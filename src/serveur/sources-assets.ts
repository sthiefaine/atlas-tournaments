import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readdir, stat, rename, unlink } from 'node:fs/promises';
import { lireGlb } from '@/assets/valider-gltf';
export const LIMITE_SOURCE = 150 * 1024 * 1024;
export const REVISION_SOURCE = /^[a-f0-9]{64}$/;
export function dossierSources(): string | null {
  const configure = process.env.ATLAS_ASSET_SOURCES_DIR;
  if (configure) return path.isAbsolute(configure) ? configure : null;
  return process.env.NODE_ENV === 'production' ? null : path.resolve('assets/sources');
}
export function cheminSource(racine: string, id: string, revision: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(id) || !REVISION_SOURCE.test(revision)) throw new Error('Identifiant de source invalide');
  return path.join(racine, id, `${revision}.glb`);
}
export async function enregistrerSource(racine: string, id: string, octets: Uint8Array) {
  if (!octets.length || octets.length > LIMITE_SOURCE) throw new Error('150 Mio maximum par GLB');
  const lu = lireGlb(octets);
  if (!lu.ok) throw new Error(lu.motif.detail);
  if (lu.document.asset?.version !== '2.0' || !Array.isArray(lu.document.meshes) || !lu.document.meshes.length) throw new Error('Un modèle glTF 2.0 avec géométrie est attendu');
  // Le dépôt ne télécharge jamais de références externes et exige un export autonome.
  const document = lu.document as typeof lu.document & { buffers?: {uri?:string}[] };
  for (const objet of [...(document.images ?? []), ...(document.buffers ?? [])]) {
    if (objet.uri && !objet.uri.startsWith('data:')) throw new Error('Exportez un GLB autonome avec textures intégrées, sans fichier externe');
  }
  const revision = createHash('sha256').update(octets).digest('hex');
  const fichier = cheminSource(racine, id, revision);
  await mkdir(path.dirname(fichier), { recursive: true });
  const temporaire = path.join(path.dirname(fichier), `${randomUUID()}.tmp`);
  try { await writeFile(temporaire, octets, { flag: 'wx' }); await rename(temporaire, fichier); }
  finally { await unlink(temporaire).catch(() => {}); }
  return { revision, octets: octets.length };
}
export async function listerSources(racine: string, id: string) {
  const dossier = path.dirname(cheminSource(racine, id, '0'.repeat(64)));
  let noms: string[];
  try { noms = await readdir(dossier); } catch(e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
  const sources = await Promise.all(noms.filter(n=>REVISION_SOURCE.test(n.replace(/\.glb$/, '')) && n.endsWith('.glb')).map(async nom=>{
    const s = await stat(path.join(dossier, nom));
    return { revision: nom.slice(0,-4), octets: s.size, date: s.mtime.toISOString() };
  }));
  return sources.sort((a,b)=>b.date.localeCompare(a.date));
}
