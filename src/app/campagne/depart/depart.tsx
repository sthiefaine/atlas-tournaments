'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PROFILS, lireProfils, changerProfilActif, renommerProfil, normaliserNomProfil, NOM_PROFIL_MAX, ecrireDifficulte, modeDifficileDebloque, type EtatProfils, type Profil } from '../../preferences';
import { victoiresDe } from '../progression';
import styles from './menu.module.css';
import { Theatre } from './theatre';

export default function Depart(): React.ReactElement {
  const router = useRouter();
  const [profils, setProfils] = useState<EtatProfils | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [etape, setEtape] = useState<'profil' | 'nom' | 'mode'>('profil');
  const [nom, setNom] = useState('');
  const [mode, setMode] = useState<'normal' | 'difficile'>('normal');
  const [departEnCours, setDepartEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [victoires, setVictoires] = useState({ a: 0, b: 0 });
  const [debloques, setDebloques] = useState({ a: false, b: false });
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const lire = () => { setProfils(lireProfils()); setVictoires({ a: victoiresDe('a').length, b: victoiresDe('b').length }); setDebloques({ a: modeDifficileDebloque('a'), b: modeDifficileDebloque('b') }); };
    lire(); window.addEventListener('pageshow', lire); window.addEventListener('storage', lire);
    return () => { window.removeEventListener('pageshow', lire); window.removeEventListener('storage', lire); };
  }, []);
  useEffect(() => { titre.current?.focus(); }, [etape]);
  const choisir = (p: Profil) => { setErreur(''); setMode('normal'); setProfil(p); setNom(profils?.noms[p] ?? ''); setEtape(profils?.noms[p] ? 'mode' : 'nom'); };
  const partir = (mode: 'normal' | 'difficile') => {
    if (!profil || departEnCours) return;
    if (mode === 'difficile' && !modeDifficileDebloque(profil)) { setErreur('Terminez la campagne en normal pour débloquer ce mode.'); return; }
    if (!ecrireDifficulte(profil, mode) || !changerProfilActif(profil)) { setErreur('Le navigateur refuse de sauvegarder ce profil. Autorisez le stockage local pour continuer.'); return; }
    setDepartEnCours(true);
    router.push('/campagne/salon');
  };
  const nomProfil = profil ? profils?.noms[profil] || `Profil ${profil.toUpperCase()}` : '';
  const retour = () => { if (departEnCours) return; setEtape('profil'); setErreur(''); };
  return <main className={styles.page} onKeyDown={e => { if (e.key === 'Escape' && etape !== 'profil') { e.preventDefault(); retour(); } }}>
    <header className={styles.barre}>
      <Link href="/" className={styles.marque} aria-label="Atlas Tournament — accueil">ATLAS<span>TOURNAMENT</span></Link>
      <span className={styles.rubrique}>CAMPAGNE</span>
      <Link href="/" className={styles.quitter}>Quitter <span aria-hidden="true">×</span></Link>
    </header>
    <div className={styles.scene}>
      <aside className={styles.theatre} aria-hidden="true"><div className={styles.halo} /><p className={styles.surtitre}>À vous de commander</p><h2>CHAQUE CHOIX<br/><em>COMPTE.</em></h2><Theatre/><div className={styles.coordonnees}><span>FORMATION → SAISON 1</span><i/><span>VOTRE AVENTURE</span></div></aside>
      <section className={styles.console}>
        <ol className={styles.etapes} aria-label="Étapes du départ"><li data-actif={etape !== 'mode'}>01 <span>Sauvegarde</span></li><li data-actif={etape === 'mode'}>02 <span>Difficulté</span></li><li>03 <span>Camp de base</span></li></ol>
        <div className={styles.entete}><p>{etape === 'profil' ? 'CHOISIR UNE SAUVEGARDE' : etape === 'nom' ? 'NOUVEAU PROFIL' : nomProfil}</p><h1 ref={titre} tabIndex={-1}>{etape === 'profil' ? 'Votre campagne' : etape === 'nom' ? 'Votre nom ?' : 'Votre défi'}</h1></div>
        {etape === 'profil' && <div className={styles.sauvegardes}>{PROFILS.map((p, i) => <button key={p} disabled={!profils} onClick={() => choisir(p)} className={styles.slot}>
          <span className={styles.numero}>0{i + 1}</span><span className={styles.slotTexte}><small>{profils && victoires[p] > 0 ? 'PARTIE EN COURS' : 'NOUVELLE PARTIE'}</small><strong>{profils?.noms[p] || `Profil ${p.toUpperCase()}`}</strong><span>{!profils ? 'Chargement…' : victoires[p] ? `${victoires[p]} missions remportées` : 'Le voyage commence ici'}</span>{debloques[p] && <b>Difficile débloqué</b>}</span><span className={styles.fleche} aria-hidden="true">→</span>
        </button>)}</div>}
        {etape === 'nom' && <form id="nom-campagne" onSubmit={e => { e.preventDefault(); if (!profil) return; const propre = normaliserNomProfil(nom); if (!propre) { setErreur('Entrez un nom ou choisissez « Plus tard ».'); return; } if (!renommerProfil(profil, propre)) { setErreur('Impossible d’enregistrer le nom sur cet appareil.'); return; } setProfils(lireProfils()); setErreur(''); setEtape('mode'); }}>
          <label className={styles.nom}>Nom de sauvegarde<input value={nom} maxLength={NOM_PROFIL_MAX} autoComplete="nickname" onChange={e => setNom(e.target.value)} placeholder="Votre nom" /></label><p className={styles.aide}>Modifiable à tout moment dans les réglages.</p>
        </form>}
        {etape === 'mode' && <><div className={styles.modes} role="group" aria-label="Difficulté">
          <button className={styles.mode} aria-pressed={mode === 'normal'} disabled={departEnCours} onClick={() => setMode('normal')}><span className={styles.grade} aria-hidden="true">◆</span><span><strong>Normal</strong><small>L’aventure Atlas, dès les premiers ordres.</small></span><i aria-hidden="true">{mode === 'normal' ? '✓' : ''}</i></button>
          <button className={styles.mode} aria-pressed={mode === 'difficile'} disabled={departEnCours || !profil || !debloques[profil]} aria-describedby="condition-difficile" onClick={() => setMode('difficile')}><span className={styles.grade} aria-hidden="true">◆◆</span><span><strong>Difficile</strong><small>{profil && debloques[profil] ? 'Des adversaires mieux équipés.' : 'VERROUILLÉ'}</small></span><i aria-hidden="true">{profil && debloques[profil] ? mode === 'difficile' ? '✓' : '' : '⊘'}</i></button>
        </div><p id="condition-difficile" className={styles.verrou}>Difficile : terminez la campagne entière en Normal avec ce profil.</p></>}
        {erreur && <p role="alert" className={styles.erreur}>{erreur}</p>}
        <footer className={styles.actions}>
          {etape === 'profil' ? <p className={styles.aide}>Deux sauvegardes indépendantes sur cet appareil.</p> : <button disabled={departEnCours} className={styles.retour} onClick={retour}>← Retour</button>}
          {etape === 'nom' && <><button className={styles.retour} onClick={() => { setErreur(''); setEtape('mode'); }}>Plus tard</button><button className={styles.confirmer} type="submit" form="nom-campagne">Valider <span>→</span></button></>}
          {etape === 'mode' && <button className={styles.confirmer} disabled={departEnCours} onClick={() => partir(mode)}>{departEnCours ? 'Ouverture…' : 'Entrer au camp'} <span aria-hidden="true">→</span></button>}
        </footer>
      </section>
    </div>
    <footer className={styles.bas}><span>ATLAS / CAMPAGNE</span><span>Votre progression reste sur cet appareil</span></footer>
  </main>;
}
