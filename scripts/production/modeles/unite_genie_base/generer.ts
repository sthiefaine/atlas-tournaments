/** Binôme original de génie : volumes et rig propres, aucun maillage importé. */
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { exporterGlb, decouperGlb, assemblerGlb, dedoublonner, alleger } from './gltf';
type V3=[number,number,number];
type Piece={g:T.BufferGeometry;role:number;os:string;etiquette:string};
const id='unite_genie_base',sortie=path.resolve(process.argv[2]??`tmp/production-sequentielle/${id}`);
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
// Socle ovale fixe : emprise centrée, dessus à 18 mm, aucune racine animée.
const plateau=new T.CylinderGeometry(1,1,.014,28);plateau.scale(.225,1,.217);piece(plateau,2,'base','plateau_ovale',[0,.007,0]);
const liseret=new T.CylinderGeometry(1,1,.004,28);liseret.scale(.221,1,.213);piece(liseret,0,'base','liseret_equipe',[0,.016,0]);
const profils=[{nom:'technicien',x:-.103,z:-.026,dy:.008,peau:8,cheveux:10},{nom:'technicienne',x:.103,z:.026,dy:0,peau:9,cheveux:11}];
for(const p of profils){
 const {nom,x,z,dy,peau,cheveux}=p;
 const pos=(a:number,b:number,c:number):V3=>[x+a,b+dy,z+c];
 articulation(`os_bassin_${nom}`,null,pos(0,.274,0));articulation(`os_torse_${nom}`,`os_bassin_${nom}`,pos(0,.317,0));articulation(`os_tete_${nom}`,`os_torse_${nom}`,pos(0,.464,0));
 const bassin=`os_bassin_${nom}`,torse=`os_torse_${nom}`,tete=`os_tete_${nom}`;
 volume(bassin,[{y:-.032,x:.085,z:.062},{y:.022,x:.094,z:.068}],pos(0,.276,0),1,'pantalons_taille');
 // Deux silhouettes distinctes par largeur d'épaules, taille, visage, coiffure et outils.
 const largeur=nom==='technicienne'?.104:.114;
 volume(torse,[{y:0,x:.085,z:.064},{y:.063,x:largeur,z:.078},{y:.109,x:largeur+.005,z:.075},{y:.130,x:.066,z:.055}],pos(0,.312,0),13,'vestes_tissu_equipe');
 boite(torse,[.088,.024,.071],pos(0,.322,.002),2,'ceintures');
 for(const s of [-1,1])boite(torse,[.020,.110,.012],pos(s*.031,.383,.043),1,'bretelles_portage');
 coffre(torse,[.047,.043,.026],pos(.044,.344,.042),12,'poche_outils',.004);
 cylindre(tete,.019,.037,pos(0,.458,0),peau,'cous',8);
 ellipsoide(tete,[nom==='technicienne'?.038:.040,.053,.038],pos(0,.506,.006),peau,'visages',10,7);
 // Chevelure arrière mate, face dégagée ; la technicienne a un chignon sous casque.
 ellipsoide(tete,[.041,.045,.023],pos(0,.516,-.016),cheveux,'chevelures',8,4);
 if(nom==='technicienne')ellipsoide(tete,[.023,.023,.025],pos(0,.486,-.048),cheveux,'chignon',8,4);
 // Coque du casque demi-sphère + bord protecteur épais, sans visière sur le visage.
 const casque=new T.SphereGeometry(1,12,4,0,Math.PI*2,0,Math.PI/2);casque.scale(.049,.039,.046);piece(casque,0,tete,'casques',pos(0,.537,0));
 cylindre(tete,.049,.009,pos(0,.538,0),1,'bords_casques',12,.049);
 boite(tete,[.034,.006,.021],pos(0,.539,.049),0,'visieres_casques');
 // Petites pièces faciales, sans texte ni visage réel.
 for(const s of [-1,1])boite(tete,[.006,.004,.003],pos(s*.014,.510,.043),11,'yeux');
 boite(tete,[.009,.013,.010],pos(0,.499,.044),peau,'nez');
 boite(tete,[.016,.003,.003],pos(0,.485,.040),peau,'levres');
 for(const [j,s] of [-1,1].entries()){
  const cote=j===0?'gauche':'droite',hanche=`os_cuisse_${nom}_${cote}`,genou=`os_mollet_${nom}_${cote}`,pied=`os_pied_${nom}_${cote}`;
  const xx=s*.026;
  articulation(hanche,bassin,pos(xx,.267,0));articulation(genou,hanche,pos(xx,.153,.002));articulation(pied,genou,pos(xx,.051-dy,.006));
  segment(hanche,pos(xx,.257,0),pos(xx,.166,.002),.026,.029,1,'jambes_haut');
  ellipsoide(genou,[.026,.026,.026],pos(xx,.154,.002),1,'articulations_genoux',8,4);
  segment(genou,pos(xx,.141,.002),pos(xx,.070-dy,.006),.025,.021,1,'jambes_bas');
  coffre(genou,[.034,.040,.018],pos(xx,.149,.026),12,'genouilleres',.003);
  coffre(pied,[.049,.043,.086],pos(xx,.0395-dy,.024),2,'bottes',.007);
  boite(pied,[.048,.012,.085],pos(xx,.024-dy,.024),2,'semelles');
  const bras=`os_bras_${nom}_${cote}`,avant=`os_avant_bras_${nom}_${cote}`;
  const epaule=pos(s*.067,.423,0),coude=pos(s*.074,.361,.015),main=pos(s*.070,.327,.063);
  articulation(bras,torse,epaule);articulation(avant,bras,coude);
  ellipsoide(bras,[.030,.034,.032],epaule,13,'epaules_vestes',8,4);
  segment(bras,epaule,coude,.024,.025,13,'manches_haut');
  segment(avant,coude,main,.020,.024,1,'manches_bas');
  ellipsoide(avant,[.024,.019,.024],main,2,'gants',8,4);
 }
}
// Capsule dorsale du technicien : un scanner de chantier, large mais porté par harnais.
const homme='os_torse_technicien',femme='os_torse_technicienne';
coffre(homme,[.118,.145,.078],[-.103,.405,-.092],0,'capsule_scanner',.018);
coffre(homme,[.080,.075,.014],[-.103,.407,-.138],5,'trappe_service_capsule',.006);
for(const s of [-1,1])boite(homme,[.018,.106,.013],[-.103+s*.043,.408,-.141],3,'rails_capsule');
boite(homme,[.026,.022,.064],[-.103,.477,-.129],3,'support_radar_capsule');
// Le mât, le pied orientable et la petite parabole ont des sections robustes.
cylindre(homme,.012,.083,[-.103,.502,-.149],3,'mat_radar',8);
articulation('module_radar',homme,[-.103,.545,-.149]);
cylindre('module_radar',.020,.024,[-.103,.552,-.149],3,'pivot_radar',10);
// Parabole avec deux parois et rebord : axe initial dirigé +Z, inclinaison montante.
const radars=new T.LatheGeometry([new T.Vector2(0,-.014),new T.Vector2(.022,-.010),new T.Vector2(.048,.002),new T.Vector2(.050,.009),new T.Vector2(.045,.013),new T.Vector2(.020,.001),new T.Vector2(0,-.002)],12);
radars.rotateX(Math.PI/2-.35);piece(radars,5,'module_radar','parabole_radar',[-.103,.567,-.143]);
// Mallette de diagnostic tenue par la technicienne, sans arme ni pièce effilée.
coffre('os_avant_bras_technicienne_gauche',[.089,.037,.070],[.067,.337,.136],5,'tablette_diagnostic',.006);
boite('os_avant_bras_technicienne_gauche',[.064,.005,.045],[.067,.359,.136],4,'ecran_sans_texte');
// Marqueur compact tenu à droite du technicien : courte cassette à nez large.
articulation('os_marqueur','os_avant_bras_technicien_droite',[-.033,.343,.086]);
coffre('os_marqueur',[.047,.038,.096],[-.033,.345,.108],5,'marqueur_court',.007);
cylindre('os_marqueur',.018,.023,[-.033,.345,.165],3,'bouche_marqueur',8,.018,[Math.PI/2,0,0]);
cylindre('os_marqueur',.011,.002,[-.033,.345,.178],2,'insert_bouche_marqueur',8,.011,[Math.PI/2,0,0]);
// Maillet de montage et outil à mâchoires massives, rangés latéralement.
segment(femme,[.161,.298,-.016],[.163,.396,-.025],.0105,.0105,12,'manche_maillet',6);
coffre(femme,[.057,.025,.034],[.163,.405,-.025],2,'tete_maillet',.003);
boite(homme,[.022,.085,.020],[-.164,.313,-.037],3,'cle_entretien');
boite(homme,[.046,.023,.024],[-.164,.351,-.037],3,'machoire_cle');
// Deux attaches de ceinture protègent les outils et font un vrai raccord au corps.
for(const [n,x,z] of [[femme,.156,-.020],[homme,-.156,-.036]] as const)boite(n,[.030,.025,.039],[x,.330,z],12,'attaches_outils');
const materiaux=[new T.MeshStandardMaterial({name:'mat_corps',metalness:1,roughness:1}),new T.MeshStandardMaterial({name:'mat_details',metalness:1,roughness:1})];
const noms=[...os.keys()];
function fusionner(ps:Piece[],skin:boolean){
 const groupes:T.BufferGeometry[]=[],mats:number[]=[];
 for(const mat of [0,1]){
  const gs=ps.filter(p=>([0,13].includes(p.role)?0:1)===mat).map(p=>{const g=p.g.index?p.g.toNonIndexed():p.g.clone();if(skin){const n=g.getAttribute('position').count,joints=new Uint16Array(n*4),poids=new Float32Array(n*4);for(let i=0;i<n;i++){joints[i*4]=noms.indexOf(p.os);poids[i*4]=1;}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(poids,4));}return g;});
  if(gs.length){const g=mergeVertices(mergeGeometries(gs,false)!,1e-7);g.computeTangents();groupes.push(g);mats.push(mat);}
 }
 const g=mergeGeometries(groupes,true)!;g.groups.forEach((gr,i)=>gr.materialIndex=mats[i]!);return g;
}
const corps=new T.SkinnedMesh(fusionner(pieces,true),materiaux);corps.name='corps';racine.add(corps);
const base=new T.Mesh(fusionner(basePieces,false),materiaux);base.name='base';racine.add(base);
// Le témoin du scanner est escamoté dans hors_jeu ; le socle ovale demeure.
const socle=new T.Mesh(new T.BoxGeometry(.028,.013,.021),materiaux[1]);socle.name='socle';socle.position.set(0,.163,-.090);os.get(homme)!.add(socle);
const u=socle.geometry.getAttribute('uv');for(let i=0;i<u.count;i++)u.setXY(i,(3.07+u.getX(i)*.86)/4,(1.07+u.getY(i)*.86)/4);socle.geometry.computeTangents();bilan.temoin_disponibilite=12;
racine.updateMatrixWorld(true);corps.bind(new T.Skeleton([...os.values()]));
const poseInitiale=new Map<T.Object3D,{p:T.Vector3;q:T.Quaternion;s:T.Vector3}>();racine.traverse(o=>poseInitiale.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
const rotation=(nom:string,t:number[],v:V3[])=>new T.QuaternionKeyframeTrack(`${nom}.quaternion`,t,v.flatMap(v=>new T.Quaternion().setFromEuler(new T.Euler(...v)).toArray()));
const position=(nom:string,t:number[],v:V3[])=>new T.VectorKeyframeTrack(`${nom}.position`,t,v.flatMap(v=>{const p=poseInitiale.get(os.get(nom)!)!.p;return [p.x+v[0],p.y+v[1],p.z+v[2]];}));
function radar(d:number,tours:number,arret=false){const n=tours*16,t:number[]=[],q:number[]=[];for(let k=0;k<=n;k++){t.push(k/n*(arret?d*.60:d));q.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),k/n*Math.PI*2*tours).toArray());}q.splice(-4,4,0,0,0,1);if(arret){t.push(d);q.push(0,0,0,1);}return new T.QuaternionKeyframeTrack('module_radar.quaternion',t,q);}
const repos:T.KeyframeTrack[]=[radar(2.4,1)];
const marche:T.KeyframeTrack[]=[radar(1,1)];
const tir:T.KeyframeTrack[]=[radar(.7,1),position('os_marqueur',[0,.14,.22,.40,.7],[[0,0,0],[0,0,0],[0,0,-.019],[0,0,-.006],[0,0,0]])];
const touche:T.KeyframeTrack[]=[radar(.5,1)];
const fin:T.KeyframeTrack[]=[radar(.9,1,true),new T.VectorKeyframeTrack('socle.scale',[0,.25,.55,.9],[1,1,1,1,1,1,0,0,0,0,0,0])];
for(const [pIndex,p] of profils.entries()){
 const n=p.nom,torse=`os_torse_${n}`,tete=`os_tete_${n}`,bassin=`os_bassin_${n}`;
 repos.push(rotation(torse,[0,.6,1.2,1.8,2.4],[[0,0,0],[.012,0,.007],[0,0,0],[-.012,0,-.007],[0,0,0]]),rotation(tete,[0,1.2,2.4],[[0,0,0],[0,pIndex===0?.08:-.10,0],[0,0,0]]));
 // Marche en place résolue en deux segments : un pied porte, l'autre se lève.
 const t=Array.from({length:129},(_,i)=>i/128),fermer=(v:V3[])=>{v[v.length-1]=[...v[0]!] as V3;return v;};
 const bassinY=t.map(t=>-.012+.002*Math.sin(t*4*Math.PI));
 marche.push(position(bassin,t,fermer(bassinY.map(y=>[0,y,0]))),rotation(torse,t,fermer(t.map(t=>[.025,.022*Math.sin(2*Math.PI*t),0]))));
 for(const [j,cote] of ['gauche','droite'].entries()){
  const l1=Math.hypot(.114,.002),l2=Math.hypot(.102+p.dy,.004),alpha0=Math.atan2(-.002,.114),beta0=Math.atan2(-.004,.102+p.dy);
  const poses=t.map((t,i)=>{
   const phase=t*Math.PI*2+(j+pIndex)*Math.PI;
   const z=.006+.035*Math.sin(phase),levee=.023*Math.max(0,Math.cos(phase))**2;
   const d=.216+p.dy+bassinY[i]!-levee,rayon=Math.hypot(d,z),gamma=Math.atan2(-z,d);
   const a=gamma-Math.acos((l1*l1+rayon*rayon-l2*l2)/(2*l1*rayon))-alpha0;
   const total=gamma+Math.acos((l2*l2+rayon*rayon-l1*l1)/(2*l2*rayon))-beta0;
   return {a,k:total-a,cheville:-total};
  });
  marche.push(rotation(`os_cuisse_${n}_${cote}`,t,fermer(poses.map(v=>[v.a,0,0]))),rotation(`os_mollet_${n}_${cote}`,t,fermer(poses.map(v=>[v.k,0,0]))),rotation(`os_pied_${n}_${cote}`,t,fermer(poses.map(v=>[v.cheville,0,0]))),rotation(`os_bras_${n}_${cote}`,t,fermer(t.map(t=>[.065*Math.sin(t*Math.PI*2+(j+pIndex)*Math.PI),0,0]))));
  // Affaissement de tournoi : genoux devant, pieds horizontaux et socle fixe.
  const tf=Array.from({length:65},(_,i)=>i/64*.6);tf.push(.9);
  const angles=tf.map(t=>-.32*Math.min(1,t/.6));
  fin.push(rotation(`os_cuisse_${n}_${cote}`,tf,angles.map(a=>[a,0,0])),rotation(`os_mollet_${n}_${cote}`,tf,angles.map(a=>[-a*2,0,0])),rotation(`os_pied_${n}_${cote}`,tf,angles.map(a=>[a,0,0])),rotation(`os_bras_${n}_${cote}`,[0,.6,.9],[[0,0,0],[.13,0,0],[.13,0,0]]));
 }
 tir.push(rotation(torse,[0,.14,.22,.42,.7],[[0,0,0],[0,0,0],[-.038,0,0],[.009,0,0],[0,0,0]]));
 touche.push(rotation(torse,[0,.10,.29,.5],[[0,0,0],[-.055,0,pIndex===0?-.035:.035],[.023,0,0],[0,0,0]]));
 const tf=Array.from({length:65},(_,i)=>i/64*.6);tf.push(.9);
 const descente=tf.map(t=>{const a=-.32*Math.min(1,t/.6);return [0,-(.216+p.dy)*(1-Math.cos(a))-.002*Math.sin(a),.002*Math.min(1,t/.6)] as V3;});
 fin.push(position(bassin,tf,descente),rotation(torse,[0,.6,.9],[[0,0,0],[.18,0,0],[.18,0,0]]),rotation(tete,[0,.6,.9],[[0,0,0],[.16,0,0],[.16,0,0]]));
}
const clips=[new T.AnimationClip('repos',2.4,repos),new T.AnimationClip('deplacement',1,marche),new T.AnimationClip('tir',.7,tir),new T.AnimationClip('touche',.5,touche),new T.AnimationClip('hors_jeu',.9,fin)];
async function ecrire(){
 mkdirSync(sortie,{recursive:true});const triangles=Object.values(bilan).reduce((a,b)=>a+b,0);if(triangles>4000)throw new Error(`Budget ${triangles}: ${JSON.stringify(bilan)}`);
 const bornes=new T.Box3().setFromObject(racine);const {document,bin}=decouperGlb(await exporterGlb(racine,clips));
 const canaux=['albedo','normale','rugosite','metal','masque_equipe'];document.images=canaux.map(c=>({name:c,uri:`${id}_${c}.png`,mimeType:'image/png'}));document.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];document.textures=canaux.map((c,i)=>({name:c,source:i,sampler:0}));
 for(const m of document.materials as {pbrMetallicRoughness:Record<string,unknown>;normalTexture?:unknown}[]){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.65};}
 document.asset={version:'2.0',generator:'Atlas — binome genie original parametrique v1',extras:{source:'creation_originale',aucunMaillageImporte:true,haut:'+Y',avant:'+Z'}};
 const binaire=dedoublonner(document,bin);alleger(document);const octets=assemblerGlb(document,binaire);writeFileSync(path.join(sortie,`${id}_lod0.glb`),octets);
 const rapport={id,approbationArtistique:false,provenance:{type:'creation_originale_parametrique',sourcesExternes:[],geometrieAncienneImportee:false},triangles,budgetTriangles:4000,primitives:(document.meshes as {primitives:unknown[]}[]).reduce((n,m)=>n+m.primitives.length,0),octetsGlb:octets.length,sha256Glb:createHash('sha256').update(octets).digest('hex'),bornes:{min:bornes.min.toArray(),max:bornes.max.toArray(),dimensions:bornes.getSize(new T.Vector3()).toArray()},trianglesParEnsemble:bilan,os:noms,poids:'un os par pièce rigide ; membres articulés séparément',hauteurSocle:.018,personnages:profils,animations:clips.map(c=>({nom:c.name,duree:c.duration,pistes:c.tracks.map(t=>t.name)})),limites:['Aucun rendu ni contrôle visuel.','Articulations rigides aux pièces de vêtement, pas de déformation organique continue.','Pas de collision complète entre accessoires, ni de kit national certifié.']};
 writeFileSync(path.join(sortie,'fabrication.json'),JSON.stringify(rapport,null,2)+'\n');console.log(JSON.stringify({triangles,octets:octets.length,dimensions:rapport.bornes.dimensions,primitives:rapport.primitives}));
}
void ecrire();
