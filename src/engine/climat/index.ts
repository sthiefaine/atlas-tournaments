/**
 * La couche climat : une mécanique globale, sur le même contrat de hooks que les
 * mécaniques régionales (`doc/04-gameplay.md` §12.5, `02-architecture.md` §3.1).
 * Le moteur l'appelle **avant** la mécanique régionale sur chaque hook, pour que
 * le local ait le dernier mot sur le global.
 *
 * Ce que la couche ne fait pas : écrire dans l'état. L'avance du cycle, le tirage
 * de la météo et le décalage des prévisions sont calculés ici par des fonctions
 * pures (`initialiserClimat`, `avancerClimat`) et appliqués par `tour.ts` — les
 * hooks, eux, ne rendent que des effets déclaratifs.
 */

import type { CampId, CleTerrain, CleUnite, EtatClimat, Meteo } from '../../schemas/index';
import type {
  Catalogue, CtxMecanique, EffetMecanique, EtatPartie, Mecanique, ReglagesPartie, Rng, Unite,
} from '../types';
import { porte } from '../types';
import { avancerCycle, phaseDe } from './cycle';
import { tirerMeteo } from './meteo';
import { effetsSaison, saisonDe, type EffetSaison } from './saison';

export * from './saison';
export * from './meteo';
export * from './cycle';

/** Fenêtres bornées : aucune immunité météo permanente. */
export function evenementClimat(r: ReglagesPartie, journee: number) {
  return r.evenementsClimat?.find((e) => journee >= e.journee && journee < e.journee + e.duree);
}
export function campAdapteClimat(etat: EtatPartie, camp: CampId): boolean {
  return evenementClimat(etat.reglages, etat.journee)?.campsAdaptes.includes(camp) ?? false;
}

/** Coût d'unité au-delà duquel une unité terrestre est « lourde » (§12.2). */
export const COUT_UNITE_LOURDE = 7000;

/** Saison effective d'un scénario : forcée, ou déduite de la date et de l'hémisphère. */
export function saisonEffective(r: ReglagesPartie): ReturnType<typeof saisonDe> {
  return r.saisonForcee ?? saisonDe(r.date, r.hemisphere);
}

/** Cycle effectif : la nuit polaire force `{ jour: 0, nuit: 6 }`. */
export function cycleEffectif(r: ReglagesPartie): { jour: number; nuit: number } {
  const effets = effetsSaison(r.climatPays, saisonEffective(r));
  if (effets.includes('nuit_polaire')) return { jour: 0, nuit: 6 };
  return r.cycleJourNuit;
}

/** Effets de saison actifs d'une partie. */
export function effetsSaisonPartie(r: ReglagesPartie): EffetSaison[] {
  return effetsSaison(r.climatPays, saisonEffective(r));
}

/**
 * Climat de la journée 1 : la saison, la phase, la météo du jour et deux journées
 * de prévision — trois tirages d'un coup pour que la prévision soit pleine.
 */
export function initialiserClimat(r: ReglagesPartie, rng: Rng): EtatClimat {
  const saison = saisonEffective(r);
  const cycle = cycleEffectif(r);
  const flux = rng.branche('meteo');
  const tire = (): Meteo => r.meteoForcee ?? tirerMeteo(r.climatPays, saison, flux);
  const j1 = tire();
  const j2 = tire();
  const j3 = tire();
  return {
    saison,
    phase: phaseDe(cycle, 0),
    journeeDansCycle: 0,
    meteo: evenementClimat(r, 1)?.meteo ?? j1,
    previsions: [evenementClimat(r, 2)?.meteo ?? j2, evenementClimat(r, 3)?.meteo ?? j3],
  };
}

/** Une météo imposée par un pouvoir, jusqu'à une journée incluse (`EtatPartie.meteoImposee`). */
export interface MeteoImposee { meteo: Meteo; jusqu: number }

/**
 * Avance le climat d'une journée : cycle, phase, décalage des prévisions et
 * tirage de la journée J+2. Fonction pure, appelée au début du tour du camp 0.
 *
 * `imposee` est la météo qu'un pouvoir impose (10 septembre 2026) : elle
 * **remplace** la valeur du jour et des prévisions qu'elle couvre encore, mais
 * le tirage a lieu comme d'habitude — le flux `meteo` avance du même pas avec
 * ou sans pouvoir, et le rejeu ne bouge pas. Elle l'emporte aussi sur une
 * fenêtre de scénario : un pouvoir est un acte, la fenêtre un décor.
 */
