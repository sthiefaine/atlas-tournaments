// Exécute les migrations SQL (drizzle/*.sql) dans l'ordre, une seule fois
// chacune, avec une copie de sécurité pg_dump avant toute migration en attente.
// Lancé automatiquement par `npm start` (voir Dockerfile) et par `npm run migrate`.
//
// Règles :
// - une migration = un fichier `NNNN_nom.sql`, jamais modifié après avoir été appliqué ;
// - la table `_migrations` garde ce qui a été joué ;
// - la copie de sécurité est NON bloquante (mieux vaut un site debout qu'un site
//   mort faute de copie), mais un pg_dump plus ancien que le serveur est signalé
//   clairement : Postgres 18 exige un client 18.
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dossier = path.join(root, "drizzle");

function majeure(v) {
  const m = /(\d+)/.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
}

function versionDeLOutil() {
  return new Promise((resolve) => {
    const child = spawn("pg_dump", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    let sortie = "";
    child.stdout.on("data", (c) => (sortie += c));
    child.on("error", () => resolve(null));
    child.on("close", () => resolve(majeure(sortie.replace(/^\D+/, ""))));
  });
}

async function copieAvantMigration(client, url, enAttente) {
  if (enAttente.length === 0) return;
  const outil = await versionDeLOutil();
  if (outil === null) {
    console.warn("[migrate] ⚠ pg_dump introuvable : AUCUNE COPIE avant migration.");
    return;
  }
  const { rows } = await client.query("show server_version");
  const serveur = majeure(rows[0]?.server_version);
  if (serveur !== null && outil < serveur) {
    console.warn(`[migrate] ⚠ pg_dump ${outil} < serveur ${serveur} : la copie échouerait. Installer postgresql${serveur}-client.`);
    return;
  }
  const dir = path.resolve(root, process.env.BACKUP_DIR || ".backups");
  await mkdir(dir, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const fichier = path.join(dir, `avant-${enAttente[0].replace(/\.sql$/, "")}-${horodatage}.sql`);
  await new Promise((resolve) => {
    const child = spawn("pg_dump", ["--no-owner", "--no-privileges", "-f", fichier, url], { stdio: "inherit" });
    child.on("error", (e) => { console.warn("[migrate] ⚠ copie impossible :", e.message); resolve(); });
    child.on("close", (code) => {
      if (code === 0) console.log(`[migrate] copie de sécurité : ${fichier}`);
      else console.warn(`[migrate] ⚠ pg_dump a rendu ${code} : pas de copie.`);
      resolve();
    });
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`create table if not exists _migrations (
      nom text primary key,
      applique_le timestamptz not null default now()
    )`);
    const deja = new Set((await client.query("select nom from _migrations")).rows.map((r) => r.nom));
    const fichiers = (await readdir(dossier)).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
    const enAttente = fichiers.filter((f) => !deja.has(f));
    if (enAttente.length === 0) {
      console.log(`[migrate] à jour (${fichiers.length} migration(s)).`);
      return;
    }
    await copieAvantMigration(client, url, enAttente);
    for (const f of enAttente) {
      const sql = await readFile(path.join(dossier, f), "utf8");
      console.log(`[migrate] → ${f}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (nom) values ($1)", [f]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw new Error(`[migrate] échec de ${f} : ${e.message}`);
      }
    }
    console.log(`[migrate] ${enAttente.length} migration(s) appliquée(s).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
