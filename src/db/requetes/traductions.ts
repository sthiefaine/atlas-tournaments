/** Accès typé à `traductions` : pénurie, lots, bundle, échantillon humain. */

import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../client';
import { chainesSource, traductions } from '../schema';
import { identifiant } from './communs';

/** Une ligne de `traductions`. */
export type LigneTraduction = typeof traductions.$inferSelect;

/** Une chaîne à traduire, telle qu'elle part dans un lot. */
export interface ChaineDuLot {
  cle: string;
  texte: string;
  contexte: Record<string, unknown>;
  longueurMax: number | null;
  placeholders: string[];
  pluriel: boolean;
  statutCourant: string;
  ancienneTraduction?: string;
  sourceHash: string;
}

/** Pénurie d'une langue : ce qui décide du tri de la file (`09-i18n.md` §8.2). */
export interface Penurie {
  locale: string;
  manquantes: number;
  perimees: number;
  validees: number;
  total: number;
  couverture: number;
}

/**
 * Crée les lignes `manquante` d'une langue pour toutes les chaînes qui n'en ont
 * pas encore. Idempotent : on peut l'appeler à chaque passage.
 */
export async function semer(locale: string): Promise<number> {
  if (locale === 'fr') return 0;
  const res = await db().execute(sql`
    insert into traductions (id, cle_chaine, locale, texte, statut, source_hash, version_chaine)
    select 'trd_' || replace(gen_random_uuid()::text, '-', ''), c.cle, ${locale}, null, 'manquante', c.source_hash, c.version_chaine
      from chaines_source c
     where not exists (select 1 from traductions t where t.cle_chaine = c.cle and t.locale = ${locale})
    on conflict do nothing
  `);
  return res.rowCount ?? 0;
}

/** La pénurie de chaque langue cible, la plus en retard en tête. */
export async function penuries(): Promise<Penurie[]> {
  const total = await db().select({ n: sql<number>`count(*)` }).from(chainesSource);
  const t = Number(total[0]?.n ?? 0);
  const lignes = await db().select({
    locale: traductions.locale,
    manquantes: sql<number>`count(*) filter (where ${traductions.statut} = 'manquante')`,
    perimees: sql<number>`count(*) filter (where ${traductions.statut} = 'perimee')`,
    validees: sql<number>`count(*) filter (where ${traductions.statut} = 'validee')`,
  }).from(traductions).groupBy(traductions.locale);
  return lignes
    .map((l) => ({
      locale: l.locale,
      manquantes: Number(l.manquantes),
      perimees: Number(l.perimees),
      validees: Number(l.validees),
      total: t,
      couverture: t === 0 ? 1 : Number(l.validees) / t,
    }))
    .sort((a, b) => a.couverture - b.couverture || b.manquantes - a.manquantes);
}

/** La pénurie d'une langue précise. */
export async function penurie(locale: string): Promise<Penurie> {
  const toutes = await penuries();
  return toutes.find((p) => p.locale === locale)
    ?? { locale, manquantes: 0, perimees: 0, validees: 0, total: 0, couverture: 1 };
}

/** Le prochain lot d'une langue : manquantes d'abord, puis périmées. */
export async function lot(locale: string, limite: number): Promise<ChaineDuLot[]> {
  const lignes = await db().select({
    cle: chainesSource.cle,
    texte: chainesSource.texte,
    contexte: chainesSource.contexte,
    longueurMax: chainesSource.longueurMax,
    placeholders: chainesSource.placeholders,
    pluriel: chainesSource.pluriel,
    sourceHash: chainesSource.sourceHash,
    statut: traductions.statut,
    ancien: traductions.texte,
  }).from(traductions)
    .innerJoin(chainesSource, eq(traductions.cleChaine, chainesSource.cle))
    .where(and(
      eq(traductions.locale, locale),
      sql`${traductions.statut} in ('manquante', 'perimee')`,
    ))
    .orderBy(sql`case ${traductions.statut} when 'manquante' then 0 else 1 end`, asc(chainesSource.cle))
    .limit(limite);
  return lignes.map((l) => ({
    cle: l.cle,
    texte: l.texte,
    contexte: l.contexte as Record<string, unknown>,
    longueurMax: l.longueurMax,
    placeholders: l.placeholders,
    pluriel: l.pluriel,
    statutCourant: l.statut,
    ...(l.statut === 'perimee' && l.ancien ? { ancienneTraduction: l.ancien } : {}),
    sourceHash: l.sourceHash,
  }));
}

/** Enregistre une traduction acceptée. `brouillon` si elle part à l'échantillon humain. */
export async function enregistrer(entree: {
  cle: string; locale: string; texte: string; sourceHash: string; versionChaine: number;
  statut: 'validee' | 'brouillon'; auteur: 'atlas_traduction' | 'humain'; runRef: string | null;
}): Promise<void> {
  await db().insert(traductions).values({
    id: identifiant('trd'),
    cleChaine: entree.cle,
    locale: entree.locale,
    texte: entree.texte,
    statut: entree.statut,
    sourceHash: entree.sourceHash,
    versionChaine: entree.versionChaine,
    auteur: entree.auteur,
    runRef: entree.runRef,
  }).onConflictDoUpdate({
    target: [traductions.cleChaine, traductions.locale],
    set: {
      texte: entree.texte, statut: entree.statut, sourceHash: entree.sourceHash,
      versionChaine: entree.versionChaine, auteur: entree.auteur, runRef: entree.runRef,
      majLe: new Date(),
    },
  });
}

/** Marque une ligne comme relue par un humain, et la valide. */
export async function relire(cle: string, locale: string, texte: string | null): Promise<boolean> {
  const lignes = await db().update(traductions).set({
    statut: 'validee',
    relueParHumain: true,
    ...(texte === null ? {} : { texte, auteur: 'humain' as const }),
    majLe: new Date(),
  }).where(and(eq(traductions.cleChaine, cle), eq(traductions.locale, locale)))
    .returning({ id: traductions.id });
  return lignes.length > 0;
}

/** Les lignes en attente de relecture humaine pour une langue. */
export async function enAttenteDeRelecture(locale: string, limite = 20): Promise<{
  cle: string; texte: string | null; source: string;
}[]> {
  const lignes = await db().select({
    cle: traductions.cleChaine,
    texte: traductions.texte,
    source: chainesSource.texte,
  }).from(traductions)
    .innerJoin(chainesSource, eq(traductions.cleChaine, chainesSource.cle))
    .where(and(eq(traductions.locale, locale), eq(traductions.statut, 'brouillon')))
    .limit(limite);
  return lignes;
}

/**
 * Construit le bundle plat d'une langue, replis déjà appliqués
 * (`locale → en → fr`, `09-i18n.md` §4). Le client ne voit jamais un trou.
 */
export async function bundle(locale: string): Promise<Record<string, string>> {
  const lignes = await db().execute<{ cle: string; texte: string }>(sql`
    select c.cle as cle,
           coalesce(
             (select t.texte from traductions t
               where t.cle_chaine = c.cle and t.locale = ${locale}
                 and t.statut in ('validee', 'perimee') and t.texte is not null),
             (select t.texte from traductions t
               where t.cle_chaine = c.cle and t.locale = 'en'
                 and t.statut in ('validee', 'perimee') and t.texte is not null),
             c.texte
           ) as texte
      from chaines_source c
  `);
  const out: Record<string, string> = {};
  for (const l of lignes.rows) out[l.cle] = l.texte;
  return out;
}
