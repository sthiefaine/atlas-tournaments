/**
 * Les superusines de scénario (`doc/04-gameplay.md` §7.7, 10 septembre 2026) :
 * une unité neuve, gratuite, au début du tour de son camp quand la journée
 * est due ; sur la voisine libre si le bâtiment est occupé ; plafonnée par
 * `max` ; arrêtée net par une capture ou une désaffectation ; et le rejeu
 * reste identique au bit près.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, chargerCatalogue, creerPartie, empreinte, enregistrerPartie, producteursDe, rejouer, revenuParTour,
  superusineDue, superusineSur, verifierProduction,
  type Action, type EtatPartie, type ReglagesPartie, type Scene,
} from '../../src/engine/index';
import { jouerTour, PONDEREE } from '../../src/ai/index';
import { creerRng } from '../../src/engine/rng';
import { CAT, scenePersonnalisee } from './aides';

const GRILLE = [
  'HUPPPPPP',
  'PPPPPPPP',
  'PPPPPPUH',
];
const PROPRIETAIRES = { '0,0': 0 as const, '1,0': 0 as const, '6,2': 1 as const, '7,2': 1 as const };

function scene(reglages: Partial<ReglagesPartie> = {}): Scene {
  return scenePersonnalisee(GRILLE, PROPRIETAIRES, [
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 4, y: 0 },
  ], {
    superusines: [{ x: 6, y: 2, camp: 1, type: 'char_leger' }],
    cycleJourNuit: { jour: 1, nuit: 0 },
    victoire: [{ type: 'survivre', journees: 30 }],
    ...reglages,
  });
}

function fin(e: EtatPartie): EtatPartie {
  const r = appliquer(e, { type: 'finTour' }, CAT);
  assert.ok(r.ok);
  return r.ok ? r.etat : e;
}

/** Ferme n tours : deux par journée. */
function tours(e: EtatPartie, n: number): EtatPartie {
  let courant = e;
  for (let i = 0; i < n; i += 1) courant = fin(courant);
  return courant;
}

const chars = (e: EtatPartie) => e.unites.filter((u) => u.camp === 1 && u.type === 'char_leger');

test('superusineDue : depuis, chaque, et le défaut « chaque journée »', () => {
  assert.equal(superusineDue({}, 1), true);
  assert.equal(superusineDue({}, 7), true);
  assert.equal(superusineDue({ depuisJournee: 3 }, 2), false);
  assert.equal(superusineDue({ depuisJournee: 3, chaque: 2 }, 3), true);
  assert.equal(superusineDue({ depuisJournee: 3, chaque: 2 }, 4), false);
  assert.equal(superusineDue({ depuisJournee: 3, chaque: 2 }, 5), true);
});

test('trois journées, trois chars, prêts et gratuits ; la case occupée décale sur la voisine', () => {
  const depart = creerPartie(scene(), CAT, 'superusine');
  assert.equal(chars(depart).length, 0, 'rien avant le tour du camp 1');
  const fondsAvant = depart.camps[1]!.fonds;

  // Tour du camp 1, journée 1 : le premier char paraît sur l'usine.
  const j1 = fin(depart);
  assert.equal(j1.campCourant, 1);
  assert.equal(chars(j1).length, 1);
  const premier = chars(j1)[0]!;
  assert.deepEqual({ x: premier.x, y: premier.y }, { x: 6, y: 2 });
  assert.equal(premier.etat, 'prete', 'elle joue le tour même');
  assert.equal(premier.pv, 100);
  assert.equal(premier.munitions, CAT.unites['char_leger']!.munitions);
  assert.equal(premier.carburant, CAT.unites['char_leger']!.carburant?.max);
  assert.equal(j1.camps[1]!.fonds, fondsAvant + 2 * 1000, 'aucun coût : seuls les revenus des deux bâtiments');
  const evt = j1.journal.find((e) => e.type === 'production_automatique');
  assert.deepEqual(evt, { type: 'production_automatique', camp: 1, uniteId: premier.id, unite: 'char_leger', case: { x: 6, y: 2 } });
  assert.equal(j1.superusinesProduites?.['0'], 1);
  assert.equal(j1.produites['1:char_leger'], 1);

  // Journée 2 : l'usine est occupée, le second paraît sur la première voisine libre (au nord).
  const j2 = tours(j1, 2);
  assert.equal(j2.journee, 2);
  assert.equal(chars(j2).length, 2);
  assert.deepEqual(chars(j2).map((u) => ({ x: u.x, y: u.y })), [{ x: 6, y: 2 }, { x: 6, y: 1 }]);

  // Journée 3 : nord pris, le troisième va à l'ouest. Le QG n'est jamais une voisine libre : il est occupé ? non, mais il vient après.
  const j3 = tours(j2, 2);
  assert.equal(chars(j3).length, 3);
  assert.deepEqual(chars(j3).map((u) => ({ x: u.x, y: u.y })), [{ x: 6, y: 2 }, { x: 6, y: 1 }, { x: 5, y: 2 }]);
  assert.equal(j3.superusinesProduites?.['0'], 3);
  assert.ok(chars(j3).every((u) => u.etat === 'prete'));
});

