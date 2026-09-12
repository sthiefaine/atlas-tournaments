/** La couche végétale du GLB suit le champ d'altitude, sans remplacer le terrain continu. */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { alea, hauteurEn, type GrilleTerrain } from './geometrie';
export interface VegetationLivree { proche:THREE.BufferGeometry; base:number }
export function extraireVegetation(scene:THREE.Object3D):THREE.BufferGeometry|null{
  scene.updateMatrixWorld(true);const morceaux:THREE.BufferGeometry[]=[];
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const materiaux=Array.isArray(o.material)?o.material:[o.material];
    if(materiaux.length!==1||materiaux[0]?.name!=='mat_herbe')return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);morceaux.push(g);
  });
  if(!morceaux.length)return null;
  const fusion=mergeGeometries(morceaux,false);for(const g of morceaux)g.dispose();return fusion;
}
export function geometrieGazon(g:GrilleTerrain,source:VegetationLivree):THREE.BufferGeometry{
  const cases:{x:number;y:number}[]=[];
  for(let y=0;y<g.hauteur;y++)for(let x=0;x<g.largeur;x++)if(g.terrainDe(x,y)==='plaine')cases.push({x,y});
  // Un seul appel de dessin, toujours la géométrie LOD0.
  const lod=0;
  const originale=source.proche;
  const a=originale.getAttribute('position'),c=originale.getAttribute('color');
  const positions=new Float32Array(cases.length*a.count*3),couleurs=new Float32Array(positions.length);
  let n=0;
  for(const p of cases){
    const angle=Math.floor(alea(p.x,p.y,722)*4)*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle);
    const nuance=.94+alea(p.x,p.y,725)*.12;
    for(let i=0;i<a.count;i++){
      const x=p.x+.5+a.getX(i)*cos-a.getZ(i)*sin,z=p.y+.5+a.getX(i)*sin+a.getZ(i)*cos;
      positions[n]=x;positions[n+1]=hauteurEn(g,x,z)+a.getY(i)-source.base+.001;positions[n+2]=z;
      couleurs[n]=(c?.getX(i)??.4)*nuance;couleurs[n+1]=(c?.getY(i)??.6)*nuance;couleurs[n+2]=(c?.getZ(i)??.2)*nuance;n+=3;
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(couleurs,3));geo.computeVertexNormals();
  geo.userData={cases:cases.length,lod,triangles:positions.length/9};return geo;
}
