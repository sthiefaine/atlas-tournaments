/**
 * `GET /api/routines/cerveau/metriques?routine=&jours=` — les métriques agrégées
 * qui fondent une candidate de prompt (`05-routines.md` §5.4).
 *
 * Rien que des compteurs : ce sont eux, et non une impression de lecture, qui
 * justifient une proposition de prompt.
 */

import { prompts as requetesPrompts, reviews, runs } from '@/db/requetes/index';
import { estClePrompt } from '@/serveur/prompts';
import { entierBorne, erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const params = new URL(requete.url).searchParams;
  const routine = params.get('routine');
  if (!estClePrompt(routine)) {
    return erreur('routine_inconnue', 400, 'paramètre ?routine= attendu parmi les cinq clés de prompt');
  }
  const jours = entierBorne(params.get('jours'), 30, 1, 180);

  const compteurs = await runs.metriques(routine, jours);
  const courant = await requetesPrompts.prompteCourant(routine);
  return json({
    routine,
    jours,
    runs: compteurs.runs,
    missions: compteurs.missions,
    soumissions: compteurs.soumissions,
    runs_en_echec: compteurs.echecs,
    acceptation_1er_post: compteurs.missions === 0 ? null : compteurs.soumissions / compteurs.missions,
    rejets_par_motif: await reviews.rejetsParMotif(jours),
    prompt_courant: courant ? { cle: courant.cle, version: courant.version } : null,
  });
});
