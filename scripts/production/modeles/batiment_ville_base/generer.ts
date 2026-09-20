/** Îlot de ville partagé original ; aucune géométrie du candidat historique importée. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:THREE.BufferGeometry;role:number;nom:string};
const id='batiment_ville_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const pieces=new Map<string,Piece[]>();
const poses:Record<string,{parent:string|null;p:V3}>={racine:{parent:null,p:[0,0,0]},corps:{parent:'racine',p:[0,0,0]},toit:{parent:'racine',p:[0,0,0]},enseigne:{parent:'corps',p:[0,.522,-.126]},volet_mobile:{parent:'corps',p:[-.190,.330,-.116]}};
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


// Sol lavé continu ; passage central de 260 mm de large, ouverture intégrale vers +Z.
plaque('corps',[.85,.024,.85],[0,.012,0],0,'dalle',.006);
const maisons=[{nom:'arriere',x:0,z:-.296,w:.658,d:.214,e:.556,h:.690,niveaux:3},{nom:'gauche',x:-.303,z:.013,w:.198,d:.338,e:.414,h:.527,niveaux:2},{nom:'droite',x:.303,z:.026,w:.198,d:.312,e:.451,h:.558,niveaux:2}];
/** Toit convexe fermé, sections triangulaires ; six faces, pas de plaque dépassante. */
function toitFerme(m:typeof maisons[number]){
 const w=m.w+.026,d=m.d+.024,y=m.e,haut=m.h;
 const v=[[-w/2,y,-d/2],[w/2,y,-d/2],[w/2,y,d/2],[-w/2,y,d/2],[-w/2,haut,0],[w/2,haut,0]];
 const faces=[[0,3,2,1],[0,1,5,4],[3,4,5,2],[0,4,3],[1,2,5]];
 const positions:number[]=[],uv:number[]=[];
 for(const f of faces.map(f=>f.reverse()))for(let i=1;i<f.length-1;i++)for(const ix of [f[0]!,f[i]!,f[i+1]!]){const p=v[ix]!;positions.push(p[0]!+m.x,p[1]!,p[2]!+m.z);uv.push(0,0);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));projeterUv(g);g.computeVertexNormals();ajouter('toit',g,5,`toit_${m.nom}`);
 // Tuiles par rangs continus à petit ressaut, toutes adossées aux pans pleins.
 for(const signe of [-1,1]){
  const angle=signe*Math.atan2(haut-y,d/2),longueur=Math.hypot(haut-y,d/2);
  for(let j=0;j<4;j++){
   const t=(j+.5)/4,zz=signe*d/2*(1-t),yy=y+(haut-y)*t;
   boite('toit',[w-.005,.009,longueur/4+.004],[m.x,yy+.002,m.z+zz],5,`rang_tuile_${m.nom}_${signe}_${j}`,[angle,0,0]);
  }
  // Rives grises d'équipe suivant la vraie pente, lisibles du dessus.
  for(const x of [-w/2+.007,w/2-.007])boite('toit',[.014,.015,longueur+.005],[m.x+x,(haut+y)/2+.004,m.z+signe*d/4],2,`rive_${m.nom}_${signe}_${x}`,[angle,0,0]);
 }
 cyl('toit',.010,w,[m.x,haut,m.z],5,`faitiere_${m.nom}`,[0,0,Math.PI/2],10);
}
for(const m of maisons){
 boite('corps',[m.w,m.e-.024,m.d],[m.x,(m.e+.024)/2,m.z],m.nom==='droite'?1:12,`mur_${m.nom}`);
 boite('corps',[m.w+.008,.044,m.d+.008],[m.x,.046,m.z],0,`soubassement_${m.nom}`);
 for(let j=1;j<m.niveaux;j++)boite('corps',[m.w+.012,.014,m.d+.012],[m.x,.06+j*(m.e-.05)/m.niveaux,m.z],0,`bandeau_${m.nom}_${j}`);
 boite('corps',[m.w+.019,.018,m.d+.016],[m.x,m.e-.006,m.z],0,`corniche_${m.nom}`);
 toitFerme(m);
}
// Façades : encadrement de pierre, vitrage posé devant, volets en bois à traverses.
function fenetre(nom:string,p:V3,angle:number,w=.048,h=.073,volets=true){
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),orig=new THREE.Vector3(...p);
 const poser=(s:V3,local:V3,role:number,n:string)=>boite('corps',s,new THREE.Vector3(...local).applyQuaternion(q).add(orig).toArray() as V3,role,`${nom}_${n}`,[0,angle,0]);
 poser([w+.016,h+.018,.012],[0,0,0],0,'cadre');poser([w,h,.009],[0,0,.009],4,'verre');
 poser([w+.025,.012,.025],[0,-h/2-.011,.006],0,'appui');poser([.006,h,.009],[0,0,.016],9,'meneau');
 if(volets)for(const signe of [-1,1]){
  const x=signe*(w/2+.017);poser([.024,h+.003,.008],[x,0,.006],9,`volet_${signe}`);
  for(const yy of [-h*.30,h*.30])poser([.026,.007,.006],[x,yy,.012],9,`traverse_${signe}_${yy}`);
 }
}
for(const y of [.142,.310,.478])for(const x of [-.218,0,.218])if(y!==.142||x!==0)fenetre(`baie_arriere_${x}_${y}`,[x,y,-.184],0);
for(const y of [.142,.310,.478])for(const x of [-.205,.205])fenetre(`baie_dos_${x}_${y}`,[x,y,-.409],Math.PI,.052,.074,false);
for(const m of maisons.slice(1)){
 const gauche=m.x<0,angle=gauche?Math.PI/2:-Math.PI/2;
 for(const y of [.155,.327])for(const z of [-.055,.093]){
  if(gauche&&y===.327&&z===-.055){
   fenetre('baie_volet_mobile',[-.198,y,z],angle,.054,.075,false);
   // Le volet unique est ouvert à 90°, adossé à sa charnière verticale.
   boite('volet_mobile',[.052,.079,.014],[-.164,.330,-.116],9,'panneau_volet_mobile');
   for(const yy of [.307,.353])boite('volet_mobile',[.054,.009,.017],[-.164,yy,-.114],9,`traverse_mobile_${yy}`);
   for(const yy of [.303,.357]){cyl('corps',.008,.022,[-.190,yy,-.116],3,`charniere_${yy}`,undefined,10);boite('corps',[.021,.018,.023],[-.202,yy,-.116],3,`platine_charniere_${yy}`);}
  }else fenetre(`baie_${m.nom}_${z}_${y}`,[m.x+(gauche?m.w/2:-m.w/2)+ (gauche?.006:-.006),y,z],angle,.045,.068);
 }
 for(const y of [.155,.327])fenetre(`baie_pignon_${m.nom}_${y}`,[m.x,y,m.z+m.d/2+.006],0,.054,.078,false);
}
// Trois portes épaisses : logements et café. Seuils posés sur le socle.
for(const [nom,p,angle] of [['porte_arriere',[0,.105,-.181],0],['porte_gauche',[-.197,.103,.131],Math.PI/2],['porte_droite',[.197,.103,.139],-Math.PI/2]] as [string,V3,number][]){
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),o=new THREE.Vector3(...p);
 for(const [n,s,l,r] of [['cadre',[.074,.171,.017],[0,0,0],0],['bois',[.055,.151,.010],[0,0,.014],9],['poignee',[.008,.020,.011],[.018,-.016,.022],3],['seuil',[.086,.014,.037],[0,-.074,.009],0]] as [string,V3,V3,number][])boite('corps',s,new THREE.Vector3(...l).applyQuaternion(q).add(o).toArray() as V3,r,`${nom}_${n}`,[0,angle,0]);
}
// Terrasse de café couverte sur la façade +Z ; X reste <= -.195 hors du couloir.
boite('corps',[.216,.017,.226],[-.303,.220,.280],2,'auvent', [.10,0,0]);
boite('corps',[.222,.030,.018],[-.303,.197,.395],2,'retombee_auvent');
for(const x of [-.398,-.208]){tige('corps',[x,.147,.177],[x,.211,.388],.008,3,`console_auvent_${x}`,8);boite('corps',[.024,.027,.023],[x,.150,.184],3,`platine_auvent_${x}`);}
// Banderole de cour sans emblème, coulisse verticale rattachée à la façade arrière.
boite('corps',[.196,.016,.080],[0,.472,-.156],3,'console_enseigne');
for(const x of [-.083,.083]){
 boite('corps',[.015,.142,.020],[x,.538,-.142],3,`rail_enseigne_${x}`);
 boite('corps',[.026,.014,.032],[x,.604,-.142],3,`butee_enseigne_${x}`);
}
boite('enseigne',[.152,.044,.019],[0,.522,-.126],2,'banderole');
boite('enseigne',[.152,.015,.039],[0,.549,-.135],2,'retour_haut_banderole');
for(const x of [-.083,.083])boite('enseigne',[.027,.027,.018],[x,.522,-.133],3,`patin_enseigne_${x}`);
// Cour : café sur les marges, table ronde et deux tabourets, tous les pieds au sol.
cyl('corps',.044,.016,[-.306,.131,.310],9,'plateau_table',undefined,20);
cyl('corps',.011,.095,[-.306,.0765,.310],3,'pied_table',undefined,10);
cyl('corps',.029,.009,[-.306,.0285,.310],3,'embase_table',undefined,16);
for(const x of [-.382,-.230]){
 cyl('corps',.024,.014,[x,.088,.310],9,`assise_${x}`,undefined,16);
 for(const dz of [-.010,.010])for(const dx of [-.010,.010])boite('corps',[.009,.057,.009],[x+dx,.0525,.310+dz],3,`pied_tabouret_${x}_${dx}_${dz}`);
}
// Jardinières creuses par quatre parois et fond, terre et feuillage en volume.
for(const [k,x,z] of [[0,-.250,.226],[1,.290,.221],[2,-.360,.221]] as [number,number,number][]){
 const w=.080,d=.044,h=.048;
 boite('corps',[w,.011,d],[x,.0295,z],5,`bac_${k}_fond`);
 for(const dx of [-w/2+.004,w/2-.004])boite('corps',[.008,h,d],[x+dx,.048,z],5,`bac_${k}_cote_${dx}`);
 for(const dz of [-d/2+.004,d/2-.004])boite('corps',[w,h,.008],[x,.048,z+dz],5,`bac_${k}_long_${dz}`);
 boite('corps',[w-.016,.030,d-.016],[x,.048,z],11,`terre_${k}`);
 for(let j=0;j<3;j++){const g=new THREE.IcosahedronGeometry(.025,0);g.scale(1,.8,.65);ajouter('corps',g,6,`feuillage_${k}_${j}`,[x-.024+j*.024,.076,z]);}
}
// Râtelier à trois arceaux carrés épais et deux longerons posés, marge droite frontale.
for(const z of [.286,.370])boite('corps',[.159,.012,.022],[.296,.030,z],3,`longeron_ratelier_${z}`);
for(const x of [.236,.296,.356]){
 for(const z of [.286,.370])boite('corps',[.013,.074,.013],[x,.068,z],3,`pied_ratelier_${x}_${z}`);
 boite('corps',[.013,.013,.097],[x,.1085,.328],3,`arceau_ratelier_${x}`);
}
// Deux luminaires fixés aux façades, seules leurs lentilles sont émissives.
for(const x of [-.126,.126]){
 boite('corps',[.018,.037,.027],[x,.231,-.177],3,`applique_${x}`);
 boite('corps',[.016,.027,.012],[x,.231,-.157],10,`lentille_${x}`);
}
// Métal visible = mat_corps ; seules les surfaces vitreuses utilisent mat_vitrage.
const materiaux=[new THREE.MeshStandardMaterial({name:'mat_corps',color:0xffffff,metalness:1,roughness:1}),new THREE.MeshStandardMaterial({name:'mat_vitrage',color:0xffffff,metalness:1,roughness:1,emissive:0xffffff})];
const objets=new Map<string,THREE.Object3D>();let triangles=0;const bilan:Record<string,number>={};
for(const [nom,pose] of Object.entries(poses)){
 const ps=pieces.get(nom)??[];let o:THREE.Object3D;
 if(ps.length){const gs:THREE.BufferGeometry[]=[],mi:number[]=[],infos:{nom:string;primitive:number;triangleDebut:number;triangles:number;role:number}[]=[];
  for(const mat of [0,1]){let debut=0;const sel=ps.filter(p=>[4,10].includes(p.role)?mat===1:mat===0);if(!sel.length)continue;
   const source=sel.map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone(),t=g.getAttribute('position').count/3,po=pivot(nom);g.translate(-po.x,-po.y,-po.z);infos.push({nom:p.nom,primitive:gs.length,triangleDebut:debut,triangles:t,role:p.role});debut+=t;triangles+=t;bilan[p.nom]=t;return g;});
   const g=mergeVertices(mergeGeometries(source,false)!,1e-7);g.computeTangents();gs.push(g);mi.push(mat);
  }
  const g=mergeGeometries(gs,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mi[i]!);o=new THREE.Mesh(g,materiaux);o.userData={pieces:infos};
 }else o=new THREE.Group();o.name=nom;o.position.set(...pose.p);objets.set(nom,o);
}
for(const [nom,p] of Object.entries(poses))if(p.parent)objets.get(p.parent)!.add(objets.get(nom)!);
const racine=objets.get('racine')!;racine.userData.atlasAnimationsBatiment=true;racine.updateMatrixWorld(true);

