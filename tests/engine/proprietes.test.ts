/**
 * Propriétés du moteur : déterminisme, pureté, sérialisabilité, invariants
 * d'état, rejeu, cartes manuelles et contrat de hooks
 * (`doc/02-architecture.md` §7 et §8).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  appliquer, canonique, chargerCatalogue, cleCase, clesMecaniques, creerPartie,
  creerRng, empreinte, enregistrerPartie, MECANIQUE_TEST, mecaniqueDe, rejouer,
  reglagesParDefaut, sceneDeCarte, terrainLogique, type Action, type EtatPartie,
} from '../../src/engine/index';
import { jouerPartie, strategie } from '../../src/ai/index';
import { validerMapDef } from '../../src/schemas/index';
import { CARTES, CAT, carte, partie, partiePersonnalisee } from './aides';

/** Vérifie les invariants qu'aucune action ne doit briser. */
function invariants(etat: EtatPartie, ou: string): void {
  const occupees = new Set<string>();
  for (const u of etat.unites) {
    assert.ok(u.pv >= 1 && u.pv <= 100, `${ou} : PV hors bornes (${u.id} à ${u.pv})`);
    assert.ok(u.x >= 0 && u.x < etat.largeur, `${ou} : ${u.id} hors carte`);
    assert.ok(u.y >= 0 && u.y < etat.hauteur, `${ou} : ${u.id} hors carte`);
    if (u.dansTransport !== null) continue;
    const k = cleCase(u);
    assert.ok(!occupees.has(k), `${ou} : deux unités en ${k}`);
    occupees.add(k);
    assert.ok(u.pointsCapture >= 0 && u.pointsCapture < 20, `${ou} : points de capture hors bornes`);
    if (u.munitions !== null) assert.ok(u.munitions >= 0, `${ou} : munitions négatives`);
    if (u.carburant !== null) assert.ok(u.carburant >= 0, `${ou} : carburant négatif`);
  }
  for (const c of etat.camps) {
    assert.ok(c.fonds >= 0, `${ou} : fonds négatifs pour le camp ${c.id}`);
    assert.ok(c.jauge >= 0 && c.jauge <= c.jaugeMax, `${ou} : jauge hors bornes`);
  }
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    const [x, y] = k.split(',');
    const terrain = terrainLogique(etat, CAT, { x: Number(x), y: Number(y) });
    assert.ok(terrain !== null, `${ou} : propriétaire hors carte en ${k}`);
    assert.ok(etat.camps.some((c) => c.id === proprio), `${ou} : camp inconnu en ${k}`);
  }
}

test('les trois cartes manuelles sont des MapDef valides', () => {
  for (const nom of CARTES) {
    const brut = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, 'cartes', `${nom}.json`), 'utf8'),
    ) as unknown;
    const r = validerMapDef(brut);
    assert.equal(r.ok, true, `${nom} : ${r.ok ? '' : JSON.stringify(r.erreurs)}`);
  }
});

test('chaque carte manuelle ouvre une partie jouable', () => {
  for (const nom of CARTES) {
    const etat = partie(nom, 'ouverture');
    assert.equal(etat.journee, 1);
    assert.equal(etat.campCourant, 0);
    assert.equal(etat.partie.terminee, false);
    assert.ok(etat.unites.length >= 4);
    assert.ok(etat.camps.every((c) => c.qgCase !== null), `${nom} : QG de départ non repéré`);
    invariants(etat, nom);
  }
});

test("l'état est du JSON pur : la sérialisation est l'identité", () => {
  const etat = partie('plaine', 'serialisation');
  const aller = JSON.parse(JSON.stringify(etat)) as EtatPartie;
  assert.equal(canonique(aller), canonique(etat));
  assert.equal(empreinte(aller), empreinte(etat));
});

test("appliquer ne modifie jamais l'état d'entrée", () => {
  const etat = partie('plaine', 'purete');
  const avant = canonique(etat);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: etat.unites[0]!.id,
    chemin: [{ x: etat.unites[0]!.x, y: etat.unites[0]!.y }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok, true);
  assert.equal(canonique(etat), avant);
});

test('une action refusée ne change rien et ne lève jamais', () => {
  const etat = partie('plaine', 'refus');
  const avant = canonique(etat);
  const actions: Action[] = [
    { type: 'ordre', uniteId: 'inconnue', chemin: [], suite: { type: 'rien' } },
    { type: 'produire', batiment: { x: -1, y: -1 }, unite: 'char_lourd' },
    { type: 'pouvoir', niveau: 'super' },
    { type: 'ordre', uniteId: 'u1', chemin: [{ x: 99, y: 99 }], suite: { type: 'rien' } },
  ];
  for (const a of actions) {
    const r = appliquer(etat, a, CAT);
    assert.equal(r.ok, false, JSON.stringify(a));
    assert.equal(canonique(etat), avant);
  }
});

test('même graine et mêmes actions donnent la même empreinte', () => {
  for (const nom of CARTES) {
    const a = jouerAvecIa(nom, 'graine-identique');
    const b = jouerAvecIa(nom, 'graine-identique');
    assert.equal(empreinte(a.etat), empreinte(b.etat), nom);
    assert.deepEqual(a.actions.length, b.actions.length);
    const c = jouerAvecIa(nom, 'graine-differente');
    assert.notEqual(empreinte(a.etat), empreinte(c.etat), nom);
  }
});

