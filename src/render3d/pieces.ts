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

/** À quel matériau une pièce appartient : c'est là qu'agit le masque d'équipe. */
export type RolePiece =
  | 'principal' | 'sombre' | 'clair' | 'materiel' | 'verre' | 'roulant';

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

/**
 * Une pièce dans le repère d'une figurine : origine entre les pieds, X devant,
 * Y haut. Seuls le **lacet** (autour de Y) et le **tangage** (autour de Z) sont
 * permis, parce que c'est ce qui rend la pose d'une figurine composable avec
 * l'orientation de la figurine entière : `Ry(cap) · Ry(lacet) · Rz(tangage)`
 * reste un Euler `[0, cap + lacet, tangage]`, sans recomposer de matrice.
 * Un cylindre le long de Z est `lacet: π/2, tangage: π/2`.
 */
interface PieceLocale {
  nom: string;
  forme: FormePiece;
  role: RolePiece;
  position: [number, number, number];
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

/** Le gabarit d'un corps : ce qui change entre un fantassin, un grenadier et un sapeur. */
interface Gabarit {
  /** Hauteur des jambes ; le tronc commence au-dessus. */
  jambes: number;
  /** Longueur, hauteur et largeur du tronc. */
  tronc: [number, number, number];
  /** Rôle du tronc et rôle des jambes : c'est la répartition des couleurs. */
  roleTronc: RolePiece;
  roleJambes: RolePiece;
  /** Inclinaison du tronc vers l'avant (un sapeur se penche sur son ouvrage). */
  penche?: number;
  /** Foulée : les pieds décalés l'un devant l'autre disent qu'on marche. */
  foulee?: number;
  /** Rayon de tête, et donc du casque qui la coiffe. */
  tete: number;
}

/**
 * Le corps commun : deux jambes, deux bottes, un tronc, une tête. La tête est
 * `sombre` parce qu'il n'existe pas de rôle « peau » et qu'un visage dans
 * l'ombre d'un casque est ce qu'on voit d'en haut. Renvoie aussi la hauteur
 * d'épaule et de sommet de tête, où se posent bras, casque et équipement.
 */
function corpsFigurine(g: Gabarit): { pieces: PieceLocale[]; epaule: number; sommet: number } {
  const foulee = g.foulee ?? 0;
  const [lt, ht, pt] = g.tronc;
  const penche = g.penche ?? 0;
  // Un tronc penché avance son centre d'autant qu'il s'incline.
  const xTronc = Math.sin(penche) * ht / 2;
  const yTronc = g.jambes + Math.cos(penche) * ht / 2;
  const epaule = g.jambes + Math.cos(penche) * ht;
  const xEpaule = Math.sin(penche) * ht;
  const pieces: PieceLocale[] = [
    { nom: 'jambe_gauche', forme: 'boite', role: g.roleJambes, position: [foulee, g.jambes / 2, -pt * 0.26], taille: [pt * 0.42, g.jambes, pt * 0.4] },
    { nom: 'jambe_droite', forme: 'boite', role: g.roleJambes, position: [-foulee, g.jambes / 2, pt * 0.26], taille: [pt * 0.42, g.jambes, pt * 0.4] },
    { nom: 'botte_gauche', forme: 'boite', role: 'roulant', position: [foulee + 0.015, 0.022, -pt * 0.26], taille: [pt * 0.62, 0.044, pt * 0.42] },
    { nom: 'botte_droite', forme: 'boite', role: 'roulant', position: [-foulee + 0.015, 0.022, pt * 0.26], taille: [pt * 0.62, 0.044, pt * 0.42] },
    { nom: 'tronc', forme: 'boite', role: g.roleTronc, position: [xTronc, yTronc, 0], taille: [lt, ht, pt], tangage: -penche },
    // Un cylindre et non une sphère : la tête est sous un casque, on n'en voit que
    // le visage dans l'ombre, et une sphère coûte trois fois plus de triangles.
    { nom: 'tete', forme: 'cylindre', role: 'sombre', position: [xEpaule + 0.01, epaule + g.tete * 0.9, 0], taille: [g.tete * 1.9, g.tete * 1.8, g.tete * 1.9] },
  ];
  return { pieces, epaule, sommet: epaule + g.tete * 1.8 };
}

/** Deux bras en capsule, tendus vers l'avant et vers le bas selon `tangage`. */
function bras(epaule: number, xEpaule: number, ecart: number, longueur: number, tangage: number, role: RolePiece, rayon = 0.055): PieceLocale[] {
  const avance = Math.sin(tangage) * longueur / 2;
  const descente = Math.cos(tangage) * longueur / 2;
  return [
    { nom: 'bras_gauche', forme: 'capsule', role, position: [xEpaule + avance, epaule - descente, -ecart], taille: [rayon, longueur, rayon], tangage: -tangage },
    { nom: 'bras_droit', forme: 'capsule', role, position: [xEpaule + avance, epaule - descente, ecart], taille: [rayon, longueur, rayon], tangage: -tangage },
  ];
}

/**
 * Un fantassin : léger, casque à rebord, gilet et sac, fusil d'assaut en travers
 * de la poitrine. Le rebord `clair` est ce qu'on distingue d'en haut : sans lui,
 * un casque n'est qu'une boule de la couleur du camp.
 */
function fantassin(pose: { foulee: number; fusilLeve: boolean }): PieceLocale[] {
  const corps = corpsFigurine({ jambes: 0.17, tronc: [0.11, 0.16, 0.16], roleTronc: 'principal', roleJambes: 'sombre', foulee: pose.foulee, tete: 0.052 });
  const e = corps.epaule;
  const yFusil = e - 0.07;
  const tangageFusil = pose.fusilLeve ? 0.08 : 0.3;
  return [
    ...corps.pieces,
    { nom: 'gilet', forme: 'boite', role: 'sombre', position: [0.05, e - 0.085, 0], taille: [0.05, 0.12, 0.13] },
    { nom: 'sac', forme: 'boite', role: 'sombre', position: [-0.075, e - 0.065, 0], taille: [0.07, 0.13, 0.13] },
    { nom: 'casque', forme: 'sphere', role: 'principal', position: [0.01, e + 0.075, 0], taille: [0.16, 0.12, 0.16] },
    { nom: 'rebord_casque', forme: 'cylindre', role: 'clair', position: [0.015, e + 0.045, 0], taille: [0.185, 0.016, 0.175] },
    { nom: 'lunettes', forme: 'boite', role: 'verre', position: [0.075, e + 0.035, 0], taille: [0.025, 0.028, 0.09] },
    ...bras(e - 0.01, 0, 0.1, 0.15, 1.05, 'principal'),
    // Le fusil est tenu en travers : un lacet le fait pointer vers l'avant-gauche,
    // ce qui lui donne de la longueur apparente vu de haut.
    { nom: 'fusil', forme: 'boite', role: 'materiel', position: [0.1, yFusil, 0.01], taille: [0.24, 0.04, 0.035], lacet: 0.5, tangage: -tangageFusil },
    { nom: 'canon_fusil', forme: 'cylindre', role: 'roulant', position: [0.1 + 0.155 * Math.cos(0.5), yFusil + 0.155 * Math.sin(tangageFusil), 0.01 - 0.155 * Math.sin(0.5)], taille: [0.022, 0.09, 0.022], lacet: 0.5, tangage: DEMI_PI - tangageFusil },
    { nom: 'chargeur', forme: 'boite', role: 'sombre', position: [0.09, yFusil - 0.04, 0.02], taille: [0.035, 0.06, 0.03], lacet: 0.5, tangage: 0.2 },
    { nom: 'crosse', forme: 'boite', role: 'sombre', position: [0.1 - 0.14 * Math.cos(0.5), yFusil - 0.02, 0.01 + 0.14 * Math.sin(0.5)], taille: [0.07, 0.05, 0.03], lacet: 0.5 },
  ];
}

/**
 * Un grenadier antichar : trapu, blindé, casque lourd à visière, et surtout un
 * **tube lance-missiles à l'épaule** — l'ogive `clair` devant, le venturi
 * `sombre` derrière. `agenouille` abaisse la figurine sur un genou, ce qui donne
 * à la paire une silhouette en escalier au lieu de deux jumeaux.
 */
function grenadier(pose: { agenouille: boolean }): PieceLocale[] {
  const jambes = pose.agenouille ? 0.09 : 0.19;
  const corps = corpsFigurine({ jambes, tronc: [0.16, 0.19, 0.21], roleTronc: 'sombre', roleJambes: 'sombre', tete: 0.058 });
  const e = corps.epaule;
  const pieces: PieceLocale[] = [...corps.pieces];
  if (pose.agenouille) {
    // Le genou droit au sol, la cuisse gauche relevée devant : le tronc s'assoit sur l'une et l'autre.
    pieces.splice(0, 2,
      { nom: 'jambe_gauche', forme: 'boite', role: 'sombre', position: [0.07, 0.065, -0.055], taille: [0.18, 0.075, 0.08] },
      { nom: 'jambe_droite', forme: 'boite', role: 'sombre', position: [-0.06, 0.05, 0.055], taille: [0.09, 0.1, 0.08] },
    );
    pieces[2] = { nom: 'botte_gauche', forme: 'boite', role: 'roulant', position: [0.15, 0.022, -0.055], taille: [0.1, 0.044, 0.085] };
    pieces[3] = { nom: 'botte_droite', forme: 'boite', role: 'roulant', position: [-0.14, 0.03, 0.055], taille: [0.09, 0.06, 0.085] };
  }
  // Le tube repose sur l'épaule droite, légèrement relevé vers la cible.
  const releve = 0.16;
  const zTube = 0.115;
  const yTube = e + 0.03;
  const xTube = 0.04;
  const long = 0.5;
  const bout = (d: number): [number, number, number] => [xTube + Math.cos(releve) * d, yTube + Math.sin(releve) * d, zTube];
  pieces.push(
    { nom: 'plastron', forme: 'boite', role: 'principal', position: [0.075, e - 0.1, 0], taille: [0.05, 0.15, 0.17] },
    { nom: 'dorsale', forme: 'boite', role: 'principal', position: [-0.085, e - 0.11, 0], taille: [0.05, 0.14, 0.17] },
    { nom: 'epaulette_gauche', forme: 'boite', role: 'materiel', position: [0, e - 0.015, -0.12], taille: [0.1, 0.05, 0.085] },
    { nom: 'epaulette_droite', forme: 'boite', role: 'materiel', position: [0, e - 0.015, 0.12], taille: [0.1, 0.05, 0.085] },
    { nom: 'casque', forme: 'sphere', role: 'principal', position: [0.005, e + 0.085, 0], taille: [0.17, 0.14, 0.17] },
    { nom: 'crete_casque', forme: 'plaque', role: 'clair', position: [0, e + 0.145, 0], taille: [0.12, 0.022, 0.028] },
    { nom: 'visiere', forme: 'boite', role: 'verre', position: [0.08, e + 0.055, 0], taille: [0.03, 0.05, 0.11] },
    ...bras(e - 0.02, 0, 0.13, 0.15, 1.35, 'sombre', 0.065),
    { nom: 'tube_lance', forme: 'cylindre', role: 'materiel', position: bout(0), taille: [0.085, long, 0.085], tangage: DEMI_PI - releve },
    // Un cylindre couché par `Rz(+π/2)` a son sommet vers l'arrière : le premier rayon est celui de l'arrière.
    { nom: 'ogive', forme: 'cylindre', role: 'clair', position: bout(long / 2 + 0.045), taille: [0.092, 0.1, 0.03], tangage: DEMI_PI - releve },
    { nom: 'venturi', forme: 'cylindre', role: 'sombre', position: bout(-long / 2 - 0.02), taille: [0.12, 0.06, 0.08], tangage: DEMI_PI - releve },
    { nom: 'viseur', forme: 'boite', role: 'verre', position: [xTube + 0.06, yTube + 0.06, zTube], taille: [0.05, 0.035, 0.03] },
    { nom: 'poignee_tube', forme: 'boite', role: 'roulant', position: [xTube + 0.1, yTube - 0.055, zTube], taille: [0.03, 0.05, 0.03] },
    { nom: 'sac_roquettes', forme: 'boite', role: 'sombre', position: [-0.12, e - 0.06, -0.04], taille: [0.07, 0.17, 0.11] },
    { nom: 'roquette_reserve_1', forme: 'cylindre', role: 'clair', position: [-0.12, e + 0.05, -0.07], taille: [0.03, 0.06, 0.03] },
    { nom: 'roquette_reserve_2', forme: 'cylindre', role: 'clair', position: [-0.12, e + 0.05, -0.01], taille: [0.03, 0.06, 0.03] },
  );
  return pieces;
}

/**
 * Un sapeur : casque de chantier à visière plate et gilet haute visibilité,
 * tous deux `clair` — d'en haut, une équipe de chantier est de la couleur
 * d'accent de son pays, ce que ni le fantassin ni le grenadier ne sont. Pas de
 * fusil : l'outil dit le métier.
 */
function sapeur(outil: 'pelle' | 'marteau_piqueur' | 'brouette'): PieceLocale[] {
  const penche = outil === 'marteau_piqueur' ? 0.32 : outil === 'brouette' ? 0.22 : 0.08;
  const corps = corpsFigurine({ jambes: 0.16, tronc: [0.11, 0.16, 0.17], roleTronc: 'principal', roleJambes: 'sombre', penche, foulee: outil === 'pelle' ? 0.03 : 0, tete: 0.052 });
  const e = corps.epaule;
  const xe = Math.sin(penche) * 0.16;
  const pieces: PieceLocale[] = [
    ...corps.pieces,
    { nom: 'gilet', forme: 'boite', role: 'clair', position: [xe * 0.5, e - 0.07, 0], taille: [0.135, 0.12, 0.19], tangage: -penche },
    { nom: 'bande_gilet', forme: 'plaque', role: 'materiel', position: [xe * 0.5, e - 0.09, 0], taille: [0.142, 0.02, 0.196], tangage: -penche },
    { nom: 'casque', forme: 'sphere', role: 'clair', position: [xe + 0.01, e + 0.08, 0], taille: [0.14, 0.11, 0.14] },
    { nom: 'visiere_casque', forme: 'plaque', role: 'clair', position: [xe + 0.075, e + 0.055, 0], taille: [0.07, 0.012, 0.13] },
    { nom: 'bandeau_casque', forme: 'cylindre', role: 'clair', position: [xe + 0.01, e + 0.05, 0], taille: [0.155, 0.014, 0.15] },
  ];
  if (outil === 'pelle') {
    // La pelle sur l'épaule, fer en arrière : un long manche qui dépasse la tête se lit d'en haut.
    const incl = 0.55;
    pieces.push(
      ...bras(e - 0.01, 0, 0.1, 0.14, 0.8, 'principal'),
      { nom: 'outil_manche', forme: 'cylindre', role: 'sombre', position: [-0.06, e + 0.04, 0.11], taille: [0.024, 0.36, 0.024], tangage: -incl },
      { nom: 'outil_pelle', forme: 'plaque', role: 'materiel', position: [-0.06 - Math.sin(incl) * 0.21, e + 0.04 + Math.cos(incl) * 0.21, 0.11], taille: [0.09, 0.11, 0.02], tangage: -incl },
    );
  } else if (outil === 'marteau_piqueur') {
    // Le marteau-piqueur tenu devant soi, pointe au sol ; la caisse à outils à côté.
    pieces.push(
      ...bras(e - 0.01, xe, 0.1, 0.15, 1.2, 'principal'),
      { nom: 'outil_corps', forme: 'boite', role: 'sombre', position: [0.24, 0.2, 0], taille: [0.1, 0.15, 0.09] },
      { nom: 'outil_guidon', forme: 'boite', role: 'clair', position: [0.21, 0.29, 0], taille: [0.05, 0.035, 0.26] },
      { nom: 'outil_burin', forme: 'cylindre', role: 'materiel', position: [0.24, 0.07, 0], taille: [0.03, 0.14, 0.03] },
      { nom: 'caisse_outils', forme: 'boite', role: 'sombre', position: [0.02, 0.045, -0.19], taille: [0.14, 0.09, 0.07] },
      { nom: 'poignee_caisse', forme: 'boite', role: 'materiel', position: [0.02, 0.1, -0.19], taille: [0.07, 0.02, 0.022] },
    );
  } else {
    // La brouette poussée devant, un touret de câble dedans ; la radio dans le dos,
    // antenne dressée : c'est ce que le module « radar » veut dire pour une troupe.
    pieces.push(
      ...bras(e - 0.01, xe, 0.1, 0.16, 1.15, 'principal'),
      { nom: 'brancard_gauche', forme: 'cylindre', role: 'sombre', position: [0.2, 0.15, -0.08], taille: [0.022, 0.3, 0.022], tangage: DEMI_PI - 0.22 },
      { nom: 'brancard_droit', forme: 'cylindre', role: 'sombre', position: [0.2, 0.15, 0.08], taille: [0.022, 0.3, 0.022], tangage: DEMI_PI - 0.22 },
      { nom: 'caisse_brouette', forme: 'boite', role: 'materiel', position: [0.27, 0.13, 0], taille: [0.2, 0.1, 0.2], tangage: 0.12 },
      { nom: 'roue_brouette', forme: 'cylindre', role: 'roulant', position: [0.38, 0.055, 0], taille: [0.11, 0.045, 0.11], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'touret', forme: 'cylindre', role: 'clair', position: [0.27, 0.21, 0], taille: [0.1, 0.1, 0.1], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'joue_touret_gauche', forme: 'cylindre', role: 'materiel', position: [0.27, 0.21, -0.053], taille: [0.14, 0.012, 0.14], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'joue_touret_droite', forme: 'cylindre', role: 'materiel', position: [0.27, 0.21, 0.053], taille: [0.14, 0.012, 0.14], lacet: DEMI_PI, tangage: DEMI_PI },
      { nom: 'radio', forme: 'boite', role: 'sombre', position: [-0.075, e - 0.07, 0], taille: [0.07, 0.14, 0.12], tangage: -penche },
      { nom: 'antenne_radio', forme: 'cylindre', role: 'materiel', position: [-0.09, e + 0.08, -0.04], taille: [0.012, 0.3, 0.012] },
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
 * - aucun des deux — trois fusiliers en patrouille.
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
      ...poserFigurine('figurine_1', -0.1, -0.16, -0.12, grenadier({ agenouille: false })),
      ...poserFigurine('figurine_2', 0.04, 0.16, 0.1, grenadier({ agenouille: true })),
    ];
  }
  return [
    ...poserFigurine('figurine_1', 0.13, 0, 0, fantassin({ foulee: 0.03, fusilLeve: true })),
    ...poserFigurine('figurine_2', -0.14, -0.21, 0.3, fantassin({ foulee: -0.03, fusilLeve: false })),
    ...poserFigurine('figurine_3', -0.13, 0.21, -0.25, fantassin({ foulee: 0.02, fusilLeve: false })),
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
