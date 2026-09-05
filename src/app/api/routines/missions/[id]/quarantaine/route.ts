/**
 * `POST /api/routines/missions/{id}/quarantaine` — le signalement
 * (`05-routines.md` §1.6).
 *
 * Ce qu'une routine ne reconnaît pas, elle le signale au lieu de l'inventer. La
 * mission est close, l'objet ciblé passe en `quarantaine`, et il apparaît dans la
 * file dédiée de l'administration. **Une quarantaine n'est pas un échec de run :
 * c'est un signalement réussi.**
 */

import { cartes, commandants, depeches, evenements, missions, pays, scenarios, unites } from '@/db/requetes/index';
import { transitionAutorisee } from '@/serveur/cycle';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Les codes de quarantaine admis : la routine ne rédige pas un motif libre. */
const CODES = ['reference_inconnue', 'objet_incomprehensible', 'contradiction_canon'];

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await missions.mission(id);
    if (!ligne) return erreur('mission_inconnue', 404, 'cette mission n’existe pas');
    if (ligne.statut !== 'ouverte') return erreur('mission_close', 409, `la mission est ${ligne.statut}`);

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    const o = corps.valeur as Record<string, unknown>;
    const code = typeof o['code'] === 'string' ? o['code'] : '';
    const detail = typeof o['detail'] === 'string' ? o['detail'].slice(0, 300) : '';
    if (!CODES.includes(code)) {
      return erreur('code_inconnu', 422, `code attendu parmi : ${CODES.join(', ')}`);
    }

    const decision = transitionAutorisee('brouillon', 'quarantaine', 'routine');
    if (!decision.ok) return erreur(decision.code, 409, decision.detail);

    await mettreEnQuarantaine(ligne.cibleType, ligne.cibleCle);
    await missions.clore(id, 'quarantaine', { code, detail });
    return json({ statut: 'quarantaine', mission: 'close' });
  })(requete);
}

async function mettreEnQuarantaine(cibleType: string, cle: string): Promise<void> {
  switch (cibleType) {
    case 'MapDef': {
      const c = await cartes.carteParCode(cle);
      if (c) await cartes.changerStatut(c.id, 'quarantaine');
      break;
    }
    case 'Scenario': await scenarios.changerStatut(cle, 'quarantaine'); break;
    case 'Commander': await commandants.changerStatut(cle, 'quarantaine'); break;
    case 'Country': await pays.changerStatut(cle, 'quarantaine'); break;
    case 'Event': await evenements.changerStatut(cle, 'quarantaine'); break;
    case 'UnitType': await unites.changerCycle(cle, 'quarantaine'); break;
    case 'MissionDuJour': await depeches.changerStatut(cle, 'quarantaine'); break;
    default: break;
  }
}