test('max plafonne, chaque espace, depuisJournee retarde', () => {
  const plafond = tours(creerPartie(scene({ superusines: [{ x: 6, y: 2, camp: 1, type: 'char_leger', max: 2 }] }), CAT, 'max'), 7);
  assert.equal(plafond.journee, 4);
  assert.equal(chars(plafond).length, 2, 'deux et pas plus');

  const espace = tours(creerPartie(scene({ superusines: [{ x: 6, y: 2, camp: 1, type: 'char_leger', chaque: 2 }] }), CAT, 'chaque'), 7);
  assert.equal(chars(espace).length, 2, 'journées 1 et 3');

  const tard = tours(creerPartie(scene({ superusines: [{ x: 6, y: 2, camp: 1, type: 'char_leger', depuisJournee: 3 }] }), CAT, 'tard'), 7);
  assert.equal(chars(tard).length, 2, 'journées 3 et 4');
});

test('capturée ou désaffectée, la superusine s’arrête ; rendue, elle repart', () => {
  const j1 = fin(creerPartie(scene(), CAT, 'capture'));
  assert.equal(chars(j1).length, 1);
  // La capture est jouée par la main du test : c'est le propriétaire qui compte.
  const prise = { ...j1, proprietaires: { ...j1.proprietaires, '6,2': 0 as const } };
  const apresPrise = tours(prise, 2);
  assert.equal(chars(apresPrise).length, 1, 'rien ne sort d’une usine prise');
  const desaffectee = { ...j1, desaffectes: ['6,2'] };
  assert.equal(chars(tours(desaffectee, 2)).length, 1, 'rien ne sort d’une usine désaffectée');
  const rendue = { ...apresPrise, proprietaires: { ...apresPrise.proprietaires, '6,2': 1 as const } };
  assert.equal(chars(tours(rendue, 2)).length, 2, 'reprise, elle produit de nouveau');
});

test('capturée, la superusine se tient mais ne sert à rien : refus usine_inerte, production automatique arrêtée, revenu de bâtiment', () => {
  const j1 = fin(creerPartie(scene(), CAT, 'inerte'));
  assert.equal(chars(j1).length, 1);
  assert.deepEqual(superusineSur(j1, { x: 6, y: 2 })?.type, 'char_leger');
  assert.equal(superusineSur(j1, { x: 1, y: 0 }), null, 'l’usine ordinaire n’en porte pas');
  // Même son camp d'origine n'y produit rien au menu : il n'a que l'automatique.
  const origine = verifierProduction(j1, CAT, 1, { x: 6, y: 2 }, 'infanterie');
  assert.equal(origine.ok, false);
  if (!origine.ok) assert.equal(origine.motif, 'usine_inerte');
  assert.ok(!producteursDe(j1, CAT, 1).includes('6,2'), 'pas un producteur pour son camp');
  assert.ok(producteursDe(j1, CAT, 1).includes('7,2'), 'le QG, lui, produit');

  // Le camp 0 la prend (par la main du test) et joue son tour : rien ne sort,
  // le menu refuse, et l'usine ordinaire du camp 0 reste ouverte.
  const prise: EtatPartie = { ...j1, proprietaires: { ...j1.proprietaires, '6,2': 0 as const } };
  const tourJoueur = fin(prise);
  assert.equal(tourJoueur.campCourant, 0);
  const riche: EtatPartie = { ...tourJoueur, camps: tourJoueur.camps.map((c) => ({ ...c, fonds: 50_000 })) };
  const refus = verifierProduction(riche, CAT, 0, { x: 6, y: 2 }, 'infanterie');
  assert.equal(refus.ok, false);
  if (!refus.ok) assert.equal(refus.motif, 'usine_inerte');
  const produire = appliquer(riche, { type: 'produire', batiment: { x: 6, y: 2 }, unite: 'infanterie' }, CAT);
  assert.equal(produire.ok, false);
  if (!produire.ok) assert.equal(produire.motif, 'usine_inerte');
  assert.equal(verifierProduction(riche, CAT, 0, { x: 1, y: 0 }, 'infanterie').ok, true, 'l’usine ordinaire répond');
  assert.ok(!producteursDe(riche, CAT, 0).includes('6,2'));
  // Production automatique arrêtée pour le camp 1, sur deux journées.
  assert.equal(chars(tours(prise, 4)).length, 1);
  // Le revenu est celui de tout bâtiment tenu : trois bâtiments au camp 0, un de plus qu'avant.
  assert.equal(revenuParTour(prise, 0), revenuParTour(j1, 0) + prise.reglages.revenusParBatiment);
  assert.equal(revenuParTour(prise, 1), revenuParTour(j1, 1) - prise.reglages.revenusParBatiment);
  // Rendue à son camp, elle repart en automatique, et reste inerte au menu.
  const rendue: EtatPartie = { ...prise, proprietaires: { ...prise.proprietaires, '6,2': 1 as const } };
  assert.equal(chars(tours(rendue, 2)).length, 2);
});

