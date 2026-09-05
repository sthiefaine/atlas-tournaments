// Test d'intégration CONDITIONNEL : il ne tourne que si DATABASE_URL est présente.
// Sans base, il est sauté — l'intégration continue doit rester verte sur une
// machine qui n'a pas de Postgres.
//
// Ce qu'il vérifie : les migrations de `drizzle/` s'appliquent sur une base vierge,
// et elles sont REJOUABLES (les rejouer ne casse rien et ne duplique rien).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..', '..');
const dossier = path.join(racine, 'drizzle');
const url = process.env['DATABASE_URL'];

test('les migrations sont nommées NNNN_nom.sql et se suivent sans trou', async () => {
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(fichiers.length > 0, 'aucune migration');
  for (const f of fichiers) assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/);
  const numeros = fichiers.map((f) => Number(f.slice(0, 4)));
  for (let i = 0; i < numeros.length; i += 1) {
    assert.equal(numeros[i], i, `trou ou doublon de numérotation à ${fichiers[i]}`);
  }
});

test('chaque migration est écrite pour être rejouable', async () => {
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of fichiers) {
    const sql = await readFile(path.join(dossier, f), 'utf8');
    // Une création sans `if not exists` casse au second passage sur une base
    // partiellement migrée ; on l'interdit ici plutôt que de le découvrir en prod.
    const creations = sql.match(/create\s+(?:unique\s+)?(?:table|index)\s+(?!if not exists)/gi) ?? [];
    assert.deepEqual(creations, [], `${f} : création sans « if not exists »`);
    const insertions = sql.match(/^\s*insert into/gim) ?? [];
    if (insertions.length > 0) {
      assert.match(sql, /on conflict/i, `${f} : insertion sans « on conflict »`);
    }
  }
});

test('les migrations s’appliquent et se rejouent sur une base vierge', { skip: !url }, async () => {
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  try {
    const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();
    // Deux passages : le second prouve que le fichier est rejouable.
    for (let passage = 1; passage <= 2; passage += 1) {
      for (const f of fichiers) {
        const sql = await readFile(path.join(dossier, f), 'utf8');
        await client.query(sql);
      }
    }
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const noms = tables.rows.map((r) => r.table_name);
    for (const attendue of [
      'ai_prompts', 'routine_runs', 'routine_missions', 'countries', 'commanders', 'maps',
      'scenarios', 'reviews', 'events', 'memory', 'unit_types', 'daily_missions', 'locales',
      'chaines_source', 'traductions', 'glossaires', 'compteurs',
    ]) {
      assert.ok(noms.includes(attendue), `table manquante : ${attendue}`);
    }
    // Les neuf langues sont posées une seule fois, malgré les deux passages.
    const langues = await client.query<{ n: string }>('select count(*)::text as n from locales');
    assert.equal(Number(langues.rows[0]?.n), 9);
  } finally {
    await client.end();
  }
});
