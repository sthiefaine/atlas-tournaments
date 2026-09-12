import { controlerDepot } from '../src/serveur/depot-modeles';
/** Deterministic shared vehicle geometry. Run: npx tsx scripts/generer-antiair.ts.
 * Six rigid nodes, no nation-dependent geometry. Atlas addresses are keyed by
 * physical part and retained at every LOD. No illumination enters the albedo.
 */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './infanterie/gltf';
import { lireSpec } from './controler-asset';
import { validerGlb } from '../src/assets';

const ID = 'unite_antiair_base';
const texturesExistantes = path.resolve('public/assets/modeles');
const delivery = path.resolve('assets/livraisons', ID);
type V = [number, number, number];
type Finish = 'paint' | 'team' | 'rubber' | 'metal' | 'dish' | 'signal';
const slots = new Map<string, { index: number; finish: Finish }>();
const names = ['racine', 'corps', 'base', 'socle', 'module_tourelle', 'module_radar'] as const;
type NodeName = typeof names[number];
const pivots: Record<NodeName, V> = {
  racine: [0, 0, 0], base: [0, 0, 0], corps: [0, 0.16, 0],
  module_tourelle: [0, 0.265, 0], module_radar: [0, 0.365, -0.17], socle: [0, 0.32, 0.178],
};
const parents: Partial<Record<NodeName, NodeName>> = {
  base: 'racine', corps: 'racine', module_tourelle: 'corps', module_radar: 'module_tourelle', socle: 'module_tourelle',
};
const materials = ['mat_corps', 'mat_details'].map(name => new T.MeshStandardMaterial({ name, roughness: 1, metalness: 1 }));

