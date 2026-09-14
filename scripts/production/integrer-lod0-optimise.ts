/** Remplacement direct autorisé, seulement après contrôle du dérivé et de sa provenance. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lireSpec } from '../controler-asset';
import { controlerDepot, nomsAttendus } from '../../src/serveur/depot-modeles';

const [id, preparation] = process.argv.slice(2);
if (!id || !preparation || !['unite_infanterie_base', 'unite_barge_base', 'unite_char_leger_base', 'batiment_qg_base'].includes(id)) throw new Error('Asset optimisé et dossier de préparation requis');
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const optimisation = json(path.join(preparation, 'optimisation.json'));
const maitre = json(path.join(preparation, 'maitre.json')) as { id: string; sha256Glb: string; fichiers: { nom: string; sha256: string }[] };
const spec = lireSpec(`assets/specs/${id}.json`), nomGlb = `${id}_lod0.glb`;
if (maitre.id !== id || optimisation.id !== id || maitre.sha256Glb !== optimisation.sourcePrepareeSha256) throw new Error('Mauvaise provenance');
for (const f of maitre.fichiers) {
  const source = path.join(optimisation.sourceDossier, f.nom);
  if (hash(readFileSync(source)) !== f.sha256) throw new Error('Maître HD absent ou altéré : ' + source);
}
const actif = hash(readFileSync(path.join('public/assets/modeles', nomGlb)));
if (![maitre.sha256Glb, optimisation.glbSha256].includes(actif)) throw new Error('Le modèle actif a changé depuis la préparation');
const fichiers = nomsAttendus(spec).filter(n => existsSync(path.join(preparation, n))).map(nom => ({ nom, octets: readFileSync(path.join(preparation, nom)) }));
const avant = fichiers.map(f => hash(f.octets));
const verdict = controlerDepot(spec, fichiers);
if (fichiers.some((f, i) => hash(f.octets) !== avant[i])) throw new Error('Le contrôle a modifié les octets');
if (!verdict.ok) throw new Error(JSON.stringify(verdict));
if (hash(fichiers.find(f => f.nom === nomGlb)!.octets) !== optimisation.glbSha256) throw new Error('Dérivé altéré après optimisation');
const lot = path.join('assets/livraisons', id), donnees = 'public/assets/donnees';
mkdirSync(lot, { recursive: true }); mkdirSync(donnees, { recursive: true });
const revision = createHash('sha256').update(JSON.stringify(spec));
function alias(dossier: string, nom: string, cible: string) {
  mkdirSync(dossier, { recursive: true });
  const lien = path.join(dossier, nom), relatif = path.relative(dossier, cible);
  try {
    const stat = lstatSync(lien);
    if (stat.isSymbolicLink() && readlinkSync(lien) === relatif) return;
    if (!stat.isSymbolicLink() && !stat.isFile()) throw new Error('Alias non remplaçable');
    // Ne jamais écrire à travers un lien : les données adressées par SHA sont immuables.
    unlinkSync(lien);
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  symlinkSync(relatif, lien);
}
for (const f of fichiers) {
  const empreinte = hash(f.octets), cible = path.join(donnees, empreinte + path.extname(f.nom));
  if (!existsSync(cible)) writeFileSync(cible, f.octets, { flag: 'wx' });
  else if (!readFileSync(cible).equals(f.octets)) throw new Error('Collision de contenu');
  for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) alias(dossier, f.nom, cible);
  revision.update(f.nom).update('\0').update(empreinte);
}
// Les textures hivernales héritées du char procédural ne correspondent pas à
// ses UV uploadés. Le maître les conserve pour l'historique, pas pour le jeu.
for (const f of maitre.fichiers.filter(f => f.nom.endsWith('_hiver.png'))) {
  for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) {
    const p = path.join(dossier, f.nom);
    if (existsSync(p)) unlinkSync(p);
  }
}
const empreinte = revision.digest('hex');
const rapport = { id, revision: empreinte, octets: fichiers.reduce((n, f) => n + f.octets.length, 0), verdict, approbationArtistique: false, integration: 'actif_lod0_optimise' };
for (const nom of ['maitre.json', 'optimisation.json', 'textures-optimisation.json']) writeFileSync(path.join(lot, nom), readFileSync(path.join(preparation, nom)));
writeFileSync(path.join(lot, 'validation-lot.json'), JSON.stringify(rapport, null, 2) + '\n');
writeFileSync(path.join(lot, 'version-candidat.json'), JSON.stringify({ revision: empreinte, source: 'maitre.json', preparation: 'optimisation.json', approbationArtistique: false }, null, 2) + '\n');
const exposition = json('assets/production/exposition.json');
const entree = exposition.assets.find((a: { id: string }) => a.id === id);
if (!entree) throw new Error('Entrée de catalogue absente');
Object.assign(entree, { fichiers: fichiers.map(f => f.nom), revision: empreinte });
writeFileSync('assets/production/exposition.json', JSON.stringify(exposition, null, 2) + '\n');
const registre = 'assets/production/optimisation-lod0.json';
const bilan = existsSync(registre) ? json(registre) : { version: 1, date: '2026-09-14', mesuresTelephone: 'en_attente_appareil_reel', assets: [] };
bilan.assets = bilan.assets.filter((a: { id: string }) => a.id !== id);
bilan.assets.push({ id, trianglesAvant: optimisation.trianglesAvant, triangles: optimisation.triangles, glbOctetsAvant: optimisation.glbOctetsAvant, glbOctets: optimisation.glbOctets, octetsLot: rapport.octets, revision: empreinte, sourcePrepareeSha256: maitre.sha256Glb, actifSha256: optimisation.glbSha256, controle: 'ok' });
bilan.assets.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
writeFileSync(registre, JSON.stringify(bilan, null, 2) + '\n');
console.log(JSON.stringify({ id, triangles: optimisation.triangles, octetsLot: rapport.octets, verdict: 'ok', revision: empreinte }));
