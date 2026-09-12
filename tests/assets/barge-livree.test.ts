import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {genererSpecs} from '../../src/assets/index';
import {controlerDepot} from '../../src/serveur/depot-modeles';
test('barge Tripo active : contrat, trois LOD, clips et PNG partagés',()=>{
 const spec=genererSpecs().find(s=>s.id==='unite_barge_base')!;
 const fichiers=readdirSync('public/assets/modeles').filter(n=>n.startsWith(spec.id+'_')).map(nom=>({nom,octets:new Uint8Array(readFileSync('public/assets/modeles/'+nom))}));
 const verdict=controlerDepot(spec,fichiers);assert.equal(verdict.ok,true,JSON.stringify(verdict.motifs));
 assert.deepEqual(spec.budget,{lod0:50000,lod1:12000,lod2:3000,materiauxMax:3});
 for(const f of fichiers.filter(f=>f.nom.endsWith('.glb'))){const b=Buffer.from(f.octets),d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  assert.ok(d.images.every((i:{uri?:string;bufferView?:number})=>i.uri?.startsWith(spec.id+'_')&&i.bufferView===undefined));
  assert.deepEqual(d.animations.map((a:{name:string})=>a.name),['repos','deplacement','touche','hors_jeu']);
  assert.deepEqual(d.nodes.map((n:{name:string})=>n.name),['racine','corps','base','socle','module_grue']);
 }
});
