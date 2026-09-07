/**
 * Le paysage : les **accessoires** qui font qu'un biome se reconnaît avant même
 * qu'on ait lu la grille — haies et bottes de foin du bocage, souches et
 * champignons du sous-bois, cairns et névés des hauteurs, cactus du désert,
 * lianes de la jungle, congères et lacs gelés, fumerolles et coulées, oyats et
 * phare, cocotiers et pirogues, roseaux et nénuphars. Et la **ligne de rivage**,
 * écume ou galets, là où l'eau touche la terre.
 *
 * Trois règles le tiennent, les mêmes que pour les arbres et les rochers de
 * `decor.ts` :
 *
 * - **Tout est instancié.** Une géométrie par genre d'accessoire, un
 *   `InstancedMesh` par genre, une teinte par instance. Une carte de bocage a
 *   cent haies et un seul appel de dessin pour toutes.
 * - **Tout est déterministe**, tiré de `alea(x, y, sel)` : deux montages
 *   sèment exactement le même paysage, et une case ne porte jamais deux fois le
 *   même hasard.
 * - **Le centre d'une case reste libre** (`10-rendu-3d.md` §4.2) : c'est là que
 *   se pose une unité. Les accessoires se sèment en anneau, au bord, ou entre
 *   les arbres, jamais au milieu — et jamais sur une case bâtie ni sur une route,
 *   qui ont leur propre décor.
 *
 * Le semis (`semerPaysage`, `segmentsRivage`) est **pur** et testé sans WebGL ;
 * le montage three.js (`creerPaysage`) ne fait que le poser sur le relief. Et
 * il le repose à chaque `majRelief` : toute donnée dérivée de la grille et
 * figée au montage est un gel en puissance (`CLAUDE.md`, « le terrain qui
 * bouge »).
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, materialColor, materialOpacity } from 'three/tsl';

import type { Biome, CleTerrain, Saison } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import { alea, CASE, NIVEAU_EAU, type GrilleTerrain } from './geometrie';

/**
 * Vrai si deux ensembles de cases vues disent la même chose. La vue arrive à
 * chaque survol avec un ensemble **neuf** ; comparer les contenus est ce qui
 * permet de ne rien refaire tant qu'aucune case n'a changé de camp.
 */
