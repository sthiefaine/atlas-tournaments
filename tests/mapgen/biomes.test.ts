import test from 'node:test';
import assert from 'node:assert/strict';
import { genererCarte, PROFILS_BIOME } from '../../src/mapgen/index';
import type { Biome, ParametresCarte } from '../../src/schemas/index';

function carte(biome: Biome) {
  return genererCarte({ largeur: 24, hauteur: 18, camps: 2, biome, symetrie: 'axe_vertical' } as ParametresCarte, 72);
}

test('les dix biomes produisent des topologies distinctes et des descriptions tactiques', () => {
  const grilles = new Set<string>();
  for (const biome of Object.keys(PROFILS_BIOME) as Biome[]) {
    const c = carte(biome);
    assert.ok(PROFILS_BIOME[biome].description.length > 40);
    grilles.add(c.grille.join(''));
    assert.deepEqual(carte(biome), c);
  }
  assert.equal(grilles.size, 10);
});

test('désert et crêtes volcaniques sans forêts ; côtes à marées', () => {
  assert.ok(!carte('desert').grille.join('').includes('F'));
  assert.ok(!carte('volcanique').grille.join('').includes('F'));
  assert.equal(carte('cotier').mecanique, 'meca_marees');
  assert.equal(carte('archipel').mecanique, 'meca_marees');
});
