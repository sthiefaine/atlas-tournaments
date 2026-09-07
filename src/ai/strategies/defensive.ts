/**
 * `defensive` — mêmes calculs que `ponderee`, poids différents : elle tient ses
 * bâtiments, préfère le couvert, ne s'expose pas et garde des capteurs en
 * réserve. Elle gagne rarement vite, elle perd rarement vite.
 */

import type { Poids, Strategie } from '../types';
import { POIDS_PONDEREE, strategieAvec } from './ponderee';

/** Poids de la personnalité défensive. */
export const POIDS_DEFENSIVE: Poids = {
  ...POIDS_PONDEREE,
  echange: 10,
  securite: 14,
  progression: 3,
  terrain: 3,
  capteursVises: 5,
  engagement: 0.7,
  // Elle rentre tôt, garde ses munitions et sert ses voisins avant d'avancer.
  munitions: 2,
  carburant: 18,
  reserve: 2,
  ravitaillement: 16,
  embarquement: 14,
  debarquement: 12,
};

/** La stratégie défensive. */
export const DEFENSIVE: Strategie = strategieAvec('defensive', POIDS_DEFENSIVE);
