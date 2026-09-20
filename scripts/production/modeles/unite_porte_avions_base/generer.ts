/** Porte-avions de transport original. Aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_porte_avions_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,.18,0]},
 base:{parent:'corps',p:[0,-.18,0]},
 module_radar:{parent:'corps',p:[.195,.293,.14]},
 module_antenne:{parent:'corps',p:[.226,.183,-.105]},
 os_marqueur:{parent:'corps',p:[.224,.068,.295]},
 socle:{parent:'corps',p:[.258,.290,.10]},
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

/** Section marine symétrique, large au milieu et étroite aux extrémités. */
const plan: [number,number][]=[[-.180,-.445],[.180,-.445],[.260,-.355],[.325,-.240],[.325,.200],[.285,.305],[.170,.425],[.100,.445],[-.100,.445],[-.170,.425],[-.285,.305],[-.325,.200],[-.325,-.240],[-.260,-.355]];
function volume(plan2:[number,number][],y0:number,y1:number,sx0:number,sz0:number,sx1:number,sz1:number):THREE.BufferGeometry{
 const ps:number[]=[],uv:number[]=[],idx:number[]=[];
 const ring=(y:number,sx:number,sz:number)=>plan2.map(([x,z])=>new THREE.Vector3(x*sx,y,z*sz));
 const a=ring(y0,sx0,sz0),b=ring(y1,sx1,sz1),n=a.length;
 function face(v:THREE.Vector3[]){
  const no=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();
  const axes=Math.abs(no.y)>=Math.max(Math.abs(no.x),Math.abs(no.z))?['x','z'] as const:Math.abs(no.x)>Math.abs(no.z)?['z','y'] as const:['x','y'] as const;
  const uu=v.map(p=>p[axes[0]]),vv=v.map(p=>p[axes[1]]),u=Math.min(...uu),w=Math.min(...vv),du=Math.max(...uu)-u,dv=Math.max(...vv)-w,k=ps.length/3;
  v.forEach((p,i)=>{ps.push(...p.toArray());uv.push((uu[i]!-u)/du,(vv[i]!-w)/dv);});for(let i=1;i<v.length-1;i++)idx.push(k,k+i,k+i+1);
 }
 face(a);for(let i=0;i<n;i++){const j=(i+1)%n;face([a[i]!,b[i]!,b[j]!,a[j]!]);}face([...b].reverse());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function pont(n:string,y0:number,y1:number,sx0:number,sz0:number,sx1:number,sz1:number,role:number,nom:string){ajouter(n,volume(plan,y0,y1,sx0,sz0,sx1,sz1),role,nom);}
// La quille seule touche Y=0 ; chaque plan supérieur recouvre le précédent de 1 mm.
pont('base',0,.039,.47,.69,.64,.85,1,'quille');
pont('base',.038,.083,.64,.85,.83,.925,1,'carene_basse');
pont('base',.082,.105,.835,.93,.865,.94,2,'ceinture_flottaison');
pont('base',.104,.176,.858,.936,.91,.975,0,'borde_evase');
pont('corps',.171,.190,.91,.975,.985,.995,0,'encorbellement_pont');
const contourPont=new THREE.Shape(plan.map(([x,z])=>new THREE.Vector2(x,z)));
const trouAscenseur=octo(.254,.237,.010,-.166).map(p=>new THREE.Vector2(p.x-.119,p.y));
contourPont.holes.push(new THREE.Path(trouAscenseur));
for(const x of [-.158,-.090])contourPont.holes.push(new THREE.Path([new THREE.Vector2(x-.013,.0045),new THREE.Vector2(x+.013,.0045),new THREE.Vector2(x+.013,.3275),new THREE.Vector2(x-.013,.3275)]));
const gPont=new THREE.ExtrudeGeometry(contourPont,{depth:.022,bevelEnabled:false,steps:1,curveSegments:1});
gPont.rotateX(Math.PI/2);gPont.translate(0,.210,0);
// L'extrusion propose des UV monde : projection locale normalisée, marge d'atlas conservée.
const uvPont=gPont.getAttribute('uv');for(let i=0;i<uvPont.count;i++)uvPont.setXY(i,(uvPont.getX(i)+1)/2,(uvPont.getY(i)+1)/2);
ajouter('corps',gPont,8,'pont_envol');
// La plate-forme de manutention est affleurante, sans petit avion qui occupe le pont.
ajouter('corps',carene([{y:.202,w:.252,d:.235,c:.010,z:-.166},{y:.210,w:.252,d:.235,c:.010,z:-.166}]),5,'ascenseur_affleurant',[-.119,0,0]);
for(const x of [-.241,.003])boite('corps',[.014,.026,.202],[x,.190,-.166],3,'guides_ascenseur');
// Deux voies de lancement en métal, encastrées ; aucune peinture ni ligne de marquage.
for(const x of [-.158,-.090]){
 boite('corps',[.026,.005,.323],[x,.197,.166],1,'puits_catapulte');
 for(const s of [-1,1])boite('corps',[.007,.016,.323],[x+s*.009,.204,.166],3,'rails_catapulte');
 plaque('corps',[.030,.009,.042],[x,.216,.018],3,'navettes_catapulte',[0,0,0],.003);
}
// Bordures basses : ouvertes à la proue et à la poupe, ni garde-corps sur la piste.
for(const s of [-1,1]){
 tige('corps',[s*.309,.218,-.238],[s*.309,.218,.189],.0105,1,'lisses_laterales',12);
 for(const z of [-.284,-.031,.215]){
  const x=s*(z<-.2?.271:z>.2?.284:.298);
  plaque('corps',[.045,.030,.055],[x,.175,z],1,'supports_defenses',[0,0,0],.005);
  cyl('corps',.021,.082,[x,.127,z],2,'defenses',[0,0,s*.08],16);
 }
 // Consoles triangulées de l'encorbellement, attachées sous le pont.
 for(const z of [-.262,-.125,.025,.18]){
  tige('corps',[s*.269,.131,z],[s*.308,.181,z],.012,1,'consoles_pont',10);
  boite('corps',[.039,.014,.030],[s*.301,.181,z],3,'semelles_consoles');
 }
 for(const z of [-.335,.331]){
  const x=s*.174;
  plaque('corps',[.066,.010,.052],[x,.207,z],1,'semelles_amarrage',[0,0,0],.005);
  for(const dz of [-.014,.014]){
   cyl('corps',.011,.023,[x,.222,z+dz],3,'bittes_amarrage',[0,0,0],12);
   cyl('corps',.016,.006,[x,.235,z+dz],3,'chapeaux_bittes',[0,0,0],12);
  }
 }
 // Coffres techniques sous le pont, grilles et ventilations latérales.
 for(const z of [-.170,.100]){
  plaque('base',[.018,.040,.114],[s*.287,.142,z],0,'coffrets_borde',[0,0,0],.004);
  boite('base',[.007,.028,.080],[s*.300,.143,z],6,'grilles_borde');
  for(let i=0;i<4;i++)boite('base',[.010,.026,.010],[s*.303,.143,z-.028+i*.019],3,'lames_grilles');
 }
}
// Îlot tribord avancé, bas étroit et passerelle débordante. Le centre du pont reste libre.
ajouter('corps',carene([{y:.209,w:.154,d:.254,c:.018,z:.112},{y:.352,w:.132,d:.229,c:.018,z:.112}]),0,'ilot_bas',[.206,0,0]);
plaque('corps',[.186,.015,.266],[.206,.350,.124],1,'galerie_passerelle',[0,0,0],.019);
ajouter('corps',carene([{y:.356,w:.155,d:.233,c:.027,z:.131},{y:.410,w:.177,d:.238,c:.027,z:.131}]),5,'cabine_passerelle',[.206,0,0]);
ajouter('corps',carene([{y:.404,w:.178,d:.240,c:.027,z:.131},{y:.447,w:.158,d:.220,c:.022,z:.131}]),4,'vitrage_passerelle',[.206,0,0]);
plaque('corps',[.193,.018,.257],[.206,.454,.131],0,'toit_passerelle',[0,0,0],.023);
for(const x of [-.050,0,.050])tige('corps',[.206+x,.404,.252],[.206+x,.447,.242],.006,1,'montants_avant',8);
for(const s of [-1,1])for(const z of [.066,.129,.191])tige('corps',[.206+s*.089,.404,z],[.206+s*.079,.447,z],.006,1,'montants_cote',8);
// Accès à l'îlot, caisson de ventilation arrière et escalier côté quai.
plaque('corps',[.010,.083,.045],[.132,.263,.175],1,'porte_etanche',[0,0,-.075],.003);
boite('corps',[.014,.012,.024],[.124,.279,.164],3,'poignee_porte');
for(let i=0;i<4;i++)boite('corps',[.045,.016,.038],[.105,.220+i*.022,.174-i*.025],3,'marches_passerelle');
tige('corps',[.108,.215,.185],[.108,.297,.098],.011,1,'limon_escalier',10);
plaque('corps',[.115,.062,.063],[.215,.298,-.042],5,'ventilation_ilot',[0,0,0],.009);
boite('corps',[.080,.041,.009],[.215,.300,-.076],6,'grille_ilot');
for(let i=0;i<4;i++)boite('corps',[.080,.006,.011],[.215,.287+i*.009,-.081],3,'lames_ilot');
// Petit marqueur de proximité monté devant l'îlot : carter court et recul de 12 mm.
plaque('corps',[.082,.025,.065],[.224,.223,.290],1,'support_marqueur',[0,0,0],.009);
for(const s of [-1,1])boite('corps',[.015,.026,.050],[.224+s*.032,.247,.294],3,'berceau_marqueur');
boite('os_marqueur',[.063,.034,.055],[.224,.249,.294],0,'carter_marqueur');
tube('bouche_marqueur','os_marqueur',.021,.012,.065,[.224,.249,.343],3,16,[Math.PI/2,0,0]);
cyl('os_marqueur',.012,.004,[.224,.249,.313],1,'fond_marqueur',[Math.PI/2,0,0],12);
// Radar : pivot vertical sur le toit, parabole en coque fermée à UV explicites.
cyl('corps',.027,.026,[.195,.473,.140],1,'support_radar',[0,0,0],24);
cyl('module_radar',.021,.055,[.195,.500,.140],3,'axe_radar',[0,0,0],24);
plaque('module_radar',[.071,.048,.034],[.195,.519,.139],1,'dos_radar',[0,0,0],.008);
function parabole():THREE.BufferGeometry{
 const pp:number[]=[],uv:number[]=[],idx:number[]=[];const rings=6,ns=32;
 function vertex(r:number,a:number,z:number){pp.push(Math.cos(a)*r,Math.sin(a)*r,z);uv.push(.5+Math.cos(a)*r/.13,.5+Math.sin(a)*r/.13);}
 // Chaque peau est séparée : normales de face avant/back, arête nette au bord.
 for(let side=0;side<2;side++){
  const k=pp.length/3;vertex(0,0,side===0?0:-.006);
  for(let j=1;j<=rings;j++)for(let i=0;i<ns;i++){const r=.063*j/rings;vertex(r,i/ns*Math.PI*2,.018*(r/.063)**2-(side===0?0:.006));}
  const tri=(a:number,b:number,c:number)=>side===0?idx.push(k+a,k+b,k+c):idx.push(k+a,k+c,k+b);
  for(let i=0;i<ns;i++)tri(0,1+i,1+(i+1)%ns);
  for(let j=1;j<rings;j++)for(let i=0;i<ns;i++){const a=1+(j-1)*ns+i,b=1+(j-1)*ns+(i+1)%ns,c=a+ns,d=b+ns;tri(a,c,d);tri(a,d,b);}
 }
 // Fermeture du bord via anneau à UV latérales non dégénérées.
 const k=pp.length/3;
 for(let i=0;i<=ns;i++)for(const z of [.012,.018]){const a=i/ns*Math.PI*2;pp.push(Math.cos(a)*.063,Math.sin(a)*.063,z);uv.push(i/ns,z===.012?0:1);}
 for(let i=0;i<ns;i++){const a=k+i*2;idx.push(a,a+2,a+3,a,a+3,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
ajouter('module_radar',parabole(),5,'parabole',[.195,.531,.156]);
ajouter('module_radar',new THREE.TorusGeometry(.063,.0045,6,32),3,'couronne_radar',[.195,.531,.174]);
// Récepteur au foyer devant la parabole, porté depuis le bord inférieur.
tige('module_radar',[.195,.471,.171],[.195,.526,.223],.0105,1,'bras_recepteur',12);
cyl('module_radar',.016,.024,[.195,.530,.224],4,'recepteur',[0,0,0],16);
// Antenne sur une console reliée à l'arrière de l'îlot, distincte du balayage radar.
plaque('corps',[.073,.020,.065],[.226,.357,-.105],1,'console_antenne',[0,0,0],.007);
tige('corps',[.226,.298,-.003],[.226,.350,-.100],.014,1,'jambe_console',12);
cyl('module_antenne',.026,.015,[.226,.370,-.105],3,'embase_antenne',[0,0,0],16);
cyl('module_antenne',.010,.086,[.226,.417,-.105],1,'ame_ressort',[0,0,0],12);
class Helice extends THREE.Curve<THREE.Vector3>{constructor(){super();}override getPoint(t:number){const a=t*Math.PI*6;return new THREE.Vector3(.226+Math.cos(a)*.020,.384+t*.059,-.105+Math.sin(a)*.020);}}
ajouter('module_antenne',new THREE.TubeGeometry(new Helice(),48,.0042,6,false),3,'ressort_antenne');
cyl('module_antenne',.026,.010,[.226,.381,-.105],3,'collerette_basse',[0,0,0],16);
cyl('module_antenne',.025,.010,[.226,.447,-.105],3,'collerette_haute',[0,0,0],16);
cyl('module_antenne',.0105,.148,[.226,.525,-.105],1,'fouet_antenne',[0,0,0],12);
cyl('module_antenne',.015,.024,[.226,.608,-.105],2,'embout_antenne',[0,0,0],12);
// Témoin repliable sur l'îlot ; aucune plaque artificielle sous la coque.
cyl('corps',.018,.012,[.258,.469,.10],1,'support_temoin',[0,0,0],16);
plaque('socle',[.027,.024,.027],[.258,.482,.10],7,'temoin_disponibilite',[0,0,0],.004);
// Dégagement du bras inférieur au-dessus du toit, axe encore engagé dans le support.
for(const p of pieces.get('module_radar')??[])p.g.translate(0,.004,0);poses.module_radar!.p[1]+=.004;
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
const oscillation=(d:number,a:number)=>rot('module_antenne',[0,d*.25,d*.5,d*.75,d],[[0,0,0],[a,0,0],[0,0,0],[-a,0,0],[0,0,0]]);
const radar=(d:number)=>rot('module_radar',[0,d/4,d/2,d*3/4,d],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,Math.PI*1.5,0],[0,Math.PI*2,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[radar(2.4),oscillation(2.4,.016)]),
 new THREE.AnimationClip('deplacement',1,[radar(1),pos('corps',[0,.25,.5,.75,1],[[0,.009,0],[0,.012,0],[0,.009,0],[0,.006,0],[0,.009,0]]),rot('corps',[0,.25,.5,.75,1],[[0,0,0],[0,0,.010],[0,0,0],[0,0,-.010],[0,0,0]]),oscillation(1,.042)]),
 new THREE.AnimationClip('tir',.7,[pos('os_marqueur',[0,.09,.17,.34,.7],[[0,0,0],[0,0,-.012],[0,0,-.012],[0,0,-.004],[0,0,0]]),pos('corps',[0,.09,.2,.7],[[0,0,0],[0,.005,0],[0,.003,0],[0,0,0]]),rot('corps',[0,.09,.2,.7],[[0,0,0],[-.006,0,0],[.003,0,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.09,.23,.5],[[0,0,0],[0,.018,0],[0,.006,0],[0,0,0]]),rot('corps',[0,.09,.23,.5],[[0,0,0],[.025,0,.045],[-.009,0,-.018],[0,0,0]]),rot('module_antenne',[0,.09,.23,.5],[[0,0,0],[.07,0,0],[-.025,0,0],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.3,.6,.9],[[0,0,0],[0,.012,0],[0,.001,0],[0,.001,0]]),rot('corps',[0,.3,.6,.9],[[0,0,0],[.008,0,.014],[0,0,0],[0,0,0]]),rot('module_radar',[0,.6,.9],[[0,0,0],[0,.62,0],[0,.62,0]]),rot('module_antenne',[0,.6,.9],[[0,0,0],[-.14,0,0],[-.14,0,0]]),rot('os_marqueur',[0,.6,.9],[[0,0,0],[.08,0,0],[.08,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.6,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>9000)throw new Error(`Budget ${triangles}/9000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Porte-avions original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
