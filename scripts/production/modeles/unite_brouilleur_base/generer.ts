/** Brouilleur original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id='unite_brouilleur_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 base:{parent:'racine',pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.18,0]},
 module_radar:{parent:'corps',pivot:[0,.188,-.18]},
 module_antenne:{parent:'corps',pivot:[-.215,.065,-.255]},
 socle:{parent:'corps',pivot:[.11,.234,.27]},
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
// Six pneus larges à épaulements arrondis et vrais crampons ; aucun train de chenilles.
for(const cote of [-1,1])for(const z of [-.28,0,.28]){
 const x=cote*.254;
 const profil=[[.043,-.052],[.075,-.052],[.092,-.042],[.099,-.024],[.099,.024],[.092,.042],[.075,.052],[.043,.052]].map(([r,a])=>new THREE.Vector2(r!,a!));
 ajouter('base',new THREE.LatheGeometry(profil,16),2,'pneus_tout_terrain',[x,.104,z],[0,0,Math.PI/2]);
 cylindre('base',.052,.108,[x,.104,z],3,'jantes_embouties',[0,0,Math.PI/2],16);
 cylindre('base',.025,.118,[x,.104,z],1,'moyeux',[0,0,Math.PI/2],10);
 // Crampons inclinés en alternance, contiennent la circonférence des pneus.
 for(let k=0;k<12;k++){
  const a=k/12*Math.PI*2;
  boite('base',[.087,.010,.029],[x,.104+Math.cos(a)*.099,z+Math.sin(a)*.099],2,'crampons_moules',[a,0,(k%2?1:-1)*.08]);
 }
 boite('corps',[.124,.023,.204],[x,.224,z],5,'garde_boue_individuels');
}
// Longerons ouverts sous le plateau et trois essieux.
for(const x of [-.14,.14])boite('base',[.042,.046,.69],[x,.12,0],1,'longerons');
for(const z of [-.28,0,.28]){
 cylindre('base',.022,.46,[0,.104,z],3,'essieux',[0,0,Math.PI/2],10);
 panneau('base',[.095,.057,.075],[0,.102,z],1,'carters_differentiels',[0,0,0],.009);
}
panneau('corps',[.451,.044,.772],[0,.195,0],1,'plateau_porteur',[0,0,0],.012);
panneau('corps',[.403,.014,.468],[0,.225,-.12],8,'plancher_technique',[0,0,0],.004);
for(const z of [-.4075,.4075])panneau('corps',[.342,.031,.035],[0,.181,z],2,'pare_chocs_souples',[0,0,0],.006);
// Cabine avancée vitrée, entièrement distincte d’une casemate de char.
ajouter('corps',carene([
 {y:.218,largeur:.406,profondeur:.258,coupe:.032,z:.263},
 {y:.319,largeur:.419,profondeur:.255,coupe:.032,z:.267},
 {y:.399,largeur:.375,profondeur:.204,coupe:.029,z:.248},
]),0,'cabine_avancee');
panneau('corps',[.404,.021,.222],[0,.403,.248],0,'pavillon_cabine',[0,0,0],.008);
for(const cote of [-1,1]){
 boite('corps',[.150,.061,.012],[cote*.082,.357,.372],4,'pare_brise_incline',[-.49,0,0]);
 boite('corps',[.012,.061,.118],[cote*.198,.353,.259],4,'vitrages_lateraux',[0,0,cote*.255]);
 panneau('corps',[.012,.065,.112],[cote*.207,.271,.272],0,'portes',[0,0,0],.003);
 boite('corps',[.018,.013,.032],[cote*.217,.303,.262],3,'poignees_portes');
 boite('corps',[.054,.018,.137],[cote*.216,.221,.246],8,'marchepieds');
 boite('corps',[.042,.024,.015],[cote*.136,.266,.398],7,'feux_avant');
 boite('corps',[.052,.014,.059],[cote*.147,.422,.262],5,'nervures_pavillon');
}
boite('corps',[.132,.040,.015],[0,.27,.399],6,'grille_frontale');
// Coffrets de traitement, répartis bas sur le plateau avec ailettes et rails visibles.
for(const cote of [-1,1]){
 panneau('corps',[.101,.087,.217],[cote*.154,.272,-.084],0,'coffrets_electroniques',[0,0,0],.009);
 boite('corps',[.094,.010,.206],[cote*.154,.321,-.084],5,'couvercles_coffrets');
 boite('corps',[.013,.044,.134],[cote*.207,.278,-.084],6,'ventilations_coffrets');
 for(let k=0;k<5;k++)boite('corps',[.008,.047,.014],[cote*.215,.278,-.14+k*.028],3,'ailettes_refroidissement');
 boite('corps',[.025,.023,.092],[cote*.154,.34,-.073],3,'poignees_coffrets');
}
panneau('corps',[.282,.055,.094],[0,.255,-.323],0,'module_alimentation',[0,0,0],.007);
for(const cote of [-1,1])boite('corps',[.019,.055,.017],[cote*.118,.261,-.377],3,'verrous_module');
// Colonne fixe et étrier robuste : seule la tête tourne dans module_radar.
cylindre('corps',.053,.026,[0,.251,-.18],3,'couronne_radar',[0,0,0],20);
cylindre('corps',.034,.086,[0,.307,-.18],5,'colonne_radar',[0,0,0],12);
for(const x of [-.052,.052])boite('corps',[.023,.070,.035],[x,.335,-.18],3,'etrier_radar');
cylindre('module_radar',.021,.133,[0,.368,-.18],3,'axe_radar',[0,0,Math.PI/2],12);
/** Paraboloïde double peau à vrais creux : centre z=-.026, bord z=.024. */
function parabole():THREE.BufferGeometry{
 const p:number[]=[],uv:number[]=[],idx:number[]=[];const n=24,anneaux=4,r=.145,profondeur=.05,epaisseur=.012;
 const face=(pts:V3[],avant:boolean)=>{
  const start=p.length/3;for(const v of pts){p.push(...v);uv.push(.5+v[0]/(r*2),.5+v[1]/(r*2));}
  for(let k=1;k<pts.length-1;k++)idx.push(start,start+(avant?k:k+1),start+(avant?k+1:k));
 };
 const vertex=(ring:number,k:number,arriere:boolean):V3=>{
  const rho=r*ring/anneaux,a=k/n*Math.PI*2;return [rho*Math.cos(a),rho*Math.sin(a),-.026+profondeur*(rho/r)**2-(arriere?epaisseur:0)];
 };
 for(const arriere of [false,true]){
  for(let k=0;k<n;k++)face([vertex(0,k,arriere),vertex(1,k,arriere),vertex(1,k+1,arriere)],!arriere);
  for(let ring=1;ring<anneaux;ring++)for(let k=0;k<n;k++)face([vertex(ring,k,arriere),vertex(ring+1,k,arriere),vertex(ring+1,k+1,arriere),vertex(ring,k+1,arriere)],!arriere);
 }
 // Lèvre périmétrique avec un UV rectangulaire spécifique, pas la projection radiale dégénérée.
 for(let k=0;k<n;k++){
  const start=p.length/3;for(const v of [vertex(anneaux,k,false),vertex(anneaux,k,true),vertex(anneaux,k+1,true),vertex(anneaux,k+1,false)])p.push(...v);
  uv.push(0,0,0,1,1,1,1,0);idx.push(start,start+1,start+2,start,start+2,start+3);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
// La concavité regarde +Z et 31,5° vers le ciel dans la pose de travail.
const angleParabole=-.55,centreRadar=new THREE.Vector3(0,.368,-.18);
const orienterRadar=(v:V3)=>new THREE.Vector3(...v).applyAxisAngle(new THREE.Vector3(1,0,0),angleParabole).add(centreRadar).toArray() as V3;
ajouter('module_radar',parabole(),5,'parabole_concave',centreRadar.toArray() as V3,[angleParabole,0,0]);
ajouter('module_radar',new THREE.TorusGeometry(.145,.010,6,24),3,'bord_parabole',orienterRadar([0,0,.024]),[angleParabole,0,0]);
// Trois bras convergents épais soutiennent un récepteur court ; aucune forme de canon.
for(let k=0;k<3;k++){
 const a=k*Math.PI*2/3+Math.PI/2;
 liaison('module_radar',orienterRadar([Math.cos(a)*.123,Math.sin(a)*.123,.025]),orienterRadar([0,0,.096]),.011,3,'supports_recepteur',8);
}
const capteur=new THREE.CylinderGeometry(.025,.031,.038,12,1,false);capteur.rotateX(Math.PI/2);
ajouter('module_radar',capteur,1,'recepteur_radar',orienterRadar([0,0,.10]),[angleParabole,0,0]);
// Ressort à trois tours et fouet épaissi. Le module entier fléchit par son articulation de pied.
const piedAntenne=pivotMonde('module_antenne');
cylindre('corps',.033,.025,[piedAntenne.x,.239,piedAntenne.z],3,'embase_antenne',[0,0,0],12);
const cheminRessort:THREE.Vector3[]=[];
for(let k=0;k<=64;k++){
 const a=k/64*Math.PI*6;cheminRessort.push(new THREE.Vector3(piedAntenne.x+.020*Math.cos(a),.253+k/64*.072,piedAntenne.z+.020*Math.sin(a)));
}
ajouter('module_antenne',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cheminRessort),46,.0111,5,false),3,'ressort_antenne');
boite('module_antenne',[.056,.020,.049],[piedAntenne.x,.332,piedAntenne.z],3,'chapeau_ressort');
const fouet=new THREE.CatmullRomCurve3([new THREE.Vector3(piedAntenne.x,.329,piedAntenne.z),new THREE.Vector3(piedAntenne.x+.002,.375,piedAntenne.z+.004),new THREE.Vector3(piedAntenne.x+.012,.455,piedAntenne.z+.013),new THREE.Vector3(piedAntenne.x+.021,.502,piedAntenne.z+.019)]);
ajouter('module_antenne',new THREE.TubeGeometry(fouet,10,.012,6,false),1,'fouet_epais');
cylindre('module_antenne',.012,.020,[piedAntenne.x+.021,.501,piedAntenne.z+.019],5,'embout_antenne',[0,0,0],8);
// Le témoin seul emploie la tuile 15 émissive ; aucun écran du corps n’émet.
panneau('socle',[.043,.019,.026],pivotMonde('socle').toArray() as V3,15,'temoin_disponibilite',[0,0,0],.003);
// Origine centrée sur les sommets réels au sol, sans transformation de la racine.
const enveloppe=new THREE.Box3();for(const ps of morceaux.values())for(const p of ps){p.geometrie.computeBoundingBox();enveloppe.union(p.geometrie.boundingBox!);}
const decalage=new THREE.Vector3(-(enveloppe.min.x+enveloppe.max.x)/2,-enveloppe.min.y,-(enveloppe.min.z+enveloppe.max.z)/2);
// Translation commune intégrée aux géométries et pivots, donc conservée après animation.
for(const ps of morceaux.values())for(const p of ps)p.geometrie.translate(...decalage.toArray());
for(const p of Object.values(poses))if(p.parent==='racine')p.pivot=p.pivot.map((v,i)=>v+decalage.toArray()[i]!) as V3;
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
const clips=[
 new THREE.AnimationClip('repos',2.4,[rotation('module_radar',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.62,0],[0,0,0],[0,-.62,0],[0,0,0]]),rotation('module_antenne',[0,.6,1.2,1.8,2.4],[[0,0,0],[.018,0,.009],[0,0,0],[-.018,0,-.009],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.004,0],[0,0,0],[0,.003,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.013,0,-.008],[0,0,0],[-.013,0,.008],[0,0,0]]),rotation('module_radar',[0,.25,.5,.75,1],[[0,0,0],[.02,.18,0],[0,0,0],[-.02,-.18,0],[0,0,0]]),rotation('module_antenne',[0,.25,.5,.75,1],[[0,0,0],[-.06,0,.045],[0,0,0],[.06,0,-.045],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.1,.25,.5],[[0,0,0],[.018,0,.042],[-.008,0,-.019],[0,0,0]]),rotation('module_radar',[0,.12,.28,.5],[[0,0,0],[-.09,.1,0],[.035,-.045,0],[0,0,0]]),rotation('module_antenne',[0,.10,.25,.5],[[0,0,0],[.07,0,-.11],[-.03,0,.05],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.55,.9],[[0,0,0],[0,-.015,0],[0,-.015,0]]),rotation('corps',[0,.55,.9],[[0,0,0],[.015,0,-.018],[.015,0,-.018]]),rotation('module_radar',[0,.6,.9],[[0,0,0],[-1.02,0,0],[-1.02,0,0]]),rotation('module_antenne',[0,.6,.9],[[0,0,0],[1.1,0,0],[1.1,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
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
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let rayon=0;
 for(let deg=0;deg<=360;deg++){objets.get('module_radar')!.rotation.set(0,deg*Math.PI/180,0);const m=mesurer();for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,m.min[a]!);max[a]=Math.max(max[a]!,m.max[a]!);}rayon=Math.max(rayon,m.rayon);}reset();
 return {id,methode:'Sommets transformés Three.js, 193 instants par clip et clés exactes ; balayage radar 360° par pas de 1°.',clips:resultats,balayageRadar:{nombreEchantillons:361,min,max,rayonHorizontalMax:rayon},limites:['Échantillonnage numérique, sans contrôle visuel.','Aucun certificat de collision interne ni de mélanges entre clips.']};
}
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const mesures=mouvements();
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),canaux=['albedo','normale','rugosite','metal','masque_equipe','emission'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.6};if(m.name==='mat_details'){m.emissiveTexture={index:5};m.emissiveFactor=[.4,.4,.4];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — brouilleur original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>6000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_brouilleur_base/generer.ts',sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,parabole:{rayon:.145,profondeur:.05,epaisseur:.012,angleVerticalDeg:31.512678732,orientation:'+Z relevé vers +Y'},limites:['Pas de rendu ni contrôle visuel.','Pneus rigides ; suspension portée par corps sans rotation de roues.','Fouet déformé statiquement et animé par rotation de son pied, sans peau souple.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
