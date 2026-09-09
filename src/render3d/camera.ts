/**
 * La caméra du plateau : **perspective, vue de dessus à faible inclinaison**.
 *
 * Le brief fixe le cadre : **tangage inclinable** entre 30° et 75° au-dessus de
 * l'horizontale (68° par défaut, révision du 8 septembre 2026 — voir
 * `TANGAGE_MIN`), bearing libre, avec raccourcis **par quarts de tour** (Q et E),
 * zoom borné (molette, pincement, + et −), glisser au un doigt ou bouton droit.
 * Un tap reste au jeu. Le cadrage conserve des cases lisibles sur téléphone,
 * quitte à explorer la carte en glissant.
 *
 * Tout ce qui **dure** — l'inertie d'un glisser lâché, l'interpolation d'un pas
 * de zoom, le recentrage d'un double-tap — passe par `avancer(ms)`, que la
 * boucle paresseuse appelle à chaque image comme pour les autres animations.
 * Les gestes ne portent donc aucune horloge, et la caméra se rejoue à sec.
 *
 * Les fonctions du haut de fichier sont **pures** : elles ne connaissent ni le
 * DOM ni three.js et se testent directement (`tests/render3d/camera.test.ts`).
 */

import * as THREE from 'three/webgpu';

import type { Case } from '../schemas/types';
import { CASE, mondeVersCase } from './geometrie';

/**
 * Tangage minimal, en degrés au-dessus de l'horizontale.
 *
 * **Abaissé de 60° à 30° le 8 septembre 2026**, à la demande du propriétaire
 * (« on est toujours en vue du dessus »). `10-rendu-3d.md` §3.2 refusait le
 * dessous de 60° parce que les unités du fond se cachent les unes derrière les
 * autres : c'est vrai, et c'est désormais **le choix du joueur**, qui redresse
 * d'un geste et retrouve la vue de lecture. Ce qui, lui, n'est pas négociable
 * est la borne : le demi-champ vertical vaut 21° (`FOV` / 2), donc sous 25° le
 * rayon du haut de l'écran passe l'horizon, et le champ visible au sol comme le
 * cadre d'ombre partent à l'infini (`ombres.ts`, `champVisibleAuSol`). Trente
 * degrés laissent neuf degrés de marge.
 */
export const TANGAGE_MIN = 30;
/** Tangage maximal : au-delà, la lecture des unités s'aplatit. */
export const TANGAGE_MAX = 75;
/** Tangage par défaut : la vue de lecture, celle où la partie se joue. */
export const TANGAGE_DEFAUT = 68;

/**
 * Les trois inclinaisons du **bouton unique** : la vue de lecture, l'oblique où
 * le relief et les figurines prennent du volume, la rasante où l'on regarde le
 * plateau presque de face. Un bouton qui fait le tour plutôt que deux boutons :
 * le panneau caméra en porte déjà cinq, et sept ne tiennent pas au pouce.
 */
export const PALIERS_TANGAGE = [TANGAGE_DEFAUT, 48, 32] as const;

/** Un pas d'inclinaison, en degrés : la touche, la molette, le banc. */
export const PAS_TANGAGE = 7;

/**
 * Ce qu'un pixel de glisser à deux doigts vaut en degrés : la plage entière se
 * couvre en 180 px, soit un pouce d'écran. Plus fin, on n'arrive jamais en bas ;
 * plus gros, le moindre tremblement bascule la vue.
 */
export const DEGRES_PAR_PIXEL = 0.25;

/** Champ de vision vertical, en degrés. */
export const FOV = 42;

/**
 * Les paliers de zoom historiques, en distance caméra-cible. `zoomer()` n'y
 * colle plus — il avance par pas de `PAS_ZOOM` entre les deux bornes de
 * lisibilité —, mais `palierDistance` et `palierSuivant` restent exposés.
 */
export const PALIERS_DISTANCE = [5, 7, 9.5, 13, 17.5, 24, 33, 45] as const;

/** Bornes absolues de la distance, quelle que soit la vue. */
export const DISTANCE_MIN = 2;
export const DISTANCE_MAX = 60;

