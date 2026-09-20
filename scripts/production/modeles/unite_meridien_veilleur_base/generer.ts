/** Veilleur électronique original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string; os: number };
const id='unite_meridien_veilleur_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
let osCourant=0;
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.25,0]},
 base:{parent:'corps',pivot:[0,0,0]},
 module_radar:{parent:'corps',pivot:[0,.245,0]},
 module_antenne:{parent:'corps',pivot:[-.20,.059,.23]},
 socle:{parent:'corps',pivot:[0,.026,.285]},
 os_rotor_gauche:{parent:'corps',pivot:[-.20,.15,-.20]},
 os_rotor_droit:{parent:'corps',pivot:[.20,.15,.20]},
};
function pivotMonde(nom:string):THREE.Vector3{
 const p=poses[nom]!;return new THREE.Vector3(...p.pivot).add(p.parent?pivotMonde(p.parent):new THREE.Vector3());
}
function ajouter(noeud: string, g: THREE.BufferGeometry, role: number, etiquette: string, p: V3=[0,0,0], rotation: V3=[0,0,0]) {
 // LatheGeometry émet deux triangles nuls par segment à ses pôles fermés.
 // Ne conserver que les faces de surface, avant fusion et calcul des tangentes.
 if(g.index){
  const points=g.getAttribute('position'),ix=g.index,valides:number[]=[];
  for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);const v=new THREE.Vector3().fromBufferAttribute(points,a),u=new THREE.Vector3().fromBufferAttribute(points,b).sub(v),w=new THREE.Vector3().fromBufferAttribute(points,c).sub(v);if(u.cross(w).lengthSq()>1e-20)valides.push(a,b,c);}
  g.setIndex(valides);
 }

 const uv = g.getAttribute('uv');
 // Atlas 4 × 4 : 16 px de gouttière à 1024, zone échantillonnée intérieure stable.
 for (let i=0;i<uv.count;i++) uv.setXY(i, ((role%4)+.065+uv.getX(i)*.87)/4, (Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 const transformation = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1,1,1));
 g.applyMatrix4(transformation);
 const liste = morceaux.get(noeud) ?? []; liste.push({geometrie:g, role, etiquette, os:osCourant}); morceaux.set(noeud,liste);
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
function ellipsoide(noeud:string,rayons:V3,p:V3,role:number,etiquette:string,n=20,m=12){
 const g=new THREE.SphereGeometry(1,n,m);g.scale(...rayons);ajouter(noeud,g,role,etiquette,p);
}
function courbeTube(noeud:string,pts:V3[],r:number,role:number,etiquette:string,segments=16,n=6){
 const courbe=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
 ajouter(noeud,new THREE.TubeGeometry(courbe,segments,r,n,false),role,etiquette);
}

function tige(noeud:string,a:V3,b:V3,r:number,role:number,etiquette:string,n=10){
 const debut=new THREE.Vector3(...a),fin=new THREE.Vector3(...b),dir=fin.clone().sub(debut);
 const g=new THREE.CylinderGeometry(r,r,dir.length(),n,1,false);
 g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
 ajouter(noeud,g,role,etiquette,debut.add(fin).multiplyScalar(.5).toArray() as V3);
}
// Nacelle courte en capsule. Épaules lisses ; panneaux de service rapportés en vrai volume.
ellipsoide('corps',[.132,.087,.207],[0,.263,.06],5,'capsule_arrondie',28,14);
panneau('corps',[.187,.033,.228],[0,.343,.062],0,'capot_equipe',[0,0,0],.021);
for(const s of [-1,1]){
 panneau('corps',[.024,.083,.186],[s*.126,.274,.068],0,'flancs_equipe',[0,0,0],.008);
 panneau('corps',[.008,.042,.084],[s*.141,.263,.053],6,'grilles_laterales',[0,0,0],.003);
 for(let k=0;k<4;k++)boite('corps',[.012,.034,.006],[s*.145,.263,.023+k*.020],3,'lames_grilles');
 cylindre('corps',.013,.014,[s*.078,.367,.113],3,'loquets_capot',[0,0,0],8);
}
// Une optique fermée, en avant : aucune bouche de tube ou arme.
panneau('corps',[.104,.054,.039],[0,.278,.247],1,'cadre_optique',[.10,0,0],.011);
panneau('corps',[.071,.032,.016],[0,.280,.271],4,'verre_optique',[.10,0,0],.006);
boite('socle',[.036,.019,.012],pivotMonde('socle').toArray() as V3,7,'temoin_veille');
panneau('corps',[.102,.052,.032],[0,.258,-.139],1,'connectique_arriere',[0,0,0],.008);
for(const x of [-.023,.023])cylindre('corps',.013,.009,[x,.263,-.159],3,'prises_obturees',[Math.PI/2,0,0],10);
// Deux rotors diagonaux : les disques restent indépendants ; quatre pales par rotor.
for(const [i,s] of [-1,1].entries()){
 const x=s*.20,z=s*.20,nom=s<0?'gauche':'droit';
 tige('corps',[s*.058,.284,s*.059],[x,.348,z],.024,5,`bras_porteur_${nom}`,12);
 tige('corps',[s*.062,.228,s*.055],[x,.325,z],.012,3,`hauban_${nom}`,10);
 cylindre('corps',.043,.043,[x,.347,z],1,`nacelle_moteur_${nom}`,[0,0,0],16,.038);
 cylindre('corps',.033,.020,[x,.379,z],3,`col_moteur_${nom}`,[0,0,0],16);
 cylindre('corps',.014,.035,[x,.394,z],3,`axe_moteur_${nom}`,[0,0,0],12);
 // Les pales et le moyeu seuls sont pondérés à l'os, et suivent son pivot propre.
 osCourant=i;
 cylindre('base',.049,.024,[x,.403,z],3,`moyeu_${nom}`,[0,0,0],16,.035);
 cylindre('base',.024,.031,[x,.418,z],1,`chapeau_rotor_${nom}`,[0,0,0],12,.014);
 for(let k=0;k<4;k++){
  const angle=k*Math.PI/2;
  const g=carene([{y:-.007,largeur:.038,profondeur:.180,coupe:.009},{y:.007,largeur:.038,profondeur:.180,coupe:.009}]);
  g.translate(.007,0,.120);g.rotateY(angle);
  ajouter('base',g,2,`pales_${nom}`,[x,.4,z]);
  // Extrémité grise contrastée, couche en relief au dessus de la pale.
  const tip=carene([{y:0,largeur:.021,profondeur:.018,coupe:.006},{y:.003,largeur:.021,profondeur:.018,coupe:.006}]);
  tip.translate(.007,.007,.196);tip.rotateY(angle);ajouter('base',tip,5,`embouts_${nom}`,[x,.4,z]);
 }
}
// Deux vrais patins continus. Position neutre à 35 mm au-dessus du sol pour le vol.
for(const s of [-1,1]){
 panneau('corps',[.035,.028,.479],[s*.145,.049,.012],2,'patins_atterrissage',[0,0,0],.009);
 for(const z of [-.117,.153]){
  tige('corps',[s*.112,.212,z],[s*.145,.064,z],.012,3,'montants_patins',10);
  cylindre('corps',.019,.027,[s*.125,.170,z],1,'manchons_train',[0,0,Math.PI/2],10);
 }
}
// Pivot radar central dans l'espace entre les deux disques. Le bras supérieur le
// déporte vers l'arrière ; le radar devient un second volume distinct de la nacelle.
cylindre('corps',.029,.122,[0,.414,0],3,'mat_radar',[0,0,0],16);
cylindre('corps',.044,.035,[0,.356,0],1,'embase_mat_radar',[0,0,0],16);
cylindre('corps',.033,.044,[0,.491,0],1,'palier_fixe_radar',[0,0,Math.PI/2],16);
tige('module_radar',[0,.494,0],[0,.535,-.104],.020,3,'bras_pliant_radar',12);
cylindre('module_radar',.028,.046,[0,.542,-.110],3,'moyeu_disque_radar',[0,0,0],16);
// Radôme large lenticulaire, fermé, construit par révolution ; pas de parabole creuse
// ni d'effet de lumière peint. Taille de 294 mm, profil nettement séparé des rotors.
const profilRadome=[new THREE.Vector2(0,-.014),new THREE.Vector2(.110,-.014),new THREE.Vector2(.145,-.008),new THREE.Vector2(.147,.004),new THREE.Vector2(.118,.017),new THREE.Vector2(.065,.024),new THREE.Vector2(0,.027)];
ajouter('module_radar',new THREE.LatheGeometry(profilRadome,32),5,'radome',[0,.554,-.11]);
// Anneau technique et deux plaques au sommet donnent une lecture de disque.
ajouter('module_radar',new THREE.TorusGeometry(.119,.004,6,32).rotateX(Math.PI/2),3,'jonc_radome',[0,.572,-.11]);
for(const s of [-1,1])panneau('module_radar',[.052,.007,.029],[s*.069,.578,-.11],0,'panneaux_equipe_radar',[0,0,0],.005);
// Antenne hors du volume balayé par le radar. Ressort réel à trois spires espacées.
tige('corps',[-.105,.269,.16],[-.20,.303,.23],.016,5,'console_antenne',10);
cylindre('corps',.027,.019,[-.20,.304,.23],1,'embase_antenne',[0,0,0],12);
const ap=pivotMonde('module_antenne');
cylindre('module_antenne',.006,.065,[ap.x,ap.y+.0325,ap.z],2,'ame_ressort',[0,0,0],10);
const pts:V3[]=[];for(let i=0;i<=72;i++){const a=i/72*Math.PI*6;pts.push([ap.x+Math.cos(a)*.018,ap.y+.005+i/72*.046,ap.z+Math.sin(a)*.018]);}
courbeTube('module_antenne',pts,.004,11,'ressort_antenne',72,6);
cylindre('module_antenne',.014,.012,[ap.x,ap.y+.061,ap.z],3,'collier_fouet',[0,0,0],12);
// Fouet épais à l'échelle figurine : diamètre >=20 mm, embout non pointu.
tige('module_antenne',[ap.x,ap.y+.063,ap.z],[ap.x,ap.y+.335,ap.z],.010,1,'fouet',10);
ellipsoide('module_antenne',[.013,.013,.013],[ap.x,ap.y+.335,ap.z],1,'embout_fouet',12,6);
const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const ps=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(ps.length){
  const groupes:THREE.BufferGeometry[]=[],mats:number[]=[];
  for(const mat of [0,1]){
   const gs=ps.filter(p=>(p.role===0?0:1)===mat).map(p=>{
    const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone(),pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);
    if(nom==='base'){
     const n=g.getAttribute('position').count,indices=new Uint16Array(n*4),poids=new Float32Array(n*4);
     for(let j=0;j<n;j++){indices[j*4]=p.os;poids[j*4]=1;}
     g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(poids,4));
    }
    return g;
   });
   if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-6);g.computeTangents();groupes.push(g);mats.push(mat);}
  }
  const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mats[i]!);
  objet=nom==='base'?new THREE.SkinnedMesh(g,materiaux):new THREE.Mesh(g,materiaux);
 }else objet=nom.startsWith('os_')?new THREE.Bone():new THREE.Group();
 objet.name=nom;objet.position.set(...pose.pivot);objets.set(nom,objet);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const base=objets.get('base') as THREE.SkinnedMesh;
base.bind(new THREE.Skeleton([objets.get('os_rotor_gauche') as THREE.Bone,objets.get('os_rotor_droit') as THREE.Bone]));
const bornes=new THREE.Box3().setFromObject(racine),dimensions=bornes.getSize(new THREE.Vector3());
const quat=(r:V3)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray();
const rotation=(nom:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(quat));
const position=(nom:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(p=>p.map((v,i)=>v+poses[nom]!.pivot[i]!)));
function rotors(duree:number,tours:number,arret=false){
 return ['os_rotor_gauche','os_rotor_droit'].map((nom,i)=>{
  const n=tours*16,t:number[]=[],q:number[]=[];
  for(let k=0;k<=n;k++){t.push(k/n*(arret?duree*.57:duree));q.push(...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(i===0?1:-1)*k/n*Math.PI*2*tours).toArray());}
  q.splice(q.length-4,4,0,0,0,1);if(arret){t.push(duree);q.push(0,0,0,1);}
  return new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,q);
 });
}
const balayage=(d:number)=>rotation('module_radar',[0,d*.25,d*.5,d*.75,d],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,Math.PI*1.5,0],[0,0,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[...rotors(2.4,4),balayage(2.4),position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.006,0],[0,.009,0],[0,.006,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[...rotors(1,3),position('corps',[0,.25,.5,.75,1],[[0,.020,0],[0,.028,0],[0,.020,0],[0,.028,0],[0,.020,0]]),rotation('corps',[0,.25,.5,.75,1],[[-.028,0,0],[-.020,0,.016],[-.028,0,0],[-.020,0,-.016],[-.028,0,0]]),rotation('module_radar',[0,.5,1],[[.12,0,0],[.15,0,0],[.12,0,0]]),rotation('module_antenne',[0,.5,1],[[.015,0,0],[.026,0,0],[.015,0,0]])]),
 new THREE.AnimationClip('touche',.5,[...rotors(.5,1),position('corps',[0,.1,.28,.5],[[0,0,0],[0,.024,0],[0,.012,0],[0,0,0]]),rotation('corps',[0,.1,.28,.5],[[0,0,0],[.042,0,.035],[-.025,0,-.024],[0,0,0]]),rotation('module_antenne',[0,.1,.28,.5],[[0,0,0],[.04,0,-.03],[-.025,0,.018],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[...rotors(.9,1,true),position('corps',[0,.57,.9],[[0,0,0],[0,-.035,0],[0,-.035,0]]),rotation('module_radar',[0,.57,.9],[[0,0,0],[.65,0,0],[.65,0,0]]),rotation('module_antenne',[0,.57,.9],[[0,0,0],[.06,0,0],[.06,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.25,.52,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
function reset(){for(const [nom,o] of objets){o.position.set(...poses[nom]!.pivot);o.quaternion.identity();o.scale.set(1,1,1);}racine.updateMatrixWorld(true);}
function mesurer(){
 racine.updateMatrixWorld(true);const b=new THREE.Box3();let r=0;
 racine.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);if(o instanceof THREE.SkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);b.expandByPoint(v);r=Math.max(r,Math.hypot(v.x,v.z));}});
 return {min:b.min.toArray(),max:b.max.toArray(),rayon:r};
}
function mouvements(){
 const resultats=clips.map(clip=>{
  reset();const mixer=new THREE.AnimationMixer(racine),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const instants=new Set<number>(Array.from({length:1537},(_,i)=>i/1536*clip.duration));clip.tracks.forEach(tr=>Array.from(tr.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let rayon=0;
  for(const t of [...instants].sort((a,b)=>a-b)){mixer.setTime(t);const m=mesurer();for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,m.min[a]!);max[a]=Math.max(max[a]!,m.max[a]!);}rayon=Math.max(rayon,m.rayon);}
  mixer.stopAllAction();mixer.uncacheRoot(racine);return {nom:clip.name,nombreEchantillons:instants.size,enveloppe:{min,max},rayonHorizontalMax:rayon};
 });reset();return {id,methode:'Sommets transformés Three.js avec skin, 1537 instants par clip et clés exactes.',clips:resultats,limites:['Échantillonnage numérique, sans contrôle visuel.','Aucun certificat de collisions internes ni de mélanges entre clips.']};
}
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const mesures=mouvements();
 const reperes=[...morceaux].flatMap(([noeud,liste])=>[0,1].flatMap(mat=>{let debut=0;return liste.filter(p=>(p.role===0?0:1)===mat).map(p=>{const count=(p.geometrie.index?p.geometrie.index.count:p.geometrie.getAttribute('position').count)/3;const r={noeud,materiau:mat===0?'mat_corps':'mat_details',etiquette:p.etiquette,role:p.role,os:p.os,premierTriangle:debut,nombreTriangles:count};debut+=count;return r;});}));
 writeFileSync(path.join(sortie,'reperes-pieces.json'),JSON.stringify({id,methode:'Ordre des triangles conservé par mergeGeometries/mergeVertices et GLTFExporter, avant déduplication sans changement des index.',reperes},null,2)+'\n');
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.6};}
 document.asset={version:'2.0',generator:'Atlas Tournament — drone veilleur original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>6000)throw new Error(`Budget dépassé : ${triangles} ${JSON.stringify(bilan)}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:`scripts/production/modeles/${id}/generer.ts`,sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,rotors:{noeuds:['os_rotor_gauche','os_rotor_droit'],axe:'+Y',maillage:'base',poidsRigides:true,dispositionDiagonale:true,animationGLB:true},limites:['Pas de rendu ni contrôle visuel.','Deux rotors à poids rigides sur deux os, pales découvertes.','Capsule sans arme, radôme fermé sur un bras articulé.','Un seul pivot commun de radar pour le scan et le repli ; pas de simulation physique.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