export function memesVisibles(a: ReadonlySet<string> | null, b: ReadonlySet<string> | null): boolean {
  if (a === b) return true;
  if (a === null || b === null || a.size !== b.size) return false;
  for (const c of a) if (!b.has(c)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Le vocabulaire : genres, formes, espèces
// ---------------------------------------------------------------------------

/** Les genres d'accessoires, tous biomes confondus. */
export const GENRES_PAYSAGE = [
  // Plaine — le bocage.
  'haie', 'botte', 'champ', 'cloture', 'moulin', 'ailes_moulin', 'herbe_haute', 'herbes_hautes',
  // Forêt — le sous-bois.
  'souche', 'fougere', 'champignon', 'tronc', 'buisson',
  // Montagne — l'alpage.
  'eboulis', 'neve', 'cairn', 'chalet', 'herbe_alpine',
  // Désert — et son oasis.
  'dune', 'cactus', 'ossement', 'palmier_oasis', 'touffe_oasis',
  // Jungle.
  'palmier', 'liane', 'racine', 'fleur', 'fougere_geante',
  // Neige.
  'sapin_neige', 'congere', 'glace', 'cairn_givre', 'bouleau',
  // Volcanique.
  'basalte', 'fumerolle', 'fumee', 'coulee', 'lave', 'fougere_pionniere', 'scorie',
  // Côte.
  'oyat', 'rocher_greve', 'cabane', 'phare', 'lanterne', 'algue',
  // Archipel.
  'cocotier', 'recif', 'pirogue', 'hibiscus',
  // Marais.
  'roseau', 'jonc', 'mangrove', 'ponton', 'nenuphar',
] as const;
export type GenrePaysage = typeof GENRES_PAYSAGE[number];

/** Les silhouettes : une forme peut servir plusieurs genres, dans des teintes différentes. */
type Forme =
  | 'haie' | 'botte' | 'champ' | 'cloture' | 'moulin' | 'ailes' | 'touffe'
  | 'souche' | 'fougere' | 'champignon' | 'tronc' | 'buisson'
  | 'eboulis' | 'neve' | 'cairn' | 'chalet'
  | 'dune' | 'cactus' | 'ossement' | 'palmier'
  | 'liane' | 'racine' | 'fleur'
  | 'sapin_neige' | 'glace' | 'bouleau'
  | 'basalte' | 'fumerolle' | 'fumee' | 'coulee' | 'lave'
  | 'rocher' | 'cabane' | 'phare' | 'lanterne' | 'algue'
  | 'recif' | 'pirogue' | 'mangrove' | 'ponton' | 'nenuphar';

/** Ce qu'un voisinage doit contenir pour qu'une case reçoive l'accessoire. */
type Voisinage = 'eau' | 'terre' | 'montagne' | 'foret' | 'bati' | 'eau_et_bati';

/**
 * Comment un accessoire se place dans sa case.
 * - `anneau` : n'importe où sur une couronne, orientation libre ;
 * - `bord` : contre l'un des quatre côtés, orienté le long du côté — c'est ce
 *   qui permet à une haie ou à un champ de faire 0,8 case de long sans sortir ;
 * - `sous_bois` : entre les trois arbres que `decor.ts` pose sur une forêt.
 */
type Pose = 'anneau' | 'bord' | 'sous_bois';

/** La règle de semis d'un genre. */
export interface Regle {
  /** Les terrains qui le portent. Jamais une case bâtie ni une route. */
  sur: readonly CleTerrain[];
  pres?: Voisinage;
  /** Part des cases éligibles qui en reçoivent. */
  chance: number;
  /** Nombre par case retenue, bornes incluses. */
  nombre: readonly [number, number];
  /** Rayon depuis le centre, en fraction de case. Toujours hors du disque central. */
  rayon: readonly [number, number];
  pose: Pose;
  echelle: readonly [number, number];
  /** Ne descend jamais sous le plan d'eau : un ponton, un nénuphar. */
  flotte?: boolean;
  /** Se tient sous le plan d'eau, d'autant : un récif. */
  immersion?: number;
  /** Un second accessoire posé au même point : ailes du moulin, fumée, lave, lanterne. */
  jumeau?: GenrePaysage;
}

/** Ce qui fait la matière d'un genre : c'est elle que l'ambiance retouche. */
type Matiere = 'vegetal' | 'persistant' | 'mineral' | 'bois' | 'glace' | 'feu' | 'fumee' | 'lumiere';

interface Espece {
  forme: Forme;
  couleur: number;
  matiere: Matiere;
  regle: Regle;
  /** Se balance au vent, comme les arbres. */
  balance?: boolean;
  /** Teintes possibles d'une instance : une palette de fleurs, sinon une variation de gris. */
  palette?: readonly number[];
  /** Décalage local d'un jumeau, dans le repère orienté de l'instance. */
  decalage?: { y: number; z: number };
  /** Ne projette pas d'ombre : trop plat, ou pas de la matière. */
  sansOmbre?: boolean;
}

const RAYON_ANNEAU: readonly [number, number] = [0.2, 0.42];
const RAYON_BORD: readonly [number, number] = [0.37, 0.42];
const RAYON_SOUS_BOIS: readonly [number, number] = [0.18, 0.28];

const FLEURS_JUNGLE: readonly number[] = [0xff6f61, 0xffc23d, 0xf25fa0, 0xff8c42, 0xffffff];
const FLEURS_HIBISCUS: readonly number[] = [0xe8334a, 0xff7a9a, 0xffb347];

/** Les cinquante-quatre espèces : forme, teinte, matière, règle de semis. */
export const ESPECES: Readonly<Record<GenrePaysage, Espece>> = {
  // --- Plaine
  haie: { forme: 'haie', couleur: 0x3f6f35, matiere: 'vegetal', regle: { sur: ['plaine'], chance: 0.14, nombre: [1, 1], rayon: RAYON_BORD, pose: 'bord', echelle: [0.85, 1.1] } },
  botte: { forme: 'botte', couleur: 0xc9a85a, matiere: 'bois', regle: { sur: ['plaine'], chance: 0.1, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.1] } },
  champ: { forme: 'champ', couleur: 0x8a6a3e, matiere: 'vegetal', sansOmbre: true, regle: { sur: ['plaine'], chance: 0.16, nombre: [1, 2], rayon: RAYON_BORD, pose: 'bord', echelle: [0.9, 1] } },
  cloture: { forme: 'cloture', couleur: 0x8b6a45, matiere: 'bois', regle: { sur: ['plaine'], pres: 'bati', chance: 0.55, nombre: [1, 1], rayon: RAYON_BORD, pose: 'bord', echelle: [0.9, 1.05] } },
  moulin: { forme: 'moulin', couleur: 0xd9cfb8, matiere: 'mineral', regle: { sur: ['plaine'], chance: 0.025, nombre: [1, 1], rayon: [0.3, 0.36], pose: 'anneau', echelle: [0.95, 1.05], jumeau: 'ailes_moulin' } },
  ailes_moulin: { forme: 'ailes', couleur: 0xe8e2d2, matiere: 'bois', decalage: { y: 0.3, z: 0.15 }, regle: { sur: [], chance: 0, nombre: [0, 0], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1, 1] } },
  herbe_haute: { forme: 'touffe', couleur: 0x7fa04a, matiere: 'vegetal', balance: true, regle: { sur: ['plaine'], chance: 0.22, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1] } },
  // Le terrain `herbe_haute` (7 septembre 2026 au soir) : les mêmes touffes, mais
  // partout et hautes — c'est ce qui doit dire « ça cache un fantassin » sans
  // qu'on lise la fiche. Le sol reste celui de la plaine ; ce sont les touffes
  // qui font le terrain.
  herbes_hautes: { forme: 'touffe', couleur: 0x6f9a3e, matiere: 'vegetal', balance: true, regle: { sur: ['herbe_haute'], chance: 1, nombre: [5, 7], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1.1, 1.45] } },
  // --- Forêt
  souche: { forme: 'souche', couleur: 0x6f5136, matiere: 'bois', regle: { sur: ['foret'], chance: 0.3, nombre: [1, 1], rayon: RAYON_SOUS_BOIS, pose: 'sous_bois', echelle: [0.8, 1.1] } },
  fougere: { forme: 'fougere', couleur: 0x4f8a3c, matiere: 'vegetal', balance: true, regle: { sur: ['foret', 'plaine'], pres: 'foret', chance: 0.4, nombre: [1, 2], rayon: RAYON_SOUS_BOIS, pose: 'sous_bois', echelle: [0.7, 1] } },
  champignon: { forme: 'champignon', couleur: 0xb8452f, matiere: 'persistant', regle: { sur: ['foret'], chance: 0.28, nombre: [1, 1], rayon: RAYON_SOUS_BOIS, pose: 'sous_bois', echelle: [0.8, 1.2] } },
  tronc: { forme: 'tronc', couleur: 0x6b4a2f, matiere: 'bois', regle: { sur: ['foret', 'plaine'], pres: 'foret', chance: 0.14, nombre: [1, 1], rayon: RAYON_BORD, pose: 'bord', echelle: [0.8, 1] } },
  buisson: { forme: 'buisson', couleur: 0x4d7d3a, matiere: 'vegetal', regle: { sur: ['plaine', 'foret'], chance: 0.22, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1.1] } },
  // --- Montagne
  eboulis: { forme: 'eboulis', couleur: 0x8c8a82, matiere: 'mineral', regle: { sur: ['plaine', 'foret'], pres: 'montagne', chance: 0.5, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.2] } },
  neve: { forme: 'neve', couleur: 0xf2f6fa, matiere: 'glace', sansOmbre: true, regle: { sur: ['montagne'], chance: 0.45, nombre: [1, 1], rayon: [0.3, 0.42], pose: 'anneau', echelle: [0.8, 1.2] } },
  cairn: { forme: 'cairn', couleur: 0x8d8d86, matiere: 'mineral', regle: { sur: ['montagne'], chance: 0.22, nombre: [1, 1], rayon: [0.38, 0.44], pose: 'anneau', echelle: [0.9, 1.1] } },
  chalet: { forme: 'chalet', couleur: 0x7a5a3a, matiere: 'bois', regle: { sur: ['plaine'], pres: 'montagne', chance: 0.12, nombre: [1, 1], rayon: [0.3, 0.36], pose: 'anneau', echelle: [0.95, 1.05] } },
  herbe_alpine: { forme: 'touffe', couleur: 0x8ea560, matiere: 'vegetal', balance: true, regle: { sur: ['plaine'], chance: 0.28, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.5, 0.75] } },
  // --- Désert. Le générateur y pose du **sable** (`plage`), pas de la plaine : les règles le suivent.
  dune: { forme: 'dune', couleur: 0xe0c48c, matiere: 'mineral', sansOmbre: true, regle: { sur: ['plaine', 'plage'], chance: 0.3, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.3] } },
  cactus: { forme: 'cactus', couleur: 0x4e8a48, matiere: 'persistant', regle: { sur: ['plaine', 'plage'], chance: 0.2, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1.1] } },
  ossement: { forme: 'ossement', couleur: 0xb59f87, matiere: 'mineral', regle: { sur: ['plaine', 'plage', 'montagne'], chance: 0.12, nombre: [1, 1], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.9, 1.3] } },
  palmier_oasis: { forme: 'palmier', couleur: 0x3f9450, matiere: 'persistant', regle: { sur: ['plaine', 'plage'], pres: 'eau', chance: 0.55, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.05] } },
  touffe_oasis: { forme: 'touffe', couleur: 0x6fa24e, matiere: 'vegetal', balance: true, regle: { sur: ['plaine', 'plage'], pres: 'eau', chance: 0.6, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1] } },
  // --- Jungle
  palmier: { forme: 'palmier', couleur: 0x3f9450, matiere: 'persistant', regle: { sur: ['plaine', 'plage'], pres: 'foret', chance: 0.4, nombre: [1, 1], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.85, 1.1] } },
  liane: { forme: 'liane', couleur: 0x5a7a3a, matiere: 'persistant', balance: true, regle: { sur: ['foret'], chance: 0.5, nombre: [1, 2], rayon: [0.26, 0.34], pose: 'sous_bois', echelle: [0.9, 1.1] } },
  racine: { forme: 'racine', couleur: 0x6b4a2f, matiere: 'bois', regle: { sur: ['foret'], chance: 0.4, nombre: [1, 1], rayon: RAYON_SOUS_BOIS, pose: 'sous_bois', echelle: [0.9, 1.2] } },
  fleur: { forme: 'fleur', couleur: 0xffffff, matiere: 'persistant', palette: FLEURS_JUNGLE, regle: { sur: ['plaine', 'foret'], chance: 0.35, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.9, 1.3] } },
  fougere_geante: { forme: 'fougere', couleur: 0x3f8a4a, matiere: 'persistant', balance: true, regle: { sur: ['plaine'], chance: 0.3, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1.2, 1.7] } },
  // --- Neige
  sapin_neige: { forme: 'sapin_neige', couleur: 0x3d6b4a, matiere: 'persistant', regle: { sur: ['plaine'], chance: 0.18, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1.1] } },
  congere: { forme: 'dune', couleur: 0xf4f7fb, matiere: 'glace', sansOmbre: true, regle: { sur: ['plaine', 'foret', 'plage'], chance: 0.32, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1.2] } },
  glace: { forme: 'glace', couleur: 0xd8ecf6, matiere: 'glace', sansOmbre: true, regle: { sur: ['mer', 'riviere'], chance: 0.55, nombre: [1, 1], rayon: [0.18, 0.26], pose: 'anneau', echelle: [0.9, 1.2], flotte: true } },
  cairn_givre: { forme: 'cairn', couleur: 0xb9c2c9, matiere: 'mineral', regle: { sur: ['montagne'], chance: 0.25, nombre: [1, 1], rayon: [0.38, 0.44], pose: 'anneau', echelle: [0.9, 1.1] } },
  bouleau: { forme: 'bouleau', couleur: 0xe9e6dc, matiere: 'vegetal', regle: { sur: ['plaine'], chance: 0.14, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.1] } },
  // --- Volcanique
  basalte: { forme: 'basalte', couleur: 0x3e3f45, matiere: 'mineral', regle: { sur: ['montagne', 'plaine'], chance: 0.25, nombre: [1, 1], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.2] } },
  fumerolle: { forme: 'fumerolle', couleur: 0x5a5048, matiere: 'mineral', regle: { sur: ['montagne', 'plaine'], chance: 0.14, nombre: [1, 1], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.9, 1.2], jumeau: 'fumee' } },
  fumee: { forme: 'fumee', couleur: 0xcfcac4, matiere: 'fumee', sansOmbre: true, decalage: { y: 0.08, z: 0 }, regle: { sur: [], chance: 0, nombre: [0, 0], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1, 1] } },
  coulee: { forme: 'coulee', couleur: 0x2a2626, matiere: 'mineral', sansOmbre: true, regle: { sur: ['plaine', 'montagne'], chance: 0.16, nombre: [1, 1], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.9, 1.3], jumeau: 'lave' } },
  lave: { forme: 'lave', couleur: 0xff7a1a, matiere: 'feu', sansOmbre: true, regle: { sur: [], chance: 0, nombre: [0, 0], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1, 1] } },
  fougere_pionniere: { forme: 'fougere', couleur: 0x5f9a3c, matiere: 'vegetal', balance: true, regle: { sur: ['plaine'], chance: 0.3, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.6, 0.9] } },
  scorie: { forme: 'eboulis', couleur: 0x3c3a3a, matiere: 'mineral', regle: { sur: ['plaine', 'foret'], chance: 0.3, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.2] } },
  // --- Côte
  oyat: { forme: 'touffe', couleur: 0xbdb27a, matiere: 'vegetal', balance: true, regle: { sur: ['plage'], chance: 0.6, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1] } },
  rocher_greve: { forme: 'rocher', couleur: 0x6f7470, matiere: 'mineral', regle: { sur: ['plage', 'plaine'], pres: 'eau', chance: 0.4, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.7, 1.2] } },
  cabane: { forme: 'cabane', couleur: 0x9a7d5b, matiere: 'bois', regle: { sur: ['plage'], chance: 0.12, nombre: [1, 1], rayon: [0.3, 0.38], pose: 'anneau', echelle: [0.95, 1.05] } },
  phare: { forme: 'phare', couleur: 0xf0ece2, matiere: 'mineral', regle: { sur: ['plaine', 'plage'], pres: 'eau_et_bati', chance: 0.35, nombre: [1, 1], rayon: [0.3, 0.36], pose: 'anneau', echelle: [1, 1], jumeau: 'lanterne' } },
  lanterne: { forme: 'lanterne', couleur: 0xffe9a8, matiere: 'lumiere', sansOmbre: true, decalage: { y: 0.53, z: 0 }, regle: { sur: [], chance: 0, nombre: [0, 0], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1, 1] } },
  algue: { forme: 'algue', couleur: 0x3f5a3a, matiere: 'persistant', sansOmbre: true, regle: { sur: ['plage'], chance: 0.35, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.3] } },
  // --- Archipel
  cocotier: { forme: 'palmier', couleur: 0x47a35a, matiere: 'persistant', regle: { sur: ['plage'], chance: 0.5, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.1] } },
  recif: { forme: 'recif', couleur: 0x8a7a5a, matiere: 'mineral', sansOmbre: true, regle: { sur: ['mer'], pres: 'terre', chance: 0.4, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.3], immersion: 0.03 } },
  pirogue: { forme: 'pirogue', couleur: 0x7a5a3a, matiere: 'bois', regle: { sur: ['plage'], pres: 'eau', chance: 0.18, nombre: [1, 1], rayon: RAYON_BORD, pose: 'bord', echelle: [0.9, 1.05] } },
  hibiscus: { forme: 'fleur', couleur: 0xffffff, matiere: 'persistant', palette: FLEURS_HIBISCUS, regle: { sur: ['plaine', 'plage'], chance: 0.3, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.9, 1.3] } },
  // --- Marais
  roseau: { forme: 'touffe', couleur: 0x9a9a5a, matiere: 'vegetal', balance: true, regle: { sur: ['plaine', 'foret', 'plage'], pres: 'eau', chance: 0.7, nombre: [2, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [1.1, 1.6] } },
  jonc: { forme: 'touffe', couleur: 0x4a6a3a, matiere: 'vegetal', balance: true, regle: { sur: ['plaine', 'riviere'], chance: 0.35, nombre: [1, 2], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.6, 0.9], flotte: true } },
  mangrove: { forme: 'mangrove', couleur: 0x3f7f45, matiere: 'persistant', regle: { sur: ['mer', 'riviere'], pres: 'terre', chance: 0.4, nombre: [1, 1], rayon: [0.26, 0.4], pose: 'anneau', echelle: [0.85, 1.1], flotte: true } },
  ponton: { forme: 'ponton', couleur: 0x8c7050, matiere: 'bois', regle: { sur: ['plaine'], pres: 'eau', chance: 0.14, nombre: [1, 1], rayon: RAYON_BORD, pose: 'bord', echelle: [0.95, 1.05], flotte: true } },
  nenuphar: { forme: 'nenuphar', couleur: 0x4e8f4a, matiere: 'persistant', sansOmbre: true, regle: { sur: ['mer', 'riviere'], chance: 0.55, nombre: [1, 3], rayon: RAYON_ANNEAU, pose: 'anneau', echelle: [0.8, 1.3], flotte: true } },
};

