/** Création originale déterministe de l’hélicoptère. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_helico_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.50,.03] },
 base: { parent: 'corps', pivot: [0,.31,-.03] },
 module_nacelle: { parent: 'corps', pivot: [0,-.095,.205] },
 socle: { parent: 'corps', pivot: [-.104,.154,-.035] },
};
function pivotMonde(nom: string): THREE.Vector3 {
 const p = poses[nom]!;
 return new THREE.Vector3(...p.pivot).add(p.parent ? pivotMonde(p.parent) : new THREE.Vector3());
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
/** Tube creux réel : paroi intérieure et couronne de bouche, pas de disque noir peint. */
function tube(noeud:string,exterieur:number,interieur:number,longueur:number,p:V3,role:number,etiquette:string,n=16,rotation:V3=[0,0,0]) {
 const positions:number[]=[],normales:number[]=[],uv:number[]=[],indices:number[]=[];
 const anneau=(r:number,z:number,face:number)=>{
  for(let i=0;i<=n;i++) {const a=i/n*Math.PI*2, x=Math.cos(a),y=Math.sin(a);positions.push(x*r,y*r,z);normales.push(face===0?x:0,face===0?y:0,face===0?0:face);uv.push(i/n, z===0?0:1);}
 };
 anneau(exterieur,0,0);anneau(exterieur,longueur,0);anneau(interieur,0,0);anneau(interieur,longueur,0);
 for(let i=2*(n+1)*3;i<4*(n+1)*3;i++)normales[i]=-normales[i]!;
 for(let i=0;i<n;i++) {let a=i,b=i+1,c=n+1+i,d=c+1;indices.push(a,b,d,a,d,c);a+=2*(n+1);b+=2*(n+1);c+=2*(n+1);d+=2*(n+1);indices.push(a,d,b,a,c,d);}
 // Couronne de bouche séparée, normale +Z.
 const premier=positions.length/3;
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;for(const r of [interieur,exterieur]){positions.push(Math.cos(a)*r,Math.sin(a)*r,longueur);normales.push(0,0,1);uv.push(.5+Math.cos(a)*r/(exterieur*2),.5+Math.sin(a)*r/(exterieur*2));}}
 for(let i=0;i<n;i++){const a=premier+i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normales,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);ajouter(noeud,g,role,etiquette,p,rotation);
}

