/** Paramètres de la caméra libre ; les vues techniques conservent leurs axes. */
export interface Orbite { bearing:number; inclinaison:number; zoom:number }
export const ORBITE_INITIALE:Readonly<Orbite>={bearing:0,inclinaison:68,zoom:1};
export function reglerOrbite(v:Orbite,dx=0,dy=0,facteur=1):Orbite {
 return {bearing:((v.bearing+dx)%360+360)%360,inclinaison:Math.max(-80,Math.min(85,v.inclinaison+dy)),zoom:Math.max(.4,Math.min(3,v.zoom*facteur))};
}
