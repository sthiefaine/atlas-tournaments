/**
 * Le composeur des figurines 3D, en pièces déclaratives.
 *
 * Même règle qu'en 2D et même raison : **aucune unité n'est modélisée par son
 * nom**. Une unité apporte une `Silhouette` — une `base`, un `corps`, trois
 * `modules` au plus, une `taille` — et ce fichier la traduit en une liste de
 * pièces élémentaires (boîtes biseautées, cylindres, capsules, plaques). C'est
 * `unites.ts` qui en fait des maillages three.js, et l'arrivée d'un vrai modèle
 * `.glb` remplacera le tout sans toucher à une ligne de ce fichier.
 *
 * Le module est **pur** : ni three.js, ni DOM. Les tailles sont en unités de
 * scène, une case valant 1 — un char occupe environ 70 % de sa case et monte à
 * un tiers de case, ce qui reste lisible sous une caméra à 68°.
 */

import type { ModuleSilhouette, Silhouette, TailleSilhouette } from '../schemas/types';

/**
 * À quel matériau une pièce appartient : c'est là qu'agit le masque d'équipe.
 * `principal`, `sombre` et `clair` prennent la palette de la nation — c'est le
 * squelette qui change de couleur, le repli de toute unité sans kit. Les quatre
 * autres sont neutres : métal, verre, caoutchouc, et la **peau** des figurines,
 * un seul ton pour tout le monde, comme un jeu de miniatures.
 */
export type RolePiece =
  | 'principal' | 'sombre' | 'clair' | 'materiel' | 'verre' | 'roulant' | 'peau';

/** Les formes élémentaires du composeur. */
export type FormePiece = 'boite' | 'cylindre' | 'capsule' | 'sphere' | 'cone' | 'plaque';

/** Une pièce posée dans le repère local de l'unité (X avant, Y haut, Z côté). */
export interface Piece {
  nom: string;
  forme: FormePiece;
  role: RolePiece;
  /** Centre de la pièce. */
  position: [number, number, number];
  /** Dimensions : longueur (X), hauteur (Y), largeur (Z) ; rayon = X/2 pour les ronds. */
  taille: [number, number, number];
  /** Rotation d'Euler, en radians. */
  rotation?: [number, number, number];
}

/** Facteur d'échelle par taille de silhouette, comme en 2D. */
export function echelleTaille(taille: TailleSilhouette): number {
  if (taille === 1) return 0.86;
  if (taille === 3) return 1.16;
  return 1;
}

const DEMI_PI = Math.PI / 2;

/** Les pièces d'une base de silhouette. */
function piecesBase(base: Silhouette['base']): Piece[] {
  switch (base) {
    case 'chenilles':
      return [
        { nom: 'chenille_gauche', forme: 'boite', role: 'roulant', position: [0, 0.07, -0.2], taille: [0.66, 0.14, 0.15] },
        { nom: 'chenille_droite', forme: 'boite', role: 'roulant', position: [0, 0.07, 0.2], taille: [0.66, 0.14, 0.15] },
        { nom: 'plancher', forme: 'boite', role: 'sombre', position: [0, 0.1, 0], taille: [0.58, 0.07, 0.32] },
      ];
    case 'roues':
      return [
        { nom: 'roue_avant_gauche', forme: 'cylindre', role: 'roulant', position: [0.2, 0.08, -0.19], taille: [0.16, 0.09, 0.16], rotation: [DEMI_PI, 0, 0] },
        { nom: 'roue_avant_droite', forme: 'cylindre', role: 'roulant', position: [0.2, 0.08, 0.19], taille: [0.16, 0.09, 0.16], rotation: [DEMI_PI, 0, 0] },
        { nom: 'roue_arriere_gauche', forme: 'cylindre', role: 'roulant', position: [-0.2, 0.08, -0.19], taille: [0.16, 0.09, 0.16], rotation: [DEMI_PI, 0, 0] },
        { nom: 'roue_arriere_droite', forme: 'cylindre', role: 'roulant', position: [-0.2, 0.08, 0.19], taille: [0.16, 0.09, 0.16], rotation: [DEMI_PI, 0, 0] },
        { nom: 'plancher', forme: 'boite', role: 'sombre', position: [0, 0.11, 0], taille: [0.56, 0.06, 0.3] },
      ];
    case 'pattes':
      // Une troupe à pied : des figurines, jamais un bloc. Voir `troupe`.
      return [];
    case 'coque':
      return [
        { nom: 'coque', forme: 'boite', role: 'principal', position: [0, 0.09, 0], taille: [0.82, 0.16, 0.36] },
        { nom: 'etrave', forme: 'cone', role: 'principal', position: [0.44, 0.09, 0], taille: [0.2, 0.16, 0.34], rotation: [0, 0, -DEMI_PI] },
      ];
    case 'rotor':
      return [
        { nom: 'patin_gauche', forme: 'boite', role: 'materiel', position: [0, 0.02, -0.16], taille: [0.5, 0.03, 0.04] },
        { nom: 'patin_droit', forme: 'boite', role: 'materiel', position: [0, 0.02, 0.16], taille: [0.5, 0.03, 0.04] },
        { nom: 'jambe_gauche', forme: 'boite', role: 'materiel', position: [0, 0.11, -0.11], taille: [0.04, 0.16, 0.04] },
        { nom: 'jambe_droite', forme: 'boite', role: 'materiel', position: [0, 0.11, 0.11], taille: [0.04, 0.16, 0.04] },
        { nom: 'mat_rotor', forme: 'cylindre', role: 'materiel', position: [0.02, 0.36, 0], taille: [0.05, 0.09, 0.05] },
        { nom: 'pale_avant', forme: 'plaque', role: 'materiel', position: [0.02, 0.41, 0], taille: [0.92, 0.012, 0.06] },
        { nom: 'pale_laterale', forme: 'plaque', role: 'materiel', position: [0.02, 0.41, 0], taille: [0.06, 0.012, 0.92] },
        { nom: 'rotor_queue', forme: 'plaque', role: 'materiel', position: [-0.42, 0.29, 0.02], taille: [0.03, 0.24, 0.02] },
      ];
    case 'ailes':
      return [
        { nom: 'aile_gauche', forme: 'plaque', role: 'principal', position: [-0.02, 0.24, -0.3], taille: [0.3, 0.02, 0.42] },
        { nom: 'aile_droite', forme: 'plaque', role: 'principal', position: [-0.02, 0.24, 0.3], taille: [0.3, 0.02, 0.42] },
        { nom: 'derive', forme: 'plaque', role: 'clair', position: [-0.36, 0.33, 0], taille: [0.16, 0.16, 0.02] },
        { nom: 'train', forme: 'cylindre', role: 'materiel', position: [0.1, 0.06, 0], taille: [0.06, 0.12, 0.06] },
      ];
    case 'rail':
      return [
        { nom: 'rail_gauche', forme: 'boite', role: 'materiel', position: [0, 0.03, -0.17], taille: [0.9, 0.04, 0.05] },
        { nom: 'rail_droit', forme: 'boite', role: 'materiel', position: [0, 0.03, 0.17], taille: [0.9, 0.04, 0.05] },
        { nom: 'bogie_avant', forme: 'boite', role: 'sombre', position: [0.22, 0.09, 0], taille: [0.2, 0.09, 0.3] },
        { nom: 'bogie_arriere', forme: 'boite', role: 'sombre', position: [-0.22, 0.09, 0], taille: [0.2, 0.09, 0.3] },
      ];
    default:
      return [];
  }
}