export function avancerClimat(
  climat: EtatClimat, r: ReglagesPartie, rng: Rng, journee?: number, imposee?: MeteoImposee,
): EtatClimat {
  const cycle = cycleEffectif(r);
  const journeeDansCycle = avancerCycle(cycle, climat.journeeDansCycle);
  const flux = rng.branche('meteo');
  const nouvelle = r.meteoForcee ?? tirerMeteo(r.climatPays, climat.saison, flux);
  const imposeeLe = (j: number | undefined): Meteo | undefined => (
    imposee !== undefined && j !== undefined && j <= imposee.jusqu ? imposee.meteo : undefined
  );
  return {
    saison: climat.saison,
    phase: phaseDe(cycle, journeeDansCycle),
    journeeDansCycle,
    meteo: imposeeLe(journee)
      ?? (journee === undefined ? undefined : evenementClimat(r, journee)?.meteo) ?? climat.previsions[0],
    previsions: [
      imposeeLe(journee === undefined ? undefined : journee + 1)
        ?? (journee === undefined ? undefined : evenementClimat(r, journee + 1)?.meteo) ?? climat.previsions[1],
      imposeeLe(journee === undefined ? undefined : journee + 2)
        ?? (journee === undefined ? undefined : evenementClimat(r, journee + 2)?.meteo) ?? nouvelle,
    ],
  };
}

/** Libellé du commentateur d'Atlas pour la journée en cours. */
export function bulletin(climat: EtatClimat): string {
  const [j1, j2] = climat.previsions;
  const nuit = climat.phase === 'nuit' ? 'Nuit' : 'Jour';
  return `${nuit}, ${climat.meteo} — demain ${j1}, après-demain ${j2}.`;
}

/** Clés des unités « lourdes » du catalogue : terre et coût ≥ 7 000. */
export function unitesLourdes(cat: Catalogue): CleUnite[] {
  return cat.cles.filter((c) => {
    const u = cat.unites[c];
    return u !== undefined && u.domaine === 'terre' && u.cout >= COUT_UNITE_LOURDE;
  });
}

/** Clés des unités terrestres du catalogue. */
export function unitesTerrestres(cat: Catalogue): CleUnite[] {
  return cat.cles.filter((c) => cat.unites[c]?.domaine === 'terre');
}

/** Vrai si la forêt cache encore, c'est-à-dire hors automne sans couvert. */
export function foretCache(etat: EtatPartie): boolean {
  return !effetsSaisonPartie(etat.reglages).includes('forets_sans_couvert');
}

/** Vrai si le brouillard de guerre est imposé : nuit, météo brouillard, ou scénario. */
export function brouillardActif(etat: EtatPartie): boolean {
  return etat.reglages.brouillard
    || etat.climat.phase === 'nuit'
    || etat.climat.meteo === 'brouillard';
}

/** Surcoût de case dû au climat (§12.2 et §12.4), avant plafond et plancher. */
export function surcoutClimat(
  etat: EtatPartie, terrain: CleTerrain, mouvement: string, lourde: boolean, camp: CampId = etat.campCourant,
): number {
  const effets = effetsSaisonPartie(etat.reglages);
  const meteo = etat.climat.meteo;
  const horsRoute = terrain !== 'route';
  let surcout = 0;

  if (effets.includes('neige_plaines')
    && (terrain === 'plaine' || terrain === 'route')
    && (mouvement === 'roues' || mouvement === 'chenilles')) surcout += 1;
  if ((effets.includes('sol_detrempe') || effets.includes('saison_des_pluies'))
    && mouvement === 'roues' && horsRoute) surcout += 1;
  if (effets.includes('cols_fermes') && terrain === 'montagne'
    && (mouvement === 'pied' || mouvement === 'bottes')) surcout += 1;

  // `canicule` et `canicule_saison` ne se cumulent pas (§12.4) : le malus est un
  // point de mouvement, posé en modificateur par `debutTour`, pas un surcoût de case.
  void lourde;
  return surcout + (campAdapteClimat(etat, camp) ? 0 : surcoutMeteo(meteo, terrain, mouvement));
}

