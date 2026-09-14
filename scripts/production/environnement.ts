/** Candidats environnementaux procéduraux : silhouettes par fonction, variantes de climat et de territoire. */
import * as THREE from 'three';
import type { AssetSpec } from '../../src/assets/spec';
import { ecrireCandidat, type Morceau } from './commun';

function empreinte(s: string): number { let n=2166136261; for (const c of s) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
export function geometries(spec: AssetSpec, lod: number): Morceau[] {
  const pieces: Morceau[]=[];
  const graine=empreinte(spec.id), segments=lod===0?12:lod===1?8:5;
  const ajouter=(g:THREE.BufferGeometry,noeud:string,role:number,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);pieces.push({geometrie:g,noeud,role});};
  const boite=(n:string,r:number,x:number,y:number,z:number,w:number,h:number,d:number,ry=0)=>ajouter(new THREE.BoxGeometry(w,h,d),n,r,x,y,z,0,ry);
  const cyl=(n:string,r:number,x:number,y:number,z:number,bas:number,haut:number,h:number,seg=segments)=>ajouter(new THREE.CylinderGeometry(haut,bas,h,seg),n,r,x,y,z);
  const sphere=(n:string,r:number,x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=new THREE.IcosahedronGeometry(1,lod===0?1:0);g.scale(w,h,d);ajouter(g,n,r,x,y,z);};
  const branche=(a:THREE.Vector3,b:THREE.Vector3,rayon:number)=>{const g=new THREE.CylinderGeometry(rayon*.62,rayon,a.distanceTo(b),Math.max(4,segments-2));g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());pieces.push({geometrie:g,noeud:'tronc',role:7});};
  const toit=(x:number,y:number,z:number,w:number,h:number,d:number,plat:boolean)=>{if(plat){boite('toit',7,x,y,z,w,.045,d);return;}const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1});g.translate(x,y,z-d/2);pieces.push({geometrie:g,noeud:'toit',role:7});};
  if(spec.type==='terrain') {
    const cle=spec.cle; const h=spec.echelle.y.cible;
    if(cle==='montagne') {
      boite('sol',6,0,.035,0,1,.07,1);
      cyl('sol',6,0,.26,0,.46,.34,.46,8);
      cyl('sol',6,-.04,.64,-.03,.34,.29,.36,8);
      boite('sol',6,-.04,.84,-.03,.52,.09,.5);
      if(lod===0)for(let i=0;i<6;i++) sphere('sol',6,Math.cos(i)*.36,.1,Math.sin(i)*.36,.09,.08,.075);
    } else if(cle==='pont') {
      boite('sol',2,0,.07,0,.84,.14,1);
      boite('sol',7,0,.16,0,1,.045,1);
      for(const x of [-.46,.46]) {boite('sol',2,x,.28,0,.04,.04,1);for(const z of [-.43,0,.43])boite('sol',2,x,.23,z,.035,.15,.035);}
      if(lod<2)for(let i=0;i<9;i++)boite('sol',7,0,.19,-.44+i*.11,.89,.018,.085);
    } else boite('sol',6,0,h/2,0,1,h,1);
    return pieces;
  }
  if(spec.type==='decor') {
    const biome=spec.cle.split('_')[1]??'plaine';
    if(spec.cle.startsWith('rocher')) {
      if(biome==='volcanique') {
        for(const [x,z,h] of [[-.17,-.08,.4],[.14,.05,.31],[0,.23,.23]] as const)cyl('bloc',6,x,h/2,z,.18,.155,h,lod===2?5:6);
      } else if(biome==='desert') {
        cyl('bloc',6,0,.065,0,.4,.36,.13,lod===2?5:7);cyl('bloc',6,-.025,.18,.01,.35,.29,.12,lod===2?5:7);cyl('bloc',6,-.06,.28,.025,.28,.25,.08,lod===2?5:7);
      } else {
        sphere('bloc',6,0,.17,0,.42,.25,.38);
        if(lod<2){sphere('bloc',6,-.24,.08,.17,.18,.12,.2);sphere('bloc',6,.25,.07,-.18,.13,.11,.15);}
      }
      return pieces;
    }
    const palm=/palm|cocot|dattier/i.test(spec.description.fr);
    const conif=/sapin|épicéa|mélèze|conifère|pin sylvestre/i.test(spec.description.fr)||['neige','montagne'].includes(biome);
    const desert=biome==='desert';
    const inclinaison=(graine%7-3)*.017;
    branche(new THREE.Vector3(0,0,0),new THREE.Vector3(inclinaison,.66,0),.045);
    // Quatre touffes de cartes découpées, orientées dans l’espace : aucune silhouette en panneau unique.
    const cartesParTouffe=lod===0?24:lod===1?12:5;
    for(let touffe=0;touffe<4;touffe++) {
      const angle=touffe*Math.PI/2+(graine%13)*.03;
      const rayon=palm?.18:conif?.08:.16;
      const centre=new THREE.Vector3(inclinaison+Math.cos(angle)*rayon,conif?.3+touffe*.15:.61+(touffe%2)*.055,Math.sin(angle)*rayon);
      if(lod<2)branche(new THREE.Vector3(inclinaison,.34,0),centre,.018);
      for(let i=0;i<cartesParTouffe;i++) {
        const a=i*2.39996323, r=i<4?.16:.15*Math.sqrt((i+.5)/cartesParTouffe);
        const x=centre.x+Math.cos(a)*r,z=centre.z+Math.sin(a)*r;
        const y=centre.y+(desert?.035:.095)*Math.sin(a*1.7);
        const largeur=palm?.095:conif?.075:.12, longueur=palm?.32:conif?.18:.15;
        const g=new THREE.PlaneGeometry(largeur,longueur);
        g.rotateX(-Math.PI/2+(i%3-1)*.48);
        g.rotateY(palm?angle:a);
        g.rotateZ((i%5-2)*.13);
        g.translate(x,y,z);
        pieces.push({geometrie:g,noeud:'feuillage',role:4});
      }
    }
    return pieces;
  }
  const fonction=spec.cle.split('_')[0];
  const description=spec.description.fr;
  const tropical=/bambou|rotin|tropical|pilotis/i.test(description);
  const plat=/adobe|terrasse|béton|désert|Maroc/i.test(description)&&!tropical;
  const variation=(graine%5)*.025;
  boite('corps',6,0,.025,0,.94,.05,.94);
  const fenetres=(x:number,y:number,z:number,w:number,etages=1)=>{for(let j=0;j<etages;j++)for(let i=0;i<(lod===2?2:3);i++)boite('corps',3,x-w*.32+i*w*.32,y+j*.12,z,w*.17,.065,.018);};
  const pavillon=()=>{boite('enseigne',2,.37,.44,-.34,.025,.8,.025);boite('enseigne',0,.29,.78,-.34,.18,.1,.025);};
  if(fonction==='ville') {
    for(const [i,x,z,w,d] of ([[0,-.24,-.2,.32,.36],[1,.22,-.24,.32,.32],[2,-.26,.22,.28,.28]] as const)){
      const hauteur=.28+variation+(i===1?.12:0);boite('corps',6,x,.06+hauteur/2,z,w,hauteur,d);toit(x,.07+hauteur,z,w+.055,.14,d+.055,plat);fenetres(x,.16,z+d/2+.01,w,2);
      if(tropical)for(const dx of [-w*.35,w*.35])boite('corps',7,x+dx,.09,z+d*.36,.025,.14,.025);
    }
    boite('enseigne',0,.19,.25,.18,.32,.035,.22);for(const x of [.06,.31])boite('corps',7,x,.14,.25,.018,.22,.018);
    if(lod===0){for(const z of [-.03,.35]){boite('corps',7,.35,.075,z,.12,.055,.09);sphere('corps',4,.35,.13,z,.065,.065,.05);}}
  } else if(fonction==='qg') {
    boite('corps',6,0,.24,-.11,.6,.39,.53);boite('corps',6,-.29,.15,.14,.22,.22,.32);toit(0,.45,-.11,.66,.17,.59,plat);fenetres(0,.22,.16,.58,2);
    boite('enseigne',0,0,.39,.17,.63,.065,.04);boite('corps',6,0,.075,.32,.3,.05,.21);pavillon();
  } else if(fonction==='usine') {
    boite('corps',6,0,.22,-.13,.72,.34,.5);
    for(let i=0;i<3;i++)toit(-.25+i*.25,.39,-.13,.27,.13,.54,false);
    for(const x of [-.22,.05,.29])boite('corps',2,x,.18,.125,.18,.2,.025);
    cyl('corps',2,.33,.43,-.34,.055,.055,.66);boite('enseigne',0,-.12,.35,.14,.43,.055,.025);
    if(lod<2){for(const x of [-.27,.05])boite('corps',7,x,.09,.31,.17,.08,.13);}
  } else if(fonction==='aeroport') {
    cyl('corps',6,-.06,.065,.14,.35,.35,.045,segments*2);
    const ring=new THREE.TorusGeometry(.28,.018,4,segments*2);ajouter(ring,'enseigne',0,-.06,.092,.14,Math.PI/2);
    boite('corps',6,.23,.24,-.26,.31,.36,.25);boite('corps',3,.23,.32,-.119,.27,.11,.018);toit(.23,.43,-.26,.36,.06,.3,true);
    for(const x of [-.36,.36])for(const z of [-.36,.36])cyl('corps',3,x,.09,z,.025,.025,.06,6);
    boite('enseigne',2,-.35,.34,-.34,.024,.59,.024);boite('enseigne',0,-.27,.61,-.34,.16,.05,.045);
  } else if(fonction==='radar') {
    boite('corps',6,0,.18,0,.48,.28,.45);fenetres(0,.2,.23,.45);
    cyl('toit',2,0,.46,0,.08,.06,.28);
    const dish=new THREE.SphereGeometry(.25,segments,Math.max(3,segments/2),0,Math.PI*2,0,Math.PI*.47);dish.scale(1,.27,1);dish.rotateZ(.35);ajouter(dish,'toit',2,0,.61,0);
    boite('enseigne',0,0,.29,.24,.44,.055,.028);boite('corps',2,.34,.2,-.2,.1,.29,.14);
  } else if(fonction==='port') {
    boite('corps',7,-.24,.09,.06,.38,.08,.79);for(const z of [-.28,.28])cyl('corps',7,-.36,.16,z,.035,.035,.25);
    boite('corps',6,.18,.19,-.23,.38,.28,.35);toit(.18,.35,-.23,.44,.13,.41,plat);fenetres(.18,.23,-.04,.35);
    boite('corps',2,.31,.36,.2,.06,.59,.06);boite('toit',2,.12,.64,.2,.43,.055,.055);boite('toit',2,-.06,.47,.2,.022,.31,.022);
    boite('enseigne',0,.2,.29,-.04,.33,.06,.024);
    if(lod<2)for(let i=0;i<3;i++)boite('corps',7,.14,.095,.06+i*.11,.18,.08,.08);
  }
  // Détails des bases communes : architecture lisible à la case, sans signes nationaux.
  if(spec.id.endsWith('_base') && lod===0 && fonction!=='qg') {
    if(fonction==='ville') {
      for(const [x,z,w,d,h] of [[-.24,-.2,.32,.36,.28+variation],[.22,-.24,.32,.32,.40+variation],[-.26,.22,.28,.28,.28+variation]]) {
        boite('corps',7,x!,.15,z!+d!/2+.015,.07,.16,.025);
        for(const dx of [-1,1])boite('corps',6,x!+dx*w!*.42,.06+h!/2,z!+d!/2+.025,.025,h!, .035);
        for(const dz of [-1,1])boite('toit',0,x!,.07+h!,z!+dz*(d!+.055)/2,w!+.055,.02,.025);
        for(let k=0;k<6;k++)boite('toit',2,x!-w!/2+k*w!/5,.09+h!,z!,.008,.012,d!);
      }
      for(const z of [.27,.31,.35])boite('corps',7,.08,.08,z,.20,.025,.023);
      boite('corps',2,.08,.11,.36,.20,.04,.016);
      for(const x of [-.01,.17])boite('corps',2,x,.055,.31,.018,.07,.10);
      for(const x of [-.36,.38]) {boite('corps',2,x,.18,.37,.025,.28,.025);boite('corps',3,x,.33,.37,.065,.07,.065);}
    } else if(fonction==='usine') {
      // Portique, palan court, rideaux nervurés, vitrages des sheds et roues de rechange.
      for(const x of [-.31,.24])boite('corps',2,x,.26,.30,.035,.44,.035);
      boite('corps',0,-.035,.49,.30,.61,.05,.06);
      boite('corps',2,.08,.41,.30,.05,.10,.05);
      for(const x of [-.22,.05,.29])for(let k=0;k<7;k++)boite('corps',0,x,.10+k*.025,.145,.18,.012,.012);
      for(let i=0;i<3;i++) {boite('toit',3,-.25+i*.25,.445,-.13,.19,.025,.43);for(const z of [-.31,-.13,.05])boite('toit',2,-.25+i*.25,.46,z,.21,.014,.012);}
      for(let i=0;i<3;i++){const g=new THREE.TorusGeometry(.038,.014,6,14);ajouter(g,'corps',1,-.28+i*.09,.12,.40);}
      for(let i=0;i<4;i++)boite('corps',7,-.19,.07,.34+i*.025,.31,.025,.018);
    } else if(fonction==='port') {
      for(let i=0;i<14;i++)boite('corps',7,-.24,.14,-.32+i*.055,.36,.018,.035);
      for(const z of [-.28,.04,.34]) {cyl('corps',2,-.39,.20,z,.025,.025,.10,8);cyl('corps',2,-.39,.25,z,.04,.04,.018,8);}
      for(const x of [.05,.16,.27])for(let j=0;j<4;j++)boite('corps',0,x,.115+j*.025,.35,.085,.018,.13);
      for(const z of [.175,.225]) {boite('toit',2,.12,.68,z,.45,.025,.02);for(let i=0;i<4;i++)boite('toit',2,-.07+i*.12,.65,z,.012,.08,.012,.5);}
      boite('corps',3,.18,.27,-.04,.28,.055,.022);
    } else if(fonction==='aeroport') {
      for(const x of [.10,.20,.30]) {boite('corps',3,x,.33,-.10,.07,.11,.02);boite('corps',2,x+.04,.33,-.085,.013,.12,.015);}
      for(let i=0;i<12;i++) {const a=i*Math.PI/6;cyl('corps',3,-.06+Math.cos(a)*.32,.107,.14+Math.sin(a)*.32,.014,.014,.025,8);}
      for(const x of [.07,.39])boite('toit',0,x,.455,-.26,.025,.03,.32);
      boite('corps',0,.23,.19,-.10,.16,.035,.035);
      for(const z of [-.37,-.31,-.25,-.19])boite('toit',2,.23,.477,z,.22,.025,.025);
    } else if(fonction==='radar') {
      for(const x of [-.15,0,.15])boite('corps',3,x,.23,.24,.105,.07,.022);
      for(let i=0;i<7;i++)boite('corps',2,.397,.12+i*.028,-.2,.014,.012,.11);
      const ring=new THREE.TorusGeometry(.25,.012,5,24);ajouter(ring,'toit',2,0,.61,0,Math.PI/2,0,.35);
      for(const z of [-.16,.16])boite('toit',0,0,.335,z,.48,.025,.025);
      for(const x of [-.20,.20])boite('corps',2,x,.10,.29,.026,.12,.026);
      boite('corps',7,0,.065,.32,.43,.035,.18);
    }
  }
  // Every contractual node carries geometry, including a blank team-colour sign on civic buildings.
  if(!pieces.some(p=>p.noeud==='enseigne'))boite('enseigne',0,.24,.16,.34,.18,.09,.02);
  return pieces;
}