/** Polyèdre convexe : faces orientées vers l'extérieur et UV planaires non dégénérées. */
function solide(sommets:V3[],faces:number[][]):THREE.BufferGeometry {
 const p:number[]=[],uv:number[]=[],idx:number[]=[];
 const centre=new THREE.Vector3();for(const v of sommets)centre.add(new THREE.Vector3(...v));centre.divideScalar(sommets.length);
 for(const indices of faces){
  let pts=indices.map(i=>new THREE.Vector3(...sommets[i]!));
  let n=new THREE.Vector3().crossVectors(pts[1]!.clone().sub(pts[0]!),pts[2]!.clone().sub(pts[0]!)).normalize();
  const c=pts.reduce((a,b)=>a.add(b),new THREE.Vector3()).divideScalar(pts.length);
  if(n.dot(c.sub(centre))<0){pts=pts.reverse();n.negate();}
  const axes=Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))?['x','z'] as const:Math.abs(n.x)>Math.abs(n.z)?['z','y'] as const:['x','y'] as const;
  const us=pts.map(a=>a[axes[0]]),vs=pts.map(a=>a[axes[1]]),u0=Math.min(...us),v0=Math.min(...vs),du=Math.max(...us)-u0,dv=Math.max(...vs)-v0;
  const depart=p.length/3;pts.forEach((v,i)=>{p.push(v.x,v.y,v.z);uv.push((us[i]!-u0)/du,(vs[i]!-v0)/dv);});
  for(let i=1;i<pts.length-1;i++)idx.push(depart,depart+i,depart+i+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function ellipsoide(noeud:string,rayons:V3,p:V3,role:number,etiquette:string,n=20,m=12){
 const g=new THREE.SphereGeometry(1,n,m);g.scale(...rayons);ajouter(noeud,g,role,etiquette,p);
}
function liaison(noeud:string,a:V3,b:V3,r:number,role:number,etiquette:string,n=10,rb=r){
 const debut=new THREE.Vector3(...a),fin=new THREE.Vector3(...b),d=fin.clone().sub(debut);
 const g=new THREE.CylinderGeometry(rb,r,d.length(),n,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
 ajouter(noeud,g,role,etiquette,debut.add(fin).multiplyScalar(.5).toArray() as V3);
}
function courbeTube(noeud:string,pts:V3[],r:number,role:number,etiquette:string,segments=16,n=6){
 const courbe=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
 ajouter(noeud,new THREE.TubeGeometry(courbe,segments,r,n,false),role,etiquette);
}

// Nacelle en capsule. Les vitrages font partie de la même peau, sans surface superposée.
const peau=new THREE.SphereGeometry(1,28,16).toNonIndexed();peau.scale(.177,.184,.245);peau.translate(0,.514,.072);
const groupesPeau=new Map<number,{p:number[];n:number[];uv:number[]}>();
for(let i=0;i<peau.getAttribute('position').count;i+=3){
 const at=peau.getAttribute('position'),c=new THREE.Vector3();for(let k=0;k<3;k++)c.add(new THREE.Vector3().fromBufferAttribute(at,i+k));c.divideScalar(3);
 const verre=c.z>.137&&c.y>.502&&c.y<.676&&Math.abs(c.x)>.013;
 const flanc=Math.abs(c.x)>.111&&c.y>.395&&c.y<.570&&c.z<.128&&c.z>-.104;
 const role=verre?4:flanc?0:c.y<.388?1:5;
 const g=groupesPeau.get(role)??{p:[],n:[],uv:[]};
 for(let k=0;k<3;k++){
  g.p.push(at.getX(i+k),at.getY(i+k),at.getZ(i+k));const n=peau.getAttribute('normal'),uv=peau.getAttribute('uv');
  g.n.push(n.getX(i+k),n.getY(i+k),n.getZ(i+k));g.uv.push(uv.getX(i+k),uv.getY(i+k));
 }groupesPeau.set(role,g);
}
for(const [role,a] of groupesPeau){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(a.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));ajouter('corps',g,role,role===4?'vitrages_capsule':role===0?'flancs_equipe':'coque_arrondie');}
// Arceaux francs et nez central séparant les deux vitrages, aucune ligne peinte de reflet.
courbeTube('corps',[[0,.508,.318],[0,.580,.300],[0,.644,.245],[0,.680,.166]],.010,5,'montant_parebrise',12,6);
for(const s of [-1,1]){
 courbeTube('corps',[[s*.165,.467,.12],[s*.157,.550,.16],[s*.128,.623,.173],[s*.074,.674,.172]],.011,1,'montants_portes',10,6);
 panneau('corps',[.022,.035,.065],[s*.174,.487,.019],3,'poignees_encastrees',[0,0,0],.005);
 panneau('corps',[.022,.064,.127],[s*.159,.449,-.039],0,'panneaux_portes_equipe',[0,0,s*.09],.006);
 // Prises d'air latérales de la transmission, avec lames géométriques épaisses.
 panneau('corps',[.031,.072,.092],[s*.111,.648,-.046],1,'admissions_moteur',[0,0,-s*.3],.007);
 for(let j=0;j<4;j++)boite('corps',[.035,.010,.068],[s*.13,.626+j*.014,-.046],6,'lamelles_admission',[0,0,-s*.3]);
}
// Dos moteur en volumes raccordés au fuselage, pas de boîte surdimensionnée.
ellipsoide('corps',[.111,.064,.118],[0,.689,-.020],5,'capot_transmission',20,10);
for(const s of [-1,1]){
 tube('corps',.024,.016,.065,[s*.067,.664,-.122],3,'echappements_creux',12,[0,Math.PI,0]);
 cylindre('corps',.027,.038,[s*.067,.664,-.119],1,'brides_echappement',[Math.PI/2,0,0],12);
}
// Mât fixe et plateau cyclique ; le rotor base tourne à son propre pivot +Y.
cylindre('corps',.046,.037,[0,.758,0],1,'embase_mat',[0,0,0],20);
cylindre('corps',.018,.067,[0,.787,0],3,'mat_rotor',[0,0,0],16);
cylindre('corps',.047,.013,[0,.793,0],3,'plateau_cyclique',[0,0,0],20);
for(const s of [-1,1])liaison('corps',[s*.057,.720,-.015],[s*.028,.791,-.019],.010,3,'bielles_cycliques',8);
cylindre('base',.042,.024,[0,.820,0],3,'moyeu_rotor',[0,0,0],20);
ellipsoide('base',[.036,.022,.036],[0,.839,0],5,'coiffe_moyeu',16,8);
for(let pale=0;pale<4;pale++){
 const angle=pale*Math.PI/2;
 const pts:V3[]=[[.039,.812,-.026],[.432,.824,-.015],[.444,.824,.011],[.083,.814,.032],[.039,.824,-.026],[.432,.836,-.015],[.444,.836,.011],[.083,.826,.032]];
 const g=solide(pts,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]);g.rotateY(angle);
 ajouter('base',g,1,'quatre_pales_coniques');
 const marque=solide([[.389,.838,-.016],[.420,.839,-.015],[.420,.839,.013],[.389,.838,.017],[.389,.841,-.016],[.420,.842,-.015],[.420,.842,.013],[.389,.841,.017]],[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]);marque.rotateY(angle);ajouter('base',marque,5,'reperes_neutres_bouts_pales');
}
// Poutre compacte remontante, anticouple ouvert et entièrement caréné.
liaison('corps',[0,.526,-.112],[0,.590,-.341],.060,5,'poutre_queue_conique',20,.033);
liaison('corps',[0,.571,-.279],[0,.590,-.341],.035,0,'collier_queue_equipe',20,.033);
ajouter('corps',new THREE.TorusGeometry(.083,.018,8,28),5,'carene_anticouple',[0,.611,-.339],[0,Math.PI/2,0]);
ajouter('corps',new THREE.TorusGeometry(.084,.006,6,24),3,'levre_anticouple',[-.014,.611,-.339],[0,Math.PI/2,0]);
cylindre('corps',.020,.039,[0,.611,-.339],3,'moyeu_anticouple',[0,0,Math.PI/2],16);
for(let i=0;i<8;i++){
 const a=i*Math.PI/4;
 const g=new THREE.BoxGeometry(.012,.058,.022);g.translate(0,.049,0);g.rotateX(a);
 ajouter('corps',g,1,'pales_anticouple',[0,.611,-.339]);
}
const finYZ:[number,number][]=[[-.357,.638],[-.395,.717],[-.383,.754],[-.342,.748],[-.287,.658]];
const finPts:V3[]=([-1,1] as const).flatMap(s=>finYZ.map(([z,y])=>[s*.016,y,z] as V3));
ajouter('corps',solide(finPts,[[0,1,2,3,4],[5,6,7,8,9],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]),0,'derive_equipe');
panneau('corps',[.257,.024,.071],[0,.566,-.276],5,'stabilisateur_queue',[0,0,0],.009);
// Patins à nez relevé : le point bas reste à 0,18 m, racine au sol.
for(const s of [-1,1]){
 courbeTube('corps',[[s*.179,.200,-.166],[s*.192,.186,-.123],[s*.192,.185,.108],[s*.189,.193,.219],[s*.178,.227,.262]],.013,3,'patins_courbes',20,6);
 for(const z of [-.067,.145])liaison('corps',[s*.113,.380,z],[s*.184,.216,z],.013,5,'jambes_patins',12);
 for(const z of [-.118,.185])panneau('corps',[.038,.025,.063],[s*.191,.189,z],2,'semelles_patins',[0,0,0],.006);
 panneau('corps',[.044,.023,.098],[s*.176,.292,.051],1,'marchepieds',[0,0,0],.007);
 liaison('corps',[s*.158,.333,.056],[s*.176,.293,.056],.010,3,'supports_marchepieds',8);
}
for(const z of [-.067,.145])liaison('corps',[-.151,.269,z],[.151,.269,z],.011,3,'entretoises_train',12);
// Nacelle de marquage au menton, articulée pour le recul du clip tir.
ellipsoide('module_nacelle',[.051,.042,.066],[0,.405,.242],1,'nacelle_marqueur',16,8);
cylindre('module_nacelle',.025,.060,[0,.405,.275],3,'chemise_marqueur',[Math.PI/2,0,0],16);
tube('module_nacelle',.022,.014,.033,[0,.405,.296],3,'bouche_marqueur',16);
for(const s of [-1,1])cylindre('module_nacelle',.024,.010,[s*.049,.409,.227],5,'axes_nacelle',[0,0,Math.PI/2],12);
// Témoin non émissif escamoté au hors-jeu ; verre ambré, aucune marque nationale.
cylindre('socle',.020,.019,[-.104,.654,-.005],1,'embase_temoin',[0,0,0],12);
ellipsoide('socle',[.017,.014,.017],[-.104,.670,-.005],7,'temoin_disponibilite',12,8);

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const pieces=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(pieces.length){
  const groupes:THREE.BufferGeometry[]=[],mi:number[]=[];
  for(const mat of [0,1]){
   const gs=pieces.filter(p=>(p.role===0?0:1)===mat).map(p=>{const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone();const pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;});
   if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-6);g.computeTangents();groupes.push(g);mi.push(mat);}
  }
  const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mi[i]!);objet=new THREE.Mesh(g,materiaux);g.computeBoundingBox();
 }else objet=new THREE.Group();
 objet.name=nom;objet.position.set(...pose.pivot);objets.set(nom,objet);
}
for(const [nom,pose] of Object.entries(poses))if(pose.parent)objets.get(pose.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const bornes=new THREE.Box3().setFromObject(racine,true),dimensions=bornes.getSize(new THREE.Vector3());
const quat=(r:V3)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray();
const rotation=(nom:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(quat));
const position=(nom:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(p=>p.map((n,i)=>n+poses[nom]!.pivot[i]!)));
/** Rotation animée du GLB uniquement : pas de 45°, pas de raccourci quaternion. */
function rotor(duree:number,tours:number,arret=false){
 const segments=tours*8,temps:number[]=[],valeurs:number[]=[];
 for(let i=0;i<=segments;i++){
  // Hors-jeu : cadence décroissante, arrêt à 0,60 s, même quaternion jusqu'à 0,9 s.
  temps.push(arret?.6*(1-Math.sqrt(1-i/segments)):duree*i/segments);
  const angle=i/segments*tours*Math.PI*2;
  valeurs.push(0,Math.sin(angle/2),0,Math.cos(angle/2));
 }
 // Tours pairs => la représentation quaternion revient exactement à [0,0,0,1].
 valeurs.splice(valeurs.length-4,4,0,0,0,1);
 if(arret){temps.push(duree);valeurs.push(0,0,0,1);}
 return new THREE.QuaternionKeyframeTrack('base.quaternion',temps,valeurs);
}
const clips=[
 new THREE.AnimationClip('repos',2.4,[position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.006,0],[0,0,0],[0,-.004,0],[0,0,0]]),rotation('module_nacelle',[0,.6,1.8,2.4],[[0,0,0],[0,.04,0],[0,-.04,0],[0,0,0]]),rotor(2.4,8)]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.004,0],[0,0,0],[0,-.002,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[.038,0,0],[.047,0,-.009],[.038,0,0],[.03,0,.009],[.038,0,0]]),rotor(1,4)]),
 new THREE.AnimationClip('tir',.7,[position('module_nacelle',[0,.08,.17,.32,.7],[[0,0,0],[0,0,-.018],[0,0,-.018],[0,0,-.005],[0,0,0]]),rotation('corps',[0,.08,.25,.7],[[0,0,0],[-.014,0,0],[.006,0,0],[0,0,0]]),rotor(.7,2)]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.10,.24,.5],[[0,0,0],[.028,0,.038],[-.011,0,-.013],[0,0,0]]),rotor(.5,2)]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.6,.9],[[0,0,0],[0,-.11,0],[0,-.11,0]]),rotation('corps',[0,.6,.9],[[0,0,0],[.028,0,-.045],[.028,0,-.045]]),rotation('module_nacelle',[0,.6,.9],[[0,0,0],[.14,0,0],[.14,0,0]]),rotor(.9,2,true),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
