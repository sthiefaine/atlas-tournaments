// Règles d'import de doc/02-architecture.md §5 : le sens des dépendances ne
// s'inverse jamais. Ce test lit les imports de chaque fichier de src/ et refuse
// toute violation. Il est volontairement sans dépendance (pas d'AST), ce qui
// suffit pour des imports écrits normalement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const racine = path.resolve(import.meta.dirname, "..", "src");

// Ce que chaque couche a le droit d'importer (en plus d'elle-même et de node:*).
const autorise: Record<string, string[]> = {
  engine: ["schemas", "content"],
  ai: ["engine", "schemas", "content"],
  mapgen: ["engine", "schemas", "content"],
  render: ["engine", "schemas", "content", "i18n"],
  render3d: ["engine", "schemas", "content", "i18n", "render", "assets"],
  assets: ["schemas", "content"],
  schemas: [],
  content: ["schemas"],
  i18n: ["schemas"],
  db: ["schemas"],
  serveur: ["engine", "ai", "mapgen", "schemas", "content", "db", "i18n", "assets"],
  app: ["engine", "ai", "mapgen", "render", "render3d", "assets", "schemas", "content", "db", "serveur", "i18n"],
};

// Modules du navigateur interdits dans les couches pures.
const pures = ["engine", "ai", "mapgen", "schemas", "content"];
const interdits = [/\bwindow\b/, /\bdocument\b/, /\bfetch\(/, /Date\.now\(/, /Math\.random\(/];

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) out.push(...fichiers(p));
    else if (/\.(ts|tsx)$/.test(nom) && !/\.d\.ts$/.test(nom)) out.push(p);
  }
  return out;
}

function couche(fichier: string): string | null {
  const rel = path.relative(racine, fichier).split(path.sep);
  return rel[0] ?? null;
}

function cibleImport(spec: string, depuis: string): string | null {
  if (spec.startsWith("@/")) return spec.slice(2).split("/")[0] ?? null;
  if (spec.startsWith(".")) {
    const abs = path.resolve(path.dirname(depuis), spec);
    const rel = path.relative(racine, abs).split(path.sep);
    return rel[0] && !rel[0].startsWith("..") ? rel[0] : null;
  }
  return null; // paquet npm ou node:*
}

test("frontières d'import entre couches", () => {
  const erreurs: string[] = [];
  for (const f of fichiers(racine)) {
    const c = couche(f);
    if (!c || !(c in autorise)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/^\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
      const cible = cibleImport(m[1]!, f);
      if (!cible || cible === c) continue;
      if (!autorise[c]!.includes(cible)) erreurs.push(`${path.relative(racine, f)} importe ${cible}`);
    }
    if (pures.includes(c)) {
      for (const re of interdits) {
        if (re.test(src)) erreurs.push(`${path.relative(racine, f)} utilise ${re.source} (interdit dans une couche pure)`);
      }
    }
  }
  assert.deepEqual(erreurs, []);
});
