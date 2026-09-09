import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerAnnotations } from '../../src/app/api/routines/missions/annotations';

test('PATCH accepte une note partielle mais jamais un statut ou du contenu', () => {
  assert.equal(validerAnnotations({ note: 'Vérifier le renfort allié à J40.' }, false).ok, true);
  for (const valeur of [null, [], {}, { statut: 'en_ligne' }, { scenario: {} }, { confiance: '1' }]) {
    assert.equal(validerAnnotations(valeur, false).ok, false);
  }
});

test('PUT exige toutes les annotations et permet leur effacement explicite', () => {
  assert.equal(validerAnnotations({ commentaire: 'Carte relue' }, true).ok, false);
  assert.deepEqual(validerAnnotations({ commentaire: null, note: null, confiance: null }, true), {
    ok: true, valeur: { commentaire: null, note: null, confiance: null },
  });
});

test('confiance et textes sont bornés sans troncature silencieuse', () => {
  for (const confiance of [-0.01, 1.01, NaN, Infinity]) {
    assert.equal(validerAnnotations({ confiance }, false).ok, false);
  }
  for (const confiance of [0, 0.5, 1, null]) {
    assert.equal(validerAnnotations({ confiance }, false).ok, true);
  }
  assert.equal(validerAnnotations({ note: 'a'.repeat(2000) }, false).ok, true);
  assert.equal(validerAnnotations({ note: 'a'.repeat(2001) }, false).ok, false);
});
