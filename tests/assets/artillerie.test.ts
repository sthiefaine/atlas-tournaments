/** Inspect delivered binary/PNG payloads independently of the generator. */
import { test } from 'node:test';
import * as T from 'three';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { decouperGlb } from '../../scripts/infanterie/gltf';
import { lireSpec } from '../../scripts/controler-asset';
import { validerGlb } from '../../src/assets';
const id = 'unite_artillerie_base';
const dir = 'public/assets/modeles/';
function png(channel: string) {
  const b = readFileSync(`${dir}${id}_${channel}.png`);
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  assert.equal(b[24], 8); assert.equal(b[25], 2);
  const chunks: Buffer[] = [];
  for (let p = 8; p < b.length;) { const n = b.readUInt32BE(p); if (b.toString('ascii', p + 4, p + 8) === 'IDAT') chunks.push(b.subarray(p + 8, p + 8 + n)); p += n + 12; }
  const raw = inflateSync(Buffer.concat(chunks)), rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) { assert.equal(raw[y * (width * 3 + 1)], 0); raw.copy(rgb, y * width * 3, y * (width * 3 + 1) + 1, (y + 1) * (width * 3 + 1)); }
  return { width, height, rgb };
}
test('cinq textures aux résolutions prescrites, masque binaire et albédo neutre sous le masque', () => {
  for (const channel of ['albedo', 'normale', 'rugosite', 'metal', 'masque_equipe']) {
    const image = png(channel), size = ['albedo', 'normale'].includes(channel) ? 1024 : 512;
    assert.equal(image.width, size); assert.equal(image.height, size);
  }
  const mask = png('masque_equipe').rgb, albedo = png('albedo').rgb;
  let whites = 0;
  for (let i = 0; i < mask.length; i += 3) {
    assert.ok(mask[i] === 0 || mask[i] === 255);
    assert.equal(mask[i], mask[i + 1]); assert.equal(mask[i], mask[i + 2]);
    if (mask[i] === 255) {
      whites++;
      const x = (i / 3) % 512, y = Math.floor(i / 3 / 512);
      for (const dx of [0, 1]) for (const dy of [0, 1]) { const p = ((y * 2 + dy) * 1024 + x * 2 + dx) * 3; assert.equal(albedo[p], albedo[p + 1]); assert.equal(albedo[p], albedo[p + 2]); }
    }
  }
  assert.ok(whites > 0 && whites < 512 * 512 / 4);
});
for (const lod of [0, 1, 2] as const) test(`LOD${lod}: noms exacts, géométrie valide et cinq clips aux durées exactes`, () => {
  const bytes = readFileSync(`${dir}${id}_lod${lod}.glb`);
  assert.equal(validerGlb(bytes, lireSpec(`assets/specs/${id}.json`), { lod }).ok, true);
  const { document: d, bin } = decouperGlb(bytes);
  const nodes = d.nodes as { name: string }[];
  assert.deepEqual(nodes.map(n => n.name).sort(), ['racine', 'corps', 'base', 'socle', 'module_canon_long'].sort());
  assert.deepEqual((d.materials as { name: string }[]).map(m => m.name).sort(), ['mat_corps', 'mat_details']);
  const accessors = d.accessors as { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  const views = d.bufferViews as { byteOffset?: number; byteStride?: number }[];
  function values(index: number) {
    const a = accessors[index]!, v = views[a.bufferView]!, size = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]!;
    assert.equal(a.componentType, 5126);
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), result: number[] = [];
    for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) result.push(data.getFloat32((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? size * 4) + j * 4, true));
    assert.ok(result.every(Number.isFinite)); return result;
  }
  for (const mesh of d.meshes as { primitives: { attributes: Record<string, number> }[] }[]) for (const p of mesh.primitives) {
    values(p.attributes.POSITION!);
    assert.ok(values(p.attributes.TEXCOORD_0!).every(v => v >= 0 && v <= 1));
    const normal = values(p.attributes.NORMAL!);
    for (let i = 0; i < normal.length; i += 3) assert.ok(Math.abs(Math.hypot(normal[i]!, normal[i + 1]!, normal[i + 2]!) - 1) < 1e-5);
  }
  const durations: Record<string, number> = { repos: 2.4, deplacement: 1, tir: 0.7, touche: 0.5, hors_jeu: 0.9 };
  const animations = d.animations as { name: string; extras: { loop: boolean }; samplers: { input: number; output: number }[]; channels: { sampler: number; target: { node: number; path: string } }[] }[];
  assert.deepEqual(animations.map(a => a.name).sort(), Object.keys(durations).sort());
  for (const a of animations) {
    assert.equal(a.extras.loop, ['repos', 'deplacement'].includes(a.name));
    for (const s of a.samplers) { const times = values(s.input); assert.equal(times[0], 0); assert.ok(Math.abs(times.at(-1)! - durations[a.name]!) < 1e-6); values(s.output); }
  }
  // Every looping channel returns to its initial pose, including stowed spades.
  for (const a of animations.filter(a => a.extras.loop)) for (const channel of a.channels) {
    const v = values(a.samplers[channel.sampler]!.output), stride = channel.target.path === 'rotation' ? 4 : 3;
    v.slice(0, stride).forEach((x, i) => assert.ok(Math.abs(x - v[v.length - stride + i]!) < 1e-6));
  }
  // Sample actual binary node transforms and vertices, including inherited
  // hull motion: folded spades must not penetrate the ground or adjacent tiles.
  const sceneNodes = d.nodes as { name: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  const meshes = d.meshes as { primitives: { attributes: Record<string, number> }[] }[];
  const parents = new Map<number, number>();
  sceneNodes.forEach((n, i) => n.children?.forEach(c => parents.set(c, i)));
  for (const animation of animations) for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const poses = sceneNodes.map(n => ({
      translation: [...(n.translation ?? [0, 0, 0])], rotation: [...(n.rotation ?? [0, 0, 0, 1])], scale: [...(n.scale ?? [1, 1, 1])],
    }));
    for (const c of animation.channels) {
      const sampler = animation.samplers[c.sampler]!, times = values(sampler.input), v = values(sampler.output);
      const index = Math.min(times.length - 1, Math.round(fraction * (times.length - 1)));
      const key = c.target.path as 'translation' | 'rotation' | 'scale', stride = key === 'rotation' ? 4 : 3;
      poses[c.target.node]![key] = v.slice(index * stride, (index + 1) * stride);
    }
    const matrices = new Map<number, T.Matrix4>();
    function world(index: number): T.Matrix4 {
      if (matrices.has(index)) return matrices.get(index)!;
      const p = poses[index]!;
      const m = new T.Matrix4().compose(new T.Vector3().fromArray(p.translation), new T.Quaternion().fromArray(p.rotation), new T.Vector3().fromArray(p.scale));
      if (parents.has(index)) m.premultiply(world(parents.get(index)!));
      matrices.set(index, m); return m;
    }
    const total = new T.Box3();
    sceneNodes.forEach((node, index) => {
      if (node.mesh === undefined) return;
      const bounds = new T.Box3();
      for (const primitive of meshes[node.mesh]!.primitives) {
        const p = values(primitive.attributes.POSITION!);
        for (let i = 0; i < p.length; i += 3) bounds.expandByPoint(new T.Vector3().fromArray(p, i).applyMatrix4(world(index)));
      }
      if (animation.name === 'deplacement' && node.name === 'socle') assert.ok(bounds.min.y > 0.04, 'spades raised clear of ground');
      total.union(bounds);
    });
    assert.ok(total.min.y > -1e-6, `${animation.name}: ground penetration ${total.min.y}`);
    assert.ok(total.max.x - total.min.x <= 0.69 && total.max.z - total.min.z <= 0.92, `${animation.name}: tile clearance`);
  }
  const off = animations.find(a => a.name === 'hors_jeu')!;
  const lowered = off.channels.find(c => nodes[c.target.node]!.name === 'module_canon_long' && c.target.path === 'rotation')!;
  const q = values(off.samplers[lowered.sampler]!.output).slice(-4);
  assert.ok(q[0]! > 0.1, 'tube parked and ready tab retracted at shutdown');
});
