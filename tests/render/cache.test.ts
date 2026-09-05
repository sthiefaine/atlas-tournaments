// La clé du cache de sprites : cinq champs, et pour une unité la **silhouette**
// et non la clé d'unité (02-architecture.md §2 point 2 et §3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import { palierZoom } from '../../src/render/camera';
import { nationDe } from '../../src/render/palettes';
import { cleSilhouette } from '../../src/render/sprites/silhouettes';
import { cleSprite } from '../../src/render/sprites/cache';
import { ambiance } from '../../src/render/ambiance';

test('la clé de sprite tient en cinq champs séparés par deux-points', () => {
  const cle = cleSprite({
    type: 'silhouette', cle: 'chenilles-bloc-tourelle-2', nation: 'bleu',
    ambiance: 'automne:jour:clair', zoom: 2,
  });
  assert.equal(cle, 'silhouette:chenilles-bloc-tourelle-2:bleu:automne:jour:clair:2x');
  assert.equal(cle.startsWith('silhouette:'), true);
  assert.equal(cle.endsWith(':2x'), true);
});

test('deux unités de silhouette identique partagent la même clé', () => {
  const a = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 });
  const b = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 });
  const c = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 3 });
  assert.equal(a, b);
  assert.notEqual(a, c, 'la taille fait partie de l’identité de la silhouette');
  assert.equal(a, 'chenilles-bloc-tourelle-2');
  assert.equal(
    cleSilhouette({ base: 'pattes', corps: 'capsule', modules: [], taille: 1 }),
    'pattes-capsule-nu-1',
  );
});

test('les dix unités canon donnent des silhouettes distinctes', () => {
  const cat = chargerCatalogue();
  const cles = cat.cles.map((c) => cleSilhouette(cat.unites[c]!.silhouette));
  assert.equal(cles.length, 10);
  assert.equal(new Set(cles).size, 10, 'deux unités canon partagent une silhouette');
});

test('la clé change avec la nation, l’ambiance et le palier de zoom', () => {
  const champs = {
    type: 'silhouette', cle: 'roues-plateau-lance_roquettes-3',
    nation: nationDe(0), ambiance: ambiance('hiver', 'jour', 'neige').cle, zoom: palierZoom(1),
  };
  const base = cleSprite(champs);
  assert.notEqual(base, cleSprite({ ...champs, nation: nationDe(1) }));
  assert.notEqual(base, cleSprite({ ...champs, ambiance: ambiance('hiver', 'nuit', 'neige').cle }));
  assert.notEqual(base, cleSprite({ ...champs, zoom: palierZoom(2) }));
});
