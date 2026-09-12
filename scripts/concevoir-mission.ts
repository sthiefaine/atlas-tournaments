/** Produit un lot autonome de brouillons et de rejeux ; ne modifie jamais le canon. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { intentionCanon } from '../src/serveur/conception-canon';
import { concevoirMission, promptConception } from '../src/serveur/conception';
import { avecConsequences } from '../src/app/admin/cartes/consequences';
import { validerConception } from '../src/schemas/conception';
async function main(){
const args=process.argv.slice(2);
const valeur=(cle:string,defaut:string)=>{const n=args.indexOf(cle);return n<0?defaut:args[n+1]??defaut;};
const fichier=valeur('--contrat','');
const brut=fichier?JSON.parse(await readFile(fichier,'utf8')):avecConsequences((await intentionCanon(valeur('--scenario','opus1_tutoriel_05')))!);
const v=validerConception(brut);if(!v.ok)throw new Error(JSON.stringify(v.erreurs));
const sortie=path.resolve(valeur('--sortie','apercus/conception'));
if(sortie===path.resolve('content')||sortie.startsWith(path.resolve('content')+path.sep))throw new Error('Exporter dans apercus ou un dossier temporaire, jamais dans le canon.');
const rapport=await concevoirMission(v.valeur,{dureeMaxMs:120000,progression:texte=>process.stdout.write(`${texte}\n`)});
await mkdir(sortie,{recursive:true});
await writeFile(path.join(sortie,'rapport.json'),JSON.stringify(rapport,null,2)+'\n');
await writeFile(path.join(sortie,'intention.json'),JSON.stringify(v.valeur,null,2)+'\n');
await writeFile(path.join(sortie,'prompt.txt'),promptConception(v.valeur)+'\n');
for(const c of rapport.candidates)for(const r of c.revisions){
  const dossier=path.join(sortie,`variante_${c.rang}_revision_${r.revision}`);await mkdir(dossier,{recursive:true});
  await writeFile(path.join(dossier,'carte.json'),JSON.stringify(r.carte,null,2)+'\n');
  await writeFile(path.join(dossier,'scenario.json'),JSON.stringify({...v.valeur.scenario,carteCle:r.carte.cle,statut:'brouillon'},null,2)+'\n');
}
process.stdout.write(JSON.stringify({sortie,parties:rapport.budget.parties,recommandation:rapport.recommandation,interrompu:rapport.budget.interrompu})+'\n');

}
void main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
