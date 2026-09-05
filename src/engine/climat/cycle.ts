/**
 * Cycle jour / nuit, compté en journées (`doc/04-gameplay.md` §12.3).
 * Défaut 4 / 2 ; les extrêmes sont autorisés (nuit polaire `{ jour: 0, nuit: 6 }`).
 */

import type { PhaseJour } from '../../schemas/index';

/** Cycle déclaré par le scénario. */
export interface CycleJourNuit { jour: number; nuit: number }

/** Longueur d'un cycle, au moins 1. */
export function longueurCycle(cycle: CycleJourNuit): number {
  return Math.max(1, cycle.jour + cycle.nuit);
}

/** Phase d'une position dans le cycle. */
export function phaseDe(cycle: CycleJourNuit, journeeDansCycle: number): PhaseJour {
  if (cycle.jour <= 0) return 'nuit';
  if (cycle.nuit <= 0) return 'jour';
  return journeeDansCycle < cycle.jour ? 'jour' : 'nuit';
}

/** Position suivante dans le cycle : avance de 1, repasse à 0 en fin de cycle. */
export function avancerCycle(cycle: CycleJourNuit, journeeDansCycle: number): number {
  return (journeeDansCycle + 1) % longueurCycle(cycle);
}
