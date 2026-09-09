import test from 'node:test';
import assert from 'node:assert/strict';
import { facteurDuree, normaliserVitesse } from '../../src/render/cadence';
import { normaliserPreferences } from '../../src/app/preferences';

test('cadences : migration neutre, choix conservé, réduction prioritaire', () => {
  assert.equal(normaliserPreferences({ version: 1 }).vitesseAnimations, 'normale');
  assert.equal(normaliserPreferences({ modeTactique: true }).modeTactique, true);
  for (const valeur of [null, 5, 'turbo', false]) assert.equal(normaliserVitesse(valeur), 'normale');
  for (const vitesse of ['normale', 'rapide', 'instantanee'] as const) {
    assert.equal(normaliserPreferences({ vitesseAnimations: vitesse }).vitesseAnimations, vitesse);
    assert.equal(facteurDuree(vitesse, true), 0);
  }
  assert.equal(facteurDuree('normale'), 1);
  assert.equal(facteurDuree('rapide'), 0.5);
  assert.equal(facteurDuree('instantanee'), 0);
});
