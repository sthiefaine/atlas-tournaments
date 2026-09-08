import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three/webgpu';
import { creerTampon } from '../../src/render3d/maillage';

// Exécuter l'utilitaire installé, pas une copie de la correction.
const utilitaire = import(pathToFileURL(path.resolve(
  'node_modules/three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js',
)).href);

for (const Tableau of [Float32Array, Uint32Array]) {
  test(`la plage WebGPU respecte la destination et la vue source (${Tableau.name})`, async () => {
    const { default: Utilitaire } = await utilitaire;
    const source = new Tableau([90, 91, 1, 2, 3, 4, 5, 6, 92]).subarray(2, 8);
    const attribut = new THREE.BufferAttribute(source, 1);
    attribut.addUpdateRange(2, 3);
    const gpu = new Uint8Array(source.byteLength).fill(0);
    const appels: number[][] = [];
    const moteur = new Utilitaire({
      get: () => ({ buffer: gpu }),
      device: { queue: {
        writeBuffer(destination: Uint8Array, offset: number, data: Float32Array | Uint32Array, debut: number, compte: number) {
          appels.push([offset, debut, compte]);
          destination.set(new Uint8Array(data.buffer, data.byteOffset + debut * data.BYTES_PER_ELEMENT,
            compte * data.BYTES_PER_ELEMENT), offset);
        },
      } },
    });
    moteur.updateAttribute(attribut);
    assert.deepEqual(appels, [[8, 2, 3]]);
    assert.deepEqual([...new Tableau(gpu.buffer)], [0, 0, 3, 4, 5, 0]);
    assert.deepEqual(attribut.updateRanges, []);
  });
}

test('une petite flèche ne téléverse pas sa réserve de 4096 sommets', () => {
  const maille = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicNodeMaterial());
  const tampon = creerTampon(maille, { sommets: 4096, indices: 8192 });
  const ecrire = (n: number) => tampon.ecrire({
    attributs: { position: { valeurs: new Float32Array(n * 3), taille: 3 } },
    indices: new Uint32Array(n),
  });
  ecrire(300);
  ecrire(12); // Deux écritures avant le dessin : seule la dernière est utilisée.
  assert.deepEqual((maille.geometry.getAttribute('position') as THREE.BufferAttribute).updateRanges, [{ start: 0, count: 36 }]);
  assert.deepEqual(maille.geometry.index!.updateRanges, [{ start: 0, count: 12 }]);
  assert.equal(tampon.dessines, 12);
  assert.equal(tampon.reallocations, 1);
  const octets = (36 + 12) * 4;
  const reserve = (4096 * 3 + 8192) * 4;
  assert.equal(octets, 192);
  assert.equal(reserve, 81920);
  assert.ok(octets < reserve / 100);
  tampon.dispose();
});