/**
 * Les accessoires de chaque biome, dans l'ordre où ils se sèment. Cet ordre est
 * **signifiant** : le rang d'un genre entre dans son sel d'aléa, et le changer
 * change le paysage de toutes les cartes du biome.
 */
export const PAYSAGES: Readonly<Record<Biome, readonly GenrePaysage[]>> = {
  plaine: ['haie', 'botte', 'champ', 'cloture', 'moulin', 'herbe_haute'],
  foret: ['souche', 'fougere', 'champignon', 'tronc', 'buisson'],
  montagne: ['eboulis', 'neve', 'cairn', 'chalet', 'herbe_alpine'],
  desert: ['dune', 'cactus', 'ossement', 'palmier_oasis', 'touffe_oasis'],
  jungle: ['palmier', 'liane', 'racine', 'fleur', 'fougere_geante'],
  neige: ['sapin_neige', 'congere', 'glace', 'cairn_givre', 'bouleau'],
  volcanique: ['basalte', 'fumerolle', 'coulee', 'fougere_pionniere', 'scorie'],
  cotier: ['oyat', 'rocher_greve', 'cabane', 'phare', 'algue'],
  archipel: ['cocotier', 'recif', 'pirogue', 'hibiscus', 'rocher_greve'],
  marais: ['roseau', 'jonc', 'mangrove', 'ponton', 'nenuphar'],
};

// ---------------------------------------------------------------------------
// Le semis, pur
// ---------------------------------------------------------------------------

/** Un accessoire semé : sa place dans le monde et ce qui le distingue de ses voisins. */
export interface Accessoire {
  genre: GenrePaysage;
  /** Position dans le monde, hors altitude : l'altitude se relit à chaque pose. */
  x: number;
  z: number;
  /** Rotation autour de la verticale. */
  angle: number;
  echelle: number;
  /** 0 à 1 : choisit dans la palette, ou nuance le gris. */
  teinte: number;
  /** La case d'origine, pour les tests et le voisinage. */
  case: { x: number; y: number };
}

const EAU: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['mer', 'riviere']);
const BATI: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['ville', 'qg', 'usine', 'aeroport', 'radar', 'port']);

/** Vrai si l'une des huit voisines vérifie le prédicat. */
function voisine(g: GrilleTerrain, x: number, y: number, ok: (t: CleTerrain) => boolean): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const vx = x + dx;
      const vy = y + dy;
      if (vx < 0 || vy < 0 || vx >= g.largeur || vy >= g.hauteur) continue;
      if (ok(g.terrainDe(vx, vy))) return true;
    }
  }
  return false;
}