function build(lod: number) {
  const reperes: Record<string, { min: number[]; max: number[] }> = {};
  const pieces = new Map<NodeName, [T.BufferGeometry[], T.BufferGeometry[]]>();
  for (const name of names) pieces.set(name, [[], []]);
  function add(key: string, node: NodeName, finish: Finish, g: T.BufferGeometry, pos: V, rotation: V = [0, 0, 0]) {
    if (!slots.has(key)) slots.set(key, { index: slots.size, finish });
    const slot = slots.get(key)!;
    if (slot.index >= 256) throw new Error('UV atlas exhausted');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      // Four texels of dilation at 512², UV safely inside each 32px tile.
      uv.setXY(i, ((slot.index % 16) + 0.125 + uv.getX(i) * 0.75) / 16,
        (Math.floor(slot.index / 16) + 0.125 + (1 - uv.getY(i)) * 0.75) / 16);
    }
    g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation)));
    const p = pivots[node];
    g.translate(pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (['hull', 'track--1', 'track-1', 'marker--1', 'marker-1', 'radar-dish'].includes(key)) {
      g.computeBoundingBox();
      const b = g.boundingBox!.clone().translate(new T.Vector3(...p));
      reperes[key] = { min: b.min.toArray(), max: b.max.toArray() };
    }
    const source = g.index ? g.toNonIndexed() : g;
    // Lathe poles contain collapsed triangles; remove them before export.
    const positions = source.getAttribute('position'), sourceUv = source.getAttribute('uv'), sourceNormal = source.getAttribute('normal');
    const keptPositions: number[] = [], keptUv: number[] = [], keptNormals: number[] = [];
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) continue;
      for (let j = i; j < i + 3; j++) { keptPositions.push(positions.getX(j), positions.getY(j), positions.getZ(j)); keptUv.push(sourceUv.getX(j), sourceUv.getY(j)); keptNormals.push(sourceNormal.getX(j), sourceNormal.getY(j), sourceNormal.getZ(j)); }
    }
    const flat = new T.BufferGeometry();
    flat.setAttribute('position', new T.Float32BufferAttribute(keptPositions, 3));
    flat.setAttribute('uv', new T.Float32BufferAttribute(keptUv, 2));
    // Garder les normales lisses des courbes, et les arêtes franches des plaques.
    flat.setAttribute('normal', new T.Float32BufferAttribute(keptNormals, 3));
    pieces.get(node)![finish === 'paint' || finish === 'team' ? 0 : 1].push(flat);
  }
  function box(key: string, node: NodeName, finish: Finish, pos: V, size: V, rotation?: V) {
    const g = new T.BoxGeometry(...size);
    // Each cube face has its own region, so kits can paint front/back separately.
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);
      uv.setXY(i, (f % 3 + 0.08 + uv.getX(i) * 0.84) / 3, (Math.floor(f / 3) + 0.08 + uv.getY(i) * 0.84) / 2);
    }
    add(key, node, finish, g, pos, rotation);
  }
  function cylinder(key: string, node: NodeName, finish: Finish, pos: V, radius: number, length: number, axis: 'x' | 'y' | 'z', n = [24, 8, 6][lod]!) {
    add(key, node, finish, new T.CylinderGeometry(radius, radius, length, n, 1), pos,
      axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
  }
  // A broad sloping hull; reduced top footprint makes the cheeks read at 65°.
  function hull(key: string, node: NodeName, finish: Finish, pos: V, lower: V, top: V) {
    const g = new T.BoxGeometry(...lower);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * top[0] / lower[0], p.getY(i), p.getZ(i) * top[2] / lower[2]);
    g.computeVertexNormals();
    add(key, node, finish, g, pos);
  }
  hull('hull', 'corps', 'paint', [0, 0.19, -0.015], [0.49, 0.15, 0.75], [0.36, 0.15, 0.56]);
  box('front-team', 'corps', 'team', [0, 0.181, 0.329], [0.32, 0.09, 0.014], [-0.88, 0, 0]);
  box('rear-deck', 'corps', 'paint', [0, 0.27, -0.236], [0.31, 0.018, 0.15]);
  if (lod < 2) {
    for (let i = 0; i < 5; i++) box(`vent-${i}`, 'corps', 'rubber', [0, 0.281, -0.285 + i * 0.021], [0.20, 0.008, 0.007]);
    for (const s of [-1, 1]) {
      box(`fender-${s}`, 'corps', 'paint', [s * 0.259, 0.205, -0.015], [0.095, 0.022, 0.57]);
      box(`rear-latch-${s}`, 'corps', 'metal', [s * 0.137, 0.176, -0.393], [0.035, 0.032, 0.012]);
    }
  }
  // Extruded octagonal annular tracks, open on the sides: road wheels visible.
  const outer = [[-0.425, 0.067], [-0.357, 0], [0.357, 0], [0.425, 0.067], [0.425, 0.14], [0.357, 0.21], [-0.357, 0.21], [-0.425, 0.14]];
  const inner = outer.map(([z, y]) => [z! * 0.91, 0.105 + (y! - 0.105) * 0.64]);
  for (const s of [-1, 1]) {
    const vertices: number[] = [], uvs: number[] = [];
    function quad(points: V[]) {
      for (const j of [0, 1, 2, 0, 2, 3]) { vertices.push(...points[j]!); uvs.push(...([[0, 0], [1, 0], [1, 1], [0, 1]][j]!)); }
    }
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const a = outer[i]!, b = outer[j]!, c = inner[i]!, d = inner[j]!;
      const x0 = s * 0.253 - 0.057, x1 = s * 0.253 + 0.057;
      quad([[x0, a[1]!, a[0]!], [x1, a[1]!, a[0]!], [x1, b[1]!, b[0]!], [x0, b[1]!, b[0]!]]);
      quad([[x0, d[1]!, d[0]!], [x1, d[1]!, d[0]!], [x1, c[1]!, c[0]!], [x0, c[1]!, c[0]!]]);
      quad([[x0, c[1]!, c[0]!], [x0, a[1]!, a[0]!], [x0, b[1]!, b[0]!], [x0, d[1]!, d[0]!]]);
      quad([[x1, a[1]!, a[0]!], [x1, c[1]!, c[0]!], [x1, d[1]!, d[0]!], [x1, b[1]!, b[0]!]]);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    add(`track-${s}`, 'base', 'rubber', g, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      cylinder(`wheel-${s}-${i}`, 'base', 'metal', [s * 0.263, 0.101, -0.285 + i * 0.19], 0.072, 0.082, 'x');
      if (lod < 2) {
        cylinder(`tire-${s}-${i}`, 'base', 'rubber', [s * 0.261, 0.101, -0.285 + i * 0.19], 0.079, 0.065, 'x');
        cylinder(`hub-${s}-${i}`, 'base', 'paint', [s * 0.307, 0.101, -0.285 + i * 0.19], 0.032, 0.006, 'x', 12);
      }
    }
    // Broad rubber shoes over the continuous belt, no disconnected track links.
    if (lod < 2) for (let i = 0; i < (lod === 0 ? 17 : 10); i++) {
      const z = -0.335 + i * 0.67 / (lod === 0 ? 16 : 9);
      box(`pad-top-${s}-${i}`, 'base', 'rubber', [s * 0.253, 0.214, z], [0.102, 0.008, 0.025]);
      if (lod === 0) box(`pad-side-${s}-${i}`, 'base', 'rubber', [s * 0.307, 0.031, z], [0.006, 0.044, 0.025]);
    }
  }
  cylinder('turret-bearing', 'module_tourelle', 'metal', [0, 0.272, 0], 0.14, 0.025, 'y');
  hull('turret', 'module_tourelle', 'paint', [0, 0.324, 0], [0.335, 0.095, 0.34], [0.27, 0.095, 0.29]);
  for (const s of [-1, 1]) {
    box(`turret-team-${s}`, 'module_tourelle', 'team', [s * 0.158, 0.318, 0.008], [0.012, 0.066, 0.229], [0, 0, s * 0.33]);
    cylinder(`marker-${s}`, 'module_tourelle', 'paint', [s * 0.09, 0.331, 0.249], 0.042, 0.228, 'z');
    cylinder(`muzzle-${s}`, 'module_tourelle', 'metal', [s * 0.09, 0.331, 0.35], 0.047, 0.027, 'z', lod === 2 ? 4 : [24, 8][lod]!);
    cylinder(`aperture-${s}`, 'module_tourelle', 'rubber', [s * 0.09, 0.331, 0.364], 0.031, 0.003, 'z', lod === 2 ? 4 : [24, 8][lod]!);
  }
  if (lod < 2) box('turret-hatch', 'module_tourelle', 'metal', [0, 0.375, 0.023], [0.106, 0.01, 0.12]);
  // Hinged radar support: all its vertices are above the hinge; folds as one module.
  box('radar-arm', 'module_radar', 'metal', [0, 0.402, -0.17], [0.032, 0.079, 0.034], [-0.32, 0, 0]);
  if (lod < 2) cylinder('radar-hinge', 'module_radar', 'paint', [0, 0.372, -0.169], 0.025, 0.059, 'x', 12);
  // Thick shallow concave dish, angled upwards for top-down readability.
  const n = [32, 12, 6][lod]!;
  const dish = new T.LatheGeometry([new T.Vector2(0, -0.017), new T.Vector2(0.095, 0.006), new T.Vector2(0.098, 0.026), new T.Vector2(0.083, 0.019), new T.Vector2(0, -0.005)], n);
  add('radar-dish', 'module_radar', 'dish', dish, [0, 0.447, -0.178], [0.32, 0, 0]);
  if (lod < 2) cylinder('dish-feed', 'module_radar', 'metal', [0, 0.464, -0.173], 0.015, 0.035, 'y', 12);
  // Status lamp on an existing named rigid node: scale hides it on switch-off.
  box('status', 'socle', 'signal', pivots.socle, [0.046, 0.018, 0.01]);
  const nodes = new Map<NodeName, T.Object3D>();
  let triangles = 0;
  for (const name of names) {
    const groups = pieces.get(name)!;
    const geos: T.BufferGeometry[] = [];
    const indices: number[] = [];
    groups.forEach((gs, m) => { if (gs.length) { geos.push(mergeGeometries(gs, false)!); indices.push(m); } });
    let node: T.Object3D;
    if (geos.length) {
      const g = mergeGeometries(geos, true)!;
      g.groups.forEach((group, i) => { group.materialIndex = indices[i]!; });
      triangles += g.getAttribute('position').count / 3;
      node = new T.Mesh(g, materials);
    } else node = new T.Group();
    node.name = name;
    const parent = parents[name];
    node.position.fromArray(pivots[name]);
    if (parent) node.position.sub(new T.Vector3(...pivots[parent]));
    nodes.set(name, node);
  }
  for (const name of names) if (parents[name]) nodes.get(parents[name]!)!.add(nodes.get(name)!);
  const root = nodes.get('racine')!;
  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root);
  return { root, triangles, bounds, nodes, reperes };
}

