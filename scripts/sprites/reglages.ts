/**
 * Les réglages de la cuisson : tout ce que la chaîne choisit librement, là où
 * le contrat (`src/render2d/contrat.ts`) ne dit rien. La projection, les vues,
 * les clips, la cadence et la direction des lumières sont au contrat et ne se
 * recopient pas ici ; ce fichier ne porte que des forces, des marges, des
 * qualités et des chemins. Le contour (couleur, épaisseur, opacité par
 * famille) est lu dans la charte des figurines, qui en fait foi.
 *
 * Toute valeur de ce fichier entre dans l'empreinte de cuisson d'une entrée,
 * le contour compris : en changer une recuit tout au prochain
 * `npm run cuire:sprites -- --tout`.
 * Changer le script Blender, lui, n'est pas vu : c'est `VERSION_CUISSON` qu'on
 * incrémente alors.
 */

import { ECLAIRAGE_CUISSON, FAMILLES_SPRITE, type FamilleSprite } from '../../src/render2d/contrat';
import charte from '../production/figurines/charte.json';

import { srgbVersLineaire } from './image';

/**
 * Incrémentée quand la chaîne change de comportement sans qu'un réglage change.
 * 2 (23 septembre 2026, soir) : lumière symétrique et contour cuit, la charte
 * des figurines (`scripts/production/figurines/charte.json`).
 */
export const VERSION_CUISSON = 2;

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
 * Ce que l'éclairage doit rendre sur une face blanche mate d'une unité (le ciel
 * uniforme la voit de partout : une unité n'a pas de sol) : la face
 * **horizontale** à 1,0 exactement — un albédo sRGB s'y lit tel quel, et une
 * zone d'équipe cuite en blanc, multipliée par la couleur d'équipe, rend cette
 * couleur, pas plus claire —, la face tournée **vers le joueur** à 0,68, et les
 * **flancs** à 0,45. Charte du 23 septembre 2026 : la moitié de l'armée est
 * dessinée en miroir, la lumière est donc symétrique (principale depuis le
 * joueur, contour depuis le haut de l'écran), et les deux flancs reçoivent la
 * même lumière, celle du ciel seul.
 */
export const CLARTES_VISEES = { horizontale: 1, joueur: 0.68, flanc: 0.45 } as const;

const RAD = Math.PI / 180;

/**
 * Les forces qui rendent `CLARTES_VISEES` sous les directions du contrat. Une
 * face blanche lambertienne de normale `n` renvoie `ciel + Σ force/π · max(0, n·d)` :
 * - un flanc (normale ±X) ne voit ni la principale, qui vient du joueur, ni le
 *   contour, qui vient du haut de l'écran : il ne reçoit que le ciel ;
 * - la face tournée vers le joueur voit la principale sous `cos(élévation)` ;
 * - la face horizontale voit les deux sous le sinus de leur élévation.
 */
function forcesEclairage(): { principale: number; contour: number; ciel: number } {
  const p = ECLAIRAGE_CUISSON.principale;
  const c = ECLAIRAGE_CUISSON.contour;
  const ciel = CLARTES_VISEES.flanc;
  const kP = (CLARTES_VISEES.joueur - ciel) / (Math.cos(p.azimut * RAD) * Math.cos(p.elevation * RAD));
  const kC = (CLARTES_VISEES.horizontale - ciel - kP * Math.sin(p.elevation * RAD)) / Math.sin(c.elevation * RAD);
  return { principale: kP * Math.PI, contour: kC * Math.PI, ciel };
}

const FORCES = forcesEclairage();

/**
 * L'éclairage, en unités de Cycles. Le contrat donne les directions, les forces
 * sortent de `CLARTES_VISEES` (principale ≈ 1,445, contour ≈ 0,953, ciel 0,45 ;
 * `tests/sprites/eclairage.test.ts` les recalcule, `calibration_lumiere` les
 * mesure). Lumières blanches : l'étalonnage de saison, de phase et de météo est
 * au rendu.
 */
export const ECLAIRAGE = {
  principale: { ...ECLAIRAGE_CUISSON.principale, force: FORCES.principale, angle: 3, ombre: true },
  contour: { ...ECLAIRAGE_CUISSON.contour, force: FORCES.contour, angle: 5, ombre: false },
  ciel: FORCES.ciel,
} as const;

/** Un vecteur de direction, dans le repère de Blender (x droite, y haut de l'écran, z en l'air). */
type Direction = readonly [number, number, number];

/** La direction **vers** une lumière du contrat (la règle de `cuire_entree.py`, `vers_la_source`). */
export function versLaSource(azimut: number, elevation: number): Direction {
  const a = azimut * RAD;
  const e = elevation * RAD;
  return [Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), Math.sin(e)];
}

/**
 * La clarté d'une face blanche mate de normale `n` (repère de Blender), sans
 * rien qui l'occulte : ce que la calibration mesure. Pur, pour le test.
 */
export function clarteFace(n: Direction, e: typeof ECLAIRAGE = ECLAIRAGE): number {
  let total = e.ciel;
  for (const l of [e.principale, e.contour]) {
    const d = versLaSource(l.azimut, l.elevation);
    total += (l.force / Math.PI) * Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
  }
  return total;
}

/**
 * Le contour cuit d'une famille : un anneau autour de la couverture du modèle,
 * posé **sous** lui à l'échelle 4 (`image.ts`, `contourner`). Couleur en
 * lumière linéaire.
 */
export interface ReglageContour {
  couleur: readonly [number, number, number];
  opacite: number;
  /** Épaisseur de l'anneau, en pixels de l'échelle 4. */
  epaisseur: number;
  /** La couverture à partir de laquelle un pixel rendu est du modèle. */
  seuil: number;
}

function hexVersLineaire(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbVersLineaire(v / 255)) as [number, number, number];
}

/**
 * Le contour de chaque famille, lu dans la charte des figurines : c'est elle
 * qui en fait foi (couleur, épaisseur, opacité par famille). Une opacité nulle
 * ou absente : pas de contour.
 */
export const CONTOUR_PAR_FAMILLE: Readonly<Record<FamilleSprite, ReglageContour | null>> = Object.fromEntries(
  FAMILLES_SPRITE.map((f) => {
    const opacite = (charte.contour.opacite as Partial<Record<FamilleSprite, number>>)[f] ?? 0;
    const reglage: ReglageContour | null = opacite > 0
      ? { couleur: hexVersLineaire(charte.contour.hex), opacite, epaisseur: charte.contour.epaisseurEchelle4, seuil: charte.contour.seuilCouverture }
      : null;
    return [f, reglage];
  }),
) as Record<FamilleSprite, ReglageContour | null>;

/**
 * La marge du canevas d'une entrée, en pixels livrés : `MARGE_CANEVAS`, plus
 * l'épaisseur du contour quand il y en a un — sans quoi l'anneau toucherait le
 * bord et serait coupé.
 */
export function margeCanevas(contour: ReglageContour | null, surechantillonnage: number): number {
  return MARGE_CANEVAS + (contour ? Math.ceil(contour.epaisseur / surechantillonnage) + 1 : 0);
}

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
