// Node 20 et 22 ne développent pas les globs de test de la même manière.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function trouver(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    const fichier = join(dossier, e.name);
    return e.isDirectory() ? trouver(fichier) : e.name.endsWith('.test.ts') ? [fichier] : [];
  });
}
// Rien à précharger d'autre que tsx : `tests/aides/webgpu-en-node.mjs` alignait
// les imports de three sur le moteur WebGPU, parti avec la peau 3D le
// 23 septembre 2026 ; il reste, vide, pour la commande de test ciblé des
// documents.
const resultat = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...trouver('tests').sort()],
  { stdio: 'inherit' },
);
if (resultat.error) console.error(resultat.error.message);
process.exitCode = resultat.status ?? 1;
