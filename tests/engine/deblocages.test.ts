// Les déblocages : conditions composables, dates, modes, généraux secrets
// (`doc/13-campagne.md` §8). Le moteur ne lit jamais l'horloge : la date du jour
// arrive par le contexte, jamais par `Date.now()`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  commandantJouable, deblocagesAcquis, deblocagesNouveaux, evaluerCondition,
  type ContexteDeblocage,
} from '../../src/engine/deblocages';
import type { Condition, Deblocage, ProfilCampagne } from '../../src/schemas/index';

const LE_JOUR: ContexteDeblocage = { aujourdhui: '2026-09-05' };

/** Un profil de référence : deux booléens, deux compteurs, trois pays, un secret. */
function profil(surcharge: Partial<ProfilCampagne> = {}): ProfilCampagne {
  return {
    cle: 'profil_test',
    paysDepart: 'fr',
    mode: 'normal',
    flags: {
      booleens: { 'pays.fr.tour_complet': true, 'monde.cinquieme.contact': true },
      compteurs: { 'monde.atlas.soupcon': 4, 'monde.regie.faveur': -1 },
      journal: [],
    },
    deblocages: [],
    filsEnCours: [],
    filsFinis: [],
    scenariosFinis: [],
    secretsTrouves: ['mur_du_vestiaire'],
    paysVisites: ['fr', 'lu', 'ch'],
    modesFinis: ['normal'],
    relations: { lu: 'alliee', ch: 'rivale', gr: 'retiree' },
    confiance: { cmd_elsbeth_vonlanthen: 2, cmd_yann_reinert: 3 },
    serieDepeches: 3,
    catalogueVersion: 1,
    chainesVersion: 1,
    creeLe: '2026-09-01',
    majLe: '2026-09-05',
    ...surcharge,
  };
}

test('un flag booléen posé satisfait sa condition, un flag absent non', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'flag', cle: 'pays.fr.tour_complet' }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'flag', cle: 'pays.fr.barrage_rompu' }, p, LE_JOUR), false);
});

test('un compteur absent vaut zéro, jamais indéfini', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'compteur', cle: 'monde.atlas.soupcon', min: 4 }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'compteur', cle: 'monde.atlas.soupcon', min: 5 }, p, LE_JOUR), false);
  assert.equal(evaluerCondition({ type: 'compteur', cle: 'monde.public.ferveur', min: 1 }, p, LE_JOUR), false);
});

test('une relation négative ne franchit aucun seuil positif', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'compteur', cle: 'monde.regie.faveur', min: 1 }, p, LE_JOUR), false);
});

test('mode_fini lit les modes achevés, pas le mode courant', () => {
  const p = profil({ mode: 'difficile', modesFinis: ['normal'] });
  assert.equal(evaluerCondition({ type: 'mode_fini', mode: 'normal' }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'mode_fini', mode: 'difficile' }, p, LE_JOUR), false);
});

test('une fenêtre de dates est bornée des deux côtés, bornes incluses', () => {
  const p = profil();
  const avril: Condition = { type: 'date', du: '2026-04-01', au: '2026-04-01' };
  assert.equal(evaluerCondition(avril, p, { aujourdhui: '2026-04-01' }), true);
  assert.equal(evaluerCondition(avril, p, { aujourdhui: '2026-03-31' }), false);
  assert.equal(evaluerCondition(avril, p, { aujourdhui: '2026-04-02' }), false);
  assert.equal(evaluerCondition({ type: 'date', du: '2026-01-01' }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'date', au: '2026-01-01' }, p, LE_JOUR), false);
});

test('la même condition de date donne deux réponses à deux jours différents', () => {
  const p = profil();
  const noel: Condition = { type: 'date', du: '2026-12-24', au: '2026-12-26' };
  assert.equal(evaluerCondition(noel, p, { aujourdhui: '2026-12-25' }), true);
  assert.equal(evaluerCondition(noel, p, { aujourdhui: '2026-09-05' }), false);
});

test('pays_visite compte les pays de la liste effectivement visités', () => {
  const p = profil();
  const trois: Condition = { type: 'pays_visite', pays: ['fr', 'lu', 'ch', 'jp'], combien: 3 };
  assert.equal(evaluerCondition(trois, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ ...trois, combien: 4 }, p, LE_JOUR), false);
  assert.equal(evaluerCondition({ type: 'pays_visite', pays: ['jp', 'br'], combien: 1 }, p, LE_JOUR), false);
});

