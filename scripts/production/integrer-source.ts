/** Expose uniquement le candidat source contrôlé ; ne remplace pas le modèle actif. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lireSpec } from '../controler-asset';
import { controlerDepot, nomsAttendus } from '../../src/serveur/depot-modeles';
const id = process.argv[2];
if (!id || !['unite_artillerie_base', 'unite_infanterie_base', 'unite_antiair_base'].includes(id)) throw new Error('Asset source attendu');
const dossier = path.resolve('assets/livraisons', id);
const spec = lireSpec(`assets/specs/${id}.json`);
const fichiers = nomsAttendus(spec).filter(nom => existsSync(path.join(dossier, nom))).map(nom => ({ nom, octets: readFileSync(path.join(dossier, nom)) }));
const verdict = controlerDepot(spec, fichiers);
if (!verdict.ok) throw new Error(JSON.stringify(verdict));
const revision = createHash('sha256').update(JSON.stringify(spec));
const alias = path.resolve('public/assets/candidats'), donnees = path.resolve('public/assets/donnees');
mkdirSync(alias, { recursive: true }); mkdirSync(donnees, { recursive: true });
for (const { nom, octets } of fichiers) {
  const empreinte = createHash('sha256').update(octets).digest('hex');
  const cible = path.join(donnees, empreinte + path.extname(nom));
  if (!existsSync(cible)) writeFileSync(cible, octets, { flag: 'wx' });
  else if (!readFileSync(cible).equals(octets)) throw new Error('Donnée altérée : ' + cible);
  const lien = path.join(alias, nom), relatif = path.relative(alias, cible);
  try {
    if (!lstatSync(lien).isSymbolicLink()) throw new Error('Alias attendu : ' + lien);
    if (readlinkSync(lien) !== relatif) { unlinkSync(lien); symlinkSync(relatif, lien); }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    symlinkSync(relatif, lien);
  }
  revision.update(nom).update('\0').update(empreinte);
}
const empreinte = revision.digest('hex');
const chemin = 'assets/production/exposition.json';
const exposition = JSON.parse(readFileSync(chemin, 'utf8'));
const entree = exposition.assets.find((a: { id: string }) => a.id === id);
if (!entree) throw new Error('Candidat absent du manifeste');
Object.assign(entree, { fichiers: fichiers.map(f => f.nom), revision: empreinte });
writeFileSync(chemin, JSON.stringify(exposition, null, 2) + '\n');
const rapport = { id, revision: empreinte, octets: fichiers.reduce((n, f) => n + f.octets.length, 0), verdict, approbationArtistique: false, integration: 'candidat_inspecteur' };
writeFileSync(path.join(dossier, 'validation-lot.json'), JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify(rapport, null, 2));
