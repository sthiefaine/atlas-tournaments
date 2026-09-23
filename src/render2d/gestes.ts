/**
 * Les gestes de la peau 2D : un tap joue, un glisser ou un pincement déplacent
 * la carte, un double-clic ou un appui long **inspectent** ; un appui long qui
 * n'inspecte rien annule, comme le clic droit.
 *
 * C'est la grammaire de la 3D (`render3d/gestes.ts`), moins ce qu'une vue fixe
 * n'a pas : ni rotation ni inclinaison, donc ni Alt + glisser, ni Maj +
 * molette, et les touches Q, E, R, F ne font rien — elles ne remontent pas non
 * plus au contrôleur, ce sont des touches de caméra. Ce qui reste :
 *
 * - le **survol** est coalescé sur l'image : une souris envoie des centaines de
 *   positions par seconde, on n'en traite qu'une par image ;
 * - un glisser lâché en mouvement **continue** (l'inertie vit dans la caméra),
 *   le doigt suivant l'arrête net, et ce n'est pas un tap ;
 * - deux doigts **zooment et déplacent** à la fois, la case pincée reste sous
 *   les doigts ; un pincement ne sélectionne jamais la case sous le doigt resté
 *   immobile ;
 * - la souris a le double-clic pour inspecter, le doigt l'appui long — et son
 *   double-tap recentre et rapproche, comme une carte ;
 * - la molette zoome **autour du pointeur** : sur une carte à plat, c'est ce que
 *   la main attend ;
 * - Safari garde ses `gesturestart/change/end`, que `touch-action` ne couvre
 *   pas : ils agrandiraient la page entière. On les refuse ici.
 */

import { toucheDe } from '../render/entrees';
import type { GestesRendu } from '../render/rendu';
import type { Case } from '../schemas/types';
import type { Camera2d } from './camera';

/** Seuils des gestes composés, réglables pour les tests. */
export interface OptionsGestes2d {
  seuilAppuiLongMs?: number;
  seuilDoubleClicMs?: number;
  /** Au-delà, un appui devient un glisser ; sans valeur, il dépend du pointeur. */
  seuilGlisserPx?: number;
  /** Planifie le survol à la prochaine image ; sans lui (les tests), il est traité sur-le-champ. */
  planifierImage?: (f: () => void) => number;
  annulerImage?: (id: number) => void;
}

const SEUIL_APPUI_LONG = 520;
const SEUIL_DOUBLE_CLIC = 350;
/** Un ou deux pixels de tremblement à la souris, pas plus. */
const SEUIL_GLISSER_SOURIS = 6;
/** La pulpe d'un doigt roule d'une dizaine de pixels dans un tap. */
const SEUIL_GLISSER_DOIGT = 10;
/** Fenêtre d'échantillons pour la vitesse au relâchement. */
const MS_FENETRE_VITESSE = 100;
/** Un doigt immobile depuis plus longtemps ne lance pas d'inertie. */
const MS_ARRET_AVANT_LACHER = 80;
/** Sous cette durée d'échantillonnage, la vitesse n'est pas mesurable. */
const MS_MESURE_MIN = 16;
/** Ce qu'un pixel de molette vaut en zoom : un cran de souris (100) fait environ ×1,16. */
const ZOOM_PAR_PIXEL_MOLETTE = 0.0015;

/** Le facteur de zoom d'un mouvement de molette, borné pour un cran démesuré. */
export function facteurMolette(deltaY: number, modeLigne = false): number {
  const pixels = modeLigne ? deltaY * 33 : deltaY;
  return Math.exp(-Math.max(-400, Math.min(400, pixels)) * ZOOM_PAR_PIXEL_MOLETTE);
}

