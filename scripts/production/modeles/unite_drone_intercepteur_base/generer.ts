/** Drone intercepteur original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id='unite_drone_intercepteur_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.31,0]},
 base:{parent:'corps',pivot:[0,.022,.035]},
 module_radar:{parent:'corps',pivot:[0,.168,-.075]},
 socle:{parent:'corps',pivot:[.072,.091,.13]},
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
// Capsule à nez effilé et épaules larges : coque opaque, jamais de cockpit occupé.
const profils:[number,number,number,number][]=[
 [-.425,.310,.028,.022],[-.399,.312,.042,.034],[-.350,.314,.073,.052],[-.275,.318,.108,.068],
 [-.185,.322,.132,.078],[-.090,.324,.149,.084],[.015,.324,.145,.083],[.115,.322,.121,.072],
 [.220,.318,.091,.056],[.310,.312,.061,.039],[.380,.306,.034,.026],[.425,.301,.012,.015],
];
ajouter('corps',peauSections(profils.map(([z,y,a,b])=>({centre:[0,y,z],rayonA:a,rayonB:b})),'z',24),0,'capsule_losange');
// Voilure épaisse en flèche douce ; raccords arrondis et bouts sans pointe fragile.
for(const s of [-1,1]){
 const stations:[number,number,number,number,number][]=[
  [.100,.311,.001,.186,.031],[.168,.314,-.009,.168,.030],[.245,.319,-.027,.134,.027],
  [.324,.325,-.049,.103,.024],[.410,.331,-.072,.067,.021],[.463,.334,-.082,.036,.017],
 ];
 ajouter('corps',peauSections(stations.map(([x,y,z,d,h])=>({centre:[s*x,y,z],rayonA:h,rayonB:d})),'x',20),0,'ailes_fixes_epaisses');
 const contour:[number,number][]=[[.208,-.130],[.419,-.125],[.403,-.146],[.224,-.177]];
 const pts:V3[]=([0,.012] as const).flatMap(dy=>contour.map(([x,z])=>[s*x,.310+.045*x+dy,z] as V3));
 ajouter('corps',solide(pts,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]),5,'volets_epais_encastres');
 // Nacelles latérales : lèvres de métal et vrais conduits ouverts vers +Z.
 ajouter('corps',peauSections([
  {centre:[s*.140,.267,-.160],rayonA:.028,rayonB:.030},
  {centre:[s*.159,.269,-.100],rayonA:.038,rayonB:.038},
  {centre:[s*.168,.272,.055],rayonA:.040,rayonB:.040},
 ],'z',16),1,'nacelles_propulsion');
 tube('corps',.041,.030,.054,[s*.168,.272,.049],3,'admissions_creuses',16);
 cylindre('corps',.030,.008,[s*.168,.272,.052],6,'fonds_recesses_admission',[Math.PI/2,0,0],16);
 boite('corps',[.053,.013,.012],[s*.168,.272,.058],6,'traverse_admission');
 tube('corps',.029,.021,.041,[s*.143,.267,-.153],3,'tuyeres_arriere',12,[0,Math.PI,0]);
 cylindre('corps',.021,.008,[s*.143,.267,-.158],6,'fonds_recesses_tuyere',[Math.PI/2,0,0],12);
 // Deux lanceurs de marqueurs verticaux courts sur la même embase de recul.
 panneau('base',[.072,.043,.133],[s*.170,.342,.039],1,'assises_lanceurs',[0,0,0],.009);
 tube('base',.030,.020,.102,[s*.170,.360,.049],3,'lanceurs_vers_ciel',16,[-Math.PI/2,0,0]);
 cylindre('base',.021,.009,[s*.170,.365,.049],6,'fonds_lanceurs',[0,0,0],12);
 cylindre('base',.035,.022,[s*.170,.392,.049],5,'colliers_lanceurs',[0,0,0],16);
 // Trois appuis bas au total : deux principaux ici, le patin avant ci-dessous.
 liaison('corps',[s*.103,.252,-.175],[s*.130,.132,-.189],.016,3,'jambes_train',8);
 panneau('corps',[.063,.026,.137],[s*.130,.111,-.182],2,'patins_train',[0,0,0],.007);
}
liaison('corps',[0,.265,.244],[0,.129,.253],.017,3,'jambe_avant',8);
panneau('corps',[.068,.026,.122],[0,.111,.257],2,'patin_avant',[0,0,0],.007);
// Trappes et maintenance en volumes, motifs en normale seulement.
panneau('corps',[.110,.014,.120],[0,.408,-.075],5,'trappe_dorsale',[0,0,0],.008);
for(const s of [-1,1]){
 panneau('corps',[.030,.016,.117],[s*.065,.399,-.196],6,'grilles_hautes',[0,0,0],.004);
 for(let j=0;j<3;j++)boite('corps',[.033,.009,.014],[s*.065,.410,-.230+j*.035],3,'barrettes_grilles');
}
// Radar concave à double paroi et moyeu plein. Toute l'assiette tourne avec module_radar.
cylindre('corps',.043,.033,[0,.435,-.075],1,'palier_radar',[0,0,0],16);
cylindre('module_radar',.023,.064,[0,.463,-.075],3,'axe_radar',[0,0,0],12);
const profilRadar=[new THREE.Vector2(.016,-.005),new THREE.Vector2(.040,.001),new THREE.Vector2(.073,.019),new THREE.Vector2(.079,.019),new THREE.Vector2(.079,.011),new THREE.Vector2(.043,-.011),new THREE.Vector2(.016,-.017)];
const assiette=new THREE.LatheGeometry(profilRadar,24);assiette.rotateX(Math.PI/3);
ajouter('module_radar',assiette,3,'assiette_radar_concave',[0,.492,-.075]);
cylindre('module_radar',.018,.038,[0,.496,-.069],1,'moyeu_radar',[Math.PI/3,0,0],12);
boite('socle',[.032,.024,.027],pivotMonde('socle').toArray() as V3,7,'temoin_disponibilite');
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
 for(let k=0;k<=n;k++){t.push(k/n*(arret?duree*.60:duree));q.push(...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),k/n*Math.PI*2).toArray());}
 q.splice(q.length-4,4,0,0,0,1);if(arret){t.push(duree);q.push(0,0,0,1);}
 return new THREE.QuaternionKeyframeTrack('module_radar.quaternion',t,q);
}
// Contact calculé dans la pose finale d'affaissement sur le train.
objets.get('corps')!.rotation.set(.025,0,-.024);racine.updateMatrixWorld(true);
let minimumAtterrissage=Infinity;
racine.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);minimumAtterrissage=Math.min(minimumAtterrissage,v.y);}});
const abaissement=.003-minimumAtterrissage;
objets.get('corps')!.quaternion.identity();racine.updateMatrixWorld(true);
const clips=[
 new THREE.AnimationClip('repos',2.4,[radar(2.4),position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.009,0],[0,0,0],[0,-.005,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[radar(1),position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.007,0],[0,0,0],[0,.004,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[.030,0,0],[.030,0,.018],[.030,0,0],[.030,0,-.018],[.030,0,0]])]),
 new THREE.AnimationClip('tir',.7,[radar(.7),position('base',[0,.09,.16,.29,.7],[[0,0,0],[0,-.022,-.004],[0,-.018,-.003],[0,0,0],[0,0,0]]),rotation('corps',[0,.09,.24,.7],[[0,0,0],[-.026,0,0],[.011,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[radar(.5),rotation('corps',[0,.10,.26,.5],[[0,0,0],[.032,0,.036],[-.015,0,-.016],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[radar(.9,true),position('corps',[0,.62,.9],[[0,0,0],[0,abaissement,0],[0,abaissement,0]]),rotation('corps',[0,.62,.9],[[0,0,0],[.025,0,-.024],[.025,0,-.024]]),position('base',[0,.62,.9],[[0,0,0],[0,-.014,0],[0,-.014,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.30,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
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
 document.asset={version:'2.0',generator:'Atlas Tournament — drone intercepteur original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>3500)throw new Error(`Budget dépassé : ${triangles} ${JSON.stringify(bilan)}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_drone_intercepteur_base/generer.ts',sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:3500,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,radar:{noeud:'module_radar',axe:'+Y',animationGLB:true},lanceurs:{noeud:'base',nombre:2,axe:'+Y',reculMaxMetres:.022},limites:['Pas de rendu ni contrôle visuel.','Train et volets rigides ; mouvement porté par corps.','Radar rigide concave ; rotation du pied, sans visée de cible.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
