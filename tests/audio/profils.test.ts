import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sonDeplacement, sonEnvironnement } from '../../src/audio/profils';
import { TIMBRES } from '../../src/audio/moteur';
import { TYPES_MOUVEMENT } from '../../src/schemas/types';
test('chaque locomotion possède un timbre et les familles restent distinctes', () => {
  for (const type of TYPES_MOUVEMENT) assert.ok(TIMBRES[sonDeplacement(type)]);
  assert.notEqual(sonDeplacement('pied'), sonDeplacement('chenilles'));
  assert.notEqual(sonDeplacement('air'), sonDeplacement('mer'));
});
test('la météo prime sur la nuit puis le paysage', () => {
  assert.equal(sonEnvironnement('tempete', 'nuit', 'ile'), 'pluie');
  assert.equal(sonEnvironnement('clair', 'nuit', 'ile'), 'insectes');
  assert.equal(sonEnvironnement('clair', 'jour', 'littoral'), 'vagues');
  assert.equal(sonEnvironnement('clair', 'jour', 'plaine'), 'vent');
});
