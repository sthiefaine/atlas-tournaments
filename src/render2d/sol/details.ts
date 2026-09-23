/**
 * Les **textures de détail** du sol, synthétisées au chargement : une couche
 * par matière — herbe, terre, roche, sable, galets, pavé, sous-bois, herbe
 * haute —, plus la neige, l'eau et une couche de bruit que le nuanceur lit pour
 * déformer ses lisières.
 *
 * Aucune image n'est téléchargée (`CLAUDE.md` : aucun fichier image dans ce
 * projet que la cuisson n'ait produit), et rien n'est dessiné sur un canvas :
 * tout est calculé dans des tableaux d'octets, donc vérifiable sous Node.
 *
 * Trois règles :
 *
 * - **Bouclable.** Chaque couche se répète des dizaines de fois sur la carte ;
 *   tous les bruits sont périodiques sur la taille de la tuile, et les motifs
 *   (rides, strates, dalles) ont des fréquences entières. Une couture se
 *   verrait aussitôt.
 * - **Déterministe.** Mêmes biome, saison et taille : mêmes octets, au bit près.
 * - **Rapide.** Les bruits coûteux sont calculés une fois et partagés entre les
 *   couches, décalés pour ne pas se ressembler ; le tout tient sous 100 ms
 *   pour onze couches de 256² (mesure dans `doc/refonte/sprites-terrain.md`).
 *
 * Ce qu'un texel porte : **R** la clarté du grain, lumière de cuisson comprise
 * (les bosses sont éclairées du même côté que les images cuites) ; **G** le
 * relief, qui sert au mélange des matières et au dépôt de neige ; **B** un
 * accent — fleurs, feuilles, cailloux, joints moussus — que le nuanceur teinte
 * d'une couleur propre à la matière et à la saison ; **A** réservé (255).
 * La couleur n'est jamais dans la texture : elle vient des uniformes, et une
 * averse ne repeint donc aucun pixel.
 */

import type { Biome, Saison } from '../../schemas/types';
import { lumiereSol } from './lumiere';

/** Les couches, dans l'ordre du tableau de textures. Les huit premières suivent `MATIERES`. */
export const COUCHES_DETAIL = [
  'herbe', 'terre', 'roche', 'sable', 'galets', 'pave', 'sousbois', 'herbehaute',
  'neige', 'eau', 'bruit',
] as const;
export type CoucheDetail = typeof COUCHES_DETAIL[number];

/** Le rang d'une couche dans le tableau. */
export function rangCouche(c: CoucheDetail): number {
  return COUCHES_DETAIL.indexOf(c);
}

/** Côté d'une couche, en texels. 256 : un texel par pixel de plan à l'échelle du jeu. */
export const TAILLE_DETAIL = 256;

/**
 * Combien de fois chaque couche se répète **par case** de sol. Le pavé fait
 * quatre dalles par case, une tuile par case ; la roche, plus large, se
 * répète moins ; la couche de bruit couvre huit cases.
 */
export const REPETITIONS: Readonly<Record<CoucheDetail, number>> = {
  herbe: 0.5,
  terre: 0.55,
  roche: 0.4,
  sable: 0.45,
  galets: 0.8,
  pave: 1,
  sousbois: 0.5,
  herbehaute: 0.6,
  neige: 0.45,
  eau: 0.35,
  bruit: 0.125,
};

// ---------------------------------------------------------------------------
// Les bruits
// ---------------------------------------------------------------------------

