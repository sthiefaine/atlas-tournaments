/** Inventaire final : présence, références des GLB et poids dédupliqué par contenu. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetSpec } from '../../src/assets/spec';
import { nomModele, nomTexture } from '../../src/assets/spec';
import { nomsAttendus } from '../../src/serveur/depot-modeles';
const uniques = new Map<string, number>();
const fichiersGit: string[] = [];
let octetsLogiques = 0, glb = 0, png = 0, imagesEmbarquees = 0;
const lots = readdirSync('assets/specs').filter(n => n.endsWith('.json')).sort().map(n => {
  const spec = JSON.parse(readFileSync(path.join('assets/specs', n), 'utf8')) as AssetSpec;
  const local = path.join('assets/livraisons', spec.id);
  const dossier = existsSync(path.join(local, nomModele(spec, 0))) ? local : 'public/assets/modeles';
  const requis = [...spec.verification.lodRequis.map(l => nomModele(spec, l)), ...spec.textures.filter(t => t.obligatoire).map(t => nomTexture(spec, t.canal))];
  const manquants = requis.filter(f => !existsSync(path.join(dossier, f)));
  const referencesAbsentes: string[] = [];
  let octets = 0, fichiers = 0;
  for (const f of nomsAttendus(spec)) {
    const chemin = path.join(dossier, f); if (!existsSync(chemin)) continue;
    const b = readFileSync(chemin); fichiers++; octets += b.length; octetsLogiques += b.length;
    uniques.set(createHash('sha256').update(b).digest('hex'), b.length);
    if (dossier === local) fichiersGit.push(chemin);
    if (f.endsWith('.glb')) {
      glb++;
      const document = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { images?: { uri?: string; bufferView?: number }[] };
      for (const image of document.images ?? []) {
        if (image.bufferView !== undefined) imagesEmbarquees++;
        if (!image.uri || !/^[^:/\\]+\.png$/.test(image.uri) || !existsSync(path.join(dossier, image.uri))) referencesAbsentes.push(image.uri ?? 'image_embarquee');
      }
    } else if (f.endsWith('.png')) png++;
  }
  return { id: spec.id, famille: spec.type, dossier, fichiers, octets, manquants, referencesAbsentes };
});
const bilan = { version: 1, controle: 'presence_references_externes_et_poids', validationArtistique: 'non_effectuee', total: lots.length, lotsComplets: lots.filter(l => !l.manquants.length && !l.referencesAbsentes.length).length, glb, png, imagesEmbarquees, octetsLogiques, octetsUniques: [...uniques.values()].reduce((a, b) => a + b, 0), lots };
mkdirSync('assets/production', { recursive: true });
writeFileSync('assets/production/bilan.json', JSON.stringify(bilan, null, 2) + '\n');
writeFileSync('/tmp/atlas-fichiers-production.txt', fichiersGit.join('\n') + '\n');
console.log(JSON.stringify({ ...bilan, lots: undefined }));
if (bilan.lotsComplets !== bilan.total || imagesEmbarquees) process.exitCode = 1;
