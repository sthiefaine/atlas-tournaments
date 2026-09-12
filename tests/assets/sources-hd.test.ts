import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decouperGlb } from '../../scripts/infanterie/gltf';
for (const [type, triangles, sha] of [
  ['char_leger', 957212, '82f0857a3f0074cbd2aca688ec81c2227f53fa1a1dcbba66d6579f399a513f99'],
  ['antiair', 950812, 'bd7e4df51bf5a0cdc8b34a95b036f866ccf64d362cbd1580bf4ef55675ffc989'],
  ['artillerie', 941718, '38a5dbc65010bb45ec2424de7fa9c19b1e6d220ec0beb5339d2a5c35214fad5b'],
  ['infanterie', 985194, 'd98081ee79d3d57c5ce16d8dec70f602a78ec07e63030ee9652aa4b7ac433b84'],
] as const) test(`${type} : provenance, triangles HD et textures externes`, () => {
  const id = `unite_${type}_base`, dir = `assets/livraisons/${id}/`;
  const { document: d } = decouperGlb(readFileSync(`${dir}${id}_lod0.glb`));
  const asset = d.asset as { extras: { sourceSha256: string } };
  assert.equal(asset.extras.sourceSha256, sha);
  const accessors = d.accessors as { count: number }[];
  const meshes = d.meshes as { primitives: { indices: number }[] }[];
  assert.equal(meshes.reduce((n, m) => n + m.primitives.reduce((n, p) => n + accessors[p.indices]!.count / 3, 0), 0), triangles);
  for (const im of d.images as { uri: string; bufferView?: number }[]) {
    assert.equal(im.bufferView, undefined);
    assert.ok(im.uri.startsWith(id + '_') && !im.uri.includes('/'));
    assert.ok(readFileSync(dir + im.uri).length > 0);
  }
  const report = JSON.parse(readFileSync(dir + 'validation-lot.json', 'utf8'));
  if (type === 'char_leger') {
    assert.equal(report.verdict, null);
    assert.equal(report.dernierVerdictAvantCompression, 'ok');
  } else assert.equal(report.verdict.ok, true);
  assert.equal(report.approbationArtistique, false);
});