/**
 * Le seuil de lisibilité (`10-rendu-3d.md` §3.4) : sous 48 px de côté on ne
 * distingue plus une unité. C'est la borne de recul, jamais dépassée.
 */
export const PIXELS_LISIBLES = 48;
/** Le cadrage d'ouverture vise plus confortable que le seuil, quand la carte tient. */
export const PIXELS_CADRAGE = 64;
/** Le rapprochement maximal : une case grande comme un pouce et demi. */
export const PIXELS_PROCHES = 200;
/** Le zoom d'un double-tap : de quoi lire une unité et ses voisines. */
export const PIXELS_DOUBLE_TAP = 96;

/** Un pas de zoom : assez pour se voir, pas assez pour perdre ses repères. */
export const PAS_ZOOM = 1.25;
/** Durée d'un pas de zoom ou d'un recentrage. */
export const MS_TRANSITION = 180;
/**
 * Amortissement de l'inertie par image de 60 Hz : le glisser s'éteint en un
 * tiers de seconde, ce qui se lit comme un coup de pouce et non comme une glace.
 */
export const AMORTISSEMENT = 0.9;
/** En deçà de cette vitesse, en pixels par milliseconde, l'inertie s'arrête. */
const VITESSE_REPOS = 0.02;

/** L'état de la caméra : une cible au sol, une distance, deux angles. */
export interface EtatCamera {
  /** Point visé au sol, en unités de scène. */
  cible: { x: number; z: number };
  distance: number;
  /** Tangage en degrés, borné à [`TANGAGE_MIN`, `TANGAGE_MAX`]. */
  tangage: number;
  /** Bearing en degrés, normalisé dans [0, 360[. */
  lacet: number;
}

/** Position de la caméra pour un état donné. */
export function positionCamera(etat: EtatCamera): { x: number; y: number; z: number } {
  const e = (etat.tangage * Math.PI) / 180;
  const a = (etat.lacet * Math.PI) / 180;
  const plat = Math.cos(e) * etat.distance;
  return {
    x: etat.cible.x + Math.sin(a) * plat,
    y: Math.sin(e) * etat.distance,
    z: etat.cible.z + Math.cos(a) * plat,
  };
}

/**
 * La distance qui fait tenir une carte de `largeur × hauteur` cases dans la vue.
 * On prend le pire des deux axes, avec une marge : mieux vaut un peu de ciel
 * autour du plateau qu'une colonne de cases coupée.
 */
export function distanceCadrage(
  largeur: number, hauteur: number, aspect: number, tangage = TANGAGE_DEFAUT, marge = 1.06,
): number {
  const demiFov = Math.tan((FOV * Math.PI) / 360);
  const e = (tangage * Math.PI) / 180;
  const parProfondeur = (hauteur * CASE * Math.sin(e)) / (2 * demiFov);
  const parLargeur = (largeur * CASE) / (2 * demiFov * Math.max(0.2, aspect));
  return Math.max(parProfondeur, parLargeur) * marge;
}

/**
 * La distance qui fait tenir la **largeur** de la carte, sans regarder sa
 * hauteur. C'est le cadrage d'un écran en portrait : la largeur y est la
 * dimension rare, et faire tenir la hauteur aussi donnerait des cases de vingt
 * pixels. On laisse le haut et le bas dépasser, le joueur fera défiler.
 */
export function distanceCadrageLargeur(
  largeur: number, aspect: number, marge = 1.06,
): number {
  const demiFov = Math.tan((FOV * Math.PI) / 360);
  return ((largeur * CASE) / (2 * demiFov * Math.max(0.2, aspect))) * marge;
}

/** Distance maximale pour garder une case lisible au centre de la vue. */
export function distanceLisible(hauteurVue: number, pixelsParCase = PIXELS_LISIBLES, tangage = TANGAGE_DEFAUT): number {
  return Math.max(DISTANCE_MIN,
    (Math.max(1, hauteurVue) * CASE * Math.sin((tangage * Math.PI) / 180))
      / (2 * Math.tan((FOV * Math.PI) / 360) * pixelsParCase));
}

