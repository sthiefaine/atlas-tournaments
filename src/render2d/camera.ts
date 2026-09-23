/**
 * La caméra de la peau 2D : elle **déplace et agrandit le plan**, rien d'autre.
 *
 * Le plan est l'image de la carte entière à l'échelle 1 (`contrat.ts`,
 * `versPlan`) : 128 pixels par case en largeur, et la profondeur écrasée par le
 * tangage fixe de 50°. La vue est celle d'Advance Wars — ni rotation ni
 * inclinaison (`doc/18-rendu-sprites.md` §4) —, donc un point du plan va à
 * l'écran par une **seule** transformation affine : décaler, multiplier. C'est
 * ce qui rend `versEcran` et `versMonde` exacts l'un pour l'autre et gratuits,
 * ce qui compte : le HUD ancre ses chiffres et son menu de production par
 * `versEcran` **à chaque image**.
 *
 * Les règles de lecture sont celles que la 3D a trouvées (`render3d/camera.ts`),
 * traduites en pixels : jamais moins de 48 pixels d'écran par case
 * (`PIXELS_LISIBLES`), 64 au cadrage d'ouverture quand la carte ne tient pas,
 * 200 au plus près, 96 au double-tap ; une carte en portrait se cadre sur sa
 * largeur. Tout ce qui **dure** — l'inertie d'un glisser lâché, un pas de zoom,
 * un recentrage — passe par `avancer(ms)`, que la boucle appelle : les gestes ne
 * portent aucune horloge et la caméra se rejoue à sec.
 *
 * Pur : ni DOM, ni WebGL, ni horloge (`tests/render2d/camera.test.ts`).
 */

import type { Case } from '../schemas/types';
import { caseDepuisPlan, PIXELS_PAR_CASE, SIN_TANGAGE, versPlan } from './contrat';

/** Le seuil de lisibilité : sous 48 pixels de côté, on ne distingue plus une unité. */
export const PIXELS_LISIBLES = 48;
/** Le cadrage d'ouverture vise plus confortable, quand la carte ne tient pas. */
export const PIXELS_CADRAGE = 64;
/** Le rapprochement maximal : une case grande comme un pouce et demi. */
export const PIXELS_PROCHES = 200;
/** Le zoom d'un double-tap : de quoi lire une unité et ses voisines. */
export const PIXELS_DOUBLE_TAP = 96;

/** Un pas de zoom : assez pour se voir, pas assez pour perdre ses repères. */
export const PAS_ZOOM = 1.25;
/** Durée d'un pas de zoom ou d'un recentrage, comme en 3D. */
export const MS_TRANSITION = 180;
/**
 * Amortissement de l'inertie par image de 60 Hz : le glisser s'éteint en un
 * tiers de seconde, ce qui se lit comme un coup de pouce et non comme une glace.
 */
export const AMORTISSEMENT = 0.9;
/** En deçà de cette vitesse, en pixels d'écran par milliseconde, l'inertie s'arrête. */
const VITESSE_REPOS = 0.02;

/**
 * Ce qui dépasse **au-dessus** de la première ligne, en pixels de plan : un
 * bâtiment ou une montagne posés sur la ligne 0 montent au-dessus du bord de la
 * carte, et le cadrage doit les laisser voir.
 */
export const MARGE_HAUT_PLAN = 0.5 * PIXELS_PAR_CASE;

/**
 * Le jeu laissé à la vue au-delà des bords, en cases. Le HUD pose des bandeaux
 * par-dessus la toile — la journée en haut, le pied en bas — : une caméra bornée
 * au ras de la carte laisserait la première et la dernière ligne sous eux pour
 * toujours. Une case et quart permet de les en sortir d'un glisser.
 */
export const JEU_BORDS = 1.25;

/** Le zoom d'une densité donnée : pixels d'écran par pixel de plan. */
export function zoomPourPixels(pixelsParCase: number): number {
  return pixelsParCase / PIXELS_PAR_CASE;
}

/** Les bornes du zoom : 48 à 200 pixels d'écran par case. */
export const ZOOM_MIN = zoomPourPixels(PIXELS_LISIBLES);
export const ZOOM_MAX = zoomPourPixels(PIXELS_PROCHES);

/** Borne un zoom à la fourchette de lecture ; un zoom illisible retombe au minimum. */
export function bornerZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) : ZOOM_MIN;
}

/** L'état de la caméra : le point du plan au centre de l'écran, et le zoom. */
export interface EtatCamera2d {
  cx: number;
  cy: number;
  /** Pixels d'écran (CSS) par pixel de plan. */
  zoom: number;
}

