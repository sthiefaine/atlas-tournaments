/** Aéroport partagé original ; aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='batiment_aeroport_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,0,0]},toit:{parent:'racine',p:[0,0,0]},enseigne:{parent:'toit',p:[-.321,.400,-.348]},manche_air:{parent:'racine',p:[.225,.316,-.398]}};
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
// Dalle unique, plane, biseautée et centrée au sol. Pas de plaine ni d'herbe ajoutée.
ajouter('corps',carene([{y:0,w:.908,d:.908,c:.025},{y:.005,w:.92,d:.92,c:.025},{y:.019,w:.92,d:.92,c:.025},{y:.024,w:.91,d:.91,c:.025}]),0,'dalle');
// Apron : l'anneau est peint dans le PNG, pas de seconde face au même plan.
ajouter('corps',new THREE.CylinderGeometry(.300,.300,.006,64,1,true),0,'chant_apron',[.020,.025,.075]);
ajouter('corps',new THREE.CircleGeometry(.300,64).rotateX(-Math.PI/2),1,'apron',[.020,.028,.075]);
// Accès frontal affleurant ; joints sciés dans les normales de la dalle.
// Cabine à soubassement large, couronne vitrée, toiture mince. Glaces = paroi, pas overlay.
plaque('corps',[.267,.030,.308],[-.307,.039,-.281],0,'semelle_cabine',.012);
ajouter('corps',carene([{y:.052,w:.244,d:.283,c:.015},{y:.209,w:.232,d:.271,c:.016}]),5,'cabine_basse',[-.307,0,-.281]);
plaque('corps',[.244,.014,.283],[-.307,.209,-.281],3,'appui_vitrage',.011);
// Quatre vitres épaisses reliées aux montants ; aucune face de mur derrière la glace.
boite('corps',[.207,.154,.012],[-.307,.292,-.146],4,'vitrage_avant');
boite('corps',[.207,.154,.012],[-.307,.292,-.416],4,'vitrage_arriere');
for(const s of [-1,1]){
 boite('corps',[.012,.154,.245],[-.307+s*.116,.292,-.281],4,`vitrage_cote_${s}`);
 for(const z of [-.416,-.146])plaque('corps',[.020,.166,.020],[-.307+s*.108,.291,z],3,`montant_${s}_${z}`, .003);
 boite('corps',[.016,.154,.013],[-.307+s*.063,.292,-.138],5,`meneau_${s}`);
}
// Porte arrière dans le soubassement, intégrée en matériau et joint normal.
plaque('corps',[.082,.124,.010],[-.307,.116,-.423],8,'porte_service',.003);
// Bande propriétaire sur la face et toiture, larges et neutres.
plaque('corps',[.166,.034,.010],[-.307,.171,-.140],2,'bande_cabine',.003);
plaque('toit',[.269,.027,.309],[-.307,.3815,-.281],2,'toiture',.014);
// Glissière : capot fixe, rails et indicateur animé, intégralement dans le toit.
plaque('toit',[.181,.004,.208],[-.305,.397,-.277],6,'fond_glissiere',.003);
for(const x of [-.401,-.209])plaque('toit',[.018,.018,.223],[x,.405,-.277],3,`rail_capture_${x}`,.003);
plaque('enseigne',[.170,.010,.057],[-.305,.404,-.333],2,'indicateur_capture',.006);
for(const z of [-.391,-.162])plaque('toit',[.218,.019,.022],[-.305,.405,z],2,`rive_toit_${z}`, .004);
// Camion ravitailleur compact, garé en retrait et hors de l'aire centrale.
const tx=.333,tz=-.245;
plaque('corps',[.121,.026,.257],[tx,.084,tz],5,'chassis_camion',.008);
for(const s of [-1,1])for(const z of [-.323,-.175]){
 cyl('corps',.034,.027,[tx+s*.074,.058,z],7,`pneu_${s}_${z}`,[0,0,Math.PI/2],16);
 cyl('corps',.019,.030,[tx+s*.074,.058,z],3,`jante_${s}_${z}`,[0,0,Math.PI/2],12);
}
ajouter('corps',carene([{y:.096,w:.132,d:.085,c:.010},{y:.173,w:.126,d:.077,c:.012},{y:.194,w:.108,d:.060,c:.012}]),5,'cabine_camion',[tx,0,-.145]);
plaque('corps',[.117,.010,.075],[tx,.196,-.148],2,'toit_camion',.007);
// Pare-brise dans le flanc avant du camion ; verre non émissif, rôle distinct de la cabine.
boite('corps',[.085,.035,.009],[tx,.166,-.104],11,'parebrise_camion');
for(const s of [-1,1])boite('corps',[.008,.033,.044],[tx+s*.062,.160,-.147],11,`vitre_camion_${s}`);
plaque('corps',[.158,.020,.026],[tx,.104,-.094],3,'parechoc',.004);
// Cuve cylindrique horizontale, deux berceaux ; ses extrémités sont biseautées.
const tank=new THREE.CylinderGeometry(.058,.058,.151,24,1,false).rotateX(Math.PI/2);
ajouter('corps',tank,3,'cuve',[tx,.155,-.292]);
for(const z of [-.344,-.240]){
 boite('corps',[.132,.033,.018],[tx,.109,z],5,`berceau_${z}`);
 const tor=new THREE.TorusGeometry(.059,.004,6,16);ajouter('corps',tor,5,`sangle_cuve_${z}`,[tx,.155,z]);
}
cyl('corps',.024,.012,[tx,.216,-.292],5,'bouchon_cuve',[0,0,0],16);
// Flexible rangé en boucle contre le flanc, deux extrémités raccordées aux raccords.
plaque('corps',[.058,.047,.067],[.387,.1165,-.294],5,'bloc_pompe',.006);
cyl('corps',.018,.022,[.408,.132,-.294],3,'raccord_pompe',[0,0,Math.PI/2],12);
tuyau('corps',[[.419,.132,-.294],[.426,.158,-.283],[.427,.157,-.239],[.425,.116,-.220],[.417,.111,-.265],[.411,.129,-.294]],.007,7,'flexible_range',16);
// Mât avec embase, roulement et manche creuse. Tout reste sous la toiture.
cyl('corps',.029,.012,[.225,.030,-.398],3,'embase_mat',[0,0,0],16);
cyl('corps',.011,.280,[.225,.174,-.398],3,'mat',[0,0,0],12);
ajouter('corps',new THREE.SphereGeometry(.017,12,8),3,'rotule_manche',[.225,.316,-.398]);
// Manche à quatre sections, épaisseur réelle, extrémités ouvertes, rayures pigmentaires.
{
 const pos:number[]=[],uv:number[]=[],ix:number[]=[],N=16,R=5;
 for(const inner of [false,true])for(let j=0;j<R;j++)for(let i=0;i<=N;i++){
  const u=j/(R-1),a=i/N*Math.PI*2,r=.031-u*.016-(inner?.002:0);pos.push(.222-u*.184,.316-.013*u*u+Math.cos(a)*r,-.398+Math.sin(a)*r);uv.push(i/N,u);
 }
 const layer=R*(N+1);
 for(let layerIndex=0;layerIndex<2;layerIndex++)for(let j=0;j<R-1;j++)for(let i=0;i<N;i++){
  const a=layerIndex*layer+j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;
  if(layerIndex===0)ix.push(a,b,d,a,d,c);else ix.push(a,d,b,a,c,d);
 }
 for(let i=0;i<ix.length;i+=3){const b=ix[i+1]!;ix[i+1]=ix[i+2]!;ix[i+2]=b;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
 const norm=g.getAttribute('normal');for(let l=0;l<2;l++)for(let j=0;j<R;j++){const a=l*layer+j*(N+1),b=a+N,v=new THREE.Vector3().fromBufferAttribute(norm,a).add(new THREE.Vector3().fromBufferAttribute(norm,b)).normalize();norm.setXYZ(a,v.x,v.y,v.z);norm.setXYZ(b,v.x,v.y,v.z);}
 ajouter('manche_air',g,9,'manche_creuse');
 ajouter('manche_air',new THREE.RingGeometry(.029,.031,16).rotateY(Math.PI/2),5,'ourlet_manche_entree',[.222,.316,-.398]);
 ajouter('manche_air',new THREE.RingGeometry(.013,.015,16).rotateY(-Math.PI/2),5,'ourlet_manche_sortie',[.038,.303,-.398]);
 // Tige intérieure porte-manche fixée à la rotule, diamètre >=2 cm.
 tige('manche_air',[.222,.316,-.398],[.215,.316,-.398],.014,3,'axe_manche',12);
 for(const z of [-.428,-.368])tige('manche_air',[.220,.316,-.398],[.220,.316,z],.004,3,`rayon_manche_${z}`,8);
}
// Quatre feux exactement cardinaux autour de l'apron, lentilles dédiées à l'émission.
for(const [nom,x,z] of [['nord',.020,-.248],['est',.343,.075],['sud',.020,.398],['ouest',-.303,.075]] as const){
 cyl('corps',.022,.008,[x,.022,z],5,`support_feu_${nom}`,[0,0,0],16,.019);
 cyl('corps',.017,.003,[x,.0265,z],10,`lentille_${nom}`,[0,0,0],16,.013);
}
// Implantation finale : tous les accessoires restent hors du disque, y compris les avant-toits.
const nomsCabine=['semelle_cabine','cabine_basse','appui_vitrage','vitrage_avant','vitrage_arriere','porte_service','bande_cabine'];
const nomsCamion=['chassis_camion','cabine_camion','toit_camion','parebrise_camion','parechoc','cuve','bouchon_cuve','bloc_pompe','raccord_pompe','flexible_range'];
for(const [n,ps] of pieces)for(const p of ps){
 if(n==='toit'||n==='enseigne'||nomsCabine.includes(p.nom)||/^(vitrage_cote|montant|meneau)_/.test(p.nom))p.g.translate(-.016,0,-.015);
 if(nomsCamion.includes(p.nom)||/^(pneu|jante|vitre_camion|berceau|sangle_cuve)_/.test(p.nom))p.g.translate(0,0,-.040);
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
const axeVent=new THREE.Vector3(.3,1,.27).normalize();
const clips=[
 new THREE.AnimationClip('repos',3.2,[new THREE.QuaternionKeyframeTrack('manche_air.quaternion',[0,.4,.8,1.2,1.6,2,2.4,2.8,3.2],[0,.060,.085,.060,0,-.060,-.085,-.060,0].flatMap(a=>new THREE.Quaternion().setFromAxisAngle(axeVent,a).toArray()))]),
 new THREE.AnimationClip('capture',1.4,[new THREE.VectorKeyframeTrack('enseigne.position',[0,.28,.70,1.03,1.4],[[-.321,.400,-.348],[-.321,.400,-.308],[-.321,.400,-.278],[-.321,.400,-.308],[-.321,.400,-.348]].flat())]),
];
async function ecrire(){
 if(triangles>4200)throw new Error(`Budget ${triangles}/4200`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','emission','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[]}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};if(m.name==='mat_vitrage'){m.emissiveTexture={index:3};m.emissiveFactor=[1,1,1];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — Aéroport commun original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:4200,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
