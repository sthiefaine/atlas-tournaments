// Le tour de l'IA dans un Web Worker (23 septembre 2026) : le protocole de
// `ia.worker.ts`, exécuté dans un faux worker du même processus, doit rendre
// **exactement** la suite que l'IA du fil principal choisissait — sur des
// parties réelles du canon, plusieurs camps, plusieurs stratégies, avec des
// pouvoirs et des embarquements. Et partout où le worker faillit, la partie
// doit continuer sur le fil principal sans perdre un tour.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  creerAdversaireEnFond, type AdversaireEnFond, type OptionsAdversaireEnFond, type RaisonRepli,
} from '../../src/app/jeu/adversaire-fond';
import { creerRepondeur, type MessageDepuisIa } from '../../src/app/jeu/ia.worker';
import type { Action, EtatPartie } from '../../src/engine/index';
import type { Mode, StrategieIa } from '../../src/schemas/index';
import {
  adversaireDuFil, FauxWorker, preparerPartie, toursIa, unInstant, type OptionsFaux, type Partie, type TourIa,
} from './aides';

/** L'adversaire en fond d'une partie, branché sur un faux worker qu'on garde sous la main. */
function enFond(
  p: Partie, faux: OptionsFaux = {}, options: OptionsAdversaireEnFond = {},
): { fond: AdversaireEnFond; workers: FauxWorker[]; replis: RaisonRepli[] } {
  const workers: FauxWorker[] = [];
  const replis: RaisonRepli[] = [];
  const fond = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
    creerWorker: () => {
      const w = new FauxWorker(faux);
      workers.push(w);
      return w;
    },
    surRepli: (raison) => { replis.push(raison); },
    ...options,
  });
  return { fond, workers, replis };
}

/**
 * Les tours d'IA d'une partie jouée jusqu'à une journée, gardés pour les tests
 * suivants : jouer treize journées du drone marin prend une seconde et demie,
 * et trois tests en ont besoin. Les états gardés ne sont jamais donnés tels
 * quels à un calcul du fil principal — toujours une copie.
 */
const PARTIES_JOUEES = new Map<string, { p: Partie; tours: TourIa[] }>();
function toursDe(code: string, jusqua: number, mode: Mode = 'normal'): { p: Partie; tours: TourIa[] } {
  const cle = `${code}|${mode}|${jusqua}`;
  let partie = PARTIES_JOUEES.get(cle);
  if (!partie) {
    const p = preparerPartie(code, mode);
    partie = { p, tours: toursIa(p, jusqua) };
    PARTIES_JOUEES.set(cle, partie);
  }
  return partie;
}

/** Un tour d'IA d'une partie courte, pour les cas où un seul suffit. */
function unTour(code = 'demo', jusqua = 2): { p: Partie; tour: TourIa } {
  const { p, tours } = toursDe(code, jusqua);
  const tour = tours.at(-1);
  if (!tour) throw new Error(`aucun tour d'IA dans ${code}`);
  return { p, tour };
}

// ---------------------------------------------------------------------------
// Les mêmes suites, sur des parties réelles
// ---------------------------------------------------------------------------

/**
 * Les parties jouées : la Forge sous brouillard et ses pouvoirs de la faction,
 * les trois IA des Routes, le brouillard à trois camps d'`opus1_fr_04`, le col,
 * le drone marin qui **embarque** à la journée 13 sous la stratégie agressive,
 * la gloutonne d'un tutoriel à trois camps, la défensive du chantier.
 */
const PARTIES: readonly { code: string; mode: Mode; jusqua: number }[] = [
  { code: 'aube_superusine', mode: 'normal', jusqua: 6 },
  { code: 'aube_routes_3v1', mode: 'normal', jusqua: 5 },
  { code: 'opus1_fr_04', mode: 'normal', jusqua: 6 },
  { code: 'pacte_du_col', mode: 'normal', jusqua: 5 },
  { code: 'aube_drone_marin', mode: 'normal', jusqua: 13 },
  { code: 'opus1_tutoriel_08', mode: 'normal', jusqua: 3 },
  { code: 'chantier_des_usines', mode: 'normal', jusqua: 3 },
];

