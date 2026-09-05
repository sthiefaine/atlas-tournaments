/**
 * L'ambiance : `ambiance(saison, phase, meteo)` → une palette de substitution,
 * un voile et un calque de particules (`02-architecture.md` §3.4).
 *
 * Fonction **pure**, sans DOM ni horloge : elle ne lit que `EtatPartie.climat`.
 * L'ambiance est purement cosmétique — aucune règle n'en dépend, et une partie
 * jouée calques éteints est exactement la même partie. Sa `cle` entre dans la
 * clé du cache de sprites (`sprites/cache.ts`), qui est donc purgé au changement
 * de saison, de phase ou de météo.
 *
 * Les couleurs de base sont celles de `doc/assets/atlas-render-vector.html` et de
 * `render/apercu/raster.ts`, pour que l'aperçu et le jeu restent de la même famille.
 */

import type { Meteo, PhaseJour, Saison } from '../schemas/types';

// ---------------------------------------------------------------------------
// Couleurs : petites fonctions pures sur des `#rrggbb`
// ---------------------------------------------------------------------------

/** Triplet rouge-vert-bleu, 0 à 255. */
export interface Rvb { r: number; v: number; b: number }

/** Lit une couleur `#rrggbb`. Une entrée illisible rend du noir plutôt que de lever. */
export function lireCouleur(hex: string): Rvb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return { r: 0, v: 0, b: 0 };
  return { r: (n >> 16) & 255, v: (n >> 8) & 255, b: n & 255 };
}

/** Écrit une couleur en `#rrggbb`. */
export function ecrireCouleur(c: Rvb): string {
  const borne = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  return `#${((borne(c.r) << 16) | (borne(c.v) << 8) | borne(c.b)).toString(16).padStart(6, '0')}`;
}

/** Mélange deux couleurs : `t = 0` rend `a`, `t = 1` rend `b`. */
export function melanger(a: string, b: string, t: number): string {
  const ca = lireCouleur(a);
  const cb = lireCouleur(b);
  const k = Math.max(0, Math.min(1, t));
  return ecrireCouleur({
    r: ca.r + (cb.r - ca.r) * k,
    v: ca.v + (cb.v - ca.v) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

/** Assombrit (facteur < 1) ou éclaircit (facteur > 1) une couleur. */
export function teinter(couleur: string, facteur: number): string {
  const c = lireCouleur(couleur);
  return ecrireCouleur({ r: c.r * facteur, v: c.v * facteur, b: c.b * facteur });
}

/** Une couleur avec une composante alpha, pour les calques translucides. */
export function alpha(couleur: string, a: number): string {
  const c = lireCouleur(couleur);
  return `rgba(${c.r},${c.v},${c.b},${Math.max(0, Math.min(1, a))})`;
}

// ---------------------------------------------------------------------------
// La palette d'ambiance
// ---------------------------------------------------------------------------

/** Palette de terrain d'une ambiance : ce que la scène lit pour chaque couche. */
export interface PaletteTerrain {
  eauHaut: string;
  eauBas: string;
  ecume: string;
  sable: string;
  herbe: string;
  herbeClair: string;
  herbeSombre: string;
  route: string;
  routeLigne: string;
  feuillage: string;
  feuillageClair: string;
  feuillageSommet: string;
  tronc: string;
  roche: string;
  rocheOmbre: string;
  neige: string;
  riviere: string;
  pont: string;
  grille: string;
  ombre: string;
  fenetre: string;
}

/** Types de particule du calque météo. */
export const TYPES_PARTICULE = ['aucune', 'pluie', 'neige', 'brume', 'poussiere'] as const;
/** Type de particule affiché par-dessus le terrain. */
export type TypeParticule = typeof TYPES_PARTICULE[number];

/** Calque de particules : densité par case, vitesse de chute, dérive du vent. */
export interface Particules {
  type: TypeParticule;
  densite: number;
  vitesse: number;
  vent: number;
}

/** Voile plein posé au-dessus du terrain et sous les unités. */
export interface Voile {
  couleur: string;
  alpha: number;
}

/** Ce que rend `ambiance()` : palette, voile, particules, villes éclairées. */
export interface Ambiance {
  /** `saison:phase:meteo` — entre telle quelle dans la clé du cache de sprites. */
  cle: string;
  saison: Saison;
  phase: PhaseJour;
  meteo: Meteo;
  palette: PaletteTerrain;
  voile: Voile | null;
  particules: Particules;
  /** Les bâtiments s'allument : villes, usines, aéroports et QG (§12.3). */
  villesEclairees: boolean;
}

/** La palette de plein jour, de printemps, par temps clair : la référence. */
const BASE: PaletteTerrain = {
  eauHaut: '#57b0ea',
  eauBas: '#3b8fd4',
  ecume: '#ffffff',
  sable: '#efe0a4',
  herbe: '#a3d96b',
  herbeClair: '#bdeb8c',
  herbeSombre: '#78be50',
  route: '#dccb9f',
  routeLigne: '#ffffff',
  feuillage: '#2f9a48',
  feuillageClair: '#49b862',
  feuillageSommet: '#8fdc9a',
  tronc: '#7a5232',
  roche: '#aab2bf',
  rocheOmbre: '#7b8494',
  neige: '#ffffff',
  riviere: '#4aa3e8',
  pont: '#a98254',
  grille: '#000000',
  ombre: '#000000',
  fenetre: '#ffe9a3',
};

/** Applique la saison : c'est elle qui décide du feuillage et du sol. */
function parSaison(p: PaletteTerrain, saison: Saison): PaletteTerrain {
  if (saison === 'automne') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#c99a3f', 0.16),
      herbeClair: melanger(p.herbeClair, '#e0b45c', 0.22),
      herbeSombre: melanger(p.herbeSombre, '#9c7430', 0.24),
      feuillage: '#c86a22',
      feuillageClair: '#e0913a',
      feuillageSommet: '#f2c15e',
      sable: melanger(p.sable, '#d8b878', 0.3),
    };
  }
  if (saison === 'hiver') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#e8eef5', 0.55),
      herbeClair: melanger(p.herbeClair, '#ffffff', 0.6),
      herbeSombre: melanger(p.herbeSombre, '#c3d2e0', 0.5),
      feuillage: melanger(p.feuillage, '#5f7f68', 0.45),
      feuillageClair: melanger(p.feuillageClair, '#8fae95', 0.5),
      feuillageSommet: '#e9f2f7',
      roche: melanger(p.roche, '#e6edf5', 0.4),
      rocheOmbre: melanger(p.rocheOmbre, '#9fb0c2', 0.4),
      sable: melanger(p.sable, '#dfe6ee', 0.4),
      eauHaut: melanger(p.eauHaut, '#7aa8c8', 0.3),
      eauBas: melanger(p.eauBas, '#5b87a8', 0.3),
    };
  }
  if (saison === 'ete') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#d9d167', 0.2),
      herbeSombre: melanger(p.herbeSombre, '#a8a844', 0.2),
      feuillage: melanger(p.feuillage, '#2c8a3f', 0.2),
    };
  }
  return p;
}

