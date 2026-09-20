/** Porte-caisson chenillé original. Aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_missiles_sol_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},base:{parent:'racine',p:[0,0,0]},
 corps:{parent:'racine',p:[0,.230,0]},
 module_lance_roquettes:{parent:'corps',p:[0,.073,-.277]},
 os_recul:{parent:'module_lance_roquettes',p:[0,0,0]},
 module_antenne:{parent:'corps',p:[.243,.053,.102]},
 socle:{parent:'corps',p:[-.122,.248,.282]},
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

// Deux chenilles creuses : piste continue, flancs ouverts sur les galets et patins rapportés.
// Les extrémités arrondies rentrent dans le cercle d'une demi-case.
function contour(r:number){const out:THREE.Vector2[]=[];for(let i=0;i<=10;i++){const a=-Math.PI/2+i/10*Math.PI;out.push(new THREE.Vector2(.115+r*Math.sin(a),.258+r*Math.cos(a)));}for(let i=0;i<=10;i++){const a=Math.PI/2+i/10*Math.PI;out.push(new THREE.Vector2(.115+r*Math.sin(a),-.258+r*Math.cos(a)));}return out;}
function chenille():THREE.BufferGeometry{
 const o=contour(.104),q=contour(.084),p:number[]=[],uv:number[]=[],idx:number[]=[];
 function quad(a:number[],b:number[],c:number[],d:number[]){const k=p.length/3;p.push(...a,...b,...c,...d);uv.push(0,0,1,0,1,1,0,1);idx.push(k,k+1,k+2,k,k+2,k+3);}
 const v=(x:number,t:THREE.Vector2)=>[x,t.x,t.y];
 for(let i=0;i<o.length;i++){const j=(i+1)%o.length;
  quad(v(-.060,o[i]!),v(.060,o[i]!),v(.060,o[j]!),v(-.060,o[j]!));
  quad(v(-.060,q[j]!),v(.060,q[j]!),v(.060,q[i]!),v(-.060,q[i]!));
  quad(v(.060,o[i]!),v(.060,q[i]!),v(.060,q[j]!),v(.060,o[j]!));
  quad(v(-.060,o[j]!),v(-.060,q[j]!),v(-.060,q[i]!),v(-.060,o[i]!));
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
for(const side of [-1,1]){
 const x=side*.257,tag=side<0?'g':'d';
 ajouter('base',chenille(),3,`chenille_${tag}`,[x,0,0]);
 // Une semelle caoutchoutée de 20 mm entre maillons métalliques.
 for(const top of [-1,1])for(let i=0;i<13;i++)boite('base',[.128,.012,.027],[x,.115+top*.108,-.240+i*.040],2,`patins_${tag}`);
 for(const front of [-1,1])for(let i=0;i<10;i++){
  const a=-Math.PI/2+(i+.5)/10*Math.PI;
  boite('base',[.128,.012,.018],[x,.115+.108*Math.sin(a),front*(.258+.108*Math.cos(a))],2,`patins_${tag}`,[front*(Math.PI/2-a),0,0]);
 }
 // Trois galets de route et deux roues terminales, bagues et couvercles accessibles.
 for(const [i,z] of [-.258,-.130,0,.130,.258].entries()){
  const end=i===0||i===4,rad=end?.078:.050,y=end?.115:.082;
  cyl('base',rad,.087,[x,y,z],2,`roue_${tag}_${i}`,[0,0,Math.PI/2],12);
  cyl('base',rad*.76,.096,[x,y,z],5,`jante_${tag}_${i}`,[0,0,Math.PI/2],12);
  cyl('base',.027,.108,[x,y,z],3,`moyeu_${tag}_${i}`,[0,0,Math.PI/2],12);
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2;cyl('base',.006,.008,[x+side*.056,y+Math.sin(a)*rad*.47,z+Math.cos(a)*rad*.47],3,`boulons_${tag}_${i}`,[0,0,Math.PI/2],6);}
  tige('base',[side*.145,.159,z-.022],[side*.234,y,z],.014,1,`bras_${tag}_${i}`,8);
 }
 boite('base',[.038,.050,.665],[side*.153,.163,0],1,'longerons');
 // Petits garde-boue arrêtés avant l'arrondi terminal : aucune jupe ne cache les galets.
 plaque('corps',[.138,.015,.590],[x,.237,0],0,`garde_chenille_${tag}`,[0,0,0],.013);
 for(const z of [-.205,.205]){
  boite('corps',[.083,.018,.048],[side*.20,.232,z],1,'attaches_garde_chenille');
  cyl('base',.010,.060,[side*.145,.209,z],3,'coulisseaux_suspension',[0,0,0],12);
  tube('fourreaux_suspension','corps',.021,.0145,.047,[side*.145,.229,z],1,12);
 }
}
for(const z of [-.258,-.130,0,.130,.258])cyl('base',.017,.51,[0,Math.abs(z)>.2?.115:.082,z],3,'axes_galets',[0,0,Math.PI/2],12);
for(const z of [-.21,.21])boite('base',[.31,.022,.049],[0,.178,z],3,'traverses_chassis');
// Châssis bas à proue pincée ; les extrémités sont étroites pour la rotation en case.
ajouter('corps',carene([{y:.228,w:.424,d:.848,c:.079},{y:.254,w:.444,d:.878,c:.087}]),1,'plateau_principal');
plaque('corps',[.407,.012,.493],[0,.262,-.175],8,'plancher_arriere',[0,0,0],.009);
for(const z of [-.441,.441])plaque('corps',[.270,.030,.021],[0,.221,z],2,'pare_chocs',[0,0,0],.007);
for(const s of [-1,1])for(const z of [-.433,.433])tige('corps',[s*.115,.240,z],[s*.115,.216,z],.013,3,'supports_pare_chocs');
// Cabine avancée asymétrique au détail mais symétrique dans son emprise, toit nervuré.
ajouter('corps',carene([{y:.260,w:.374,d:.297,c:.040,z:.280},{y:.322,w:.402,d:.290,c:.044,z:.280},{y:.441,w:.338,d:.210,c:.037,z:.253}]),0,'cabine');
plaque('corps',[.356,.015,.222],[0,.449,.253],0,'pavillon',[0,0,0],.012);
for(const s of [-1,1]){
 // Face frontale z=.425 - .067/.119*(y-.322).
 boite('corps',[.129,.076,.010],[s*.074,.382,.3949],4,'pare_brise',[-Math.atan(.067/.119),0,0]);
 boite('corps',[.010,.071,.106],[s*.187,.383,.263],4,'vitres_laterales',[0,0,s*Math.atan(.032/.119)]);
 plaque('corps',[.012,.048,.133],[s*.194,.290,.284],0,'portes',[0,0,0],.003);
 boite('corps',[.018,.012,.031],[s*.204,.320,.238],3,'poignees');
 plaque('corps',[.068,.022,.146],[s*.213,.264,.265],8,'marchepieds',[0,0,0],.005);
 for(const z of [.238,.318])tige('corps',[s*.168,.260,z],[s*.215,.259,z],.012,1,'supports_marchepieds');
 boite('corps',[.021,.008,.135],[s*.121,.461,.265],5,'nervures_pavillon');
 plaque('corps',[.048,.032,.021],[s*.124,.295,.429],1,'capots_feux',[0,0,0],.004);
 boite('corps',[.033,.018,.009],[s*.124,.295,.443],7,'lentilles_feux');
 tige('corps',[s*.027,.356,.406],[s*.117,.362,.403],.004,1,'essuie_glaces',6);
 // Accès aux organes moteurs sous l'intervalle cabine/caisson.
 plaque('corps',[.042,.061,.122],[s*.202,.294,-.061],0,'coffrets_lateraux',[0,0,0],.006);
 boite('corps',[.007,.036,.072],[s*.225,.296,-.066],6,'grilles_coffrets');
 for(let i=0;i<4;i++)boite('corps',[.008,.031,.008],[s*.230,.297,-.092+i*.018],3,'lames_coffrets');
 boite('corps',[.032,.016,.014],[s*.098,.273,-.438],7,'lentilles_arriere');
}
boite('corps',[.120,.030,.012],[0,.291,.425],6,'grille_avant');
for(let i=0;i<5;i++)boite('corps',[.009,.027,.008],[-.046+i*.023,.291,.435],3,'lames_grille_avant');
plaque('corps',[.094,.009,.082],[0,.461,.279],5,'trappe_pavillon',[0,0,0],.006);
// Berceau fixe, axe transversal sous les logements et deux rails de recul.
for(const s of [-1,1]){
 plaque('corps',[.052,.073,.125],[s*.164,.301,-.279],1,'berceaux_fixes',[0,0,0],.006);
 cyl('module_lance_roquettes',.027,.024,[s*.180,.303,-.277],3,'tourillons',[0,0,Math.PI/2],16);
 plaque('module_lance_roquettes',[.040,.024,.284],[s*.151,.311,-.195],1,'rails_recul',[0,0,0],.005);
}
cyl('corps',.018,.380,[0,.303,-.277],3,'axe_inclinaison',[0,0,Math.PI/2],16);
for(const s of [-1,1])boite('os_recul',[.037,.020,.240],[s*.151,.332,-.195],3,'patins_recul');
// Caisson de huit logements compacts ; parois et fond indépendants, aucune fausse bouche.
for(const s of [-1,1])plaque('os_recul',[.016,.211,.434],[s*.209,.443,-.165],0,'flancs_caisson',[0,0,0],.005);
for(const y of [.340,.546])plaque('os_recul',[.410,.015,.434],[0,y,-.165],0,y<.4?'plancher_caisson':'toit_caisson',[0,0,0],.005);
plaque('os_recul',[.401,.197,.018],[0,.443,-.389],1,'fond_caisson',[0,0,0],.005);
for(const [j,y] of [.394,.490].entries())for(const [k,x] of [-.153,-.051,.051,.153].entries()){
 tube(`cellule_${j}_${k}`,'os_recul',.043,.033,.419,[x,y,-.158],3,8,[Math.PI/2,0,0]);
 cyl('os_recul',.0325,.006,[x,y,-.365],4,`fond_cellule_${j}_${k}`,[Math.PI/2,0,0],8);
 tube(`levre_${j}_${k}`,'os_recul',.044,.033,.018,[x,y,.052],1,8,[Math.PI/2,0,0]);
}
for(const x of [-.203,-.102,0,.102,.203])boite('os_recul',[.012,.197,.017],[x,.443,.052],5,'montants_facade');
for(const y of [.344,.442,.541])boite('os_recul',[.405,.013,.017],[0,y,.052],5,'traverses_facade');
for(const s of [-1,1]){
 for(const z of [-.300,-.084])plaque('os_recul',[.023,.041,.060],[s*.219,.442,z],1,'raidisseurs_caisson',[0,0,0],.004);
 for(const z of [-.306,-.071])boite('os_recul',[.028,.010,.039],[s*.142,.558,z],3,'oreilles_manutention');
}
const pivotRack=pivot('module_lance_roquettes');for(const n of ['module_lance_roquettes','os_recul'])for(const p of pieces.get(n)??[]){p.g.translate(-pivotRack.x,-pivotRack.y,-pivotRack.z);p.g.rotateX(-.045);p.g.translate(...pivotRack.toArray());}
// Fouet : axe suffisamment épais, ressort à trois tours avec âme séparée.
plaque('corps',[.062,.025,.075],[.237,.268,.102],1,'support_antenne',[0,0,0],.005);
cyl('module_antenne',.026,.015,[.243,.289,.102],3,'embase_antenne',[0,0,0],16);
cyl('module_antenne',.010,.086,[.243,.336,.102],1,'ame_ressort',[0,0,0],12);
class Helice extends THREE.Curve<THREE.Vector3>{constructor(){super();}override getPoint(t:number){const a=t*Math.PI*6;return new THREE.Vector3(.243+Math.cos(a)*.020,.303+t*.059,.102+Math.sin(a)*.020);}}
ajouter('module_antenne',new THREE.TubeGeometry(new Helice(),48,.0042,6,false),3,'ressort_antenne');
// Raccords tangents de début et fin dans les collerettes, sans spire noyée.
cyl('module_antenne',.026,.010,[.243,.300,.102],3,'collerette_basse',[0,0,0],16);
cyl('module_antenne',.025,.010,[.243,.366,.102],3,'collerette_haute',[0,0,0],16);
cyl('module_antenne',.0105,.220,[.243,.480,.102],1,'fouet_antenne',[0,0,0],12);
cyl('module_antenne',.015,.024,[.243,.600,.102],2,'embout_antenne',[0,0,0],12);
plaque('corps',[.048,.012,.040],[-.122,.462,.282],1,'support_temoin',[0,0,0],.004);
plaque('socle',[.029,.023,.025],[-.122,.478,.282],7,'temoin_disponibilite',[0,0,0],.003);

// Vingt millimètres de garde dynamique entre les patins et le plateau suspendu.
for(const [n,ps] of pieces)if(n!=='base')for(const p of ps)p.g.translate(0,.020,0);poses.corps!.p[1]+=.020;
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
const oscillation=(d:number,a:number)=>rot('module_antenne',[0,d*.25,d*.5,d*.75,d],[[0,0,0],[a,0,0],[0,0,0],[-a,0,0],[0,0,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[oscillation(2.4,.018)]),
 new THREE.AnimationClip('deplacement',1,[pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.003,0],[0,0,0],[0,-.003,0],[0,0,0]]),oscillation(1,.05)]),
 new THREE.AnimationClip('tir',.7,[rot('module_lance_roquettes',[0,.18,.24,.36,.52,.7],[[0,0,0],[-.19,0,0],[-.19,0,0],[-.18,0,0],[-.07,0,0],[0,0,0]]),pos('os_recul',[0,.18,.24,.36,.52,.7],[[0,0,0],[0,0,0],[0,0,-.013],[0,0,-.007],[0,0,-.003],[0,0,0]]),pos('corps',[0,.18,.24,.38,.7],[[0,0,0],[0,0,0],[0,-.004,0],[0,.002,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.09,.22,.38,.5],[[0,0,0],[0,-.006,0],[0,.002,0],[0,-.002,0],[0,0,0]]),rot('module_lance_roquettes',[0,.09,.22,.5],[[0,0,0],[-.03,0,0],[.015,0,0],[0,0,0]]),rot('module_antenne',[0,.09,.22,.5],[[0,0,0],[0,0,.075],[0,0,-.025],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.56,.9],[[0,0,0],[0,-.010,0],[0,-.010,0]]),rot('module_lance_roquettes',[0,.56,.9],[[0,0,0],[.034,0,0],[.034,0,0]]),rot('module_antenne',[0,.56,.9],[[0,0,0],[.12,0,0],[.12,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.3,.56,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>9000)throw new Error(`Budget ${triangles}/9000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Porte-caisson chenillé original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},recentrage:offset.toArray(),noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
