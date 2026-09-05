/**
 * Les **surbrillances** : ce qu'une case allumée veut dire au joueur.
 *
 * Ce fichier ne contient qu'un vocabulaire, et c'est pour cela qu'il existe
 * séparément. Il vivait dans le rendu vectoriel, qui en peignait les couleurs ;
 * quand celui-ci a été retiré, le contrôleur, les objectifs et la peau 3D en
 * avaient toujours besoin — mais aucun d'eux n'a à connaître la façon dont on
 * les dessine.
 */

import type { Case } from '../schemas/types';

/**
 * Ce qu'une surbrillance signifie. C'est sa couleur qui le dit au joueur, et la
 * phrase tient en cinq mots : **vert, j'y vais ; rouge, j'y tire**. L'or est un
 * objectif de match et le bleu un chantier du génie — les deux s'écartent
 * volontairement du couple vert/rouge, sans quoi le joueur lirait un ordre là
 * où il n'y en a pas.
 */
export type GenreSurbrillance = 'deplacement' | 'attaque' | 'capture' | 'production' | 'danger';

/** Les cinq genres, dans l'ordre où le jeu les apprend. */
export const GENRES_SURBRILLANCE: readonly GenreSurbrillance[] = [
  'deplacement', 'attaque', 'capture', 'production', 'danger',
];

/** Une case mise en avant sous le curseur du joueur. */
export interface Surbrillance {
  case: Case;
  genre: GenreSurbrillance;
}