/** La taille de la vue, en pixels CSS. */
export interface TailleVue { largeur: number; hauteur: number }

/** Ce qu'une carte occupe dans le plan, dépassement du haut compris. */
export interface Emprise { minX: number; minY: number; maxX: number; maxY: number }

/** L'emprise d'une carte de `largeur × hauteur` cases. */
export function empriseCarte(largeur: number, hauteur: number): Emprise {
  const coin = versPlan(largeur, hauteur, 0);
  return { minX: 0, minY: -MARGE_HAUT_PLAN, maxX: coin.X, maxY: coin.Y };
}

/**
 * Le centre ramené dans la carte, sur chaque axe : une carte plus petite que la
 * vue (bords compris) se centre, une plus grande se parcourt sans que la vue ne
 * s'éloigne de plus de `JEU_BORDS` cases au-delà d'un bord.
 */
export function bornerCentre(etat: EtatCamera2d, emprise: Emprise, vue: TailleVue): EtatCamera2d {
  const jeuX = JEU_BORDS * PIXELS_PAR_CASE;
  const jeuY = JEU_BORDS * PIXELS_PAR_CASE * SIN_TANGAGE;
  const axe = (valeur: number, min: number, max: number, visible: number, jeu: number): number => {
    const bas = min - jeu + visible / 2;
    const haut = max + jeu - visible / 2;
    if (bas > haut) return (min + max) / 2;
    return Math.max(bas, Math.min(haut, valeur));
  };
  const z = Math.max(1e-6, etat.zoom);
  etat.cx = axe(etat.cx, emprise.minX, emprise.maxX, vue.largeur / z, jeuX);
  etat.cy = axe(etat.cy, emprise.minY, emprise.maxY, vue.hauteur / z, jeuY);
  return etat;
}

/** Plan → écran, en pixels CSS relatifs au coin haut-gauche de la toile. */
export function planVersEcran(etat: EtatCamera2d, vue: TailleVue, X: number, Y: number): { x: number; y: number } {
  return {
    x: (X - etat.cx) * etat.zoom + vue.largeur / 2,
    y: (Y - etat.cy) * etat.zoom + vue.hauteur / 2,
  };
}

/** Écran → plan : l'inverse exact de `planVersEcran`. */
export function ecranVersPlan(etat: EtatCamera2d, vue: TailleVue, x: number, y: number): { X: number; Y: number } {
  const z = Math.max(1e-6, etat.zoom);
  return { X: (x - vue.largeur / 2) / z + etat.cx, Y: (y - vue.hauteur / 2) / z + etat.cy };
}

/**
 * La matrice 3 × 3 qui envoie le plan dans l'espace de découpe, colonne par
 * colonne (`ContexteImage.planVersDecoupe`). Écrite dans `sortie` : la boucle la
 * recalcule à chaque image sans rien allouer.
 */
export function matricePlanVersDecoupe(etat: EtatCamera2d, vue: TailleVue, sortie: Float32Array): Float32Array {
  const sx = (2 * etat.zoom) / Math.max(1, vue.largeur);
  const sy = (-2 * etat.zoom) / Math.max(1, vue.hauteur);
  sortie[0] = sx; sortie[1] = 0; sortie[2] = 0;
  sortie[3] = 0; sortie[4] = sy; sortie[5] = 0;
  sortie[6] = -etat.cx * sx; sortie[7] = -etat.cy * sy; sortie[8] = 1;
  return sortie;
}

/**
 * Le zoom qui fait tenir la carte. En portrait, la largeur est la dimension
 * rare : faire tenir la hauteur aussi donnerait des cases de vingt pixels, on
 * laisse le haut et le bas dépasser. La marge laisse un peu de fond autour.
 */
export function zoomCadrage(emprise: Emprise, vue: TailleVue, marge = 1.06): number {
  const l = emprise.maxX - emprise.minX;
  const h = emprise.maxY - emprise.minY;
  const parLargeur = vue.largeur / (l * marge);
  if (vue.largeur < vue.hauteur) return parLargeur;
  return Math.min(parLargeur, vue.hauteur / (h * marge));
}

/** Une case au sol, son centre, dans le plan. */
function centreDe(c: Case): { X: number; Y: number } {
  return versPlan(c.x + 0.5, c.y + 0.5, 0);
}

/**
 * Une vitesse d'inertie après `ms` d'amortissement, et le chemin parcouru
 * pendant ce temps : l'amortissement est défini par image de 60 Hz et ramené à
 * la durée réelle, une image longue ne doit pas freiner moins.
 */
