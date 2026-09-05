import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserProgression, missionOuverte } from '../../src/app/campagne/progression';

test('la progression locale refuse les formes corrompues et déduplique les victoires', () => {
  assert.deepEqual(normaliserProgression({ version: 9, victoires: ['mission_un'] }).victoires, []);
  assert.deepEqual(normaliserProgression({ version: 1, victoires: ['mission_un', 'mission_un', 4, '../admin'] }).victoires, ['mission_un']);
});
test('le parcours ouvre le tutoriel puis la mission qui suit une victoire', () => {
  const codes = ['mission_un', 'mission_deux', 'mission_trois'];
  const vide = normaliserProgression(null);
  assert.ok(missionOuverte(codes, 'mission_un', vide));
  assert.equal(missionOuverte(codes, 'mission_deux', vide), false);
  const progression = normaliserProgression({ version: 1, victoires: ['mission_un'] });
  assert.ok(missionOuverte(codes, 'mission_deux', progression));
  assert.equal(missionOuverte(codes, 'mission_trois', progression), false);
  assert.equal(missionOuverte(codes, 'inconnue', progression), false);
});
