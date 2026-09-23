/**
 * La grille **telle qu'elle se lit maintenant**, et la texture de données qui la
 * porte jusqu'au nuanceur.
 *
 * La grille est **lue** par `lecture.ts`, qui seul parle au moteur ; ce module
 * ne fait que la raisonner — liaisons, pièces, encodage — sans rien importer du
 * moteur au-delà d'un type, pour que le nuanceur qui en dépend reste léger.
 *
 * Les voies sont reprises de la 3D (`render3d/geometrie.ts`, qu'on n'importe
 * pas) : mêmes liaisons, même règle du pont toujours droit, mêmes six pièces.
 * Le nuanceur ne peint pas des tuiles d'atlas, il trace chaque bras depuis le
 * centre de la case jusqu'au milieu d'un bord : deux cases voisines se
 * raccordent donc **exactement**, à largeur constante, quel que soit le zoom.
 */

import type { EtatPartie } from '../../engine/index';
import { CARACTERE_PAR_TERRAIN, type CleTerrain } from '../../schemas/types';
import { codeDe, porteEau, TERRAINS_BATIS } from './terrains';

/** La grille logique d'un instant : un terrain par case, ligne par ligne. */
export interface GrilleSol {
  readonly largeur: number;
  readonly hauteur: number;
  readonly terrains: readonly CleTerrain[];
}

/** Terrain d'une case, avec bords collants : hors carte, on prolonge le bord. */
export function terrainEn(g: GrilleSol, x: number, y: number): CleTerrain {
  const cx = Math.max(0, Math.min(g.largeur - 1, x));
  const cy = Math.max(0, Math.min(g.hauteur - 1, y));
  return g.terrains[cy * g.largeur + cx] ?? 'plaine';
}

/** Le terrain de chaque caractère de grille, inversé une fois. */
const PAR_CARACTERE = new Map<string, CleTerrain>(
  (Object.entries(CARACTERE_PAR_TERRAIN) as [CleTerrain, string][]).map(([t, c]) => [c, t]),
);

/**
 * La grille **brute** d'un état, lue sur ses caractères, sans climat ni
 * mécanique : ce que le sol peut peindre à sa naissance, avant d'avoir reçu le
 * catalogue par la vue. La première `maj` la remplace par la lecture logique.
 */
export function grilleBrute(etat: EtatPartie): GrilleSol {
  const terrains: CleTerrain[] = new Array<CleTerrain>(etat.largeur * etat.hauteur);
  for (let y = 0; y < etat.hauteur; y += 1) {
    const ligne = etat.grille[y] ?? '';
    for (let x = 0; x < etat.largeur; x += 1) {
      terrains[y * etat.largeur + x] = PAR_CARACTERE.get(ligne[x] ?? '') ?? 'plaine';
    }
  }
  return { largeur: etat.largeur, hauteur: etat.hauteur, terrains };
}