/** Branche les gestes sur la toile ; rend le débranchement. */
export function brancherGestes2d(
  canvas: HTMLCanvasElement,
  camera: () => Camera2d | null,
  gestes: GestesRendu,
  salir: () => void,
  options: OptionsGestes2d = {},
): () => void {
  const seuilLong = options.seuilAppuiLongMs ?? SEUIL_APPUI_LONG;
  const seuilDouble = options.seuilDoubleClicMs ?? SEUIL_DOUBLE_CLIC;
  interface Doigt {
    x: number; y: number; debutX: number; debutY: number; seuil: number;
    traces: { t: number; x: number; y: number }[];
  }
  const doigts = new Map<number, Doigt>();
  let glisse = false;
  let ecart = 0;
  let annule = false;
  let appuiLong: ReturnType<typeof setTimeout> | null = null;
  let dernierTap: { c: Case; temps: number } | null = null;

  const g = globalThis as {
    requestAnimationFrame?: (f: (t: number) => void) => number;
    cancelAnimationFrame?: (id: number) => void;
  };
  const planifier = options.planifierImage
    ?? (g.requestAnimationFrame
      ? (f: () => void): number => g.requestAnimationFrame!(() => f())
      : (f: () => void): number => { f(); return 0; });
  const annulerImage = options.annulerImage ?? g.cancelAnimationFrame ?? ((): void => undefined);
  let survol: { x: number; y: number } | null = null;
  let imageSurvol: number | null = null;

  /**
   * Un point d'événement en pixels de mise en page de la toile. La boîte peut
   * être **transformée** — la page fait entrer la toile par une animation en
   * `scale` — : on ramène l'écart à la taille de mise en page, qui est celle
   * de la caméra.
   */
  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const boite = canvas.getBoundingClientRect();
    const kx = boite.width > 0 && canvas.clientWidth > 0 ? canvas.clientWidth / boite.width : 1;
    const ky = boite.height > 0 && canvas.clientHeight > 0 ? canvas.clientHeight / boite.height : 1;
    return { x: (e.clientX - boite.left) * kx, y: (e.clientY - boite.top) * ky };
  };
  const caseSous = (x: number, y: number): Case | null => camera()?.caseSous(x, y) ?? null;
  const seuilDe = (e: PointerEvent): number => (
    options.seuilGlisserPx ?? (e.pointerType === 'mouse' ? SEUIL_GLISSER_SOURIS : SEUIL_GLISSER_DOIGT)
  );

  const traiterSurvol = (): void => {
    imageSurvol = null;
    const p = survol;
    survol = null;
    if (!p) return;
    const c = caseSous(p.x, p.y);
    if (c) gestes.surSurvolCase?.(c);
  };
  const annulerAppuiLong = (): void => {
    if (appuiLong !== null) clearTimeout(appuiLong);
    appuiLong = null;
  };
  const tracer = (doigt: Doigt, t: number, x: number, y: number): void => {
    doigt.traces.push({ t, x, y });
    while (doigt.traces.length > 1 && t - (doigt.traces[0]?.t ?? t) > MS_FENETRE_VITESSE) doigt.traces.shift();
  };
  const vitesseAuLacher = (doigt: Doigt, t: number): { x: number; y: number } | null => {
    const premier = doigt.traces[0];
    const dernier = doigt.traces[doigt.traces.length - 1];
    if (!premier || !dernier || t - dernier.t > MS_ARRET_AVANT_LACHER) return null;
    const duree = dernier.t - premier.t;
    if (duree < MS_MESURE_MIN) return null;
    return { x: (dernier.x - premier.x) / duree, y: (dernier.y - premier.y) / duree };
  };

  const surDown = (e: PointerEvent): void => {
    const p = local(e);
    canvas.focus?.({ preventScroll: true });
    if (doigts.size === 0) {
      annule = false;
      // Poser le doigt sur une carte qui glisse encore l'arrête, et ce n'est pas un tap.
      if (camera()?.arreter() === true) {
        annule = true;
        salir();
      }
    }
    canvas.setPointerCapture?.(e.pointerId);
    doigts.set(e.pointerId, { x: p.x, y: p.y, debutX: p.x, debutY: p.y, seuil: seuilDe(e), traces: [{ t: e.timeStamp, x: p.x, y: p.y }] });
    annulerAppuiLong();
    if (doigts.size >= 2) {
      annule = true;
      const [a, b] = [...doigts.values()];
      if (a && b) ecart = Math.hypot(a.x - b.x, a.y - b.y);
      glisse = true;
    } else {
      // Le bouton droit et celui du milieu glissent tout de suite ; le gauche et le doigt attendent le seuil.
      glisse = e.button === 2 || e.button === 1;
      if (e.pointerType !== 'mouse') {
        appuiLong = setTimeout(() => {
          appuiLong = null;
          if (glisse || annule) return;
          annule = true;
          const c = caseSous(p.x, p.y);
          if (!(c && gestes.surInspecter?.(c) === true)) gestes.surAnnuler?.();
        }, seuilLong);
      }
    }
  };

  const surMove = (e: PointerEvent): void => {
    const p = local(e);
    const doigt = doigts.get(e.pointerId);
    if (!doigt) {
      survol = p;
      if (imageSurvol === null) imageSurvol = planifier(traiterSurvol);
      return;
    }
    const dx = p.x - doigt.x;
    const dy = p.y - doigt.y;
    doigt.x = p.x;
    doigt.y = p.y;
    tracer(doigt, e.timeStamp, p.x, p.y);
    if (doigts.size >= 2) {
      const [a, b] = [...doigts.values()];
      if (a && b) {
        // Le milieu des doigts a glissé de la moitié du mouvement de ce doigt ;
        // le zoom s'ancre ensuite sur le nouveau milieu : la case pincée reste dessous.
        camera()?.glisser(dx / 2, dy / 2);
        const nouvel = Math.hypot(a.x - b.x, a.y - b.y);
        if (ecart > 4 && nouvel > 4) camera()?.facteurZoom(nouvel / ecart, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        ecart = nouvel;
      }
      salir();
      return;
    }
    const parcours = Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY);
    if (parcours >= doigt.seuil) {
      annule = true;
      annulerAppuiLong();
    }
    if (!glisse) {
      if (parcours < doigt.seuil) return;
      glisse = true;
      annule = true;
    }
    camera()?.glisser(dx, dy);
    salir();
  };

  const surUp = (e: PointerEvent): void => {
    if (e.type === 'pointercancel') annule = true;
    const doigt = doigts.get(e.pointerId);
    doigts.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
    annulerAppuiLong();
    if (doigts.size < 2) ecart = 0;
    if (!doigt) return;
    const bouge = Math.hypot(doigt.x - doigt.debutX, doigt.y - doigt.debutY) > doigt.seuil;
    if (!bouge && !annule && e.type !== 'pointercancel') {
      if (e.button === 2) {
        gestes.surAnnuler?.();
        dernierTap = null;
      } else if (e.button === 0 || e.button === undefined) {
        const c = caseSous(doigt.x, doigt.y);
        if (c) {
          gestes.surClicCase?.(c);
          const double = dernierTap !== null && dernierTap.c.x === c.x && dernierTap.c.y === c.y
            && e.timeStamp - dernierTap.temps <= seuilDouble;
          // Le double-clic consomme ses deux taps : un troisième repart de zéro.
          dernierTap = double ? null : { c, temps: e.timeStamp };
          if (double) {
            if (e.pointerType === 'mouse') gestes.surInspecter?.(c);
            else {
              camera()?.viser(c);
              salir();
            }
          }
        }
      }
    } else if (glisse && doigts.size === 0 && e.type !== 'pointercancel') {
      // Un seul doigt qui lâche en mouvement : la carte continue sur sa lancée.
      const v = vitesseAuLacher(doigt, e.timeStamp);
      if (v) {
        camera()?.lancer(v.x, v.y);
        salir();
      }
    }
    if (doigts.size === 0) {
      glisse = false;
      annule = false;
    }
  };

  const surWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = local(e);
    camera()?.facteurZoom(facteurMolette(e.deltaY, e.deltaMode === 1), p);
    salir();
  };

  const surContextMenu = (e: Event): void => e.preventDefault();

  const surKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const touche = toucheDe(e.code);
    if (!touche) return;
    e.preventDefault();
    if (touche === 'zoom_plus' || touche === 'zoom_moins') {
      camera()?.zoomer(touche === 'zoom_plus' ? 1 : -1);
      salir();
      return;
    }
    // La vue est fixe : tourner et incliner ne font rien, et ne sont pas des ordres de jeu.
    if (touche === 'tourner_gauche' || touche === 'tourner_droite' || touche === 'redresser' || touche === 'pencher') return;
    gestes.surTouche?.(touche);
  };

  const refuser = (e: Event): void => { e.preventDefault(); };

  canvas.addEventListener('pointerdown', surDown);
  canvas.addEventListener('pointermove', surMove);
  canvas.addEventListener('pointerup', surUp);
  canvas.addEventListener('pointercancel', surUp);
  canvas.addEventListener('wheel', surWheel, { passive: false });
  canvas.addEventListener('contextmenu', surContextMenu);
  canvas.addEventListener('keydown', surKey);
  for (const genre of ['gesturestart', 'gesturechange', 'gestureend']) canvas.addEventListener(genre, refuser, { passive: false });

  return (): void => {
    annulerAppuiLong();
    if (imageSurvol !== null) annulerImage(imageSurvol);
    imageSurvol = null;
    survol = null;
    canvas.removeEventListener('pointerdown', surDown);
    canvas.removeEventListener('pointermove', surMove);
    canvas.removeEventListener('pointerup', surUp);
    canvas.removeEventListener('pointercancel', surUp);
    canvas.removeEventListener('wheel', surWheel);
    canvas.removeEventListener('contextmenu', surContextMenu);
    canvas.removeEventListener('keydown', surKey);
    for (const genre of ['gesturestart', 'gesturechange', 'gestureend']) canvas.removeEventListener(genre, refuser);
  };
}
