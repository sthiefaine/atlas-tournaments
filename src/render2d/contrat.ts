/**
 * Le contrat de la peau 2D — décision du propriétaire du 23 septembre 2026
 * (`BRIEF.md`, « Sprites précalculés » ; `doc/18-rendu-sprites.md`).
 *
 * Le jeu ne dessine plus de 3D en temps réel : il **photographie** ses modèles
 * GLB une fois, hors ligne (Blender, `scripts/sprites/`), et compose ces images
 * à l'écran en WebGL 2 (`src/render2d/`). Ce fichier est la seule chose que la
 * cuisson et le rendu partagent : la projection qui les tient ensemble, le
 * format du manifeste, et ce qu'une couche dessine. Tout le reste est libre de
 * chaque côté, et c'est voulu : la cuisson peut changer d'outil, le rendu de
 * technique, sans que l'autre le sache.
 *
 * Pur : ni DOM, ni horloge, ni WebGL — les scripts de cuisson l'importent sous
 * Node, et les tests le vérifient sans navigateur. **Il ne fait que s'étendre** :
 * on y ajoute, on ne renomme ni ne retire, deux côtés le lisent sans se voir.
 */

import { cleCase, type EtatPartie } from '../engine/types';
import type { VueInteraction } from '../render/rendu';
import type { Biome, Case, Saison } from '../schemas/types';

// ---------------------------------------------------------------------------
// 1. La projection : une seule caméra, orthographique et fixe
// ---------------------------------------------------------------------------

/**
 * Densité de cuisson : pixels d'image par case, à l'échelle 1. Une case vaut
 * un mètre (`render3d/geometrie.ts` `CASE`, spec d'asset « 1 unit = 1 metre »).
 * 128 couvre un téléphone à 48 px CSS par case et trois pixels physiques par
 * pixel CSS ; au-delà, l'image s'agrandit — et reste lisse, parce qu'elle a
 * été réduite depuis bien plus grand.
 */
export const PIXELS_PAR_CASE = 128;

/** La cuisson rend à cette échelle, puis réduit : c'est ce qui rend l'image lisse. */
export const SURECHANTILLONNAGE = 4;

/**
 * Le tangage de la caméra de carte, en degrés au-dessus de l'horizontale.
 * Orthographique, lacet fixe : la caméra se tient au bas de l'écran et regarde
 * vers le haut (les lignes décroissantes). À 50°, on voit le visage d'un
 * fantassin et la façade d'une ville, et une case reste plus large que haute.
 */
export const TANGAGE_CARTE = 50;

/** Le tangage de l'écran de combat : presque de profil, comme Advance Wars. */
export const TANGAGE_PROFIL = 12;

const RADIAN = Math.PI / 180;

/** Ce que devient une profondeur au sol, à l'écran. */
export const SIN_TANGAGE = Math.sin(TANGAGE_CARTE * RADIAN);

/** Ce que devient une hauteur, à l'écran. */
export const COS_TANGAGE = Math.cos(TANGAGE_CARTE * RADIAN);

/**
 * Un point du **plan** : l'image de la carte entière à l'échelle 1, en pixels,
 * origine au coin haut-gauche de la case (0, 0), au sol. La caméra du rendu ne
 * fait que déplacer et agrandir le plan ; elle ne tourne ni ne s'incline.
 */
export interface PointPlan { X: number; Y: number }

/**
 * Monde → plan. `x` et `y` sont en cases, comme `Case` (le centre d'une case
 * est à `colonne + 0,5`, `ligne + 0,5`) ; `h` est une hauteur au-dessus du
 * sol, en cases. C'est **exactement** la caméra de cuisson : un pixel d'image
 * cuite vaut un pixel de plan, sans recalage.
 */
export function versPlan(x: number, y: number, h = 0): PointPlan {
  return {
    X: x * PIXELS_PAR_CASE,
    Y: (y * SIN_TANGAGE - h * COS_TANGAGE) * PIXELS_PAR_CASE,
  };
}

