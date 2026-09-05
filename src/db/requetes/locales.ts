/** Accès typé à `locales` : ajouter une langue est une ligne ici, et rien d'autre. */

import { asc, eq } from 'drizzle-orm';

import { db } from '../client';
import { locales } from '../schema';
import { identifiant } from './communs';

/** Une ligne de `locales`. */
export type LigneLocale = typeof locales.$inferSelect;

/** Toutes les langues, dans l'ordre du sélecteur. */
export async function toutes(): Promise<LigneLocale[]> {
  return db().select().from(locales).orderBy(asc(locales.ordre));
}

/** Une langue par son code BCP 47 minuscule. */
export async function locale(code: string): Promise<LigneLocale | null> {
  const lignes = await db().select().from(locales).where(eq(locales.code, code)).limit(1);
  return lignes[0] ?? null;
}

/** Les langues cibles : toutes sauf `fr`, qui est la source. */
export async function cibles(): Promise<LigneLocale[]> {
  const l = await toutes();
  return l.filter((x) => x.code !== 'fr');
}

/** Ajoute une langue. Une seule ligne suffit : le reste se calcule. */
export async function ajouter(entree: {
  code: string; nom: string; script: string; sens?: string;
  facteurLongueur?: number; echantillonHumain?: number; ordre?: number; registre?: string;
}): Promise<LigneLocale> {
  const lignes = await db().insert(locales).values({
    id: identifiant('loc'),
    code: entree.code,
    nom: entree.nom,
    script: entree.script,
    sens: entree.sens ?? 'ltr',
    statut: 'en_preparation',
    facteurLongueur: String(entree.facteurLongueur ?? 1.0),
    echantillonHumain: entree.echantillonHumain ?? 20,
    ordre: entree.ordre ?? 100,
    registre: entree.registre ?? '',
  }).onConflictDoNothing().returning();
  const ligne = lignes[0];
  if (!ligne) {
    const existante = await locale(entree.code);
    if (!existante) throw new Error('ajout de langue sans retour');
    return existante;
  }
  return ligne;
}

/**
 * Active une langue. `fr` et `en` ne sont jamais rétrogradés, et une langue
 * active ne redevient jamais `en_preparation` (`09-i18n.md` §5.2).
 */
export async function activer(code: string): Promise<boolean> {
  const lignes = await db().update(locales)
    .set({ statut: 'active', echantillonHumain: 0, majLe: new Date() })
    .where(eq(locales.code, code))
    .returning({ id: locales.id });
  return lignes.length > 0;
}

/** Écrit le registre de la langue, recopié ensuite dans chaque lot de traduction. */
export async function ecrireRegistre(code: string, registre: string): Promise<void> {
  await db().update(locales).set({ registre, majLe: new Date() }).where(eq(locales.code, code));
}
