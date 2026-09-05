/** Accès typé à `glossaires` : copie miroir du canon, jamais écrite par une routine. */

import { eq } from 'drizzle-orm';

import { db } from '../client';
import { glossaires } from '../schema';
import type { EntreeGlossaire } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `glossaires`. */
export type LigneGlossaire = typeof glossaires.$inferSelect;

/** Le glossaire d'une langue. Sans lui, aucun lot n'est servi (`09-i18n.md` §5.1). */
export async function glossaire(locale: string): Promise<LigneGlossaire | null> {
  const lignes = await db().select().from(glossaires).where(eq(glossaires.locale, locale)).limit(1);
  return lignes[0] ?? null;
}

/** Tous les glossaires connus. */
export async function tous(): Promise<LigneGlossaire[]> {
  return db().select().from(glossaires);
}

/**
 * Pose un glossaire depuis `content/i18n/` : appelé par le déploiement ou une
 * migration, jamais par `atlas_traduction`.
 */
export async function poser(entree: {
  locale: string; entrees: EntreeGlossaire[]; termesInterdits: string[];
}): Promise<LigneGlossaire> {
  const lignes = await db().insert(glossaires).values({
    id: identifiant('glo'),
    locale: entree.locale,
    entrees: entree.entrees,
    termesInterdits: entree.termesInterdits,
  }).onConflictDoUpdate({
    target: glossaires.locale,
    set: { entrees: entree.entrees, termesInterdits: entree.termesInterdits, majLe: new Date() },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('pose de glossaire sans retour');
  return ligne;
}
