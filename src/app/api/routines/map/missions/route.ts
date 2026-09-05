/**
 * `GET /api/routines/map/missions?priorite=depeche&limite=<n>` — la **file
 * prioritaire quotidienne** de la Dépêche du jour (`05-routines.md` §8.2).
 *
 * L'enveloppe est **exactement** celle de `GET /api/routines/missions`, plus une
 * `echeance` par mission : une routine n'a pas deux formats à connaître. Une
 * mission dont l'heure limite est passée n'est pas servie — le jour reste blanc,
 * et rien n'est reporté au lendemain.
 */

import { runs } from '@/db/requetes/index';
import { candidatsMap } from '@/serveur/candidats';
import { baseDuSite, fileDeMissions, type EnveloppeMissions } from '@/serveur/missions';
import { promptDeRun } from '@/serveur/prompts';
import { entierBorne, erreur, json } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const params = new URL(requete.url).searchParams;
  const priorite = params.get('priorite');
  if (priorite !== null && priorite !== 'depeche') {
    return erreur('priorite_inconnue', 400, 'seule la valeur « depeche » existe aujourd’hui');
  }
  const limite = entierBorne(params.get('limite'), 2, 1, 4);

  const prompt = await promptDeRun('atlas_map');
  const run = await runs.ouvrirRun('atlas_map', prompt.version);
  const missions = await fileDeMissions(
    'atlas_map',
    await candidatsMap(),
    { limite, prioriteDepeche: true, base: baseDuSite(requete) },
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
