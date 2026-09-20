/** Station radar partagée original ; aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='batiment_radar_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,0,0]},toit:{parent:'racine',p:[0,0,0]},enseigne:{parent:'toit',p:[-.238,.260,-.10]},radar:{parent:'toit',p:[.015,.281,-.170]}};
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

// Dalle à rampe pleine largeur : une seule peau, sans dalle cachée sous la pente.
{
 const shape=new THREE.Shape();
 // Extrusion dans X après remappage : profil (-Z,Y), haut avant à 2 mm.
 shape.moveTo(.430,0);shape.lineTo(-.430,0);shape.lineTo(-.430,.002);
 shape.lineTo(-.330,.038);shape.lineTo(.430,.038);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:.860,bevelEnabled:false,steps:1,curveSegments:1});
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,p.getZ(i)-.430,p.getY(i),-p.getX(i));
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,Math.min(1,Math.max(0,uv.getX(i)+.5)),Math.min(1,Math.max(0,uv.getY(i))));
 // UV indépendants par face selon son axe dominant pour les surfaces étroites.
 for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k)),n=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!));
  const axes=Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))?['x','z'] as const:Math.abs(n.x)>Math.abs(n.z)?['z','y'] as const:['x','y'] as const;
  const u=v.map(x=>x[axes[0]]),w=v.map(x=>x[axes[1]]),umin=Math.min(...u),wmin=Math.min(...w),du=Math.max(...u)-umin,dw=Math.max(...w)-wmin;
  v.forEach((_,k)=>uv.setXY(i+k,(u[k]!-umin)/du,(w[k]!-wmin)/dw));
 }
 g.computeVertexNormals();ajouter('corps',g,0,'dalle_rampee');
}
// Local technique bas, bardage clair, baies et porte de service vers l'accès.
plaque('corps',[.684,.022,.410],[0,.049,-.195],0,'soubassement',.012);
ajouter('corps',carene([{y:.060,w:.646,d:.380,c:.017},{y:.220,w:.628,d:.366,c:.017}]),5,'cabine');
// Translation en profondeur appliquée à la seule géométrie du local.
pieces.get('corps')!.at(-1)!.g.translate(0,0,-.195);
plaque('toit',[.680,.026,.413],[0,.233,-.195],5,'toiture',.011);
plaque('corps',[.204,.102,.012],[.174,.158,-.007],3,'cadre_vitrage',.004);
boite('corps',[.178,.077,.012],[.174,.158,.001],4,'vitrage_avant');
boite('corps',[.014,.090,.015],[.174,.158,.009],5,'meneau_avant');
plaque('corps',[.135,.144,.012],[-.074,.139,-.005],3,'cadre_porte',.004);
plaque('corps',[.110,.123,.011],[-.074,.135,.004],8,'porte',.004);
boite('corps',[.088,.032,.006],[-.074,.171,.013],4,'vitrage_porte');
plaque('corps',[.021,.014,.014],[-.034,.119,.015],3,'poignee',.003);
plaque('corps',[.212,.011,.072],[-.074,.043,.048],0,'seuil',.003);
// Rive frontale et panneau horizontal d'équipe ; indicateur coulissant capturable.
plaque('toit',[.604,.015,.034],[0,.250,-.005],2,'rive_equipe',.004);
plaque('toit',[.147,.004,.160],[-.238,.248,-.097],6,'fond_glissiere',.003);
for(const x of [-.322,-.154])plaque('toit',[.017,.017,.170],[x,.255,-.097],3,`rail_${x}`,.003);
for(const z of [-.190,-.004])plaque('toit',[.180,.018,.018],[-.238,.255,z],2,`butée_${z}`,.003);
plaque('enseigne',[.142,.010,.062],[-.238,.255,-.10],2,'indicateur_capture',.004);
// Refroidisseur latéral, lames séparées et trappes en volume.
plaque('corps',[.063,.121,.198],[.342,.122,-.260],5,'coffret_ventilation',.007);
plaque('corps',[.008,.089,.156],[.374,.123,-.260],6,'fond_ventilation',.003);
for(let j=0;j<5;j++)boite('corps',[.015,.010,.146],[.380,.091+j*.016,-.260],3,`lame_ventilation_${j}`,[0,0,.22]);
plaque('corps',[.012,.110,.156],[-.319,.123,-.285],8,'trappe_service',.004);
for(const z of [-.345,-.225])plaque('corps',[.023,.019,.034],[-.327,.121,z],3,`charniere_${z}`,.003);
// Embase moteur fixée au toit ; seule sa couronne supérieure appartient au scan.
cyl('toit',.107,.026,[.015,.257,-.170],3,'embase_moteur',[0,0,0],32);
cyl('toit',.095,.018,[.015,.278,-.170],6,'roulement_fixe',[0,0,0],32);
cyl('radar',.092,.023,[.015,.296,-.170],3,'couronne_mobile',[0,0,0],32);
plaque('radar',[.214,.027,.116],[.015,.316,-.186],5,'traverse_berceau',.007);
// Inclinaison fixe de 24 degrés vers le ciel. Rotation de tout le berceau sur Y.
const centre=new THREE.Vector3(.015,.498,-.170),inclinaison=-.42;
const qDish=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),inclinaison);
function pd(p:V3):V3{return new THREE.Vector3(...p).applyQuaternion(qDish).add(centre).toArray() as V3;}
const moyeu=pd([0,0,-.034]);
for(const s of [-1,1]){
 const x=.015+s*.097;
 plaque('radar',[.031,moyeu[1]-.315,.066],[x,(moyeu[1]+.315)/2,moyeu[2]],5,`montant_berceau_${s}`,.006);
 cyl('radar',.035,.034,[x,moyeu[1],moyeu[2]],3,`palier_${s}`,[0,0,Math.PI/2],20);
}
cyl('radar',.020,.230,moyeu,3,'axe_elevation',[0,0,Math.PI/2],20);
cyl('radar',.066,.052,moyeu,5,'moyeu_parabole',[Math.PI/2+inclinaison,0,0],32);
// Réflecteur paraboloïde : face concave, vrai dos décalé de 18 mm et couronne fermée.
const rayon=.245,profondeur=.070,epaisseur=.018,segments=48,anneaux=6;
function coque(dos:boolean):THREE.BufferGeometry{
 const ps=[0,0,dos?-epaisseur:0],uv=[.5,.5],ix:number[]=[];
 for(let k=1;k<=anneaux;k++)for(let j=0;j<segments;j++){
  const r=rayon*k/anneaux,a=j/segments*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a);
  ps.push(x,y,profondeur*(r/rayon)**2-(dos?epaisseur:0));uv.push(.5+x/(2*rayon),.5+y/(2*rayon));
 }
 function tri(a:number,b:number,c:number){ix.push(a,dos?c:b,dos?b:c);}
 for(let j=0;j<segments;j++)tri(0,1+j,1+(j+1)%segments);
 for(let k=0;k<anneaux-1;k++)for(let j=0;j<segments;j++){
  const a=1+k*segments+j,b=1+k*segments+(j+1)%segments,c=a+segments,d=b+segments;
  tri(a,c,d);tri(a,d,b);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
ajouter('radar',coque(false),1,'parabole_concave',centre.toArray() as V3,[inclinaison,0,0]);
ajouter('radar',coque(true),5,'parabole_dos',centre.toArray() as V3,[inclinaison,0,0]);
// Annulaire de fermeture seulement : aucun disque ne bouche la cavité.
{
 const ps:number[]=[],uv:number[]=[],ix:number[]=[];
 for(let k=0;k<2;k++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2;ps.push(rayon*Math.cos(a),rayon*Math.sin(a),profondeur-epaisseur*k);uv.push(j/segments,k);}
 for(let j=0;j<segments;j++){const a=j,b=j+1,c=j+segments+1,d=c+1;ix.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();ajouter('radar',g,3,'chant_parabole',centre.toArray() as V3,[inclinaison,0,0]);
}
ajouter('radar',new THREE.TorusGeometry(rayon,.010,6,48),3,'couronne_parabole',pd([0,0,profondeur-.005]),[inclinaison,0,0]);
// Nervures arrière soutenant le réflecteur jusqu'à sa couronne, sans traverser le bol.
for(let j=0;j<6;j++){
 const a=(j+.5)/6*Math.PI*2,r0=.057,r1=.235;
 const pts:V3[]=[r0,.13,r1].map(r=>pd([r*Math.cos(a),r*Math.sin(a),profondeur*(r/rayon)**2-epaisseur-.003]));
 for(let k=0;k<2;k++)tige('radar',pts[k]!,pts[k+1]!,.011,5,`nervure_${j}_${k}`,8);
}
// Trois bras à partir de la couronne : récepteur réellement porté, axe optique dégagé.
for(let j=0;j<3;j++){
 const a=(j/3+.25)*Math.PI*2;
 tige('radar',pd([.245*Math.cos(a),.245*Math.sin(a),.065]),pd([.021*Math.cos(a),.021*Math.sin(a),.238]),.0105,3,`bras_recepteur_${j}`,10);
}
cyl('radar',.029,.050,pd([0,0,.244]),6,'recepteur',[Math.PI/2+inclinaison,0,0],24);
cyl('radar',.025,.012,pd([0,0,.213]),3,'bouche_recepteur',[Math.PI/2+inclinaison,0,0],24);
// Feux de fonctionnement uniquement sur les surfaces vitreuses.
for(const x of [-.275,.275]){
 plaque('corps',[.034,.033,.023],[x,.179,-.006],5,`support_indicateur_${x}`,.004);
 cyl('corps',.012,.010,[x,.179,.010],10,`lentille_${x}`,[Math.PI/2,0,0],12);
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
const axeRadar=new THREE.Vector3(0,1,0);
const clips=[
 new THREE.AnimationClip('repos',3.2,[new THREE.QuaternionKeyframeTrack('radar.quaternion',[0,.4,.8,1.2,1.6,2,2.4,2.8,3.2],[0,.198,.280,.198,0,-.198,-.280,-.198,0].flatMap(a=>new THREE.Quaternion().setFromAxisAngle(axeRadar,a).toArray()))]),
 new THREE.AnimationClip('capture',1.4,[new THREE.VectorKeyframeTrack('enseigne.position',[0,.28,.70,1.03,1.4],[[-.238,.260,-.10],[-.238,.260,-.075],[-.238,.260,-.05],[-.238,.260,-.075],[-.238,.260,-.10]].flat())]),
];
async function ecrire(){
 if(triangles>5000)throw new Error(`Budget ${triangles}/5000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','emission','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[]}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};if(m.name==='mat_vitrage'){m.emissiveTexture={index:3};m.emissiveFactor=[1,1,1];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — Station radar commune originale v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:5000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
