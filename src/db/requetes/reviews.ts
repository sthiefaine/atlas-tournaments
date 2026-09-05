/** Accès typé à `reviews` : le journal d'audit du gardien, jamais purgé. */

import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { reviews } from '../schema';
import type { CibleReview, ReviewVerdict } from '../../schemas/index';
import { identifiant } from './communs';

/** Une ligne de `reviews`. */
export type LigneReview = typeof reviews.$inferSelect;

/** Enregistre un verdict. Les codes de motifs sont extraits pour l'index. */
export async function enregistrer(verdict: ReviewVerdict): Promise<LigneReview> {
  const lignes = await db().insert(reviews).values({
    id: identifiant('rvw'),
    cle: verdict.cle,
    cibleType: verdict.cibleType,
    cibleCle: verdict.cibleCle,
    cibleVersion: verdict.cibleVersion,
    verdict: verdict.verdict,
    motifs: verdict.motifs,
    codesMotifs: verdict.motifs.map((m) => m.code),
    stats: verdict.stats,
    coherenceLore: String(verdict.coherenceLore),
    suggestions: verdict.suggestions,
    routineRunId: verdict.routineRunId,
  }).returning();
  const ligne = lignes[0];
  if (!ligne) throw new Error('enregistrement de review sans retour');
  return ligne;
}

/** Les verdicts rendus sur une cible, plus récents d'abord. */
export async function surCible(cibleType: CibleReview, cibleCle: string): Promise<LigneReview[]> {
  return db().select().from(reviews)
    .where(and(eq(reviews.cibleType, cibleType), eq(reviews.cibleCle, cibleCle)))
    .orderBy(desc(reviews.createdAt));
}

/** Combien de rejets sur une cible : trois rejets l'archivent (`02` §6). */
export async function rejetsSurCible(cibleType: CibleReview, cibleCle: string): Promise<number> {
  const lignes = await db().select({ n: sql<number>`count(*)` }).from(reviews)
    .where(and(
      eq(reviews.cibleType, cibleType),
      eq(reviews.cibleCle, cibleCle),
      eq(reviews.verdict, 'rejete'),
    ));
  return Number(lignes[0]?.n ?? 0);
}

/**
 * Motifs de rejet des `jours` derniers jours sur un type de cible, triés par
 * fréquence : c'est la matière du champ `apprise` (`05-routines.md` §1.9).
 */
export async function motifsRecents(
  cibleTypes: CibleReview[],
  jours: number,
): Promise<{ code: string; n: number; mesure: Record<string, number> | null }[]> {
  if (cibleTypes.length === 0) return [];
  const lignes = await db().execute<{ code: string; n: string; mesure: Record<string, number> | null }>(sql`
    select motif->>'code' as code,
           count(*)::text as n,
           (array_agg(motif->'mesure'))[1] as mesure
      from reviews, lateral jsonb_array_elements(motifs) as motif
     where verdict = 'rejete'
       and cible_type = any(${sql.raw(`array[${cibleTypes.map((c) => `'${c}'`).join(',')}]`)})
       and created_at >= now() - make_interval(days => ${jours})
     group by 1
     order by count(*) desc
     limit 8
  `);
  return lignes.rows.map((r) => ({ code: r.code, n: Number(r.n), mesure: r.mesure }));
}

/** Répartition des rejets par motif sur une fenêtre : les métriques du cerveau. */
export async function rejetsParMotif(jours: number): Promise<Record<string, number>> {
  const lignes = await db().execute<{ code: string; n: string }>(sql`
    select motif->>'code' as code, count(*)::text as n
      from reviews, lateral jsonb_array_elements(motifs) as motif
     where verdict = 'rejete' and created_at >= now() - make_interval(days => ${jours})
     group by 1 order by count(*) desc
  `);
  const out: Record<string, number> = {};
  for (const r of lignes.rows) out[r.code] = Number(r.n);
  return out;
}

/** Les derniers verdicts, toutes cibles confondues : la file de rejets de l'admin. */
export async function derniers(limite = 50): Promise<LigneReview[]> {
  return db().select().from(reviews).orderBy(desc(reviews.createdAt)).limit(limite);
}
