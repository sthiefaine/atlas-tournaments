import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { genererKit } from '../../scripts/production/kits';
import { genererSpecs } from '../../src/assets/catalogue';
import { empreinteGeometrie } from '../../src/assets/geometrie-partagee';
import { lirePng } from '../../src/assets/png';
import { decouperGlb, assemblerGlb } from '../../scripts/infanterie/gltf';

test('livrée candidate conserve exactement la géométrie publique et réduit le masque à un liseré neutre', async()=>{
 const dossier=mkdtempSync(path.join(os.tmpdir(),'atlas-kit-'));
 try{
  const spec=genererSpecs().find(s=>s.id==='kit_fr_antiair')!,sortie=path.join(dossier,spec.id);
  const r=await genererKit(spec,sortie,dossier);
  assert(r.ok,JSON.stringify(r.motifs));
  for(const lod of spec.verification.lodRequis)assert.equal(empreinteGeometrie(readFileSync(path.join(sortie,`kit_fr_antiair_lod${lod}.glb`))),empreinteGeometrie(readFileSync(`public/assets/modeles/unite_antiair_base_lod${lod}.glb`)));
  const m=lirePng(readFileSync(path.join(sortie,'kit_fr_antiair_masque_equipe.png')));
  assert.equal(m.largeur,256);
  assert(m.rgba.some((v,i)=>i%4===0&&v===255));
  assert(m.rgba.some((v,i)=>i%4===0&&v===0));
  const encore=await genererKit(spec,sortie,dossier);assert(encore.ok);assert(encore.conserve);
  const fichier=path.join(sortie,'kit_fr_antiair_lod0.glb');const {document,bin}=decouperGlb(readFileSync(fichier));
  (document.nodes as {translation?:number[]}[])[1]!.translation=[.123,0,0];
  const modifie=assemblerGlb(document,bin);writeFileSync(fichier,modifie);
  const refuse=await genererKit(spec,sortie,dossier);assert(!refuse.ok);
  assert.match(JSON.stringify(refuse.motifs),/géométrie/);
  assert.deepEqual(readFileSync(fichier),Buffer.from(modifie),'une reprise refuse le lot altéré sans écraser les fichiers');
 }finally{rmSync(dossier,{recursive:true,force:true});}
});