/** Hauteur de plancher d'une base : le corps se pose dessus. */
function hauteurBase(base: Silhouette['base']): number {
  switch (base) {
    case 'chenilles': return 0.135;
    case 'roues': return 0.14;
    case 'coque': return 0.17;
    case 'rotor': return 0.19;
    case 'ailes': return 0.14;
    case 'rail': return 0.135;
    default: return 0.1;
  }
}

/** Les pièces d'un corps, posées sur le plancher de la base. */
function piecesCorps(corps: Silhouette['corps'], y: number): Piece[] {
  switch (corps) {
    case 'capsule':
      return [
        { nom: 'corps_capsule', forme: 'capsule', role: 'principal', position: [0, y + 0.11, 0], taille: [0.26, 0.5, 0.26], rotation: [0, 0, DEMI_PI] },
        { nom: 'verriere', forme: 'sphere', role: 'verre', position: [0.15, y + 0.16, 0], taille: [0.16, 0.13, 0.18] },
      ];
    case 'plateau':
      return [
        { nom: 'corps_plateau', forme: 'boite', role: 'principal', position: [-0.04, y + 0.05, 0], taille: [0.62, 0.09, 0.36] },
        { nom: 'cabine', forme: 'boite', role: 'clair', position: [0.22, y + 0.13, 0], taille: [0.2, 0.18, 0.3] },
        { nom: 'pare_brise', forme: 'plaque', role: 'verre', position: [0.32, y + 0.15, 0], taille: [0.02, 0.11, 0.24] },
      ];
    default:
      return [
        { nom: 'corps_bloc', forme: 'boite', role: 'principal', position: [-0.02, y + 0.1, 0], taille: [0.56, 0.19, 0.34] },
        { nom: 'capot', forme: 'boite', role: 'clair', position: [0.22, y + 0.07, 0], taille: [0.16, 0.11, 0.3] },
      ];
  }
}

/** Hauteur du dessus d'un corps : c'est là que se posent les modules. */
function hauteurCorps(corps: Silhouette['corps'], y: number): number {
  if (corps === 'capsule') return y + 0.24;
  if (corps === 'plateau') return y + 0.1;
  return y + 0.2;
}

/** Les pièces d'un module, posé au sommet du corps. */
function piecesModule(module: ModuleSilhouette, y: number, rang: number): Piece[] {
  const recul = rang * -0.12;
  switch (module) {
    case 'tourelle':
      return [
        { nom: 'tourelle', forme: 'cylindre', role: 'principal', position: [recul, y + 0.06, 0], taille: [0.28, 0.12, 0.28] },
        { nom: 'canon', forme: 'cylindre', role: 'materiel', position: [recul + 0.28, y + 0.07, 0], taille: [0.05, 0.42, 0.05], rotation: [0, 0, DEMI_PI] },
      ];
    case 'canon_long':
      return [
        { nom: 'berceau', forme: 'boite', role: 'sombre', position: [recul, y + 0.06, 0], taille: [0.2, 0.1, 0.18] },
        { nom: 'canon_long', forme: 'cylindre', role: 'materiel', position: [recul + 0.36, y + 0.1, 0], taille: [0.045, 0.66, 0.045], rotation: [0, 0, DEMI_PI - 0.16] },
      ];
    case 'lance_roquettes':
      return [
        { nom: 'rampe', forme: 'boite', role: 'sombre', position: [recul - 0.04, y + 0.09, 0], taille: [0.34, 0.13, 0.28], rotation: [0, 0, -0.22] },
        { nom: 'tube_gauche', forme: 'cylindre', role: 'materiel', position: [recul - 0.04, y + 0.13, -0.08], taille: [0.05, 0.34, 0.05], rotation: [0, 0, DEMI_PI - 0.22] },
        { nom: 'tube_droit', forme: 'cylindre', role: 'materiel', position: [recul - 0.04, y + 0.13, 0.08], taille: [0.05, 0.34, 0.05], rotation: [0, 0, DEMI_PI - 0.22] },
      ];
    case 'radar':
      return [
        { nom: 'mat_radar', forme: 'cylindre', role: 'materiel', position: [recul, y + 0.06, 0], taille: [0.04, 0.12, 0.04] },
        { nom: 'antenne_radar', forme: 'plaque', role: 'clair', position: [recul, y + 0.15, 0], taille: [0.04, 0.2, 0.3], rotation: [0, 0, -0.5] },
      ];
    case 'antenne':
      return [
        { nom: 'antenne', forme: 'cylindre', role: 'materiel', position: [recul - 0.1, y + 0.16, 0.1], taille: [0.02, 0.32, 0.02] },
        { nom: 'embase_antenne', forme: 'cylindre', role: 'sombre', position: [recul - 0.1, y + 0.02, 0.1], taille: [0.07, 0.04, 0.07] },
      ];
    case 'grue':
      return [
        { nom: 'pivot_grue', forme: 'cylindre', role: 'sombre', position: [recul - 0.08, y + 0.05, 0], taille: [0.16, 0.1, 0.16] },
        { nom: 'fleche_grue', forme: 'boite', role: 'materiel', position: [recul + 0.08, y + 0.19, 0], taille: [0.44, 0.05, 0.06], rotation: [0, 0, 0.42] },
      ];
    case 'panneaux_solaires':
      return [
        { nom: 'panneau_gauche', forme: 'plaque', role: 'verre', position: [recul, y + 0.08, -0.16], taille: [0.34, 0.015, 0.24], rotation: [0.22, 0, 0] },
        { nom: 'panneau_droit', forme: 'plaque', role: 'verre', position: [recul, y + 0.08, 0.16], taille: [0.34, 0.015, 0.24], rotation: [-0.22, 0, 0] },
      ];
    case 'nacelle':
      return [
        { nom: 'nacelle', forme: 'capsule', role: 'clair', position: [recul + 0.06, y - 0.02, 0], taille: [0.2, 0.3, 0.2], rotation: [0, 0, DEMI_PI] },
        { nom: 'hublot', forme: 'sphere', role: 'verre', position: [recul + 0.19, y + 0.01, 0], taille: [0.12, 0.1, 0.12] },
      ];
    default:
      return [];
  }
}