/** Vrai si deux grilles disent la même chose, case pour case. */
export function memesTerrains(a: GrilleSol, b: GrilleSol): boolean {
  if (a.largeur !== b.largeur || a.hauteur !== b.hauteur) return false;
  for (let i = 0; i < a.terrains.length; i += 1) if (a.terrains[i] !== b.terrains[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Les liaisons, les pièces
// ---------------------------------------------------------------------------

/** Les quatre liaisons d'une case, dans l'ordre `[nord, est, sud, ouest]`. */
export type Liaisons = readonly [boolean, boolean, boolean, boolean];

/** Les décalages des quatre directions, dans le même ordre. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Les formes de pièce d'une voie, et leurs liaisons **canoniques**. Toute autre
 * configuration s'obtient en tournant une de ces six pièces par quarts de tour
 * horaires (`render3d/geometrie.ts`, repris tel quel).
 */
export type FormeVoie = 'bout' | 'droite' | 'virage' | 'te' | 'croix' | 'isole';

export const LIAISONS_CANON: Readonly<Record<FormeVoie, Liaisons>> = {
  isole: [false, false, false, false],
  bout: [true, false, false, false],
  droite: [true, false, true, false],
  virage: [true, true, false, false],
  te: [true, true, true, false],
  croix: [true, true, true, true],
};

/** Une pièce posée : sa forme et son nombre de quarts de tour horaires. */
export interface PieceVoie {
  forme: FormeVoie;
  rotation: 0 | 1 | 2 | 3;
}

/** Tourne des liaisons d'un quart de tour horaire par unité : le nord passe à l'est. */
export function tournerLiaisons(l: Liaisons, quarts: number): Liaisons {
  const k = ((quarts % 4) + 4) % 4;
  return [l[(4 - k) % 4]!, l[(5 - k) % 4]!, l[(6 - k) % 4]!, l[(7 - k) % 4]!];
}

/** La pièce de liaisons données : il y en a toujours exactement une. */
export function pieceDepuisLiaisons(l: Liaisons): PieceVoie {
  for (const forme of Object.keys(LIAISONS_CANON) as FormeVoie[]) {
    for (const rotation of [0, 1, 2, 3] as const) {
      const t = tournerLiaisons(LIAISONS_CANON[forme], rotation);
      if (t[0] === l[0] && t[1] === l[1] && t[2] === l[2] && t[3] === l[3]) return { forme, rotation };
    }
  }
  // Inatteignable : les six formes couvrent les seize cas.
  return { forme: 'croix', rotation: 0 };
}

/** Les liaisons d'une pièce posée. */
export function liaisonsDePiece(p: PieceVoie): Liaisons {
  return tournerLiaisons(LIAISONS_CANON[p.forme], p.rotation);
}

/** L'axe d'un pont : nord-sud ou est-ouest, celui de la circulation. */
export type AxePont = 'ns' | 'eo';

/**
 * L'axe d'un pont, lu sur ses voisines : les voies qu'il relie comptent double,
 * l'eau qu'il franchit compte simple — l'eau est **à ses côtés**, pas dans son
 * axe. Sans aucun indice, nord-sud. C'est la règle de la 3D : un pont voisin
 * compte comme une voie, si bien que deux ponts bout à bout franchissent un
 * bras large au lieu de se tourner le dos.
 */
export function axePont(g: GrilleSol, x: number, y: number): AxePont {
  const voie = (dx: number, dy: number): number => {
    const t = terrainEn(g, x + dx, y + dy);
    return t === 'route' || t === 'pont' || TERRAINS_BATIS.has(t) ? 2 : 0;
  };
  const eau = (dx: number, dy: number): number => {
    const t = terrainEn(g, x + dx, y + dy);
    return t === 'mer' || t === 'riviere' ? 1 : 0;
  };
  const versNs = voie(0, -1) + voie(0, 1) + eau(1, 0) + eau(-1, 0);
  const versEo = voie(1, 0) + voie(-1, 0) + eau(0, 1) + eau(0, -1);
  return versEo > versNs ? 'eo' : 'ns';
}

/** Vrai si la direction `d` (0 nord … 3 ouest) court le long de l'axe. */
function dansAxe(axe: AxePont, d: number): boolean {
  return axe === 'ns' ? d % 2 === 0 : d % 2 === 1;
}

/** Vrai si la case est dans la carte. */
function dedans(g: GrilleSol, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.largeur && y < g.hauteur;
}

/**
 * Les liaisons d'une case selon une règle de raccord. Hors carte, une voie ne
 * se raccorde que si elle **arrive en face** : une route qui descend vers le
 * bord continue au-delà, elle ne finit pas en moignon ; une route qui longe le
 * bord ne lance pas un bras vers l'extérieur à chaque case — ce que faisait le
 * bord prolongé de la 3D.
 */
function liaisonsSelon(
  g: GrilleSol, x: number, y: number, relie: (t: CleTerrain, d: number, vx: number, vy: number) => boolean,
): Liaisons {
  const interieur = DIRECTIONS.map(([dx, dy]) => dedans(g, x + dx, y + dy));
  const l = DIRECTIONS.map(([dx, dy], d) =>
    interieur[d] === true && relie(terrainEn(g, x + dx, y + dy), d, x + dx, y + dy));
  for (let d = 0; d < 4; d += 1) {
    const face = (d + 2) % 4;
    if (!interieur[d]) l[d] = interieur[face] === true && l[face] === true;
  }
  return [l[0]!, l[1]!, l[2]!, l[3]!];
}

/**
 * Les liaisons **de voie** d'une case : une route se raccorde à une route, à un
 * bâtiment — elle mène quelque part, et son bout s'arrête à la cour —, et à un
 * pont **par son axe** seulement : une route qui arriverait sur le flanc d'un
 * pont buterait contre son garde-corps.
 */
export function liaisonsVoie(g: GrilleSol, x: number, y: number): Liaisons {
  return liaisonsSelon(g, x, y, (t, d, vx, vy) => {
    if (t === 'route' || TERRAINS_BATIS.has(t)) return true;
    return t === 'pont' && dansAxe(axePont(g, vx, vy), d);
  });
}

/**
 * La pièce de voie d'une case, ou `null` si elle n'en porte pas. Un pont est
 * toujours **droit** dans son axe : il traverse, il ne finit pas sur l'eau.
 */
export function pieceVoie(g: GrilleSol, x: number, y: number): PieceVoie | null {
  const t = terrainEn(g, x, y);
  if (t === 'pont') return { forme: 'droite', rotation: axePont(g, x, y) === 'eo' ? 1 : 0 };
  if (t !== 'route') return null;
  return pieceDepuisLiaisons(liaisonsVoie(g, x, y));
}

/**
 * Les liaisons **d'eau** d'une case de rivière : vers une rivière, vers la mer
 * (l'estuaire), et vers un pont qui la franchit — c'est-à-dire dont l'axe est
 * **en travers** de la direction.
 */
export function liaisonsEau(g: GrilleSol, x: number, y: number): Liaisons {
  return liaisonsSelon(g, x, y, (t, d, vx, vy) => {
    if (t === 'riviere' || t === 'mer') return true;
    return t === 'pont' && !dansAxe(axePont(g, vx, vy), d);
  });
}

/**
 * La pièce d'eau d'une case : le chenal d'une rivière, ou celui qui passe sous
 * un pont — droit, **en travers** de son axe. Un pont dont aucun côté ne touche
 * l'eau garde ses deux bras : un tablier sur du sec se lirait comme une erreur.
 * La mer n'a pas de pièce : elle se dessine par son étendue, pas par ses bras.
 */
export function pieceEau(g: GrilleSol, x: number, y: number): PieceVoie | null {
  const t = terrainEn(g, x, y);
  if (t === 'riviere') return pieceDepuisLiaisons(liaisonsEau(g, x, y));
  if (t !== 'pont') return null;
  const travers: Liaisons = axePont(g, x, y) === 'ns'
    ? [false, true, false, true]
    : [true, false, true, false];
  const l = DIRECTIONS.map(([dx, dy], d) => travers[d] === true && porteEau(terrainEn(g, x + dx, y + dy)));
  if (!l.some(Boolean)) return pieceDepuisLiaisons(travers);
  return pieceDepuisLiaisons([l[0]!, l[1]!, l[2]!, l[3]!]);
}

// ---------------------------------------------------------------------------
// La texture de données
// ---------------------------------------------------------------------------

/**
 * Les bits d'une case. Canal R : le code du terrain (`terrains.ts`). Canal G :
 * les bras de voie, l'axe d'un pont et la présence d'une voie. Canal B : les
 * bras d'eau. Canal A : le brouillard — 255 vue, 0 cachée.
 */
export const BITS = {
  NORD: 1,
  EST: 2,
  SUD: 4,
  OUEST: 8,
  /** Un pont dont la circulation va d'est en ouest. */
  AXE_EO: 16,
  /** La case porte une voie : une route, ou le tablier d'un pont. */
  VOIE: 32,
} as const;

/** Les quatre premiers bits d'une liaison. */
export function bitsDe(l: Liaisons): number {
  return (l[0] ? BITS.NORD : 0) | (l[1] ? BITS.EST : 0) | (l[2] ? BITS.SUD : 0) | (l[3] ? BITS.OUEST : 0);
}

/** L'octet de voie d'une case (canal G). */
export function octetVoie(g: GrilleSol, x: number, y: number): number {
  const piece = pieceVoie(g, x, y);
  if (!piece) return 0;
  const axe = terrainEn(g, x, y) === 'pont' && axePont(g, x, y) === 'eo' ? BITS.AXE_EO : 0;
  return bitsDe(liaisonsDePiece(piece)) | axe | BITS.VOIE;
}

/** L'octet d'eau d'une case (canal B). */
export function octetEau(g: GrilleSol, x: number, y: number): number {
  const piece = pieceEau(g, x, y);
  return piece ? bitsDe(liaisonsDePiece(piece)) : 0;
}

/** Une case décodée : ce que le nuanceur lit dans un texel. */
export interface CaseCodee {
  code: number;
  voie: number;
  eau: number;
  vue: number;
}

/**
 * Encode la grille en RGBA, une case par texel, ligne par ligne — la ligne 0
 * de la carte est la ligne 0 de la texture, sans retournement. `brouillard`
 * (`niveauxBrouillard` du contrat) remplit le canal A ; `null` : tout est vu.
 * `sortie` est réutilisée si elle a la bonne taille : un survol ne doit rien
 * allouer.
 */
export function encoderCases(
  g: GrilleSol, brouillard: Uint8Array | null, sortie?: Uint8Array,
): Uint8Array {
  const n = g.largeur * g.hauteur;
  const octets = sortie && sortie.length === n * 4 ? sortie : new Uint8Array(n * 4);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const i = y * g.largeur + x;
      octets[i * 4] = codeDe(terrainEn(g, x, y));
      octets[i * 4 + 1] = octetVoie(g, x, y);
      octets[i * 4 + 2] = octetEau(g, x, y);
      octets[i * 4 + 3] = brouillard ? (brouillard[i] ?? 255) : 255;
    }
  }
  return octets;
}

/**
 * Réécrit le seul canal du brouillard. Rend vrai si un octet a changé : la vue
 * repasse ici à chaque survol avec un brouillard neuf mais égal.
 */
export function poserBrouillard(octets: Uint8Array, brouillard: Uint8Array | null): boolean {
  let change = false;
  const n = octets.length / 4;
  for (let i = 0; i < n; i += 1) {
    const v = brouillard ? (brouillard[i] ?? 255) : 255;
    if (octets[i * 4 + 3] !== v) {
      octets[i * 4 + 3] = v;
      change = true;
    }
  }
  return change;
}

/** Lit un texel encodé. */
export function decoderCase(octets: Uint8Array, largeur: number, x: number, y: number): CaseCodee {
  const i = (y * largeur + x) * 4;
  return {
    code: octets[i] ?? 0,
    voie: octets[i + 1] ?? 0,
    eau: octets[i + 2] ?? 0,
    vue: octets[i + 3] ?? 0,
  };
}
