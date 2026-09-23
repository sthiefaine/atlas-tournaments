/**
 * Les réglages de la cuisson : tout ce que la chaîne choisit librement, là où
 * le contrat (`src/render2d/contrat.ts`) ne dit rien. La projection, les vues,
 * les clips, la cadence et la direction des lumières sont au contrat et ne se
 * recopient pas ici ; ce fichier ne porte que des forces, des marges, des
 * qualités et des chemins.
 *
 * Toute valeur de ce fichier entre dans l'empreinte de cuisson d'une entrée :
 * en changer une recuit tout au prochain `npm run cuire:sprites -- --tout`.
 * Changer le script Blender, lui, n'est pas vu : c'est `VERSION_CUISSON` qu'on
 * incrémente alors.
 */

import { ECLAIRAGE_CUISSON, type FamilleSprite } from '../../src/render2d/contrat';

/** Incrémentée quand la chaîne change de comportement sans qu'un réglage change. */
export const VERSION_CUISSON = 1;

/** Le Blender qui cuit : 5.1 en ligne de commande. */
export const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';

/**
 * Échantillons par pixel **rendu**, soit seize fois plus par pixel livré
 * (suréchantillonnage 4). Mesuré le 23 septembre 2026 sur le char léger, écart
 * quadratique moyen à une référence de 1 024 échantillons, en niveaux sur 255
 * (`doc/refonte/sprites-cuisson.md`) : 16 → 0,85, 24 → 0,73, 32 → 0,64.
 */
export const ECHANTILLONS = 24;

/** Seuil de l'échantillonnage adaptatif de Cycles. */
export const SEUIL_ADAPTATIF = 0.01;

/** Débruitage OpenImageDenoise sur la passe combinée, à l'échelle 4. */
export const DEBRUITAGE = true;

/**
 * Le préfiltre du débruitage. Mesuré : à l'échelle 4, la réduction moyenne
 * déjà seize pixels rendus, et le débruiteur ne gagne que 0,03 à 0,04 niveau ;
 * avec les passes d'albédo et de normale (`ACCURATE`), il coûte 55 à 85 % de
 * temps en plus, sur la couleur seule (`NONE`), presque rien.
 */
export const PREFILTRE_DEBRUITAGE = 'NONE';

/**
 * Nombre de cuissons menées de front. Le processeur graphique rend pendant
 * que l'autre Blender synchronise sa scène ou écrit son image, et que Node
 * réduit et encode : deux, sur un M1 à 16 Go.
 */
export const CUISSONS_PARALLELES = 2;

/**
 * Le flou de bouge : l'obturateur reste ouvert cette fraction du pas entre
 * deux images, centré sur l'instant photographié. Mesuré sur l'hélicoptère :
 * son rotor tourne de 100° entre deux images de `deplacement` (240° au
 * `repos`), et paraissait à l'arrêt ou à l'envers ; ouvert la moitié du pas,
 * l'écart d'alpha d'une image à la suivante est divisé par deux (`deplacement`)
 * et par trois (`repos`), pour 2 % de temps de rendu en plus sur `deplacement`.
 */
export const FLOU_DE_BOUGE = 0.5;

/**
 * Au-delà de cette durée, un clip est échantillonné plus lâchement et sa
 * cadence de lecture baisse d'autant : sa durée reste la vraie.
 */
export const IMAGES_MAX_PAR_CLIP = 12;

/** Marge du canevas autour de l'enveloppe du modèle, en pixels livrés. */
export const MARGE_CANEVAS = 3;

/**
 * L'éclairage, en unités de Cycles. Le contrat donne les directions ; les
 * forces sont réglées pour qu'une face **horizontale** blanche sorte à 1,0
 * exactement — principale `2,2/π · sin 55°` + contour `0,8/π · sin 30°` + ciel
 * `0,3` —, de sorte qu'un albédo sRGB s'y lise tel quel et qu'une zone
 * d'équipe cuite en blanc, multipliée par la couleur d'équipe, rende cette
 * couleur, pas plus claire. Lumières blanches : l'étalonnage de saison, de
 * phase et de météo est au rendu.
 */
export const ECLAIRAGE = {
  principale: { ...ECLAIRAGE_CUISSON.principale, force: 2.2, angle: 3, ombre: true },
  contour: { ...ECLAIRAGE_CUISSON.contour, force: 0.8, angle: 5, ombre: false },
  ciel: 0.3,
} as const;

/** Qualité WebP de la couleur et de l'émission ; l'alpha est sans perte. */
export const QUALITE_WEBP = 90;

/** Côté maximal d'une page d'atlas. */
export const PAGE_MAX = 2048;

/**
 * Pixels vides entre deux images d'une page. Avec la bordure de chaque image,
 * six pixels transparents séparent deux silhouettes : les mipmaps du rendu
 * n'y bavent pas avant le niveau 2 (une image au quart de sa taille).
 */
export const ESPACEMENT = 4;

/**
 * Bordure transparente laissée autour de chaque image rognée : le filtrage
 * bilinéaire d'un bord ne lit jamais que des pixels de l'image elle-même.
 */
export const BORDURE = 1;

/**
 * Une ombre cuite (pixel sans surface du modèle) plus faible que ce seuil, sur
 * 255, est effacée : le débruitage laisse quelques poussières loin du modèle,
 * qui agrandiraient le rognage pour rien.
 */
export const SEUIL_OMBRE = 3;

/**
 * Sur combien de pixels, avant le bord du canevas, une ombre cuite descend à
 * zéro (`image.ts`, `versCalques`).
 */
export const FONDU_OMBRE = 10;

/**
 * La marge d'occlusion autour de l'emprise au sol d'un modèle ombré, en
 * mètres : le canevas la contient, le fondu s'occupe du reste.
 */
export const MARGE_OCCLUSION = 0.35;

/** Le dossier de chaque famille, sous la racine des images cuites. */
export const DOSSIER_FAMILLE: Readonly<Record<FamilleSprite, string>> = {
  unite: 'unites',
  batiment: 'batiments',
  terrain: 'terrains',
  decor: 'decors',
};

/** Où la cuisson écrit par défaut : le manifeste et les pages, servis par Next. */
export const RACINE_SORTIE = 'public/assets/sprites';

/** Le préfixe des chemins de page dans le manifeste, relatif à `public/`. */
export const PREFIXE_PAGES = 'assets/sprites';

/** Les brouillons : GLB préparés, travaux, rendus bruts. Ignoré par git. */
export const TEMPORAIRE = 'tmp/sprites';

/** Où sont les modèles livrés, les sources du catalogue. */
export const RACINE_MODELES = 'public/assets/modeles';
