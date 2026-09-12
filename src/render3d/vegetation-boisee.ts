/** Feuillage en petits rameaux et feuilles pliées : volumes partagés, sans cartes alpha. */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { alea } from './geometrie';

type Rameau = readonly [number, number, number, number];
export function couronneFeuillue(rameaux: readonly Rameau[], graine=37): THREE.BufferGeometry {
  const positions:number[]=[], couleurs:number[]=[];
  for (let r=0;r<rameaux.length;r++) {
    const [x,y,z,rayon]=rameaux[r]!;
    // Chaque rameau porte des feuilles réparties en profondeur, et non une boule pleine.
    for(let i=0;i<28;i++) {
      const a=i*2.39996+alea(r,1,graine)*6.28;
      const v=(i+.5)/28, hauteur=(v-.5)*rayon*1.5;
      const distance=rayon*Math.sqrt(1-Math.pow(2*v-1,2))*(.55+alea(i,r,graine)*.45);
      const cx=x+Math.cos(a)*distance, cy=y+hauteur, cz=z+Math.sin(a)*distance;
      const longueur=rayon*(.35+alea(i,r,graine+1)*.22), largeur=longueur*.46;
      const verts=[[-longueur,0,0],[0,.004,largeur],[longueur,.009,0],[0,.004,-largeur],[0,.013,0]];
      const pigment=.72+alea(i,r,graine+2)*.28;
      for(const k of [0,1,4,1,2,4,2,3,4,3,0,4]) {
        const [px,py,pz]=verts[k]!;
        positions.push(cx+px!*Math.cos(a)-pz!*Math.sin(a),cy+py!,cz+px!*Math.sin(a)+pz!*Math.cos(a));
        couleurs.push(pigment,pigment, pigment*(.92+alea(i,r,graine+3)*.08));
      }
    }
  }
  return geometrie(positions,couleurs);
}
function geometrie(p:number[],c:number[]):THREE.BufferGeometry {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.computeVertexNormals();return g;
}
export function conifereBoise():THREE.BufferGeometry {
  const p:number[]=[],c:number[]=[];
  for(let niveau=0;niveau<6;niveau++) for(let j=0;j<7;j++) {
    const a=j*Math.PI*2/7+niveau*.61;
    const rayon=(.175-niveau*.024)*(.85+alea(j,niveau,76)*.2), y=-.17+niveau*.069;
    const points=[[0,y+.042,0],[rayon*.53,y,rayon*.35],[rayon,y-.028,0],[rayon*.53,y,-rayon*.35],[rayon*.48,y+.018,0]];
    const pigment=.72+alea(j,niveau,91)*.28;
    for(const k of [0,1,4,1,2,4,2,3,4,3,0,4]) {
      const [x,h,z]=points[k]!;p.push(x!*Math.cos(a)-z!*Math.sin(a),h!,x!*Math.sin(a)+z!*Math.cos(a));c.push(pigment,pigment,pigment*.94);
    }
  }
  return geometrie(p,c);
}
export function troncRamifie():THREE.BufferGeometry {
  const morceaux:THREE.BufferGeometry[]=[new THREE.CylinderGeometry(.023,.038,.2,7)];
  for(let i=0;i<5;i++) {
    const a=i*2.39996;
    const debut=new THREE.Vector3(0,.005+i*.008,0),fin=new THREE.Vector3(Math.cos(a)*.105,.17+i*.008,Math.sin(a)*.105);
    const direction=fin.clone().sub(debut);
    const b=new THREE.CylinderGeometry(.004,.012,direction.length(),5);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));b.translate(...debut.add(fin).multiplyScalar(.5).toArray());morceaux.push(b);
  }
  const g=mergeGeometries(morceaux)!;for(const b of morceaux)b.dispose();return g;
}
