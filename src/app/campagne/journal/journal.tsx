'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireProgression, type Rencontre } from '../progression';
import styles from './journal.module.css';
interface Fiche { cle: string; genre: 'unite' | 'commandant'; nom: string; texte: string; pouvoir: string; superPouvoir: string }
export default function Journal({ fiches, missions }: { fiches: Fiche[]; missions: Record<string,string> }): React.ReactElement {
  const [rencontres, setRencontres] = useState<Rencontre[]>([]);
  const [pret, setPret] = useState(false);
  const [retour, setRetour] = useState('/campagne/salon');
  const [filtre, setFiltre] = useState('unite');
  const [selection, setSelection] = useState('');
  useEffect(() => {
    const destination = new URLSearchParams(window.location.search).get('retour');
    if (destination && /^\/jeu\/[a-z0-9_]+$/.test(destination)) setRetour(destination);
    const lire = () => { setRencontres(lireProgression().rencontres ?? []); setPret(true); };
    lire(); window.addEventListener('pageshow', lire); window.addEventListener('storage', lire);
    return () => { window.removeEventListener('pageshow', lire); window.removeEventListener('storage', lire); };
  }, []);
  const visibles = rencontres.filter(r => r.genre === filtre);
  const identite = (r: Rencontre) => `${r.genre}:${r.cle}:${r.relation}`;
  const active = visibles.find(r => identite(r) === selection) ?? visibles[0];
  const fiche = active && fiches.find(f => f.cle === active.cle && f.genre === active.genre);
  return <main className={styles.page}>
    <header className={styles.entete}>
      <Link className={styles.retour} href={retour}>← {retour.startsWith('/jeu/') ? 'Retour au jeu' : 'Retour'}</Link>
      <h1>Carnet de bord</h1>
    </header>
    <nav className={styles.onglets} aria-label="Rubriques du carnet">
      {([['unite', 'Unités'], ['commandant', 'Commandants']] as const).map(([cle, nom]) => <button key={cle} type="button" aria-pressed={filtre === cle} onClick={() => { setFiltre(cle); setSelection(''); }}>{nom}</button>)}
    </nav>
    {!pret ? <p className={styles.vide}>Ouverture du carnet…</p> : !active ? <p className={styles.vide}>Vos rencontres apparaîtront ici au fil des missions.</p> : <div className={styles.contenu}>
      <nav className={styles.liste} aria-label="Rencontres">
        {visibles.map(r => { const f = fiches.find(f => f.cle === r.cle && f.genre === r.genre); return <button key={identite(r)} type="button" aria-pressed={identite(r) === identite(active)} onClick={() => setSelection(identite(r))}><strong>{f?.nom ?? 'Rencontre'}</strong><span>{r.relation === 'allie' ? 'Allié' : 'Adversaire'}</span></button>; })}
      </nav>
      <article className={styles.fiche} aria-live="polite">
        <p className={styles.categorie}>{active.relation === 'allie' ? 'Allié' : 'Adversaire'}</p>
        <h2>{fiche?.nom ?? 'Rencontre'}</h2>
        <p>{fiche?.texte}</p>
        {fiche?.pouvoir && <section><h3>Pouvoir</h3><p>{fiche.pouvoir}</p></section>}
        {fiche?.superPouvoir && <section><h3>Super pouvoir</h3><p>{fiche.superPouvoir}</p></section>}
        <footer>Rencontré dans {missions[active.mission] ?? 'une mission'} · Jour {active.journee}</footer>
      </article>
    </div>}
  </main>;
}
