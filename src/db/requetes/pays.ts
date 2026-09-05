/** Accès typé à `countries` : les 24 fiches pays, canon et généré confondus. */

import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '../client';
import { countries } from '../schema';
import type { Country, Statut } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `countries`. */
export type LignePays = typeof countries.$inferSelect;

/** Un pays par son code ISO. */
export async function pays(code: string): Promise<LignePays | null> {
  const lignes = await db().select().from(countries).where(eq(countries.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Tous les pays d'un ou plusieurs statuts, par code. */
export async function parStatut(statuts: Statut[]): Promise<LignePays[]> {
  return db().select().from(countries)
    .where(inArray(countries.statut, statuts))
    .orderBy(asc(countries.code));
}

/** Tous les pays, quel que soit leur statut. */
export async function tous(): Promise<LignePays[]> {
  return db().select().from(countries).orderBy(asc(countries.code));
}

/** Enregistre un pays en brouillon (ou remplace le brouillon existant). */
export async function deposer(donnees: Country, source: string): Promise<LignePays> {
  const lignes = await db().insert(countries).values({
    id: identifiant('pay'),
    code: donnees.code,
    donnees,
    statut: 'brouillon',
    source,
  }).onConflictDoUpdate({
    target: countries.code,
    set: { donnees, statut: 'brouillon', majLe: new Date(), source },
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('dépôt de pays sans retour');
  return ligne;
}

/** Change le statut d'un pays. Le contrôle des transitions vit dans `serveur/cycle.ts`. */
export async function changerStatut(code: string, statut: Statut): Promise<boolean> {
  const lignes = await db().update(countries)
    .set({ statut, majLe: new Date() })
    .where(eq(countries.code, code))
    .returning({ id: countries.id });
  return lignes.length > 0;
}
