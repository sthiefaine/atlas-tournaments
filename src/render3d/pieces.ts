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
      // L'infanterie : trois figurines, jamais un bloc. Voir `composerSilhouette`.
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

/** Trois petites figurines équipées, avec une pose et un équipement lisibles. */
function figurine(nom: string, x: number, z: number, technicien: boolean): Piece[] {
  const pieces: Piece[] = [
    { nom: `${nom}_jambes`, forme: 'boite', role: 'sombre', position: [x, 0.1, z], taille: [0.09, 0.15, 0.11] },
    { nom: `${nom}_botte_gauche`, forme: 'boite', role: 'roulant', position: [x + 0.03, 0.035, z - 0.048], taille: [0.13, 0.06, 0.065] },
    { nom: `${nom}_botte_droite`, forme: 'boite', role: 'roulant', position: [x - 0.015, 0.035, z + 0.048], taille: [0.13, 0.06, 0.065] },
    { nom: `${nom}_buste`, forme: 'capsule', role: 'principal', position: [x, 0.245, z], taille: [0.17, 0.24, 0.17] },
    { nom: `${nom}_gilet`, forme: 'boite', role: technicien ? 'clair' : 'sombre', position: [x + 0.071, 0.24, z], taille: [0.045, 0.15, 0.13] },
    { nom: `${nom}_sac`, forme: 'boite', role: 'sombre', position: [x - 0.095, 0.26, z], taille: [0.08, 0.16, 0.13] },
    { nom: `${nom}_casque`, forme: 'sphere', role: 'principal', position: [x, 0.385, z], taille: [0.21, 0.17, 0.20] },
    { nom: `${nom}_rebord_casque`, forme: 'cylindre', role: 'clair', position: [x + 0.015, 0.364, z], taille: [0.218, 0.024, 0.205] },
    { nom: `${nom}_visiere`, forme: 'boite', role: 'verre', position: [x + 0.092, 0.369, z], taille: [0.031, 0.052, 0.13] },
    { nom: `${nom}_bras_gauche`, forme: 'capsule', role: 'principal', position: [x + 0.035, 0.24, z - 0.107], taille: [0.065, 0.16, 0.065], rotation: [0, 0, -0.65] },
    { nom: `${nom}_bras_droit`, forme: 'capsule', role: 'principal', position: [x + 0.035, 0.24, z + 0.107], taille: [0.065, 0.16, 0.065], rotation: [0, 0, -0.65] },
  ];
  if (technicien) {
    pieces.push(
      { nom: `${nom}_outil_manche`, forme: 'cylindre', role: 'materiel', position: [x + 0.08, 0.18, z + 0.13], taille: [0.023, 0.28, 0.023], rotation: [0, 0, -0.25] },
      { nom: `${nom}_outil_pelle`, forme: 'plaque', role: 'clair', position: [x + 0.11, 0.045, z + 0.13], taille: [0.07, 0.075, 0.025], rotation: [0, 0, -0.25] },
      { nom: `${nom}_caisse_outils`, forme: 'boite', role: 'clair', position: [x + 0.04, 0.12, z - 0.15], taille: [0.15, 0.10, 0.07] },
      { nom: `${nom}_poignee_caisse`, forme: 'boite', role: 'materiel', position: [x + 0.04, 0.18, z - 0.15], taille: [0.08, 0.023, 0.025] },
    );
  } else {
    pieces.push(
      { nom: `${nom}_fusil`, forme: 'boite', role: 'materiel', position: [x + 0.1, 0.22, z + 0.1], taille: [0.23, 0.045, 0.037] },
      { nom: `${nom}_canon_fusil`, forme: 'cylindre', role: 'roulant', position: [x + 0.25, 0.223, z + 0.1], taille: [0.024, 0.08, 0.024], rotation: [0, 0, DEMI_PI] },
      { nom: `${nom}_chargeur`, forme: 'boite', role: 'sombre', position: [x + 0.09, 0.175, z + 0.1], taille: [0.038, 0.065, 0.033], rotation: [0, 0, 0.18] },
    );
  }
  return pieces;
}

/**
 * Compose une silhouette en pièces. L'ordre est stable — base, corps, modules —
 * ce qui rend la liste comparable dans les tests et le rendu reproductible.
 */
export function composerSilhouette(s: Silhouette): Piece[] {
  if (s.base === 'pattes') {
    const technicien = s.modules.includes('radar');
    const troupe = [
      ...figurine('figurine_1', 0.12, -0.20, technicien),
      ...figurine('figurine_2', -0.19, 0.01, technicien),
      ...figurine('figurine_3', 0.11, 0.20, technicien),
    ];
    let rang = 0;
    for (const m of s.modules.slice(0, 3)) {
      for (const p of piecesModule(m, 0.24, rang)) {
        troupe.push({ ...p, position: [p.position[0] * 0.5 + 0.05, p.position[1] * 0.8, p.position[2] * 0.5 - 0.11] });
      }
      rang += 1;
    }
    return troupe;
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
