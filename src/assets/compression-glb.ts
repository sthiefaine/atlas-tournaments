/** Décompression de contrôle uniquement. Le rendu utilise le décodeur WASM rapide. */
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder_reference.js';
export const EXT_MESHOPT = 'EXT_meshopt_compression';
export const LIMITE_DECOMPRESSEE = 96 * 1024 * 1024;
interface Compression { buffer: number; byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string }
export interface DocumentCompresse {
  buffers: { byteLength: number; uri?: string; extensions?: Record<string, unknown> }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; extensions?: Record<string, Compression> }[];
  accessors: { bufferView?: number; componentType: number; count: number; type: string; byteOffset?: number }[];
  extensionsUsed?: string[]; extensionsRequired?: string[];
  [cle: string]: unknown;
}
export function morceauxGlb(octets: Uint8Array): { document: DocumentCompresse; bin: Uint8Array } {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (octets.length < 28 || v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2 || v.getUint32(8, true) !== octets.length || v.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB invalide');
  const n = v.getUint32(12, true), fin = 20 + n;
  if (fin + 8 > octets.length || v.getUint32(fin + 4, true) !== 0x004e4942 || fin + 8 + v.getUint32(fin, true) !== octets.length) throw new Error('Binaire GLB invalide');
  return { document: JSON.parse(new TextDecoder().decode(octets.subarray(20, fin))), bin: octets.subarray(fin + 8) };
}
export function assemblerCompression(document: DocumentCompresse, bin: Uint8Array): Uint8Array {
  const j = new TextEncoder().encode(JSON.stringify(document)), nj = (j.length + 3) & ~3, nb = (bin.length + 3) & ~3;
  const out = new Uint8Array(28 + nj + nb), v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, out.length, true);
  v.setUint32(12, nj, true); v.setUint32(16, 0x4e4f534a, true); out.fill(32, 20, 20 + nj); out.set(j, 20);
  v.setUint32(20 + nj, nb, true); v.setUint32(24 + nj, 0x004e4942, true); out.set(bin, 28 + nj); return out;
}
export function decompresserGlb(octets: Uint8Array): Uint8Array {
  // Les petits GLB sans BIN restent pris en charge par le lecteur historique.
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (octets.length < 20) return octets;
  const n = v.getUint32(12, true);
  if (20 + n > octets.length) return octets;
  const entete = JSON.parse(new TextDecoder().decode(octets.subarray(20, 20 + n))) as DocumentCompresse;
  if (!entete.bufferViews?.some(b => b.extensions?.[EXT_MESHOPT])) return octets;
  const { document: d, bin } = morceauxGlb(octets);
  const taille = d.buffers?.[1]?.byteLength ?? -1;
  if (d.buffers?.length !== 2 || d.buffers.some(b => b.uri) || !d.extensionsRequired?.includes(EXT_MESHOPT) || !Number.isSafeInteger(taille) || taille <= 0 || taille > LIMITE_DECOMPRESSEE || d.buffers[0]!.byteLength > bin.length) throw new Error('Budget ou buffers Meshopt invalides');
  const entier = (n: number) => Number.isSafeInteger(n) && n >= 0;
  let total = 0;
  for (const b of d.bufferViews) {
    const c = b.extensions?.[EXT_MESHOPT];
    if (!c || b.buffer !== 1 || c.buffer !== 0 || ![b.byteOffset ?? 0, b.byteLength, c.byteOffset ?? 0, c.byteLength, c.count, c.byteStride].every(entier)) throw new Error('Vue Meshopt invalide');
    if (!['ATTRIBUTES', 'INDICES', 'TRIANGLES'].includes(c.mode) || (c.filter && c.filter !== 'NONE')) throw new Error('Codec Meshopt non pris en charge');
    if (c.count < 1 || c.count > 1000000 || c.byteStride < 1 || (c.mode === 'ATTRIBUTES' ? c.byteStride % 4 !== 0 || c.byteStride > 256 : ![2, 4].includes(c.byteStride)) || (c.mode === 'TRIANGLES' && c.count % 3 !== 0)) throw new Error('Format Meshopt invalide');
    total += b.byteLength;
    if (total > LIMITE_DECOMPRESSEE || b.byteLength !== c.count * c.byteStride || (b.byteStride !== undefined && b.byteStride !== c.byteStride) || (b.byteOffset ?? 0) + b.byteLength > taille || (c.byteOffset ?? 0) + c.byteLength > bin.length) throw new Error('Vue Meshopt hors limites');
  }
  const brut = new Uint8Array(taille);
  for (const b of d.bufferViews) {
    const c = b.extensions![EXT_MESHOPT]!;
    const sortie = brut.subarray(b.byteOffset ?? 0, (b.byteOffset ?? 0) + b.byteLength);
    MeshoptDecoder.decodeGltfBuffer(sortie, c.count, c.byteStride, bin.subarray(c.byteOffset ?? 0, (c.byteOffset ?? 0) + c.byteLength), c.mode);
    b.buffer = 0; delete b.extensions![EXT_MESHOPT]; if (!Object.keys(b.extensions!).length) delete b.extensions;
  }
  d.buffers = [{ byteLength: taille }];
  for (const cle of ['extensionsUsed', 'extensionsRequired'] as const) { d[cle] = d[cle]?.filter(x => x !== EXT_MESHOPT); if (!d[cle]?.length) delete d[cle]; }
  return assemblerCompression(d, brut);
}