/**
 * Le champ couvert au sol par une vue, en cases, mesuré au plan de la cible :
 * `largeur` le long de l'axe horizontal de l'écran, `profondeur` le long de
 * l'axe vertical. Une approximation — la perspective en montre un peu plus au
 * fond et un peu moins devant — mais c'est celle qu'il faut pour cadrer.
 */
export function champAuSol(
  distance: number, aspect: number, tangage = TANGAGE_DEFAUT,
): { largeur: number; profondeur: number } {
  const demiFov = Math.tan((FOV * Math.PI) / 360);
  return {
    largeur: (2 * distance * demiFov * aspect) / CASE,
    profondeur: (2 * distance * demiFov) / (Math.sin((tangage * Math.PI) / 180) * CASE),
  };
}

/**
 * Où poser la cible pour regarder `centre` **sans montrer de vide** : sur
 * chaque axe, si la carte tient dans le champ on la centre, sinon on approche
 * la cible du centre demandé sans que le bord de l'écran ne quitte le plateau.
 * Le lacet échange les deux axes : à 90° la largeur de l'écran suit Z.
 */
export function cibleCadrage(
  carte: { largeur: number; hauteur: number },
  champ: { largeur: number; profondeur: number },
  centre: { x: number; z: number },
  lacet = 0,
): { x: number; z: number } {
  const angle = lacet * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const champX = (cos * champ.largeur + sin * champ.profondeur) * CASE;
  const champZ = (sin * champ.largeur + cos * champ.profondeur) * CASE;
  const borner = (valeur: number, etendue: number, visible: number): number => (
    visible >= etendue
      ? etendue / 2
      : Math.max(visible / 2, Math.min(etendue - visible / 2, valeur))
  );
  return {
    x: borner(centre.x, carte.largeur * CASE, champX),
    z: borner(centre.z, carte.hauteur * CASE, champZ),
  };
}

/** Le palier de distance le plus proche d'une valeur. */
export function palierDistance(distance: number): number {
  let meilleur: number = PALIERS_DISTANCE[0];
  let ecart = Number.POSITIVE_INFINITY;
  for (const p of PALIERS_DISTANCE) {
    const d = Math.abs(p - distance);
    if (d < ecart) {
      ecart = d;
      meilleur = p;
    }
  }
  return meilleur;
}

/** Le palier suivant (`sens = +1` rapproche) ou précédent. */
export function palierSuivant(distance: number, sens: number): number {
  const courant = palierDistance(distance);
  const i = PALIERS_DISTANCE.indexOf(courant as (typeof PALIERS_DISTANCE)[number]);
  const j = Math.max(0, Math.min(PALIERS_DISTANCE.length - 1, i - Math.sign(sens)));
  return PALIERS_DISTANCE[j] ?? courant;
}

/** Borne un tangage à la fourchette du brief. */
export function bornerTangage(tangage: number): number {
  return Number.isFinite(tangage)
    ? Math.max(TANGAGE_MIN, Math.min(TANGAGE_MAX, tangage))
    : TANGAGE_DEFAUT;
}

/**
 * L'inclinaison suivante du cycle : le premier palier **sous** le tangage
 * courant, et le plus haut quand il n'y en a plus. Un tangage posé au geste
 * tombe donc au palier d'en dessous plutôt que de sauter en tête de liste : le
 * bouton continue le mouvement du doigt au lieu de le contredire.
 */
export function tangageSuivant(tangage: number): number {
  const courant = bornerTangage(tangage);
  for (const p of PALIERS_TANGAGE) {
    // Une demi-marge : un palier atteint au geste, à un dixième de degré près,
    // compte comme atteint, sinon le bouton n'avancerait pas.
    if (p < courant - 0.5) return p;
  }
  return PALIERS_TANGAGE[0];
}

