/** Transport aérien cargo original ; aucune géométrie historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='unite_transport_air_base';
const sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={
 racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,.2,0]},base:{parent:'corps',p:[0,-.2,0]},
 os_rotor:{parent:'corps',p:[0,.403,0]},module_grue:{parent:'corps',p:[.112,.042,-.102]},
 os_grue_coude:{parent:'module_grue',p:[0,.108,-.174]},socle:{parent:'corps',p:[-.097,.229,.13]},
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
function courbe(n:string,pts:V3[],rayon:number,role:number,nom:string,segs=24,ns=8){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),segs,rayon,ns,false);if(nom.startsWith('patin_')){g.computeBoundingBox();g.translate(0,-g.boundingBox!.min.y,0);}ajouter(n,g,role,nom);}
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
// Châssis bas à plateau ouvert ; les côtés de cargo ne sont pas une coque fermée.
ajouter('corps',carene([{y:.130,w:.25,d:.595,c:.032,z:-.023},{y:.159,w:.336,d:.635,c:.035,z:-.023},{y:.184,w:.330,d:.625,c:.035,z:-.023}]),0,'plateau_chassis');
plaque('corps',[.292,.012,.328],[0,.189,-.144],8,'plancher_cargo',[0,0,0],.012);
for(const s of [-1,1]){
 const cote=s<0?'g':'d';
 // Patin cintré continu, posé sur sa longue section centrale.
 courbe('base',[[s*.193,.040,.302],[s*.193,.015,.263],[s*.193,.014,.207],[s*.193,.014,-.245],[s*.193,.033,-.300]],.014,2,`patin_${cote}`,24,10);
 for(const z of [-.203,.158]){
  tige('corps',[s*.193,.026,z],[s*.120,.150,z],.015,3,`jambe_${cote}_${z}`,12);
  cyl('corps',.028,.037,[s*.116,.146,z],1,`fourreau_${cote}_${z}`,[0,0,s*.42],16);
 }
 plaque('corps',[.018,.030,.290],[s*.157,.198,-.154],5,`rebord_${cote}`,[0,0,0],.004);
 for(const z of [-.266,-.115]){
  const g=new THREE.TorusGeometry(.012,.004,6,12).rotateY(Math.PI/2);
  ajouter('corps',g,3,`anneau_arrimage_${cote}_${z}`,[s*.167,.184,z]);
 }
 plaque('corps',[.017,.049,.063],[s*.148,.180,.096],1,`marche_cabine_${cote}`,[0,0,0],.004);
}
// Cabine à nez incliné, section YZ extrudée suivant X.
const profilCabine:[number,number][]=[[.171,.095],[.171,.354],[.235,.382],[.375,.335],[.423,.263],[.423,.130],[.361,.076]];
const cabine=prisme(profilCabine,.283).applyMatrix4(new THREE.Matrix4().set(0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1));
// L'échange XY inverse le winding ; conversion complète avant export.
const idxCab=cabine.index!;for(let i=0;i<idxCab.count;i+=3){const k=idxCab.getX(i+1);idxCab.setX(i+1,idxCab.getX(i+2));idxCab.setX(i+2,k);}cabine.computeVertexNormals();
ajouter('corps',cabine,0,'cabine');
// Vitrages pleins très légèrement enchâssés dans la peau, sans reflet peint.
for(const s of [-1,1]){
 const c=s<0?'g':'d';
 // Panneau latéral YZ exactement à l'extérieur des flancs droits.
 const fen=prisme([[.286,.139],[.286,.323],[.360,.316],[.399,.258],[.399,.145]],.006).applyMatrix4(new THREE.Matrix4().set(0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1));
 const ix=fen.index!;for(let i=0;i<ix.count;i+=3){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k);}fen.computeVertexNormals();
 ajouter('corps',fen,4,`vitre_laterale_${c}`,[s*.142,0,0]);
 boite('corps',[.009,.125,.009],[s*.146,.337,.226],5,`montant_lateral_${c}`);
 plaque('corps',[.010,.061,.137],[s*.143,.231,.221],5,`porte_basse_${c}`,[0,0,0],.003);
 tige('corps',[s*.151,.263,.142],[s*.151,.263,.176],.006,3,`poignee_${c}`,8);
 boite('corps',[.025,.057,.100],[s*.134,.257,.114],0,`pilier_arriere_${c}`);
}
// Pare-brise principal sur le plan incliné du nez (pente z/y = -0,336).
plaque('corps',[.238,.111,.008],[0,.321,.356],4,'pare_brise',[-.324,0,0],.003);
boite('corps',[.014,.123,.011],[0,.321,.357],5,'montant_pare_brise',[-.324,0,0]);
plaque('corps',[.248,.018,.116],[0,.426,.194],0,'pavillon_cabine',[0,0,0],.014);
// Moteur dorsal fixé sur le toit et sur deux jambes arrière du pylône.
ajouter('corps',carene([{y:.394,w:.142,d:.214,c:.028,z:.069},{y:.446,w:.161,d:.205,c:.030,z:.064},{y:.484,w:.137,d:.174,c:.025,z:.060}]),1,'bloc_moteur');
for(const s of [-1,1]){
 tige('corps',[s*.098,.187,-.052],[s*.055,.439,-.008],.022,0,`pylone_${s<0?'g':'d'}`,12);
 plaque('corps',[.008,.035,.095],[s*.080,.450,.066],6,`grille_moteur_${s<0?'g':'d'}`,[0,0,0],.002);
 // Échappement court, pas d'arme ni de projectile.
 tube(`echappement_${s<0?'g':'d'}`,'corps',.018,.011,.052,[s*.061,.467,-.035],3,12,[Math.PI/2,0,0]);
}
cyl('corps',.052,.050,[0,.492,0],5,'embase_mat',[0,0,0],24,.060);
cyl('corps',.025,.083,[0,.550,0],3,'mat_rotor',[0,0,0],24);
cyl('corps',.047,.022,[0,.575,0],1,'palier_rotor',[0,0,0],24);
cyl('os_rotor',.044,.029,[0,.602,0],3,'moyeu_rotor',[0,0,0],24,.037);
// Quatre pales épaisses, raccordées au moyeu et réellement entraînées autour de Y.
for(let i=0;i<4;i++){
 const blade=prisme([[.024,-.020],[.080,-.029],[.394,-.038],[.417,-.014],[.414,.027],[.070,.028]],.012).rotateY(i*Math.PI/2);
 ajouter('os_rotor',blade,5,`pale_${i}`,[0,.602,0]);
 const root=new THREE.BoxGeometry(.066,.020,.028).translate(.048,0,0).rotateY(i*Math.PI/2);
 ajouter('os_rotor',root,3,`attache_pale_${i}`,[0,.602,0]);
}
ellipsoide('os_rotor',[.041,.026,.041],[0,.618,0],0,'chapeau_rotor',20,10);
// Grue de manutention repliée le long du bord droit du plateau.
cyl('corps',.044,.027,[.112,.207,-.102],1,'platine_grue',[0,0,0],20);
plaque('corps',[.074,.050,.070],[.112,.224,-.102],5,'berceau_grue',[0,0,0],.008);
cyl('module_grue',.028,.085,[.112,.242,-.102],3,'axe_epaule',[0,0,Math.PI/2],20);
function poutre(n:string,a:V3,b:V3,largeur:number,hauteur:number,role:number,nom:string){
 const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b),d=pb.clone().sub(pa);
 const g=new THREE.BoxGeometry(largeur,hauteur,d.length()).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize()));ajouter(n,g,role,nom,pa.add(pb).multiplyScalar(.5).toArray() as V3);
}
poutre('module_grue',[.112,.242,-.102],[.112,.350,-.276],.034,.034,0,'bras_grue');
cyl('os_grue_coude',.027,.056,[.112,.350,-.276],3,'axe_coude',[0,0,Math.PI/2],20);
poutre('os_grue_coude',[.112,.350,-.276],[.112,.362,-.100],.026,.026,5,'avant_bras_grue');
// Poulie et crochet de levage courts solidaires de l'avant-bras.
cyl('os_grue_coude',.020,.033,[.112,.360,-.100],1,'poulie_crochet',[0,0,Math.PI/2],20);
tige('os_grue_coude',[.112,.360,-.100],[.112,.312,-.100],.007,3,'suspente_crochet',10);
courbe('os_grue_coude',[[.112,.315,-.100],[.112,.298,-.100],[.112,.291,-.112],[.112,.299,-.124]],.0065,3,'crochet',12,8);
// Coffre compact à gauche ; plus de la moitié du plateau demeure ouvert.
plaque('corps',[.098,.066,.113],[-.075,.227,-.236],1,'coffre_cargo',[0,0,0],.011);
plaque('corps',[.103,.011,.118],[-.075,.263,-.236],5,'couvercle_cargo',[0,0,0],.009);
for(const z of [-.271,-.203]){
 boite('corps',[.106,.008,.012],[-.075,.270,z],2,`sangle_haut_${z}`);
 for(const s of [-1,1])boite('corps',[.008,.079,.012],[-.075+s*.052,.233,z],2,`sangle_cote_${s}_${z}`);
}
plaque('corps',[.035,.011,.035],[-.097,.425,.130],1,'support_temoin',[0,0,0],.004);
plaque('socle',[.026,.024,.026],[-.097,.440,.130],7,'temoin',[0,0,0],.004);
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
function rotor(d:number,tours:number){const n=tours*32,t:number[]=[],v:V3[]=[];for(let i=0;i<=n;i++){t.push(i/n*d);v.push([0,i/n*tours*Math.PI*2,0]);}return rot('os_rotor',t,v);}
const clips=[
 new THREE.AnimationClip('repos',2.4,[rotor(2.4,1),oscillation('os_grue_coude',2.4,.014,0)]),
 new THREE.AnimationClip('deplacement',1,[rotor(1,2),pos('corps',[0,.125,.25,.375,.5,.625,.75,.875,1],[[0,0,0],[0,0,0],[0,.003,0],[0,.006,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]),oscillation('module_grue',1,.045,0)]),
 new THREE.AnimationClip('touche',.5,[pos('corps',[0,.07,.12,.28,.5],[[0,0,0],[0,.007,0],[0,.007,0],[0,.003,0],[0,0,0]]),rot('corps',[0,.07,.12,.28,.5],[[0,0,0],[0,0,-.026],[0,0,-.026],[0,0,.010],[0,0,0]]),rot('module_grue',[0,.12,.28,.5],[[0,0,0],[.07,0,0],[-.03,0,0],[0,0,0]])]),
 new THREE.AnimationClip('hors_jeu',.9,[rot('os_rotor',[0,.15,.35,.6,.9],[[0,0,0],[0,.8,0],[0,1.30,0],[0,1.42,0],[0,1.42,0]]),rot('module_grue',[0,.30,.60,.9],[[0,0,0],[-.08,0,0],[-.12,0,0],[-.12,0,0]]),rot('os_grue_coude',[0,.30,.60,.9],[[0,0,0],[-.06,0,0],[-.12,0,0],[-.12,0,0]]),new THREE.VectorKeyframeTrack('socle.scale',[0,.30,.60,.9],[1,1,1,1,1,1,0,0,0,0,0,0])]),
];
async function ecrire(){
 if(triangles>6000)throw new Error(`Budget ${triangles}/6000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas Tournament — Transport aérien cargo original v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:6000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,noeuds:Object.keys(poses),bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
