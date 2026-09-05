/** Accès typé à `scenarios` : `date` et `catalogue_version` sont des colonnes. */

import { desc, eq, inArray } from 'drizzle-orm';

import { db } from '../client';
import { scenarios } from '../schema';
import type { Scenario, Statut } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `scenarios`. */
export type LigneScenario = typeof scenarios.$inferSelect;

/** Un scénario par son code. */
export async function scenario(code: string): Promise<LigneScenario | null> {
  const lignes = await db().select().from(scenarios).where(eq(scenarios.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Un scénario par son identifiant interne. */
export async function parId(id: string): Promise<LigneScenario | null> {
  const lignes = await db().select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
  return lignes[0] ?? null;
}

/** Les scénarios d'un ou plusieurs statuts. */
export async function parStatut(statuts: Statut[], limite = 50): Promise<LigneScenario[]> {
  return db().select().from(scenarios)
    .where(inArray(scenarios.statut, statuts))
    .orderBy(desc(scenarios.creeLe))
    .limit(limite);
}

/** Dépose un scénario en brouillon, en figeant ses deux versions. */
export async function deposer(entree: {
  donnees: Scenario;
  mapId: string | null;
  catalogueVersion: number;
  chainesVersion: number;
  source: string;
}): Promise<LigneScenario> {
  const d = entree.donnees;
  const lignes = await db().insert(scenarios).values({
    id: identifiant('scn'),
    code: d.code,
    mapId: entree.mapId,
    donnees: d,
    acte: d.acte,
    paysCode: d.paysCode,
    date: d.date,
    catalogueVersion: entree.catalogueVersion,
    chainesVersion: entree.chainesVersion,
    statut: 'brouillon',
    source: entree.source,
  }).onConflictDoUpdate({
    target: scenarios.code,
    set: {
      donnees: d, mapId: entree.mapId, acte: d.acte, paysCode: d.paysCode, date: d.date,
      statut: 'brouillon', majLe: new Date(),
    },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de scénario sans retour');
  return ligne;
}

/** Change le statut d'un scénario. */
export async function changerStatut(code: string, statut: Statut): Promise<boolean> {
  const lignes = await db().update(scenarios)
    .set({ statut, majLe: new Date() })
    .where(eq(scenarios.code, code))
    .returning({ id: scenarios.id });
  return lignes.length > 0;
}