test('le worker rend exactement la suite de l’IA du fil principal, tour après tour, sur des parties réelles', async (t) => {
  const camps = new Set<string>();
  const strategies = new Set<StrategieIa>();
  let pouvoirs = 0;
  let supers = 0;
  let productions = 0;
  let embarquements = 0;
  let compares = 0;
  for (const { code, mode, jusqua } of PARTIES) {
    const { p, tours } = toursDe(code, jusqua, mode);
    assert.ok(tours.length > 0, `${code} : des tours d'IA`);
    // Un seul worker pour toute la partie, comme sur la page.
    const { fond, workers, replis } = enFond(p);
    for (const tour of tours) {
      const obtenu = await fond.adversaire(tour.etat);
      assert.deepEqual(obtenu, tour.attendu, `${code}, journée ${tour.journee}, camp ${tour.camp}`);
      compares += 1;
      camps.add(`${code}:${tour.camp}`);
      strategies.add(tour.strategie);
      if (tour.attendu.some((a) => a.type === 'pouvoir' && a.niveau === 'normal')) pouvoirs += 1;
      if (tour.attendu.some((a) => a.type === 'pouvoir' && a.niveau === 'super')) supers += 1;
      if (tour.attendu.some((a) => a.type === 'produire')) productions += 1;
      if (tour.attendu.some((a) => a.type === 'ordre' && a.suite.type === 'embarquer')) embarquements += 1;
    }
    assert.equal(fond.mode, 'worker', `${code} : jamais de repli (${replis.join(', ')})`);
    assert.equal(workers.length, 1, `${code} : un seul worker par partie`);
    fond.fermer();
  }
  // Ce que ces parties couvrent réellement, pour que le test ne se vide pas en silence.
  t.diagnostic(`${compares} tours comparés, ${pouvoirs} pouvoirs, ${supers} supers, ${productions} avec production, ${embarquements} avec embarquement`);
  // Soixante le 23 septembre 2026 ; la marge laisse vivre le contenu des scénarios.
  assert.ok(compares >= 40, `${compares} tours comparés`);
  assert.ok(pouvoirs >= 1 && supers >= 1, `pouvoirs ${pouvoirs}, supers ${supers}`);
  assert.ok(productions >= 10, `${productions} tours avec production`);
  assert.ok(embarquements >= 1, `${embarquements} tours avec embarquement`);
  for (const s of ['ponderee', 'agressive', 'gloutonne', 'defensive'] as const) assert.ok(strategies.has(s), `stratégie ${s}`);
  for (const c of ['aube_routes_3v1:1', 'aube_routes_3v1:2', 'aube_routes_3v1:3', 'opus1_fr_04:2']) assert.ok(camps.has(c), `camp ${c}`);
});

test('le répondeur du worker : configurer d’abord, puis un tour par demande', async () => {
  const { p, tour } = unTour();
  const repondre = creerRepondeur();
  // Un tour avant la configuration ne se devine pas : il se refuse.
  assert.deepEqual(await repondre({ type: 'tour', id: 1, etat: structuredClone(tour.etat) }),
    { type: 'erreur', id: 1, message: 'adversaire non configuré' });
  assert.equal(await repondre({
    type: 'configurer',
    configuration: {
      strategie: p.strategie, catalogueVersion: p.scenario.catalogueVersion,
      commandants: structuredClone(p.commandants), strategiesParCamp: p.strategiesParCamp,
    },
  }), null);
  const reponse = await repondre({ type: 'tour', id: 7, etat: structuredClone(tour.etat) });
  assert.deepEqual(reponse, { type: 'tour', id: 7, actions: tour.attendu });
  // Ce qui n'est pas du protocole ne reçoit rien.
  assert.equal(await repondre({ type: 'inconnu' } as never), null);
});

test('un état cloné ne perd rien : ni champ absent, ni champ `undefined`, ni flux d’aléa', () => {
  const { tour } = unTour('aube_superusine', 6);
  const copie = structuredClone(tour.etat);
  assert.deepStrictEqual(copie, tour.etat);
  // Le flux d'aléa voyage en données — `graine` et `flux` —, jamais en objet.
  assert.equal(typeof copie.graine, 'string');
  for (const etatFlux of Object.values(copie.flux)) assert.ok(etatFlux.every((n) => Number.isInteger(n)));
  // Et l'état est du JSON pur : ni `Map`, ni `Set`, ni classe, ni fonction.
  const impurs: string[] = [];
  const parcourir = (v: unknown, chemin: string): void => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') impurs.push(chemin);
      return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== Array.prototype) impurs.push(chemin);
    for (const [k, x] of Object.entries(v)) parcourir(x, `${chemin}.${k}`);
  };
  parcourir(tour.etat, 'etat');
  assert.deepEqual(impurs, []);
});

