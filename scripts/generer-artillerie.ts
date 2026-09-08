/** Deterministic shared vehicle geometry. Run: npx tsx scripts/generer-artillerie.ts.
 * Five rigid nodes, no nation-dependent geometry. Atlas addresses are keyed by
 * physical part and retained at every LOD. No illumination enters the albedo.
 */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { creerImage, encoderPng, pixel, type Rvb } from '../src/render/apercu/png';
import { exporterGlb, decouperGlb, assemblerGlb } from './infanterie/gltf';
import { lireSpec } from './controler-asset';
import { validerGlb } from '../src/assets';

const ID = 'unite_artillerie_base';
const out = path.resolve('public/assets/modeles');
const delivery = path.resolve('assets/livraisons', ID);
type V = [number, number, number];
type Finish = 'paint' | 'team' | 'rubber' | 'metal' | 'glass' | 'deck' | 'signal';
const slots = new Map<string, { index: number; finish: Finish }>();
const finishes: Record<Finish, { color: Rvb; rough: number; metal: number }> = {
  paint: { color: [107, 118, 123], rough: 0.57, metal: 0 },
  team: { color: [170, 170, 170], rough: 0.5, metal: 0 },
  rubber: { color: [38, 42, 43], rough: 0.91, metal: 0 },
  metal: { color: [142, 151, 157], rough: 0.34, metal: 0.92 },
  signal: { color: [28, 210, 119], rough: 0.54, metal: 0 },
  glass: { color: [27, 58, 66], rough: 0.18, metal: 0 },
  deck: { color: [86, 96, 98], rough: 0.82, metal: 0 },
};
const names = ['racine', 'corps', 'base', 'socle', 'module_canon_long'] as const;
type NodeName = typeof names[number];
const pivots: Record<NodeName, V> = {
  racine: [0, 0, 0], base: [0, 0, 0], corps: [0, 0.16, 0],
  module_canon_long: [0, 0.315, -0.13], socle: [0, 0.185, -0.28],
};
const parents: Partial<Record<NodeName, NodeName>> = {
  base: 'racine', corps: 'racine', module_canon_long: 'corps', socle: 'racine',
};
const materials = ['mat_corps', 'mat_details'].map(name => new T.MeshStandardMaterial({ name, roughness: 1, metalness: 1 }));