/** Plan → sol (hauteur nulle) : l'inverse exact de `versPlan(x, y, 0)`. */
export function solDepuisPlan(X: number, Y: number): { x: number; y: number } {
  return { x: X / PIXELS_PAR_CASE, y: Y / (PIXELS_PAR_CASE * SIN_TANGAGE) };
}

/** La case au sol sous un point du plan, ou `null` hors de la carte. */
export function caseDepuisPlan(X: number, Y: number, largeur: number, hauteur: number): Case | null {
  const s = solDepuisPlan(X, Y);
  const c: Case = { x: Math.floor(s.x), y: Math.floor(s.y) };
  return c.x >= 0 && c.y >= 0 && c.x < largeur && c.y < hauteur ? c : null;
}

/** Le centre d'une case, au sol, dans le plan : c'est là que tombe le pivot d'une image. */
export function centreCase(c: Case): PointPlan {
  return versPlan(c.x + 0.5, c.y + 0.5, 0);
}

/** L'emprise au sol d'une carte dans le plan, sans ce qui dépasse vers le haut. */
export function taillePlan(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  const coin = versPlan(largeur, hauteur, 0);
  return { largeur: coin.X, hauteur: coin.Y };
}

// ---------------------------------------------------------------------------
// 2. Les vues, les clips, l'éclairage
// ---------------------------------------------------------------------------

/**
 * Les vues cuites. Une unité se cuit dans trois : `droite` (de trois quarts,
 * tournée vers la droite de l'écran), `bas` (vers le joueur) et `haut` (de
 * dos). La gauche est `droite` **retournée** par le rendu. Un bâtiment ou un
 * décor se cuit en `fixe` ; un pont en `fixe` et `travers`. `profil` est la
 * vue de l'écran de combat, au tangage `TANGAGE_PROFIL`, tournée vers la droite.
 */
export const VUES = ['droite', 'bas', 'haut', 'fixe', 'travers', 'profil'] as const;
export type VueSprite = typeof VUES[number];

/**
 * Le lacet de chaque vue : la direction où **regarde** le modèle dans le plan
 * du sol, en degrés — 0 vers le joueur (le bas de l'écran), 90 vers la droite,
 * 180 vers le haut. Le GLB, lui, regarde +Z (spec d'asset) : la cuisson le
 * tourne pour qu'il regarde là.
 */
export const LACET_VUE: Readonly<Record<VueSprite, number>> = {
  droite: 60,
  bas: 20,
  haut: 160,
  fixe: 0,
  travers: 90,
  profil: 70,
};

/** Les clips des GLB (spec d'asset) : la cuisson en tire des images, elle n'en invente aucun. */
export const CLIPS = ['repos', 'deplacement', 'tir', 'touche', 'hors_jeu', 'capture'] as const;
export type ClipSprite = typeof CLIPS[number];

/** Cadence de cuisson et de lecture des clips, en images par seconde. */
export const IMAGES_PAR_SECONDE = 12;

/**
 * L'éclairage de cuisson, commun à toutes les images. Les angles disent d'où
 * **vient** la lumière dans le plan du sol : azimut 0 depuis le joueur (le bas
 * de l'écran), −90 depuis la gauche, 180 depuis le haut ; élévation au-dessus
 * de l'horizon. La lumière principale vient de l'avant-gauche : elle éclaire
 * les faces que la caméra voit. L'ombre d'un bâtiment ou d'un décor est cuite
 * dans son image (attrapeur d'ombre) ; celle d'une **unité ne l'est pas** — une
 * unité se retourne, son ombre ne doit pas changer de côté, et une unité en vol
 * pose la sienne sur la case, sous elle : le rendu la dessine (`OMBRE_UNITE`).
 */
export const ECLAIRAGE_CUISSON = {
  principale: { azimut: -40, elevation: 55 },
  contour: { azimut: 180, elevation: 30 },
} as const;

