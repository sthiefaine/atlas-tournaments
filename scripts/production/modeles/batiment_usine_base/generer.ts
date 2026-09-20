/** Atelier à sheds partagé original ; aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='batiment_usine_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,0,0]},toit:{parent:'racine',p:[0,0,0]},enseigne:{parent:'toit',p:[-.04,.605,.060]},chariot:{parent:'corps',p:[.358,.527,-.065]}};
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
function tuyau(n:string,pts:V3[],rayon:number,role:number,nom:string,segments=20){
 const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(curve,segments,rayon,8,false);ajouter(n,g,role,nom);
 // Bouchons géométriques des sections ouvertes, mêmes huit sommets que le tube.
 for(const end of [0,1]){const ring=end?segments*9:0,pos=g.getAttribute('position'),vv:number[]=[],uv:number[]=[],ix:number[]=[],center=curve.getPoint(end);vv.push(...center.toArray());uv.push(.5,.5);
 for(let j=0;j<8;j++){const p=new THREE.Vector3().fromBufferAttribute(pos,ring+j);vv.push(...p.toArray());uv.push(.5+.5*Math.cos(j*Math.PI/4),.5+.5*Math.sin(j*Math.PI/4));}
 for(let j=0;j<8;j++){const a=1+j,b=1+(j+1)%8;ix.push(0,end?b:a,end?a:b);}
 const c=new THREE.BufferGeometry();c.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));c.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));c.setIndex(ix);c.computeVertexNormals();ajouter(n,c,role,`${nom}_bouchon_${end}`);
 }
}


function projeterUv(g:THREE.BufferGeometry){
 const p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k)),n=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!));
 const axes=Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))?['x','z'] as const:Math.abs(n.x)>Math.abs(n.z)?['z','y'] as const:['x','y'] as const;
 const u=v.map(x=>x[axes[0]]),w=v.map(x=>x[axes[1]]),u0=Math.min(...u),w0=Math.min(...w),du=Math.max(...u)-u0,dw=Math.max(...w)-w0;
 v.forEach((_,k)=>uv.setXY(i+k,(u[k]!-u0)/du,(w[k]!-w0)/dw));}
}

// Dalle plate : accès frontal sans marche intermédiaire.
plaque('corps',[.9,.026,.9],[0,.013,0],0,'dalle',.007);
// Halle monovolume réellement creuse : murs séparés, aucune boîte pleine derrière le rideau.
plaque('corps',[.550,.554,.026],[-.04,.303,-.392],0,'mur_arriere',.005);
for(const x of [-.302,.222])plaque('corps',[.026,.554,.444],[x,.303,-.17],0,`mur_lateral_${x}`,.004);
for(const x of [-.28,.20])plaque('corps',[.070,.554,.029],[x,.303,.052],0,`jambage_${x}`,.004);
plaque('corps',[.440,.100,.029],[-.04,.530,.052],0,'linteau',.004);
// Raidisseurs béton extérieurs et soubassement, ouverture utile 410 x 448 mm derrière le rideau.
for(const x of [-.316,.236])for(const z of [-.355,-.155,.025])boite('corps',[.020,.532,.035],[x,.292,z],0,`pilastre_${x}_${z}`);
for(const x of [-.302,.222])boite('corps',[.038,.047,.456],[x,.049,-.171],0,`plinthe_${x}`);
plaque('corps',[.432,.022,.062],[-.04,.030,.079],0,'seuil',.003);
// Rideau fermé : tôle grise d'équipe, lames reliées au tablier, aucune animation de bâtiment.
plaque('corps',[.424,.451,.016],[-.04,.256,.069],2,'rideau',.004);
for(let j=0;j<15;j++)boite('corps',[.414,.008,.009],[-.04,.048+j*.029,.081],2,`nervure_rideau_${j}`);
for(const x of [-.263,.183])boite('corps',[.027,.462,.028],[x,.256,.079],3,`rail_rideau_${x}`);
plaque('corps',[.480,.052,.075],[-.04,.506,.080],5,'coffre_rideau',.006);
plaque('corps',[.116,.020,.018],[-.04,.102,.085],3,'poignee_rideau',.003);
// Trois sheds : pente opaque vers +Z ; vitrage haut tourné vers -Z (nord de l'asset).
const largeur=.568,xc=-.04,ybas=.580,yhaut=.790;
for(let j=0;j<3;j++){
 const z0=-.402+j*.151,z1=z0+.151;
 const p0=new THREE.Vector3(xc,yhaut,z0+.018),p1=new THREE.Vector3(xc,ybas,z1);
 const delta=p1.clone().sub(p0),len=delta.length(),angle=Math.atan2(-delta.y,delta.z);
 plaque('toit',[largeur,.016,len+.016],p0.clone().add(p1).multiplyScalar(.5).toArray() as V3,5,`pan_shed_${j}`,.004);
 const pg=pieces.get('toit')!.at(-1)!.g;const centre=p0.clone().add(p1).multiplyScalar(.5);pg.translate(-centre.x,-centre.y,-centre.z);pg.rotateX(angle);pg.translate(centre.x,centre.y,centre.z);
 // Deux joues triangulaires pleines ; vitrage séparé de la pente opaque.
 for(const x of [-.315,.235]){
  const shape=new THREE.Shape();shape.moveTo(z0,ybas);shape.lineTo(z1,ybas);shape.lineTo(z0+.018,yhaut);shape.lineTo(z0,yhaut);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:false,steps:1,curveSegments:1});
  const pos=g.getAttribute('position');for(let k=0;k<pos.count;k++)pos.setXYZ(k,x+pos.getZ(k)-.007,pos.getY(k),pos.getX(k));
  // X/Z permutation changes handedness: reverse each triangle before deriving normals.
  for(let k=0;k<pos.count;k+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,k+1),b=new THREE.Vector3().fromBufferAttribute(pos,k+2);pos.setXYZ(k+1,b.x,b.y,b.z);pos.setXYZ(k+2,a.x,a.y,a.z);}
  projeterUv(g);g.computeVertexNormals();ajouter('toit',g,0,`joue_shed_${j}_${x}`);
 }
 boite('toit',[.514,.184,.012],[xc,.687,z0+.006],4,`verriere_${j}`);
 for(const y of [.588,.784])boite('toit',[.568,.021,.031],[xc,y,z0+.007],3,`traverse_verriere_${j}_${y}`);
 for(const x of [-.312,-.133,.053,.232])boite('toit',[.013,.208,.025],[x,.686,z0+.006],3,`meneau_${j}_${x}`);
 plaque('toit',[.584,.020,.038],[xc,.799,z0+.009],2,`rive_haute_${j}`,.004);
 // Rives latérales sur la pente, gris équipe lisible en vue plongeante.
 for(const x of [-.323,.243]){
  const g=new THREE.BoxGeometry(.028,.024,len+.017);g.rotateX(angle);ajouter('toit',g,2,`rive_pente_${j}_${x}`,[x,centre.y+.002,centre.z]);
 }
}
// Petite glissière de capture horizontale, indépendante du toit et de la façade.
plaque('toit',[.264,.022,.107],[-.04,.583,.083],5,'console_capture',.004);
plaque('toit',[.238,.009,.081],[-.04,.596,.083],6,'fond_glissiere',.003);
for(const z of [.035,.131])boite('toit',[.265,.020,.014],[-.04,.601,z],3,`rail_capture_${z}`);
for(const x of [-.177,.097])boite('toit',[.016,.020,.110],[x,.601,.083],3,`butee_capture_${x}`);
plaque('enseigne',[.136,.013,.066],[-.060,.607,.083],2,'indicateur_capture',.003);
// Portique à palan rangé sur le flanc droit ; poutre en I, pieds et jambes stables.
for(const z of [-.330,.176]){
 plaque('corps',[.132,.021,.087],[.358,.0365,z],3,`pied_portique_${z}`,.004);
 plaque('corps',[.039,.482,.040],[.358,.288,z],5,`montant_portique_${z}`,.006);
 for(const s of [-1,1])tige('corps',[.358+s*.048,.047,z],[.358,.195,z],.0105,3,`jambe_portique_${z}_${s}`,8);
 for(const x of [.310,.406])cyl('corps',.010,.008,[x,.051,z],3,`boulon_pied_${z}_${x}`,[0,0,0],8);
}
boite('corps',[.070,.018,.592],[.358,.537,-.077],3,'poutre_semelle_basse');
boite('corps',[.018,.067,.592],[.358,.570,-.077],5,'poutre_ame');
plaque('corps',[.070,.018,.600],[.358,.611,-.077],3,'poutre_semelle_haute',.003);
for(const z of [-.351,.197])plaque('corps',[.105,.063,.022],[.358,.557,z],5,`butee_portique_${z}`,.004);
// Chariot : quatre galets sur semelle ; joues porteuses sous la poutre et palan.
for(const x of [.333,.383])for(const z of [-.097,-.033])cyl('chariot',.016,.017,[x,.562,z],3,`galet_chariot_${x}_${z}`,[0,0,Math.PI/2],16);
for(const x of [.3175,.3985])for(const z of [-.097,-.033])cyl('chariot',.006,.026,[x,.562,z],3,`axe_galet_${x}_${z}`,[0,0,Math.PI/2],8);
for(const x of [.310,.406])plaque('chariot',[.014,.072,.105],[x,.528,-.065],5,`joue_chariot_${x}`,.004);
plaque('chariot',[.111,.027,.095],[.358,.486,-.065],5,'traverse_chariot',.004);
cyl('chariot',.037,.062,[.358,.445,-.065],5,'palan',[Math.PI/2,0,0],24);
cyl('chariot',.023,.069,[.358,.445,-.065],3,'axe_palan',[Math.PI/2,0,0],20);
// Brin de chaîne en vrais maillons alternés, sans antenne fine ni longue arête libre.
for(let j=0;j<11;j++){
 const g=new THREE.TorusGeometry(.0072,.0016,4,8);g.scale(.72,1.34,1);if(j%2)g.rotateY(Math.PI/2);
 ajouter('chariot',g,3,`maillon_${j}`,[.358,.410-j*.013,-.065]);
}
// Crochet épais ouvert, raccordé au dernier maillon ; ouverture volontaire tournée +Z.
const pts:V3[]=[[.358,.267,-.065],[.358,.254,-.065],[.358,.241,-.065],[.358,.230,-.055],[.358,.230,-.040],[.358,.241,-.032],[.358,.250,-.038]];
tuyau('chariot',pts,.0055,3,'crochet',16);
cyl('chariot',.010,.018,[.358,.271,-.065],3,'emergence_crochet',[0,0,0],12);
// Caisses et palette sur le flanc gauche, jamais devant le rideau.
for(const [k,z,y] of [[0,-.264,.075],[1,-.150,.075],[2,-.217,.173]] as const){
 plaque('corps',[.100,.098,.102],[-.390,y,z],9,`caisse_${k}`,.005);
 for(const xx of [-.431,-.349])boite('corps',[.008,.102,.108],[xx,y,z],8,`sangle_caisse_${k}_${xx}`);
}
for(const z of [.012,.155])boite('corps',[.108,.020,.026],[-.386,.036,z],9,`pied_palette_${z}`);
for(let k=0;k<4;k++)boite('corps',[.110,.016,.037],[-.386,.054,.016+k*.044],9,`planche_palette_${k}`);
// Trois galets de rechange couchés sur la palette : caoutchouc et moyeux biseautés.
for(let k=0;k<3;k++){
 const z=.025+k*.055;
 cyl('corps',.028,.049,[-.386,.090,z],7,`pneu_rechange_${k}`,[0,0,Math.PI/2],16);
 cyl('corps',.021,.052,[-.386,.090,z],3,`jante_rechange_${k}`,[0,0,Math.PI/2],16);
 cyl('corps',.009,.057,[-.386,.090,z],8,`moyeu_rechange_${k}`,[0,0,Math.PI/2],12);
 // Deux cales garantissent un appui non tangentiel sur le plateau.
 for(const dz of [-.024,.024])boite('corps',[.048,.017,.013],[-.386,.067,z+dz],9,`cale_galet_${k}_${dz}`);
}
// Râtelier d'atelier sur le mur gauche, outils attachés et ordonnés.
plaque('corps',[.017,.154,.242],[-.3235,.378,-.175],8,'râtelier',.003);
for(const z of [-.260,-.190,-.120]){
 boite('corps',[.016,.116,.015],[-.343,.365,z],3,`manche_outil_${z}`);
 boite('corps',[.034,.021,.043],[-.347,.423,z],3,`tete_outil_${z}`);
 boite('corps',[.030,.016,.029],[-.337,.340,z],5,`attache_outil_${z}`);
}
// Luminaire de façade : lentille seule émissive.
plaque('corps',[.067,.027,.038],[.154,.551,.085],5,'support_lampe',.004);
boite('corps',[.055,.016,.014],[.154,.550,.106],10,'lentille_lampe');
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

const clips=[
 new THREE.AnimationClip('repos',3.2,[new THREE.VectorKeyframeTrack('chariot.position',[0,.4,.8,1.2,1.6,2,2.4,2.8,3.2],[0,.030,.044,.030,0,-.030,-.044,-.030,0].flatMap(d=>[.358,.527,-.065+d]))]),
 new THREE.AnimationClip('capture',1.4,[new THREE.VectorKeyframeTrack('enseigne.position',[0,.28,.70,1.03,1.4],[0,.028,.045,.028,0].flatMap(d=>[-.04+d,.605,.060]))]),
];
async function ecrire(){
 if(triangles>5600)throw new Error(`Budget ${triangles}/5600`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','emission','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[]}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};if(m.name==='mat_vitrage'){m.emissiveTexture={index:3};m.emissiveFactor=[1,1,1];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — Usine commune à sheds originale v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:5600,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
