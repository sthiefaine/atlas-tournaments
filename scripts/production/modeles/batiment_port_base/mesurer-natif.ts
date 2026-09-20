/** GLTFLoader natif et AnimationMixer ; aucune création de moteur de rendu. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decouperGlb, assemblerGlb } from './gltf';
const id='batiment_port_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
async function mesurer(){
 const {document,bin}=decouperGlb(readFileSync(path.join(sortie,`${id}_lod0.glb`)));
 // Sous Node sans canevas : cartes retirées en mémoire seulement. Meshes/normales/UV/clips conservés.
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown}[]){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;delete m.normalTexture;delete m.emissiveTexture;}
 const bytes=assemblerGlb(document,bin),gltf=await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer,'');
 const original=gltf.scene,copie=original.clone(true),a=original.getObjectByName('grue')!,b=copie.getObjectByName('grue')!;
 if(a===b)throw new Error('Nœuds animés partagés');b.rotateY(.4);if(a.quaternion.angleTo(new THREE.Quaternion())>1e-7)throw new Error('Rotation partagée');
 if(original.getObjectByName('racine')?.userData.atlasAnimationsBatiment!==true)throw new Error('Opt-in perdu');
 const numpy=JSON.parse(readFileSync(path.join(sortie,'mesures.json'),'utf8')) as {animations:{clips:{nom:string;poses:number;enveloppe:{min:number[];max:number[]};mobile:{nom:string;min:number[];max:number[];probesCles:{t:number;matrice:number[]}[]}}[]}};
 const clips=gltf.animations.map((clip,i)=>{
  const clone=original.clone(true),mixer=new THREE.AnimationMixer(clone),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set(Array.from({length:129},(_,j)=>j/128*clip.duration));clip.tracks.forEach(p=>Array.from(p.times).forEach(t=>instants.add(t)));
  const ref=numpy.animations.clips[i]!,mobile=clone.getObjectByName(ref.mobile.nom)!,mobileMin=[Infinity,Infinity,Infinity],mobileMax=[-Infinity,-Infinity,-Infinity];
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let erreurMatricesMax=0;
  for(const t of [...instants].sort((a,b)=>a-b)){
   mixer.setTime(t);clone.updateMatrixWorld(true);
   mobile.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position');for(let j=0;j<p.count;j++){const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);for(let k=0;k<3;k++){mobileMin[k]=Math.min(mobileMin[k]!,v.getComponent(k));mobileMax[k]=Math.max(mobileMax[k]!,v.getComponent(k));}}});
   const probe=ref.mobile.probesCles.find(p=>p.t===t);if(probe){const actual=mobile.matrixWorld.clone().transpose().elements;erreurMatricesMax=Math.max(erreurMatricesMax,...actual.map((v,k)=>Math.abs(v-probe.matrice[k]!)));}
   clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position');for(let j=0;j<p.count;j++){const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);for(let k=0;k<3;k++){min[k]=Math.min(min[k]!,v.getComponent(k));max[k]=Math.max(max[k]!,v.getComponent(k));}}});
  }
  if(erreurMatricesMax>2e-6||mobileMin.some((v,k)=>Math.abs(v-ref.mobile.min[k]!)>2e-6)||mobileMax.some((v,k)=>Math.abs(v-ref.mobile.max[k]!)>2e-6))throw new Error(`Divergence mobile ${clip.name}`);
  if(ref.nom!==clip.name||ref.poses!==instants.size||min.some((v,k)=>Math.abs(v-ref.enveloppe.min[k]!)>2e-6)||max.some((v,k)=>Math.abs(v-ref.enveloppe.max[k]!)>2e-6))throw new Error(`Divergence native ${clip.name}`);
  mixer.stopAllAction();mixer.uncacheRoot(clone);return {nom:clip.name,poses:instants.size,min,max,mobile:{nom:ref.mobile.nom,min:mobileMin,max:mobileMax,matricesClesComparees:ref.mobile.probesCles.length,erreurMatricesMax}};
 });
 const rapport={id,methode:'GLTFLoader natif, objets clonés et AnimationMixer. Retrait des références de cartes en mémoire seulement, sans modifier le GLB. Parité avec interpolation et transformations NumPy à 2 micromètres.',clonesNoeudsIndependants:true,optInConserve:true,pariteNumpyDeuxMicrometres:true,clips,controleVisuel:false,approbationArtistique:false};
 writeFileSync(path.join(sortie,'mesures-natif-glb.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({chargementNatif:true,poses:clips.reduce((n,c)=>n+c.poses,0),pariteNumpy:true,clonesIndependants:true}));
}
void mesurer();
