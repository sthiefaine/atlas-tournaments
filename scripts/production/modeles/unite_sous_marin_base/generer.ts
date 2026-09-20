/** Sous-marin de compétition original ; aucune géométrie historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_sous_marin_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,.153,0]},base:{parent:'racine',p:[0,0,0]},
 module_antenne:{parent:'corps',p:[0,.207,-.094]},os_helice:{parent:'corps',p:[0,0,-.389]},
 os_marqueur:{parent:'corps',p:[0,.172,.244]},socle:{parent:'corps',p:[.039,.202,.070]},
};
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


function peauSections(sections:{centre:V3;rayonA:number;rayonB:number}[],axe:'x'|'z',n:number):THREE.BufferGeometry {
 const p:number[]=[],uv:number[]=[],idx:number[]=[];
 const anneaux=sections.map(({centre:c,rayonA:a,rayonB:b})=>Array.from({length:n+1},(_,i)=>{
  const angle=i/n*Math.PI*2;
  return axe==='z'?new THREE.Vector3(c[0]+a*Math.cos(angle),c[1]+b*Math.sin(angle),c[2]):new THREE.Vector3(c[0],c[1]+a*Math.sin(angle),c[2]+b*Math.cos(angle));
 }));
 for(let j=0;j<anneaux.length;j++)for(let i=0;i<=n;i++){const v=anneaux[j]![i]!;p.push(v.x,v.y,v.z);uv.push(i/n,j/(anneaux.length-1));}
 for(let j=0;j<anneaux.length-1;j++)for(let i=0;i<n;i++){
  const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;
  const va=anneaux[j]![i]!,vb=anneaux[j]![i+1]!,vd=anneaux[j+1]![i+1]!;
  const normale=new THREE.Vector3().crossVectors(vb.clone().sub(va),vd.clone().sub(va));
  const centre=new THREE.Vector3(...sections[j]!.centre).add(new THREE.Vector3(...sections[j+1]!.centre)).multiplyScalar(.5);
  const radial=va.clone().add(vb).add(vd).multiplyScalar(1/3).sub(centre);
  if(normale.dot(radial)>0)idx.push(a,b,d,a,d,c);else idx.push(a,d,b,a,c,d);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 // Raccord des deux côtés de la couture, sans fusionner les UV 0 et 1.
 const norm=g.getAttribute('normal');for(let j=0;j<anneaux.length;j++){const a=j*(n+1),b=a+n,v=new THREE.Vector3().fromBufferAttribute(norm,a).add(new THREE.Vector3().fromBufferAttribute(norm,b)).normalize();norm.setXYZ(a,v.x,v.y,v.z);norm.setXYZ(b,v.x,v.y,v.z);}
 const bouchons:THREE.BufferGeometry[]=[];
 for(const j of [0,anneaux.length-1]){
  const positions:number[]=[],tex:number[]=[],indices:number[]=[];const centre=sections[j]!.centre;
  positions.push(...centre);tex.push(.5,.5);
  for(let i=0;i<n;i++){const v=anneaux[j]![i]!;positions.push(v.x,v.y,v.z);tex.push(.5+.5*Math.cos(i/n*Math.PI*2),.5+.5*Math.sin(i/n*Math.PI*2));}
  const direction=sections.at(-1)!.centre[axe==='x'?0:2]-sections[0]!.centre[axe==='x'?0:2];
  const signe=(j===0?-1:1)*Math.sign(direction)*(axe==='x'?-1:1);
  for(let i=0;i<n;i++){const a=i+1,b=(i+1)%n+1;if(signe>0)indices.push(0,a,b);else indices.push(0,b,a);}
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));cap.setIndex(indices);cap.computeVertexNormals();bouchons.push(cap);
 }
 return mergeGeometries([g,...bouchons],false)!;
}

function ellipsoide(n:string,r:V3,p:V3,role:number,nom:string,ns=20,ms=10){const g=new THREE.SphereGeometry(1,ns,ms);g.scale(...r);ajouter(n,g,role,nom,p);}
function courbe(n:string,pts:V3[],rayon:number,role:number,nom:string,segs=24,ns=8){ajouter(n,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),segs,rayon,ns,false),role,nom);}
/** Profil plan fermé extrudé ; normales de chaque face et UV projetés, sans face dégénérée. */
function prisme(poly:[number,number][],h:number):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];
 const rings=[-h/2,h/2].map(y=>poly.map(([x,z])=>new THREE.Vector3(x,y,z)));
 function face(v:THREE.Vector3[]){
  const d=pos.length/3,n=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();
  const ax=Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))?['x','z'] as const:Math.abs(n.x)>Math.abs(n.z)?['z','y'] as const:['x','y'] as const;
  const u=v.map(p=>p[ax[0]]),vv=v.map(p=>p[ax[1]]),u0=Math.min(...u),v0=Math.min(...vv),du=Math.max(...u)-u0,dv=Math.max(...vv)-v0;
  v.forEach((p,i)=>{pos.push(...p.toArray());uv.push((u[i]!-u0)/du,(vv[i]!-v0)/dv);});
  for(let i=1;i<v.length-1;i++)idx.push(d,d+i,d+i+1);
 }
 let area=0;for(let i=0;i<poly.length;i++){const p=poly[i]!,q=poly[(i+1)%poly.length]!;area+=p[0]*q[1]-p[1]*q[0];}
 if(area<0)rings.forEach(r=>r.reverse());face(rings[0]!);face([...rings[1]!].reverse());
 for(let i=0;i<poly.length;i++){const k=(i+1)%poly.length;face([rings[0]![i]!,rings[1]![i]!,rings[1]![k]!,rings[0]![k]!]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
// Coque capsule : long flanc régulier, épaules et extrémités arrondies.
const profils:[number,number,number][]=[[-.364,.026,.032],[-.350,.053,.060],[-.322,.100,.091],[-.276,.148,.119],[-.223,.179,.139],[-.163,.192,.145],[-.075,.195,.145],[.035,.195,.145],[.146,.193,.143],[.222,.183,.137],[.281,.163,.122],[.327,.132,.102],[.366,.097,.076],[.397,.059,.047],[.416,.026,.022],[.420,.004,.006]];
ajouter('corps',peauSections(profils.map(([z,a,b])=>({centre:[0,.153,z],rayonA:a,rayonB:b})),'z',32),0,'coque_capsule');
// Ceinture moulée à la flottaison : vrai relief continu sur les flancs.
ajouter('corps',peauSections(profils.map(([z,a])=>({centre:[0,.153,z],rayonA:a+.005,rayonB:.017})),'z',24),2,'ceinture_flottaison');
// Quille d'appui conservée à Y=0 ; la coque peut osciller légèrement autour de son centre.
plaque('base',[.072,.022,.31],[0,.011,.027],1,'quille',[0,0,0],.015);
// Kiosque profilé compact, entre épaules et fouet.
ajouter('corps',carene([{y:.274,w:.142,d:.257,c:.038,z:.003},{y:.296,w:.155,d:.241,c:.047,z:.007},{y:.342,w:.132,d:.194,c:.043,z:.015},{y:.354,w:.100,d:.157,c:.033,z:.015}]),5,'kiosque');
plaque('corps',[.090,.009,.096],[0,.356,.025],0,'trappe_kiosque',[0,0,0],.016);
for(const s of [-1,1]){
 boite('corps',[.011,.024,.055],[s*.072,.321,.040],4,'capteur_kiosque',[0,0,s*.12]);
 cyl('corps',.009,.008,[s*.022,.365,.050],3,'charniere_trappe',[0,0,Math.PI/2],8);
 // Plans latéraux bien raccordés dans la capsule, forte silhouette en vue du dessus.
 const fin=prisme(([[.118,-.213],[.180,-.270],[.300,-.295],[.305,-.224],[.218,-.156],[.125,-.141]] as [number,number][]).map(([x,z])=>[x*s,z]),.022);
 ajouter('corps',fin,5,`plan_lateral_${s<0?'g':'d'}`,[0,.158,0]);
 plaque('corps',[.027,.027,.119],[s*.17,.164,-.204],3,`attache_plan_${s<0?'g':'d'}`,[0,0,0],.004);
 // Plans avant courts : leur embase traverse le flanc arrondi.
 const avant=prisme(([[.112,.214],[.162,.184],[.252,.180],[.259,.215],[.168,.260],[.114,.259]] as [number,number][]).map(([x,z])=>[x*s,z]),.020);
 ajouter('corps',avant,5,`plan_avant_${s<0?'g':'d'}`,[0,.176,0]);
 // Protection d'accès supérieure à deux attaches, forme fermée.
 const pts:V3[]=[[s*.073,.278,-.058],[s*.083,.301,-.058],[s*.083,.301,-.104],[s*.073,.278,-.104]];
 courbe('corps',pts,.010,3,`poignee_${s<0?'g':'d'}`,12,6);
}
// Groupe propulsif raccordé à la poupe, shroud creux réellement ouvert.
cyl('corps',.032,.060,[0,.153,-.360],1,'carter_poupe',[Math.PI/2,0,0],20,.039);
cyl('corps',.013,.060,[0,.153,-.389],3,'arbre_helice',[Math.PI/2,0,0],12);
tube('couronne_propulsion','corps',.082,.069,.046,[0,.153,-.397],1,28,[Math.PI/2,0,0]);
for(const s of [-1,1]){
 boite('corps',[.105,.014,.021],[s*.036,.153,-.372],3,`support_couronne_${s<0?'g':'d'}`);
}
// Aileron vertical supérieur et patin inférieur, encastrés dans coque et carénage.
// Forme directe locale XY (prisme initial XZ -> vertical YZ).
const derive=prisme([[-.358,.020],[-.338,.140],[-.296,.170],[-.271,.100],[-.282,.018]],.024).applyMatrix4(new THREE.Matrix4().set(0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1));
ajouter('corps',derive,5,'derive_superieure',[0,.176,0]);
// Hélice à cinq pales larges, profil pentagonal balayé ; pivot sur son axe +Z.
cyl('os_helice',.021,.031,[0,.153,-.398],3,'moyeu_helice',[Math.PI/2,0,0],20,.016);
for(let i=0;i<5;i++){
 const pale=prisme([[.014,-.007],[.043,-.012],[.062,.007],[.056,.022],[.024,.016]],.012).rotateX(Math.PI/2).rotateZ(i*Math.PI*2/5);
 ajouter('os_helice',pale,3,`pale_${i}`,[0,.153,-.395]);
}
// Petit lanceur de marqueur homologué : tube creux et boîtier de recul au-dessus du nez.
plaque('corps',[.067,.047,.090],[0,.2945,.235],1,'berceau_marqueur',[0,0,0],.008);
boite('corps',[.052,.020,.079],[0,.321,.239],3,'rail_marqueur');
plaque('os_marqueur',[.061,.027,.087],[0,.337,.244],5,'culasse_marqueur',[0,0,0],.006);
tube('tube_marqueur','os_marqueur',.020,.012,.058,[0,.337,.297],3,16,[Math.PI/2,0,0]);
cyl('os_marqueur',.012,.007,[0,.337,.266],1,'fond_marqueur',[Math.PI/2,0,0],16);
// Colonne d'antenne verticale compacte ; ressort réel, fil séparé de l'âme.
cyl('corps',.030,.037,[0,.354,-.094],5,'support_antenne',[0,0,0],16);
cyl('module_antenne',.007,.068,[0,.399,-.094],2,'ame_ressort',[0,0,0],12);
cyl('module_antenne',.024,.010,[0,.374,-.094],3,'collerette_basse',[0,0,0],16);
cyl('module_antenne',.023,.010,[0,.435,-.094],3,'collerette_haute',[0,0,0],16);
const helix:V3[]=Array.from({length:73},(_,i)=>{const a=i/72*Math.PI*6;return [Math.cos(a)*.019,.379+i/72*.051,-.094+Math.sin(a)*.019];});
courbe('module_antenne',helix,.0042,3,'ressort_antenne',72,6);
courbe('module_antenne',[[0,.431,-.094],[0,.452,-.094],[-.002,.482,-.097],[-.005,.512,-.102]],.011,2,'fouet_antenne',10,8);
ellipsoide('module_antenne',[.011,.011,.011],[-.005,.512,-.102],2,'embout_fouet',10,6);
plaque('corps',[.030,.012,.033],[.039,.345,.070],1,'support_temoin',[0,0,0],.003);
plaque('socle',[.024,.019,.025],[.039,.355,.070],7,'temoin',[0,0,0],.004);
// Deux accès étanches sur le dessus de coque, avec prise encastrée.
for(const z of [-.186,.158]){
 cyl('corps',.041,.013,[0,.292,z],1,`joint_acces_${z}`,[0,0,0],24);
 cyl('corps',.035,.010,[0,.302,z],5,`trappe_acces_${z}`,[0,0,0],24);
 boite('corps',[.033,.009,.014],[0,.309,z],3,`prise_acces_${z}`);
}
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


const oscillation=(n:string,d:number,a:number,axe:0|1|2)=>rot(n,[0,d/4,d/2,d*3/4,d],[[0,0,0],[0,0,0].map((_,i)=>i===axe?a:0) as V3,[0,0,0],[0,0,0].map((_,i)=>i===axe?-a:0) as V3,[0,0,0]]);
function helice(d:number,tours:number){const n=tours*16,t:number[]=[],v:V3[]=[];for(let i=0;i<=n;i++){t.push(i/n*d);v.push([0,0,i/n*tours*Math.PI*2]);}return rot('os_helice',t,v);}
const clips=[
 new THREE.AnimationClip('repos',2.4,[oscillation('module_antenne',2.4,.012,0)]),
 new THREE.AnimationClip('deplacement',1,[helice(1,1),oscillation('corps',1,.012,2),pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.002,0],[0,0,0],[0,-.002,0],[0,0,0]]),oscillation('module_antenne',1,.025,0)]),
 new THREE.AnimationClip('tir',.7,[pos('os_marqueur',[0,.13,.21,.34,.7],[[0,0,0],[0,0,0],[0,0,-.011],[0,0,-.003],[0,0,0]]),pos('corps',[0,.13,.21,.34,.7],[[0,0,0],[0,0,0],[0,-.002,0],[0,.001,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[rot('corps',[0,.09,.22,.5],[[0,0,0],[0,0,-.036],[0,0,.014],[0,0,0]]),oscillation('module_antenne',.5,.060,0)]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.56,.9],[[0,0,0],[0,-.005,0],[0,-.005,0]]),rot('module_antenne',[0,.56,.9],[[0,0,0],[-.12,0,0],[-.12,0,0]]),pos('os_marqueur',[0,.56,.9],[[0,0,0],[0,0,-.009],[0,0,-.009]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.30,.56,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>6000)throw new Error(`Budget ${triangles}/6000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Sous-marin capsule original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:6000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
