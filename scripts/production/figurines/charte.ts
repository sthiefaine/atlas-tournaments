/**
 * La charte des figurines, typée, et l'**atlas** qu'elle peint. Pur : ni
 * fichier ni Blender ici, des tableaux — c'est ce que les tests exercent.
 *
 * L'atlas est la cohésion du lot rendue structurelle : chaque teinte de la
 * charte a une case, dans l'ordre de la liste, et chaque pièce d'un modèle a
 * ses UV dans la case de sa teinte (`bibliotheque.py`, `Charte.case`, la même
 * règle). Tous les modèles lisent donc les mêmes images : l'albédo (les
 * teintes d'équipe y sont blanches), le masque d'équipe (blanc sur ces cases,
 * noir ailleurs, 0 ou 1 et jamais entre les deux), la rugosité (G) et le métal
 * (B), une normale plate, l'émission des teintes qui émettent.
 */

import donnees from './charte.json';

import { couleurHex, creerImage, encoderPng, type Image, type Rvb } from '../../../src/render/apercu/png';
import type { CanalTexture } from '../../../src/assets/spec';

/** Une borne de mesure : un minimum, un maximum, ou les deux. */
export interface Bornes { min?: number; max?: number }

export interface Teinte {
  nom: string;
  hex: string;
  equipe?: boolean;
  rugosite: number;
  metal: number;
  materiau: 'corps' | 'details';
  sombre?: boolean;
  reflet?: { hex: string; part: number };
  emission?: boolean;
  reserveeA?: string[];
  batiment?: boolean;
  role: string;
}

export interface Charte {
  version: number;
  atlas: { colonnes: number; lignes: number; remplissage: number; caseInutilisee: string };
  teintes: Teinte[];
  saisons: Record<string, Record<string, string> | string>;
  materiaux: { corps: string; details: string };
  palette: { teintesMax: number; parts: Record<string, Bornes & { seulementPour?: string }> };
  equipe: {
    droite: Bornes; droiteFantassin: Bornes; basEtHautMin: number; connexeMin: number; pixelsParCaseConnexe: number;
    eclairee: { lumiereMin: number; partMin: number };
  };
  tailles: {
    classes: Record<'petite' | 'moyenne' | 'grande', Bornes>;
    fantassin: { largeur: Bornes; hauteur: Bornes };
    debordLateralMax: number;
    hauteurAuDessusDuPivotMax: { sol: number; vol: number };
  };
  altitudes: { rotor: number; avion: number; drone: number; tolerance: number };
  repos: { agitationMax: { sol: number; vol: number }; seuilNiveaux: number; rotationMaxDegres: number };
  formes: { chanfreinMin: number; chanfreinPart: number; epaisseurMin: number; epaisseurMinAntenne: number; piecesLisiblesMax: number };
  poses: { tirIndirectDegres: Bornes; antiAerienDegres: Bornes; flottaisonMetres: Bornes };
  contour: { hex: string; epaisseurEchelle4: number; seuilCouverture: number; opacite: Record<string, number> };
  budget: { triangles: number };
  planche: { herbe: string; grille: string; camps: { nom: string; hex: string }[] };
}

/** La charte du dépôt. */
export const CHARTE = donnees as unknown as Charte;

/** L'indice d'une teinte dans la charte, ou −1. */
export function indiceTeinte(charte: Charte, nom: string): number {
  return charte.teintes.findIndex((t) => t.nom === nom);
}

/** La couleur d'une teinte pour une saison (surcharge de `saisons`), en sRGB 0–255. */
export function couleurTeinte(charte: Charte, t: Teinte, saison?: string): Rvb {
  const surcharges = saison ? charte.saisons[saison] : undefined;
  const hex = surcharges && typeof surcharges === 'object' ? surcharges[t.nom] ?? t.hex : t.hex;
  return couleurHex(hex);
}

/** Le rectangle d'une case, en pixels d'une image de `n × n` : colonnes et lignes à partir du haut à gauche. */
export function caseAtlas(charte: Charte, indice: number, n: number): { x0: number; y0: number; x1: number; y1: number } {
  const { colonnes, lignes } = charte.atlas;
  const col = indice % colonnes;
  const lig = Math.floor(indice / colonnes);
  return {
    x0: Math.round((col * n) / colonnes), x1: Math.round(((col + 1) * n) / colonnes),
    y0: Math.round((lig * n) / lignes), y1: Math.round(((lig + 1) * n) / lignes),
  };
}