function build(lod: number) {
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
    const source = g.index ? g.toNonIndexed() : g;
    // Lathe poles contain collapsed triangles; remove them before export.
    const positions = source.getAttribute('position'), sourceUv = source.getAttribute('uv');
    const keptPositions: number[] = [], keptUv: number[] = [];
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) continue;
      for (let j = i; j < i + 3; j++) { keptPositions.push(positions.getX(j), positions.getY(j), positions.getZ(j)); keptUv.push(sourceUv.getX(j), sourceUv.getY(j)); }
    }
    const flat = new T.BufferGeometry();
    flat.setAttribute('position', new T.Float32BufferAttribute(keptPositions, 3));
    flat.setAttribute('uv', new T.Float32BufferAttribute(keptUv, 2));
    flat.computeVertexNormals();
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
  function cylinder(key: string, node: NodeName, finish: Finish, pos: V, radius: number, length: number, axis: 'x' | 'y' | 'z', n = [12, 8, 6][lod]!) {
    add(key, node, finish, new T.CylinderGeometry(radius, radius, length, n, 1), pos,
      axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
  }
  // A broad sloping hull; reduced top footprint makes the cheeks read at 65°.
  function hull(key: string, node: NodeName, finish: Finish, pos: V, lower: V, top: V) {
    const g = new T.BoxGeometry(...lower);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * top[0] / lower[0], p.getY(i), p.getZ(i) * top[2] / lower[2]);
    add(key, node, finish, g, pos);
  }
  // Open flat carrier: no turret housing or enclosing shield.
  box('deck', 'corps', 'paint', [0, 0.194, 0.0425], [0.47, 0.044, 0.645]);
  box('work-platform', 'corps', 'deck', [0, 0.221, -0.058], [0.39, 0.01, 0.366]);
  for (const side of [-1, 1]) {
    box(`deck-skirt-${side}`, 'corps', 'team', [side * 0.235, 0.185, 0.033], [0.014, 0.065, 0.573]);
  }
  // Compact offset operator cab, with glazing, forward of the exposed mount.
  hull('front-cab', 'corps', 'paint', [-0.132, 0.287, 0.245], [0.195, 0.144, 0.238], [0.175, 0.144, 0.203]);
  box('windscreen', 'corps', 'glass', [-0.132, 0.311, 0.358], [0.145, 0.065, 0.008], [-0.13, 0, 0]);
  if (lod < 2) box('cab-side-window', 'corps', 'glass', [-0.226, 0.312, 0.253], [0.006, 0.062, 0.115], [0, 0, -0.07]);
  if (lod < 2) {
    box('cab-roof', 'corps', 'paint', [-0.132, 0.365, 0.243], [0.196, 0.016, 0.228]);
    for (let i = 0; i < 4; i++) box(`front-vent-${i}`, 'corps', 'rubber', [-0.132, 0.232 + i * 0.013, 0.366], [0.12, 0.005, 0.006]);
  }
  // Folded crew ladder laid along the right side, with a visible hinge.
  for (const rail of [-1, 1]) box(`ladder-rail-${rail}`, 'corps', 'metal', [0.273, 0.235 + rail * 0.025, 0.02], [0.022, 0.014, 0.25]);
  for (let i = 0; i < (lod === 2 ? 2 : 4); i++) box(`ladder-rung-${i}`, 'corps', 'metal', [0.274, 0.235, -0.075 + i * (lod === 2 ? 0.19 : 0.064)], [0.021, 0.044, 0.012]);
  if (lod < 2) cylinder('ladder-hinge', 'corps', 'paint', [0.271, 0.23, -0.125], 0.023, 0.04, 'x', 8);
  // A low travel saddle receives the marker tube when the carrier moves.
  if (lod < 2) box('travel-lock-pedestal', 'corps', 'metal', [0.028, 0.245, 0.248], [0.075, 0.048, 0.054]);
  for (const side of [-1, 1]) box(`travel-lock-jaw-${side}`, 'corps', 'rubber', [0.028 + side * 0.043, 0.289, 0.248], [0.018, 0.07, 0.048]);
  // Open A-frame cradle: team-painted cheeks remain visibly separated.
  for (const side of [-1, 1]) {
    box(`cradle-${side}`, 'corps', 'team', [0.028 + side * 0.071, 0.276, -0.13], [0.027, 0.113, 0.115], [0, 0, side * 0.13]);
    if (lod < 2) cylinder(`pivot-cap-${side}`, 'corps', 'metal', [0.028 + side * 0.093, 0.315, -0.13], 0.034, 0.014, 'x', 8);
  }
  // Extruded octagonal annular tracks, open on the sides: road wheels visible.
  const outer = [[-0.34, 0.067], [-0.286, 0], [0.357, 0], [0.425, 0.067], [0.425, 0.14], [0.357, 0.21], [-0.286, 0.21], [-0.34, 0.14]];
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
    for (let i = 0; i < (lod === 2 ? 3 : 4); i++) {
      cylinder(`wheel-${s}-${i}`, 'base', 'metal', [s * 0.263, 0.101, -0.242 + i * (lod === 2 ? 0.254 : 0.16933)], 0.072, 0.082, 'x');
      if (lod < 2) {
        cylinder(`tire-${s}-${i}`, 'base', 'rubber', [s * 0.261, 0.101, -0.242 + i * (lod === 2 ? 0.254 : 0.16933)], 0.079, 0.065, 'x');
        cylinder(`hub-${s}-${i}`, 'base', 'paint', [s * 0.307, 0.101, -0.242 + i * (lod === 2 ? 0.254 : 0.16933)], 0.032, 0.006, 'x', 8);
      }
    }
    // Broad rubber shoes over the continuous belt, no disconnected track links.
    if (lod < 2) for (let i = 0; i < (lod === 0 ? 17 : 10); i++) {
      const z = -0.255 + i * 0.59 / (lod === 0 ? 16 : 9);
      box(`pad-top-${s}-${i}`, 'base', 'rubber', [s * 0.253, 0.214, z], [0.102, 0.008, 0.025]);
      if (lod === 0) box(`pad-side-${s}-${i}`, 'base', 'rubber', [s * 0.307, 0.031, z], [0.006, 0.044, 0.025]);
    }
  }
  // Twin ground spades share one transverse hinge and fold in synchrony.
  // At rest their soles touch Y=0; moving raises them entirely clear of the ground.
  for (const side of [-1, 1]) {
    box(`spade-arm-${side}`, 'socle', 'metal', [side * 0.154, 0.108, -0.332], [0.03, 0.184, 0.032], [0.59, 0, 0]);
    box(`spade-sole-${side}`, 'socle', 'metal', [side * 0.154, 0.016, -0.384], [0.115, 0.032, 0.082]);
    if (lod < 2) {
      cylinder(`spade-hinge-${side}`, 'corps', 'paint', [side * 0.154, 0.185, -0.28], 0.027, 0.056, 'x', 8);
      box(`spade-rib-${side}`, 'socle', 'paint', [side * 0.154, 0.037, -0.389], [0.022, 0.028, 0.069]);
    }
  }
  // Mechanical ready tab: visible while elevated, retracts into the dark
  // switch housing as the tube parks. No emissive texture or extra node.
  box('ready-tab', 'module_canon_long', 'signal', [0.103, 0.335, -0.052], [0.026, 0.01, 0.022]);
  box('switch-housing', 'corps', 'rubber', [0.103, 0.317, -0.052], [0.037, 0.025, 0.035]);
  // A single exposed long marker tube; elevation is supplied by the pivot node.
  // Build the raised rest pose around the trunnion, then animate relative to it.
  const elevation = 0.265;
  function barrel(key: string, finish: Finish, radius: number, length: number, along: number, n = [16, 10, 6][lod]!) {
    const g = new T.CylinderGeometry(radius, radius, length, n, 1);
    g.rotateX(Math.PI / 2);
    g.translate(0.028, 0, along);
    g.rotateX(-elevation);
    add(key, 'module_canon_long', finish, g, pivots.module_canon_long);
  }
  barrel('long-marker-tube', 'paint', 0.033, 0.54, 0.22);
  barrel('breech-sleeve', 'metal', 0.047, 0.15, -0.053);
  barrel('muzzle-collar', 'metal', 0.041, 0.042, 0.475);
  barrel('marker-opening', 'rubber', 0.028, 0.004, 0.498, lod === 2 ? 4 : 10);
  if (lod < 2) {
    barrel('tube-band', 'rubber', 0.036, 0.025, 0.19);
    // Visible linear recoil buffer, not a protective shell.
    const buffer = new T.CylinderGeometry(0.022, 0.022, 0.24, 8, 1);
    buffer.rotateX(Math.PI / 2); buffer.translate(0.028, -0.057, 0.08); buffer.rotateX(-elevation);
    add('recoil-buffer', 'module_canon_long', 'metal', buffer, pivots.module_canon_long);
    box('breech-handle', 'module_canon_long', 'rubber', [0.106, 0.299, -0.217], [0.047, 0.023, 0.023]);
  }
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
  return { root, triangles, bounds, nodes };
}

