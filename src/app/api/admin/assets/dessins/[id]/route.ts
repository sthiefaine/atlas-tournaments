import { lireDessinAutorise } from '@/app/admin/assets/dessins/donnees';
import { exigerAdmin } from '@/serveur/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENTETES = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Cookie',
};

export async function GET(requete: Request, contexte: { params: Promise<{ id: string }> }): Promise<Response> {
  const refus = exigerAdmin(requete);
  if (refus) {
    const entetes = new Headers(refus.headers);
    for (const [nom, valeur] of Object.entries(ENTETES)) entetes.set(nom, valeur);
    return new Response(refus.body, { status: refus.status, headers: entetes });
  }
  const { id } = await contexte.params;
  const contenu = await lireDessinAutorise(id);
  if (!contenu) return new Response(null, { status: 404, headers: ENTETES });
  const telecharger = new URL(requete.url).searchParams.get('telecharger') === '1';
  return new Response(contenu, {
    headers: {
      ...ENTETES,
      'Content-Type': 'image/png',
      'Content-Length': String(contenu.byteLength),
      'Content-Disposition': `${telecharger ? 'attachment' : 'inline'}; filename="${id}.png"`,
    },
  });
}
