/**
 * `render/apercu/` — rendu d'aperçu d'une carte en PNG, sans dépendance native
 * et sans DOM. Réservé à la relecture (scripts, routines, tests) ; le rendu du
 * jeu reste le Canvas 2D vectoriel de `render/`.
 *
 * ```ts
 * import { rasteriserCarte, encoderPng } from '@/render/apercu';
 * writeFileSync('carte.png', encoderPng(rasteriserCarte(carte)));
 * ```
 */

export { encoderPng, crc32, creerImage, couleurHex, pixel, rectangle, disque, triangle, SIGNATURE_PNG } from './png';
export type { Image, Rvb } from './png';
export { rasteriserCarte, TUILE } from './raster';
export type { OptionsRendu } from './raster';