/**
 * L'ombre qu'un rendu pose sous une unité : une ellipse douce, décalée comme
 * le serait l'ombre de la lumière principale, en fraction de case.
 */
export const OMBRE_UNITE = { largeur: 0.62, hauteur: 0.3, decalageX: 0.06, decalageY: -0.04, opacite: 0.34 } as const;

/**
 * Le masque d'équipe : la cuisson peint les zones d'équipe en **blanc** et
 * écrit le masque (0 à 255) dans une page à part, aux mêmes coordonnées. Le
 * rendu multiplie : `couleur = cuite × mix(1, équipe, masque)`. C'est exact sur
 * un masque binaire — la règle du validateur de GLB —, approché sur ses bords
 * lissés, où personne ne le voit. La couleur d'équipe est celle que la 3D
 * utilise (`palette.main` du style de la nation, `assets/styles`).
 */
export const COULEUR_ZONE_EQUIPE_CUISSON = [1, 1, 1] as const;

/**
 * La page d'émission (fenêtres, feux) s'**ajoute** à la couleur, pondérée :
 * presque rien le jour — une lampe allumée ne se voit pas au soleil —, pleine
 * la nuit, quand `ambiance.villesEclairees` est vrai. Valeurs de la cuisson,
 * qui a retiré l'émission de la couleur pour la mettre dans sa page.
 */
export const EMISSION_JOUR = 0.06;
export const EMISSION_NUIT = 1;

// ---------------------------------------------------------------------------
// 3. Le manifeste des images cuites
// ---------------------------------------------------------------------------

/** Version du format : un manifeste d'une autre version est refusé, pas deviné. */
export const VERSION_SPRITES = 1;

/** Où le rendu lit le manifeste (sous `public/`). */
export const CHEMIN_MANIFESTE = '/assets/sprites/manifeste.json';

/** Les familles d'entrées. */
export const FAMILLES_SPRITE = ['unite', 'batiment', 'terrain', 'decor'] as const;
export type FamilleSprite = typeof FAMILLES_SPRITE[number];

/** Une image dans une page d'atlas. */
export interface CadreSprite {
  /** Index de la page, dans `EntreeSprite.pages`. */
  page: number;
  /** Rectangle dans la page, en pixels. */
  x: number;
  y: number;
  l: number;
  h: number;
  /**
   * Le pivot dans le rectangle, en pixels : la projection de l'origine du
   * modèle — le point de contact au sol, au centre de la case. Il peut tomber
   * hors du rectangle, qui est rogné au plus près des pixels visibles.
   */
  px: number;
  py: number;
}

/** Un clip cuit dans une vue. */
export interface AnimationSprite {
  vue: VueSprite;
  clip: ClipSprite;
  boucle: boolean;
  /** Images par seconde de lecture. */
  ips: number;
  cadres: CadreSprite[];
}

/** Une page d'atlas : une image couleur, et ses calques facultatifs aux mêmes coordonnées. */
export interface PageSprite {
  /** Chemin sous `public/`, sans barre initiale : `assets/sprites/unites/char_leger.webp`. */
  couleur: string;
  /** Masque d'équipe, niveaux de gris ; absent quand l'entrée n'a aucune zone d'équipe. */
  masque?: string;
  /** Lumières propres (fenêtres, feux), ajoutées la nuit ; facultatif. */
  emission?: string;
  largeur: number;
  hauteur: number;
}

/** Une entrée : un modèle photographié, toutes ses vues et tous ses clips. */
export interface EntreeSprite {
  /** L'identifiant : celui du GLB source (`unite_char_leger_base`), ou `idDecor(…)`. */
  id: string;
  famille: FamilleSprite;
  /** La clé de jeu : `CleUnite` d'une unité, `CleTerrain` d'un bâtiment ou d'un terrain, l'essence d'un décor. */
  cle: string;
  /** Pays d'un kit national (`fr`), saison d'un décor… ; absent pour une base commune. */
  variante?: string;
  /** Le fichier cuit et son empreinte : une source qui change se recuit. */
  source: { fichier: string; sha256: string };
  pages: PageSprite[];
  animations: AnimationSprite[];
}

