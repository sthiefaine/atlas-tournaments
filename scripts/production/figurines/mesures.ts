/**
 * Les mesures d'une figurine cuite, et leur verdict contre la charte. Pur :
 * des images décodées en entrée (`lecture.ts` les lit), des nombres en sortie.
 *
 * Deux sources. L'**image cuite** — ce que le joueur voit : largeur de la
 * silhouette contour compris, débords, part d'équipe (sur la page de masque,
 * parmi les pixels du modèle que dit la page de couverture, contour exclu),
 * lumière reçue par l'équipe, agitation du repos. L'**image d'identifiants**
 * (`fabriquer.py`) — ce que la palette couvre : un rendu à plat où chaque
 * pixel dit la teinte de sa pièce, sous la même caméra.
 *
 * La composition est celle du nuanceur du jeu (`src/render2d/lot.ts`), en
 * valeurs sRGB comme le tampon de WebGL : `c · a · mix(1, équipe, m) + fond · (1 − a)`.
 */

import type { Bornes, Charte } from './charte';

/** Une image cuite dans son cadre : couleur non prémultipliée, masque et couverture sur 0–255. */
export interface Cadre {
  l: number;
  h: number;
  /** Le pivot, en pixels continus depuis le coin haut-gauche (entier pour une image cuite). */
  px: number;
  py: number;
  rgba: Uint8Array;
  masque: Uint8Array | null;
  couverture: Uint8Array | null;
}

/** Une image de fond, RVB en valeurs sRGB de 0 à 1. */
export interface Fond {
  l: number;
  h: number;
  rvb: Float32Array;
}

export type Rvb01 = readonly [number, number, number];

/** Un fond uni. */
export function fondUni(l: number, h: number, couleur: Rvb01): Fond {
  const rvb = new Float32Array(l * h * 3);
  for (let p = 0; p < l * h; p++) rvb.set(couleur, p * 3);
  return { l, h, rvb };
}

