/** Dix bustes d’archétypes fictifs, sculptés par volumes et profils distincts. Candidats uniquement. */
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { genererSpecs } from '../../src/assets/catalogue';
import type { AssetSpec } from '../../src/assets/spec';
import { ecrireCandidat, type Morceau } from './commun';

type V=[number,number,number];
interface Profil { age:number; largeur:number; machoire:number; longueur:number; nez:number; asymetrie:number; cheveux:V; peau:V; coiffure:'raie'|'queue'|'degarni'|'court'|'boucles'|'banane'|'tresse'|'bonnet'|'meche'|'chignon'; epaules:number; inclinaison:number }
export const PROFILS_COMMANDANTS:Record<string,Profil>={
 stratege_prudent:{age:54,largeur:.089,machoire:.073,longueur:.282,nez:.036,asymetrie:.003,cheveux:[110,105,100],peau:[184,145,116],coiffure:'raie',epaules:.21,inclinaison:0},
 fonceuse:{age:29,largeur:.082,machoire:.058,longueur:.256,nez:.025,asymetrie:-.004,cheveux:[57,40,31],peau:[180,124,93],coiffure:'queue',epaules:.19,inclinaison:.1},
 veteran:{age:63,largeur:.103,machoire:.09,longueur:.264,nez:.039,asymetrie:.005,cheveux:[153,151,143],peau:[190,149,118],coiffure:'degarni',epaules:.25,inclinaison:.06},
 ingenieur:{age:42,largeur:.09,machoire:.071,longueur:.273,nez:.034,asymetrie:-.003,cheveux:[45,41,38],peau:[148,104,79],coiffure:'court',epaules:.2,inclinaison:.055},
 diplomate:{age:47,largeur:.087,machoire:.063,longueur:.253,nez:.027,asymetrie:.0035,cheveux:[62,40,32],peau:[202,159,125],coiffure:'boucles',epaules:.2,inclinaison:-.025},
 showman:{age:36,largeur:.092,machoire:.076,longueur:.258,nez:.029,asymetrie:-.005,cheveux:[36,29,27],peau:[136,95,72],coiffure:'banane',epaules:.24,inclinaison:-.055},
 survivante:{age:39,largeur:.079,machoire:.056,longueur:.279,nez:.03,asymetrie:.0025,cheveux:[76,54,36],peau:[169,119,85],coiffure:'tresse',epaules:.19,inclinaison:-.03},
 meteorologue:{age:51,largeur:.088,machoire:.07,longueur:.271,nez:.037,asymetrie:-.004,cheveux:[93,91,85],peau:[195,154,121],coiffure:'bonnet',epaules:.21,inclinaison:-.08},
 prodige:{age:20,largeur:.083,machoire:.059,longueur:.244,nez:.023,asymetrie:.002,cheveux:[40,33,30],peau:[179,132,99],coiffure:'meche',epaules:.19,inclinaison:.025},
 gardienne:{age:45,largeur:.096,machoire:.081,longueur:.262,nez:.031,asymetrie:-.003,cheveux:[61,53,45],peau:[145,104,81],coiffure:'chignon',epaules:.245,inclinaison:0},
};

