'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Signe, type NomSigne } from '../../composants/signe';
import type { CategorieSprite, SpriteBibliotheque } from './sprites';

const CATEGORIES: readonly (readonly [CategorieSprite, string, NomSigne])[] = [
  ['unites', 'Unités', 'unites'], ['batiments', 'Bâtiments', 'batiments'], ['decors', 'Décors', 'decors'], ['terrains', 'Terrains', 'carte'],
];
const GROUPES = [['', 'Toutes'], ['infanterie', 'Infanterie'], ['mobiles', 'Mobiles'], ['aeriennes', 'Aériennes'], ['navales', 'Navales']] as const;
const normaliser = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');

export function Modeles({ sprites, initial }: {
  sprites: SpriteBibliotheque[];
  initial: { categorie: CategorieSprite; groupe: string; recherche: string };
}): React.ReactElement {
  const [recherche, setRecherche] = useState(initial.recherche);
  const [categorie, setCategorie] = useState(initial.categorie);
  const [groupe, setGroupe] = useState(initial.groupe);
  const memoriser = (valeurs: Record<string, string>): void => {
    const url = new URL(window.location.href);
    for (const [cle, valeur] of Object.entries(valeurs)) {
      if (valeur) url.searchParams.set(cle, valeur); else url.searchParams.delete(cle);
    }
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  };
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  const visibles = sprites.filter(s => s.categorie === categorie
    && (categorie !== 'unites' || !groupe || s.groupe === groupe)
    && mots.every(mot => normaliser(`${s.nom} ${s.variante} ${s.id}`).includes(mot)));
  return <section className="modeles-bibliotheque" aria-label="Choisir un sprite à regarder">
    <nav className="modeles-categories" aria-label="Catégories de sprites">
      {CATEGORIES.map(([cle, nom, signe]) => <button key={cle} type="button" className={`admin-action${categorie === cle ? ' admin-action-primaire' : ''}`} aria-pressed={categorie === cle} onClick={() => {
        setCategorie(cle); setGroupe(''); setRecherche(''); memoriser({ categorie: cle, groupe: '', rechercheModele: '' });
      }}><Signe nom={signe} />{nom}<small>{sprites.filter(s => s.categorie === cle).length}</small></button>)}
    </nav>
    {categorie === 'unites' ? <nav className="modeles-groupes" aria-label="Types d’unités">
      {GROUPES.map(([cle, nom]) => <button key={cle} type="button" className={`admin-action${groupe === cle ? ' admin-action-primaire' : ''}`} aria-pressed={groupe === cle} onClick={() => { setGroupe(cle); memoriser({ groupe: cle }); }}>{nom}</button>)}
    </nav> : null}
    <div className="assets-filtres"><label>Rechercher<input type="search" value={recherche} onChange={e => { setRecherche(e.target.value); memoriser({ rechercheModele: e.target.value }); }} placeholder="Nom, saison, variante…" /></label></div>
    <p className="modeles-compteur" role="status">{visibles.length} sprite(s) disponible(s)</p>
    <div className="modeles-liste">{visibles.map(s => <Link key={s.id} className="asset-carte" href={`/atelier/unites?id=${encodeURIComponent(s.id)}`}>
      <Signe nom={CATEGORIES.find(([cle]) => cle === s.categorie)?.[2] ?? 'cube'} />
      <div><small>{s.variante || GROUPES.find(([cle]) => cle === s.groupe)?.[1] || 'Image actuelle'}</small><h3>{s.nom}</h3></div>
      <span className="modele-disponibilite" data-disponible="true">Image actuelle</span>
      <span className="asset-etat">Voir l’image <b aria-hidden="true">→</b></span>
    </Link>)}</div>
    {visibles.length === 0 ? <p>Aucun sprite dans cette sélection. <button type="button" className="admin-action" onClick={() => { setRecherche(''); setGroupe(''); memoriser({ rechercheModele: '', groupe: '' }); }}>Effacer les filtres</button></p> : null}
  </section>;
}
