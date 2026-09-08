/**
 * Échanger la géométrie d'une maille, sous WebGPU.
 *
 * `WebGLRenderer` relisait `mesh.geometry` à chaque dessin : remplacer une
 * géométrie par une autre était transparent. `WebGPURenderer` ne le fait pas.
 * Il tient un `RenderObject` par couple **objet + matériau** (la géométrie
 * n'entre pas dans la clé, `RenderObjects.get`), y capture la géométrie une
 * fois pour toutes (`this.geometry = object.geometry`) et **mémoïse** les
 * attributs et les tampons de sommets qu'il en tire (`getAttributes`). Rien ne
 * l'invalide quand la géométrie change : le seul écouteur est posé sur le
 * matériau, et la reconstruction n'a lieu que si `material.version` bouge.
 *
 * Conséquence, vue le 7 septembre 2026 au soir : la flèche de chemin
 * s'affichait **une fois**, puis plus jamais. Le premier survol créait l'objet
 * de rendu sur une géométrie valide ; le survol suivant posait une nouvelle
 * géométrie — l'ancienne étant libérée — et le moteur continuait de dessiner
 * les tampons de la première, détruits. Tout ce qui échange une géométrie était
 * touché : la flèche, son liseré, les nappes de surbrillance, le curseur, les
 * voies, les ponts, le socle, la grille, l'eau et le sol d'une marée.
 *
 * Lever `needsUpdate` sur le matériau incrémente sa version (`Material`), ce
 * qui fait jeter l'objet de rendu et le reconstruire sur la bonne géométrie. Le
 * nuanceur, lui, est mis en cache par sa clé de programme : on ne recompile pas.
 */

import * as THREE from 'three/webgpu';

/**
 * Pose `neuve` sur `maille`, libère l'ancienne et prévient le moteur.
 *
 * `libererAncienne` vaut faux quand la géométrie sortante est partagée ou
 * réutilisée ailleurs — la libérer la retirerait aussi de l'autre maille.
 */
export function remplacerGeometrie(
  maille: THREE.Mesh | THREE.LineSegments | THREE.Line,
  neuve: THREE.BufferGeometry,
  libererAncienne = true,
): void {
  const ancienne = maille.geometry;
  if (ancienne === neuve) return;
  if (libererAncienne) ancienne.dispose();
  maille.geometry = neuve;
  invaliderMaille(maille);
}

/**
 * Force le moteur à reconstruire l'objet de rendu de cette maille : à appeler
 * après toute mutation que le cache ne voit pas — un échange de géométrie, ou
 * un attribut remplacé par un autre objet.
 */
export function invaliderMaille(maille: THREE.Object3D & { material?: unknown }): void {
  const m = maille.material;
  for (const materiau of Array.isArray(m) ? m : [m]) {
    if (materiau instanceof THREE.Material) materiau.needsUpdate = true;
  }
}