test('relation lit l\'état d\'une nation, et une nation absente est neutre', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'relation', pays: ['lu'], relation: 'alliee', combien: 1 }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'relation', pays: ['ch'], relation: 'alliee', combien: 1 }, p, LE_JOUR), false);
  assert.equal(evaluerCondition({ type: 'relation', pays: ['gr'], relation: 'retiree', combien: 1 }, p, LE_JOUR), true);
  // `jp` n'est pas dans `relations` : le Japon est neutre, il n'est pas indéfini.
  assert.equal(evaluerCondition({ type: 'relation', pays: ['jp'], relation: 'neutre', combien: 1 }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'relation', pays: ['jp'], relation: 'alliee', combien: 1 }, p, LE_JOUR), false);
});

test('la borne « au moins deux alliées » se lit comme une seule condition', () => {
  const uneSeule = profil();
  const deux = profil({ relations: { lu: 'alliee', jp: 'alliee', ch: 'rivale' } });
  const borne: Condition = {
    type: 'relation', pays: ['lu', 'ch', 'gr', 'jp', 'br'], relation: 'alliee', combien: 2,
  };
  assert.equal(evaluerCondition(borne, uneSeule, LE_JOUR), false);
  assert.equal(evaluerCondition(borne, deux, LE_JOUR), true);
});

test('une nation alliée ouvre son départ de Nouvelle Ronde', () => {
  const departJapon: Deblocage = {
    cle: 'deb_depart_jp',
    libelle: 'Le Japon comme pays de départ',
    condition: { type: 'relation', pays: ['jp'], relation: 'alliee', combien: 1 },
    recompense: { type: 'depart_nation', ref: 'jp' },
    cache: false,
  };
  assert.deepEqual(deblocagesAcquis(profil(), [departJapon], LE_JOUR), []);
  const allie = profil({ relations: { jp: 'alliee' } });
  assert.deepEqual(deblocagesAcquis(allie, [departJapon], LE_JOUR), ['deb_depart_jp']);
});

test('la confiance d’un général absent vaut zéro, jamais indéfini', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'confiance', commandantCle: 'cmd_elsbeth_vonlanthen', min: 2 }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'confiance', commandantCle: 'cmd_elsbeth_vonlanthen', min: 3 }, p, LE_JOUR), false);
  // Un général jamais incarné : zéro, et aucun seuil franchi.
  assert.equal(evaluerCondition({ type: 'confiance', commandantCle: 'cmd_maelle_kerdraon', min: 1 }, p, LE_JOUR), false);
});

test('un profil écrit avant l’incarnation reste lisible', () => {
  // Le champ `confiance` peut manquer : la condition est fausse, pas une exception.
  const ancien = profil();
  delete (ancien as Partial<ProfilCampagne>).confiance;
  assert.equal(evaluerCondition({ type: 'confiance', commandantCle: 'cmd_yann_reinert', min: 1 }, ancien, LE_JOUR), false);
});

test('une confiance de trois ouvre le départ de Nouvelle Ronde comme une alliance', () => {
  // Rallier et incarner sont deux chemins vers la même porte (`13-campagne.md` §3.5).
  const departSuisse: Deblocage = {
    cle: 'deb_depart_ch',
    libelle: 'La Suisse comme pays de départ',
    condition: {
      type: 'ou',
      conditions: [
        { type: 'relation', pays: ['ch'], relation: 'alliee', combien: 1 },
        { type: 'confiance', commandantCle: 'cmd_elsbeth_vonlanthen', min: 3 },
      ],
    },
    recompense: { type: 'depart_nation', ref: 'ch' },
    cache: false,
  };
  assert.deepEqual(deblocagesAcquis(profil(), [departSuisse], LE_JOUR), []);
  const confiant = profil({ confiance: { cmd_elsbeth_vonlanthen: 3 } });
  assert.deepEqual(deblocagesAcquis(confiant, [departSuisse], LE_JOUR), ['deb_depart_ch']);
});

test('un secret trouvé satisfait sa condition', () => {
  const p = profil();
  assert.equal(evaluerCondition({ type: 'secret', cle: 'mur_du_vestiaire' }, p, LE_JOUR), true);
  assert.equal(evaluerCondition({ type: 'secret', cle: 'quatre_traits' }, p, LE_JOUR), false);
});