function clips() {
  return [['repos', 2.4], ['deplacement', 1], ['tir', 0.7], ['touche', 0.5], ['hors_jeu', 0.9]].map(([name, duration]) => {
    const d = duration as number, count = 28;
    const times = Array.from({ length: count + 1 }, (_, i) => i * d / count);
    const tracks: T.KeyframeTrack[] = [];
    for (const node of ['corps', 'module_canon_long', 'socle'] as const) {
      const rots: number[] = [], positions: number[] = [];
      for (const t of times) {
        const u = t / d, wave = Math.sin(u * Math.PI * 2), pulse = Math.sin(Math.PI * u) ** 2;
        let x = 0, z = 0, dy = 0, dz = 0;
        if (name === 'repos' && node === 'module_canon_long') x = 0.003 * wave;
        if (name === 'deplacement') {
          if (node === 'corps') { x = 0.012 * Math.sin(u * Math.PI * 4); dy = 0.003 * (1 - Math.cos(u * Math.PI * 4)); }
          if (node === 'module_canon_long') x = 0.265;
          if (node === 'socle') x = -1.65;
        }
        if (name === 'tir' && node === 'module_canon_long') {
          const kick = Math.exp(-(((u - 0.38) / 0.11) ** 2)) * pulse;
          dz = -0.035 * kick; dy = -0.0095 * kick; x = -0.022 * kick;
        }
        if (name === 'touche' && node === 'corps') { z = 0.035 * pulse * Math.sin(u * Math.PI * 3); x = -0.024 * pulse; }
        if (name === 'hors_jeu') {
          const s = u * u * (3 - 2 * u);
          if (node === 'corps') { dy = -0.018 * s; x = -0.018 * s; }
          // Power-down parks the long tube in its rubber-lined travel lock;
          // support pressure is released, while track contact stays stationary.
          if (node === 'module_canon_long') x = 0.265 * s;
          if (node === 'socle') x = 0.16 * s;
        }
        rots.push(...new T.Quaternion().setFromEuler(new T.Euler(x, 0, z)).toArray());
        const p = new T.Vector3(...pivots[node]).sub(new T.Vector3(...pivots[parents[node]!]));
        positions.push(p.x, p.y + dy, p.z + dz);
      }
      tracks.push(new T.QuaternionKeyframeTrack(`${node}.quaternion`, times, rots), new T.VectorKeyframeTrack(`${node}.position`, times, positions));
    }
    return new T.AnimationClip(name as string, d, tracks);
  });
}

