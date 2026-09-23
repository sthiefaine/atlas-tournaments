// La grille du sol : les codes de terrain, les pièces de voie et d'eau, et la
// texture de données qui les porte au nuanceur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLES_TERRAIN } from '../../../src/schemas/types';
import {
  axePont, BITS, decoderCase, encoderCases, LIAISONS_CANON, liaisonsDePiece, liaisonsEau, liaisonsVoie,
  pieceDepuisLiaisons, pieceEau, pieceVoie, poserBrouillard, tournerLiaisons, type Liaisons,
} from '../../../src/render2d/sol/grille';
import {
  codeDe, MATIERES, NB_CODES, ORDRE_CODES, poidsDe, tablesPoids, TERRAINS_BATIS, terrainDuCode,
} from '../../../src/render2d/sol/terrains';
import { grilleDe } from './aides';

test('chaque terrain du canon a un code distinct, et les bâtiments ferment la liste', () => {
  const codes = CLES_TERRAIN.map(codeDe);
  assert.equal(new Set(codes).size, CLES_TERRAIN.length, 'deux terrains partagent un code');
  for (const t of CLES_TERRAIN) {
    assert.ok(codeDe(t) < NB_CODES, t);
    assert.equal(terrainDuCode(codeDe(t)), t);
  }
  assert.equal(ORDRE_CODES.length, CLES_TERRAIN.length, 'un terrain du canon n’a pas de code');
  // Le nuanceur reconnaît une case bâtie par `code >= CODE_VILLE` : c'est vrai
  // exactement pour les bâtiments.
  for (const t of CLES_TERRAIN) {
    assert.equal(codeDe(t) >= codeDe('ville'), TERRAINS_BATIS.has(t), t);
  }
});

test('le mélange de chaque terrain somme à 1, et les tables d’uniformes le portent', () => {
  for (const t of CLES_TERRAIN) {
    const p = poidsDe(t);
    assert.equal(p.length, MATIERES.length);
    assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9, t);
  }
  const { a, b } = tablesPoids();
  assert.equal(a.length, NB_CODES * 4);
  const mer = codeDe('mer');
  assert.ok(Math.abs((a[mer * 4 + 3] ?? 0) - poidsDe('mer')[3]!) < 1e-6, 'le sable du fond marin');
  const ville = codeDe('ville');
  assert.ok((b[ville * 4 + 1] ?? 0) > 0.8, 'une ville est une cour pavée');
});

test('les seize liaisons se répartissent entre les six pièces, chacune exactement une fois', () => {
  const vus = new Set<string>();
  for (let n = 0; n < 16; n += 1) {
    const l: Liaisons = [(n & 1) > 0, (n & 2) > 0, (n & 4) > 0, (n & 8) > 0];
    const p = pieceDepuisLiaisons(l);
    assert.deepEqual(liaisonsDePiece(p), l, `configuration ${n}`);
    vus.add(`${p.forme}:${p.rotation}`);
  }
  assert.equal(vus.size, 16);
  // Tourner quatre fois ramène au départ ; un quart de tour envoie le nord à l'est.
  assert.deepEqual(tournerLiaisons(LIAISONS_CANON.bout, 1), [false, true, false, false]);
  assert.deepEqual(tournerLiaisons(LIAISONS_CANON.virage, 4), LIAISONS_CANON.virage);
});

test('une route se raccorde aux routes et aux bâtiments, et au pont par son axe seulement', () => {
  const g = grilleDe([
    'PPPPP',
    'PRRCP',
    'PPRPP',
    'VVNVV',
    'PPRPP',
  ]);
  assert.deepEqual(liaisonsVoie(g, 1, 1), [false, true, false, false], 'bout vers l’est');
  assert.deepEqual(liaisonsVoie(g, 2, 1), [false, true, true, true], 'T vers la ville et le sud');
  // Le pont de (2, 3) franchit une rivière est-ouest : il circule nord-sud.
  assert.equal(axePont(g, 2, 3), 'ns');
  assert.deepEqual(liaisonsVoie(g, 2, 2), [true, false, true, false], 'la route rejoint le pont par le sud');
  assert.deepEqual(pieceVoie(g, 2, 3), { forme: 'droite', rotation: 0 });
  // Une route qui arrive sur le flanc d'un pont ne s'y raccorde pas : elle
  // buterait contre le garde-corps. Celle qui arrive par l'axe, si.
  const flanc = grilleDe([
    'PRP',
    'VNR',
    'PRP',
  ]);
  assert.equal(axePont(flanc, 1, 1), 'ns');
  assert.equal(liaisonsVoie(flanc, 2, 1)[3], false, 'le flanc');
  assert.equal(liaisonsVoie(flanc, 1, 0)[2], true, 'l’axe');
  // L'axe suit les voies qu'il relie, l'eau n'est qu'un indice.
  const parLaRoute = grilleDe([
    'PVP',
    'RNP',
    'PVP',
  ]);
  assert.equal(axePont(parLaRoute, 1, 1), 'eo');
  assert.deepEqual(liaisonsVoie(parLaRoute, 0, 1), [false, true, false, true]);
});

