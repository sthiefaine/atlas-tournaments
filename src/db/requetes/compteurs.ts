/** Accès typé à `compteurs` : `catalogueVersion` et `chainesVersion`. */

import { eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { compteurs } from '../schema';

/** Les deux compteurs versionnés du projet. */
export type CleCompteur = 'catalogue_version' | 'chaines_version';

/** Lit un compteur. Rend 1 si la ligne manque (base fraîchement migrée). */
export async function lire(cle: CleCompteur): Promise<number> {
  const lignes = await db().select().from(compteurs).where(eq(compteurs.cle, cle)).limit(1);
  return lignes[0]?.valeur ?? 1;
}

/**
 * Incrémente un compteur et rend sa nouvelle valeur. Tout changement de statut
 * d'unité passe par ici : un changement qui n'incrémente pas est un bug
 * (`05-routines.md` §9.3).
 */
export async function incrementer(cle: CleCompteur): Promise<number> {
  const lignes = await db().insert(compteurs)
    .values({ cle, valeur: 2 })
    .onConflictDoUpdate({
      target: compteurs.cle,
      set: { valeur: sql`${compteurs.valeur} + 1`, majLe: new Date() },
    })
    .returning({ valeur: compteurs.valeur });
  return lignes[0]?.valeur ?? 1;
}