// ---------------------------------------------------------------------------
// Le repli sur le fil principal
// ---------------------------------------------------------------------------

test('sans `Worker`, l’IA joue sur le fil principal, sans promesse, sur une copie', () => {
  const { p, tour } = unTour();
  assert.equal(typeof (globalThis as { Worker?: unknown }).Worker, 'undefined', 'Node n’a pas de Worker global');
  const replis: RaisonRepli[] = [];
  const fond = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
    surRepli: (r) => { replis.push(r); },
  });
  assert.equal(fond.mode, 'fil');
  assert.equal(fond.raisonRepli, 'sans_worker');
  assert.deepEqual(replis, ['sans_worker']);
  const avant = JSON.stringify(tour.etat);
  const reponse = fond.adversaire(tour.etat);
  // Synchrone : le chef d'orchestre joue le premier ordre dans le même tour d'horloge.
  assert.ok(Array.isArray(reponse));
  assert.deepEqual(reponse, tour.attendu);
  assert.equal(JSON.stringify(tour.etat), avant, 'l’état donné n’est jamais écrit');
});

test('une fabrique de worker qui lève : repli immédiat', () => {
  const { p, tour } = unTour();
  const fond = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
    creerWorker: () => { throw new Error('worker-src refusé'); },
    surRepli: () => undefined,
  });
  assert.equal(fond.mode, 'fil');
  assert.equal(fond.raisonRepli, 'creation');
  assert.deepEqual(fond.adversaire(tour.etat), tour.attendu);
});

test('un worker qui lève au chargement : la demande en cours est rendue par le fil principal', async () => {
  const { p, tour } = unTour();
  const { fond, workers, replis } = enFond(p, { demarrage: 'erreur' });
  const obtenu = await fond.adversaire(tour.etat);
  assert.deepEqual(obtenu, tour.attendu);
  assert.equal(fond.mode, 'fil');
  assert.deepEqual(replis, ['erreur']);
  assert.equal(workers[0]!.terminaisons, 1, 'le worker est arrêté');
  // Les demandes suivantes restent sur le fil principal, sans promesse.
  assert.ok(Array.isArray(fond.adversaire(tour.etat)));
  assert.equal(workers.length, 1, 'aucun second worker');
});

test('un worker qui répond « erreur » : repli, et la même suite', async () => {
  const { p, tour } = unTour();
  const { fond, replis } = enFond(p, {
    sortie: (m) => (m.type === 'tour' ? [{ type: 'erreur', id: m.id, message: 'RangeError: pile pleine' }] : [m]),
  });
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  assert.deepEqual(replis, ['erreur']);
});

test('un worker qui ne se déclare jamais prêt : repli au bout du délai, sans rien lui avoir envoyé', async () => {
  const { p, tour } = unTour();
  const { fond, workers, replis } = enFond(p, { demarrage: 'jamais' }, { msDemarrage: 30 });
  const t0 = Date.now();
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  assert.ok(Date.now() - t0 >= 25, 'le délai est tenu avant de renoncer');
  assert.deepEqual(replis, ['demarrage']);
  assert.deepEqual(workers[0]!.envoyes, [], 'rien ne part avant « prêt »');
});

test('un worker prêt qui se tait : le chien de garde rend la main au fil principal', async () => {
  const { p, tour } = unTour();
  const { fond, replis } = enFond(p, { sortie: (m) => (m.type === 'tour' ? [] : [m]) }, { msSilence: 40 });
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  assert.deepEqual(replis, ['silence']);
});

test('un worker qui répond bien ne déclenche aucun chien de garde, même lent à charger', async () => {
  const { p, tour } = unTour();
  // Le module écoute au bout de 20 ms : un message envoyé avant serait perdu.
  const { fond, workers, replis } = enFond(p, { msChargement: 20 }, { msSilence: 5_000, msDemarrage: 5_000 });
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  assert.equal(fond.mode, 'worker');
  assert.deepEqual(replis, []);
  assert.equal(workers[0]!.perdus, 0, 'aucun message n’est parti avant que le worker écoute');
  assert.deepEqual(workers[0]!.envoyes.map((m) => m.type), ['configurer', 'tour', 'tour']);
  fond.fermer();
});

