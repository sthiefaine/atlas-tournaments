/** Création originale commandée, avec archivage du candidat précédent et protection des uploads. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lireSpec } from '../controler-asset';
import { controlerDepot, nomsAttendus } from '../../src/serveur/depot-modeles';
import { sourcesStockees } from '../../src/serveur/sources-assets-stockage';

async function integrer() {
const [id, preparation] = process.argv.slice(2);
if (!id || !/^[a-z0-9_]+$/.test(id) || !preparation) throw new Error('Création originale explicitement commandée et dossier requis');
const spec = lireSpec(`assets/specs/${id}.json`), nomGlb = `${id}_lod0.glb`;
const empreinte = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const lireJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const existeEntree = (p: string) => {
  try { lstatSync(p); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
};
const lot = `assets/livraisons/${id}`;
const plan = lireJson('assets/production/plan-modeles-3d.json');
const fiche = plan.modeles.find((m: { id: string }) => m.id === id);
if (!fiche || fiche.etat !== 'en_cours' || fiche.suivi.etape !== 'creation_originale'
  || fiche.source.verificationDistante?.nombreDepots !== 0 || id === 'terrain_plaine'
  || spec.type === 'kit' || spec.variantes.nations.length) throw new Error('Modèle commun sans dépôt, en création dans la file, requis');
// Un upload peut arriver pendant le travail de l'artiste : le relevé initial ne suffit pas.
if (!process.env.ATLAS_UPLOAD_TOKEN) throw new Error('Configurer ATLAS_UPLOAD_TOKEN pour revérifier les sources avant remplacement');
if ((await sourcesStockees(id)).length) throw new Error('Une source GLB est déposée : préparer cet upload avant toute création originale');
fiche.source.verificationDistante = { date: new Date().toISOString(), nombreDepots: 0, revisionRecente: null };
const attendus = nomsAttendus(spec);
const fichiers = readdirSync(preparation).filter(n => /\.(png|glb)$/.test(n)).map(nom => ({ nom, octets: readFileSync(path.join(preparation, nom)) }));
if (fichiers.some(f => !attendus.includes(f.nom))) throw new Error('Fichier de modèle ou texture hors contrat');
const shaAvant = fichiers.map(f => empreinte(f.octets));
const verdict = controlerDepot(spec, fichiers);
if (fichiers.some((f, i) => empreinte(f.octets) !== shaAvant[i])) throw new Error('Le contrôle a altéré les octets');
if (!verdict.ok) throw new Error(JSON.stringify(verdict));
// Aucun upload ou maître HD n'est remplaçable par cette voie.
if (existsSync(`assets/sources/${id}`) || existeEntree(`${lot}/source.json`) || existeEntree(`${lot}/maitre.json`)) throw new Error('Une source locale existe déjà');
for (const [p, reference] of [[`${lot}/${nomGlb}`, fiche.candidat], [`public/assets/modeles/${nomGlb}`, fiche.actuel]] as const) {
  if (existeEntree(p) ? empreinte(readFileSync(p)) !== reference?.sha256 : !!reference) throw new Error('Le modèle a changé depuis son inventaire');
}
const revue = lireJson(path.join(preparation, 'revue-technique.json'));
if (revue.id !== id || revue.approbationArtistique !== false) throw new Error('Compte rendu technique original requis, sans approbation artistique');
const exposition = lireJson('assets/production/exposition.json');
const activation = lireJson('assets/production/activation-jeu.json');
const hashRevision = createHash('sha256').update(JSON.stringify(spec));
const manifestes = fichiers.map((f, i) => {
  hashRevision.update(f.nom).update('\0').update(shaAvant[i]!);
  return { nom: f.nom, sha256: shaAvant[i]!, octets: f.octets.length };
});
const revision = hashRevision.digest('hex');
const archive = path.join('assets/receptions', id, `avant-${fiche.candidat?.sha256 ?? 'premiere-creation'}`);
const precedents: { chemin: string; sha256: string; octets: number }[] = [];
for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) {
  const noms = dossier === lot && existsSync(lot) ? readdirSync(lot).filter(n => !n.endsWith('.zip')) : attendus;
  for (const nom of noms) {
    const p = path.join(dossier, nom); if (!existsSync(p) || !lstatSync(p).isFile() && !lstatSync(p).isSymbolicLink()) continue;
    const b = readFileSync(p), sha256 = empreinte(b), sauvegarde = path.join(archive, sha256 + path.extname(nom));
    mkdirSync(archive, { recursive: true });
    if (!existsSync(sauvegarde)) writeFileSync(sauvegarde, b, { flag: 'wx' });
    else if (!readFileSync(sauvegarde).equals(b)) throw new Error('Archive altérée');
    precedents.push({ chemin: p, sha256, octets: b.length });
  }
}
const donnees = 'public/assets/donnees';
mkdirSync(donnees, { recursive: true });
for (const [i, f] of fichiers.entries()) {
  const cible = path.join(donnees, shaAvant[i]! + path.extname(f.nom));
  if (!existsSync(cible)) writeFileSync(cible, f.octets, { flag: 'wx' });
  else if (!readFileSync(cible).equals(f.octets)) throw new Error('Collision de contenu');
  for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) {
    mkdirSync(dossier, { recursive: true });
    if (existeEntree(path.join(dossier, f.nom))) unlinkSync(path.join(dossier, f.nom));
    symlinkSync(path.relative(dossier, cible), path.join(dossier, f.nom));
  }
}
// Les anciennes variantes utilisent un autre dépliage ; elles restent dans l'archive.
for (const dossier of [lot, 'public/assets/modeles', 'public/assets/candidats']) for (const nom of attendus) {
  if (!fichiers.some(f => f.nom === nom) && existeEntree(path.join(dossier, nom))) unlinkSync(path.join(dossier, nom));
}
for (const nom of ['README.md', 'revue-technique.json']) writeFileSync(path.join(lot, nom), readFileSync(path.join(preparation, nom)));
const rapport = { id, revision, octets: fichiers.reduce((n, f) => n + f.octets.length, 0), verdict, approbationArtistique: false, integration: 'actif_creation_originale' };
const source = { id, nature: 'creation_originale', date: '2026-09-16', scripts: `scripts/production/modeles/${id}`, fichiers: manifestes, verificationDistante: fiche.source.verificationDistante, archivePrecedente: precedents.length ? archive : null, precedents, approbationArtistique: false };
writeFileSync(path.join(lot, 'creation-originale.json'), JSON.stringify(source, null, 2) + '\n');
writeFileSync(path.join(lot, 'validation-lot.json'), JSON.stringify(rapport, null, 2) + '\n');
writeFileSync(path.join(lot, 'version-candidat.json'), JSON.stringify({ revision, source: 'creation-originale.json', approbationArtistique: false }, null, 2) + '\n');
exposition.assets = exposition.assets.filter((a: { id: string }) => a.id !== id);
exposition.assets.push({ id, fichiers: fichiers.map(f => f.nom), revision });
exposition.assets.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
writeFileSync('assets/production/exposition.json', JSON.stringify(exposition, null, 2) + '\n');
activation.date = '2026-09-16';
activation.assets = activation.assets.filter((a: { id: string }) => a.id !== id);
activation.assets.push({ id, fichierActif: `public/assets/modeles/${nomGlb}`, donnees: `../donnees/${manifestes.find(f => f.nom === nomGlb)!.sha256}.glb`, revision, controle: 'ok', provenance: 'creation_originale' });
writeFileSync('assets/production/activation-jeu.json', JSON.stringify(activation, null, 2) + '\n');
writeFileSync('assets/production/plan-modeles-3d.json', JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ id, revision, octetsLot: rapport.octets, verdict: 'ok' }));
}
void integrer().catch(e => { console.error(e instanceof Error ? e.message : 'Intégration impossible'); process.exitCode = 1; });
