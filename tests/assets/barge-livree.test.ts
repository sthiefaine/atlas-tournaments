import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {genererSpecs} from '../../src/assets/index';
import {controlerDepot} from '../../src/serveur/depot-modeles';
test('barge Tripo active : contrat, LOD0 unique, clips et PNG partagés',()=>{
 const spec=genererSpecs().find(s=>s.id==='unite_barge_base')!;
 const fichiers=readdirSync('public/assets/modeles').filter(n=>n.startsWith(spec.id+'_')).map(nom=>({nom,octets:new Uint8Array(readFileSync('public/assets/modeles/'+nom))}));
 const verdict=controlerDepot(spec,fichiers);assert.equal(verdict.ok,true,JSON.stringify(verdict.motifs));
 assert.deepEqual(spec.budget,{lod0:1000000,materiauxMax:3});
 assert.deepEqual(spec.verification.lodRequis,[0]);
 assert.equal(fichiers.filter(f=>f.nom.endsWith('.glb')).length,1);
 for(const f of fichiers.filter(f=>f.nom.endsWith('.glb'))){const b=Buffer.from(f.octets),d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  for(const m of d.meshes) for(const p of m.primitives) assert.equal(d.accessors[p.attributes.NORMAL].componentType,5126,'normales float32 compatibles WebGPU');
  const triangles=d.meshes.flatMap((m:{primitives:{indices:number}[]})=>m.primitives).reduce((n:number,p:{indices:number})=>n+d.accessors[p.indices].count/3,0);
  assert.equal(triangles,934594);
  assert.ok(d.images.every((i:{uri?:string;bufferView?:number})=>i.uri?.startsWith(spec.id+'_')&&i.bufferView===undefined));
  assert.deepEqual(d.animations.map((a:{name:string})=>a.name),['repos','deplacement','touche','hors_jeu']);
  assert.deepEqual(d.nodes.map((n:{name:string})=>n.name),['racine','corps','base','socle','module_grue']);
 }
});
