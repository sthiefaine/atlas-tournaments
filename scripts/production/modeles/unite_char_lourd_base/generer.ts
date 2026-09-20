/** Création originale déterministe du char lourd. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from '../../../infanterie/gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_char_lourd_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 base: { parent: 'racine', pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.20,0] },
 module_tourelle: { parent: 'corps', pivot: [0,.14,.07] },
 module_canon_long: { parent: 'module_tourelle', pivot: [0,.081,.23] },
 socle: { parent: 'module_tourelle', pivot: [-.16,.178,-.10] },
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

/** Chemin fermé d'une chenille autour des deux roues extrêmes ; les patins suivent la tangente. */
function parcoursChenille(t:number): {y:number;z:number;angle:number} {
 const r=.094,avant=.295,arriere=-.295,droit=avant-arriere,arc=Math.PI*r,total=2*droit+2*arc;
 let s=((t%1)+1)%1*total;
 if(s<droit)return{y:.205,z:arriere+s,angle:0};s-=droit;
 if(s<arc){const a=s/r;return{y:.111+r*Math.cos(a),z:avant+r*Math.sin(a),angle:a};}s-=arc;
 if(s<droit)return{y:.017,z:avant-s,angle:Math.PI};s-=droit;
 const a=Math.PI+s/r;return{y:.111+r*Math.cos(a),z:arriere+r*Math.sin(a),angle:a};
}
/** Bande de liaison continue sous les patins, sans fermer l'ouverture latérale des galets. */
function bandeChenille(x:number): THREE.BufferGeometry {
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const n=32;
 const quads:THREE.Vector3[][]=[];
 for(let i=0;i<n;i++){
  const a=parcoursChenille(i/n),b=parcoursChenille((i+1)/n);
  const section=(q:{y:number;z:number;angle:number})=>[-1,1].flatMap(cote=>[-1,1].map(epaisseur=>new THREE.Vector3(x+cote*.052,q.y+Math.cos(q.angle)*epaisseur*.006,q.z+Math.sin(q.angle)*epaisseur*.006)));
  const aa=section(a),bb=section(b);
  for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]])quads.push([aa[j!]!,aa[k!]!,bb[k!]!,bb[j!]!]);
 }
 for(const q of quads){const depart=positions.length/3;q.forEach(v=>positions.push(...v.toArray()));uv.push(0,0,1,0,1,1,0,1);indices.push(depart,depart+2,depart+1,depart,depart+3,depart+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}


/** Câble lové en ovale : la section ronde et la boucle sont de la géométrie. */
function cableLove(signe:number) {
 const points:THREE.Vector3[]=[];
 for(let i=0;i<33;i++){
  const a=i/32*Math.PI*2;
  points.push(new THREE.Vector3(signe*(.327+.004*Math.sin(a*2)),.265+.031*Math.sin(a),-.035+.142*Math.cos(a)));
 }
 const courbe=new THREE.CatmullRomCurve3(points.slice(0,-1),true,'centripetal');
 ajouter('corps',new THREE.TubeGeometry(courbe,28,.010,6,true),3,'cables_remorquage_loves');
 for(const z of [-.13,.06])boite('corps',[.028,.023,.026],[signe*.329,.286,z],5,'brides_cables');
}

// Un train lourd à sept galets de route, plus roues de renvoi et barbotins séparés.
// Les jupes laissent les galets inférieurs visibles ; aucune plaque ne bouche les ouvertures.
for(const signe of [-1,1]) {
 const x=signe*.286;
 ajouter('base',bandeChenille(x),3,'bandes_chenille_continues');
 for(let i=0;i<30;i++) {
  const q=parcoursChenille(i/30);
  boite('base',[.126,.023,.046],[x,q.y,q.z],2,'patins_caoutchouc',[q.angle,0,0]);
  if(i%2===0)boite('base',[.103,.006,.015],[x,q.y+Math.cos(q.angle)*.014,q.z+Math.sin(q.angle)*.014],3,'nervures_liaison_patins',[q.angle,0,0]);
 }
 for(let i=0;i<7;i++) {
  const z=-.237+i*.079;
  cylindre('base',.054,.084,[x,.078,z],2,'galets_route_bandages',[0,0,Math.PI/2],14);
  cylindre('base',.041,.010,[x+signe*.046,.078,z],5,'galets_route_flasques',[0,0,Math.PI/2],14);
  cylindre('base',.016,.017,[x+signe*.053,.078,z],3,'galets_route_moyeux',[0,0,Math.PI/2],12);
 }
 for(const z of [-.295,.295]) {
  cylindre('base',.072,.078,[x,.111,z],2,'roues_extremes_bandages',[0,0,Math.PI/2],16);
  cylindre('base',.055,.013,[x+signe*.048,.111,z],3,'barbotin_renvoi_flasques',[0,0,Math.PI/2],12);
  cylindre('base',.023,.023,[x+signe*.057,.111,z],1,'barbotin_renvoi_moyeux',[0,0,Math.PI/2],12);
 }
 for(const z of [-.15,0,.15])cylindre('base',.026,.075,[x,.172,z],2,'rouleaux_retour',[0,0,Math.PI/2],10);
 boite('base',[.038,.070,.62],[signe*.216,.116,0],1,'longerons_chassis');
}

// Caisse multicouche aux épaules larges. Le glacis +Z reste distinct du plateau moteur -Z.
ajouter('corps',carene([
 {y:.128,largeur:.441,profondeur:.623,coupe:.066,z:.015},
 {y:.238,largeur:.646,profondeur:.767,coupe:.061,z:.015},
 {y:.305,largeur:.554,profondeur:.662,coupe:.094,z:-.006},
 {y:.320,largeur:.540,profondeur:.628,coupe:.089,z:-.014},
]),5,'caisse_joues_larges_inclinees');
// Deux épaisses joues frontales en V, géométrie lisible même sans texture.
for(const signe of [-1,1]) {
 panneau('corps',[.229,.032,.134],[signe*.125,.278,.318],5,'plaques_glacis_frontales',[-.40,signe*.11,0],.009);
 // Cinq jupes profondes couvrent le haut du train porteur, séparées par des joints réels.
 for(const z of [-.264,-.132,0,.132,.264])
  panneau('corps',[.041,.112,.122],[signe*.324,.213,z],0,'jupes_equipe_profondes',[0,0,signe*.065],.005);
 panneau('corps',[.128,.022,.088],[signe*.270,.242,.333],5,'garde_boue_avant',[0,0,0],.006);
 panneau('corps',[.123,.024,.092],[signe*.268,.238,-.332],5,'garde_boue_arriere',[0,0,0],.006);
 panneau('corps',[.143,.025,.123],[signe*.156,.319,-.254],1,'cadres_refroidissement',[0,0,0],.004);
 boite('corps',[.117,.010,.094],[signe*.156,.336,-.254],6,'grilles_refroidissement');
 for(let i=0;i<5;i++)boite('corps',[.117,.007,.006],[signe*.156,.342,-.291+i*.018],5,'lames_refroidissement');
 panneau('corps',[.056,.029,.024],[signe*.199,.249,.368],1,'capots_feux_avant',[0,0,0],.004);
 boite('corps',[.042,.017,.010],[signe*.199,.249,.384],7,'lentilles_feux_avant');
 boite('corps',[.064,.032,.031],[signe*.188,.158,.356],3,'crochets_remorquage_avant');
 boite('corps',[.064,.032,.031],[signe*.188,.158,-.361],3,'crochets_remorquage_arriere');
 cableLove(signe);
}
panneau('corps',[.116,.021,.072],[-.145,.304,.296],5,'trappe_conducteur',[.12,0,0],.006);
panneau('corps',[.081,.025,.032],[-.145,.320,.316],1,'protection_periscope_conducteur',[0,0,0],.004);
boite('corps',[.061,.013,.011],[-.145,.321,.336],4,'lentille_periscope_conducteur');

// Tourelle en coin très large : ceinture de flancs d'équipe et dos de coffre prismatique.
cylindre('module_tourelle',.194,.027,[0,.333,.07],3,'couronne_tourelle',[0,0,0],28);
ajouter('module_tourelle',carene([
 {y:.346,largeur:.438,profondeur:.385,coupe:.055,z:.067},
 {y:.382,largeur:.514,profondeur:.417,coupe:.069,z:.062},
 {y:.470,largeur:.437,profondeur:.355,coupe:.074,z:.084},
]),0,'tourelle_flancs_equipe');
ajouter('module_tourelle',carene([
 {y:.471,largeur:.439,profondeur:.357,coupe:.075,z:.084},
 {y:.490,largeur:.395,profondeur:.328,coupe:.071,z:.089},
]),5,'toit_tourelle_epais');
panneau('module_tourelle',[.334,.070,.068],[0,.423,.280],5,'coffre_tourelle_biseaute',[0,0,0],.012);
for(const signe of [-1,1]) {
 panneau('module_tourelle',[.121,.089,.121],[signe*.159,.411,-.087],0,'joues_tourelle_massives',[0,-signe*.26,-signe*.08],.010);
 panneau('module_tourelle',[.025,.028,.096],[signe*.244,.387,.097],3,'prises_manipulation_tourelle',[0,0,0],.004);
}
panneau('module_tourelle',[.172,.101,.099],[0,.420,-.135],1,'mantelet_fixe', [0,0,0],.014);
// Une vraie coupole étagée, avec couronne optique et couvercle épais. Aucun emblème.
cylindre('module_tourelle',.074,.019,[-.090,.495,.119],3,'coupole_couronne',[0,0,0],24);
cylindre('module_tourelle',.065,.042,[-.090,.522,.119],1,'coupole_corps',[0,0,0],24,.062);
for(let i=0;i<6;i++) {
 const a=i*Math.PI/3;
 boite('module_tourelle',[.033,.018,.010],[-.090+Math.sin(a)*.062,.527,.119+Math.cos(a)*.062],4,'episcopes_coupole',[0,a,0]);
}
cylindre('module_tourelle',.072,.019,[-.090,.552,.119],5,'coupole_couvercle',[0,0,0],24,.067);
boite('module_tourelle',[.049,.022,.022],[-.090,.572,.119],3,'poignee_coupole');
panneau('module_tourelle',[.099,.020,.097],[.094,.501,.115],5,'trappe_chargeur',[0,0,0],.007);
panneau('module_tourelle',[.071,.043,.058],[.100,.499,-.033],1,'boitier_visee',[0,0,0],.007);
boite('module_tourelle',[.049,.024,.011],[.100,.498,-.067],4,'lentille_visee');

// Construction de la tourelle dans sa pose de transport ; l'ensemble sera réorienté +Z.
// La pose de référence est celle du tir, la pose arrière est portée par deplacement.
cylindre('module_canon_long',.049,.058,[0,.421,-.176],3,'collier_recul',[Math.PI/2,0,0],20);
cylindre('module_canon_long',.038,.171,[0,.421,-.278],5,'chemise_thermique_facettee',[Math.PI/2,0,0],12);
cylindre('module_canon_long',.027,.019,[0,.421,-.347],3,'tube_marqueur_long',[Math.PI/2,0,0],20);
cylindre('module_canon_long',.039,.021,[0,.421,-.346],5,'collier_chemise',[Math.PI/2,0,0],16);
tube('module_canon_long',.037,.023,.066,[0,.421,-.344],3,'bouche_creuse_reelle',24,[0,Math.PI,0]);
cylindre('module_canon_long',.023,.009,[0,.421,-.359],1,'obturateur_interieur',[Math.PI/2,0,0],20);
// Berceau en U autour de la chemise, deux appuis caoutchoutés et traverses épaisses.
panneau('corps',[.139,.023,.064],[0,.326,-.309],5,'verrou_route_embase',[0,0,0],.005);
for(const signe of [-1,1]){
 boite('corps',[.024,.070,.026],[signe*.052,.369,-.327],3,'verrou_route_montants');
 boite('corps',[.025,.017,.032],[signe*.026,.382,-.327],2,'verrou_route_appuis');
}
boite('corps',[.119,.021,.029],[0,.351,-.327],3,'verrou_route_traverse');
// socle est le témoin rétractable de disponibilité, pas un piédestal.
panneau('module_tourelle',[.046,.023,.046],[.160,.499,.17],1,'support_temoin',[0,0,0],.004);
panneau('socle',[.032,.020,.032],[.160,.518,.17],7,'temoin_disponibilite',[0,0,0],.003);
// La racine regarde +Z, comme les tirs du jeu. Rotation propre (sans échelle négative)
// de toute la superstructure autour de la couronne, qui reste au-dessus du châssis.
for(const nom of ['module_tourelle','module_canon_long','socle'])
 for(const p of morceaux.get(nom)??[])p.geometrie.rotateY(Math.PI).translate(0,0,.14);
// Le contour des patins inclinés dépasse de quelques millimètres leur chemin nominal.
// Centrage mesuré sur les sommets, sans échelle négative ni déplacement de racine.
const enveloppe=new THREE.Box3();
for(const pieces of morceaux.values())for(const p of pieces){p.geometrie.computeBoundingBox();enveloppe.union(p.geometrie.boundingBox!);}
const decalage=new THREE.Vector3(-(enveloppe.min.x+enveloppe.max.x)/2,-enveloppe.min.y,-(enveloppe.min.z+enveloppe.max.z)/2);
for(const pieces of morceaux.values())for(const p of pieces)p.geometrie.translate(decalage.x,decalage.y,decalage.z);
// Les pivots d'attache suivent exactement le même recentrage que leur géométrie.
for(const pose of Object.values(poses))if(pose.parent==='racine')pose.pivot=pose.pivot.map((v,i)=>v+decalage.getComponent(i)) as V3;
const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();
for(const [nom,pose] of Object.entries(poses)) {
 const pieces=morceaux.get(nom)??[];
 let objet:THREE.Object3D;
 if(pieces.length){
  const groupes:THREE.BufferGeometry[]=[];const materiauxGroupes:number[]=[];
  for(const mat of [0,1]){
   const gs=pieces.filter(p=>(p.role===0?0:1)===mat).map(p=>{
    let g=p.geometrie.index?p.geometrie.toNonIndexed():p.geometrie.clone();
    const pm=pivotMonde(nom);g.translate(-pm.x,-pm.y,-pm.z);return g;
   });
   if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-6);g.computeTangents();groupes.push(g);materiauxGroupes.push(mat);}
  }
  const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=materiauxGroupes[i]!);
  objet=new THREE.Mesh(g,materiaux);g.computeBoundingBox();
 } else objet=new THREE.Group();
 objet.name=nom;objet.position.set(...pose.pivot);objets.set(nom,objet);
}
for(const [nom,pose] of Object.entries(poses))if(pose.parent)objets.get(pose.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const bornes=new THREE.Box3().setFromObject(racine),dimensions=bornes.getSize(new THREE.Vector3());
const quat=(r:V3)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray();
const rotation=(nom:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(quat));
const position=(nom:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(p=>p.map((n,i)=>n+poses[nom]!.pivot[i]!)));
const clips=[
 new THREE.AnimationClip('repos',2.4,[rotation('module_tourelle',[0,.6,1.8,2.4],[[0,0,0],[0,.006,0],[0,-.006,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.0025,0],[0,0,0],[0,.002,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.012,0,-.008],[0,0,0],[-.012,0,.008],[0,0,0]]),rotation('module_tourelle',[0,.25,.5,.75,1],[[0,Math.PI,0],[-.006,Math.PI,.005],[0,Math.PI,0],[.006,Math.PI,-.005],[0,Math.PI,0]])]),
 new THREE.AnimationClip('tir',.7,[rotation('module_tourelle',[0,.7],[[0,0,0],[0,0,0]]),position('module_canon_long',[0,.08,.14,.30,.7],[[0,0,0],[0,0,-.036],[0,0,-.036],[0,0,-.010],[0,0,0]]),rotation('corps',[0,.08,.22,.7],[[0,0,0],[-.012,0,0],[.005,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.10,.24,.5],[[0,0,0],[.022,0,.035],[-.010,0,-.014],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.55,.9],[[0,0,0],[0,-.014,0],[0,-.014,0]]),rotation('corps',[0,.55,.9],[[0,0,0],[.018,0,-.018],[.018,0,-.018]]),rotation('module_tourelle',[0,.55,.9],[[0,0,0],[.026,.016,0],[.026,.016,0]]),position('module_canon_long',[0,.55,.9],[[0,0,0],[0,0,-.024],[0,0,-.024]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.35,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
// Mesure numérique des cinq clips, y compris leurs clés et les poses intermédiaires.
// Ce relevé ne rend aucune image et ne vaut pas revue artistique.
const mouvements=clips.map(clip=>{
 const copie=racine.clone(true),mixer=new THREE.AnimationMixer(copie);
 const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const instants=[...new Set([0,clip.duration,...Array.from({length:21},(_,i)=>i*clip.duration/20),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const enveloppe=new THREE.Box3(),dimensionsMax=new THREE.Vector3();
 let directionZMin=1,directionZMax=-1;
 for(const t of instants){
  mixer.setTime(t);copie.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(copie);enveloppe.union(box);dimensionsMax.max(box.getSize(new THREE.Vector3()));
  const direction=new THREE.Vector3(0,0,1).transformDirection(copie.getObjectByName('module_canon_long')!.matrixWorld);
  directionZMin=Math.min(directionZMin,direction.z);directionZMax=Math.max(directionZMax,direction.z);
 }
 if(dimensionsMax.x>=1||dimensionsMax.z>=1)throw new Error(`${clip.name} dépasse une case : ${dimensionsMax.toArray()}`);
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5)throw new Error(`${clip.name} sort des limites de la case.`);
 if(enveloppe.min.y < -1e-5)throw new Error(`${clip.name} passe sous le sol : ${enveloppe.min.y}`);
 if(clip.name==='tir'&&directionZMin<.99)throw new Error('Le tube doit tirer vers +Z.');
 if(clip.name==='deplacement'&&directionZMax>-.99)throw new Error('Le tube doit être transporté vers -Z.');
 mixer.stopAllAction();mixer.uncacheRoot(copie);
 return{nom:clip.name,nombreEchantillons:instants.length,dimensionsMax:dimensionsMax.toArray(),enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},directionTubeZ:{min:directionZMin,max:directionZMax}};
});
// Le mélangeur peut traverser les orientations entre route et tir. Mesurer la slerp
// complète évite qu'un tube conforme dans les deux poses dépasse latéralement au milieu.
const balayageTourelle=(()=>{
 const copie=racine.clone(true),tourelle=copie.getObjectByName('module_tourelle')!;
 const debut=new THREE.Quaternion(),fin=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
 const enveloppe=new THREE.Box3();
 for(let i=0;i<=40;i++){
  tourelle.quaternion.slerpQuaternions(debut,fin,i/40);copie.updateMatrixWorld(true);
  enveloppe.union(new THREE.Box3().setFromObject(copie));
 }
 if(Math.max(Math.abs(enveloppe.min.x),Math.abs(enveloppe.max.x),Math.abs(enveloppe.min.z),Math.abs(enveloppe.max.z))>.5)throw new Error('Balayage de la tourelle hors de la case.');
 return{methode:'slerp des quaternions de 0 à π',nombreEchantillons:41,enveloppe:{min:enveloppe.min.toArray(),max:enveloppe.max.toArray()},resteDansCase:true};
})();
async function ecrire(){
 mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips);const {document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));
 document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — char lourd original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify({methode:'AnimationMixer Three.js : clés + 21 instants uniformes, interpolation quaternion sphérique',clips:mouvements,balayageTourelle},null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_char_lourd_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'a0750ff6917d4e0f9b8e39163b14af0a74e9d35f64760f203de6f053d722a496',ancienCandidatTriangles:996,depotsDistants:0,dateVerificationSource:'2026-09-20'},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière créé analytiquement en espace tangent ; aucun bake HD vers low-poly.','Chenilles rigides : suspension animée sans défilement des patins.', 'Pose active et tir vers +Z ; deplacement tourne la tourelle à 180 degrés au-dessus du plateau arrière. Pas de clip autonome de mise en batterie, transition gérée par le mélangeur du jeu.', 'Verrou de route fixe ; pointage limité dans les clips livrés.','Mesure réelle sur téléphone en attente.']};
 if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');
 console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
