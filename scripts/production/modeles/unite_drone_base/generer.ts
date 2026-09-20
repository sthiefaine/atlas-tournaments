/** Drone original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id='unite_drone_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.33,0]},
 base:{parent:'corps',pivot:[0,.395,0]},
 module_antenne:{parent:'corps',pivot:[-.158,.082,-.176]},
 socle:{parent:'corps',pivot:[.112,.104,.185]},
};
function pivotMonde(nom:string):THREE.Vector3{
 const p=poses[nom]!;return new THREE.Vector3(...p.pivot).add(p.parent?pivotMonde(p.parent):new THREE.Vector3());
}
function ajouter(noeud: string, g: THREE.BufferGeometry, role: number, etiquette: string, p: V3=[0,0,0], rotation: V3=[0,0,0]) {
 const uv = g.getAttribute('uv');
 // Atlas 4 × 4 : 16 px de gouttière à 1024, zone échantillonnée intérieure stable.
 for (let i=0;i<uv.count;i++) uv.setXY(i, ((role%4)+.065+uv.getX(i)*.87)/4, (Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 const transformation = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1,1,1));
 g.applyMatrix4(transformation);
 const liste = morceaux.get(noeud) ?? []; liste.push({geometrie:g, role, etiquette}); morceaux.set(noeud,liste);
 bilan[etiquette]=(bilan[etiquette]??0)+(g.index?g.index.count:g.getAttribute('position').count)/3;
}
function boite(noeud: string, taille: V3, p: V3, role: number, etiquette: string, rotation: V3=[0,0,0]) {
 ajouter(noeud,new THREE.BoxGeometry(...taille),role,etiquette,p,rotation);
}
/** Sections octogonales : les grands pans et les chanfreins ont de vraies normales planes. */
function octogone(largeur: number, profondeur: number, coupe: number): [number,number][] {
 const x=largeur/2,z=profondeur/2,c=Math.min(coupe,x*.8,z*.8);
 return [[-x+c,-z],[x-c,-z],[x,-z+c],[x,z-c],[x-c,z],[-x+c,z],[-x,z-c],[-x,-z+c]];
}
function carene(sections: {y:number;largeur:number;profondeur:number;coupe:number;z?:number}[]): THREE.BufferGeometry {
 const positions:number[]=[], uv:number[]=[], indices:number[]=[];
 const anneaux=sections.map(s=>octogone(s.largeur,s.profondeur,s.coupe).map(([x,z])=>new THREE.Vector3(x,s.y,z+(s.z??0))));
 const face=(points:THREE.Vector3[])=>{
  const depart=positions.length/3;
  // Projection sur le plan le plus stable, jamais UV dégénérée sur les chanfreins.
  const normale=new THREE.Vector3().crossVectors(points[1]!.clone().sub(points[0]!),points[2]!.clone().sub(points[0]!)).normalize();
  const axes=Math.abs(normale.y)>=Math.max(Math.abs(normale.x),Math.abs(normale.z))?['x','z'] as const:Math.abs(normale.x)>Math.abs(normale.z)?['z','y'] as const:['x','y'] as const;
  const u=points.map(p=>p[axes[0]]),v=points.map(p=>p[axes[1]]),umin=Math.min(...u),vmin=Math.min(...v),du=Math.max(...u)-umin,dv=Math.max(...v)-vmin;
  points.forEach((p,i)=>{positions.push(p.x,p.y,p.z);uv.push((u[i]!-umin)/du,(v[i]!-vmin)/dv);});
  for(let i=1;i<points.length-1;i++)indices.push(depart,depart+i,depart+i+1);
 };
 // L'anneau est antihoraire dans XZ ; en coordonnées +Y sa face supérieure doit être inversée.
 face(anneaux[0]!);
 for(let j=0;j<anneaux.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;face([anneaux[j]![i]!,anneaux[j+1]![i]!,anneaux[j+1]![k]!,anneaux[j]![k]!]);}
 face([...anneaux.at(-1)!].reverse());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function panneau(noeud: string, taille: V3, p: V3, role: number, etiquette: string, rotation: V3=[0,0,0], chanfrein=.007) {
 const [l,h,d]=taille,b=Math.min(chanfrein,h*.28);
 const g=carene([{y:-h/2,largeur:l-b*2,profondeur:d-b*2,coupe:chanfrein},{y:-h/2+b,largeur:l,profondeur:d,coupe:chanfrein},{y:h/2-b,largeur:l,profondeur:d,coupe:chanfrein},{y:h/2,largeur:l-b*2,profondeur:d-b*2,coupe:chanfrein}]);
 ajouter(noeud,g,role,etiquette,p,rotation);
}
function cylindre(noeud: string, rayon: number, hauteur: number, p: V3, role: number, etiquette: string, rotation: V3=[0,0,0], n=16, rayonHaut=rayon) {
 ajouter(noeud,new THREE.CylinderGeometry(rayonHaut,rayon,hauteur,n,1,false),role,etiquette,p,rotation);
}
/** Liaison pleine épaisse entre deux points ; aucune aiguille sous 2 cm. */
function liaison(noeud:string,a:V3,b:V3,rayon:number,role:number,etiquette:string,n=8){
 const debut=new THREE.Vector3(...a),fin=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(rayon,rayon,debut.distanceTo(fin),n,1,false);
 g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),fin.clone().sub(debut).normalize()));
 ajouter(noeud,g,role,etiquette,debut.add(fin).multiplyScalar(.5).toArray() as V3);
}
// Plateau polygonal très court : aucune queue d’hélicoptère, aucune cabine habitée.
panneau('corps',[.422,.058,.460],[0,.307,0],1,'plateau_porteur',[0,0,0],.018);
panneau('corps',[.397,.023,.429],[0,.348,0],0,'capot_plateau',[0,0,0],.012);
// Deux batteries latérales, coulisseaux et prise de maintenance arrière.
for(const cote of [-1,1]){
 panneau('corps',[.079,.064,.270],[cote*.166,.385,-.035],0,'batteries_laterales',[0,0,0],.010);
 boite('corps',[.074,.011,.028],[cote*.166,.423,-.11],3,'verrous_batteries');
 boite('corps',[.074,.011,.028],[cote*.166,.423,.056],3,'verrous_batteries');
 boite('corps',[.016,.036,.114],[cote*.210,.322,-.036],6,'grilles_laterales');
 for(let k=0;k<4;k++)boite('corps',[.008,.035,.014],[cote*.221,.322,-.075+k*.026],3,'ailettes_echangeur');
}
panneau('corps',[.128,.041,.034],[0,.342,-.247],1,'prise_arriere',[0,0,0],.004);
// Nacelle avancée surélevée : carter opaque sans cockpit et œil optique encastré.
ajouter('corps',carene([
 {y:.345,largeur:.214,profondeur:.209,coupe:.035,z:.157},
 {y:.405,largeur:.233,profondeur:.202,coupe:.031,z:.170},
 {y:.490,largeur:.190,profondeur:.143,coupe:.028,z:.135},
 {y:.511,largeur:.146,profondeur:.114,coupe:.024,z:.120},
]),0,'nacelle_capteur');
panneau('corps',[.173,.018,.114],[0,.518,.124],5,'couvercle_nacelle',[0,0,0],.004);
// Optique à axe horizontal +Z : couronne métal, joint caoutchouc et verre bleuté uni.
cylindre('corps',.061,.031,[0,.425,.271],3,'couronne_optique',[Math.PI/2,0,0],24);
cylindre('corps',.052,.035,[0,.425,.288],2,'joint_optique',[Math.PI/2,0,0],24);
cylindre('corps',.043,.012,[0,.425,.310],4,'lentille_optique',[Math.PI/2,0,0],24);
// Petits capteurs stéréo réellement en relief, sans textures de reflet.
for(const x of [-.077,.077]){
 cylindre('corps',.016,.024,[x,.387,.278],1,'capteurs_stereo',[Math.PI/2,0,0],10);
 cylindre('corps',.012,.006,[x,.387,.293],4,'verres_stereo',[Math.PI/2,0,0],10);
}
// Atterrisseur : patins moulés aux extrémités relevées, quatre jambes et traverses.
for(const cote of [-1,1]){
 const x=cote*.191;
 const chemin=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.131,-.283),new THREE.Vector3(x,.103,-.247),new THREE.Vector3(x,.103,.226),new THREE.Vector3(x,.143,.280)]);
 ajouter('corps',new THREE.TubeGeometry(chemin,12,.014,6,false),2,'patins_landing');
 for(const z of [-.141,.140])liaison('corps',[cote*.135,.287,z],[x,.119,z],.015,3,'jambes_aterrissage',8);
}
for(const z of [-.141,.140])liaison('corps',[-.191,.123,z],[.191,.123,z],.012,1,'traverses_train',8);
// Moteur central et mât. Cinq ailettes et le collier apportent du relief mécanique.
cylindre('corps',.078,.042,[0,.389,-.018],1,'assise_moteur',[0,0,0],20);
cylindre('corps',.058,.113,[0,.465,-.018],5,'moteur_rotor',[0,0,0],20);
for(let k=0;k<4;k++)cylindre('corps',.068,.012,[0,.426+k*.026,-.018],3,'ailettes_moteur',[0,0,0],20);
cylindre('corps',.024,.196,[0,.623,0],3,'mat_rotor',[0,0,0],16);
cylindre('corps',.040,.027,[0,.534,-.005],1,'palier_inferieur',[0,0,0],16);
// Rotor quadripale sculpté en sections : pales épaisses, bords biseautés et extrémités arrondies.
function pale():THREE.BufferGeometry{
 const sections=[{r:.053,chord:.064,y:0,h:.012},{r:.112,chord:.071,y:.003,h:.015},{r:.302,chord:.060,y:.008,h:.012},{r:.425,chord:.051,y:.011,h:.010},{r:.448,chord:.032,y:.013,h:.007}];
 const g=carene(sections.map(s=>({y:s.r,largeur:s.chord,profondeur:s.h,coupe:.002,z:s.y})));
 // local section axis +Y becomes radial +X ; depth becomes +Y, width becomes +Z.
 const m=new THREE.Matrix4().set(0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1);g.applyMatrix4(m);return g;
}
for(let k=0;k<4;k++){
 const a=k*Math.PI/2;
 ajouter('base',pale(),5,'pales_composites',[0,.725,0],[0,a,0]);
 const p=new THREE.Vector3(.084,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),a);
 cylindre('base',.021,.029,[p.x,.729,p.z],3,'attaches_pales',[0,0,0],10);
}
cylindre('base',.055,.028,[0,.725,0],3,'moyeu_quadripale',[0,0,0],20);
cylindre('base',.036,.026,[0,.744,0],1,'capuchon_moyeu',[0,0,0],16,.025);
// Fouet court sur ressort épais : sa hauteur reste sous le plan des pales.
const antenne=pivotMonde('module_antenne');
cylindre('corps',.029,.023,[antenne.x,.406,antenne.z],1,'embase_antenne',[0,0,0],12);
const spires:THREE.Vector3[]=[];
for(let k=0;k<=48;k++){
 const a=k/48*Math.PI*4;spires.push(new THREE.Vector3(antenne.x+.017*Math.cos(a),.423+k/48*.048,antenne.z+.017*Math.sin(a)));
}
ajouter('module_antenne',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spires),32,.0105,5,false),3,'ressort_deux_tours');
boite('module_antenne',[.044,.017,.043],[antenne.x,.482,antenne.z],3,'chapeau_ressort');
liaison('module_antenne',[antenne.x,.484,antenne.z],[antenne.x-.012,.650,antenne.z-.013],.011,1,'fouet_epais',8);
cylindre('module_antenne',.013,.023,[antenne.x-.012,.651,antenne.z-.013],5,'embout_fouet',[0,0,0],8);
// Témoin ambré indépendant, masqué quand le drone se pose hors jeu.
boite('socle',[.037,.021,.024],pivotMonde('socle').toArray() as V3,7,'temoin_disponibilite');
const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const ps=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(ps.length){
  const groupes:THREE.BufferGeometry[]=[],mats:number[]=[];
  for(const mat of [0,1]){
   const gs=ps.filter(p=>(p.role===0?0:1)===mat).map(p=>{
    const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone(),pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;
   });
   if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-6);g.computeTangents();groupes.push(g);mats.push(mat);}
  }
  const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mats[i]!);objet=new THREE.Mesh(g,materiaux);
 }else objet=new THREE.Group();
 objet.name=nom;objet.position.set(...pose.pivot);objets.set(nom,objet);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const bornes=new THREE.Box3().setFromObject(racine),dimensions=bornes.getSize(new THREE.Vector3());
