/** Reprend seulement les refus du rapport, sans toucher aux candidats acceptés. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetSpec } from '../../src/assets/spec';
import type { RapportCandidat } from './commun';
import { genererEnvironnement } from './environnement';
async function main() {
  const fichier='assets/livraisons/rapport-environnement.json';
  const rapport=JSON.parse(readFileSync(fichier,'utf8')) as {resultats:RapportCandidat[];traites:number;total:number};
  for(let i=0;i<rapport.resultats.length;i++) {
    const ancien=rapport.resultats[i]!;if(ancien.ok)continue;
    const spec=JSON.parse(readFileSync(`assets/specs/${ancien.id}.json`,'utf8')) as AssetSpec;
    const sortie=path.join('assets/livraisons',ancien.id);
    const r=await genererEnvironnement(spec,sortie);rapport.resultats[i]=r;
    if(r.ok) {
      const geometrie=r.fichiers.filter(n=>n.endsWith('.glb')).map(nom=>{
        const b=readFileSync(path.join(sortie,nom)),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
        let triangles=0;for(const m of g.meshes??[])for(const p of m.primitives??[])triangles+=g.accessors[p.indices??p.attributes.POSITION].count/3;
        return {nom,octets:b.length,triangles,noeuds:g.nodes.map((n:{name:string})=>n.name),materiaux:g.materials.map((m:{name:string})=>m.name),imagesEmbarquees:g.images.filter((im:{bufferView?:number})=>im.bufferView!==undefined).length};
      });
      writeFileSync(path.join(sortie,'candidat-production.json'),JSON.stringify({id:spec.id,statut:'candidat_technique',validationArtistique:'non_effectuee',generateur:'scripts/production/environnement.ts',limites:['Candidat procédural ; composition, matières et variantes saisonnières restent à examiner artistiquement.'],geometrie,rapport:r},null,2)+'\n');
    }
    writeFileSync(fichier,JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id:r.id,ok:r.ok,motifs:r.motifs}));
  }
}
void main();