function voisinageOk(g: GrilleTerrain, x: number, y: number, pres: Voisinage | undefined): boolean {
  switch (pres) {
    case undefined: return true;
    case 'eau': return voisine(g, x, y, (t) => EAU.has(t));
    case 'terre': return voisine(g, x, y, (t) => !EAU.has(t));
    case 'montagne': return voisine(g, x, y, (t) => t === 'montagne');
    case 'foret': return voisine(g, x, y, (t) => t === 'foret');
    case 'bati': return voisine(g, x, y, (t) => BATI.has(t));
    case 'eau_et_bati': return voisine(g, x, y, (t) => EAU.has(t)) && voisine(g, x, y, (t) => BATI.has(t));
    default: return true;
  }
}

/**
 * Le sel d'aléa d'un genre : au-delà de mille, pour ne jamais recouper ceux
 * des arbres, des pierres et des bâtiments de `decor.ts`. Huit accessoires par
 * case au plus, six tirages par accessoire.
 */
function sel(rang: number, i: number, j: number): number {
  return 1000 + rang * 64 + 8 + i * 6 + j;
}

/**
 * Sème les accessoires d'un biome sur une grille. Pur et déterministe : même
 * grille, même biome, mêmes positions — c'est ce qui rend le paysage testable.
 */
export function semerPaysage(g: GrilleTerrain, biome: Biome): Accessoire[] {
  const sortie: Accessoire[] = [];
  const genres = PAYSAGES[biome];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const terrain = g.terrainDe(x, y);
      // Une route ou un bâtiment ont leur décor propre ; on ne leur en ajoute pas.
      if (BATI.has(terrain) || terrain === 'route' || terrain === 'pont') continue;
      genres.forEach((genre, rang) => {
        const espece = ESPECES[genre];
        const r = espece.regle;
        if (!r.sur.includes(terrain)) return;
        if (alea(x, y, sel(rang, 0, 0) - 8) >= r.chance) return;
        if (!voisinageOk(g, x, y, r.pres)) return;
        const nombre = r.nombre[0] + Math.floor(alea(x, y, sel(rang, 0, 0) - 7) * (r.nombre[1] - r.nombre[0] + 1));
        for (let i = 0; i < Math.min(8, nombre); i += 1) {
          const a = (j: number): number => alea(x, y, sel(rang, i, j));
          let polaire: number;
          let rayon: number;
          let angle: number;
          if (r.pose === 'bord') {
            // L'un des quatre côtés, à peine tourné : l'accessoire épouse le bord.
            polaire = Math.floor(a(0) * 4) * (Math.PI / 2) + (a(1) - 0.5) * 0.1;
            rayon = r.rayon[0] + a(2) * (r.rayon[1] - r.rayon[0]);
            angle = polaire + Math.PI / 2;
          } else if (r.pose === 'sous_bois') {
            // Entre les arbres : `decor.ts` les pose à i/3 de tour, à 0,39 du centre.
            polaire = ((i + 0.5) / 3) * Math.PI * 2 + (a(0) - 0.5) * 0.5;
            rayon = r.rayon[0] + a(2) * (r.rayon[1] - r.rayon[0]);
            angle = a(1) * Math.PI * 2;
          } else {
            // Des créneaux répartis, avec du jeu : deux accessoires ne se superposent pas.
            polaire = ((i + a(0) * 0.8) / Math.max(1, nombre)) * Math.PI * 2 + a(3) * 0.4;
            rayon = r.rayon[0] + a(2) * (r.rayon[1] - r.rayon[0]);
            angle = a(1) * Math.PI * 2;
          }
          const base: Accessoire = {
            genre,
            x: x * CASE + CASE / 2 + Math.cos(polaire) * rayon,
            z: y * CASE + CASE / 2 + Math.sin(polaire) * rayon,
            angle,
            echelle: r.echelle[0] + a(4) * (r.echelle[1] - r.echelle[0]),
            teinte: a(5),
            case: { x, y },
          };
          sortie.push(base);
          if (r.jumeau) sortie.push({ ...base, genre: r.jumeau });
        }
      });
    }
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// La ligne de rivage, pure
// ---------------------------------------------------------------------------

/** Un côté de case où l'eau touche la terre. */
export interface SegmentRivage {
  /** Milieu du côté, dans le monde. */
  x: number;
  z: number;
  /** Normale unitaire, de la terre vers l'eau. */
  nx: number;
  nz: number;
  /** La case de terre, pour le sel d'aléa. */
  case: { x: number; y: number };
}

/** Les côtés terre/eau d'une grille, dans l'ordre de lecture. Aucun au bord de carte. */
export function segmentsRivage(g: GrilleTerrain): SegmentRivage[] {
  const sortie: SegmentRivage[] = [];
  const cotes: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (EAU.has(g.terrainDe(x, y))) continue;
      for (const [dx, dy] of cotes) {
        const vx = x + dx;
        const vy = y + dy;
        if (vx < 0 || vy < 0 || vx >= g.largeur || vy >= g.hauteur) continue;
        if (!EAU.has(g.terrainDe(vx, vy))) continue;
        sortie.push({
          x: (x + 0.5 + dx * 0.5) * CASE,
          z: (y + 0.5 + dy * 0.5) * CASE,
          nx: dx,
          nz: dy,
          case: { x, y },
        });
      }
    }
  }
  return sortie;
}

/** Ce que le rivage montre : de l'écume sur les côtes douces, des galets sur les dures. */
export type GenreRivage = 'ecume' | 'galets';

const RIVAGE_PAR_BIOME: Readonly<Record<Biome, GenreRivage>> = {
  plaine: 'ecume', foret: 'galets', montagne: 'galets', desert: 'ecume', jungle: 'ecume',
  neige: 'galets', volcanique: 'galets', cotier: 'ecume', archipel: 'ecume', marais: 'galets',
};

export function genreRivage(biome: Biome): GenreRivage {
  return RIVAGE_PAR_BIOME[biome];
}

// ---------------------------------------------------------------------------
// Les formes : de petites géométries, colorées par sommet
// ---------------------------------------------------------------------------