/** Applique la météo : la neige couvre, la canicule blanchit, la pluie sature. */
function parMeteo(p: PaletteTerrain, meteo: Meteo): PaletteTerrain {
  if (meteo === 'neige') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#f2f7fb', 0.7),
      herbeClair: melanger(p.herbeClair, '#ffffff', 0.75),
      herbeSombre: melanger(p.herbeSombre, '#d6e2ee', 0.65),
      route: melanger(p.route, '#eef3f8', 0.55),
      feuillageSommet: '#ffffff',
      feuillage: melanger(p.feuillage, '#cfe0e6', 0.35),
      feuillageClair: melanger(p.feuillageClair, '#e4eef2', 0.4),
      sable: melanger(p.sable, '#eef3f8', 0.5),
      roche: melanger(p.roche, '#ffffff', 0.35),
    };
  }
  if (meteo === 'pluie' || meteo === 'tempete') {
    const t = meteo === 'tempete' ? 0.3 : 0.18;
    return {
      ...p,
      herbe: melanger(p.herbe, '#4d6b52', t),
      herbeClair: melanger(p.herbeClair, '#6b8a6a', t),
      herbeSombre: melanger(p.herbeSombre, '#3d5a45', t),
      route: melanger(p.route, '#8f8b7c', t),
      sable: melanger(p.sable, '#b9ab7f', t),
      eauHaut: melanger(p.eauHaut, '#3d6f96', t),
      eauBas: melanger(p.eauBas, '#2b5878', t),
    };
  }
  if (meteo === 'canicule') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#e0cf6a', 0.35),
      herbeSombre: melanger(p.herbeSombre, '#b7a548', 0.35),
      sable: melanger(p.sable, '#f7ecc0', 0.4),
      route: melanger(p.route, '#f0e2b6', 0.3),
    };
  }
  if (meteo === 'brouillard') {
    return {
      ...p,
      herbe: melanger(p.herbe, '#c8d2cc', 0.25),
      feuillage: melanger(p.feuillage, '#8fa596', 0.25),
      eauHaut: melanger(p.eauHaut, '#9db4c0', 0.25),
    };
  }
  return p;
}

