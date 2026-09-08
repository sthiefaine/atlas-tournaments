// Le moteur WebGPU de three suppose un navigateur dès son chargement (`self`,
// `navigator`) : une page qui l'importe **statiquement** répond 500 côté serveur
// — la page de jeu l'a fait le 7 septembre 2026, et Next ne s'en rattrapait
// qu'en développement. Ce test suit les imports statiques de chaque page de
// `src/app` et refuse tout chemin qui atteint `three/webgpu` ou `three/tsl`
// sans passer par un `import()` dynamique (`next/dynamic` avec `ssr: false`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../../src');
const MOTEUR = /^three\/(webgpu|tsl)$/;

function pages(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return pages(chemin);
    return e.name === 'page.tsx' || e.name === 'layout.tsx' ? [chemin] : [];
  });
}

/** Les spécificateurs importés **statiquement** par un fichier (jamais `import(...)`). */
function importsStatiques(fichier: string): string[] {
  const source = readFileSync(fichier, 'utf8');
  const sortie: string[] = [];
  for (const m of source.matchAll(/^(?:import|export)\s[^;]*?\sfrom\s+['"]([^'"]+)['"]/gms)) sortie.push(m[1]!);
  for (const m of source.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) sortie.push(m[1]!);
  return sortie;
}

function resoudre(depuis: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(RACINE, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(depuis), spec) : null;
  if (base === null) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Le premier chemin d'imports statiques qui mène au moteur, ou `null`. */
function cheminVersLeMoteur(fichier: string, vus = new Set<string>()): string[] | null {
  if (vus.has(fichier)) return null;
  vus.add(fichier);
  for (const spec of importsStatiques(fichier)) {
    if (MOTEUR.test(spec)) return [fichier, spec];
    const cible = resoudre(fichier, spec);
    if (!cible) continue;
    const suite = cheminVersLeMoteur(cible, vus);
    if (suite) return [fichier, ...suite];
  }
  return null;
}

test('aucune page ne charge le moteur WebGPU au rendu serveur', () => {
  const fautes: string[] = [];
  for (const page of pages(path.join(RACINE, 'app'))) {
    const chemin = cheminVersLeMoteur(page);
    if (chemin) fautes.push(chemin.map((f) => path.relative(RACINE, f)).join(' → '));
  }
  assert.deepEqual(fautes, [], `chemins d'import statique vers three/webgpu :\n${fautes.join('\n')}`);
});

test('le marcheur d’imports voit bien un chemin fautif quand il existe', () => {
  // La toile elle-même importe le moteur : c'est précisément pour cela qu'elle
  // n'est atteinte que par un `import()` dynamique depuis `toile-client.tsx`.
  const toile = path.join(RACINE, 'app/jeu/[scenario]/toile.tsx');
  assert.ok(cheminVersLeMoteur(toile), 'la toile atteint three/webgpu par ses imports statiques');
});
