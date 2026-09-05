/**
 * Les revêtements des voies : un **atlas** de six tuiles par biome — droite,
 * virage, T, croix, bout, placette — peint au chargement dans un canvas, comme
 * les matières du sol (`textures.ts`).
 *
 * Chaque tuile porte une pièce **canonique** (nord en haut) avec sa chaussée,
 * ses accotements adoucis dans le canal alpha et son motif ; toute autre
 * orientation s'obtient en tournant les UV du décalque (`uvAtlas`). C'est ce
 * qui donne des voies **continues** à largeur constante pour un seul appel de
 * dessin, là où une bande par case laissait des rectangles bout à bout.
 *
 * Le biome ne change pas la règle — une route coûte la même chose partout —,
 * il change l'**apparence** : bitume marqué en plaine, sentier de terre en
 * forêt, pavés en montagne, sable tassé au désert, chaussée déneigée entre deux
 * congères, basalte au volcan, planches et coquillages en archipel.
 *
 * Tout ici ne touche le canvas que par `createImageData` / `putImageData` :
 * les tuiles se vérifient en mémoire, sans navigateur.
 */

import * as THREE from 'three';

import type { Biome } from '../schemas/types';
import { LIAISONS_CANON, type FormeVoie } from './geometrie';
import { bruitFractal, texture } from './textures';

/** L'ordre des tuiles dans l'atlas, en lecture : trois colonnes, deux rangs. */
export const TUILES_ATLAS: readonly FormeVoie[] = ['droite', 'virage', 'te', 'croix', 'bout', 'isole'];
export const COLONNES_ATLAS = 3;
export const RANGS_ATLAS = 2;

type RGB = readonly [number, number, number];

/** Le motif peint sur la chaussée : ce qui dit « route » ou « sentier » de loin. */
export type MotifVoie = 'tirets' | 'ornieres' | 'paves' | 'planches' | 'fissures' | 'aucun';

/** L'apparence d'une voie dans un biome. */
export interface ApparenceVoie {
  /** Le revêtement, du sombre au clair, mêlé par le grain. */
  sombre: RGB;
  clair: RGB;
  /** L'accotement : sa teinte, sa largeur (fraction de case), son opacité au bord de la chaussée. */
  accotement: RGB;
  largeurAccotement: number;
  opaciteAccotement: number;
  /** Vrai quand l'accotement est plein et non fondu : une congère, pas une lisière. */
  accotementPlein: boolean;
  /** Demi-largeur de la chaussée, en fraction de case. */
  demiLargeur: number;
  /** L'irrégularité du bord : un sentier se perd dans l'herbe, un bitume non. */
  frange: number;
  motif: MotifVoie;
  couleurMotif: RGB;
  /** Force du grain : un bitume est lisse, un gravier ne l'est pas. */
  grain: number;
  /** Teinte du tablier, des parapets et des piles d'un pont. */
  pont: number;
}

const BITUME: ApparenceVoie = {
  sombre: [74, 80, 86], clair: [104, 110, 114], accotement: [150, 141, 118],
  largeurAccotement: 0.07, opaciteAccotement: 0.55, accotementPlein: false,
  demiLargeur: 0.2, frange: 0.012, motif: 'tirets', couleurMotif: [214, 208, 178],
  grain: 0.55, pont: 0x8f8d86,
};

const SENTIER: ApparenceVoie = {
  sombre: [116, 96, 70], clair: [160, 138, 104], accotement: [96, 104, 62],
  largeurAccotement: 0.1, opaciteAccotement: 0.5, accotementPlein: false,
  demiLargeur: 0.17, frange: 0.05, motif: 'ornieres', couleurMotif: [92, 74, 52],
  grain: 1, pont: 0x7a5a3c,
};

/** Les dix biomes : chaque apparence dit d'où l'on est avant toute lecture. */
export const APPARENCES: Readonly<Record<Biome, ApparenceVoie>> = {
  plaine: BITUME,
  cotier: { ...BITUME, sombre: [82, 86, 90], clair: [112, 116, 118], accotement: [188, 172, 138] },
  foret: SENTIER,
  jungle: { ...SENTIER, sombre: [104, 78, 56], clair: [150, 118, 82], accotement: [70, 98, 52] },
  marais: { ...SENTIER, sombre: [92, 84, 58], clair: [140, 128, 90], accotement: [88, 96, 60], frange: 0.07 },
  montagne: {
    sombre: [112, 116, 122], clair: [160, 162, 164], accotement: [118, 122, 110],
    largeurAccotement: 0.06, opaciteAccotement: 0.6, accotementPlein: false,
    demiLargeur: 0.19, frange: 0.02, motif: 'paves', couleurMotif: [72, 74, 80],
    grain: 0.6, pont: 0x8a8f94,
  },
  desert: {
    sombre: [186, 156, 108], clair: [214, 188, 138], accotement: [200, 176, 126],
    largeurAccotement: 0.12, opaciteAccotement: 0.4, accotementPlein: false,
    demiLargeur: 0.19, frange: 0.06, motif: 'ornieres', couleurMotif: [160, 130, 88],
    grain: 0.7, pont: 0xb08e66,
  },
  neige: {
    sombre: [58, 62, 70], clair: [92, 96, 104], accotement: [236, 242, 248],
    largeurAccotement: 0.12, opaciteAccotement: 0.96, accotementPlein: true,
    demiLargeur: 0.18, frange: 0.035, motif: 'tirets', couleurMotif: [196, 190, 166],
    grain: 0.45, pont: 0x7c8a96,
  },
  volcanique: {
    sombre: [40, 40, 46], clair: [76, 74, 80], accotement: [90, 84, 82],
    largeurAccotement: 0.08, opaciteAccotement: 0.5, accotementPlein: false,
    demiLargeur: 0.2, frange: 0.03, motif: 'fissures', couleurMotif: [118, 96, 84],
    grain: 0.8, pont: 0x4a4a52,
  },
  archipel: {
    sombre: [206, 192, 160], clair: [240, 230, 204], accotement: [226, 214, 182],
    largeurAccotement: 0.08, opaciteAccotement: 0.45, accotementPlein: false,
    demiLargeur: 0.17, frange: 0.04, motif: 'planches', couleurMotif: [150, 120, 84],
    grain: 0.9, pont: 0x9a7452,
  },
};