/** Une couleur `#rrggbb` en sRGB de 0 à 1. */
export function rvb01(hex: string): Rvb01 {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** L'inverse de la fonction sRGB. */
export function lineaire(s: number): number {
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** La clarté CIE L* d'une couleur sRGB de 0 à 1. */
export function clarte(r: number, g: number, b: number): number {
  const y = 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

// ---------------------------------------------------------------------------
// 1. Composer comme le jeu
// ---------------------------------------------------------------------------

/**
 * Pose un cadre sur un fond, son pivot au pixel entier (`x`, `y`) du fond,
 * teint par `equipe` (null : blanc, aucune teinte), retourné si `miroir` — la
 * gauche est la droite retournée autour du pivot (`empaqueter`, `lot.ts`).
 */
export function composer(fond: Fond, c: Cadre, x: number, y: number, equipe: Rvb01 | null, miroir = false, opacite = 1): void {
  const gauche = miroir ? x - (c.l - c.px) : x - c.px;
  const haut = y - c.py;
  for (let j = 0; j < c.h; j++) {
    const fy = Math.round(haut + j);
    if (fy < 0 || fy >= fond.h) continue;
    for (let i = 0; i < c.l; i++) {
      const fx = Math.round(gauche + i);
      if (fx < 0 || fx >= fond.l) continue;
      const si = miroir ? c.l - 1 - i : i;
      const s = j * c.l + si;
      const a = (c.rgba[s * 4 + 3]! / 255) * opacite;
      if (a <= 0) continue;
      const m = equipe && c.masque ? c.masque[s]! / 255 : 0;
      const o = (fy * fond.l + fx) * 3;
      for (let k = 0; k < 3; k++) {
        const teinte = equipe ? 1 - m + m * equipe[k]! : 1;
        fond.rvb[o + k] = (c.rgba[s * 4 + k]! / 255) * a * teinte + fond.rvb[o + k]! * (1 - a);
      }
    }
  }
}

/**
 * L'ombre qu'un rendu pose sous une unité (`OMBRE_UNITE`, dessinée par
 * `render2d/replis.ts`) : une ellipse en dégradé radial — cœur noir, 0,75 à
 * 55 % du rayon, transparente au bord —, à l'opacité donnée.
 */
export function composerOmbre(fond: Fond, cx: number, cy: number, rx: number, ry: number, opacite: number): void {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    if (y < 0 || y >= fond.h) continue;
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (x < 0 || x >= fond.l) continue;
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const a = (d < 0.55 ? 1 - (0.25 * d) / 0.55 : 0.75 * (1 - (d - 0.55) / 0.45)) * opacite;
      const o = (y * fond.l + x) * 3;
      for (let k = 0; k < 3; k++) fond.rvb[o + k] = fond.rvb[o + k]! * (1 - a);
    }
  }
}

/**
 * Réduit un cadre d'un facteur `f` (0,375 pour 48 pixels par case) par la
 * moyenne des aires, en valeurs prémultipliées comme les mipmaps du jeu ; le
 * masque se moyenne tel quel, comme sa texture. La grille de sortie est calée
 * pour que le pivot tombe sur un pixel entier.
 */
export function reduireCadre(c: Cadre, f: number): Cadre {
  const P = Math.round(c.px * f);
  const Q = Math.round(c.py * f);
  const l = Math.ceil((c.l - c.px) * f) + P + 1;
  const h = Math.ceil((c.h - c.py) * f) + Q + 1;
  const rgba = new Uint8Array(l * h * 4);
  const masque = c.masque ? new Uint8Array(l * h) : null;
  const couverture = c.couverture ? new Uint8Array(l * h) : null;
  for (let j = 0; j < h; j++) {
    const sy0 = c.py + (j - Q) / f;
    const sy1 = c.py + (j + 1 - Q) / f;
    for (let i = 0; i < l; i++) {
      const sx0 = c.px + (i - P) / f;
      const sx1 = c.px + (i + 1 - P) / f;
      let r = 0;
      let g = 0;
      let b = 0;
      let sa = 0;
      let sm = 0;
      let sc = 0;
      let aire = 0;
      for (let y = Math.max(0, Math.floor(sy0)); y < Math.min(c.h, Math.ceil(sy1)); y++) {
        const wy = Math.min(sy1, y + 1) - Math.max(sy0, y);
        if (wy <= 0) continue;
        for (let x = Math.max(0, Math.floor(sx0)); x < Math.min(c.l, Math.ceil(sx1)); x++) {
          const wx = Math.min(sx1, x + 1) - Math.max(sx0, x);
          if (wx <= 0) continue;
          const w = wx * wy;
          const s = y * c.l + x;
          const a = c.rgba[s * 4 + 3]! / 255;
          r += w * a * c.rgba[s * 4]!;
          g += w * a * c.rgba[s * 4 + 1]!;
          b += w * a * c.rgba[s * 4 + 2]!;
          sa += w * a;
          if (c.masque) sm += w * c.masque[s]!;
          if (c.couverture) sc += w * c.couverture[s]!;
          aire += w;
        }
      }
      const norme = (sy1 - sy0) * (sx1 - sx0);
      if (aire <= 0) continue;
      const a = sa / norme;
      const o = j * l + i;
      if (a > 0) {
        rgba[o * 4] = Math.round(r / sa);
        rgba[o * 4 + 1] = Math.round(g / sa);
        rgba[o * 4 + 2] = Math.round(b / sa);
        rgba[o * 4 + 3] = Math.round(a * 255);
      }
      if (masque) masque[o] = Math.round(sm / norme);
      if (couverture) couverture[o] = Math.round(sc / norme);
    }
  }
  return { l, h, px: P, py: Q, rgba, masque, couverture };
}

// ---------------------------------------------------------------------------
// 2. Ce qu'une image cuite dit
// ---------------------------------------------------------------------------

/**
 * La part d'équipe : parmi les pixels du **modèle** (couverture ≥ 0,5 — le
 * contour et l'ombre n'en sont pas), ceux dont le masque vaut au moins 0,5.
 */
export function partEquipe(c: Cadre): { modele: number; equipe: number; part: number } {
  if (!c.couverture) throw new Error('mesure de la part d’équipe sans page de couverture');
  let modele = 0;
  let equipe = 0;
  for (let p = 0; p < c.l * c.h; p++) {
    if (c.couverture[p]! < 128) continue;
    modele++;
    if (c.masque && c.masque[p]! >= 128) equipe++;
  }
  return { modele, equipe, part: modele ? equipe / modele : 0 };
}

/**
 * L'emprise de la silhouette (alpha ≥ `seuil`, contour compris), en pixels,
 * mesurée depuis le pivot : à gauche, à droite, au-dessus, au-dessous.
 */
export function emprise(c: Cadre, seuil = 128): { gauche: number; droite: number; dessus: number; dessous: number; largeur: number; hauteur: number } | null {
  let x0 = c.l;
  let x1 = -1;
  let y0 = c.h;
  let y1 = -1;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.l; x++) {
      if (c.rgba[(y * c.l + x) * 4 + 3]! < seuil) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  return { gauche: c.px - x0, droite: x1 + 1 - c.px, dessus: c.py - y0, dessous: y1 + 1 - c.py, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 };
}

/**
 * La lumière que reçoivent les zones d'équipe : cuites en blanc, leur valeur
 * est la lumière reçue. Rend la part des pixels d'équipe qui en reçoivent au
 * moins `seuil` (en lumière linéaire) — une équipe portée par les dessus.
 */
export function partEquipeEclairee(c: Cadre, seuil: number): number {
  if (!c.couverture || !c.masque) return 0;
  let equipe = 0;
  let eclaires = 0;
  for (let p = 0; p < c.l * c.h; p++) {
    if (c.couverture[p]! < 255 || c.masque[p]! < 128) continue;
    equipe++;
    const v = Math.max(c.rgba[p * 4]!, c.rgba[p * 4 + 1]!, c.rgba[p * 4 + 2]!) / 255;
    if (lineaire(v) >= seuil) eclaires++;
  }
  return equipe ? eclaires / equipe : 0;
}

/**
 * La silhouette d'un cadre en ombre chinoise, ramenée à `pixelsParCase`
 * pixels par case (48 : la carte vue de loin) depuis `pixelsSource` (ceux de
 * la cuisson) par `reduireCadre` — la grille calée sur le pivot, comme les
 * mipmaps du jeu —, un pixel plein si l'alpha, contour compris, le couvre à
 * moitié. Rend les pixels pleins, « x,y » depuis le pivot : deux silhouettes
 * se comparent sans se recadrer.
 */
export function silhouette(c: Cadre, pixelsParCase: number, pixelsSource: number): Set<string> {
  const r = reduireCadre(c, pixelsParCase / pixelsSource);
  const pleins = new Set<string>();
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.l; x++) if (r.rgba[(y * r.l + x) * 4 + 3]! >= 128) pleins.add(`${x - r.px},${y - r.py}`);
  }
  return pleins;
}

