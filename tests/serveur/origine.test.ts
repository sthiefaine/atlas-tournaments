import { test } from 'node:test';
import assert from 'node:assert/strict';
import { origineAutorisee } from '../../src/serveur/origine';
test('proxy : seule l’origine publique configurée est ajoutée à l’origine locale', () => {
  const req = (origin: string, extra = {}) => new Request('http://atlas:3000/api/admin/assets/test/sources', { headers: { origin, ...extra } });
  assert.equal(origineAutorisee(req('https://atlas-tournament.clairdev.com'), 'https://atlas-tournament.clairdev.com/'), true);
  assert.equal(origineAutorisee(req('https://autre.test'), 'https://atlas-tournament.clairdev.com'), false);
  assert.equal(origineAutorisee(req('null'), 'https://atlas-tournament.clairdev.com'), false);
  assert.equal(origineAutorisee(req('https://autre.test', { 'x-forwarded-host': 'autre.test', 'x-forwarded-proto': 'https' }), ''), false);
  assert.equal(origineAutorisee(req('http://atlas:3000'), ''), true);
  assert.equal(origineAutorisee(req('https://autre.test'), 'invalide'), false);
});
