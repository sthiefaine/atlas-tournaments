/**
 * La routine contrôle, côté serveur : les seuils et le verdict.
 *
 * Ce fichier ne fait tourner **aucune** partie — il fabrique des statistiques et
 * vérifie que chaque seuil de `doc/05-routines.md` §4.3 produit exactement le
 * motif attendu, avec le bon code et la bonne mesure. La campagne réelle est
 * testée dans `controle-simulation.test.ts`, qui est plus lent.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GRAVITE_MOTIF, ordonnerMotifs, rendreVerdict, SEUILS_CONTROLE,
} from '../../src/serveur/controle/index';
import type { ResultatSimulation } from '../../src/serveur/simulation';
import { validerReviewVerdict } from '../../src/schemas/index';
import { MOTIFS_REJET, type MotifRejet, type StatsSimulation } from '../../src/schemas/index';

/** Un `StatsSimulation` plausible, que chaque cas vient déformer sur un point. */
function stats(patch: Partial<StatsSimulation> = {}): StatsSimulation {
  const parties = patch.parties ?? 30;
  return {
    parties,
    strategie: 'ponderee vs agressive',
    graines: Array.from({ length: parties }, (_, i) => `g${i}`),
    victoiresCamp: [15, 15],
    nonTerminees: 0,
    journeesMediane: 20,
    journeesEcartType: 3.2,
    fondsMoyenParCamp: [30000, 30000],
    casesJamaisVisitees: 4,
    mecaniqueDeclenchee: null,
    climat: { saison: 'ete', meteo: 'tiree', phase: 'cycle' },
    dureeMoyenneMs: 120,
    ...patch,
  };
}

/** Une campagne fabriquée : l'agrégat, ses conditions, ses mesures hors schéma. */
function campagne(
  patch: Partial<StatsSimulation> = {},
  horsSchema: Record<string, number> = {},
  parCondition: ResultatSimulation['parCondition'] = [],
): ResultatSimulation {
  return {
    simulationId: 'sim_test',
    dureeCalculMs: 1000,
    stats: stats(patch),
    conditionsEcartees: [],
    parCondition: parCondition.length > 0 ? parCondition : [
      {
        condition: { saison: 'ete', meteo: 'clair', phase: 'jour' },
        stats: stats(patch),
        horsSchema: { non_terminees: 0, journees_sans_contact: 3 },
      },
    ],
    horsSchema: { victoires_camp_1: 0.5, non_terminees: 0, part_cases_jamais_visitees: 0.02, ...horsSchema },
  };
}

/** Les codes du verdict rendu sur une carte. */
function codes(r: ResultatSimulation, dureeVisee?: [number, number]): MotifRejet[] {
  const v = rendreVerdict(
    { type: 'carte', cle: 'carte_test', version: 1, ...(dureeVisee ? { dureeVisee } : {}) }, r,
  );
  return v.motifs.map((m) => m.code);
}

test('une campagne dans les clous rend un verdict validé, sans motif', () => {
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test' }, campagne());
  assert.equal(v.verdict, 'valide');
  assert.deepEqual(v.motifs, []);
  assert.equal(v.cibleType, 'carte');
  assert.equal(v.cibleCle, 'carte_test');
  const r = validerReviewVerdict(v);
  assert.ok(r.ok, `verdict non conforme : ${JSON.stringify(r.ok ? [] : r.erreurs)}`);
});

test('avantage_premier_joueur se déclenche hors de [0,40 ; 0,60], des deux côtés', () => {
  assert.ok(codes(campagne({ victoiresCamp: [19, 11] }, { victoires_camp_1: 0.6333 }))
    .includes('avantage_premier_joueur'));
  assert.ok(codes(campagne({ victoiresCamp: [10, 20] }, { victoires_camp_1: 0.3333 }))
    .includes('avantage_premier_joueur'));
  // Les bornes elles-mêmes passent : 0,40 et 0,60 sont dedans.
  assert.ok(!codes(campagne({ victoiresCamp: [18, 12] })).includes('avantage_premier_joueur'));
  assert.ok(!codes(campagne({ victoiresCamp: [12, 18] })).includes('avantage_premier_joueur'));
});

test('la mesure d’avantage_premier_joueur porte le taux et le nombre de parties', () => {
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test' }, campagne({ victoiresCamp: [21, 9] }));
  const motif = v.motifs.find((m) => m.code === 'avantage_premier_joueur');
  assert.ok(motif, 'motif attendu');
  assert.equal(motif.mesure?.['victoires_camp_1'], 0.7);
  assert.equal(motif.mesure?.['parties'], 30);
});

test('trop_de_parties_non_terminees se déclenche au-delà de 20 % de parties sans résultat', () => {
  assert.ok(codes(campagne({ nonTerminees: 7 })).includes('trop_de_parties_non_terminees'));
  assert.ok(!codes(campagne({ nonTerminees: 6 })).includes('trop_de_parties_non_terminees'));
});

test('la durée hors bornes produit partie_trop_courte ou partie_trop_longue', () => {
  assert.ok(codes(campagne({ journeesMediane: 5 })).includes('partie_trop_courte'));
  assert.ok(codes(campagne({ journeesMediane: 60 })).includes('partie_trop_longue'));
  // L'intention de niveau l'emporte sur les bornes par défaut.
  assert.ok(codes(campagne({ journeesMediane: 30 }), [14, 22]).includes('partie_trop_longue'));
  assert.ok(!codes(campagne({ journeesMediane: 18 }), [14, 22]).includes('partie_trop_longue'));
});

