'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PROFILS, lireProfils, changerProfilActif, renommerProfil, normaliserNomProfil, NOM_PROFIL_MAX, ecrireDifficulte, modeDifficileDebloque, type EtatProfils, type Profil } from '../../preferences';
import { victoiresDe } from '../progression';
import styles from './depart.module.css';

export default function Depart(): React.ReactElement {
  const router = useRouter();
  const [profils, setProfils] = useState<EtatProfils | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [etape, setEtape] = useState<'profil' | 'nom' | 'mode'>('profil');
  const [nom, setNom] = useState('');
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
  const choisir = (p: Profil) => { setErreur(''); setProfil(p); setNom(profils?.noms[p] ?? ''); setEtape(profils?.noms[p] ? 'mode' : 'nom'); };
  const partir = (mode: 'normal' | 'difficile') => {
    if (!profil) return;
    if (mode === 'difficile' && !modeDifficileDebloque(profil)) { setErreur('Terminez la campagne en normal pour débloquer ce mode.'); return; }
    if (!ecrireDifficulte(profil, mode) || !changerProfilActif(profil)) { setErreur('Le navigateur refuse de sauvegarder ce profil. Autorisez le stockage local pour continuer.'); return; }
    router.push('/campagne');
  };
  const nomProfil = profil ? profils?.noms[profil] || `Profil ${profil.toUpperCase()}` : '';
  return <main className={styles.page}><div className={styles.fond} aria-hidden="true" /><section className={styles.panneau}>
    <Link href="/" className={styles.retour}>← Accueil</Link>
    <p className={styles.etapes}>01 Profil <span>→</span> 02 Difficulté <span>→</span> 03 Campagne</p>
    <h1 ref={titre} tabIndex={-1}>{etape === 'profil' ? 'Qui prend le commandement ?' : etape === 'nom' ? 'Comment vous appelle-t-on ?' : 'Choisissez votre défi'}</h1>
    <p className={styles.note}>{etape === 'profil' ? 'Deux aventures indépendantes, sauvegardées sur cet appareil.' : etape === 'nom' ? 'Donnez un nom à votre sauvegarde. Vous pourrez le modifier dans les réglages.' : `${nomProfil} · Votre progression est conservée séparément dans chaque mode.`}</p>
    {etape === 'profil' && <div className={styles.choix}>{PROFILS.map((p, i) => <button key={p} disabled={!profils} onClick={() => choisir(p)} className={styles.carte}><span className={styles.insigne}>{i + 1}</span><strong>{profils?.noms[p] || `Profil ${p.toUpperCase()}`}</strong><span>{!profils ? 'Lecture de la sauvegarde…' : victoires[p] ? `${victoires[p]} missions remportées` : 'Une nouvelle aventure'}</span><small>{debloques[p] ? 'Normal + Difficile débloqué' : 'Mode normal'}</small><b>Choisir →</b></button>)}</div>}
    {etape === 'nom' && <form onSubmit={e => { e.preventDefault(); if (!profil) return; const propre = normaliserNomProfil(nom); if (!propre) { setErreur('Entrez un nom, ou continuez sans nom.'); return; } if (!renommerProfil(profil, propre)) { setErreur('Le nom n’a pas pu être enregistré.'); return; } setProfils(lireProfils()); setErreur(''); setEtape('mode'); }}>
      <label className={styles.nom}>Nom du profil<input value={nom} maxLength={NOM_PROFIL_MAX} autoComplete="nickname" onChange={e => setNom(e.target.value)} placeholder="Votre nom de commandant" /></label><button className={styles.principal} type="submit">Enregistrer et continuer →</button><button className={styles.retour} type="button" onClick={() => { setErreur(''); setEtape('mode'); }}>Continuer sans nom</button>
    </form>}
    {etape === 'mode' && <><div className={styles.choix}><button className={styles.carte} onClick={() => partir('normal')}><span className={styles.insigne}>N</span><strong>Normal</strong><span>Découvrez l’histoire, préparez vos attaques et faites vos choix.</span><b>Ouvrir la carte →</b></button><button className={styles.carte} disabled={!profil || !debloques[profil]} aria-describedby="condition-difficile" onClick={() => partir('difficile')}><span className={styles.insigne}>{profil && debloques[profil] ? 'D' : '🔒'}</span><strong>Difficile</strong><span>Des adversaires mieux équipés. Chaque placement compte.</span><b>{profil && debloques[profil] ? 'Ouvrir la carte →' : 'Verrouillé'}</b></button></div><p id="condition-difficile" className={styles.note}>Remportez la finale de la campagne en mode normal avec ce profil pour débloquer Difficile. Les tutoriels et la saison 1 seule ne suffisent pas.</p></>}
    {erreur && <p role="alert" className={styles.erreur}>{erreur}</p>}
    {etape !== 'profil' && <button className={styles.retour} onClick={() => { setEtape('profil'); setErreur(''); }}>← Changer de profil</button>}
  </section></main>;
}