/** Détails mécaniques larges : lisibles au zoom de jeu, sans texture de bruit. */
function detailsBase(base: Silhouette['base']): Piece[] {
  const pieces: Piece[] = [];
  if (base === 'chenilles') {
    for (const [cote, z] of [['gauche', -0.278], ['droite', 0.278]] as const) {
      for (let i = 0; i < 5; i++) {
        pieces.push({ nom: `galet_${cote}_${i}`, forme: 'cylindre', role: 'materiel', position: [-0.24 + i * 0.12, 0.075, z], taille: [0.105, 0.018, 0.105], rotation: [DEMI_PI, 0, 0] });
      }
      pieces.push({ nom: `garde_boue_${cote}`, forme: 'plaque', role: 'principal', position: [0, 0.155, z * 0.8], taille: [0.69, 0.035, 0.13] });
      for (let i = 0; i < 5; i++) {
        pieces.push({ nom: `patin_${cote}_${i}`, forme: 'plaque', role: 'sombre', position: [-0.25 + i * 0.125, 0.178, z * 0.8], taille: [0.018, 0.012, 0.13] });
      }
    }
  } else if (base === 'roues') {
    for (const [cote, z] of [['gauche', -0.242], ['droite', 0.242]] as const) {
      for (const [bout, x] of [['avant', 0.2], ['arriere', -0.2]] as const) {
        pieces.push({ nom: `moyeu_${bout}_${cote}`, forme: 'cylindre', role: 'clair', position: [x, 0.08, z], taille: [0.065, 0.012, 0.065], rotation: [DEMI_PI, 0, 0] });
        pieces.push({ nom: `aile_roue_${bout}_${cote}`, forme: 'plaque', role: 'principal', position: [x, 0.17, z * 0.76], taille: [0.22, 0.025, 0.11] });
      }
    }
  } else if (base === 'rotor') {
    pieces.push(
      { nom: 'poutre_queue', forme: 'cone', role: 'principal', position: [-0.31, 0.27, 0], taille: [0.12, 0.39, 0.12], rotation: [0, 0, DEMI_PI] },
      { nom: 'stabilisateur_queue', forme: 'plaque', role: 'clair', position: [-0.43, 0.27, 0], taille: [0.13, 0.022, 0.28] },
      { nom: 'moyeu_rotor', forme: 'cylindre', role: 'sombre', position: [0.02, 0.42, 0], taille: [0.1, 0.045, 0.1] },
      { nom: 'turbine_gauche', forme: 'capsule', role: 'materiel', position: [-0.1, 0.33, -0.115], taille: [0.075, 0.22, 0.075], rotation: [0, 0, DEMI_PI] },
      { nom: 'turbine_droite', forme: 'capsule', role: 'materiel', position: [-0.1, 0.33, 0.115], taille: [0.075, 0.22, 0.075], rotation: [0, 0, DEMI_PI] },
    );
  }
  return pieces;
}

function detailsCorps(s: Silhouette, y: number): Piece[] {
  const pieces: Piece[] = [];
  if (s.base === 'chenilles' || s.base === 'roues') {
    for (const [cote, z] of [['gauche', -0.12], ['droite', 0.12]] as const) {
      pieces.push(
        { nom: `phare_${cote}`, forme: 'boite', role: 'verre', position: [0.308, y + 0.07, z], taille: [0.035, 0.055, 0.065] },
        { nom: `coffre_${cote}`, forme: 'boite', role: 'sombre', position: [-0.19, y + 0.125, z * 1.5], taille: [0.19, 0.07, 0.055] },
      );
    }
    pieces.push({ nom: 'pare_chocs', forme: 'boite', role: 'materiel', position: [0.32, y + 0.008, 0], taille: [0.045, 0.045, 0.32] });
    if (s.corps === 'bloc') {
      pieces.push(
        { nom: 'blindage_frontal', forme: 'plaque', role: 'principal', position: [0.24, y + 0.14, 0], taille: [0.18, 0.065, 0.31], rotation: [0, 0, -0.32] },
        { nom: 'ecoutille_conducteur', forme: 'plaque', role: 'sombre', position: [0.15, y + 0.206, 0.08], taille: [0.085, 0.024, 0.07] },
        { nom: 'echappement', forme: 'cylindre', role: 'materiel', position: [-0.29, y + 0.09, 0.115], taille: [0.04, 0.11, 0.04], rotation: [0, 0, DEMI_PI] },
      );
      for (let i = 0; i < 4; i++) pieces.push({ nom: `grille_moteur_${i}`, forme: 'plaque', role: 'materiel', position: [-0.21 + i * 0.035, y + 0.201, 0], taille: [0.018, 0.012, 0.19] });
    } else if (s.corps === 'plateau') {
      for (const z of [-0.156, 0.156]) pieces.push({ nom: `vitre_cabine_${z}`, forme: 'plaque', role: 'verre', position: [0.22, y + 0.16, z], taille: [0.13, 0.08, 0.012] });
    }
  }
  return pieces;
}

function detailsModule(module: ModuleSilhouette, y: number, rang: number): Piece[] {
  const recul = rang * -0.12;
  if (module === 'tourelle') return [
    { nom: 'couronne_tourelle', forme: 'cylindre', role: 'sombre', position: [recul, y + 0.006, 0], taille: [0.33, 0.03, 0.33] },
    { nom: 'ecoutille_tourelle', forme: 'cylindre', role: 'clair', position: [recul - 0.045, y + 0.127, 0.055], taille: [0.10, 0.023, 0.10] },
    { nom: 'viseur_tourelle', forme: 'boite', role: 'verre', position: [recul + 0.08, y + 0.123, -0.05], taille: [0.065, 0.035, 0.055] },
    { nom: 'mantelet', forme: 'boite', role: 'principal', position: [recul + 0.13, y + 0.07, 0], taille: [0.09, 0.09, 0.12] },
    { nom: 'bouche_canon', forme: 'cylindre', role: 'sombre', position: [recul + 0.49, y + 0.07, 0], taille: [0.07, 0.055, 0.07], rotation: [0, 0, DEMI_PI] },
  ];
  if (module === 'canon_long') return [
    { nom: 'culasse', forme: 'boite', role: 'principal', position: [recul - 0.025, y + 0.1, 0], taille: [0.14, 0.12, 0.2] },
    { nom: 'frein_bouche', forme: 'boite', role: 'sombre', position: [recul + 0.66, y + 0.155, 0], taille: [0.085, 0.07, 0.09], rotation: [0, 0, 0.16] },
  ];
  if (module === 'lance_roquettes') {
    return [-0.085, 0, 0.085].flatMap((z, i) => [
      { nom: `ogive_${i}`, forme: 'cylindre' as const, role: 'clair' as const, position: [recul + 0.135, y + 0.17, z] as [number, number, number], taille: [0.045, 0.022, 0.045] as [number, number, number], rotation: [0, 0, DEMI_PI - 0.22] as [number, number, number] },
      { nom: `event_roquette_${i}`, forme: 'cylindre' as const, role: 'roulant' as const, position: [recul + 0.146, y + 0.17, z] as [number, number, number], taille: [0.026, 0.023, 0.026] as [number, number, number], rotation: [0, 0, DEMI_PI - 0.22] as [number, number, number] },
    ]);
  }
  if (module === 'grue') return [
    { nom: 'verin_grue', forme: 'cylindre', role: 'clair', position: [recul, y + 0.13, 0.045], taille: [0.025, 0.24, 0.025], rotation: [0, 0, -0.45] },
    { nom: 'cable_grue', forme: 'cylindre', role: 'roulant', position: [recul + 0.28, y + 0.2, 0], taille: [0.018, 0.16, 0.018] },
    { nom: 'crochet_grue', forme: 'boite', role: 'materiel', position: [recul + 0.27, y + 0.12, 0], taille: [0.05, 0.025, 0.035] },
  ];
  return [];
}