/** Un générateur pseudo-aléatoire déterministe (celui de la 3D). */
function generateur(graine: number): () => number {
  let e = graine >>> 0;
  return (): number => {
    e = (e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Un aléa par couple d'entiers, pour les dalles et les étincelles. */
function hache(i: number, j: number, graine: number): number {
  let e = (Math.imul(i, 0x9e3779b1) ^ Math.imul(j, 0x85ebca77) ^ Math.imul(graine, 0xc2b2ae3d)) >>> 0;
  e = (e + 0x6d2b79f5) >>> 0;
  let t = Math.imul(e ^ (e >>> 15), 1 | e);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

function adoucir(t: number): number {
  return t * t * (3 - 2 * t);
}

function lisser(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Un bruit de valeur **bouclant** sur la tuile : une grille aléatoire de
 * `periodeX × periodeY` points, interpolée en douceur. Deux périodes
 * différentes donnent un bruit étiré — les brins de l'herbe haute. Séparable,
 * comme en 3D : la passe horizontale ne se paie que par rangée de la grille.
 */
export function bruitValeur(taille: number, periodeX: number, periodeY: number, graine: number): Float32Array {
  const alea = generateur(graine);
  const grille = new Float32Array(periodeX * periodeY);
  for (let i = 0; i < grille.length; i += 1) grille[i] = alea();
  const lignes = new Float32Array(periodeY * taille);
  const pasX = periodeX / taille;
  for (let g = 0; g < periodeY; g += 1) {
    for (let x = 0; x < taille; x += 1) {
      const fx = x * pasX;
      const p = Math.floor(fx);
      const x0 = p % periodeX;
      const x1 = (x0 + 1) % periodeX;
      const a = grille[g * periodeX + x0]!;
      lignes[g * taille + x] = a + (grille[g * periodeX + x1]! - a) * adoucir(fx - p);
    }
  }
  const sortie = new Float32Array(taille * taille);
  const pasY = periodeY / taille;
  for (let y = 0; y < taille; y += 1) {
    const fy = y * pasY;
    const p = Math.floor(fy);
    const l0 = (p % periodeY) * taille;
    const l1 = ((p + 1) % periodeY) * taille;
    const ty = adoucir(fy - p);
    for (let x = 0; x < taille; x += 1) {
      const a = lignes[l0 + x]!;
      sortie[y * taille + x] = a + (lignes[l1 + x]! - a) * ty;
    }
  }
  return sortie;
}

/** Une somme d'octaves bouclante, normalisée dans [0, 1]. */
export function bruitFractal(taille: number, octaves: number, periode: number, graine: number): Float32Array {
  const sortie = new Float32Array(taille * taille);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const p = Math.min(taille, periode * 2 ** o);
    const couche = bruitValeur(taille, p, p, graine + o * 7919);
    for (let i = 0; i < sortie.length; i += 1) sortie[i] = sortie[i]! + couche[i]! * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < sortie.length; i += 1) sortie[i] = sortie[i]! / total;
  return sortie;
}

/** Un pavage de Voronoï bouclant : distance au plus proche germe, au second, et l'aléa du plus proche. */
interface Voronoi {
  f1: Float32Array;
  f2: Float32Array;
  id: Float32Array;
}

/**
 * Le pavage de Voronoï d'une tuile de `cellules × cellules` germes. Les
 * distances sont en **cellules** ; les germes se lisent modulo la tuile, donc
 * le pavage boucle. C'est lui qui fait les galets, les cailloux, les feuilles
 * tombées et les fleurs.
 */
export function voronoi(taille: number, cellules: number, graine: number): Voronoi {
  const gx = new Float32Array(cellules * cellules);
  const gy = new Float32Array(cellules * cellules);
  const ga = new Float32Array(cellules * cellules);
  const alea = generateur(graine);
  for (let i = 0; i < gx.length; i += 1) {
    gx[i] = 0.15 + alea() * 0.7;
    gy[i] = 0.15 + alea() * 0.7;
    ga[i] = alea();
  }
  const f1 = new Float32Array(taille * taille);
  const f2 = new Float32Array(taille * taille);
  const id = new Float32Array(taille * taille);
  const pas = cellules / taille;
  // Les indices de cellule repliés, calculés une fois : la boucle intérieure
  // tourne neuf fois par texel, un modulo y coûterait plus que la distance.
  const replie = new Int32Array(cellules + 2);
  for (let n = -1; n <= cellules; n += 1) replie[n + 1] = ((n % cellules) + cellules) % cellules;
  const colonne = new Int32Array(taille);
  const abscisse = new Float32Array(taille);
  for (let x = 0; x < taille; x += 1) {
    abscisse[x] = (x + 0.5) * pas;
    colonne[x] = Math.floor((x + 0.5) * pas);
  }
  for (let y = 0; y < taille; y += 1) {
    const v = (y + 0.5) * pas;
    const cy = Math.floor(v);
    for (let x = 0; x < taille; x += 1) {
      const u = abscisse[x]!;
      const cx = colonne[x]!;
      let d1 = 9;
      let d2 = 9;
      let a1 = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = cy + dy;
        const ligne = replie[ny + 1]! * cellules;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          const k = ligne + replie[nx + 1]!;
          const ex = nx + gx[k]! - u;
          const ey = ny + gy[k]! - v;
          const d = ex * ex + ey * ey;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            a1 = ga[k]!;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const i = y * taille + x;
      f1[i] = Math.sqrt(d1);
      f2[i] = Math.sqrt(d2);
      id[i] = a1;
    }
  }
  return { f1, f2, id };
}

// ---------------------------------------------------------------------------
// Les couches
// ---------------------------------------------------------------------------

/** Les bruits partagés d'une synthèse, et de quoi les lire décalés. */
interface Bruits {
  taille: number;
  b4: Float32Array;
  b8: Float32Array;
  b16: Float32Array;
  b32: Float32Array;
  b64: Float32Array;
  b128: Float32Array;
  brins: Float32Array;
  vA: Voronoi;
  vB: Voronoi;
}

/** Les réglages de motif d'un biome : ce que la palette seule ne dit pas. */
interface MotifsBiome {
  /** Part des cellules de Voronoï qui fleurissent au printemps. */
  fleurs: number;
  /** Force des rides du sable. */
  rides: number;
  /** Taches de lichen sur la roche. */
  lichen: number;
}

const MOTIFS: Readonly<Record<Biome, MotifsBiome>> = {
  plaine: { fleurs: 0.25, rides: 0.16, lichen: 0.3 },
  foret: { fleurs: 0.18, rides: 0.16, lichen: 0.45 },
  montagne: { fleurs: 0.2, rides: 0.16, lichen: 0.5 },
  desert: { fleurs: 0.04, rides: 0.38, lichen: 0.05 },
  jungle: { fleurs: 0.42, rides: 0.14, lichen: 0.6 },
  neige: { fleurs: 0.04, rides: 0.2, lichen: 0.2 },
  volcanique: { fleurs: 0.08, rides: 0.12, lichen: 0.1 },
  cotier: { fleurs: 0.2, rides: 0.22, lichen: 0.35 },
  archipel: { fleurs: 0.3, rides: 0.24, lichen: 0.3 },
  marais: { fleurs: 0.14, rides: 0.12, lichen: 0.55 },
};

/** Force du relief de chaque couche, pour la lumière cuite : la roche accroche, la neige glisse. */
const FORCE_RELIEF: Readonly<Record<CoucheDetail, number>> = {
  herbe: 1.4, terre: 1.6, roche: 2.6, sable: 1.2, galets: 2.2, pave: 1.0,
  sousbois: 1.4, herbehaute: 1.2, neige: 0.9, eau: 0, bruit: 0,
};

/** Les tableaux de travail d'une couche, alloués une fois par synthèse. */
interface Travail {
  relief: Float32Array;
  clarte: Float32Array;
  accent: Float32Array;
}

/**
 * Un peintre remplit clarté (avant lumière), relief et accent d'une couche.
 *
 * Chaque peintre a **sa propre boucle** : un seul site d'appel par texel pour
 * neuf fonctions différentes est mégamorphe, rien ne s'y inline, et c'est ce
 * qui coûtait l'essentiel de la synthèse. Les bruits se lisent décalés — un
 * bruit bouclant décalé reste bouclant — par des lignes précalculées et un
 * masque, la taille étant une puissance de deux.
 */
type Peintre = (b: Bruits, m: MotifsBiome, saison: Saison, w: Travail) => void;

/** Le décalage d'une ligne, replié : `((y + oy) & masque) * taille`. */
function ligne(y: number, oy: number, masque: number, taille: number): number {
  return ((y + oy) & masque) * taille;
}

const PEINTRES: Readonly<Record<Exclude<CoucheDetail, 'eau' | 'bruit'>, Peintre>> = {
  herbe(b, m, saison, w) {
    const t = b.taille;
    const k = t - 1;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l64 = ligne(y, 91, k, t);
      const l128 = ligne(y, 5, k, t);
      const l16 = ligne(y, 13, k, t);
      const l64b = ligne(y, 200, k, t);
      for (let x = 0; x < t; x += 1, i += 1) {
        const base = b.b8[i]!;
        const detail = b.b64[l64 + ((x + 37) & k)]!;
        const fin = b.b128[l128 + ((x + 11) & k)]!;
        w.relief[i] = 0.5 * base + 0.35 * detail + 0.15 * fin;
        w.clarte[i] = 0.3 + 0.55 * base + 0.25 * (detail - 0.5) + 0.15 * (fin - 0.5);
        const fA = b.vA.f1[i]!;
        const idA = b.vA.id[i]!;
        let accent: number;
        if (saison === 'printemps') {
          accent = idA < m.fleurs ? 1 - lisser(0.05, 0.11, fA) : 0;
        } else if (saison === 'ete') {
          accent = lisser(0.6, 0.8, b.b16[l16 + ((x + 71) & k)]!) * 0.8;
        } else if (saison === 'automne') {
          accent = Math.max(idA < 0.45 ? 1 - lisser(0.07, 0.15, fA) : 0, lisser(0.66, 0.82, b.b16[l16 + ((x + 71) & k)]!) * 0.6);
        } else {
          accent = lisser(0.62, 0.82, b.b64[l64b + ((x + 5) & k)]!) * 0.75;
        }
        w.accent[i] = accent;
      }
    }
  },
  terre(b, _m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l8 = ligne(y, 20, k, t);
      const l64 = ligne(y, 77, k, t);
      const lv = ligne(y, 64, k, t);
      for (let x = 0; x < t; x += 1, i += 1) {
        const base = b.b8[l8 + ((x + 50) & k)]!;
        const grain = b.b64[l64 + ((x + 3) & k)]!;
        const j = lv + ((x + 128) & k);
        const pierre = b.vA.id[j]! < 0.35 ? 1 - lisser(0.09, 0.17, b.vA.f1[j]!) : 0;
        w.relief[i] = 0.45 * base + 0.25 * grain + 0.35 * pierre;
        w.clarte[i] = 0.35 + 0.45 * base + 0.2 * (grain - 0.5);
        w.accent[i] = pierre;
      }
    }
  },
  roche(b, m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    const tau = Math.PI * 2;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l4 = ligne(y, 140, k, t);
      const l32 = ligne(y, 60, k, t);
      const l16 = ligne(y, 33, k, t);
      const phase = (y / t) * 5 * tau;
      for (let x = 0; x < t; x += 1, i += 1) {
        const large = b.b4[l4 + ((x + 9) & k)]!;
        const detail = b.b32[l32 + ((x + 60) & k)]!;
        // Les strates de la 3D (`reliefPeint`) : des fréquences entières, donc bouclantes.
        const strate = Math.sin((x / t) * 2 * tau + phase + large * 4);
        const fissure = Math.max(0, 1 - Math.abs(strate) * 9);
        w.relief[i] = 0.14 + large * 0.66 + detail * 0.2 - fissure * 0.14;
        w.clarte[i] = 0.25 + 0.6 * large + 0.2 * (detail - 0.5) - fissure * 0.25;
        w.accent[i] = Math.min(1, fissure * 0.8 + lisser(0.68, 0.84, b.b16[l16 + ((x + 99) & k)]!) * m.lichen);
      }
    }
  },
  sable(b, m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    const tau = Math.PI * 2;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l8 = ligne(y, 100, k, t);
      const l128 = ligne(y, 30, k, t);
      const l64 = ligne(y, 40, k, t);
      const lv = ligne(y, 170, k, t);
      const phase = (y / t) * 7 * tau;
      for (let x = 0; x < t; x += 1, i += 1) {
        const large = b.b8[l8 + ((x + 200) & k)]!;
        const rides = Math.sin((x / t) * 3 * tau + phase + large * 3) * 0.5 + 0.5;
        const fin = b.b128[l128 + ((x + 70) & k)]!;
        w.relief[i] = large * 0.7 + rides * m.rides + b.b64[l64 + ((x + 20) & k)]! * 0.05;
        w.clarte[i] = 0.4 + 0.4 * large + (rides - 0.5) * m.rides * 0.8 + (fin - 0.5) * 0.12;
        const j = lv + ((x + 40) & k);
        w.accent[i] = b.vA.id[j]! > 0.9 ? 1 - lisser(0.03, 0.065, b.vA.f1[j]!) : 0;
      }
    }
  },
  galets(b, _m, _s, w) {
    const n = b.taille * b.taille;
    for (let i = 0; i < n; i += 1) {
      const f1 = b.vB.f1[i]!;
      const pierre = lisser(0.02, 0.11, b.vB.f2[i]! - f1);
      const r = f1 / 0.62;
      const dome = Math.sqrt(Math.max(0, 1 - r * r));
      w.relief[i] = pierre * (0.3 + 0.6 * dome);
      w.clarte[i] = pierre * (0.3 + 0.45 * b.vB.id[i]! + 0.25 * dome) + (1 - pierre) * 0.12;
      w.accent[i] = 1 - pierre;
    }
  },
  pave(b, _m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    for (let y = 0, i = 0; y < t; y += 1) {
      // Quatre dalles par tuile, rangées décalées d'une demi-dalle : le pas
      // divise la tuile, sinon la couture entre deux tuiles se voit. Au centre
      // du texel : un joint qui tombe sur le bord de la tuile se partage entre
      // la première et la dernière colonne, sans couture.
      const v = ((y + 0.5) / t) * 4;
      const rang = Math.floor(v);
      const fv = v - rang;
      const l16 = ligne(y, 150, k, t);
      const l64 = ligne(y, 12, k, t);
      for (let x = 0; x < t; x += 1, i += 1) {
        const decale = ((x + 0.5) / t) * 4 + (rang % 2) * 0.5;
        const plancher = Math.floor(decale);
        const fu = decale - plancher;
        const joint = 1 - lisser(0.025, 0.065, Math.min(fu, 1 - fu, fv, 1 - fv));
        const ton = hache(rang, plancher % 4, 5021);
        const tache = b.b16[l16 + ((x + 45) & k)]!;
        w.relief[i] = (1 - joint) * (0.6 + 0.1 * ton) + b.b64[l64 + ((x + 90) & k)]! * 0.05;
        w.clarte[i] = 0.42 + 0.28 * ton + 0.15 * (tache - 0.5) - joint * 0.3;
        w.accent[i] = joint * (0.4 + 0.6 * tache);
      }
    }
  },
  sousbois(b, _m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l8 = ligne(y, 7, k, t);
      const l16 = ligne(y, 180, k, t);
      const lv = ligne(y, 211, k, t);
      const l64 = ligne(y, 60, k, t);
      for (let x = 0; x < t; x += 1, i += 1) {
        const base = b.b8[l8 + ((x + 130) & k)]!;
        const mousse = lisser(0.55, 0.75, b.b16[l16 + ((x + 12) & k)]!);
        const j = lv + ((x + 17) & k);
        const feuille = b.vA.id[j]! < 0.6 ? 1 - lisser(0.07, 0.14, b.vA.f1[j]!) : 0;
        const grain = b.b64[l64 + ((x + 140) & k)]!;
        w.relief[i] = 0.4 * base + 0.3 * feuille + 0.2 * grain;
        w.clarte[i] = 0.25 + 0.45 * base + 0.2 * mousse + 0.15 * (grain - 0.5);
        w.accent[i] = feuille;
      }
    }
  },
  herbehaute(b, _m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l8 = ligne(y, 66, k, t);
      const l128 = ligne(y, 9, k, t);
      for (let x = 0; x < t; x += 1, i += 1) {
        const brin = b.brins[i]!;
        const base = b.b8[l8 + ((x + 33) & k)]!;
        w.relief[i] = 0.5 * brin + 0.3 * base + 0.2 * b.b128[l128 + ((x + 3) & k)]!;
        w.clarte[i] = 0.25 + 0.6 * brin + 0.15 * (base - 0.5);
        w.accent[i] = lisser(0.66, 0.9, brin) * 0.8;
      }
    }
  },
  neige(b, _m, _s, w) {
    const t = b.taille;
    const k = t - 1;
    const tau = Math.PI * 2;
    for (let y = 0, i = 0; y < t; y += 1) {
      const l8 = ligne(y, 177, k, t);
      const l64 = ligne(y, 7, k, t);
      const l128 = ligne(y, 9, k, t);
      const phase = (y / t) * 3 * tau;
      for (let x = 0; x < t; x += 1, i += 1) {
        const base = b.b8[l8 + ((x + 77) & k)]!;
        const rides = Math.sin((x / t) * 2 * tau + phase + base * 2) * 0.5 + 0.5;
        w.relief[i] = 0.7 * base + 0.2 * rides + 0.1 * b.b64[l64 + ((x + 7) & k)]!;
        w.clarte[i] = 0.55 + 0.35 * base + 0.1 * rides;
        w.accent[i] = b.b128[l128 + ((x + 9) & k)]! > 0.93 ? 1 : 0;
      }
    }
  },
};

