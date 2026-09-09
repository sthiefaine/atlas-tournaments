/** Activation explicitement demandée pour la mission ; aucune approbation artistique implicite. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function activerPremierContact(racine = process.cwd(), categories = ['base_unite', 'kit_national']) {
  const dossier = path.resolve(racine, 'assets/missions/premier_contact');
  const manifeste = JSON.parse(readFileSync(path.join(dossier, 'manifest.json'), 'utf8')) as { assets: { id: string; categorie: string; source: string; fichiers: string[] }[] };
  const lots = manifeste.assets.filter(a => categories.includes(a.categorie));
  const destination = path.resolve(racine, 'public/assets/modeles');
  const donnees = path.resolve(racine, 'public/assets/donnees');
  const fichiers = lots.flatMap(a => a.fichiers.map(fichier => {
    const source = path.resolve(racine, a.source, path.basename(fichier));
    if (!source.startsWith(path.resolve(racine) + path.sep)) throw new Error('Source hors du lot');
    const octets = readFileSync(source), nom = path.basename(fichier);
    const empreinte = createHash('sha256').update(octets).digest('hex');
    const cible = path.join(destination, nom);
    try {
      lstatSync(cible);
      if (!existsSync(cible) || createHash('sha256').update(readFileSync(cible)).digest('hex') !== empreinte) throw new Error(`Modèle existant différent, conservé : ${nom}`);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return { nom, octets, empreinte, cible };
  }));
  // Toute collision est refusée avant la première publication.
  mkdirSync(destination, { recursive: true }); mkdirSync(donnees, { recursive: true });
  for (const f of fichiers) {
    if (existsSync(f.cible)) continue;
    const blob = path.join(donnees, f.empreinte + path.extname(f.nom));
    if (!existsSync(blob)) writeFileSync(blob, f.octets, { flag: 'wx' });
    else if (!readFileSync(blob).equals(f.octets)) throw new Error(`Donnée altérée : ${f.nom}`);
    symlinkSync(path.relative(destination, blob), f.cible);
  }
  const rapport = { version: 1, mission: 'premier_contact', activation: 'autorisee_par_utilisateur', validationArtistique: 'non_effectuee', prefixe: '/assets/modeles', categories, assets: lots.map(l => l.id), fichiers: fichiers.map(f => f.nom) };
  writeFileSync(path.join(dossier, `activation-${categories.join('-')}.json`), JSON.stringify(rapport, null, 2) + '\n');
  return rapport;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(activerPremierContact()));
