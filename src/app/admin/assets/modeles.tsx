'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Signe, type NomSigne } from '../../composants/signe';
interface Modele { id: string; nom: string; type: string; categorie: string; groupe: string; disponible?: boolean }
const CATEGORIES = [['unites', 'Unités'], ['batiments', 'Bâtiments'], ['commandants', 'Commandants'], ['decors', 'Décors']] as const;
const GROUPES = [['', 'Toutes'], ['infanterie', 'Infanterie'], ['mobiles', 'Mobiles'], ['aeriennes', 'Aériennes'], ['navales', 'Navales'], ['autres', 'Autres']] as const;
export function Modeles({ modeles, initial }: { modeles: Modele[]; initial?: { categorie: string; groupe: string; recherche: string; disponibilite: string } }): React.ReactElement {
  const [recherche, setRecherche] = useState(initial?.recherche ?? '');
  const [categorie, setCategorie] = useState(initial?.categorie ?? 'unites');
  const [groupe, setGroupe] = useState(initial?.groupe ?? '');
  const [disponibilite, setDisponibilite] = useState(initial?.disponibilite ?? '');
  const memoriser = (valeurs: Record<string, string>) => { const url = new URL(window.location.href); for (const [cle, valeur] of Object.entries(valeurs)) { if (valeur) url.searchParams.set(cle, valeur); else url.searchParams.delete(cle); } window.history.replaceState(window.history.state, '', url.pathname + url.search); };
  const signes: Record<string, NomSigne> = { unites: 'unites', batiments: 'batiments', commandants: 'commandants', decors: 'decors' };
  const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visibles = modeles.filter(m => m.categorie === categorie && (categorie !== 'unites' || !groupe || m.groupe === groupe) && (!disponibilite || Boolean(m.disponible) === (disponibilite === 'disponibles')) && normaliser(`${m.nom} ${m.id}`).includes(normaliser(recherche)));
  return <section className="modeles-bibliotheque" aria-label="Choisir un modèle à modifier">
    <nav className="modeles-categories" aria-label="Catégories d’assets">
      {CATEGORIES.map(([cle, nom]) => <button key={cle} type="button" className={`admin-action${categorie === cle ? ' admin-action-primaire' : ''}`} aria-pressed={categorie === cle} onClick={() => { setCategorie(cle); setGroupe(''); setRecherche(''); memoriser({ categorie: cle, groupe: '', rechercheModele: '' }); }}><Signe nom={signes[cle]!} />{nom}<small>{modeles.filter(m => m.categorie === cle).length}</small></button>)}
    </nav>
    {categorie === 'unites' && <nav className="modeles-groupes" aria-label="Types d’unités">
      {GROUPES.map(([cle, nom]) => <button key={cle} type="button" className={`admin-action${groupe === cle ? ' admin-action-primaire' : ''}`} aria-pressed={groupe === cle} onClick={() => { setGroupe(cle); memoriser({ groupe: cle }); }}>{nom}</button>)}
    </nav>}
    <div className="assets-filtres"><label>Rechercher<input type="search" value={recherche} onChange={e => { setRecherche(e.target.value); memoriser({ rechercheModele: e.target.value }); }} placeholder={`Rechercher dans ${CATEGORIES.find(([cle]) => cle === categorie)?.[1].toLowerCase()}…`} /></label><label>Fichiers<select value={disponibilite} onChange={e => { setDisponibilite(e.target.value); memoriser({ disponibilite: e.target.value }); }}><option value="">Tous</option><option value="disponibles">Lot disponible</option><option value="manquants">À produire</option></select></label></div>
    <p className="modeles-compteur" role="status">{visibles.length} modèles</p>
    <div className="modeles-liste">{visibles.map(m => <Link key={m.id} className="asset-carte" href={`/admin/assets/${m.id}`}><Signe nom={signes[m.categorie] ?? 'cube'} /><div><small>{m.categorie === 'unites' ? GROUPES.find(([cle]) => cle === m.groupe)?.[1] : m.type}</small><h3>{m.nom}</h3></div><span className="modele-disponibilite" data-disponible={Boolean(m.disponible)}>{m.disponible ? 'Lot disponible' : 'À produire'}</span><span className="asset-etat">Ouvrir <b aria-hidden="true">→</b></span></Link>)}</div>
    {!visibles.length && <p>Aucun modèle dans cette sélection. <button type="button" className="admin-action" onClick={() => { setRecherche(''); setGroupe(''); setDisponibilite(''); memoriser({ rechercheModele: '', groupe: '', disponibilite: '' }); }}>Effacer les filtres</button></p>}
  </section>;
}
