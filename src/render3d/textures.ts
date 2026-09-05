/**
 * Les textures **procédurales**, générées au chargement dans des `canvas`.
 *
 * Albédos et normales sont peints au chargement, sans téléchargement : palettes
 * des dix biomes, strates minérales, touffes et rides du sable. Les détails
 * restent continus et déterministes pour une lecture nette en vue rapprochée.
 *
 * Toutes les fonctions prennent le `Document` en paramètre : rien ici ne suppose
 * un `window` global, ce qui garde le module montable dans un `iframe` ou un
 * canvas hors écran.
 */

import * as THREE from 'three';
import type { Biome } from '../schemas/types';

/** Les matières du terrain, dans l'ordre des canaux de la carte de mélange. */
export type Matiere = 'herbe' | 'terre' | 'roche' | 'sable' | 'neige';

/** Un générateur pseudo-aléatoire déterministe : deux montages, mêmes textures. */
function rng(graine: number): () => number {
  let e = graine >>> 0;
  return (): number => {
    e = (e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Interpolation douce, la classique `3t² − 2t³`. */
function adoucir(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Bruit de valeur bouclant sur `taille` : une grille aléatoire de `periode`
 * points, interpolée en douceur. Le bouclage est indispensable — la texture est
 * répétée des dizaines de fois sur le plateau, une couture se verrait aussitôt.
 */
function bruit(taille: number, periode: number, graine: number): Float32Array {
  const alea = rng(graine);
  const grille = new Float32Array(periode * periode);
  for (let i = 0; i < grille.length; i += 1) grille[i] = alea();
  const sortie = new Float32Array(taille * taille);
  const pas = periode / taille;
  for (let y = 0; y < taille; y += 1) {
    const fy = y * pas;
    const y0 = Math.floor(fy) % periode;
    const y1 = (y0 + 1) % periode;
    const ty = adoucir(fy - Math.floor(fy));
    for (let x = 0; x < taille; x += 1) {
      const fx = x * pas;
      const x0 = Math.floor(fx) % periode;
      const x1 = (x0 + 1) % periode;
      const tx = adoucir(fx - Math.floor(fx));
      const a = (grille[y0 * periode + x0] ?? 0) + ((grille[y0 * periode + x1] ?? 0) - (grille[y0 * periode + x0] ?? 0)) * tx;
      const b = (grille[y1 * periode + x0] ?? 0) + ((grille[y1 * periode + x1] ?? 0) - (grille[y1 * periode + x0] ?? 0)) * tx;
      sortie[y * taille + x] = a + (b - a) * ty;
    }
  }
  return sortie;
}

/** Somme d'octaves : la structure large, puis le détail. */
export function bruitFractal(
  taille: number, octaves: number, periodeBase: number, graine: number,
): Float32Array {
  const sortie = new Float32Array(taille * taille);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const couche = bruit(taille, Math.max(2, Math.round(periodeBase * 2 ** o)), graine + o * 7919);
    for (let i = 0; i < sortie.length; i += 1) sortie[i] = (sortie[i] ?? 0) + (couche[i] ?? 0) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < sortie.length; i += 1) sortie[i] = (sortie[i] ?? 0) / total;
  return sortie;
}

/** Un canvas carré, prêt à peindre. */
function toile(doc: Document, taille: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = doc.createElement('canvas');
  c.width = taille;
  c.height = taille;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponible : textures procédurales impossibles.');
  return { c, g };
}

/** Mélange linéaire de deux couleurs `[r, v, b]`. */
function mel(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [
    (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * k,
    (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * k,
    (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * k,
  ];
}

/** Recette d'une matière : deux teintes, un grain fin, une part de tacheture. */
interface Recette {
  sombre: [number, number, number];
  clair: [number, number, number];
  periode: number;
  octaves: number;
  grain: number;
  /** Fréquence des taches (cailloux, touffes, fissures). */
  taches: number;
  couleurTache: [number, number, number];
  graine: number;
}

const RECETTES: Readonly<Record<Matiere, Recette>> = {
  herbe: {
    sombre: [110, 142, 84], clair: [130, 158, 102], periode: 6, octaves: 2,
    grain: 0.025, taches: 0.01, couleurTache: [96, 124, 56], graine: 11,
  },
  terre: {
    sombre: [131, 111, 85], clair: [151, 131, 104], periode: 5, octaves: 2,
    grain: 0.025, taches: 0.01, couleurTache: [188, 172, 148], graine: 23,
  },
  roche: {
    sombre: [133, 140, 150], clair: [153, 159, 169], periode: 4, octaves: 2,
    grain: 0.025, taches: 0.01, couleurTache: [60, 63, 69], graine: 37,
  },
  sable: {
    sombre: [214, 192, 143], clair: [234, 214, 164], periode: 6, octaves: 2,
    grain: 0.025, taches: 0.01, couleurTache: [172, 150, 104], graine: 53,
  },
  neige: {
    sombre: [214, 226, 240], clair: [255, 255, 255], periode: 5, octaves: 2,
    grain: 0.025, taches: 0.01, couleurTache: [232, 242, 252], graine: 67,
  },
};

/** Palettes minérales et végétales : le biome reste reconnaissable sans décor. */
const PALETTES: Readonly<Record<Biome, Partial<Record<Matiere, readonly [string, string]>>>> = {
  plaine: { herbe: ['#6e934e', '#a2b879'], terre: ['#987d58', '#b19c76'] },
  foret: { herbe: ['#426d48', '#7d995b'], terre: ['#6d6145', '#a18b63'] },
  montagne: { herbe: ['#78835d', '#acb38b'], roche: ['#747e89', '#b8bdc0'] },
  desert: { herbe: ['#bb995b', '#dcc38c'], terre: ['#ac764c', '#d5a270'], roche: ['#9b6a51', '#c29474'], sable: ['#d9af70', '#f1d59b'] },
  jungle: { herbe: ['#32734b', '#79a56b'], terre: ['#805c42', '#ab8356'], roche: ['#6b8074', '#a3b2a1'] },
  neige: { herbe: ['#bac6c7', '#e3e9e7'], terre: ['#9aabb2', '#c1cbd0'], roche: ['#8398aa', '#b7c9d5'] },
  volcanique: { herbe: ['#666c54', '#8b8964'], terre: ['#574d48', '#827064'], roche: ['#494d56', '#7b7e88'], sable: ['#787574', '#a49b8c'] },
  cotier: { herbe: ['#789563', '#afba84'], roche: ['#8e9392', '#b9b7a9'], sable: ['#d8c49c', '#f0e0b9'] },
  archipel: { herbe: ['#4e9466', '#9ab978'], sable: ['#ddd2b1', '#f4e9cb'] },
  marais: { herbe: ['#627a4e', '#96a16b'], terre: ['#686341', '#90865d'], roche: ['#758077', '#a1aa96'] },
};

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Champs continus, répétables : strates rocheuses, rides du sable, touffes peintes. */
function reliefPeint(matiere: Matiere, u: number, v: number, large: number, detail: number): number {
  const tau = Math.PI * 2;
  if (matiere === 'roche') {
    const strate = Math.sin((u * 2 + v * 5) * tau + large * 4);
    const fissure = Math.max(0, 1 - Math.abs(strate) * 9);
    return large * 0.66 + detail * 0.20 - fissure * 0.14;
  }
  if (matiere === 'sable' || matiere === 'neige') {
    const rides = Math.sin((u * 3 + v * 7) * tau + large * 3) * 0.5 + 0.5;
    return large * 0.80 + rides * 0.16 + detail * 0.04;
  }
  const touffes = Math.pow(Math.max(0, (detail - 0.36) / 0.64), 1.7);
  return large * 0.76 + touffes * 0.24;
}

/** Peint l'albédo d'une matière et rend en même temps son champ de hauteur. */
export function albedoMatiere(
  doc: Document, matiere: Matiere, taille = 256, biome: Biome = 'plaine',
): { canvas: HTMLCanvasElement; hauteur: Float32Array } {
  const recette = RECETTES[matiere];
  const palette = PALETTES[biome][matiere];
  const r = palette ? { ...recette, sombre: rgb(palette[0]), clair: rgb(palette[1]) } : recette;
  const { c, g } = toile(doc, taille);
  const base = bruitFractal(taille, r.octaves, r.periode, r.graine);
  const detail = bruitFractal(taille, 3, taille / 8, r.graine + 101);
  const tache = bruitFractal(taille, 2, taille / 6, r.graine + 211);
  const image = g.createImageData(taille, taille);
  const hauteur = new Float32Array(taille * taille);
  for (let i = 0; i < taille * taille; i += 1) {
    const n = reliefPeint(matiere, (i % taille) / taille, Math.floor(i / taille) / taille, base[i] ?? 0.5, detail[i] ?? 0.5);
    let couleur = mel(r.sombre, r.clair, n);
    const t = tache[i] ?? 0.5;
    if (t > 1 - r.taches) couleur = mel(couleur, r.couleurTache, (t - (1 - r.taches)) / r.taches);
    const j = i * 4;
    image.data[j] = couleur[0];
    image.data[j + 1] = couleur[1];
    image.data[j + 2] = couleur[2];
    image.data[j + 3] = 255;
    hauteur[i] = n;
  }
  g.putImageData(image, 0, 0);
  return { canvas: c, hauteur };
}

/**
 * Carte de normales approximative, dérivée du champ de hauteur par différences
 * centrées (un Sobel allégé). Ce n'est pas une normale mesurée, mais elle suffit
 * à accrocher la lumière rasante — c'est exactement ce qu'on lui demande ici.
 */
export function normalesDepuis(
  doc: Document, hauteur: Float32Array, taille: number, force = 2.4,
): HTMLCanvasElement {
  const { c, g } = toile(doc, taille);
  const image = g.createImageData(taille, taille);
  const h = (x: number, y: number): number => {
    const xi = ((x % taille) + taille) % taille;
    const yi = ((y % taille) + taille) % taille;
    return hauteur[yi * taille + xi] ?? 0;
  };
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * force;
      const dy = (h(x, y + 1) - h(x, y - 1)) * force;
      const l = Math.hypot(dx, dy, 1);
      const j = (y * taille + x) * 4;
      image.data[j] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      image.data[j + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      image.data[j + 2] = Math.round((1 / l) * 0.5 * 255 + 127);
      image.data[j + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return c;
}

/** Une texture three.js répétable depuis un canvas. */
export function texture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Le jeu complet d'une matière : albédo et normales, déjà en textures. */
export interface JeuMatiere {
  albedo: THREE.CanvasTexture;
  normales: THREE.CanvasTexture;
}

/** Fabrique le jeu de textures d'une matière. */
export function jeuMatiere(doc: Document, matiere: Matiere, taille = 256, biome: Biome = 'plaine'): JeuMatiere {
  const { canvas, hauteur } = albedoMatiere(doc, matiere, taille, biome);
  const normales = normalesDepuis(doc, hauteur, taille, matiere === 'roche' ? 2.6 : 1.25);
  return { albedo: texture(canvas, true), normales: texture(normales, false) };
}

/**
 * Les normales de l'eau : deux trains de vagues croisés. On n'en fait pas
 * d'albédo — la couleur de l'eau vient de l'ambiance, ses reflets de la lumière.
 */
export function normalesEau(doc: Document, taille = 256): THREE.CanvasTexture {
  const hauteur = new Float32Array(taille * taille);
  const houle = bruitFractal(taille, 3, 5, 907);
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const i = y * taille + x;
      const u = (x / taille) * Math.PI * 2;
      const v = (y / taille) * Math.PI * 2;
      hauteur[i] = 0.5
        + Math.sin(u * 3 + v * 2) * 0.18
        + Math.sin(u * 2 - v * 4) * 0.12
        + ((houle[i] ?? 0.5) - 0.5) * 0.5;
    }
  }
  return texture(normalesDepuis(doc, hauteur, taille, 1.5), false);
}

/**
 * Le revêtement des routes : un bitume clair et poussiéreux. Pas de marquage —
 * une bande blanche répétée par case donnerait une échelle de traverses vue de
 * dessus, ce qui se lit comme une voie ferrée et non comme une route.
 */
export function textureRoute(doc: Document, taille = 128): THREE.CanvasTexture {
  const { c, g } = toile(doc, taille);
  const grain = bruitFractal(taille, 4, 5, 1301);
  const gravier = bruitFractal(taille, 2, taille / 5, 1607);
  const image = g.createImageData(taille, taille);
  for (let i = 0; i < taille * taille; i += 1) {
    const n = grain[i] ?? 0.5;
    const x = i % taille;
    const bord = Math.min(x, taille - 1 - x) / taille;
    let couleur = mel([72, 81, 89], [99, 108, 113], n);
    // Accotements continus et deux traces de roues assourdies, sans fausse voie ferrée.
    const accotement = 1 - Math.min(1, bord / 0.07);
    couleur = mel(couleur, [168, 160, 139], accotement * 0.65);
    const roue = Math.exp(-(((x / taille - 0.28) / 0.065) ** 2)) + Math.exp(-(((x / taille - 0.72) / 0.065) ** 2));
    couleur = mel(couleur, [66, 76, 83], roue * 0.19);
    const t = gravier[i] ?? 0.5;
    if (t > 0.9) couleur = mel(couleur, [138, 141, 146], (t - 0.9) / 0.1);
    const j = i * 4;
    image.data[j] = couleur[0];
    image.data[j + 1] = couleur[1];
    image.data[j + 2] = couleur[2];
    image.data[j + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return texture(c, true);
}