test('mecanique_inutilisee ne se déclenche que si la carte déclare une mécanique', () => {
  assert.ok(codes(campagne({ mecaniqueDeclenchee: 10 })).includes('mecanique_inutilisee'));
  assert.ok(!codes(campagne({ mecaniqueDeclenchee: 20 })).includes('mecanique_inutilisee'));
  assert.ok(!codes(campagne({ mecaniqueDeclenchee: null })).includes('mecanique_inutilisee'));
});

test('zone_morte se déclenche au-delà d’un quart de la terre jamais visitée', () => {
  assert.ok(codes(campagne({}, { part_cases_jamais_visitees: 0.3 })).includes('zone_morte'));
  assert.ok(!codes(campagne({}, { part_cases_jamais_visitees: 0.25 })).includes('zone_morte'));
});

test('injouable_sous_meteo retient la pire condition et porte sa mesure', () => {
  const r = campagne({}, {}, [
    {
      condition: { saison: 'ete', meteo: 'clair', phase: 'jour' },
      stats: stats(), horsSchema: { non_terminees: 0.1, journees_sans_contact: 3 },
    },
    {
      condition: { saison: 'hiver', meteo: 'tempete', phase: 'jour' },
      stats: stats(), horsSchema: { non_terminees: 0.34, journees_sans_contact: 7 },
    },
  ]);
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test' }, r);
  const motif = v.motifs.find((m) => m.code === 'injouable_sous_meteo');
  assert.ok(motif, 'motif climatique attendu');
  assert.equal(motif.mesure?.['non_terminees'], 0.34);
  assert.equal(motif.mesure?.['journees_sans_contact'], 7);
  assert.match(motif.detail ?? '', /hiver \/ tempete \/ jour/);
});

test('nuit_bloquante ne vise que les conditions de phase nuit', () => {
  const nuit = campagne({}, {}, [
    {
      condition: { saison: 'automne', meteo: 'brouillard', phase: 'nuit' },
      stats: stats(), horsSchema: { non_terminees: 0.22, journees_sans_contact: 6 },
    },
  ]);
  assert.ok(codes(nuit).includes('nuit_bloquante'));
  const jour = campagne({}, {}, [
    {
      condition: { saison: 'automne', meteo: 'brouillard', phase: 'jour' },
      stats: stats(), horsSchema: { non_terminees: 0.22, journees_sans_contact: 6 },
    },
  ]);
  assert.ok(!codes(jour).includes('nuit_bloquante'));
});

test('une campagne absente sur une carte donne simulation_plantee', () => {
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test' }, null);
  assert.deepEqual(v.motifs.map((m) => m.code), ['simulation_plantee']);
  assert.equal(v.verdict, 'rejete');
});

test('les vérifications structurelles entrent telles quelles dans le verdict', () => {
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test' }, campagne(), [
    { code: 'qg_inaccessible', detail: 'aucun chemin terrestre entre les QG', mesure: { paires_isolees: 1 } },
  ]);
  assert.equal(v.verdict, 'rejete');
  assert.equal(v.motifs[0]?.code, 'qg_inaccessible');
  assert.equal(v.motifs[0]?.mesure?.['paires_isolees'], 1);
});

test('les motifs sont dédoublonnés, triés par gravité et coupés à six', () => {
  const ordonnes = ordonnerMotifs([
    { code: 'zone_morte' }, { code: 'mecanique_inutilisee' }, { code: 'qg_inaccessible' },
    { code: 'zone_morte' }, { code: 'partie_trop_longue' }, { code: 'desequilibre_fonds' },
    { code: 'avantage_premier_joueur' }, { code: 'redite_commandant' },
  ]);
  assert.equal(ordonnes.length, 6);
  assert.deepEqual(ordonnes.slice(0, 3).map((m) => m.code),
    ['qg_inaccessible', 'desequilibre_fonds', 'avantage_premier_joueur']);
  assert.equal(new Set(ordonnes.map((m) => m.code)).size, 6);
});

test('le catalogue de gravités couvre exactement l’énumération MotifRejet', () => {
  assert.deepEqual(Object.keys(GRAVITE_MOTIF).sort(), [...MOTIFS_REJET].sort());
});

test('un verdict rejeté reste conforme au schéma, motifs et mesures compris', () => {
  const v = rendreVerdict({ type: 'carte', cle: 'carte_test', version: 2 },
    campagne({ victoiresCamp: [22, 8], nonTerminees: 9, journeesMediane: 60 },
      { part_cases_jamais_visitees: 0.4 }));
  const r = validerReviewVerdict(v);
  assert.ok(r.ok, `verdict non conforme : ${JSON.stringify(r.ok ? [] : r.erreurs)}`);
  assert.equal(v.verdict, 'rejete');
  assert.ok(v.motifs.every((m) => m.mesure && Object.keys(m.mesure).length > 0),
    'chaque motif porte la mesure qui l’a déclenché (§4.5)');
  assert.ok(v.suggestions.length > 0 && v.suggestions.length <= 3);
});

test('les seuils publiés sont ceux du document, pas des valeurs de circonstance', () => {
  assert.deepEqual(SEUILS_CONTROLE.avantagePremierJoueur, { min: 0.4, max: 0.6 });
  assert.equal(SEUILS_CONTROLE.nonTermineesMax, 0.2);
  assert.equal(SEUILS_CONTROLE.nonTermineesSousMeteoMax, 0.25);
  assert.equal(SEUILS_CONTROLE.mecaniqueMin, 0.6);
  assert.equal(SEUILS_CONTROLE.uniteDominanteVictoire, 0.6);
  assert.equal(SEUILS_CONTROLE.uniteDominanteEfficacite, 1.3);
  assert.equal(SEUILS_CONTROLE.uniteInutileFrequence, 0.1);
  assert.equal(SEUILS_CONTROLE.uniteInutileEcart, 0.02);
});
