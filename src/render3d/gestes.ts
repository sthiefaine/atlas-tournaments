/**
 * Gestes de caméra tactiles : un tap joue, un glisser ou pincement déplace la
 * vue. Un double-clic ou un appui long demandent l'**inspection** de la case ;
 * un appui long qui n'inspecte rien annule, comme le clic droit.
 */
import type * as THREE from 'three';
import { toucheDe } from '../render/entrees';
import type { GestesRendu } from '../render/rendu';
import type { Case } from '../schemas/types';
import type { Vue3d } from './camera';

/** Seuils de temps des gestes composés, réglables pour les tests. */
export interface OptionsGestes3d {
  /** Au-delà, un doigt immobile fait un appui long. */
  seuilAppuiLongMs?: number;
  /** En deçà, deux taps sur la même case font un double-clic. */
  seuilDoubleClicMs?: number;
}

const SEUIL_APPUI_LONG = 520;
const SEUIL_DOUBLE_CLIC = 350;
const SEUIL_BOUGE = 6;

/** Séparé du montage WebGL pour tester les gestes réels et leur annulation. */
export function brancherGestes3d(
  canvas: HTMLCanvasElement,
  vue: () => Vue3d | null,
  sol: () => THREE.Object3D | readonly THREE.Object3D[] | null,
  gestes: GestesRendu,
  salir: () => void,
  options: OptionsGestes3d = {},
): () => void {
  const seuilLong = options.seuilAppuiLongMs ?? SEUIL_APPUI_LONG;
  const seuilDouble = options.seuilDoubleClicMs ?? SEUIL_DOUBLE_CLIC;
  const doigts = new Map<number, { x: number; y: number; debutX: number; debutY: number }>();
  let glisse = false;
  let ecart = 0;
  let annule = false;
  let appuiLong: ReturnType<typeof setTimeout> | null = null;
  /** Le dernier tap, en case et en temps : c'est la case qui fait le double-clic. */
  let dernierTap: { c: Case; temps: number } | null = null;

  const annulerAppuiLong = (): void => {
    if (appuiLong !== null) clearTimeout(appuiLong);
    appuiLong = null;
  };

  const local = (e: PointerEvent): { x: number; y: number } => {
    const boite = canvas.getBoundingClientRect();
    return { x: e.clientX - boite.left, y: e.clientY - boite.top };
  };
  const caseSous = (x: number, y: number): Case | null => (
    vue()?.caseSous(x, y, sol()) ?? null
  );

  const surDown = (e: PointerEvent): void => {
    const p = local(e);
    canvas.focus({ preventScroll: true });
    if (doigts.size === 0) annule = false;
    canvas.setPointerCapture?.(e.pointerId);
    doigts.set(e.pointerId, { x: p.x, y: p.y, debutX: p.x, debutY: p.y });
    annulerAppuiLong();
    if (doigts.size >= 2) {
      annule = true;
      const [a, b] = [...doigts.values()];
      if (a && b) ecart = Math.hypot(a.x - b.x, a.y - b.y);
      glisse = true;
    } else {
      // Droit/milieu glissent immédiatement ; gauche et toucher attendent le seuil.
      glisse = e.button === 2 || e.button === 1;
      // La souris a le double-clic ; le doigt, qui n'en a pas de fiable, a
      // l'appui long. Le relâchement qui suit ne compte plus comme un tap.
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
      const c = caseSous(p.x, p.y);
      if (c) gestes.surSurvolCase?.(c);
      return;
    }
    const dx = p.x - doigt.x;
    const dy = p.y - doigt.y;
    doigt.x = p.x;
    doigt.y = p.y;
    if (doigts.size >= 2) {
      const [a, b] = [...doigts.values()];
      if (a && b) {
        const nouvel = Math.hypot(a.x - b.x, a.y - b.y);
        if (ecart > 4 && nouvel > 4) {
          vue()?.facteurZoom(nouvel / ecart, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
        ecart = nouvel;
      }
      vue()?.glisser(dx / 2, dy / 2);
      salir();
      return;
    }
    if (Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY) >= SEUIL_BOUGE) {
      annule = true;
      annulerAppuiLong();
    }
    if (!glisse) {
      if (Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY) < SEUIL_BOUGE) return;
      glisse = true;
      annule = true;
    }
    vue()?.glisser(dx, dy);
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
    const bouge = Math.hypot(doigt.x - doigt.debutX, doigt.y - doigt.debutY) > SEUIL_BOUGE;
    if (!bouge && !annule && e.type !== 'pointercancel') {
      if (e.button === 2) {
        gestes.surAnnuler?.();
        dernierTap = null;
      } else if (e.button === 0) {
        const c = caseSous(doigt.x, doigt.y);
        if (c) {
          gestes.surClicCase?.(c);
          const double = dernierTap !== null
            && dernierTap.c.x === c.x && dernierTap.c.y === c.y
            && e.timeStamp - dernierTap.temps <= seuilDouble;
          // Le double-clic consomme ses deux taps : un troisième repart de zéro.
          dernierTap = double ? null : { c, temps: e.timeStamp };
          if (double) gestes.surInspecter?.(c);
        }
      }
    }
    if (doigts.size === 0) {
      glisse = false;
      annule = false;
    }
  };

  const surWheel = (e: WheelEvent): void => {
    e.preventDefault();
    vue()?.zoomer(e.deltaY < 0 ? 1 : -1);
    salir();
  };

  const surContextMenu = (e: Event): void => e.preventDefault();

  const surKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Q et E tournent la caméra d'un quart de tour : le brief les réserve.
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      vue()?.tourner(e.code === 'KeyQ' ? -1 : 1);
      salir();
      return;
    }
    const touche = toucheDe(e.code);
    if (!touche) return;
    e.preventDefault();
    if (touche === 'zoom_plus' || touche === 'zoom_moins') {
      vue()?.zoomer(touche === 'zoom_plus' ? 1 : -1);
      salir();
      return;
    }
    gestes.surTouche?.(touche);
  };

  canvas.addEventListener('pointerdown', surDown);
  canvas.addEventListener('pointermove', surMove);
  canvas.addEventListener('pointerup', surUp);
  canvas.addEventListener('pointercancel', surUp);
  canvas.addEventListener('wheel', surWheel, { passive: false });
  canvas.addEventListener('contextmenu', surContextMenu);
  canvas.addEventListener('keydown', surKey);

  return (): void => {
    annulerAppuiLong();
    canvas.removeEventListener('pointerdown', surDown);
    canvas.removeEventListener('pointermove', surMove);
    canvas.removeEventListener('pointerup', surUp);
    canvas.removeEventListener('pointercancel', surUp);
    canvas.removeEventListener('wheel', surWheel);
    canvas.removeEventListener('contextmenu', surContextMenu);
    canvas.removeEventListener('keydown', surKey);
  };
}
