'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { DessinReference, DomaineDessin, FamilleDessin } from './types';
import styles from './dessins.module.css';

const FAMILLES: readonly (readonly [FamilleDessin | '', string])[] = [
  ['', 'Toutes les familles'], ['unite', 'Unités'], ['batiment', 'Bâtiments'], ['decor', 'Décors'], ['terrain', 'Terrains'],
  ['portrait', 'Portraits'],
];
const DOMAINES: readonly (readonly [DomaineDessin | '', string])[] = [
  ['', 'Tous les domaines'], ['terre', 'Terre'], ['air', 'Air'], ['mer', 'Mer'],
];
const TAILLES = [['48', '48 px'], ['64', '64 px'], ['128', '128 px'], ['grand', 'Grand']] as const;
type Taille = typeof TAILLES[number][0];
const normaliser = (texte: string): string => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');
const GROUPES: readonly (readonly [string, string])[] = [
  ['unites', 'Unités'], ['batiments', 'Bâtiments'], ['sols', 'Sols'], ['ponts', 'Ponts'], ['biomes', 'Biomes'],
  ['rochers', 'Rochers'], ['vegetation', 'Végétation'], ['accessoires', 'Accessoires'], ['portraits', 'Portraits'], ['decors', 'Autres décors'],
];
const BIOMES: Record<string, string> = {
  tempere: 'Tempéré', cotier: 'Côtier', desert: 'Désert', aride: 'Aride', tropical: 'Tropical',
  archipel: 'Archipel', montagne: 'Montagne', volcanique: 'Volcanique', polaire: 'Polaire',
  arctique: 'Arctique', marais: 'Marais', savane: 'Savane', urbain: 'Urbain',
};
const libelle = (cle: string): string => cle.replace(/_/g, ' ').replace(/^./, lettre => lettre.toUpperCase());
const nomGroupe = (cle: string): string => GROUPES.find(([valeur]) => cle === valeur)?.[1] ?? libelle(cle);
const nomBiome = (cle: string): string => Object.hasOwn(BIOMES, cle) ? BIOMES[cle] ?? libelle(cle) : libelle(cle);
const ordreGroupe = (cle: string): number => {
  const position = GROUPES.findIndex(([valeur]) => valeur === cle);
  return position === -1 ? GROUPES.length : position;
};

function CarteDessin({ dessin }: { dessin: DessinReference }) {
  const [imageAbsente, setImageAbsente] = useState(false);
  const present = dessin.disponible && !imageAbsente;
  const url = `/api/admin/assets/dessins/${encodeURIComponent(dessin.id)}?v=${encodeURIComponent(dessin.revision)}`;
  const aReprendre = dessin.statut === 'a_refaire' || dessin.statut === 'a_reprendre';
  const statut = aReprendre ? 'Référence à reprendre'
    : present ? dessin.statut === 'pilote_reutilise' ? 'Pilote de référence' : 'Dessin de référence'
    : dessin.statut === 'a_dessiner' && !imageAbsente ? 'À dessiner' : 'Fichier indisponible';
  const domaine = DOMAINES.find(([cle]) => cle === dessin.domaine)?.[1];
  const categorie = [nomGroupe(dessin.groupe), dessin.biome ? nomBiome(dessin.biome) : domaine].filter(Boolean).join(' · ');
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
      <p className={styles.famille}>{categorie}</p>
      <h3>{dessin.nom}</h3>
      <p className={styles.statut} data-present={present} data-reprise={aReprendre}>{statut}</p>
      {present ? <a className={styles.telecharger} href={`${url}&telecharger=1`} download={`${dessin.id}.png`} aria-label={`Télécharger ${dessin.nom} en PNG`}>Télécharger le PNG <span aria-hidden="true">↓</span></a> : null}
    </div>
  </li>;
}