/** Tête fermée à sections : menton, angle mandibulaire, pommettes, tempes et voûte. */
function visage(p:Profil,segments:number):THREE.BufferGeometry {
 const niveaux=[[0,.32,.5],[.07,.65,.67],[.19,p.machoire/p.largeur,.8],[.36,.96,.95],[.52,1,.91],[.65,.95,.87],[.79,.94,.83],[.91,.72,.61],[1,.25,.24]];
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let j=0;j<niveaux.length;j++){
  const [h,w,d]=niveaux[j]!;
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2,x=Math.sin(a)*w!*p.largeur;
   // Dissymétrie discrète : joue gauche plus haute, menton décalé, jamais caricature.
   positions.push(x+p.asymetrie*(1-h!)*.55,.584+h!*p.longueur+p.asymetrie*Math.sin(a)*Math.sin(Math.PI*h!),Math.cos(a)*d!*.074+.003*Math.sin(a));
   uv.push(i/segments,h!);
   if(j<niveaux.length-1&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
 }
 for(const haut of [false,true]){
  const centre=positions.length/3;positions.push(0,.584+(haut?p.longueur+.004:-.005),0);uv.push(.5,haut?1:0);
  const premier=haut?(niveaux.length-1)*(segments+1):0;
  for(let i=0;i<segments;i++)indices.push(...(haut?[centre,premier+i,premier+i+1]:[centre,premier+i+1,premier+i]));
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function geometriesCommandant(spec:AssetSpec,lod:number):Morceau[]{
 const p=PROFILS_COMMANDANTS[spec.cle];if(!p)throw new Error(`Archétype sans sculpture : ${spec.cle}`);
 const out:Morceau[]=[],n=lod===0?18:lod===1?12:8;
 const ajoute=(g:THREE.BufferGeometry,noeud:string,role:number)=>{out.push({geometrie:g,noeud,role});};
 const boule=(noeud:string,role:number,c:V,taille:V)=>{const g=new THREE.SphereGeometry(1,n,Math.max(6,n/2));g.scale(...taille);g.translate(...c);ajoute(g,noeud,role);};
 const boite=(noeud:string,role:number,c:V,taille:V)=>{const g=new THREE.BoxGeometry(...taille);g.translate(...c);ajoute(g,noeud,role);};
 const liaison=(noeud:string,role:number,a:V,b:V,r:number,r2=r)=>{const debut=new THREE.Vector3(...a),fin=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r2,r,debut.distanceTo(fin),n);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),fin.clone().sub(debut).normalize()));g.translate(...debut.add(fin).multiplyScalar(.5).toArray());ajoute(g,noeud,role);};
 const courbe=(noeud:string,role:number,pts:V[],r:number)=>{const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),Math.max(5,n/2),r,5,false);ajoute(g,noeud,role);};
 // Le premier volume fixe le pivot de respiration ; la tête pivote sur le cou.
 const buste=new THREE.LatheGeometry([new THREE.Vector2(.155,0),new THREE.Vector2(.165,.12),new THREE.Vector2(.18,.3),new THREE.Vector2(p.epaules,.43),new THREE.Vector2(.16,.49),new THREE.Vector2(.079,.525)],n*2);buste.scale(1,1,.55);ajoute(buste,'buste',0);
 for(const [rayon,y,angle]of [[.155,0,Math.PI/2],[.079,.525,-Math.PI/2]]){const g=new THREE.CircleGeometry(rayon!,n*2);g.scale(1,.55,1);g.rotateX(angle!);g.translate(0,y!,0);ajoute(g,'buste',0);}
 liaison('tete',5,[0,.515,0],[0,.625,0],.041,.039);
 ajoute(visage(p,n*2),'tete',5);
 const yeux=.584+p.longueur*.57,front=.584+p.longueur*.76;
 for(const cote of [-1,1]){
  const x=cote*p.largeur*.46,y=yeux+(cote<0?p.asymetrie:0);
  boule('tete',5,[cote*p.largeur,.584+p.longueur*.45,-.005],[.019,.039,.019]);
  boule('tete',5,[cote*p.largeur*1.035,.584+p.longueur*.45,.009],[.008,.023,.011]);
  // Sclérotique et iris ne prennent jamais la couleur d’équipe.
  boule('tete',3,[x,y,.064],[.021,.01,.011]);
  boule('tete',1,[x+.002,y,.074],[.006,.0065,.003]);
  courbe('tete',5,[[x-.021,y+.001,.071],[x,y+.011,.074],[x+.021,y+.001,.071]],.003);
  courbe('tete',7,[[x-.023,y+.022,.066],[x,y+.027+(cote<0?.002:0),.073],[x+.023,y+.02,.067]],.0038);
  if(p.age>38){courbe('tete',5,[[x-.019,y-.018,.061],[x,y-.022,.068],[x+.018,y-.017,.059]],.0018);}
 }
 // Nez : arête, ailes et pointe avec une base distincte selon le profil.
 liaison('tete',5,[p.asymetrie*.4,yeux+.01,.069],[p.asymetrie,yeux-.041,.08+p.nez],.008,.014);
 boule('tete',5,[p.asymetrie,yeux-.04,.08+p.nez],[.015,.012,.014]);
 for(const cote of [-1,1])boule('tete',5,[p.asymetrie+cote*.014,yeux-.047,.08+p.nez*.65],[.009,.007,.011]);
 const bouche=yeux-.077,sourire=spec.cle==='diplomate'||spec.cle==='showman'?.007:.001;
 courbe('tete',6,[[-.03,bouche+sourire,.064],[p.asymetrie*.5,bouche,.076],[.028,bouche+sourire+p.asymetrie,.066]],.0025);
 courbe('tete',5,[[-.025,bouche-.006+sourire,.066],[.002,bouche-.009,.075],[.024,bouche-.005+sourire,.067]],.0035);
 if(p.age>=45&&lod<2)for(let j=0;j<(p.age>=60?3:2);j++)courbe('tete',5,[[-.05,front+j*.013,.057],[0,front+.004+j*.013,.063],[.047,front+j*.013,.057]],.0014);
 // Coiffures sculptées : absence volontaire d’un volume sphérique identique sur les dix visages.
 const sommet=.584+p.longueur;
 if(p.coiffure==='degarni'){
  for(const cote of [-1,1])boule('tete',7,[cote*p.largeur*.8,sommet-.064,-.033],[.025,.067,.045]);
  boule('tete',7,[.002,.621,.045],[p.largeur*.77,.047,.04]);
 }else if(p.coiffure==='bonnet'){
  const g=new THREE.SphereGeometry(1,n,8,0,Math.PI*2,0,Math.PI*.55);g.scale(p.largeur*1.09,.10,.089);g.translate(0,sommet-.064,-.009);ajoute(g,'tete',4);
  const g2=new THREE.TorusGeometry(p.largeur,.011,6,n*2);g2.rotateX(Math.PI/2);g2.scale(1,1,.9);g2.translate(0,sommet-.065,-.01);ajoute(g2,'tete',4);
 }else{
  const g=new THREE.SphereGeometry(1,n,8,0,Math.PI*2,0,Math.PI*.56);g.scale(p.largeur*1.04,.085,.082);g.rotateZ(p.asymetrie*9);g.translate(0,sommet-.06,-.007);ajoute(g,'tete',7);
  if(['queue','chignon','tresse'].includes(p.coiffure)){
   boule('tete',7,[.018,sommet-.086,-.084],[.042,.042,.045]);
   if(p.coiffure!=='chignon')for(let j=0;j<4;j++)boule('tete',7,[.021+Math.sin(j)*.005,sommet-.12-j*.03,-.091-j*.006],[.025-j*.003,.027,.022]);
  }
  if(p.coiffure==='boucles')for(let j=0;j<8;j++){const a=j/8*Math.PI*2;boule('tete',7,[Math.cos(a)*p.largeur*.8,sommet-.054+(j%2)*.017,Math.sin(a)*.065],[.031,.04,.028]);}
  if(p.coiffure==='banane'||p.coiffure==='meche'||p.coiffure==='raie')for(let j=0;j<4;j++)courbe('tete',7,[[-p.largeur*.8+j*.015,sommet-.065,.036],[-.015+j*.017,sommet+.01-(p.coiffure==='raie'?.018:0),.025],[p.largeur*.7,sommet-.08,.018]],p.coiffure==='meche'?.016:.011);
 }
 // Col et fermeture : seules la veste et ses manches occupent la bande d’équipe.
 for(const cote of [-1,1])boite('buste',0,[cote*.055,.512,.05],[.055,.065,.034]);
 if(spec.cle==='stratege_prudent'){for(let j=0;j<5;j++)boule('buste',1,[0,.12+j*.068,.105],[.006,.006,.004]);}
 else liaison('buste',2,[.002,.045,.098],[.002,.455,.101],.003);
 if(spec.cle==='fonceuse'){boite('buste',4,[0,.365,.109],[.13,.25,.018]);for(const cote of [-1,1])courbe('buste',0,[[cote*.038,.495,.12],[cote*.091,.405,.123],[cote*.064,.258,.12]],.012);}

 const croises=['veteran','gardienne'].includes(spec.cle),poches=['prodige','survivante'].includes(spec.cle);
 for(const cote of [-1,1]){
  const epaule:V=[cote*p.epaules*.87,.435,0];let coude:V=[cote*(p.epaules+.008),.29,.025],main:V=[cote*.17,.12,.057];
  if(croises){const bas=spec.cle==='gardienne'?.06:0;coude=[cote*.22,.28-bas,.08];main=[-cote*.1,.3-bas+(cote<0?.026:0),.16];}
  else if(poches){coude=[cote*.205,.26,.018];main=[cote*.062,.19,.12];}
  else if(spec.cle==='showman'){coude=[cote*.255,.34,.015];main=[cote*.3,.42,.055];}
  else if(spec.cle==='diplomate'&&cote===1){coude=[.225,.31,.035];main=[.23,.48,.09];}
  else if(spec.cle==='meteorologue'&&cote===1){coude=[.24,.53,.025];main=[.055,yeux+.045,.12];}
  else if(spec.cle==='ingenieur'){coude=[cote*.205,.245,.12];main=[cote*.1,.27,.2];}
  else if(spec.cle==='stratege_prudent'){coude=[cote*.185,.285,-.045];main=[cote*.045,.205,-.12];}
  else if(spec.cle==='fonceuse'){coude=[cote*.18,.29,cote*.08];main=[cote*.13,.36,cote*.16];}
  liaison('buste',0,epaule,coude,.052,.043);boule('buste',0,coude,[.046,.046,.046]);
  const manchesCourtes=['fonceuse','ingenieur'].includes(spec.cle);
  liaison('buste',manchesCourtes?5:0,coude,main,.036,.025);
  if(!poches)boule('buste',spec.cle==='fonceuse'&&cote<0?1:5,main,spec.cle==='meteorologue'&&cote===1?[.05,.015,.027]:[.029,.038,.022]);
  if(spec.cle==='veteran')boule('buste',4,[coude[0],coude[1],coude[2]+.039],[.032,.039,.009]);
  if((spec.cle==='diplomate'&&cote===1)||spec.cle==='showman'){
   for(let doigt=0;doigt<4;doigt++){const x=main[0]+(doigt-1.5)*.011;liaison('buste',5,[x,main[1]+.021,main[2]+.006],[x,main[1]+.057-Math.abs(doigt-1.5)*.006,main[2]+.004],.0055,.0045);}
   liaison('buste',5,[main[0]-.021,main[1],main[2]+.009],[main[0]-.04,main[1]+.021,main[2]+.01],.007,.005);
  }
  if(spec.cle==='showman')liaison('buste',2,[main[0],main[1]-.018,main[2]],[main[0],main[1]-.008,main[2]],.03);
 }
 if(poches)boite('buste',0,[0,.205,.101],[.21,.087,.025]);
 if(['prodige','survivante'].includes(spec.cle))boule('buste',0,[0,.49,-.065],[.11,.058,.042]);
 if(spec.cle==='veteran'||spec.cle==='gardienne'){
  for(let j=0;j<5;j++)courbe('buste',0,[[-.15,.1+j*.07,.078],[0,.105+j*.07,.104],[.15,.1+j*.07,.078]],.003);
  if(spec.cle==='veteran')liaison('buste',2,[.18,.02,.06],[.18,.13,.06],.022);
  else for(const x of [-.095,-.045])boule('buste',1,[x,.065,.11],[.026,.055,.016]);
 }
 // Les petits accessoires restent non marqués et sans surface de texte lisible.
 if(['stratege_prudent','showman'].includes(spec.cle)){
  for(const cote of [-1,1]){const g=new THREE.TorusGeometry(.022,.0032,5,16);g.scale(1,.65,1);g.translate(cote*.028,front+.03,.062);ajoute(g,'tete',2);}
  liaison('tete',2,[-.007,front+.03,.062],[.007,front+.03,.062],.0025);
 }
 if(spec.cle==='stratege_prudent')liaison('buste',7,[-.1,.355,.098],[-.1,.415,.098],.017);
 if(spec.cle==='ingenieur'){
  boite('buste',4,[0,.255,.109],[.24,.32,.022]);for(const x of [-.075,.065])liaison('buste',4,[x,.42,.09],[x,.53,.04],.014);
  for(let j=0;j<3;j++)boite('buste',2,[.055+j*.012,.33,.13],[.008,.08,.008]);
  courbe('buste',1,[[-.046,.51,.06],[-.061,.425,.127],[.061,.425,.127],[.046,.51,.06]],.003);
  for(const x of [-.026,.026])boite('buste',3,[x,.423,.133],[.042,.025,.009]);
 }
 if(spec.cle==='diplomate'){
  courbe('buste',4,[[-.06,.52,.04],[0,.478,.09],[.065,.53,.03]],.026);boite('buste',4,[-.03,.39,.118],[.05,.17,.018]);
  courbe('buste',1,[[-.055,.49,.08],[0,.35,.12],[.055,.49,.08]],.003);boite('buste',2,[0,.33,.12],[.035,.049,.008]);
 }
 if(spec.cle==='survivante'){courbe('buste',1,[[-.044,.52,.06],[0,.385,.12],[.044,.52,.06]],.003);boite('buste',2,[0,.375,.128],[.017,.032,.012]);}
 if(spec.cle==='prodige'){
  courbe('buste',1,[[-.073,.535,.025],[-.092,.49,.075],[0,.47,.103],[.092,.49,.075],[.073,.535,.025]],.009);
  for(const x of [-.077,.077])boule('buste',1,[x,.501,.076],[.028,.035,.017]);
 }
 if(spec.cle==='meteorologue'){
  liaison('buste',2,[-.18,.06,.064],[-.18,.145,.064],.013);boule('buste',2,[-.18,.155,.064],[.027,.025,.012]);
 }
 // Pose en trois-quarts, avec un léger déséquilibre propre au tempérament.
 for(const m of out){m.geometrie.rotateX(p.inclinaison);m.geometrie.rotateY(spec.cle==='diplomate'?.6:spec.cle==='showman'?-.45:.45);}
 return out;
}
export async function genererCommandant(spec:AssetSpec,sortie:string){
 const p=PROFILS_COMMANDANTS[spec.cle];if(!p)throw new Error(`Portrait absent : ${spec.cle}`);
 const r=await ecrireCandidat(spec,sortie,lod=>geometriesCommandant(spec,lod),{portrait:true,palette:[[150,150,150],[37,35,34],[136,145,148],[221,218,207],[111,105,84],p.peau,[132,78,68],p.cheveux]});
 if(r.ok&&!r.conserve)writeFileSync(path.join(sortie,'candidat-production.json'),JSON.stringify({id:spec.id,statut:'candidat_technique',validationArtistique:'non_effectuee',ageFictif:p.age,generateur:'scripts/production/commandants.ts',limites:['Sculpture procédurale par profils anatomiques : expression et finition doivent être relues humainement.','Aucune ressemblance avec une personne réelle recherchée ; ni identité nationale ni livrée dans le modèle partagé.'],rapport:r},null,2)+'\n');
 return r;
}
async function main(){const sortie=path.resolve(process.argv[2]??'assets/livraisons'),filtre=process.argv[3];mkdirSync(sortie,{recursive:true});const resultats=[];for(const s of genererSpecs().filter(s=>s.type==='commandant'&&(!filtre||s.id===filtre))){const r=await genererCommandant(s,path.join(sortie,s.id));resultats.push(r);console.log(JSON.stringify({id:r.id,ok:r.ok,motifs:r.motifs}));writeFileSync(path.join(sortie,'rapport-commandants.json'),JSON.stringify({statut:'candidats_non_valides_artistiquement',resultats},null,2)+'\n');}if(resultats.some(r=>!r.ok))process.exitCode=1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main().catch(e=>{console.error(e);process.exitCode=1;});
