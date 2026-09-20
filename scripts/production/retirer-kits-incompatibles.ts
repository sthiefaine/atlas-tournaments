/** Retire uniquement les anciens alias de livrée qui cacheraient la nouvelle base commune. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { empreinteGeometrie } from '../../src/assets/geometrie-partagee';
import { lireSpec } from '../controler-asset';
import { controlerDepot } from '../../src/serveur/depot-modeles';

function retirer() {
  const [id, preparation, option] = process.argv.slice(2);
  if (!id || !/^unite_[a-z0-9_]+_base$/.test(id) || !preparation || option && option !== '--appliquer') {
    throw new Error('Usage : retirer-kits-incompatibles.ts <base> <dossier préparé> [--appliquer]');
  }
  const spec = lireSpec(`assets/specs/${id}.json`);
  const plan = JSON.parse(readFileSync('assets/production/plan-modeles-3d.json', 'utf8'));
  const fiche = plan.modeles.find((m: { id: string }) => m.id === id);
  if (spec.type !== 'unite' || !fiche || fiche.etat !== 'en_cours' || fiche.suivi.etape !== 'creation_originale') {
    throw new Error('Base commune en cours de création requise');
  }
  const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  const nomGlb = `${id}_lod0.glb`;
  const ancien = readFileSync(`assets/livraisons/${id}/${nomGlb}`);
  if (sha(ancien) !== fiche.candidat?.sha256) throw new Error('Ancienne base changée depuis le plan');
  const nouveau = readFileSync(path.join(preparation, nomGlb));
  const fichiersPrepares = readdirSync(preparation).filter(n => /\.(png|glb)$/.test(n))
    .map(nom => ({ nom, octets: readFileSync(path.join(preparation, nom)) }));
  const empreintesPreparees = fichiersPrepares.map(f => sha(f.octets));
  const verdict = controlerDepot(spec, fichiersPrepares);
  if (!verdict.ok || fichiersPrepares.some((f, i) => sha(f.octets) !== empreintesPreparees[i])) {
    throw new Error('Le remplacement préparé doit être conforme et intact avant retrait des anciens kits');
  }
  const revue = JSON.parse(readFileSync(path.join(preparation, 'revue-technique.json'), 'utf8'));
  if (revue.id !== id || revue.approbationArtistique !== false || !readFileSync(path.join(preparation, 'README.md'), 'utf8').trim()) {
    throw new Error('Documentation de livraison requise');
  }
  const geomAvant = empreinteGeometrie(ancien), geomApres = empreinteGeometrie(nouveau);
  if (!geomAvant || !geomApres || geomAvant === geomApres) throw new Error('Deux géométries différentes et lisibles sont requises');
  const dossier = 'public/assets/modeles';
  const cle = spec.cle.replace(/_base$/, '');
  const noms = readdirSync(dossier);
  const kits = noms.filter(n => n.startsWith('kit_') && n.endsWith(`_${cle}_lod0.glb`));
  if (!kits.length) throw new Error('Aucun ancien kit actif à retirer');
  const fichiers: { chemin: string; nom: string; sha256: string; octets: Buffer; lien: string | null }[] = [];
  for (const nom of kits) {
    const kit = nom.replace(/_lod0\.glb$/, '');
    const geomKit = empreinteGeometrie(readFileSync(path.join(dossier, nom)));
    if (geomKit !== geomAvant) throw new Error(`${kit} ne correspond pas à l'ancienne base : inspection spécifique requise`);
    if (existsSync(`assets/sources/${kit}`) || existsSync(`assets/livraisons/${kit}/source.json`)) {
      throw new Error(`${kit} possède une source locale : inspection spécifique requise`);
    }
    for (const fichier of noms.filter(n => n.startsWith(`${kit}_`) && /\.(png|glb)$/.test(n))) {
      const chemin = path.join(dossier, fichier), stat = lstatSync(chemin);
      if (!stat.isSymbolicLink() && !stat.isFile()) throw new Error(`Alias non régulier : ${chemin}`);
      const octets = readFileSync(chemin);
      fichiers.push({ chemin, nom: fichier, octets, sha256: sha(octets), lien: stat.isSymbolicLink() ? readlinkSync(chemin) : null });
    }
  }
  const archive = `assets/receptions/${id}/kits-avant-${sha(nouveau)}`;
  const rapport = {
    id, motif: 'Les anciens kits partagent la géométrie précédente et masqueraient la nouvelle base commune.',
    basePrecedente: sha(ancien), nouvelleBase: sha(nouveau), geometriePrecedente: geomAvant, geometrieNouvelle: geomApres,
    archive, kits: kits.map(n => n.replace(/_lod0\.glb$/, '')),
    fichiers: fichiers.map(f => ({ chemin: f.chemin, sha256: f.sha256, octets: f.octets.length, lien: f.lien })),
    candidatsConserves: true, donneesImmuablesConservees: true, approbationArtistique: false,
  };
  if (option === '--appliquer') {
    mkdirSync(archive, { recursive: true });
    for (const f of fichiers) {
      const copie = path.join(archive, f.sha256 + path.extname(f.nom));
      if (!existsSync(copie)) writeFileSync(copie, f.octets, { flag: 'wx' });
      else if (!readFileSync(copie).equals(f.octets)) throw new Error('Archive altérée');
    }
    // Tous les octets sont sauvegardés avant le premier retrait ; les candidats restent en place.
    const texte = JSON.stringify({ ...rapport, date: new Date().toISOString() }, null, 2) + '\n';
    writeFileSync(path.join(archive, 'retrait-kits-incompatibles.json'), texte);
    writeFileSync(path.join(preparation, 'retrait-kits-incompatibles.json'), texte);
    for (const f of fichiers) {
      if (sha(readFileSync(f.chemin)) !== f.sha256) throw new Error('Alias modifié pendant archivage');
      unlinkSync(f.chemin);
    }
  }
  console.log(JSON.stringify({ id, mode: option === '--appliquer' ? 'alias_retires' : 'inspection_seule', kits: rapport.kits, fichiers: fichiers.length }));
}
try { retirer(); } catch (e) { console.error(e instanceof Error ? e.message : 'Retrait impossible'); process.exitCode = 1; }