/**
 * La ligne (en pixels, depuis le haut de la case) où finit la bande de reflet
 * d'une teinte de verre : le haut de la zone utile plus `part` de sa hauteur —
 * la bibliothèque y envoie le haut de chaque pièce (`uv='hauteur'`).
 */
export function limiteReflet(charte: Charte, part: number, hauteurCase: number): number {
  const marge = (1 - charte.atlas.remplissage) / 2;
  return Math.round((marge + part * charte.atlas.remplissage) * hauteurCase);
}

/** Les canaux qu'un atlas sait peindre. */
export const CANAUX_ATLAS: readonly CanalTexture[] = ['albedo', 'normale', 'rugosite', 'metal', 'masque_equipe', 'emission', 'occlusion'];

/**
 * Peint un canal de l'atlas à la résolution `n`. Une case sans teinte est
 * peinte d'une couleur criarde dans l'albédo (`caseInutilisee`) : une pièce
 * dont les UV tomberaient à côté se verrait sur la planche.
 */
export function peindreAtlas(charte: Charte, canal: CanalTexture, n: number, saison?: string): Image {
  const { colonnes, lignes } = charte.atlas;
  if (n % colonnes !== 0 || n % lignes !== 0) throw new Error(`atlas de ${n} px : pas un multiple de ${colonnes} × ${lignes}`);
  const neutre: Record<string, Rvb> = {
    albedo: couleurHex(charte.atlas.caseInutilisee), normale: [128, 128, 255], rugosite: [255, 230, 0],
    metal: [0, 0, 0], masque_equipe: [0, 0, 0], emission: [0, 0, 0], occlusion: [255, 255, 255],
  };
  const fond = neutre[canal];
  if (!fond) throw new Error(`canal sans atlas : ${canal}`);
  const image = creerImage(n, n, fond);
  charte.teintes.forEach((t, i) => {
    const c = caseAtlas(charte, i, n);
    const principal = couleurCase(charte, t, canal, saison);
    const reflet = canal === 'albedo' && t.reflet ? couleurHex(t.reflet.hex) : null;
    const limite = t.reflet ? c.y0 + limiteReflet(charte, t.reflet.part, c.y1 - c.y0) : -1;
    for (let y = c.y0; y < c.y1; y++) {
      const rvb = reflet && y < limite ? reflet : principal;
      for (let x = c.x0; x < c.x1; x++) {
        const k = (y * n + x) * 3;
        image.pixels[k] = rvb[0];
        image.pixels[k + 1] = rvb[1];
        image.pixels[k + 2] = rvb[2];
      }
    }
  });
  return image;
}

/** La couleur d'une case pour un canal. */
function couleurCase(charte: Charte, t: Teinte, canal: CanalTexture, saison?: string): Rvb {
  switch (canal) {
    case 'albedo': return t.equipe ? [255, 255, 255] : couleurTeinte(charte, t, saison);
    case 'masque_equipe': return t.equipe ? [255, 255, 255] : [0, 0, 0];
    case 'rugosite': return [255, Math.round(t.rugosite * 255), Math.round(t.metal * 255)];
    case 'metal': { const m = Math.round(t.metal * 255); return [m, m, m]; }
    case 'normale': return [128, 128, 255];
    case 'emission': return t.emission ? couleurTeinte(charte, t, saison) : [0, 0, 0];
    case 'occlusion': return [255, 255, 255];
    default: throw new Error(`canal sans atlas : ${canal}`);
  }
}

/** Le PNG d'un canal de l'atlas : déterministe, octet pour octet. */
export function pngAtlas(charte: Charte, canal: CanalTexture, n: number, saison?: string): Uint8Array {
  return encoderPng(peindreAtlas(charte, canal, n, saison));
}

/** Vrai si une teinte a le droit d'aller sur l'unité `cle` : ni réservée à d'autres, ni de bâtiment. */
export function teintePermise(t: Teinte, cle: string): boolean {
  if (t.batiment) return false;
  return !t.reserveeA || t.reserveeA.includes(cle);
}
