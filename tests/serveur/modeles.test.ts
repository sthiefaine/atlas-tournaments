/**
 * L'inventaire des modèles livrés (`src/serveur/modeles.ts`) : une fonction
 * pure sur des noms de fichiers, et une lecture de dossier qui tient l'absence
 * du dossier pour l'état normal.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { decomposerNomModele, estInventaireModeles, genererSpecs, nomModele } from '../../src/assets/index';
import { inventaireModeles, lireInventaireModeles } from '../../src/serveur/modeles';

test('l’inventaire regroupe les niveaux par identifiant, triés, et ignore ce qui n’est pas un modèle', () => {
  const inventaire = inventaireModeles([
    'unite_x_base_lod1.glb',
    'lisez-moi.txt',
    'kit_fr_x_lod2.glb',
    'unite_x_base_lod0.glb',
    'unite_y_base.glb',
    'Unite_Z_base_lod0.glb',
    'unite_w_base_lod3.glb',
    '.DS_Store',
    'kit_fr_x_lod0.glb',
    'unite_x_base_lod1.glb',
  ]);
  assert.deepEqual(inventaire, {
    modeles: {
      kit_fr_x: [0, 2],
      unite_x_base: [0, 1],
    },
  });
  assert.deepEqual(Object.keys(inventaire.modeles), ['kit_fr_x', 'unite_x_base'], 'identifiants triés : un JSON stable');
  assert.deepEqual(inventaireModeles([]), { modeles: {} });
});

test('un niveau manquant se voit : le lod1 absent n’est pas inventé', () => {
  assert.deepEqual(inventaireModeles(['unite_x_base_lod0.glb', 'unite_x_base_lod2.glb']).modeles['unite_x_base'], [0, 2]);
});

test('la décomposition d’un nom est l’inverse exact du gabarit de la spécification', () => {
  const spec = genererSpecs().find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec);
  for (const lod of [0, 1, 2] as const) {
    assert.deepEqual(decomposerNomModele(nomModele(spec, lod)), { id: spec.id, lod });
  }
  assert.equal(decomposerNomModele('unite_char_leger_base.glb'), null, 'sans suffixe, ce n’est pas un niveau');
  assert.equal(decomposerNomModele('unite_char_leger_base_lod0.gltf'), null, 'seul le conteneur binaire est livré');
  assert.equal(decomposerNomModele('Unite_Char_lod0.glb'), null, 'une clé est en minuscules');
});

test('la forme d’un inventaire se vérifie, parce qu’elle traverse le réseau', () => {
  assert.equal(estInventaireModeles({ modeles: {} }), true);
  assert.equal(estInventaireModeles({ modeles: { unite_x_base: [0, 1, 2] } }), true);
  assert.equal(estInventaireModeles(null), false);
  assert.equal(estInventaireModeles([]), false);
  assert.equal(estInventaireModeles({}), false);
  assert.equal(estInventaireModeles({ modeles: [] }), false);
  assert.equal(estInventaireModeles({ modeles: { unite_x_base: [0, 3] } }), false, 'il n’y a pas de lod3');
  assert.equal(estInventaireModeles({ modeles: { unite_x_base: 'lod0' } }), false);
  assert.equal(estInventaireModeles({ modeles: { 'Pas une clé': [0] } }), false);
});

test('un dossier absent rend l’inventaire vide : c’est l’état normal du projet', () => {
  assert.deepEqual(lireInventaireModeles(path.join(os.tmpdir(), 'atlas-modeles-qui-n-existe-pas')), { modeles: {} });
});

test('un dossier de livraison se lit, sous-dossiers exclus', () => {
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'atlas-modeles-'));
  for (const nom of ['unite_x_base_lod0.glb', 'unite_x_base_lod1.glb', 'kit_fr_x_lod0.glb', 'notes.md']) {
    writeFileSync(path.join(dossier, nom), '');
  }
  mkdirSync(path.join(dossier, 'unite_y_base_lod0.glb'));
  assert.deepEqual(lireInventaireModeles(dossier), {
    modeles: { kit_fr_x: [0], unite_x_base: [0, 1] },
  });
});
