/**
 * Les entrées : souris, tactile et clavier (`02-architecture.md` §2, point 3).
 *
 * C'est la brique la plus fastidieuse d'un rendu « from scratch » : convertir des
 * coordonnées d'écran, distinguer un **tap** d'un **glisser** (seuil en pixels et
 * en millisecondes), gérer le **pincement** à deux doigts, le déroulement inertiel
 * et la touche Échap comme « annuler ».
 *
 * Deux règles fermes : jamais d'`alert` ni de `confirm` — toute confirmation passe
 * par le HUD dessiné —, et aucune décision de jeu ici : ce module ne fait que
 * traduire des gestes en intentions, le contrôleur décide.
 */

/** Un point en pixels logiques, relatif au canvas. */
export interface PointEcran { x: number; y: number }

/** Les touches de jeu, nommées par leur intention et non par leur code. */
export type ToucheJeu =
  | 'haut' | 'bas' | 'gauche' | 'droite'
  | 'valider' | 'annuler' | 'fin_tour'
  | 'zoom_plus' | 'zoom_moins'
  | 'tourner_gauche' | 'tourner_droite'
  | 'redresser' | 'pencher';

/** Ce que le contrôleur reçoit des entrées. */
export interface Gestes {
  /** Un clic ou un tap sur un point. */
  surTap?(p: PointEcran): void;
  /** Un clic droit ou un appui long : le geste « annuler » au pointeur. */
  surTapSecondaire?(p: PointEcran): void;
  /**
   * Un double-clic, ou un appui long : demander l'inspection de ce qui est
   * sous le pointeur. Rend vrai si une inspection s'est ouverte ; sinon un appui
   * long retombe sur `surTapSecondaire`. Le double-clic arrive **après** les
   * deux taps, qui ont déjà été remontés : il n'en remplace aucun.
   */
  surInspecter?(p: PointEcran): boolean;
  /** Le pointeur a bougé sans bouton : survol. */
  surSurvol?(p: PointEcran | null): void;
  /** Un glisser, en delta d'écran depuis la dernière image. */
  surGlisser?(dx: number, dy: number): void;
  /** Fin d'un glisser, avec la vitesse en pixels par seconde. */
  surLacher?(vx: number, vy: number): void;
  /** Un zoom : facteur multiplicatif autour d'un point. */
  surZoom?(facteur: number, ancre: PointEcran): void;
  /** Une touche du clavier, déjà traduite en intention. */
  surTouche?(touche: ToucheJeu): void;
}

/** Réglages des seuils de geste. */
export interface OptionsEntrees {
  /** Au-delà, un appui devient un glisser. */
  seuilGlisserPx?: number;
  /** Au-delà, un appui devient un appui long (tap secondaire). */
  seuilAppuiLongMs?: number;
  /** En deçà, deux taps au même endroit font un double-clic. */
  seuilDoubleClicMs?: number;
  /** Molette : facteur de zoom par cran. */
  pasMolette?: number;
}

const SEUIL_GLISSER = 6;
const SEUIL_APPUI_LONG = 520;
const SEUIL_DOUBLE_CLIC = 350;
/**
 * Deux clics « au même endroit » : une souris bouge toujours d'un ou deux
 * pixels entre les deux, et une case fait au moins 48 px de côté.
 */
const SEUIL_DOUBLE_CLIC_PX = 12;
const PAS_MOLETTE = 1.12;

/** Traduit un code de touche en intention de jeu, ou `null` si elle ne nous concerne pas. */
export function toucheDe(code: string): ToucheJeu | null {
  switch (code) {
    case 'ArrowUp': case 'KeyW': case 'KeyZ': return 'haut';
    case 'ArrowDown': case 'KeyS': return 'bas';
    case 'ArrowLeft': case 'KeyA': return 'gauche';
    case 'ArrowRight': case 'KeyD': return 'droite';
    case 'Enter': case 'NumpadEnter': case 'Space': return 'valider';
    case 'Escape': case 'Backspace': return 'annuler';
    case 'KeyT': return 'fin_tour';
    case 'Equal': case 'NumpadAdd': return 'zoom_plus';
    case 'Minus': case 'NumpadSubtract': return 'zoom_moins';
    // Q et E tournent la caméra d'un quart de tour, comme dans tout jeu de
    // stratégie : le brief les réserve, ils ne servent donc ni à se déplacer ni à
    // finir le tour.
    case 'KeyQ': return 'tourner_gauche';
    case 'KeyE': return 'tourner_droite';
    // R et F inclinent la caméra, et ils sont au même endroit du clavier en
    // AZERTY comme en QWERTY : R au-dessus de F, comme la vue qu'ils donnent —
    // R redresse vers le dessus, F penche vers l'horizon.
    case 'KeyR': return 'redresser';
    case 'KeyF': return 'pencher';
    default: return null;
  }
}

/** Position d'un événement de pointeur, en pixels logiques relatifs au canvas. */
function positionDans(canvas: HTMLCanvasElement, x: number, y: number): PointEcran {
  const boite = canvas.getBoundingClientRect();
  return { x: x - boite.left, y: y - boite.top };
}

/**
 * Branche les entrées sur un canvas. Rend la fonction de débranchement : tout ce
 * qui a été écouté est retiré, y compris sur la fenêtre.
 */
