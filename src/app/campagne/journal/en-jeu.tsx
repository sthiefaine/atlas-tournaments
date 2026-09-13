'use client';
import { useEffect, useRef, useMemo, useState } from 'react';
import { chargerCatalogue, terrainLogique, type EtatPartie } from '@/engine/index';
import { verifierProduction } from '@/engine/regles/economie';
import { nomUnite, nomTerrain } from '@/render/libelles';
import { ficheUnite } from '@/render/fiche-unite';
import type { CleUnite, CodePays } from '@/schemas/types';
import Journal from './journal';
import { donneesJournal } from './donnees';
import ApercuUnite from './apercu-unite';
import styles from './en-jeu.module.css';

const montant = (n: number) => n.toLocaleString('fr-FR');
export default function CarnetEnJeu({ fermer, etat, catalogueVersion, pays, surProduire }: {
  fermer: () => void; etat: EtatPartie; catalogueVersion: number; pays?: CodePays | null;
  surProduire?: (unite: CleUnite, batiment: { x: number; y: number }) => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [onglet, setOnglet] = useState('unites');
  const [selection, setSelection] = useState<string>('');
  const [lieuChoisi, setLieuChoisi] = useState('');
  const [famille, setFamille] = useState('tout');
  const [erreur, setErreur] = useState('');
  const donnees = useMemo(donneesJournal, []);
  const cat = useMemo(() => chargerCatalogue(catalogueVersion), [catalogueVersion]);
  const batiments = Object.entries(etat.proprietaires).filter(([, camp]) => camp === 0).map(([cle]) => {
    const [x, y] = cle.split(',').map(Number);
    return { cle, x: x!, y: y!, terrain: terrainLogique(etat, cat, { x: x!, y: y! }) };
  });
  const peutAcheter = etat.campCourant === 0 && !etat.partie.terminee;
  const achats = peutAcheter ? Object.values(cat.unites).flatMap(u => {
    const lieux = batiments.flatMap(b => { const v = verifierProduction(etat, cat, 0, b, u.cle); return v.ok ? [{ ...b, cout: v.cout }] : []; });
    return lieux.length ? [{ u, lieux, cout: lieux[0]!.cout }] : [];
  }) : [];
  const liste = achats.filter(a => famille === 'tout' || a.u.domaine === famille);
  const choisi = liste.find(a => a.u.cle === selection) ?? liste[0];
  const lieu = choisi?.lieux.find(b => b.cle === lieuChoisi) ?? choisi?.lieux[0];
  const fiche = choisi ? ficheUnite(cat, choisi.u.cle) : null;
  const batiment = batiments.find(b => b.cle === lieuChoisi) ?? batiments[0];
  const fonds = etat.camps.find(c => c.id === 0)?.fonds ?? 0;
  useEffect(() => {
    const dialog = ref.current, avant = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (avant instanceof HTMLElement && avant.isConnected) avant.focus(); };
  }, []);
  const nomBatiment = (b: typeof batiments[number]) => b.terrain ? nomTerrain('fr', cat, b.terrain) : 'Bâtiment';
  return <dialog className={styles.carnet} ref={ref} aria-label="Carnet de campagne" onCancel={e => { e.preventDefault(); fermer(); }} onKeyDown={e => e.stopPropagation()}>
    <header className={styles.entete}><button onClick={fermer} type="button">← Jeu</button><strong>Carnet</strong><span className={styles.fonds}><small>Fonds disponibles</small>{montant(fonds)}</span></header>
    <nav className={styles.onglets} aria-label="Rubriques">{[['unites', 'Unités'], ['batiments', 'Bâtiments'], ['commandants', 'Commandants']].map(([cle, nom]) => <button key={cle} type="button" aria-pressed={onglet === cle} onClick={() => setOnglet(cle!)}>{nom}</button>)}</nav>
    {onglet === 'commandants' ? <div className={styles.commandants}><Journal {...donnees} fermer={fermer} rubrique="commandant" integre /></div> : <div className={styles.arsenal}>
      <aside className={styles.liste}>
        <div className={styles.titreListe}><span>{onglet === 'unites' ? 'Acheter une unité' : 'Vos bâtiments'}</span><b>{onglet === 'unites' ? liste.length : batiments.length}</b></div>
        {onglet === 'unites' && <div className={styles.filtres} aria-label="Milieu">{[['tout', 'Tout'], ['terre', 'Terre'], ['air', 'Air'], ['mer', 'Mer']].map(([cle, label]) => <button key={cle} aria-pressed={famille === cle} onClick={() => setFamille(cle!)}>{label}</button>)}</div>}
        <div className={styles.choix}>
          {onglet === 'unites' ? liste.map(({ u, cout }) => <button type="button" key={u.cle} className={styles.ligne} aria-pressed={choisi?.u.cle === u.cle} onClick={() => setSelection(u.cle)}><span className={styles.fleche} aria-hidden="true">▸</span><span>{nomUnite('fr', cat, u.cle)}</span><b>{montant(cout)}</b></button>) : batiments.map(b => <button type="button" key={b.cle} className={styles.ligne} aria-pressed={batiment?.cle === b.cle} onClick={() => setLieuChoisi(b.cle)}><span className={styles.fleche} aria-hidden="true">▸</span><span>{nomBatiment(b)}</span><b>{b.x + 1} : {b.y + 1}</b></button>)}
          {onglet === 'unites' && !liste.length && <p className={styles.vide}>{!peutAcheter ? 'Production disponible à votre tour.' : famille !== 'tout' && achats.length ? 'Aucune unité disponible dans ce milieu.' : 'Aucun achat possible. Il faut des fonds et un bâtiment de production libre.'}</p>}
          {onglet === 'batiments' && !batiments.length && <p className={styles.vide}>Aucun bâtiment sous votre contrôle.</p>}
        </div>
      </aside>
      <section className={styles.detail} aria-label="Fiche sélectionnée">
        {onglet === 'unites' && choisi && fiche ? <>
          <header className={styles.identite}><div><small>{fiche.guide?.role ?? 'Unité'}</small><h2>{nomUnite('fr', cat, choisi.u.cle)}</h2></div><strong>{montant(lieu?.cout ?? choisi.cout)}<small>fonds</small></strong></header>
          <div className={styles.modele}><ApercuUnite unite={choisi.u.cle} pays={pays} camp={0} nom={nomUnite('fr', cat, choisi.u.cle)} /></div>
          <div className={styles.chiffres}>{[['Mouvement', fiche.mouvement], ['Portée', fiche.portee[0] === fiche.portee[1] ? fiche.portee[0] : fiche.portee.join('–')], ['Vision', fiche.vision], ['Munitions', fiche.munitions ?? '—']].map(([nom, valeur]) => <div key={nom}><small>{nom}</small><strong>{valeur}</strong></div>)}</div>
          {fiche.guide && <p className={styles.role}>{fiche.guide.achat}</p>}
          <div className={styles.duels}>{([['Efficace contre', fiche.forte], ['Vulnérable face à', fiche.craint]] as const).map(([titre, lignes]) => <div key={titre}><h3>{titre}</h3>{lignes.length ? lignes.map(d => <span key={d.unite}>{nomUnite('fr', cat, d.unite)}<b>{d.degats}%</b></span>) : <span>—</span>}</div>)}</div>
          <footer className={styles.achat}><label>Produire à<select value={lieu?.cle ?? ''} onChange={e => setLieuChoisi(e.target.value)}>{choisi.lieux.map(b => <option value={b.cle} key={b.cle}>{nomBatiment(b)} · {b.x + 1}:{b.y + 1}</option>)}</select></label><button className={styles.produire} type="button" disabled={!surProduire || !lieu} onClick={() => { if (lieu && surProduire) { if (surProduire(choisi.u.cle, { x: lieu.x, y: lieu.y })) fermer(); else setErreur('Achat indisponible : revenez au jeu pour terminer l’action en cours.'); } }}>Produire <b>{montant(lieu?.cout ?? choisi.cout)}</b><span aria-hidden="true">→</span></button><small>Solde après achat : {montant(fonds - (lieu?.cout ?? choisi.cout))}</small>{erreur && <p role="status" className={styles.erreur}>{erreur}</p>}</footer>
        </> : onglet === 'batiments' && batiment ? <>
          <header className={styles.identite}><div><small>Sous votre contrôle</small><h2>{nomBatiment(batiment)}</h2></div><strong>{batiment.x + 1}:{batiment.y + 1}<small>case</small></strong></header>
          <div className={styles.modele}><ApercuUnite batiment={batiment.terrain ?? undefined} pays={pays} camp={0} nom={nomBatiment(batiment)} /></div>
          <div className={styles.productionBatiment}><h3>Produire ici</h3>{achats.filter(a => a.lieux.some(b => b.cle === batiment.cle)).map(a => <button className={styles.ligne} key={a.u.cle} onClick={() => { setSelection(a.u.cle); setFamille('tout'); setOnglet('unites'); }}><span>{nomUnite('fr', cat, a.u.cle)}</span><b>{montant(a.lieux.find(b => b.cle === batiment.cle)!.cout)}</b><span aria-hidden="true">→</span></button>)}{!achats.some(a => a.lieux.some(b => b.cle === batiment.cle)) && <p className={styles.vide}>Aucun achat disponible ici pour le moment.</p>}</div>
        </> : <div className={styles.attente}><span aria-hidden="true">＋</span><p>Vos unités disponibles apparaissent à gauche.</p></div>}
      </section>
    </div>}
  </dialog>;
}
