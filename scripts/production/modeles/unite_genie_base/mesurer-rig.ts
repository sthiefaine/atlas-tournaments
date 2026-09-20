/** Lecture native du GLB, articulations et poses mesurées sans image ni rendu. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {decouperGlb,assemblerGlb} from './gltf';
const id='unite_genie_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
function meshes(r:T.Object3D){const result:T.Mesh[]=[];r.traverse(o=>{if(o instanceof T.Mesh)result.push(o);});return result;}
function points(r:T.Object3D){r.updateMatrixWorld(true);const b=new T.Box3(),pieds=new Map<string,T.Box3>(),personnes=new Map<string,T.Box3>(),radarBox=new T.Box3(),teteBox=new T.Box3();let rayon=0;
 for(const o of meshes(r)){const p=o.geometry.getAttribute('position'),j=o.geometry.getAttribute('skinIndex');for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i);let os='';if(o instanceof T.SkinnedMesh){o.applyBoneTransform(i,v);os=o.skeleton.bones[j.getX(i)]!.name;}v.applyMatrix4(o.matrixWorld);b.expandByPoint(v);rayon=Math.max(rayon,Math.hypot(v.x,v.z));
  if(os==='module_radar')radarBox.expandByPoint(v);if(os==='os_tete_technicien')teteBox.expandByPoint(v);
  if(os.startsWith('os_pied_')){const bb=pieds.get(os)??new T.Box3();bb.expandByPoint(v);pieds.set(os,bb);}
  if(os.includes('technicien')){const nom=os.includes('technicienne')?'technicienne':'technicien';const bb=personnes.get(nom)??new T.Box3();bb.expandByPoint(v);personnes.set(nom,bb);}
 }}
 return {min:b.min.toArray(),max:b.max.toArray(),dimensions:b.getSize(new T.Vector3()).toArray(),rayon,jeuRadarDerriereCasque:teteBox.min.z-radarBox.max.z,pieds:Object.fromEntries([...pieds].map(([k,b])=>[k,{min:b.min.toArray(),max:b.max.toArray()}])),personnes:Object.fromEntries([...personnes].map(([k,b])=>[k,{min:b.min.toArray(),max:b.max.toArray()}]))};
}
async function mesurer(){
 const {document,bin}=decouperGlb(readFileSync(path.join(sortie,`${id}_lod0.glb`)));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;delete m.normalTexture;}
 const octets=assemblerGlb(document,bin),gltf=await new GLTFLoader().parseAsync(octets.buffer as ArrayBuffer,'');
 const original=gltf.scene,copie=clone(original),skins=meshes(copie).filter((m):m is T.SkinnedMesh=>m instanceof T.SkinnedMesh),skinsOrig=meshes(original).filter((m):m is T.SkinnedMesh=>m instanceof T.SkinnedMesh);
 if(skins.length!==2||skins.some((m,i)=>m.skeleton===skinsOrig[i]!.skeleton||m.skeleton.bones.some((b,j)=>b===skinsOrig[i]!.skeleton.bones[j])))throw new Error('Clone/skin incorrect');
 const neutre=points(original),neutreCopie=points(copie);if(neutre.min.some((v,i)=>Math.abs(v-neutreCopie.min[i]!)>1e-9))throw new Error('Clone modifie pose neutre');
 copie.getObjectByName('os_cuisse_technicien_gauche')!.rotation.x=.28;copie.updateMatrixWorld(true);if(original.getObjectByName('os_cuisse_technicien_gauche')!.quaternion.angleTo(new T.Quaternion())>1e-9)throw new Error('Os partagé');
 const clips=gltf.animations.map(clip=>{
  const r=clone(original),mixer=new T.AnimationMixer(r),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set(Array.from({length:193},(_,i)=>i/192*clip.duration));clip.tracks.forEach(tr=>Array.from(tr.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],semelles:Record<string,{min:number;max:number}>={};let rayon=0,rootError=0,jeuRadar=Infinity;const appuis:Record<string,{erreurSupportMax:number;anglePiedMax:number}>={technicien:{erreurSupportMax:0,anglePiedMax:0},technicienne:{erreurSupportMax:0,anglePiedMax:0}};const radar:T.Vector3[]=[];
  for(const t of [...instants].sort((a,b)=>a-b)){
   mixer.setTime(t);const p=points(r);for(let i=0;i<3;i++){min[i]=Math.min(min[i]!,p.min[i]!);max[i]=Math.max(max[i]!,p.max[i]!);}rayon=Math.max(rayon,p.rayon);jeuRadar=Math.min(jeuRadar,p.jeuRadarDerriereCasque);
   for(const nom of ['technicien','technicienne']){const pieds=['gauche','droite'].map(c=>`os_pied_${nom}_${c}`);appuis[nom]!.erreurSupportMax=Math.max(appuis[nom]!.erreurSupportMax,Math.abs(Math.min(...pieds.map(n=>p.pieds[n]!.min[1]!))-.018));appuis[nom]!.anglePiedMax=Math.max(appuis[nom]!.anglePiedMax,...pieds.map(n=>r.getObjectByName(n)!.getWorldQuaternion(new T.Quaternion()).angleTo(new T.Quaternion())));}
   for(const [nom,b] of Object.entries(p.pieds)){const s=semelles[nom]??{min:Infinity,max:-Infinity};s.min=Math.min(s.min,b.min[1]!);s.max=Math.max(s.max,b.min[1]!);semelles[nom]=s;}
   const rac=r.getObjectByName('racine')!;rootError=Math.max(rootError,rac.position.length(),rac.quaternion.angleTo(new T.Quaternion()),rac.scale.distanceTo(new T.Vector3(1,1,1)));
   radar.push(r.getObjectByName('module_radar')!.getWorldPosition(new T.Vector3()));
  }
  mixer.setTime(clip.duration);const indicateur=r.getObjectByName('socle')!.scale.toArray(),final=points(r),orientationsPieds:Record<string,number>={};for(const n of Object.keys(semelles))orientationsPieds[n]=r.getObjectByName(n)!.getWorldQuaternion(new T.Quaternion()).angleTo(new T.Quaternion());
  mixer.stopAllAction();mixer.uncacheRoot(r);if(rootError>1e-8||min[1]!<-.00001||rayon>=.5||jeuRadar<=0||Object.values(appuis).some(a=>a.erreurSupportMax>1e-5||a.anglePiedMax>1e-5))throw new Error(`Racine/sol/case ${clip.name}`);
  return {nom:clip.name,dureeMs:Math.round(clip.duration*1000),poses:instants.size,enveloppe:{min,max},rayonHorizontalMax:rayon,semelles,appuis,rootError,jeuRadarDerriereCasqueMin:jeuRadar,final:{semelles:final.pieds,orientationPiedsRad:orientationsPieds,indicateur},radarDeplacementPivotMax:Math.max(...radar.map(p=>p.distanceTo(radar[0]!)))};
 });
 const rapport={id,approbationArtistique:false,methode:'GLTFLoader avec seules références PNG retirées en mémoire, SkeletonUtils.clone, AnimationMixer et positions skin réelles, sans rendu.',skinNatif:true,squelettesClonesIndependants:true,os:skins[0]!.skeleton.bones.map(b=>b.name),neutre,clips,limites:['Articulations par segments rigides ; pas de peau organique lissée.','Mesures échantillonnées dans le GLB, sans certification des mélanges entre clips.','Collisions internes et adaptations aux kits nationaux non certifiées.','Aucun rendu, aucune image et aucune mesure FPS téléphone.']};
 writeFileSync(path.join(sortie,'mesures-rig-glb.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({skin:true,clonesIndependants:true,os:rapport.os.length,neutre,clips:clips.map(c=>({nom:c.nom,poses:c.poses,rayon:c.rayonHorizontalMax,semelles:c.semelles,finPieds:c.final.orientationPiedsRad}))}));
}
void mesurer();
