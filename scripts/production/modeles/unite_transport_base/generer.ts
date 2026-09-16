/** Création originale déterministe du transport. Aucun modèle source externe ni placeholder importé. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb } from '../../../infanterie/gltf';

type V3 = [number, number, number];
type Piece = { geometrie: THREE.BufferGeometry; role: number; etiquette: string };
const id = 'unite_transport_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const morceaux = new Map<string, Piece[]>();
const bilan: Record<string, number> = {};
const poses: Record<string, { parent: string | null; pivot: V3 }> = {
 racine: { parent: null, pivot: [0,0,0] },
 base: { parent: 'racine', pivot: [0,0,0] },
 corps: { parent: 'racine', pivot: [0,.16,0] },
 module_grue: { parent: 'corps', pivot: [-.202,.12,.028] },
 socle: { parent: 'corps', pivot: [.135,.305,.245] },
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
/** Chemin fermé d'une chenille autour des deux roues extrêmes ; les patins suivent la tangente. */
function parcoursChenille(t:number): {y:number;z:number;angle:number} {
 const r=.074,avant=.274,arriere=-.274,droit=avant-arriere,arc=Math.PI*r,total=2*droit+2*arc;
 let s=((t%1)+1)%1*total;
 if(s<droit)return{y:.163,z:arriere+s,angle:0};s-=droit;
 if(s<arc){const a=s/r;return{y:.089+r*Math.cos(a),z:avant+r*Math.sin(a),angle:a};}s-=arc;
 if(s<droit)return{y:.015,z:avant-s,angle:Math.PI};s-=droit;
 const a=Math.PI+s/r;return{y:.089+r*Math.cos(a),z:arriere+r*Math.sin(a),angle:a};
}
/** Bande de liaison continue sous les patins, sans fermer l'ouverture latérale des galets. */
function bandeChenille(x:number): THREE.BufferGeometry {
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const n=40;
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

// Chenilles ouvertes : la surface ne remplit jamais l'espace entre les galets.
for(const signe of [-1,1]) {
 const x=signe*.256;
 ajouter('base',bandeChenille(x),3,'bandes_chenille_continues');
 for(let i=0;i<24;i++) {
  const q=parcoursChenille(i/24);
  boite('base',[.108,.020,.046],[x,q.y,q.z],2,'patins_caoutchouc',[q.angle,0,0]);
  boite('base',[.097,.006,.016],[x,q.y+Math.cos(q.angle)*.011,q.z+Math.sin(q.angle)*.011],3,'crampons_support',[q.angle,0,0]);
 }
 for(let i=0;i<6;i++) {
  const z=-.26+i*.104,r=i===0||i===5?.064:.060;
  cylindre('base',r,.072,[x,.087,z],2,'bandages_galets',[0,0,Math.PI/2],14);
  cylindre('base',r*.76,.007,[x+signe*.041,.087,z],5,'flasques_galets',[0,0,Math.PI/2],14);
  cylindre('base',r*.27,.013,[x+signe*.046,.087,z],3,'moyeux_galets',[0,0,Math.PI/2],10);
 }
 boite('base',[.035,.043,.58],[signe*.197,.104,0],1,'longerons');
}
// Plateau fin, aucune casemate. Le milieu de la soute reste intégralement dégagé.
ajouter('corps',carene([{y:.149,largeur:.405,profondeur:.655,coupe:.035,z:.01},{y:.183,largeur:.49,profondeur:.71,coupe:.045,z:.01},{y:.21,largeur:.47,profondeur:.71,coupe:.04,z:.01}]),1,'plateau_porteur');
panneau('corps',[.323,.016,.382],[0,.218,-.11],8,'plancher_antiderapant', [0,0,0],.005);
for(const signe of [-1,1]) {
 panneau('corps',[.035,.102,.39],[signe*.206,.252,-.115],0,'panneaux_soute_equipe',[0,0,0],.006);
 panneau('corps',[.069,.025,.319],[signe*.144,.261,-.107],2,'assises_banquettes',[0,0,0],.005);
 for(const z of [-.222,-.025])boite('corps',[.023,.036,.026],[signe*.146,.235,z],3,'pieds_banquettes');
 // Rails d'arrimage dégagés du panneau : lumières entre les trois pieds.
 boite('corps',[.021,.021,.339],[signe*.211,.327,-.123],3,'rails_arrimage');
 for(const z of [-.267,-.121,.021])boite('corps',[.023,.025,.024],[signe*.211,.308,z],3,'supports_arrimage');
 panneau('corps',[.088,.021,.21],[signe*.247,.193,.252],5,'garde_boue_avant',[0,0,0],.005);
 panneau('corps',[.088,.021,.128],[signe*.247,.193,-.257],5,'garde_boue_arriere',[0,0,0],.005);
}
// Cabine avancée : vitrage frontal incliné, pavillon chanfreiné et seuils latéraux.
ajouter('corps',carene([{y:.207,largeur:.376,profondeur:.233,coupe:.026,z:.235},{y:.343,largeur:.390,profondeur:.23,coupe:.028,z:.236},{y:.456,largeur:.346,profondeur:.172,coupe:.023,z:.222}]),0,'cabine_equipe');
panneau('corps',[.378,.025,.212],[0,.471,.222],5,'toit_cabine',[0,0,0],.009);
// Pare-brise à deux panneaux : les vitrages sont des surfaces réelles, sans reflet peint.
for(const signe of [-1,1]) {
 panneau('corps',[.133,.073,.012],[signe*.073,.397,.331],4,'pare_brise',[-.29,0,0],.003);
 panneau('corps',[.012,.083,.085],[signe*.184,.394,.212],4,'vitres_laterales',[0,0,signe*.17],.003);
 panneau('corps',[.009,.067,.078],[signe*.195,.291,.219],5,'portes_cabine',[0,0,0],.003);
 boite('corps',[.020,.016,.040],[signe*.207,.317,.210],3,'poignees_portes');
 panneau('corps',[.054,.024,.10],[signe*.228,.219,.202],8,'marchepieds',[0,0,0],.004);
 panneau('corps',[.046,.030,.021],[signe*.135,.284,.362],7,'feux_avant',[0,0,0],.004);
}
panneau('corps',[.296,.043,.034],[0,.232,.374],2,'pare_chocs_souple',[0,0,0],.007);
panneau('corps',[.118,.018,.078],[.08,.491,.206],6,'ventilation_pavillon',[0,0,0],.004);
// Rampe de chargement abaissée, charnière transversale et relief antidérapant géométrique.
const longueurRampe=.226,angleRampe=-.82,centreRampe:V3=[0,.129,-.407];
panneau('corps',[.324,.019,longueurRampe],centreRampe,8,'rampe_arriere_abaissee',[angleRampe,0,0],.005);
cylindre('corps',.015,.337,[0,.207,-.33],3,'axe_rampe',[0,0,Math.PI/2],12);
for(let i=0;i<5;i++) {
 const z=-.081+i*.040;
 boite('corps',[.295,.007,.014],[0,centreRampe[1]+Math.cos(angleRampe)*.015-Math.sin(angleRampe)*z,centreRampe[2]+Math.sin(angleRampe)*.015+Math.cos(angleRampe)*z],3,'nervures_rampe',[angleRampe,0,0]);
}
// Grue rangée sur le flanc gauche. Les bras épais dessinent un Z compact, pas un tube.
function poutre(a:V3,b:V3,largeur:number,hauteur:number,role:number,etiquette:string) {
 const debut=new THREE.Vector3(...a),fin=new THREE.Vector3(...b),milieu=debut.clone().add(fin).multiplyScalar(.5);
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),fin.clone().sub(debut).normalize());
 const g=carene([{y:-hauteur/2,largeur:largeur-.008,profondeur:debut.distanceTo(fin),coupe:.005},{y:hauteur/2,largeur,profondeur:debut.distanceTo(fin),coupe:.005}]);
 g.applyQuaternion(q);ajouter('module_grue',g,role,etiquette,milieu.toArray() as V3);
}
cylindre('module_grue',.044,.029,[-.205,.253,.035],3,'couronne_grue',[0,0,0],16);
panneau('module_grue',[.068,.112,.070],[-.205,.309,.035],5,'colonne_grue',[0,0,0],.008);
poutre([-.205,.354,.035],[-.205,.412,-.262],.044,.051,5,'bras_principal_replie');
poutre([-.205,.426,-.245],[-.205,.439,-.055],.035,.036,3,'avant_bras_replie');
for(const [y,z] of [[.356,.026],[.418,-.255],[.438,-.057]])cylindre('module_grue',.026,.057,[-.205,y,z],3,'axes_grue',[0,0,Math.PI/2],12);
// Vérin de levage rangé parallèlement au bras ; articulations bien séparées.
poutre([-.173,.319,.027],[-.173,.375,-.143],.026,.026,3,'verin_hydraulique');
poutre([-.173,.369,-.125],[-.173,.4,-.234],.016,.016,5,'tige_verin');
boite('module_grue',[.023,.05,.026],[-.205,.404,-.055],1,'manille_crochet');
ajouter('module_grue',new THREE.TorusGeometry(.025,.011,6,12,Math.PI*1.65),3,'crochet_captif',[-.205,.372,-.055],[0,Math.PI/2,.25]);
// Témoin prêt / hors service, nœud distinct. Pas d'émission animée fictive.
panneau('socle',[.036,.018,.029],[.134,.492,.266],7,'temoin_disponibilite',[0,0,0],.003);
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
 new THREE.AnimationClip('repos',2.4,[rotation('module_grue',[0,1.2,2.4],[[0,0,0],[.009,0,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[position('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.004,0],[0,0,0],[0,.003,0],[0,0,0]]),rotation('corps',[0,.25,.5,.75,1],[[0,0,0],[.013,0,-.008],[0,0,0],[-.013,0,.008],[0,0,0]]),rotation('module_grue',[0,.25,.5,.75,1],[[0,0,0],[-.022,0,0],[0,0,0],[.016,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rotation('corps',[0,.10,.24,.5],[[0,0,0],[.025,0,.042],[-.012,0,-.019],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[position('corps',[0,.5,.9],[[0,0,0],[0,-.014,0],[0,-.014,0]]),rotation('corps',[0,.5,.9],[[0,0,0],[.02,0,-.02],[.02,0,-.02]]),rotation('module_grue',[0,.55,.9],[[0,0,0],[-.05,0,0],[-.05,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.35,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips);const {document,bin}=decouperGlb(brut);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];
 document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));
 document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — transport original paramétrique v1',extras:{source:'creation_originale',unite:'metre',hauteur:'Y+',avant:'Z+',sansEclairagePeint:true}};
 const octets=assemblerGlb(document,bin);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);
 const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',script:'scripts/production/modeles/unite_transport_base/generer.ts',sourcesExternes:[],placeholderImporte:false},triangles,budgetTriangles:6000,octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:dimensions.toArray()},hierarchie:poses,trianglesParEnsemble:bilan,materiaux:['mat_corps','mat_details'],texturesExternes:canaux,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),validationArtistique:'non_effectuee',limites:['Création paramétrique originale, pas un GLB HD uploadé.','Pas de capture ni contrôle visuel ; lisibilité et appréciation artistique non attestées.','Relief de matière créé analytiquement en espace tangent ; aucun bake HD vers low-poly.','Chenilles rigides : suspension animée sans défilement des patins.', 'La rampe reste abaissée dans cette version ; elle n’a pas de nœud distinct dans le contrat.','Mesure réelle sur téléphone en attente.']};
 if(triangles>6000)throw new Error(`Budget dépassé : ${triangles}`);
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');
 console.log(JSON.stringify({triangles,octets:octets.length,dimensions:dimensions.toArray(),sha256:rapport.sha256Glb}));
}
void ecrire();
