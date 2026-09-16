/** Création originale déterministe du char moyen. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from '../../../infanterie/gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_char_moyen_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 base: { parent: 'racine', pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.17,0] },
 module_tourelle: { parent: 'corps', pivot: [0,.14,-.045] },
 module_canon_long: { parent: 'module_tourelle', pivot: [0,.072,.178] },
 socle: { parent: 'module_tourelle', pivot: [.112,.183,-.14] },
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
 const r=.079,avant=.264,arriere=-.264,droit=avant-arriere,arc=Math.PI*r,total=2*droit+2*arc;
 let s=((t%1)+1)%1*total;
 if(s<droit)return{y:.173,z:arriere+s,angle:0};s-=droit;
 if(s<arc){const a=s/r;return{y:.094+r*Math.cos(a),z:avant+r*Math.sin(a),angle:a};}s-=arc;
 if(s<droit)return{y:.015,z:avant-s,angle:Math.PI};s-=droit;
 const a=Math.PI+s/r;return{y:.094+r*Math.cos(a),z:arriere+r*Math.sin(a),angle:a};
}
/** Bande de liaison continue sous les patins, sans fermer l'ouverture latérale des galets. */
function bandeChenille(x:number): THREE.BufferGeometry {
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const n=32;
 const quads:THREE.Vector3[][]=[];
 for(let i=0;i<n;i++){
  const a=parcoursChenille(i/n),b=parcoursChenille((i+1)/n);
  const section=(q:{y:number;z:number;angle:number})=>[-1,1].flatMap(cote=>[-1,1].map(epaisseur=>new THREE.Vector3(x+cote*.046,q.y+Math.cos(q.angle)*epaisseur*.006,q.z+Math.sin(q.angle)*epaisseur*.006)));
  const aa=section(a),bb=section(b);
  for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]])quads.push([aa[j!]!,aa[k!]!,bb[k!]!,bb[j!]!]);
 }
 for(const q of quads){const depart=positions.length/3;q.forEach(v=>positions.push(...v.toArray()));uv.push(0,0,1,0,1,1,0,1);indices.push(depart,depart+2,depart+1,depart,depart+3,depart+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}


// Train porteur : six galets de route par côté, deux rouleaux de retour et patins ouverts.
for(const signe of [-1,1]) {
 const x=signe*.255;
 ajouter('base',bandeChenille(x),3,'bandes_chenille_continues');
 for(let i=0;i<24;i++) {
  const q=parcoursChenille(i/24);
  boite('base',[.110,.022,.046],[x,q.y,q.z],2,'patins_caoutchouc',[q.angle,0,0]);
  if(i%2===0)boite('base',[.088,.005,.013],[x,q.y+Math.cos(q.angle)*.012,q.z+Math.sin(q.angle)*.012],3,'nervures_liaison_patins',[q.angle,0,0]);
 }
 for(let i=0;i<6;i++) {
  const z=-.255+i*.102,r=(i===0||i===5)?.067:.060;
  cylindre('base',r,.076,[x,.092,z],2,'galets_bandages',[0,0,Math.PI/2],14);
  cylindre('base',r*.77,.009,[x+signe*.042,.092,z],5,'galets_flasques',[0,0,Math.PI/2],14);
  cylindre('base',r*.26,.014,[x+signe*.050,.092,z],3,'galets_moyeux',[0,0,Math.PI/2],10);
 }
 for(const z of [-.13,.13])cylindre('base',.028,.061,[x,.15,z],2,'rouleaux_retour',[0,0,Math.PI/2],12);
 boite('base',[.025,.055,.57],[signe*.191,.106,0],1,'longerons_chassis');
}
// Caisse large : cassure de blindage homologué sur les épaules, glacis avant incliné.
ajouter('corps',carene([
 {y:.123,largeur:.390,profondeur:.540,coupe:.065,z:0},
 {y:.208,largeur:.565,profondeur:.659,coupe:.071,z:0},
 {y:.281,largeur:.446,profondeur:.535,coupe:.083,z:-.020},
]),0,'caisse_joues_larges_equipe');
// Les jupes n'occultent que le brin supérieur : le train de roulement reste ouvert.
for(const signe of [-1,1]) {
 for(const z of [-.202,-.068,.066,.20])
  panneau('corps',[.039,.060,.123],[signe*.274,.222,z],0,'jupes_segmentees_equipe',[0,0,signe*.08],.006);
 panneau('corps',[.104,.025,.117],[signe*.240,.211,.283],5,'garde_boue_avant',[0,0,0],.006);
 panneau('corps',[.100,.025,.112],[signe*.241,.21,-.285],5,'garde_boue_arriere',[0,0,0],.006);
 // Plaques de visite arrière, sous l'écartement de la tourelle.
 boite('corps',[.136,.014,.099],[signe*.137,.269,-.235],6,'grilles_moteur',[-.07,0,0]);
 panneau('corps',[.045,.031,.019],[signe*.179,.243,.303],7,'feux_marche_avant',[0,0,0],.003);
 boite('corps',[.058,.020,.028],[signe*.167,.179,.326],3,'anneaux_remorquage_avant');
 boite('corps',[.056,.023,.028],[signe*.168,.177,-.328],3,'prises_remorquage_arriere');
}
// Trappe de conduite avec lentille étroite ; les optiques ne portent aucun reflet peint.
panneau('corps',[.118,.018,.082],[-.105,.285,.180],5,'trappe_conduite',[.11,0,0],.005);
panneau('corps',[.085,.026,.027],[-.105,.307,.202],1,'capot_periscope_conduite',[.11,0,0],.003);
boite('corps',[.063,.012,.010],[-.105,.307,.219],4,'verre_periscope_conduite');
// Verrou de route en U au-dessous du tube, contact par deux patins noirs.
for(const signe of [-1,1]) {
 boite('corps',[.020,.061,.023],[signe*.040,.309,.290],3,'verrou_route_montants');
 boite('corps',[.018,.014,.030],[signe*.029,.342,.290],2,'verrou_route_patins');
}
boite('corps',[.099,.018,.038],[0,.274,.290],5,'verrou_route_embase');
// Couronne vraie, tourelle polygonale massive et coffre arrière intégré.
cylindre('module_tourelle',.155,.028,[0,.300,-.045],3,'couronne_tourelle',[0,0,0],24);
ajouter('module_tourelle',carene([
 {y:.311,largeur:.357,profondeur:.331,coupe:.047,z:-.054},
 {y:.346,largeur:.423,profondeur:.360,coupe:.059,z:-.047},
 {y:.432,largeur:.304,profondeur:.286,coupe:.051,z:-.065},
 {y:.446,largeur:.284,profondeur:.270,coupe:.048,z:-.065},
]),0,'tourelle_prismatique_equipe');
panneau('module_tourelle',[.252,.060,.067],[0,.375,-.239],5,'coffre_tourelle_arriere',[0,0,0],.009);
// Les grosses joues triangulent réellement le raccord au mantelet.
for(const signe of [-1,1]) {
 panneau('module_tourelle',[.087,.073,.110],[signe*.132,.369,.088],0,'joues_tourelle_equipe',[0,signe*.31,signe*.12],.008);
 panneau('module_tourelle',[.020,.030,.075],[signe*.198,.353,-.078],3,'rails_accessibilite_tourelle',[0,0,0],.004);
}
panneau('module_tourelle',[.161,.090,.087],[0,.380,.134],1,'mantelet_fixe',[0,0,0],.012);
// Deux trappes différentes à l'échelle de la figurine ; poignée épaisse et viseur protégé.
cylindre('module_tourelle',.061,.014,[-.057,.453,-.098],3,'joint_trappe_commandant',[0,0,0],20);
cylindre('module_tourelle',.056,.017,[-.057,.466,-.098],0,'trappe_commandant_equipe',[0,0,0],20);
boite('module_tourelle',[.052,.021,.021],[-.057,.482,-.098],3,'poignee_trappe');
panneau('module_tourelle',[.077,.022,.090],[.065,.454,-.089],5,'trappe_service',[0,0,0],.007);
panneau('module_tourelle',[.060,.038,.049],[.080,.460,.008],1,'bloc_visee_protege',[0,0,0],.006);
boite('module_tourelle',[.040,.022,.013],[.080,.460,.035],4,'optique_visee');
// Tube rigide à recul axial, chemise thermique facettée et couronne de bouche creuse.
cylindre('module_canon_long',.038,.047,[0,.382,.172],3,'collier_recul',[Math.PI/2,0,0],16);
cylindre('module_canon_long',.029,.119,[0,.382,.251],5,'chemise_thermique',[Math.PI/2,0,0],12,.029);
cylindre('module_canon_long',.022,.170,[0,.382,.377],3,'tube_marqueur',[Math.PI/2,0,0],16,.021);
cylindre('module_canon_long',.029,.027,[0,.382,.330],5,'collier_thermique',[Math.PI/2,0,0],16);
tube('module_canon_long',.030,.018,.058,[0,.382,.451],3,'bouche_creuse',20);
// Le cylindre intérieur est reculé derrière la couronne : obturateur réel, pas disque peint.
cylindre('module_canon_long',.018,.008,[0,.382,.465],1,'obturateur_interne',[Math.PI/2,0,0],20);
// Témoin de disponibilité escamoté par hors_jeu ; socle n'est pas un piédestal.
panneau('module_tourelle',[.045,.022,.042],[.112,.480,-.185],1,'support_temoin',[0,0,0],.004);
panneau('socle',[.031,.017,.029],[.112,.496,-.185],7,'temoin_disponibilite',[0,0,0],.003);
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
 new THREE.AnimationClip('repos',2.4,[rotation('module_tourelle',[0,.6,1.8,2.4],[[0,0,0],[0,.014,0],[0,-.014,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.004,0],[0,0,0],[0,.003,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.012,0,-.008],[0,0,0],[-.012,0,.008],[0,0,0]]),rotation('module_tourelle',[0,.25,.5,.75,1],[[0,0,0],[-.008,0,.006],[0,0,0],[.008,0,-.006],[0,0,0]])]),
 new THREE.AnimationClip('tir',.7,[position('module_canon_long',[0,.08,.14,.30,.7],[[0,0,0],[0,0,-.032],[0,0,-.032],[0,0,-.012],[0,0,0]]),rotation('corps',[0,.08,.22,.7],[[0,0,0],[-.012,0,0],[.005,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.10,.24,.5],[[0,0,0],[.022,0,.035],[-.010,0,-.014],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.55,.9],[[0,0,0],[0,-.014,0],[0,-.014,0]]),rotation('corps',[0,.55,.9],[[0,0,0],[.018,0,-.018],[.018,0,-.018]]),rotation('module_tourelle',[0,.55,.9],[[0,0,0],[.026,.016,0],[.026,.016,0]]),position('module_canon_long',[0,.55,.9],[[0,0,0],[0,0,-.024],[0,0,-.024]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.35,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips);const {document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));
 document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — char moyen original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_char_moyen_base/generer.ts',sourcesExternes:[],placeholderImporte:false,ancienCandidatSha256:'7a7e5d4d28835ca702a861810b0e3f41089d3e02d2529137f41cc0c0c1c999bc',ancienCandidatTriangles:996,depotsDistants:0,dateVerificationSource:'2026-09-16'},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière créé analytiquement en espace tangent ; aucun bake HD vers low-poly.','Chenilles rigides : suspension animée sans défilement des patins.', 'Verrou de route fixe ; pointage limité dans les clips livrés.','Mesure réelle sur téléphone en attente.']};
 if(triangles>6000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');
 console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
