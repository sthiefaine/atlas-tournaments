/** Création originale déterministe du bombardier. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_bombardier_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.5,0] },
 base: { parent: 'corps', pivot: [0,-.135,.040] },
 socle: { parent: 'corps', pivot: [0,.126,-.105] },
 module_nacelle: { parent: 'corps', pivot: [0,.055,.185] },
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
// Fuselage inédit par couples octogonaux : ventre plat, joues inclinées, dos étroit.
function celluleAnguleuse(stations:[number,number,number,number,number][]):THREE.BufferGeometry {
 const sommets:V3[]=stations.flatMap(([z,y,largeur,haut,bas])=>[
  [-largeur*.62,y-bas,z],[largeur*.62,y-bas,z],[largeur,y-bas*.35,z],[largeur,y+haut*.35,z],
  [largeur*.57,y+haut,z],[-largeur*.57,y+haut,z],[-largeur,y+haut*.35,z],[-largeur,y-bas*.35,z],
 ] as V3[]);
 const faces:number[][]=[Array.from({length:8},(_,i)=>i),Array.from({length:8},(_,i)=>(stations.length-1)*8+i)];
 for(let j=0;j<stations.length-1;j++)for(let i=0;i<8;i++)faces.push([j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i]);
 return solide(sommets,faces);
}
ajouter('corps',celluleAnguleuse([
 [-.425,.505,.021,.027,.025],[-.390,.501,.042,.033,.032],[-.310,.494,.067,.046,.039],
 [-.205,.492,.098,.068,.055],[-.090,.495,.128,.086,.076],[.035,.497,.148,.085,.093],
 [.160,.493,.131,.074,.079],[.270,.483,.103,.056,.060],[.357,.471,.064,.037,.041],[.425,.465,.012,.015,.015],
]),5,'fuselage_octogonal_joues_inclinees');
// Joues larges en pans : insertions grises d'équipe, angles et rivets géométriques.
for(const s of [-1,1]){
 const points:V3[]=[
  [s*.129,.505,-.068],[s*.149,.505,.050],[s*.131,.504,.167],[s*.088,.565,.195],[s*.087,.585,.045],[s*.076,.579,-.078],
  [s*.134,.510,-.068],[s*.154,.510,.050],[s*.136,.509,.167],[s*.093,.570,.195],[s*.092,.590,.045],[s*.081,.584,-.078],
 ];
 ajouter('corps',solide(points,[[0,1,2,3,4,5],[6,7,8,9,10,11],[0,6,7,1],[1,7,8,2],[2,8,9,3],[3,9,10,4],[4,10,11,5],[5,11,6,0]]),0,'joues_blindees_equipe');
 // Voilure épaisse presque droite, corde généreuse et saumons arrondis par section.
 ajouter('corps',peauSections([
  {centre:[s*.092,.487,.038],rayonA:.026,rayonB:.185},
  {centre:[s*.175,.490,.028],rayonA:.028,rayonB:.175},
  {centre:[s*.265,.494,.018],rayonA:.025,rayonB:.162},
  {centre:[s*.350,.497,.002],rayonA:.021,rayonB:.139},
  {centre:[s*.420,.501,-.012],rayonA:.017,rayonB:.112},
  {centre:[s*.470,.505,-.023],rayonA:.0105,rayonB:.070},
 ],'x',28),0,'ailes_larges_faible_fleche');
 // Volets massifs séparés par un joint réel, charnières visibles sous l'aile.
 panneau('corps',[.160,.022,.051],[s*.335,.482,-.126],5,'volets_bord_fuite',[0,s*.08,0],.006);
 for(const x of [.270,.381])cylindre('corps',.014,.040,[s*x,.474,-.132],3,'axes_volets',[0,0,Math.PI/2],12);
 // Deux nacelles moteurs propres, indépendantes du fuselage et bien visibles de dessus.
 ajouter('corps',peauSections([
  {centre:[s*.259,.470,-.167],rayonA:.038,rayonB:.043},
  {centre:[s*.259,.470,-.135],rayonA:.054,rayonB:.057},
  {centre:[s*.259,.472,-.075],rayonA:.058,rayonB:.064},
  {centre:[s*.259,.473,.020],rayonA:.059,rayonB:.065},
  {centre:[s*.259,.473,.101],rayonA:.055,rayonB:.061},
  {centre:[s*.259,.474,.158],rayonA:.047,rayonB:.050},
 ],'z',28),5,'nacelles_moteurs_jumelees');
 tube('corps',.048,.036,.030,[s*.259,.474,.155],3,'levres_admission',28);
 tube('corps',.036,.030,.043,[s*.259,.474,.126],1,'conduits_admission',28);
 cylindre('corps',.031,.009,[s*.259,.474,.129],6,'fonds_admission',[Math.PI/2,0,0],24);
 // Stators et moyeu restent à l'intérieur, sans pales animées ni effet de propulsion.
 for(let i=0;i<8;i++){
  const a=i/8*Math.PI*2;
  boite('corps',[.023,.007,.012],[s*.259+Math.cos(a)*.019,.474+Math.sin(a)*.019,.137],3,'stators_admission',[0,0,a]);
 }
 ellipsoide('corps',[.018,.018,.026],[s*.259,.474,.151],3,'moyeux_admission',16,8);
 tube('corps',.038,.027,.039,[s*.259,.470,-.163],3,'echappements_creux',28,[0,Math.PI,0]);
 cylindre('corps',.026,.008,[s*.259,.470,-.166],6,'fonds_echappement',[Math.PI/2,0,0],20);
 panneau('corps',[.047,.023,.110],[s*.259,.537,-.012],1,'capots_moteurs_techniques',[0,0,0],.006);
 for(const z of [-.046,-.021,.004,.029])boite('corps',[.042,.013,.011],[s*.259,.550,z],6,'ouies_moteur');
 // Empennage horizontal large et deux dérives trapézoïdales tronquées.
 ajouter('corps',peauSections([
  {centre:[s*.040,.510,-.328],rayonA:.020,rayonB:.067},
  {centre:[s*.130,.520,-.328],rayonA:.017,rayonB:.066},
  {centre:[s*.211,.528,-.344],rayonA:.011,rayonB:.043},
 ],'x',20),5,'empennage_horizontal_biplan');
 const contour:[number,number][]=[[-.395,.525],[-.389,.746],[-.358,.770],[-.298,.770],[-.262,.533]];
 const derive:V3[]=([-1,1] as const).flatMap(cote=>contour.map(([z,y])=>[s*.139+cote*.012,y,z] as V3));
 ajouter('corps',solide(derive,[[0,1,2,3,4],[5,6,7,8,9],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]),0,'derives_jumelees_trapezoidales');
 panneau('corps',[.029,.024,.074],[s*.139,.542,-.320],1,'embases_derives',[0,0,0],.004);
 // Trappes techniques fermées, sans train sorti sur cette pose de vol.
 panneau('corps',[.043,.022,.128],[s*.083,.406,-.076],1,'trappes_train_fermees',[0,0,0],.005);
}
// Nacelle d'équipage facettée, très différente de la goutte du chasseur.
ajouter('module_nacelle',celluleAnguleuse([
 [.060,.564,.073,.035,.018],[.103,.594,.072,.064,.030],[.188,.599,.061,.061,.027],
 [.267,.572,.048,.049,.018],[.303,.550,.025,.020,.014],
]),1,'cadre_nacelle_angulaire');
ajouter('module_nacelle',celluleAnguleuse([
 [.102,.596,.061,.051,.020],[.186,.601,.052,.051,.018],[.263,.574,.038,.036,.010],
]),4,'vitrages_nacelle_facettes');
// Arceaux épais : pièces de structure lisibles, aucun visage ni poste intérieur.
for(const z of [.109,.183]){
 const y=z<.15?.596:.601,demi=z<.15?.062:.053;
 liaison('module_nacelle',[-demi,y+.012,z],[-demi*.57,y+.056,z],.0105,3,'montants_nacelle',10);
 liaison('module_nacelle',[demi,y+.012,z],[demi*.57,y+.056,z],.0105,3,'montants_nacelle',10);
 liaison('module_nacelle',[-demi*.57,y+.056,z],[demi*.57,y+.056,z],.0105,3,'traverses_nacelle',10);
}
liaison('module_nacelle',[0,.652,.109],[0,.653,.186],.011,5,'longeron_nacelle',10);
// Une soute centrale propre : rebords, porte-guide et cassette sans projectile.
panneau('corps',[.139,.041,.260],[0,.395,.014],1,'rebord_soute_ventrale',[0,0,0],.010);
panneau('corps',[.096,.024,.218],[0,.371,.014],6,'fond_soute_marqueur',[0,0,0],.006);
for(const s of [-1,1]){
 panneau('corps',[.025,.045,.236],[s*.064,.367,.014],5,'portes_laterales_soute',[0,0,s*.20],.006);
 for(const z of [-.056,.082])cylindre('corps',.015,.042,[s*.070,.382,z],3,'charniere_porte_soute',[Math.PI/2,0,0],12);
}
panneau('base',[.073,.034,.126],[0,.350,.038],3,'cassette_marquage_ventrale',[0,0,0],.006);
// Deux sorties fixes vers le bas, propres au rôle aérien de bombardement.
for(const z of [.007,.069]){
 tube('base',.026,.017,.030,[0,.350,z],3,'sorties_verticales_marquage',20,[Math.PI/2,0,0]);
 cylindre('base',.017,.007,[0,.342,z],1,'fonds_sorties_marquage',[0,0,0],16);
}
// Témoins sans émission peinte ; le groupe entier s'escamote en hors-jeu.
panneau('socle',[.045,.022,.045],[0,.614,-.105],1,'embase_temoin',[0,0,0],.004);
ellipsoide('socle',[.021,.021,.021],[0,.637,-.105],7,'temoin_disponibilite',16,10);

const materiaux=['mat_corps','mat_details'].map(name=>new THREE.MeshStandardMaterial({name,color:0xffffff,metalness:1,roughness:1}));
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const pieces=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(pieces.length){
  const groupes:THREE.BufferGeometry[]=[],mi:number[]=[];
  for(const mat of [0,1]){
   const gs=pieces.filter(p=>[0,5].includes(p.role)?mat===0:mat===1).map(p=>{const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone();const pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;});
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
// Animations en place : l'appareil regarde +Z, la cassette tire vers -Y ; racine fixe.
const clips=[
 new THREE.AnimationClip('repos',2.4,[position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.009,0],[0,0,0],[0,-.009,0],[0,0,0]]),rotation('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[.009,0,-.012],[0,0,0],[-.009,0,.012],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.006,0],[0,0,0],[0,-.006,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[.025,0,0],[.018,0,-.025],[.025,0,0],[.032,0,.025],[.025,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('base',[0,.07,.14,.32,.7],[[0,0,0],[0,.025,0],[0,.025,0],[0,.006,0],[0,0,0]]),position('corps',[0,.07,.2,.7],[[0,0,0],[0,0,-.006],[0,0,-.002],[0,0,0]]),rotation('corps',[0,.07,.24,.7],[[0,0,0],[-.012,0,0],[.006,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.1,.23,.5],[[0,0,0],[.029,0,.055],[-.012,0,-.019],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.60,.9],[[0,0,0],[0,-.14,0],[0,-.14,0]]),rotation('corps',[0,.6,.9],[[0,0,0],[.080,0,-.065],[.080,0,-.065]]),position('base',[0,.6,.9],[[0,0,0],[0,.025,0],[0,.025,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
const mouvements=clips.map(clip=>{
 const copie=racine.clone(true),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const instants=[...new Set([0,clip.duration,...Array.from({length:193},(_,i)=>i*clip.duration/192),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const enveloppe=new THREE.Box3(),dimensionsMax=new THREE.Vector3();let rayonHorizontalMax=0,directionMarqueurBasMin=1;
 for(const t of instants){
  mixer.setTime(t);copie.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(copie,true);enveloppe.union(b);dimensionsMax.max(b.getSize(new THREE.Vector3()));
  copie.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const at=obj.geometry.getAttribute('position');for(let i=0;i<at.count;i++){const p=new THREE.Vector3().fromBufferAttribute(at,i).applyMatrix4(obj.matrixWorld);rayonHorizontalMax=Math.max(rayonHorizontalMax,Math.hypot(p.x,p.z));}});
  const direction=new THREE.Vector3(0,-1,0).transformDirection(copie.getObjectByName('base')!.matrixWorld);directionMarqueurBasMin=Math.min(directionMarqueurBasMin,-direction.y);
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
 if(clip.name==='tir'&&directionMarqueurBasMin<.99)throw new Error('Les marqueurs ne pointent plus vers -Y.');
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5||enveloppe.min.y<0)throw new Error(`${clip.name} dépasse la case ou le sol.`);
 mixer.stopAllAction();mixer.uncacheRoot(copie);
 return{nom:clip.name,nombreEchantillons:instants.length,rayonHorizontalMax,rayonHorizontalMajoreContinu,margeInterpolation,margeDeuxVoisinsTousCaps:1-2*rayonHorizontalMajoreContinu,directionMarqueurBasMin,dimensionsMax:dimensionsMax.toArray(),enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
});
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — bombardier original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify({methode:'AnimationMixer Three.js : toutes clés + 193 instants uniformes ; sommets transformés et interpolation quaternion sphérique ; rayon horizontal bornant tous les changements de cap',clips:mouvements},null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_bombardier_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'63e33e97b3c2493eeed94bd7f4cf55e0015333fed943254a74e614df917d4c84',ancienCandidatTriangles:1208,depotsDistants:0,dateVerificationSource:'2026-09-20',verificationAvantIntegration:'coordinateur'},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière analytique en espace tangent ; aucun bake HD vers low-poly.','Voilure et gouvernes fixes, inclinaison animée du corps complet.','Nacelle vitrée opaque teintée PBR sans intérieur modélisé.','Hors-jeu : descente et inclinaison contenues en vol, témoin escamoté, aucun débris.','Atlas de matières répété : pas de motif unique par panneau.','Mesure réelle sur téléphone en attente.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
