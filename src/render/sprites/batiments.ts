/**
 * Les bâtiments en vue trois quarts, repris de la démo : face avant, toit décalé
 * de `d`, liseré clair et fenêtres. La nuit, les fenêtres des bâtiments
 * **éclairés** brillent — ce sont exactement ceux qui gardent leur vision
 * (`04-gameplay.md` §12.3), ce qui rend la règle lisible sans un mot de texte.
 *
 * Le repère est celui d'une tuile : `(0, 0)` au coin haut gauche de la case.
 */

import type { CleTerrain, Palette } from '../../schemas/types';
import type { PaletteTerrain } from '../ambiance';
import { disque, ombre, polygone, rr, trait, type Pinceau } from './formes';

/** Un corps de bâtiment en trois quarts. */
export function corpsBatiment(
  g: Pinceau, x: number, y: number, l: number, h: number, d: number,
  col: Palette, fenetres: boolean, couleurFenetre: string,
): void {
  g.fillStyle = col.dark;
  rr(g, x, y, l, h, 3);
  g.fill();
  g.fillStyle = col.main;
  rr(g, x, y - d, l, d + 4, 3);
  g.fill();
  g.fillStyle = col.light;
  g.fillRect(x + 3, y - d + 3, l - 6, 2);
  if (!fenetres) return;
  g.fillStyle = couleurFenetre;
  for (let j = 6; j < h - 6; j += 9) {
    for (let i = 5; i < l - 5; i += 9) g.fillRect(x + i, y + j, 4, 5);
  }
}

/** Une ville : trois corps de hauteurs différentes. */
export function ville(g: Pinceau, px: number, py: number, col: Palette, f: string): void {
  ombre(g, true);
  corpsBatiment(g, px + 8, py + 30, 18, 26, 10, col, true, f);
  corpsBatiment(g, px + 28, py + 22, 20, 34, 14, col, true, f);
  corpsBatiment(g, px + 50, py + 34, 10, 22, 8, col, true, f);
  ombre(g, false);
}

/** Une usine : une halle basse et sa cheminée. */
export function usine(g: Pinceau, px: number, py: number, col: Palette, f: string): void {
  ombre(g, true);
  corpsBatiment(g, px + 8, py + 30, 40, 26, 12, col, true, f);
  corpsBatiment(g, px + 46, py + 16, 10, 40, 6, col, false, f);
  ombre(g, false);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(px + 51, py + 10, 7, 5, 0, 0, Math.PI * 2);
  g.fill();
}

/** Un aéroport : un hangar en voûte, une piste et sa manche à air. */
export function aeroport(g: Pinceau, px: number, py: number, col: Palette, f: string): void {
  g.fillStyle = 'rgba(60,64,72,0.55)';
  rr(g, px + 4, py + 44, 56, 12, 4);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = px + 10; i < px + 56; i += 12) g.fillRect(i, py + 49, 7, 2);
  ombre(g, true);
  corpsBatiment(g, px + 10, py + 24, 34, 20, 12, col, false, f);
  ombre(g, false);
  g.fillStyle = col.light;
  rr(g, px + 14, py + 20, 26, 8, 4);
  g.fill();
  trait(g, px + 52, py + 40, px + 52, py + 20, '#4a4f57', 2);
  polygone(g, [[px + 52, py + 20], [px + 62, py + 24], [px + 52, py + 28]], col.main);
}

/** Un QG : bloc massif, panneau et fanion, comme dans la démo. */
export function qg(
  g: Pinceau, px: number, py: number, col: Palette, f: string, etiquette: string,
): void {
  ombre(g, true);
  corpsBatiment(g, px + 10, py + 28, 44, 26, 16, col, false, f);
  ombre(g, false);
  g.fillStyle = col.light;
  rr(g, px + 18, py + 34, 28, 14, 3);
  g.fill();
  g.fillStyle = col.dark;
  g.font = 'bold 11px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText(etiquette, px + 32, py + 45);
  trait(g, px + 50, py + 30, px + 50, py + 4, '#444444', 2);
  polygone(g, [[px + 50, py + 2], [px + 64, py + 7], [px + 50, py + 12]], col.main);
  g.textAlign = 'left';
}

/** Halo chaud posé sur un bâtiment éclairé la nuit. */
export function halo(g: Pinceau, px: number, py: number, p: PaletteTerrain): void {
  const grad = g.createRadialGradient(px + 32, py + 34, 4, px + 32, py + 34, 40);
  grad.addColorStop(0, 'rgba(255,214,120,0.32)');
  grad.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = grad;
  g.fillRect(px - 8, py - 8, 80, 80);
  disque(g, px + 32, py + 22, 2.5, p.fenetre);
}

/** Dessine le bâtiment d'un terrain capturable. Les autres terrains n'en ont pas. */
export function batiment(
  g: Pinceau, terrain: CleTerrain, px: number, py: number,
  col: Palette, p: PaletteTerrain, etiquetteQg: string,
): void {
  const f = p.fenetre;
  switch (terrain) {
    case 'ville': ville(g, px, py, col, f); break;
    case 'usine': usine(g, px, py, col, f); break;
    case 'aeroport': aeroport(g, px, py, col, f); break;
    case 'qg': qg(g, px, py, col, f, etiquetteQg); break;
    default: break;
  }
}
