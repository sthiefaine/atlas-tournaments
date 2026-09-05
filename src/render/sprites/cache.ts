/**
 * Le cache de sprites vectoriels en canvas hors écran (`02-architecture.md` §2,
 * point 2).
 *
 * Redessiner trois arbres et une montagne à la main pour chacune des cases à
 * chaque image est un gaspillage. Chaque combinaison est rendue **une fois** dans
 * un `OffscreenCanvas`, puis blittée avec `drawImage`.
 *
 * La clé est textuelle et tient en cinq champs :
 *
 *     type : cle : nation : ambiance : zoom
 *
 * — pour une unité, `cle` est sa **silhouette** et non sa clé d'unité
 * (`silhouette:chenilles-bloc-tourelle-2:bleu:automne:jour:clair:2x` une fois
 * l'ambiance dépliée) : deux unités de même silhouette partagent le même canvas,
 * et une unité homologuée n'ajoute aucune entrée si sa silhouette existe déjà.
 *
 * Le cache est purgé au changement de palier de zoom, d'ambiance ou de ratio de
 * pixels — soit quelques fois par partie, ce qui est acceptable.
 */

import type { Pinceau } from './formes';

/** Une toile hors écran et son pinceau. */
export interface Toile {
  toile: OffscreenCanvas | HTMLCanvasElement;
  g: Pinceau;
  largeur: number;
  hauteur: number;
}

/** Les cinq champs d'une clé de cache. */
export interface ChampsCle {
  type: string;
  cle: string;
  nation: string;
  ambiance: string;
  zoom: number;
}

/** Compose la clé textuelle d'un sprite : `type:cle:nation:ambiance:zoom`. */
export function cleSprite(c: ChampsCle): string {
  return `${c.type}:${c.cle}:${c.nation}:${c.ambiance}:${c.zoom}x`;
}

/** Crée une toile hors écran : `OffscreenCanvas` si le navigateur le sait. */
export function creerToile(largeur: number, hauteur: number, ratio: number): Toile {
  const l = Math.max(1, Math.ceil(largeur * ratio));
  const h = Math.max(1, Math.ceil(hauteur * ratio));
  const g = globalThis as unknown as {
    OffscreenCanvas?: new (l: number, h: number) => OffscreenCanvas;
    document?: Document;
  };
  if (typeof g.OffscreenCanvas === 'function') {
    const toile = new g.OffscreenCanvas(l, h);
    const ctx = toile.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D hors écran indisponible.');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { toile, g: ctx, largeur, hauteur };
  }
  if (!g.document) throw new Error('Aucune surface hors écran disponible.');
  const toile = g.document.createElement('canvas');
  toile.width = l;
  toile.height = h;
  const ctx = toile.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D hors écran indisponible.');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { toile, g: ctx, largeur, hauteur };
}

/** Ce que le cache appelle pour peindre une entrée neuve. */
export type PeintreSprite = (g: Pinceau, largeur: number, hauteur: number) => void;

/**
 * Cache borné, à éviction du plus ancien. Le plafond protège d'une carte à
 * beaucoup de nations et de beaucoup d'ambiances : le cache ne doit jamais
 * devenir le problème de mémoire qu'il est censé éviter.
 */
export class CacheSprites {
  private readonly entrees = new Map<string, Toile>();

  private readonly plafond: number;

  private ratio: number;

  /** Signature courante : ambiance et palier de zoom. Sa rupture purge le cache. */
  private signature = '';

  constructor(ratio = 1, plafond = 256) {
    this.ratio = Math.max(1, ratio);
    this.plafond = Math.max(8, plafond);
  }

  /** Nombre d'entrées gardées. */
  get taille(): number {
    return this.entrees.size;
  }

  /** Le ratio de pixels des toiles du cache. */
  get ratioPixels(): number {
    return this.ratio;
  }

  /**
   * Déclare l'ambiance et le palier de zoom courants. Rend vrai si le cache a
   * été purgé — l'appelant en profite pour salir la scène.
   */
  contexte(ambiance: string, zoom: number, ratio: number): boolean {
    const signature = `${ambiance}|${zoom}|${ratio}`;
    if (signature === this.signature) return false;
    this.signature = signature;
    this.ratio = Math.max(1, ratio);
    this.vider();
    return true;
  }

  /** L'entrée d'une clé, peinte à la première demande. */
  obtenir(cle: string, largeur: number, hauteur: number, peindre: PeintreSprite): Toile {
    const memo = this.entrees.get(cle);
    if (memo) {
      // Remise en tête : la Map garde l'ordre d'insertion, c'est notre LRU.
      this.entrees.delete(cle);
      this.entrees.set(cle, memo);
      return memo;
    }
    const toile = creerToile(largeur, hauteur, this.ratio);
    peindre(toile.g, largeur, hauteur);
    this.entrees.set(cle, toile);
    if (this.entrees.size > this.plafond) {
      const plusAncienne = this.entrees.keys().next();
      if (!plusAncienne.done) this.entrees.delete(plusAncienne.value);
    }
    return toile;
  }

  /** Vide le cache : changement de ratio, d'ambiance ou de palier de zoom. */
  vider(): void {
    this.entrees.clear();
  }
}

/** Blitte une toile de cache à une position d'écran, taille logique conservée. */
export function blitter(g: Pinceau, toile: Toile, x: number, y: number): void {
  g.drawImage(
    toile.toile as CanvasImageSource,
    0, 0, (toile.toile as { width: number }).width, (toile.toile as { height: number }).height,
    x, y, toile.largeur, toile.hauteur,
  );
}