/** Le manifeste : tout ce que la cuisson a produit, par identifiant. */
export interface ManifesteSprites {
  version: typeof VERSION_SPRITES;
  pixelsParCase: number;
  tangage: number;
  tangageProfil: number;
  entrees: Record<string, EntreeSprite>;
}

/** L'identifiant de l'entrée d'une unité commune. */
export function idUnite(cle: string): string {
  return `unite_${cle}_base`;
}

/** L'identifiant de l'entrée d'un bâtiment commun ; un pays donne son kit (`batiment_qg_fr`). */
export function idBatiment(cle: string, pays?: string): string {
  return pays ? `batiment_${cle}_${pays}` : `batiment_${cle}_base`;
}

// ---------------------------------------------------------------------------
// 4. Le décor
// ---------------------------------------------------------------------------

/**
 * Les essences de décor. C'est le **placement** (`render2d/sol/`) qui choisit
 * l'essence d'après le terrain et le biome ; la cuisson produit, pour chaque
 * essence et chaque saison, au moins deux variantes numérotées à partir de 1.
 * Les rochers gardent l'identifiant de leur GLB (`decor_rocher_cotier`).
 */
export const ESSENCES_DECOR = [
  'feuillu',
  'conifere',
  'palmier',
  'tropical',
  'buisson',
  'touffe',
  'roseau',
  'montagne',
  'montagne_aride',
  'montagne_volcan',
] as const;
export type EssenceDecor = typeof ESSENCES_DECOR[number];

/** La saison d'un décor : une des quatre, ou `toutes` quand elle ne se voit pas dessus. */
export type SaisonDecor = Saison | 'toutes';

/** L'identifiant d'une variante de décor : `decor_feuillu_automne_2`. */
export function idDecor(essence: EssenceDecor, saison: SaisonDecor, n: number): string {
  return `decor_${essence}_${saison}_${n}`;
}

// ---------------------------------------------------------------------------
// 5. Ce que le rendu dessine
// ---------------------------------------------------------------------------

/**
 * Une image posée à l'écran : ce qu'une couche remet au lot de sprites. Pur
 * donnée — le placement du décor, les unités et les effets fabriquent des
 * instances, un seul endroit les dessine.
 */
export interface InstanceSprite {
  /** L'entrée du manifeste. */
  entree: string;
  /** Index dans `EntreeSprite.animations`. */
  animation: number;
  /** Index dans `AnimationSprite.cadres`. */
  cadre: number;
  /** Position au sol, en cases (`x` colonne, `y` ligne ; le centre d'une case à +0,5). */
  x: number;
  y: number;
  /** Hauteur au-dessus du sol, en cases : un appareil en vol. */
  h?: number;
  /** Retournée gauche-droite. */
  miroir?: boolean;
  /** Couleur d'équipe, sRGB de 0 à 1 ; `null` ou absente : blanc (aucune teinte). */
  equipe?: readonly [number, number, number] | null;
  /** Multiplicateur de couleur, sRGB de 0 à 1. */
  teinte?: readonly [number, number, number];
  /** 0 transparent, 1 opaque. */
  opacite?: number;
  /** 0 rien, 1 blanc : l'éclat d'un coup reçu. */
  eclat?: number;
  /** 1 vue, 0 noire : le brouillard de guerre, par case. */
  vue?: number;
  /** Agrandissement autour du pivot. */
  echelle?: number;
}

/** Les calques dans l'ordre où ils se peignent : le premier est au fond. */
export const ORDRE_CALQUES = [
  'sol',
  'voies',
  'surbrillances',
  'volumes',
  'ombres_unites',
  'unites',
  'effets',
  'meteo',
  'etalonnage',
] as const;
export type CalqueRendu = typeof ORDRE_CALQUES[number];

