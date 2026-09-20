/** Bastion original : coque en diamant tronqué, chenilles courtes, marqueurs jumelés. Aucun rendu. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';

type V3 = [number, number, number];
type Piece = { g: THREE.BufferGeometry; role: number; nom: string };
const id='unite_meridien_bastion_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},base:{parent:'racine',p:[0,0,0]},
 corps:{parent:'racine',p:[0,.185,0]},module_tourelle:{parent:'corps',p:[0,.11,0]},
 os_recul:{parent:'module_tourelle',p:[0,.074,.165]},
 module_radar:{parent:'module_tourelle',p:[0,.125,-.10]},
 module_antenne:{parent:'module_tourelle',p:[-.17,.129,-.102]},
 socle:{parent:'module_tourelle',p:[.157,.133,-.088]},
};
function pivot(n:string):THREE.Vector3 { const p=poses[n]!;return new THREE.Vector3(...p.p).add(p.parent?pivot(p.parent):new THREE.Vector3()); }
function ajouter(n:string,g:THREE.BufferGeometry,role:number,nom:string,p:V3=[0,0,0],r:V3=[0,0,0]){
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,((role%4)+.065+uv.getX(i)*.87)/4,(Math.floor(role/4)+.065+uv.getY(i)*.87)/4);
 g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1)));
 const a=pieces.get(n)??[];a.push({g,role,nom});pieces.set(n,a);
}
function boite(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0]){ajouter(n,new THREE.BoxGeometry(...s),role,nom,p,r);}
function cyl(n:string,ra:number,h:number,p:V3,role:number,nom:string,r:V3=[0,0,0],ns=16,rb=ra){ajouter(n,new THREE.CylinderGeometry(rb,ra,h,ns,1,false),role,nom,p,r);}
/** Fourreau vraiment creux : le coulisseau traverse une ouverture, sans disque caché. */
function fourreau(p:V3,nom:string){
 const h=.065,ra=.021,ri=.016,n=8;
 const ext=new THREE.CylinderGeometry(ra,ra,h,n,1,true),int=new THREE.CylinderGeometry(ri,ri,h,n,1,true);
 const no=int.getAttribute('normal');for(let i=0;i<no.count;i++)no.setXYZ(i,-no.getX(i),-no.getY(i),-no.getZ(i));
 const ix=int.index!;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a);}
 const haut=new THREE.RingGeometry(ri,ra,n).rotateX(-Math.PI/2).translate(0,h/2,0);
 const bas=new THREE.RingGeometry(ri,ra,n).rotateX(Math.PI/2).translate(0,-h/2,0);
 ajouter('corps',mergeGeometries([ext,int,haut,bas],false)!,1,nom,p);
}
function octo(w:number,d:number,c:number,z=0):THREE.Vector2[]{const x=w/2,a=d/2;return [[-x+c,-a],[x-c,-a],[x,-a+c],[x,a-c],[x-c,a],[-x+c,a],[-x,a-c],[-x,-a+c]].map(([xx,zz])=>new THREE.Vector2(xx!,zz!+z));}
function carene(ss:{y:number;w:number;d:number;c:number;z?:number}[]):THREE.BufferGeometry{
 const pos:number[]=[],uv:number[]=[],ix:number[]=[];const rings=ss.map(s=>octo(s.w,s.d,s.c,s.z).map(v=>new THREE.Vector3(v.x,s.y,v.y)));
 function face(v:THREE.Vector3[]){const start=pos.length/3;const no=new THREE.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();const axes=Math.abs(no.y)>=Math.max(Math.abs(no.x),Math.abs(no.z))?['x','z'] as const:Math.abs(no.x)>Math.abs(no.z)?['z','y'] as const:['x','y'] as const;const uu=v.map(x=>x[axes[0]]),vv=v.map(x=>x[axes[1]]);const u=Math.min(...uu),v0=Math.min(...vv),du=Math.max(...uu)-u,dv=Math.max(...vv)-v0;v.forEach((x,i)=>{pos.push(...x.toArray());uv.push((uu[i]!-u)/du,(vv[i]!-v0)/dv);});for(let i=1;i<v.length-1;i++)ix.push(start,start+i,start+i+1);}
 face(rings[0]!);for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;face([rings[j]![i]!,rings[j+1]![i]!,rings[j+1]![k]!,rings[j]![k]!]);}face([...rings.at(-1)!].reverse());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function plaque(n:string,s:V3,p:V3,role:number,nom:string,r:V3=[0,0,0],b=.005){const [w,h,d]=s;const k=Math.min(b,h*.3);ajouter(n,carene([{y:-h/2,w,d,c:b},{y:h/2-k,w,d,c:b},{y:h/2,w:w-k*2,d:d-k*2,c:b}]),role,nom,p,r);}