/** Ramène la cible dans la carte : on ne sort jamais du plateau. */
export function limiterCible(
  etat: EtatCamera, carte: { largeur: number; hauteur: number },
): EtatCamera {
  const marge = 1.5;
  etat.cible.x = Math.max(-marge, Math.min(carte.largeur * CASE + marge, etat.cible.x));
  etat.cible.z = Math.max(-marge, Math.min(carte.hauteur * CASE + marge, etat.cible.z));
  etat.tangage = bornerTangage(etat.tangage);
  etat.distance = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, etat.distance));
  etat.lacet = ((etat.lacet % 360) + 360) % 360;
  return etat;
}

/**
 * Traduit un glisser d'écran en déplacement de la cible, dans le repère tourné
 * par le lacet : glisser vers la droite fait glisser la carte vers la droite,
 * quel que soit le quart de tour courant.
 */
export function deplacerCible(
  etat: EtatCamera, dxEcran: number, dyEcran: number, hauteurVue: number,
): EtatCamera {
  const echelle = (2 * etat.distance * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, hauteurVue);
  const a = (etat.lacet * Math.PI) / 180;
  const dx = -dxEcran * echelle;
  const dz = -dyEcran * echelle / Math.sin((etat.tangage * Math.PI) / 180);
  etat.cible.x += dx * Math.cos(a) + dz * Math.sin(a);
  etat.cible.z += -dx * Math.sin(a) + dz * Math.cos(a);
  return etat;
}

/**
 * Une vitesse d'inertie après `ms` d'amortissement, et le chemin parcouru
 * pendant ce temps. L'amortissement est défini par image de 60 Hz et
 * ramené à la durée réelle : une image longue ne doit pas freiner moins.
 */
export function amortir(
  vitesse: { x: number; y: number }, ms: number, amortissement = AMORTISSEMENT,
): { vitesse: { x: number; y: number }; parcours: { x: number; y: number } } {
  const facteur = Math.pow(amortissement, ms / (1000 / 60));
  const apres = { x: vitesse.x * facteur, y: vitesse.y * facteur };
  // Le parcours est l'intégrale de la vitesse sur l'intervalle : avec un
  // amortissement exponentiel, c'est la vitesse moyenne fois la durée.
  const moyenne = facteur === 1 ? 1 : (facteur - 1) / Math.log(facteur);
  const parcours = { x: vitesse.x * moyenne * ms, y: vitesse.y * moyenne * ms };
  return {
    vitesse: Math.hypot(apres.x, apres.y) < VITESSE_REPOS ? { x: 0, y: 0 } : apres,
    parcours,
  };
}

// ---------------------------------------------------------------------------
// La caméra three.js
// ---------------------------------------------------------------------------

/** Ce que visent une transition ou un cadrage : la cible au sol et la distance. */
interface Visee { x: number; z: number; distance: number }

