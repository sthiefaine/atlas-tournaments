/**
 * La géométrie du plateau : **une case = une unité de scène**, sans exception
 * (`BRIEF.md`, « dimensions et échelle : une case = 1 unité de scène »).
 *
 * Tout ce fichier est **pur** — pas de three.js, pas de DOM, pas d'horloge — pour
 * que la conversion case ↔ monde, les hauteurs de terrain et la construction de
 * la carte de mélange (*splat map*) soient vérifiables par `tsx --test`. Le
 * maillage, lui, est bâti dans `terrain.ts` à partir d'exactement ces fonctions :
 * une unité posée à `caseVersMonde(c)` retombe toujours sur le sol de `hauteurEn`.
 *
 * Le repère : `x` de la grille → `+X`, `y` de la grille → `+Z`, altitude → `+Y`.
 * Le centre de la case `(0, 0)` est donc en `(0.5, h, 0.5)`.
 */

import type { Case, CleTerrain } from '../schemas/types';

/** Côté d'une case, en unités de scène. Il ne change pas : c'est l'échelle. */
export const CASE = 1;

/**
 * Relief par terrain, en unités de scène (`BRIEF.md`, « relief léger par
 * terrain »). La montagne monte à 1,0 mais son pic est **adouci** par
 * l'interpolation entre centres de cases : un massif isolé fait une colline,
 * une chaîne fait une crête.
 */
export const HAUTEURS: Readonly<Record<CleTerrain, number>> = {
  plaine: 0,
  foret: 0.05,
  montagne: 1,
  route: 0,
  ville: 0.02,
  qg: 0.02,
  usine: 0.02,
  aeroport: 0,
  mer: -0.4,
  riviere: -0.25,
  pont: 0,
  plage: -0.05,
};

/** Hauteur d'un terrain, `0` pour un terrain inconnu. */
export function hauteurTerrain(terrain: CleTerrain): number {
  return HAUTEURS[terrain] ?? 0;
}

/** Niveau du plan d'eau : au-dessus des lits de rivière et des fonds marins. */
export const NIVEAU_EAU = -0.12;

/** Centre d'une case, en unités de scène (hors altitude). */
export function caseVersMonde(c: Case): { x: number; z: number } {
  return { x: c.x * CASE + CASE / 2, z: c.y * CASE + CASE / 2 };
}

/** Point du monde → case de la grille. La case peut tomber hors carte. */
export function mondeVersCase(x: number, z: number): Case {
  return { x: Math.floor(x / CASE), y: Math.floor(z / CASE) };
}

/** La grille lue par le maillage : juste de quoi connaître le terrain d'une case. */
export interface GrilleTerrain {
  largeur: number;
  hauteur: number;
  terrainDe(x: number, y: number): CleTerrain;
}

/** Terrain d'une case, avec bords collants : hors carte, on prolonge le bord. */
export function terrainBorne(g: GrilleTerrain, x: number, y: number): CleTerrain {
  const cx = Math.max(0, Math.min(g.largeur - 1, x));
  const cy = Math.max(0, Math.min(g.hauteur - 1, y));
  return g.terrainDe(cx, cy);
}

/** Hauteur au centre d'une case, sans lissage. */
export function hauteurCase(g: GrilleTerrain, x: number, y: number): number {
  return hauteurTerrain(terrainBorne(g, x, y));
}

/**
 * Le champ d'altitude **continu** du plateau : une interpolation bilinéaire
 * entre les centres de cases. C'est ce qui donne à la fois les « sommets
 * partagés » (deux cases voisines ne peuvent pas se décoller) et les « jonctions
 * adoucies » : au centre d'une case on retrouve exactement sa hauteur, au bord
 * on est à mi-chemin de la voisine.
 */
export function hauteurEn(g: GrilleTerrain, x: number, z: number): number {
  const fx = x / CASE - 0.5;
  const fz = z / CASE - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = hauteurCase(g, x0, z0);
  const h10 = hauteurCase(g, x0 + 1, z0);
  const h01 = hauteurCase(g, x0, z0 + 1);
  const h11 = hauteurCase(g, x0 + 1, z0 + 1);
  const haut = h00 + (h10 - h00) * tx;
  const bas = h01 + (h11 - h01) * tx;
  return haut + (bas - haut) * tz;
}

/** Altitude du sol au centre d'une case : là où se posent unités et décor. */
export function solDeCase(g: GrilleTerrain, c: Case): number {
  const m = caseVersMonde(c);
  return hauteurEn(g, m.x, m.z);
}

// ---------------------------------------------------------------------------
// Carte de mélange (splat map)
// ---------------------------------------------------------------------------

/**
 * Les quatre matières mélangées par le nuanceur du terrain, dans l'ordre des
 * canaux RGBA : **R herbe, G terre et route, B roche, A sable**. La somme d'une
 * case vaut toujours 1 — le nuanceur renormalise quand même, par sécurité.
 */
export type Splat = [herbe: number, terre: number, roche: number, sable: number];

/** Le mélange de matières d'un terrain. */
export function splatTerrain(terrain: CleTerrain): Splat {
  switch (terrain) {
    case 'plaine': return [1, 0, 0, 0];
    case 'foret': return [0.85, 0.15, 0, 0];
    case 'montagne': return [0.08, 0.04, 0.88, 0];
    // La route ne repeint pas toute sa case : c'est la bande de bitume posée
    // par `terrain.ts` qui la dessine, la splat n'apporte que ses bas-côtés.
    case 'route': return [0.55, 0.45, 0, 0];
    case 'pont': return [0.2, 0.8, 0, 0];
    case 'ville': return [0.25, 0.75, 0, 0];
    case 'qg': return [0.2, 0.8, 0, 0];
    case 'usine': return [0.15, 0.85, 0, 0];
    case 'aeroport': return [0.1, 0.9, 0, 0];
    case 'plage': return [0.05, 0, 0, 0.95];
    case 'riviere': return [0.1, 0.3, 0, 0.6];
    case 'mer': return [0, 0, 0.1, 0.9];
    default: return [1, 0, 0, 0];
  }
}

/** Le mélange d'une case de la grille. */
export function splatCase(g: GrilleTerrain, x: number, y: number): Splat {
  return splatTerrain(terrainBorne(g, x, y));
}

/**
 * Construit la texture de mélange : un octet par canal et par case, lue en
 * filtrage linéaire par le nuanceur — c'est ce filtrage qui fond les lisières
 * sans qu'on ait à flouter quoi que ce soit à la main.
 */
export function construireSplat(g: GrilleTerrain): Uint8Array<ArrayBuffer> {
  const donnees = new Uint8Array(new ArrayBuffer(g.largeur * g.hauteur * 4));
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const s = splatCase(g, x, y);
      const i = (y * g.largeur + x) * 4;
      donnees[i] = Math.round(s[0] * 255);
      donnees[i + 1] = Math.round(s[1] * 255);
      donnees[i + 2] = Math.round(s[2] * 255);
      donnees[i + 3] = Math.round(s[3] * 255);
    }
  }
  return donnees;
}

/** Les huit voisines d'une case, dans l'ordre horaire depuis le nord. */
export const VOISINES: readonly (readonly [number, number])[] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Un aléa déterministe par case : deux montages rendent le même décor. */
export function alea(x: number, y: number, sel = 0): number {
  let n = (x * 374_761_393 + y * 668_265_263 + sel * 2_246_822_519) | 0;
  n = (n ^ (n >>> 13)) * 1_274_126_177;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4_294_967_296;
}