/** Peint une géométrie d'une couleur unie : la couleur voyage avec les sommets à la fusion. */
function peindre(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const couleurs = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    couleurs[i * 3] = c.r;
    couleurs[i * 3 + 1] = c.g;
    couleurs[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  return geo;
}

/**
 * Fusionne des volumes en une seule géométrie. Tout passe en non indexé : les
 * polyèdres de three.js ne le sont pas, les boîtes et cylindres le sont, et
 * `mergeGeometries` refuse de mélanger les deux.
 */
function fusion(parties: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pretes = parties.map((p) => {
    if (!p.index) return p;
    const n = p.toNonIndexed();
    p.dispose();
    return n;
  });
  const geo = mergeGeometries(pretes);
  if (!geo) throw new Error('fusion de formes impossible : attributs disparates');
  for (const p of pretes) p.dispose();
  return geo;
}

interface Placement { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number }

function placer(geo: THREE.BufferGeometry, p: Placement): THREE.BufferGeometry {
  if (p.rx) geo.rotateX(p.rx);
  if (p.rz) geo.rotateZ(p.rz);
  if (p.ry) geo.rotateY(p.ry);
  geo.translate(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  return geo;
}

function boite(l: number, h: number, p: number, couleur: number, pl: Placement = {}): THREE.BufferGeometry {
  return peindre(placer(new THREE.BoxGeometry(l, h, p), pl), couleur);
}

function cylindre(rBas: number, rHaut: number, h: number, seg: number, couleur: number, pl: Placement = {}): THREE.BufferGeometry {
  return peindre(placer(new THREE.CylinderGeometry(rHaut, rBas, h, seg), pl), couleur);
}

function cone(r: number, h: number, seg: number, couleur: number, pl: Placement = {}): THREE.BufferGeometry {
  // Le cône est posé sur sa base, pas centré : c'est plus simple à empiler.
  return peindre(placer(new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), pl), couleur);
}

function boule(r: number, couleur: number, pl: Placement = {}, sx = 1, sy = 1, sz = 1, seg = 7): THREE.BufferGeometry {
  return peindre(placer(new THREE.SphereGeometry(r, seg, Math.max(3, seg - 2)).scale(sx, sy, sz), pl), couleur);
}

function disque(r: number, seg: number, couleur: number, y: number, longueur = Math.PI * 2): THREE.BufferGeometry {
  return peindre(new THREE.CircleGeometry(r, seg, 0, longueur).rotateX(-Math.PI / 2).translate(0, y, 0), couleur);
}

/**
 * Érode un volume : chaque sommet est poussé d'un bruit tiré de sa position
 * arrondie, pour que deux sommets confondus bougent ensemble — sans quoi les
 * facettes se décousent (la même précaution que pour les pierres de `decor.ts`).
 */
function eroder(geo: THREE.BufferGeometry, graine: number, force: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bruit = alea(Math.round(x * 512), Math.round(z * 512) + Math.round(y * 97), graine);
    const f = 1 - force / 2 + bruit * force;
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Une touffe : des lames fines penchées vers l'extérieur. Sert d'herbe, d'oyat, de roseau, de jonc. */
function touffe(couleur: number, hauteur: number, lames: number): THREE.BufferGeometry {
  const parties: THREE.BufferGeometry[] = [];
  for (let i = 0; i < lames; i += 1) {
    const a = (i / lames) * Math.PI * 2;
    const pente = 0.25 + alea(i, 3, 41) * 0.3;
    parties.push(cone(0.013, hauteur * (0.75 + alea(i, 5, 42) * 0.5), 4, couleur,
      { rz: pente, ry: -a, x: Math.cos(a) * 0.02, z: Math.sin(a) * 0.02 }));
  }
  return fusion(parties);
}

/** Une fougère : des frondes plates qui retombent en étoile. */
function fougere(couleur: number, taille: number): THREE.BufferGeometry {
  const parties: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const fronde = new THREE.ConeGeometry(0.035 * taille, 0.2 * taille, 4).scale(1, 1, 0.3)
      .translate(0, 0.1 * taille, 0).rotateZ(1.15).rotateY(-a).translate(0, 0.02, 0);
    parties.push(peindre(fronde, couleur));
  }
  return fusion(parties);
}

/** Un palmier : tronc courbé par segments, palmes en couronne. Cocotier et oasis. */
function palmier(couleurPalmes: number): THREE.BufferGeometry {
  const parties: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k += 1) {
    parties.push(cylindre(0.034 - k * 0.002, 0.03 - k * 0.002, 0.1, 6, 0x8b6b4a,
      { x: k * k * 0.012, y: 0.05 + k * 0.095, rz: -0.08 }));
  }
  const sommetX = 16 * 0.012 + 0.02;
  for (let i = 0; i < 6; i += 1) {
    // Six segments par palme : à 48 px la case, une palme est un trait, pas une surface.
    parties.push(boule(0.15, couleurPalmes, { ry: (i / 6) * Math.PI * 2, x: sommetX, y: 0.5 }, 0.35, 0.1, 1.15, 6));
  }
  parties.push(boule(0.04, 0x7a5a3a, { x: sommetX, y: 0.48 }, 1, 0.8, 1, 5));
  return fusion(parties);
}

