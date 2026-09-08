/**
 * L'**interface commune des rendus** (`BRIEF.md`, direction artistique révisée du
 * 5 septembre 2026).
 *
 * Le jeu ne connaît qu'un `Rendu` : une peau qui sait se monter dans un élément,
 * afficher un `EtatPartie` accompagné de la vue d'interaction, rejouer une file
 * d'événements en animations, convertir un point d'écran en case, et se démonter.
 * Le rendu 3D (`render3d/`) l'implémente
 * tous les deux, et `controleur.ts` comme `jeu.ts` ne dépendent d'aucun des deux.
 *
 * Trois règles tiennent l'ensemble :
 *
 * 1. un rendu **ne décide de rien** : il reçoit un état, il le peint ;
 * 2. il ne parle au reste du jeu qu'en **cases**, jamais en pixels ni en mètres —
 *    c'est ce qui rend le contrôleur commun aux deux ;
 * 3. `animer()` est un **rattrapage visuel** : l'état logique est déjà en avance,
 *    la promesse ne fait qu'attendre que l'image l'ait rejoint.
 */

import type { Catalogue, EtatPartie, EvenementJeu } from '../engine/index';
import type { CampId, Case } from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { ToucheJeu } from './entrees';
import type { Partition } from './partition';
import type { BackendRendu, QualiteRendu } from './qualite';
import type { Surbrillance } from './surbrillance';

/**
 * La peau. Il n'y en a plus qu'une : le rendu vectoriel a été retiré, et un
 * appareil sans WebGL 2 n'affiche pas le jeu plutôt que d'en afficher une
 * version dégradée. Le type reste un littéral pour que `data-rendu` et les
 * tests de fumée continuent de nommer ce qu'ils regardent.
 */
export type CleRendu = '3d';

/** Un point en pixels logiques dans l'élément du rendu. */
export interface PointVue { x: number; y: number }

/**
 * Le coût d'une **famille** de la scène — terrain, décor, unités, surbrillances,
 * effets — : ses triangles, et ce qu'elle demande à dessiner.
 */
export interface MesureFamille {
  triangles: number;
  /**
   * Le nombre d'objets dessinés — mailles, une maille instanciée comptée une
   * fois, sprites, nuages de points. C'est une **approximation des appels de
   * dessin** de la famille sur la seule passe de couleur : la passe d'ombres
   * redemande chacun de ceux qui portent ombre, et la chaîne de post-traitement
   * les redessine une seconde fois pour les normales.
   */
  mailles: number;
}

/**
 * Ce qu'une image a coûté (`16-realisme.md` A6). Les compteurs portent sur la
 * **dernière image dessinée, en entier** : la passe d'ombres est comptée, et,
 * quand la chaîne de post-traitement est active, la seconde passe de scène
 * (normales et profondeur) et les passes plein écran le sont aussi — c'est le
 * coût réel de l'image, pas celui de la seule géométrie. `composeur` dit
 * laquelle des deux on a mesurée.
 */
export interface MesuresRendu {
  /**
   * Les triangles de la dernière image, tels que le moteur les a comptés.
   * **Ne se compare pas d'un dos à l'autre** : le dos WebGL de three r170
   * appelle `Info.update` avec le mode de dessin là où la signature attend le
   * nombre d'instances (`mesures.ts`), et son compte est faux. `familles` dit
   * la vérité de la scène sur les deux dos.
   */
  triangles: number;
  /** Appels de dessin (*draw calls*). */
  appels: number;
  /** Durée **médiane** d'envoi des dernières images, en millisecondes. */
  msParImage: number;
  /** Vrai si l'image passe par la chaîne de post-traitement. */
  composeur: boolean;
  /**
   * La médiane des images de calibration, processeur graphique compris, en
   * millisecondes ; `null` tant qu'elle n'est pas mesurée ou hors qualité
   * `auto`. C'est la seule durée ici qui attende vraiment le dessin.
   */
  msCalibration: number | null;
  /**
   * La médiane des intervalles entre les dernières images **consécutives**, en
   * millisecondes ; `null` tant qu'il n'y en a pas assez. C'est la mesure qui
   * compte le processeur graphique en jeu, sans barrière : le navigateur
   * retient l'image suivante tant que la précédente n'est pas présentée. Seize
   * millisecondes, c'est soixante images par seconde. Absente d'une peau qui
   * ne sait pas la dire.
   */
  msCadence?: number | null;
  /** Le dos du moteur qui dessine — WebGPU, ou son repli WebGL 2 — ; `null` tant qu'il n'est pas initialisé. */
  backend: BackendRendu | null;
  /**
   * Le détail par famille, sous le nom du groupe de premier niveau de la
   * scène qui la porte. Compté sur la scène **entière**, pas sur le seul champ
   * de la caméra : les deux coïncident carte cadrée en entier, et s'écartent
   * en gros plan. Absent d'une peau qui ne sait pas le dire.
   */
  familles?: Record<string, MesureFamille>;
}

