import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REGEX_CLE } from '@/schemas/index';
import { receptionAsset } from '@/serveur/reception-assets';
import { sessionCourante } from '../../session';
import { chargerCatalogueAssets } from '../donnees';
import { manifesteAsset } from '../parcours-production';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!await sessionCourante()) return Response.json({ erreur: 'Session administrateur requise.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const cle = params.get('cle');
  const format = params.get('format') ?? 'json';
  if (!['json', 'prompt'].includes(format) || (cle !== null && !REGEX_CLE.test(cle))) return Response.json({ erreur: 'Export invalide.' }, { status: 400 });
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!cle) {
    if (format !== 'json') return Response.json({ erreur: 'Le plan global est disponible au format JSON.' }, { status: 400 });
    try {
      const plan = await readFile(path.resolve('assets/production/plan-assets.json'), 'utf8');
      JSON.parse(plan);
      return new Response(plan, { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="plan-assets.json"' } });
    } catch {
      return Response.json({ erreur: 'Plan de production indisponible sur ce serveur. Générez le manifeste puis redéployez-le.' }, { status: 503, headers });
    }
  }
  const spec = chargerCatalogueAssets().specs.find(s => s.id === cle);
  if (!spec) return Response.json({ erreur: 'Asset inconnu.' }, { status: 404, headers });
  const manifeste = manifesteAsset(spec, receptionAsset(spec));
  const texte = format === 'prompt' ? manifeste.prompt : `${JSON.stringify(manifeste, null, 2)}\n`;
  return new Response(texte, { headers: { ...headers,
    'Content-Type': format === 'prompt' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${cle}_${format === 'prompt' ? 'prompt.txt' : 'production.json'}"`,
  } });
}
