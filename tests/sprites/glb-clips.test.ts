// Un clip où rien ne bouge se lit dans les données binaires du GLB : toutes
// les valeurs de ses pistes sont celles de leur première clé.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accesseurConstant, lireDocument, type DocumentGltf } from '../../scripts/sprites/glb';

/** Un document à deux clips : `repos` tient une translation, `capture` la fait bouger d'un millimètre. */
function exemple(): { document: DocumentGltf; bin: Uint8Array } {
  const flottants = new Float32Array([
    0, 1.6, // temps
    0, 0.1, 0, 0, 0.1, 0, // repos : deux fois la même translation
    0, 0.1, 0, 0.001, 0.1, 0, // capture : la seconde clé bouge d'un millimètre
  ]);
  const bin = new Uint8Array(flottants.buffer);
  const document: DocumentGltf = {
    bufferViews: [{ byteOffset: 0, byteLength: 8 }, { byteOffset: 8, byteLength: 24 }, { byteOffset: 32, byteLength: 24 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', max: [1.6] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 2, type: 'VEC3' },
    ],
    animations: [
      { name: 'repos', samplers: [{ input: 0, output: 1 }] },
      { name: 'capture', samplers: [{ input: 0, output: 2 }] },
    ],
  };
  return { document, bin };
}

test('un accesseur de flottants est constant quand chaque élément vaut le premier', () => {
  const { document, bin } = exemple();
  assert.equal(accesseurConstant(document, bin, 1), true);
  assert.equal(accesseurConstant(document, bin, 2), false);
  // Dans le doute, un clip bouge : des entiers, ou un accesseur qui déborde des données.
  assert.equal(accesseurConstant(document, bin, 3), false);
  assert.equal(accesseurConstant(document, bin.subarray(0, 16), 1), false);
});

test('avec ses données binaires, chaque clip dit s’il est fixe ; sans elles, il ne dit rien', () => {
  const { document, bin } = exemple();
  assert.deepEqual(lireDocument(document, bin).clips, [
    { nom: 'repos', duree: 1.6, fixe: true },
    { nom: 'capture', duree: 1.6, fixe: false },
  ]);
  assert.deepEqual(lireDocument(document).clips.map((c) => c.fixe), [undefined, undefined]);
});