function textures() {
  const result = new Map<string, Uint8Array>();
  // Semantic per-channel PNGs; ORM is packed only inside the GLB.
  for (const channel of ['albedo', 'normale', 'rugosite', 'metal', 'masque_equipe', 'orm']) {
    const size = ['albedo', 'normale'].includes(channel) ? 1024 : 512;
    const img = creerImage(size, size, channel === 'normale' ? [128, 128, 255] : [0, 0, 0]);
    for (const { index, finish } of slots.values()) {
      const m = finishes[finish], cell = size / 16;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const noise = ((Math.imul(x + index * 19, 73) ^ Math.imul(y, 193)) & 15) / 15 - 0.5;
        let c: Rvb;
        if (channel === 'albedo') c = m.color.map(v => Math.round(v + noise * (finish === 'rubber' ? 6 : 2))) as V;
        else if (channel === 'normale') c = [Math.round(128 + noise * 5), Math.round(128 + Math.sin(x * 0.6) * (finish === 'rubber' ? 7 : 1)), 255];
        else if (channel === 'masque_equipe') c = finish === 'team' ? [255, 255, 255] : [0, 0, 0];
        else { const r = Math.round((m.rough + noise * 0.02) * 255), metal = Math.round(m.metal * 255); c = channel === 'orm' ? [255, r, metal] : channel === 'metal' ? [metal, metal, metal] : [r, r, r]; }
        pixel(img, index % 16 * cell + x, Math.floor(index / 16) * cell + y, c);
      }
    }
    result.set(channel, encoderPng(img));
  }
  return result;
}

async function main() {
  const spec = lireSpec(`assets/specs/${ID}.json`);
  const scenes = [0, 1, 2].map(build);
  const maps = textures(), animations = clips();
  const files = new Map<string, Uint8Array>();
  for (const [channel, data] of maps) if (channel !== 'orm') files.set(`${ID}_${channel}.png`, data);
  const report: unknown[] = [];
  for (const lod of [0, 1, 2] as const) {
    const scene = scenes[lod]!;
    const { document, bin } = decouperGlb(await exporterGlb(scene.root, animations));
    // Self-contained GLBs, with the five individually named maps also delivered.
    const views = document.bufferViews as Record<string, unknown>[];
    const chunks: Buffer[] = [Buffer.from(bin)]; let offset = bin.length;
    const images: unknown[] = [], tex: unknown[] = [];
    for (const [channel, bytes] of maps) {
      const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
      views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
      images.push({ name: `${ID}_${channel}.png`, mimeType: 'image/png', bufferView: views.length - 1 });
      tex.push({ name: channel, source: images.length - 1, sampler: channel === 'masque_equipe' ? 1 : 0 });
      chunks.push(Buffer.from(bytes)); offset += bytes.length;
    }
    document.images = images; document.textures = tex;
    document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }, { magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }];
    (document.buffers as Record<string, unknown>[])[0]!.byteLength = offset;
    for (const m of document.materials as Record<string, unknown>[]) {
      const pbr = m.pbrMetallicRoughness as Record<string, unknown>;
      pbr.baseColorTexture = { index: 0 }; pbr.metallicRoughnessTexture = { index: 5 };
      m.normalTexture = { index: 1, scale: 0.5 };
      m.extras = { masque_equipe: `${ID}_masque_equipe.png`, teamMaskTexture: 4 };
    }
    (document.animations as Record<string, unknown>[]).forEach(a => { a.extras = { loop: ['repos', 'deplacement'].includes(a.name as string) }; });
    document.extras = { units: 'metre', up: '+Y', front: '+Z', teamMaskTexture: 4, bulk: 2,
      role: { funds: 5500, movement: 5, movementType: 'chenilles', range: [2, 3], vision: 1, traits: ['tir_indirect'] } };
    const glb = assemblerGlb(document, Buffer.concat(chunks));
    const verdict = validerGlb(glb, spec, { lod, fichiersLivres: [...files.keys(), ...[0, 1, 2].map(n => `${ID}_lod${n}.glb`)] });
    if (!verdict.ok) throw new Error(JSON.stringify({ lod, verdict }));
    if (scene.triangles > spec.budget[`lod${lod}`]) throw new Error(`lod${lod}: ${scene.triangles} triangles`);
    files.set(`${ID}_lod${lod}.glb`, glb);
    report.push({ lod, triangles: scene.triangles, dimensions: scene.bounds.getSize(new T.Vector3()).toArray(), min: scene.bounds.min.toArray(), max: scene.bounds.max.toArray(), verdict });
  }
  mkdirSync(out, { recursive: true }); mkdirSync(delivery, { recursive: true });
  for (const [name, bytes] of files) writeFileSync(path.join(out, name), bytes);
  writeFileSync(path.join(delivery, 'validation.json'), JSON.stringify(report, null, 2));
  writeFileSync(path.join(delivery, 'atlas.json'), JSON.stringify({ grid: 16, uvOrigin: 'glTF image top-left', paddingAt512: 4, parts: Object.fromEntries(slots) }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
void main();
