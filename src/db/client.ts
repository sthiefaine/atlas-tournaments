/**
 * Connexion à PostgreSQL : un seul pool `pg`, créé **paresseusement**.
 *
 * Rien n'est ouvert à l'import du module — `next build` doit pouvoir compiler
 * toutes les routes sans qu'une base existe. La connexion n'est établie qu'au
 * premier appel réel, dans une fonction, jamais au chargement.
 *
 * Cette couche n'importe que `schemas` (`02-architecture.md` §5).
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

/** Le pool et la base Drizzle sont mémorisés sur le `globalThis` pour survivre au HMR. */
interface Cache {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
}

const cache: Cache = ((globalThis as unknown as { __atlasDb?: Cache }).__atlasDb ??= {});

/** Vrai si `DATABASE_URL` est présente : permet de répondre proprement sans base. */
export function baseConfiguree(): boolean {
  return typeof process.env['DATABASE_URL'] === 'string' && process.env['DATABASE_URL'] !== '';
}

/** Le pool `pg` partagé. Lève si `DATABASE_URL` manque — jamais à l'import. */
export function pool(): Pool {
  if (cache.pool) return cache.pool;
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL manquante : impossible de joindre la base.');
  cache.pool = new Pool({
    connectionString: url,
    max: Number(process.env['DATABASE_POOL_MAX'] ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return cache.pool;
}

/** La base Drizzle typée par `schema.ts`. Singleton, créé au premier appel. */
export function db(): NodePgDatabase<typeof schema> {
  if (cache.db) return cache.db;
  cache.db = drizzle(pool(), { schema });
  return cache.db;
}

/** Ping de santé : `select 1`. Renvoie la latence en millisecondes. */
export async function ping(): Promise<{ ok: true; ms: number } | { ok: false; erreur: string }> {
  const depart = Date.now();
  try {
    await pool().query('select 1');
    return { ok: true, ms: Date.now() - depart };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/** Ferme le pool (tests d'intégration, arrêt propre). */
export async function fermer(): Promise<void> {
  if (cache.pool) {
    await cache.pool.end();
    cache.pool = undefined;
    cache.db = undefined;
  }
}

export { schema };
