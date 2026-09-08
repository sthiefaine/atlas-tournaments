// Le découpage de la planche de la vitrine, isolé de son composant pour être
// jouable sans navigateur : le composant importe une feuille CSS, que Node ne
// sait pas lire.

/**
 * Le rectangle d'une tuile dans le repère du moteur — origine en bas à gauche —,
 * ou `null` si elle ne tient pas entièrement dans le cadre.
 *
 * Sous WebGPU, `setScissorRect` et `setViewport` prennent des entiers **non
 * signés** et refusent tout ce qui déborde de la cible : un `y` négatif lève
 * « Value is outside the 'unsigned long' value range », et l'exception remonte
 * jusqu'à la limite d'erreur de React, qui remplace la page entière par
 * « Application error ». WebGL, lui, s'en accommodait sans rien dire — c'est un
 * écart de dos, pas une faute de mise en page.
 *
 * On saute plutôt qu'on rogne : rogner changerait la projection, donc
 * déformerait la vue le temps d'un redimensionnement. Une tuile sautée réapparaît
 * à l'image suivante, quand la mise en page est retombée.
 */
export function rectangleTuile(
  cadre: { left: number; top: number },
  tuile: { left: number; top: number; width: number; height: number },
  largeur: number,
  hauteur: number,
): { x: number; y: number; l: number; h: number } | null {
  const x = Math.round(tuile.left - cadre.left);
  const yHaut = Math.round(tuile.top - cadre.top);
  const l = Math.round(tuile.width);
  const h = Math.round(tuile.height);
  if (l <= 0 || h <= 0) return null;
  const y = hauteur - yHaut - h;
  if (x < 0 || y < 0 || x + l > largeur || y + h > hauteur) return null;
  return { x, y, l, h };
}