/** L'intersection sur l'union de deux silhouettes : 0 disjointes, 1 confondues. */
export function iou(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let commun = 0;
  for (const cle of a) if (b.has(cle)) commun++;
  const union = a.size + b.size - commun;
  return union ? commun / union : 0;
}

/** La clarté L* moyenne des pixels du modèle hors équipe, telle que cuite : une information. */
export function clarteHorsEquipe(c: Cadre): number {
  if (!c.couverture) return 0;
  let n = 0;
  let somme = 0;
  for (let p = 0; p < c.l * c.h; p++) {
    if (c.couverture[p]! < 255 || (c.masque && c.masque[p]! >= 128)) continue;
    n++;
    somme += clarte(c.rgba[p * 4]! / 255, c.rgba[p * 4 + 1]! / 255, c.rgba[p * 4 + 2]! / 255);
  }
  return n ? somme / n : 0;
}

/**
 * Les composantes connexes (8-voisinage) d'une image binaire : la taille de
 * la plus grande, et le total.
 */
export function composantes(binaire: Uint8Array, l: number, h: number): { plusGrande: number; total: number; nombre: number } {
  const vu = new Uint8Array(l * h);
  const pile: number[] = [];
  let plusGrande = 0;
  let total = 0;
  let nombre = 0;
  for (let depart = 0; depart < l * h; depart++) {
    if (!binaire[depart] || vu[depart]) continue;
    nombre++;
    let taille = 0;
    vu[depart] = 1;
    pile.push(depart);
    while (pile.length) {
      const p = pile.pop()!;
      taille++;
      const x = p % l;
      const y = (p - x) / l;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if ((dx || dy) && xx >= 0 && yy >= 0 && xx < l && yy < h) {
            const q = yy * l + xx;
            if (binaire[q] && !vu[q]) {
              vu[q] = 1;
              pile.push(q);
            }
          }
        }
      }
    }
    total += taille;
    plusGrande = Math.max(plusGrande, taille);
  }
  return { plusGrande, total, nombre };
}

