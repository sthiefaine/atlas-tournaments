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
import { and, eq, sql } from 'drizzle-orm';
import { validerAnnotations } from '../annotations';

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
  return annoter(requete, contexte, false);
}

/** Remplace les seules annotations ; le contexte canonique reste intact. */
export async function PUT(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  return annoter(requete, contexte, true);
}

async function annoter(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
  remplacement: boolean,
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await lireMission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');
    if (ligne.statut !== 'ouverte') return erreur('mission_close', 409, `la mission est ${ligne.statut}`);

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    const valide = validerAnnotations(corps.valeur, remplacement);
    if (!valide.ok) {
      return erreur('annotations_invalides', 422, 'annotations refusées', valide.chemins);
    }
    const misesAJour = await db().update(routineMissions)
      .set({ contexte: sql`${routineMissions.contexte} || ${JSON.stringify(valide.valeur)}::jsonb` })
      .where(and(eq(routineMissions.id, id), eq(routineMissions.statut, 'ouverte')))
      .returning({ id: routineMissions.id });
    if (misesAJour.length === 0) return erreur('mission_close', 409, 'mission fermée pendant la mise à jour');
    return json({ ok: true });
  })(requete);
}