/**
 * Ce qu'une couche qui dessine elle-même — le sol, par son nuanceur — reçoit à
 * chaque image. Le plan va vers l'écran par une seule matrice : la caméra.
 */
export interface ContexteImage {
  gl: WebGL2RenderingContext;
  /** Matrice 3 × 3, colonne par colonne : coordonnées de plan → espace de découpe. */
  planVersDecoupe: Float32Array;
  /** Pixels physiques par pixel de plan : le zoom multiplié par le ratio de pixels. */
  echelle: number;
  /** Taille du tampon, en pixels physiques. */
  largeur: number;
  hauteur: number;
  /** Horloge de rendu, en millisecondes : l'eau, les feuillages. Jamais une règle. */
  tempsMs: number;
  /** Animations réduites : rien ne bouge de soi-même. */
  reduit: boolean;
}

/** Une couche qui dessine elle-même. */
export interface CoucheGl {
  dessiner(ctx: ContexteImage): void;
  dispose(): void;
}

/** Ce que le sol sait de la partie en naissant. */
export interface OptionsSol {
  biome: Biome;
  /** Animations réduites : l'eau ne bouge pas, une marée se pose d'un coup. */
  reduit: boolean;
  /** Le manifeste, s'il est arrivé : le décor y cherche ses images, et dessine un repli sinon. */
  manifeste: ManifesteSprites | null;
}

/**
 * Le sol (`render2d/sol/`) : le terrain par son nuanceur, les routes et les
 * rivières, et le **placement** du décor. Il ne dessine pas le décor lui-même :
 * il rend des instances, que le lot de sprites peint dans le calque `volumes`
 * avec les bâtiments, triées par ligne.
 */
export interface CoucheSol extends CoucheGl {
  /**
   * Pose le terrain courant, le climat et le brouillard (`niveauxBrouillard`).
   * Rend vrai si l'image doit être redessinée. Une marée ou un chantier du
   * génie change la grille **en cours de partie** : le sol relit
   * `signatureTerrain` du moteur, jamais une copie prise au montage.
   */
  maj(etat: EtatPartie, vue: VueInteraction, brouillard: Uint8Array): boolean;
  /** Les images de décor (arbres, montagnes, ponts, rochers…) à peindre dans le calque `volumes`. */
  volumes(): readonly InstanceSprite[];
  /** Vrai tant qu'une transition (marée, saison) se joue : la boucle continue. */
  enMouvement(): boolean;
  /**
   * Vrai si le sol porte une animation d'ambiance — l'eau qui ondule — qui
   * mérite une image au pas d'ambiance du moteur (12 par seconde), même quand
   * rien d'autre ne bouge. Facultatif : absent ou faux, le sol ne réclame rien,
   * et sous animations réduites il doit rendre faux.
   */
  ambiant?(): boolean;
  /**
   * Le mode tactique (`Rendu.modeTactique`) : le sol retire sa végétation de
   * repli (arbres, hautes herbes dessinés par le nuanceur) comme le moteur
   * retire la végétation cuite ; le relief, les rochers et les ponts restent.
   * Le moteur le rappelle après chaque création du sol, pour que le mode
   * survive au manifeste qui arrive.
   */
  tactique?(actif: boolean): void;
}

/** Ce que `render2d/sol/index.ts` exporte sous le nom `creerSol`. */
export type FabriqueSol = (gl: WebGL2RenderingContext, etat: EtatPartie, options: OptionsSol) => CoucheSol;

/**
 * Le brouillard d'une carte, une valeur par case (255 vue, 0 cachée), ligne
 * par ligne : c'est la texture que le sol lit et la valeur que chaque instance
 * reçoit. `null` (pas de brouillard) rend tout vu.
 */
export function niveauxBrouillard(
  largeur: number, hauteur: number, visibles: ReadonlySet<string> | null,
): Uint8Array {
  const n = new Uint8Array(largeur * hauteur);
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      n[y * largeur + x] = visibles === null || visibles.has(cleCase({ x, y })) ? 255 : 0;
    }
  }
  return n;
}