/** Applique la nuit : tout bleuit et s'assombrit, les fenêtres restent chaudes. */
function parNuit(p: PaletteTerrain): PaletteTerrain {
  const nuit = (c: string, force = 0.45): string => melanger(teinter(c, 0.62), '#1a2b52', force);
  return {
    eauHaut: nuit(p.eauHaut, 0.5),
    eauBas: nuit(p.eauBas, 0.55),
    ecume: melanger(p.ecume, '#7f9bd0', 0.5),
    sable: nuit(p.sable),
    herbe: nuit(p.herbe),
    herbeClair: nuit(p.herbeClair),
    herbeSombre: nuit(p.herbeSombre, 0.5),
    route: nuit(p.route),
    routeLigne: melanger(p.routeLigne, '#8fa4cf', 0.45),
    feuillage: nuit(p.feuillage, 0.5),
    feuillageClair: nuit(p.feuillageClair, 0.5),
    feuillageSommet: nuit(p.feuillageSommet, 0.5),
    tronc: nuit(p.tronc, 0.4),
    roche: nuit(p.roche),
    rocheOmbre: nuit(p.rocheOmbre, 0.5),
    neige: nuit(p.neige, 0.4),
    riviere: nuit(p.riviere, 0.5),
    pont: nuit(p.pont, 0.4),
    grille: p.grille,
    ombre: p.ombre,
    fenetre: '#ffe9a3',
  };
}

/** Le calque de particules d'une météo. */
function particulesDe(meteo: Meteo, phase: PhaseJour): Particules {
  switch (meteo) {
    case 'pluie': return { type: 'pluie', densite: 0.55, vitesse: 620, vent: 90 };
    case 'tempete': return { type: 'pluie', densite: 1, vitesse: 900, vent: 320 };
    case 'neige': return { type: 'neige', densite: 0.5, vitesse: 70, vent: 26 };
    case 'brouillard': return { type: 'brume', densite: 0.7, vitesse: 12, vent: 16 };
    case 'canicule': return { type: 'poussiere', densite: phase === 'nuit' ? 0.1 : 0.3, vitesse: 24, vent: 12 };
    default: return { type: 'aucune', densite: 0, vitesse: 0, vent: 0 };
  }
}

/** Le voile plein d'une ambiance : nuit bleutée, nappe de brume, halo de chaleur. */
function voileDe(phase: PhaseJour, meteo: Meteo): Voile | null {
  if (phase === 'nuit') {
    return { couleur: '#0d1a3a', alpha: meteo === 'brouillard' ? 0.42 : 0.32 };
  }
  if (meteo === 'brouillard') return { couleur: '#d7e2e8', alpha: 0.34 };
  if (meteo === 'tempete') return { couleur: '#2d3a4a', alpha: 0.22 };
  if (meteo === 'canicule') return { couleur: '#ffb547', alpha: 0.09 };
  if (meteo === 'pluie') return { couleur: '#33455e', alpha: 0.12 };
  return null;
}

const MEMOIRE = new Map<string, Ambiance>();

/**
 * L'ambiance d'un climat. Mémorisée par clé : la même saison, la même phase et la
 * même météo rendent toujours le **même objet**, ce qui rend la comparaison de
 * clés de cache triviale.
 */
export function ambiance(saison: Saison, phase: PhaseJour, meteo: Meteo): Ambiance {
  const cle = `${saison}:${phase}:${meteo}`;
  const memo = MEMOIRE.get(cle);
  if (memo) return memo;
  let palette = parMeteo(parSaison(BASE, saison), meteo);
  if (phase === 'nuit') palette = parNuit(palette);
  const valeur: Ambiance = {
    cle,
    saison,
    phase,
    meteo,
    palette,
    voile: voileDe(phase, meteo),
    particules: particulesDe(meteo, phase),
    villesEclairees: phase === 'nuit',
  };
  MEMOIRE.set(cle, valeur);
  return valeur;
}

/** L'ambiance d'un état de partie : le seul point d'entrée du rendu. */
export function ambianceDe(climat: { saison: Saison; phase: PhaseJour; meteo: Meteo }): Ambiance {
  return ambiance(climat.saison, climat.phase, climat.meteo);
}