test('aucune action acceptée ne laisse un état invalide', () => {
  for (const nom of CARTES) {
    const scene = sceneDeCarte(carte(nom), reglagesParDefaut({ limiteJournees: 12 }));
    let etat = creerPartie(scene, CAT, `invariants-${nom}`);
    const strat = strategie('ponderee');
    let garde = 0;
    while (!etat.partie.terminee && garde < 400) {
      garde += 1;
      const action = strat.choisirAction(etat, etat.campCourant, creerRng('ia'), CAT);
      const r = appliquer(etat, action, CAT);
      if (!r.ok) {
        const fin = appliquer(etat, { type: 'finTour' }, CAT);
        if (!fin.ok) break;
        etat = fin.etat;
        continue;
      }
      etat = r.etat;
      invariants(etat, `${nom} après ${action.type}`);
    }
  }
});

/** Joue une partie IA contre IA courte et rend l'état final et ses actions. */
function jouerAvecIa(nom: string, graine: string): { etat: EtatPartie; actions: Action[] } {
  const scene = sceneDeCarte(carte(nom), reglagesParDefaut({ limiteJournees: 10 }));
  const etat = creerPartie(scene, CAT, graine);
  const r = jouerPartie(etat, [strategie('ponderee'), strategie('agressive')], creerRng(`${graine}:ia`), CAT);
  return { etat: r.etat, actions: r.actions };
}

test('une partie enregistrée se rejoue à l’identique', () => {
  const nom = 'plaine';
  const graine = 'rejeu';
  const scene = sceneDeCarte(carte(nom), reglagesParDefaut({ limiteJournees: 10 }));
  const depart = creerPartie(scene, CAT, graine);
  const partieJouee = jouerPartie(
    depart, [strategie('ponderee'), strategie('defensive')], creerRng(`${graine}:ia`), CAT,
  );
  const sauvegarde = enregistrerPartie(partieJouee.etat, partieJouee.actions);
  assert.equal(sauvegarde.graine, graine);
  assert.ok(sauvegarde.actions.length > 10);
  const rejoue = rejouer(scene, CAT, sauvegarde);
  assert.deepEqual(rejoue.refus, []);
  assert.equal(empreinte(rejoue.etat), empreinte(partieJouee.etat));
});

test("l'empreinte change dès qu'un PV change", () => {
  const etat = partie('plaine', 'empreinte');
  const autre: EtatPartie = {
    ...etat,
    unites: etat.unites.map((u, i) => (i === 0 ? { ...u, pv: u.pv - 1 } : u)),
  };
  assert.notEqual(empreinte(etat), empreinte(autre));
});

test('le catalogue est la seule source des unités et des terrains', () => {
  const cat = chargerCatalogue();
  assert.equal(cat.cles.length, 11);
  assert.equal(Object.keys(cat.terrains).length, 13);
  assert.equal(cat.degats.matrice.length, 10);
  for (const ligne of cat.degats.matrice) assert.equal(ligne.length, 10);
});

test('le registre de mécaniques expose la mécanique de test et les marées', () => {
  const cles = clesMecaniques();
  assert.ok(cles.includes('meca_test'));
  assert.ok(cles.includes('meca_marees'));
  assert.equal(mecaniqueDe('meca_test')?.nom, MECANIQUE_TEST.nom);
  assert.equal(mecaniqueDe('meca_inconnue'), undefined);
});

test('une mécanique change le terrain logique sans réécrire la grille', () => {
  const grille = [
    'HPPPPPPPPH',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
  ];
  const etat = partiePersonnalisee(grille, {}, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 7, y: 7 },
  ], {}, 'meca', { cle: 'meca_test', parametres: { colonne: 3, periodeJournees: 1 } });
  // Journée 1 : couvert absent (1 % 2 = 1) ; journée 2 : couvert levé.
  assert.equal(terrainLogique(etat, CAT, { x: 3, y: 5 }), 'plaine');
  const r = appliquer(appliquer(etat, { type: 'finTour' }, CAT).ok
    ? (appliquer(etat, { type: 'finTour' }, CAT) as { ok: true; etat: EtatPartie }).etat
    : etat, { type: 'finTour' }, CAT);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.etat.journee, 2);
  assert.equal(terrainLogique(r.etat, CAT, { x: 3, y: 5 }), 'foret');
  assert.equal(r.etat.grille[5], 'PPPPPPPPPP');
  assert.equal(Number(r.etat.mecanique?.donnees['appels'] ?? 0) > 0, true);
});

test('le flux de combat est indépendant de celui de la météo', () => {
  const rng = creerRng('flux');
  const combat = rng.branche('combat');
  const meteo = rng.branche('meteo');
  const attendu = [meteo.suivant(), meteo.suivant(), meteo.suivant()];
  const autre = creerRng('flux');
  const autreCombat = autre.branche('combat');
  for (let i = 0; i < 20; i += 1) autreCombat.suivant();
  const autreMeteo = autre.branche('meteo');
  assert.deepEqual([autreMeteo.suivant(), autreMeteo.suivant(), autreMeteo.suivant()], attendu);
  assert.notDeepEqual(attendu, [combat.suivant(), combat.suivant(), combat.suivant()]);
});

test('un flux se restaure exactement depuis son instantané', () => {
  const rng = creerRng('instantane');
  const combat = rng.branche('combat');
  for (let i = 0; i < 5; i += 1) combat.suivant();
  const photo = rng.instantane();
  const attendu = [combat.suivant(), combat.suivant()];
  const rejoue = creerRng('instantane');
  rejoue.restaurer(photo);
  const rejoueCombat = rejoue.branche('combat');
  assert.deepEqual([rejoueCombat.suivant(), rejoueCombat.suivant()], attendu);
});
