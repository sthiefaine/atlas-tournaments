/** Compression de diffusion, sans quantification ni modification des triangles/UV/animations. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer';
import { assemblerCompression, EXT_MESHOPT, morceauxGlb } from '../../src/assets/compression-glb';

async function main() {
  const id = process.argv[2];
  if (!id || !['batiment_qg_base'].includes(id)) throw new Error('Asset source non autorisé pour cette compression');
  const dossier = path.resolve('assets/livraisons', id), nom = `${id}_lod0.glb`, fichier = path.join(dossier, nom);
  const initial = readFileSync(fichier), { document: d, bin } = morceauxGlb(initial);
  if (d.extensionsRequired?.includes(EXT_MESHOPT)) throw new Error('Fichier déjà compressé : repartir de la préparation source');
  await MeshoptEncoder.ready;
  const morceaux: Uint8Array[] = [];
  let position = 0;
  const original = d.buffers[0]!.byteLength;
  for (let i = 0; i < d.bufferViews.length; i++) {
    const b = d.bufferViews[i]!;
    const acc = d.accessors.filter(a => a.bufferView === i);
    if (b.buffer !== 0 || acc.length !== 1 || acc[0]!.byteOffset || b.extensions || b.byteStride) throw new Error('La préparation doit fournir un accesseur compact par vue');
    const a = acc[0]!, composants = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type];
    if (!composants || ![5125, 5126].includes(a.componentType)) throw new Error('Format source non pris en charge');
    const stride = composants * 4, mode = a.componentType === 5125 ? 'INDICES' : 'ATTRIBUTES';
    if (b.byteLength !== a.count * stride) throw new Error('Vue source incohérente');
    const brut = bin.subarray(b.byteOffset ?? 0, (b.byteOffset ?? 0) + b.byteLength);
    const code = MeshoptEncoder.encodeGltfBuffer(brut, a.count, stride, mode);
    const alignement = (4 - position % 4) % 4;
    if (alignement) { morceaux.push(new Uint8Array(alignement)); position += alignement; }
    b.extensions = { [EXT_MESHOPT]: { buffer: 0, byteOffset: position, byteLength: code.length, byteStride: stride, count: a.count, mode } };
    b.buffer = 1; morceaux.push(code); position += code.length;
  }
  d.buffers = [{ byteLength: position }, { byteLength: original, extensions: { [EXT_MESHOPT]: { fallback: true } } }];
  d.extensionsUsed = [...new Set([...(d.extensionsUsed ?? []), EXT_MESHOPT])];
  d.extensionsRequired = [...new Set([...(d.extensionsRequired ?? []), EXT_MESHOPT])];
  const sortie = assemblerCompression(d, Buffer.concat(morceaux));
  writeFileSync(fichier, sortie);
  console.log(JSON.stringify({avant:initial.length,apres:sortie.length}));
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
