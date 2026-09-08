/**
 * Ce qui décide **combien de programmes** le moteur doit écrire.
 *
 * Sous WebGPU (three r170), tout objet dessiné donne un `RenderObject` dont la
 * clé — `getMaterialCacheKey`, `RenderObject.js` — sert d'entrée au cache
 * `Nodes.nodeBuilderCache`. Une clé jamais vue coûte une **traduction TSL →
 * WGSL en JavaScript**, puis la création d'un pipeline par le pilote. C'est
 * exactement ce que la première image paie : elle bloque le fil principal une
 * seconde pendant que l'image suivante coûte deux millisecondes et demie
 * (`10-rendu-3d.md` §9.4). Le nombre de matériaux ne dit rien de ce coût ; le
 * nombre de **clés distinctes**, si.
 *
 * Or three sépare sur deux différences qui n'en sont pas :
 *
 * 1. **Un nombre réduit à « nul ou non ».** La clé écrit `'1'` ou `'0'` pour
 *    toute propriété numérique — « important for clearcoat, transmission »,
 *    dit le commentaire de three, parce que zéro y désactive une branche du
 *    nuanceur. Mais `metalness` et `emissiveIntensity` ne sont que des
 *    **uniformes** d'un `MeshStandardNodeMaterial` : le WGSL est le même à
 *    zéro et à un — c'est vérifié par `tests/render3d/programmes.test.ts`, qui
 *    construit les deux nuanceurs et compare les textes. Un zéro exact coûte
 *    donc un programme entier pour un nuanceur identique. `sansZero` le
 *    remplace par un millième, sous la quantification d'un canal de huit bits :
 *    invisible à l'écran, un programme de moins.
 *
 * 2. **L'ordre d'insertion des attributs de géométrie.** `getGeometryCacheKey`
 *    parcourt `geometry.attributes` dans l'ordre où ils ont été posés. Or
 *    `BoxGeometry` pose `position, normal, uv` et `ExtrudeGeometry` pose
 *    `position, uv` puis `computeVertexNormals()` ajoute `normal` à la fin :
 *    deux figurines de la même matière, l'une biseautée et l'autre non,
 *    coûtaient deux programmes pour un seul nuanceur. `ordonnerAttributs`
 *    remet tout le monde dans le même ordre.
 *
 * Deux limites, écrites plutôt que cachées : cela ne se fait qu'**avant le
 * premier dessin** d'une géométrie — réordonner après coup changerait la clé
 * et provoquerait précisément la reconstruction qu'on évite —, et cela ne peut
 * rien contre les séparations réelles : un `InstancedMesh` porte son `uuid`
 * dans la clé (le nombre d'instances est écrit en dur dans le WGSL sous mille),
 * `vertexColors`, `flatShading`, `side`, `transparent` et les tests de
 * profondeur changent vraiment le nuanceur ou l'état du pipeline.
 */

import * as THREE from 'three/webgpu';

/**
 * La valeur qui remplace un zéro exact dans une propriété numérique qui n'est
 * qu'un uniforme. Un millième de métal ou d'émission ne se voit pas — la
 * quantification d'un canal de huit bits vaut quatre millièmes — et ne coûte
 * pas un programme de plus.
 */
export const EPSILON_UNIFORME = 0.001;

/** Un nombre jamais nul, pour une propriété que three réduit à « nul ou non ». */
export function sansZero(v: number): number {
  return v === 0 ? EPSILON_UNIFORME : v;
}

/**
 * L'ordre canonique des attributs. Les quatre premiers sont ceux que le rendu
 * emploie ; tout autre attribut suit, dans son ordre d'apparition — un nom
 * inconnu ne doit pas être perdu, seulement rangé après les connus.
 */
export const ORDRE_ATTRIBUTS: readonly string[] = ['position', 'normal', 'uv', 'color'];

/**
 * Remet les attributs d'une géométrie dans l'ordre canonique. Sans effet — pas
 * même une écriture — si l'ordre est déjà le bon : la fonction est appelée sur
 * des géométries mémorisées, et repositionner un attribut déjà dessiné coûterait
 * la reconstruction qu'on cherche à éviter.
 */
export function ordonnerAttributs<T extends THREE.BufferGeometry>(geo: T): T {
  const noms = Object.keys(geo.attributes);
  const voulu = [
    ...ORDRE_ATTRIBUTS.filter((n) => noms.includes(n)),
    ...noms.filter((n) => !ORDRE_ATTRIBUTS.includes(n)),
  ];
  if (voulu.every((n, i) => noms[i] === n)) return geo;
  const gardes = voulu.map((n) => [n, geo.attributes[n]!] as const);
  for (const [n] of gardes) geo.deleteAttribute(n);
  for (const [n, a] of gardes) geo.setAttribute(n, a);
  return geo;
}

/**
 * Efface d'un matériau les zéros qui ne coûtent qu'un programme. Idempotente et
 * gratuite quand il n'y en a pas : elle est appelée sur des matériaux déjà en
 * scène, où seule l'écriture d'un uniforme est sans conséquence.
 */
export function normaliserMateriau(m: THREE.Material): void {
  const standard = m as THREE.Material & { metalness?: number; emissiveIntensity?: number };
  if (standard.metalness === 0) standard.metalness = EPSILON_UNIFORME;
  if (standard.emissiveIntensity === 0) standard.emissiveIntensity = EPSILON_UNIFORME;
}