function clips() {
  return [['repos', 2.4], ['deplacement', 1], ['tir', 0.7], ['touche', 0.5], ['hors_jeu', 0.9]].map(([name, duration]) => {
    const d = duration as number, count = 24;
    const times = Array.from({ length: count + 1 }, (_, i) => i * d / count);
    const tracks: T.KeyframeTrack[] = [];
    for (const node of ['corps', 'module_tourelle', 'module_radar', 'socle'] as const) {
      const rots: number[] = [], positions: number[] = [], scales: number[] = [];
      for (const t of times) {
        const u = t / d, wave = Math.sin(u * Math.PI * 2), pulse = Math.sin(Math.PI * u) ** 2;
        let x = 0, y = 0, z = 0, dy = 0, dz = 0, scale = 1;
        if (name === 'repos') { if (node === 'module_radar') y = u * Math.PI * 2; if (node === 'module_tourelle') y = 0.035 * wave; }
        if (name === 'deplacement') { if (node === 'corps') { x = 0.016 * Math.sin(u * Math.PI * 4); dy = 0.004 * (1 - Math.cos(u * Math.PI * 4)); } if (node === 'module_radar') y = u * Math.PI * 2; }
        if (name === 'tir' && node === 'module_tourelle') { const kick = Math.exp(-(((u - 0.36) / 0.12) ** 2)) * pulse; dz = -0.025 * kick; x = -0.07 * kick; }
        if (name === 'touche' && node === 'corps') { z = 0.045 * pulse * Math.sin(u * Math.PI * 3); x = -0.03 * pulse; }
        if (name === 'hors_jeu') {
          const s = u * u * (3 - 2 * u);
          if (node === 'corps') { dy = -0.022 * s; x = 0.03 * s; }
          if (node === 'module_tourelle') x = 0.09 * s;
          if (node === 'module_radar') { x = -1.1 * s; y = 0.2 * s; }
          if (node === 'socle') scale = 1 - Math.min(1, Math.max(0, (u - 0.45) / 0.15));
        }
        const q = new T.Quaternion().setFromEuler(new T.Euler(x, y, z)); rots.push(...q.toArray());
        const p = new T.Vector3(...pivots[node]).sub(new T.Vector3(...pivots[parents[node]!]));
        positions.push(p.x, p.y + dy, p.z + dz); scales.push(scale, scale, scale);
      }
      tracks.push(new T.QuaternionKeyframeTrack(`${node}.quaternion`, times, rots), new T.VectorKeyframeTrack(`${node}.position`, times, positions));
      if (node === 'socle') tracks.push(new T.VectorKeyframeTrack(`${node}.scale`, times, scales));
    }
    return new T.AnimationClip(name as string, d, tracks);
  });
}

