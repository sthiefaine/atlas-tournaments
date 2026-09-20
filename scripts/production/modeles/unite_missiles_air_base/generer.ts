/** Camion lance-marqueurs original. Aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_missiles_air_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},base:{parent:'racine',p:[0,0,0]},
 corps:{parent:'racine',p:[0,.235,0]},
 module_lance_roquettes:{parent:'corps',p:[0,.080,-.245]},
 os_recul:{parent:'module_lance_roquettes',p:[0,0,0]},
 module_radar:{parent:'corps',p:[0,.279,.231]},
 socle:{parent:'corps',p:[.129,.238,.250]},
};
function pivot(n:string):THREE.Vector3{const p=poses[n]!;return new THREE.Vector3(...p.p).add(p.parent?pivot(p.parent):new THREE.Vector3());}
function ajouter(n:string,g:THREE.BufferGeometry,role:number,nom:string,p:V3=[0,0,0],r:V3=[0,0,0]){
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,((role%4)+.065+uv.getX(i)*.87)/4,(Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1)));
 const a=pieces.get(n)??[];a.push({g,role,nom});pieces.set(n,a);
}
function boite(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0]){ajouter(n,new THREE.BoxGeometry(...s),role,nom,p,r);}
function cyl(n:string,ra:number,h:number,p:V3,role:number,nom:string,r:V3=[0,0,0],ns=16,rb=ra){ajouter(n,new THREE.CylinderGeometry(rb,ra,h,ns,1,false),role,nom,p,r);}
function octo(w:number,d:number,c:number,z=0):THREE.Vector2[]{const x=w/2,a=d/2;c=Math.min(c,x*.8,a*.8);return [[-x+c,-a],[x-c,-a],[x,-a+c],[x,a-c],[x-c,a],[-x+c,a],[-x,a-c],[-x,-a+c]].map(([xx,zz])=>new THREE.Vector2(xx!,zz!+z));}
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
// Six roues à profil arrondi, vrais crampons larges et moyeux boulonnés.
// Les trois essieux sont à 245 mm les uns des autres ; pneus de diamètre 216 mm.
for(const side of [-1,1])for(const [i,z] of [-.245,0,.245].entries()){
 const x=side*.263,tag=`${side<0?'g':'d'}${i}`;
 const profil=[[.040,-.055],[.076,-.055],[.095,-.045],[.103,-.024],[.103,.024],[.095,.045],[.076,.055],[.040,.055]].map(([r,a])=>new THREE.Vector2(r!,a!));
 ajouter('base',new THREE.LatheGeometry(profil,16),2,`pneu_${tag}`,[x,.109,z],[0,0,Math.PI/2]);
 cyl('base',.053,.112,[x,.109,z],3,`jante_${tag}`,[0,0,Math.PI/2],20);
 cyl('base',.029,.123,[x,.109,z],1,`moyeu_${tag}`,[0,0,Math.PI/2],12);
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2;boite('base',[.082,.012,.025],[x,.109+Math.cos(a)*.103,z+Math.sin(a)*.103],2,`crampons_${tag}`,[a,0,0]);}
 for(let k=0;k<4;k++){const a=k/4*Math.PI*2;cyl('base',.006,.009,[x+side*.060,.109+Math.sin(a)*.038,z+Math.cos(a)*.038],3,`boulons_${tag}`,[0,0,Math.PI/2],6);}
 plaque('corps',[.123,.018,.223],[x,.245,z],5,`garde_boue_${tag}`,[0,0,0],.008);
 // Liaison intérieure entre garde-boue et rail de plateau, aucun garde-boue flottant.
 boite('corps',[.055,.016,.066],[side*.216,.242,z],1,`attache_garde_boue_${tag}`);
}
for(const x of [-.144,.144])boite('base',[.043,.053,.70],[x,.158,0],1,'longerons_chassis');
for(const z of [-.245,0,.245]){
 cyl('base',.021,.498,[0,.109,z],3,'essieux',[0,0,Math.PI/2],12);
 plaque('base',[.10,.061,.080],[0,.109,z],1,'differentiels',[0,0,0],.012);
 boite('base',[.33,.024,.035],[0,.185,z],3,'traverses_chassis');
 for(const s of [-1,1]){
  tige('base',[s*.146,.168,z-.042],[s*.227,.109,z],.013,3,'bras_suspension');
  cyl('base',.011,.060,[s*.145,.212,z],3,'coulisseaux_suspension',[0,0,0],12);
  tube('fourreaux_suspension','corps',.022,.015,.049,[s*.145,.230,z],1,12);
 }
}
// Plateau bas à coins resserrés ; largeur maximale à mi-longueur seulement.
ajouter('corps',carene([{y:.235,w:.454,d:.855,c:.052},{y:.261,w:.468,d:.872,c:.059}]),1,'plateau_principal');
plaque('corps',[.418,.012,.488],[0,.269,-.170],8,'plancher_arriere',[0,0,0],.008);
for(const z of [-.440,.440])plaque('corps',[.338,.031,.030],[0,.209,z],2,'pare_chocs',[0,0,0],.008);
for(const s of [-1,1]){
 // Cabine courte et large, pans cassés et avant resserré.
 plaque('corps',[.067,.025,.128],[s*.22,.276,.279],8,'marchepieds',[0,0,0],.007);
 tige('corps',[s*.147,.235,.416],[s*.147,.210,.440],.013,3,'supports_pare_choc_avant');
 tige('corps',[s*.147,.235,-.410],[s*.147,.210,-.440],.013,3,'supports_pare_choc_arriere');
}
ajouter('corps',carene([{y:.267,w:.408,d:.290,c:.035,z:.275},{y:.331,w:.434,d:.278,c:.044,z:.275},{y:.439,w:.364,d:.211,c:.036,z:.248}]),0,'cabine');
plaque('corps',[.388,.018,.226],[0,.449,.249],0,'pavillon',[0,0,0],.011);
for(const s of [-1,1]){
 // Surfaces vitrées parallèles aux vrais pans inclinés de cabine.
 boite('corps',[.134,.071,.010],[s*.075,.386,.3864],4,'pare_brise',[-.5106667,0,0]);
 boite('corps',[.010,.065,.104],[s*.203,.384,.256],4,'vitres_laterales',[0,0,s*.3133908]);
 plaque('corps',[.010,.054,.112],[s*.213,.302,.259],0,'portes',[0,0,0],.003);
 boite('corps',[.018,.012,.032],[s*.220,.337,.235],3,'poignees_portes');
 plaque('corps',[.054,.030,.020],[s*.134,.300,.423],1,'capots_feux',[0,0,0],.004);
 boite('corps',[.039,.017,.010],[s*.134,.300,.437],7,'lentilles_feux');
 // Deux nervures de toit et essuie-glaces bas, sans nouvelle matière.
 boite('corps',[.021,.009,.126],[s*.130,.462,.270],5,'nervures_toit');
 tige('corps',[s*.035,.359,.399],[s*.123,.365,.397],.004,1,'essuie_glaces',6);
 boite('corps',[.017,.018,.059],[s*.147,.299,-.423],1,'boitiers_feux_arriere');
 boite('corps',[.030,.013,.010],[s*.147,.300,-.451],7,'lentilles_arriere');
}
boite('corps',[.146,.036,.010],[0,.303,.420],6,'fond_grille_avant');
for(let i=0;i<5;i++)boite('corps',[.010,.033,.007],[-.060+i*.030,.303,.429],3,'lames_grille_avant');
plaque('corps',[.093,.008,.068],[0,.460,.317],5,'trappe_pavillon',[0,0,0],.004);
// Coffrets bas sur les flancs arrière, avec charnières et verrous d'accès.
for(const s of [-1,1]){
 plaque('corps',[.066,.064,.139],[s*.207,.303,-.092],0,'coffrets_lateraux',[0,0,0],.007);
 boite('corps',[.009,.038,.092],[s*.244,.306,-.092],6,'grilles_coffrets');
 for(let i=0;i<4;i++)boite('corps',[.009,.038,.009],[s*.251,.306,-.125+i*.023],3,'lames_coffrets');
 plaque('corps',[.060,.075,.073],[s*.182,.310,-.306],1,'berceaux_fixes',[0,0,0],.008);
 // L'axe plein traverse volontairement les joues du berceau ; il n'est pas une collision parasite.

}
cyl('corps',.019,.421,[0,.315,-.245],3,'axe_inclinaison',[0,0,Math.PI/2],20);
// Deux équerres montent au pivot commun et portent les tourillons.
for(const s of [-1,1]){
 tige('corps',[s*.183,.300,-.306],[s*.183,.315,-.245],.018,1,'equerres_berceau',8);
 cyl('module_lance_roquettes',.027,.018,[s*.203,.315,-.245],3,'tourillons',[0,0,Math.PI/2],20);
 plaque('module_lance_roquettes',[.040,.024,.158],[s*.181,.322,-.197],1,'rails_recul',[0,0,0],.005);
}
// Caisson rectangulaire ouvert devant : six cellules à section octogonale, fond 410 mm derrière.
// Les parois du caisson et l'intérieur des cellules sont modélisés séparément.
for(const s of [-1,1])plaque('os_recul',[.017,.198,.430],[s*.196,.438,-.160],0,'flancs_caisson',[0,0,0],.006);
for(const y of [.340,.534])plaque('os_recul',[.388,.016,.430],[0,y,-.160],0,y<.4?'plancher_caisson':'toit_caisson',[0,0,0],.006);
plaque('os_recul',[.381,.175,.020],[0,.438,-.382],1,'fond_caisson',[0,0,0],.005);
for(const [j,y] of [.388,.486].entries())for(const [k,x] of [-.123,0,.123].entries()){
 tube(`cellule_${j}_${k}`,'os_recul',.048,.038,.403,[x,y,-.151],3,8,[Math.PI/2,0,0]);
 // Lentille de marquage au fond de la cavité, aucune munition ni projectile mobile.
 cyl('os_recul',.037,.006,[x,y,-.351],4,`fond_cellule_${j}_${k}`,[Math.PI/2,0,0],8);
 tube(`levre_${j}_${k}`,'os_recul',.0485,.038,.022,[x,y,.052],1,8,[Math.PI/2,0,0]);
}
// Fines traverses carrées entre les cellules ; pas de disque plein couvrant la face.
for(const x of [-.185,-.0615,.0615,.185])boite('os_recul',[.017,.177,.018],[x,.437,.055],5,'montants_facade');
for(const y of [.341,.437,.532])boite('os_recul',[.380,.016,.018],[0,y,.055],5,'traverses_facade');
for(const s of [-1,1]){
 for(const z of [-.306,-.083])plaque('os_recul',[.024,.034,.058],[s*.208,.438,z],1,'raidisseurs_caisson',[0,0,0],.004);
 for(const z of [-.285,-.068])boite('os_recul',[.029,.010,.035],[s*.14,.548,z],3,'oreilles_manutention');
}
// Léger angle de repos intégré au maillage : la bouche est haute, pas dirigée vers la cabine.
const pivotRack=pivot('module_lance_roquettes');for(const n of ['module_lance_roquettes','os_recul'])for(const p of pieces.get(n)??[]){p.g.translate(-pivotRack.x,-pivotRack.y,-pivotRack.z);p.g.rotateX(-.055);p.g.translate(...pivotRack.toArray());}
// Radar compact au-dessus du pavillon. Le pivot est vertical, le col ne flotte pas.
cyl('corps',.044,.014,[0,.472,.231],1,'couronne_radar',[0,0,0],20);
cyl('corps',.022,.032,[0,.492,.231],3,'col_radar',[0,0,0],16);
cyl('module_radar',.031,.015,[0,.512,.231],1,'rotule_radar',[0,0,0],16);
tige('module_radar',[0,.516,.231],[0,.548,.232],.012,3,'support_parabole',12);
function parabole(){const p:number[]=[],uv:number[]=[],ix:number[]=[];const n=24,r=.077;function pt(rho:number,a:number,back:boolean){return new THREE.Vector3(Math.cos(a)*rho,Math.sin(a)*rho,(rho/r)**2*.023-(back?.007:0));}function face(v:THREE.Vector3[],inverse=false){const k=p.length/3;if(inverse)v.reverse();v.forEach(t=>{p.push(...t.toArray());uv.push(.5+t.x/(2*r),.5+t.y/(2*r));});for(let j=1;j<v.length-1;j++)ix.push(k,k+j,k+j+1);}for(const back of [false,true])for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,rr=ring/3*r,rs=(ring+1)/3*r;if(!ring)face([pt(0,0,back),pt(rs,a,back),pt(rs,b,back)],back);else face([pt(rr,a,back),pt(rs,a,back),pt(rs,b,back),pt(rr,b,back)],back);}for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,k=p.length/3;[pt(r,a,false),pt(r,a,true),pt(r,b,true),pt(r,b,false)].forEach(t=>p.push(...t.toArray()));uv.push(0,0,1,0,1,1,0,1);ix.push(k,k+1,k+2,k,k+2,k+3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
ajouter('module_radar',parabole(),5,'parabole_concave',[0,.551,.233],[-.16,0,0]);
for(const s of [-1,1])tige('module_radar',[s*.058,.551,.251],[s*.009,.551,.299],.006,3,'bras_capteur_radar',8);
cyl('module_radar',.012,.022,[0,.551,.300],4,'capteur_radar',[Math.PI/2,0,0],12);
plaque('corps',[.044,.016,.038],[.129,.462,.250],1,'support_temoin',[0,0,0],.004);
plaque('socle',[.028,.024,.024],[.129,.478,.250],7,'temoin_disponibilite',[0,0,0],.003);
// L'appui et le centre utilisent les sommets exacts, racine toujours identité.
const box0=new THREE.Box3();for(const ps of pieces.values())for(const p of ps){p.g.computeBoundingBox();box0.union(p.g.boundingBox!);}
const offset=new THREE.Vector3(-(box0.min.x+box0.max.x)/2,-box0.min.y,-(box0.min.z+box0.max.z)/2);
for(const ps of pieces.values())for(const p of ps)p.g.translate(...offset.toArray());poses.corps!.p=poses.corps!.p.map((x,i)=>x+offset.getComponent(i)) as V3;
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
const tour=(d:number)=>rot('module_radar',[0,d/4,d/2,3*d/4,d],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,3*Math.PI/2,0],[0,2*Math.PI,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[tour(2.4)]),
 new THREE.AnimationClip('deplacement',1,[pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.003,0],[0,0,0],[0,-.003,0],[0,0,0]]),tour(1)]),
 new THREE.AnimationClip('tir',.7,[rot('module_lance_roquettes',[0,.18,.24,.36,.52,.7],[[0,0,0],[-.18,0,0],[-.18,0,0],[-.17,0,0],[-.07,0,0],[0,0,0]]),pos('os_recul',[0,.18,.24,.36,.52,.7],[[0,0,0],[0,0,0],[0,0,-.014],[0,0,-.008],[0,0,-.003],[0,0,0]]),pos('corps',[0,.18,.24,.38,.7],[[0,0,0],[0,0,0],[0,-.004,0],[0,.002,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.09,.22,.38,.5],[[0,0,0],[0,-.007,0],[0,.002,0],[0,-.002,0],[0,0,0]]),rot('module_lance_roquettes',[0,.09,.22,.5],[[0,0,0],[-.045,0,0],[.02,0,0],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.56,.9],[[0,0,0],[0,-.011,0],[0,-.011,0]]),rot('module_lance_roquettes',[0,.56,.9],[[0,0,0],[.045,0,0],[.045,0,0]]),rot('module_radar',[0,.56,.9],[[0,0,0],[0,.40,0],[0,.40,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.56,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>9000)throw new Error(`Budget ${triangles}/9000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Camion lance-marqueurs original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},recentrage:offset.toArray(),noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
