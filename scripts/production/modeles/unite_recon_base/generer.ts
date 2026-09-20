/** Voiture de reconnaissance originale. Aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_recon_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,.2,0]},
 base:{parent:'racine',p:[0,0,0]},
 module_radar:{parent:'corps',p:[0,.126,-.212]},
 os_marqueur:{parent:'corps',p:[.102,.065,.267]},
 socle:{parent:'corps',p:[.104,.139,.055]},
};
const roues:string[]=[];
for(const s of [-1,1])for(const [i,z] of [-.238,0,.238].entries()){
 const n=`os_roue_${s<0?'g':'d'}_${i}`;poses[n]={parent:'base',p:[s*.201,.078,z]};roues.push(n);
}
function pivot(n:string):THREE.Vector3{const p=poses[n]!;return new THREE.Vector3(...p.p).add(p.parent?pivot(p.parent):new THREE.Vector3());}
function ajouter(n:string,g:THREE.BufferGeometry,role:number,nom:string,p:V3=[0,0,0],r:V3=[0,0,0]){
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,((role%4)+.065+uv.getX(i)*.87)/4,(Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1)));
 const a=pieces.get(n)??[];a.push({g,role,nom});pieces.set(n,a);
}
function boite(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0]){ajouter(n,new THREE.BoxGeometry(...s),role,nom,p,r);}
function cyl(n:string,ra:number,h:number,p:V3,role:number,nom:string,r:V3=[0,0,0],ns=16,rb=ra){ajouter(n,new THREE.CylinderGeometry(rb,ra,h,ns,1,false),role,nom,p,r);}
function octo(w:number,d:number,c:number,z=0):THREE.Vector2[]{
 c=Math.min(c,w/2-.00001,d/2-.00001);const pts:THREE.Vector2[]=[];
 for(let q=0;q<4;q++){const a=q*Math.PI/2,xc=(q===0||q===3?1:-1)*(w/2-c),zc=(q<2?1:-1)*(d/2-c);
  for(let j=0;j<4;j++){const t=a+j/4*Math.PI/2;pts.push(new THREE.Vector2(xc+c*Math.cos(t),zc+c*Math.sin(t)+z));}}
 return pts;
}
function carene(ss:{y:number;w:number;d:number;c:number;z?:number}[]):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],ix:number[]=[];const rings=ss.map(s=>octo(s.w,s.d,s.c,s.z).map(v=>new THREE.Vector3(v.x,s.y,v.y)));
 function face(v:THREE.Vector3[]){const start=pos.length/3;const no=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();const axes=Math.abs(no.y)>=Math.max(Math.abs(no.x),Math.abs(no.z))?['x','z'] as const:Math.abs(no.x)>Math.abs(no.z)?['z','y'] as const:['x','y'] as const;const uu=v.map(x=>x[axes[0]]),vv=v.map(x=>x[axes[1]]);const u=Math.min(...uu),v0=Math.min(...vv),du=Math.max(...uu)-u,dv=Math.max(...vv)-v0;v.forEach((x,i)=>{pos.push(...x.toArray());uv.push((uu[i]!-u)/du,(vv[i]!-v0)/dv);});for(let i=1;i<v.length-1;i++)ix.push(start,start+i,start+i+1);}
 face(rings[0]!);for(let j=0;j<rings.length-1;j++)for(let i=0;i<16;i++){const k=(i+1)%16;face([rings[j]![i]!,rings[j+1]![i]!,rings[j+1]![k]!,rings[j]![k]!]);}face([...rings.at(-1)!].reverse());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function plaque(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0],b=.005){const [w,h,d]=s;const k=Math.min(b,h*.3);ajouter(n,carene([{y:-h/2,w,d,c:b},{y:h/2,w:w-k*2,d:d-k*2,c:b}]),role,nom,p,r);}
function tige(n:string,a:V3,b:V3,rayon:number,role:number,nom:string,segments=8){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa);const g=new THREE.CylinderGeometry(rayon,rayon,v.length(),segments,1,false);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));ajouter(n,g,role,nom,aa.add(bb).multiplyScalar(.5).toArray() as V3);}
/** Parois concentriques et anneaux distincts : aucune face pleine dans l'ouverture. */
function tube(nom:string,n:string,ro:number,ri:number,h:number,p:V3,role:number,ns=12,r:V3=[0,0,0]){
 const ext=new THREE.CylinderGeometry(ro,ro,h,ns,1,true),int=new THREE.CylinderGeometry(ri,ri,h,ns,1,true);
 const no=int.getAttribute('normal');for(let i=0;i<no.count;i++)no.setXYZ(i,-no.getX(i),-no.getY(i),-no.getZ(i));const ix=int.index!;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a);}
 const haut=new THREE.RingGeometry(ri,ro,ns).rotateX(-Math.PI/2).translate(0,h/2,0),bas=new THREE.RingGeometry(ri,ro,ns).rotateX(Math.PI/2).translate(0,-h/2,0);
 ajouter(n,mergeGeometries([ext,int,haut,bas],false)!,role,nom,p,r);
}


