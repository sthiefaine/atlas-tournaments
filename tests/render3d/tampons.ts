// Lire une géométrie tenue par un `TamponMaille` (`src/render3d/maillage.ts`).
//
// Un tampon alloue ses attributs à une capacité et n'en remplit qu'une part : ce
// que le moteur dessine est borné par `drawRange`, pas par la taille du tableau.
// `position.count` et `computeBoundingBox()` répondent donc sur le **remplissage
// à zéro** autant que sur le contenu — le premier compte des sommets qui
// n'existent pas, le second tire la boîte jusqu'à l'origine. Ces deux fonctions
// posent la question dans les termes du moteur, et c'est la seule façon
// d'affirmer quoi que ce soit sur ce qui est réellement à l'écran.
import * as THREE from 'three/webgpu';

/** Les rangs des sommets effectivement dessinés, une fois chacun. */
export function rangsDessines(g: THREE.BufferGeometry): number[] {
  const { start, count } = g.drawRange;
  const fin = start + (count === Infinity ? (g.index?.count ?? g.getAttribute('position')?.count ?? 0) : count);
  const vus = new Set<number>();
  for (let i = start; i < fin; i += 1) vus.add(g.index ? g.index.getX(i) : i);
  return [...vus];
}

/** Le nombre de sommets dessinés : ce que `position.count` disait avant le tampon. */
export function sommetsDessines(g: THREE.BufferGeometry): number {
  return rangsDessines(g).length;
}

/** La boîte des seuls sommets dessinés. */
export function bornesDessinees(g: THREE.BufferGeometry): THREE.Box3 {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const boite = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const i of rangsDessines(g)) boite.expandByPoint(point.set(p.getX(i), p.getY(i), p.getZ(i)));
  return boite;
}
