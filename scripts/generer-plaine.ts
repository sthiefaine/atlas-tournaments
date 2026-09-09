import { controlerDepot } from '../src/serveur/depot-modeles';
/** Flat tournament turf. Generate textures first with scripts/plaine/textures.py. */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './infanterie/gltf';
import { lireSpec } from './controler-asset';
import { validerGlb } from '../src/assets';

const ID = 'terrain_plaine';
const destination = path.resolve('public/assets/modeles');
const livraison = path.resolve('assets/livraisons', ID);
// First float32 above 0.02, avoiding rejection from rounding below the lower bound.
const HEIGHT = Math.fround(0.020000001);
const channels = ['albedo', 'normale', 'rugosite', 'occlusion'];


async function main() {
  const spec = lireSpec(`assets/specs/${ID}.json`);
  const pending = new Map<string, Uint8Array>();
  const report: unknown[] = [];
  for (const lod of [0, 1] as const) {
    const subdivisions = lod === 0 ? 16 : 8;
    const top = new T.PlaneGeometry(1, 1, subdivisions, subdivisions);
    top.rotateX(-Math.PI / 2);
    // Exact flat top, no displacement, bump geometry or residual rotation noise.
    const p = top.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, HEIGHT);
    const normals = top.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
    const casing = new T.BoxGeometry(1, HEIGHT, 1).toNonIndexed();
    casing.translate(0, HEIGHT / 2, 0);
    const components: T.BufferGeometry[] = [top.toNonIndexed()];
    // Four vertical edges and a bottom form a level slab; omit duplicate top.
    for (const group of casing.groups) {
      if (group.materialIndex === 2) continue;
      const g = new T.BufferGeometry();
      for (const attr of ['position', 'normal', 'uv']) {
        const a = casing.getAttribute(attr);
        g.setAttribute(attr, new T.Float32BufferAttribute(Array.from(a.array).slice(group.start * a.itemSize, (group.start + group.count) * a.itemSize), a.itemSize));
      }
      components.push(g);
    }
    const geometry = mergeGeometries(components, false)!;
    const root = new T.Group(); root.name = 'racine';
    const sol = new T.Mesh(geometry, new T.MeshStandardMaterial({ name: 'mat_sol', roughness: 1, metalness: 0 }));
    sol.name = 'sol'; root.add(sol);
    const { document, bin } = decouperGlb(await exporterGlb(root, []));
    document.images = channels.map(channel => ({ name: `${ID}_${channel}.png`, uri: `${ID}_${channel}.png`, mimeType: 'image/png' }));
    document.textures = channels.map((name, source) => ({ name, source, sampler: 0 }));
    document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    const material = (document.materials as Record<string, unknown>[])[0]!;
    const pbr = material.pbrMetallicRoughness as Record<string, unknown>;
    pbr.baseColorTexture = { index: 0 };
    // Roughness PNG is grayscale; G supplies roughness, metallicFactor stays 0.
    pbr.metallicRoughnessTexture = { index: 2 };
    material.normalTexture = { index: 1, scale: 1 };
    material.occlusionTexture = { index: 3, strength: 1 };
    document.extras = { units: 'metre', up: '+Y', front: '+Z', grid: 'P', defence: 1,
      flatTop: true, slabThickness: HEIGHT, terrainReliefOwnedByRenderer: true,
      seamlessRotations: [0, 90, 180, 270], textureSource: 'deterministic procedural turf, no baked lighting' };
    const bytes = assemblerGlb(document, bin);
    const verdict = validerGlb(bytes, spec, { lod });
    if (!verdict.ok) throw new Error(JSON.stringify(verdict));
    const bounds = new T.Box3().setFromObject(root);
    report.push({ lod, triangles: geometry.getAttribute('position').count / 3,
      dimensions: bounds.getSize(new T.Vector3()).toArray(), min: bounds.min.toArray(), max: bounds.max.toArray(), verdict });
    pending.set(`${ID}_lod${lod}.glb`, bytes);
  }
  const lot = [...pending].map(([nom, octets]) => ({ nom, octets }));
  for (const canal of channels) { const nom = `${ID}_${canal}.png`; lot.push({ nom, octets: readFileSync(path.join(destination, nom)) }); }
  const reception = controlerDepot(spec, lot);
  if (!reception.ok) throw new Error(JSON.stringify(reception));
  mkdirSync(livraison, { recursive: true });
  for (const [name, data] of pending) writeFileSync(path.join(destination, name), data);
  writeFileSync(path.join(livraison, 'validation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
void main();