// Coque en capsule à quatre niveaux, fine et arrondie, sans blindage ni tourelle.
ajouter('corps',carene([{y:.129,w:.245,d:.578,c:.090},{y:.176,w:.336,d:.670,c:.112},{y:.224,w:.336,d:.670,c:.112},{y:.248,w:.280,d:.615,c:.096}]),5,'capsule');
// Capot et deux portes : seules surfaces de couleur d'équipe.
ajouter('corps',carene([{y:.246,w:.261,d:.200,c:.045,z:.202},{y:.256,w:.244,d:.187,c:.044,z:.202}]),0,'capot_equipe');
for(const s of [-1,1]){
 plaque('corps',[.010,.057,.170],[s*.166,.208,.074],0,'porte_equipe',[0,0,0],.003);
 boite('corps',[.016,.009,.038],[s*.174,.222,.034],3,'poignee');
}
// Cabine vitrée basse : grande verrière unie avec cadre indépendant, sans reflet peint.
ajouter('corps',carene([{y:.237,w:.263,d:.291,c:.045,z:.068},{y:.286,w:.264,d:.253,c:.043,z:.052}]),1,'cadre_cabine');
ajouter('corps',carene([{y:.282,w:.264,d:.253,c:.043,z:.052},{y:.328,w:.218,d:.197,c:.040,z:.042}]),4,'verriere');
plaque('corps',[.238,.012,.215],[0,.331,.042],5,'toit_cabine',[0,0,0],.044);
for(const s of [-1,1])tige('corps',[s*.097,.283,.173],[s*.079,.330,.135],.008,1,'montants_parebrise',6);
// Plateau arrière et motorisation ; la parabole est couchée au-dessus, jamais dans la cabine.
plaque('corps',[.218,.013,.170],[0,.252,-.221],1,'plateau_arriere',[0,0,0],.035);
plaque('corps',[.099,.012,.039],[0,.264,-.292],6,'aeration_moteur',[0,0,0],.005);
// Pneus larges sur trois essieux. Roues indépendantes pour leur rotation, bras fixes lisibles.
function pneu(n:string,p:V3,rayon:number,largeur:number,nom:string){
 const profil=[[.74*rayon,-largeur/2],[rayon,-largeur*.34],[rayon,largeur*.34],[.74*rayon,largeur/2]].map(([r,y])=>new THREE.Vector2(r!,y!));
 ajouter(n,new THREE.LatheGeometry(profil,16).rotateZ(Math.PI/2),2,nom,p);
 cyl(n,rayon*.80,largeur*1.02,p,3,nom+'_jante',[0,0,Math.PI/2],12);
}
function gardeBoue(n:string,p:V3,nom:string){
 const ps:number[]=[],uv:number[]=[],idx:number[]=[];
 // Section transversale rectangulaire balayée sur le demi-cercle supérieur.
 const section=[[-.043,.094],[-.043,.100],[.043,.100],[.043,.094]],ns=8;
 for(let s=0;s<4;s++){
  const start=ps.length/3;
  for(let i=0;i<=ns;i++)for(const j of [s,(s+1)%4]){const [x,r]=section[j]!,a=i/ns*Math.PI;ps.push(x!,Math.sin(a)*r!,Math.cos(a)*r!);uv.push(i/ns,j===s?0:1);}
  for(let i=0;i<ns;i++){const k=start+i*2;idx.push(k,k+2,k+3,k,k+3,k+1);}
 }
 for(const a of [0,Math.PI]){
  const k=ps.length/3;section.forEach(([x,r],j)=>{ps.push(x!,Math.sin(a)*r!,Math.cos(a)*r!);uv.push(j<2?0:1,j===0||j===3?0:1);});
  if(a===0)idx.push(k,k+2,k+1,k,k+3,k+2);else idx.push(k,k+1,k+2,k,k+2,k+3);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));for(let i=0;i<idx.length;i+=3){const t=idx[i+1]!;idx[i+1]=idx[i+2]!;idx[i+2]=t;}g.setIndex(idx);g.computeVertexNormals();ajouter(n,g,1,nom,p);
}
for(const s of [-1,1])for(const [i,z] of [-.238,0,.238].entries()){
 const n=`os_roue_${s<0?'g':'d'}_${i}`,p:V3=[s*.201,.078,z];pneu(n,p,.078,.074,`pneu_${s}_${i}`);
 cyl(n,.028,.012,[s*.239,.078,z],1,`moyeu_${s}_${i}`,[0,0,Math.PI/2],8);
 gardeBoue('corps',[s*.201,.078,z],`garde_boue_${s}_${i}`);
 tige('base',[s*.104,.111,z-.047],[s*.183,.078,z],.011,3,`bras_avant_${s}_${i}`,6);
 tige('base',[s*.104,.111,z+.047],[s*.183,.078,z],.011,3,`bras_arriere_${s}_${i}`,6);
}
// Deux longerons mécaniques ; pas de socle artificiel sous les roues.
for(const s of [-1,1])boite('base',[.025,.034,.53],[s*.105,.110,0],1,'longeron');
for(const z of [-.238,0,.238])cyl('base',.012,.380,[0,.078,z],3,'essieu',[0,0,Math.PI/2],8);
// Roue de secours sur le flanc gauche, retenue par une console rigide.
boite('corps',[.042,.047,.033],[-.182,.249,-.098],3,'console_secours');
pneu('corps',[-.212,.251,-.098],.055,.046,'pneu_secours');
cyl('corps',.020,.010,[-.240,.251,-.098],1,'ecrou_secours',[0,0,Math.PI/2],8);
// Pare-chocs, projecteurs et anneaux remorquage : l'avant reste léger.
for(const z of [-.337,.337]){
 boite('corps',[.234,.021,.025],[0,.174,z],1,'parechoc');
 for(const s of [-1,1])boite('corps',[.049,.027,.021],[s*.101,.201,z],z>0?7:4,'projecteur');
}
// Marqueur court, porté par le capot ; une vraie bouche creuse sans projectile.
boite('corps',[.045,.021,.060],[.102,.258,.268],1,'support_marqueur');
boite('os_marqueur',[.037,.032,.047],[.102,.278,.276],5,'carter_marqueur');
tube('tube_marqueur','os_marqueur',.0175,.0105,.055,[.102,.278,.323],3,12,[Math.PI/2,0,0]);
cyl('os_marqueur',.0105,.004,[.102,.278,.297],1,'fond_marqueur',[Math.PI/2,0,0],12);
// Radar couché, concave vers le ciel et tournant autour d'un axe vertical.
cyl('corps',.022,.065,[0,.291,-.212],1,'support_radar',[0,0,0],12);
cyl('module_radar',.015,.024,[0,.330,-.212],3,'axe_radar',[0,0,0],12);
function parabole():THREE.BufferGeometry{
 const ps:number[]=[],uv:number[]=[],ix:number[]=[],ns=20,rings=3;
 for(let side=0;side<2;side++){
  const k=ps.length/3;ps.push(0,side===0?0:-.007,0);uv.push(.5,.5);
  for(let j=1;j<=rings;j++)for(let i=0;i<ns;i++){const r=.083*j/rings,a=i/ns*Math.PI*2;ps.push(Math.cos(a)*r,.016*(r/.083)**2-(side===0?0:.007),Math.sin(a)*r);uv.push(.5+Math.cos(a)*r/.18,.5+Math.sin(a)*r/.18);}
  const tr=(a:number,b:number,c:number)=>side===0?ix.push(k+a,k+c,k+b):ix.push(k+a,k+b,k+c);
  for(let i=0;i<ns;i++)tr(0,1+i,1+(i+1)%ns);
  for(let j=1;j<rings;j++)for(let i=0;i<ns;i++){const a=1+(j-1)*ns+i,b=1+(j-1)*ns+(i+1)%ns,c=a+ns,d=b+ns;tr(a,c,d);tr(a,d,b);}
 }
 const k=ps.length/3;
 for(let i=0;i<=ns;i++)for(const y of [.009,.016]){const a=i/ns*Math.PI*2;ps.push(Math.cos(a)*.083,y,Math.sin(a)*.083);uv.push(i/ns,y===.009?0:1);}
 for(let i=0;i<ns;i++){const a=k+i*2;ix.push(a,a+3,a+2,a,a+1,a+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
ajouter('module_radar',parabole(),5,'parabole',[0,.348,-.212]);
// Récepteur au-dessus du centre, fixé à un bras latéral qui tourne avec la parabole.
tige('module_radar',[.076,.355,-.212],[.038,.391,-.212],.0105,1,'bras_recepteur_1',8);
tige('module_radar',[.038,.391,-.212],[0,.391,-.212],.0105,1,'bras_recepteur_2',8);
cyl('module_radar',.015,.027,[0,.386,-.212],4,'recepteur',[0,0,0],12);
// Témoin rétractable sur le toit : absent en fin hors_jeu.
cyl('corps',.015,.011,[.104,.337,.055],1,'support_temoin',[0,0,0],8);
boite('socle',[.022,.027,.022],[.104,.352,.055],7,'temoin');

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();let triangles=0;const bilan:Record<string,number>={};
for(const [nom,pose] of Object.entries(poses)){
 const ps=pieces.get(nom)??[];let o:THREE.Object3D;
 if(ps.length){const gs:THREE.BufferGeometry[]=[],mi:number[]=[];const infos:{nom:string;primitive:number;triangleDebut:number;triangles:number;role:number}[]=[];
  for(const mat of [0,1]){let debut=0;const sel=ps.filter(p=>(p.role===0?0:1)===mat);if(!sel.length)continue;
   const source=sel.map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone(),t=g.getAttribute('position').count/3,po=pivot(nom);g.translate(-po.x,-po.y,-po.z);infos.push({nom:p.nom,primitive:gs.length,triangleDebut:debut,triangles:t,role:p.role});debut+=t;triangles+=t;bilan[p.nom]=(bilan[p.nom]??0)+t;return g;});
   const g=mergeVertices(mergeGeometries(source,false)!,1e-7);g.computeTangents();gs.push(g);mi.push(mat);
  }
  const g=mergeGeometries(gs,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mi[i]!);o=new THREE.Mesh(g,materiaux);o.userData={pieces:infos};
 }else o=new THREE.Group();o.name=nom;o.position.set(...pose.p);objets.set(nom,o);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const rot=(n:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,t,v.flatMap(p=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...p)).toArray()));
