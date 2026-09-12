import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { genererSpecs, commandeAsset, decomposerNomModele } from '../../src/assets/index';
import { classerDepot } from '../../src/serveur/depot-modeles';

test('toutes les familles commandent et acceptent uniquement le LOD0', () => {
  for (const spec of genererSpecs()) {
    assert.deepEqual(spec.verification.lodRequis, [0], spec.id);
    assert.deepEqual(Object.keys(spec.budget).sort(), ['lod0', 'materiauxMax']);
    assert.doesNotMatch(commandeAsset(spec), /_lod[1-9]\.glb/);
    const anciens = [1, 2].map(n => `${spec.id}_lod${n}.glb`);
    assert.deepEqual(classerDepot(spec, anciens).inconnus, anciens);
  }
  assert.equal(decomposerNomModele('unite_x_base_lod1.glb'), null);
  assert.equal(decomposerNomModele('unite_x_base_lod2.glb'), null);
});

test('aucun fichier LOD supplémentaire dans les livraisons et les répertoires publics', () => {
  function parcourir(dossier: string): void {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const f = path.join(dossier, e.name);
      assert.doesNotMatch(e.name, /_lod[1-9]\.glb$/, f);
      if (e.isDirectory()) parcourir(f);
    }
  }
  parcourir('assets/livraisons');
  parcourir('public/assets');
});