/** Construit la forme d'un genre, dans sa couleur principale. */
function construireForme(forme: Forme, couleur: number): THREE.BufferGeometry {
  switch (forme) {
    case 'haie':
      return fusion([-0.24, -0.08, 0.08, 0.24].map((x, i) =>
        boule(0.11, couleur, { x, y: 0.09 }, 1, 0.8 + (i % 2) * 0.15, 0.9, 6)));
    case 'botte':
      return fusion([
        cylindre(0.075, 0.075, 0.11, 10, couleur, { rx: Math.PI / 2, y: 0.075 }),
        boite(0.152, 0.03, 0.115, 0xa8843e, { y: 0.075 }),
      ]);
    case 'champ': {
      const parties = [boite(0.8, 0.012, 0.17, couleur, { y: 0.006 })];
      for (let k = 0; k < 6; k += 1) {
        parties.push(boite(0.06, 0.035, 0.05, 0x7fa04a, { x: -0.33 + k * 0.132, y: 0.028, z: -0.04 }));
        parties.push(boite(0.06, 0.035, 0.05, 0x8fb254, { x: -0.27 + k * 0.132, y: 0.028, z: 0.045 }));
      }
      return fusion(parties);
    }
    case 'cloture':
      return fusion([
        ...[-0.28, 0, 0.28].map((x) => boite(0.025, 0.11, 0.025, couleur, { x, y: 0.055 })),
        boite(0.62, 0.018, 0.014, couleur, { y: 0.045 }),
        boite(0.62, 0.018, 0.014, couleur, { y: 0.085 }),
      ]);
    case 'moulin':
      return fusion([
        cylindre(0.09, 0.07, 0.32, 8, couleur, { y: 0.16 }),
        cone(0.095, 0.09, 8, 0x6a4b33, { y: 0.32 }),
        cylindre(0.012, 0.012, 0.09, 6, 0x4a3a2a, { rx: Math.PI / 2, y: 0.3, z: 0.1 }),
        boite(0.04, 0.06, 0.012, 0x4a3a2a, { y: 0.03, z: 0.085 }),
      ]);
    case 'ailes': {
      const parties = [boite(0.03, 0.56, 0.012, 0x6a4b33), boite(0.56, 0.03, 0.012, 0x6a4b33)];
      for (let k = 0; k < 4; k += 1) {
        parties.push(boite(0.05, 0.2, 0.008, couleur, { x: 0.035, y: 0.17, ry: 0, rz: 0 }).rotateZ(k * Math.PI / 2));
      }
      return fusion(parties);
    }
    case 'touffe':
      return touffe(couleur, 0.17, 7);
    case 'souche':
      return fusion([
        cylindre(0.075, 0.06, 0.09, 7, couleur, { y: 0.045 }),
        disque(0.06, 7, 0xb9976b, 0.092),
        boite(0.08, 0.03, 0.03, couleur, { x: 0.07, y: 0.015 }),
        boite(0.03, 0.03, 0.08, couleur, { z: -0.07, y: 0.015 }),
      ]);
    case 'fougere':
      return fougere(couleur, 1);
    case 'champignon':
      return fusion([
        cylindre(0.016, 0.012, 0.05, 6, 0xe9dcc4, { y: 0.025 }),
        boule(0.035, couleur, { y: 0.055 }, 1, 0.55, 1, 7),
        cylindre(0.011, 0.009, 0.035, 6, 0xe9dcc4, { x: 0.05, y: 0.017, z: 0.02 }),
        boule(0.024, couleur, { x: 0.05, y: 0.038, z: 0.02 }, 1, 0.55, 1, 6),
      ]);
    case 'tronc':
      return fusion([
        cylindre(0.055, 0.045, 0.5, 7, couleur, { rz: Math.PI / 2, y: 0.045 }),
        cylindre(0.02, 0.015, 0.08, 5, couleur, { rz: 0.5, x: 0.1, y: 0.1 }),
        disque(0.055, 7, 0xb9976b, 0).rotateZ(-Math.PI / 2).translate(0.25, 0.045, 0),
      ]);
    case 'buisson':
      return fusion([
        boule(0.075, couleur, { y: 0.06 }, 1, 0.85, 1, 6),
        boule(0.06, couleur, { x: 0.07, y: 0.05, z: 0.03 }, 1, 0.85, 1, 6),
        boule(0.055, couleur, { x: -0.05, y: 0.045, z: -0.05 }, 1, 0.85, 1, 6),
      ]);
    case 'eboulis': {
      const parties: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 7; k += 1) {
        const a = alea(k, 9, 51) * Math.PI * 2;
        const d = 0.04 + alea(k, 9, 52) * 0.1;
        parties.push(peindre(new THREE.TetrahedronGeometry(0.028 + alea(k, 9, 53) * 0.025)
          .rotateY(a * 2).translate(Math.cos(a) * d, 0.012, Math.sin(a) * d), couleur));
      }
      return fusion(parties);
    }
    case 'neve':
      return boule(0.2, couleur, { y: 0.002 }, 1, 0.12, 0.75, 8);
    case 'cairn':
      return fusion([0.06, 0.05, 0.04, 0.03].map((r, k) =>
        boule(r, couleur, { y: 0.02 + k * 0.05, ry: k * 0.7 }, 1, 0.55, 0.85, 6)));
    case 'chalet':
      return fusion([
        boite(0.24, 0.03, 0.18, 0x9b978c, { y: 0.015 }),
        boite(0.22, 0.1, 0.16, couleur, { y: 0.08 }),
        boite(0.14, 0.02, 0.2, 0x4a3b33, { x: -0.055, y: 0.155, rz: 0.75 }),
        boite(0.14, 0.02, 0.2, 0x4a3b33, { x: 0.055, y: 0.155, rz: -0.75 }),
        boite(0.03, 0.03, 0.03, 0x9b978c, { x: 0.06, y: 0.2, z: -0.04 }),
      ]);
    case 'dune':
      return boule(0.22, couleur, { y: 0.002 }, 1, 0.2, 0.5, 8);
    case 'cactus':
      return fusion([
        cylindre(0.035, 0.03, 0.28, 7, couleur, { y: 0.14 }),
        cylindre(0.022, 0.02, 0.09, 6, couleur, { rz: Math.PI / 2, x: 0.06, y: 0.16 }),
        cylindre(0.02, 0.018, 0.1, 6, couleur, { x: 0.1, y: 0.2 }),
        cylindre(0.022, 0.02, 0.08, 6, couleur, { rz: Math.PI / 2, x: -0.055, y: 0.1 }),
        cylindre(0.02, 0.018, 0.08, 6, couleur, { x: -0.09, y: 0.13 }),
      ]);
    case 'ossement':
      return fusion([-0.08, 0, 0.08].map((x, k) =>
        cone(0.022, 0.22 - Math.abs(k - 1) * 0.05, 5, couleur, { rz: (k - 1) * 0.5, x })));
    case 'palmier':
      return palmier(couleur);
    case 'liane': {
      const parties: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 3; k += 1) {
        const x = (k - 1) * 0.04;
        parties.push(cylindre(0.006, 0.006, 0.4, 4, couleur, { x, y: 0.24, rz: (k - 1) * 0.08 }));
        parties.push(boule(0.02, couleur, { x: x + 0.01, y: 0.12 + k * 0.1 }, 1, 0.6, 1.4, 5));
      }
      return fusion(parties);
    }
    case 'racine':
      return fusion([0, 1, 2, 3].map((k) =>
        boite(0.16, 0.05, 0.03, couleur, { x: 0.09, y: 0.03, rz: 0.35 }).rotateY(k * Math.PI / 2 + 0.6)));
    case 'fleur':
      return fusion([
        cylindre(0.006, 0.005, 0.07, 4, 0x4f8a3c, { y: 0.035 }),
        boule(0.022, 0xffffff, { y: 0.075 }, 1, 0.8, 1, 6),
      ]);
    case 'sapin_neige': {
      const parties = [cylindre(0.03, 0.025, 0.1, 5, 0x5a4030, { y: 0.05 })];
      [0, 1, 2].forEach((k) => {
        parties.push(cone(0.15 - k * 0.035, 0.22 - k * 0.03, 8, couleur, { y: 0.08 + k * 0.12 }));
        // La neige s'accroche au rebord de chaque étage : une jupe blanche, un peu plus large.
        parties.push(cone(0.158 - k * 0.035, 0.045, 8, 0xf4f8fb, { y: 0.085 + k * 0.12 }));
      });
      return fusion(parties);
    }
    case 'glace':
      return cylindre(0.3, 0.3, 0.012, 6, couleur, { y: 0.006 });
    case 'bouleau':
      return fusion([
        cylindre(0.02, 0.014, 0.34, 6, couleur, { y: 0.17 }),
        ...[0.1, 0.19, 0.27].map((y) => boite(0.036, 0.012, 0.036, 0x3b3a36, { y })),
        boule(0.06, 0x9aa79c, { y: 0.36 }, 1, 1.3, 1, 6),
        boule(0.045, 0x9aa79c, { x: 0.04, y: 0.3 }, 1, 1.2, 1, 5),
      ]);
    case 'basalte': {
      const parties: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 5; k += 1) {
        const a = (k / 5) * Math.PI * 2;
        const h = 0.08 + alea(k, 11, 61) * 0.16;
        parties.push(cylindre(0.05, 0.05, h, 6, couleur, { x: Math.cos(a) * 0.075, y: h / 2 - 0.01, z: Math.sin(a) * 0.075 }));
      }
      return fusion(parties);
    }
    case 'fumerolle':
      return fusion([
        cone(0.11, 0.08, 8, couleur, { y: 0 }),
        cylindre(0.045, 0.04, 0.02, 8, 0x3a3230, { y: 0.075 }),
      ]);
    case 'fumee':
      return fusion([
        boule(0.04, couleur, { y: 0.02 }, 1, 1, 1, 6),
        boule(0.055, couleur, { x: 0.02, y: 0.1 }, 1, 1, 1, 6),
        boule(0.07, couleur, { x: -0.01, y: 0.2 }, 1, 1, 1, 6),
      ]);
    case 'coulee':
      return eroder(boule(0.28, couleur, {}, 1, 0.08, 0.6, 8), 71, 0.3).translate(0, 0.004, 0);
    case 'lave':
      return fusion([0, 1.1, 2.2].map((a) => boite(0.34, 0.012, 0.018, couleur, { y: 0.026, ry: a })));
    case 'rocher':
      return eroder(boule(0.14, couleur, {}, 1, 0.7, 0.85, 8), 72, 0.35).translate(0, 0.06, 0);
    case 'cabane':
      return fusion([
        ...[[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.05]].map(([x, z]) =>
          cylindre(0.012, 0.012, 0.06, 5, 0x6b5238, { x, y: 0.03, z })),
        boite(0.18, 0.12, 0.14, couleur, { y: 0.11 }),
        boite(0.22, 0.02, 0.18, 0x5b4a3f, { y: 0.18, rz: 0.12 }),
        boite(0.05, 0.07, 0.01, 0x3d3128, { y: 0.085, z: 0.071 }),
      ]);
    case 'phare':
      return fusion([
        cylindre(0.075, 0.05, 0.5, 10, couleur, { y: 0.25 }),
        cylindre(0.069, 0.064, 0.06, 10, 0xc43b31, { y: 0.14 }),
        cylindre(0.059, 0.054, 0.06, 10, 0xc43b31, { y: 0.34 }),
        cylindre(0.085, 0.085, 0.02, 10, 0x3a3a3a, { y: 0.5 }),
        cone(0.06, 0.06, 10, 0x3a3a3a, { y: 0.56 }),
      ]);
    case 'lanterne':
      return cylindre(0.045, 0.045, 0.06, 8, couleur, {});
    case 'algue':
      return fusion([
        disque(0.11, 7, couleur, 0.006),
        disque(0.07, 6, couleur, 0.008).translate(0.1, 0, 0.06),
      ]);
    case 'recif':
      return eroder(boule(0.18, couleur, {}, 1, 0.35, 0.8, 8), 73, 0.4);
    case 'pirogue':
      return fusion([
        boite(0.36, 0.06, 0.1, couleur, { y: 0.04 }),
        cone(0.05, 0.12, 4, couleur, { rz: -Math.PI / 2, x: 0.18, y: 0.045 }).scale(1, 0.7, 1),
        cone(0.05, 0.12, 4, couleur, { rz: Math.PI / 2, x: -0.18, y: 0.045 }).scale(1, 0.7, 1),
        boite(0.02, 0.02, 0.09, 0xb9976b, { y: 0.06 }),
        boite(0.02, 0.014, 0.2, 0xb9976b, { x: 0.1, y: 0.06, z: 0.1 }),
        boite(0.02, 0.014, 0.2, 0xb9976b, { x: -0.1, y: 0.06, z: 0.1 }),
        boite(0.3, 0.03, 0.03, couleur, { y: 0.03, z: 0.19 }),
      ]);
    case 'mangrove': {
      const parties = [cylindre(0.03, 0.025, 0.22, 6, 0x5f4633, { y: 0.25 })];
      for (let k = 0; k < 5; k += 1) {
        const a = (k / 5) * Math.PI * 2;
        // Une racine-échasse part du tronc et s'écarte vers le bas ; on l'écarte puis on la tourne.
        parties.push(cylindre(0.012, 0.008, 0.22, 4, 0x5f4633, { rz: -0.5, x: 0.05, y: 0.1 }).rotateY(-a));
      }
      parties.push(boule(0.1, couleur, { y: 0.4 }, 1, 0.7, 1, 7));
      parties.push(boule(0.07, couleur, { x: 0.08, y: 0.36, z: 0.04 }, 1, 0.7, 1, 6));
      return fusion(parties);
    }
    case 'ponton':
      return fusion([
        boite(0.5, 0.02, 0.14, couleur, { y: 0.09 }),
        ...[[-0.2, -0.055], [0.2, -0.055], [-0.2, 0.055], [0.2, 0.055]].map(([x, z]) =>
          cylindre(0.014, 0.014, 0.16, 5, 0x5f4633, { x, y: 0.06, z })),
      ]);
    case 'nenuphar':
      return fusion([
        disque(0.075, 9, couleur, 0.006, 5.5).rotateY(0.4),
        boule(0.02, 0xf2a5c8, { x: 0.03, y: 0.02, z: 0.02 }, 1, 0.8, 1, 5),
      ]);
    default:
      return boule(0.05, couleur, { y: 0.05 });
  }
}

