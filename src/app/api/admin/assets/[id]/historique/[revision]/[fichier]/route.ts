import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { genererSpecs } from '@/assets/index';
import { nomsAttendus } from '@/serveur/depot-modeles';
import { dossierReceptions } from '@/serveur/reception-assets';
import { exigerAdmin } from '@/serveur/auth';
export const runtime = 'nodejs';
export async function GET(req: Request, contexte: { params: Promise<{ id: string; revision: string; fichier: string }> }) {
  const refus = exigerAdmin(req); if (refus) return refus;
  const { id, revision, fichier } = await contexte.params, spec = genererSpecs().find((s) => s.id === id);
  if (!spec || !/^[a-f0-9]{64}$/.test(revision) || !nomsAttendus(spec).includes(fichier)) return new Response(null, { status: 404 });
  try {
    const b = await readFile(path.join(dossierReceptions(), id, revision, fichier));
    return new Response(new Uint8Array(b), { headers: { 'content-type': fichier.endsWith('.glb') ? 'model/gltf-binary' : 'image/png', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  } catch { return new Response(null, { status: 404 }); }
}
