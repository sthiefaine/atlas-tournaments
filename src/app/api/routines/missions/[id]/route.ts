/**
 * `GET  /api/routines/missions/{id}` — le contexte de travail (le `promptUrl`).
 * `PATCH /api/routines/missions/{id}` — un complément **non structurant** : un
 * commentaire, une note de confiance. Jamais du contenu (`05-routines.md` §1.10).
 */

import { missions } from '@/db/requetes/index';
import { contexteDeMission } from '@/serveur/contexte';
import { baseDuSite } from '@/serveur/missions';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { db } from '@/db/client';
import { routineMissions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function lireMission(id: string) {
  const ligne = await missions.mission(id);
  if (!ligne) return null;
  return ligne;
}

export async function GET(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await lireMission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');
    if (ligne.statut !== 'ouverte') {
      return erreur('mission_close', 409, `la mission est ${ligne.statut}`);
    }
    return json(await contexteDeMission({
      id: ligne.id,
      routine: ligne.routine,
      kind: ligne.kind,
      cibleType: ligne.cibleType,
      cibleCle: ligne.cibleCle,
      echeance: ligne.echeance,
      contexte: ligne.contexte,
    }, baseDuSite(req)));
  })(requete);
}

export async function PATCH(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await lireMission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');
    if (ligne.statut !== 'ouverte') return erreur('mission_close', 409, `la mission est ${ligne.statut}`);

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    if (typeof corps.valeur !== 'object' || corps.valeur === null) {
      return erreur('charge_invalide', 400, 'un objet est attendu');
    }
    const entrant = corps.valeur as Record<string, unknown>;
    const permis = ['commentaire', 'note', 'confiance'];
    const inconnus = Object.keys(entrant).filter((c) => !permis.includes(c));
    if (inconnus.length > 0) {
      // Un PATCH ne porte jamais de contenu : c'est la soumission qui écrit.
      return erreur('champ_inconnu', 422, 'seuls commentaire, note et confiance sont acceptés', inconnus);
    }
    await db().update(routineMissions)
      .set({ contexte: sql`${routineMissions.contexte} || ${JSON.stringify(entrant)}::jsonb` })
      .where(eq(routineMissions.id, id));
    return json({ ok: true });
  })(requete);
}
