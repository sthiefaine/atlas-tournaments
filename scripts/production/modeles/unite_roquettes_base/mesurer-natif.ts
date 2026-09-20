/** Chargement natif glTF et clonage du rig, sans textures ni rendu. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decouperGlb, assemblerGlb } from './gltf';
const id='unite_roquettes_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
async function mesurer(){
 const {document,bin}=decouperGlb(readFileSync(path.join(sortie,`${id}_lod0.glb`)));
 // Seules les références de textures sont retirées en mémoire pour lire le rig sous
 // Node. Les sommets, nœuds, matériaux scalaires, peaux et clips restent inchangés.
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;delete m.normalTexture;}
 const octets=assemblerGlb(document,bin);
 const gltf=await new GLTFLoader().parseAsync(octets.buffer as ArrayBuffer,'');
 const original=gltf.scene,exemplaire=clone(original);
 const moduleOriginal=original.getObjectByName('module_lance_roquettes')!,moduleCopie=exemplaire.getObjectByName('module_lance_roquettes')!;
 if(moduleOriginal===moduleCopie)throw new Error('Nœud partagé entre copies');
 exemplaire.updateMatrixWorld(true);const centre=moduleCopie.getWorldPosition(new THREE.Vector3());
 moduleCopie.rotateY(.71);exemplaire.updateMatrixWorld(true);
 if(moduleCopie.getWorldPosition(new THREE.Vector3()).distanceTo(centre)>1e-8)throw new Error('Pivot rack mobile');
 if(moduleOriginal.quaternion.angleTo(new THREE.Quaternion())>1e-8)throw new Error('Rotation partagée entre copies');
 const clips=gltf.animations.map(clip=>{
  const copie=clone(original),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set(Array.from({length:193},(_,i)=>i/192*clip.duration));clip.tracks.forEach(p=>Array.from(p.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let rayon=0;
  for(const t of [...instants].sort((a,b)=>a-b)){
   mixer.setTime(t);copie.updateMatrixWorld(true);
   copie.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(o instanceof THREE.SkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);
     for(let k=0;k<3;k++){min[k]=Math.min(min[k]!,v.getComponent(k));max[k]=Math.max(max[k]!,v.getComponent(k));}rayon=Math.max(rayon,Math.hypot(v.x,v.z));}
   });
  }
  mixer.stopAllAction();mixer.uncacheRoot(copie);return {nom:clip.name,poses:instants.size,min,max,rayon};
 });
 const autres=JSON.parse(readFileSync(path.join(sortie,'mesures-poses-glb.json'),'utf8')) as {clips:{nom:string;rayonHorizontalMax:number;enveloppe:{min:number[];max:number[]}}[]};
 for(const [i,c] of clips.entries()){
  const a=autres.clips[i]!;
  if(c.nom!==a.nom||Math.abs(c.rayon-a.rayonHorizontalMax)>2e-6||c.min.some((v,k)=>Math.abs(v-a.enveloppe.min[k]!)>2e-6)||c.max.some((v,k)=>Math.abs(v-a.enveloppe.max[k]!)>2e-6))throw new Error('Divergence chargeur natif');
 }
 const rapport={id,methode:'GLTFLoader natif, seules références de cartes retirées en mémoire ; SkeletonUtils.clone et AnimationMixer sans rendu. Géométrie et clips inchangés.',clonesNoeudsIndependants:true,pivotRackFixeDansCorps:true,pariteNumpyDeuxMicrometres:true,clips,limites:['Textures non chargées dans ce contrôle natif ; références contrôlées séparément.','Chaque clip isolé, transitions exclues.','Aucun rendu ni appréciation artistique.'],approbationArtistique:false};
 writeFileSync(path.join(sortie,'mesures-natif-glb.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({chargementNatif:true,clonesIndependants:true,poses:clips.reduce((n,c)=>n+c.poses,0)}));
}
void mesurer();
