// Le gras des scénaristes (`render/gras.ts`) : `**texte**` se segmente, un
// `**` jamais refermé se rend tel quel, et rien d'autre n'est jamais injecté.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { htmlGras, sansGras, segmenter } from '../../src/render/gras';

test('segmenter découpe un gras apparié et fusionne les morceaux voisins', () => {
  assert.deepEqual(segmenter('Prenez **la ville** avant la nuit.'), [
    { texte: 'Prenez ', gras: false },
    { texte: 'la ville', gras: true },
    { texte: ' avant la nuit.', gras: false },
  ]);
  assert.deepEqual(segmenter('**Tout** et **rien**'), [
    { texte: 'Tout', gras: true },
    { texte: ' et ', gras: false },
    { texte: 'rien', gras: true },
  ]);
  assert.deepEqual(segmenter('sans marque'), [{ texte: 'sans marque', gras: false }]);
  assert.deepEqual(segmenter(''), []);
});

test('un ** jamais refermé se rend tel quel, étoiles comprises', () => {
  assert.deepEqual(segmenter('Attention **au pont'), [{ texte: 'Attention **au pont', gras: false }]);
  assert.deepEqual(segmenter('**a** puis **b'), [
    { texte: 'a', gras: true },
    { texte: ' puis **b', gras: false },
  ]);
  // Un gras vide ne produit rien, et ne casse pas la suite.
  assert.deepEqual(segmenter('x **** y'), [{ texte: 'x  y', gras: false }]);
});

test('sansGras rend le texte nu, pour un title ou un journal', () => {
  assert.equal(sansGras('Prenez **la ville** avant **la nuit**.'), 'Prenez la ville avant la nuit.');
  assert.equal(sansGras('reste **ouvert'), 'reste **ouvert');
});

test('htmlGras échappe par la fonction de l’appelant et n’injecte qu’un strong', () => {
  const ech = (s: string): string => s.replace(/</g, '&lt;');
  assert.equal(htmlGras('a <b> **<c>** d', ech), 'a &lt;b> <strong>&lt;c></strong> d');
  assert.equal(htmlGras('rien', ech), 'rien');
});
