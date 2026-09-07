/**
 * # IA de jeu d'Atlas Tournament — API publique
 *
 * Une seule IA sert deux usages : l'adversaire du joueur solo et le pilote des
 * deux camps dans les simulations headless (`doc/02-architecture.md` §3.2).
 * Elle n'utilise que l'**API publique du moteur** et un flux dérivé
 * `rng.branche('ia')` : deux graines identiques donnent la même partie.
 *
 * ```ts
 * jouerTour(etat, strategie, rng, cat?, commandants?): ResultatTour
 * ```
 *
 * `jouerTour` enchaîne les actions du camp courant jusqu'à la fin de son tour et
 * rend le nouvel état, les actions jouées et les refus rencontrés.
 */

import type {
  Action, Catalogue, Commandants, EtatPartie, MotifRefus,
} from '../engine/index';
import { appliquer, catalogueParDefaut } from '../engine/index';
import type { Rng } from '../engine/index';
import type { StrategieIa } from '../schemas/index';
import { AGRESSIVE } from './strategies/agressive';
import { DEFENSIVE } from './strategies/defensive';
import { PONDEREE, strategieAvec, POIDS_PONDEREE } from './strategies/ponderee';
import type { Poids, Strategie } from './types';

export type { Poids, Strategie } from './types';
export {
  meilleureOption, meilleureProduction, POIDS_PONDEREE, PONDEREE, strategieAvec,
} from './strategies/ponderee';
export { AGRESSIVE, POIDS_AGRESSIVE } from './strategies/agressive';
export { DEFENSIVE, POIDS_DEFENSIVE } from './strategies/defensive';
export * from './evaluation';
export * from './logistique';

/**
 * `gloutonne` : la stratégie pondérée privée de tout ce qui n'est pas immédiat.
 * Elle ignore le climat et la sécurité — c'est délibéré, c'est l'étalon faible
 * de la routine contrôle (`04-gameplay.md` §12.7).
 */
export const POIDS_GLOUTONNE: Poids = {
  ...POIDS_PONDEREE,
  securite: 0,
  progression: 4,
  terrain: 0,
  capteursVises: 2,
};

/** La stratégie gloutonne. */
export const GLOUTONNE: Strategie = strategieAvec('gloutonne', POIDS_GLOUTONNE);

/** Une IA passive : elle finit son tour, rien d'autre. Étalon des tests. */
export const PASSIVE: Strategie = {
  id: 'passive',
  poids: POIDS_PONDEREE,
  choisirAction(): Action {
    return { type: 'finTour' };
  },
};

/** Stratégie d'un identifiant du contrat (`StrategieIa`). */
export function strategie(id: StrategieIa | 'passive'): Strategie {
  if (id === 'agressive') return AGRESSIVE;
  if (id === 'defensive') return DEFENSIVE;
  if (id === 'gloutonne') return GLOUTONNE;
  if (id === 'passive') return PASSIVE;
  return PONDEREE;
}

/** Ce que rend un tour joué par l'IA. */
export interface ResultatTour {
  etat: EtatPartie;
  actions: Action[];
  refus: { action: Action; motif: MotifRefus }[];
}

/** Garde-fou : au-delà, on considère que la stratégie tourne en rond. */
export const ACTIONS_MAX_PAR_TOUR = 200;

/**
 * Joue le tour du camp courant : suite d'actions jusqu'à `finTour` compris.
 * Une action refusée n'est jamais rejouée : la stratégie perd la main et le tour
 * se ferme, ce qui garantit qu'une partie se termine toujours.
 */
export function jouerTour(
  etat: EtatPartie, strat: Strategie, rng: Rng,
  cat: Catalogue = catalogueParDefaut(), commandants: Commandants = [],
): ResultatTour {
  const flux = rng.branche('ia');
  const actions: Action[] = [];
  const refus: { action: Action; motif: MotifRefus }[] = [];
  let courant = etat;
  const campDepart = courant.campCourant;
  for (let i = 0; i < ACTIONS_MAX_PAR_TOUR; i += 1) {
    if (courant.partie.terminee) break;
    const action = strat.choisirAction(courant, courant.campCourant, flux, cat);
    const r = appliquer(courant, action, cat, commandants);
    if (!r.ok) {
      refus.push({ action, motif: r.motif });
      if (action.type === 'finTour') break;
      const fin = appliquer(courant, { type: 'finTour' }, cat, commandants);
      if (fin.ok) {
        courant = fin.etat;
        actions.push({ type: 'finTour' });
      }
      break;
    }
    courant = r.etat;
    actions.push(action);
    if (action.type === 'finTour') break;
    if (courant.campCourant !== campDepart) break;
  }
  return { etat: courant, actions, refus };
}

/** Joue une partie entière, un camp par stratégie. Utile aux simulations. */
export interface ResultatPartie {
  etat: EtatPartie;
  actions: Action[];
  journees: number;
  terminee: boolean;
  vainqueur: number | null;
}

/** Fait jouer une partie complète, dans la limite de journées du scénario. */
export function jouerPartie(
  etat: EtatPartie, strategies: Strategie[], rng: Rng,
  cat: Catalogue = catalogueParDefaut(), commandants: Commandants = [],
  toursMax = 400,
): ResultatPartie {
  let courant = etat;
  const actions: Action[] = [];
  for (let tour = 0; tour < toursMax && !courant.partie.terminee; tour += 1) {
    const strat = strategies[courant.campCourant] ?? PONDEREE;
    const r = jouerTour(courant, strat, rng.branche(`camp${courant.campCourant}`), cat, commandants);
    if (r.actions.length === 0) break;
    courant = r.etat;
    actions.push(...r.actions);
  }
  return {
    etat: courant,
    actions,
    journees: courant.journee,
    terminee: courant.partie.terminee,
    vainqueur: courant.partie.vainqueur,
  };
}