/** La caméra montée, avec ses commandes et son picking. */
export interface Vue3d {
  readonly camera: THREE.PerspectiveCamera;
  readonly etat: EtatCamera;
  readonly cible: THREE.Vector3;
  /**
   * Déclare la taille de la vue et recalcule la projection. Un changement de
   * hauteur conserve la **taille des cases à l'écran** : tourner le téléphone
   * ou rétracter la barre d'adresse ne zoome pas, il montre plus ou moins.
   */
  redimensionner(largeur: number, hauteur: number): void;
  /** Recopie l'état dans la caméra three.js. */
  appliquer(): void;
  /**
   * Cadre la carte dans la limite de lisibilité des cases. En portrait, c'est
   * la largeur qui est cadrée ; quand la carte déborde malgré tout, la vue se
   * porte vers `centre` — le centre de l'action — sans montrer de vide.
   */
  cadrerCarte(centre?: Case): void;
  /** Amène une case dans le champ, sans brutalité. */
  cadrerCase(c: Case, hauteurSol: number): void;
  centrerCase(c: Case): void;
  /** Recentre sur une case à un zoom lisible, en une courte transition. */
  viser(c: Case): void;
  glisser(dx: number, dy: number): void;
  /** Un pas de zoom (`+1` rapproche), joué en transition ; les pas s'enchaînent. */
  zoomer(sens: number): void;
  facteurZoom(facteur: number, ancre?: { x: number; y: number }): void;
  tourner(sens: number, pas?: number): void;
  /**
   * Incline la caméra de `degres` : **positif redresse** vers la vue de dessus,
   * négatif penche vers l'horizon. Manipulation directe — le glisser à deux
   * doigts, la molette avec Maj —, bornée à [`TANGAGE_MIN`, `TANGAGE_MAX`].
   */
  incliner(degres: number): void;
  /** Pose l'inclinaison suivante du cycle (`tangageSuivant`). */
  inclinaisonSuivante(): void;
  /** Lance l'inertie d'un glisser lâché : une vitesse d'écran en pixels par milliseconde. */
  lancer(vx: number, vy: number): void;
  /** Coupe inertie et transition. Rend vrai si quelque chose bougeait. */
  arreter(): boolean;
  /**
   * Retient la vue courante pour y revenir : le point visé et la distance.
   * Sert au tour de l'adversaire, pendant lequel la caméra va voir ce qui se
   * joue ailleurs sur la carte.
   */
  retenirVue(): void;
  /**
   * Revient à la vue retenue, en transition, et oublie la mémoire. **Ne fait
   * rien si le joueur a lui-même bougé la caméra depuis** : on le ramènerait
   * de force là où il a choisi de ne plus être. Rend vrai si la vue revient.
   */
  revenirVue(): boolean;
  /**
   * Fait avancer inertie et transition de `ms`. Rend vrai tant que la caméra
   * bouge encore. Sous mouvement réduit, tout arrive d'un coup.
   */
  avancer(ms: number, mouvementReduit?: boolean): boolean;
  /** Point d'écran → case, par lancer de rayon sur le sol. */
  /** Les cibles sont interrogées ensemble ; la plus proche de la caméra l'emporte. */
  caseSous(x: number, y: number, sol: THREE.Object3D | readonly THREE.Object3D[] | null): Case | null;
  /** Point du monde → point d'écran en pixels logiques, ou `null` si derrière. */
  versEcran(point: THREE.Vector3): { x: number; y: number } | null;
}

