/** Une source chargée une fois pour le plateau et le carnet ; matériaux privés par utilisateur. */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
import { clonerFigurine, clonerMateriauNoeud, definirMasque, lectureDepuisGltf, masqueDe } from './modeles';
const sources = new Map<string, { refs: number; lecture: Promise<THREE.Object3D> }>();
const baux = new WeakMap<THREE.Object3D, () => void>();
function detruireSource(objet: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materiaux = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  objet.traverse(o => { if(o instanceof THREE.Mesh) { geometries.add(o.geometry); for(const m of Array.isArray(o.material)?o.material:[o.material]) { materiaux.add(m); const masque=masqueDe(m);if(masque)textures.add(masque);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v); } } });
  for(const m of materiaux)m.dispose();for(const g of geometries)g.dispose();for(const t of textures)t.dispose();
}
export async function acquerirBatiment(id: string): Promise<THREE.Object3D> {
  let entree = sources.get(id);
  if(!entree) {
    entree = {refs:0,lecture:new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/assets/modeles/${id}_lod0.glb`).then(lectureDepuisGltf).then(l=>l.scene)};
    sources.set(id,entree);
  }
  entree.refs++;
  const bail = entree;
  let libere=false;
  const rendre = () => {
    if(libere)return;libere=true;bail.refs--;
    if(bail.refs===0) { if(sources.get(id)===bail)sources.delete(id);void bail.lecture.then(detruireSource,()=>undefined); }
  };
  try {
    const source = await bail.lecture, copie = clonerFigurine(source);
    const clones=new Map<THREE.Material,THREE.Material>();
    copie.traverse(o=>{if(o instanceof THREE.Mesh){const cloner=(m:THREE.Material)=>{let c=clones.get(m);if(!c){c=m instanceof THREE.MeshStandardNodeMaterial ? clonerMateriauNoeud(m) : m.clone();const masque=masqueDe(m);if(masque)definirMasque(c,masque);clones.set(m,c);}return c;};o.material=Array.isArray(o.material)?o.material.map(cloner):cloner(o.material);o.castShadow=true;o.receiveShadow=true;}});
    copie.name=id;
    baux.set(copie,()=>{for(const m of clones.values())m.dispose();rendre();});
    return copie;
  } catch(e) { rendre();throw e; }
}
/** true signifie que l'objet appartient au cache : ne jamais libérer ses textures ailleurs. */
export function rendreBatiment(objet:THREE.Object3D):boolean {
  const rendre=baux.get(objet);if(!rendre)return false;
  // Conserver un marqueur idempotent, y compris après une double fermeture.
  baux.set(objet,()=>undefined);rendre();return true;
}