test('sans voisine libre, la production est sautée sans compter', () => {
  const s = scene();
  s.unitesDepart = [
    { camp: 1, type: 'infanterie', x: 6, y: 2 }, { camp: 1, type: 'infanterie', x: 6, y: 1 },
    { camp: 1, type: 'infanterie', x: 5, y: 2 }, { camp: 1, type: 'infanterie', x: 7, y: 2 },
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
  ];
  const j1 = fin(creerPartie(s, CAT, 'plein'));
  assert.equal(chars(j1).length, 0);
  assert.equal(j1.superusinesProduites, undefined);
});

test('le rejeu d’une partie à superusine est identique au bit près, IA comprise', () => {
  const s = scene();
  const depart = creerPartie(s, CAT, 'rejeu');
  const actions: Action[] = [];
  let courant = depart;
  const rng = creerRng('rejeu-ia');
  for (let i = 0; i < 8; i += 1) {
    const r = jouerTour(courant, PONDEREE, rng.branche(`t${i}`), CAT);
    assert.deepEqual(r.refus, [], 'l’IA joue les chars produits sans refus');
    actions.push(...r.actions);
    courant = r.etat;
  }
  assert.ok(chars(courant).length + courant.journal.filter((e) => e.type === 'hors_jeu' && e.unite === 'char_leger').length >= 3);
  const bis = rejouer(s, CAT, enregistrerPartie(depart, actions));
  assert.deepEqual(bis.refus, []);
  assert.equal(empreinte(bis.etat), empreinte(courant));
});

test('creerPartie tient le scénario à sa parole : bâtiment producteur du camp, type du catalogue, exclusivité', () => {
  const sur = (superusine: NonNullable<ReglagesPartie['superusines']>[number]) =>
    () => creerPartie(scene({ superusines: [superusine] }), CAT, 'x');
  assert.throws(sur({ x: 3, y: 1, camp: 1, type: 'char_leger' }), /producteur/);
  assert.throws(sur({ x: 1, y: 0, camp: 1, type: 'char_leger' }), /son camp/);
  assert.throws(sur({ x: 6, y: 2, camp: 1, type: 'licorne' }), /inconnu/);
  assert.doesNotThrow(sur({ x: 7, y: 2, camp: 1, type: 'infanterie' }), 'le QG produit');
  const cat9 = chargerCatalogue(9);
  assert.throws(() => creerPartie(scene({ superusines: [{ x: 6, y: 2, camp: 1, type: 'meridien_automate' }] }), cat9, 'x'), /exclusive/);
  const faction = scene({ superusines: [{ x: 6, y: 2, camp: 1, type: 'meridien_automate' }], factionsParCamp: { 1: 'atl' } });
  const r = appliquer(creerPartie(faction, cat9, 'atl'), { type: 'finTour' }, cat9);
  assert.ok(r.ok);
  const j1 = r.ok ? r.etat : creerPartie(faction, cat9, 'atl');
  assert.equal(j1.unites.filter((u) => u.type === 'meridien_automate').length, 1, 'l’automate sort de la superusine des Gris');
});
