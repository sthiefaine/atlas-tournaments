/** Production ciblée des cinq bases sans source importée ; activation après contrôle technique. */
import { mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { genererEnvironnement } from './environnement';
import { controlerDepot } from '../../src/serveur/depot-modeles';
import type { AssetSpec } from '../../src/assets/spec';
const ids = ['ville', 'usine', 'port', 'aeroport', 'radar'].map(c => `batiment_${c}_base`);
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
async function main() {
  const expositionPath = 'assets/production/exposition.json';
  const exposition = JSON.parse(readFileSync(expositionPath, 'utf8'));
  const bilan: unknown[] = [];
  for (const id of ids) {
    const spec = JSON.parse(readFileSync(`assets/specs/${id}.json`, 'utf8')) as AssetSpec;
    const dossier = `assets/livraisons/${id}`;
    const resultat = await genererEnvironnement(spec, dossier);
    if (!resultat.ok) throw new Error(JSON.stringify(resultat));
    const fichiers = resultat.fichiers.map(nom => ({ nom, octets: new Uint8Array(readFileSync(path.join(dossier, nom))) }));
    const empreintes = fichiers.map(f => sha(f.octets));
    const verdict = controlerDepot(spec, fichiers);
    if (!verdict.ok || fichiers.some((f,i) => sha(f.octets) !== empreintes[i])) throw new Error(JSON.stringify(verdict));
    const modele = fichiers.find(f => f.nom.endsWith('.glb'))!.octets;
    const buffer = Buffer.from(modele);
    const document = JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
    const triangles = document.meshes.flatMap((m: {primitives: {indices?:number;attributes:{POSITION:number}}[]}) => m.primitives).reduce((n:number,p:{indices?:number;attributes:{POSITION:number}})=>n+document.accessors[p.indices ?? p.attributes.POSITION].count/3,0);
    for (const [i, f] of fichiers.entries()) {
      const blob = path.resolve('public/assets/donnees', empreintes[i]! + path.extname(f.nom));
      if (!existsSync(blob)) writeFileSync(blob, f.octets, {flag:'wx'});
      for (const folder of ['modeles', 'candidats']) {
        const repertoire = path.resolve('public/assets', folder); mkdirSync(repertoire,{recursive:true});
        const lien = path.join(repertoire,f.nom);
        if (existsSync(lien) || (()=>{try{return lstatSync(lien).isSymbolicLink();}catch{return false;}})()) {
          if (!lstatSync(lien).isSymbolicLink()) throw new Error(`Fichier ordinaire à préserver : ${lien}`);
          unlinkSync(lien);
        }
        symlinkSync(path.relative(repertoire,blob),lien);
      }
      // Le lot local aussi pointe vers la donnée publiée, sans deuxième GLB dans git.
      const local = path.resolve(dossier, f.nom);
      if (f.nom.endsWith('.glb') && !lstatSync(local).isSymbolicLink()) {
        unlinkSync(local);
        symlinkSync(path.relative(path.resolve(dossier), blob), local);
      }
    }
    const revision = sha(Buffer.from(JSON.stringify(spec)+empreintes.join('')));
    const entree = {id, fichiers:fichiers.map(f=>f.nom), revision};
    const i = exposition.assets.findIndex((a:{id:string})=>a.id===id);
    if(i<0)exposition.assets.push(entree);else exposition.assets[i]=entree;
    const rapport = {id,triangles,octets:fichiers.reduce((n,f)=>n+f.octets.length,0),source:'modélisation procédurale Atlas',verdict,revision,actif:true,approbationArtistique:false};
    writeFileSync(path.join(dossier,'validation-lot.json'),JSON.stringify(rapport,null,2)+'\n');
    writeFileSync(path.join(dossier,'README.md'),`# ${id}\n\nModèle original construit dans le dépôt, LOD0 uniquement. PNG PBR externes, masque d’équipe neutre et vitrages émissifs. Aucun GLB uploadé remplacé.\n\n${triangles} triangles ; ${rapport.octets} octets. Contrôle technique OK. Qualité artistique non certifiée.\n`);
    bilan.push(rapport); console.log(JSON.stringify({id,triangles,octets:rapport.octets,ok:verdict.ok}));
  }
  writeFileSync(expositionPath,JSON.stringify(exposition,null,2)+'\n');
  writeFileSync('assets/livraisons/batiments-base-septembre.json',JSON.stringify(bilan,null,2)+'\n');
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
