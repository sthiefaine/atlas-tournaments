/** Port partagé original ; aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='batiment_port_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,0,0]},toit:{parent:'racine',p:[0,0,0]},enseigne:{parent:'toit',p:[-.285,.342,-.295]},grue:{parent:'racine',p:[.250,.570,-.235]}};
function pivot(n:string):THREE.Vector3{const p=poses[n]!;return new THREE.Vector3(...p.p).add(p.parent?pivot(p.parent):new THREE.Vector3());}
function ajouter(n:string,g:THREE.BufferGeometry,role:number,nom:string,p:V3=[0,0,0],r:V3=[0,0,0]){
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,((role%4)+.065+uv.getX(i)*.87)/4,(Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1)));
 const a=pieces.get(n)??[];a.push({g,role,nom});pieces.set(n,a);
}
function boite(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0]){ajouter(n,new THREE.BoxGeometry(...s),role,nom,p,r);}
function cyl(n:string,ra:number,h:number,p:V3,role:number,nom:string,r:V3=[0,0,0],ns=16,rb=ra){ajouter(n,new THREE.CylinderGeometry(rb,ra,h,ns,1,false),role,nom,p,r);}
/** Sections octogonales biseautées, UV projetés indépendants sur chaque face. */
function carene(ss:{y:number;w:number;d:number;c:number}[]):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],ix:number[]=[];
 const rings=ss.map(({y,w,d,c})=>{c=Math.min(c,w*.4,d*.4);return [[-w/2+c,-d/2],[w/2-c,-d/2],[w/2,-d/2+c],[w/2,d/2-c],[w/2-c,d/2],[-w/2+c,d/2],[-w/2,d/2-c],[-w/2,-d/2+c]].map(([x,z])=>new THREE.Vector3(x,y,z));});
 function face(v:THREE.Vector3[]){const start=pos.length/3,no=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();const ax=Math.abs(no.y)>=Math.max(Math.abs(no.x),Math.abs(no.z))?['x','z'] as const:Math.abs(no.x)>Math.abs(no.z)?['z','y'] as const:['x','y'] as const;const uu=v.map(x=>x[ax[0]]),vv=v.map(x=>x[ax[1]]),u=Math.min(...uu),v0=Math.min(...vv),du=Math.max(...uu)-u,dv=Math.max(...vv)-v0;v.forEach((x,i)=>{pos.push(...x.toArray());uv.push((uu[i]!-u)/du,(vv[i]!-v0)/dv);});for(let i=1;i<v.length-1;i++)ix.push(start,start+i,start+i+1);}
 face(rings[0]!);for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;face([rings[j]![i]!,rings[j+1]![i]!,rings[j+1]![k]!,rings[j]![k]!]);}face([...rings.at(-1)!].reverse());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function plaque(n:string,s:V3,p:V3,role:number,nom:string,b=.004){const [w,h,d]=s,k=Math.min(b,h*.28);ajouter(n,carene([{y:-h/2,w:w-2*k,d:d-2*k,c:b},{y:-h/2+k,w,d,c:b},{y:h/2-k,w,d,c:b},{y:h/2,w:w-2*k,d:d-2*k,c:b}]),role,nom,p);}