/** Les six PNG existants sont conservés à l’octet près ; aucune nouvelle peinture. */
function textures() {
  return new Map(['albedo', 'normale', 'rugosite', 'metal', 'masque_equipe', 'emission'].map(channel => {
    const nom = `${ID}_${channel}.png`, livre = path.join(delivery, nom);
    return [channel, readFileSync(existsSync(livre) ? livre : path.join(texturesExistantes, nom))];
  }));
}

async function main() {
  const spec = lireSpec(`assets/specs/${ID}.json`);
  const scenes = [0].map(build);
  const maps = textures(), animations = clips();
  // glTF lit rugosité en G et métal en B : une seule carte partagée entre LODs.
  const files = new Map<string, Uint8Array>();
  for (const [channel, data] of maps) if (channel !== 'orm') files.set(`${ID}_${channel}.png`, data);
  const report: unknown[] = [];
  for (const lod of [0] as const) {
    const scene = scenes[lod]!;
    const { document, bin } = decouperGlb(await exporterGlb(scene.root, animations));
    const images: unknown[] = [], tex: unknown[] = [];
    for (const channel of maps.keys()) {
      images.push({ name: `${ID}_${channel}.png`, uri: `${ID}_${channel}.png`, mimeType: 'image/png' });
      tex.push({ name: channel, source: images.length - 1, sampler: channel === 'masque_equipe' ? 1 : 0 });
    }
    document.images = images; document.textures = tex;
    document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }, { magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }];
    for (const m of document.materials as Record<string, unknown>[]) {
      const pbr = m.pbrMetallicRoughness as Record<string, unknown>;
      pbr.baseColorTexture = { index: 0 }; pbr.metallicRoughnessTexture = { index: 2 };
      m.normalTexture = { index: 1, scale: 0.5 }; m.emissiveTexture = { index: 5 }; m.emissiveFactor = [1, 1, 1];
      m.extras = { masque_equipe: `${ID}_masque_equipe.png`, teamMaskTexture: 4 };
    }
    (document.animations as Record<string, unknown>[]).forEach(a => { a.extras = { loop: ['repos', 'deplacement'].includes(a.name as string) }; });
    document.extras = { units: 'metre', up: '+Y', front: '+Z', teamMaskTexture: 4, bulk: 2,
      role: { funds: 7500, movement: 6, movementType: 'chenilles', range: [1, 1], vision: 2, traits: ['anti_air'] } };
    const glb = assemblerGlb(document, bin);
    const verdict = validerGlb(glb, spec, { lod, fichiersLivres: [...files.keys(), ...[0].map(n => `${ID}_lod${n}.glb`)] });
    if (!verdict.ok) throw new Error(JSON.stringify({ lod, verdict }));
    if (scene.triangles > spec.budget[`lod${lod}`]) throw new Error(`lod${lod}: ${scene.triangles} triangles`);
    files.set(`${ID}_lod${lod}.glb`, glb);
    report.push({ lod, triangles: scene.triangles, dimensions: scene.bounds.getSize(new T.Vector3()).toArray(), min: scene.bounds.min.toArray(), max: scene.bounds.max.toArray(), verdict });
  }
  const reception = controlerDepot(spec, [...files].map(([nom, octets]) => ({ nom, octets })));
  if (!reception.ok) throw new Error(JSON.stringify(reception));
  mkdirSync(delivery, { recursive: true });
  for (const [name, bytes] of files) writeFileSync(path.join(delivery, name), bytes);
  writeFileSync(path.join(delivery, 'validation.json'), JSON.stringify(report, null, 2));
  // Projections numériques des trois repères, sans capture ni jugement de silhouette.
  const projections = Object.fromEntries([['dessus', 90, 0], ['trois_quarts', 45, 45], ['jeu_65', 65, 0]].map(([nom, elevation, azimut]) => {
    const e = Number(elevation) * Math.PI / 180, a = Number(azimut) * Math.PI / 180;
    return [nom, Object.fromEntries(Object.entries(scenes[0]!.reperes).map(([cle, b]) => {
      const points = [b.min[0]!, b.max[0]!].flatMap(x => [b.min[1]!, b.max[1]!].flatMap(y => [b.min[2]!, b.max[2]!].map(z => [48 * (x * Math.cos(a) - z * Math.sin(a)), 48 * (y * Math.cos(e) - (x * Math.sin(a) + z * Math.cos(a)) * Math.sin(e))])));
      return [cle, { largeurPx: Math.max(...points.map(p => p[0]!)) - Math.min(...points.map(p => p[0]!)), hauteurPx: Math.max(...points.map(p => p[1]!)) - Math.min(...points.map(p => p[1]!)) }];
    }))];
  }));
  writeFileSync(path.join(delivery, 'reperes.json'), JSON.stringify({ pixelsParMetre: 48, methode: 'projection_des_boites_englobantes_sans_rendu', validationArtistique: false, reperes: scenes[0]!.reperes, projections }, null, 2) + '\n');
  writeFileSync(path.join(delivery, 'atlas.json'), JSON.stringify({ grid: 16, uvOrigin: 'glTF image top-left', paddingAt512: 4, parts: Object.fromEntries(slots) }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
void main();
