/**
 * L'**interface commune des rendus** (`BRIEF.md`, direction artistique révisée du
 * 5 septembre 2026).
 *
 * Le jeu ne connaît qu'un `Rendu` : une peau qui sait se monter dans un élément,
 * afficher un `EtatPartie` accompagné de la vue d'interaction, rejouer une file
 * d'événements en animations, convertir un point d'écran en case, et se démonter.
 * Le rendu vectoriel 2D (`rendu2d.ts`) et le rendu 3D (`render3d/`) l'implémentent
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
import type { Case } from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { ToucheJeu } from './entrees';
import type { Surbrillance } from './scene';

/** Les deux peaux disponibles. */
export type CleRendu = '2d' | '3d';

/** Ce que la page demande : une peau précise, ou le meilleur disponible. */
export type PreferenceRendu = CleRendu | 'auto';

/** Un point en pixels logiques dans l'élément du rendu. */
export interface PointVue { x: number; y: number }

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
  /** Cases vues par le camp du joueur, ou `null` sans brouillard. */
  visibles: ReadonlySet<string> | null;
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
  /** Point d'écran → case de la carte, ou `null` hors carte. */
  versMonde(x: number, y: number): Case | null;
  /** Case → point d'écran (centre de la case), ou `null` si hors champ. */
  versEcran(c: Case): PointVue | null;
  /** Branche les gestes ; rend le débranchement. */
  brancher(gestes: GestesRendu): () => void;
  /** Recentre la vue sur une case, sans animation. */
  cadrer(c: Case): void;
  /**
   * Une image PNG en `data:` de l'état courant, ou `null`. Le rendu 3D **redessine
   * de façon synchrone** avant de lire : sans cela, un tampon WebGL non préservé
   * rendrait une image vide. Sert aux tests de fumée et aux aperçus.
   */
  capturer(): string | null;
  /** Durée moyenne d'une image, en millisecondes. Sert aux mesures et au réglage. */
  msParImage(): number;
  /** Retire tout : écouteurs, boucle, contextes, mémoire graphique. */
  demonter(): void;
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

/**
 * Résout la préférence de la page en peau réelle : `auto` prend la 3D quand
 * WebGL 2 répond, et retombe sur le vectoriel sinon — c'est la promesse de repli
 * du brief, et elle vaut aussi pour les navigateurs sans canvas accéléré.
 */
export function choisirRendu(preference: PreferenceRendu = 'auto'): CleRendu {
  if (preference === '2d') return '2d';
  if (preference === '3d') return '3d';
  return webgl2Disponible() ? '3d' : '2d';
}

/** Lit une préférence de rendu depuis une chaîne (`?rendu=…`). */
export function preferenceDe(valeur: string | null | undefined): PreferenceRendu {
  if (valeur === '2d' || valeur === '3d' || valeur === 'auto') return valeur;
  return 'auto';
}