/**
 * La part de l'équipe que porte sa plus grande zone d'un seul tenant, à
 * `pixelsParCase` (48 : un téléphone) : l'équipe du cadre réduite par les
 * aires, seuillée à la moitié, et ses composantes.
 */
export function equipeConnexe(c: Cadre, facteur: number): number {
  if (!c.couverture || !c.masque) return 0;
  const binaire: Cadre = { ...c, masque: new Uint8Array(c.l * c.h) };
  for (let p = 0; p < c.l * c.h; p++) binaire.masque![p] = c.couverture[p]! >= 128 && c.masque[p]! >= 128 ? 255 : 0;
  const r = reduireCadre(binaire, facteur);
  const b = new Uint8Array(r.l * r.h);
  for (let p = 0; p < r.l * r.h; p++) b[p] = r.masque![p]! >= 128 ? 1 : 0;
  const k = composantes(b, r.l, r.h);
  return k.total ? k.plusGrande / k.total : 0;
}

/**
 * L'agitation d'un clip : ses images recalées sur leur pivot et composées sur
 * `fond` en `equipe`, la part des pixels de la silhouette qui changent de plus
 * de `seuil` niveaux d'une image à la suivante (la dernière à la première
 * pour une boucle). `exclure` : un masque de pixels à ignorer, en coordonnées
 * relatives au pivot (les pièces tournantes déclarées).
 */
export function agitation(cadres: readonly Cadre[], equipe: Rvb01, fond: Rvb01, seuil: number, boucle: boolean,
  exclure?: (dx: number, dy: number) => boolean): { moyenne: number; pire: number } {
  if (cadres.length < 2) return { moyenne: 0, pire: 0 };
  const G = Math.max(...cadres.map((c) => c.px));
  const H = Math.max(...cadres.map((c) => c.py));
  const l = G + Math.max(...cadres.map((c) => c.l - c.px));
  const h = H + Math.max(...cadres.map((c) => c.h - c.py));
  const images = cadres.map((c) => {
    const f = fondUni(l, h, fond);
    composer(f, c, G, H, equipe);
    const alpha = new Uint8Array(l * h);
    for (let j = 0; j < c.h; j++) {
      for (let i = 0; i < c.l; i++) alpha[(j + H - c.py) * l + (i + G - c.px)] = c.rgba[(j * c.l + i) * 4 + 3]!;
    }
    return { rvb: f.rvb, alpha };
  });
  const parts: number[] = [];
  const paires = boucle ? images.length : images.length - 1;
  for (let k = 0; k < paires; k++) {
    const a = images[k]!;
    const b = images[(k + 1) % images.length]!;
    let union = 0;
    let changes = 0;
    for (let p = 0; p < l * h; p++) {
      if (a.alpha[p]! <= 32 && b.alpha[p]! <= 32) continue;
      const x = p % l;
      const y = (p - x) / l;
      if (exclure && exclure(x - G, y - H)) continue;
      union++;
      let ecart = 0;
      for (let c = 0; c < 3; c++) ecart = Math.max(ecart, Math.abs(a.rvb[p * 3 + c]! - b.rvb[p * 3 + c]!) * 255);
      if (ecart > seuil) changes++;
    }
    parts.push(union ? changes / union : 0);
  }
  return { moyenne: parts.reduce((s, v) => s + v, 0) / parts.length, pire: Math.max(...parts) };
}

// ---------------------------------------------------------------------------
// 3. Ce que dit une image d'identifiants
// ---------------------------------------------------------------------------

/** Une image d'identifiants décodée : RVBA, pivot au pixel (`-x0`, `-y0`) du canevas. */
export interface ImageIds { l: number; h: number; x0: number; y0: number; rgba: Uint8Array }

/** La teinte d'un pixel d'identifiant (R = 10 × (indice + 1)), ou −1 hors du modèle. */
export function teinteDuPixel(r: number, a: number): number {
  return a < 128 ? -1 : Math.round(r / 10) - 1;
}

/** Ce que `partsTeintes` rend. */
export interface PaletteIds {
  total: number;
  parts: Record<string, number>;
  /** Le centre vertical de chaque teinte (px, vers le bas). */
  centreY: Record<string, number>;
  centreYTotal: number;
  /** Les mêmes, sans les pièces qui tournent sans fin (G ≥ 128 dans l'identifiant) : un rotor sombre ne dit rien de l'assise. */
  partsFixes: Record<string, number>;
  centreYFixe: Record<string, number>;
  centreYTotalFixe: number;
}

