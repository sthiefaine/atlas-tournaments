'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireProfils, lireDifficulte } from '../../preferences';
import styles from '../depart/depart.module.css';
export default function Salon(): React.ReactElement {
  const [nom, setNom] = useState('Votre campagne'), [mode, setMode] = useState('Normal');
  useEffect(() => { const p = lireProfils(); setNom(p.noms[p.actif] || `Profil ${p.actif.toUpperCase()}`); setMode(lireDifficulte() === 'normal' ? 'Normal' : 'Difficile'); }, []);
  return <main className={styles.page}><div className={styles.fond} aria-hidden="true"/><section className={styles.panneau}><Link className={styles.retour} href="/">← Accueil</Link><p className={styles.etapes}>{nom} · {mode}</p><h1>Votre camp de base</h1><p className={styles.note}>Votre prochaine mission vous attend.</p><div className={styles.choix}><Link className={styles.carte} href="/campagne"><span className={styles.insigne}>▶</span><strong>Continuer</strong><span>Ouvrir la carte de campagne et choisir votre prochaine mission.</span><b>Reprendre l’aventure →</b></Link></div><Link href="/campagne/depart" className={styles.retour}>Changer de profil ou de difficulté</Link></section></main>;
}
