/** Gestes de caméra tactiles : un tap joue, un glisser ou pincement déplace la vue. */
import type * as THREE from 'three';
import { toucheDe } from '../render/entrees';
import type { GestesRendu } from '../render/rendu';
import type { Case } from '../schemas/types';
import type { Vue3d } from './camera';

/** Séparé du montage WebGL pour tester les gestes réels et leur annulation. */
export function brancherGestes3d(
  canvas: HTMLCanvasElement,
  vue: () => Vue3d | null,
  sol: () => THREE.Object3D | null,
  gestes: GestesRendu,
  salir: () => void,
): () => void {
  const doigts = new Map<number, { x: number; y: number; debutX: number; debutY: number }>();
  let glisse = false;
  let ecart = 0;
  let annule = false;

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
    if (doigts.size >= 2) {
      annule = true;
      const [a, b] = [...doigts.values()];
      if (a && b) ecart = Math.hypot(a.x - b.x, a.y - b.y);
      glisse = true;
    } else {
      // Droit/milieu glissent immédiatement ; gauche et toucher attendent le seuil.
      glisse = e.button === 2 || e.button === 1;
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
    if (Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY) >= 6) annule = true;
    if (!glisse) {
      if (Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY) < 6) return;
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
    if (doigts.size < 2) ecart = 0;
    if (!doigt) return;
    const bouge = Math.hypot(doigt.x - doigt.debutX, doigt.y - doigt.debutY) > 6;
    if (!bouge && !annule && e.type !== 'pointercancel') {
      if (e.button === 2) gestes.surAnnuler?.();
      else if (e.button === 0) {
        const c = caseSous(doigt.x, doigt.y);
        if (c) gestes.surClicCase?.(c);
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
    canvas.removeEventListener('pointerdown', surDown);
    canvas.removeEventListener('pointermove', surMove);
    canvas.removeEventListener('pointerup', surUp);
    canvas.removeEventListener('pointercancel', surUp);
    canvas.removeEventListener('wheel', surWheel);
    canvas.removeEventListener('contextmenu', surContextMenu);
    canvas.removeEventListener('keydown', surKey);
  };
}
