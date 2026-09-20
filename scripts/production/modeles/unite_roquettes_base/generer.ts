/** Camion porte-caisson à six roues original. Aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_roquettes_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,.20,0]},base:{parent:'racine',p:[0,0,0]},
 module_lance_roquettes:{parent:'corps',p:[0,.10,-.19]},os_recul:{parent:'module_lance_roquettes',p:[0,0,0]},
 socle:{parent:'corps',p:[-.104,.226,.295]},
};
const roues:string[]=[],glissieres:string[]=[],pieds:string[]=[];
for(const s of [-1,1]){
 for(const [i,z] of [-.275,-.02,.265].entries()){
  const n=`os_roue_${s<0?'g':'d'}_${i}`;poses[n]={parent:'base',p:[s*.214,.090272,z]};roues.push(n);
 }
 for(const [i,z] of [-.145,.12].entries()){
  const n=`os_glissiere_${s<0?'g':'d'}_${i}`,p=`os_pied_${s<0?'g':'d'}_${i}`;
  poses[n]={parent:'base',p:[s*.282,.202,z]};glissieres.push(n);
  poses[p]={parent:n,p:[0,0,0]};pieds.push(p);
 }
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
  for(let j=0;j<2;j++){const t=a+j/2*Math.PI/2;pts.push(new THREE.Vector2(xc+c*Math.cos(t),zc+c*Math.sin(t)+z));}}
 return pts;
}
function carene(ss:{y:number;w:number;d:number;c:number;z?:number}[]):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],ix:number[]=[];const rings=ss.map(s=>octo(s.w,s.d,s.c,s.z).map(v=>new THREE.Vector3(v.x,s.y,v.y)));
 function face(v:THREE.Vector3[]){const start=pos.length/3;const no=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();const axes=Math.abs(no.y)>=Math.max(Math.abs(no.x),Math.abs(no.z))?['x','z'] as const:Math.abs(no.x)>Math.abs(no.z)?['z','y'] as const:['x','y'] as const;const uu=v.map(x=>x[axes[0]]),vv=v.map(x=>x[axes[1]]);const u=Math.min(...uu),v0=Math.min(...vv),du=Math.max(...uu)-u,dv=Math.max(...vv)-v0;v.forEach((x,i)=>{pos.push(...x.toArray());uv.push((uu[i]!-u)/du,(vv[i]!-v0)/dv);});for(let i=1;i<v.length-1;i++)ix.push(start,start+i,start+i+1);}
 face(rings[0]!);for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;face([rings[j]![i]!,rings[j+1]![i]!,rings[j+1]![k]!,rings[j]![k]!]);}face([...rings.at(-1)!].reverse());
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


// Six roues à pneus épais et jantes raccordées aux talons.
for(const s of [-1,1])for(const [i,z] of [-.275,-.02,.265].entries()){
 const n=`os_roue_${s<0?'g':'d'}_${i}`,tag=`${s<0?'g':'d'}_${i}`,x=s*.214;
 const profil=[[-.049,.055],[-.045,.077],[-.031,.087],[.031,.087],[.045,.077],[.049,.055],[.033,.052],[-.033,.052]].map(([a,r])=>new THREE.Vector2(r,a));profil.push(profil[0]!.clone());
 ajouter(n,new THREE.LatheGeometry(profil,12).rotateZ(Math.PI/2),2,`pneu_${tag}`,[x,.090272,z]);
 cyl(n,.060,.103,[x,.090272,z],3,`jante_${tag}`,[0,0,Math.PI/2],16);
 cyl(n,.036,.112,[x,.090272,z],1,`moyeu_${tag}`,[0,0,Math.PI/2],12);
 for(let j=0;j<3;j++){const a=j/3*Math.PI*2;cyl(n,.0055,.006,[x+s*.059,.090272+Math.sin(a)*.024,z+Math.cos(a)*.024],3,`boulons_${tag}`,[0,0,Math.PI/2],6);}
 for(let j=0;j<12;j++){const a=j/12*Math.PI*2;boite(n,[.067,.006,.014],[x,.090272+.087*Math.cos(a),z+.087*Math.sin(a)],2,`crampons_${tag}`,[a,0,0]);}
 if(s===1)cyl('base',.017,.44,[0,.090272,z],3,`essieu_${i}`,[0,0,Math.PI/2],12);
 tige('base',[s*.13,.158,z-.024],[s*.20,.090272,z],.014,1,`bras_${tag}`);
 plaque('corps',[.117,.016,.203],[x,.203,z],5,`garde_boue_${tag}`,[0,0,0],.022);
 boite('corps',[.062,.023,.056],[s*.168,.205,z],1,'attaches_garde_boue');
}
for(const s of [-1,1])boite('base',[.032,.056,.683],[s*.131,.147,-.010],1,'longerons');
for(const z of [-.315,.33])boite('base',[.29,.027,.048],[0,.171,z],3,'traverses');
ajouter('corps',carene([{y:.210,w:.412,d:.820,c:.105},{y:.233,w:.438,d:.830,c:.107}]),5,'plateau');
plaque('corps',[.398,.010,.42],[0,.239,-.196],8,'plancher');
// Extrémités étroites pour la rotation du gabarit c dans la case.
for(const s of [-1,1]){
 plaque('corps',[.110,.028,.017],[0,.197,s*.4265],1,'pare_chocs',[0,0,0],.006);
 for(const x of [-.045,.045])tige('corps',[x,.217,s*.400],[x,.205,s*.427],.012,3,'supports_pare_chocs');
}
ajouter('corps',carene([{y:.235,w:.350,d:.257,c:.034,z:.276},{y:.299,w:.366,d:.254,c:.043,z:.276},{y:.395,w:.310,d:.193,c:.044,z:.254}]),5,'cabine');
plaque('corps',[.314,.014,.194],[0,.401,.254],1,'pavillon',[0,0,0],.025);
for(const s of [-1,1]){
 boite('corps',[.112,.066,.010],[s*.065,.349,.3791],4,'pare_brise',[-Math.atan(.0525/.096),0,0]);
 boite('corps',[.010,.064,.102],[s*.1725,.346,.258],4,'vitres_laterales',[0,0,s*Math.atan(.028/.096)]);
 plaque('corps',[.011,.050,.133],[s*.183,.273,.269],0,'porte_equipe',[0,0,0],.003);
 boite('corps',[.014,.009,.029],[s*.192,.288,.220],3,'poignee');
 plaque('corps',[.064,.014,.116],[s*.202,.226,.262],8,'marchepied',[0,0,0],.006);
 boite('corps',[.040,.024,.017],[s*.119,.267,.405],1,'support_feu');
 boite('corps',[.029,.015,.008],[s*.119,.267,.417],7,'lentille_feu');
 boite('corps',[.035,.019,.011],[s*.095,.253,-.409],7,'feux_arriere');
 tige('corps',[s*.016,.326,.391],[s*.096,.331,.388],.0035,1,'essuie_glaces',6);
}
boite('corps',[.130,.031,.011],[0,.273,.407],6,'grille_avant');
for(let i=0;i<5;i++)boite('corps',[.009,.027,.008],[-.048+i*.024,.273,.417],3,'lames_grille');
plaque('corps',[.104,.010,.100],[0,.413,.25],5,'trappe_cabine',[0,0,0],.011);
plaque('corps',[.037,.011,.034],[-.104,.411,.295],1,'support_temoin',[0,0,0],.004);
plaque('socle',[.027,.020,.025],[-.104,.426,.295],7,'temoin',[0,0,0],.004);
// Stabilisateurs télescopiques, semelles à plat et coulisseaux creux.
for(const s of [-1,1])for(const [i,z] of [-.145,.12].entries()){
 const tag=`${s<0?'g':'d'}_${i}`,g=`os_glissiere_${tag}`,p=`os_pied_${tag}`;
 tube(`fourreau_horizontal_${tag}`,'base',.024,.018,.135,[s*.192,.202,z],1,12,[0,0,Math.PI/2]);
 cyl(g,.014,.137,[s*.224,.202,z],3,`glissiere_${tag}`,[0,0,Math.PI/2],12);
 cyl(g,.025,.048,[s*.282,.202,z],1,`collier_${tag}`,[0,0,Math.PI/2],12);
 tube(`fourreau_vertical_${tag}`,g,.022,.014,.128,[s*.282,.148,z],1,12);
 cyl(p,.011,.135,[s*.282,.0835,z],3,`tige_pied_${tag}`,[0,0,0],12);
 cyl(p,.019,.021,[s*.282,.021,z],1,`rotule_pied_${tag}`,[Math.PI/2,0,0],12);
 plaque(p,[.066,.013,.051],[s*.282,.0065,z],8,`semelle_${tag}`,[0,0,0],.006);
}
// Pivot arrière transversal et berceau.
for(const s of [-1,1]){
 plaque('corps',[.048,.067,.100],[s*.151,.271,-.19],1,'berceau_fixe',[0,0,0],.009);
 cyl('module_lance_roquettes',.028,.045,[s*.173,.300,-.19],3,'tourillons',[0,0,Math.PI/2],16);
 boite('module_lance_roquettes',[.037,.028,.261],[s*.140,.312,-.10],1,'rails_recul');
 boite('os_recul',[.039,.018,.224],[s*.140,.334,-.10],3,'patins_recul');
}
cyl('corps',.018,.340,[0,.300,-.19],3,'axe_pivot',[0,0,Math.PI/2],16);
// Caisson large à douze cellules, incliné de 0,32 rad au repos.
for(const s of [-1,1]){
 plaque('os_recul',[.016,.181,.430],[s*.313,.4325,-.025],0,'joue_equipe',[0,0,0],.005);
 for(const z of [-.174,.09])plaque('os_recul',[.022,.044,.060],[s*.323,.436,z],1,'renfort_joue',[0,0,0],.004);
}
for(const y of [.347,.520])plaque('os_recul',[.619,.013,.430],[0,y,-.025],5,y<.4?'plancher_caisson':'toit_caisson',[0,0,0],.004);
plaque('os_recul',[.614,.166,.016],[0,.433,-.246],1,'fond_caisson',[0,0,0],.005);
for(const [j,y] of [.391,.476].entries())for(const [k,x] of [-.25,-.15,-.05,.05,.15,.25].entries()){
 tube(`cellule_${j}_${k}`,'os_recul',.038,.0295,.412,[x,y,-.024],3,8,[Math.PI/2,0,0]);
 cyl('os_recul',.029,.006,[x,y,-.226],4,`fond_cellule_${j}_${k}`,[Math.PI/2,0,0],8);
 tube(`levre_${j}_${k}`,'os_recul',.040,.0295,.015,[x,y,.185],1,8,[Math.PI/2,0,0]);
}
for(const x of [-.303,-.20,-.10,0,.10,.20,.303])boite('os_recul',[.009,.169,.014],[x,.434,.186],5,'montants_facade');
for(const y of [.352,.434,.516])boite('os_recul',[.607,.010,.014],[0,y,.186],5,'traverses_facade');
for(const x of [-.242,.242])for(const z of [-.165,.065])boite('os_recul',[.055,.013,.030],[x,.531,z],3,'prises_manutention');
const pivotRack=pivot('module_lance_roquettes');
for(const n of ['module_lance_roquettes','os_recul'])for(const p of pieces.get(n)??[]){p.g.translate(-pivotRack.x,-pivotRack.y,-pivotRack.z);p.g.rotateX(-.32);p.g.translate(...pivotRack.toArray());}
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

const roue=(n:string)=>rot(n,[0,.25,.5,.75,1],[[0,0,0],[Math.PI/2,0,0],[Math.PI,0,0],[Math.PI*1.5,0,0],[Math.PI*2,0,0]]);
const repos=rot('module_lance_roquettes',[0,.6,1.2,1.8,2.4],[[0,0,0],[-.004,0,0],[0,0,0],[.004,0,0],[0,0,0]]);
const retracter=()=>[...glissieres.map(n=>pos(n,[0,1],[[n.includes('_g_')?.037:-.037,0,0],[n.includes('_g_')?.037:-.037,0,0]])),...pieds.map(n=>pos(n,[0,1],[[0,.064,0],[0,.064,0]]))];
const clips=[
 new THREE.AnimationClip('repos',2.4,[repos]),
 new THREE.AnimationClip('deplacement',1,[...roues.map(roue),...retracter(),rot('module_lance_roquettes',[0,1],[[.07,0,0],[.07,0,0]]),pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.003,0],[0,0,0],[0,-.003,0],[0,0,0]])]),
 new THREE.AnimationClip('tir',.7,[rot('module_lance_roquettes',[0,.16,.24,.36,.7],[[0,0,0],[-.10,0,0],[-.10,0,0],[-.095,0,0],[0,0,0]]),pos('os_recul',[0,.16,.24,.36,.7],[[0,0,0],[0,0,0],[0,-.003,-.010],[0,-.001,-.003],[0,0,0]]),pos('corps',[0,.16,.24,.36,.7],[[0,0,0],[0,0,0],[0,-.003,0],[0,.001,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.09,.22,.5],[[0,0,0],[0,-.005,0],[0,.002,0],[0,0,0]]),rot('module_lance_roquettes',[0,.09,.22,.5],[[0,0,0],[.018,0,0],[-.008,0,0],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.56,.9],[[0,0,0],[0,-.008,0],[0,-.008,0]]),rot('module_lance_roquettes',[0,.56,.9],[[0,0,0],[.09,0,0],[.09,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.56,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>9000)throw new Error(`Budget ${triangles}/9000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Porte-caisson à six roues original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
