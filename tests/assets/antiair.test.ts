/** Inspect delivered binary/PNG payloads independently of the generator. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { decouperGlb } from '../../scripts/infanterie/gltf';
import { lireSpec } from '../../scripts/controler-asset';
import { validerGlb } from '../../src/assets';
const id = 'unite_antiair_base';
const dir = 'assets/livraisons/unite_antiair_base/';
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
test('six textures aux résolutions prescrites, masque binaire et albédo neutre sous le masque', () => {
  for (const channel of ['albedo', 'normale', 'rugosite', 'metal', 'masque_equipe', 'emission']) {
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
for (const lod of [0] as const) test(`LOD${lod}: noms exacts, géométrie valide et cinq clips aux durées exactes`, () => {
  const bytes = readFileSync(`${dir}${id}_lod${lod}.glb`);
  assert.equal(validerGlb(bytes, lireSpec(`assets/specs/${id}.json`), { lod }).ok, true);
  const { document: d, bin } = decouperGlb(bytes);
  const nodes = d.nodes as { name: string }[];
  assert.deepEqual(nodes.map(n => n.name).sort(), ['racine', 'corps', 'base', 'socle', 'module_tourelle', 'module_radar'].sort());
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
  const off = animations.find(a => a.name === 'hors_jeu')!;
  const lamp = off.channels.find(c => nodes[c.target.node]!.name === 'socle' && c.target.path === 'scale')!;
  assert.deepEqual(values(off.samplers[lamp.sampler]!.output).slice(-3), [0, 0, 0]);
});

test('le candidat conserve les PNG externes et les trois repères séparés', () => {
  const { document: d } = decouperGlb(readFileSync(`${dir}${id}_lod0.glb`));
  for (const image of d.images as { uri: string; bufferView?: number }[]) {
    assert.equal(image.bufferView, undefined);
    assert.match(image.uri, /^unite_antiair_base_[a-z_]+\.png$/);
    assert.deepEqual(readFileSync(`${dir}${image.uri}`), readFileSync(`public/assets/modeles/${image.uri}`), 'PNG existant conservé');
  }
  const metal = png('metal').rgb, orm = png('rugosite').rgb;
  for (let i = 0; i < metal.length; i += 3) assert.equal(orm[i + 2], metal[i], 'canal B = métal éditable');
  const mesures = JSON.parse(readFileSync(`${dir}reperes.json`, 'utf8'));
  const gauche = mesures.reperes['marker--1'], droite = mesures.reperes['marker-1'];
  assert.ok(droite.min[0] - gauche.max[0] > .09, 'les tubes restent clairement séparés');
  assert.ok(mesures.reperes['radar-dish'].max[2] < gauche.min[2], 'radar distinct derrière les tubes');
  assert.equal(mesures.pixelsParMetre, 48);
  assert.equal(mesures.validationArtistique, false);
  const nodes = d.nodes as { name: string }[];
  for (const a of d.animations as { channels: { target: { node: number } }[] }[]) {
    assert.ok(a.channels.every(c => nodes[c.target.node]!.name !== 'racine'));
  }
});
