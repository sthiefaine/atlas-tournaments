/** Lecture GLTFLoader native du lot, sans images ni renderer. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

async function main() {
  const id = 'decor_rocher_cotier', out = `tmp/production-sequentielle/${id}`;
  const original = readFileSync(`${out}/${id}_lod0.glb`);
  const length = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + length).toString('utf8'));
  // Les PNG ne sont pas décodés par Node : seul ce document en mémoire perd les références.
  for (const material of document.materials) {
    delete material.normalTexture;
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
  const json = Buffer.from(JSON.stringify(document));
  const jsonPad = Buffer.alloc((json.length + 3) & ~3, 32); json.copy(jsonPad);
  const bin = original.subarray(28 + length);
  const glb = Buffer.alloc(28 + jsonPad.length + bin.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonPad.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonPad.copy(glb, 20);
  glb.writeUInt32LE(bin.length, 20 + jsonPad.length); glb.writeUInt32LE(0x004e4942, 24 + jsonPad.length); bin.copy(glb, 28 + jsonPad.length);
  const loaded = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  loaded.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(loaded.scene);
  const reference = JSON.parse(readFileSync(`${out}/mesures.json`, 'utf8'));
  const actual = [...box.min.toArray(), ...box.max.toArray()];
  const expected: number[] = [...reference.bornes.min, ...reference.bornes.max];
  const error = Math.max(...actual.map((n, i) => Math.abs(n - expected[i]!)));
  let meshes = 0, triangles = 0;
  loaded.scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes += 1;
    triangles += o.geometry.index!.count / 3;
    if (!o.geometry.getAttribute('uv') || !o.geometry.getAttribute('normal') || !o.geometry.getAttribute('tangent')) throw new Error('Attribut absent');
  });
  if (meshes !== 1 || triangles !== 858 || error > .000002 || loaded.animations.length) throw new Error('Lecture native divergente');
  writeFileSync(`${out}/mesures-natif-glb.json`, JSON.stringify({ id, triangles, meshes, animations: loaded.animations.length, ecartBornesMaxM: error, pariteNumpyDeuxMicrometres: true, sha256Glb: createHash('sha256').update(original).digest('hex'), texturesRetireesEnMemoire: true, controleVisuel: false, fpsTelephone: null }, null, 2) + '\n');
  console.log(JSON.stringify({ id, triangles, meshes, ecartBornesMaxM: error, controle: 'ok' }));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
