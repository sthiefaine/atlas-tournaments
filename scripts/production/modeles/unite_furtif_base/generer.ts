/** Création originale : voilure intégrée à facettes. Aucun maillage externe. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number,number,number];
type Piece = {geometrie:THREE.BufferGeometry;role:number;etiquette:string};
const id='unite_furtif_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.2,0]},
 base:{parent:'corps',pivot:[0,-.069,.336]},
 socle:{parent:'corps',pivot:[0,.067,-.073]},
 module_antenne:{parent:'corps',pivot:[0,.075,-.201]},
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

/** Loft facetté, arêtes dures ; normale orientée depuis le centre de chaque couple. */
function loft(anneaux:V3[][],axe:'x'|'z'):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];
 const centres=anneaux.map(a=>a.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).divideScalar(a.length));
 const face=(ps:V3[],direction:THREE.Vector3)=>{
  let pts=ps.map(v=>new THREE.Vector3(...v));
  let normale=new THREE.Vector3().crossVectors(pts[1]!.clone().sub(pts[0]!),pts[2]!.clone().sub(pts[0]!));
  if(normale.dot(direction)<0){pts=pts.reverse();normale.negate();}
  const axes=Math.abs(normale.y)>=Math.max(Math.abs(normale.x),Math.abs(normale.z))?['x','z'] as const:Math.abs(normale.x)>Math.abs(normale.z)?['z','y'] as const:['x','y'] as const;
  const u=pts.map(p=>p[axes[0]]),v=pts.map(p=>p[axes[1]]),u0=Math.min(...u),v0=Math.min(...v),du=Math.max(...u)-u0,dv=Math.max(...v)-v0;
  const debut=pos.length/3;pts.forEach((p,i)=>{pos.push(p.x,p.y,p.z);uv.push((u[i]!-u0)/du,(v[i]!-v0)/dv);});
  for(let i=1;i<pts.length-1;i++)idx.push(debut,debut+i,debut+i+1);
 };
 const n=anneaux[0]!.length;
 face(anneaux[0]!,axe==='x'?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,-1));
 for(let j=0;j<anneaux.length-1;j++)for(let k=0;k<n;k++){
  const h=(k+1)%n,ps=[anneaux[j]![k]!,anneaux[j+1]![k]!,anneaux[j+1]![h]!,anneaux[j]![h]!];
  const centre=centres[j]!.clone().add(centres[j+1]!).multiplyScalar(.5);
  const dir=ps.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(.25).sub(centre);
  face(ps,dir);
 }
 face(anneaux.at(-1)!,axe==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function fuselage(stations:[number,number,number,number,number][]):THREE.BufferGeometry{
 return loft(stations.map(([z,w,y,h,b])=>[[-w*.68,y-b,z],[w*.68,y-b,z],[w,y-b*.4,z],[w,y+h*.3,z],[w*.48,y+h,z],[-w*.48,y+h,z],[-w,y+h*.3,z],[-w,y-b*.4,z]]),'z');
}
// Fuselage monocoque étroit, bec tronqué et ventre sans train saillant.
ajouter('corps',fuselage([[-.425,.012,.184,.012,.015],[-.345,.015,.184,.055,.055],[-.265,.106,.177,.072,.081],[-.208,.110,.177,.072,.081],[-.030,.108,.179,.064,.080],[.105,.082,.181,.056,.064],[.240,.052,.179,.039,.043],[.353,.028,.176,.020,.025],[.425,.012,.172,.009,.009]]),0,'fuselage_facettes');
// Grande aile intégrée : flèche continue, bord de fuite en deux décrochements.
const aileStations:[number,number,number,number,number][]=[
 [.036,-.324,.242,.198,.058],[.101,-.343,.226,.201,.059],[.190,-.272,.173,.207,.049],[.281,-.316,.105,.214,.041],[.371,-.245,.018,.220,.033],[.454,-.145,-.055,.227,.025],[.475,-.105,-.074,.229,.022],
];
function aile(stations:typeof aileStations){return loft(stations.map(([x,z0,z1,y,h])=>{
 const corde=z1-z0;return [[x,y-h*.1,z0],[x,y-h*.5,z0+corde*.12],[x,y-h*.5,z1-corde*.14],[x,y-h*.1,z1],[x,y+h*.14,z1],[x,y+h*.5,z1-corde*.23],[x,y+h*.5,z0+corde*.18],[x,y+h*.12,z0]];
}),'x');}
for(const s of [-1,1]){
 const g=aile(aileStations);if(s<0){g.scale(-1,1,1);const index=g.getIndex()!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}
 ajouter('corps',g,0,'voilure_integree');
 // Longs inserts de bord d'attaque : volume discret porté par la voilure.
 const bandes=aileStations.slice(1).map(([x,z0,z1,y,h])=>[x,z1-.023,z1,y+h*.16,.013] as [number,number,number,number,number]);
 const bord=aile(bandes);if(s<0){bord.scale(-1,1,1);const ix=bord.getIndex()!;for(let i=0;i<ix.count;i+=3){const v=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,v);}}
 ajouter('corps',bord,1,'bords_attaque_composite');
 // Deux gouvernes trapézoïdales affleurantes ; aucune dérive haute.
 const pts:V3[]=[[s*.211,.231,-.206],[s*.276,.237,-.249],[s*.348,.241,-.204],[s*.340,.241,-.168]];
 const inf=pts.map(([x,y,z])=>[x,y-.012,z] as V3);
 ajouter('corps',solide([...inf,...pts],[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]),1,'gouvernes_affleurantes');
 // Dessus de panneaux d'accès, arrêts et rails des entrées dorsales.
 panneau('corps',[.071,.012,.100],[s*.144,.236,-.103],5,'panneaux_acces_aile',[0,s*.32,0],.009);
 for(const z of [-.125,-.075])cylindre('corps',.012,.010,[s*.145,.247,z],3,'verrous_encastres',[0,0,0],12);
 panneau('corps',[.029,.022,.105],[s*.050,.084,-.072],1,'portes_train_fermees',[0,0,0],.006);
}
// Pont dorsal plat et capot avant, socle de la cabine avancée.
panneau('corps',[.154,.028,.246],[0,.248,-.043],1,'pont_dorsal_bas',[0,0,0],.018);
panneau('corps',[.143,.022,.225],[0,.253,.168],3,'joint_cabine_avancee',[0,0,0],.018);
ajouter('corps',fuselage([[.064,.061,.262,.030,.008],[.122,.063,.270,.067,.010],[.220,.052,.267,.060,.012],[.300,.025,.258,.025,.010],[.317,.013,.253,.007,.009]]),4,'verriere_anguleuse');
// Arceaux de cabine 20 mm minimum, mats et indépendants de la teinte d'équipe.
liaison('corps',[-.056,.308,.122],[.056,.308,.122],.0105,1,'arceau_cabine',8);
liaison('corps',[0,.336,.126],[0,.315,.260],.0105,1,'nervure_cabine',8);
// Deux entrées d'air ouvertes : quatre parois et fond reculé, bouche vers +Z.
// Elles sont posées sur les épaules ; la silhouette reste sans nacelle extérieure.
for(const s of [-1,1]){
 const x=s*.111;
 boite('corps',[.073,.010,.101],[x,.267,-.130],1,'toits_entrees');
 boite('corps',[.073,.010,.101],[x,.228,-.130],3,'planchers_entrees');
 for(const q of [-1,1])boite('corps',[.010,.032,.101],[x+q*.034,.2475,-.130],3,'parois_entrees');
 boite('corps',[.058,.027,.006],[x,.2475,-.178],2,'fonds_recules_entrees');
 // Deux aubes internes, placées derrière les lèvres, sans fausse profondeur peinte.
 for(const q of [-1,1])boite('corps',[.011,.028,.055],[x+q*.015,.2475,-.143],5,'aubes_entrees');
 // Sorties arrière ouvertes de part et d'autre d'une quille centrale étroite.
 panneau('corps',[.075,.020,.080],[s*.042,.181,-.318],1,'epaules_sorties_raccordees',[0,0,0],.008);
 boite('corps',[.048,.008,.061],[s*.042,.170,-.382],3,'levres_superieures_sorties');
 boite('corps',[.048,.008,.061],[s*.042,.139,-.382],3,'levres_inferieures_sorties');
 for(const q of [-1,1])boite('corps',[.008,.027,.061],[s*.042+q*.022,.1545,-.382],1,'joues_sorties');
 boite('corps',[.035,.020,.008],[s*.042,.1545,-.354],2,'fonds_sorties');
 for(const q of [-1,1])boite('corps',[.008,.020,.021],[s*.042+q*.010,.1545,-.389],6,'diffuseurs_sorties');
}
// Marquage vers +Z ; deux canaux courts, ouverts, solidaires de la cassette mobile.
panneau('base',[.112,.040,.090],[0,.127,.323],1,'cassette_marquage',[0,0,0],.009);
for(const s of [-1,1]){
 tube('base',.019,.012,.063,[s*.031,.131,.334],3,'bouches_marquage',16);
 cylindre('base',.012,.011,[s*.031,.131,.331],2,'fonds_bouches',[Math.PI/2,0,0],16);
}
// Antenne de tournoi épaisse : tube 21 mm, âme 20 mm, ressort libre 21 mm.
cylindre('corps',.035,.024,[0,.266,-.201],3,'embase_antenne',[0,0,0],20,.029);
cylindre('module_antenne',.020,.025,[0,.286,-.201],2,'soufflet_antenne',[0,0,0],16);
cylindre('module_antenne',.044,.009,[0,.292,-.201],3,'coupelle_basse_ressort',[0,0,0],20);
cylindre('module_antenne',.010,.112,[0,.347,-.201],3,'ame_ressort',[0,0,0],12);
class Helice extends THREE.Curve<THREE.Vector3>{constructor(){super();}override getPoint(t:number,target=new THREE.Vector3()) {const a=t*Math.PI*2*3;return target.set(Math.cos(a)*.035,.300+t*.090,-.201+Math.sin(a)*.035);}}
ajouter('module_antenne',new THREE.TubeGeometry(new Helice(),144,.0105,8,false),11,'ressort_antenne');
liaison('module_antenne',[0,.393,-.201],[.012,.524,-.209],.0105,1,'fouet_antenne',12);
// Embouts arrondis épais, sans pointe libre au sommet.
ellipsoide('module_antenne',[.011,.011,.011],[.012,.524,-.209],1,'capuchon_antenne',12,8);
cylindre('module_antenne',.044,.010,[0,.397,-.201],3,'coupelle_haute_ressort',[0,0,0],20);
cylindre('module_antenne',.018,.022,[0,.399,-.201],3,'collier_antenne',[0,0,0],16);
// Témoin de disponibilité discret ; son nœud est escamoté en hors-jeu.
panneau('socle',[.034,.021,.041],[0,.267,-.073],7,'temoin_disponibilite',[0,0,0],.006);

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const ps=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(ps.length){
  const groupes:THREE.BufferGeometry[]=[],mats:number[]=[];
  for(const mat of [0,1]){
   const gs=ps.filter(p=>(p.role===0?0:1)===mat).map(p=>{const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone(),pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;});
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
// Animations en place. La racine n'est jamais ciblée, la cassette recule vers -Z.
const clips=[
 new THREE.AnimationClip('repos',2.4,[position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.005,0],[0,0,0],[0,.005,0],[0,0,0]]),rotation('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[.008,0,.010],[0,0,0],[-.008,0,-.010],[0,0,0]]),rotation('module_antenne',[0,.6,1.2,1.8,2.4],[[0,0,0],[.018,0,.025],[0,0,0],[-.018,0,-.025],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,.012,0],[0,.017,0],[0,.012,0],[0,.017,0],[0,.012,0]]),rotation('corps',[0,.25,.5,.75,1],[[-.035,0,0],[-.028,0,.018],[-.035,0,0],[-.028,0,-.018],[-.035,0,0]]),rotation('module_antenne',[0,.25,.5,.75,1],[[-.035,0,0],[-.045,0,.015],[-.035,0,0],[-.045,0,-.015],[-.035,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('base',[0,.12,.23,.45,.7],[[0,0,0],[0,0,0],[0,0,-.022],[0,0,-.008],[0,0,0]]),rotation('corps',[0,.12,.23,.45,.7],[[0,0,0],[.010,0,0],[-.020,0,0],[.006,0,0],[0,0,0]]),rotation('module_antenne',[0,.12,.23,.45,.7],[[0,0,0],[0,0,0],[.035,0,.012],[-.020,0,-.009],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[position('corps',[0,.10,.28,.5],[[0,0,0],[0,.018,0],[0,.006,0],[0,0,0]]),rotation('corps',[0,.1,.28,.5],[[0,0,0],[.038,0,.048],[-.022,0,-.024],[0,0,0]]),rotation('module_antenne',[0,.10,.28,.5],[[0,0,0],[-.05,0,-.05],[.022,0,.028],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.58,.9],[[0,0,0],[0,-.018,0],[0,-.018,0]]),rotation('corps',[0,.58,.9],[[0,0,0],[.012,0,-.034],[.012,0,-.034]]),rotation('module_antenne',[0,.58,.9],[[0,0,0],[.03,0,.06],[.03,0,.06]]),position('base',[0,.58,.9],[[0,0,0],[0,0,-.010],[0,0,-.010]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.25,.50,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.6};}
 document.asset={version:'2.0',generator:'Atlas Tournament — furtif original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:`scripts/production/modeles/${id}/generer.ts`,sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,ressort:{axeAme:[0,-.201],rayonHelice:.035,rayonFil:.0105,rayonAme:.010,hauteur:.090,tours:3,pas:.030,jeuRadialNominal:.0145,jeuAxialNominal:.009},limites:['Pas de rendu ni contrôle visuel.','Création originale ; aucun bake HD.','Pas de mesure FPS téléphone.','Gabarits nationaux et mélanges entre clips non certifiés.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
