/**
 * Gestes de caméra tactiles : un tap joue, un glisser ou pincement déplace la
 * vue. Un double-clic ou un appui long demandent l'**inspection** de la case ;
 * un appui long qui n'inspecte rien annule, comme le clic droit.
 *
 * Au doigt, la caméra doit répondre comme une carte et non comme un formulaire :
 * un glisser lâché en mouvement **continue** un instant (l'inertie vit dans la
 * caméra, `Vue3d.avancer`), le doigt suivant l'arrête net, et un double-tap
 * recentre la case tapée à un zoom lisible. La souris garde le double-clic pour
 * l'inspection — elle n'a pas d'appui long fiable, le doigt n'a pas de
 * double-clic fiable, chacun son geste.
 */
import type * as THREE from 'three';
import { toucheDe } from '../render/entrees';
import type { GestesRendu } from '../render/rendu';
import type { Case } from '../schemas/types';
import type { Vue3d } from './camera';

/** Seuils des gestes composés, réglables pour les tests. */
export interface OptionsGestes3d {
  /** Au-delà, un doigt immobile fait un appui long. */
  seuilAppuiLongMs?: number;
  /** En deçà, deux taps sur la même case font un double-clic. */
  seuilDoubleClicMs?: number;
  /**
   * Au-delà, un appui devient un glisser. Sans valeur, le seuil dépend du
   * pointeur : un doigt tremble plus qu'une souris, et un tap volé par un
   * glisser de huit pixels est le défaut le plus agaçant d'un jeu tactile.
   */
  seuilGlisserPx?: number;
}

const SEUIL_APPUI_LONG = 520;
const SEUIL_DOUBLE_CLIC = 350;
/** Seuil de glisser à la souris : un ou deux pixels de tremblement, pas plus. */
const SEUIL_GLISSER_SOURIS = 6;
/** Seuil de glisser au doigt : la pulpe roule d'une dizaine de pixels dans un tap. */
const SEUIL_GLISSER_DOIGT = 10;
/**
 * Fenêtre d'échantillons retenue pour mesurer la vitesse au relâchement. Plus
 * court, la vitesse tremble ; plus long, elle traîne un début de geste qui
 * n'a plus rien à voir avec la fin.
 */
const MS_FENETRE_VITESSE = 100;
/** Un doigt immobile depuis plus longtemps que cela ne lance pas d'inertie. */
const MS_ARRET_AVANT_LACHER = 80;
/** Sous cette durée d'échantillonnage, la vitesse n'est pas mesurable. */
const MS_MESURE_MIN = 16;

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
  interface Doigt {
    x: number; y: number; debutX: number; debutY: number;
    /** Le seuil de glisser de ce pointeur, fixé à l'appui. */
    seuil: number;
    /** Les derniers points horodatés, pour la vitesse au relâchement. */
    traces: { t: number; x: number; y: number }[];
  }
  const doigts = new Map<number, Doigt>();
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
  const seuilDe = (e: PointerEvent): number => (
    options.seuilGlisserPx ?? (e.pointerType === 'mouse' ? SEUIL_GLISSER_SOURIS : SEUIL_GLISSER_DOIGT)
  );

  /** Ne garde que les traces de la fenêtre de mesure. */
  const tracer = (doigt: Doigt, t: number, x: number, y: number): void => {
    doigt.traces.push({ t, x, y });
    while (doigt.traces.length > 1 && t - (doigt.traces[0]?.t ?? t) > MS_FENETRE_VITESSE) {
      doigt.traces.shift();
    }
  };

  /** La vitesse au relâchement, en pixels par milliseconde, ou `null` si le doigt s'était arrêté. */
  const vitesseAuLacher = (doigt: Doigt, t: number): { x: number; y: number } | null => {
    const premier = doigt.traces[0];
    const dernier = doigt.traces[doigt.traces.length - 1];
    if (!premier || !dernier) return null;
    if (t - dernier.t > MS_ARRET_AVANT_LACHER) return null;
    const duree = dernier.t - premier.t;
    if (duree < MS_MESURE_MIN) return null;
    return { x: (dernier.x - premier.x) / duree, y: (dernier.y - premier.y) / duree };
  };

  const surDown = (e: PointerEvent): void => {
    const p = local(e);
    canvas.focus({ preventScroll: true });
    if (doigts.size === 0) {
      annule = false;
      // Poser le doigt sur une carte qui glisse encore l'arrête, et ce n'est
      // pas un tap : on ne sélectionne pas ce qui passait sous le doigt.
      if (vue()?.arreter() === true) {
        annule = true;
        salir();
      }
    }
    canvas.setPointerCapture?.(e.pointerId);
    doigts.set(e.pointerId, {
      x: p.x, y: p.y, debutX: p.x, debutY: p.y, seuil: seuilDe(e), traces: [{ t: e.timeStamp, x: p.x, y: p.y }],
    });
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
    tracer(doigt, e.timeStamp, p.x, p.y);
    if (doigts.size >= 2) {
      const [a, b] = [...doigts.values()];
      if (a && b) {
        const nouvel = Math.hypot(a.x - b.x, a.y - b.y);
        // Le milieu des doigts a déjà glissé de la moitié du mouvement de ce
        // doigt ; le zoom s'ancre ensuite sur le nouveau milieu, de sorte que
        // la case pincée reste sous les doigts.
        vue()?.glisser(dx / 2, dy / 2);
        if (ecart > 4 && nouvel > 4) {
          vue()?.facteurZoom(nouvel / ecart, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
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
    const bouge = Math.hypot(doigt.x - doigt.debutX, doigt.y - doigt.debutY) > doigt.seuil;
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
          if (double) {
            if (e.pointerType === 'mouse') gestes.surInspecter?.(c);
            else {
              vue()?.viser(c);
              salir();
            }
          }
        }
      }
    } else if (glisse && doigts.size === 0 && e.type !== 'pointercancel') {
      // Un seul doigt qui lâche en mouvement : la carte continue sur sa lancée.
      const v = vitesseAuLacher(doigt, e.timeStamp);
      if (v) {
        vue()?.lancer(v.x, v.y);
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
    vue()?.zoomer(e.deltaY < 0 ? 1 : -1);
    salir();
  };

  const surContextMenu = (e: Event): void => e.preventDefault();

  const surKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const touche = toucheDe(e.code);
    if (!touche) return;
    e.preventDefault();
    // Les touches de caméra ne remontent pas au contrôleur : elles ne changent
    // rien au jeu, seulement au point de vue.
    if (touche === 'zoom_plus' || touche === 'zoom_moins') {
      vue()?.zoomer(touche === 'zoom_plus' ? 1 : -1);
      salir();
      return;
    }
    if (touche === 'tourner_gauche' || touche === 'tourner_droite') {
      vue()?.tourner(touche === 'tourner_gauche' ? -1 : 1);
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
