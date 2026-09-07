// Construire le nuanceur d'un objet sans carte graphique.
//
// Le moteur WebGPU de three (r170) sépare la **construction** du nuanceur — les
// nœuds d'un matériau deviennent du WGSL — de sa compilation par la carte
// graphique. Un `WebGPURenderer` jamais initialisé (`init()` n'est pas appelé,
// aucun `GPUDevice` n'existe) fournit tout de même le constructeur de nœuds de
// son moteur, et c'est lui qui écrit le WGSL. On obtient donc, sous Node, le
// texte exact que le navigateur enverrait à la carte : un test peut y lire dans
// quel ordre les choses se font — l'instance avant la position monde, le
// masque après l'éclairage — au lieu de se contenter de compter des nœuds.
//
// Ce que cela ne vérifie pas : que le WGSL compile et que l'image est juste.
// Cela reste affaire de navigateur.
import * as THREE from 'three/webgpu';
import { densityFog, uniform } from 'three/tsl';

/** Le WGSL des deux étages d'un objet, tel que three l'écrirait. */
export interface Nuanceur {
  vertex: string;
  fragment: string;
}

/** Ce qu'un `WebGPUBackend` sait faire sans appareil : fabriquer son constructeur de nœuds. */
interface FabriqueConstructeur {
  createNodeBuilder(objet: THREE.Object3D, renderer: THREE.Renderer): THREE.NodeBuilder;
}

/** Une toile factice : le rendu ne dessinera jamais, il n'a besoin que d'un objet à tenir. */
function toileFactice(): HTMLCanvasElement {
  return {
    width: 1, height: 1, style: {},
    addEventListener(): void {},
    removeEventListener(): void {},
    getContext: (): null => null,
  } as unknown as HTMLCanvasElement;
}

/**
 * Construit le nuanceur d'une maille, avec des lumières et une brume de scène
 * pour que le fragment porte un éclairage et un brouillard de scène complets —
 * c'est **après** eux que le masque de visibilité doit venir, et on ne peut
 * l'affirmer que s'ils sont là.
 */
export function construireNuanceur(
  objet: THREE.Mesh | THREE.InstancedMesh | THREE.LineSegments,
  options: { lumieres?: boolean; brume?: boolean } = {},
): Nuanceur {
  const renderer = new THREE.WebGPURenderer({ canvas: toileFactice() });
  // `hasFeature` interroge le moteur, qui n'est pas initialisé et ne le sera
  // jamais ici : aucune extension, et pas d'avertissement dans la sortie.
  renderer.hasFeature = (): false => false;
  const fabrique = renderer.backend as unknown as FabriqueConstructeur;
  const constructeur = fabrique.createNodeBuilder(objet, renderer);
  if (options.lumieres !== false) {
    constructeur.lightsNode = renderer.lighting.createNode([
      new THREE.DirectionalLight(0xffffff, 1), new THREE.AmbientLight(0xffffff, 0.2),
    ]);
  }
  if (options.brume !== false) {
    constructeur.fogNode = densityFog(uniform(new THREE.Color(0x808080)), uniform(0.02));
  }
  constructeur.build();
  return { vertex: constructeur.vertexShader, fragment: constructeur.fragmentShader };
}

/**
 * La position, dans un nuanceur, de la première ligne qui vérifie un motif :
 * −1 si aucune. Sert à dire qu'une chose se fait avant une autre.
 */
export function ligneDe(code: string, motif: RegExp): number {
  const lignes = code.split('\n');
  return lignes.findIndex((l) => motif.test(l));
}
