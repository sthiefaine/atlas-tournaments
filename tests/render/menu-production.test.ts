// Le menu de production met une unité en avant à l'ouverture : la première que
// les fonds permettent, sinon la première tout court — une fiche vide n'apprend
// rien. Pur, sur le vrai catalogue, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import { premiereAbordable } from '../../src/render/hud-html';

const CAT = chargerCatalogue(4);

test('la première unité abordable est mise en avant, sinon la première', () => {
  const unites = ['char_lourd', 'char_leger', 'infanterie'] as const;
  assert.equal(premiereAbordable(CAT, unites, 7000), 'char_leger');
  assert.equal(premiereAbordable(CAT, unites, 20000), 'char_lourd');
  assert.equal(premiereAbordable(CAT, unites, 500), 'char_lourd');
  assert.equal(premiereAbordable(CAT, [], 500), null);
});
