'use client';
import { useEffect, useRef, useMemo, useState } from 'react';
import { chargerCatalogue, terrainLogique, type EtatPartie } from '@/engine/index';
import { verifierProduction } from '@/engine/regles/economie';
import { nomUnite, nomTerrain } from '@/render/libelles';
import Journal from './journal';
import { donneesJournal } from './donnees';
import styles from './en-jeu.module.css';
export default function CarnetEnJeu({ fermer, etat, catalogueVersion }: { fermer: () => void; etat: EtatPartie; catalogueVersion: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [onglet, setOnglet] = useState('unites');
  const donnees = useMemo(donneesJournal, []);
  const cat = useMemo(() => chargerCatalogue(catalogueVersion), [catalogueVersion]);
  const batiments = Object.entries(etat.proprietaires).filter(([,camp])=>camp===0).map(([cle])=>{
    const [x,y]=cle.split(',').map(Number); return { x:x!, y:y!, terrain:terrainLogique(etat,cat,{x:x!,y:y!}) };
  });
  const peutAcheter = etat.campCourant === 0 && !etat.partie.terminee;
  const achats = peutAcheter ? Object.values(cat.unites).flatMap(u=>{
    const lieux = batiments.flatMap(b=>{const v=verifierProduction(etat,cat,0,b,u.cle);return v.ok?[{...b,cout:v.cout}]:[];});
    return lieux.length ? [{u,lieux,cout:lieux[0]!.cout}] : [];
  }) : [];
  useEffect(() => {
    const dialog = ref.current, avant = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (avant instanceof HTMLElement && avant.isConnected) avant.focus(); };
  }, []);
  return <dialog className={styles.carnet} ref={ref} aria-label="Carnet de campagne" onCancel={e => { e.preventDefault(); fermer(); }} onKeyDown={e => e.stopPropagation()}>
    <header className={styles.entete}><button onClick={fermer} type="button">← Jeu</button><strong>Carnet</strong><span>{(etat.camps.find(c=>c.id===0)?.fonds??0).toLocaleString('fr-FR')} fonds</span></header>
    <nav className={styles.onglets} aria-label="Rubriques">{[['unites','Unités'],['batiments','Bâtiments'],['commandants','Commandants']].map(([cle,nom])=><button key={cle} type="button" aria-pressed={onglet===cle} onClick={()=>setOnglet(cle!)}>{nom}</button>)}</nav>
    {onglet==='commandants'?<Journal {...donnees} fermer={fermer} rubrique="commandant" integre/>:<div className={styles.contenu}>
      {onglet==='unites'?<><h2>Achetables maintenant <span>{achats.length}</span></h2>
        {!achats.length?<p className={styles.vide}>{!peutAcheter?'Les achats seront disponibles pendant votre tour.':'Aucune unité achetable : vérifiez vos fonds et vos bâtiments de production libres.'}</p>:<div className={styles.grille}>{achats.map(({u,lieux,cout})=><article key={u.cle} className={styles.unite}><div className={styles.identite}><svg viewBox="0 0 40 40" aria-hidden="true"><path d={u.domaine==='air'?'M20 4 24 17 36 24 24 24 24 33 20 30 16 33 16 24 4 24 16 17Z':u.domaine==='mer'?'M4 25H36L30 34H11ZM15 12H25V24H15ZM20 5V12':u.typeMouvement==='pied'?'M20 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM14 18H26L29 27H24V36H20V28H18V36H14Z':'M6 22H34V31H6ZM12 14H25V22H12ZM25 16H38V19H25Z'} fill="currentColor"/></svg><h3>{nomUnite('fr',cat,u.cle)}</h3><b>{cout.toLocaleString('fr-FR')}</b></div><dl><div><dt>Mouvement</dt><dd>{u.mouvement}</dd></div><div><dt>Portée</dt><dd>{u.portee.join('–')}</dd></div><div><dt>Vision</dt><dd>{u.vision}</dd></div></dl><p>Produire : {[...new Set(lieux.map(b=>b.terrain?nomTerrain('fr',cat,b.terrain):''))].join(', ')}</p></article>)}</div>}</>:<><h2>Vos bâtiments</h2><p className={styles.vide}>Les bâtiments se capturent, ils ne s’achètent pas.</p><div className={styles.grille}>{batiments.map(b=><article key={`${b.x},${b.y}`} className={styles.unite}><h3>{b.terrain?nomTerrain('fr',cat,b.terrain):'Bâtiment'}</h3><p>Case {b.x+1} · {b.y+1}</p><span>{peutAcheter?`${Object.values(cat.unites).filter(u=>verifierProduction(etat,cat,0,b,u.cle).ok).length} unités achetables`:'Hors de votre tour'}</span></article>)}</div></>}
    </div>}
  </dialog>;
}
