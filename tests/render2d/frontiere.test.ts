// La peau 2D ne connaît ni three ni la peau 3D. `tests/frontieres.test.ts`
// tient déjà `render3d/` à l'écart (règle des couches) ; celui-ci ferme la
// seconde porte : un paquet `three` importé d'ici ferait entrer le moteur
// WebGPU dans la route de jeu 2D, et c'est précisément ce qu'on retire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..', '..', 'src', 'render2d');

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) out.push(...fichiers(p));
    else if (/\.(ts|tsx)$/.test(nom)) out.push(p);
  }
  return out;
}

test('aucun fichier de render2d n’importe three ni render3d', () => {
  const fautes: string[] = [];
  for (const f of fichiers(racine)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^\s*(?:import|export)[^'"]*from\s+|import\(\s*)['"]([^'"]+)['"]/gm)) {
      const spec = m[1] ?? '';
      if (spec === 'three' || spec.startsWith('three/') || spec.includes('render3d')) fautes.push(`${path.relative(racine, f)} → ${spec}`);
    }
  }
  assert.deepEqual(fautes, []);
});
