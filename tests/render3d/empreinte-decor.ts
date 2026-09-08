// L'empreinte d'un décor : de quoi prouver qu'un remaniement n'a **rien** changé.
//
// Le décor est déterministe — arbres, pierres, accessoires et bâtiments sont
// tirés de l'aléa de case — mais il n'a aucun pixel à comparer hors navigateur.
// Ce qu'on peut comparer, en revanche, est tout ce qui décide de l'image : la
// place, l'orientation et l'échelle de chaque objet, les matrices et les
// couleurs de chaque instance, et le contenu exact de chaque géométrie fondue.
//
// D'où cette empreinte : une ligne par objet de la scène, hachée. Deux décors
// qui rendent la même image ont la même empreinte ; un sommet qui bouge d'un
// bit la change. C'est ce qui a servi à découper `creerDecor` en tranches et à
// mémoriser ses formes sans rien déplacer à l'écran — les empreintes figées
// dans `decor.test.ts` ont été relevées sur le code d'avant ce remaniement.
import * as THREE from 'three/webgpu';

import { estLotInstancie } from '../../src/render3d/lots';

/**
 * Les attributs que `LotInstancie` ajoute à la forme qu'il instancie. Ils sont
 * **exclus** de la part « géométrie » de l'empreinte et rapportés à part, dans
 * la ligne `inst:` — exactement là où `InstancedMesh` rangeait les siens. C'est
 * ce qui permet aux condensés figés, relevés avant `lots.ts`, de tenir : ils
 * disent ce que le décor met à l'écran, et cela n'a pas bougé.
 */
const ATTRIBUTS_INSTANCE = new Set(['iCol0', 'iCol1', 'iCol2', 'iCol3', 'iTeinte']);

/** Un FNV-1a sur les octets d'une suite de nombres, en double précision. */
function hacher(valeurs: ArrayLike<number>): string {
  let h = 0x811c9dc5;
  const tampon = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < valeurs.length; i += 1) {
    tampon.setFloat64(0, valeurs[i] as number);
    for (let k = 0; k < 8; k += 1) {
      h ^= tampon.getUint8(k);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** Ce qu'un objet du décor met à l'écran, en une ligne comparable. */
function ligneDe(o: THREE.Object3D, chemin: string): string {
  const p = [
    o.position.x, o.position.y, o.position.z,
    o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w,
    o.scale.x, o.scale.y, o.scale.z,
  ];
  // Un lot instancié se déclare `Mesh` depuis `lots.ts` — c'est justement ce
  // qui lui épargne un programme —, mais il met à l'écran ce qu'un
  // `InstancedMesh` y mettait : l'empreinte le dit comme avant.
  const type = estLotInstancie(o) ? 'InstancedMesh' : o.type;
  let ligne = `${chemin}|${type}|${o.name}|${o.visible ? 1 : 0}`
    + `|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`
    + `|${p.map((v) => v.toFixed(9)).join(',')}`;
  const m = o as THREE.Mesh;
  if (!m.isMesh) return ligne;
  const g = m.geometry;
  // Les attributs sont triés : leur ordre d'insertion compte pour le nombre de
  // programmes (`programmes.ts`), pas pour l'image, et il a son propre test.
  const attributs = Object.keys(g.attributes).sort().filter((n) => !ATTRIBUTS_INSTANCE.has(n));
  ligne += `|geo:${attributs.map((n) => {
    const a = g.getAttribute(n) as THREE.BufferAttribute;
    return `${n}:${a.itemSize}:${a.count}:${hacher(a.array as ArrayLike<number>)}`;
  }).join(';')}`;
  ligne += `|idx:${g.index ? `${g.index.count}:${hacher(g.index.array as ArrayLike<number>)}` : 'nul'}`;
  const mat = m.material as THREE.MeshStandardMaterial;
  ligne += `|mat:${mat.type}:${mat.color?.getHexString?.() ?? '-'}`
    + `:${mat.transparent ? 1 : 0}:${(mat.opacity ?? 1).toFixed(3)}`;
  if (estLotInstancie(o)) {
    // Les seize flottants d'une instance, dans l'ordre où `instanceMatrix` les
    // rangeait : quatre colonnes à la suite. Même contenu, même haché.
    ligne += `|inst:${o.compte}/${o.capacite}:${hacher(o.matricesAPlat())}`;
    const teintes = o.teintesAPlat();
    ligne += `|col:${teintes ? hacher(teintes) : 'nul'}`;
    return ligne;
  }
  const lot = m as THREE.InstancedMesh;
  if (lot.isInstancedMesh) {
    ligne += `|inst:${lot.count}/${lot.instanceMatrix.count}`
      + `:${hacher(lot.instanceMatrix.array as ArrayLike<number>)}`;
    ligne += `|col:${lot.instanceColor ? hacher(lot.instanceColor.array as ArrayLike<number>) : 'nul'}`;
  }
  return ligne;
}

export interface Empreinte {
  /** Une ligne par objet, triées : ce sont les contenus qu'on compare, pas leur ordre. */
  readonly lignes: readonly string[];
  /** Le condensé de toutes les lignes : c'est lui qu'on fige dans un test. */
  readonly digest: string;
}

/** L'empreinte d'un sous-arbre de scène. */
export function empreinte(racine: THREE.Object3D): Empreinte {
  const lignes: string[] = [];
  const parcourir = (o: THREE.Object3D, chemin: string): void => {
    lignes.push(ligneDe(o, chemin));
    o.children.forEach((c, i) => parcourir(c, `${chemin}/${i}:${c.name || c.type}`));
  };
  parcourir(racine, 'decor');
  const triees = [...lignes].sort();
  return { lignes: triees, digest: hacher([...triees.join('\n')].map((c) => c.charCodeAt(0))) };
}

/** Les différences entre deux empreintes, prêtes à s'afficher. */
export function ecarts(a: Empreinte, b: Empreinte): string[] {
  const dansA = new Set(a.lignes);
  const dansB = new Set(b.lignes);
  return [
    ...a.lignes.filter((l) => !dansB.has(l)).slice(0, 3).map((l) => `- ${l.slice(0, 200)}`),
    ...b.lignes.filter((l) => !dansA.has(l)).slice(0, 3).map((l) => `+ ${l.slice(0, 200)}`),
  ];
}
