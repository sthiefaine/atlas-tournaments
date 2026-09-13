'use client';
import Link from 'next/link';
import { useState } from 'react';
interface Modele { id: string; nom: string; type: string; categorie: string; groupe: string }
const CATEGORIES = [['unites', 'Unités'], ['batiments', 'Bâtiments'], ['commandants', 'Commandants'], ['decors', 'Décors']] as const;
const GROUPES = [['', 'Toutes'], ['infanterie', 'Infanterie'], ['mobiles', 'Mobiles'], ['aeriennes', 'Aériennes'], ['navales', 'Navales'], ['autres', 'Autres']] as const;
export function Modeles({ modeles }: { modeles: Modele[] }): React.ReactElement {
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('unites');
  const [groupe, setGroupe] = useState('');
  const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visibles = modeles.filter(m => m.categorie === categorie && (categorie !== 'unites' || !groupe || m.groupe === groupe) && normaliser(`${m.nom} ${m.id}`).includes(normaliser(recherche)));
  return <section aria-label="Choisir un modèle à modifier">
    <nav className="admin-actions" aria-label="Catégories d’assets">
      {CATEGORIES.map(([cle, nom]) => <button key={cle} type="button" className={`admin-action${categorie === cle ? ' admin-action-primaire' : ''}`} aria-pressed={categorie === cle} onClick={() => { setCategorie(cle); setGroupe(''); setRecherche(''); }}>{nom}</button>)}
    </nav>
    {categorie === 'unites' && <nav className="admin-actions" aria-label="Types d’unités">
      {GROUPES.map(([cle, nom]) => <button key={cle} type="button" className={`admin-action${groupe === cle ? ' admin-action-primaire' : ''}`} aria-pressed={groupe === cle} onClick={() => setGroupe(cle)}>{nom}</button>)}
    </nav>}
    <div className="assets-filtres"><label>Rechercher<input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={`Rechercher dans ${CATEGORIES.find(([cle]) => cle === categorie)?.[1].toLowerCase()}…`} /></label></div>
    <div className="assets-grille">{visibles.map(m => <Link key={m.id} className="asset-carte" href={`/admin/assets/${m.id}`}><small>{m.categorie === 'unites' ? GROUPES.find(([cle]) => cle === m.groupe)?.[1] : m.type}</small><h3>{m.nom}</h3><span className="asset-etat">Modifier le GLB →</span></Link>)}</div>
    {!visibles.length && <p role="status">Aucun modèle dans cette sélection.</p>}
  </section>;
}
