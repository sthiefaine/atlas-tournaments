import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assemblerGlb, decouperGlb } from '../../scripts/infanterie/gltf';
import { extraireVegetation, geometrieGazon } from '../../src/render3d/vegetation-plaine';
import { hauteurEn, type GrilleTerrain } from '../../src/render3d/geometrie';

async function charger(lod: number) {
  const {document, bin} = decouperGlb(readFileSync(`public/assets/modeles/terrain_plaine_lod${lod}.glb`));
  // Geometry loading under Node: remove only image references, preserving real primitives and transforms.
  for (const m of document.materials as Record<string, unknown>[]) {
    delete m.normalTexture; delete m.occlusionTexture;
    const p = m.pbrMetallicRoughness as Record<string, unknown>;
    delete p.baseColorTexture; delete p.metallicRoughnessTexture;
  }
  const bytes = assemblerGlb(document, bin);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  const g = extraireVegetation(gltf.scene); assert.ok(g);
  return g;
}
test('real GLBs expose only the vegetation; grass conforms to relief and avoids water', async () => {
  const proche = await charger(0), loin = await charger(1);
  assert.equal(proche.getAttribute('position').count / 3, 1872);
  assert.equal(loin.getAttribute('position').count / 3, 384);
  const source = {proche, loin, base: .020000001};
  const grille: GrilleTerrain = {largeur: 2, hauteur: 1, terrainDe: x => x === 0 ? 'plaine' : 'riviere'};
  const before = Array.from(proche.getAttribute('position').array);
  const g = geometrieGazon(grille, source), a = g.getAttribute('position');
  assert.equal(g.userData.cases, 1);
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    assert.ok(x > 0 && x < 1 && z > 0 && z < 1);
    const h = y - hauteurEn(grille, x, z);
    assert.ok(h >= .0009 && h <= .1211, `blade height ${h}`);
  }
  assert.deepEqual(Array.from(proche.getAttribute('position').array), before);
  assert.deepEqual(g.getAttribute('position').array, geometrieGazon(grille, source).getAttribute('position').array);
  const grand = geometrieGazon({largeur: 15, hauteur: 10, terrainDe: () => 'plaine'}, source);
  assert.equal(grand.userData.lod, 1); assert.equal(grand.userData.triangles, 150 * 384);
  const carte = JSON.parse(readFileSync('content/cartes/carte_premier_contact.json', 'utf8'));
  const premierContact = geometrieGazon({largeur: carte.largeur, hauteur: carte.hauteur, terrainDe: (x,y) => carte.grille[y][x] === 'P' ? 'plaine' : 'route'}, source);
  assert.equal(premierContact.userData.lod, 0, 'Premier contact must show the detailed new grass');
  const eau = geometrieGazon({largeur: 1, hauteur: 1, terrainDe: () => 'mer'}, source);
  assert.equal(eau.getAttribute('position').count, 0);
});
