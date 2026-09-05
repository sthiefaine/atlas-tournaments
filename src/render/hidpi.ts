/**
 * Le redimensionnement HiDPI (`02-architecture.md` §2, point 4).
 *
 * La démo triche avec un `scale(2, 2)` en dur. Ici on lit `devicePixelRatio`, on
 * dimensionne le canvas en **pixels physiques**, on le contraint en CSS en pixels
 * logiques, et on réapplique la transformation à chaque redimensionnement comme à
 * chaque changement d'écran — un portable branché sur un moniteur externe change
 * de ratio à chaud. `ResizeObserver` sur le conteneur, jamais `window.onresize`.
 *
 * Le cache de sprites est vidé au changement de ratio : c'est l'appelant qui le
 * fait, prévenu par `surRatio`.
 */

/** Ce que l'appelant apprend d'un redimensionnement. */
export interface Redimension {
  /** Largeur en pixels logiques (CSS). */
  largeur: number;
  /** Hauteur en pixels logiques (CSS). */
  hauteur: number;
  /** Ratio de pixels appliqué. */
  ratio: number;
  /** Vrai quand le ratio a changé depuis la mesure précédente. */
  ratioChange: boolean;
}

/** Réglages du montage d'une surface. */
export interface OptionsSurface {
  /** Appelée après chaque redimensionnement effectif. */
  surRedimension?(r: Redimension): void;
  /** Plafond de ratio : au-delà, on dessine moins de pixels que l'écran n'en a. */
  ratioMax?: number;
}

/** Une surface de dessin montée sur un canvas, avec sa transformation HiDPI. */
export interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Largeur en pixels logiques. */
  readonly largeur: number;
  /** Hauteur en pixels logiques. */
  readonly hauteur: number;
  /** Ratio de pixels courant. */
  readonly ratio: number;
  /** Remesure et réapplique la transformation. Rend `null` si rien n'a changé. */
  mesurer(): Redimension | null;
  /** Réapplique la transformation : à faire au début de chaque image. */
  reinitialiserTransformation(): void;
  demonter(): void;
}

/** Le ratio de pixels courant, borné. */
export function ratioPixels(max = 3): number {
  const g = globalThis as unknown as { devicePixelRatio?: number };
  const brut = typeof g.devicePixelRatio === 'number' && g.devicePixelRatio > 0 ? g.devicePixelRatio : 1;
  return Math.max(1, Math.min(max, brut));
}

/**
 * Monte une surface HiDPI sur un canvas. Le canvas garde sa taille CSS ; ce sont
 * ses attributs `width` et `height` qui suivent le ratio.
 */
export function monterSurface(
  canvas: HTMLCanvasElement, options: OptionsSurface = {},
): Surface {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible : le rendu ne peut pas démarrer.');
  const ratioMax = options.ratioMax ?? 3;

  let largeur = 0;
  let hauteur = 0;
  let ratio = 0;

  const appliquer = (): Redimension | null => {
    const boite = canvas.getBoundingClientRect();
    const l = Math.max(1, Math.round(boite.width || canvas.clientWidth || 1));
    const h = Math.max(1, Math.round(boite.height || canvas.clientHeight || 1));
    const r = ratioPixels(ratioMax);
    if (l === largeur && h === hauteur && r === ratio) return null;
    const ratioChange = r !== ratio;
    largeur = l;
    hauteur = h;
    ratio = r;
    canvas.width = Math.round(l * r);
    canvas.height = Math.round(h * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return { largeur, hauteur, ratio, ratioChange };
  };

  const prevenir = (): void => {
    const r = appliquer();
    if (r) options.surRedimension?.(r);
  };

  let observateur: ResizeObserver | null = null;
  const g = globalThis as unknown as {
    ResizeObserver?: new (f: () => void) => ResizeObserver;
    matchMedia?: (q: string) => MediaQueryList;
    addEventListener?: (t: string, f: () => void) => void;
    removeEventListener?: (t: string, f: () => void) => void;
  };
  if (typeof g.ResizeObserver === 'function') {
    observateur = new g.ResizeObserver(prevenir);
    observateur.observe(canvas);
  } else if (typeof g.addEventListener === 'function') {
    g.addEventListener('resize', prevenir);
  }

  // Un changement d'écran ne redimensionne pas forcément le canvas : on écoute
  // aussi la résolution elle-même, seule façon de voir un ratio changer à chaud.
  let media: MediaQueryList | null = null;
  const surMedia = (): void => {
    prevenir();
    brancherMedia();
  };
  function brancherMedia(): void {
    if (typeof g.matchMedia !== 'function') return;
    media?.removeEventListener('change', surMedia);
    media = g.matchMedia(`(resolution: ${ratioPixels(ratioMax)}dppx)`);
    media.addEventListener('change', surMedia);
  }

  appliquer();
  brancherMedia();

  return {
    canvas,
    ctx,
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get ratio() { return ratio; },
    mesurer: appliquer,
    reinitialiserTransformation(): void {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    demonter(): void {
      observateur?.disconnect();
      media?.removeEventListener('change', surMedia);
      if (!observateur && typeof g.removeEventListener === 'function') {
        g.removeEventListener('resize', prevenir);
      }
    },
  };
}
