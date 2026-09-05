/**
 * Les palettes de nation. Un seul dessin par unité, teinté par nation
 * (`BRIEF.md`, direction artistique) : le palette swap est trivial en Canvas 2D,
 * c'est le même code qui redessine avec d'autres couleurs.
 *
 * Les quatre couleurs de camp et la neutre sont celles de la démo `ARMY`.
 */

import type { CampId, Palette } from '../schemas/types';

/** Nom court d'une palette : c'est ce qui entre dans la clé du cache de sprites. */
export type NomNation = 'bleu' | 'rouge' | 'vert' | 'or' | 'neutre';

/** Les palettes de camp, dans l'ordre des `CampId`. */
export const PALETTES: Readonly<Record<NomNation, Palette>> = {
  bleu: { main: '#3f86e0', dark: '#255a9e', light: '#8dbdf5' },
  rouge: { main: '#e04b45', dark: '#96292a', light: '#f59a95' },
  vert: { main: '#37b35a', dark: '#1f6f38', light: '#8ee0a4' },
  or: { main: '#e9b93a', dark: '#9c7717', light: '#f7dd8c' },
  neutre: { main: '#b9bec7', dark: '#7c828c', light: '#e2e5ea' },
};

/** Ordre des nations par camp. */
export const NATIONS: readonly NomNation[] = ['bleu', 'rouge', 'vert', 'or'];

/** Nom de nation d'un camp, `neutre` pour un bâtiment sans propriétaire. */
export function nationDe(camp: CampId | null): NomNation {
  if (camp === null) return 'neutre';
  return NATIONS[camp] ?? 'neutre';
}

/** Palette d'un camp, la neutre pour `null`. */
export function paletteDe(camp: CampId | null): Palette {
  return PALETTES[nationDe(camp)];
}

/** Palette d'une nation nommée. */
export function paletteNation(nation: NomNation): Palette {
  return PALETTES[nation] ?? PALETTES.neutre;
}