/** Les parts de chaque teinte dans une image d'identifiants, et le centre vertical de chacune (px, vers le bas). */
export function partsTeintes(ids: ImageIds, charte: Charte): PaletteIds {
  const comptes = new Map<number, { n: number; y: number }>();
  const fixes = new Map<number, { n: number; y: number }>();
  let total = 0;
  let sy = 0;
  let totalFixe = 0;
  let syFixe = 0;
  for (let p = 0; p < ids.l * ids.h; p++) {
    const t = teinteDuPixel(ids.rgba[p * 4]!, ids.rgba[p * 4 + 3]!);
    if (t < 0) continue;
    const y = Math.floor(p / ids.l);
    total++;
    sy += y;
    const c = comptes.get(t) ?? { n: 0, y: 0 };
    c.n++;
    c.y += y;
    comptes.set(t, c);
    if (ids.rgba[p * 4 + 1]! >= 128) continue;
    totalFixe++;
    syFixe += y;
    const f = fixes.get(t) ?? { n: 0, y: 0 };
    f.n++;
    f.y += y;
    fixes.set(t, f);
  }
  const nomDe = (i: number): string => charte.teintes[i]?.nom ?? `inconnue_${i}`;
  const parts: Record<string, number> = {};
  const centreY: Record<string, number> = {};
  for (const [i, c] of comptes) {
    parts[nomDe(i)] = c.n / total;
    centreY[nomDe(i)] = c.y / c.n;
  }
  const partsFixes: Record<string, number> = {};
  const centreYFixe: Record<string, number> = {};
  for (const [i, c] of fixes) {
    partsFixes[nomDe(i)] = c.n / totalFixe;
    centreYFixe[nomDe(i)] = c.y / c.n;
  }
  return { total, parts, centreY, centreYTotal: total ? sy / total : 0, partsFixes, centreYFixe, centreYTotalFixe: totalFixe ? syFixe / totalFixe : 0 };
}

/**
 * La masse sombre tient-elle le bas de la silhouette ? Son centre vertical
 * doit tomber sous celui du modèle. Les pièces tournantes n'y comptent pas :
 * un rotor graphite, tout en haut, n'est pas une masse qui assoit l'unité —
 * compté, il tire le centre sombre vers le haut et oblige un appareil à
 * rotors à charger son bas de graphite pour compenser.
 */
export function masseSombreEnBas(palette: PaletteIds, sombres: readonly string[]): boolean {
  const poids = sombres.reduce((s, n) => s + (palette.partsFixes[n] ?? 0), 0);
  if (!(poids > 0)) return false;
  const y = sombres.reduce((s, n) => s + (palette.partsFixes[n] ?? 0) * (palette.centreYFixe[n] ?? 0), 0) / poids;
  return y > palette.centreYTotalFixe;
}

/** L'emprise du modèle dans une image d'identifiants, en pixels depuis le pivot (sans contour). */
export function empriseIds(ids: ImageIds): { gauche: number; droite: number; dessus: number; largeur: number; hauteur: number } | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let p = 0; p < ids.l * ids.h; p++) {
    if (ids.rgba[p * 4 + 3]! < 128) continue;
    const x = p % ids.l;
    const y = (p - x) / ids.l;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  // Le pivot est au pixel (−x0, −y0) du canevas.
  return { gauche: -ids.x0 - x0, droite: x1 + 1 + ids.x0, dessus: -ids.y0 - y0, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 };
}

