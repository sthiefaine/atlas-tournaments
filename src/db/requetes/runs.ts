/** Accès typé à `routine_runs` : le journal d'un run, du premier GET à la ligne de bilan. */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../client';
import { routineRuns, type ErreurRun, type StatutRun } from '../schema';
import type { ClePrompt } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `routine_runs`. */
export type LigneRun = typeof routineRuns.$inferSelect;

/** Ouvre un run, ou reprend celui déjà ouvert pour cette routine. */
export async function ouvrirRun(routine: ClePrompt, promptVersion: number | null): Promise<LigneRun> {
  const ouverts = await db().select().from(routineRuns)
    .where(and(eq(routineRuns.routine, routine), isNull(routineRuns.finiLe)))
    .orderBy(desc(routineRuns.demarreLe)).limit(1);
  const encours = ouverts[0];
  if (encours) return encours;
  const lignes = await db().insert(routineRuns).values({
    id: identifiant('run'),
    routine,
    promptVersion,
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('ouverture de run sans retour');
  return ligne;
}

/** Compte un appel (et, au choix, une mission reçue ou soumise) sur un run. */
export async function compter(
  runId: string,
  quoi: { appels?: number; recues?: number; soumises?: number },
): Promise<void> {
  await db().update(routineRuns).set({
    appels: sql`${routineRuns.appels} + ${quoi.appels ?? 0}`,
    missionsRecues: sql`${routineRuns.missionsRecues} + ${quoi.recues ?? 0}`,
    missionsSoumises: sql`${routineRuns.missionsSoumises} + ${quoi.soumises ?? 0}`,
  }).where(eq(routineRuns.id, runId));
}

/** Consigne une erreur sur un run : un code, jamais du contenu de mission. */
export async function consignerErreur(runId: string, erreur: ErreurRun): Promise<void> {
  await db().update(routineRuns)
    .set({ erreurs: sql`${routineRuns.erreurs} || ${JSON.stringify([erreur])}::jsonb` })
    .where(eq(routineRuns.id, runId));
}

/** Ferme un run avec son statut et sa ligne de bilan. */
export async function fermerRun(runId: string, statut: StatutRun, bilan: string | null): Promise<void> {
  await db().update(routineRuns)
    .set({ statut, bilan, finiLe: new Date() })
    .where(eq(routineRuns.id, runId));
}

/** Le dernier run terminé d'une routine : c'est ce que lit la sonde « homme mort ». */
export async function dernierRunTermine(routine: ClePrompt): Promise<LigneRun | null> {
  const lignes = await db().select().from(routineRuns)
    .where(and(eq(routineRuns.routine, routine), sql`${routineRuns.finiLe} is not null`))
    .orderBy(desc(routineRuns.finiLe)).limit(1);
  return lignes[0] ?? null;
}

/** Les derniers runs, toutes routines confondues : le journal de l'administration. */
export async function derniersRuns(limite = 40): Promise<LigneRun[]> {
  return db().select().from(routineRuns).orderBy(desc(routineRuns.demarreLe)).limit(limite);
}

/** Ferme en `coupe` les runs ouverts depuis plus de `minutes`. */
export async function fermerRunsAbandonnes(minutes: number): Promise<number> {
  const lignes = await db().update(routineRuns)
    .set({ statut: 'coupe', finiLe: new Date(), bilan: 'run fermé automatiquement : silence dépassé' })
    .where(and(
      isNull(routineRuns.finiLe),
      sql`${routineRuns.demarreLe} < now() - make_interval(mins => ${minutes})`,
    ))
    .returning({ id: routineRuns.id });
  return lignes.length;
}

/** Métriques agrégées d'une routine sur une fenêtre glissante (volet prompts du cerveau). */
export async function metriques(routine: ClePrompt, jours: number): Promise<{
  runs: number; missions: number; soumissions: number; echecs: number;
}> {
  const lignes = await db().select({
    runs: sql<number>`count(*)`,
    missions: sql<number>`coalesce(sum(${routineRuns.missionsRecues}), 0)`,
    soumissions: sql<number>`coalesce(sum(${routineRuns.missionsSoumises}), 0)`,
    echecs: sql<number>`count(*) filter (where ${routineRuns.statut} in ('echec', 'coupe'))`,
  }).from(routineRuns).where(and(
    eq(routineRuns.routine, routine),
    sql`${routineRuns.demarreLe} >= now() - make_interval(days => ${jours})`,
  ));
  const l = lignes[0];
  return {
    runs: Number(l?.runs ?? 0),
    missions: Number(l?.missions ?? 0),
    soumissions: Number(l?.soumissions ?? 0),
    echecs: Number(l?.echecs ?? 0),
  };
}