/** Borne dans [0, 255] après passage en octet. */
function octet(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
}

/**
 * Écrit une couche à relief, une fois son peintre passé : la lumière de
 * cuisson éclaire le relief — les bosses du côté de la lumière
 * s'éclaircissent, les autres s'assombrissent, une surface plate ne bouge pas.
 */
function ecrireCouche(sortie: Uint8Array, rang: number, taille: number, force: number, travail: Travail): void {
  const n = taille * taille;
  const { relief, clarte, accent } = travail;
  const [lx, ly, lz] = lumiereSol();
  const base = rang * n * 4;
  const k = taille - 1;
  for (let y = 0; y < taille; y += 1) {
    const haut = ((y + k) & k) * taille;
    const bas = ((y + 1) & k) * taille;
    const ligneY = y * taille;
    for (let x = 0; x < taille; x += 1) {
      const i = ligneY + x;
      const dx = (relief[ligneY + ((x + 1) & k)]! - relief[ligneY + ((x + k) & k)]!) * force;
      const dy = (relief[bas + x]! - relief[haut + x]!) * force;
      const eclairage = (lz - dx * lx - dy * ly) / (Math.sqrt(dx * dx + dy * dy + 1) * lz);
      const f = 0.78 + 0.22 * eclairage;
      const facteur = f < 0.4 ? 0.4 : f > 1.3 ? 1.3 : f;
      const j = base + i * 4;
      sortie[j] = octet(clarte[i]! * facteur);
      sortie[j + 1] = octet(relief[i]!);
      sortie[j + 2] = octet(accent[i]!);
      sortie[j + 3] = 255;
    }
  }
}