// ---------------------------------------------------------------------------
// La troupe à pied
// ---------------------------------------------------------------------------

/** Un point du repère local d'une figurine. */
type Point = [number, number, number];

/**
 * Une pièce dans le repère d'une figurine : origine entre les pieds, X devant,
 * Y haut, Z à droite. Seuls le **lacet** (autour de Y) et le **tangage** (autour
 * de Z) sont permis, parce que c'est ce qui rend la pose d'une figurine
 * composable avec l'orientation de la figurine entière :
 * `Ry(cap) · Ry(lacet) · Rz(tangage)` reste un Euler `[0, cap + lacet, tangage]`,
 * sans recomposer de matrice. Un cylindre le long de Z est `lacet: π/2, tangage: π/2`.
 */
interface PieceLocale {
  nom: string;
  forme: FormePiece;
  role: RolePiece;
  position: Point;
  taille: [number, number, number];
  lacet?: number;
  tangage?: number;
}

/** Pose une figurine dans la case : préfixe des noms, pieds en (x, z), tournée de `cap`. */
function poserFigurine(prefixe: string, x: number, z: number, cap: number, pieces: PieceLocale[]): Piece[] {
  const c = Math.cos(cap);
  const s = Math.sin(cap);
  return pieces.map((p) => ({
    nom: `${prefixe}_${p.nom}`,
    forme: p.forme,
    role: p.role,
    position: [x + p.position[0] * c + p.position[2] * s, p.position[1], z - p.position[0] * s + p.position[2] * c],
    taille: p.taille,
    rotation: [0, cap + (p.lacet ?? 0), p.tangage ?? 0],
  }));
}

// --- La géométrie de pose : de quoi mettre un membre entre deux points --------

const plus = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const moins = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const fois = (a: Point, k: number): Point => [a[0] * k, a[1] * k, a[2] * k];
const milieu = (a: Point, b: Point): Point => fois(plus(a, b), 0.5);
const norme = (a: Point): number => Math.hypot(a[0], a[1], a[2]);
const unitaire = (a: Point): Point => {
  const n = norme(a);
  return n < 1e-9 ? [0, 1, 0] : fois(a, 1 / n);
};
const scalaire = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Une pièce orientée le long d'un axe. Sa hauteur (Y locale) suit `axe` ; sa
 * longueur (X locale) reste dans le plan vertical de l'axe — c'est le « dessus »
 * d'un fusil ou d'un manche — et sa largeur (Z locale) reste horizontale. C'est
 * ce qui permet de coucher une boîte le long d'un bras sans qu'elle roule sur
 * elle-même. `taille` se lit donc [épaisseur verticale, longueur, largeur].
 */
function orientee(
  nom: string, forme: FormePiece, role: RolePiece, centre: Point, axe: Point, taille: [number, number, number],
): PieceLocale {
  const u = unitaire(axe);
  const tangage = Math.acos(Math.max(-1, Math.min(1, u[1])));
  const lacet = Math.sin(tangage) < 1e-6 ? 0 : Math.atan2(u[2], -u[0]);
  return { nom, forme, role, position: centre, taille, lacet, tangage };
}

/**
 * Un membre ou un manche de `a` à `b`. En capsule, les bouts ronds débordent
 * d'un rayon sur chaque articulation : c'est ce qui fait un coude ou un genou
 * sans pièce de plus.
 */
function segment(
  nom: string, role: RolePiece, a: Point, b: Point, rayon: number, forme: 'capsule' | 'cylindre' = 'capsule',
): PieceLocale {
  const d = moins(b, a);
  const longueur = norme(d);
  return orientee(nom, forme, role, milieu(a, b), d, [rayon * 2, forme === 'capsule' ? longueur + rayon * 2 : longueur, rayon * 2]);
}

/** Un point à `s` le long d'un axe depuis `origine`, décalé de `haut` vers le dessus et de `cote` vers la droite. */
function surAxe(origine: Point, axe: Point, s: number, haut = 0, cote = 0): Point {
  const u = unitaire(axe);
  const dessus = unitaire(moins([0, 1, 0], fois(u, u[1])));
  const droite: Point = [u[1] * dessus[2] - u[2] * dessus[1], u[2] * dessus[0] - u[0] * dessus[2], u[0] * dessus[1] - u[1] * dessus[0]];
  return plus(plus(plus(origine, fois(u, s)), fois(dessus, haut)), fois(droite, cote));
}

const HUMERUS = 0.078;

/**
 * Un bras de l'épaule `epaule` à la main `main`, en deux segments : le coude se
 * place par la géométrie — sur le cercle des points à une longueur d'humérus des
 * deux bouts —, du côté où un coude plie : vers le bas, l'arrière et l'extérieur.
 * Une main hors de portée est ramenée à bout de bras, jamais arrachée.
 */
function brasVers(cote: 'gauche' | 'droit', epaule: Point, main: Point, manche: RolePiece, pli?: Point): PieceLocale[] {
  let d = moins(main, epaule);
  let distance = norme(d);
  const portee = 2 * HUMERUS - 0.006;
  if (distance > portee) {
    d = fois(unitaire(d), portee);
    distance = portee;
    main = plus(epaule, d);
  }
  const u = unitaire(d);
  const indice: Point = pli ?? [-0.35, -1, cote === 'gauche' ? -0.8 : 0.8];
  let n = moins(indice, fois(u, scalaire(indice, u)));
  if (norme(n) < 1e-6) n = [0, -1, 0];
  n = unitaire(n);
  const hauteur = Math.sqrt(Math.max(0, HUMERUS * HUMERUS - (distance / 2) * (distance / 2)));
  const coude = plus(milieu(epaule, main), fois(n, hauteur));
  // La manche s'arrête au poignet : sinon le bout rond de l'avant-bras avale la main.
  const poignet = plus(main, fois(unitaire(moins(coude, main)), 0.03));
  return [
    segment(`bras_${cote}`, manche, epaule, coude, 0.026),
    segment(`avant_bras_${cote}`, manche, coude, poignet, 0.023),
    { nom: `main_${cote}`, forme: 'sphere', role: 'peau', position: main, taille: [0.05, 0.04, 0.046] },
  ];
}

