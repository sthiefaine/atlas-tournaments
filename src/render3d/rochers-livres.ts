/** Prépare un rocher GLB statique pour les lots instanciés du paysage. */
import * as THREE from 'three/webgpu';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clonerMateriauNoeud } from './modeles';

export interface RocherLivre {
  geometrie: THREE.BufferGeometry;
  materiau: THREE.MeshStandardNodeMaterial;
  /** Conserve l'encombrement des pierres semées par le moteur. */
  echelle: number;
  /** Les textures restent à la charge du bail qui détient le GLB. */
  dispose(): void;
}

/**
 * Fusionne les primitives d'un même matériau dans le repère du fichier.
 * Les sommets, UV et normales de la source restent intacts. Le matériau privé
 * recevra les nœuds d'instanciation sans modifier celui du modèle en cache.
 */
export function extraireRocherLivre(source: THREE.Object3D): RocherLivre | null {
  const mailles: THREE.Mesh[] = [];
  let incompatible = false;
  source.updateMatrixWorld(true);
  source.traverse(objet => {
    if (!(objet instanceof THREE.Mesh)) return;
    if (objet instanceof THREE.SkinnedMesh || Object.keys(objet.geometry.morphAttributes).length) incompatible = true;
    mailles.push(objet);
  });
  if (incompatible || !mailles.length || source.animations.length) return null;
  const materiaux = new Set(mailles.flatMap(m => Array.isArray(m.material) ? m.material : [m.material]));
  const original = materiaux.values().next().value;
  if (materiaux.size !== 1 || !(original instanceof THREE.MeshStandardNodeMaterial)) return null;

  const morceaux: THREE.BufferGeometry[] = [];
  let fusion: THREE.BufferGeometry | null = null;
  try {
    for (const maille of mailles) {
      const geo = maille.geometry.index ? maille.geometry.toNonIndexed() : maille.geometry.clone();
      morceaux.push(geo);
      if (!geo.getAttribute('position') || !geo.getAttribute('normal') || !geo.getAttribute('uv')) return null;
      // LotInstancie transforme la normale, pas les tangentes du GLB. Sans
      // cet attribut, Three reconstruit le repère de la carte normale à partir
      // des dérivées de la position et des UV, après rotation de l'instance.
      geo.deleteAttribute('tangent');
      geo.clearGroups();
      geo.applyMatrix4(maille.matrixWorld);
    }
    const attributs = morceaux.map(g => Object.keys(g.attributes).sort().join(','));
    if (attributs.some(a => a !== attributs[0])) return null;
    fusion = mergeGeometries(morceaux, false);
    if (!fusion) return null;
    const geometrie = mergeVertices(fusion, 1e-7);
    geometrie.computeBoundingBox();
    const volume = geometrie.boundingBox!.getSize(new THREE.Vector3());
    const largeur = Math.max(volume.x, volume.z);
    if (!Number.isFinite(largeur) || largeur <= 0 || !Number.isFinite(volume.y)) {
      geometrie.dispose();
      return null;
    }
    const materiau = clonerMateriauNoeud(original);
    let libere = false;
    return {
      geometrie, materiau, echelle: 0.34 / largeur,
      dispose() {
        if (libere) return;
        libere = true;
        geometrie.dispose();
        materiau.dispose();
      },
    };
  } finally {
    fusion?.dispose();
    for (const geo of morceaux) geo.dispose();
  }
}
