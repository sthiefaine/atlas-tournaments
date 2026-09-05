/** Accès typé à `maps` : paramètres, graine, aperçu, une seule itération. */

import { desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../client';
import { maps, type ApercuCarte } from '../schema';
import type { MapDef, ParametresCarte, Statut } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `maps`. */
export type LigneCarte = typeof maps.$inferSelect;

/** Une carte par son identifiant. */
export async function carte(id: string): Promise<LigneCarte | null> {
  const lignes = await db().select().from(maps).where(eq(maps.id, id)).limit(1);
  return lignes[0] ?? null;
}

/** Une carte par son code. */
export async function carteParCode(code: string): Promise<LigneCarte | null> {
  const lignes = await db().select().from(maps).where(eq(maps.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Les cartes d'un ou plusieurs statuts, plus récentes d'abord. */
export async function parStatut(statuts: Statut[], limite = 50): Promise<LigneCarte[]> {
  return db().select().from(maps)
    .where(inArray(maps.statut, statuts))
    .orderBy(desc(maps.creeLe))
    .limit(limite);
}

/** Crée une carte à partir de paramètres et d'une graine : la grille vient du serveur. */
export async function deposer(entree: {
  code: string;
  graine: string;
  parametres: ParametresCarte;
  donnees: MapDef | null;
  apercu: ApercuCarte | null;
  diagnostic: Record<string, number> | null;
  source: string;
}): Promise<LigneCarte> {
  const lignes = await db().insert(maps).values({
    id: identifiant('map'),
    code: entree.code,
    graine: entree.graine,
    parametres: entree.parametres,
    donnees: entree.donnees,
    apercu: entree.apercu,
    diagnostic: entree.diagnostic,
    statut: 'brouillon',
    source: entree.source,
  }).onConflictDoUpdate({
    target: maps.code,
    set: {
      graine: entree.graine, parametres: entree.parametres, donnees: entree.donnees,
      apercu: entree.apercu, diagnostic: entree.diagnostic, statut: 'brouillon', majLe: new Date(),
    },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de carte sans retour');
  return ligne;
}

/**
 * Consomme l'unique itération d'aperçu. Rend `false` si elle est déjà épuisée :
 * c'est ce qui produit le `409 ITERATION_EPUISEE` de `05-routines.md` §3.3.
 */
export async function consommerIteration(id: string, apercu: ApercuCarte, graine: string): Promise<boolean> {
  const lignes = await db().update(maps)
    .set({ iterations: sql`${maps.iterations} + 1`, apercu, graine, majLe: new Date() })
    .where(sql`${maps.id} = ${id} and ${maps.iterations} = 0`)
    .returning({ id: maps.id });
  return lignes.length > 0;
}

/** Change le statut d'une carte. */
export async function changerStatut(id: string, statut: Statut): Promise<boolean> {
  const lignes = await db().update(maps)
    .set({ statut, majLe: new Date() })
    .where(eq(maps.id, id))
    .returning({ id: maps.id });
  return lignes.length > 0;
}
