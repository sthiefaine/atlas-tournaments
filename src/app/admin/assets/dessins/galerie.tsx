'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { DessinReference, DomaineDessin, FamilleDessin } from './types';
import styles from './dessins.module.css';

const FAMILLES: readonly (readonly [FamilleDessin | '', string])[] = [
  ['', 'Toutes les familles'], ['unite', 'Unités'], ['batiment', 'Bâtiments'], ['decor', 'Décors'], ['terrain', 'Terrains'],
];
const DOMAINES: readonly (readonly [DomaineDessin | '', string])[] = [
  ['', 'Tous les domaines'], ['terre', 'Terre'], ['air', 'Air'], ['mer', 'Mer'],
];
const TAILLES = [['48', '48 px'], ['64', '64 px'], ['128', '128 px'], ['grand', 'Grand']] as const;
type Taille = typeof TAILLES[number][0];
const normaliser = (texte: string): string => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');

function CarteDessin({ dessin }: { dessin: DessinReference }) {
  const [imageAbsente, setImageAbsente] = useState(false);
  const present = dessin.disponible && !imageAbsente;
  const url = `/api/admin/assets/dessins/${encodeURIComponent(dessin.id)}?v=${encodeURIComponent(dessin.revision)}`;
  const statut = present ? dessin.statut === 'pilote_reutilise' ? 'Pilote de référence' : 'Dessin de référence'
    : dessin.statut === 'a_dessiner' && !imageAbsente ? 'À dessiner' : 'Fichier indisponible';
  const famille = FAMILLES.find(([cle]) => cle === dessin.famille)?.[1] ?? '';
  const domaine = DOMAINES.find(([cle]) => cle === dessin.domaine)?.[1];
  return <li className={styles.carte}>
    <div className={styles.apercu}>
      {present ? <a className={styles.imageLien} href={url} target="_blank" rel="noreferrer" aria-label={`Ouvrir le dessin de ${dessin.nom} en grand, dans un nouvel onglet`}>
        {/* Le PNG privé exige le cookie de session ; pas de proxy d'optimisation public. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Dessin de référence : ${dessin.nom}`} width={320} height={320} loading="lazy" decoding="async" onError={() => setImageAbsente(true)} />
      </a> : <div className={styles.attente}>
        <span aria-hidden="true" className={styles.marqueAttente}>—</span>
        <span>{dessin.statut === 'a_dessiner' && !imageAbsente ? 'Dessin à venir' : 'Image non disponible'}</span>
      </div>}
    </div>
    <div className={styles.legende}>
      <p className={styles.famille}>{famille}{domaine ? ` · ${domaine}` : ''}</p>
      <h3>{dessin.nom}</h3>
      <p className={styles.statut} data-present={present}>{statut}</p>
      {present ? <a className={styles.telecharger} href={`${url}&telecharger=1`} download={`${dessin.id}.png`} aria-label={`Télécharger ${dessin.nom} en PNG`}>Télécharger le PNG <span aria-hidden="true">↓</span></a> : null}
    </div>
  </li>;
}

export function GalerieDessins({ dessins }: { dessins: DessinReference[] }) {
  const router = useRouter();
  const [actualisation, startTransition] = useTransition();
  const [tentative, setTentative] = useState(0);
  const [famille, setFamille] = useState<FamilleDessin | ''>('');
  const [domaine, setDomaine] = useState<DomaineDessin | ''>('');
  const [recherche, setRecherche] = useState('');
  const [taille, setTaille] = useState<Taille>('grand');
  const [fond, setFond] = useState<'clair' | 'sombre'>('clair');
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  const visibles = dessins.filter(d => (!famille || d.famille === famille) && (!domaine || d.domaine === domaine)
    && mots.every(mot => normaliser(`${d.nom} ${d.cle} ${d.id}`).includes(mot)));
  const presents = dessins.filter(d => d.disponible).length;

  return <section className={styles.galerie} data-fond={fond} data-taille={taille} aria-label="Collection de dessins">
    <div className={styles.bilan}>
      <p><strong>{presents}</strong> dessin{presents > 1 ? 's' : ''} disponible{presents > 1 ? 's' : ''}<span> sur {dessins.length} références prévues</span></p>
      <button type="button" className={styles.actualiser} disabled={actualisation} onClick={() => { setTentative(t => t + 1); startTransition(() => router.refresh()); }}>{actualisation ? 'Actualisation…' : 'Actualiser'}</button>
    </div>
    <div className={styles.filtres}>
      <label className={styles.recherche}>Rechercher un dessin
        <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Infanterie, QG, forêt…" />
      </label>
      <label>Famille
        <select value={famille} onChange={e => { setFamille(e.target.value as FamilleDessin | ''); setDomaine(''); }}>
          {FAMILLES.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </select>
      </label>
      <label>Domaine des unités
        <select value={domaine} disabled={famille !== '' && famille !== 'unite'} onChange={e => setDomaine(e.target.value as DomaineDessin | '')}>
          {DOMAINES.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </select>
      </label>
    </div>
    <div className={styles.options}>
      <fieldset><legend>Fond de l’aperçu</legend><div className={styles.choix}>
        {(['clair', 'sombre'] as const).map(valeur => <button key={valeur} type="button" aria-pressed={fond === valeur} onClick={() => setFond(valeur)}>{valeur === 'clair' ? 'Clair' : 'Sombre'}</button>)}
      </div></fieldset>
      <fieldset><legend>Taille de l’aperçu</legend><div className={styles.choix}>
        {TAILLES.map(([valeur, nom]) => <button key={valeur} type="button" aria-pressed={taille === valeur} onClick={() => setTaille(valeur)}>{nom}</button>)}
      </div></fieldset>
      <p className={styles.compteur} role="status" aria-live="polite">{visibles.length} référence{visibles.length > 1 ? 's' : ''} affichée{visibles.length > 1 ? 's' : ''}</p>
    </div>
    <ul className={styles.grille} aria-busy={actualisation}>
      {visibles.map(dessin => <CarteDessin key={`${dessin.id}:${dessin.revision}:${tentative}`} dessin={dessin} />)}
    </ul>
    {visibles.length === 0 ? <div className={styles.vide}>
      <p>Aucun dessin ne correspond à ces filtres.</p>
      <button type="button" onClick={() => { setFamille(''); setDomaine(''); setRecherche(''); }}>Effacer les filtres</button>
    </div> : null}
  </section>;
}