/** Monte la caméra sur une carte donnée. */
export function creerVue3d(carte: { largeur: number; hauteur: number }): Vue3d {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  const etat: EtatCamera = {
    cible: { x: (carte.largeur * CASE) / 2, z: (carte.hauteur * CASE) / 2 },
    distance: 18,
    tangage: TANGAGE_DEFAUT,
    lacet: 0,
  };
  const cible = new THREE.Vector3();
  const rayon = new THREE.Raycaster();
  const plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  // Réutilisés d'un lancer à l'autre : `caseSous` part à chaque image de survol.
  const ndcRayon = new THREE.Vector2();
  const pointRayon = new THREE.Vector3();
  const ciblesRayon: THREE.Object3D[] = [];
  let largeurVue = 1;
  let hauteurVue = 1;
  /** Faux tant que la vue n'a jamais été mesurée : la première mesure ne remet pas à l'échelle. */
  let mesuree = false;
  /** L'inertie en cours, en pixels d'écran par milliseconde. */
  const vitesse = { x: 0, y: 0 };
  /** La transition en cours, s'il y en a une. */
  let transition: { depuis: Visee; vers: Visee; ecoule: number } | null = null;

  const distanceMin = (): number => distanceLisible(hauteurVue, PIXELS_PROCHES);
  const distanceMax = (): number => distanceLisible(hauteurVue, PIXELS_LISIBLES);
  const borner = (d: number): number => Math.max(distanceMin(), Math.min(distanceMax(), d));

  function appliquer(): void {
    limiterCible(etat, carte);
    etat.distance = borner(etat.distance);
    const p = positionCamera(etat);
    camera.position.set(p.x, p.y, p.z);
    cible.set(etat.cible.x, 0, etat.cible.z);
    camera.lookAt(cible);
    camera.updateMatrixWorld();
  }

  /** Ce que la caméra vise en ce moment : la fin de la transition, sinon l'état. */
  function viseeCourante(): Visee {
    return transition
      ? { ...transition.vers }
      : { x: etat.cible.x, z: etat.cible.z, distance: etat.distance };
  }

  /**
   * Repart de l'état courant vers une nouvelle visée. Une transition relancée
   * en cours de route ne saute pas : elle repart d'où la caméra en est.
   */
  function lancerTransition(vers: Partial<Visee>): void {
    transition = {
      depuis: { x: etat.cible.x, z: etat.cible.z, distance: etat.distance },
      vers: { ...viseeCourante(), ...vers },
      ecoule: 0,
    };
  }

  /** Une manipulation directe de la distance reprend la main : la transition s'efface. */
  function interrompre(): void {
    transition = null;
  }

  /**
   * La vue retenue le temps du tour adverse, ou `null`. Elle est **oubliée dès
   * que le joueur touche à la caméra** : un cadrage automatique se défait, un
   * geste voulu ne se défait jamais.
   */
  let vueRetenue: { x: number; z: number; distance: number } | null = null;
  const oublierVue = (): void => { vueRetenue = null; };

  /**
   * Pose la cible sans toucher à la distance : un pas de zoom en cours
   * continue, il arrive simplement ailleurs. Couper la transition laisserait
   * le zoom à mi-chemin dès qu'on glisse pendant un coup de molette.
   */
  function poserCible(x: number, z: number): void {
    etat.cible.x = x;
    etat.cible.z = z;
    if (transition) {
      transition.depuis.x = x;
      transition.depuis.z = z;
      transition.vers.x = x;
      transition.vers.z = z;
    }
  }

  /** Glisse la cible d'un mouvement d'écran, transition comprise. */
  function glisserCible(dxEcran: number, dyEcran: number): void {
    const { x, z } = etat.cible;
    deplacerCible(etat, dxEcran, dyEcran, hauteurVue);
    if (transition) {
      const dx = etat.cible.x - x;
      const dz = etat.cible.z - z;
      transition.depuis.x += dx;
      transition.depuis.z += dz;
      transition.vers.x += dx;
      transition.vers.z += dz;
    }
  }

  function cadrerCarte(centre?: Case): void {
    interrompre();
    vitesse.x = 0;
    vitesse.y = 0;
    const portrait = camera.aspect < 1;
    // On prend la distance exacte plutôt qu'un palier : coller au palier
    // laisserait jusqu'à un tiers de l'écran vide autour du plateau. En
    // portrait la largeur est cadrée et le recul va jusqu'au seuil de
    // lisibilité : six colonnes à 64 px sur un téléphone, c'est trop peu pour
    // voir une manœuvre ; huit à 48 px, ça se joue.
    etat.distance = Math.min(
      portrait
        ? distanceCadrageLargeur(carte.largeur, camera.aspect)
        : distanceCadrage(carte.largeur, carte.hauteur, camera.aspect, etat.tangage),
      distanceLisible(hauteurVue, portrait ? PIXELS_LISIBLES : PIXELS_CADRAGE),
    );
    etat.distance = borner(etat.distance);
    const demande = centre
      ? { x: centre.x * CASE + CASE / 2, z: centre.y * CASE + CASE / 2 }
      : { x: (carte.largeur * CASE) / 2, z: (carte.hauteur * CASE) / 2 };
    const c = cibleCadrage(carte, champAuSol(etat.distance, camera.aspect, etat.tangage), demande, etat.lacet);
    etat.cible.x = c.x;
    etat.cible.z = c.z;
    appliquer();
  }

  return {
    camera,
    etat,
    cible,

    redimensionner(l: number, h: number): void {
      const nouvelleHauteur = Math.max(1, h);
      if (mesuree && nouvelleHauteur !== hauteurVue) {
        // Les pixels par case ne dépendent que de la hauteur de vue et de la
        // distance : garder leur rapport, c'est garder la même échelle.
        const rapport = nouvelleHauteur / hauteurVue;
        etat.distance *= rapport;
        if (transition) {
          transition.depuis.distance *= rapport;
          transition.vers.distance *= rapport;
        }
      }
      mesuree = true;
      largeurVue = Math.max(1, l);
      hauteurVue = nouvelleHauteur;
      camera.aspect = largeurVue / hauteurVue;
      camera.updateProjectionMatrix();
      appliquer();
    },

    appliquer,
    cadrerCarte,

    centrerCase(c: Case): void {
      oublierVue();
      poserCible(c.x * CASE + CASE / 2, c.y * CASE + CASE / 2);
      appliquer();
    },

    viser(c: Case): void {
      oublierVue();
      const distance = Math.min(viseeCourante().distance, distanceLisible(hauteurVue, PIXELS_DOUBLE_TAP));
      const p = cibleCadrage(
        carte, champAuSol(distance, camera.aspect, etat.tangage),
        { x: c.x * CASE + CASE / 2, z: c.y * CASE + CASE / 2 }, etat.lacet,
      );
      lancerTransition({ x: p.x, z: p.z, distance: borner(distance) });
    },

    cadrerCase(c: Case, hauteurSol: number): void {
      const p = new THREE.Vector3(c.x * CASE + CASE / 2, hauteurSol, c.y * CASE + CASE / 2);
      const ecran = this.versEcran(p);
      const marge = 0.16;
      if (
        ecran
        && ecran.x > largeurVue * marge && ecran.x < largeurVue * (1 - marge)
        && ecran.y > hauteurVue * marge && ecran.y < hauteurVue * (1 - marge)
      ) return;
      poserCible(p.x, p.z);
      appliquer();
    },

    glisser(dx: number, dy: number): void {
      oublierVue();
      glisserCible(dx, dy);
      appliquer();
    },

    zoomer(sens: number): void {
      if (sens === 0) return;
      oublierVue();
      // On part de la visée, pas de l'état : quatre pas donnés d'un coup font
      // quatre pas, et non un seul relancé quatre fois.
      const depuis = viseeCourante().distance;
      lancerTransition({ distance: borner(sens > 0 ? depuis / PAS_ZOOM : depuis * PAS_ZOOM) });
    },

    facteurZoom(facteur: number, ancre?: { x: number; y: number }): void {
      if (!Number.isFinite(facteur) || facteur <= 0) return;
      oublierVue();
      interrompre();
      const auSol = (): THREE.Vector3 | null => {
        if (!ancre) return null;
        rayon.setFromCamera(new THREE.Vector2(
          (ancre.x / largeurVue) * 2 - 1, -(ancre.y / hauteurVue) * 2 + 1,
        ), camera);
        return rayon.ray.intersectPlane(plan, new THREE.Vector3());
      };
      const avant = auSol();
      etat.distance = etat.distance / Math.max(0.2, facteur);
      appliquer();
      const apres = auSol();
      if (avant && apres) {
        etat.cible.x += avant.x - apres.x;
        etat.cible.z += avant.z - apres.z;
        appliquer();
      }
    },

    tourner(sens: number, pas = 90): void {
      if (!Number.isFinite(sens) || !Number.isFinite(pas) || pas <= 0 || sens === 0) return;
      oublierVue();
      interrompre();
      etat.lacet += Math.sign(sens) * pas;
      appliquer();
    },

    incliner(degres: number): void {
      if (!Number.isFinite(degres) || degres === 0) return;
      // Un geste de caméra voulu efface la vue retenue du tour adverse : on ne
      // ramène personne au point de vue qu'il vient lui-même de quitter.
      oublierVue();
      // La transition d'un zoom ne porte que la cible et la distance : elle
      // continue, inclinée. `appliquer` borne le tangage comme le reste.
      etat.tangage = bornerTangage(etat.tangage + degres);
      appliquer();
    },

    inclinaisonSuivante(): void {
      oublierVue();
      etat.tangage = tangageSuivant(etat.tangage);
      appliquer();
    },

    lancer(vx: number, vy: number): void {
      oublierVue();
      vitesse.x = Number.isFinite(vx) ? vx : 0;
      vitesse.y = Number.isFinite(vy) ? vy : 0;
    },

    arreter(): boolean {
      const bougeait = transition !== null || vitesse.x !== 0 || vitesse.y !== 0;
      interrompre();
      vitesse.x = 0;
      vitesse.y = 0;
      return bougeait;
    },

    retenirVue(): void {
      // La visée, pas l'état : si un zoom est en cours, c'est là qu'il allait.
      const v = viseeCourante();
      vueRetenue = { x: v.x, z: v.z, distance: v.distance };
    },

    revenirVue(): boolean {
      const vue = vueRetenue;
      vueRetenue = null;
      if (!vue) return false;
      const v = viseeCourante();
      // Rien à défaire si la caméra n'a pas bougé d'un demi-dixième de case.
      const seuil = CASE / 20;
      if (
        Math.abs(v.x - vue.x) < seuil && Math.abs(v.z - vue.z) < seuil
        && Math.abs(v.distance - vue.distance) < seuil
      ) return false;
      lancerTransition({ x: vue.x, z: vue.z, distance: vue.distance });
      return true;
    },

    avancer(ms: number, mouvementReduit = false): boolean {
      let bouge = false;
      if (vitesse.x !== 0 || vitesse.y !== 0) {
        if (mouvementReduit) {
          // Pas de glissade sous réduction : la carte s'arrête où le doigt l'a laissée.
          vitesse.x = 0;
          vitesse.y = 0;
        } else {
          const { vitesse: apres, parcours } = amortir(vitesse, ms);
          glisserCible(parcours.x, parcours.y);
          const { x, z } = etat.cible;
          limiterCible(etat, carte);
          // Butée : une carte qui a touché son bord ne « pousse » pas contre
          // lui, elle s'arrête, comme un plateau qu'on aurait glissé au mur.
          const butee = etat.cible.x !== x || etat.cible.z !== z;
          vitesse.x = butee ? 0 : apres.x;
          vitesse.y = butee ? 0 : apres.y;
          bouge = true;
        }
      }
      if (transition) {
        transition.ecoule += ms;
        const p = mouvementReduit ? 1 : Math.min(1, transition.ecoule / MS_TRANSITION);
        // Sortie en douceur : le gros du chemin d'abord, l'arrivée se pose.
        const t = 1 - Math.pow(1 - p, 3);
        const { depuis, vers } = transition;
        etat.cible.x = depuis.x + (vers.x - depuis.x) * t;
        etat.cible.z = depuis.z + (vers.z - depuis.z) * t;
        etat.distance = depuis.distance + (vers.distance - depuis.distance) * t;
        if (p >= 1) transition = null;
        bouge = true;
      }
      if (bouge) appliquer();
      return transition !== null || vitesse.x !== 0 || vitesse.y !== 0;
    },

    caseSous(x: number, y: number, sol: THREE.Object3D | readonly THREE.Object3D[] | null): Case | null {
      ndcRayon.set((x / largeurVue) * 2 - 1, -(y / hauteurVue) * 2 + 1);
      rayon.setFromCamera(ndcRayon, camera);
      if (sol) {
        ciblesRayon.length = 0;
        if (Array.isArray(sol)) ciblesRayon.push(...(sol as readonly THREE.Object3D[]));
        else ciblesRayon.push(sol as THREE.Object3D);
        const touches = rayon.intersectObjects(ciblesRayon, false);
        const premiere = touches[0];
        if (premiere) {
          const c = mondeVersCase(premiere.point.x, premiere.point.z);
          if (c.x >= 0 && c.y >= 0 && c.x < carte.largeur && c.y < carte.hauteur) return c;
        }
      }
      if (!rayon.ray.intersectPlane(plan, pointRayon)) return null;
      const c = mondeVersCase(pointRayon.x, pointRayon.z);
      if (c.x < 0 || c.y < 0 || c.x >= carte.largeur || c.y >= carte.hauteur) return null;
      return c;
    },

    versEcran(point: THREE.Vector3): { x: number; y: number } | null {
      const p = point.clone().project(camera);
      if (p.z > 1) return null;
      return {
        x: (p.x * 0.5 + 0.5) * largeurVue,
        y: (-p.y * 0.5 + 0.5) * hauteurVue,
      };
    },
  };
}