/**
 * Le surcoût de case dû à la **météo du jour**, sans rien savoir d'une partie.
 *
 * C'est la moitié de `surcoutClimat` qui ne dépend ni de la saison, ni du pays,
 * ni de la région. Elle est isolée pour qu'on puisse **poser la question à
 * l'avance** — « cette unité avance-t-elle mal sous la pluie ? » — sans
 * fabriquer un état de partie. La fiche d'unité du HUD s'en sert : sans elle,
 * elle réécrirait la règle, et les deux dériveraient au premier ajustement.
 */
export function surcoutMeteo(meteo: Meteo, terrain: CleTerrain, mouvement: string): number {
  const horsRoute = terrain !== 'route';
  if (meteo === 'pluie' && mouvement === 'roues' && horsRoute) return 1;
  if (meteo === 'neige' && (mouvement === 'bottes' || mouvement === 'roues')) return 1;
  return 0;
}

/** Facteur de mouvement dû à la météo seule : la tempête bride ce qui vole. */
export function facteurMouvementMeteo(meteo: Meteo, domaine: string): number {
  return meteo === 'tempete' && domaine === 'air' ? 0.5 : 1;
}

/** Facteur de mouvement dû à la tempête : les unités aériennes sont bridées. */
export function facteurMouvementClimat(etat: EtatPartie, domaine: string, camp: CampId = etat.campCourant): number {
  return campAdapteClimat(etat, camp) ? 1 : facteurMouvementMeteo(etat.climat.meteo, domaine);
}

/** La couche climat, écrite comme n'importe quelle mécanique. */
export const MECANIQUE_CLIMAT: Mecanique = {
  cle: 'climat',
  nom: 'Climat',
  parametresParDefaut: {} as Record<string, never>,
  hooks: {
    debutTour(ctx: CtxMecanique): EffetMecanique[] {
      const effets: EffetMecanique[] = [];
      const etat = ctx.etat;
      const saison = effetsSaisonPartie(etat.reglages);
      const canicule = (etat.climat.meteo === 'canicule' && !campAdapteClimat(etat, ctx.camp)) || saison.includes('canicule_saison');
      if (canicule) {
        const lourdes = unitesLourdes(ctx.catalogue);
        if (lourdes.length > 0) {
          effets.push({
            type: 'modificateur',
            duree: 'tour_complet',
            effet: {
              cible: 'toutes_unites',
              filtre: { types: lourdes },
              modificateur: { quoi: 'mouvement', valeur: -1 },
            },
          });
        }
      }
      if (saison.includes('nuits_froides') && etat.climat.phase === 'nuit') {
        effets.push({
          type: 'modificateur',
          duree: 'tour_complet',
          effet: {
            cible: 'toutes_unites',
            filtre: { types: unitesTerrestres(ctx.catalogue) },
            modificateur: { quoi: 'mouvement', valeur: -1 },
          },
        });
      }
      if (ctx.camp === 0) {
        effets.push({ type: 'annonce', texte: bulletin(etat.climat), icone: etat.climat.meteo });
      }
      return effets;
    },

    surAttaque(ctx: CtxMecanique, att: Unite, _def: Unite, degats: number): number {
      const u = ctx.catalogue.unites[att.type];
      if (u && porte(u, 'tir_indirect') && ctx.etat.climat.meteo === 'tempete' && !campAdapteClimat(ctx.etat, att.camp)) {
        return degats * 0.8;
      }
      return degats;
    },

    modifTerrain(ctx: CtxMecanique, _c, terrain: CleTerrain): CleTerrain {
      // `rivieres_gelees` : une rivière est vue comme une plaine, sauf sur une
      // mécanique déclarée `gelable: false` (§12.6, règle 4).
      if (terrain !== 'riviere') return terrain;
      if (!effetsSaisonPartie(ctx.etat.reglages).includes('rivieres_gelees')) return terrain;
      if (ctx.etat.mecanique && ctx.etat.mecanique.gelable === false) return terrain;
      return 'plaine';
    },

    surCoutCase(ctx: CtxMecanique, mouvement, terrain, u) {
      return surcoutClimat(ctx.etat, terrain, mouvement, u.domaine === 'terre' && u.cout >= COUT_UNITE_LOURDE, ctx.camp);
    },
  },
};