export function amortir(
  vitesse: { x: number; y: number }, ms: number, amortissement = AMORTISSEMENT,
): { vitesse: { x: number; y: number }; parcours: { x: number; y: number } } {
  const facteur = Math.pow(amortissement, ms / (1000 / 60));
  const apres = { x: vitesse.x * facteur, y: vitesse.y * facteur };
  const moyenne = facteur === 1 ? 1 : (facteur - 1) / Math.log(facteur);
  return {
    vitesse: Math.hypot(apres.x, apres.y) < VITESSE_REPOS ? { x: 0, y: 0 } : apres,
    parcours: { x: vitesse.x * moyenne * ms, y: vitesse.y * moyenne * ms },
  };
}

/** La caméra montée sur une carte : son état, ses gestes, ses conversions. */
export interface Camera2d {
  readonly etat: EtatCamera2d;
  readonly vue: TailleVue;
  /** Déclare la taille de la vue. Les cases gardent leur taille à l'écran : tourner le téléphone montre plus, il ne zoome pas. */
  redimensionner(largeur: number, hauteur: number): void;
  /** Change de carte sans démonter la peau : l'emprise suit, la vue se recadre au prochain `cadrerCarte`. */
  poserCarte(largeur: number, hauteur: number): void;
  /**
   * Cadre la carte : entière si elle tient à 64 pixels par case, sinon à 64
   * pixels (48 en portrait, cadré sur la largeur), la vue portée vers `centre`.
   */
  cadrerCarte(centre?: Case): void;
  /** Amène une case dans le champ si elle en sort (marge de 16 %) ; ne bouge pas sinon. */
  cadrerCase(c: Case): void;
  /** Centre une case, même déjà visible. */
  centrerCase(c: Case): void;
  /** Recentre sur une case à un zoom lisible, en une courte transition : le double-tap. */
  viser(c: Case): void;
  /** Glisse la carte d'un mouvement d'écran. */
  glisser(dx: number, dy: number): void;
  /** Un pas de zoom (`+1` rapproche), joué en transition ; les pas s'enchaînent. */
  zoomer(sens: number): void;
  /** Un facteur de zoom immédiat, qui garde fixe le point du plan sous `ancre`. */
  facteurZoom(facteur: number, ancre?: { x: number; y: number }): void;
  /** Lance l'inertie d'un glisser lâché, en pixels d'écran par milliseconde. */
  lancer(vx: number, vy: number): void;
  /** Coupe inertie et transition. Rend vrai si quelque chose bougeait. */
  arreter(): boolean;
  /** Retient la vue courante — la visée d'une transition en cours — pour y revenir. */
  retenirVue(): void;
  /**
   * Revient à la vue retenue et l'oublie. Ne fait rien si le joueur a bougé la
   * caméra depuis : on ne ramène personne là où il a choisi de ne plus être.
   */
  revenirVue(): boolean;
  /** Fait avancer inertie et transition. Rend vrai tant que la caméra bouge. */
  avancer(ms: number, reduit?: boolean): boolean;
  /** Vrai tant qu'une inertie ou une transition est en cours. */
  enMouvement(): boolean;
  /** Point du plan → écran. */
  versEcran(X: number, Y: number): { x: number; y: number };
  /** Écran → point du plan. */
  versPlan(x: number, y: number): { X: number; Y: number };
  /** Écran → case au sol, ou `null` hors de la carte. */
  caseSous(x: number, y: number): Case | null;
  /** Le rectangle du plan que la vue montre. */
  champ(): Emprise;
}

/** Ce que visent une transition, un retour de vue : le centre et le zoom. */
interface Visee { cx: number; cy: number; zoom: number }