function tige(n:string,a:V3,b:V3,rayon:number,role:number,nom:string,segments=8){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa);const g=new THREE.CylinderGeometry(rayon,rayon,v.length(),segments,1,false);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));ajouter(n,g,role,nom,aa.add(bb).multiplyScalar(.5).toArray() as V3);}

/** Capsule de chenille. y minimum des patins exactement zéro, extrémités arrondies. */
function chemin(t:number){const r=.079,a=.267,l=2*a,arc=Math.PI*r,total=2*l+2*arc;let s=((t%1)+1)%1*total;if(s<l)return{y:.170,z:-a+s,angle:0};s-=l;if(s<arc){const q=s/r;return{y:.091+r*Math.cos(q),z:a+r*Math.sin(q),angle:q};}s-=arc;if(s<l)return{y:.012,z:a-s,angle:Math.PI};s-=l;const q=Math.PI+s/r;return{y:.091+r*Math.cos(q),z:-a+r*Math.sin(q),angle:q};}
function bande(x:number){const p:number[]=[],uv:number[]=[],ix:number[]=[];const n=32;for(let i=0;i<n;i++){const a=chemin(i/n),b=chemin((i+1)/n);const ring=(q:ReturnType<typeof chemin>)=>[-1,1].flatMap(c=>[-1,1].map(e=>new THREE.Vector3(x+c*.050,q.y+Math.cos(q.angle)*e*.004,q.z+Math.sin(q.angle)*e*.004)));const aa=ring(a),bb=ring(b);for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]]){const start=p.length/3;[aa[j!]!,aa[k!]!,bb[k!]!,bb[j!]!].forEach(q=>p.push(...q.toArray()));uv.push(0,0,1,0,1,1,0,1);ix.push(start,start+2,start+1,start,start+3,start+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
for(const side of [-1,1]){
 const x=side*.275,tag=side<0?'gauche':'droite';
 ajouter('base',bande(x),3,`bande_${tag}`);
 for(let i=0;i<34;i++){const q=chemin(i/34);boite('base',[.114,.024,.031],[x,q.y,q.z],2,`patins_${tag}`,[q.angle,0,0]);}
 // Galets espacés, disposés dans l'ouverture ; leurs moyeux dépassent le bandage latéralement.
 for(let i=0;i<6;i++){
  const z=-.169+i*.0676;
  cyl('base',.0325,.081,[x,.0575,z],2,`galets_bandages_${tag}`,[0,0,Math.PI/2],12);
  cyl('base',.028,.009,[x+side*.045,.0575,z],5,`galets_flasques_${tag}`,[0,0,Math.PI/2],12);
  cyl('base',.012,.012,[x+side*.055,.0575,z],3,`galets_moyeux_${tag}`,[0,0,Math.PI/2],10);
  tige('base',[side*.227,.106,z-.023],[side*.227,.0575,z],.012,3,`bras_suspension_${tag}`,8);
 }
 for(const z of [-.267,.267]){
  cyl('base',.065,.077,[x,.091,z],2,`renvois_bandages_${tag}`,[0,0,Math.PI/2],16);
  cyl('base',.044,.009,[x+side*.044,.091,z],3,`renvois_flasques_${tag}`,[0,0,Math.PI/2],16);
  cyl('base',.016,.013,[x+side*.056,.091,z],1,`renvois_moyeux_${tag}`,[0,0,Math.PI/2],12);
 }
 for(const z of [-.125,.125])cyl('base',.019,.076,[x,.137,z],2,`rouleaux_retour_${tag}`,[0,0,Math.PI/2],12);
 boite('base',[.028,.06,.56],[side*.214,.109,0],1,`longerons_${tag}`);
 // Coulisseaux restent engagés dans leurs fourreaux même au maximum d'affaissement.
 for(const z of [-.16,.16]){
  cyl('base',.014,.048,[side*.195,.148,z],3,`tiges_suspension_${tag}`, [0,0,0],12);
  fourreau([side*.195,.190,z],`fourreaux_suspension_${tag}`);
 }
}

// Coque principale unique. Les chanfreins très longs limitent le rayon des coins.
ajouter('corps',carene([{y:.205,w:.414,d:.707,c:.090},{y:.236,w:.678,d:.890,c:.186},{y:.271,w:.538,d:.712,c:.144},{y:.282,w:.514,d:.680,c:.141}]),5,'coque_joues_inclinees');
// Glacis d'équipe posé sur le pan avant, extrémités volontairement étroites.
plaque('corps',[.260,.018,.113],[0,.272,.380],0,'glacis_equipe',[.374,0,0],.006);
for(const side of [-1,1]){
 for(const z of [-.213,-.071,.071,.213])plaque('corps',[.024,.059,.123],[side*.335,.232,z],1,'jupes_flancs', [0,0,side*.08],.004);
 plaque('corps',[.109,.017,.084],[side*.118,.288,-.240],1,'cadres_grilles_moteur',[0,0,0],.004);
 boite('corps',[.093,.007,.068],[side*.118,.300,-.240],6,'fonds_grilles_moteur');
 for(let i=0;i<4;i++)boite('corps',[.093,.007,.006],[side*.118,.307,-.266+i*.017],3,'lames_grilles_moteur');
 plaque('corps',[.045,.026,.035],[side*.13,.233,.425],1,'capots_avant',[-.10,0,0],.004);
 boite('corps',[.030,.013,.007],[side*.13,.233,.444],4,'lentilles_avant');
 // Anneaux de manutention visibles, sans pièce pleine masquant leur ouverture.
 ajouter('corps',new THREE.TorusGeometry(.018,.006,6,12),3,'anneaux_remorquage',[side*.14,.198,side>0?.403:-.403],[0,0,0]);
}
plaque('corps',[.110,.020,.074],[-.095,.285,.230],1,'trappe_conduite',[0,0,0],.005);
plaque('corps',[.067,.028,.032],[-.095,.303,.248],5,'capot_optique',[0,0,0],.004);
boite('corps',[.050,.014,.007],[-.095,.304,.267],4,'vitrage_optique');

// Couronne fixe et anneau mobile : mécanisme concentrique vertical.
cyl('corps',.178,.020,[0,.292,0],3,'couronne_fixe',[0,0,0],28);
cyl('module_tourelle',.162,.016,[0,.310,0],1,'couronne_mobile',[0,0,0],28);
ajouter('module_tourelle',carene([{y:.318,w:.372,d:.318,c:.061},{y:.356,w:.430,d:.344,c:.077},{y:.416,w:.368,d:.281,c:.066}]),0,'tourelle_panneaux_equipe');
plaque('module_tourelle',[.185,.017,.084],[0,.425,.050],5,'toit_technique',[0,0,0],.006);
// Deux berceaux indépendants ouverts devant la tourelle ; aucun long canon.
for(const side of [-1,1]){
 plaque('module_tourelle',[.073,.086,.062],[side*.085,.369,.165],1,'berceaux_marqueurs',[0,0,0],.009);
 cyl('module_tourelle',.033,.081,[side*.085,.369,.166],3,'axes_berceaux',[0,0,Math.PI/2],16);
}

/** Fût tourné creux avec changements de rayon réels ; tube de 160 mm, âme 19 mm. */
function marqueur(x:number){
 const ps:number[]=[],ns:number[]=[],uv:number[]=[],ix:number[]=[];const n=20;
 const profile:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[0,.028],[.028,.028],[.038,.023],[.132,.023],[.139,.030],[.160,.030]];
 function ring(r:number,z:number,nr:number,nz:number){const k=ps.length/3;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;ps.push(Math.cos(a)*r,Math.sin(a)*r,z);ns.push(Math.cos(a)*nr,Math.sin(a)*nr,nz);uv.push(i/n,z/.160);}return k;}
 for(let j=0;j<profile.length-1;j++){const [z0,r0]=profile[j]!,[z1,r1]=profile[j+1]!,len=Math.hypot(z1-z0,r1-r0),nr=(z1-z0)/len,nz=(r0-r1)/len;const a=ring(r0,z0,nr,nz),b=ring(r1,z1,nr,nz);for(let i=0;i<n;i++)ix.push(a+i,a+i+1,b+i+1,a+i,b+i+1,b+i);}
 const a=ring(.019,0,-1,0),b=ring(.019,.160,-1,0);for(let i=0;i<n;i++)ix.push(a+i,b+i+1,a+i+1,a+i,b+i,b+i+1);
 const front=ps.length/3;for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;for(const r of [.019,.030]){ps.push(Math.cos(t)*r,Math.sin(t)*r,.160);ns.push(0,0,1);uv.push(.5+Math.cos(t)*r/.06,.5+Math.sin(t)*r/.06);}}
 for(let i=0;i<n;i++){const k=front+i*2;ix.push(k,k+1,k+3,k,k+3,k+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(ns,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ajouter('os_recul',g,3,'tubes_creux',[x,.369,.192]);
 // Une lentille de marquage est au fond, à 145 mm derrière la bouche.
 cyl('os_recul',.0187,.005,[x,.369,.207],4,'fond_optique_tubes',[Math.PI/2,0,0],20);
}
marqueur(-.085);marqueur(.085);

// Radar : pied fixe puis parabole à deux faces, épaisseur vraie et bord annulaire.
cyl('module_tourelle',.027,.036,[0,.434,-.10],1,'pied_radar_fixe',[0,0,0],16);
cyl('module_radar',.022,.024,[0,.455,-.10],3,'axe_radar',[0,0,0],16);
tige('module_radar',[0,.459,-.10],[0,.511,-.109],.012,1,'col_radar',12);
function parabole(){const p:number[]=[],uv:number[]=[],ix:number[]=[];const n=24,rmax=.072;function point(r:number,a:number,back:boolean){return new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,(r/rmax)**2*.023-(back?.006:0));}function face(v:THREE.Vector3[],inverse=false){const k=p.length/3;if(inverse)v.reverse();v.forEach(t=>{p.push(t.x,t.y,t.z);uv.push(.5+t.x/(2*rmax),.5+t.y/(2*rmax));});for(let j=1;j<v.length-1;j++)ix.push(k,k+j,k+j+1);}
 for(const back of [false,true])for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,rr=ring/3*rmax,rs=(ring+1)/3*rmax;if(ring===0)face([point(0,0,back),point(rs,a,back),point(rs,b,back)],back);else face([point(rr,a,back),point(rs,a,back),point(rs,b,back),point(rr,b,back)],back);}
 // Le bord emploie des UV déroulés distincts : sa projection XY serait dégénérée.
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,k=p.length/3;[point(rmax,a,false),point(rmax,a,true),point(rmax,b,true),point(rmax,b,false)].forEach(t=>p.push(...t.toArray()));uv.push(0,0,1,0,1,1,0,1);ix.push(k,k+1,k+2,k,k+2,k+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
ajouter('module_radar',parabole(),5,'parabole_radar',[0,.521,-.103],[0,0,0]);
for(const s of [-1,1])tige('module_radar',[s*.050,.521,-.091],[s*.010,.521,-.041],.005,3,'bras_capteur_radar',8);
cyl('module_radar',.011,.023,[0,.521,-.038],4,'capteur_radar',[Math.PI/2,0,0],12);

// Fouet de 20 mm et ressort de base distinct. Spires et âme restent séparées.
cyl('module_tourelle',.028,.019,[-.17,.421,-.102],1,'embase_antenne',[0,0,0],16);
cyl('module_antenne',.006,.058,[-.17,.459,-.102],2,'ame_ressort',[0,0,0],12);
const hp:THREE.Vector3[]=[];for(let i=0;i<=72;i++){const t=i/72,a=t*Math.PI*6;hp.push(new THREE.Vector3(-.17+Math.cos(a)*.018,.436+t*.046,-.102+Math.sin(a)*.018));}
ajouter('module_antenne',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp),72,.004,6,false),11,'ressort_antenne');
cyl('module_antenne',.015,.014,[-.17,.489,-.102],1,'collier_fouet',[0,0,0],16);
cyl('module_antenne',.0102,.108,[-.17,.550,-.102],1,'fouet_antenne',[0,0,0],12,.0102);
ajouter('module_antenne',new THREE.SphereGeometry(.0102,12,6),1,'bout_fouet',[-.17,.604,-.102]);
// Indicateur escamotable, pas de piédestal sous l'unité.
plaque('module_tourelle',[.038,.018,.044],[.157,.423,-.088],1,'support_temoin',[0,0,0],.004);
plaque('socle',[.025,.021,.028],[.157,.439,-.088],7,'temoin_disponibilite',[0,0,0],.003);

