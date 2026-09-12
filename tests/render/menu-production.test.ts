// Le menu de production met une unité en avant à l'ouverture : la première que
// les fonds permettent, sinon la première tout court — une fiche vide n'apprend
// rien. Pur, sur le vrai catalogue, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import { ordreProduction, premiereAbordable } from '../../src/render/hud-html';

const CAT = chargerCatalogue(0);

test('la première unité abordable est mise en avant, sinon la première', () => {
  const unites = ['char_lourd', 'char_leger', 'infanterie'] as const;
  assert.equal(premiereAbordable(CAT, unites, 7000), 'char_leger');
  assert.equal(premiereAbordable(CAT, unites, 20000), 'char_lourd');
  assert.equal(premiereAbordable(CAT, unites, 500), 'char_lourd');
  assert.equal(premiereAbordable(CAT, [], 500), null);
});

test('la grille de production est rangée par prix croissant, à égalité l’ordre du canon', () => {
  // `content/unites.json` range par famille : un char lourd à 15 000 y précède
  // une artillerie à 5 500. C'est le bon ordre pour lire un catalogue et le
  // mauvais pour tenir une boutique — ce qu'on peut payer s'y disperse au
  // milieu de ce qu'on ne peut pas.
  const unites = ['char_lourd', 'artillerie', 'infanterie', 'char_leger'] as const;
  assert.deepEqual(ordreProduction(CAT, unites),
    ['infanterie', 'artillerie', 'char_leger', 'char_lourd']);
  // Le tri ne dépend que du prix : deux ouvertures donnent la même grille, et la
  // mémoire du geste tient.
  assert.deepEqual(ordreProduction(CAT, unites), ordreProduction(CAT, unites));
  assert.deepEqual(ordreProduction(CAT, []), []);
  // À prix égal, l'ordre du canon survit : le tri est stable.
  const memePrix = (['transport', 'brouilleur'] as const).filter((c) => CAT.unites[c]);
  if (memePrix.length === 2) {
    assert.deepEqual(ordreProduction(CAT, memePrix), [...memePrix]);
    assert.deepEqual(ordreProduction(CAT, [...memePrix].reverse()), [...memePrix].reverse());
  }
});
