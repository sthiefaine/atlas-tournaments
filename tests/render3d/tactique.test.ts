import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reglerDecorTactique, symboleRole } from '../../src/render3d/tactique';

test('le mode tactique laisse les objectifs et restaure le décor sans réveiller les couches éteintes', () => {
  const objets = [
    { name: 'paysage', visible: true }, { name: 'coniferes', visible: false },
    { name: 'batiments', visible: true }, { name: 'pavillons', visible: true },
  ];
  const avant = new WeakMap();
  reglerDecorTactique(objets, false, avant);
  assert.equal(objets[1]!.visible, false);
  reglerDecorTactique(objets, true, avant);
  reglerDecorTactique(objets, true, avant);
  assert.deepEqual(objets.map((o) => o.visible), [false, false, true, true]);
  const resseme = { name: 'rochers-0', visible: true };
  objets.push(resseme);
  reglerDecorTactique(objets, true, avant);
  assert.equal(resseme.visible, false);
  reglerDecorTactique(objets, false, avant);
  assert.deepEqual(objets.map((o) => o.visible), [true, false, true, true, true]);
});

test('les drones spécialisés portent leur fonction avant leur moyen de déplacement', () => {
  assert.equal(symboleRole({ traits: ['vol', 'drone', 'anti_air'] }), '⊕');
  assert.equal(symboleRole({ traits: ['vol', 'drone', 'ravitaillement'] }), '+');
  assert.equal(symboleRole({ traits: ['vol', 'drone', 'brouilleur'] }), '≈');
  assert.equal(symboleRole({ traits: ['vol', 'drone'] }), '◇');
});
