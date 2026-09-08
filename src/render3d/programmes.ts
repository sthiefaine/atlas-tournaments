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
 * 2. **L'ordre d'insertion des attributs de géométrie** — et c'était une fausse
 *    piste, corrigée le 8 septembre 2026 au soir. `ordonnerAttributs` rangeait
 *    les attributs parce que `getGeometryCacheKey` était réputée les parcourir
 *    dans l'ordre où ils ont été posés. Elle écrit en fait
 *    `Object.keys(geometry.attributes).sort()` : l'ordre n'a jamais rien
 *    séparé, et la mesure l'a confirmé — le compte de programmes est le même
 *    avec et sans, sur les deux cartes. La fonction est retirée, le compteur
 *    des tests lit désormais la vraie clé (`cleGeometrieProgramme`, dans
 *    `prechauffage.ts`), et un test épingle l'invariant pour le jour où une
 *    version de three cesserait de trier. Les 39 → 31 programmes du §9.5
 *    viennent donc **entièrement** de `sansZero`.
 *
 * Une limite, écrite plutôt que cachée : rien de tout cela ne peut contre les
 * séparations réelles. Un `InstancedMesh` porte son `uuid` dans la clé (le
 * nombre d'instances est écrit en dur dans le WGSL sous mille), et
 * `vertexColors`, `flatShading`, `side`, `transparent`, le nombre de
 * composantes d'un attribut et les tests de profondeur changent vraiment le
 * nuanceur ou l'état du pipeline.
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
 * Efface d'un matériau les zéros qui ne coûtent qu'un programme. Idempotente et
 * gratuite quand il n'y en a pas : elle est appelée sur des matériaux déjà en
 * scène, où seule l'écriture d'un uniforme est sans conséquence.
 */
export function normaliserMateriau(m: THREE.Material): void {
  const standard = m as THREE.Material & { metalness?: number; emissiveIntensity?: number };
  if (standard.metalness === 0) standard.metalness = EPSILON_UNIFORME;
  if (standard.emissiveIntensity === 0) standard.emissiveIntensity = EPSILON_UNIFORME;
}