/** Synthétise toutes les couches, sans mémoire. */
function synthetiser(biome: Biome, saison: Saison, taille: number): Uint8Array {
  if (taille < 16 || (taille & (taille - 1)) !== 0) {
    throw new Error(`couchesDetail : la taille ${taille} n'est pas une puissance de deux`);
  }
  const b: Bruits = {
    taille,
    b4: bruitFractal(taille, 2, 4, 101),
    b8: bruitFractal(taille, 3, 8, 211),
    b16: bruitFractal(taille, 2, 16, 307),
    b32: bruitFractal(taille, 2, 32, 401),
    b64: bruitValeur(taille, 64, 64, 503),
    b128: bruitValeur(taille, 128, 128, 601),
    brins: bruitValeur(taille, 64, 8, 709),
    vA: voronoi(taille, 24, 809),
    vB: voronoi(taille, 9, 907),
  };
  const sortie = new Uint8Array(taille * taille * 4 * COUCHES_DETAIL.length);
  const motifs = MOTIFS[biome];
  const travail: Travail = {
    relief: new Float32Array(taille * taille),
    clarte: new Float32Array(taille * taille),
    accent: new Float32Array(taille * taille),
  };
  for (const couche of ['herbe', 'terre', 'roche', 'sable', 'galets', 'pave', 'sousbois', 'herbehaute', 'neige'] as const) {
    PEINTRES[couche](b, motifs, saison, travail);
    ecrireCouche(sortie, rangCouche(couche), taille, FORCE_RELIEF[couche], travail);
  }

  // L'eau n'a pas de lumière cuite : ses rides bougent, la lumière les suivrait mal.
  const n = taille * taille;
  const k = taille - 1;
  const tau = Math.PI * 2;
  const eau = rangCouche('eau') * n * 4;
  for (let y = 0, i = 0; y < taille; y += 1) {
    const l16 = ligne(y, 29, k, taille);
    const l16a = ligne(y, 0, k, taille);
    const l16b = ligne(y, 64, k, taille);
    const l64 = ligne(y, 31, k, taille);
    const phase = (y / taille) * 3 * tau;
    for (let x = 0; x < taille; x += 1, i += 1) {
      const houle = b.b8[i]!;
      const ride = 0.5 + 0.25 * Math.sin((x / taille) * 4 * tau + phase + houle * 5)
        + 0.25 * (b.b16[l16 + ((x + 17) & k)]! - 0.5);
      const reseau = 1 - Math.min(1, Math.abs(b.b16[l16a + ((x + 64) & k)]! - b.b16[l16b + (x & k)]!) * 4);
      const eclat = Math.max(0, (b.b64[l64 + ((x + 31) & k)]! - 0.72) / 0.28);
      const j = eau + i * 4;
      sortie[j] = octet(ride);
      sortie[j + 1] = octet(reseau);
      sortie[j + 2] = octet(eclat);
      sortie[j + 3] = 255;
    }
  }

  // Le bruit que le nuanceur lit pour ses lisières : quatre fréquences, une par canal.
  const bruit = rangCouche('bruit') * n * 4;
  for (let y = 0, i = 0; y < taille; y += 1) {
    const l8 = ligne(y, 50, k, taille);
    const l16 = ligne(y, 90, k, taille);
    for (let x = 0; x < taille; x += 1, i += 1) {
      const j = bruit + i * 4;
      sortie[j] = octet(b.b4[i]!);
      sortie[j + 1] = octet(b.b8[l8 + ((x + 100) & k)]!);
      sortie[j + 2] = octet(b.b16[l16 + ((x + 30) & k)]!);
      sortie[j + 3] = octet(b.b64[i]!);
    }
  }
  return sortie;
}

/**
 * Combien de jeux de couches on garde. Un jeu fait 2,9 Mo à 256² ; quatre
 * couvrent une partie et un changement de saison dans l'atelier.
 */
const MAX_JEUX = 4;
const memoire = new Map<string, Uint8Array>();

/**
 * Les couches de détail d'un biome à une saison, **mémorisées** : la même clé
 * rend le même tableau, qu'on ne modifie jamais. Le résultat est prêt pour un
 * `texImage3D` : couche après couche, ligne après ligne, RGBA.
 */
export function couchesDetail(biome: Biome, saison: Saison, taille = TAILLE_DETAIL): Uint8Array {
  const cle = `${biome}:${saison}:${taille}`;
  const memo = memoire.get(cle);
  if (memo) {
    memoire.delete(cle);
    memoire.set(cle, memo);
    return memo;
  }
  const octets = synthetiser(biome, saison, taille);
  memoire.set(cle, octets);
  if (memoire.size > MAX_JEUX) {
    const vieux = memoire.keys().next().value;
    if (vieux !== undefined) memoire.delete(vieux);
  }
  return octets;
}

/** Oublie les jeux mémorisés : pour mesurer à froid. */
export function oublierCouches(): void {
  memoire.clear();
}