function tige(n:string,a:V3,b:V3,rayon:number,role:number,nom:string,ns=10){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa),g=new THREE.CylinderGeometry(rayon,rayon,v.length(),ns,1,false);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));ajouter(n,g,role,nom,aa.add(bb).multiplyScalar(.5).toArray() as V3);}
function tuyau(n:string,pts:V3[],rayon:number,role:number,nom:string,segments=20){ajouter(n,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),segments,rayon,8,false),role,nom);}
// Quai arrière et deux doigts de quai : bassin réellement ouvert vers +Z, sans eau.
ajouter('corps',carene([{y:0,w:.860,d:.370,c:.018},{y:.006,w:.880,d:.390,c:.018},{y:.034,w:.880,d:.390,c:.018},{y:.040,w:.868,d:.378,c:.018}]),0,'dalle',[0,0,-.245]);
for(const side of [-1,1])ajouter('corps',carene([{y:0,w:.183,d:.488,c:.016},{y:.006,w:.195,d:.500,c:.016},{y:.034,w:.195,d:.500,c:.016},{y:.040,w:.183,d:.488,c:.016}]),0,`quai_${side}`,[side*.3425,0,.190]);
// Rampe de service centrale vers le plan du terrain : nez de 2 mm, pente douce .038/.15.
{
 const g=new THREE.BoxGeometry(.420,.040,.150),p=g.getAttribute('position');
 for(let i=0;i<p.count;i++){const z=p.getZ(i)-.005;p.setXYZ(i,p.getX(i),p.getY(i)>0?.002+(.070-z)/.150*.038:0,z);}
 g.computeVertexNormals();ajouter('corps',g,0,'rampe');
}
// Cabine arrière gauche : soubassement, parois vitrées et toiture séparés.
plaque('corps',[.290,.024,.316],[-.280,.052,-.251],0,'semelle_cabine',.012);
ajouter('corps',carene([{y:.064,w:.260,d:.286,c:.014},{y:.176,w:.248,d:.274,c:.014}]),5,'cabine_basse',[-.280,0,-.251]);
plaque('corps',[.258,.012,.284],[-.280,.179,-.251],3,'appui_vitrage',.009);
boite('corps',[.222,.122,.012],[-.280,.244,-.114],4,'vitrage_avant');
boite('corps',[.222,.122,.012],[-.280,.244,-.388],4,'vitrage_arriere');
for(const s of [-1,1]){
 boite('corps',[.012,.122,.258],[-.280+s*.123,.244,-.251],4,`vitrage_cote_${s}`);
 for(const z of [-.388,-.114])plaque('corps',[.020,.130,.020],[-.280+s*.114,.243,z],3,`montant_${s}_${z}`, .003);
}
boite('corps',[.018,.122,.014],[-.280,.244,-.108],5,'meneau_avant');
plaque('toit',[.291,.024,.317],[-.280,.314,-.251],2,'toiture',.010);
plaque('corps',[.168,.032,.010],[-.280,.144,-.111],2,'bande_cabine',.003);
plaque('corps',[.082,.087,.010],[-.280,.108,-.395],8,'porte_service',.003);
// Indicateur de capture à plat sur glissière, neutre au repos et après capture.
plaque('toit',[.184,.004,.212],[-.280,.328,-.251],6,'fond_glissiere',.003);
for(const x of [-.383,-.177])plaque('toit',[.018,.016,.221],[x,.334,-.251],3,`rail_capture_${x}`,.003);
plaque('enseigne',[.180,.009,.053],[-.280,.3345,-.294],2,'indicateur_capture',.005);
for(const z of [-.371,-.131])plaque('toit',[.225,.018,.019],[-.280,.335,z],2,`rive_toit_${z}`,.003);
// Fût fixe, couronne de pivot et coffret de maintenance. Pas de mur animé.
plaque('corps',[.179,.022,.184],[.250,.051,-.235],0,'semelle_grue',.011);
plaque('corps',[.120,.103,.122],[.250,.1115,-.235],5,'pied_grue',.009);
ajouter('corps',carene([{y:.163,w:.092,d:.096,c:.011},{y:.546,w:.073,d:.078,c:.010}]),2,'fut_grue',[.250,0,-.235]);
cyl('corps',.059,.026,[.250,.550,-.235],3,'roulement_fixe',[0,0,0],24);
cyl('grue',.055,.031,[.250,.573,-.235],6,'couronne_mobile',[0,0,0],24);
plaque('corps',[.072,.089,.067],[.332,.104,-.237],5,'coffret',.006);
for(const z of [-.280,-.190])tige('corps',[.195,.078,z],[.245,.267,z],.013,3,`renfort_fut_${z}`,8);
// Flèche rigide en treillis. Elle pivote de quelques degrés seulement autour de Y.
plaque('grue',[.490,.034,.072],[.159,.611,-.235],2,'poutre_basse',.006);
plaque('grue',[.090,.095,.123],[.368,.6405,-.235],5,'contrepoids',.008);
plaque('grue',[.074,.044,.082],[.250,.598,-.235],3,'selle_grue',.006);
for(const z of [-.263,-.207]){
 tige('grue',[-.077,.627,z],[.250,.700,z],.013,2,`tirant_avant_${z}`,8);
 tige('grue',[.250,.700,z],[.361,.649,z],.013,3,`tirant_arriere_${z}`,8);
 tige('grue',[.250,.620,z],[.250,.700,z],.013,3,`montant_fleche_${z}`,8);
 tige('grue',[.038,.612,z],[.110,.670,z],.011,3,`diagonale_${z}`,8);
}
tige('grue',[.250,.700,-.263],[.250,.700,-.207],.014,3,'traverse_sommet',10);
// Poulie et câble porteur épais lisibles ; crochet en tube recourbé, sans charge.
cyl('grue',.029,.042,[-.066,.611,-.235],3,'poulie_tete',[Math.PI/2,0,0],20);
tige('grue',[-.066,.638,-.235],[.268,.678,-.235],.010,6,'cable_tambour',10);
tige('grue',[-.066,.604,-.235],[-.066,.432,-.235],.010,6,'cable_levage',10);
cyl('grue',.023,.037,[-.066,.425,-.235],5,'bloc_crochet',[0,0,0],16);
tige('grue',[-.066,.413,-.235],[-.066,.392,-.235],.010,3,'tige_crochet',10);
ajouter('grue',new THREE.TorusGeometry(.027,.010,8,24,Math.PI*1.35).rotateZ(Math.PI),3,'crochet',[-.039,.392,-.235]);
// Fermeture exacte des deux sections du crochet partiel, raccordée à ses huit côtés.
for(const [nom,angle,fin] of [['depart',Math.PI,false],['bout',Math.PI*2.35,true]] as const){
 const cx=-.039+.027*Math.cos(angle),cy=.392+.027*Math.sin(angle),pos=[cx,cy,-.235],uv=[.5,.5],ix:number[]=[];
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pos.push(cx+.010*Math.cos(a)*Math.cos(angle),cy+.010*Math.cos(a)*Math.sin(angle),-.235+.010*Math.sin(a));uv.push(.5+.5*Math.cos(a),.5+.5*Math.sin(a));}
 for(let i=0;i<8;i++){const j=(i+1)%8;ix.push(0,fin?j+1:i+1,fin?i+1:j+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();ajouter('grue',g,3,`section_crochet_${nom}`);
}
// Tambour visible de la grue, berceaux et moteur fixés sur la flèche.
cyl('grue',.033,.068,[.268,.645,-.235],6,'tambour_grue',[Math.PI/2,0,0],20);
for(const z of [-.273,-.197])cyl('grue',.043,.012,[.268,.645,z],3,`flasque_grue_${z}`,[Math.PI/2,0,0],20);
// Bollards de quai et défenses latérales ; le centre et l'avant restent libres.
for(const s of [-1,1])for(const z of [.112,.337]){
 const x=s*.365;
 plaque('corps',[.106,.014,.089],[x,.047,z],3,`platine_bollard_${s}_${z}`,.005);
 cyl('corps',.024,.050,[x,.078,z],5,`bollard_${s}_${z}`,[0,0,0],16);
 cyl('corps',.038,.014,[x,.105,z],5,`chapeau_bollard_${s}_${z}`,[0,0,0],16);
 // Fenders low, outside the approach, mounted against the quay side.
 cyl('corps',.021,.110,[s*.430,.028,z],7,`defense_${s}_${z}`,[Math.PI/2,0,0],16);
}
// Treuil d'amarrage arrière, entre cabine et fût ; il ne remplit pas l'accès.
plaque('corps',[.167,.016,.107],[-.027,.048,-.359],3,'socle_treuil',.005);
for(const x of [-.087,.033])plaque('corps',[.021,.070,.082],[x,.085,-.359],5,`joue_treuil_${x}`,.003);
cyl('corps',.033,.109,[-.027,.094,-.359],6,'tambour_treuil',[0,0,Math.PI/2],20);
for(const x of [-.078,.024])cyl('corps',.045,.013,[x,.094,-.359],3,`flasque_treuil_${x}`,[0,0,Math.PI/2],20);
// Lentilles nocturnes sur la cabine seulement, sans émission de béton ou métal.
for(const x of [-.398,-.162]){
 plaque('corps',[.032,.027,.027],[x,.270,-.103],5,`support_feu_${x}`,.004);
 cyl('corps',.011,.006,[x,.270,-.087],10,`lentille_${x}`,[Math.PI/2,0,0],12);
}
// Métal visible = mat_corps ; seules les surfaces vitreuses utilisent mat_vitrage.
const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_vitrage',color:0xffffff,metalness:1,roughness:1,emissive:0xffffff})];
const objets=new Map<string,THREE.Object3D>();let triangles=0;const bilan:Record<string,number>={};
for(const [nom,pose] of Object.entries(poses)){
 const ps=pieces.get(nom)??[];let o:THREE.Object3D;
 if(ps.length){const gs:THREE.BufferGeometry[]=[],mi:number[]=[],infos:{nom:string;primitive:number;triangleDebut:number;triangles:number;role:number}[]=[];
  for(const mat of [0,1]){let debut=0;const sel=ps.filter(p=>[4,10,11].includes(p.role)?mat===1:mat===0);if(!sel.length)continue;
   const source=sel.map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone(),t=g.getAttribute('position').count/3,po=pivot(nom);g.translate(-po.x,-po.y,-po.z);infos.push({nom:p.nom,primitive:gs.length,triangleDebut:debut,triangles:t,role:p.role});debut+=t;triangles+=t;bilan[p.nom]=t;return g;});
   const g=mergeVertices(mergeGeometries(source,false)!,1e-7);g.computeTangents();gs.push(g);mi.push(mat);
  }
  const g=mergeGeometries(gs,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mi[i]!);o=new THREE.Mesh(g,materiaux);o.userData={pieces:infos};
 }else o=new THREE.Group();o.name=nom;o.position.set(...pose.p);objets.set(nom,o);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.userData.atlasAnimationsBatiment=true;racine.updateMatrixWorld(true);
const axeGrue=new THREE.Vector3(0,1,0);
const clips=[
 new THREE.AnimationClip('repos',3.2,[new THREE.QuaternionKeyframeTrack('grue.quaternion',[0,.4,.8,1.2,1.6,2,2.4,2.8,3.2],[0,.032,.045,.032,0,-.032,-.045,-.032,0].flatMap(a=>new THREE.Quaternion().setFromAxisAngle(axeGrue,a).toArray()))]),
 new THREE.AnimationClip('capture',1.4,[new THREE.VectorKeyframeTrack('enseigne.position',[0,.28,.70,1.03,1.4],[[-.285,.342,-.295],[-.285,.342,-.258],[-.285,.342,-.220],[-.285,.342,-.258],[-.285,.342,-.295]].flat())]),
];
async function ecrire(){
 if(triangles>5000)throw new Error(`Budget ${triangles}/5000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','emission','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[]}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};if(m.name==='mat_vitrage'){m.emissiveTexture={index:3};m.emissiveFactor=[1,1,1];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — Port commun original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:5000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
