// Les déclencheurs de scènes : ils se jugent sur les **événements** rendus par
// le moteur, jamais sur une horloge, et une scène ne se joue qu'une fois. Ce
// test travaille sur une vraie partie pour que les événements soient ceux que le
// moteur produit réellement, pas ceux qu'on croit qu'il produit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte,
  type EtatPartie, type EvenementJeu,
} from '../../src/engine/index';
import {
  filerRepliques, scenesDeclenchees, sceneOuverture,
} from '../../src/render/dialogues';
import { validerMapDef, type MapDef, type SceneDialogue } from '../../src/schemas/index';

const CAT = chargerCatalogue();

function carte(): MapDef {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  return r.valeur;
}

function partie(): EtatPartie {
  return creerPartie(sceneDeCarte(carte(), reglagesParDefaut({ meteoForcee: 'clair' })), CAT, 'dialogues');
}

function scene(cle: string, declencheur: SceneDialogue['declencheur']): SceneDialogue {
  return {
    cle,
    declencheur,
    repliques: [{ locuteur: 'cmd_ariane_belloc', texte: 'Texte de test.' }],
  };
}

const AUCUN: readonly EvenementJeu[] = [];

test("l'ouverture ne se déclenche jamais sur un événement : c'est l'hôte qui l'ouvre", () => {
  const scenes = [scene('ouv', { type: 'ouverture' })];
  const etat = partie();
  const evenements: EvenementJeu[] = [{ type: 'debut_tour', journee: 3, camp: 0 }];
  assert.deepEqual(scenesDeclenchees(scenes, new Set(), { etat, evenements, camp: 0 }), []);
  assert.equal(sceneOuverture(scenes)?.cle, 'ouv');
});

test('une scène de journée attend le début du tour du joueur, pas celui de l’adversaire', () => {
  const scenes = [scene('j2', { type: 'journee', journee: 2 })];
  const etat = partie();
  const adverse: EvenementJeu[] = [{ type: 'debut_tour', journee: 2, camp: 1 }];
  assert.equal(scenesDeclenchees(scenes, new Set(), { etat, evenements: adverse, camp: 0 }).length, 0);
  const mien: EvenementJeu[] = [{ type: 'debut_tour', journee: 2, camp: 0 }];
  assert.equal(scenesDeclenchees(scenes, new Set(), { etat, evenements: mien, camp: 0 }).length, 1);
});

test('une journée dépassée déclenche encore : une scène ratée se rattrape', () => {
  const scenes = [scene('j2', { type: 'journee', journee: 2 })];
  const evenements: EvenementJeu[] = [{ type: 'debut_tour', journee: 5, camp: 0 }];
  assert.equal(scenesDeclenchees(scenes, new Set(), { etat: partie(), evenements, camp: 0 }).length, 1);
});

test('capture et perte se restreignent au camp quand il est précisé', () => {
  const etat = partie();
  const capture: EvenementJeu[] = [{
    type: 'capture', uniteId: 'u1', case: { x: 1, y: 1 }, points: 20, acquis: true, camp: 1,
  }];
  const mienne = [scene('c', { type: 'capture', camp: 0 })];
  const sienne = [scene('c', { type: 'capture', camp: 1 })];
  const libre = [scene('c', { type: 'capture' })];
  assert.equal(scenesDeclenchees(mienne, new Set(), { etat, evenements: capture, camp: 0 }).length, 0);
  assert.equal(scenesDeclenchees(sienne, new Set(), { etat, evenements: capture, camp: 0 }).length, 1);
  assert.equal(scenesDeclenchees(libre, new Set(), { etat, evenements: capture, camp: 0 }).length, 1);
});

test('une capture en cours, non acquise, ne déclenche rien', () => {
  const evenements: EvenementJeu[] = [{
    type: 'capture', uniteId: 'u1', case: { x: 1, y: 1 }, points: 10, acquis: false, camp: 0,
  }];
  const scenes = [scene('c', { type: 'capture', camp: 0 })];
  assert.equal(scenesDeclenchees(scenes, new Set(), { etat: partie(), evenements, camp: 0 }).length, 0);
});

test('la production se filtre par type d’unité', () => {
  const etat = partie();
  const evenements: EvenementJeu[] = [{
    type: 'production', camp: 0, unite: 'genie', case: { x: 2, y: 2 }, cout: 1500,
  }];
  const genie = [scene('p', { type: 'production', unite: 'genie' })];
  const char = [scene('p', { type: 'production', unite: 'char_leger' })];
  assert.equal(scenesDeclenchees(genie, new Set(), { etat, evenements, camp: 0 }).length, 1);
  assert.equal(scenesDeclenchees(char, new Set(), { etat, evenements, camp: 0 }).length, 0);
});

test('un jalon de relais se lit sur l’état, sans événement dédié', () => {
  const etat = { ...partie(), relais: { '0': 2 } };
  const deuxieme = [scene('e2', { type: 'etape', etape: 2 })];
  const troisieme = [scene('e3', { type: 'etape', etape: 3 })];
  assert.equal(scenesDeclenchees(deuxieme, new Set(), { etat, evenements: AUCUN, camp: 0 }).length, 1);
  assert.equal(scenesDeclenchees(troisieme, new Set(), { etat, evenements: AUCUN, camp: 0 }).length, 0);
});

test('une scène déjà jouée ne revient pas, même si son déclencheur reste vrai', () => {
  const scenes = [scene('combat', { type: 'premier_combat' })];
  const etat = partie();
  const evenements: EvenementJeu[] = [{
    type: 'attaque', attaquantId: 'a', cibleId: 'b', degats: 30, riposte: 10,
  }];
  assert.equal(scenesDeclenchees(scenes, new Set(), { etat, evenements, camp: 0 }).length, 1);
  assert.equal(scenesDeclenchees(scenes, new Set(['combat']), { etat, evenements, camp: 0 }).length, 0);
});

test('les scènes sortent dans l’ordre du scénario, pas dans celui des événements', () => {
  const scenes = [
    scene('a_perte', { type: 'perte' }),
    scene('b_combat', { type: 'premier_combat' }),
  ];
  const evenements: EvenementJeu[] = [
    { type: 'attaque', attaquantId: 'a', cibleId: 'b', degats: 99, riposte: 0 },
    { type: 'hors_jeu', uniteId: 'b', camp: 1, unite: 'infanterie' },
  ];
  const sorties = scenesDeclenchees(scenes, new Set(), { etat: partie(), evenements, camp: 0 });
  assert.deepEqual(sorties.map((s) => s.cle), ['a_perte', 'b_combat']);
});

test('les répliques se déplient en file numérotée, avec le camp du locuteur', () => {
  const file = filerRepliques('sc', [
    { locuteur: 'cmd_ariane_belloc', texte: 'Un.', emotion: 'joie' },
    { locuteur: 'cmd_tomas_reiner', texte: 'Deux.' },
  ], (l) => (l === 'cmd_ariane_belloc' ? 0 : 1));
  assert.deepEqual(file.map((r) => [r.rang, r.total, r.camp, r.emotion]), [
    [1, 2, 0, 'joie'],
    [2, 2, 1, 'neutre'],
  ]);
  assert.ok(file.every((r) => r.sceneCle === 'sc'));
});
