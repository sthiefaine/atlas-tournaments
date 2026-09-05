/**
 * Combat : la formule du §5 vérifiée à la main sur les valeurs de la matrice de
 * `content/degats.json`, la riposte, les munitions et la jauge.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, calculerDegats, degatsBase, JAUGE_PAR_PV_INFLIGE, JAUGE_PAR_PV_SUBI,
  peutViser, pvAffiches, resoudreAttaque, copierEtat,
} from '../../src/engine/index';
import { CAT, partiePersonnalisee, rngFixe, u } from './aides';

// Une bande de terrain simple : route, forêt, plaine, montagne.
const GRILLE = [
  'HRRFMPPPPH',
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

test("la table de dégâts est bien celle du document 04 §8", () => {
  assert.equal(degatsBase(CAT, 'char_leger', 'infanterie'), 75);
  assert.equal(degatsBase(CAT, 'antiair', 'helico'), 120);
  assert.equal(degatsBase(CAT, 'char_lourd', 'helico'), 0);
  assert.equal(degatsBase(CAT, 'transport', 'infanterie'), 0);
});

test("l'exemple travaillé du §5.4 donne exactement 68 puis 10 PV", () => {
  // Char léger 10 PV sur route (1,0 → route), infanterie 10 PV en forêt (E = 2).
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ]);
  const travail = copierEtat(etat);
  const char = u(travail, 'u1');
  const inf = u(travail, 'u2');
  // Fterrain = 1 − 0,05 × 2 × 1 = 0,90 ; D = 75 × 1 × 0,90 = 67,5 → 68.
  const degats = calculerDegats(travail, CAT, char, inf, rngFixe(0.5));
  assert.equal(degats, 68);
  inf.pv -= degats;
  assert.equal(inf.pv, 32);
  assert.equal(pvAffiches(inf.pv), 4);
  // Riposte : 25 × (4/10) × 1,00 (le char est sur une route, E = 0) = 10.
  assert.equal(calculerDegats(travail, CAT, inf, char, rngFixe(0.5)), 10);
});

test("l'aléa reste borné à ±5 %", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ]);
  const bas = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0));
  const haut = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.999999));
  assert.equal(bas, Math.round(67.5 * 0.95));
  assert.equal(haut, Math.round(67.5 * 1.05));
});

test('la défense de terrain dépend des PV de la cible', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 4, y: 0, pv: 20 },
  ]);
  // Montagne, E = 4, cible à 2 PV affichés : Fterrain = 1 − 0,05 × 4 × 0,2 = 0,96.
  const degats = calculerDegats(copierEtat(etat), CAT, u(etat, 'u1'), u(etat, 'u2'), rngFixe(0.5));
  assert.equal(degats, Math.min(20, Math.round(75 * 0.96)));
});

test('une unité de tir indirect ne riposte jamais et ne tire pas après avoir bougé', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 1 },
    { camp: 1, type: 'artillerie', x: 5, y: 2 },
  ]);
  const travail = copierEtat(etat);
  const issue = resoudreAttaque(travail, CAT, u(travail, 'u1'), u(travail, 'u2'), rngFixe(0.5), []);
  assert.equal(issue.riposte, 0);
  const arti = u(etat, 'u2');
  assert.equal(peutViser(etat, CAT, arti, u(etat, 'u1'), { x: 5, y: 2 }, true).ok, false);
  assert.equal(peutViser(etat, CAT, arti, u(etat, 'u1'), { x: 5, y: 2 }, false).ok, false); // distance 1
});

test('la portée minimale des indirectes interdit le corps à corps', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'artillerie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 7 },
  ]);
  const arti = u(etat, 'u1');
  const cible = u(etat, 'u2');
  assert.equal(peutViser(etat, CAT, arti, cible, { x: 5, y: 5 }, false).ok, true);
  const collee = peutViser(etat, CAT, arti, cible, { x: 5, y: 6 }, false);
  assert.equal(collee.ok, false);
  assert.equal(collee.ok === false && collee.motif, 'cible_hors_portee');
});

test('la riposte consomme une munition et rend de la jauge aux deux camps', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'char_leger', x: 5, y: 6 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  const def = u(travail, 'u2');
  const avantAtt = att.munitions ?? 0;
  const avantDef = def.munitions ?? 0;
  const issue = resoudreAttaque(travail, CAT, att, def, rngFixe(0.5), []);
  assert.equal(att.munitions, avantAtt - 1);
  assert.equal(def.munitions, avantDef - 1);
  assert.ok(issue.riposte > 0);
  const retires = 10 - pvAffiches(def.pv);
  const rendus = 10 - pvAffiches(att.pv);
  assert.equal(
    travail.camps[0]?.jauge,
    JAUGE_PAR_PV_INFLIGE * retires + JAUGE_PAR_PV_SUBI * rendus,
  );
  assert.equal(
    travail.camps[1]?.jauge,
    JAUGE_PAR_PV_SUBI * retires + JAUGE_PAR_PV_INFLIGE * rendus,
  );
});

test("une unité sans munition ne peut plus viser", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const travail = copierEtat(etat);
  const att = u(travail, 'u1');
  att.munitions = 0;
  const v = peutViser(travail, CAT, att, u(travail, 'u2'), { x: 5, y: 5 }, false);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.motif, 'sans_munitions');
});

test("le transport ne peut viser personne", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'transport', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const v = peutViser(etat, CAT, u(etat, 'u1'), u(etat, 'u2'), { x: 5, y: 5 }, false);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.motif, 'ne_peut_pas_viser');
});

test('une attaque passe par appliquer et laisse la cible sous ses PV de départ', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 5, y: 6 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 5, y: 5 }],
    suite: { type: 'attaquer', cible: { x: 5, y: 6 } },
  }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(u(r.etat, 'u2').pv < 100);
  assert.equal(u(r.etat, 'u1').etat, 'agi');
  // L'état d'entrée n'a pas bougé : le moteur est pur.
  assert.equal(u(etat, 'u2').pv, 100);
});
