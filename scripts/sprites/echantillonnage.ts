/**
 * Quels instants d'un clip on photographie. Pur : la règle se teste sans
 * Blender, et le script Blender reçoit des instants tout faits.
 *
 * La cadence du contrat est `IMAGES_PAR_SECONDE`. Un clip plus long que
 * `IMAGES_MAX_PAR_CLIP` images à cette cadence est échantillonné plus
 * lâchement, et sa cadence de lecture (`ips`) baisse d'autant : la durée lue
 * reste la durée du clip, seule la finesse change.
 */

import { IMAGES_PAR_SECONDE } from '../../src/render2d/contrat';

import { IMAGES_MAX_PAR_CLIP } from './reglages';

export interface Echantillonnage {
  /** Les instants, en secondes depuis le début du clip, croissants. */
  temps: number[];
  /** La cadence de lecture qui rend au clip sa vraie durée. */
  ips: number;
}

/** Arrondi à la microseconde : des instants lisibles dans un JSON. */
function net(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * Les instants d'un clip de `duree` secondes.
 *
 * - Un clip **qui boucle** se découpe en `n` pas égaux sur `[0, durée[` : la
 *   dernière image précède la première, qui la suit.
 * - Un clip **qui joue une fois** se découpe en `n − 1` pas sur `[0, durée]` :
 *   sa première et sa dernière pose sont photographiées — celle de `hors_jeu`
 *   est celle qui reste à l'écran.
 * - Un clip de durée nulle, ou absent, est une seule image à l'instant zéro.
 */
export function echantillonner(duree: number, boucle: boolean, max = IMAGES_MAX_PAR_CLIP): Echantillonnage {
  if (!(duree > 0)) return { temps: [0], ips: IMAGES_PAR_SECONDE };
  if (boucle) {
    const n = Math.max(1, Math.min(max, Math.round(duree * IMAGES_PAR_SECONDE)));
    return { temps: Array.from({ length: n }, (_, k) => net((k * duree) / n)), ips: net(n / duree) };
  }
  const n = Math.max(2, Math.min(max, Math.ceil(duree * IMAGES_PAR_SECONDE - 1e-9) + 1));
  return { temps: Array.from({ length: n }, (_, k) => net((k * duree) / (n - 1))), ips: net((n - 1) / duree) };
}
