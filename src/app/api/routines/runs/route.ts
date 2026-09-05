/**
 * `GET  /api/routines/runs?routine=&limite=` — le journal des runs.
 * `POST /api/routines/runs` — clôture du run courant avec sa **ligne de bilan**.
 *
 * `05-routines.md` §1.8 décrit la table `routine_runs` mais pas sa route : chaque
 * run est ouvert au premier `GET /missions` et « fermé à la ligne de bilan ». Il
 * fallait un endroit où cette ligne arrive — c'est ici. Aucun contenu de mission
 * n'y est recopié : des compteurs, des codes, et la ligne finale telle quelle.
 */

import { runs } from '@/db/requetes/index';
import { estClePrompt } from '@/serveur/prompts';
import { entierBorne, erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Statuts de fin acceptés dans une ligne de bilan. */
const STATUTS_FIN = ['ok', 'partiel', 'echec'];

export const GET = routeRoutine(async (requete) => {
  const params = new URL(requete.url).searchParams;
  const limite = entierBorne(params.get('limite'), 20, 1, 100);
  const routine = params.get('routine');
  const lignes = await runs.derniersRuns(limite * 2);
  const filtrees = estClePrompt(routine) ? lignes.filter((l) => l.routine === routine) : lignes;
  return json({
    count: Math.min(filtrees.length, limite),
    runs: filtrees.slice(0, limite).map((l) => ({
      id: l.id,
      routine: l.routine,
      prompt_version: l.promptVersion,
      demarre_le: l.demarreLe.toISOString(),
      fini_le: l.finiLe ? l.finiLe.toISOString() : null,
      statut: l.statut,
      missions_recues: l.missionsRecues,
      missions_soumises: l.missionsSoumises,
      appels: l.appels,
      bilan: l.bilan,
      erreurs: l.erreurs,
    })),
  });
});

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const o = corps.valeur as Record<string, unknown>;

  const routine = typeof o['routine'] === 'string' ? o['routine'] : null;
  if (!estClePrompt(routine)) {
    return erreur('routine_inconnue', 400, 'le champ routine est attendu parmi les cinq clés de prompt');
  }
  const statut = typeof o['statut'] === 'string' ? o['statut'] : 'ok';
  if (!STATUTS_FIN.includes(statut)) {
    return erreur('statut_inconnu', 422, `statut attendu parmi : ${STATUTS_FIN.join(', ')}`);
  }
  const bilan = typeof o['bilan'] === 'string' ? o['bilan'].slice(0, 500) : null;
  if (bilan === null || bilan.trim() === '') {
    return erreur('bilan_manquant', 422, 'un run se termine par UNE ligne de bilan');
  }

  const run = await runs.ouvrirRun(routine, null);
  if (Array.isArray(o['erreurs'])) {
    for (const e of o['erreurs'].slice(0, 20)) {
      if (typeof e !== 'object' || e === null) continue;
      const r = e as Record<string, unknown>;
      await runs.consignerErreur(run.id, {
        ...(typeof r['mission_id'] === 'string' ? { missionId: r['mission_id'] } : {}),
        etape: typeof r['etape'] === 'string' ? r['etape'] : 'inconnue',
        code: typeof r['code'] === 'string' ? r['code'] : 'inconnu',
        ...(typeof r['detail'] === 'string' ? { detail: r['detail'].slice(0, 200) } : {}),
      });
    }
  }
  await runs.fermerRun(run.id, statut as 'ok' | 'partiel' | 'echec', bilan);
  return json({ id: run.id, routine, statut, bilan });
});
