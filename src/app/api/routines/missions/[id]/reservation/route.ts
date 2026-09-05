/**
 * `DELETE /api/routines/missions/{id}/reservation` — rendre une mission
 * (`05-routines.md` §1.10).
 *
 * C'est la sortie propre quand le contexte est correct mais le travail impossible
 * dans le run courant : la mission repart dans la file immédiatement, sans passer
 * par la quarantaine. C'est aussi ce qu'une routine fait d'une mission de dépêche
 * dont l'heure limite est passée — une dépêche en retard n'est jamais rattrapée.
 */

import { missions } from '@/db/requetes/index';
import { erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async () => {
    const ligne = await missions.mission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');
    if (ligne.statut !== 'ouverte') return erreur('mission_close', 409, `la mission est ${ligne.statut}`);
    await missions.clore(id, 'rendue');
    return json({ rendue: true });
  })(requete);
}
