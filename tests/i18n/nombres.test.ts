import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombre } from '../../src/i18n/index';

test('le cache conserve les séparateurs, les décimales et les locales du HUD', () => {
  for (const locale of ['fr', 'en', 'de', 'ar', 'ja']) {
    for (const valeur of [0, 500, 12345.678, -19, NaN, Infinity]) {
      assert.equal(nombre(locale, valeur), new Intl.NumberFormat(locale).format(valeur));
      assert.equal(nombre(locale, valeur), new Intl.NumberFormat(locale).format(valeur));
    }
  }
  assert.equal(nombre('locale_invalide', 1234), new Intl.NumberFormat('fr').format(1234));
});

test('les options restent indépendantes des formats mis en cache', () => {
  nombre('fr', 12);
  const options: Intl.NumberFormatOptions = { minimumFractionDigits: 2 };
  assert.equal(nombre('fr', 12, options), new Intl.NumberFormat('fr', options).format(12));
  options.minimumFractionDigits = 3;
  assert.equal(nombre('fr', 12, options), new Intl.NumberFormat('fr', options).format(12));
  assert.equal(nombre('fr', 12), new Intl.NumberFormat('fr').format(12));
});
