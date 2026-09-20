/** Drone ravitailleur original ; aucune géométrie ni texture de l’ancien candidat importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string; os: number };
const id='unite_drone_ravitailleur_base';
const sortie=path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux=new Map<string,Piece[]>();
const bilan:Record<string,number>={};
let osCourant=0;
const poses:Record<string,{parent:string|null;pivot:V3}>={
 racine:{parent:null,pivot:[0,0,0]},
 corps:{parent:'racine',pivot:[0,.43,0]},
 base:{parent:'corps',pivot:[0,0,0]},
 module_grue:{parent:'corps',pivot:[0,-.003,-.275]},
 module_nacelle:{parent:'corps',pivot:[0,-.025,0]},
 socle:{parent:'corps',pivot:[0,.085,-.306]},
 os_rotor_gauche:{parent:'corps',pivot:[-.225,.175,0]},
 os_rotor_droit:{parent:'corps',pivot:[.225,.175,0]},
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

// Les anneaux fixes sont de vraies parois ouvertes, avec épaisseur et lèvre de protection.
const profilGarde=[new THREE.Vector2(.171,-.035),new THREE.Vector2(.194,-.035),new THREE.Vector2(.205,-.022),new THREE.Vector2(.205,.025),new THREE.Vector2(.193,.039),new THREE.Vector2(.171,.039),new THREE.Vector2(.171,-.035)];
for(const [i,s] of [-1,1].entries()){
 const x=s*.225;
 ajouter('corps',new THREE.LatheGeometry(profilGarde,28),1,'carenages_rotors',[x,.600,0]);
 // Croix de support sous les pales, sans fermeture de l'ouverture du rotor.
 for(const a of [0,Math.PI/2])boite('corps',[.313,.020,.023],[x,.562,0],5,'croisillons_support_rotor',[0,a,0]);
 cylindre('corps',.046,.074,[x,.575,0],3,'moteurs_rotors',[0,0,0],16);
 // Les pales et le moyeu sont rigidement pondérés à l'os centré de CE rotor.
 osCourant=i;
 cylindre('base',.045,.040,[x,.610,0],3,'moyeux_rotatifs',[0,0,0],16,.035);
 cylindre('base',.024,.056,[x,.657,0],1,'capuchons_axes',[0,0,0],12,.016);
 for(let pale=0;pale<4;pale++){
  const a=pale*Math.PI/2+s*.12;
  const g=carene([{y:-.009,largeur:.039,profondeur:.119,coupe:.012},{y:.009,largeur:.039,profondeur:.119,coupe:.012}]);
  g.translate(.016,0,.100);g.rotateY(a);ajouter('base',g,2,'pales_composite',[x,.605,0]);
 }
 // Des bras courts porteurs raccordent le châssis aux gardes de rotor.
 for(const z of [-.19,.19])panneau('corps',[.182,.035,.060],[s*.164,.523,z],5,'bras_porteurs',[0,s*z*.5,0],.007);
}
// Châssis allongé à bouts chanfreinés, avec capot de service et capteur avant.
panneau('corps',[.300,.079,.850],[0,.483,0],1,'chassis_trapu',[0,0,0],.052);
panneau('corps',[.251,.026,.321],[0,.535,-.147],0,'capot_equipe_dessus',[0,0,0],.023);
panneau('corps',[.240,.090,.211],[0,.551,.260],0,'pod_capteurs_avant',[0,0,0],.025);
panneau('corps',[.193,.052,.020],[0,.563,.369],3,'cadre_vitrage_capteurs',[.08,0,0],.006);
panneau('corps',[.163,.033,.013],[0,.563,.384],4,'vitrage_capteurs_sans_passager',[.08,0,0],.004);
for(const s of [-1,1]){
 panneau('corps',[.022,.052,.187],[s*.153,.483,.219],0,'bande_equipe_laterale',[0,0,0],.005);
 boite('corps',[.032,.019,.143],[s*.090,.541,-.182],6,'grilles_service');
 cylindre('corps',.018,.017,[s*.070,.540,-.329],3,'verrous_capot',[0,0,0],8);
}
// La caisse fermée se détache du châssis. Les larges portes suggèrent deux modules
// batteries / marqueurs sans exposer de tubes, de munitions ni de poste d'équipage.
panneau('module_nacelle',[.316,.219,.521],[0,.293,-.017],5,'nacelle_logistique_fermee',[0,0,0],.025);
for(const s of [-1,1]){
 panneau('module_nacelle',[.021,.158,.367],[s*.167,.299,-.017],0,'portes_equipe_nacelle',[0,0,0],.006);
 for(const z of [-.204,.169])boite('module_nacelle',[.024,.143,.025],[s*.164,.297,z],3,'verrous_verticaux_caisse');
 boite('module_nacelle',[.022,.037,.072],[s*.182,.317,-.018],3,'poignees_caisse');
}
for(const z of [-.192,.162])boite('module_nacelle',[.346,.024,.024],[0,.227,z],2,'raidisseurs_caisse');
panneau('module_nacelle',[.236,.151,.020],[0,.295,.251],5,'porte_frontale_nacelle',[0,0,0],.008);
panneau('module_nacelle',[.181,.089,.022],[0,.300,-.287],2,'boitier_connectique_ferme',[0,0,0],.009);
for(const s of [-1,1])cylindre('module_nacelle',.026,.011,[s*.050,.300,-.304],3,'capuchons_connecteurs',[Math.PI/2,0,0],10);
// Deux patins continus et quatre montants, dimensionnés pour une caisse épaisse.
for(const s of [-1,1]){
 panneau('corps',[.045,.038,.647],[s*.192,.076,-.007],2,'patins_atterrissage',[0,0,0],.010);
 for(const z of [-.225,.215]){
  boite('corps',[.028,.325,.036],[s*.192,.251,z],3,'montants_train');
  cylindre('corps',.026,.040,[s*.192,.421,z],5,'articulations_train',[0,0,Math.PI/2],8);
 }
}
// Bras de manutention replié contre l'arrière. Il reste au-dessus de la caisse.
cylindre('corps',.039,.055,[0,.427,-.275],3,'charniere_grue',[0,0,Math.PI/2],12);
panneau('module_grue',[.061,.034,.227],[0,.420,-.183],5,'bras_grue_replie',[.08,0,0],.008);
panneau('module_grue',[.046,.032,.151],[0,.445,-.129],3,'retour_bras_grue',[.12,0,0],.006);
boite('module_grue',[.088,.038,.026],[0,.450,-.062],2,'pince_logistique_fermee');
boite('socle',[.032,.020,.037],pivotMonde('socle').toArray() as V3,7,'temoin_disponibilite');
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
const clips=[
 new THREE.AnimationClip('repos',2.4,[...rotors(2.4,4),position('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.009,0],[0,.004,0],[0,.009,0],[0,0,0]]),rotation('corps',[0,.6,1.2,1.8,2.4],[[0,0,0],[.009,0,.011],[0,0,0],[-.009,0,-.011],[0,0,0]]),rotation('module_nacelle',[0,.6,1.2,1.8,2.4],[[0,0,0],[-.014,0,-.012],[0,0,0],[.014,0,.012],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[...rotors(1,3),position('corps',[0,.25,.5,.75,1],[[0,.019,0],[0,.025,0],[0,.019,0],[0,.025,0],[0,.019,0]]),rotation('corps',[0,.25,.5,.75,1],[[-.055,0,0],[-.045,0,.016],[-.055,0,0],[-.045,0,-.016],[-.055,0,0]]),rotation('module_nacelle',[0,.25,.5,.75,1],[[.022,0,0],[.012,0,-.012],[.022,0,0],[.012,0,.012],[.022,0,0]]),rotation('module_grue',[0,.5,1],[[.03,0,0],[.022,0,0],[.03,0,0]])]),
 new THREE.AnimationClip('touche',.5,[...rotors(.5,1),position('corps',[0,.1,.28,.5],[[0,0,0],[0,.030,0],[0,.015,0],[0,0,0]]),rotation('corps',[0,.1,.28,.5],[[0,0,0],[.054,0,.045],[-.035,0,-.027],[0,0,0]]),rotation('module_nacelle',[0,.1,.28,.5],[[0,0,0],[-.032,0,-.024],[.017,0,.014],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[...rotors(.9,1,true),position('corps',[0,.57,.9],[[0,0,0],[0,-.012,0],[0,-.012,0]]),rotation('corps',[0,.57,.9],[[0,0,0],[.016,0,-.038],[.016,0,-.038]]),rotation('module_nacelle',[0,.57,.9],[[0,0,0],[-.016,0,.028],[-.016,0,.028]]),rotation('module_grue',[0,.57,.9],[[0,0,0],[.07,0,0],[.07,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.25,.52,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
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
  const instants=new Set<number>(Array.from({length:385},(_,i)=>i/384*clip.duration));clip.tracks.forEach(tr=>Array.from(tr.times).forEach(t=>instants.add(t)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let rayon=0;
  for(const t of [...instants].sort((a,b)=>a-b)){mixer.setTime(t);const m=mesurer();for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,m.min[a]!);max[a]=Math.max(max[a]!,m.max[a]!);}rayon=Math.max(rayon,m.rayon);}
  mixer.stopAllAction();mixer.uncacheRoot(racine);return {nom:clip.name,nombreEchantillons:instants.size,enveloppe:{min,max},rayonHorizontalMax:rayon};
 });reset();return {id,methode:'Sommets transformés Three.js avec skin, 385 instants par clip et clés exactes.',clips:resultats,limites:['Échantillonnage numérique, sans contrôle visuel.','Aucun certificat de collisions internes ni de mélanges entre clips.']};
}
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const mesures=mouvements();
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.6};}
 document.asset={version:'2.0',generator:'Atlas Tournament — drone ravitailleur original paramétrique v1',extras:{source:'creation_originale',unite:'metre',haut:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>3500)throw new Error(`Budget dépassé : ${triangles} ${JSON.stringify(bilan)}`);
 writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);writeFileSync(path.join(sortie,'mesures-mouvements.json'),JSON.stringify(mesures,null,2)+'\n');
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:`scripts/production/modeles/${id}/generer.ts`,sourcesExternes:[],candidatImporte:false},triangles,budgetTriangles:3500,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false,rotors:{noeuds:['os_rotor_gauche','os_rotor_droit'],axe:'+Y',maillage:'base',poidsRigides:true,rayonInterieurGarde:.171,animationGLB:true},limites:['Pas de rendu ni contrôle visuel.','Deux rotors à poids rigides sur deux os, carénages fixes.','Nacelle fermée sans contenu ou personnage modélisé.','Bras logistique à articulation unique, sans simulation physique.','Aucun bake HD ni essai téléphone.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
