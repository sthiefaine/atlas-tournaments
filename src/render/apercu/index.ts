/**
 * `render/apercu/` — rendu d'aperçu d'une carte en PNG, sans dépendance native
 * et sans DOM. Réservé à la relecture (scripts, routines, tests) : ce n'est pas
 * le rendu du jeu, qui est la peau 3D de `render3d/`.
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
