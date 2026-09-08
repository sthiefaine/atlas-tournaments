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

/**
 * Les deux qualités. Une valeur inconnue retombe sur `auto` — y compris `haute`,
 * retirée le 6 septembre 2026 : elle forçait la chaîne sans mesure, et sur un
 * M1 elle divisait la cadence par deux. Un joueur qui l'avait choisie revient
 * à `auto`, qui mesure et décide.
 */
export type QualiteRendu = 'auto' | 'basse';

/** La liste fermée, dans l'ordre où les réglages la présentent. */
export const QUALITES_RENDU: readonly QualiteRendu[] = Object.freeze(['auto', 'basse'] as const);

/** La qualité par défaut : le rendu mesure et décide. */
export const QUALITE_PAR_DEFAUT: QualiteRendu = 'auto';

/**
 * Le **dos** du moteur (7 septembre 2026) : un seul moteur, `WebGPURenderer`,
 * qui tourne sur WebGPU quand le navigateur offre un adaptateur, et sur son
 * dos WebGL 2 sinon — le même code, les mêmes nuanceurs compilés en GLSL au
 * lieu de WGSL. La décision se prend **avant** de construire le moteur
 * (`render3d/scene.ts`, `choisirBackend`) ; ce type dit laquelle a été prise.
 */
export type BackendRendu = 'webgpu' | 'webgl';

/** Ramène n'importe quoi à une qualité valide. */
export function normaliserQualite(brut: unknown): QualiteRendu {
  return brut === 'basse' ? brut : QUALITE_PAR_DEFAUT;
}

/**
 * Le budget d'une image, en millisecondes : une image par rafraîchissement d'un
 * écran à soixante hertz. C'est la cible du §9.3 de `doc/10`, et le nombre que
 * la synchronisation verticale impose de toute façon.
 */
export const BUDGET_MS_IMAGE = 1000 / 60;

/**
 * Ce que la chaîne coûte, en multiple de l'image nue : elle redessine la scène
 * une seconde fois (normales et profondeur pour l'occlusion) et ajoute cinq
 * passes plein écran. **Mesuré ×2,3** sur un Apple M1 (`doc/10` §9.2 : 14,5 ms
 * l'image nue en calibration, 33,4 ms entre deux images une fois la chaîne
 * allumée), ×1,6 à ×2,6 sous SwiftShader.
 */
export const FACTEUR_COMPOSEUR = 2.3;

/**
 * Le seuil de la qualité `auto`, en millisecondes par image **sans** la chaîne,
 * processeur graphique compris (`msCalibration`, mesurée derrière une barrière
 * du processeur graphique : `onSubmittedWorkDone` sur WebGPU, `readPixels` sur
 * le dos WebGL).
 *
 * La règle est celle du budget : on n'allume la chaîne que si l'image
 * **composée** tiendra encore dans une image d'écran, c'est-à-dire si l'image
 * nue coûte moins que le budget divisé par le facteur — 16,7 / 2,3 ≈ 7,2 ms,
 * arrondi à sept. Ce seuil a été porté de 8 à 20 ms le 6 septembre 2026 « sur
 * la mesure », parce que le M1 de référence mesurait 12 à 18 ms l'image nue :
 * la chaîne s'allumait alors sur toutes ses cartes, à 25–36 images par seconde
 * en animation — la moitié de la cadence, et le délai que le propriétaire
 * sentait au survol. Un seuil qui couvre la machine de référence n'est pas un
 * seuil : c'est le budget qui décide. Sur ce M1, `auto` n'allume donc plus la
 * chaîne, et c'est juste ; ce qui la rallumera, c'est la baisse des appels de
 * dessin (`doc/10` §9.1), pas un seuil plus haut. `haute` reste le choix de
 * qui la veut quand même.
 */
export const SEUIL_MS_COMPOSEUR = 7;

/**
 * La rétroaction, une fois la chaîne allumée en `auto` : le nombre d'images
 * **consécutives** — la boucle n'a pas dormi entre deux — dont on prend la
 * cadence avant de juger. Trente images, c'est une demi-seconde à soixante
 * hertz, et assez pour que la compilation des programmes de la chaîne à sa
 * première image ne pèse pas sur la médiane.
 */
export const IMAGES_CADENCE = 30;

/**
 * La cadence au-delà de laquelle la chaîne est éteinte, en millisecondes entre
 * deux images consécutives. À soixante hertz une image tient en 16,7 ms ; une
 * chaîne qui fait manquer un rafraîchissement sur deux donne 33,3. Vingt-quatre
 * est entre les deux : une image manquée de temps en temps passe, une sur deux
 * ne passe pas. Un écran à cent vingt hertz qui tombe de 8,3 à 16,7 reste sous
 * le seuil, et c'est voulu : il tient encore soixante images par seconde.
 */
