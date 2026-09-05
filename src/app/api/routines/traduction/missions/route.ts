/**
 * `GET /api/routines/traduction/missions` — la file de la cinquième routine,
 * **triée par pénurie** (`09-i18n.md` §8.2).
 *
 * L'enveloppe est exactement celle de `GET /api/routines/missions`, plus `penurie`
 * et `lotUrl`. **La routine ne choisit pas la langue** : le serveur la choisit, et
 * une seule par run.
 */

import { localesReq, runs, traductions } from '@/db/requetes/index';
import { candidatsTraduction } from '@/serveur/candidats';
import { baseDuSite, fileDeMissions, type EnveloppeMissions } from '@/serveur/missions';
import { promptDeRun } from '@/serveur/prompts';
import { json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  // Toute langue cible reçoit ses lignes `manquante` avant qu'on mesure la pénurie.
  for (const l of await localesReq.cibles()) await traductions.semer(l.code);

  const prompt = await promptDeRun('atlas_traduction');
  const run = await runs.ouvrirRun('atlas_traduction', prompt.version);
  const base = baseDuSite(requete);
  const missions = await fileDeMissions(
    'atlas_traduction',
    await candidatsTraduction(),
    { limite: 1, base },
    run.id,
  );
  await runs.compter(run.id, { recues: missions.length });

  const enrichies = [];
  for (const m of missions) {
    enrichies.push({
      ...m,
      penurie: await traductions.penurie(m.cible.cle),
      lotUrl: `${base}/api/routines/traduction/lot?locale=${m.cible.cle}&limite=60`,
      submitUrl: `${base}/api/routines/traduction/soumettre`,
    });
  }

  const enveloppe: EnveloppeMissions & { missions: typeof enrichies } = {
    key: prompt.key,
    version: prompt.version,
    body: prompt.body,
    count: enrichies.length,
    missions: enrichies,
  };
  return json(enveloppe);
});