/**
 * Ce que le contrôleur donne à peindre par-dessus l'état : la sélection, les
 * cases allumées, le chemin, le curseur, le brouillard et l'ambiance.
 */
export interface VueInteraction {
  catalogue: Catalogue;
  ambiance: Ambiance;
  surbrillances: readonly Surbrillance[];
  chemin: readonly Case[];
  curseur: Case | null;
  /** Identifiant de l'unité sélectionnée. */
  selection: string | null;
  /**
   * Le chemin pointé **sort de la vue** (brouillard, `04-gameplay.md` §2) :
   * l'unité avancera d'abord et décidera une fois arrivée, le menu d'ordres ne
   * s'ouvrira pas avant. Une peau peut le dire sur la flèche — pointillés,
   * autre teinte ; absent ou faux, la flèche est celle d'un chemin ordinaire.
   */
  cheminAveugle?: boolean;
  /** Cases vues par le camp du joueur, ou `null` sans brouillard. */
  visibles: ReadonlySet<string> | null;
  /**
   * Le camp du joueur, s'il y en a un : c'est pour lui que ses unités furtives
   * se voilent — l'adversaire qui en tient une au contact la voit entière.
   * Absent — le banc, la vitrine —, toute furtive se voile.
   */
  camp?: CampId;
  /**
   * Les identifiants des unités que le joueur voit (`unitesVues` du moteur),
   * `null` sans brouillard, absent : toutes. Une furtive adverse hors contact
   * ou une unité tapie en forêt sont sur une case éclairée et pourtant
   * cachées : la case ne suffit pas à dire ce qu'on dessine.
   */
  unitesVues?: ReadonlySet<string> | null;
  /** Vrai pendant que l'adversaire joue : les rendus se calment. */
  attenteIa: boolean;
  /** Étiquette du QG, déjà traduite : un rendu n'appelle jamais `t()`. */
  etiquetteQg: string;
}

/**
 * Les gestes déjà traduits en intentions de jeu. Le rendu se charge de la
 * caméra (glisser, zoom, rotation) et ne remonte que ce qui concerne la partie.
 */
export interface GestesRendu {
  surClicCase?(c: Case): void;
  surSurvolCase?(c: Case | null): void;
  surAnnuler?(): void;
  /**
   * Un double-clic ou un appui long sur une case : demander l'inspection de
   * l'unité qui s'y trouve. Rend vrai si une inspection s'est ouverte ; sinon
   * un appui long retombe sur `surAnnuler`, comme ailleurs sur la carte.
   */
  surInspecter?(c: Case): boolean;
  surTouche?(touche: ToucheJeu): void;
}

