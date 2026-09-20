/** Chargement natif glTF et clonage du rig, sans textures ni rendu. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decouperGlb, assemblerGlb } from './gltf';
const id='unite_meridien_veilleur_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
async function mesurer(){
 const {document,bin}=decouperGlb(readFileSync(path.join(sortie,`${id}_lod0.glb`)));
 // Seules les références de textures sont retirées en mémoire pour lire le rig sous
 // Node. Les sommets, nœuds, matériaux scalaires, peaux et clips restent inchangés.
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;delete m.normalTexture;}
 const octets=assemblerGlb(document,bin);
 const gltf=await new GLTFLoader().parseAsync(octets.buffer as ArrayBuffer,'');
 const original=gltf.scene,exemplaire=clone(original),originalBase=original.getObjectByName('base') as THREE.SkinnedMesh,base=exemplaire.getObjectByName('base') as THREE.SkinnedMesh;
 if(!originalBase.isSkinnedMesh||!base.isSkinnedMesh)throw new Error('Skin natif absent');
 if(base.skeleton===originalBase.skeleton||base.skeleton.bones.some((o,i)=>o===originalBase.skeleton.bones[i]))throw new Error('Clones partagent le squelette');
 const noms=['os_rotor_gauche','os_rotor_droit'];
 if(base.skeleton.bones.map(o=>o.name).join(',')!==noms.join(','))throw new Error('Os inattendus');
 exemplaire.updateMatrixWorld(true);
 const centres=base.skeleton.bones.map(o=>o.getWorldPosition(new THREE.Vector3()));
 base.skeleton.bones[0]!.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.71);
 exemplaire.updateMatrixWorld(true);
 base.skeleton.bones.forEach((o,i)=>{if(o.getWorldPosition(new THREE.Vector3()).distanceTo(centres[i]!)>1e-8)throw new Error('Centre de rotor déplacé');});
 if(originalBase.skeleton.bones.some(o=>o.quaternion.angleTo(new THREE.Quaternion())>1e-8))throw new Error('Animation partagée entre copies');
 const points=base.geometry.getAttribute('position'),indices=base.geometry.getAttribute('skinIndex');
 const rayons=[0,0];
 for(let i=0;i<points.count;i++){
  const os=indices.getX(i),inverse=base.skeleton.boneInverses[os]!,p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(base.bindMatrix).applyMatrix4(inverse);
  rayons[os]=Math.max(rayons[os]!,Math.hypot(p.x,p.z));
 }
 const distanceCentres=centres[0]!.distanceTo(centres[1]!);
 const jeuEntreDisques=distanceCentres-rayons[0]!-rayons[1]!;
 if(jeuEntreDisques<=0)throw new Error('Disques balayés superposés');
 const clips=gltf.animations.map(clip=>{
  const copie=clone(original),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set(Array.from({length:1537},(_,i)=>i/1536*clip.duration));clip.tracks.forEach(p=>Array.from(p.times).forEach(t=>instants.add(t)));
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
 const rapport={id,methode:'GLTFLoader natif avec seules références de cartes retirées en mémoire, SkeletonUtils.clone puis AnimationMixer et applyBoneTransform. Aucun rendu.',peauChargee:true,squelettesClonesIndependants:true,centresRotorsFixesDansCorps:true,axes:'+Y',rayonsRotors:rayons,distanceCentres,jeuEntreDisques,pariteNumpyDeuxMicrometres:true,clips,limites:['Géométrie neutre uniquement.','Séparation des deux disques balayés, pas de certification de toutes les collisions internes.','Textures non chargées et aucun rendu.'],approbationArtistique:false};
 writeFileSync(path.join(sortie,'mesures-rig-glb.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({skinNatif:true,clonesIndependants:true,poses:clips.reduce((n,c)=>n+c.poses,0),jeuEntreDisques}));
}
void mesurer();
