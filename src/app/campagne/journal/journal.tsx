'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireProgression, type Rencontre } from '../progression';
import { lireProfils } from '../../preferences';
import styles from '../depart/depart.module.css';
interface Fiche { cle: string; genre: 'unite' | 'commandant'; nom: string; texte: string; pouvoir: string; superPouvoir: string }
export default function Journal({ fiches, missions }: { fiches: Fiche[]; missions: Record<string,string> }): React.ReactElement {
  const [rencontres, setRencontres] = useState<Rencontre[]>([]), [pret, setPret] = useState(false), [nom, setNom] = useState('');
  const [filtre, setFiltre] = useState('tous');
  useEffect(() => { const lire = () => { const p = lireProfils(); setNom(p.noms[p.actif] || `Profil ${p.actif.toUpperCase()}`); setRencontres(lireProgression().rencontres ?? []); setPret(true); }; lire(); window.addEventListener('pageshow',lire); window.addEventListener('storage',lire); return () => { window.removeEventListener('pageshow',lire); window.removeEventListener('storage',lire); }; }, []);
  const visibles = rencontres.filter(r => filtre === 'tous' || filtre === r.genre || filtre === r.relation);
  return <main className={styles.page}><section className={styles.panneau}><Link className={styles.retour} href="/campagne/salon">← Camp de base</Link><p className={styles.etapes}>{nom} · Carnet de découvertes</p><h1>Journal de bord</h1><p className={styles.note}>Ce que vous avez réellement rencontré. Le brouillard garde ses secrets : une unité cachée n’entre pas dans le journal. Une même unité peut avoir été vue dans les deux camps.</p><nav aria-label="Filtrer le journal" className={styles.filtres}>{[['tous','Tout'],['unite','Unités'],['commandant','Commandants'],['adversaire','Adversaires'],['allie','Alliés']].map(([cle,label])=><button key={cle} className={styles.principal} aria-pressed={filtre===cle} onClick={()=>setFiltre(cle!)}>{label}</button>)}</nav>
    {!pret ? <p className={styles.note}>Lecture du journal…</p> : !visibles.length ? <p className={styles.note}>Aucune rencontre enregistrée dans cette rubrique. Le journal se remplit pendant vos prochaines parties, y compris lors d’une reprise. Les anciennes victoires ne révèlent pas automatiquement tous les adversaires.</p> : <div className={styles.choix}>{visibles.map(r=>{const f=fiches.find(f=>f.cle===r.cle&&f.genre===r.genre);return <article className={styles.carte} key={`${r.genre}:${r.cle}:${r.relation}`}><small>{r.genre==='unite'?'Unité':'Commandant'} · {r.relation==='allie'?'Allié':'Adversaire'}</small><strong>{f?.nom??'Rencontre enregistrée'}</strong><span>{f?.texte}</span><small>Premier contact : {missions[r.mission]??'Mission jouée'} · J{r.journee}</small>{f?.pouvoir&&<details><summary>Pouvoir et super pouvoir</summary><p>{f.pouvoir}</p><p>{f.superPouvoir}</p></details>}</article>;})}</div>}
  </section></main>;
}
