/** Accès typé à `ai_prompts` : historique, version courante, promotion, retour arrière. */

import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { aiPrompts, type SectionsVerrouillees } from '../schema';
import type { ClePrompt, StatutPrompt } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne d'`ai_prompts`, telle qu'elle sort de la base. */
export type LignePrompt = typeof aiPrompts.$inferSelect;

/** La version `courant` d'une clé, ou `null` si la base n'en a aucune. */
export async function prompteCourant(cle: ClePrompt): Promise<LignePrompt | null> {
  const lignes = await db().select().from(aiPrompts)
    .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.statut, 'courant')))
    .limit(1);
  return lignes[0] ?? null;
}

/** L'historique complet d'une clé, version décroissante. */
export async function historique(cle: ClePrompt, limite = 50): Promise<LignePrompt[]> {
  return db().select().from(aiPrompts)
    .where(eq(aiPrompts.cle, cle))
    .orderBy(desc(aiPrompts.version))
    .limit(limite);
}

/** Une version précise. */
export async function versionPrompt(cle: ClePrompt, version: number): Promise<LignePrompt | null> {
  const lignes = await db().select().from(aiPrompts)
    .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.version, version)))
    .limit(1);
  return lignes[0] ?? null;
}

/** La plus haute version connue d'une clé, 0 si la clé est vierge. */
export async function versionMax(cle: ClePrompt): Promise<number> {
  const lignes = await db()
    .select({ max: sql<number>`coalesce(max(${aiPrompts.version}), 0)` })
    .from(aiPrompts).where(eq(aiPrompts.cle, cle));
  return Number(lignes[0]?.max ?? 0);
}

/** Toutes les candidates en attente, toutes clés confondues. */
export async function candidates(): Promise<LignePrompt[]> {
  return db().select().from(aiPrompts)
    .where(eq(aiPrompts.statut, 'propose'))
    .orderBy(desc(aiPrompts.createdAt));
}

/** Insère une version. Ne promeut rien : c'est `promouvoir` qui décide. */
export async function insererVersion(entree: {
  cle: ClePrompt;
  version: number;
  corps: string;
  sections: SectionsVerrouillees;
  auteur: 'humain' | 'atlas_cerveau';
  auteurRef?: string;
  statut: StatutPrompt;
  justification: string;
  diffResume: string[];
  parentVersion: number | null;
  valideParHumain: boolean;
}): Promise<LignePrompt> {
  const lignes = await db().insert(aiPrompts).values({
    id: identifiant('prm'),
    cle: entree.cle,
    version: entree.version,
    corps: entree.corps,
    sections: entree.sections,
    auteur: entree.auteur,
    auteurRef: entree.auteurRef ?? null,
    statut: entree.statut,
    justification: entree.justification,
    diffResume: entree.diffResume,
    parentVersion: entree.parentVersion,
    valideParHumain: entree.valideParHumain,
    activeLe: entree.statut === 'courant' ? new Date() : null,
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('insertion de prompt sans retour');
  return ligne;
}

/**
 * Promeut une version en `courant` : l'ancienne passe `retire`, dans la même
 * transaction. Le retour arrière est exactement le même geste sur une version
 * antérieure (`05-routines.md` §1.2).
 */
export async function promouvoir(cle: ClePrompt, version: number): Promise<boolean> {
  return db().transaction(async (tx) => {
    const cible = await tx.select().from(aiPrompts)
      .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.version, version))).limit(1);
    if (!cible[0]) return false;
    await tx.update(aiPrompts).set({ statut: 'retire' })
      .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.statut, 'courant')));
    await tx.update(aiPrompts)
      .set({ statut: 'courant', activeLe: new Date(), valideParHumain: true })
      .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.version, version)));
    return true;
  });
}

/** Écarte une candidate : elle passe `retire` avec un motif dans sa justification. */
export async function rejeterCandidate(cle: ClePrompt, version: number, motif: string): Promise<boolean> {
  const lignes = await db().update(aiPrompts)
    .set({ statut: 'retire', justification: sql`${aiPrompts.justification} || ' — refusée : ' || ${motif}` })
    .where(and(eq(aiPrompts.cle, cle), eq(aiPrompts.version, version), eq(aiPrompts.statut, 'propose')))
    .returning({ id: aiPrompts.id });
  return lignes.length > 0;
}

/** Nombre de candidates déposées par le cerveau sur une clé depuis `depuis`. */
export async function candidatesDepuis(cle: ClePrompt, depuis: Date): Promise<number> {
  const lignes = await db()
    .select({ n: sql<number>`count(*)` }).from(aiPrompts)
    .where(and(
      eq(aiPrompts.cle, cle),
      eq(aiPrompts.auteur, 'atlas_cerveau'),
      sql`${aiPrompts.createdAt} >= ${depuis.toISOString()}`,
    ));
  return Number(lignes[0]?.n ?? 0);
}
