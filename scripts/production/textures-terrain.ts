/** Grain de matière uniquement : aucune lumière ou ombre directionnelle dans l’albédo. */
const borne=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
function bruit(x:number,y:number):number {let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function feuille(x:number,y:number):number {
  const cx=Math.floor(x/23),cy=Math.floor(y/23),r=bruit(cx,cy);
  const u=x-cx*23-6-r*10,v=y-cy*23-8-bruit(cy,cx)*7;
  return u*u/42+v*v/17<1&&r>.25?1:0;
}
function relief(cle:string,x:number,y:number,n:number):number {
  if(cle==='mer'||cle==='riviere')return Math.sin(x/n*Math.PI*32+y/n*Math.PI*16)*.8+Math.sin(y/n*Math.PI*48)*.35;
  if(cle==='foret')return feuille(x,y)*.5+bruit(Math.floor(x/2),Math.floor(y/2))*.12;
  if(cle==='pont')return Math.sin(x*.4+Math.sin(y*.08))* .16;
  if(cle==='herbe_haute'||cle==='plaine')return Math.sin(x*.7+y*.28)*.16+bruit(Math.floor(x/3),Math.floor(y/3))*.1;
  return bruit(Math.floor(x/3),Math.floor(y/3))*.18;
}
export function pixelTerrain(cle:string,canal:string,x:number,y:number,n:number,saison:string|undefined,rgb:number[]):number[] {
  if(x<3||y<3||x>=n-3||y>=n-3)return rgb;
  const grain=bruit(Math.floor(x/2),Math.floor(y/2));
  if(canal==='normale') {
    const dx=relief(cle,x+1,y,n)-relief(cle,x-1,y,n),dy=relief(cle,x,y+1,n)-relief(cle,x,y-1,n);
    return [borne(128-dx*12),borne(128-dy*12),255];
  }
  if(canal==='rugosite') {
    const valeur=cle==='mer'||cle==='riviere'?85:cle==='route'?194:cle==='pont'?188:215;
    return [255,borne(valeur+grain*12),0];
  }
  if(canal!=='albedo'||saison==='hiver')return rgb;
  if(cle==='mer'||cle==='riviere')return rgb; // Les rides sont portées par la normale, jamais par une fausse réflexion peinte.
  if(cle==='foret')return feuille(x,y)?[borne(131+grain*25),borne(98+grain*18),borne(47+grain*17)]:rgb;
  if(cle==='herbe_haute'||cle==='plaine') {
    const brin=(x+Math.floor(y/7)*3)%11<2;
    const trefle=bruit(Math.floor(x/19),Math.floor(y/19))>.96&&(x%19-9)**2+(y%19-9)**2<12;
    return trefle?[99,145,66]:brin?rgb.map((v,i)=>borne(v+(i===1?11:3))):rgb;
  }
  if(cle==='plage')return grain>.92?[198,182,142]:rgb.map(v=>borne(v+(grain-.5)*9));
  if(cle==='montagne')return grain>.83?[159,162,154]:rgb.map(v=>borne(v+(grain-.5)*11));
  if(cle==='route')return grain>.88?[115,116,109]:grain<.1?[78,80,79]:rgb;
  if(cle==='pont')return rgb.map((v,i)=>borne(v+Math.sin(y*.08+x*.3)*(i===2?2:5)));
  return rgb;
}