/** Mélange linéaire de deux couleurs. */
function mel(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function lisser(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Position d'une tuile dans l'atlas : colonne et rang. */
export function tuileDe(forme: FormeVoie): { colonne: number; rang: number } {
  const i = Math.max(0, TUILES_ATLAS.indexOf(forme));
  return { colonne: i % COLONNES_ATLAS, rang: Math.floor(i / COLONNES_ATLAS) };
}

/**
 * Les UV d'un point `(a, b)` de la case — `a` vers l'est, `b` vers le sud —
 * pour une pièce tournée de `rotation` quarts de tour horaires. La tuile est
 * peinte au nord en haut, l'atlas n'est pas retourné (`flipY = false`) : on
 * tourne donc le point **en sens inverse** pour retrouver sa place canonique.
 */
export function uvAtlas(forme: FormeVoie, rotation: number, a: number, b: number): [number, number] {
  let qa = a;
  let qb = b;
  for (let k = 0; k < ((rotation % 4) + 4) % 4; k += 1) {
    const na = qb;
    const nb = 1 - qa;
    qa = na;
    qb = nb;
  }
  const { colonne, rang } = tuileDe(forme);
  return [(colonne + qa) / COLONNES_ATLAS, (rang + qb) / RANGS_ATLAS];
}

/** Distance signée à un rectangle axial `[x0,x1]×[y0,y1]` : négative dedans. */
function distRect(a: number, b: number, x0: number, x1: number, y0: number, y1: number): number {
  const dx = Math.max(x0 - a, 0, a - x1);
  const dy = Math.max(y0 - b, 0, b - y1);
  const dehors = Math.hypot(dx, dy);
  const dedans = Math.min(0, Math.max(a - x1, x0 - a, b - y1, y0 - b));
  return dehors + dedans;
}

/** Les bras d'une pièce canonique : pour chacun, sa direction et son rectangle. */
interface Bras {
  /** 0 nord, 1 est, 2 sud, 3 ouest. */
  dir: number;
  rect: [number, number, number, number];
}

function brasDe(forme: FormeVoie, w: number): Bras[] {
  const l = LIAISONS_CANON[forme];
  const bras: Bras[] = [];
  if (l[0]) bras.push({ dir: 0, rect: [0.5 - w, 0.5 + w, 0, 0.5] });
  if (l[1]) bras.push({ dir: 1, rect: [0.5, 1, 0.5 - w, 0.5 + w] });
  if (l[2]) bras.push({ dir: 2, rect: [0.5 - w, 0.5 + w, 0.5, 1] });
  if (l[3]) bras.push({ dir: 3, rect: [0, 0.5, 0.5 - w, 0.5 + w] });
  return bras;
}

/**
 * Le motif en un point, en `[0, 1]` : `0` laisse le revêtement, `1` peint la
 * couleur du motif. `long` est la coordonnée le long du bras le plus proche,
 * `trav` l'écart à son axe ; `centre` dit qu'on est dans le disque du carrefour.
 */
function motifEn(
  ap: ApparenceVoie, long: number, trav: number, centre: boolean, nBras: number,
  grain: number, a: number, b: number,
): number {
  switch (ap.motif) {
    case 'tirets': {
      // Pas de ligne au milieu d'un carrefour : deux axes qui se croisent en
      // pointillé se lisent comme une cible.
      if (centre && nBras > 2) return 0;
      const ligne = 1 - lisser(0.012, 0.022, Math.abs(trav));
      const tiret = ((long * 4) % 1 + 1) % 1 < 0.55 ? 1 : 0;
      return ligne * tiret * 0.85;
    }
    case 'ornieres': {
      const r = Math.exp(-(((Math.abs(trav) - ap.demiLargeur * 0.55) / 0.035) ** 2));
      return r * (0.45 + grain * 0.4);
    }
    case 'paves': {
      // Quatorze pavés par case, rangs décalés d'un demi : le pas divise la
      // case, sinon la couture entre deux tuiles se voit.
      const pas = 1 / 14;
      const rang = Math.floor(b / pas);
      const u = ((a + (rang % 2) * pas * 0.5) / pas) % 1;
      const v = (b / pas) % 1;
      const joint = Math.min(u, 1 - u, v, 1 - v);
      return (1 - lisser(0.06, 0.17, joint)) * 0.8;
    }
    case 'planches': {
      // Des planches en travers du bras, douze par case, et des coquillages
      // clairs semés entre elles.
      const v = ((long * 12) % 1 + 1) % 1;
      const joint = Math.min(v, 1 - v);
      const bord = (1 - lisser(0.04, 0.14, joint)) * 0.7;
      const veine = Math.abs(Math.sin(trav * 90 + long * 7)) > 0.93 ? 0.25 : 0;
      return Math.max(bord, veine) + (grain > 0.82 ? -0.5 : 0);
    }
    case 'fissures': {
      const f = Math.abs(grain - 0.5) < 0.018 ? 1 : 0;
      return f * 0.7;
    }
    default:
      return 0;
  }
}

/**
 * Peint l'atlas d'un biome : `taille` pixels par tuile. Le canal alpha porte la
 * couverture — chaussée pleine, accotements fondus —, de sorte que le décalque
 * laisse voir le sol autour de la voie sans qu'on ait à découper la géométrie.
 */
export function atlasVoies(doc: Document, biome: Biome, taille = 128): HTMLCanvasElement {
  const ap = APPARENCES[biome];
  const L = taille * COLONNES_ATLAS;
  const H = taille * RANGS_ATLAS;
  const c = doc.createElement('canvas');
  c.width = L;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponible : atlas des voies impossible.');
  // Un seul bruit pour toutes les tuiles, tiré une fois : c'est lui qui coûte.
  const grain = bruitFractal(taille, 4, 6, 4111);
  const frange = bruitFractal(taille, 2, 4, 4211);
  const image = g.createImageData(L, H);
  const w = ap.demiLargeur;

  TUILES_ATLAS.forEach((forme, indice) => {
    const { colonne, rang } = tuileDe(forme);
    const bras = brasDe(forme, w);
    const rayonCentre = forme === 'isole' ? w * 1.25 : w;
    for (let py = 0; py < taille; py += 1) {
      for (let px = 0; px < taille; px += 1) {
        const a = (px + 0.5) / taille;
        const b = (py + 0.5) / taille;
        const i = py * taille + px;
        const n = grain[i] ?? 0.5;
        const f = frange[(i + indice * 977) % frange.length] ?? 0.5;

        // La distance à la voie : le disque du carrefour et chacun des bras.
        let d = Math.hypot(a - 0.5, b - 0.5) - rayonCentre;
        let proche: Bras | null = null;
        let dProche = Infinity;
        for (const br of bras) {
          const [x0, x1, y0, y1] = br.rect;
          const db = distRect(a, b, x0, x1, y0, y1);
          if (db < dProche) { dProche = db; proche = br; }
          d = Math.min(d, db);
        }
        // Un bord qui ondule : c'est la frange, forte sur un sentier, nulle
        // sur un bitume coulé au coffrage.
        d += (f - 0.5) * ap.frange * 2;

        const chaussee = 1 - lisser(-0.006, 0.006, d);
        let alpha: number;
        let couleur = mel(ap.sombre, ap.clair, 0.5 + (n - 0.5) * ap.grain);
        if (chaussee > 0) {
          // Coordonnées le long du bras le plus proche, pour les motifs.
          const dir = proche?.dir ?? 0;
          const long = dir === 0 || dir === 2 ? b : a;
          const trav = dir === 0 || dir === 2 ? a - 0.5 : b - 0.5;
          const centre = Math.hypot(a - 0.5, b - 0.5) < rayonCentre;
          const m = motifEn(ap, long, trav, centre, bras.length, n, a, b);
          couleur = mel(couleur, ap.couleurMotif, m);
          alpha = chaussee;
        } else {
          alpha = 0;
        }
        const acc = lisser(ap.largeurAccotement, 0, d) * (1 - chaussee);
        if (acc > 0) {
          const opac = ap.accotementPlein
            ? ap.opaciteAccotement * lisser(0, 0.35, acc)
            : ap.opaciteAccotement * acc ** 1.4;
          couleur = mel(couleur, mel(ap.accotement, ap.clair, (n - 0.5) * 0.4), 1);
          alpha = Math.max(alpha, opac);
        }
        const j = ((rang * taille + py) * L + colonne * taille + px) * 4;
        image.data[j] = Math.round(couleur[0]);
        image.data[j + 1] = Math.round(couleur[1]);
        image.data[j + 2] = Math.round(couleur[2]);
        image.data[j + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
      }
    }
  });
  g.putImageData(image, 0, 0);
  return c;
}

/** L'atlas en texture three.js : non retourné, non répété — ce sont des tuiles. */
export function textureVoies(doc: Document, biome: Biome, taille = 128): THREE.CanvasTexture {
  const t = texture(atlasVoies(doc, biome, taille), true);
  t.flipY = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
