/** Création originale déterministe du cuirassé. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from './gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_cuirasse_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.15,0]},
 base:{parent:'corps',pivot:[0,-.15,0]},
 module_tourelle:{parent:'corps',pivot:[0,.095,.10]},
 module_canon_long:{parent:'module_tourelle',pivot:[0,.082,.075]},
 socle:{parent:'corps',pivot:[0,.389,-.17]},
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

/** Coque originale par couples en plan : étrave pointue +Z, tableau arrière étroit -Z. */
const ligneCoque:[number,number][]=[[-.105,-.475],[.105,-.475],[.23,-.42],[.31,-.29],[.35,-.08],[.33,.15],[.245,.335],[.11,.43],[0,.475],[-.11,.43],[-.245,.335],[-.33,.15],[-.35,-.08],[-.31,-.29],[-.23,-.42]];
function portionCoque(y0:number,y1:number,x0:number,z0:number,x1:number,z1:number):THREE.BufferGeometry{
 const a=ligneCoque.map(([x,z])=>[x*x0,y0,z*z0] as V3),b=ligneCoque.map(([x,z])=>[x*x1,y1,z*z1] as V3),n=a.length;
 return solide([...a,...b],[Array.from({length:n},(_,i)=>i),...a.map((_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n]),Array.from({length:n},(_,i)=>i+n)]);
}
ajouter('base',portionCoque(0,.035,.52,.74,.72,.88),1,'quille_et_fonds');
ajouter('base',portionCoque(.035,.080,.72,.88,.90,.96),1,'carene_sous_flottaison');
ajouter('base',portionCoque(.080,.106,.90,.96,.945,.985),2,'liston_flottaison');
ajouter('corps',portionCoque(.103,.171,.945,.985,1,1),0,'borde_superieur_evase');
ajouter('corps',portionCoque(.171,.202,1,1,.955,.98),0,'pavois_incline');
ajouter('corps',portionCoque(.202,.216,.945,.975,.945,.975),8,'pont_antiderapant');
// Lisses épaisses du bord, séparées au droit des apparaux ; pas de fil fin ni drapeau.
for(let i=0;i<ligneCoque.length;i++){
 const a=ligneCoque[i]!,b=ligneCoque[(i+1)%ligneCoque.length]!;
 liaison('corps',[a[0]*.933,.232,a[1]*.959],[b[0]*.933,.232,b[1]*.959],.0105,1,'lisses_pavois',8);
}
// Quatre défenses latérales et les grands écubiers d'étrave.
for(const s of [-1,1]){
 for(const z of [-.22,.12])cylindre('corps',.025,.101,[s*(z<0?.325:.321),.150,z],2,'defenses_suspendues',[0,0,s*.11],16);
 for(const z of [.335,-.352]){
  panneau('corps',[.062,.016,.059],[s*(z>0?.161:.181),.225,z],1,'semelles_bittes',[0,0,0],.006);
  for(const dz of [-.016,.016]){cylindre('corps',.0115,.025,[s*(z>0?.161:.181),.245,z+dz],3,'bittes_amarrage',[0,0,0],12);cylindre('corps',.015,.007,[s*(z>0?.161:.181),.261,z+dz],3,'chapeaux_bittes',[0,0,0],12);}
 }
 tube('corps',.025,.014,.012,[s*.099,.244,.375],3,'ecubiers_ouverts',16,[Math.PI/2,0,0]);
}
// Guindeau avant : tambours réels, arbres et guide-chaîne épais.
panneau('corps',[.085,.022,.055],[0,.23,.330],1,'assis_guindeau');
cylindre('corps',.025,.071,[0,.258,.330],3,'tambour_guindeau',[0,0,Math.PI/2],20);
for(const x of [-.033,.033])cylindre('corps',.031,.009,[x,.258,.330],1,'joues_guindeau',[0,0,Math.PI/2],20);
for(const s of [-1,1])liaison('corps',[s*.020,.237,.353],[s*.058,.237,.383],.0105,3,'guides_amarrage',8);
// Couronne rotative et blindage naval au-dessus du pont avant.
cylindre('module_tourelle',.163,.025,[0,.232,.102],1,'embase_tourelle',[0,0,0],40);
cylindre('module_tourelle',.148,.016,[0,.251,.102],3,'couronne_tourelle',[0,0,0],40);
ajouter('module_tourelle',carene([
 {y:.257,largeur:.303,profondeur:.26,coupe:.040,z:.102},
 {y:.291,largeur:.330,profondeur:.268,coupe:.05,z:.10},
 {y:.367,largeur:.265,profondeur:.224,coupe:.05,z:.090},
 {y:.378,largeur:.239,profondeur:.20,coupe:.043,z:.086},
]),0,'tourelle_joues_larges');
panneau('module_tourelle',[.122,.015,.079],[0,.386,.053],5,'trappe_tourelle',[0,0,0],.014);
for(const s of [-1,1]){
 panneau('module_tourelle',[.028,.035,.092],[s*.149,.303,.058],5,'boitiers_lateraux_tourelle',[0,0,s*.21],.006);
 cylindre('module_tourelle',.039,.019,[s*.072,.327,.185],3,'tourillons',[0,0,Math.PI/2],20);
}
// Mantel, longue jaquette, bagues et bouche creuse ; aucun projectile.
panneau('module_canon_long',[.117,.083,.071],[0,.328,.203],1,'mantelet_marqueur',[0,0,0],.018);
cylindre('module_canon_long',.028,.174,[0,.327,.302],0,'jaquette_longue',[Math.PI/2,0,0],24,.023);
for(const z of [.231,.283,.368])cylindre('module_canon_long',.031,.018,[0,.327,z],3,'bagues_jaquette',[Math.PI/2,0,0],24);
tube('module_canon_long',.025,.015,.081,[0,.327,.382],3,'tube_bouche_creuse',24);
cylindre('module_canon_long',.017,.008,[0,.327,.382],1,'fond_chambre',[Math.PI/2,0,0],20);
// Verrou de route en U dégagé du tube ; les joues restent attachées au pont.
for(const s of [-1,1])panneau('corps',[.023,.075,.032],[s*.041,.261,.294],3,'fourche_verrou',[0,0,-s*.14],.004);
panneau('corps',[.11,.021,.045],[0,.225,.294],1,'pied_verrou');
// Passerelle étagée. Les murs sont inclinés ; les vitrages sont des volumes opaques teintés.
ajouter('corps',carene([{y:.216,largeur:.259,profondeur:.224,coupe:.035,z:-.222},{y:.346,largeur:.220,profondeur:.195,coupe:.03,z:-.217}]),0,'chateau_premier_etage');
panneau('corps',[.284,.022,.237],[0,.349,-.222],1,'galerie_passerelle',[0,0,0],.032);
ajouter('corps',carene([{y:.36,largeur:.235,profondeur:.178,coupe:.039,z:-.201},{y:.441,largeur:.253,profondeur:.188,coupe:.037,z:-.202}]),5,'passerelle_corps');
ajouter('corps',carene([{y:.432,largeur:.254,profondeur:.19,coupe:.037,z:-.202},{y:.479,largeur:.227,profondeur:.176,coupe:.029,z:-.207}]),4,'vitrage_passerelle');
// Montants épais sur les grandes faces, pas de lettres ni reflet peint.
for(const x of [-.081,-.029,.029,.081])liaison('corps',[x,.432,-.106],[x*.90,.479,-.119],.0105,1,'montants_face_passerelle',8);
for(const s of [-1,1])for(const z of [-.246,-.194])liaison('corps',[s*.128,.432,z],[s*.115,.479,z-.003],.0105,1,'montants_flanc_passerelle',8);
panneau('corps',[.276,.024,.220],[0,.489,-.207],0,'toit_passerelle',[0,0,0],.035);
// Portes étanches et hublots de cabine basse avec encadrement de métal.
for(const s of [-1,1]){
 panneau('corps',[.021,.08,.047],[s*.127,.282,-.267],1,'encadrements_portes',[0,0,0],.004);
 panneau('corps',[.023,.045,.043],[s*.123,.311,-.185],3,'cadres_hublots_bas',[0,0,0],.004);
 panneau('corps',[.025,.026,.028],[s*.126,.312,-.185],4,'hublots_bas',[0,0,0],.004);
 for(const y of [.247,.28,.313])boite('corps',[.030,.020,.027],[s*.144,y,-.281],3,'marchepieds');
}
// Deux cheminées à sortie évidée et grilles épaisses, équipements de poupe.
for(const s of [-1,1]){
 cylindre('corps',.039,.111,[s*.125,.286,-.359],5,'cheminees',[0,0,0],20,.032);
 tube('corps',.039,.025,.03,[s*.125,.341,-.359],1,'sorties_cheminees',20,[-Math.PI/2,0,0]);
 cylindre('corps',.025,.006,[s*.125,.345,-.359],2,'fonds_cheminees',[0,0,0],16);
 panneau('corps',[.101,.029,.075],[s*.241,.238,-.105],5,'caissons_de_pont',[0,0,0],.012);
 for(let j=0;j<3;j++)boite('corps',[.082,.012,.012],[s*.241,.257,-.128+j*.023],6,'nervures_caissons');
 // Bouée technique uniforme sans bandes ; section épaisse, aucun symbole national.
 const anneau=new THREE.TorusGeometry(.032,.011,8,20);ajouter('corps',anneau,5,'bouees_techniques',[s*.170,.246,-.239],[Math.PI/2,0,0]);
}
// Mât court et radar volumique fixe, séparés du témoin escamotable.
panneau('corps',[.047,.066,.047],[0,.528,-.235],1,'mat_court',[0,0,0],.009);
panneau('corps',[.175,.025,.045],[0,.563,-.235],5,'radar_veille',[0,.08,0],.009);
for(const s of [-1,1])panneau('corps',[.026,.037,.043],[s*.073,.560,-.235],3,'extremites_radar',[0,0,0],.005);
cylindre('socle',.019,.028,[0,.536,-.17],1,'embase_temoin',[0,0,0],20);
ellipsoide('socle',[.018,.018,.018],[0,.562,-.17],7,'temoin_disponibilite',20,12);

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)){
 const pieces=morceaux.get(nom)??[];let objet:THREE.Object3D;
 if(pieces.length){
  const groupes:THREE.BufferGeometry[]=[],mi:number[]=[];
  for(const mat of [0,1]){
   const gs=pieces.filter(p=>([0,5,8].includes(p.role)?0:1)===mat).map(p=>{const g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone();const pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;});
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
// Corps : pilonnement/roulis mesurés, toute la coque suit ; racine strictement fixe.
const clips=[
 new THREE.AnimationClip('repos',2.4,[position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.005,0],[0,.009,0],[0,.005,0],[0,0,0]]),rotation('module_tourelle',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.07,0],[0,0,0],[0,-.07,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,.006,0],[0,.012,0],[0,.006,0],[0,.012,0],[0,.006,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.007,0,.016],[0,0,0],[-.007,0,-.016],[0,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('module_canon_long',[0,.07,.14,.32,.7],[[0,0,0],[0,0,-.036],[0,0,-.036],[0,0,-.012],[0,0,0]]),position('corps',[0,.07,.2,.7],[[0,0,0],[0,.005,-.005],[0,.006,-.002],[0,0,0]]),rotation('corps',[0,.07,.24,.7],[[0,0,0],[-.009,0,0],[.003,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[position('corps',[0,.1,.23,.5],[[0,0,0],[0,.024,0],[0,.012,0],[0,0,0]]),rotation('corps',[0,.1,.23,.5],[[0,0,0],[.022,0,.065],[-.009,0,-.020],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.3,.6,.9],[[0,0,0],[0,.013,0],[0,.002,0],[0,.002,0]]),rotation('corps',[0,.3,.6,.9],[[0,0,0],[.009,0,.014],[0,0,0],[0,0,0]]),rotation('module_canon_long',[0,.6,.9],[[0,0,0],[.08,0,0],[.08,0,0]]),position('module_canon_long',[0,.6,.9],[[0,0,0],[0,0,-.015],[0,0,-.015]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
const mouvements=clips.map(clip=>{
 const copie=racine.clone(true),mixer=new THREE.AnimationMixer(copie),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const instants=[...new Set([0,clip.duration,...Array.from({length:193},(_,i)=>i*clip.duration/192),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const enveloppe=new THREE.Box3(),dimensionsMax=new THREE.Vector3();let rayonHorizontalMax=0,directionMarqueurZMin=1;
 for(const t of instants){
  mixer.setTime(t);copie.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(copie,true);enveloppe.union(b);dimensionsMax.max(b.getSize(new THREE.Vector3()));
  copie.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const at=obj.geometry.getAttribute('position');for(let i=0;i<at.count;i++){const p=new THREE.Vector3().fromBufferAttribute(at,i).applyMatrix4(obj.matrixWorld);rayonHorizontalMax=Math.max(rayonHorizontalMax,Math.hypot(p.x,p.z));}});
  const direction=new THREE.Vector3(0,0,1).transformDirection(copie.getObjectByName('module_canon_long')!.matrixWorld);directionMarqueurZMin=Math.min(directionMarqueurZMin,direction.z);
 }
 // Borne continue entre deux échantillons : vitesses maximales des pistes LINEAR
 // et slerp, multipliées par le bras de levier mesuré de chaque sous-arbre.
 // Les branches corps/tourelle/canon tournent ; le témoin se rétracte.
 // Le tube est le plus loin du pivot de corps à son cap +Z, avant les rotations limitées.
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
 if(rayonHorizontalMajoreContinu>.5)throw new Error(`${clip.name} : borne continue non garantie.`);
 if(rayonHorizontalMax>.5)throw new Error(`${clip.name} dépasse la case après changement de cap : ${rayonHorizontalMax}`);
 if(clip.name==='tir'&&directionMarqueurZMin<.99)throw new Error('Les marqueurs ne pointent plus vers +Z.');
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5||enveloppe.min.y<-.00001)throw new Error(`${clip.name} dépasse la case ou le sol.`);
 mixer.stopAllAction();mixer.uncacheRoot(copie);
 return{nom:clip.name,nombreEchantillons:instants.length,rayonHorizontalMax,rayonHorizontalMajoreContinu,margeInterpolation,margeDeuxVoisinsTousCaps:1-2*rayonHorizontalMajoreContinu,directionMarqueurZMin,dimensionsMax:dimensionsMax.toArray(),enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
});
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — cuirasse original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify({methode:'AnimationMixer Three.js : toutes clés + 193 instants uniformes ; sommets transformés et interpolation quaternion sphérique ; rayon horizontal bornant tous les changements de cap',clips:mouvements},null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_cuirasse_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'755e446ea2dcd7057c2c63cff8cc394f3029fc5c08b12999878f7e4ebfa70c60',ancienCandidatTriangles:1124,depotsDistants:0,dateVerificationSource:'2026-09-20',verificationAvantIntegration:'coordinateur'},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière analytique en espace tangent ; aucun bake HD vers low-poly.','Coque et équipements rigides, roulis et pilonnement du corps complet.','Vitrages opaques teintés PBR sans intérieur modélisé.','Hors-jeu : pilonnement amorti, tube abaissé, témoin escamoté, aucun débris.','Atlas de matières répété : pas de motif unique par panneau.','Mesure réelle sur téléphone en attente.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
