/** Création originale déterministe du chasseur. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_chasseur_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.445,0] },
 base: { parent: 'corps', pivot: [0,-.083,.245] },
 socle: { parent: 'corps', pivot: [0,.132,-.062] },
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
// Capsule effilée : profil inédit, nez arrondi, ventre continu et dos doux.
const profils:[number,number,number,number][]=[
 [-.365,.446,.058,.052],[-.343,.446,.072,.062],[-.310,.447,.086,.070],[-.266,.448,.095,.074],
 [-.210,.450,.105,.080],[-.145,.451,.115,.087],[-.070,.452,.123,.091],[.005,.453,.124,.091],
 [.075,.455,.116,.085],[.140,.456,.102,.077],[.203,.453,.085,.063],[.261,.446,.065,.049],
 [.309,.438,.046,.036],[.348,.431,.032,.028],[.380,.426,.022,.020],[.404,.422,.012,.012],[.423,.420,.004,.004],
];
ajouter('corps',peauSections(profils.map(([z,y,a,b])=>({centre:[0,y,z],rayonA:a,rayonB:b})),'z',36),5,'fuselage_capsule_arrondi');
// La verrière est un volume elliptique allongé, assis dans la coque, avec joint et arceaux.
ellipsoide('corps',[.076,.025,.150],[0,.520,.126],1,'joint_verriere',24,12);
ellipsoide('corps',[.069,.076,.140],[0,.530,.129],4,'verriere_goutte',28,14);
courbeTube('corps',[[-.069,.540,.123],[-.058,.577,.125],[0,.609,.128],[.058,.577,.125],[.069,.540,.123]],.0105,3,'arceau_verriere',20,6);
courbeTube('corps',[[0,.540,.269],[0,.586,.215],[0,.608,.130],[0,.575,.010]],.010,5,'montant_verriere',20,6);
// Grands plans en flèche : profil elliptique fermé, épaisseur et dièdre légers.
for(const s of [-1,1]){
 const stations:[number,number,number,number,number][]=[
  [.082,.438,.002,.173,.023],[.136,.440,-.011,.157,.024],[.205,.443,-.036,.132,.021],
  [.280,.446,-.063,.106,.017],[.353,.449,-.093,.078,.013],[.411,.452,-.117,.056,.0105],[.460,.454,-.126,.034,.0105],
 ];
 ajouter('corps',peauSections(stations.map(([x,y,z,chord,h])=>({centre:[s*x,y,z],rayonA:h,rayonB:chord})),'x',24),0,'voilure_fleche_epaisse');
 // Ailerons neutres encastrés sur l'arrière ; vrais volumes biseautés et charnières.
 const contour:[number,number][]=[[.215,-.153],[.432,-.153],[.411,-.169],[.240,-.179]];
 const pts:V3[]=([0,.014] as const).flatMap(dy=>contour.map(([x,z])=>[s*x,.437+.06*x+dy,z] as V3));
 ajouter('corps',solide(pts,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]),1,'ailerons_geometriques');
 // Deux prises d'air en nacelles profilées intégrées aux épaules, lèvres et tunnels ouverts.
 ellipsoide('corps',[.053,.052,.120],[s*.104,.414,-.056],5,'epaules_admission',20,12);
 tube('corps',.043,.031,.078,[s*.120,.416,.066],3,'levres_admission_creuses',24);
 tube('corps',.032,.026,.057,[s*.120,.416,.010],1,'tunnels_admission',24);
 cylindre('corps',.028,.010,[s*.120,.416,.073],6,'fond_admission',[Math.PI/2,0,0],24);
 for(let j=-1;j<=1;j++)boite('corps',[.057,.012,.013],[s*.120,.416+j*.017,.080],6,'lamelles_admission');
 // Empennage horizontal arrière, court et généreux pour la lecture en vue de dessus.
 ajouter('corps',peauSections([
  {centre:[s*.053,.472,-.291],rayonA:.016,rayonB:.082},
  {centre:[s*.110,.478,-.307],rayonA:.013,rayonB:.066},
  {centre:[s*.178,.484,-.334],rayonA:.011,rayonB:.044},
  {centre:[s*.222,.488,-.348],rayonA:.0105,rayonB:.023},
 ],'x',20),5,'stabilisateurs_arriere');
 // Plaques d'accès latérales neutralisées, reliefs lisibles et sans signes.
 panneau('corps',[.023,.060,.115],[s*.119,.470,-.137],0,'panneaux_flancs_equipe',[0,0,s*.05],.006);
 panneau('corps',[.024,.039,.084],[s*.095,.436,-.280],1,'trappes_maintenance',[0,0,s*.10],.006);
}
// Empennage vertical épais, forme inclinée tronquée : pas de pointe ou d'antenne fine.
const derive:[number,number][]=[[-.336,.491],[-.358,.703],[-.315,.745],[-.267,.745],[-.161,.500]];
const d:V3[]=([-1,1] as const).flatMap(s=>derive.map(([z,y])=>[s*.013,y,z] as V3));
ajouter('corps',solide(d,[[0,1,2,3,4],[5,6,7,8,9],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]),0,'derive_epaisse_equipe');
panneau('corps',[.038,.021,.064],[0,.501,-.214],1,'pied_derive',[0,0,0],.005);
// Échappement coaxial ouvert : l'intérieur n'est pas un disque noir collé à la sortie.
tube('corps',.060,.048,.074,[0,.446,-.337],3,'tuyere_creuse',32,[0,Math.PI,0]);
tube('corps',.047,.039,.036,[0,.446,-.354],1,'conduit_tuyere',32,[0,Math.PI,0]);
cylindre('corps',.041,.011,[0,.446,-.377],6,'fond_tuyere_recul',[Math.PI/2,0,0],24);
for(let i=0;i<12;i++){
 const a=i/12*Math.PI*2;
 boite('corps',[.017,.015,.045],[Math.cos(a)*.060,.446+Math.sin(a)*.060,-.382],3,'petales_tuyere',[0,0,a-Math.PI/2]);
}
// Dessous profilé et portes fermées du train : l'appareil est en vol.
ellipsoide('corps',[.070,.029,.160],[0,.362,.047],1,'carene_ventrale',24,12);
panneau('corps',[.059,.021,.164],[0,.337,.038],5,'trappe_train_fermee',[0,0,0],.007);
for(const s of [-1,1])panneau('corps',[.040,.020,.071],[s*.039,.340,-.110],5,'trappes_service_inferieures',[0,0,0],.005);
// base est la paire de culasses internes de marquage ; le recul reste axial -Z.
for(const s of [-1,1]){
 ellipsoide('base',[.029,.028,.077],[s*.047,.366,.222],1,'carters_marqueurs',20,12);
 tube('base',.022,.014,.056,[s*.047,.366,.255],3,'bouches_marqueurs_creuses',20);
 cylindre('base',.020,.018,[s*.047,.366,.253],1,'fonds_marqueurs',[Math.PI/2,0,0],16);
}
// Témoin escamotable ambré dans l'axe du dos, sans émission factice.
cylindre('socle',.020,.021,[0,.563,-.063],1,'embase_temoin',[0,0,0],16);
ellipsoide('socle',[.018,.014,.021],[0,.577,-.063],7,'temoin_disponibilite',16,10);

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const pieces=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(pieces.length){
  const groupes:THREE.BufferGeometry[]=[],mi:number[]=[];
  for(const mat of [0]){
   const gs=pieces.map(p=>{const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone();const pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;});
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
// Animations en place : l'avant et les deux bouches regardent +Z ; aucune piste racine.
const clips=[
 new THREE.AnimationClip('repos',2.4,[position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.009,0],[0,0,0],[0,-.009,0],[0,0,0]]),rotation('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[.009,0,-.012],[0,0,0],[-.009,0,.012],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.006,0],[0,0,0],[0,-.006,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[.025,0,0],[.018,0,-.025],[.025,0,0],[.032,0,.025],[.025,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('base',[0,.07,.14,.32,.7],[[0,0,0],[0,0,-.022],[0,0,-.022],[0,0,-.006],[0,0,0]]),position('corps',[0,.07,.2,.7],[[0,0,0],[0,0,-.006],[0,0,-.002],[0,0,0]]),rotation('corps',[0,.07,.24,.7],[[0,0,0],[-.016,0,0],[.006,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.1,.23,.5],[[0,0,0],[.029,0,.055],[-.012,0,-.019],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.60,.9],[[0,0,0],[0,-.14,0],[0,-.14,0]]),rotation('corps',[0,.6,.9],[[0,0,0],[.080,0,-.065],[.080,0,-.065]]),position('base',[0,.6,.9],[[0,0,0],[0,0,-.018],[0,0,-.018]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
const mouvements=clips.map(clip=>{
 const copie=racine.clone(true),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const instants=[...new Set([0,clip.duration,...Array.from({length:193},(_,i)=>i*clip.duration/192),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const enveloppe=new THREE.Box3(),dimensionsMax=new THREE.Vector3();let rayonHorizontalMax=0,directionMarqueurZMin=1;
 for(const t of instants){
  mixer.setTime(t);copie.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(copie,true);enveloppe.union(b);dimensionsMax.max(b.getSize(new THREE.Vector3()));
  copie.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const at=obj.geometry.getAttribute('position');for(let i=0;i<at.count;i++){const p=new THREE.Vector3().fromBufferAttribute(at,i).applyMatrix4(obj.matrixWorld);rayonHorizontalMax=Math.max(rayonHorizontalMax,Math.hypot(p.x,p.z));}});
  const direction=new THREE.Vector3(0,0,1).transformDirection(copie.getObjectByName('base')!.matrixWorld);directionMarqueurZMin=Math.min(directionMarqueurZMin,direction.z);
 }
 // Borne continue entre deux échantillons : vitesses maximales des pistes LINEAR
 // et slerp, multipliées par le bras de levier mesuré de chaque sous-arbre.
 // Dans ce rig, seul corps tourne ; les descendants translatent ou se rétractent.
 let deplacementMaxCumule=0,vitesseMax=0;
 for(const t of clip.tracks)if(t.name.endsWith('.position')){
  let maximum=0;for(let i=0;i<t.values.length;i+=3)maximum=Math.max(maximum,Math.hypot(t.values[i]!-t.values[0]!,t.values[i+1]!-t.values[1]!,t.values[i+2]!-t.values[2]!));
  deplacementMaxCumule+=maximum;
 }
 for(const t of clip.tracks){
  const [nom,canal]=t.name.split('.'),objet=objets.get(nom!)!;
  const origine=objet.getWorldPosition(new THREE.Vector3());let bras=0;
  objet.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const at=o.geometry.getAttribute('position');for(let i=0;i<at.count;i++)bras=Math.max(bras,new THREE.Vector3().fromBufferAttribute(at,i).applyMatrix4(o.matrixWorld).distanceTo(origine));});
  bras+=deplacementMaxCumule;let vitesse=0;
  for(let i=1;i<t.times.length;i++){
   const dt=t.times[i]!-t.times[i-1]!;
   if(canal==='quaternion'){
    const a=new THREE.Quaternion().fromArray(t.values,(i-1)*4).normalize(),b=new THREE.Quaternion().fromArray(t.values,i*4).normalize();vitesse=Math.max(vitesse,2*Math.acos(Math.min(1,Math.abs(a.dot(b))))/dt*bras);
   }else{
    const delta=[0,1,2].map(k=>Math.abs(t.values[i*3+k]!-t.values[(i-1)*3+k]!));
    vitesse=Math.max(vitesse,(canal==='scale'?Math.max(...delta)*bras:Math.hypot(...delta))/dt);
   }
  }
  vitesseMax+=vitesse;
 }
 const pasMax=Math.max(...instants.slice(1).map((t,i)=>t-instants[i]!));
 const margeInterpolation=vitesseMax*pasMax/2;
 const rayonHorizontalMajoreContinu=rayonHorizontalMax+margeInterpolation;
 if(rayonHorizontalMajoreContinu>.5||enveloppe.min.y-margeInterpolation<0)throw new Error(`${clip.name} : borne continue non garantie.`);
 if(rayonHorizontalMax>.5)throw new Error(`${clip.name} dépasse la case après changement de cap : ${rayonHorizontalMax}`);
 if(clip.name==='tir'&&directionMarqueurZMin<.99)throw new Error('Les marqueurs ne pointent plus vers +Z.');
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5||enveloppe.min.y<0)throw new Error(`${clip.name} dépasse la case ou le sol.`);
 mixer.stopAllAction();mixer.uncacheRoot(copie);
 return{nom:clip.name,nombreEchantillons:instants.length,rayonHorizontalMax,rayonHorizontalMajoreContinu,margeInterpolation,margeDeuxVoisinsTousCaps:1-2*rayonHorizontalMajoreContinu,directionMarqueurZMin,dimensionsMax:dimensionsMax.toArray(),enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
});
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — chasseur original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify({methode:'AnimationMixer Three.js : toutes clés + 193 instants uniformes ; sommets transformés et interpolation quaternion sphérique ; rayon horizontal bornant tous les changements de cap',clips:mouvements},null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_chasseur_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'b956f6fe3ad21928964039f98738a45889e245ab8ec745253b6361209d58e20b',ancienCandidatTriangles:820,depotsDistants:0,dateVerificationSource:'2026-09-20',verificationAvantIntegration:'coordinateur'},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière analytique en espace tangent ; aucun bake HD vers low-poly.','Voilure et gouvernes fixes, inclinaison animée du corps complet.','Verrière opaque teintée PBR sans intérieur modélisé.','Hors-jeu : descente et inclinaison contenues en vol, témoin escamoté, aucun débris.','Atlas de matières répété : pas de motif unique par panneau.','Mesure réelle sur téléphone en attente.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
