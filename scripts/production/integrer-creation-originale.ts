/** Première livraison originale : aucun fichier uploadé ou actif ne doit être écrasé. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lireSpec } from '../controler-asset';
import { controlerDepot, nomsAttendus } from '../../src/serveur/depot-modeles';

const [id, preparation] = process.argv.slice(2);
if (id !== 'unite_meridien_automate_base' || !preparation) throw new Error('Création originale explicitement commandée et dossier requis');
const spec = lireSpec(`assets/specs/${id}.json`), nomGlb = `${id}_lod0.glb`;
const empreinte = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const lireJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const existeEntree = (p: string) => {
  try { lstatSync(p); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
};
const lot = `assets/livraisons/${id}`;
const attendus = nomsAttendus(spec);
const fichiers = readdirSync(preparation).filter(n => /\.(png|glb)$/.test(n)).map(nom => ({ nom, octets: readFileSync(path.join(preparation, nom)) }));
if (fichiers.some(f => !attendus.includes(f.nom))) throw new Error('Fichier de modèle ou texture hors contrat');
const shaAvant = fichiers.map(f => empreinte(f.octets));
const verdict = controlerDepot(spec, fichiers);
if (fichiers.some((f, i) => empreinte(f.octets) !== shaAvant[i])) throw new Error('Le contrôle a altéré les octets');
if (!verdict.ok) throw new Error(JSON.stringify(verdict));
// Cette voie ne peut servir à contourner la préparation d'un upload ou refaire un actif.
for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) {
  for (const nom of attendus) if (existeEntree(path.join(dossier, nom))) throw new Error('Livraison existante : utiliser une préparation avec provenance, pas une création initiale');
}
if (existsSync(`assets/sources/${id}`) || existeEntree(`${lot}/source.json`)) throw new Error('Une source locale existe déjà');
const revue = lireJson(path.join(preparation, 'revue-technique.json'));
if (revue.id !== id || revue.approbationArtistique !== false) throw new Error('Compte rendu technique original requis, sans approbation artistique');
const exposition = lireJson('assets/production/exposition.json');
if (exposition.assets.some((a: { id: string }) => a.id === id)) throw new Error('Candidat déjà référencé');
const activation = lireJson('assets/production/activation-jeu.json');
if (activation.assets.some((a: { id: string }) => a.id === id)) throw new Error('Actif déjà référencé');
const hashRevision = createHash('sha256').update(JSON.stringify(spec));
const manifestes = fichiers.map((f, i) => {
  hashRevision.update(f.nom).update('\0').update(shaAvant[i]!);
  return { nom: f.nom, sha256: shaAvant[i]!, octets: f.octets.length };
});
const revision = hashRevision.digest('hex');
const donnees = 'public/assets/donnees';
mkdirSync(donnees, { recursive: true });
for (const [i, f] of fichiers.entries()) {
  const cible = path.join(donnees, shaAvant[i]! + path.extname(f.nom));
  if (!existsSync(cible)) writeFileSync(cible, f.octets, { flag: 'wx' });
  else if (!readFileSync(cible).equals(f.octets)) throw new Error('Collision de contenu');
  for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) {
    mkdirSync(dossier, { recursive: true });
    symlinkSync(path.relative(dossier, cible), path.join(dossier, f.nom));
  }
}
for (const nom of ['README.md', 'revue-technique.json']) writeFileSync(path.join(lot, nom), readFileSync(path.join(preparation, nom)), { flag: 'wx' });
const rapport = { id, revision, octets: fichiers.reduce((n, f) => n + f.octets.length, 0), verdict, approbationArtistique: false, integration: 'actif_creation_originale' };
const source = { id, nature: 'creation_originale', date: '2026-09-16', scripts: `scripts/production/modeles/${id}`, fichiers: manifestes, derniereRevisionDistante: 'non_attestee', approbationArtistique: false };
writeFileSync(path.join(lot, 'creation-originale.json'), JSON.stringify(source, null, 2) + '\n');
writeFileSync(path.join(lot, 'validation-lot.json'), JSON.stringify(rapport, null, 2) + '\n');
writeFileSync(path.join(lot, 'version-candidat.json'), JSON.stringify({ revision, source: 'creation-originale.json', approbationArtistique: false }, null, 2) + '\n');
exposition.assets.push({ id, fichiers: fichiers.map(f => f.nom), revision });
exposition.assets.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
writeFileSync('assets/production/exposition.json', JSON.stringify(exposition, null, 2) + '\n');
activation.date = '2026-09-16';
activation.assets.push({ id, fichierActif: `public/assets/modeles/${nomGlb}`, donnees: `../donnees/${manifestes.find(f => f.nom === nomGlb)!.sha256}.glb`, revision, controle: 'ok', provenance: 'creation_originale' });
writeFileSync('assets/production/activation-jeu.json', JSON.stringify(activation, null, 2) + '\n');
console.log(JSON.stringify({ id, revision, octetsLot: rapport.octets, verdict: 'ok' }));
