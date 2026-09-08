/**
 * Échanger la géométrie d'une maille, sous WebGPU.
 *
 * `WebGLRenderer` relisait `mesh.geometry` à chaque dessin : remplacer une
 * géométrie par une autre était transparent. `WebGPURenderer` ne le fait pas.
 * Il tient un `RenderObject` par couple **objet + matériau** (`RenderObjects`),
 * y capture la géométrie une fois pour toutes (`this.geometry = object.geometry`)
 * et **mémoïse** les attributs et les tampons qu'il en tire (`getAttributes` :
 * `if ( this.attributes !== null ) return this.attributes`). Il ne se reconstruit
 * que si sa **clé** change — et cette clé, pour la géométrie, ne retient que les
 * *noms* et *formats* des attributs (`getGeometryCacheKey` : nom, `stride`,
 * `offset`, `itemSize`, `normalized`, présence d'un index), **jamais leur taille
 * ni leur identité**. Deux flèches de longueurs différentes ont donc exactement
 * la même clé, et rien ne prévient le moteur. Lever `needsUpdate` sur le
 * matériau ne suffit pas non plus : la version est explicitement exclue de la
 * clé, et three se contente alors de recopier le numéro de version.
 *
 * Conséquence, vue le 7 septembre 2026 au soir : la flèche de chemin s'affichait
 * **une fois**, puis plus jamais, et les nappes de surbrillance restaient
 * figées sur une vue périmée. Le premier survol créait l'objet de rendu ; le
 * suivant posait une géométrie neuve — l'ancienne libérée — pendant que le
 * moteur continuait de dessiner des tampons détruits.
 *
 * Le remède tient en une ligne de clé : on pose sur chaque géométrie un
 * **attribut témoin** dont le nom alterne. La clé change, l'objet de rendu se
 * reconstruit sur la bonne géométrie. Le témoin n'est lu par aucun nuanceur —
 * `getAttributes` n'itère que sur les attributs que le nuanceur demande — donc
 * il ne coûte pas un octet de tampon ; et comme il n'alterne qu'entre deux
 * noms, le moteur ne garde jamais que deux états de pipeline, sans recompiler à
 * chaque survol.
 */

import * as THREE from 'three/webgpu';

/** Les deux noms du témoin. Deux suffisent : il faut seulement que la clé change. */
export const TEMOINS = ['atlas_maj_a', 'atlas_maj_b'] as const;

/** Le témoin porté par une géométrie, ou `null` : ce qui distingue deux clés. */
export function temoinDe(geometrie: THREE.BufferGeometry): string | null {
  return TEMOINS.find((nom) => geometrie.getAttribute(nom) !== undefined) ?? null;
}

/**
 * Pose `neuve` sur `maille`, libère l'ancienne et fait en sorte que le moteur
 * la voie. `libererAncienne` vaut faux quand la géométrie sortante est partagée
 * ou réutilisée ailleurs — la libérer la retirerait aussi de l'autre maille.
 */
export function remplacerGeometrie(
  maille: THREE.Mesh | THREE.LineSegments | THREE.Line,
  neuve: THREE.BufferGeometry,
  libererAncienne = true,
): void {
  const ancienne = maille.geometry;
  if (ancienne === neuve) return;
  // Le témoin de la neuve est l'autre que celui de l'ancienne : c'est ce
  // changement de nom, et lui seul, qui invalide l'objet de rendu.
  const precedent = temoinDe(ancienne);
  const suivant = precedent === TEMOINS[0] ? TEMOINS[1] : TEMOINS[0];
  for (const nom of TEMOINS) if (neuve.getAttribute(nom) !== undefined) neuve.deleteAttribute(nom);
  neuve.setAttribute(suivant, new THREE.BufferAttribute(new Float32Array(1), 1));
  if (libererAncienne) ancienne.dispose();
  maille.geometry = neuve;
}
