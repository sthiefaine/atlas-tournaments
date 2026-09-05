/**
 * `GET /api/routines/missions?routine=<clé>[&neuf=1]` — le point d'entrée unique
 * des cinq routines (`05-routines.md` §1.10).
 *
 * Réponse : `{key, version, body, count, missions[]}`, **déjà triée**. La routine
 * traite dans cet ordre, sans se réordonner : c'est ce tri, et rien d'autre, qui
 * place une mission de dépêche en tête.
 *
 * Le prompt métier est livré ici, une fois pour tout le run — il n'a pas de route
 * propre. Si la base est en retard sur le code, elle est mise à niveau au passage.
 */

import { runs } from '@/db/requetes/index';
import { candidatsDe } from '@/serveur/candidats';
import { baseDuSite, fileDeMissions, type EnveloppeMissions } from '@/serveur/missions';
import { estClePrompt, promptDeRun } from '@/serveur/prompts';
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

  const prompt = await promptDeRun(routine);
  const run = await runs.ouvrirRun(routine, prompt.version);
  const missions = await fileDeMissions(
    routine,
    await candidatsDe(routine),
    {
      neuf: params.get('neuf') === '1',
      limite: entierBorne(params.get('limite'), 0, 1, 24) || undefined,
      base: baseDuSite(requete),
    },
    run.id,
  );
  await runs.compter(run.id, { recues: missions.length });

  const enveloppe: EnveloppeMissions = {
    key: prompt.key,
    version: prompt.version,
    body: prompt.body,
    count: missions.length,
    missions,
  };
  return json(enveloppe);
});
