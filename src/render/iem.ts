/**
 * L'**usine sous impulsion** : ce que le rendu lit de `etat.usinesIem`.
 *
 * Le moteur pose `usinesIem[cleCase] = journée` sur un bâtiment producteur
 * touché par une impulsion ou un pouvoir `iem`, refuse la production par le
 * motif `usine_iem` **tant que l'entrée est là**, et la lève à la fermeture du
 * tour suivant de son propriétaire (`engine/types.ts`). La règle est donc la
 * présence de l'entrée, et rien d'autre : ce module ne recopie pas une durée.
 */

import { cleCase, depuisCle, terrainLogique, type Catalogue, type EtatPartie } from '../engine/index';
import type { Case } from '../schemas/types';

/** Vrai si la case est un bâtiment que l'impulsion tient encore. */
export function usineSousIem(etat: EtatPartie, cat: Catalogue, c: Case): boolean {
  if (etat.usinesIem?.[cleCase(c)] === undefined) return false;
  return terrainLogique(etat, cat, c) !== null;
}

/** Les cases des usines sous impulsion, par clé de case : ce que la carte marque. */
export function casesUsinesIem(etat: EtatPartie, cat: Catalogue): string[] {
  return Object.keys(etat.usinesIem ?? {}).filter((k) => usineSousIem(etat, cat, depuisCle(k)));
}
