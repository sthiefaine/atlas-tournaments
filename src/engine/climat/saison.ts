/**
 * Saison d'un match et effets de saison (`doc/04-gameplay.md` §12.1 et §12.2).
 *
 * La saison se déduit de `Scenario.date` et de `Country.hemisphere`, jamais de
 * l'horloge : le moteur reçoit la date comme une donnée quelconque.
 */

import type { Climat, DateIso, Hemisphere, Saison } from '../../schemas/index';

/** Les neuf effets de saison chiffrés du §12.2. */
export const EFFETS_SAISON = [
  'neige_plaines', 'rivieres_gelees', 'forets_sans_couvert', 'sol_detrempe',
  'canicule_saison', 'saison_des_pluies', 'nuits_froides', 'cols_fermes', 'nuit_polaire',
] as const;
/** Effet de saison actif pendant un match. */
export type EffetSaison = typeof EFFETS_SAISON[number];

/** Saison de base d'un mois, découpage mensuel (§12.1). */
const PAR_MOIS: Saison[] = [
  'hiver', 'hiver', 'printemps', 'printemps', 'printemps', 'ete',
  'ete', 'ete', 'automne', 'automne', 'automne', 'hiver',
];

/** Saison opposée : printemps ↔ automne, été ↔ hiver. */
export function opposee(s: Saison): Saison {
  if (s === 'printemps') return 'automne';
  if (s === 'automne') return 'printemps';
  if (s === 'ete') return 'hiver';
  return 'ete';
}

/** Saison d'un match : (date figée du scénario, hémisphère du pays) → saison. */
export function saisonDe(date: DateIso, hemisphere: Hemisphere): Saison {
  const mois = Number(date.slice(5, 7));
  const base = PAR_MOIS[Math.min(11, Math.max(0, mois - 1))] ?? 'hiver';
  return hemisphere === 'sud' ? opposee(base) : base;
}

/** Table climat × saison (§12.2) : les effets actifs de chaque couple. */
export const TABLE_CLIMAT_SAISON: Record<Climat, Record<Saison, EffetSaison[]>> = {
  tempere: {
    printemps: [], ete: [], automne: ['forets_sans_couvert'],
    hiver: ['neige_plaines', 'rivieres_gelees'],
  },
  oceanique: {
    printemps: ['sol_detrempe'], ete: [],
    automne: ['forets_sans_couvert', 'sol_detrempe'], hiver: ['sol_detrempe'],
  },
  mediterraneen: {
    printemps: [], ete: ['canicule_saison'], automne: ['forets_sans_couvert'], hiver: [],
  },
  continental: {
    printemps: ['sol_detrempe'], ete: [], automne: ['forets_sans_couvert'],
    hiver: ['neige_plaines', 'rivieres_gelees'],
  },
  tropical: {
    printemps: [], ete: ['saison_des_pluies'], automne: [], hiver: [],
  },
  aride: {
    printemps: [], ete: ['canicule_saison'], automne: [], hiver: ['nuits_froides'],
  },
  polaire: {
    printemps: ['rivieres_gelees'], ete: [], automne: ['neige_plaines'],
    hiver: ['neige_plaines', 'rivieres_gelees', 'nuit_polaire'],
  },
  montagnard: {
    printemps: ['sol_detrempe'], ete: [], automne: ['forets_sans_couvert'],
    hiver: ['neige_plaines', 'cols_fermes'],
  },
};

/** Effets de saison actifs pour un couple (climat, saison). */
export function effetsSaison(climat: Climat, saison: Saison): EffetSaison[] {
  return TABLE_CLIMAT_SAISON[climat][saison];
}