// Mesures par sommets réels : une AABB locale du rotor tournée surestime les bouts de pales.
const mouvements=clips.map(clip=>{
 const copie=racine.clone(true),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const instants=[...new Set([0,clip.duration,...Array.from({length:97},(_,i)=>i*clip.duration/96),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const enveloppe=new THREE.Box3(),dimensionsMax=new THREE.Vector3();let rayonHorizontalMax=0,directionMarqueurZMin=1;
 for(const t of instants){
  mixer.setTime(t);copie.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(copie,true);enveloppe.union(b);dimensionsMax.max(b.getSize(new THREE.Vector3()));
  copie.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const at=obj.geometry.getAttribute('position');for(let i=0;i<at.count;i++){const p=new THREE.Vector3().fromBufferAttribute(at,i).applyMatrix4(obj.matrixWorld);rayonHorizontalMax=Math.max(rayonHorizontalMax,Math.hypot(p.x,p.z));}});
  const direction=new THREE.Vector3(0,0,1).transformDirection(copie.getObjectByName('module_nacelle')!.matrixWorld);directionMarqueurZMin=Math.min(directionMarqueurZMin,direction.z);
 }
 if(rayonHorizontalMax>.5)throw new Error(`${clip.name} dépasse la case après changement de cap.`);
 if(clip.name==='tir'&&directionMarqueurZMin<.99)throw new Error('Le marqueur ne pointe plus vers +Z.');
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5||enveloppe.min.y<0)throw new Error(`${clip.name} dépasse la case ou le sol.`);
 mixer.stopAllAction();mixer.uncacheRoot(copie);
 return{nom:clip.name,nombreEchantillons:instants.length,rayonHorizontalMax,margeDeuxVoisinsTousCaps:1-2*rayonHorizontalMax,directionMarqueurZMin,dimensionsMax:dimensionsMax.toArray(),enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
});
const balayageRotor=(()=>{
 const copie=racine.clone(true),rot=copie.getObjectByName('base')!,enveloppe=new THREE.Box3();
 for(let i=0;i<=360;i++){rot.rotation.y=i*Math.PI/180;copie.updateMatrixWorld(true);enveloppe.union(new THREE.Box3().setFromObject(copie,true));}
 const pm=pivotMonde('base');let rayon=0;
 for(const piece of morceaux.get('base')!){const at=piece.geometrie.getAttribute('position');for(let i=0;i<at.count;i++)rayon=Math.max(rayon,Math.hypot(at.getX(i)-pm.x,at.getZ(i)-pm.z));}
 if(rayon>.5)throw new Error('Rayon du rotor hors case.');
 return{methode:'361 orientations + rayon analytique de chaque sommet',nombreEchantillons:361,rayonMax:rayon,margeDeuxRotorsVoisins:1-2*rayon,enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
})();
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — hélicoptère original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 if(triangles>6000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify({methode:'AnimationMixer Three.js : toutes clés + 97 instants uniformes ; sommets transformés et interpolation quaternion sphérique',clips:mouvements,balayageRotor},null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_helico_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'29c049ed9ad38800b207b4f3a730f780d13e0ddc98e4afa3b0113549e7513e1d',ancienCandidatTriangles:796,depotsDistants:0,dateVerificationSource:'2026-09-20'},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière analytique en espace tangent ; aucun bake HD vers low-poly.','Rotor principal animé par base.quaternion uniquement : le chargeur GLB désactive le rotor procédural.','Rotor anticouple caréné entièrement modélisé, pales fixes faute de nœud supplémentaire dans le contrat.','Vitrages opaques teintés PBR sans intérieur modélisé.','La pose hors-jeu abaisse le vol et parque le rotor sans toucher le terrain, sans débris.','Mesure réelle sur téléphone en attente.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