// ---------------------------------------------------------------------------
// Le montage three.js
// ---------------------------------------------------------------------------

/** Ce que `creerPaysage` rend au décor. */
export interface Paysage {
  readonly groupe: THREE.Group;
  /** Saison, neige, nuit : les mêmes retouches que sur les arbres. */
  appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void;
  /** Roseaux au vent, fumerolles, ailes du moulin. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number, mouvementReduit?: boolean): boolean;
  /** Repose tout sur le relief courant. À appeler après une mutation du terrain. */
  majRelief(): void;
  /**
   * Libère géométries et matériaux. Le brouillard de guerre ne passe pas par
   * ici : les lots et le rivage lisent le masque du sol par leur `outputNode`
   * (`grefferBrouillardSur`, `terrain.ts`), rien n'est teint dans le paysage.
   */
  dispose(): void;
}

/** Un lot : un genre, sa géométrie, son matériau, ses instances. */
interface Lot {
  genre: GenrePaysage;
  espece: Espece;
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardNodeMaterial;
  instances: Accessoire[];
}

/** Teinte de saison des végétaux caducs : la même famille que le feuillage de `decor.ts`. */
const TEINTE_SAISON: Readonly<Record<Saison, { vers: THREE.Color; part: number }>> = {
  printemps: { vers: new THREE.Color(0x9fd67a), part: 0.14 },
  ete: { vers: new THREE.Color(0xffffff), part: 0 },
  automne: { vers: new THREE.Color(0xc99a3a), part: 0.36 },
  hiver: { vers: new THREE.Color(0x9aa08c), part: 0.42 },
};

/** Subdivisions d'un segment de rivage le long du côté. */
const PAS_RIVAGE = 5;

/** Les trois rangées d'un segment : côté terre, sur la jonction, côté eau. */
const RANGS_RIVAGE: readonly number[] = [-0.11, 0, 0.09];

