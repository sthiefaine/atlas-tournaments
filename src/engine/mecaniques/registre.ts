/**
 * Registre des mécaniques régionales : un greffon par clé (préfixe `meca_`),
 * appelé aux cinq points de branchement fixes (`doc/04-gameplay.md` §11.1).
 *
 * Le paramètre commun `gelable` (défaut `true`) n'appartient à aucune mécanique :
 * le moteur le lit avant elles (`04-gameplay.md` §12.6, règle 4).
 */

import type { Cle } from '../../schemas/index';
import type { Mecanique } from '../types';
import { MECANIQUE_MAREES } from './marees';
import { MECANIQUE_TEST } from './test';

const REGISTRE = new Map<Cle, Mecanique<never>>();

/** Enregistre une mécanique. Une clé déjà prise est remplacée. */
export function enregistrer(m: Mecanique<never>): void {
  REGISTRE.set(m.cle, m);
}

/** Mécanique enregistrée sous cette clé, ou `undefined`. */
export function mecaniqueDe(cle: Cle | null | undefined): Mecanique<never> | undefined {
  if (!cle) return undefined;
  return REGISTRE.get(cle);
}

/** Clés enregistrées, triées : itération déterministe. */
export function clesMecaniques(): Cle[] {
  return [...REGISTRE.keys()].sort();
}

enregistrer(MECANIQUE_TEST as unknown as Mecanique<never>);
enregistrer(MECANIQUE_MAREES as unknown as Mecanique<never>);

export { MECANIQUE_TEST, MECANIQUE_MAREES };
