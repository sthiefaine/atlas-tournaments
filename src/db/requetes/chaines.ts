/** Accès typé à `chaines_source` : les originaux français et leur empreinte. */

import { asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../client';
import { chainesSource, traductions } from '../schema';
import { empreinteCourte } from './communs';

/** Une ligne de `chaines_source`. */
export type LigneChaine = typeof chainesSource.$inferSelect;

/** Ce qu'un appelant fournit pour une chaîne source : le calcul reste au serveur. */
export interface EntreeChaine {
  cle: string;
  texte: string;
  origine: 'interface' | 'canon' | 'genere';
  contexte?: { ecran?: string; locuteur?: string; note?: string };
  longueurMax?: number | null;
  pluriel?: boolean;
  objetRef?: { type: string; cle: string; champ: string } | null;
}

/** Extrait les marqueurs `{…}` d'un texte. Le serveur les calcule, jamais la routine. */
export function extrairePlaceholders(texte: string): string[] {
  const trouves = texte.match(/\{[a-z][a-z0-9_]*\}/g) ?? [];
  return [...new Set(trouves)].sort();
}

/** Une chaîne source par sa clé. */
export async function chaine(cle: string): Promise<LigneChaine | null> {
  const lignes = await db().select().from(chainesSource).where(eq(chainesSource.cle, cle)).limit(1);
  return lignes[0] ?? null;
}

/** Toutes les chaînes d'une origine. */
export async function parOrigine(origine: 'interface' | 'canon' | 'genere'): Promise<LigneChaine[]> {
  return db().select().from(chainesSource)
    .where(eq(chainesSource.origine, origine))
    .orderBy(asc(chainesSource.cle));
}

/** Plusieurs chaînes par clés. */
export async function parCles(cles: string[]): Promise<LigneChaine[]> {
  if (cles.length === 0) return [];
  return db().select().from(chainesSource).where(inArray(chainesSource.cle, cles));
}

/**
 * Insère ou met à jour une chaîne source. **Idempotent** : si le texte n'a pas
 * bougé, rien n'est écrit et `change` vaut faux. Sinon `source_hash` change,
 * `version_chaine` est incrémentée, et les traductions basculent `perimee` —
 * c'est ce qui garantit qu'une correction du français atteint les huit langues.
 */
export async function poser(entree: EntreeChaine): Promise<{ ligne: LigneChaine; change: boolean; perimees: number }> {
  const hash = empreinteCourte(entree.texte);
  const existante = await chaine(entree.cle);
  if (existante && existante.sourceHash === hash) {
    return { ligne: existante, change: false, perimees: 0 };
  }
  const valeurs = {
    cle: entree.cle,
    texte: entree.texte,
    origine: entree.origine,
    contexte: entree.contexte ?? {},
    longueurMax: entree.longueurMax ?? null,
    placeholders: extrairePlaceholders(entree.texte),
    pluriel: entree.pluriel ?? false,
    sourceHash: hash,
    objetRef: entree.objetRef ?? null,
  };
  const lignes = await db().insert(chainesSource)
    .values({ ...valeurs, versionChaine: 1 })
    .onConflictDoUpdate({
      target: chainesSource.cle,
      set: { ...valeurs, versionChaine: sql`${chainesSource.versionChaine} + 1`, majLe: new Date() },
    })
    .returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('pose de chaîne source sans retour');

  const basculees = await db().update(traductions)
    .set({ statut: 'perimee', majLe: new Date() })
    .where(sql`${traductions.cleChaine} = ${entree.cle}
               and ${traductions.statut} = 'validee'
               and ${traductions.sourceHash} <> ${hash}`)
    .returning({ id: traductions.id });

  return { ligne, change: true, perimees: basculees.length };
}

/** Nombre total de chaînes source, éventuellement filtré par origine. */
export async function compter(origines?: ('interface' | 'canon' | 'genere')[]): Promise<number> {
  const base = db().select({ n: sql<number>`count(*)` }).from(chainesSource);
  const lignes = origines && origines.length > 0
    ? await base.where(inArray(chainesSource.origine, origines))
    : await base;
  return Number(lignes[0]?.n ?? 0);
}