export const SEUIL_MS_CADENCE = 24;

/**
 * La chaîne peut-elle se monter sur ce moteur ? Elle dessine dans une cible en
 * demi-flottants. Sur **WebGPU**, `rgba16float` est dessinable par le cœur de
 * l'API : la réponse est oui, sans rien demander. Sur le dos **WebGL**, sans
 * `EXT_color_buffer_float` (ou sa version demi-flottante seule), une telle
 * cible n'est pas dessinable, et three.js **ne lève pas** : l'écran serait
 * noir, en silence. La question se pose alors aux extensions du dos
 * (`backend.extensions.has`), qu'on reçoit ici en fonction pour rester sans
 * three.js.
 */
export function composeurPossible(backend: BackendRendu, extensions: (nom: string) => boolean): boolean {
  if (backend === 'webgpu') return true;
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
 * La **médiane** d'une poignée de durées, ou `null` s'il n'en reste aucune de
 * lisible. C'est la statistique de toutes les mesures d'image de ce module, et
 * c'est délibéré : une moyenne serait tirée vers le haut par un ramasse-miettes,
 * par un onglet qui reprend la main ou par la première image d'un moteur, qui
 * crée ses pipelines et coûte mille fois les suivantes. Une image lente sur dix
 * n'est pas un appareil lent.
 */
export function mediane(durees: readonly number[]): number | null {
  const retenues = durees.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  if (retenues.length === 0) return null;
  const milieu = Math.floor(retenues.length / 2);
  return retenues.length % 2 === 1
    ? (retenues[milieu] ?? 0)
    : ((retenues[milieu - 1] ?? 0) + (retenues[milieu] ?? 0)) / 2;
}

/**
 * La durée représentative des images mesurées, ou `null` tant qu'il n'y en a
 * pas assez : la médiane des images qui suivent la première.
 */
export function msCalibration(durees: readonly number[], images = IMAGES_CALIBRATION): number | null {
  if (durees.length < images + 1) return null;
  return mediane(durees.slice(1, images + 1));
}

/**
 * La cadence représentative des dernières images consécutives, ou `null` tant
 * qu'il n'y en a pas assez : la **médiane** des `images` dernières durées entre
 * deux images. C'est la seule mesure qui compte le processeur graphique **en
 * jeu** — attendre une barrière n'est acceptable que pendant la calibration —,
 * parce que le navigateur retarde l'image suivante tant que la précédente n'est
 * pas présentée. Elle n'a de sens que sur des images consécutives : après un
 * sommeil de la boucle, l'intervalle dit quand quelqu'un a bougé, pas ce que
 * l'image coûte.
 *
 * Depuis le 8 septembre 2026, elle est mesurée **tout le temps**, chaîne de
 * post-traitement ou non, et lisible dans `MesuresRendu.msCadence` : c'est le
 * chiffre à lire quand quelqu'un dit « ça lag », et le seul qui réponde. La
 * rétroaction qui éteint la chaîne, elle, ne juge toujours que les images de
 * la chaîne (`scene.ts`) : une cadence basse sans chaîne n'accuse pas la chaîne.
 */
export function msCadence(intervalles: readonly number[], images = IMAGES_CADENCE): number | null {
  if (intervalles.length < images) return null;
  return mediane(intervalles.slice(-images));
}

/** La chaîne fait-elle manquer la cadence ? Vrai dès que la médiane dépasse le seuil. */
export function cadenceInsuffisante(msCadenceMesuree: number | null): boolean {
  return msCadenceMesuree !== null && msCadenceMesuree > SEUIL_MS_CADENCE;
}

/**
 * Faut-il dessiner par la chaîne de post-traitement ?
 *
 * - `reduit` (la préférence « animations réduites » ou `prefers-reduced-motion`)
 *   l'emporte sur tout : le grain change à chaque image, et quelqu'un qui
 *   demande moins de mouvement ne demande pas non plus plus de calcul ;
 * - `basse` ne l'allume jamais, `haute` toujours ;
 * - `auto` attend la mesure (`null` : pas encore), puis compare au seuil ; et
 *   si la rétroaction a jugé la cadence insuffisante une fois la chaîne allumée
 *   (`cadenceRefusee`), elle reste éteinte **pour la session** : une chaîne qui
 *   clignote au gré des mesures serait pire que pas de chaîne.
 */
export function decisionComposeur(
  qualite: QualiteRendu, msMesurees: number | null, reduit: boolean, cadenceRefusee = false,
): boolean {
  if (reduit) return false;
  if (qualite === 'basse') return false;
  if (cadenceRefusee) return false;
  return msMesurees !== null && msMesurees <= SEUIL_MS_COMPOSEUR;
}
