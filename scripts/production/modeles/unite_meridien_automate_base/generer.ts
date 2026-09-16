/** Création originale déterministe de l'automate. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from '../../../infanterie/gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_meridien_automate_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 base: { parent: 'racine', pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.16,0] },
 module_tourelle: { parent: 'corps', pivot: [0,.10,-.095] },
 module_canon_long: { parent: 'module_tourelle', pivot: [0,.05,.10] },
 module_antenne: { parent: 'module_tourelle', pivot: [-.115,.075,-.08] },
 socle: { parent: 'module_tourelle', pivot: [0,.08,.08] },
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
function tube(noeud:string,exterieur:number,interieur:number,longueur:number,p:V3,role:number,etiquette:string,n=16) {
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
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normales,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);ajouter(noeud,g,role,etiquette,p);
}
/** Chemin fermé d'une chenille autour des deux roues extrêmes ; les patins suivent la tangente. */
function parcoursChenille(t:number): {y:number;z:number;angle:number} {
 const r=.080,avant=.23,arriere=-.34,droit=avant-arriere,arc=Math.PI*r,total=2*droit+2*arc;
 let s=((t%1)+1)%1*total;
 if(s<droit)return{y:.171,z:arriere+s,angle:0};s-=droit;
 if(s<arc){const a=s/r;return{y:.091+r*Math.cos(a),z:avant+r*Math.sin(a),angle:a};}s-=arc;
 if(s<droit)return{y:.011,z:avant-s,angle:Math.PI};s-=droit;
 const a=Math.PI+s/r;return{y:.091+r*Math.cos(a),z:arriere+r*Math.sin(a),angle:a};
}
/** Bande de liaison continue sous les patins, sans fermer l'ouverture latérale des galets. */
function bandeChenille(x:number): THREE.BufferGeometry {
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const n=46;
 const quads:THREE.Vector3[][]=[];
 for(let i=0;i<n;i++){
  const a=parcoursChenille(i/n),b=parcoursChenille((i+1)/n);
  const section=(q:{y:number;z:number;angle:number})=>[-1,1].flatMap(cote=>[-1,1].map(epaisseur=>new THREE.Vector3(x+cote*.043,q.y+Math.cos(q.angle)*epaisseur*.006,q.z+Math.sin(q.angle)*epaisseur*.006)));
  const aa=section(a),bb=section(b);
  for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]])quads.push([aa[j!]!,aa[k!]!,bb[k!]!,bb[j!]!]);
 }
 for(const q of quads){const depart=positions.length/3;q.forEach(v=>positions.push(...v.toArray()));uv.push(0,0,1,0,1,1,0,1);indices.push(depart,depart+2,depart+1,depart,depart+3,depart+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// Deux flancs ouverts, galets nus lisibles, et 46 patins caoutchouc au pas régulier.
for(const signe of [-1,1]) {
 const x=signe*.258;
 ajouter('base',bandeChenille(x),3,'bandes_chenille_continues');
 for(let i=0;i<23;i++) {
  const q=parcoursChenille(i/23);
  boite('base',[.104,.022,.053],[x,q.y,q.z],2,'patins_caoutchouc',[q.angle,0,0]);
  boite('base',[.096,.008,.018],[x,q.y+Math.cos(q.angle)*.011,q.z+Math.sin(q.angle)*.011],3,'crampons_support',[q.angle,0,0]);
 }
 for(let i=0;i<6;i++) {
  const z=-.325+i*.105,r=i===0||i===5?.066:.062;
  cylindre('base',r,.074,[x,.085,z],2,'bandages_galets',[0,0,Math.PI/2],14);
  cylindre('base',r*.77,.007,[x+signe*.041,.085,z],5,'flasques_galets',[0,0,Math.PI/2],14);
  cylindre('base',r*.27,.012,[x+signe*.046,.085,z],3,'moyeux_galets',[0,0,Math.PI/2],10);
 }
 boite('base',[.038,.048,.61],[signe*.197,.096,-.055],1,'longerons');
}
// Caisse polygonale basse : les joues ne sont pas de simples cuboïdes.
ajouter('corps',carene([{y:.118,largeur:.38,profondeur:.65,coupe:.055,z:-.06},{y:.164,largeur:.51,profondeur:.72,coupe:.07,z:-.055},{y:.217,largeur:.53,profondeur:.70,coupe:.07,z:-.065},{y:.251,largeur:.42,profondeur:.59,coupe:.055,z:-.08}]),1,'caisse_inclinee');
// Plastron frontal gris d'équipe, grandes joues latérales gris clair détachées.
panneau('corps',[.31,.025,.13],[0,.239,.219],0,'plastron_equipe',[-.28,0,0]);
for(const signe of [-1,1]) {
 panneau('corps',[.064,.039,.32],[signe*.235,.229,-.062],0,'joues_equipe',[0,0,signe*.24]);
 panneau('corps',[.074,.024,.175],[signe*.245,.186,-.265],5,'garde_boue_arriere');
 panneau('corps',[.072,.021,.16],[signe*.245,.182,.22],5,'garde_boue_avant');
 // Rails de manutention / attaches : épaisseurs lisibles, aucune antenne fragile.
 cylindre('corps',.013,.048,[signe*.161,.18,.301],3,'attaches_frontales',[Math.PI/2,0,0],10);
 panneau('corps',[.074,.017,.075],[signe*.16,.252,-.326],6,'grilles_thermiques');
 for(let i=0;i<4;i++)boite('corps',[.006,.009,.057],[signe*.16-.027+i*.018,.264,-.326],1,'lamelles_thermiques');
}
panneau('corps',[.21,.021,.09],[0,.226,-.369],5,'capot_arriere');
// Couronne et tourelle compacte : profil hexagonal/octogonal, avant biseauté.
cylindre('module_tourelle',.149,.024,[0,.253,-.095],3,'couronne_tourelle',[0,0,0],24);
ajouter('module_tourelle',carene([{y:.261,largeur:.345,profondeur:.30,coupe:.075,z:-.095},{y:.296,largeur:.365,profondeur:.29,coupe:.075,z:-.095},{y:.342,largeur:.26,profondeur:.245,coupe:.060,z:-.12},{y:.35,largeur:.245,profondeur:.225,coupe:.053,z:-.12}]),0,'tourelle_equipe');
for(const signe of [-1,1]) {
 panneau('module_tourelle',[.045,.035,.16],[signe*.144,.309,-.107],5,'joues_tourelle',[0,0,signe*.48]);
 cylindre('module_tourelle',.022,.012,[signe*.183,.294,-.08],3,'axes_tourelle',[0,0,Math.PI/2],12);
}
panneau('module_tourelle',[.12,.018,.13],[0,.358,-.15],1,'trappe_technique');
panneau('module_tourelle',[.08,.018,.038],[0,.363,-.071],4,'capteur_optique');
// Bloc de recul et tube à enveloppe rigide. Bouche 38 mm lisible à l'échelle du plateau.
panneau('module_canon_long',[.11,.073,.119],[0,.306,.021],5,'berceau_tube');
cylindre('module_canon_long',.037,.24,[0,.313,.177],1,'enveloppe_tube',[Math.PI/2,0,0],16);
cylindre('module_canon_long',.043,.034,[0,.313,.086],3,'bague_de_recul',[Math.PI/2,0,0],16);
cylindre('module_canon_long',.036,.032,[0,.313,.301],3,'bague_de_bouche',[Math.PI/2,0,0],16);
tube('module_canon_long',.031,.019,.11,[0,.313,.315],5,'bouche_creuse',16);
// Fourche de route sous le tube, fixée au châssis (le tube recule dans sa fourche).
for(const signe of [-1,1])panneau('corps',[.023,.067,.035],[signe*.051,.27,.252],3,'verrou_de_route');
boite('corps',[.105,.016,.04],[0,.245,.252],1,'traverse_verrou');
// Ressort captif de l'antenne, pied rotatif et tige 24 mm, sommet à 0,50 m.
cylindre('module_antenne',.027,.025,[-.115,.349,-.175],3,'pied_antenne',[0,0,0],12);
for(let i=0;i<4;i++)cylindre('module_antenne',.021,.008,[-.115,.365+i*.009,-.175],2,'soufflet_antenne',[0,0,0],12);
cylindre('module_antenne',.012,.09,[-.115,.44,-.175],5,'antenne_epaisse',[0,0,0],12);
cylindre('module_antenne',.015,.016,[-.115,.492,-.175],1,'capuchon_antenne',[0,0,0],12);
// Témoin séparé, masqué au hors-jeu ; aucune émission animée fictive.
panneau('socle',[.037,.017,.026],[0,.35,-.015],7,'temoin_disponibilite');

// Le contour des patins inclinés dépasse de quelques millimètres leur chemin nominal.
// Centrage mesuré sur les sommets, sans échelle négative ni déplacement de racine.
const enveloppe=new THREE.Box3();
for(const pieces of morceaux.values())for(const p of pieces){p.geometrie.computeBoundingBox();enveloppe.union(p.geometrie.boundingBox!);}
const decalage=new THREE.Vector3(-(enveloppe.min.x+enveloppe.max.x)/2,-enveloppe.min.y,-(enveloppe.min.z+enveloppe.max.z)/2);
for(const pieces of morceaux.values())for(const p of pieces)p.geometrie.translate(decalage.x,decalage.y,decalage.z);
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
 new THREE.AnimationClip('repos',2.4,[rotation('module_tourelle',[0,.6,1.2,1.8,2.4],[[0,0,0],[0,.035,0],[0,0,0],[0,-.035,0],[0,0,0]]),rotation('module_antenne',[0,1.2,2.4],[[0,0,0],[.025,0,.015],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.004,0],[0,0,0],[0,.003,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.016,0,-.01],[0,0,0],[-.016,0,.01],[0,0,0]]),rotation('module_antenne',[0,.25,.5,.75,1],[[0,0,0],[-.045,0,0],[0,0,0],[.025,0,0],[0,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('module_canon_long',[0,.08,.16,.35,.7],[[0,0,0],[0,0,-.035],[0,0,-.028],[0,0,-.012],[0,0,0]]),rotation('corps',[0,.10,.24,.7],[[0,0,0],[-.016,0,0],[.012,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.10,.24,.5],[[0,0,0],[.025,0,.052],[-.012,0,-.023],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.5,.9],[[0,0,0],[0,-.017,0],[0,-.017,0]]),rotation('corps',[0,.5,.9],[[0,0,0],[.035,0,-.03],[.035,0,-.03]]),rotation('module_canon_long',[0,.55,.9],[[0,0,0],[.09,0,0],[.09,0,0]]),rotation('module_tourelle',[0,.6,.9],[[0,0,0],[0,-.12,0],[0,-.12,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.35,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips);const {document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));
 document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — automate original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_meridien_automate_base/generer.ts',sourcesExternes:[],placeholderImporte:false},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière créé analytiquement en espace tangent ; aucun bake HD vers low-poly.','Chenilles rigides : suspension animée sans défilement des patins.','Mesure réelle sur téléphone en attente.']};
 if(triangles>6000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');
 console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
