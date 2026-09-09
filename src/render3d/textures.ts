/**
 * Les textures **procédurales**, générées au chargement dans des `canvas`.
 *
 * Albédos et normales sont peints au chargement, sans téléchargement : palettes
 * des dix biomes, strates minérales, touffes et rides du sable. Les détails
 * restent continus et déterministes pour une lecture nette en vue rapprochée.
 *
 * **Peints une fois par page** (8 septembre 2026) : une matière ne dépend que de
 * son nom, de sa taille et du biome, or c'était le plus gros bloc du chargement
 * (`10-rendu-3d.md` §9.6). Ce sont les **pixels** qui sont gardés, jamais les
 * textures — chaque plateau garde et libère les siennes. Les boucles ont été
 * réécrites dans la foulée, sans changer un octet : `tests/render3d/textures.test.ts`
 * rejoue la formule d'origine et compare.
 *
 * Toutes les fonctions prennent le `Document` en paramètre : rien ici ne suppose
 * un `window` global, ce qui garde le module montable dans un `iframe` ou un
 * canvas hors écran.
 */

import * as THREE from 'three/webgpu';
import type { MatiereStyle } from '../assets/spec';
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
  // L'interpolation est **séparable** : on la fait en deux passes au lieu d'une.
  // La première étale les `periode` lignes de la grille sur `taille` colonnes ;
  // la seconde ne fait plus qu'un fondu vertical entre deux de ces lignes. Le
  // pixel coûte deux lectures et un mélange au lieu de quatre et trois, et la
  // passe horizontale ne se paie que `periode` fois, pas `taille` fois.
  //
  // Les lignes intermédiaires sont en **double** précision : un `Float32Array`
  // les arrondirait et la texture ne serait plus la même au bit près.
  const lignes = new Float64Array(periode * taille);
  for (let g = 0; g < periode; g += 1) {
    const base = g * periode;
    const sortieLigne = g * taille;
    for (let x = 0; x < taille; x += 1) {
      const fx = x * pas;
      const plancher = Math.floor(fx);
      const x0 = plancher % periode;
      const x1 = (x0 + 1) % periode;
      const a = grille[base + x0] ?? 0;
      lignes[sortieLigne + x] = a + ((grille[base + x1] ?? 0) - a) * adoucir(fx - plancher);
    }
  }
  for (let y = 0; y < taille; y += 1) {
    const fy = y * pas;
    const plancher = Math.floor(fy);
    const l0 = (plancher % periode) * taille;
    const l1 = ((((plancher % periode) + 1) % periode)) * taille;
    const ty = adoucir(fy - plancher);
    const ligne = y * taille;
    for (let x = 0; x < taille; x += 1) {
      const a = lignes[l0 + x] ?? 0;
      const b = lignes[l1 + x] ?? 0;
      sortie[ligne + x] = a + (b - a) * ty;
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

// ---------------------------------------------------------------------------
// Les toiles déjà peintes
// ---------------------------------------------------------------------------
//
// Une matière ne dépend que de son nom, de sa taille et du biome ; un atlas de
// voies que du biome. Rien de tout cela ne change d'un montage à l'autre, et
// c'est le plus gros bloc du chargement (`10-rendu-3d.md` §9.6). On garde donc
// les **pixels**, jamais les textures : une `CanvasTexture` neuve par montage
// coûte zéro pixel, et chaque plateau reste libre de libérer les siennes sans
// que le montage suivant hérite d'une texture morte.
//
// Le cache est **par document** — un canvas appartient au sien — et **borné** :
// une page qui promène le joueur de biome en biome ne garde pas tout.

/**
 * Combien de toiles au plus, tous biomes confondus.
 *
 * Un biome complet en occupe douze — quatre matières en albédo et normales à
 * 256², la neige à 128², les normales de l'eau, l'atlas des voies —, soit
 * environ **2,8 Mo** de mémoire vive. Vingt-quatre en tiennent donc exactement
 * deux, ce qui est le cas courant : l'accueil montre un biome, la mission un
 * autre. Un troisième fait sortir le plus ancien, qui se repeindra si on y
 * revient.
 */
const MAX_TOILES = 24;

/** Un cache borné, le plus anciennement lu sortant en premier. */
class Memoire<V> {
  private readonly table = new Map<string, V>();

  constructor(private readonly max: number) {}

  lire(cle: string, creer: () => V): V {
    const memo = this.table.get(cle);
    if (memo !== undefined) {
      // Relire remet en queue : c'est ce qui fait sortir le plus vieux.
      this.table.delete(cle);
      this.table.set(cle, memo);
      return memo;
    }
    const valeur = creer();
    this.table.set(cle, valeur);
    if (this.table.size > this.max) {
      const vieille = this.table.keys().next().value;
      if (vieille !== undefined) this.table.delete(vieille);
    }
    return valeur;
  }

  get taille(): number {
    return this.table.size;
  }

  vider(): void {
    this.table.clear();
  }
}

const toilesParDocument = new WeakMap<Document, Memoire<HTMLCanvasElement>>();

/**
 * La toile de `cle`, peinte une seule fois par document. Le résultat est
 * **partagé** : on le lit, on ne le repeint pas — la texture qui s'en sert,
 * elle, appartient à son appelant.
 */
export function toileMemorisee(
  doc: Document, cle: string, peindre: () => HTMLCanvasElement,
): HTMLCanvasElement {
  let memoire = toilesParDocument.get(doc);
  if (!memoire) {
    memoire = new Memoire<HTMLCanvasElement>(MAX_TOILES);
    toilesParDocument.set(doc, memoire);
  }
  return memoire.lire(cle, peindre);
}

/** Combien de toiles ce document garde en mémoire. Pour les tests et la mesure. */
export function toilesEnMemoire(doc: Document): number {
  return toilesParDocument.get(doc)?.taille ?? 0;
}

/** Oublie les toiles d'un document : à son démontage, ou pour mesurer à froid. */
export function oublierToiles(doc: Document): void {
  toilesParDocument.get(doc)?.vider();
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
  // Le mélange est écrit à plat : `mel` allouait deux tableaux de trois nombres
  // **par pixel**, soit cent trente mille objets par matière, ramassés aussitôt.
  const [sr, sv, sb] = r.sombre;
  const [cr, cv, cb] = r.clair;
  const [tr, tv, tb] = r.couleurTache;
  const seuil = 1 - r.taches;
  const donnees = image.data;
  // Deux boucles au lieu d'un modulo et d'une division entière par pixel.
  for (let i = 0, py = 0; py < taille; py += 1) {
    const v = py / taille;
    for (let px = 0; px < taille; px += 1, i += 1) {
      const n = reliefPeint(matiere, px / taille, v, base[i] ?? 0.5, detail[i] ?? 0.5);
      const k = n < 0 ? 0 : n > 1 ? 1 : n;
      let rouge = sr + (cr - sr) * k;
      let vert = sv + (cv - sv) * k;
      let bleu = sb + (cb - sb) * k;
      const t = tache[i] ?? 0.5;
      if (t > seuil) {
        const q = Math.max(0, Math.min(1, (t - seuil) / r.taches));
        rouge += (tr - rouge) * q;
        vert += (tv - vert) * q;
        bleu += (tb - bleu) * q;
      }
      const j = i * 4;
      donnees[j] = rouge;
      donnees[j + 1] = vert;
      donnees[j + 2] = bleu;
      donnees[j + 3] = 255;
      hauteur[i] = n;
    }
  }
  g.putImageData(image, 0, 0);
  return { canvas: c, hauteur };
}

/**
 * Les octets d'une carte de normales approximative, dérivée du champ de hauteur
 * par différences centrées (un Sobel allégé). Ce n'est pas une normale mesurée,
 * mais elle suffit à accrocher la lumière rasante — c'est exactement ce qu'on
 * lui demande ici. Le champ boucle : les bords se lisent modulo la taille.
 */
export function normalesDonnees(hauteur: Float32Array, taille: number, force = 2.4): Uint8ClampedArray {
  const donnees = new Uint8ClampedArray(taille * taille * 4);
  // Le repli du bord ne dépend que de la colonne ou de la ligne : deux tables
  // remplacent quatre modulos et un appel de fermeture par voisin, soit seize
  // par pixel. `Math.hypot` cède à une racine — trois octets quantifiés sur huit
  // bits ne voient pas la différence, et `tests/render3d/textures.test.ts` le
  // vérifie octet par octet contre la formule d'origine.
  const gauche = new Int32Array(taille);
  const droite = new Int32Array(taille);
  for (let x = 0; x < taille; x += 1) {
    gauche[x] = (x + taille - 1) % taille;
    droite[x] = (x + 1) % taille;
  }
  for (let y = 0; y < taille; y += 1) {
    const ligne = y * taille;
    const haut = ((y + taille - 1) % taille) * taille;
    const bas = ((y + 1) % taille) * taille;
    for (let x = 0; x < taille; x += 1) {
      const dx = ((hauteur[ligne + (droite[x] ?? 0)] ?? 0) - (hauteur[ligne + (gauche[x] ?? 0)] ?? 0)) * force;
      const dy = ((hauteur[bas + x] ?? 0) - (hauteur[haut + x] ?? 0)) * force;
      const l = Math.sqrt(dx * dx + dy * dy + 1);
      const j = (ligne + x) * 4;
      donnees[j] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      donnees[j + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      donnees[j + 2] = Math.round((1 / l) * 0.5 * 255 + 127);
      donnees[j + 3] = 255;
    }
  }
  return donnees;
}

/** La carte de normales d'un champ de hauteur, peinte dans un canvas. */
export function normalesDepuis(
  doc: Document, hauteur: Float32Array, taille: number, force = 2.4,
): HTMLCanvasElement {
  const { c, g } = toile(doc, taille);
  const image = g.createImageData(taille, taille);
  image.data.set(normalesDonnees(hauteur, taille, force));
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
  rugosite?: THREE.Texture;
  albedo: THREE.CanvasTexture;
  normales: THREE.CanvasTexture;
}

/**
 * Fabrique le jeu de textures d'une matière. Les **pixels** sont mémorisés par
 * document — une matière ne dépend que de son nom, de sa taille et du biome —,
 * les textures non : chaque plateau garde les siennes et les libère.
 */
export function jeuMatiere(doc: Document, matiere: Matiere, taille = 256, biome: Biome = 'plaine'): JeuMatiere {
  const { albedo, normales } = toilesMatiere(doc, matiere, taille, biome);
  return { albedo: texture(albedo, true), normales: texture(normales, false) };
}

/**
 * Peint les toiles d'une matière **sans en faire de texture** : de quoi mettre
 * le cache en place depuis sa propre tranche de construction, avant que
 * `creerPlateau` ne les demande (`terrain.ts`, `tranchesToilesPlateau`).
 */
export function preparerMatiere(doc: Document, matiere: Matiere, taille = 256, biome: Biome = 'plaine'): void {
  toilesMatiere(doc, matiere, taille, biome);
}

/** Les deux toiles d'une matière, peintes une fois par document. */
function toilesMatiere(
  doc: Document, matiere: Matiere, taille: number, biome: Biome,
): { albedo: HTMLCanvasElement; normales: HTMLCanvasElement } {
  const prefixe = `mat:${matiere}:${taille}:${biome}`;
  // Le champ de hauteur ne sert qu'aux normales : peint avec l'albédo, il est
  // gardé le temps des deux toiles, et jamais recalculé si les deux sont là.
  const relais: { champ?: Float32Array } = {};
  const albedo = toileMemorisee(doc, `${prefixe}:albedo`, () => {
    const peint = albedoMatiere(doc, matiere, taille, biome);
    relais.champ = peint.hauteur;
    return peint.canvas;
  });
  const normales = toileMemorisee(doc, `${prefixe}:normales`, () => {
    const h = relais.champ ?? albedoMatiere(doc, matiere, taille, biome).hauteur;
    return normalesDepuis(doc, h, taille, matiere === 'roche' ? 2.6 : 1.25);
  });
  return { albedo, normales };
}

/**
 * Les normales de l'eau : deux trains de vagues croisés. On n'en fait pas
 * d'albédo — la couleur de l'eau vient de l'ambiance, ses reflets de la lumière.
 */
export function normalesEau(doc: Document, taille = 256): THREE.CanvasTexture {
  return texture(toileEau(doc, taille), false);
}

/** Peint les normales de l'eau sans en faire de texture. Voir `preparerMatiere`. */
export function preparerEau(doc: Document, taille = 256): void {
  toileEau(doc, taille);
}

function toileEau(doc: Document, taille: number): HTMLCanvasElement {
  return toileMemorisee(doc, `eau:${taille}`, () => {
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
    return normalesDepuis(doc, hauteur, taille, 1.5);
  });
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

// ---------------------------------------------------------------------------
// Les couvertures : tuile, ardoise, tôle ondulée
// ---------------------------------------------------------------------------
//
// Les toits des bâtiments composés par le code étaient des boîtes de couleur
// unie, alors que le sol a un micro-relief depuis le premier jour. Un toit ne
// montre pas chaque tuile — à 48 px par case, un rang fait deux pixels —, il
// montre qu'il est **couvert** : la lumière rasante y accroche des rangs, et la
// couleur du style régional y varie d'une pièce à l'autre. Trois motifs
// suffisent : ce qui se cuit, ce qui se fend, ce qui se plie.
//
// Le repère de la texture : `u` (les colonnes) descend la pente, du faîte vers
// l'égout ; `v` (les lignes) court le long du faîte. Le décor projette ses pans
// dans ce repère (`decor.ts`, `cartographierToit`).

/** Les couvertures que le code sait synthétiser : trois motifs, pas un par région. */
export type SorteToit = 'tuile' | 'ardoise' | 'tole';

/**
 * La sorte de couverture d'une matière de style (`StyleRegion.toits.matiere`).
 * Les dix-huit régions n'en déclarent que trois — tuile, ardoise, tôle ondulée —,
 * mais la liste fermée des matières en admet trente : ce qui se cuit va à la
 * tuile, ce qui se plie à la tôle, et tout ce qui se pose en plaques — ardoise,
 * pierre, bois, béton — à l'ardoise. Sans style, l'ardoise : c'est le motif le
 * plus discret, et le gris neutre du toit par défaut est un gris d'ardoise.
 */
export function sorteToit(matiere: MatiereStyle | null | undefined): SorteToit {
  switch (matiere) {
    case 'tuile': case 'terre_cuite': case 'ceramique': case 'email':
      return 'tuile';
    case 'tole_ondulee': case 'acier_brosse': case 'acier_peint': case 'aluminium':
    case 'laiton': case 'cuivre': case 'fonte':
      return 'tole';
    default:
      return 'ardoise';
  }
}

/** Un aléa déterministe par case entière : deux tuiles voisines diffèrent, deux montages non. */
function hache(i: number, j: number, graine: number): number {
  let e = (Math.imul(i, 0x9e3779b1) ^ Math.imul(j, 0x85ebca77) ^ Math.imul(graine, 0xc2b2ae3d)) >>> 0;
  e = (e + 0x6d2b79f5) >>> 0;
  let t = Math.imul(e ^ (e >>> 15), 1 | e);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/** La graine de chaque couverture : trois motifs, trois tirages. */
const GRAINES_TOIT: Readonly<Record<SorteToit, number>> = { tuile: 2203, ardoise: 2251, tole: 2287 };

/**
 * La force des normales par couverture : une tuile est épaisse et bombée, une
 * ardoise mince, une tôle entre les deux.
 */
const FORCE_TOIT: Readonly<Record<SorteToit, number>> = { tuile: 2.2, ardoise: 1.6, tole: 1.8 };

/** Un texel de couverture : son relief, et son albédo en facteur de la couleur du style. */
interface TexelToit {
  hauteur: number;
  /** Clarté, dans [0, 1] : 1 laisse la couleur du style intacte. */
  clarte: number;
  /** Écart de teinte, dans [−1, 1] : un rien de chaud ou de froid par pièce. */
  teinte: number;
}

/**
 * Un rang de pièces qui se **recouvrent** — tuiles ou ardoises. Chaque pièce
 * repose sur celle du dessous, donc se soulève vers l'égout par rapport au plan
 * du toit et retombe d'un coup à son bord libre ; les rangs sont décalés d'une
 * demi-pièce. `bombe` donne la courbure en travers d'une tuile canal.
 */
function pieceRecouvrante(
  x: number, y: number, taille: number, rangs: number, colonnes: number,
  epaisseur: number, bombe: number, joint: number, graine: number,
): TexelToit {
  const pasRang = taille / rangs;
  const rang = Math.floor(x / pasRang);
  const fx = (x - rang * pasRang) / pasRang;
  const pasCol = taille / colonnes;
  const glisse = y / pasCol - (rang % 2 === 1 ? 0.5 : 0);
  const col = Math.floor(glisse);
  const fy = glisse - col;
  // La colonne se lit modulo le nombre de pièces : la pièce à cheval sur le
  // bord de la texture est la même des deux côtés, sinon la couture se voit.
  const colonne = ((col % colonnes) + colonnes) % colonnes;
  const j = hache(rang, colonne, graine);
  const bord = Math.min(fy, 1 - fy);
  let hauteur = 0.28 + epaisseur * fx + bombe * Math.sin(Math.PI * fy) + (j - 0.5) * 0.12;
  let clarte = 0.9 + (j - 0.5) * 0.14;
  // Le joint entre deux pièces d'un rang : un creux étroit, un peu plus sombre.
  if (bord < joint) {
    const creux = 1 - bord / joint;
    hauteur -= creux * 0.2;
    clarte -= creux * 0.14;
  }
  // L'ombre du rang du dessus, à la naissance de la pièce.
  if (fx < 0.08) clarte -= (1 - fx / 0.08) * 0.12;
  return { hauteur, clarte, teinte: hache(rang, colonne + 1000, graine) * 2 - 1 };
}

/**
 * De la tôle ondulée : des ondes qui **descendent** la pente — l'eau s'y
 * écoule —, en feuilles qui se recouvrent le long de la pente comme des tuiles
 * géantes. Pas de rouille : le matériel des Jeux est entretenu.
 */
function toleOndulee(x: number, y: number, taille: number): TexelToit {
  const ONDES = 8;
  const FEUILLES = 2;
  const onde = Math.sin((y / taille) * Math.PI * 2 * ONDES) * 0.5 + 0.5;
  const fx = ((x * FEUILLES) / taille) % 1;
  let hauteur = 0.12 + onde * 0.7 + fx * 0.1;
  let clarte = 0.9 + onde * 0.08;
  // Le recouvrement de deux feuilles : une marche et un liseré d'ombre.
  if (fx < 0.05) {
    hauteur -= 0.1;
    clarte -= 0.1;
  }
  return { hauteur, clarte, teinte: 0 };
}

/**
 * Le relief d'une couverture : un champ de hauteur dans [0, 1] et un albédo
 * **discret** — un gris entre 0,7 et 1 en facteur de la couleur du style, avec
 * un rien de teinte par pièce. La couleur elle-même reste au matériau, qui la
 * tient du style régional et la blanchit sous la neige.
 */
export function reliefToit(sorte: SorteToit, taille = 128): { hauteur: Float32Array; albedo: Uint8ClampedArray } {
  const hauteur = new Float32Array(taille * taille);
  const albedo = new Uint8ClampedArray(taille * taille * 4);
  const graine = GRAINES_TOIT[sorte];
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const t = sorte === 'tuile'
        ? pieceRecouvrante(x, y, taille, 6, 6, 0.42, 0.22, 0.06, graine)
        : sorte === 'ardoise'
          ? pieceRecouvrante(x, y, taille, 8, 5, 0.18, 0, 0.05, graine)
          : toleOndulee(x, y, taille);
      const i = y * taille + x;
      hauteur[i] = Math.max(0, Math.min(1, t.hauteur));
      const clarte = Math.max(0.7, Math.min(1, t.clarte)) * 255;
      const j = i * 4;
      albedo[j] = Math.round(clarte * (1 + t.teinte * 0.025));
      albedo[j + 1] = Math.round(clarte);
      albedo[j + 2] = Math.round(clarte * (1 - t.teinte * 0.025));
      albedo[j + 3] = 255;
    }
  }
  return { hauteur, albedo };
}

/** Le jeu de textures d'une couverture : albédo et normales, et de quoi les libérer. */
export interface JeuToit {
  readonly sorte: SorteToit;
  readonly albedo: THREE.DataTexture;
  readonly normales: THREE.DataTexture;
  dispose(): void;
}

/**
 * Une texture répétable depuis des octets. Une `DataTexture` plutôt qu'un
 * canvas : le décor n'a pas de `Document`, et un tableau d'octets n'en a pas
 * besoin. Elle a ses mipmaps — sans eux, un motif répété quatre fois par case
 * scintille dès qu'on s'éloigne — et, contrairement à un canvas, elle n'est
 * pas retournée à l'envoi : sa première ligne est bien `v = 0`.
 */
function textureDonnees(donnees: Uint8ClampedArray, taille: number, srgb: boolean): THREE.DataTexture {
  // Une copie plutôt qu'une vue sur le même tampon : three veut un `ArrayBuffer`
  // franc, et soixante-quatre kilo-octets copiés une fois au montage ne comptent pas.
  const octets = new Uint8Array(donnees.length);
  octets.set(donnees);
  const t = new THREE.DataTexture(octets, taille, taille, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Les octets d'une couverture : trois sortes, une ou deux tailles, rien qui
 * dépende de la carte. Ils sont gardés pour la vie de la page — trois sortes en
 * 128² font 384 ko —, et `textureDonnees` en recopie une vue à chaque montage :
 * personne ne partage un tampon avec personne.
 */
const octetsToit = new Map<string, { albedo: Uint8ClampedArray; normales: Uint8ClampedArray }>();

/** Fabrique le jeu de textures d'une couverture. Un seul par sorte suffit à toute une carte. */
export function jeuToit(sorte: SorteToit, taille = 128): JeuToit {
  const cle = `${sorte}:${taille}`;
  let octets = octetsToit.get(cle);
  if (!octets) {
    const { hauteur, albedo } = reliefToit(sorte, taille);
    octets = { albedo, normales: normalesDonnees(hauteur, taille, FORCE_TOIT[sorte]) };
    octetsToit.set(cle, octets);
  }
  const albedoTexture = textureDonnees(octets.albedo, taille, true);
  const normales = textureDonnees(octets.normales, taille, false);
  return {
    sorte,
    albedo: albedoTexture,
    normales,
    dispose(): void {
      albedoTexture.dispose();
      normales.dispose();
    },
  };
}
