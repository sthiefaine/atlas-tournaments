/**
 * `POST /api/routines/missions/{id}/soumission` — le seul point d'écriture de
 * contenu, toutes routines confondues.
 *
 * L'en-tête `Idempotency-Key: <mission.id>` est honoré : un second `POST`
 * identique renvoie la première réponse au lieu de créer un doublon
 * (`05-routines.md` §1.5).
 */

import { missions } from '@/db/requetes/index';
import { baseDuSite } from '@/serveur/missions';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { traiterSoumission } from '@/serveur/soumission';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await missions.mission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');

    const cleIdempotence = req.headers.get('idempotency-key');
    if (ligne.statut === 'soumise') {
      // Rejeu exact : on rend la première réponse, sans effet de bord.
      if (cleIdempotence && ligne.idempotencyKey === cleIdempotence && ligne.reponse) {
        return json(ligne.reponse);
      }
      return erreur('mission_close', 409, 'cette mission a déjà été soumise');
    }
    if (ligne.statut !== 'ouverte') return erreur('mission_close', 409, `la mission est ${ligne.statut}`);

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    if (typeof corps.valeur !== 'object' || corps.valeur === null || Array.isArray(corps.valeur)) {
      return erreur('charge_invalide', 400, 'un objet JSON est attendu');
    }
    if (cleIdempotence) await missions.marquerIdempotence(id, cleIdempotence);

    return traiterSoumission({
      id: ligne.id,
      routine: ligne.routine,
      kind: ligne.kind,
      cibleType: ligne.cibleType,
      cibleCle: ligne.cibleCle,
      echeance: ligne.echeance,
      contexte: ligne.contexte,
    }, corps.valeur as Record<string, unknown>, baseDuSite(req), ligne.runId);
  })(requete);
}
