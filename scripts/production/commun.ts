/** Fabrication de candidats techniques ; aucune approbation artistique implicite. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { encoderPng, creerImage } from '../../src/render/apercu/png';
import { nomModele, nomTexture, type AssetSpec } from '../../src/assets/spec';
import { contratProduction } from '../../src/assets/production';
import { controlerDepot } from '../../src/serveur/depot-modeles';
import { exporterGlb, decouperGlb, assemblerGlb } from '../infanterie/gltf';
import { encoderPngAlpha, alphaFeuillage } from './png-alpha';
import { pixelTerrain } from './textures-terrain';
export interface Morceau { geometrie: THREE.BufferGeometry; noeud: string; role?: number }
export interface OptionsCandidat { palette?: [number,number,number][]; terrain?: boolean; feuillageAlpha?: boolean; emissionVitrage?: boolean; portrait?: boolean; reference?: Morceau[] }
export const VERSION_CANDIDAT = 2;
export interface RapportCandidat { id:string; ok:boolean; motifs:unknown[]; fichiers:string[]; conserve?:boolean }
const PALETTE:[number,number,number][]=[[150,150,150],[47,49,50],[105,112,119],[44,79,91],[103,109,99],[181,138,107],[80,113,58],[117,86,54]];
/** Huit bandes UV avec gouttières : attribution stable entre LOD et kits. */
function uvRole(g:THREE.BufferGeometry,role:number,portrait=false):void {
 const uv=g.getAttribute('uv');
 for(let i=0;i<uv.count;i++)uv.setXY(i,portrait?(role===5?.02+uv.getX(i)*.46:.5+(role+.08+uv.getX(i)*.84)/16):(role+.08+uv.getX(i)*.84)/8,.02+uv.getY(i)*.96);
}
const CACHE_TEXTURES=new Map<string,Uint8Array[]>();
function textures(spec:AssetSpec,opt:OptionsCandidat):Map<string,Uint8Array>{
 const out=new Map<string,Uint8Array>();const palette=opt.palette??PALETTE;
 const caduc=!!opt.feuillageAlpha&&!/sapin|épicéa|pin |pins |palm|cocot|dattier/i.test(spec.description.fr);
 const cle=JSON.stringify([spec.textures.map(t=>[t.canal,t.resolution]),spec.variantes.saisons,palette,opt.terrain??false,opt.feuillageAlpha??false,opt.emissionVitrage??false,opt.portrait??false,opt.terrain?spec.cle:null,caduc]);
 const noms=spec.textures.flatMap(t=>[undefined,...spec.variantes.saisons].map(s=>nomTexture(spec,t.canal,s)));
 const cache=CACHE_TEXTURES.get(cle);if(cache)return new Map(noms.map((n,i)=>[n,cache[i]!]));
 for(const t of spec.textures)for(const saison of [undefined,...spec.variantes.saisons]){
  const n=t.resolution,img=creerImage(n,n,[0,0,0]);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const role=opt.terrain?6:opt.portrait?(x<n/2?5:Math.min(7,Math.floor((x/n-.5)*16))):Math.min(7,Math.floor(x*8/n)),bord=x<3||y<3||x>=n-3||y>=n-3;
   const equipe=role===0&&!opt.terrain;const grain=((x*13+y*7+(x*y)%17)%7)-3;
   let rgb:number[];
   if(t.canal==='albedo') {const base=palette[role]??palette[0]!;rgb=base.map(v=>Math.max(0,Math.min(255,v+(bord&&opt.terrain?0:grain))));if(equipe)rgb=[150+grain,150+grain,150+grain];if(opt.feuillageAlpha&&role===4&&saison==='printemps')rgb=[rgb[0]!+5,Math.min(255,rgb[1]!+13),rgb[2]!+3];if(caduc&&role===4&&saison==='automne')rgb=[166+grain,111+grain,47+grain];if(saison==='hiver'&&!equipe)rgb=rgb.map(v=>Math.round(v*.7+63));}
   else if(t.canal==='normale')rgb=opt.terrain&&bord?[128,128,255]:[128+(x%11===0?2:0),128+(y%13===0?2:0),255];
   else if(t.canal==='masque_equipe')rgb=equipe?[255,255,255]:[0,0,0];
   else if(t.canal==='rugosite')rgb=[255,role===3?75:role===2?120:opt.portrait&&role===5?165:205,role===2?210:0];
   else if(t.canal==='metal')rgb=role===2?[210,210,210]:[0,0,0];
   else if(t.canal==='occlusion')rgb=[255,255,255];
   else if(t.canal==='emission'&&opt.emissionVitrage&&role===3)rgb=[255,190,96];
   else rgb=[0,0,0];
   if(opt.terrain&&bord){if(t.canal==='albedo')rgb=palette[6]??palette[0]!;if(t.canal==='rugosite')rgb=[255,205,0];if(t.canal==='metal')rgb=[0,0,0];}
   if(opt.terrain)rgb=pixelTerrain(spec.cle,t.canal,x,y,n,saison,rgb);
   const i=(y*n+x)*3;img.pixels[i]=rgb[0]!;img.pixels[i+1]=rgb[1]!;img.pixels[i+2]=rgb[2]!;
  }
  out.set(nomTexture(spec,t.canal,saison),t.canal==='albedo'&&opt.feuillageAlpha?encoderPngAlpha(img,(x,y)=>alphaFeuillage(x,y,n)):encoderPng(img));
 }
 const valeur=[...out.values()];
 const octets=()=>[...CACHE_TEXTURES.values()].reduce((s,images)=>s+images.reduce((n,b)=>n+b.byteLength,0),0);
 while(CACHE_TEXTURES.size>=4 || (CACHE_TEXTURES.size>0 && octets()+valeur.reduce((n,b)=>n+b.byteLength,0)>128*1048576))CACHE_TEXTURES.delete(CACHE_TEXTURES.keys().next().value!);
 if(valeur.reduce((n,b)=>n+b.byteLength,0)<=128*1048576)CACHE_TEXTURES.set(cle,valeur);
 return out;
}
/** Construit chaque articulation à son pivot ; la géométrie reste à sa place au repos. */
export function sceneCandidate(spec:AssetSpec,morceaux:Morceau[],opt:OptionsCandidat):THREE.Object3D {
 const reference=opt.reference??morceaux;
 const total=new THREE.Box3();for(const p of reference){p.geometrie.computeBoundingBox();total.union(p.geometrie.boundingBox!);}
 const taille=total.getSize(new THREE.Vector3()),centre=total.getCenter(new THREE.Vector3());
 const matrice=new THREE.Matrix4().makeScale(spec.echelle.x.cible/Math.max(.001,taille.x),spec.echelle.y.cible/Math.max(.001,taille.y),spec.echelle.z.cible/Math.max(.001,taille.z));
 matrice.multiply(new THREE.Matrix4().makeTranslation(-centre.x,-total.min.y,-centre.z));
 const mats=spec.format.materiauxAttendus.map(name=>{const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:1});m.name=name;return m;});
 const contrat=contratProduction(spec);
 const parents=new Map<string,string|null>();const pivots=new Map<string,THREE.Vector3>();
 for(const nom of spec.format.noeuds){
   const articulation=contrat.assemblage.find(a=>a.nom===nom);
   parents.set(nom,articulation?.parent??(nom===spec.format.noeudRacine?null:opt.portrait&&nom==='tete'?'buste':nom==='module_canon_long'&&spec.format.noeuds.includes('module_tourelle')?'module_tourelle':nom.startsWith('module_')&&spec.format.noeuds.includes('corps')?'corps':spec.format.noeudRacine));
   if(articulation?.pivot)pivots.set(nom,new THREE.Vector3(...articulation.pivot));
 }
 const monde=new Map<string,THREE.Vector3>();
 const pivotMonde=(nom:string):THREE.Vector3=>{
   const connu=monde.get(nom);if(connu)return connu;
   const parent=parents.get(nom);const parentMonde=parent?pivotMonde(parent):new THREE.Vector3();
   const local=pivots.get(nom);let position:THREE.Vector3;
   if(local)position=parentMonde.clone().add(local);
   else if(nom==='corps'||nom==='buste'||nom==='tete'||nom.startsWith('module_')){
     const premier=reference.find(p=>p.noeud===nom);position=premier?.geometrie.boundingBox?.getCenter(new THREE.Vector3()).applyMatrix4(matrice)??parentMonde.clone();
   }else position=parentMonde.clone();
   monde.set(nom,position);return position;
 };
 const objets=new Map<string,THREE.Object3D>();
 for(const nom of spec.format.noeuds){
  const pieces=morceaux.filter(p=>p.noeud===nom);let o:THREE.Object3D;const pivot=pivotMonde(nom);
  if(pieces.length){const gs=pieces.map(p=>{let g=p.geometrie.clone();if(g.index){const indexee=g;g=g.toNonIndexed();indexee.dispose();}g.applyMatrix4(matrice);g.translate(-pivot.x,-pivot.y,-pivot.z);if(!opt.terrain)uvRole(g,p.role??0,opt.portrait);return g;});const g=mergeGeometries(gs,true)!;gs.forEach(g=>g.dispose());g.groups.forEach((gr,i)=>gr.materialIndex=opt.portrait?(pieces[i]!.role===5||pieces[i]!.role===3?0:pieces[i]!.role===7?2:1):nom.includes('tronc')||(pieces[i]!.role??0)===0?0:Math.min(1,mats.length-1));o=new THREE.Mesh(g,mats);}
  else o=new THREE.Group();o.name=nom;objets.set(nom,o);
 }
 const racine=objets.get(spec.format.noeudRacine)!;
 for(const [nom,o]of objets){const parent=parents.get(nom);if(parent){objets.get(parent)!.add(o);o.position.copy(pivotMonde(nom)).sub(pivotMonde(parent));}}
 racine.updateMatrixWorld(true);return racine;
}
export function animationsCandidates(spec:AssetSpec,racine:THREE.Object3D):THREE.AnimationClip[]{
 const cible=spec.format.noeuds.includes('corps')?'corps':spec.format.noeuds.find(n=>n!=='racine')!;
 return spec.animations.map(a=>{
  const d=a.dureeMs/1000,slump=a.nom==='hors_jeu';
  const r=slump?.11:a.nom==='tir'?.05:a.nom==='touche'?.07:.012;
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(r,0,0));
  const tracks:THREE.KeyframeTrack[]=[new THREE.QuaternionKeyframeTrack(`${cible}.quaternion`,[0,d*.4,d],[0,0,0,1,q.x,q.y,q.z,q.w,...(slump?[q.x,q.y,q.z,q.w]:[0,0,0,1])])];
  for(const nom of spec.format.noeuds.filter(n=>n.startsWith('module_'))){
    const objet=racine.getObjectByName(nom);if(!(objet instanceof THREE.Mesh))continue;
    if(a.nom==='repos'&&/radar|tourelle/.test(nom)){
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),nom.includes('radar')?.28:.08);
      tracks.push(new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,[0,d/2,d],[0,0,0,1,q.x,q.y,q.z,q.w,0,0,0,1]));
    }else if((a.nom==='tir'&&/canon|tourelle|roquettes/.test(nom))||slump){
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),slump?.2:.045);
      tracks.push(new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,[0,d*.4,d],[0,0,0,1,q.x,q.y,q.z,q.w,...(slump?[q.x,q.y,q.z,q.w]:[0,0,0,1])]));
    }
  }
  // Seul un indicateur explicitement déclaré peut disparaître ; jamais le support ou les bêches.
  if(slump&&contratProduction(spec).assemblage.some(n=>n.nom==='socle'&&n.role.includes('Readiness indicator')))tracks.push(new THREE.VectorKeyframeTrack('socle.scale',[0,d],[1,1,1,0,0,0]));
  return new THREE.AnimationClip(a.nom,d,tracks);
 });
}
export async function ecrireCandidat(spec:AssetSpec,sortie:string,construire:(lod:number)=>Morceau[],opt:OptionsCandidat={}):Promise<RapportCandidat>{
 if(existsSync(path.join(sortie,nomModele(spec,0)))){
  const noms=readdirSync(sortie).filter(n=>/\.(glb|png)$/.test(n));
  const verdict=controlerDepot(spec,noms.map(nom=>({nom,octets:new Uint8Array(readFileSync(path.join(sortie,nom)))})));
  let version=0,optionsConformes=false;try{const meta=JSON.parse(readFileSync(path.join(sortie,'version-candidat.json'),'utf8'));version=meta.version;optionsConformes=!!meta.feuillageAlpha===!!opt.feuillageAlpha&&!!meta.emissionVitrage===!!opt.emissionVitrage&&!!meta.portrait===!!opt.portrait;}catch{/* Ancien lot : ne pas prétendre à la nouvelle fabrication. */}
  return {id:spec.id,ok:verdict.ok&&version===VERSION_CANDIDAT&&optionsConformes,motifs:[...verdict.motifs,...((version!==VERSION_CANDIDAT||!optionsConformes)?[{code:'generateur_perime',detail:'Archiver ce candidat avant de le régénérer avec la version courante.'}]:[])],fichiers:noms,conserve:true};
 }
 mkdirSync(sortie,{recursive:true});const fichiers=textures(spec,opt);const reference=construire(0);
 for(const lod of spec.verification.lodRequis){const morceaux=construire(lod);const racine=sceneCandidate(spec,morceaux,{...opt,reference});morceaux.forEach(p=>p.geometrie.dispose());const b=await exporterGlb(racine,animationsCandidates(spec,racine));const {document,bin}=decouperGlb(b);const canaux=spec.textures.map(t=>t.canal);document.images=canaux.map(c=>({name:c,uri:nomTexture(spec,c),mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:opt.terrain?10497:33071,wrapT:opt.terrain?10497:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name?:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;occlusionTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[];alphaMode?:string;alphaCutoff?:number;doubleSided?:boolean}[]){const p=m.pbrMetallicRoughness;p.baseColorTexture={index:canaux.indexOf('albedo')};if(canaux.includes('rugosite'))p.metallicRoughnessTexture={index:canaux.indexOf('rugosite')};if(canaux.includes('normale'))m.normalTexture={index:canaux.indexOf('normale')};if(canaux.includes('occlusion'))m.occlusionTexture={index:canaux.indexOf('occlusion')};if(opt.feuillageAlpha&&m.name==='mat_feuillage'){m.alphaMode='MASK';m.alphaCutoff=.5;m.doubleSided=true;}if(opt.emissionVitrage&&canaux.includes('emission')){m.emissiveTexture={index:canaux.indexOf('emission')};m.emissiveFactor=[1,1,1];}}
 fichiers.set(nomModele(spec,lod),assemblerGlb(document,bin));racine.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
 }
 reference.forEach(p=>p.geometrie.dispose());
 const verdict=controlerDepot(spec,[...fichiers].map(([nom,octets])=>({nom,octets})));
 // Les candidats refusés ne sont pas présentés comme livraisons utilisables.
 if(!verdict.ok)return {id:spec.id,ok:false,motifs:verdict.motifs,fichiers:[]};
 for(const[nom,b]of fichiers)writeFileSync(path.join(sortie,nom),b,{flag:'wx'});
 writeFileSync(path.join(sortie,'version-candidat.json'),JSON.stringify({version:VERSION_CANDIDAT,validationArtistique:'non_effectuee',...(opt.feuillageAlpha?{feuillageAlpha:true}:{}),...(opt.emissionVitrage?{emissionVitrage:true}:{}),...(opt.portrait?{portrait:true}:{})})+'\n');
 return {id:spec.id,ok:true,motifs:[],fichiers:[...fichiers.keys()]};
}
