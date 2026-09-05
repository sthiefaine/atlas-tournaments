/**
 * Le composeur de **placeholders 3D**, en pièces déclaratives.
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

/** Une figurine d'infanterie : jambes, buste, casque. */
function figurine(nom: string, x: number, z: number): Piece[] {
  return [
    { nom: `${nom}_jambes`, forme: 'cylindre', role: 'sombre', position: [x, 0.09, z], taille: [0.1, 0.18, 0.1] },
    { nom: `${nom}_buste`, forme: 'capsule', role: 'principal', position: [x, 0.26, z], taille: [0.16, 0.26, 0.16] },
    { nom: `${nom}_casque`, forme: 'sphere', role: 'clair', position: [x, 0.38, z], taille: [0.14, 0.12, 0.14] },
  ];
}

/**
 * Compose une silhouette en pièces. L'ordre est stable — base, corps, modules —
 * ce qui rend la liste comparable dans les tests et le rendu reproductible.
 */
export function composerSilhouette(s: Silhouette): Piece[] {
  if (s.base === 'pattes') {
    const troupe = [
      ...figurine('figurine_1', 0.13, -0.11),
      ...figurine('figurine_2', -0.12, 0.02),
      ...figurine('figurine_3', 0.05, 0.16),
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
  const pieces = [...piecesBase(s.base), ...piecesCorps(s.corps, yBase)];
  const ySommet = hauteurCorps(s.corps, yBase);
  let rang = 0;
  for (const m of s.modules.slice(0, 3)) {
    pieces.push(...piecesModule(m, ySommet, rang));
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
