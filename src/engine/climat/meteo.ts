/**
 * Météo : table de probabilités par (climat, saison) et tirage seedé
 * (`doc/04-gameplay.md` §12.4). Une météo par journée, prévision à deux journées.
 *
 * Le flux d'aléa est `rng.branche('meteo')` (BRIEF, périmètre du moteur) : il est
 * indépendant de `combat` et de `ia`, donc ajouter un tirage ailleurs ne change
 * jamais le temps qu'il fait.
 */

import type { Climat, Meteo, Saison } from '../../schemas/index';
import { METEOS } from '../../schemas/index';
import type { Rng } from '../types';

/** Une ligne de la table : pourcentages dans l'ordre de `METEOS`. */
export type LigneMeteo = readonly [number, number, number, number, number, number];

/** Table §12.4, en pourcentages : clair, pluie, neige, brouillard, tempête, canicule. */
export const TABLE_METEO: Record<Climat, Record<Saison, LigneMeteo>> = {
  tempere: {
    printemps: [55, 30, 0, 10, 5, 0], ete: [70, 15, 0, 5, 5, 5],
    automne: [45, 30, 0, 20, 5, 0], hiver: [40, 20, 25, 10, 5, 0],
  },
  oceanique: {
    printemps: [40, 40, 0, 15, 5, 0], ete: [55, 30, 0, 10, 5, 0],
    automne: [30, 40, 0, 15, 15, 0], hiver: [25, 40, 10, 15, 10, 0],
  },
  mediterraneen: {
    printemps: [70, 20, 0, 5, 5, 0], ete: [75, 5, 0, 0, 5, 15],
    automne: [55, 30, 0, 5, 10, 0], hiver: [60, 30, 0, 5, 5, 0],
  },
  continental: {
    printemps: [55, 30, 0, 10, 5, 0], ete: [65, 15, 0, 5, 5, 10],
    automne: [50, 25, 5, 15, 5, 0], hiver: [30, 10, 45, 10, 5, 0],
  },
  tropical: {
    printemps: [60, 25, 0, 5, 10, 0], ete: [20, 55, 0, 5, 15, 5],
    automne: [55, 25, 0, 5, 10, 5], hiver: [70, 15, 0, 5, 5, 5],
  },
  aride: {
    printemps: [80, 5, 0, 0, 10, 5], ete: [65, 0, 0, 0, 10, 25],
    automne: [80, 5, 0, 0, 10, 5], hiver: [80, 10, 0, 5, 5, 0],
  },
  polaire: {
    printemps: [45, 10, 30, 10, 5, 0], ete: [55, 20, 10, 10, 5, 0],
    automne: [35, 10, 40, 10, 5, 0], hiver: [25, 0, 50, 10, 15, 0],
  },
  montagnard: {
    printemps: [45, 25, 10, 15, 5, 0], ete: [60, 20, 0, 10, 10, 0],
    automne: [40, 25, 10, 20, 5, 0], hiver: [30, 10, 40, 10, 10, 0],
  },
};

/** Tire une météo dans la ligne (climat, saison) du flux fourni. */
export function tirerMeteo(climat: Climat, saison: Saison, rng: Rng): Meteo {
  const ligne = TABLE_METEO[climat][saison];
  const tirage = rng.entier(100);
  let cumul = 0;
  for (let i = 0; i < ligne.length; i += 1) {
    cumul += ligne[i] ?? 0;
    if (tirage < cumul) return METEOS[i] ?? 'clair';
  }
  return 'clair';
}

/** Météo la plus probable d'une ligne : sert aux simulations de contrôle. */
export function meteoDominante(climat: Climat, saison: Saison): Meteo {
  const ligne = TABLE_METEO[climat][saison];
  let meilleure = 0;
  for (let i = 1; i < ligne.length; i += 1) {
    if ((ligne[i] ?? 0) > (ligne[meilleure] ?? 0)) meilleure = i;
  }
  return METEOS[meilleure] ?? 'clair';
}

/** Vrai si cette météo peut sortir pour ce couple : la ligne fait foi. */
export function meteoPossible(climat: Climat, saison: Saison, meteo: Meteo): boolean {
  const i = METEOS.indexOf(meteo);
  return i >= 0 && (TABLE_METEO[climat][saison][i] ?? 0) > 0;
}