/** Une jambe : cuisse, jambe et botte. `pied` avance la botte devant la cheville (ou derrière, pour un tibia couché). */
function jambe(
  cote: 'gauche' | 'droit', hanche: Point, genou: Point, cheville: Point, pantalon: RolePiece, pied = 0.025,
): PieceLocale[] {
  return [
    segment(`cuisse_${cote}`, pantalon, hanche, genou, 0.036),
    segment(`jambe_${cote}`, pantalon, genou, cheville, 0.03),
    { nom: `botte_${cote}`, forme: 'boite', role: 'roulant', position: [cheville[0] + pied, 0.022, cheville[2]], taille: [0.095, 0.044, 0.056] },
  ];
}

/** Ce qu'une allure décide du corps ; le reste est le même pour tout le monde. */
interface Allure {
  /** Hauteur du bassin : debout, en marche ou à genou, ce sont les jambes qui s'y plient. */
  bassin: number;
  /** Inclinaison du tronc vers l'avant. */
  penche: number;
  veste: RolePiece;
  pantalon: RolePiece;
  /** Un gilet lourd épaissit le tronc. */
  lourd?: boolean;
  /** Où regarde la tête : les yeux suivent. Le tangage est positif vers le haut. */
  regard?: { lacet?: number; tangage?: number };
  jambes: PieceLocale[];
}

/** Les ancrages qu'un corps rend pour qu'on l'équipe. */
interface Corps {
  pieces: PieceLocale[];
  /** L'axe du tronc, du bassin aux épaules. */
  axe: Point;
  epauleGauche: Point;
  epauleDroite: Point;
  /** Le haut du tronc, entre les épaules. */
  cou: Point;
  /** Le centre de la tête. */
  tete: Point;
  /** Le milieu du tronc et le milieu du dos, pour les gilets et les sacs. */
  poitrine: Point;
  dos: Point;
  ceinture: Point;
}

const RAYON_TETE = 0.038;
const HAUTEUR_TRONC = 0.15;

/**
 * Le corps commun, à cinq têtes et demie : bassin, tronc, épaules rondes, cou et
 * tête de **peau**, avec deux yeux — un visage se lit d'assez près pour qu'une
 * figurine cesse d'être un pion, et c'est le casque qui doit dégager le front,
 * pas la tête qui doit se cacher dessous. Les jambes sont données par l'allure.
 */
function corpsHumain(a: Allure): Corps {
  const axe: Point = [Math.sin(a.penche), Math.cos(a.penche), 0];
  const base: Point = [0, a.bassin + 0.035, 0];
  const cou = plus(base, fois(axe, HAUTEUR_TRONC));
  const epauleGauche: Point = [cou[0], cou[1] - 0.012, -0.078];
  const epauleDroite: Point = [cou[0], cou[1] - 0.012, 0.078];
  const hautCou = plus(cou, fois(axe, 0.03));
  const tete: Point = [hautCou[0] + 0.008, hautCou[1] + RAYON_TETE - 0.004, 0];
  const regard = a.regard?.lacet ?? 0;
  // Le menton un peu levé : sous une caméra à 68°, un visage qui regarde droit
  // devant lui ne montre que son front — et son front est sous le casque.
  const leve = a.regard?.tangage ?? 0.32;
  const avance = Math.cos(leve) * 0.034;
  const oeil = (z: number): Point => [
    tete[0] + Math.cos(regard) * avance + Math.sin(regard) * z,
    tete[1] + 0.004 + Math.sin(leve) * 0.034,
    tete[2] - Math.sin(regard) * avance + Math.cos(regard) * z,
  ];
  const epaisseur = a.lourd ? 0.11 : 0.095;
  const largeur = a.lourd ? 0.17 : 0.15;
  const pieces: PieceLocale[] = [
    ...a.jambes,
    { nom: 'bassin', forme: 'boite', role: a.pantalon, position: [0, a.bassin + 0.012, 0], taille: [0.09, 0.065, 0.12] },
    orientee('tronc', 'boite', a.veste, milieu(base, cou), axe, [epaisseur, HAUTEUR_TRONC, largeur]),
    orientee('ceinture', 'plaque', 'sombre', plus(base, fois(axe, 0.012)), axe, [epaisseur + 0.008, 0.02, largeur + 0.006]),
    { nom: 'epaule_gauche', forme: 'sphere', role: a.veste, position: epauleGauche, taille: [0.06, 0.05, 0.056] },
    { nom: 'epaule_droite', forme: 'sphere', role: a.veste, position: epauleDroite, taille: [0.06, 0.05, 0.056] },
    segment('cou', 'peau', cou, hautCou, 0.017, 'cylindre'),
    orientee('col', 'boite', a.veste, plus(cou, fois(axe, 0.006)), axe, [0.06, 0.02, 0.07]),
    { nom: 'tete', forme: 'sphere', role: 'peau', position: tete, taille: [RAYON_TETE * 2, RAYON_TETE * 2.05, RAYON_TETE * 1.9] },
    { nom: 'oeil_gauche', forme: 'boite', role: 'roulant', position: oeil(-0.014), taille: [0.008, 0.009, 0.012], lacet: regard, tangage: -leve },
    { nom: 'oeil_droit', forme: 'boite', role: 'roulant', position: oeil(0.014), taille: [0.008, 0.009, 0.012], lacet: regard, tangage: -leve },
  ];
  return {
    pieces, axe, epauleGauche, epauleDroite, cou, tete,
    poitrine: plus(milieu(base, cou), [epaisseur / 2, 0, 0]),
    dos: plus(milieu(base, cou), [-epaisseur / 2, 0, 0]),
    ceinture: plus(base, fois(axe, 0.012)),
  };
}

/**
 * Un casque de combat : une calotte **repoussée sur l'arrière** de la tête, qui
 * laisse le visage dépasser devant elle — c'est la seule façon qu'un visage se
 * voie sous une caméra qui regarde d'en haut —, une jugulaire, et un **bandeau**
 * à la couleur d'accent : vu d'en haut, c'est lui qui distingue deux nations de
 * teinte voisine.
 */
function casqueCombat(c: Corps, role: RolePiece, taille = 1): PieceLocale[] {
  const [x, y, z] = c.tete;
  const r = 0.045 * taille;
  return [
    { nom: 'casque', forme: 'sphere', role, position: [x - 0.02, y + 0.026, z], taille: [r * 2, r * 1.5, r * 2] },
    { nom: 'rebord_casque', forme: 'cylindre', role: 'clair', position: [x - 0.02, y + 0.018, z], taille: [r * 2.04, 0.012, r * 2.04] },
    { nom: 'jugulaire', forme: 'boite', role: 'sombre', position: [x - 0.002, y - 0.028, z], taille: [0.03, 0.012, 0.05] },
  ];
}

/** Le sac à dos, avec le rouleau de couchage à la couleur d'accent posé dessus. */
function sacADos(c: Corps): PieceLocale[] {
  const centre = plus(c.dos, fois(c.axe, 0.01));
  return [
    orientee('sac', 'boite', 'sombre', plus(centre, [-0.035, 0, 0]), c.axe, [0.065, 0.13, 0.13]),
    { nom: 'rouleau', forme: 'cylindre', role: 'clair', position: plus(plus(centre, fois(c.axe, 0.07)), [-0.035, 0, 0]), taille: [0.048, 0.14, 0.048], lacet: DEMI_PI, tangage: DEMI_PI },
    orientee('bretelle_gauche', 'plaque', 'sombre', plus(c.poitrine, [0.004, 0, -0.042]), c.axe, [0.012, 0.13, 0.022]),
    orientee('bretelle_droite', 'plaque', 'sombre', plus(c.poitrine, [0.004, 0, 0.042]), c.axe, [0.012, 0.13, 0.022]),
  ];
}