export async function genererEnvironnement(spec: AssetSpec, sortie: string) {
  if(!['terrain','batiment','decor'].includes(spec.type))throw new Error(`Famille non environnementale : ${spec.id}`);
  const d=spec.description.fr;
  const vert: [number,number,number]=/desert|désert/.test(d)?[116,128,58]:/neige/.test(d)?[65,100,82]:[62,119,65];
  const sol: [number,number,number]=spec.cle==='mer'||spec.cle==='riviere'?[43,112,126]:spec.cle==='plage'?[183,163,111]:spec.cle==='route'?[91,96,96]:spec.cle==='foret'?[93,76,52]:spec.cle==='montagne'?[124,128,125]:spec.type==='decor'&&spec.cle.startsWith('rocher')?[133,135,126]:spec.type==='batiment'?(/basalte|volcan/i.test(d)?[110,116,117]:/brique/i.test(d)?[165,111,83]:/adobe|Maroc/.test(d)?[188,159,115]:[188,190,177]):[85,125,58];
  return ecrireCandidat(spec,sortie,lod=>geometries(spec,lod),{terrain:spec.type==='terrain',feuillageAlpha:spec.type==='decor'&&spec.cle.startsWith('arbre'),emissionVitrage:spec.type==='batiment',palette:[[148,148,148],[51,57,54],[139,153,157],[70,120,141],vert,[187,158,126],sol,[127,87,55]]});
}
