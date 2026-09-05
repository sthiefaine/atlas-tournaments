/** Accès typé à `commanders`. */

import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '../client';
import { commanders } from '../schema';
import type { Commander, Statut } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `commanders`. */
export type LigneCommandant = typeof commanders.$inferSelect;

/** Un commandant par son code. */
export async function commandant(code: string): Promise<LigneCommandant | null> {
  const lignes = await db().select().from(commanders).where(eq(commanders.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Les commandants d'un pays : sert au contrôle de redite entre voisins. */
export async function parPays(paysCode: string): Promise<LigneCommandant[]> {
  return db().select().from(commanders).where(eq(commanders.paysCode, paysCode)).orderBy(asc(commanders.code));
}

/** Les commandants d'un ou plusieurs statuts. */
export async function parStatut(statuts: Statut[]): Promise<LigneCommandant[]> {
  return db().select().from(commanders)
    .where(inArray(commanders.statut, statuts))
    .orderBy(asc(commanders.code));
}

/** Enregistre un commandant en brouillon. */
export async function deposer(donnees: Commander, source: string): Promise<LigneCommandant> {
  const lignes = await db().insert(commanders).values({
    id: identifiant('cmd'),
    code: donnees.code,
    paysCode: donnees.paysCode,
    donnees,
    statut: 'brouillon',
    source,
  }).onConflictDoUpdate({
    target: commanders.code,
    set: { donnees, paysCode: donnees.paysCode, statut: 'brouillon', majLe: new Date(), source },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de commandant sans retour');
  return ligne;
}

/** Change le statut d'un commandant. */
export async function changerStatut(code: string, statut: Statut): Promise<boolean> {
  const lignes = await db().update(commanders)
    .set({ statut, majLe: new Date() })
    .where(eq(commanders.code, code))
    .returning({ id: commanders.id });
  return lignes.length > 0;
}
