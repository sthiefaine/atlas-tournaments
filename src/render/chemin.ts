/**
 * La géométrie d'un déplacement : longueur d'un chemin et position le long de
 * ce chemin.
 *
 * Ces fonctions vivent dans la couche commune plutôt que dans `render3d/` : une
 * figurine doit suivre le trajet que le **moteur** a validé, et cette règle
 * appartient au jeu, pas à la peau qui la dessine. Quand elles étaient rangées
 * du côté three.js, le rendu vectoriel — qui existait alors — ne pouvait pas y
 * accéder (`02-architecture.md` §5) et se contentait d'un glissement en ligne
 * droite, à travers les montagnes et les unités adverses.
 *
 * Pures et sans dépendance : elles se vérifient comme du moteur.
 */

import type { Case } from '../schemas/types';

/** Le chemin en L d'un déplacement : sur une grille, on ne coupe pas en diagonale. */
export function cheminEnL(de: Case, vers: Case): Case[] {
  const pas: Case[] = [de];
  if (de.x !== vers.x) pas.push({ x: vers.x, y: de.y });
  if (de.y !== vers.y) pas.push({ x: vers.x, y: vers.y });
  if (pas.length === 1) pas.push(vers);
  return pas;
}

/** Longueur d'un chemin, en cases. */
export function longueurChemin(pas: readonly Case[]): number {
  let total = 0;
  for (let i = 1; i < pas.length; i += 1) {
    const a = pas[i - 1];
    const b = pas[i];
    if (a && b) total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  return total;
}

/**
 * Position et cap le long d'un chemin, à la progression `p` (0 à 1). Fonction
 * pure : c'est elle que teste `tests/render3d/animations.test.ts`.
 */
export function surChemin(
  pas: readonly Case[], p: number,
): { x: number; y: number; cap: number } {
  const total = longueurChemin(pas);
  const premier = pas[0] ?? { x: 0, y: 0 };
  if (total === 0) return { x: premier.x, y: premier.y, cap: 0 };
  let reste = Math.max(0, Math.min(1, p)) * total;
  for (let i = 1; i < pas.length; i += 1) {
    const a = pas[i - 1];
    const b = pas[i];
    if (!a || !b) continue;
    const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d === 0) continue;
    if (reste <= d) {
      const k = reste / d;
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        cap: Math.atan2(-(b.y - a.y), b.x - a.x),
      };
    }
    reste -= d;
  }
  const fin = pas[pas.length - 1] ?? premier;
  const avant = pas[pas.length - 2] ?? fin;
  return { x: fin.x, y: fin.y, cap: Math.atan2(-(fin.y - avant.y), fin.x - avant.x) };
}
