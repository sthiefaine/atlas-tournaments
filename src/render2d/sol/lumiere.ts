/**
 * La lumière du sol : **celle de la cuisson** (`ECLAIRAGE_CUISSON` du contrat).
 *
 * Les images d'unités, de bâtiments et de décor sont photographiées sous une
 * lumière qui vient de l'avant-gauche. Un sol éclairé d'ailleurs ferait flotter
 * tout ce qui est posé dessus : les bosses du gazon, les galets et les arbres
 * du décor de repli s'éclairent donc du même côté, et leurs ombres tombent du
 * même côté que celles cuites dans les images.
 *
 * Deux repères. Le **sol** : `x` vers la droite de l'écran, `y` vers le bas de
 * l'écran (le joueur), `z` vers le haut. L'**écran** : `x` à droite, `y` vers
 * le bas, `z` vers la caméra — celui où l'on pose la normale d'une boule vue
 * de face, pour les frondaisons du décor de repli.
 */

import { COS_TANGAGE, ECLAIRAGE_CUISSON, SIN_TANGAGE } from '../contrat';

const RADIAN = Math.PI / 180;

/** Un vecteur à trois composantes. */
export type Vecteur3 = readonly [number, number, number];

/**
 * La direction **vers** la lumière principale, dans le repère du sol. Azimut 0 :
 * elle vient du joueur (le bas de l'écran), −90 : de la gauche (contrat).
 */
export function lumiereSol(): Vecteur3 {
  const { azimut, elevation } = ECLAIRAGE_CUISSON.principale;
  const a = azimut * RADIAN;
  const e = elevation * RADIAN;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

/**
 * La même direction dans le repère de l'écran. La caméra regarde vers le nord,
 * inclinée de `TANGAGE_CARTE` : le bas de l'écran est le sol qui vient vers
 * elle et descend, `(0, sin, −cos)`, et la direction de la caméra `(0, cos, sin)`.
 */
export function lumiereEcran(): Vecteur3 {
  const [x, y, z] = lumiereSol();
  return [x, y * SIN_TANGAGE - z * COS_TANGAGE, y * COS_TANGAGE + z * SIN_TANGAGE];
}

/**
 * Où tombe l'ombre d'un point à la hauteur `h` (en cases), en cases de sol :
 * à l'opposé de la lumière, d'autant plus loin que le soleil est bas.
 */
export function decalageOmbre(h: number): { x: number; y: number } {
  const [x, y, z] = lumiereSol();
  const horizontale = Math.hypot(x, y) || 1;
  const longueur = (h * horizontale) / z;
  return { x: (-x / horizontale) * longueur, y: (-y / horizontale) * longueur };
}
