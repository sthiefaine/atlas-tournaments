/** Prévisualisations publiques distinctes des modèles en jeu, stockées par empreinte. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AssetSpec } from '../../src/assets/spec';
import { nomsAttendus } from '../../src/serveur/depot-modeles';
export function exposerCandidats(racine = process.cwd()): { assets: number; fichiers: number; repertoire: string } {
const bilan = JSON.parse(readFileSync(path.resolve(racine, 'assets/production/bilan.json'), 'utf8')) as { total: number; lotsComplets: number; imagesEmbarquees: number; lots: { id: string; dossier: string }[] };
if (!Number.isInteger(bilan.total) || bilan.total < 0 || bilan.total !== bilan.lotsComplets || bilan.total !== bilan.lots.length || bilan.imagesEmbarquees !== 0) throw new Error('Le bilan doit être complet et sans image embarquée.');
const alias = path.resolve(racine, 'public/assets/candidats'), donnees = path.resolve(racine, 'public/assets/donnees');
mkdirSync(alias, { recursive: true }); mkdirSync(donnees, { recursive: true });
const assets = bilan.lots.map(lot => {
  const spec = JSON.parse(readFileSync(path.resolve(racine, `assets/specs/${lot.id}.json`), 'utf8')) as AssetSpec;
  const revision = createHash('sha256').update(JSON.stringify(spec));
  const fichiers: string[] = [];
  for (const nom of nomsAttendus(spec)) {
    const source = path.resolve(racine, lot.dossier, nom); if (!existsSync(source)) continue;
    const octets = readFileSync(source), empreinte = createHash('sha256').update(octets).digest('hex');
    const blob = `${empreinte}${path.extname(nom)}`, cible = path.join(donnees, blob), lien = path.join(alias, nom);
    if (!existsSync(cible)) writeFileSync(cible, octets, { flag: 'wx' });
    else if (createHash('sha256').update(readFileSync(cible)).digest('hex') !== empreinte) throw new Error(`Donnée altérée : ${blob}`);
    const relatif = path.relative(alias, cible);
    let existant = false;
    try { const stat = lstatSync(lien); if (!stat.isSymbolicLink()) throw new Error(`Le fichier ${lien} n’est pas un alias de production.`); existant = true; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    if (existant && readlinkSync(lien) !== relatif) { unlinkSync(lien); existant = false; }
    if (!existant) symlinkSync(relatif, lien);
    revision.update(nom).update('\0').update(empreinte); fichiers.push(nom);
  }
  return { id: lot.id, fichiers, revision: revision.digest('hex') };
});
writeFileSync(path.resolve(racine, 'assets/production/exposition.json'), JSON.stringify({ version: 1, prefixe: '/assets/candidats', validationArtistique: 'non_effectuee', assets }, null, 2) + '\n');
return { assets: assets.length, fichiers: assets.reduce((n, a) => n + a.fichiers.length, 0), repertoire: alias };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(exposerCandidats()));
}
