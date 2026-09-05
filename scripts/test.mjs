// Node 20 et 22 ne développent pas les globs de test de la même manière.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
function trouver(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    const fichier = join(dossier, e.name);
    return e.isDirectory() ? trouver(fichier) : e.name.endsWith('.test.ts') ? [fichier] : [];
  });
}
const resultat = spawnSync(process.execPath, [require.resolve('tsx/cli'), '--test', ...trouver('tests').sort()], { stdio: 'inherit' });
if (resultat.error) console.error(resultat.error.message);
process.exitCode = resultat.status ?? 1;
