/**
 * Les primitives de dessin vectoriel, reprises de `doc/assets/atlas-render-vector.html`
 * et typées. Tout le rendu passe par elles : rectangle arrondi, ellipse pleine,
 * ombre douce activée et désactivée explicitement autour d'un groupe.
 *
 * Aucune de ces fonctions ne connaît le jeu : elles ne voient qu'un pinceau.
 */

/** Un pinceau : contexte 2D d'un canvas visible ou d'un canvas hors écran. */
export type Pinceau = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Rectangle arrondi (le `rr` de la démo). Trace le chemin, sans remplir. */
export function rr(
  g: Pinceau, x: number, y: number, l: number, h: number, r: number,
): void {
  const rayon = Math.max(0, Math.min(r, Math.min(l, h) / 2));
  g.beginPath();
  g.moveTo(x + rayon, y);
  g.arcTo(x + l, y, x + l, y + h, rayon);
  g.arcTo(x + l, y + h, x, y + h, rayon);
  g.arcTo(x, y + h, x, y, rayon);
  g.arcTo(x, y, x + l, y, rayon);
  g.closePath();
}

/** Rectangle arrondi rempli. */
export function rrPlein(
  g: Pinceau, x: number, y: number, l: number, h: number, r: number, couleur: string,
): void {
  rr(g, x, y, l, h, r);
  g.fillStyle = couleur;
  g.fill();
}

/** Ellipse pleine (le `ell` de la démo). */
export function ell(
  g: Pinceau, x: number, y: number, rx: number, ry: number, couleur: string,
): void {
  g.beginPath();
  g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  g.fillStyle = couleur;
  g.fill();
}

/** Disque plein. */
export function disque(g: Pinceau, x: number, y: number, r: number, couleur: string): void {
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  g.fillStyle = couleur;
  g.fill();
}

/** Active ou désactive l'ombre douce, toujours autour d'un groupe explicite. */
export function ombre(g: Pinceau, active: boolean, flou = 8, decalage = 4): void {
  if (active) {
    g.shadowColor = 'rgba(0,0,0,0.28)';
    g.shadowBlur = flou;
    g.shadowOffsetY = decalage;
  } else {
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
  }
}

/** Trait épais aux bouts arrondis : canons, mâts, câbles. */
export function trait(
  g: Pinceau, x1: number, y1: number, x2: number, y2: number,
  couleur: string, epaisseur: number,
): void {
  g.strokeStyle = couleur;
  g.lineWidth = epaisseur;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** Polygone plein depuis une liste de points. */
export function polygone(g: Pinceau, points: readonly [number, number][], couleur: string): void {
  if (points.length < 3) return;
  const [premier, ...reste] = points;
  if (!premier) return;
  g.beginPath();
  g.moveTo(premier[0], premier[1]);
  for (const [x, y] of reste) g.lineTo(x, y);
  g.closePath();
  g.fillStyle = couleur;
  g.fill();
}

/**
 * Générateur pseudo-aléatoire de texture. Il est **seedé par la carte**, jamais
 * par l'horloge : sinon l'herbe et les vaguelettes bougent à chaque image et à
 * chaque redimensionnement (`02-architecture.md` §3.4, correction 1).
 */
export function bruit(graine: number): () => number {
  let etat = (graine | 0) || 1;
  return (): number => {
    etat = (etat * 9301 + 49297) % 233280;
    return etat / 233280;
  };
}

/** Empreinte entière d'une chaîne : sert de graine de texture à une carte. */
export function graineDe(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 233280;
}
