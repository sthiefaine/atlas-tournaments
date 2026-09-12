/** Brins courbés, sans cartes alpha : la lumière suit les facettes du ruban. */
import * as T from 'three';
export const SOL_PLAINE=Math.fround(.020000001);
export function vegetationPlaine(lod:0|1):T.BufferGeometry{
  const positions:number[]=[],couleurs:number[]=[],uv:number[]=[];
  let graine=521904;
  const hasard=()=>{graine=(Math.imul(graine,1664525)+1013904223)>>>0;return graine/4294967296;};
  const pigments=['#79a351','#86ad5f','#70934b','#94b56d','#769d59'].map(c=>new T.Color(c));
  function triangle(points:number[][],couleur:T.Color){for(const p of points){positions.push(...p);couleurs.push(couleur.r,couleur.g,couleur.b);uv.push(p[0]!+.5,.5-p[2]!);}}
  for(let i=0;i<360;i++){
    // Semis stratifié : pas de grosses rosettes répétées ni d'anneau autour des unités.
    const x=((i%20)+.22+hasard()*.56)/20-.5,z=(Math.floor(i/20)+.22+hasard()*.56)/18-.5;
    const a=hasard()*Math.PI*2,h=i===0?.12:.06+hasard()*.06,w=.012+hasard()*.011,courbe=.025+hasard()*.03;
    const teinte=pigments[Math.floor(hasard()*pigments.length)]!;
    if(lod===1&&i%5!==0)continue;
    const points=[[-w/2,0,0],[w/2,0,0],[-w*.4,h*.38,courbe*.12],[w*.4,h*.38,courbe*.12],[-w*.22,h*.76,courbe*.48],[w*.22,h*.76,courbe*.48],[0,h,courbe]];
    const monde=points.map(([px,py,pz])=>[Math.max(-.498,Math.min(.498,x+px!*Math.cos(a)-pz!*Math.sin(a))),SOL_PLAINE+py!,Math.max(-.498,Math.min(.498,z+px!*Math.sin(a)+pz!*Math.cos(a)))]);
    for(const ids of [[0,1,2],[1,3,2],[2,3,4],[3,5,4],[4,5,6]])triangle(ids.map(n=>monde[n]!),teinte);
  }
  // Douze minuscules trèfles : feuilles inclinées, aucune grosse fleur qui marque chaque répétition.
  for(let i=0;i<12;i++){
    const x=(hasard()-.5)*.82,z=(hasard()-.5)*.82,a=hasard()*Math.PI*2;
    if(lod===1&&i%3!==0)continue;
    for(let n=0;n<3;n++){
      const angle=a+n*Math.PI*2/3,dx=Math.cos(angle),dz=Math.sin(angle),y=SOL_PLAINE+.006;
      const points=[[x,y,z],[x+dx*.012-dz*.009,y+.004,z+dz*.012+dx*.009],[x+dx*.026,y+.007,z+dz*.026],[x+dx*.012+dz*.009,y+.004,z+dz*.012-dx*.009]];
      triangle([points[0]!,points[1]!,points[2]!],pigments[2]!);triangle([points[0]!,points[2]!,points[3]!],pigments[2]!);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(couleurs,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
