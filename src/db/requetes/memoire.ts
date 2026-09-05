/** Accès typé à `memory` : entrées structurées, datées, sourcées, expirantes. */

import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { memory } from '../schema';
import type { MemoryEntry, PorteeMemoire } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `memory`. */
export type LigneMemoire = typeof memory.$inferSelect;

/** Les entrées vivantes d'une portée : ni archivées, ni expirées. */
export async function vivantes(portee: PorteeMemoire, limite = 200): Promise<LigneMemoire[]> {
  return db().select().from(memory)
    .where(and(
      eq(memory.portee, portee),
      eq(memory.archivee, false),
      sql`(${memory.expireLe} is null or ${memory.expireLe} >= current_date)`,
    ))
    .orderBy(desc(memory.poids), desc(memory.date))
    .limit(limite);
}

/** Combien d'entrées vivantes porte une portée : le plafond est de 200 (`05` §5.3). */
export async function compterVivantes(portee: PorteeMemoire): Promise<number> {
  const lignes = await db().select({ n: sql<number>`count(*)` }).from(memory)
    .where(and(eq(memory.portee, portee), eq(memory.archivee, false)));
  return Number(lignes[0]?.n ?? 0);
}

/**
 * Insère une entrée, ou **déduplique** : même sujet, portée et référence,
 * l'entrée existante voit ses `occurrences` incrémentées et son `expireLe`
 * repoussé, plutôt qu'une ligne de plus (`05-routines.md` §5.3).
 */
export async function deposer(entree: MemoryEntry): Promise<{ ligne: LigneMemoire; dedupliquee: boolean }> {
  const jumelles = await db().select().from(memory)
    .where(and(
      eq(memory.sujet, entree.sujet),
      eq(memory.portee, entree.portee),
      entree.porteeRef === null ? sql`${memory.porteeRef} is null` : eq(memory.porteeRef, entree.porteeRef),
      eq(memory.archivee, false),
    ))
    .limit(1);
  const jumelle = jumelles[0];
  if (jumelle) {
    const lignes = await db().update(memory).set({
      occurrences: sql`${memory.occurrences} + 1`,
      expireLe: entree.expireLe,
      poids: Math.max(jumelle.poids, entree.poids),
      majLe: new Date(),
    }).where(eq(memory.id, jumelle.id)).returning();
    const ligne = lignes[0];
    if (!ligne) throw new Error('déduplication de mémoire sans retour');
    return { ligne, dedupliquee: true };
  }
  const lignes = await db().insert(memory).values({
    id: identifiant('mem'),
    cle: entree.cle,
    date: entree.date,
    source: entree.source,
    sourceRef: entree.sourceRef ?? null,
    sujet: entree.sujet,
    portee: entree.portee,
    porteeRef: entree.porteeRef,
    contenu: entree,
    poids: entree.poids,
    occurrences: entree.occurrences,
    expireLe: entree.expireLe,
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de mémoire sans retour');
  return { ligne, dedupliquee: false };
}

/** Archive une entrée : rien n'est détruit. */
export async function archiver(cle: string): Promise<boolean> {
  const lignes = await db().update(memory)
    .set({ archivee: true, majLe: new Date() })
    .where(eq(memory.cle, cle))
    .returning({ id: memory.id });
  return lignes.length > 0;
}