export function GalerieDessins({ dessins }: { dessins: DessinReference[] }) {
  const router = useRouter();
  const [actualisation, startTransition] = useTransition();
  const [tentative, setTentative] = useState(0);
  const [groupe, setGroupe] = useState('');
  const [famille, setFamille] = useState<FamilleDessin | ''>('');
  const [domaine, setDomaine] = useState<DomaineDessin | ''>('');
  const [biome, setBiome] = useState('');
  const [recherche, setRecherche] = useState('');
  const [taille, setTaille] = useState<Taille>('grand');
  const [fond, setFond] = useState<'clair' | 'sombre'>('clair');
  const comptes = new Map<string, number>();
  for (const dessin of dessins) comptes.set(dessin.groupe, (comptes.get(dessin.groupe) ?? 0) + 1);
  const groupes = [...comptes.keys()].sort((a, b) => ordreGroupe(a) - ordreGroupe(b) || nomGroupe(a).localeCompare(nomGroupe(b), 'fr'));
  // Les options suivent les catégories réellement présentes dans le plan.
  const groupeActif = comptes.has(groupe) ? groupe : '';
  const duGroupe = dessins.filter(d => !groupeActif || d.groupe === groupeActif);
  const familles = FAMILLES.filter(([cle]) => cle === '' || duGroupe.some(d => d.famille === cle));
  const familleActive = familles.some(([cle]) => cle === famille) ? famille : '';
  const deLaFamille = duGroupe.filter(d => !familleActive || d.famille === familleActive);
  const domaines = DOMAINES.filter(([cle]) => cle === '' || deLaFamille.some(d => d.domaine === cle));
  const domaineActif = domaines.some(([cle]) => cle === domaine) ? domaine : '';
  const duDomaine = deLaFamille.filter(d => !domaineActif || d.domaine === domaineActif);
  const biomes = [...new Set(duDomaine.flatMap(d => d.biome ? [d.biome] : []))].sort((a, b) => nomBiome(a).localeCompare(nomBiome(b), 'fr'));
  const biomeActif = biomes.includes(biome) ? biome : '';
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  const visibles = duDomaine.filter(d => (!biomeActif || d.biome === biomeActif)
    && mots.every(mot => normaliser(`${d.nom} ${d.cle} ${d.id} ${nomGroupe(d.groupe)} ${d.biome ? nomBiome(d.biome) : ''}`).includes(mot)));
  const presents = dessins.filter(d => d.disponible).length;
  const presentsVisibles = visibles.filter(d => d.disponible).length;
  const choisirGroupe = (valeur: string): void => {
    setGroupe(valeur); setFamille(''); setDomaine(''); setBiome('');
  };

  return <section className={styles.galerie} data-fond={fond} data-taille={taille} aria-label="Collection de dessins">
    <div className={styles.bilan}>
      <p><strong>{presents}</strong> dessin{presents > 1 ? 's' : ''} disponible{presents > 1 ? 's' : ''}<span> sur {dessins.length} références prévues</span></p>
      <button type="button" className={styles.actualiser} disabled={actualisation} onClick={() => { setTentative(t => t + 1); startTransition(() => router.refresh()); }}>{actualisation ? 'Actualisation…' : 'Actualiser'}</button>
    </div>
    <nav className={styles.groupes} aria-label="Catégories de dessins">
      <button type="button" aria-pressed={groupeActif === ''} onClick={() => choisirGroupe('')}>Tout <span>{dessins.length}</span></button>
      {groupes.map(cle => <button key={cle} type="button" aria-pressed={groupeActif === cle} onClick={() => choisirGroupe(cle)}>{nomGroupe(cle)} <span>{comptes.get(cle)}</span></button>)}
    </nav>
    <div className={styles.filtres}>
      <label className={styles.recherche}>Rechercher un dessin
        <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, catégorie, biome…" />
      </label>
      {familles.length > 2 ? <label>Famille
        <select value={familleActive} onChange={e => { setFamille(e.target.value as FamilleDessin | ''); setDomaine(''); setBiome(''); }}>
          {familles.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </select>
      </label> : null}
      {domaines.length > 1 ? <label>Domaine des unités
        <select value={domaineActif} onChange={e => { setDomaine(e.target.value as DomaineDessin | ''); setBiome(''); }}>
          {domaines.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </select>
      </label> : null}
      {biomes.length > 0 ? <label>Biome
        <select value={biomeActif} onChange={e => setBiome(e.target.value)}>
          <option value="">Tous les biomes</option>
          {biomes.map(cle => <option key={cle} value={cle}>{nomBiome(cle)}</option>)}
        </select>
      </label> : null}
    </div>
    <div className={styles.options}>
      <fieldset><legend>Fond de l’aperçu</legend><div className={styles.choix}>
        {(['clair', 'sombre'] as const).map(valeur => <button key={valeur} type="button" aria-pressed={fond === valeur} onClick={() => setFond(valeur)}>{valeur === 'clair' ? 'Clair' : 'Sombre'}</button>)}
      </div></fieldset>
      <fieldset><legend>Taille de l’aperçu</legend><div className={styles.choix}>
        {TAILLES.map(([valeur, nom]) => <button key={valeur} type="button" aria-pressed={taille === valeur} onClick={() => setTaille(valeur)}>{nom}</button>)}
      </div></fieldset>
      <p className={styles.compteur} role="status" aria-live="polite">{visibles.length} référence{visibles.length > 1 ? 's' : ''} affichée{visibles.length > 1 ? 's' : ''} · {presentsVisibles} disponible{presentsVisibles > 1 ? 's' : ''}</p>
    </div>
    <ul className={styles.grille} aria-busy={actualisation}>
      {visibles.map(dessin => <CarteDessin key={`${dessin.id}:${dessin.revision}:${tentative}`} dessin={dessin} />)}
    </ul>
    {visibles.length === 0 ? <div className={styles.vide}>
      <p>Aucun dessin ne correspond à ces filtres.</p>
      <button type="button" onClick={() => { choisirGroupe(''); setRecherche(''); }}>Effacer les filtres</button>
    </div> : null}
  </section>;
}
