// Le catalogue 5 dans le moteur : la mer se navigue, le port ravitaille et
// produit, le sous-marin ne se voit qu'au contact (`04-gameplay.md` §10 quater).
//
// Rien de tout cela n'est une exception codée : ce sont le terrain `port`, le
// coût `mer` et le trait `plongee` qui portent la règle. Ces tests le vérifient
// en lisant le catalogue, jamais en nommant une unité au moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquer, cacheeAuContact, casesVisibles, chargerCatalogue, cleCase, coutEntree, creerPartie,
  portee, produitesPar, ravitailleCetteUnite, seuilCapture, SEUIL_CAPTURE, unitesVues,
  verifierProduction, coutVers, type Action,
} from '../../src/engine/index';
import { scenePersonnalisee } from './aides';

const CAT4 = chargerCatalogue(4);
const CAT5 = chargerCatalogue(5);

/** Une rade : une bande de mer, un quai, et de la terre derrière. */
const RADE = [
  'WWWWWWWWWW',
  'WWWWWWWWWW',
  'OSPPHPPPPP',
  'PPPPPPPPPH',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

test('le catalogue 4 ignore les neuf unités du 5, le 5 les porte toutes', () => {
  for (const cle of ['barge', 'bombardier', 'chasseur', 'cuirasse', 'missiles_air',
    'missiles_sol', 'porte_avions', 'sous_marin', 'transport_air']) {
    assert.equal(CAT4.unites[cle], undefined, `catalogue 4 : ${cle} ne devrait pas exister`);
    assert.ok(CAT5.unites[cle], `catalogue 5 : ${cle} manque`);
  }
  assert.equal(CAT4.cles.length, 14);
  assert.equal(CAT5.cles.length, 23);
});

test('une coque navigue la mer et le port, et rien d’autre', () => {
  const scene = scenePersonnalisee(RADE, { '0,2': 0 }, [{ camp: 0, type: 'barge', x: 0, y: 0 }]);
  const e = creerPartie(scene, CAT5, 'rade');
  const barge = e.unites[0]!;
  assert.equal(coutEntree(e, CAT5, barge, { x: 1, y: 0 }), 1, 'la mer se franchit');
  assert.equal(coutEntree(e, CAT5, barge, { x: 0, y: 2 }), 1, 'le port se franchit');
  assert.equal(coutEntree(e, CAT5, barge, { x: 1, y: 2 }), null, 'une barge ne monte pas sur la plage');
  assert.equal(coutEntree(e, CAT5, barge, { x: 2, y: 2 }), null, 'ni sur la plaine');
  // La portée de déplacement en découle sans une ligne de code de plus.
  const p = portee(e, CAT5, barge);
  assert.notEqual(coutVers(p, { x: 0, y: 2 }), null);
  assert.equal(coutVers(p, { x: 2, y: 2 }), null);
});

test('le port produit les quatre navires et rien que sur ses fonds', () => {
  assert.deepEqual([...produitesPar(CAT5, 'port')].sort(),
    ['barge', 'cuirasse', 'porte_avions', 'sous_marin']);
  // Au catalogue 4, le même terrain ne produit rien : une version d'accueil
  // n'ouvre jamais rétroactivement une usine.
  assert.deepEqual(produitesPar(CAT4, 'port'), []);
  const scene = scenePersonnalisee(RADE, { '0,2': 0 }, [], { fondsDepart: 30000 });
  const e = creerPartie(scene, CAT5, 'quai');
  const quai = { x: 0, y: 2 };
  assert.equal(verifierProduction(e, CAT5, 0, quai, 'barge').ok, true);
  assert.equal(verifierProduction(e, CAT5, 0, quai, 'porte_avions').ok, true);
  const refus = verifierProduction(e, CAT5, 0, quai, 'char_leger');
  assert.equal(refus.ok, false);
  if (!refus.ok) assert.equal(refus.motif, 'unite_non_produite_ici');
});

test('une coque ne se ravitaille qu’à quai', () => {
  assert.equal(ravitailleCetteUnite(CAT5, 'port', 'mer'), true);
  for (const terrain of ['ville', 'usine', 'qg', 'aeroport'] as const) {
    assert.equal(ravitailleCetteUnite(CAT5, terrain, 'mer'), false, terrain);
  }
  // Le port n'est pas un aéroport de secours, et il reste bon pour le sol.
  assert.equal(ravitailleCetteUnite(CAT5, 'port', 'air'), false);
  assert.equal(ravitailleCetteUnite(CAT5, 'port', 'terre'), false);
  assert.equal(ravitailleCetteUnite(CAT5, 'ville', 'air'), true);
});

test('un port se capture comme une ville, au même seuil', () => {
  const scene = scenePersonnalisee(RADE, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 2 },
    // Un adversaire à l'autre bout, sans quoi la partie s'achève au premier tour.
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  let e = creerPartie(scene, CAT5, 'prise');
  const capturer: Action = { type: 'ordre', uniteId: 'u1', chemin: [{ x: 0, y: 2 }], suite: { type: 'capturer' } };
  // Vingt points, donc deux tours d'une infanterie intacte (§6) : le port n'a
  // pas le seuil doublé du QG ni celui d'un bâtiment désaffecté.
  const actions: Action[] = [capturer, { type: 'finTour' }, { type: 'finTour' }, capturer];
  for (const a of actions) {
    const r = appliquer(e, a, CAT5);
    assert.ok(r.ok, `action refusée : ${JSON.stringify(a)} → ${r.ok ? '' : r.motif}`);
    if (!r.ok) return;
    e = r.etat;
  }
  assert.equal(e.proprietaires[cleCase({ x: 0, y: 2 })], 0);
  assert.equal(seuilCapture(e, CAT5, { x: 0, y: 2 }), SEUIL_CAPTURE);
});

test('le trait plongee cache la coque partout, et le contact la trouve', () => {
  const scene = scenePersonnalisee(RADE, {}, [
    { camp: 0, type: 'sous_marin', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 3 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT5, 'plongee');
  const sm = e.unites[0]!;
  // En pleine mer, sans terrain qui cache : c'est le trait, et lui seul.
  assert.equal(cacheeAuContact(e, CAT5, sm), true);
  assert.ok(casesVisibles(e, CAT5, 1).has(cleCase(sm)), 'la case est éclairée…');
  assert.ok(!unitesVues(e, CAT5, 1).some((u) => u.id === sm.id), '…et la coque reste invisible');
  // À distance 1, elle est repérée, comme une unité en forêt.
  const contact = { ...e, unites: e.unites.map((u) => (u.camp === 1 ? { ...u, x: 5, y: 1 } : u)) };
  assert.ok(unitesVues(contact, CAT5, 1).some((u) => u.id === sm.id));
  // Une autre coque de mer sans le trait ne se cache pas.
  const barge = scenePersonnalisee(RADE, {}, [
    { camp: 0, type: 'barge', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 3 },
  ], { brouillard: true });
  const eb = creerPartie(barge, CAT5, 'barge');
  assert.equal(cacheeAuContact(eb, CAT5, eb.unites[0]!), false);
  assert.ok(unitesVues(eb, CAT5, 1).some((u) => u.id === eb.unites[0]!.id));
});