/** Deux sacoches de ceinture, devant : c'est là qu'une silhouette cesse d'être un tube. */
function sacoches(c: Corps): PieceLocale[] {
  return [
    { nom: 'sacoche_gauche', forme: 'boite', role: 'sombre', position: plus(c.ceinture, [0.045, -0.012, -0.04]), taille: [0.03, 0.045, 0.04] },
    { nom: 'sacoche_droite', forme: 'boite', role: 'sombre', position: plus(c.ceinture, [0.045, -0.012, 0.04]), taille: [0.03, 0.045, 0.04] },
  ];
}

/**
 * Un fusil d'assaut, décrit par la crosse et l'axe de tir : crosse, boîtier,
 * poignée, chargeur, garde-main, canon et hausse. Rend aussi où vont les deux
 * mains, pour que les bras se plient jusqu'à lui.
 */
function fusil(crosse: Point, axe: Point): { pieces: PieceLocale[]; mainDroite: Point; mainGauche: Point } {
  const p = (s: number, haut = 0, cote = 0): Point => surAxe(crosse, axe, s, haut, cote);
  return {
    pieces: [
      orientee('crosse', 'boite', 'sombre', p(0.035), axe, [0.05, 0.07, 0.024]),
      orientee('fusil', 'boite', 'materiel', p(0.135), axe, [0.034, 0.13, 0.028]),
      orientee('poignee', 'boite', 'sombre', p(0.085, -0.03), axe, [0.038, 0.02, 0.018]),
      orientee('chargeur', 'boite', 'sombre', p(0.14, -0.038), axe, [0.05, 0.03, 0.02]),
      orientee('garde_main', 'boite', 'sombre', p(0.215), axe, [0.028, 0.07, 0.026]),
      orientee('canon_fusil', 'cylindre', 'roulant', p(0.3), axe, [0.014, 0.11, 0.014]),
      orientee('hausse', 'boite', 'roulant', p(0.12, 0.024), axe, [0.016, 0.03, 0.012]),
    ],
    mainDroite: p(0.085, -0.02),
    mainGauche: p(0.225, -0.012),
  };
}

/** Un fusilier : jambes légères, veste au camp, pantalon sombre, sac et fusil. Trois allures. */
function fantassin(pose: 'pointe' | 'marche' | 'genou'): PieceLocale[] {
  const hanche = (bassin: number, z: number): Point => [0, bassin, z];
  let corps: Corps;
  let arme: ReturnType<typeof fusil>;
  if (pose === 'pointe') {
    // En tête : jambes écartées, tronc penché, fusil épaulé et yeux dans la hausse.
    const bassin = 0.205;
    corps = corpsHumain({
      bassin, penche: 0.14, veste: 'principal', pantalon: 'sombre', regard: { lacet: 0.18 },
      jambes: [
        ...jambe('gauche', hanche(bassin, -0.048), [0.06, 0.105, -0.052], [0.075, 0.02, -0.056], 'sombre'),
        ...jambe('droit', hanche(bassin, 0.048), [-0.035, 0.105, 0.052], [-0.075, 0.02, 0.06], 'sombre'),
      ],
    });
    arme = fusil(plus(corps.epauleDroite, [0.02, -0.012, -0.004]), [1, -0.14, -0.14]);
  } else if (pose === 'marche') {
    // En marche : une jambe devant, l'autre derrière, fusil bas en travers, regard sur le flanc.
    const bassin = 0.21;
    corps = corpsHumain({
      bassin, penche: 0.06, veste: 'principal', pantalon: 'sombre', regard: { lacet: -0.35 },
      jambes: [
        ...jambe('gauche', hanche(bassin, -0.047), [0.06, 0.11, -0.047], [0.08, 0.025, -0.047], 'sombre'),
        ...jambe('droit', hanche(bassin, 0.047), [-0.03, 0.115, 0.047], [-0.075, 0.02, 0.047], 'sombre'),
      ],
    });
    arme = fusil([-0.03, bassin + 0.1, 0.07], [1, -0.4, -0.55]);
  } else {
    // À genou : le genou droit au sol, le tibia couché derrière, le pied gauche à plat, fusil épaulé vers la gauche.
    const bassin = 0.135;
    corps = corpsHumain({
      bassin, penche: 0.08, veste: 'principal', pantalon: 'sombre', regard: { lacet: -0.25 },
      jambes: [
        ...jambe('gauche', hanche(bassin, -0.05), [0.075, 0.135, -0.052], [0.085, 0.02, -0.052], 'sombre'),
        ...jambe('droit', hanche(bassin, 0.05), [-0.03, 0.04, 0.055], [-0.13, 0.03, 0.055], 'sombre', -0.02),
      ],
    });
    arme = fusil(plus(corps.epauleDroite, [0.02, -0.012, -0.004]), [1, -0.06, -0.38]);
  }
  return [
    ...corps.pieces,
    ...casqueCombat(corps, 'principal'),
    ...sacADos(corps),
    ...sacoches(corps),
    ...arme.pieces,
    ...brasVers('droit', corps.epauleDroite, arme.mainDroite, 'principal'),
    ...brasVers('gauche', corps.epauleGauche, arme.mainGauche, 'principal'),
  ];
}

/**
 * Un grenadier antichar : gilet lourd — plastron et dorsale au camp sur une
 * veste sombre —, épaulières de métal, casque à visière relevée et crête
 * d'accent, et le **tube lance-missiles à l'épaule**, ogive `clair` devant,
 * venturi `sombre` derrière, tenu à deux mains. Debout et bien campé, ou à genou.
 */