const pos=(n:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${n}.position`,t,v.flatMap(p=>p.map((x,i)=>x+poses[n]!.p[i]!)));

const radar=(d:number)=>rot('module_radar',[0,d/4,d/2,d*3/4,d],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,Math.PI*1.5,0],[0,Math.PI*2,0]]);
const roue=(n:string)=>rot(n,[0,.25,.5,.75,1],[[0,0,0],[Math.PI/2,0,0],[Math.PI,0,0],[Math.PI*1.5,0,0],[Math.PI*2,0,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[radar(2.4)]),
 new THREE.AnimationClip('deplacement',1,[radar(1),...roues.map(roue),pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.003,0],[0,0,0],[0,-.003,0],[0,0,0]])]),
 new THREE.AnimationClip('tir',.7,[pos('os_marqueur',[0,.08,.18,.36,.7],[[0,0,0],[0,0,-.007],[0,0,-.007],[0,0,-.002],[0,0,0]]),pos('corps',[0,.08,.2,.7],[[0,0,0],[0,.003,0],[0,.001,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.1,.23,.5],[[0,0,0],[0,.004,0],[0,.001,0],[0,0,0]]),rot('corps',[0,.1,.23,.5],[[0,0,0],[.006,0,.009],[-.003,0,-.004],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.25,.6,.9],[[0,0,0],[0,.003,0],[0,-.008,0],[0,-.008,0]]),rot('module_radar',[0,.6,.9],[[0,0,0],[0,.64,0],[0,.64,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>3500)throw new Error(`Budget ${triangles}/3500`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Reconnaissance originale v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:3500,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
