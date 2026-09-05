/**
 * Types de l'IA de jeu (`doc/02-architecture.md` §3.2).
 *
 * L'IA est un **consommateur** du moteur : elle ne fait que ce qu'un joueur peut
 * faire, en passant par `appliquer`, et ne tire ses aléas que du `Rng` reçu.
 */

import type { Action, Catalogue, EtatPartie, Rng } from '../engine/index';
import type { CampId } from '../schemas/index';

/** Les poids d'une stratégie : mêmes calculs, personnalités différentes. */
export interface Poids {
  /** Valeur d'une progression de capture. */
  capture: number;
  /** Facteur appliqué à la capture d'un QG adverse. */
  qg: number;
  /** Valeur d'échange : fonds gagnés à l'adversaire moins fonds risqués. */
  echange: number;
  /** Poids de la menace subie sur la case d'arrivée. */
  securite: number;
  /** Valeur d'un pas vers l'objectif le plus proche. */
  progression: number;
  /** Valeur d'un point d'étoile de défense du terrain d'arrivée. */
  terrain: number;
  /** Nombre d'unités capables de capturer que la stratégie veut tenir en jeu. */
  capteursVises: number;
  /** Part des fonds qu'un achat peut engager d'un coup, de 0 à 1. */
  engagement: number;
  /** Seuil de score en dessous duquel une unité préfère ne rien faire. */
  seuil: number;
}

/** Une stratégie d'IA : le contrat de `02-architecture.md` §3.2. */
export interface Strategie {
  readonly id: string;
  readonly poids: Poids;
  choisirAction(etat: EtatPartie, camp: CampId, rng: Rng, cat: Catalogue): Action;
}
