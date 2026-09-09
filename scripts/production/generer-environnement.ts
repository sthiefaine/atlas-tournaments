/** Production locale de candidats, sans publication ni approbation artistique. */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { AssetSpec } from '../../src/assets/spec';
import { genererEnvironnement } from './environnement';

function bilanGeometrie(sortie: string, noms: string[]) {
  return noms.filter(n=>n.endsWith('.glb')).map(nom=>{
    const octets=readFileSync(path.join(sortie,nom));
    const document=JSON.parse(octets.subarray(20,20+octets.readUInt32LE(12)).toString('utf8'));
    let triangles=0;
    for(const mesh of document.meshes??[])for(const primitive of mesh.primitives??[]) {
      const compte=primitive.indices===undefined?document.accessors[primitive.attributes.POSITION].count:document.accessors[primitive.indices].count;
      triangles+=compte/3;
    }
    return {nom,octets:statSync(path.join(sortie,nom)).size,triangles,noeuds:(document.nodes??[]).map((n:{name:string})=>n.name),materiaux:(document.materials??[]).map((m:{name:string})=>m.name),imagesEmbarquees:(document.images??[]).filter((i:{bufferView?:number})=>i.bufferView!==undefined).length};
  });
}

async function main() {
  const root=process.cwd(),rapport:unknown[]=[];
  const specs=readdirSync(path.join(root,'assets/specs')).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(readFileSync(path.join(root,'assets/specs',n),'utf8')) as AssetSpec).filter(s=>['terrain','batiment','decor'].includes(s.type)&&s.id!=='terrain_plaine');
  for(const spec of specs) {
    const sortie=path.join(root,'assets/livraisons',spec.id);
    try {
      const r=await genererEnvironnement(spec,sortie);rapport.push(r);
      if(r.ok&&!r.conserve){writeFileSync(path.join(sortie,'candidat-production.json'),JSON.stringify({id:spec.id,statut:'candidat_technique',validationArtistique:'non_effectuee',generateur:'scripts/production/environnement.ts',limites:['Candidat procédural ; composition, matières et variantes saisonnières restent à examiner artistiquement.'],geometrie:bilanGeometrie(sortie,r.fichiers),rapport:r},null,2)+'\n');}
      console.log(JSON.stringify({id:r.id,ok:r.ok,conserve:r.conserve,motifs:r.motifs}));
    }catch(e){const r={id:spec.id,ok:false,erreur:String(e)};rapport.push(r);console.log(JSON.stringify(r));}
    mkdirSync(path.join(root,'assets/livraisons'),{recursive:true});writeFileSync(path.join(root,'assets/livraisons/rapport-environnement.json'),JSON.stringify({statut:'candidats_non_valides_artistiquement',plaine:'existante_preservee',total:specs.length,traites:rapport.length,resultats:rapport},null,2)+'\n');
  }
}
void main();
