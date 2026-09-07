/**
 * `agressive` — mêmes calculs que `ponderee`, poids différents
 * (`doc/02-architecture.md` §3.2) : elle valorise l'échange et la marche en
 * avant, encaisse la menace sans broncher et achète du matériel qui frappe.
 */

import type { Poids, Strategie } from '../types';
import { POIDS_PONDEREE, strategieAvec } from './ponderee';

/** Poids de la personnalité agressive. */
export const POIDS_AGRESSIVE: Poids = {
  ...POIDS_PONDEREE,
  echange: 22,
  securite: 2,
  progression: 9,
  terrain: 0.6,
  capteursVises: 3,
  qg: 4,
  // Elle rentre plus tard et ravitaille moins : la marche en avant d'abord.
  carburant: 8,
  reserve: 0.5,
  ravitaillement: 8,
  embarquement: 24,
  debarquement: 18,
};

/** La stratégie agressive. */
export const AGRESSIVE: Strategie = strategieAvec('agressive', POIDS_AGRESSIVE);