// Le bord des patins inclinés dépasse le chemin nominal : recentrage sur leurs sommets.
const brutBox=new THREE.Box3();for(const liste of pieces.values())for(const p of liste){p.g.computeBoundingBox();brutBox.union(p.g.boundingBox!);}
const recentrage=new THREE.Vector3(-(brutBox.min.x+brutBox.max.x)/2,-brutBox.min.y,-(brutBox.min.z+brutBox.max.z)/2);
for(const liste of pieces.values())for(const p of liste)p.g.translate(recentrage.x,recentrage.y,recentrage.z);
// La base garde sa transformation identité et porte les sommets déjà recalés au sol.
poses.corps!.p=poses.corps!.p.map((x,i)=>x+recentrage.getComponent(i)) as V3;

const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_details',color:0xffffff,metalness:1,roughness:1})];
const objets=new Map<string,THREE.Object3D>();let triangles=0;
const bilan:Record<string,number>={};
for(const [nom,pose] of Object.entries(poses)){
 const ps=pieces.get(nom)??[];let o:THREE.Object3D;
 if(ps.length){const gs:THREE.BufferGeometry[]=[],mi:number[]=[];const infos:{nom:string;primitive:number;triangleDebut:number;triangles:number;role:number}[]=[];
  for(const mat of [0,1]){let offset=0;const selected=ps.filter(p=>(p.role===0?0:1)===mat);if(!selected.length)continue;
   const source=selected.map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone(),t=g.getAttribute('position').count/3;const po=pivot(nom);g.translate(-po.x,-po.y,-po.z);infos.push({nom:p.nom,primitive:gs.length,triangleDebut:offset,triangles:t,role:p.role});offset+=t;triangles+=t;bilan[p.nom]=(bilan[p.nom]??0)+t;return g;});
   const g=mergeVertices(mergeGeometries(source,false)!,1e-7);g.computeTangents();gs.push(g);mi.push(mat);
  }
  const g=mergeGeometries(gs,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mi[i]!);o=new THREE.Mesh(g,materiaux);o.userData={pieces:infos};
 }else o=new THREE.Group();
 o.name=nom;o.position.set(...pose.p);objets.set(nom,o);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.updateMatrixWorld(true);
