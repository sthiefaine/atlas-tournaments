/** Lecture native du GLB, articulations et poses mesurées sans image ni rendu. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {decouperGlb,assemblerGlb} from './gltf';
const id='unite_meca_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
function meshes(r:T.Object3D){const result:T.Mesh[]=[];r.traverse(o=>{if(o instanceof T.Mesh)result.push(o);});return result;}
function distanceSegments(a:T.Vector3,b:T.Vector3,c:T.Vector3,d:T.Vector3){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),denom=aa*cc-bb*bb;
 const distance=(s:number,t:number)=>a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));
 const borne=(v:number)=>Math.min(1,Math.max(0,v));
 const valeurs=[distance(0,cc>0?borne(ee/cc):0),distance(1,cc>0?borne((ee+bb)/cc):0),distance(aa>0?borne(-dd/aa):0,0),distance(aa>0?borne((bb-dd)/aa):0,1)];
 if(denom>1e-15){const s=(bb*ee-cc*dd)/denom,t=(aa*ee-bb*dd)/denom;if(s>=0&&s<=1&&t>=0&&t<=1)valeurs.push(distance(s,t));}
 return Math.min(...valeurs);
}
function brasInterieurs(r:T.Object3D){
 const figures=[{nom:'porteuse',cote:'droite',s:1,mainZ:.026},{nom:'equipier',cote:'gauche',s:-1,mainZ:.068}];
 const capsules=figures.map(f=>{
  const bras=r.getObjectByName(`os_bras_${f.nom}_${f.cote}`)!,avant=r.getObjectByName(`os_avant_bras_${f.nom}_${f.cote}`)!;
  const a=bras.getWorldPosition(new T.Vector3()),b=avant.getWorldPosition(new T.Vector3()),c=new T.Vector3(f.s*.005,-.036,f.mainZ-.009).applyMatrix4(avant.matrixWorld);
  return [{a,b,r:.027},{a:b,b:c,r:.024},{a,b:a,r:.033}];
 });
 return Math.min(...capsules[0]!.flatMap(p=>capsules[1]!.map(q=>distanceSegments(p.a,p.b,q.a,q.b)-p.r-q.r)));
}
function points(r:T.Object3D){
 r.updateMatrixWorld(true);const b=new T.Box3(),pieds=new Map<string,T.Box3>(),boites=new Map<string,T.Box3>();let rayon=0,piedsEllipseMax=0;
 const inversePorteuse=r.getObjectByName('os_torse_porteuse')!.matrixWorld.clone().invert(),inverseEquipier=r.getObjectByName('os_torse_equipier')!.matrixWorld.clone().invert();
 const ajouter=(nom:string,v:T.Vector3)=>{const bb=boites.get(nom)??new T.Box3();bb.expandByPoint(v);boites.set(nom,bb);};
 for(const o of meshes(r)){
  const p=o.geometry.getAttribute('position'),j=o.geometry.getAttribute('skinIndex');
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i);let os='';
   if(o instanceof T.SkinnedMesh){o.applyBoneTransform(i,v);os=o.skeleton.bones[j.getX(i)]!.name;}v.applyMatrix4(o.matrixWorld);b.expandByPoint(v);rayon=Math.max(rayon,Math.hypot(v.x,v.z));
   if(os==='module_lance_roquettes')ajouter('lanceur',v.clone().applyMatrix4(inversePorteuse));
   if(os==='os_tete_porteuse')ajouter('tete_porteuse',v.clone().applyMatrix4(inversePorteuse));
   if(os==='os_bras_porteuse_gauche')ajouter('epaule_porteuse',v.clone().applyMatrix4(inversePorteuse));
   if(os==='os_avant_bras_porteuse_gauche')ajouter('gant_porteur',v.clone().applyMatrix4(inversePorteuse));
   if(os==='os_torse_equipier')ajouter('torse_equipier',v.clone().applyMatrix4(inverseEquipier));
   if(os==='os_tete_equipier')ajouter('tete_equipier',v.clone().applyMatrix4(inverseEquipier));
   if(os==='os_avant_bras_equipier_droite')ajouter('bras_salut',v.clone().applyMatrix4(inverseEquipier));
   if(os.startsWith('os_pied_')){const bb=pieds.get(os)??new T.Box3();bb.expandByPoint(v);pieds.set(os,bb);piedsEllipseMax=Math.max(piedsEllipseMax,(v.x/.221)**2+(v.z/.216)**2);}
  }
 }
 const piedsResult=Object.fromEntries([...pieds].map(([k,b])=>[k,{min:b.min.toArray(),max:b.max.toArray()}]));
 const lanceur=boites.get('lanceur')!,casque=boites.get('tete_porteuse')!,epaule=boites.get('epaule_porteuse')!,gant=boites.get('gant_porteur')!;
 const p=r.getObjectByName('os_bras_porteuse_droite')!.getWorldPosition(new T.Vector3()),e=r.getObjectByName('os_bras_equipier_gauche')!.getWorldPosition(new T.Vector3());
 return {min:b.min.toArray(),max:b.max.toArray(),dimensions:b.getSize(new T.Vector3()).toArray(),rayon,pieds:piedsResult,piedsEllipseMax,jeux:{lanceurCasque:casque.min.x-lanceur.max.x,lanceurEpaule:lanceur.min.y-epaule.max.y,lanceurGant:lanceur.min.y-gant.max.y,brasCaptureCasque:boites.get('bras_salut')!.min.x-boites.get('tete_equipier')!.max.x,epaulesInterieuresSpheres:p.distanceTo(e)-.066,brasInterieursCapsules:brasInterieurs(r),avantBrasCaptureTorse:boites.get('bras_salut')!.min.x-boites.get('torse_equipier')!.max.x}};
}
async function mesurer(){
 const {document,bin}=decouperGlb(readFileSync(path.join(sortie,`${id}_lod0.glb`)));
 // Les références PNG seules sont retirées en mémoire pour lire le GLB en Node sans DOM.
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;delete m.normalTexture;}
 const octets=assemblerGlb(document,bin),gltf=await new GLTFLoader().parseAsync(octets.buffer as ArrayBuffer,'');
 const original=gltf.scene,copie=clone(original),skins=meshes(copie).filter((m):m is T.SkinnedMesh=>m instanceof T.SkinnedMesh),skinsOrig=meshes(original).filter((m):m is T.SkinnedMesh=>m instanceof T.SkinnedMesh);
 if(skins.length!==2||skins.some((m,i)=>m.skeleton===skinsOrig[i]!.skeleton||m.skeleton.bones.some((b,j)=>b===skinsOrig[i]!.skeleton.bones[j])))throw new Error('Clone/skin incorrect');
 const neutre=points(original),neutreCopie=points(copie);if(neutre.min.some((v,i)=>Math.abs(v-neutreCopie.min[i]!)>1e-9))throw new Error('Clone modifie pose neutre');
 copie.getObjectByName('os_cuisse_porteuse_gauche')!.rotation.x=.28;copie.updateMatrixWorld(true);if(original.getObjectByName('os_cuisse_porteuse_gauche')!.quaternion.angleTo(new T.Quaternion())>1e-9)throw new Error('Os partagé');
 const clips=gltf.animations.map(clip=>{
  const r=clone(original),mixer=new T.AnimationMixer(r),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set(Array.from({length:257},(_,i)=>i/256*clip.duration));clip.tracks.forEach(tr=>Array.from(tr.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],semelles:Record<string,{min:number;max:number}>={},jeux:Record<string,number>={};let rayon=0,rootError=0,piedsEllipseMax=0,recul=0;
  const appuis:Record<string,{erreurSupportMax:number;anglePiedMax:number}>={porteuse:{erreurSupportMax:0,anglePiedMax:0},equipier:{erreurSupportMax:0,anglePiedMax:0}};
  const moduleNeutre=r.getObjectByName('module_lance_roquettes')!.position.clone(),brasNeutre=r.getObjectByName('os_avant_bras_equipier_droite')!.getWorldPosition(new T.Vector3()),geste={coudeDeplacementMax:0,angleAvantBrasMax:0,mainPoigneeDistanceMax:0};
  for(const t of [...instants].sort((a,b)=>a-b)){
   mixer.setTime(t);const p=points(r);for(let i=0;i<3;i++){min[i]=Math.min(min[i]!,p.min[i]!);max[i]=Math.max(max[i]!,p.max[i]!);}rayon=Math.max(rayon,p.rayon);piedsEllipseMax=Math.max(piedsEllipseMax,p.piedsEllipseMax);
   for(const [nom,jeu] of Object.entries(p.jeux))jeux[nom]=Math.min(jeux[nom]??Infinity,jeu);
   for(const nom of ['porteuse','equipier']){const pieds=['gauche','droite'].map(c=>`os_pied_${nom}_${c}`);appuis[nom]!.erreurSupportMax=Math.max(appuis[nom]!.erreurSupportMax,Math.abs(Math.min(...pieds.map(n=>p.pieds[n]!.min[1]!))-.018));appuis[nom]!.anglePiedMax=Math.max(appuis[nom]!.anglePiedMax,...pieds.map(n=>r.getObjectByName(n)!.getWorldQuaternion(new T.Quaternion()).angleTo(new T.Quaternion())));}
   for(const [nom,b] of Object.entries(p.pieds)){const s=semelles[nom]??{min:Infinity,max:-Infinity};s.min=Math.min(s.min,b.min[1]!);s.max=Math.max(s.max,b.min[1]!);semelles[nom]=s;}
   const rac=r.getObjectByName('racine')!;rootError=Math.max(rootError,rac.position.length(),rac.quaternion.angleTo(new T.Quaternion()),rac.scale.distanceTo(new T.Vector3(1,1,1)));
   recul=Math.max(recul,moduleNeutre.z-r.getObjectByName('module_lance_roquettes')!.position.z);
   const main=new T.Vector3(-.005,.081,.107).applyMatrix4(r.getObjectByName('os_avant_bras_porteuse_gauche')!.matrixWorld),poignee=new T.Vector3(-.089,.132,.131).applyMatrix4(r.getObjectByName('os_torse_porteuse')!.matrixWorld);geste.mainPoigneeDistanceMax=Math.max(geste.mainPoigneeDistanceMax,main.distanceTo(poignee));
   const bras=r.getObjectByName('os_avant_bras_equipier_droite')!;geste.coudeDeplacementMax=Math.max(geste.coudeDeplacementMax,bras.getWorldPosition(new T.Vector3()).distanceTo(brasNeutre));geste.angleAvantBrasMax=Math.max(geste.angleAvantBrasMax,bras.quaternion.angleTo(new T.Quaternion()));
  }
  mixer.setTime(clip.duration);const indicateur=r.getObjectByName('socle')!.scale.toArray(),final=points(r),orientationsPieds:Record<string,number>={};for(const n of Object.keys(semelles))orientationsPieds[n]=r.getObjectByName(n)!.getWorldQuaternion(new T.Quaternion()).angleTo(new T.Quaternion());
  mixer.stopAllAction();mixer.uncacheRoot(r);
  const probleme=rootError>1e-8||min[1]!<-.00001||rayon>=.5||Object.values(jeux).some(v=>v<=0)||piedsEllipseMax>1||geste.mainPoigneeDistanceMax>.0015||Object.values(appuis).some(a=>a.erreurSupportMax>1e-5||a.anglePiedMax>1e-5);
  if(probleme)throw new Error(JSON.stringify({clip:clip.name,rootError,min,rayon,jeux,piedsEllipseMax,appuis}));
  return {nom:clip.name,dureeMs:Math.round(clip.duration*1000),poses:instants.size,enveloppe:{min,max},rayonHorizontalMax:rayon,semelles,appuis,rootError,jeuxMinimumMetres:jeux,piedsEllipseMax,final:{semelles:final.pieds,orientationPiedsRad:orientationsPieds,indicateur},reculLocalMetres:recul,geste};
 });
 const rapport={id,approbationArtistique:false,methode:'GLTFLoader avec seules références PNG retirées en mémoire, SkeletonUtils.clone, AnimationMixer et positions skin réelles, sans rendu.',skinNatif:true,squelettesClonesIndependants:true,os:skins[0]!.skeleton.bones.map(b=>b.name),neutre,clips,definitionJeux:{lanceurCasque:'Plan séparateur X dans le repère du torse de la porteuse, géométrie skinnée complète du caisson et de la tête.',lanceurEpaule:'Plan séparateur Y dans ce même repère, hors selle et pont de portage en contact voulu.',lanceurGant:'Plan séparateur Y avec le gant porteur ; la poignée attachée au torse assure le raccord.',brasCaptureCasque:'Plan séparateur X entre l’avant-bras de salut et la tête de l’équipier.',epaulesInterieuresSpheres:'Sphères conservatrices de rayon 33 mm englobant chacune des deux épaules intérieures.',brasInterieursCapsules:'Minimum entre capsules conservatrices des deux bras intérieurs : manches, avant-bras, gants et épaules.',avantBrasCaptureTorse:'Plan séparateur X entre avant-bras de salut et pièces liées au torse.',mainPoigneeDistanceMax:'Distance des centres du gant porteur et de la poignée ; ils sont en contact voulu.',piedsEllipseMax:'Maximum de (x/0.221)²+(z/0.216)² pour tous les sommets des pieds, valeur < 1 à l’intérieur du plateau.'},limites:['Articulations par segments rigides ; pas de peau organique lissée.','Mesures échantillonnées dans le GLB, sans certification continue ou des mélanges entre clips.','Jeux ciblés ; collisions internes complètes et adaptations aux kits nationaux non certifiées.','Aucun rendu, aucune image et aucune mesure FPS téléphone.']};
 writeFileSync(path.join(sortie,'mesures-rig-glb.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({skin:true,clonesIndependants:true,os:rapport.os.length,neutre,clips:clips.map(c=>({nom:c.nom,poses:c.poses,rayon:c.rayonHorizontalMax,jeux:c.jeuxMinimumMetres,appuis:c.appuis,recul:c.reculLocalMetres}))}));
}
void mesurer();
