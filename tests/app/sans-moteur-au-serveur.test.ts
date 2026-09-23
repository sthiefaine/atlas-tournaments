// Ce qui dessine suppose un navigateur, et reste hors du rendu serveur et du
// premier chargement des pages : la **peau du jeu** (`render2d/index.ts`, un
// contexte WebGL 2 et des pages d'images à décoder — le gros du JavaScript de
// la route de jeu), et **three**, que seuls l'inspection d'un modèle dans
// l'admin et la carte des assets de l'atelier gardent pour montrer les GLB
// sources. Une page qui les importerait **statiquement** les ferait évaluer par
// le serveur et les embarquerait dans son premier chargement ; ils ne se
// chargent que par un `import()` dynamique (`next/dynamic` avec `ssr: false`).
//
// Le 7 septembre 2026, c'était pire : le moteur WebGPU de three levait
// `self is not defined` au chargement, et la page de jeu répondait 500 côté
// serveur. Ce test gardait alors `three/webgpu` et `three/tsl` ; la peau 3D a
// été retirée le 23 septembre 2026, et il garde désormais la peau 2D et three
// tout entier. Il suit les imports statiques de chaque page et de chaque
// gabarit de `src/app`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../../src');

/** La peau du jeu, par son fichier : ses modules purs (le contrat, la sonde, les couleurs) restent permis. */
const PEAU = path.join(RACINE, 'render2d', 'index.ts');

/** Three, ses compléments, ses exemples : tout ce qui se publie sous ce nom. */
const THREE = /^three(\/|$)/;

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

/** Le premier chemin d'imports statiques qui mène à la peau ou à three, ou `null`. */
function cheminVersCeQuiDessine(fichier: string, vus = new Set<string>()): string[] | null {
  if (vus.has(fichier)) return null;
  vus.add(fichier);
  for (const spec of importsStatiques(fichier)) {
    if (THREE.test(spec)) return [fichier, spec];
    const cible = resoudre(fichier, spec);
    if (!cible) continue;
    if (cible === PEAU) return [fichier, cible];
    const suite = cheminVersCeQuiDessine(cible, vus);
    if (suite) return [fichier, ...suite];
  }
  return null;
}

/** Un chemin lisible : les fichiers relatifs à `src/`, les paquets tels quels. */
function lisible(chemin: readonly string[]): string {
  return chemin.map((f) => (path.isAbsolute(f) ? path.relative(RACINE, f) : f)).join(' → ');
}

test('aucune page n’atteint la peau du jeu ni three par ses imports statiques', () => {
  const fautes: string[] = [];
  for (const page of pages(path.join(RACINE, 'app'))) {
    const chemin = cheminVersCeQuiDessine(page);
    if (chemin) fautes.push(lisible(chemin));
  }
  assert.deepEqual(fautes, [], `chemins d'import statique vers la peau ou three :\n${fautes.join('\n')}`);
});

test('le marcheur d’imports voit bien un chemin fautif quand il existe', () => {
  // La toile importe la peau : c'est précisément pour cela qu'elle n'est
  // atteinte que par un `import()` dynamique depuis `toile-client.tsx`.
  const toile = path.join(RACINE, 'app/jeu/[scenario]/toile.tsx');
  assert.deepEqual(cheminVersCeQuiDessine(toile)?.at(-1), PEAU, 'la toile atteint la peau par ses imports statiques');
  // L'inspection d'un modèle importe three : `inspection-client.tsx` ne la
  // charge qu'à l'ouverture du banc, par `next/dynamic`.
  const inspection = path.join(RACINE, 'app/admin/assets/[cle]/inspection.tsx');
  assert.equal(cheminVersCeQuiDessine(inspection)?.at(-1), 'three', 'l’inspection atteint three par ses imports statiques');
});