const rot=(nom:string,t:number[],v:V3[])=>new THREE.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(p=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...p)).toArray()));
const pos=(nom:string,t:number[],v:V3[])=>new THREE.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(p=>p.map((x,i)=>x+poses[nom]!.p[i]!)));
// Le radar fait un tour continu (quaternions raccordés modulo le signe à la boucle).
const radarTour=(d:number)=>rot('module_radar',[0,d/4,d/2,3*d/4,d],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,3*Math.PI/2,0],[0,2*Math.PI,0]]);
const clips=[
 new THREE.AnimationClip('repos',2.4,[radarTour(2.4),rot('module_antenne',[0,.6,1.2,1.8,2.4],[[0,0,0],[.010,0,0],[0,0,0],[-.010,0,0],[0,0,0]])]),
 new THREE.AnimationClip('deplacement',1,[pos('corps',[0,.25,.5,.75,1],[[0,0,0],[0,.003,0],[0,0,0],[0,-.003,0],[0,0,0]]),rot('module_antenne',[0,.25,.5,.75,1],[[0,0,0],[.025,0,0],[0,0,0],[-.025,0,0],[0,0,0]]),radarTour(1)]),
 new THREE.AnimationClip('tir',.7,[pos('os_recul',[0,.06,.12,.20,.25,.39,.7],[[0,0,0],[0,0,-.018],[0,0,0],[0,0,-.014],[0,0,-.014],[0,0,-.005],[0,0,0]]),pos('corps',[0,.06,.20,.40,.7],[[0,0,0],[0,-.003,0],[0,-.002,0],[0,.002,0],[0,0,0]])]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.09,.21,.35,.5],[[0,0,0],[0,-.006,0],[0,.002,0],[0,-.001,0],[0,0,0]]),rot('module_antenne',[0,.09,.21,.5],[[0,0,0],[.024,0,-.032],[-.01,0,.015],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[pos('corps',[0,.55,.9],[[0,0,0],[0,-.012,0],[0,-.012,0]]),rot('module_tourelle',[0,.55,.9],[[0,0,0],[0,.06,0],[0,.06,0]]),pos('os_recul',[0,.55,.9],[[0,0,0],[0,0,-.018],[0,0,-.018]]),rot('module_radar',[0,.55,.9],[[0,0,0],[0,.40,0],[0,.40,0]]),rot('module_antenne',[0,.55,.9],[[0,0,0],[.045,0,-.04],[.045,0,-.04]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.30,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>9000)throw new Error(`Budget dépassé : ${triangles}`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut);const compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Bastion original paramétrique v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const octets=assemblerGlb(document,compact),sha=createHash('sha256').update(octets).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const box=new THREE.Box3().setFromObject(racine);const rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:9000,octetsGlb:octets.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},pivots:poses,trianglesParPiece:bilan,animations:clips.map(c=>({nom:c.name,dureeMs:Math.round(c.duration*1000),pistes:c.tracks.map(t=>t.name)})),approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,bornes:rapport.bornes,sha}));
}
void ecrire();
