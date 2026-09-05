/**
 * `DELETE /api/routines/cerveau/memoire/{cle}` — **archive** une entrée devenue
 * fausse. Rien n'est détruit : `archivee` remplace la suppression, comme `retire`
 * ailleurs (`02-architecture.md` §6).
 */

import { memoire } from '@/db/requetes/index';
import { erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  requete: Request,
  contexte: { params: Promise<{ cle: string }> },
): Promise<Response> {
  const { cle } = await contexte.params;
  return routeRoutine(async () => {
    const ok = await memoire.archiver(cle);
    if (!ok) return erreur('entree_inconnue', 404, `l’entrée ${cle} n’existe pas`);
    return json({ cle, archivee: true });
  })(requete);
}