function grenadier(pose: 'debout' | 'genou'): PieceLocale[] {
  const hanche = (bassin: number, z: number): Point => [0, bassin, z];
  const bassin = pose === 'debout' ? 0.205 : 0.135;
  const corps = corpsHumain({
    bassin, penche: 0.05, veste: 'sombre', pantalon: 'sombre', lourd: true, regard: { lacet: 0.12 },
    jambes: pose === 'debout'
      ? [
        ...jambe('gauche', hanche(bassin, -0.05), [0.045, 0.105, -0.06], [0.05, 0.02, -0.07], 'sombre'),
        ...jambe('droit', hanche(bassin, 0.05), [-0.03, 0.105, 0.06], [-0.055, 0.02, 0.075], 'sombre'),
      ]
      : [
        ...jambe('gauche', hanche(bassin, -0.052), [0.075, 0.135, -0.056], [0.085, 0.02, -0.056], 'sombre'),
        ...jambe('droit', hanche(bassin, 0.052), [-0.03, 0.04, 0.058], [-0.13, 0.03, 0.058], 'sombre', -0.02),
      ],
  });
  // Le tube repose sur l'épaule droite, relevé vers la cible.
  const axe: Point = [1, 0.16, 0];
  const appui = plus(corps.epauleDroite, [0.02, 0.05, 0.004]);
  const t = (s: number, haut = 0, cote = 0): Point => surAxe(appui, axe, s, haut, cote);
  const long = 0.5;
  return [
    ...corps.pieces,
    orientee('plastron', 'boite', 'principal', plus(corps.poitrine, [0.012, 0, 0]), corps.axe, [0.03, 0.13, 0.15]),
    orientee('dorsale', 'boite', 'principal', plus(corps.dos, [-0.012, 0, 0]), corps.axe, [0.03, 0.13, 0.15]),
    { nom: 'epauliere_gauche', forme: 'boite', role: 'materiel', position: plus(corps.epauleGauche, [0, 0.012, -0.012]), taille: [0.08, 0.03, 0.07] },
    { nom: 'epauliere_droite', forme: 'boite', role: 'materiel', position: plus(corps.epauleDroite, [0, 0.012, 0.012]), taille: [0.08, 0.03, 0.07] },
    ...casqueCombat(corps, 'principal', 1.08),
    { nom: 'crete_casque', forme: 'plaque', role: 'clair', position: plus(corps.tete, [-0.016, 0.06, 0]), taille: [0.09, 0.016, 0.022] },
    { nom: 'visiere', forme: 'boite', role: 'verre', position: plus(corps.tete, [0.024, 0.05, 0]), taille: [0.028, 0.02, 0.08], tangage: -0.6 },
    orientee('tube_lance', 'cylindre', 'materiel', t(0.03), axe, [0.085, long, 0.085]),
    orientee('ogive', 'cylindre', 'clair', t(0.03 + long / 2 + 0.04), axe, [0.02, 0.08, 0.09]),
    orientee('venturi', 'cylindre', 'sombre', t(0.03 - long / 2 - 0.02), axe, [0.11, 0.05, 0.075]),
    orientee('viseur', 'boite', 'verre', t(0.06, 0.055), axe, [0.03, 0.045, 0.026]),
    orientee('poignee_tube', 'boite', 'roulant', t(0.08, -0.06), axe, [0.05, 0.022, 0.024]),
    ...brasVers('droit', corps.epauleDroite, t(0.08, -0.075), 'sombre', [-0.2, -1, 0.5]),
    ...brasVers('gauche', corps.epauleGauche, t(0.2, -0.062, -0.01), 'sombre'),
    orientee('sac_roquettes', 'boite', 'sombre', plus(corps.dos, [-0.04, 0, -0.03]), corps.axe, [0.07, 0.15, 0.1]),
    { nom: 'roquette_reserve_1', forme: 'cylindre', role: 'clair', position: plus(corps.dos, [-0.045, 0.1, -0.06]), taille: [0.03, 0.07, 0.03] },
    { nom: 'roquette_reserve_2', forme: 'cylindre', role: 'clair', position: plus(corps.dos, [-0.045, 0.1, -0.005]), taille: [0.03, 0.07, 0.03] },
  ];
}

/**
 * Un sapeur : casque de chantier et gilet haute visibilité, tous deux `clair` —
 * d'en haut, une équipe de chantier est de la couleur d'accent de son pays, ce
 * que ni le fusilier ni le grenadier ne sont. Pas de fusil : l'outil dit le
 * métier, et les mains vont à l'outil.
 */
function sapeur(outil: 'pelle' | 'marteau_piqueur' | 'brouette'): PieceLocale[] {
  const hanche = (bassin: number, z: number): Point => [0, bassin, z];
  const penche = outil === 'marteau_piqueur' ? 0.3 : outil === 'brouette' ? 0.2 : 0.06;
  const bassin = 0.205;
  const jambes = outil === 'marteau_piqueur'
    ? [
      ...jambe('gauche', hanche(bassin, -0.05), [0.04, 0.105, -0.058], [0.045, 0.02, -0.065], 'sombre'),
      ...jambe('droit', hanche(bassin, 0.05), [-0.04, 0.105, 0.058], [-0.06, 0.02, 0.07], 'sombre'),
    ]
    : [
      ...jambe('gauche', hanche(bassin, -0.047), [0.055, 0.11, -0.047], [0.075, 0.025, -0.047], 'sombre'),
      ...jambe('droit', hanche(bassin, 0.047), [-0.03, 0.115, 0.047], [-0.07, 0.02, 0.047], 'sombre'),
    ];
  const corps = corpsHumain({ bassin, penche, veste: 'principal', pantalon: 'sombre', regard: { lacet: outil === 'pelle' ? 0.2 : 0 }, jambes });
  const [x, y, z] = corps.tete;
  const pieces: PieceLocale[] = [
    ...corps.pieces,
    orientee('gilet', 'boite', 'clair', plus(milieu(corps.poitrine, corps.dos), fois(corps.axe, -0.01)), corps.axe, [0.108, 0.11, 0.165]),
    orientee('bande_gilet', 'plaque', 'materiel', plus(milieu(corps.poitrine, corps.dos), fois(corps.axe, -0.03)), corps.axe, [0.114, 0.018, 0.17]),
    { nom: 'casque', forme: 'sphere', role: 'clair', position: [x - 0.014, y + 0.026, z], taille: [0.094, 0.072, 0.094] },
    { nom: 'visiere_casque', forme: 'plaque', role: 'clair', position: [x + 0.03, y + 0.034, z], taille: [0.04, 0.01, 0.084], tangage: 0.35 },
    { nom: 'bandeau_casque', forme: 'cylindre', role: 'sombre', position: [x - 0.014, y + 0.01, z], taille: [0.096, 0.01, 0.096] },
  ];
  if (outil === 'pelle') {
    // La pelle sur l'épaule droite, fer en arrière et en l'air : un long manche qui dépasse la tête se lit d'en haut.
    const avant: Point = [0.1, corps.cou[1] - 0.09, 0.1];
    const arriere: Point = [-0.16, corps.cou[1] + 0.14, 0.095];
    const axe = moins(arriere, avant);
    pieces.push(
      segment('outil_manche', 'sombre', avant, arriere, 0.011, 'cylindre'),
      orientee('outil_pelle', 'plaque', 'materiel', surAxe(avant, axe, norme(axe) + 0.05), axe, [0.02, 0.12, 0.095]),
      ...brasVers('droit', corps.epauleDroite, surAxe(avant, axe, 0.05), 'principal'),
      ...brasVers('gauche', corps.epauleGauche, surAxe(avant, axe, 0.12), 'principal', [-0.2, -1, -0.2]),
    );
  } else if (outil === 'marteau_piqueur') {
    // Le marteau-piqueur tenu à deux mains par son guidon, pointe au sol ; la caisse à outils à côté.
    pieces.push(
      { nom: 'outil_corps', forme: 'boite', role: 'sombre', position: [0.2, 0.2, 0], taille: [0.09, 0.15, 0.08] },
      { nom: 'outil_guidon', forme: 'boite', role: 'clair', position: [0.19, 0.29, 0], taille: [0.05, 0.03, 0.26] },
      { nom: 'outil_burin', forme: 'cylindre', role: 'materiel', position: [0.2, 0.07, 0], taille: [0.026, 0.14, 0.026] },
      ...brasVers('droit', corps.epauleDroite, [0.19, 0.31, 0.11], 'principal'),
      ...brasVers('gauche', corps.epauleGauche, [0.19, 0.31, -0.11], 'principal'),
      { nom: 'caisse_outils', forme: 'boite', role: 'sombre', position: [0.02, 0.045, -0.2], taille: [0.14, 0.09, 0.07] },
      { nom: 'poignee_caisse', forme: 'boite', role: 'materiel', position: [0.02, 0.1, -0.2], taille: [0.07, 0.02, 0.022] },
    );
  } else {
    // La brouette poussée devant, un touret de câble dedans ; la radio dans le dos,
    // antenne dressée : c'est ce que le module « radar » veut dire pour une troupe.
    const mainG: Point = [0.1, bassin + 0.08, -0.085];
    const mainD: Point = [0.1, bassin + 0.08, 0.085];
    pieces.push(
      segment('brancard_gauche', 'sombre', mainG, [0.38, 0.1, -0.08], 0.011, 'cylindre'),
      segment('brancard_droit', 'sombre', mainD, [0.38, 0.1, 0.08], 0.011, 'cylindre'),
      { nom: 'caisse_brouette', forme: 'boite', role: 'materiel', position: [0.29, 0.15, 0], taille: [0.2, 0.1, 0.2], tangage: 0.12 },
      { nom: 'roue_brouette', forme: 'cylindre', role: 'roulant', position: [0.4, 0.055, 0], taille: [0.11, 0.045, 0.11], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'touret', forme: 'cylindre', role: 'clair', position: [0.29, 0.23, 0], taille: [0.1, 0.1, 0.1], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'joue_touret_gauche', forme: 'cylindre', role: 'materiel', position: [0.29, 0.23, -0.053], taille: [0.14, 0.012, 0.14], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'joue_touret_droite', forme: 'cylindre', role: 'materiel', position: [0.29, 0.23, 0.053], taille: [0.14, 0.012, 0.14], lacet: DEMI_PI, tangage: DEMI_PI },
      ...brasVers('droit', corps.epauleDroite, mainD, 'principal'),
      ...brasVers('gauche', corps.epauleGauche, mainG, 'principal'),
      orientee('radio', 'boite', 'sombre', plus(corps.dos, [-0.04, 0, 0]), corps.axe, [0.07, 0.14, 0.12]),
      { nom: 'antenne_radio', forme: 'cylindre', role: 'materiel', position: plus(corps.dos, [-0.05, 0.19, -0.04]), taille: [0.01, 0.3, 0.01] },
    );
  }
  return pieces;
}

