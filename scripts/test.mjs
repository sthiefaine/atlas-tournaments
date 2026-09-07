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
// Le moteur WebGPU de three a besoin de deux globales de navigateur au
// chargement, et `three` doit désigner ce moteur-là : `tests/aides/webgpu-en-node.mjs`.
// Ce crochet est enregistré **après** celui de tsx, sinon tsx court-circuite la
// résolution et le crochet ne voit jamais passer `three` — d'où le lancement
// direct de Node, sans passer par la ligne de commande de tsx.
const prechargement = new URL('../tests/aides/webgpu-en-node.mjs', import.meta.url).href;
const resultat = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--import', prechargement, '--test', ...trouver('tests').sort()],
  { stdio: 'inherit' },
);
if (resultat.error) console.error(resultat.error.message);
process.exitCode = resultat.status ?? 1;