// ---------------------------------------------------------------------------
// Les réponses périmées, et la fermeture
// ---------------------------------------------------------------------------

test('une réponse en double ou d’une demande inconnue est ignorée', async () => {
  const { p, tour } = unTour();
  const { fond, replis } = enFond(p, {
    sortie: (m): MessageDepuisIa[] => (m.type === 'tour'
      ? [m, m, { type: 'tour', id: 999, actions: [{ type: 'finTour' }] }]
      : [m]),
  });
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu);
  await unInstant();
  assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu, 'la réponse suivante est la bonne, pas le doublon');
  assert.equal(fond.mode, 'worker');
  assert.deepEqual(replis, []);
  fond.fermer();
});

test('fermer : les demandes en cours rendent une suite vide, les réponses tardives sont ignorées, et c’est idempotent', async () => {
  const { p, tour } = unTour();
  const { fond, workers } = enFond(p, { msChargement: 15 });
  const enCours = fond.adversaire(tour.etat);
  fond.fermer();
  fond.fermer();
  assert.deepEqual(await enCours, []);
  assert.equal(fond.mode, 'ferme');
  assert.equal(workers[0]!.terminaisons, 1, 'arrêté une fois');
  // Le module du faux worker aurait écouté ici, et répondu : plus personne n'écoute.
  await unInstant(30);
  assert.deepEqual(fond.adversaire(tour.etat), [], 'un adversaire fermé ne joue plus');
  assert.equal(workers.length, 1);
});

test('plusieurs demandes en file : chacune reçoit sa propre suite, dans l’ordre', async () => {
  const { p, tours } = toursDe('aube_routes_3v1', 2);
  const { fond } = enFond(p);
  const reponses = await Promise.all(tours.map((t) => fond.adversaire(t.etat)));
  assert.deepEqual(reponses, tours.map((t) => t.attendu));
  fond.fermer();
});

// ---------------------------------------------------------------------------
// L'état donné à l'IA n'est jamais écrit
// ---------------------------------------------------------------------------

/** Le tour du drone marin où l'IA agressive embarque dans un transport vide. */
function tourQuiEmbarque(): { p: Partie; tour: TourIa } {
  const { p, tours } = toursDe('aube_drone_marin', 13);
  const tour = tours.find((t) => t.attendu.some((a) => a.type === 'ordre' && a.suite.type === 'embarquer'));
  if (!tour) throw new Error('aucun tour qui embarque');
  return { p, tour };
}

test('l’IA du fil principal n’écrit plus dans l’état qu’on lui donne, même quand elle embarque dans un transport vide', () => {
  // Le 23 septembre 2026, ce test constatait le défaut : le moteur partageait
  // le `cargo` vide d'un transport entre deux états et y poussait le passager,
  // si bien que l'IA posait le passager dans l'état de la page avant que
  // l'ordre soit joué. L'embarquement écrit désormais un tableau neuf
  // (`engine/actions.ts`) : le test garde la correction. `copiePourIa` reste,
  // pour ne pas dépendre d'un seul endroit du moteur.
  const { p, tour } = tourQuiEmbarque();
  const vivant = structuredClone(tour.etat);
  const avant = JSON.stringify(vivant);
  const suite = adversaireDuFil(p)(vivant);
  assert.deepEqual(suite, tour.attendu, 'la suite ne dépend pas de l’objet');
  assert.equal(JSON.stringify(vivant), avant, 'l’état donné reste intact');
});

test('l’adversaire en fond n’écrit jamais dans l’état de la partie, par le worker comme par le repli', async () => {
  const { p, tour } = tourQuiEmbarque();
  const avant = JSON.stringify(tour.etat);
  const { fond } = enFond(p);
  const parWorker: Action[] = await fond.adversaire(tour.etat);
  assert.deepEqual(parWorker, tour.attendu);
  assert.equal(JSON.stringify(tour.etat), avant, 'le worker calcule sur sa copie');
  fond.fermer();

  const repli = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
    creerWorker: () => null, surRepli: () => undefined,
  });
  const etat: EtatPartie = tour.etat;
  assert.deepEqual(repli.adversaire(etat), tour.attendu);
  assert.equal(JSON.stringify(tour.etat), avant, 'le repli aussi');
});
