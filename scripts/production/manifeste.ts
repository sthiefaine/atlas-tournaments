/** Catalogue reproductible des commandes ; présence ne signifie pas validation. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nomModele, nomTexture, type AssetSpec } from '../../src/assets/spec';
import { promptProduction } from '../../src/app/admin/assets/prompt-production';

export function creerManifeste(racine = process.cwd()) {
  const dossier = path.join(racine, 'assets/specs');
  const assets = readdirSync(dossier).filter(n => n.endsWith('.json')).sort().map(n => {
    const spec = JSON.parse(readFileSync(path.join(dossier, n), 'utf8')) as AssetSpec;
    const requis = [...spec.verification.lodRequis.map(l => nomModele(spec, l)), ...spec.textures.filter(t => t.obligatoire).map(t => nomTexture(spec, t.canal))];
    const livraison = path.join(racine, 'assets/livraisons', spec.id);
    const presents = requis.filter(f => existsSync(path.join(livraison, f)) || existsSync(path.join(racine, 'public/assets/modeles', f)));
    return { id: spec.id, famille: spec.type, specification: `assets/specs/${n}`, destination: `assets/livraisons/${spec.id}`, fichiersRequis: requis, candidatLocal: requis.some(f => existsSync(path.join(livraison, f))), fichiersPresents: presents, fichiersManquants: requis.filter(f => !presents.includes(f)), validationArtistique: 'non_etablie', prompt: promptProduction(spec, presents) };
  });
  return { version: 1, description: 'Commandes de production Atlas Tournament. Les contrôles techniques ne constituent pas une validation artistique.', total: assets.length, familles: Object.fromEntries([...new Set(assets.map(a => a.famille))].map(f => [f, assets.filter(a => a.famille === f).length])), assets };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = path.resolve('assets/production/plan-assets.json');
  mkdirSync(path.dirname(sortie), { recursive: true });
  const manifeste = creerManifeste();
  writeFileSync(sortie, JSON.stringify(manifeste, null, 2) + '\n');
  writeFileSync(path.join(path.dirname(sortie), 'candidats.json'), JSON.stringify({ version: 1, nature: 'presence_locale_sans_approbation', assets: manifeste.assets.filter(a => a.candidatLocal).map(a => ({ id: a.id, complet: a.fichiersManquants.length === 0, destination: a.destination })) }, null, 2) + '\n');
  console.log(JSON.stringify({ fichier: sortie, total: manifeste.total, familles: manifeste.familles }));
}