/** Monte le paysage d'un biome. `hauteurEn` est une fermeture vivante : on la relit à chaque pose. */
export function creerPaysage(
  g: GrilleTerrain, hauteurEn: (x: number, z: number) => number, biome: Biome,
): Paysage {
  const groupe = new THREE.Group();
  groupe.name = 'paysage';

  // --- Les accessoires
  const semis = semerPaysage(g, biome);
  const parGenre = new Map<GenrePaysage, Accessoire[]>();
  for (const a of semis) {
    const liste = parGenre.get(a.genre) ?? [];
    liste.push(a);
    parGenre.set(a.genre, liste);
  }
  // Un lot par genre **présent** : un biome sans moulin ne paie pas un moulin.
  const lots: Lot[] = [];
  for (const [genre, instances] of parGenre) {
    const espece = ESPECES[genre];
    const geo = construireForme(espece.forme, espece.couleur);
    const mat = new THREE.MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: espece.matiere === 'glace' ? 0.25 : espece.matiere === 'mineral' ? 0.95 : 0.85,
      metalness: espece.matiere === 'glace' ? 0.1 : 0,
      flatShading: espece.matiere === 'mineral',
    });
    if (espece.matiere === 'fumee' || espece.matiere === 'glace') {
      mat.transparent = true;
      mat.opacity = espece.matiere === 'fumee' ? 0.42 : 0.8;
      mat.depthWrite = false;
    }
    if (espece.matiere === 'feu' || espece.matiere === 'lumiere') {
      mat.emissive = new THREE.Color(espece.couleur);
      mat.emissiveIntensity = 0.4;
    }
    const mesh = new THREE.InstancedMesh(geo, mat, instances.length);
    mesh.name = `paysage-${genre}`;
    mesh.castShadow = !espece.sansOmbre;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (espece.matiere === 'fumee') mesh.renderOrder = 4;
    groupe.add(mesh);
    lots.push({ genre, espece, mesh, geo, mat, instances });
  }

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const ech = new THREE.Vector3();
  const couleur = new THREE.Color();
  let souffle = 0;
  let oscillation = 0;
  /** L'altitude d'un accessoire : le sol, ou le plan d'eau s'il flotte ou s'immerge. */
  function altitude(a: Accessoire, r: Regle): number {
    const sol = hauteurEn(a.x, a.z);
    if (r.immersion !== undefined) return Math.max(sol, NIVEAU_EAU - r.immersion);
    return r.flotte ? Math.max(sol, NIVEAU_EAU) : sol;
  }

  function poserLot(lot: Lot): void {
    const { espece, mesh, instances } = lot;
    const r = espece.regle;
    const anime = souffle > 0;
    instances.forEach((a, i) => {
      let y = altitude(a, r);
      let dx = 0;
      let dz = 0;
      let balancement = 0;
      let roulis = 0;
      let echelleY = a.echelle;
      if (espece.decalage) {
        // Le jumeau se décale dans le repère orienté de son porteur.
        y += espece.decalage.y * a.echelle;
        dx = Math.sin(a.angle) * espece.decalage.z * a.echelle;
        dz = Math.cos(a.angle) * espece.decalage.z * a.echelle;
      }
      if (anime && espece.balance) {
        balancement = Math.sin(souffle + a.angle * 3) * 0.16 * oscillation;
      }
      if (anime && espece.matiere === 'fumee') {
        // Une bouffée qui monte, enfle et repart du cratère : une boucle par instance.
        const phase = (souffle * 0.25 + a.teinte) % 1;
        y += phase * 0.22;
        echelleY = a.echelle * (0.5 + phase * 0.9);
      }
      if (anime && espece.forme === 'ailes') {
        // Les ailes tournent avec le vent ; sans vent, elles restent en croix.
        roulis = souffle * 0.6 * oscillation + a.teinte * 6;
      }
      euler.set(balancement, a.angle, roulis);
      quat.setFromEuler(euler);
      pos.set(a.x + dx, y, a.z + dz);
      const largeur = espece.matiere === 'fumee' ? a.echelle * (0.6 + ((souffle * 0.25 + a.teinte) % 1) * 0.8) : a.echelle;
      ech.set(largeur, echelleY, largeur);
      mat4.compose(pos, quat, ech);
      mesh.setMatrixAt(i, mat4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function teinterLot(lot: Lot): void {
    const { espece, mesh, instances } = lot;
    instances.forEach((a, i) => {
      if (espece.palette) {
        couleur.set(espece.palette[Math.floor(a.teinte * espece.palette.length)] ?? 0xffffff);
      } else {
        // Une nuance par instance : deux haies voisines ne sont jamais du même vert.
        const k = 0.84 + a.teinte * 0.28;
        couleur.setRGB(k, k * (0.98 + a.teinte * 0.03), k * 0.97);
      }
      mesh.setColorAt(i, couleur);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  for (const lot of lots) {
    poserLot(lot);
    teinterLot(lot);
  }

  // --- La ligne de rivage : une seule géométrie pour tous les côtés terre/eau.
  const segments = segmentsRivage(g);
  const genre = genreRivage(biome);
  const rangs = RANGS_RIVAGE.length;
  const sommetsParSegment = (PAS_RIVAGE + 1) * rangs;
  const positions = new Float32Array(segments.length * sommetsParSegment * 3);
  const couleurs = new Float32Array(segments.length * sommetsParSegment * 4);
  const normales = new Float32Array(segments.length * sommetsParSegment * 3);
  const indices: number[] = [];
  segments.forEach((s, n) => {
    const tx = -s.nz;
    const tz = s.nx;
    for (let k = 0; k <= PAS_RIVAGE; k += 1) {
      const t = k / PAS_RIVAGE - 0.5;
      RANGS_RIVAGE.forEach((d, rang) => {
        const i = n * sommetsParSegment + k * rangs + rang;
        // Le bord ondule : une ligne droite ne ressemble ni à de l'écume ni à des galets.
        const bruit = alea(Math.round(s.x * 8 + t * 8), Math.round(s.z * 8), 500 + rang);
        const dd = d + (bruit - 0.5) * 0.05;
        positions[i * 3] = s.x + tx * t * CASE + s.nx * dd;
        positions[i * 3 + 2] = s.z + tz * t * CASE + s.nz * dd;
        normales[i * 3 + 1] = 1;
        const grain = alea(Math.round(s.x * 16 + t * 16), Math.round(s.z * 16 + rang * 3), 510);
        if (genre === 'ecume') {
          const clair = 0.86 + grain * 0.14;
          couleurs[i * 4] = clair;
          couleurs[i * 4 + 1] = clair;
          couleurs[i * 4 + 2] = clair;
          // L'écume se fond aux deux bords : franche sur la jonction, effacée aux extrémités.
          couleurs[i * 4 + 3] = rang === 1 ? 0.7 : 0.18;
        } else {
          const gris = 0.42 + grain * 0.3;
          couleurs[i * 4] = gris;
          couleurs[i * 4 + 1] = gris * 0.96;
          couleurs[i * 4 + 2] = gris * 0.88;
          couleurs[i * 4 + 3] = rang === 1 ? 1 : 0.55;
        }
      });
      if (k < PAS_RIVAGE) {
        for (let rang = 0; rang < rangs - 1; rang += 1) {
          const a = n * sommetsParSegment + k * rangs + rang;
          const b = a + rangs;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
  });
  const geoRivage = new THREE.BufferGeometry();
  geoRivage.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geoRivage.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
  geoRivage.setAttribute('color', new THREE.BufferAttribute(couleurs, 4));
  geoRivage.setIndex(indices);
  // Les couleurs de sommet du rivage ont **quatre** composantes : l'écume se
  // fond par leur alpha. Le matériau à nœuds ne lit les couleurs de sommet
  // qu'en `vec3` et jette l'alpha — pire, une seconde lecture en `vec4` du
  // même attribut se rabat sur la première et rend un alpha de 1. On lit donc
  // l'attribut une fois, à quatre composantes, et on le donne aux deux nœuds,
  // `vertexColors` éteint : couleur × rgb, opacité × alpha, comme le faisait
  // `color_fragment` en WebGL.
  const teinteSommet = attribute('color', 'vec4');
  const matRivage = new THREE.MeshStandardNodeMaterial({
    vertexColors: false,
    transparent: true,
    depthWrite: false,
    roughness: genre === 'ecume' ? 1 : 0.9,
    flatShading: genre === 'galets',
  });
  matRivage.colorNode = materialColor.mul(teinteSommet.xyz);
  matRivage.opacityNode = materialOpacity.mul(teinteSommet.w);
  const rivage = new THREE.Mesh(geoRivage, matRivage);
  rivage.name = 'rivage';
  rivage.receiveShadow = genre === 'galets';
  // Dessiné après l'eau, qui n'écrit pas la profondeur : la ligne passe dessus.
  rivage.renderOrder = 3;
  rivage.frustumCulled = false;
  rivage.visible = segments.length > 0;
  groupe.add(rivage);

  function poserRivage(): void {
    const posAttr = geoRivage.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i += 1) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      // Sur la terre, la ligne épouse le sol ; sur l'eau, elle flotte juste au-dessus.
      const relief = genre === 'galets' ? alea(Math.round(x * 32), Math.round(z * 32), 520) * 0.02 : 0;
      posAttr.setY(i, Math.max(hauteurEn(x, z), NIVEAU_EAU) + 0.008 + relief);
    }
    posAttr.needsUpdate = true;
    if (genre === 'galets') geoRivage.computeVertexNormals();
  }

  poserRivage();

  const blanc = new THREE.Color(0xffffff);
  const teinteSol = new THREE.Color();
  // L'ambiance arrive à chaque image ; ses paramètres ne changent d'objet que
  // pendant une transition. Même objet, même saison : rien à repeindre.
  let ambianceAppliquee: { p: ParametresAmbiance; saison: Saison } | null = null;

  return {
    groupe,

    appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void {
      if (ambianceAppliquee && ambianceAppliquee.p === p && ambianceAppliquee.saison === saison) return;
      ambianceAppliquee = { p, saison };
      oscillation = p.oscillation;
      const neige = p.neigeSol;
      const s = TEINTE_SAISON[saison];
      teinteSol.set(p.teinteSol);
      for (const lot of lots) {
        const m = lot.espece.matiere;
        lot.mat.color.set(blanc);
        // Les caducs suivent la saison ; les persistants, les pierres et le bois, non.
        if (m === 'vegetal') {
          lot.mat.color.lerp(s.vers, s.part).lerp(teinteSol, 0.2);
        }
        if (m === 'feu') {
          // La lave rougeoie surtout la nuit, comme les fenêtres.
          lot.mat.emissiveIntensity = 0.35 + p.fenetres * 1.4;
        } else if (m === 'lumiere') {
          lot.mat.emissiveIntensity = 0.2 + p.fenetres * 2.2;
        } else if (m !== 'fumee' && m !== 'glace') {
          // La neige blanchit tout ce qui a une face au ciel : les couleurs de
          // sommet plafonnent au blanc, alors on ajoute une lueur plutôt que d'éclaircir.
          lot.mat.color.lerp(blanc, neige * 0.4);
          lot.mat.emissive.set(blanc).multiplyScalar(neige * 0.22);
        }
      }
      matRivage.color.set(blanc).lerp(teinteSol, genre === 'galets' ? 0.25 : 0);
      matRivage.emissive.set(blanc).multiplyScalar(neige * (genre === 'galets' ? 0.3 : 0.1));
      // L'écume s'anime avec l'eau : plus la mer est agitée, plus elle est franche.
      matRivage.opacity = genre === 'ecume' ? 0.7 + p.eau.agitation * 0.3 : 1;
    },

    avancer(ms: number, mouvementReduit = false): boolean {
      // La préférence système passe avant l'ambiance : rien ne bouge si on l'a demandé.
      if (mouvementReduit) return false;
      souffle += ms / 320;
      let encore = false;
      for (const lot of lots) {
        const { espece } = lot;
        const vent = oscillation >= 0.3 && (espece.balance || espece.forme === 'ailes');
        if (vent || espece.matiere === 'fumee') {
          poserLot(lot);
          encore = true;
        }
      }
      return encore;
    },

    majRelief(): void {
      for (const lot of lots) poserLot(lot);
      poserRivage();
    },

    dispose(): void {
      for (const lot of lots) {
        lot.geo.dispose();
        lot.mat.dispose();
      }
      geoRivage.dispose();
      matRivage.dispose();
    },
  };
}
