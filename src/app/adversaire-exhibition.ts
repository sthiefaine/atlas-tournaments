import type { CommandantMoteur } from '@/engine/index';
import type { StrategieIa } from '@/schemas/index';
import {
  creerAdversaireEnFond, type AdversaireEnFond, type OptionsAdversaireEnFond,
} from './jeu/adversaire-fond';

/**
 * Les deux camps de l'exhibition de l'écran-titre (`attract.tsx`) : la pondérée
 * au camp 0, l'agressive au camp 1. C'était écrit à même la boucle de l'attract,
 * `strategie(etat.campCourant === 0 ? 'ponderee' : 'agressive')` ; c'est
 * désormais la configuration de son adversaire.
 */
export const STRATEGIES_EXHIBITION: Readonly<Record<number, StrategieIa>> = Object.freeze({
  0: 'ponderee',
  1: 'agressive',
});

/**
 * L'IA de l'exhibition, **hors du fil principal** (23 septembre 2026) : le même
 * Web Worker que la page de jeu (`jeu/adversaire-fond.ts`), avec le même repli
 * sur le fil principal quand le navigateur n'en veut pas. L'écran-titre ne
 * s'arrête plus le temps d'un tour pendant que la peau anime un geste — 5 ms en
 * médiane et 18 au pire sur trente tours, mesurés sous Node sur un M1
 * (`doc/refonte/sprites-bascule.md`) ; aucun téléphone n'a été mesuré.
 *
 * Les actions ne changent pas : le worker appelle `adversaireIa` avec ces
 * stratégies, qui choisit exactement ce que la boucle choisissait
 * (`tests/app/adversaire-exhibition.test.ts`), et il calcule sur une copie de
 * l'état — ce que la boucle ne faisait pas, et qui la gardait d'un transport
 * vide dont le moteur partage la cale entre deux états (`adversaire-fond.ts`).
 */
export function adversaireExhibition(
  catalogueVersion: number,
  commandants: (CommandantMoteur | null)[],
  options: OptionsAdversaireEnFond = {},
): AdversaireEnFond {
  return creerAdversaireEnFond(STRATEGIES_EXHIBITION[0], catalogueVersion, commandants, STRATEGIES_EXHIBITION, options);
}