const q=(angle:number)=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle).toArray();
const clips=[
 new THREE.AnimationClip('repos',3.2,[new THREE.QuaternionKeyframeTrack('volet_mobile.quaternion',[0,.8,1.6,2.4,3.2],[0,.06,0,-.06,0].flatMap(q))]),
 new THREE.AnimationClip('capture',1.4,[new THREE.VectorKeyframeTrack('enseigne.position',[0,.35,.7,1.05,1.4],[0,.016,.030,.016,0].flatMap(d=>[0,.522+d,-.126]))]),
];
async function ecrire(){
 if(triangles>5000)throw new Error(`Budget ${triangles}/5000`);mkdirSync(sortie,{recursive:true});
 const brut=await exporterGlb(racine,clips),{document,bin}=decouperGlb(brut),compact=dedoublonner(document,bin);alleger(document);
 const canaux=['albedo','normale','rugosite','emission','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {name:string;pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown;emissiveTexture?:unknown;emissiveFactor?:number[]}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};if(m.name==='mat_vitrage'){m.emissiveTexture={index:3};m.emissiveFactor=[1,1,1];}}
 document.asset={version:'2.0',generator:'Atlas Tournament — Ville commune à trois maisons originale v1',extras:{source:'creation_originale',unite:'metre',avant:'+Z',haut:'+Y',bakeHD:false}};
 const bytes=assemblerGlb(document,compact),sha=createHash('sha256').update(bytes).digest('hex');writeFileSync(path.join(sortie,`${id}_lod0.glb`),bytes);
 const box=new THREE.Box3().setFromObject(racine),rapport={id,version:1,provenance:{type:'creation_originale_parametrique',sourceExterne:false,ancienCandidatImporte:false},triangles,budgetTriangles:5000,octetsGlb:bytes.length,sha256Glb:sha,bornes:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},hierarchie:poses,bilanTriangles:bilan,approbationArtistique:false};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({id,triangles,octets:bytes.length,sha256:sha,dimensions:rapport.bornes.dimensions}));
}
void ecrire();
