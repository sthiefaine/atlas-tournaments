/**
 * La **qualité d'affichage** : ce que le joueur choisit dans `/reglages`, et la
 * décision que le rendu en tire.
 *
 * Trois valeurs, et la liste est fermée : `auto` (le rendu mesure ses premières
 * images et décide seul), `haute` (le post-traitement toujours), `basse`
 * (jamais). Le post-traitement en question est la chaîne du lot A de
 * `16-realisme.md` — occlusion ambiante d'écran, vignettage, grain — qui coûte
 * une seconde passe de scène et trois passes plein écran : sur un rasteriseur
 * logiciel ou un téléphone qui peine, c'est ce qu'il faut couper en premier.
 *
 * Tout ici est **pur et sans three.js** : ce module vit dans `render/` pour que
 * la page des réglages puisse l'importer sans tirer le moteur ni la peau, et
 * pour que la décision se teste à sec (`tests/render/qualite.test.ts`).
 */

/** Les trois qualités. Une valeur inconnue retombe sur `auto`. */
export type QualiteRendu = 'auto' | 'haute' | 'basse';

/** La liste fermée, dans l'ordre où les réglages la présentent. */
export const QUALITES_RENDU: readonly QualiteRendu[] = Object.freeze(['auto', 'haute', 'basse'] as const);

/** La qualité par défaut : le rendu mesure et décide. */
export const QUALITE_PAR_DEFAUT: QualiteRendu = 'auto';

/** Ramène n'importe quoi à une qualité valide. */
export function normaliserQualite(brut: unknown): QualiteRendu {
  return brut === 'haute' || brut === 'basse' ? brut : QUALITE_PAR_DEFAUT;
}

/**
 * Le seuil de la qualité `auto`, en millisecondes par image **sans** la chaîne.
 *
 * La chaîne redessine la scène une seconde fois (normales et profondeur pour
 * l'occlusion, sans lumières ni ombres : la carte d'ombre n'est calculée
 * qu'une fois par image) et ajoute cinq passes plein écran : une image
 * composée coûte environ deux fois l'image nue. Sous huit millisecondes,
 * l'image composée tient sous les vingt, donc une animation reste fluide sur
 * un portable à circuit graphique intégré (cinq millisecondes l'image nue,
 * mesuré à la main) ; un rasteriseur logiciel, à cinq cents millisecondes et
 * plus l'image, ne l'atteint jamais, et c'est voulu — le test de fumée tourne
 * dessus.
 */
export const SEUIL_MS_COMPOSEUR = 8;

/**
 * La chaîne peut-elle se monter sur ce contexte ? Elle dessine dans une cible
 * en demi-flottants, multi-échantillons ; sans `EXT_color_buffer_float` (ou sa
 * version demi-flottante seule), une telle cible n'est pas dessinable, et
 * three.js **ne lève pas** : l'écran serait noir, en silence. La question se
 * pose au contexte par `renderer.extensions.has`, qu'on reçoit ici en fonction
 * pour rester sans three.js.
 */
export function composeurPossible(extensions: (nom: string) => boolean): boolean {
  return extensions('EXT_color_buffer_float') || extensions('EXT_color_buffer_half_float');
}

/**
 * Le nombre d'images mesurées avant de décider. La toute première image d'une
 * scène compile les programmes et téléverse les textures : elle coûte dix à
 * cent fois les suivantes et n'est **pas** comptée — on attend donc une image
 * de plus que ce nombre.
 */
export const IMAGES_CALIBRATION = 10;

/**
 * La durée représentative des images mesurées, ou `null` tant qu'il n'y en a
 * pas assez. C'est la **médiane** des images qui suivent la première : une
 * moyenne serait tirée vers le haut par un ramasse-miettes ou un onglet qui
 * reprend la main, et une image lente sur dix n'est pas un appareil lent.
 */
export function msCalibration(durees: readonly number[], images = IMAGES_CALIBRATION): number | null {
  if (durees.length < images + 1) return null;
  const retenues = durees.slice(1, images + 1).filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  if (retenues.length === 0) return null;
  const milieu = Math.floor(retenues.length / 2);
  return retenues.length % 2 === 1
    ? (retenues[milieu] ?? 0)
    : ((retenues[milieu - 1] ?? 0) + (retenues[milieu] ?? 0)) / 2;
}

/**
 * Faut-il dessiner par la chaîne de post-traitement ?
 *
 * - `reduit` (la préférence « animations réduites » ou `prefers-reduced-motion`)
 *   l'emporte sur tout : le grain change à chaque image, et quelqu'un qui
 *   demande moins de mouvement ne demande pas non plus plus de calcul ;
 * - `basse` ne l'allume jamais, `haute` toujours ;
 * - `auto` attend la mesure (`null` : pas encore), puis compare au seuil.
 */
export function decisionComposeur(
  qualite: QualiteRendu, msMesurees: number | null, reduit: boolean,
): boolean {
  if (reduit) return false;
  if (qualite === 'basse') return false;
  if (qualite === 'haute') return true;
  return msMesurees !== null && msMesurees <= SEUIL_MS_COMPOSEUR;
}
