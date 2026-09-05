/**
 * La sonde « homme mort » (`05-routines.md` §1.7).
 *
 * Elle répond `200` tant que chaque routine a produit un run terminé dans son
 * délai de silence maximal, et **`500`** dès qu'une seule dépasse. Publique, sans
 * authentification, et elle ne divulgue aucun contenu : des clés, des horodatages,
 * des booléens.
 *
 * C'est le seul point qui détecte une tâche planifiée silencieusement désactivée —
 * le cas de panne le plus vicieux, parce qu'il ne produit aucune erreur.
 */

import { runs } from '../db/requetes/index';
import { CLES_PROMPT, type ClePrompt } from '../schemas/index';

/** Cadence nominale de chaque routine, en minutes (`05-routines.md` §7.1). */
export const CADENCE_MIN: Record<ClePrompt, number> = {
  atlas_controle: 30,
  atlas_map: 360,
  atlas_lore: 720,
  atlas_cerveau: 1440,
  atlas_traduction: 480,
};

/**
 * Le silence maximal toléré : trois fois la cadence nominale. Surchargeable par
 * environnement (`SILENCE_ATLAS_MAP=900`) sans redéploiement de code.
 */
export function silenceMaxMin(routine: ClePrompt): number {
  const surcharge = Number(process.env[`SILENCE_${routine.toUpperCase()}`]);
  if (Number.isFinite(surcharge) && surcharge > 0) return Math.floor(surcharge);
  return CADENCE_MIN[routine] * 3;
}

/** L'état d'une routine tel que la sonde le publie. */
export interface EtatRoutine {
  key: ClePrompt;
  dernier_run: string | null;
  silence_max_min: number;
  ok: boolean;
}

/** L'état complet de la sonde. */
export interface EtatSonde {
  ok: boolean;
  routines: EtatRoutine[];
}

/**
 * Décide de l'état d'une routine. Pur, donc testable : une routine qui n'a
 * **jamais** tourné n'est pas en panne — elle n'est pas encore en service, et la
 * mise en service est une décision humaine (`05-routines.md` §10).
 */
export function etatDeRoutine(
  routine: ClePrompt,
  dernierRun: Date | null,
  maintenant: Date,
  silenceMax: number,
): EtatRoutine {
  const ok = dernierRun === null
    ? true
    : maintenant.getTime() - dernierRun.getTime() <= silenceMax * 60_000;
  return {
    key: routine,
    dernier_run: dernierRun ? dernierRun.toISOString() : null,
    silence_max_min: silenceMax,
    ok,
  };
}

/** Interroge la base et rend l'état complet de la sonde. */
export async function sonder(maintenant = new Date()): Promise<EtatSonde> {
  // Un run resté ouvert au-delà de son silence maximal est fermé en `coupe`.
  await runs.fermerRunsAbandonnes(Math.max(...Object.values(CADENCE_MIN)) * 3);
  const etats: EtatRoutine[] = [];
  for (const routine of CLES_PROMPT) {
    const dernier = await runs.dernierRunTermine(routine);
    etats.push(etatDeRoutine(routine, dernier?.finiLe ?? null, maintenant, silenceMaxMin(routine)));
  }
  return { ok: etats.every((e) => e.ok), routines: etats };
}