test('et et ou se composent sur trois niveaux', () => {
  const p = profil();
  const composee: Condition = {
    type: 'et',
    conditions: [
      { type: 'compteur', cle: 'monde.atlas.soupcon', min: 4 },
      {
        type: 'ou',
        conditions: [
          { type: 'flag', cle: 'monde.cinquieme.demasquee' },
          { type: 'et', conditions: [
            { type: 'secret', cle: 'mur_du_vestiaire' },
            { type: 'pays_visite', pays: ['fr', 'lu'], combien: 2 },
          ] },
        ],
      },
    ],
  };
  assert.equal(evaluerCondition(composee, p, LE_JOUR), true);
  // Le secret retiré, la branche interne tombe, et le `ou` avec elle.
  assert.equal(evaluerCondition(composee, profil({ secretsTrouves: [] }), LE_JOUR), false);
});

test('une condition de type inconnu est fausse, jamais une exception', () => {
  const p = profil();
  const inconnue = { type: 'astrologie', signe: 'balance' } as unknown as Condition;
  assert.equal(evaluerCondition(inconnue, p, LE_JOUR), false);
});

test('évaluer une condition ne modifie jamais le profil', () => {
  const p = profil();
  const avant = JSON.stringify(p);
  evaluerCondition({ type: 'compteur', cle: 'monde.public.ferveur', min: 3 }, p, LE_JOUR);
  evaluerCondition({ type: 'secret', cle: 'inexistant' }, p, LE_JOUR);
  assert.equal(JSON.stringify(p), avant);
});

const CATALOGUE: Deblocage[] = [
  {
    cle: 'deb_nera_aldouin',
    libelle: 'Nera Aldouin, arbitre en chef',
    condition: { type: 'et', conditions: [
      { type: 'flag', cle: 'monde.atlas.arbitre_alliee' },
      { type: 'compteur', cle: 'monde.carnet.pages_scellees', min: 3 },
    ] },
    recompense: { type: 'general_secret', ref: 'cmd_nera_aldouin' },
    cache: true,
  },
  {
    cle: 'deb_numero_six',
    libelle: 'Numéro Six, sans-drapeau',
    condition: { type: 'mode_fini', mode: 'difficile' },
    recompense: { type: 'general_secret', ref: 'cmd_numero_six' },
    cache: false,
  },
  {
    cle: 'deb_craie',
    libelle: 'Craie',
    condition: { type: 'secret', cle: 'mur_du_vestiaire' },
    recompense: { type: 'general_secret', ref: 'cmd_craie' },
    cache: true,
  },
];

test('deblocagesAcquis rend les clés satisfaites, dans l’ordre du catalogue', () => {
  assert.deepEqual(deblocagesAcquis(profil(), CATALOGUE, LE_JOUR), ['deb_craie']);
  const complet = profil({
    flags: {
      booleens: { 'monde.atlas.arbitre_alliee': true },
      compteurs: { 'monde.carnet.pages_scellees': 3 },
      journal: [],
    },
    modesFinis: ['normal', 'difficile'],
  });
  assert.deepEqual(deblocagesAcquis(complet, CATALOGUE, LE_JOUR),
    ['deb_nera_aldouin', 'deb_numero_six', 'deb_craie']);
});

test('deblocagesNouveaux retranche ce que le profil connaît déjà', () => {
  const p = profil({ deblocages: ['deb_craie'] });
  assert.deepEqual(deblocagesNouveaux(p, CATALOGUE, LE_JOUR), []);
  const q = profil({ deblocages: [], modesFinis: ['difficile'] });
  assert.deepEqual(deblocagesNouveaux(q, CATALOGUE, LE_JOUR), ['deb_numero_six', 'deb_craie']);
});

test('un général secret n’est jouable qu’une fois son déblocage acquis', () => {
  const secret = { secret: true, deblocage: 'deb_craie' };
  assert.equal(commandantJouable(secret, profil()), false);
  assert.equal(commandantJouable(secret, profil({ deblocages: ['deb_craie'] })), true);
  assert.equal(commandantJouable({}, profil()), true);
  // Un commandant marqué secret sans déblocage resterait injouable pour toujours :
  // `validerCommander` le refuse, et le moteur ne le laisse pas passer non plus.
  assert.equal(commandantJouable({ secret: true }, profil({ deblocages: ['deb_craie'] })), false);
});
