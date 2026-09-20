/** Binôme original d’appui lourd : volumes et rig propres, aucun maillage importé. */
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:T.BufferGeometry;role:number;os:string;etiquette:string};
const id='unite_meca_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
const racine=new T.Group();racine.name='racine';
const os=new Map<string,T.Bone>(),bind=new Map<string,V3>(),pieces:Piece[]=[],basePieces:Piece[]=[];
const bilan:Record<string,number>={};
function articulation(nom:string,parent:string|null,monde:V3){
 const b=new T.Bone();b.name=nom;const p=parent?bind.get(parent)!:[0,0,0];b.position.set(monde[0]-p[0]!,monde[1]-p[1]!,monde[2]-p[2]!);(parent?os.get(parent)!:racine).add(b);os.set(nom,b);bind.set(nom,monde);return b;
}
function piece(g:T.BufferGeometry,role:number,osNom:string,etiquette:string,p:V3=[0,0,0],rotation:V3=[0,0,0]){
 // Retirer les triangles de rayon nul aux pôles d'une surface de révolution.
 const indice=g.index;if(indice){const p=g.getAttribute('position'),valides:number[]=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();for(let i=0;i<indice.count;i+=3){const ia=indice.getX(i),ib=indice.getX(i+1),ic=indice.getX(i+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)valides.push(ia,ib,ic);}g.setIndex(valides);}
 const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,((role%4)+.07+uv.getX(i)*.86)/4,(Math.floor(role/4)+.07+uv.getY(i)*.86)/4);
 g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(1,1,1)));
 (osNom==='base'?basePieces:pieces).push({g,role,os:osNom,etiquette});bilan[etiquette]=(bilan[etiquette]??0)+(g.index?g.index.count:g.getAttribute('position').count)/3;
}
function boite(osNom:string,taille:V3,p:V3,role:number,etiquette:string,rotation:V3=[0,0,0]){piece(new T.BoxGeometry(...taille),role,osNom,etiquette,p,rotation);}
function ellipsoide(osNom:string,rayons:V3,p:V3,role:number,etiquette:string,n=8,m=5){const g=new T.SphereGeometry(1,n,m);g.scale(...rayons);piece(g,role,osNom,etiquette,p);}
function cylindre(osNom:string,r:number,h:number,p:V3,role:number,etiquette:string,n=8,rhaut=r,rotation:V3=[0,0,0]){piece(new T.CylinderGeometry(rhaut,r,h,n,1,false),role,osNom,etiquette,p,rotation);}
/** Coupe octogonale réellement chanfreinée, sans sommets superposés par face. */
function volume(osNom:string,sections:{y:number;x:number;z:number}[],p:V3,role:number,etiquette:string,rotation:V3=[0,0,0]){
 const points=sections.map(s=>{const c=Math.min(s.x,s.z)*.22;return [[-s.x/2+c,-s.z/2],[s.x/2-c,-s.z/2],[s.x/2,-s.z/2+c],[s.x/2,s.z/2-c],[s.x/2-c,s.z/2],[-s.x/2+c,s.z/2],[-s.x/2,s.z/2-c],[-s.x/2,-s.z/2+c]].map(([x,z])=>new T.Vector3(x,s.y,z));});
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];
 const face=(v:T.Vector3[])=>{const first=pos.length/3,n=new T.Vector3().crossVectors(v[1]!.clone().sub(v[0]!),v[2]!.clone().sub(v[0]!)).normalize();const axes=Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z))?['x','z'] as const:Math.abs(n.x)>Math.abs(n.z)?['z','y'] as const:['x','y'] as const;const u=v.map(p=>p[axes[0]]),w=v.map(p=>p[axes[1]]),a=Math.min(...u),b=Math.min(...w),du=Math.max(...u)-a,dv=Math.max(...w)-b;v.forEach((p,i)=>{pos.push(p.x,p.y,p.z);uv.push((u[i]!-a)/du,(w[i]!-b)/dv);});for(let i=1;i<v.length-1;i++)idx.push(first,first+i,first+i+1);};
 face(points[0]!);for(let j=0;j<points.length-1;j++)for(let i=0;i<8;i++)face([points[j]![i]!,points[j+1]![i]!,points[j+1]![(i+1)%8]!,points[j]![(i+1)%8]!]);face([...points.at(-1)!].reverse());
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();piece(g,role,osNom,etiquette,p,rotation);
}
function coffre(osNom:string,taille:V3,p:V3,role:number,etiquette:string,c=.006,rotation:V3=[0,0,0]){const[x,y,z]=taille;volume(osNom,[{y:-y/2,x:x-c*2,z:z-c*2},{y:-y/2+c,x,z},{y:y/2-c,x,z},{y:y/2,x:x-c*2,z:z-c*2}],p,role,etiquette,rotation);}
function segment(osNom:string,a:V3,b:V3,r:number,r2:number,role:number,etiquette:string,n=8){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const g=new T.CylinderGeometry(r2,r,d.length(),n,1,false);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));piece(g,role,osNom,etiquette,av.add(bv).multiplyScalar(.5).toArray() as V3);}
// Base commune ovale : centrée, 18 mm de haut, aucune piste sur sa racine.
const plateau=new T.CylinderGeometry(1,1,.014,24);plateau.scale(.225,1,.220);piece(plateau,2,'base','plateau_ovale',[0,.007,0]);
const bord=new T.CylinderGeometry(1,1,.004,24);bord.scale(.221,1,.216);piece(bord,5,'base','bord_plateau',[0,.016,0]);
const profils=[{nom:'porteuse',x:-.084,z:-.024,dy:.004,peau:8,cheveux:10},{nom:'equipier',x:.101,z:.029,dy:.018,peau:9,cheveux:11}];
for(const p of profils){
 const {nom,x,z,dy,peau,cheveux}=p,porteuse=nom==='porteuse';
 const pos=(a:number,b:number,c:number):V3=>[x+a,b+dy,z+c];
 articulation(`os_bassin_${nom}`,null,pos(0,.274,0));articulation(`os_torse_${nom}`,`os_bassin_${nom}`,pos(0,.317,0));articulation(`os_tete_${nom}`,`os_torse_${nom}`,pos(0,.464,0));
 const bassin=`os_bassin_${nom}`,torse=`os_torse_${nom}`,tete=`os_tete_${nom}`;
 volume(bassin,[{y:-.032,x:.091,z:.068},{y:.022,x:.103,z:.073}],pos(0,.276,0),1,'pantalons_renforces');
 // Plastron en capsule à épaules souples : plus large que le génie, sans camouflage.
 const largeur=porteuse?.112:.122;
 volume(torse,[{y:0,x:.091,z:.070},{y:.045,x:largeur,z:.085},{y:.104,x:largeur+.005,z:.081},{y:.132,x:.071,z:.061}],pos(0,.312,0),14,'vestes_tissu_neutre');
 boite(torse,[.100,.023,.078],pos(0,.322,.003),2,'ceintures_larges');
 for(const s of [-1,1])boite(torse,[.019,.111,.014],pos(s*.034,.383,.048),12,'harnais_renforce');
 coffre(torse,[.067,.058,.018],pos(0,.389,.052),5,'plastrons_arrondis',.005);
 boite(torse,[.039,.025,.021],pos(0,.337,.052),6,'fermoirs_ceinture');
 cylindre(tete,.021,.037,pos(0,.458,0),peau,'cous',8);
 ellipsoide(tete,[porteuse?.037:.041,.052,.039],pos(0,.506,.006),peau,'visages_fictifs',10,6);
 // Profils fictifs différenciés par proportions, teints, coiffures et hauteur.
 ellipsoide(tete,[.041,.035,.019],pos(0,.512,-.021),cheveux,'chevelures',8,3);
 if(porteuse)ellipsoide(tete,[.022,.018,.023],pos(0,.482,-.047),cheveux,'chignon_bas',8,3);
 const casque=new T.SphereGeometry(1,12,4,0,Math.PI*2,0,Math.PI/2);casque.scale(.051,.040,.047);piece(casque,5,tete,'casques_renforces',pos(0,.537,0));
 cylindre(tete,.051,.009,pos(0,.538,0),6,'bords_casques',12);
 // Visière épaisse devant le haut du visage, elle reste noire dans le masque.
 coffre(tete,[.075,.024,.014],pos(0,.520,.045),4,'visieres_verre',.003);
 for(const s of [-1,1])boite(tete,[.015,.030,.034],pos(s*.043,.509,.012),6,'joues_casque');
 boite(tete,[.024,.014,.059],pos(0,.576,-.001),13,'cretes_equipe');
 boite(tete,[.010,.011,.009],pos(0,.497,.045),peau,'nez');
 boite(tete,[.017,.003,.003],pos(0,.484,.042),peau,'levres');
 // Cadre dorsal segmenté : rails porteurs, ponts au harnais et trois panneaux d'équipe.
 for(const s of [-1,1]){
  boite(torse,[.019,.139,.026],pos(s*.045,.393,-.063),3,'rails_cadre_dorsal');
  boite(torse,[.023,.022,.040],pos(s*.043,.346,-.047),6,'ancrages_bas_cadre');
  boite(torse,[.023,.022,.040],pos(s*.043,.445,-.047),6,'ancrages_haut_cadre');
 }
 coffre(torse,[.094,.128,.054],pos(0,.395,-.101),5,'capsules_dorsales',.012);
 for(const y of [.355,.394,.433])volume(torse,[{y:-.0155,x:.079,z:.015},{y:.0155,x:.079,z:.015}],pos(0,y,-.134),0,'panneaux_dorsaux_segmentes');
 for(const [j,s] of [-1,1].entries()){
  const cote=j===0?'gauche':'droite',hanche=`os_cuisse_${nom}_${cote}`,genou=`os_mollet_${nom}_${cote}`,pied=`os_pied_${nom}_${cote}`,xx=s*.031;
  articulation(hanche,bassin,pos(xx,.267,0));articulation(genou,hanche,pos(xx,.153,.002));articulation(pied,genou,pos(xx,.051-dy,.006));
  segment(hanche,pos(xx,.257,0),pos(xx,.166,.002),.029,.031,1,'cuisses_tissu');
  ellipsoide(genou,[.029,.027,.028],pos(xx,.154,.002),6,'rotules_protection',8,3);
  segment(genou,pos(xx,.139,.002),pos(xx,.069-dy,.006),.026,.022,1,'mollets_tissu');
  coffre(genou,[.044,.075,.023],pos(xx,.107,.029),5,'plaques_tibias_epaisses',.004);
  boite(genou,[.047,.015,.035],pos(xx,.122,.002),6,'sangles_tibias');
  coffre(pied,[.054,.040,.090],pos(xx,.043-dy,.026),2,'bottes_massives',.007);
  boite(pied,[.053,.010,.089],pos(xx,.029-dy,.026),2,'semelles_support');
  for(const zz of [-.0315,-.0105,.0105,.0315])boite(pied,[.051,.006,.010],pos(xx,.021-dy,.026+zz),2,'crans_semelles');
  const bras=`os_bras_${nom}_${cote}`,avant=`os_avant_bras_${nom}_${cote}`;
  const porteur=porteuse&&s===-1;
  const epaule=pos(s*.070,.423,0),coude=pos(s*.084,.367,porteur?.025:.009),main=pos(s*.089,porteur?.448:.331,porteur?.132:porteuse?.026:.068);
  articulation(bras,torse,epaule);articulation(avant,bras,coude);
  ellipsoide(bras,[.030,.029,.033],epaule,14,'epaules_souples',8,3);
  segment(bras,epaule,coude,.026,.027,14,'manches_haut');
  segment(avant,coude,main,.020,.023,1,'manches_bas');
  ellipsoide(avant,[.024,.019,.024],main,2,'gants',8,3);
 }
}
const femme='os_torse_porteuse',homme='os_torse_equipier';
// Le tube de marqueurs est un caisson fermé de compétition, porté à l'épaule gauche.
// Son nez horizontal regarde +Z ; la selle est solidaire du cadre de la porteuse.
boite(femme,[.078,.025,.034],[-.147,.452,-.048],6,'pont_epaule_lanceur');
coffre(femme,[.046,.024,.071],[-.180,.463,-.036],2,'selle_lanceur',.003);
articulation('module_lance_roquettes',femme,[-.180,.502,.013]);
coffre('module_lance_roquettes',[.062,.056,.292],[-.180,.502,.013],5,'caisson_lanceur_horizontal',.008);
for(const z of [-.104,.045])boite('module_lance_roquettes',[.066,.061,.016],[-.180,.502,z],6,'cerclages_caisson');
// Trois embouchures épaisses, embouts obturés et colorés, aucun projectile détaché.
for(const [dx,dy] of [[-.013,-.009],[.013,-.009],[0,.013]]){
 cylindre('module_lance_roquettes',.0105,.019,[-.180+dx!,.502+dy!,.168],3,'bagues_embouchures',6,.0105,[Math.PI/2,0,0]);
 cylindre('module_lance_roquettes',.0075,.002,[-.180+dx!,.502+dy!,.1785],7,'obturateurs_marqueurs',6,.0075,[Math.PI/2,0,0]);
}
boite(femme,[.025,.048,.024],[-.173,.453,.107],6,'poignee_avant_lanceur');
// Deux poignées robustes et des attaches relient le caisson de recharges au cadre.
coffre(homme,[.110,.053,.076],[.101,.355,-.121],5,'casier_recharges',.006);
for(const s of [-1,1])boite(homme,[.022,.021,.052],[.101+s*.040,.375,-.093],3,'attaches_casier');
for(const dx of [-.031,0,.031])boite(homme,[.022,.027,.006],[.101+dx,.356,-.162],6,'logements_recharges');
const materiaux=[new T.MeshStandardMaterial({name:'mat_corps',metalness:1,roughness:1}),new T.MeshStandardMaterial({name:'mat_details',metalness:1,roughness:1})];
const noms=[...os.keys()];
function fusionner(ps:Piece[],skin:boolean){
 const groupes:T.BufferGeometry[]=[],mats:number[]=[];
 for(const mat of [0,1]){
  const gs=ps.filter(p=>([0,13,14].includes(p.role)?0:1)===mat).map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone();if(skin){const n=g.getAttribute('position').count,joints=new Uint16Array(n*4),poids=new Float32Array(n*4);for(let i=0;i<n;i++){joints[i*4]=noms.indexOf(p.os);poids[i*4]=1;}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(poids,4));}return g;});
  if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-7);g.computeTangents();groupes.push(g);mats.push(mat);}
 }
 const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mats[i]!);return g;
}
const corps=new T.SkinnedMesh(fusionner(pieces,true),materiaux);corps.name='corps';racine.add(corps);
const base=new T.Mesh(fusionner(basePieces,false),materiaux);base.name='base';racine.add(base);
const socle=new T.Mesh(new T.BoxGeometry(.031,.014,.016),materiaux[1]);socle.name='socle';socle.position.set(0,.127,-.137);os.get(homme)!.add(socle);
const u=socle.geometry.getAttribute('uv');for(let i=0;i<u.count;i++)u.setXY(i,(3.07+u.getX(i)*.86)/4,(1.07+u.getY(i)*.86)/4);socle.geometry.computeTangents();bilan.temoin_disponibilite=12;
racine.updateMatrixWorld(true);corps.bind(new T.Skeleton([...os.values()]));
const poseInitiale=new Map<T.Object3D,{p:T.Vector3;q:T.Quaternion;s:T.Vector3}>();racine.traverse(o=>poseInitiale.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
const rotation=(nom:string,t:number[],v:V3[])=>new T.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(v=>new T.Quaternion().setFromEuler(new T.Euler(...v)).toArray()));
const position=(nom:string,t:number[],v:V3[])=>new T.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(v=>{const p=poseInitiale.get(os.get(nom)!)!.p;return [p.x+v[0],p.y+v[1],p.z+v[2]];}));
const repos:T.KeyframeTrack[]=[],marche:T.KeyframeTrack[]=[],tir:T.KeyframeTrack[]=[position('module_lance_roquettes',[0,.13,.21,.40,.7],[[0,0,0],[0,0,0],[0,0,-.016],[0,0,-.006],[0,0,0]])],touche:T.KeyframeTrack[]=[];
const fin:T.KeyframeTrack[]=[new T.VectorKeyframeTrack('socle.scale',[0,.25,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])];
const capture:T.KeyframeTrack[]=[rotation('os_bras_equipier_droite',[0,.28,.50,.87,1.15,1.3],[[0,0,0],[-.75,0,.35],[-1.10,0,.45],[-1.10,0,.45],[-.32,0,.12],[0,0,0]]),rotation('os_avant_bras_equipier_droite',[0,.28,.50,.68,.87,1.15,1.3],[[0,0,0],[-.58,0,0],[-.84,0,.06],[-.84,0,-.08],[-.84,0,.06],[-.24,0,0],[0,0,0]])];
for(const [pIndex,p] of profils.entries()){
 const n=p.nom,torse=`os_torse_${n}`,tete=`os_tete_${n}`,bassin=`os_bassin_${n}`;
 repos.push(rotation(torse,[0,.6,1.2,1.8,2.4],[[0,0,0],[.010,0,.004],[0,0,0],[-.010,0,-.004],[0,0,0]]),rotation(tete,[0,1.2,2.4],[[0,0,0],[0,pIndex===0?.035:-.070,0],[0,0,0]]));
 // Petite marche lourde en place ; les pieds et le bassin résolvent deux segments.
 const t=Array.from({length:129},(_,i)=>i/128),fermer=(v:V3[])=>{v[v.length-1]=[...v[0]!] as V3;return v;};
 const bassinY=t.map(t=>-.013+.002*Math.sin(t*4*Math.PI));
 marche.push(position(bassin,t,fermer(bassinY.map(y=>[0,y,0]))),rotation(torse,t,fermer(t.map(t=>[.020,.012*Math.sin(2*Math.PI*t),0]))));
 for(const [j,cote] of ['gauche','droite'].entries()){
  const l1=Math.hypot(.114,.002),l2=Math.hypot(.102+p.dy,.004),alpha0=Math.atan2(-.002,.114),beta0=Math.atan2(-.004,.102+p.dy);
  const poses=t.map((t,i)=>{
   const phase=t*Math.PI*2+(j+pIndex)*Math.PI,z=.006+.027*Math.sin(phase),levee=.016*Math.max(0,Math.cos(phase))**2;
   const d=.216+p.dy+bassinY[i]!-levee,rayon=Math.hypot(d,z),gamma=Math.atan2(-z,d);
   const a=gamma-Math.acos((l1*l1+rayon*rayon-l2*l2)/(2*l1*rayon))-alpha0,total=gamma+Math.acos((l2*l2+rayon*rayon-l1*l1)/(2*l2*rayon))-beta0;
   return {a,k:total-a,cheville:-total};
  });
  marche.push(rotation(`os_cuisse_${n}_${cote}`,t,fermer(poses.map(v=>[v.a,0,0]))),rotation(`os_mollet_${n}_${cote}`,t,fermer(poses.map(v=>[v.k,0,0]))),rotation(`os_pied_${n}_${cote}`,t,fermer(poses.map(v=>[v.cheville,0,0]))));
  if(!(n==='porteuse'&&cote==='gauche'))marche.push(rotation(`os_bras_${n}_${cote}`,t,fermer(t.map(t=>[.045*Math.sin(t*Math.PI*2+(j+pIndex)*Math.PI),0,0]))));
  const tf=Array.from({length:65},(_,i)=>i/64*.6);tf.push(.9);const angles=tf.map(t=>-.32*Math.min(1,t/.6));
  fin.push(rotation(`os_cuisse_${n}_${cote}`,tf,angles.map(a=>[a,0,0])),rotation(`os_mollet_${n}_${cote}`,tf,angles.map(a=>[-a*2,0,0])),rotation(`os_pied_${n}_${cote}`,tf,angles.map(a=>[a,0,0])));
  if(!(n==='porteuse'&&cote==='gauche'))fin.push(rotation(`os_bras_${n}_${cote}`,[0,.6,.9],[[0,0,0],[.12,0,0],[.12,0,0]]));
 }
 tir.push(rotation(torse,[0,.13,.21,.40,.7],[[0,0,0],[0,0,0],[-.032,0,0],[.008,0,0],[0,0,0]]));
 touche.push(rotation(torse,[0,.10,.29,.5],[[0,0,0],[-.045,0,pIndex===0?-.018:.025],[.020,0,0],[0,0,0]]));
 capture.push(rotation(tete,[0,.32,.66,1.0,1.3],[[0,0,0],[.080,0,0],[.025,0,0],[.080,0,0],[0,0,0]]));
 const tf=Array.from({length:65},(_,i)=>i/64*.6);tf.push(.9);
 const descente=tf.map(t=>{const a=-.32*Math.min(1,t/.6);return [0,-(.216+p.dy)*(1-Math.cos(a))-.002*Math.sin(a),.002*Math.min(1,t/.6)] as V3;});
 fin.push(position(bassin,tf,descente),rotation(torse,[0,.6,.9],[[0,0,0],[.16,0,0],[.16,0,0]]),rotation(tete,[0,.6,.9],[[0,0,0],[.14,0,0],[.14,0,0]]));
}
const clips=[new T.AnimationClip('repos',2.4,repos),new T.AnimationClip('deplacement',1,marche),new T.AnimationClip('tir',.7,tir),new T.AnimationClip('touche',.5,touche),new T.AnimationClip('hors_jeu',.9,fin),new T.AnimationClip('capture',1.3,capture)];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>4000)throw new Error(`Budget ${triangles}: ${JSON.stringify(bilan)}`);
 const bornes=new T.Box3().setFromObject(racine);const {document,bin}=decouperGlb(await exporterGlb(racine,clips));
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas — binome meca original parametrique v1',extras:{source:'creation_originale',aucunMaillageImporte:true,haut:'+Y',avant:'+Z'}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const rapport={id,approbationArtistique:false,provenance:{type:'creation_originale_parametrique',sourcesExternes:[],geometrieAncienneImportee:false},triangles,budgetTriangles:4000,primitives:(document.meshes as {primitives:unknown[]}[]).reduce((n,m)=>n+m.primitives.length,0),octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:bornes.getSize(new T.Vector3()).toArray()},trianglesParEnsemble:bilan,os:noms,poids:'un os par pièce rigide ; membres articulés séparément',hauteurSocle:.018,personnages:profils,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),limites:['Aucun rendu ni contrôle visuel.','Articulations rigides aux pièces de vêtement, pas de déformation organique continue.','Pas de collision complète entre accessoires, ni de kit national certifié.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:rapport.bornes.dimensions,primitives:rapport.primitives,ensembles:bilan}));
}
void ecrire();