/** La peau : tout ce que `jeu.ts` attend d'un rendu, et rien de plus. */
export interface Rendu {
  /** Laquelle des deux peaux : entre dans `data-rendu`. */
  readonly cle: CleRendu;
  /** Le canvas peint, une fois monté. Sert aux attributs `data-*` et aux tests. */
  readonly canvas: HTMLCanvasElement | null;
  /** Crée le canvas dans le conteneur et démarre la boucle. */
  monter(conteneur: HTMLElement): void;
  /** Pose l'état et la vue à peindre. Idempotent : deux appels, une image. */
  afficher(etat: EtatPartie, vue: VueInteraction): void;
  /** Rejoue une file d'événements ; la promesse tient jusqu'à la dernière image. */
  animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void>;
  /**
   * Joue une **partition** (`render/partition.ts`) : les gestes datés qu'un
   * réalisateur pur a écrits depuis les événements. Remplace `animer`, qui
   * laissait à la peau le soin de mettre en scène ; la promesse tient jusqu'à
   * la dernière image. Optionnel le temps que les deux chantiers se rejoignent.
   */
  jouer?(partition: Partition): Promise<void>;
  /** Coupe la partition en cours : tout saute à l'état final, la promesse se résout. */
  couper?(): void;
  /** Point d'écran → case de la carte, ou `null` hors carte. */
  versMonde(x: number, y: number): Case | null;
  /** Case → point d'écran (centre de la case), ou `null` si hors champ. */
  versEcran(c: Case): PointVue | null;
  /** Branche les gestes ; rend le débranchement. */
  brancher(gestes: GestesRendu): () => void;
  /** Recentre la vue sur une case, sans animation. */
  cadrer(c: Case): void;
  /** Centre une case explicitement, même si elle est déjà visible. */
  recentrer?(c: Case): void;
  /** Zoom tactile explicite : +1 rapproche, −1 éloigne. */
  zoomer?(sens: number): void;
  /** Un quart de tour autour de la carte : +1 vers la droite, −1 vers la gauche. */
  tourner?(sens: number): void;
  /**
   * Incline la caméra d'un pas : **+1 redresse** vers la vue de dessus, −1
   * penche vers l'horizon. Absent quand la peau ne sait pas s'incliner.
   */
  incliner?(sens: number): void;
  /**
   * Passe à l'inclinaison suivante, en boucle : la vue de lecture, l'oblique,
   * la rasante, puis la vue de lecture à nouveau. C'est le geste d'**un seul
   * bouton**, celui du panneau caméra — deux de plus ne tiendraient pas au
   * pouce à côté du zoom, de la rotation et du recentrage.
   */
  inclinaisonSuivante?(): void;
  /**
   * Où la peau dessine une unité **en ce moment**, en unités de scène — au
   * milieu d'un glissement, ce n'est ni sa case de départ ni celle d'arrivée.
   * Mise au point et tests de fumée : c'est ce qui prouve qu'une figurine bouge
   * sans regarder l'écran.
   */
  positionUnite?(id: string): { x: number; y: number; z: number } | null;
  /**
   * Retient la vue du joueur avant que la caméra n'aille voir ailleurs — le
   * tour de l'adversaire —, et l'y ramène ensuite. Un mouvement de caméra
   * **voulu par le joueur** entre les deux annule le retour : on ne ramène
   * jamais quelqu'un là où il a choisi de ne plus être.
   */
  retenirVue?(): void;
  revenirVue?(): void;
  /**
   * Une image PNG en `data:` de l'état courant, ou `null`. Le rendu 3D **redessine
   * de façon synchrone** avant de lire : sans cela, un tampon WebGL non préservé
   * rendrait une image vide. Sert aux tests de fumée et aux aperçus.
   */
  capturer(): string | null;
  /** Durée moyenne d'une image, en millisecondes. Sert aux mesures et au réglage. */
  msParImage(): number;
  /** Le coût de la dernière image : triangles, appels, durée, chaîne active ou non. */
  mesurer?(): MesuresRendu;
  /**
   * Change la qualité d'affichage sans remonter : la chaîne de post-traitement
   * se monte ou se démonte à l'image suivante, la caméra ne bouge pas. C'est
   * ce qui permet de comparer avec et sans occlusion sur la même vue.
   */
  qualite?(qualite: QualiteRendu): void;
  /** Retire tout : écouteurs, boucle, contextes, mémoire graphique. */
  demonter(): void;
}

/**
 * Vrai si le navigateur courant peut faire tourner le moteur : WebGPU
 * (`navigator.gpu`, sans garantie d'adaptateur — c'est `choisirBackend` qui la
 * demande, et le repli WebGL 2 prend alors), ou à défaut un contexte WebGL 2.
 *
 * Elle vit **ici** plutôt que dans `render3d/scene.ts`, où elle est née, parce
 * que l'écran-titre doit poser la question sans faire entrer le moteur WebGPU
 * dans son paquet. Il posait jusqu'ici celle de WebGL 2 seule : sur un appareil
 * qui a WebGPU sans WebGL 2, l'attract mode ne se montrait jamais, alors que le
 * moteur y aurait tourné — et par son meilleur dos.
 */
export function moteur3dDisponible(): boolean {
  try {
    const g = globalThis as { navigator?: { gpu?: unknown } };
    if (g.navigator?.gpu) return true;
  } catch {
    // Un `navigator` qui refuse de se laisser lire n'a pas de WebGPU.
  }
  return webgl2Disponible();
}

/** Vrai si le navigateur courant sait ouvrir un contexte WebGL 2. */
export function webgl2Disponible(): boolean {
  try {
    const d = (globalThis as { document?: Document }).document;
    if (!d) return false;
    const canvas = d.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    const perte = gl.getExtension('WEBGL_lose_context');
    perte?.loseContext();
    return true;
  } catch {
    return false;
  }
}