/** Les pixels d'une pièce tournante (G ≥ 128), en coordonnées relatives au pivot. */
export function pixelsTournants(images: readonly ImageIds[]): Set<string> {
  const s = new Set<string>();
  for (const ids of images) {
    for (let p = 0; p < ids.l * ids.h; p++) {
      if (ids.rgba[p * 4 + 3]! < 128 || ids.rgba[p * 4 + 1]! < 128) continue;
      const x = p % ids.l;
      s.add(`${x + ids.x0},${Math.floor(p / ids.l) + ids.y0}`);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// 4. Les règles
// ---------------------------------------------------------------------------

export type Verdict = 'ok' | 'echec' | 'info';

export interface Regle {
  id: string;
  libelle: string;
  valeur: number | string | boolean | null;
  attendu: string;
  verdict: Verdict;
}

/** Le genre d'une unité, pour ses seuils : il se lit dans le canon (`content/unites.json`). */
export type Genre = 'vehicule' | 'fantassin' | 'rotor' | 'avion' | 'drone' | 'navire';

/** Le genre d'une unité du canon : ses pattes, son domaine, son nom. */
export function genreDe(u: { cle: string; domaine: string; silhouette: { base: string } }): Genre {
  if (u.silhouette.base === 'pattes') return 'fantassin';
  if (u.domaine === 'mer') return 'navire';
  if (u.domaine === 'air') {
    if (u.cle.includes('drone')) return 'drone';
    return u.silhouette.base === 'rotor' ? 'rotor' : 'avion';
  }
  return 'vehicule';
}

/** La classe de taille : la taille de silhouette du canon. */
export function classeDe(taille: number): 'petite' | 'moyenne' | 'grande' {
  return taille === 1 ? 'petite' : taille === 3 ? 'grande' : 'moyenne';
}

/** Ce que les règles lisent. */
export interface Mesures {
  cle: string;
  genre: Genre;
  classe: 'petite' | 'moyenne' | 'grande';
  gris: boolean;
  /** Une fourchette plus étroite que la classe, déclarée par le module de l'unité (`LARGEUR_VISEE`). */
  largeurVisee?: Bornes;
  equipe: { droite: number; bas: number; haut: number; profil: number | null };
  equipeEclairee: number;
  equipeConnexe: number;
  largeurDroite: number;
  hauteurDroite: number;
  debordLateral: number;
  hauteurAuDessusPivot: number;
  agitation: { moyenne: number; pire: number };
  clarteHorsEquipe: number;
  palette: { parts: Record<string, number>; sombreEnBas: boolean } | null;
  equipeIds: number | null;
  triangles: number;
  materiaux: { trouves: string[]; attendus: string[]; max: number };
  teintes: string[];
  piecesFines: { nom: string; epaisseur: number; fin: boolean }[];
  rotationRepos: Record<string, number>;
  tournants: string[];
  basAuRepos: number;
  controle: { ok: boolean; motifs: number };
  /**
   * L'ombre chinoise la plus proche parmi les unités du même milieu déjà
   * installées (charte, `recouvrement`) : null s'il n'y en a aucune ; absent
   * sans cuisson.
   */
  recouvrement?: { unite: string; vue: 'droite' | 'bas'; valeur: number; droite: number; bas: number } | null;
}

const pct = (v: number): string => `${(v * 100).toFixed(1)} %`;
const cases = (v: number): string => `${v.toFixed(3)} case`;

function dans(v: number, b: Bornes): boolean {
  return (b.min === undefined || v >= b.min - 1e-9) && (b.max === undefined || v <= b.max + 1e-9);
}

function texteBornes(b: Bornes, format: (v: number) => string): string {
  if (b.min !== undefined && b.max !== undefined) return `${format(b.min)} à ${format(b.max)}`;
  if (b.min !== undefined) return `≥ ${format(b.min)}`;
  return `≤ ${format(b.max!)}`;
}

/** Les règles de la charte, chacune avec sa valeur mesurée et son verdict. */
export function regles(m: Mesures, charte: Charte): Regle[] {
  const r: Regle[] = [];
  const regle = (id: string, libelle: string, valeur: Regle['valeur'], attendu: string, ok: boolean | null): void => {
    r.push({ id, libelle, valeur, attendu, verdict: ok === null ? 'info' : ok ? 'ok' : 'echec' });
  };
  const fantassin = m.genre === 'fantassin';
  const vol = m.genre === 'rotor' || m.genre === 'avion' || m.genre === 'drone';

  regle('controle_fiche', 'Le lot passe le contrôle du dépôt (controlerDepot)', m.controle.ok, 'ok', m.controle.ok);

  const bEquipe = fantassin ? charte.equipe.droiteFantassin : charte.equipe.droite;
  regle('equipe_droite', 'Part d’équipe, vue droite (modèle, contour exclu)', Number(m.equipe.droite.toFixed(4)), texteBornes(bEquipe, pct), dans(m.equipe.droite, bEquipe));
  const bBasHaut: Bornes = { min: charte.equipe.basEtHautMin };
  regle('equipe_bas', 'Part d’équipe, vue bas', Number(m.equipe.bas.toFixed(4)), texteBornes(bBasHaut, pct), dans(m.equipe.bas, bBasHaut));
  regle('equipe_haut', 'Part d’équipe, vue haut', Number(m.equipe.haut.toFixed(4)), texteBornes(bBasHaut, pct), dans(m.equipe.haut, bBasHaut));
  if (m.equipe.profil !== null) regle('equipe_profil', 'Part d’équipe, vue profil (écran de combat)', Number(m.equipe.profil.toFixed(4)), 'information', null);
  const bConnexe: Bornes = { min: charte.equipe.connexeMin };
  regle('equipe_connexe', `Plus grande zone d’équipe d’un seul tenant à ${charte.equipe.pixelsParCaseConnexe} px, part de l’équipe`, Number(m.equipeConnexe.toFixed(4)), texteBornes(bConnexe, pct), dans(m.equipeConnexe, bConnexe));
  // Proposée par le panel, non arrêtée ; et hors de portée d'une figurine debout,
  // dont le torse est vertical : une information pour les fantassins.
  // La laque plafonne vers 0,86–0,88 sur un dessus plat (mesuré, `charte.json`) :
  // le seuil laisse peu de marge, et une pente d'équipe raide passe dessous.
  regle('equipe_eclairee', `Équipe portée par les dessus : part des pixels d’équipe qui reçoivent ≥ ${charte.equipe.eclairee.lumiereMin} de lumière — la laque plafonne vers 0,9 (seuil proposé, non arrêté)`,
    Number(m.equipeEclairee.toFixed(4)), fantassin ? 'information (fantassin)' : `≥ ${pct(charte.equipe.eclairee.partMin)}`,
    fantassin ? null : m.equipeEclairee >= charte.equipe.eclairee.partMin);
  if (m.equipeIds !== null) {
    const ecart = Math.abs(m.equipeIds - m.equipe.droite);
    regle('equipe_coherente', 'Part d’équipe des identifiants contre celle du masque cuit (UV dans la bonne case)', Number(ecart.toFixed(4)), 'écart ≤ 5 points', ecart <= 0.05);
  }

  if (fantassin) {
    regle('largeur', 'Largeur de la silhouette, vue droite, contour compris', Number(m.largeurDroite.toFixed(4)), texteBornes(charte.tailles.fantassin.largeur, cases), dans(m.largeurDroite, charte.tailles.fantassin.largeur));
    regle('hauteur', 'Hauteur de la silhouette, vue droite, contour compris', Number(m.hauteurDroite.toFixed(4)), texteBornes(charte.tailles.fantassin.hauteur, cases), dans(m.hauteurDroite, charte.tailles.fantassin.hauteur));
  } else {
    const bClasse = charte.tailles.classes[m.classe];
    regle('largeur', `Largeur de la silhouette, vue droite, contour compris (classe ${m.classe})`, Number(m.largeurDroite.toFixed(4)), texteBornes(bClasse, cases), dans(m.largeurDroite, bClasse));
    if (m.largeurVisee) regle('largeur_visee', 'Largeur visée par le module de l’unité', Number(m.largeurDroite.toFixed(4)), texteBornes(m.largeurVisee, cases), dans(m.largeurDroite, m.largeurVisee));
  }
  regle('debord_lateral', 'Débord latéral depuis le pivot, toutes vues et images de carte', Number(m.debordLateral.toFixed(4)), `≤ ${cases(charte.tailles.debordLateralMax)}`, m.debordLateral <= charte.tailles.debordLateralMax + 1e-9);
  const hMax = vol ? charte.tailles.hauteurAuDessusDuPivotMax.vol : charte.tailles.hauteurAuDessusDuPivotMax.sol;
  regle('hauteur_pivot', 'Hauteur au-dessus du pivot, toutes vues et images de carte', Number(m.hauteurAuDessusPivot.toFixed(4)), `≤ ${cases(hMax)}`, m.hauteurAuDessusPivot <= hMax + 1e-9);
  // Le bord haut de la case est à une demi-case de profondeur du pivot, soit 0,5 · sin 50° à l'écran.
  const debordCase = Math.max(0, m.hauteurAuDessusPivot - 0.5 * Math.sin((50 * Math.PI) / 180));
  regle('debord_case', 'Débord au-dessus du bord haut de la case (information)', Number(debordCase.toFixed(4)), 'information', null);
  if (vol) {
    const cible = charte.altitudes[m.genre as 'rotor' | 'avion' | 'drone'];
    regle('altitude', 'Altitude du bas de la silhouette au repos (m)', Number(m.basAuRepos.toFixed(4)), `${cible} ± ${charte.altitudes.tolerance}`, Math.abs(m.basAuRepos - cible) <= charte.altitudes.tolerance + 1e-9);
  } else {
    regle('au_sol', 'Bas du modèle au repos (m)', Number(m.basAuRepos.toFixed(4)), '0 ± 0,01', Math.abs(m.basAuRepos) <= 0.01);
  }

  const aMax = vol ? charte.repos.agitationMax.vol : charte.repos.agitationMax.sol;
  regle('repos_agitation', `Repos : pixels qui changent de plus de ${charte.repos.seuilNiveaux} niveaux d’une image à l’autre (pire paire)${m.tournants.length ? ', pièces tournantes exclues' : ''}`,
    Number(m.agitation.pire.toFixed(4)), `≤ ${pct(aMax)}`, m.agitation.pire <= aMax + 1e-9);
  const rotations = Object.entries(m.rotationRepos).filter(([n]) => !m.tournants.includes(n));
  const pireRotation = rotations.reduce((s, [, v]) => Math.max(s, v), 0);
  regle('repos_rotation', 'Repos : plus grande rotation d’une pièce (hors pièces tournantes), degrés', Number(pireRotation.toFixed(3)), `≤ ${charte.repos.rotationMaxDegres}°`, pireRotation <= charte.repos.rotationMaxDegres + 1e-9);

  if (m.palette) {
    for (const [nom, b] of Object.entries(charte.palette.parts)) {
      if (b.seulementPour === 'gris' && !m.gris) continue;
      const v = nom === 'sombre'
        ? charte.teintes.filter((t) => t.sombre).reduce((s, t) => s + (m.palette!.parts[t.nom] ?? 0), 0)
        : m.palette.parts[nom] ?? 0;
      regle(`palette_${nom}`, nom === 'sombre' ? 'Masse sombre (graphite et caoutchouc), vue droite' : `Part de la teinte ${nom}, vue droite`, Number(v.toFixed(4)), texteBornes(b, pct), dans(v, b));
    }
    regle('palette_sombre_en_bas', 'La masse sombre tient le bas de la silhouette', m.palette.sombreEnBas, 'vrai', m.palette.sombreEnBas);
  }
  regle('teintes', 'Teintes de la palette portées, équipe comprise', m.teintes.length, `≤ ${charte.palette.teintesMax}`, m.teintes.length <= charte.palette.teintesMax);
  regle('budget', 'Triangles', m.triangles, `≤ ${charte.budget.triangles}`, m.triangles <= charte.budget.triangles);
  const materiauxOk = m.materiaux.trouves.length <= m.materiaux.max && m.materiaux.attendus.every((n) => m.materiaux.trouves.includes(n));
  regle('materiaux', 'Matériaux, ceux de la fiche', m.materiaux.trouves.join(', '), m.materiaux.attendus.join(', '), materiauxOk);
  const fines = m.piecesFines.filter((p) => p.epaisseur < (p.fin ? charte.formes.epaisseurMinAntenne : charte.formes.epaisseurMin) - 1e-9);
  regle('epaisseur', `Pièces sous ${charte.formes.epaisseurMin} m (antennes : ${charte.formes.epaisseurMinAntenne} m)`, fines.map((p) => `${p.nom} ${p.epaisseur}`).join(', ') || 'aucune', 'aucune', fines.length === 0);
  regle('clarte_hors_equipe', 'Clarté L* moyenne hors équipe, cuite (information)', Number(m.clarteHorsEquipe.toFixed(1)), 'information', null);
  if (m.recouvrement !== undefined) {
    const rc = m.recouvrement;
    // D'information d'abord : la valeur dit la plus proche, le seuil est à côté.
    regle('recouvrement', `Ombre chinoise à ${charte.recouvrement.pixelsParCase} px : IoU la plus forte contre une unité installée du même milieu (vues droite et bas)`,
      rc ? `${rc.valeur.toFixed(3)} ${rc.unite} (${rc.vue})` : 'aucune à comparer', `≤ ${charte.recouvrement.max.toFixed(2)} (information)`, null);
  }
  return r;
}