test('une route qui arrive de face sur le bord continue au-delà, celle qui le longe non', () => {
  const longe = grilleDe(['RRR', 'PPP']);
  assert.deepEqual(liaisonsVoie(longe, 0, 0), [false, true, false, true], 'pas de moignon vers le nord');
  assert.deepEqual(liaisonsVoie(longe, 1, 0), [false, true, false, true]);
  assert.deepEqual(liaisonsVoie(longe, 2, 0), [false, true, false, true]);
  const descend = grilleDe(['PRP', 'PRP']);
  assert.deepEqual(liaisonsVoie(descend, 1, 0), [true, false, true, false], 'elle sort par le haut');
  assert.deepEqual(liaisonsVoie(descend, 1, 1), [true, false, true, false], 'et par le bas');
  const riviereLonge = grilleDe(['VVV', 'PPP']);
  assert.deepEqual(liaisonsEau(riviereLonge, 1, 0), [false, true, false, true]);
});

test('le chenal d’une rivière suit la rivière, la mer, et passe sous le pont en travers de son axe', () => {
  const g = grilleDe([
    'PVP',
    'RNR',
    'PVP',
    'WVP',
  ]);
  assert.equal(axePont(g, 1, 1), 'eo');
  assert.deepEqual(liaisonsEau(g, 1, 0), [true, false, true, false], 'vers le haut (bord prolongé) et sous le pont');
  assert.deepEqual(liaisonsEau(g, 1, 2), [true, false, true, false]);
  assert.deepEqual(liaisonsEau(g, 1, 3), [true, false, true, true], 'la mer à l’ouest, le bord au sud');
  // Sous le pont, le chenal est droit, en travers de la circulation.
  assert.deepEqual(liaisonsDePiece(pieceEau(g, 1, 1)!), [true, false, true, false]);
  assert.equal(pieceEau(g, 0, 0), null);
  // Un pont sur du sec garde ses deux bras : un tablier sur rien se lirait comme une erreur.
  const sec = grilleDe(['PRP', 'PNP', 'PRP']);
  assert.deepEqual(liaisonsDePiece(pieceEau(sec, 1, 1)!), [false, true, false, true]);
});

test('la texture de données : code, voie, eau et brouillard, sans retournement', () => {
  const g = grilleDe([
    'PRV',
    'WNC',
  ]);
  const brouillard = Uint8Array.from([255, 255, 0, 255, 255, 255]);
  const octets = encoderCases(g, brouillard);
  assert.equal(octets.length, 6 * 4);
  const route = decoderCase(octets, 3, 1, 0);
  assert.equal(route.code, codeDe('route'));
  assert.ok((route.voie & BITS.VOIE) !== 0);
  assert.ok((route.voie & BITS.SUD) !== 0, 'la route rejoint le pont au sud');
  const riviere = decoderCase(octets, 3, 2, 0);
  assert.equal(riviere.code, codeDe('riviere'));
  assert.equal(riviere.vue, 0, 'le brouillard est dans le canal A');
  const pont = decoderCase(octets, 3, 1, 1);
  assert.equal(pont.code, codeDe('pont'));
  assert.ok((pont.voie & BITS.VOIE) !== 0);
  assert.equal(decoderCase(octets, 3, 0, 1).code, codeDe('mer'));
  assert.equal(decoderCase(octets, 3, 0, 0).voie, 0, 'la plaine ne porte pas de voie');
  // Sans brouillard, tout est vu.
  assert.ok([...encoderCases(g, null)].filter((_, i) => i % 4 === 3).every((v) => v === 255));
});

test('le brouillard se repose sans réallouer, et dit s’il a changé', () => {
  const g = grilleDe(['PP', 'PP']);
  const octets = encoderCases(g, null);
  const meme = encoderCases(g, null, octets);
  assert.equal(meme, octets, 'un tampon de la bonne taille est réutilisé');
  assert.equal(poserBrouillard(octets, Uint8Array.from([255, 255, 255, 255])), false);
  assert.equal(poserBrouillard(octets, Uint8Array.from([255, 0, 255, 255])), true);
  assert.equal(decoderCase(octets, 2, 1, 0).vue, 0);
  assert.equal(poserBrouillard(octets, null), true, 'lever le brouillard est un changement');
  assert.equal(decoderCase(octets, 2, 1, 0).vue, 255);
});
