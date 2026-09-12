/** Un kit peint le fichier de base ; une réexportation de la géométrie n'est pas une variante de livrée. */
import { decompresserGlb } from './compression-glb';
import { createHash } from 'node:crypto';
import { lireGlb } from './valider-gltf';
export function empreinteGeometrie(octets: Uint8Array): string | null {
  try { octets = decompresserGlb(octets); } catch { return null; }
  const lu = lireGlb(octets); if (!lu.ok) return null;
  const d = lu.document as unknown as Record<string, unknown>;
  const h = createHash('sha256');
  for (const cle of ['accessors', 'bufferViews', 'meshes', 'nodes', 'skins', 'animations', 'scenes', 'scene']) h.update(JSON.stringify(d[cle] ?? null));
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  for (let p = 12; p + 8 <= octets.length;) {
    const n = vue.getUint32(p, true);
    if (vue.getUint32(p + 4, true) === 0x004e4942) h.update(octets.subarray(p + 8, p + 8 + n));
    p += n + 8;
  }
  return h.digest('hex');
}
