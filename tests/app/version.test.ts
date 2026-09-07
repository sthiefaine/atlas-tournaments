// La mention de version : calculée au build (`next.config.ts`), lue et
// composée par `src/app/version.ts`. Ici on vérifie la lecture, le format à
// l'heure de Paris et le libellé ; l'inscription au build se vérifie sur le HTML
// prérendu, pas ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterHorodatage, libelleVersion, versionBuild } from '../../src/app/version';

const INSTANT = '2026-09-07T19:14:00.000Z';

test('l’horodatage est à l’heure de Paris, en français, sans un mot de plus', () => {
  assert.equal(formaterHorodatage(INSTANT, 'fr'), '7 sept. 2026, 21:14');
  assert.equal(formaterHorodatage('un jour', 'fr'), '');
});

test('la version lue au build est validée : une date lisible, un commit court ou rien', () => {
  assert.deepEqual(versionBuild({ ATLAS_VERSION_DATE: INSTANT, ATLAS_VERSION_COMMIT: '89d3355b1fc0' }), { date: INSTANT, commit: '89d3355' });
  assert.deepEqual(versionBuild({ ATLAS_VERSION_DATE: INSTANT, ATLAS_VERSION_COMMIT: 'pas un sha' }), { date: INSTANT, commit: '' });
  assert.deepEqual(versionBuild({ ATLAS_VERSION_DATE: 'hier' }), { date: null, commit: '' });
  assert.deepEqual(versionBuild({}), { date: null, commit: '' });
});

test('le libellé porte le commit quand il existe, la date seule sinon, rien sans date', () => {
  assert.equal(libelleVersion('fr', 'accueil', { date: INSTANT, commit: '89d3355' }), '7 sept. 2026, 21:14 · 89d3355');
  assert.equal(libelleVersion('fr', 'accueil', { date: INSTANT, commit: '' }), '7 sept. 2026, 21:14');
  assert.equal(libelleVersion('fr', 'reglages', { date: INSTANT, commit: '89d3355' }), 'Mise en ligne du 7 sept. 2026, 21:14 · 89d3355');
  assert.equal(libelleVersion('fr', 'reglages', { date: null, commit: '89d3355' }), '');
});
