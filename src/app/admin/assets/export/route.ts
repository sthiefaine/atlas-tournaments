import { sessionCourante } from '../../session';
import { erreur } from '@/serveur/reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** L’export des commandes de modèles 3D est retiré avec leur parcours de production. */
export async function GET(_request: Request): Promise<Response> {
  if (!await sessionCourante()) return erreur('session_requise', 401, 'Session administrateur requise.');
  return erreur('parcours_glb_retire', 410, 'La production de modèles GLB est retirée. Consultez la bibliothèque de sprites dans /admin/assets. Les vues et animations des trois pilotes restent à finaliser.');
}