/**
 * La troupe à pied, décidée par les modules et jamais par le nom de l'unité :
 * - `lance_roquettes` — deux grenadiers antichar, tube à l'épaule ;
 * - `radar` — une équipe de chantier (radar vaut « technicien » : c'est la
 *   convention du catalogue, et la radio à antenne dans le dos du sapeur la
 *   rend visible) ;
 * - aucun des deux — trois fusiliers en coin de patrouille : un en tête qui
 *   vise, un qui marche en surveillant le flanc, un à genou qui couvre.
 * Tout autre module est une pièce servie, posée au sol derrière la troupe.
 */
function troupe(modules: readonly ModuleSilhouette[]): Piece[] {
  if (modules.includes('radar')) {
    return [
      ...poserFigurine('figurine_1', 0.1, -0.21, -0.55, sapeur('pelle')),
      ...poserFigurine('figurine_2', -0.16, 0.02, 0.15, sapeur('marteau_piqueur')),
      ...poserFigurine('figurine_3', -0.23, 0.22, 0.05, sapeur('brouette')),
    ];
  }
  if (modules.includes('lance_roquettes')) {
    return [
      ...poserFigurine('figurine_1', -0.1, -0.16, -0.12, grenadier('debout')),
      ...poserFigurine('figurine_2', 0.04, 0.16, 0.1, grenadier('genou')),
    ];
  }
  return [
    ...poserFigurine('figurine_1', 0.13, 0, 0, fantassin('pointe')),
    ...poserFigurine('figurine_2', -0.14, -0.21, 0.3, fantassin('marche')),
    ...poserFigurine('figurine_3', -0.13, 0.21, -0.25, fantassin('genou')),
  ];
}

/**
 * Compose une silhouette en pièces. L'ordre est stable — base, corps, modules —
 * ce qui rend la liste comparable dans les tests et le rendu reproductible.
 */
export function composerSilhouette(s: Silhouette): Piece[] {
  if (s.base === 'pattes') {
    const pieces = troupe(s.modules);
    let rang = 0;
    for (const m of s.modules.slice(0, 3)) {
      if (m === 'lance_roquettes' || m === 'radar') continue;
      // Une pièce servie, à demi-échelle, derrière la troupe : un module que
      // personne ne porte à l'épaule reste visible sans coiffer les têtes.
      for (const p of piecesModule(m, 0.24, rang)) {
        pieces.push({ ...p, position: [p.position[0] * 0.5 - 0.2, p.position[1] * 0.5, p.position[2] * 0.5] });
      }
      rang += 1;
    }
    return pieces;
  }

  const yBase = hauteurBase(s.base);
  const pieces = [...piecesBase(s.base), ...detailsBase(s.base), ...piecesCorps(s.corps, yBase), ...detailsCorps(s, yBase)];
  const ySommet = hauteurCorps(s.corps, yBase);
  let rang = 0;
  for (const m of s.modules.slice(0, 3)) {
    const canonEnTourelle = s.modules.includes('tourelle') && s.modules.includes('canon_long');
    const hauteurModule = ySommet + (m === 'canon_long' && canonEnTourelle ? 0.06 : 0);
    const ajout = [...piecesModule(m, hauteurModule, rang), ...detailsModule(m, hauteurModule, rang)];
    // Le canon lourd remplace le canon court de la tourelle, sans deux tubes superposés.
    pieces.push(...ajout.filter((p) => !(canonEnTourelle && (p.nom === 'canon' || p.nom === 'bouche_canon'))));
    rang += 1;
  }
  return pieces;
}

/** Les noms des pièces d'une silhouette : la forme courte pour les tests. */
export function nomsPieces(s: Silhouette): string[] {
  return composerSilhouette(s).map((p) => p.nom);
}

/** Hauteur totale d'une silhouette composée : sert à poser l'étiquette de PV. */
export function hauteurSilhouette(s: Silhouette): number {
  let haut = 0.1;
  for (const p of composerSilhouette(s)) {
    haut = Math.max(haut, p.position[1] + p.taille[1] / 2);
  }
  return haut * echelleTaille(s.taille);
}