export function brancherEntrees(
  canvas: HTMLCanvasElement, gestes: Gestes, options: OptionsEntrees = {},
): () => void {
  const seuilGlisser = options.seuilGlisserPx ?? SEUIL_GLISSER;
  const seuilLong = options.seuilAppuiLongMs ?? SEUIL_APPUI_LONG;
  const seuilDouble = options.seuilDoubleClicMs ?? SEUIL_DOUBLE_CLIC;
  const pasMolette = options.pasMolette ?? PAS_MOLETTE;

  interface Doigt { x: number; y: number; debutX: number; debutY: number; temps: number }
  const doigts = new Map<number, Doigt>();
  let glisse = false;
  let ecartPincement = 0;
  let dernierTemps = 0;
  let vitesseX = 0;
  let vitesseY = 0;
  let appuiLong: ReturnType<typeof setTimeout> | null = null;
  /** Le dernier tap principal, pour reconnaître un double-clic. */
  let dernierTap: { x: number; y: number; temps: number } | null = null;

  const annulerAppuiLong = (): void => {
    if (appuiLong !== null) clearTimeout(appuiLong);
    appuiLong = null;
  };

  const distance = (a: Doigt, b: Doigt): number => Math.hypot(a.x - b.x, a.y - b.y);

  const surPointerDown = (e: PointerEvent): void => {
    const p = positionDans(canvas, e.clientX, e.clientY);
    canvas.setPointerCapture?.(e.pointerId);
    doigts.set(e.pointerId, { x: p.x, y: p.y, debutX: p.x, debutY: p.y, temps: e.timeStamp });
    dernierTemps = e.timeStamp;
    vitesseX = 0;
    vitesseY = 0;
    if (doigts.size === 2) {
      const [a, b] = [...doigts.values()];
      if (a && b) ecartPincement = distance(a, b);
      annulerAppuiLong();
      glisse = true;
    } else if (doigts.size === 1) {
      glisse = false;
      if (e.pointerType !== 'mouse') {
        appuiLong = setTimeout(() => {
          appuiLong = null;
          if (!glisse) {
            glisse = true;
            // Un appui long qui inspecte n'annule pas en plus : les deux gestes
            // se partagent le même doigt, pas le même sens.
            if (gestes.surInspecter?.(p) !== true) gestes.surTapSecondaire?.(p);
          }
        }, seuilLong);
      }
    }
  };

  const surPointerMove = (e: PointerEvent): void => {
    const p = positionDans(canvas, e.clientX, e.clientY);
    const doigt = doigts.get(e.pointerId);
    if (!doigt) {
      gestes.surSurvol?.(p);
      return;
    }
    const dx = p.x - doigt.x;
    const dy = p.y - doigt.y;
    doigt.x = p.x;
    doigt.y = p.y;

    if (doigts.size >= 2) {
      const [a, b] = [...doigts.values()];
      if (a && b) {
        const ecart = distance(a, b);
        if (ecartPincement > 0 && ecart > 0) {
          const ancre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          gestes.surZoom?.(ecart / ecartPincement, ancre);
        }
        ecartPincement = ecart;
      }
      return;
    }

    if (!glisse) {
      const parcours = Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY);
      if (parcours < seuilGlisser) return;
      glisse = true;
      annulerAppuiLong();
    }
    const dt = Math.max(1, e.timeStamp - dernierTemps);
    dernierTemps = e.timeStamp;
    vitesseX = (dx / dt) * 1000;
    vitesseY = (dy / dt) * 1000;
    gestes.surGlisser?.(dx, dy);
  };

  const surPointerUp = (e: PointerEvent): void => {
    const doigt = doigts.get(e.pointerId);
    doigts.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
    annulerAppuiLong();
    if (doigts.size === 1) ecartPincement = 0;
    if (!doigt) return;
    const p = { x: doigt.x, y: doigt.y };
    if (!glisse && e.type !== 'pointercancel') {
      if (e.button === 2) {
        gestes.surTapSecondaire?.(p);
        dernierTap = null;
      } else {
        gestes.surTap?.(p);
        const double = dernierTap !== null
          && e.timeStamp - dernierTap.temps <= seuilDouble
          && Math.hypot(p.x - dernierTap.x, p.y - dernierTap.y) <= SEUIL_DOUBLE_CLIC_PX;
        // Le double-clic consomme ses deux taps : un troisième repart de zéro.
        dernierTap = double ? null : { x: p.x, y: p.y, temps: e.timeStamp };
        if (double) gestes.surInspecter?.(p);
      }
    } else if (doigts.size === 0) {
      gestes.surLacher?.(vitesseX, vitesseY);
    }
    if (doigts.size === 0) glisse = false;
  };

  const surPointerLeave = (): void => {
    gestes.surSurvol?.(null);
  };

  const surWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const ancre = positionDans(canvas, e.clientX, e.clientY);
    const facteur = e.deltaY < 0 ? pasMolette : 1 / pasMolette;
    gestes.surZoom?.(facteur, ancre);
  };

  const surContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  const surKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const touche = toucheDe(e.code);
    if (!touche) return;
    e.preventDefault();
    gestes.surTouche?.(touche);
  };

  canvas.addEventListener('pointerdown', surPointerDown);
  canvas.addEventListener('pointermove', surPointerMove);
  canvas.addEventListener('pointerup', surPointerUp);
  canvas.addEventListener('pointercancel', surPointerUp);
  canvas.addEventListener('pointerleave', surPointerLeave);
  canvas.addEventListener('wheel', surWheel, { passive: false });
  canvas.addEventListener('contextmenu', surContextMenu);
  canvas.addEventListener('keydown', surKeyDown);
  if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');

  return (): void => {
    annulerAppuiLong();
    canvas.removeEventListener('pointerdown', surPointerDown);
    canvas.removeEventListener('pointermove', surPointerMove);
    canvas.removeEventListener('pointerup', surPointerUp);
    canvas.removeEventListener('pointercancel', surPointerUp);
    canvas.removeEventListener('pointerleave', surPointerLeave);
    canvas.removeEventListener('wheel', surWheel);
    canvas.removeEventListener('contextmenu', surContextMenu);
    canvas.removeEventListener('keydown', surKeyDown);
  };
}
