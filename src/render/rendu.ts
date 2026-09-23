/**
 * L'**interface commune des rendus** (`BRIEF.md`, direction artistique révisée du
 * 5 septembre 2026).
 *
 * Le jeu ne connaît qu'un `Rendu` : une peau qui sait se monter dans un élément,
 * afficher un `EtatPartie` accompagné de la vue d'interaction, rejouer une file
 * d'événements en animations, convertir un point d'écran en case, et se démonter.
 * La peau est celle des images cuites (`render2d/`, décision du 23 septembre
 * 2026) ; la 3D temps réel, qui l'implémentait aussi, est retirée. L'interface
 * reste la couture : `render/` n'a pas le droit d'importer `render2d/`, et
 * `controleur.ts` comme `jeu.ts` ne dépendent pas de la peau.
 *
 * Trois règles tiennent l'ensemble :
 *
 * 1. un rendu **ne décide de rien** : il reçoit un état, il le peint ;
 * 2. il ne parle au reste du jeu qu'en **cases**, jamais en pixels ni en mètres —
 *    c'est ce qui rend le contrôleur commun aux deux ;
 * 3. `animer()` est un **rattrapage visuel** : l'état logique est déjà en avance,
 *    la promesse ne fait qu'attendre que l'image l'ait rejoint.
 */

import type { ImageMesuree } from './mesure-performance';
import type { Catalogue, EtatPartie, EvenementJeu } from '../engine/index';
import type { CampId, Case } from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { ToucheJeu } from './entrees';
import type { Partition } from './partition';
import type { BackendRendu } from './qualite';
import type { Surbrillance } from './surbrillance';

/**
 * La peau : `2d`, les images cuites depuis les modèles (décision du
 * 23 septembre 2026, `src/render2d/`). Il n'y en a plus d'autre — la 3D temps
 * réel, `3d`, a été retirée le même jour —, mais le type reste un littéral pour
 * que `data-rendu` et les specs nomment ce qu'ils regardent.
 */
export type CleRendu = '2d';

/** Un point en pixels logiques dans l'élément du rendu. */
export interface PointVue { x: number; y: number }

/** Présentation d'un duel : suit le temps de la partition, sans toucher au combat. */
export interface VueCombat { avancer(progression: number): void; fermer(): void }

/**
 * Le coût d'une **famille** de la scène — terrain, décor, unités, surbrillances,
 * effets — : ses triangles, et ce qu'elle demande à dessiner.
 */
export interface MesureFamille {
  triangles: number;
  /**
   * Ce que la famille demande à dessiner : ses appels de dessin — pour la peau
   * 2D, un par suite d'images d'un calque qui partagent une page. Le nom vient
   * de la 3D retirée, qui y comptait ses mailles.
   */
  mailles: number;
}

/**
 * Ce qu'une image a coûté (`16-realisme.md` A6). Les compteurs portent sur la
 * **dernière image dessinée, en entier**. Certains champs — `composeur`,
 * `msCalibration` — ne servaient qu'à la 3D retirée ; la peau 2D les remplit
 * de leur valeur neutre, et la forme reste pour que l'atelier et le diagnostic
 * de performance lisent le même relevé.
 */
export interface MesuresRendu {
  /** Les triangles de la dernière image, tels que la peau les a comptés. */
  triangles: number;
  /** Appels de dessin (*draw calls*). */
  appels: number;
  /** Durée **médiane** d'envoi des dernières images, en millisecondes. */
  msParImage: number;
  /**
   * Vrai si l'image passe par une chaîne de post-traitement. Celle de la 3D
   * retirée (occlusion, vignettage, grain) n'a pas d'équivalent en 2D : la peau
   * répond faux.
   */
  composeur: boolean;
  /**
   * La médiane d'images de calibration, processeur graphique compris, en
   * millisecondes, ou `null`. La 3D retirée la mesurait pour décider de sa
   * chaîne de post-traitement ; la peau 2D ne calibre rien et répond `null`.
   */
  msCalibration: number | null;
  /**
   * La médiane des intervalles entre les dernières images **consécutives**, en
   * millisecondes ; `null` tant qu'il n'y en a pas assez. Cette cadence inclut les attentes du navigateur et les pauses de la
   * boucle ; elle ne mesure pas directement le temps GPU. Le diagnostic
   * sépare repos, action et combat pour éviter de confondre repos et lenteur. Absente d'une peau qui
   * ne sait pas la dire.
   */
  msCadence?: number | null;
  /** Le dos qui dessine — WebGL 2 — ; `null` tant que la peau n'a pas de contexte. */
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
/**
 * Une **marque** posée sur une unité par le télégraphage d'un super de la
 * faction (`doc/refonte/supers-vilains.md`) : `designee`, un rayon adverse la
 * frapperait maintenant ; `menacee`, une impulsion adverse pourrait l'abattre.
 * C'est de la lecture, jamais une règle : la carte dit ce que le joueur pourrait
 * calculer lui-même.
 */
export type MarqueUnite = 'designee' | 'menacee';

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
  /**
   * Les marques du télégraphage, par identifiant d'unité (`MarqueUnite`) ;
   * `null` ou absent : aucune. Une peau les pose au-dessus de la figurine, en
   * orange — la couleur du matériel à l'essai, celle du badge des Gris.
   */
  marques?: ReadonlyMap<string, MarqueUnite> | null;
  /**
   * Les mêmes marques, posées sur des **cases** (clé `cleCase`) : `menacee`
   * sur une usine qu'une impulsion tient. `null` ou absent : aucune.
   */
  marquesCases?: ReadonlyMap<string, MarqueUnite> | null;
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
  ouvrirCombat?(hote: HTMLElement, geste: Extract<import('./partition').Geste, { genre: 'duel' }>): VueCombat | null;
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
  /** Réduit le décor et affiche les repères de camp et de rôle. */
  modeTactique?(actif: boolean): void;
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
   * Une image PNG en `data:` de l'état courant, ou `null`. La peau **redessine de
   * façon synchrone** avant de lire : sans cela, un tampon WebGL non préservé
   * rendrait une image vide. Sert aux tests de fumée et aux aperçus.
   */
  capturer(): string | null;
  /** Durée moyenne d'une image, en millisecondes. Sert aux mesures et au réglage. */
  msParImage(): number;
  /** Le coût de la dernière image : triangles, appels, durée, chaîne active ou non. */
  mesurer?(): MesuresRendu;
  /** Abonnement opt-in : aucun relevé ni envoi réseau en jeu normal. */
  observerImages?(observer: (image: ImageMesuree) => void): () => void;
  /**
   * Le monde est-il **bâti**, et non seulement dessiné une première fois ?
   *
   * Les deux ne sont pas la même chose depuis que la peau montre le sol d'abord
   * puis pose décor, unités et préchauffage en tranches : la première image
   * tombe tôt — c'est tout l'intérêt —, mais chaque tranche qui suit bloque le
   * fil principal le temps de bâtir ou de compiler. Une réplique frappée lettre
   * à lettre pendant ce temps se voit saccader, et c'est ce que le propriétaire
   * a signalé le 8 septembre 2026 en jouant `villes_du_bocage`.
   *
   * Absente d'une peau qui ne bâtit rien en tranches : l'appelant n'attend
   * alors personne.
   */
  mondeBati?(): boolean;
  /** Retire tout : écouteurs, boucle, contextes, mémoire graphique. */
  demonter(): void;
}