const quat=(r:V3)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray();
const rotation=(nom:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(quat));
const position=(nom:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(p=>p.map((v,i)=>v+poses[nom]!.pivot[i]!)));
function rotor(duree:number,tours:number,arret=false){
 const nb=tours*8,t:number[]=[],q:number[]=[];
 for(let k=0;k<=nb;k++){
  t.push(k/nb*(arret?duree*.66:duree));
  q.push(...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),k/nb*Math.PI*2*tours).toArray());
 }
 // Quaternion identité exact aux jonctions de boucle, q et -q représentent la même pose.
 q.splice(q.length-4,4,0,0,0,1);
 if(arret){t.push(duree);q.push(0,0,0,1);}
 return new THREE.QuaternionKeyframeTrack('base.quaternion',t,q);
}
// Pose d’atterrissage : contact calculé sur les sommets du train, pas sur le pivot.
objets.get('corps')!.rotation.set(.017,0,-.018);
objets.get('module_antenne')!.rotation.set(.25,0,.05);
racine.updateMatrixWorld(true);
let minimumAtterrissage=Infinity;
racine.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);minimumAtterrissage=Math.min(minimumAtterrissage,v.y);}});
const abaissement=.003-minimumAtterrissage;
objets.get('corps')!.quaternion.identity();objets.get('module_antenne')!.quaternion.identity();racine.updateMatrixWorld(true);
const clips=[
 new THREE.AnimationClip('repos',2.4,[rotor(2.4,8),position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.010,0],[0,0,0],[0,-.006,0],[0,0,0]]),rotation('module_antenne',[0,.6,1.2,1.8,2.4],[[0,0,0],[.018,0,.014],[0,0,0],[-.018,0,-.014],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[rotor(1,4),position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.008,0],[0,0,0],[0,.004,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[.026,0,0],[.026,0,.015],[.026,0,0],[.026,0,-.015],[.026,0,0]]),rotation('module_antenne',[0,.25,.5,.75,1],[[.04,0,0],[.04,0,.018],[.04,0,0],[.04,0,-.018],[.04,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotor(.5,2),rotation('corps',[0,.1,.25,.5],[[0,0,0],[.027,0,.038],[-.012,0,-.018],[0,0,0]]),rotation('module_antenne',[0,.10,.25,.5],[[0,0,0],[.07,0,-.085],[-.03,0,.04],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[rotor(.9,2,true),position('corps',[0,.60,.9],[[0,0,0],[0,abaissement,0],[0,abaissement,0]]),rotation('corps',[0,.60,.9],[[0,0,0],[.017,0,-.018],[.017,0,-.018]]),rotation('module_antenne',[0,.60,.9],[[0,0,0],[.25,0,.05],[.25,0,.05]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
function reset(){for(const [nom,o] of objets){o.position.set(...poses[nom]!.pivot);o.quaternion.identity();o.scale.set(1,1,1);}racine.updateMatrixWorld(true);}
function mesurer(){
 racine.updateMatrixWorld(true);const b=new THREE.Box3();let r=0;
 racine.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);b.expandByPoint(v);r=Math.max(r,Math.hypot(v.x,v.z));}});
 return {min:b.min.toArray(),max:b.max.toArray(),rayon:r};
}
function mouvements(){
 const resultats=clips.map(clip=>{
  reset();const mixer=new THREE.AnimationMixer(racine),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set<number>(Array.from({length:193},(_,i)=>i/192*clip.duration));clip.tracks.forEach(tr=>Array.from(tr.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let rayon=0;
  for(const t of [...instants].sort((a,b)=>a-b)){mixer.setTime(t);const m=mesurer();for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,m.min[a]!);max[a]=Math.max(max[a]!,m.max[a]!);}rayon=Math.max(rayon,m.rayon);}
  mixer.stopAllAction();mixer.uncacheRoot(racine);return {nom:clip.name,nombreEchantillons:instants.size,enveloppe:{min,max},rayonHorizontalMax:rayon};
 });reset();
 return {id,methode:'Sommets transformés Three.js, 193 instants par clip et clés exactes.',clips:resultats,limites:['Échantillonnage numérique, sans contrôle visuel.','Aucun certificat de collision interne ni de mélanges entre clips.']};
}
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const mesures=mouvements();
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.6};}
 document.asset={version:'2.0',generator:'Atlas Tournament — drone original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>3500)throw new Error(`Budget dépassé : ${triangles} ${JSON.stringify(bilan)}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_drone_base/generer.ts',sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:3500,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,rotor:{pales:4,rayonMax:.45,noeud:'base',axe:'+Y',animationGLB:true},limites:['Pas de rendu ni contrôle visuel.','Patins rigides ; mouvement porté par corps.','Fouet animé par rotation de son pied, sans peau souple.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
