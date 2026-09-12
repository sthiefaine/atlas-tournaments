/**
 * Le **buste** d'un commandant : un portrait vectoriel, teinté par la palette de
 * son camp, net à toute taille et sans une seule requête réseau. Les modèles
 * réels sont des `AssetSpec` de type `buste` non encore livrées
 * (`11-assets-spec.md` §10.3) ; celui-ci tient la place, et il la tient debout.
 *
 * Il vit dans son propre module, et c'est une décision de **poids**, pas de
 * rangement : il était dans `dialogue-html.ts`, avec la scène de dialogue, sa
 * feuille de style et les pictogrammes d'`illustrations.ts`. Le vestiaire de la
 * campagne en pose vingt et un sur une page qui ne monte aucun HUD — importer
 * `buste` y faisait entrer quarante-six kilo-octets de source pour un dessin, et
 * `/campagne` est précisément la page dont l'histoire dit qu'elle ne doit pas
 * embarquer le jeu.
 *
 * Quatre écrans le posent : la scène de dialogue, le splash de pouvoir
 * (`scenes-html.ts`), la grille du briefing et la collection du carnet.
 */

import type { CampId, Emotion } from '../schemas/types';
import { paletteDe } from './palettes';

/** Traits du visage par émotion : sourcils et bouche, rien de plus. */
export const VISAGES: Readonly<Record<Emotion, { sourcils: string; bouche: string }>> = {
  neutre: { sourcils: 'M58 76h14m18 0h14', bouche: 'M72 114h16' },
  joie: { sourcils: 'M58 74l14-4m18 0l14 4', bouche: 'M70 111q10 10 20 0' },
  colere: { sourcils: 'M58 70l14 7m18 0l14-7', bouche: 'M70 116q10-8 20 0' },
  surprise: { sourcils: 'M57 70h15m17 0h15', bouche: 'M74 110q6 12 12 0q-6-6-12 0' },
  doute: { sourcils: 'M58 78l14-8m18 4h14', bouche: 'M70 114q10 6 20-2' },
  triomphe: { sourcils: 'M58 72l14-5m18 5l14-5', bouche: 'M68 109q12 13 24 0' },
};

/**
 * Le buste d'un commandant, en SVG vectoriel : net à toute taille, sans une
 * seule requête réseau, et teinté par la palette de son camp. Les modèles réels
 * sont des `AssetSpec` de type `buste` non encore livrées (`11-assets-spec.md`
 * §10.3) ; celui-ci tient la place, et il la tient debout. Exporté pour le
 * splash de pouvoir (`scenes-html.ts`), qui montre le même visage en triomphe.
 */
export function buste(camp: CampId | null, emotion: Emotion): string {
  const pal = paletteDe(camp);
  const visage = VISAGES[emotion] ?? VISAGES.neutre;
  return `<svg viewBox="0 0 160 190" aria-hidden="true">`
    + `<path fill="${pal.dark}" d="M0 0h160v190H0z"/>`
    + `<path stroke="#ffffff" opacity=".1" stroke-width="1" d="M0 32h160M0 64h160M0 96h160M0 128h160M0 160h160M32 0v190M64 0v190M96 0v190M128 0v190"/>`
    + `<path fill="${pal.main}" opacity=".55" d="M80 26 152 190H8z"/>`
    + `<path fill="#1b3540" d="M14 190v-24q4-28 45-33h42q41 5 46 33v24"/>`
    + `<path fill="#e6b88e" d="M66 108h28v33l-14 12-14-12z"/>`
    + `<path fill="#f1c7a0" d="M54 62h52v40q-3 26-26 27-23-4-26-27z"/>`
    + `<path fill="${pal.dark}" d="M46 100V58q0-28 34-28 34 0 35 31v12l-12-8-40 6-9 12z"/>`
    + `<path fill="${pal.main}" d="M39 54q-4-28 37-30 42-5 47 21l-13 16-55 4z"/>`
    + `<path fill="#12303a" d="m49 60 60-9 7 8-13 10-50 3z"/>`
    + `<path fill="${pal.light}" d="m70 36 6-4 6 4v9l-6 4-6-4z"/>`
    + `<path stroke="#3a3a3c" stroke-width="3" stroke-linecap="round" fill="none" d="${visage.sourcils}"/>`
    + `<path stroke="#8f5f50" stroke-width="3" stroke-linecap="round" fill="none" d="${visage.bouche}"/>`
    + `<path fill="${pal.main}" d="m60 133 20 21-17 15-16-30m56-6-20 21 17 15 16-30"/>`
    + `<path fill="${pal.light}" d="M112 160h16v4h-16zm0 8h16v4h-16z"/>`
    + `</svg>`;
}
