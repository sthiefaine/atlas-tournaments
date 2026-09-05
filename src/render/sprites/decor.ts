/**
 * Le décor : arbres et montagnes, repris de la démo et recolorés par l'ambiance
 * (feuillage roux en automne, cimes blanches sous la neige, tout bleuit la nuit).
 *
 * Les fonctions dessinent dans le repère d'une tuile : `(0, 0)` est le coin haut
 * gauche de la case, la tuile fait `TUILE` pixels de côté.
 */

import type { PaletteTerrain } from '../ambiance';
import { ell, ombre, polygone, rr, type Pinceau } from './formes';

/** Un arbre : tronc, houppier en trois ellipses, ombre portée au sol. */
export function arbre(g: Pinceau, x: number, y: number, s: number, p: PaletteTerrain): void {
  ell(g, x + 2 * s, y + 14 * s, 11 * s, 4 * s, 'rgba(0,0,0,0.18)');
  g.fillStyle = p.tronc;
  rr(g, x - 2 * s, y + 4 * s, 4 * s, 11 * s, 2 * s);
  g.fill();
  ell(g, x, y - 1 * s, 11 * s, 10 * s, p.feuillage);
  ell(g, x - 3 * s, y - 4 * s, 8 * s, 7 * s, p.feuillageClair);
  ell(g, x - 5 * s, y - 6 * s, 3.5 * s, 3 * s, p.feuillageSommet);
}

/** Une montagne : face claire, face d'ombre, calotte de neige. */
export function montagne(g: Pinceau, x: number, y: number, s: number, p: PaletteTerrain): void {
  ell(g, x, y + 16 * s, 20 * s, 5 * s, 'rgba(0,0,0,0.18)');
  polygone(g, [[x - 22 * s, y + 16 * s], [x, y - 18 * s], [x + 22 * s, y + 16 * s]], p.roche);
  polygone(g, [[x, y - 18 * s], [x + 22 * s, y + 16 * s], [x + 2 * s, y + 16 * s]], p.rocheOmbre);
  polygone(g, [
    [x, y - 18 * s], [x - 7 * s, y - 6 * s], [x - 3 * s, y - 4 * s],
    [x + 1 * s, y - 7 * s], [x + 4 * s, y - 4 * s], [x + 7 * s, y - 6 * s],
  ], p.neige);
}

/** Le bosquet d'une case de forêt : trois arbres à des positions fixes. */
export function foret(g: Pinceau, px: number, py: number, p: PaletteTerrain): void {
  ombre(g, false);
  arbre(g, px + 18, py + 22, 1.1, p);
  arbre(g, px + 46, py + 18, 0.9, p);
  arbre(g, px + 30, py + 44, 1.2, p);
}

/** Le relief d'une case de montagne. */
export function relief(g: Pinceau, px: number, py: number, p: PaletteTerrain): void {
  montagne(g, px + 32, py + 34, 1.15, p);
}