/** Monte la caméra sur une carte. */
export function creerCamera2d(largeurCarte: number, hauteurCarte: number): Camera2d {
  let carte = { largeur: largeurCarte, hauteur: hauteurCarte };
  let emprise = empriseCarte(carte.largeur, carte.hauteur);
  const etat: EtatCamera2d = {
    cx: (emprise.minX + emprise.maxX) / 2,
    cy: (emprise.minY + emprise.maxY) / 2,
    zoom: zoomPourPixels(PIXELS_CADRAGE),
  };
  const vue: TailleVue = { largeur: 1, hauteur: 1 };
  const vitesse = { x: 0, y: 0 };
  let transition: { depuis: Visee; vers: Visee; ecoule: number } | null = null;
  let vueRetenue: Visee | null = null;

  const oublierVue = (): void => { vueRetenue = null; };
  const borner = (): void => {
    etat.zoom = bornerZoom(etat.zoom);
    bornerCentre(etat, emprise, vue);
  };
  /** Une visée ramenée dans les bornes, sans toucher à l'état. */
  const visee = (v: Visee): Visee => {
    const e = { cx: v.cx, cy: v.cy, zoom: bornerZoom(v.zoom) };
    bornerCentre(e, emprise, vue);
    return e;
  };
  /** Ce que la caméra vise : la fin de la transition, sinon l'état. */
  const viseeCourante = (): Visee => (transition ? { ...transition.vers } : { cx: etat.cx, cy: etat.cy, zoom: etat.zoom });
  /** Repart de l'état courant vers une visée : une transition relancée ne saute pas. */
  const lancerTransition = (vers: Partial<Visee>): void => {
    transition = {
      depuis: { cx: etat.cx, cy: etat.cy, zoom: etat.zoom },
      vers: visee({ ...viseeCourante(), ...vers }),
      ecoule: 0,
    };
  };
  /**
   * Pose le centre sans toucher au zoom : un pas de zoom en cours continue, il
   * arrive simplement ailleurs. Le couper laisserait le zoom à mi-chemin.
   */
  const poserCentre = (X: number, Y: number): void => {
    etat.cx = X;
    etat.cy = Y;
    if (transition) {
      transition.depuis.cx = X;
      transition.depuis.cy = Y;
      transition.vers = visee({ ...transition.vers, cx: X, cy: Y });
    }
    borner();
  };

  function cadrerCarte(centre?: Case): void {
    transition = null;
    vitesse.x = 0;
    vitesse.y = 0;
    const portrait = vue.largeur < vue.hauteur;
    // La carte entière si elle tient à une taille confortable ; sinon, la
    // taille confortable, et la vue portée vers l'action sans montrer de vide.
    const confort = zoomPourPixels(portrait ? PIXELS_LISIBLES : PIXELS_CADRAGE);
    etat.zoom = bornerZoom(Math.max(zoomCadrage(emprise, vue), confort));
    const vise = centre ? centreDe(centre) : { X: (emprise.minX + emprise.maxX) / 2, Y: (emprise.minY + emprise.maxY) / 2 };
    etat.cx = vise.X;
    etat.cy = vise.Y;
    borner();
  }

  const camera: Camera2d = {
    etat,
    vue,

    redimensionner(largeur: number, hauteur: number): void {
      vue.largeur = Math.max(1, largeur);
      vue.hauteur = Math.max(1, hauteur);
      borner();
      if (transition) transition.vers = visee(transition.vers);
    },

    poserCarte(largeur: number, hauteur: number): void {
      if (largeur === carte.largeur && hauteur === carte.hauteur) return;
      carte = { largeur, hauteur };
      emprise = empriseCarte(largeur, hauteur);
      transition = null;
      borner();
    },

    cadrerCarte,

    cadrerCase(c: Case): void {
      const p = centreDe(c);
      const e = planVersEcran(etat, vue, p.X, p.Y);
      const marge = 0.16;
      if (e.x > vue.largeur * marge && e.x < vue.largeur * (1 - marge)
        && e.y > vue.hauteur * marge && e.y < vue.hauteur * (1 - marge)) return;
      // Un cadrage automatique — le tour de l'adversaire — n'efface pas la vue
      // retenue : c'est justement elle qu'on rendra au joueur ensuite.
      poserCentre(p.X, p.Y);
    },

    centrerCase(c: Case): void {
      oublierVue();
      const p = centreDe(c);
      poserCentre(p.X, p.Y);
    },

    viser(c: Case): void {
      oublierVue();
      const p = centreDe(c);
      lancerTransition({ cx: p.X, cy: p.Y, zoom: Math.max(viseeCourante().zoom, zoomPourPixels(PIXELS_DOUBLE_TAP)) });
    },

    glisser(dx: number, dy: number): void {
      oublierVue();
      const z = Math.max(1e-6, etat.zoom);
      const avantX = etat.cx;
      const avantY = etat.cy;
      etat.cx -= dx / z;
      etat.cy -= dy / z;
      borner();
      // Un glisser pendant un pas de zoom : le zoom continue, il arrive ailleurs.
      if (transition) {
        transition.depuis.cx += etat.cx - avantX;
        transition.depuis.cy += etat.cy - avantY;
        transition.vers = visee({ ...transition.vers, cx: transition.vers.cx + etat.cx - avantX, cy: transition.vers.cy + etat.cy - avantY });
      }
    },

    zoomer(sens: number): void {
      if (!Number.isFinite(sens) || sens === 0) return;
      oublierVue();
      // On part de la visée : quatre pas donnés d'un coup font quatre pas.
      const depuis = viseeCourante();
      lancerTransition({ zoom: sens > 0 ? depuis.zoom * PAS_ZOOM : depuis.zoom / PAS_ZOOM });
    },

    facteurZoom(facteur: number, ancre?: { x: number; y: number }): void {
      if (!Number.isFinite(facteur) || facteur <= 0) return;
      oublierVue();
      transition = null;
      const point = ancre ? ecranVersPlan(etat, vue, ancre.x, ancre.y) : null;
      etat.zoom = bornerZoom(etat.zoom * facteur);
      if (point && ancre) {
        // Le point pincé reste sous les doigts.
        etat.cx = point.X - (ancre.x - vue.largeur / 2) / etat.zoom;
        etat.cy = point.Y - (ancre.y - vue.hauteur / 2) / etat.zoom;
      }
      borner();
    },

    lancer(vx: number, vy: number): void {
      oublierVue();
      vitesse.x = Number.isFinite(vx) ? vx : 0;
      vitesse.y = Number.isFinite(vy) ? vy : 0;
    },

    arreter(): boolean {
      const bougeait = transition !== null || vitesse.x !== 0 || vitesse.y !== 0;
      transition = null;
      vitesse.x = 0;
      vitesse.y = 0;
      return bougeait;
    },

    retenirVue(): void {
      vueRetenue = viseeCourante();
    },

    revenirVue(): boolean {
      const retenue = vueRetenue;
      vueRetenue = null;
      if (!retenue) return false;
      const v = viseeCourante();
      // Rien à défaire si la caméra n'a pas bougé d'un vingtième de case.
      const seuil = PIXELS_PAR_CASE / 20;
      if (Math.abs(v.cx - retenue.cx) < seuil && Math.abs(v.cy - retenue.cy) < seuil
        && Math.abs(v.zoom - retenue.zoom) < 1e-3) return false;
      lancerTransition(retenue);
      return true;
    },

    avancer(ms: number, reduit = false): boolean {
      if (vitesse.x !== 0 || vitesse.y !== 0) {
        if (reduit) {
          // Pas de glissade sous réduction : la carte s'arrête où le doigt l'a laissée.
          vitesse.x = 0;
          vitesse.y = 0;
        } else {
          const { vitesse: apres, parcours } = amortir(vitesse, ms);
          const z = Math.max(1e-6, etat.zoom);
          const voulu = { cx: etat.cx - parcours.x / z, cy: etat.cy - parcours.y / z };
          etat.cx = voulu.cx;
          etat.cy = voulu.cy;
          borner();
          // Butée : une carte qui touche son bord s'arrête, elle ne pousse pas contre lui.
          const butee = Math.abs(etat.cx - voulu.cx) > 1e-6 || Math.abs(etat.cy - voulu.cy) > 1e-6;
          vitesse.x = butee ? 0 : apres.x;
          vitesse.y = butee ? 0 : apres.y;
        }
      }
      if (transition) {
        transition.ecoule += ms;
        const p = reduit ? 1 : Math.min(1, transition.ecoule / MS_TRANSITION);
        // Sortie en douceur : le gros du chemin d'abord, l'arrivée se pose.
        const t = 1 - Math.pow(1 - p, 3);
        const { depuis, vers } = transition;
        etat.cx = depuis.cx + (vers.cx - depuis.cx) * t;
        etat.cy = depuis.cy + (vers.cy - depuis.cy) * t;
        etat.zoom = depuis.zoom + (vers.zoom - depuis.zoom) * t;
        if (p >= 1) transition = null;
        borner();
      }
      return this.enMouvement();
    },

    enMouvement(): boolean {
      return transition !== null || vitesse.x !== 0 || vitesse.y !== 0;
    },

    versEcran(X: number, Y: number): { x: number; y: number } {
      return planVersEcran(etat, vue, X, Y);
    },

    versPlan(x: number, y: number): { X: number; Y: number } {
      return ecranVersPlan(etat, vue, x, y);
    },

    caseSous(x: number, y: number): Case | null {
      const p = ecranVersPlan(etat, vue, x, y);
      return caseDepuisPlan(p.X, p.Y, carte.largeur, carte.hauteur);
    },

    champ(): Emprise {
      const a = ecranVersPlan(etat, vue, 0, 0);
      const b = ecranVersPlan(etat, vue, vue.largeur, vue.hauteur);
      return { minX: a.X, minY: a.Y, maxX: b.X, maxY: b.Y };
    },
  };
  return camera;
}
