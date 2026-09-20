/** Drone marin original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id='unite_drone_marin_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.105,0]},
 base:{parent:'corps',pivot:[0,0,0]},
 module_radar:{parent:'corps',pivot:[0,.165,-.068]},
 module_antenne:{parent:'corps',pivot:[.085,.125,-.19]},
 socle:{parent:'corps',pivot:[-.074,.128,.075]},
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

function ellipsoide(noeud:string,rayons:V3,p:V3,role:number,etiquette:string,n=20,m=12){
 const g=new THREE.SphereGeometry(1,n,m);g.scale(...rayons);ajouter(noeud,g,role,etiquette,p);
}
function courbeTube(noeud:string,pts:V3[],r:number,role:number,etiquette:string,segments=16,n=6){
 const courbe=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
 ajouter(noeud,new THREE.TubeGeometry(courbe,segments,r,n,false),role,etiquette);
}

/** Peau par sections elliptiques : anneaux lisses, coutures UV fermées et bouchons séparés. */
function peauSections(sections:{centre:V3;rayonA:number;rayonB:number}[],axe:'x'|'z',n:number):THREE.BufferGeometry {
 const p:number[]=[],uv:number[]=[],idx:number[]=[];
 const anneaux=sections.map(({centre:c,rayonA:a,rayonB:b})=>Array.from({length:n+1},(_,i)=>{
  const angle=i/n*Math.PI*2;
  return axe==='z'?new THREE.Vector3(c[0]+a*Math.cos(angle),c[1]+b*Math.sin(angle),c[2]):new THREE.Vector3(c[0],c[1]+a*Math.sin(angle),c[2]+b*Math.cos(angle));
 }));
 for(let j=0;j<anneaux.length;j++)for(let i=0;i<=n;i++){const v=anneaux[j]![i]!;p.push(v.x,v.y,v.z);uv.push(i/n,j/(anneaux.length-1));}
 for(let j=0;j<anneaux.length-1;j++)for(let i=0;i<n;i++){
  const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;
  const va=anneaux[j]![i]!,vb=anneaux[j]![i+1]!,vd=anneaux[j+1]![i+1]!;
  const normale=new THREE.Vector3().crossVectors(vb.clone().sub(va),vd.clone().sub(va));
  const centre=new THREE.Vector3(...sections[j]!.centre).add(new THREE.Vector3(...sections[j+1]!.centre)).multiplyScalar(.5);
  const radial=va.clone().add(vb).add(vd).multiplyScalar(1/3).sub(centre);
  if(normale.dot(radial)>0)idx.push(a,b,d,a,d,c);else idx.push(a,d,b,a,c,d);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 // Raccord des deux côtés de la couture, sans fusionner les UV 0 et 1.
 const norm=g.getAttribute('normal');for(let j=0;j<anneaux.length;j++){const a=j*(n+1),b=a+n,v=new THREE.Vector3().fromBufferAttribute(norm,a).add(new THREE.Vector3().fromBufferAttribute(norm,b)).normalize();norm.setXYZ(a,v.x,v.y,v.z);norm.setXYZ(b,v.x,v.y,v.z);}
 const bouchons:THREE.BufferGeometry[]=[];
 for(const j of [0,anneaux.length-1]){
  const positions:number[]=[],tex:number[]=[],indices:number[]=[];const centre=sections[j]!.centre;
  positions.push(...centre);tex.push(.5,.5);
  for(let i=0;i<n;i++){const v=anneaux[j]![i]!;positions.push(v.x,v.y,v.z);tex.push(.5+.5*Math.cos(i/n*Math.PI*2),.5+.5*Math.sin(i/n*Math.PI*2));}
  const direction=sections.at(-1)!.centre[axe==='x'?0:2]-sections[0]!.centre[axe==='x'?0:2];
  const signe=(j===0?-1:1)*Math.sign(direction)*(axe==='x'?-1:1);
  for(let i=0;i<n;i++){const a=i+1,b=(i+1)%n+1;if(signe>0)indices.push(0,a,b);else indices.push(0,b,a);}
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));cap.setIndex(indices);cap.computeVertexNormals();bouchons.push(cap);
 }
 return mergeGeometries([g,...bouchons],false)!;
}
// Deux flotteurs : étraves arrondies +Z, poupes pleines, quille au niveau de référence.
const profilsFlotteur:[number,number,number,number][]=[
 [-.350,.066,.025,.025],[-.316,.064,.062,.046],[-.248,.063,.083,.063],
 [-.110,.063,.083,.063],[.125,.063,.083,.063],[.240,.066,.070,.054],
 [.318,.075,.037,.034],[.350,.081,.013,.018],
];
for(const s of [-1,1]){
 const x=s*.167;
 ajouter('base',peauSections(profilsFlotteur.map(([z,y,a,b])=>({centre:[x,y,z],rayonA:a,rayonB:b})),'z',16),1,'flotteurs_coque_etanche');
 // Ceinture de flottaison épaisse, moulée dans le caoutchouc ; aucun reflet peint.
 ajouter('base',peauSections(profilsFlotteur.map(([z,y,a])=>({centre:[x,y,z],rayonA:a+.003,rayonB:.013})),'z',8),2,'ceintures_flottaison');
 panneau('corps',[.107,.018,.285],[x,.131,-.035],0,'panneaux_pont_flotteurs',[0,0,0],.008);
 panneau('corps',[.089,.024,.102],[x,.129,.223],0,'panneaux_nez_flotteurs',[.06,0,0],.008);
 // Petites protections de poupe, propulsion encastrée dirigée vers l'arrière.
 panneau('base',[.075,.047,.052],[x,.070,-.319],1,'embases_propulsion',[0,0,0],.009);
 tube('base',.029,.021,.026,[x,.068,-.324],3,'couronnes_propulsion',12,[0,Math.PI,0]);
 cylindre('base',.021,.006,[x,.068,-.332],6,'fonds_propulsion',[Math.PI/2,0,0],12);
 boite('base',[.040,.012,.009],[x,.068,-.341],3,'barrettes_propulsion');
 // Prises de levage fermées, sans crochet ni pointe.
 const poignee=new THREE.TorusGeometry(.018,.010,5,8,Math.PI);
 ajouter('corps',poignee,3,'poignees_poupe',[x,.141,-.231],[0,0,0]);
}
// Deux traverses réelles relient les flotteurs ; le pont garde un vide entre les proues.
for(const z of [-.185,.152])panneau('corps',[.344,.034,.070],[0,.104,z],5,'traverses_structure',[0,0,0],.012);
panneau('corps',[.297,.035,.447],[0,.128,-.009],1,'pont_central',[0,0,0],.021);
// Capsule étanche : épaulements doux et nez fermé, jamais de cockpit habité.
const capsule:[number,number,number,number][]=[
 [-.245,.160,.045,.022],[-.214,.171,.095,.043],[-.132,.176,.125,.061],
 [-.025,.179,.134,.066],[.082,.177,.123,.061],[.162,.167,.088,.043],[.199,.159,.036,.023],
];
ajouter('corps',peauSections(capsule.map(([z,y,a,b])=>({centre:[0,y,z],rayonA:a,rayonB:b})),'z',24),1,'capsule_arrondie');
panneau('corps',[.179,.018,.157],[0,.244,.016],0,'trappe_equipe_superieure',[0,0,0],.016);
panneau('corps',[.162,.024,.074],[0,.171,.209],0,'capot_nez',[.09,0,0],.012);
// Hublot de capteur opaque, encastré et sans reflet ; aucune place de pilote.
panneau('corps',[.091,.041,.019],[0,.193,.193],3,'cadre_capteur',[.12,0,0],.007);
ellipsoide('corps',[.035,.014,.008],[0,.194,.205],4,'lentille_capteur',12,6);
// Boîtier et prises de service sur le pont arrière.
panneau('corps',[.145,.040,.073],[0,.184,-.211],5,'coffret_service',[0,0,0],.009);
for(const s of [-1,1]){
 cylindre('corps',.014,.010,[s*.043,.207,-.211],3,'bouchons_service',[0,0,0],8);
 boite('corps',[.026,.015,.094],[s*.100,.217,-.042],6,'grilles_ventilation',[0,0,s*-.32]);
}
// Radar court concave, pied et assiette dans une vraie articulation animée +Y.
cylindre('corps',.035,.027,[0,.258,-.068],5,'embase_radar',[0,0,0],16);
cylindre('module_radar',.018,.047,[0,.292,-.068],3,'axe_radar',[0,0,0],12);
const profilRadar=[new THREE.Vector2(.015,-.003),new THREE.Vector2(.036,.002),new THREE.Vector2(.061,.019),new THREE.Vector2(.066,.019),new THREE.Vector2(.066,.011),new THREE.Vector2(.036,-.010),new THREE.Vector2(.015,-.015)];
const assiette=new THREE.LatheGeometry(profilRadar,20);assiette.rotateX(Math.PI/3);
ajouter('module_radar',assiette,3,'assiette_radar',[0,.321,-.068]);
cylindre('module_radar',.016,.031,[0,.328,-.060],1,'moyeu_radar',[Math.PI/3,0,0],12);
// Fouet épais de 22 mm, protégé par un ressort moulé de 20 mm de section.
cylindre('corps',.028,.022,[.085,.230,-.190],5,'support_antenne',[0,0,0],12);
cylindre('module_antenne',.011,.065,[.085,.264,-.190],2,'ame_ressort',[0,0,0],8);
const spirale:V3[]=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*4;return [.085+Math.cos(a)*.022,.244+i/48*.050,-.190+Math.sin(a)*.022];});
courbeTube('module_antenne',spirale,.010,3,'ressort_antenne',24,6);
courbeTube('module_antenne',[[.085,.294,-.19],[.085,.319,-.19],[.083,.359,-.193],[.079,.392,-.199]],.011,2,'fouet_antenne',9,8);
ellipsoide('module_antenne',[.011,.011,.011],[.079,.392,-.199],2,'embout_fouet',8,4);
boite('socle',[.029,.018,.026],pivotMonde('socle').toArray() as V3,7,'temoin_disponibilite');
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
function radar(duree:number,arret=false){
 const n=16,t:number[]=[],q:number[]=[];
 for(let k=0;k<=n;k++){t.push(k/n*(arret?duree*.58:duree));q.push(...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),k/n*Math.PI*2).toArray());}
 q.splice(q.length-4,4,0,0,0,1);if(arret){t.push(duree);q.push(0,0,0,1);}
 return new THREE.QuaternionKeyframeTrack('module_radar.quaternion',t,q);
}
const clips=[
 new THREE.AnimationClip('repos',2.4,[radar(2.4),position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.010,0],[0,.004,0],[0,.010,0],[0,0,0]]),rotation('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[.009,0,.012],[0,0,0],[-.009,0,-.012],[0,0,0]]),rotation('module_antenne',[0,.6,1.2,1.8,2.4],[[0,0,0],[.017,0,-.018],[0,0,0],[-.017,0,.018],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[radar(1),position('corps',[0,.25,.5,.75,1],[[0,.014,0],[0,.018,0],[0,.014,0],[0,.018,0],[0,.014,0]]),rotation('corps',[0,.25,.5,.75,1],[[-.022,0,0],[-.016,0,.014],[-.022,0,0],[-.016,0,-.014],[-.022,0,0]]),rotation('module_antenne',[0,.25,.5,.75,1],[[-.037,0,0],[-.058,0,-.026],[-.037,0,0],[-.058,0,.026],[-.037,0,0]])]),
 new THREE.AnimationClip('touche',.5,[radar(.5),position('corps',[0,.10,.26,.5],[[0,0,0],[0,.024,0],[0,.014,0],[0,0,0]]),rotation('corps',[0,.10,.26,.5],[[0,0,0],[.035,0,.036],[-.021,0,-.020],[0,0,0]]),rotation('module_antenne',[0,.10,.26,.5],[[0,0,0],[-.085,0,-.09],[.055,0,.056],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[radar(.9,true),position('corps',[0,.57,.9],[[0,0,0],[0,.021,0],[0,.021,0]]),rotation('corps',[0,.57,.9],[[0,0,0],[.018,0,-.052],[.018,0,-.052]]),rotation('module_antenne',[0,.57,.9],[[0,0,0],[.16,0,-.10],[.16,0,-.10]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.25,.52,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
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
 document.asset={version:'2.0',generator:'Atlas Tournament — drone marin original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>3500)throw new Error(`Budget dépassé : ${triangles} ${JSON.stringify(bilan)}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_drone_marin_base/generer.ts',sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:3500,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,radar:{noeud:'module_radar',axe:'+Y',animationGLB:true},antenne:{noeud:'module_antenne',diametreFouet:.022,diametreFilRessort:.020,rayonCentralRessort:.022,nombreToursRessort:2,hauteurRessort:.050,pasRessort:.025},limites:['Pas de rendu ni contrôle visuel.','Propulsion et flotteurs rigides ; mouvement porté par corps.','Radar rigide concave ; rotation du pied, sans visée de cible.','Ressort modélisé ; articulation rigide du module antenne, sans simulation physique.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
