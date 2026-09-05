/** Accès typé à `routine_missions` : réservation, reprise, clôture, quarantaine. */

import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { routineMissions, type StatutMission } from '../schema';
import type { ClePrompt } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `routine_missions`. */
export type LigneMission = typeof routineMissions.$inferSelect;

/** Les missions encore ouvertes d'une routine, dans l'ordre de la file serveur. */
export async function missionsOuvertes(routine: ClePrompt, limite: number): Promise<LigneMission[]> {
  return db().select().from(routineMissions)
    .where(and(eq(routineMissions.routine, routine), eq(routineMissions.statut, 'ouverte')))
    .orderBy(asc(routineMissions.priorite), asc(routineMissions.ouverteDepuis))
    .limit(limite);
}

/** Une mission par son identifiant. */
export async function mission(id: string): Promise<LigneMission | null> {
  const lignes = await db().select().from(routineMissions).where(eq(routineMissions.id, id)).limit(1);
  return lignes[0] ?? null;
}

/** Ouvre une mission. Une cible déjà réservée n'en produit pas une seconde. */
export async function ouvrirMission(entree: {
  routine: ClePrompt;
  kind: string;
  cibleType: string;
  cibleCle: string;
  priorite: number;
  echeance?: Date | null;
  contexte?: Record<string, unknown>;
  runId?: string | null;
}): Promise<LigneMission | null> {
  const lignes = await db().insert(routineMissions).values({
    id: identifiant('msn'),
    routine: entree.routine,
    kind: entree.kind,
    cibleType: entree.cibleType,
    cibleCle: entree.cibleCle,
    priorite: entree.priorite,
    echeance: entree.echeance ?? null,
    contexte: entree.contexte ?? {},
    runId: entree.runId ?? null,
  }).onConflictDoNothing().returning();
  return lignes[0] ?? null;
}

/** Ferme une mission dans un statut terminal, avec la réponse rendue s'il y en a une. */
export async function clore(
  id: string,
  statut: Exclude<StatutMission, 'ouverte'>,
  reponse?: Record<string, unknown>,
): Promise<void> {
  await db().update(routineMissions)
    .set({ statut, closeLe: new Date(), reponse: reponse ?? null })
    .where(eq(routineMissions.id, id));
}

/** Attache la clé d'idempotence d'un `POST` de soumission. */
export async function marquerIdempotence(id: string, cle: string): Promise<void> {
  await db().update(routineMissions).set({ idempotencyKey: cle }).where(eq(routineMissions.id, id));
}

/**
 * Expire les réservations trop vieilles : une mission ouverte non soumise depuis
 * plus de `minutes` retourne dans la file (`05-routines.md` §1.5).
 */
export async function expirerReservations(minutes: number): Promise<number> {
  const lignes = await db().update(routineMissions)
    .set({ statut: 'expiree', closeLe: new Date() })
    .where(and(
      eq(routineMissions.statut, 'ouverte'),
      sql`${routineMissions.ouverteDepuis} < now() - make_interval(mins => ${minutes})`,
    ))
    .returning({ id: routineMissions.id });
  return lignes.length;
}

/** Ferme d'office les missions à échéance dépassée : `evenement_perime`, jamais de report. */
export async function expirerEcheances(): Promise<string[]> {
  const lignes = await db().update(routineMissions)
    .set({ statut: 'expiree', closeLe: new Date() })
    .where(and(
      eq(routineMissions.statut, 'ouverte'),
      sql`${routineMissions.echeance} is not null and ${routineMissions.echeance} < now()`,
    ))
    .returning({ id: routineMissions.id });
  return lignes.map((l) => l.id);
}

/** Nombre de missions ouvertes par routine : la profondeur de file de l'administration. */
export async function profondeurFile(): Promise<{ routine: string; n: number }[]> {
  const lignes = await db().select({
    routine: routineMissions.routine,
    n: sql<number>`count(*)`,
  }).from(routineMissions)
    .where(eq(routineMissions.statut, 'ouverte'))
    .groupBy(routineMissions.routine);
  return lignes.map((l) => ({ routine: l.routine, n: Number(l.n) }));
}
