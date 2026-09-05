/** Accès typé à `unit_types` : le catalogue vivant et ses deux axes de statut. */

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '../client';
import { unitTypes } from '../schema';
import type { Statut, StatutUnite, Trait, UnitType } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne d'`unit_types`. */
export type LigneUnite = typeof unitTypes.$inferSelect;

/** Les statuts qui comptent dans le plafond de 24 unités actives. */
export const STATUTS_ACTIFS: StatutUnite[] = ['canon', 'essai', 'homologuee'];

/** Une unité par sa clé. */
export async function unite(cle: string): Promise<LigneUnite | null> {
  const lignes = await db().select().from(unitTypes).where(eq(unitTypes.cle, cle)).limit(1);
  return lignes[0] ?? null;
}

/** Le catalogue, filtré par statut d'homologation si on le demande. */
export async function catalogue(statuts?: StatutUnite[]): Promise<LigneUnite[]> {
  const q = db().select().from(unitTypes);
  if (statuts && statuts.length > 0) return q.where(inArray(unitTypes.statut, statuts)).orderBy(asc(unitTypes.cle));
  return q.orderBy(asc(unitTypes.cle));
}

/**
 * Combien d'unités occupent réellement une place au catalogue (plafond : 24).
 * Une candidate encore dans le pipeline ne compte pas : elle porte le statut
 * `essai` **demandé**, pas un statut accordé.
 */
export async function actives(): Promise<number> {
  const lignes = await db().select({ n: sql<number>`count(*)` }).from(unitTypes)
    .where(and(
      inArray(unitTypes.statut, STATUTS_ACTIFS),
      sql`${unitTypes.statutCycle} not in ('brouillon', 'en_controle', 'rejete', 'quarantaine')`,
    ));
  return Number(lignes[0]?.n ?? 0);
}

/** Les candidates déposées depuis `depuis` : le quota d'une par semaine. */
export async function candidatesDepuis(depuis: Date): Promise<number> {
  const lignes = await db().select({ n: sql<number>`count(*)` }).from(unitTypes)
    .where(and(ne(unitTypes.statut, 'canon'), sql`${unitTypes.creeLe} >= ${depuis.toISOString()}`));
  return Number(lignes[0]?.n ?? 0);
}

/** Les homologations prononcées depuis `depuis` : le quota d'une par mois. */
export async function homologationsDepuis(depuis: string): Promise<number> {
  const lignes = await db().select({ n: sql<number>`count(*)` }).from(unitTypes)
    .where(sql`${unitTypes.homologueeLe} is not null and ${unitTypes.homologueeLe} >= ${depuis}`);
  return Number(lignes[0]?.n ?? 0);
}

/** Dépose une candidate en brouillon, statut de catalogue `essai` demandé. */
export async function deposerCandidate(entree: {
  donnees: UnitType;
  catalogueVersion: number;
  sourceEventId: string | null;
}): Promise<LigneUnite> {
  const d = entree.donnees;
  const lignes = await db().insert(unitTypes).values({
    id: identifiant('unt'),
    cle: d.cle,
    donnees: d,
    statut: 'essai',
    statutCycle: 'brouillon',
    catalogueVersion: entree.catalogueVersion,
    traits: d.traits as Trait[],
    silhouette: d.silhouette,
    sourceEventId: entree.sourceEventId,
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de candidate sans retour');
  return ligne;
}

/** Change l'avancement de la candidate dans le pipeline de contenu. */
export async function changerCycle(cle: string, statutCycle: Statut): Promise<boolean> {
  const lignes = await db().update(unitTypes)
    .set({ statutCycle, majLe: new Date() })
    .where(eq(unitTypes.cle, cle))
    .returning({ id: unitTypes.id });
  return lignes.length > 0;
}

/**
 * Change la place de l'unité dans le catalogue et enregistre la nouvelle
 * `catalogueVersion`. Une ligne `canon` est intouchable : le refus est ici, en
 * base, pas seulement dans la route.
 */
export async function changerStatutCatalogue(entree: {
  cle: string;
  statut: StatutUnite;
  catalogueVersion: number;
  statutCycle?: Statut;
  essaiJusquAu?: string | null;
  homologueeLe?: string | null;
}): Promise<boolean> {
  const lignes = await db().update(unitTypes).set({
    statut: entree.statut,
    catalogueVersion: entree.catalogueVersion,
    ...(entree.statutCycle === undefined ? {} : { statutCycle: entree.statutCycle }),
    ...(entree.essaiJusquAu === undefined ? {} : { essaiJusquAu: entree.essaiJusquAu }),
    ...(entree.homologueeLe === undefined ? {} : { homologueeLe: entree.homologueeLe }),
    majLe: new Date(),
  }).where(and(eq(unitTypes.cle, entree.cle), ne(unitTypes.statut, 'canon')))
    .returning({ id: unitTypes.id });
  return lignes.length > 0;
}
