/** Inspect delivered binary/PNG payloads independently of the generator. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { decouperGlb } from '../../scripts/infanterie/gltf';
import { lireSpec } from '../../scripts/controler-asset';
import { validerGlb } from '../../src/assets';
const id = 'terrain_plaine';
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
test('quatre cartes et raccords scalaires identiques sous tous les quarts de tour', () => {
  for (const channel of ['albedo', 'normale', 'rugosite', 'occlusion']) {
    const { width, height, rgb } = png(channel);
    const size = channel === 'occlusion' ? 512 : 1024;
    assert.equal(width, size); assert.equal(height, size);
    if (channel === 'normale') continue;
    const at = (x: number, y: number) => [...rgb.subarray((y * size + x) * 3, (y * size + x) * 3 + 3)];
    for (let t = 0; t < size; t++) {
      const expected = at(t, 0);
      for (const [x, y] of [[t, size - 1], [0, t], [size - 1, t], [size - 1 - t, 0], [size - 1 - t, size - 1], [0, size - 1 - t], [size - 1, size - 1 - t]]) assert.deepEqual(at(x!, y!), expected);
    }
  }
});
test('normales : les vecteurs des bords se raccordent aussi après rotation', () => {
  const { width: n, rgb } = png('normale');
  function normal(x: number, y: number, k: number) {
    for (let i = 0; i < k; i++) [x, y] = [n - 1 - y, x];
    const offset = (y * n + x) * 3;
    let nx = rgb[offset]! - 128, ny = rgb[offset + 1]! - 128;
    for (let i = 0; i < k; i++) [nx, ny] = [-ny, nx];
    return [nx + 0, ny + 0, rgb[offset + 2]! - 128];
  }
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let t = 0; t < n; t++) {
    assert.deepEqual(normal(n - 1, t, a), normal(0, t, b));
    assert.deepEqual(normal(t, n - 1, a), normal(t, 0, b));
  }
});
for (const lod of [0, 1] as const) test(`LOD${lod}: dimensions, surface plane, noms et budget`, () => {
  const bytes = readFileSync(`${dir}${id}_lod${lod}.glb`);
  assert.equal(validerGlb(bytes, lireSpec(`assets/specs/${id}.json`), { lod }).ok, true);
  const { document: d, bin } = decouperGlb(bytes);
  assert.deepEqual((d.nodes as { name: string }[]).map(n => n.name).sort(), ['racine', 'sol']);
  assert.deepEqual((d.materials as { name: string }[]).map(n => n.name), ['mat_sol', 'mat_herbe']);
  assert.equal((d.animations as unknown[] | undefined)?.length ?? 0, 0);
  const accessors = d.accessors as { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  const views = d.bufferViews as { byteOffset?: number; byteStride?: number }[];
  const heights = new Set<number>(); let triangles = 0;
  const bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  for (const mesh of d.meshes as { primitives: { attributes: Record<string, number>; indices?: number }[] }[]) for (const p of mesh.primitives) {
    const a = accessors[p.attributes.POSITION!]!, v = views[a.bufferView]!;
    triangles += p.indices === undefined ? a.count / 3 : accessors[p.indices]!.count / 3;
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    for (let i = 0; i < a.count; i++) for (let axis = 0; axis < 3; axis++) {
      const n = data.getFloat32((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? 12) + axis * 4, true);
      assert.ok(Number.isFinite(n)); bounds[axis]![0] = Math.min(bounds[axis]![0]!, n); bounds[axis]![1] = Math.max(bounds[axis]![1]!, n);
      if (axis === 1) heights.add(n);
    }
  }
  assert.ok(heights.size > 10, 'curved vegetation has real volume');
  assert.ok(heights.has(0)); assert.ok(Math.abs(Math.max(...heights) - 0.06) < 1e-8);
  assert.deepEqual(bounds[0], [-0.5, 0.5]); assert.deepEqual(bounds[2], [-0.5, 0.5]);
  assert.ok(triangles <= (lod === 0 ? 800 : 200));
});
