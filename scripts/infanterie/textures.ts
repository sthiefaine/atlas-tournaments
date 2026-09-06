/**
 * Les quatre cartes de l'infanterie, peintes case par case dans l'atlas
 * (`atlas.ts`) et encodées par l'encodeur PNG du dépôt
 * (`src/render/apercu/png.ts`) :
 *
 * - **albédo**, 1024² : les couleurs de base. Les zones d'équipe — maillot,
 *   casque, sac — sont d'un gris neutre que la palette de la nation remplace
 *   au rendu ; la peau, les visages, les bottes et le lanceur sont peints ;
 * - **normale**, 1024² : plate, avec un tissage discret sur les tissus, un grain
 *   sur le socle et deux rainures sur le lanceur ;
 * - **rugosité**, 512² : la rugosité dans le vert et le métal dans le bleu —
 *   c'est la carte `metallicRoughness` de glTF, une seule pour les deux ;
 * - **masque d'équipe**, 512² : blanc sur les cases d'équipe, noir ailleurs,
 *   **sans une seule valeur intermédiaire**.
 *
 * Trois visages, dessinés en coordonnées angulaires — azimut autour de la
 * tête, élévation — pour tomber exactement où la sphère de la tête les déplie :
 * deux yeux, des sourcils, une bouche, des joues, des cheveux sous le casque.
 * Trois teints, trois regards, trois bouches : une escouade, pas un clone.
 *
 * Tout est déterministe : le bruit est un hachage d'entiers, jamais `Math.random`.
 */

import { creerImage, encoderPng, pixel, type Image, type Rvb } from '../../src/render/apercu/png';
import { azimutDeU, CELLULES, COTE_ATLAS, parametreDans, type Cellule, type NomCellule } from './atlas';

/** Les quatre cartes, encodées en PNG. */
export interface TexturesPeintes {
  albedo: Uint8Array;
  normale: Uint8Array;
  rugosite: Uint8Array;
  masque: Uint8Array;
}

/** Résolutions des cartes, celles de la spécification. */
export const RESOLUTIONS = { albedo: 1024, normale: 1024, rugosite: 512, masque: 512 } as const;

// ---------------------------------------------------------------------------
// Bruit déterministe et petits outils
// ---------------------------------------------------------------------------

/** Un hachage d'entiers vers `[0, 1)` : le seul aléa des textures. */
function hachage(x: number, y: number, graine: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(graine, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Un bruit de valeur lissé, de période `periode` pixels, dans `[0, 1]`. */
function bruit(x: number, y: number, periode: number, graine: number): number {
  const gx = x / periode;
  const gy = y / periode;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const l = (a: number, b: number, t: number): number => a + (b - a) * (t * t * (3 - 2 * t));
  return l(
    l(hachage(ix, iy, graine), hachage(ix + 1, iy, graine), fx),
    l(hachage(ix, iy + 1, graine), hachage(ix + 1, iy + 1, graine), fx),
    fy,
  );
}

/** Un tissage : deux sinus croisés, dans `[-1, 1]`. */
function tissage(x: number, y: number, periode: number): number {
  return Math.sin((2 * Math.PI * x) / periode) * Math.sin((2 * Math.PI * y) / periode);
}

const borne = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const teinte = (c: Rvb, d: number): Rvb => [borne(c[0] + d), borne(c[1] + d), borne(c[2] + d)];
const melanger = (a: Rvb, b: Rvb, t: number): Rvb => [
  borne(a[0] + (b[0] - a[0]) * t), borne(a[1] + (b[1] - a[1]) * t), borne(a[2] + (b[2] - a[2]) * t),
];

/** Peint une case : `fn` reçoit le `(s, t)` du maillage et le pixel. */
function peindre(image: Image, c: Cellule, fn: (s: number, t: number, px: number, py: number) => Rvb): void {
  const e = image.largeur / COTE_ATLAS;
  const x0 = Math.round(c.x * e);
  const y0 = Math.round(c.y * e);
  const largeur = Math.round(c.largeur * e);
  const hauteur = Math.round(c.hauteur * e);
  for (let py = y0; py < y0 + hauteur; py += 1) {
    for (let px = x0; px < x0 + largeur; px += 1) {
      const [s, t] = parametreDans(c, (px + 0.5) / image.largeur, (py + 0.5) / image.hauteur);
      pixel(image, px, py, fn(s, t, px, py));
    }
  }
}

// ---------------------------------------------------------------------------
// Les visages
// ---------------------------------------------------------------------------

/** Ce qui fait un visage : un teint, des cheveux, des iris, l'angle des sourcils, une bouche. */
interface Visage {
  peau: Rvb;
  cheveux: Rvb;
  iris: Rvb;
  joues: Rvb;
  /** Élévation de l'extrémité intérieure du sourcil par rapport à l'extérieure : positif, l'air décidé. */
  sourcil: number;
  bouche: 'sourire' | 'neutre' | 'ouverte';
}

const VISAGES: readonly Visage[] = [
  { peau: [232, 190, 160], cheveux: [96, 64, 40], iris: [64, 98, 142], joues: [236, 148, 140], sourcil: -0.05, bouche: 'sourire' },
  { peau: [204, 152, 118], cheveux: [42, 32, 28], iris: [72, 50, 38], joues: [212, 118, 108], sourcil: 0.02, bouche: 'neutre' },
  { peau: [142, 96, 70], cheveux: [26, 22, 20], iris: [38, 30, 28], joues: [150, 82, 72], sourcil: -0.08, bouche: 'ouverte' },
];

/** La couleur d'un point du visage, en coordonnées angulaires : `phi` l'azimut (0 devant), `theta` l'élévation. */
function couleurVisage(phi: number, theta: number, vis: Visage, px: number, py: number): Rvb {
  let c: Rvb = vis.peau;
  // Les cheveux : les côtés et l'arrière sous le casque, le dessus. La lisière
  // est un peu déchirée par un bruit, une frange nette ferait perruque.
  const lisiere = 0.04 * (bruit(px, py, 5, 11) - 0.5);
  const cotes = Math.abs(phi) > 1.08 + lisiere && theta < 0.42;
  const dessus = theta > 0.6 + lisiere;
  if (cotes || dessus) return vis.cheveux;

  // Les joues.
  for (const cote of [-1, 1]) {
    const d = Math.hypot((phi - cote * 0.42) / 0.14, (theta + 0.12) / 0.1);
    if (d < 1) c = melanger(c, vis.joues, 0.35 * (1 - d));
  }
  // L'ombre du nez.
  const nez = Math.hypot(phi / 0.045, (theta + 0.11) / 0.05);
  if (nez < 1 && theta < -0.1) c = melanger(c, [0, 0, 0], 0.12 * (1 - nez));

  // La bouche.
  const bouche: Rvb = [122, 58, 58];
  if (vis.bouche === 'ouverte') {
    if (Math.hypot(phi / 0.045, (theta + 0.3) / 0.035) < 1) return [88, 36, 40];
  } else {
    const courbe = vis.bouche === 'sourire' ? -0.3 + 0.9 * phi * phi : -0.3;
    if (Math.abs(phi) < 0.14 && Math.abs(theta - courbe) < 0.017) return bouche;
  }

  // Les yeux : blanc cerné, iris, pupille, reflet, paupière.
  for (const cote of [-1, 1]) {
    const ex = cote * 0.3;
    const ey = 0.07;
    const d = Math.hypot((phi - ex) / 0.115, (theta - ey) / 0.08);
    if (d < 1) {
      c = d > 0.82 ? [58, 42, 38] : [246, 244, 238];
      const ix = ex + 0.012;
      const iy = ey - 0.006;
      const di = Math.hypot(phi - ix, theta - iy);
      if (di < 0.058) c = vis.iris;
      if (di < 0.028) c = [22, 18, 20];
      if (Math.hypot(phi - (ix - 0.02 * cote), theta - (iy + 0.024)) < 0.015) c = [250, 250, 250];
    }
    if (Math.abs(phi - ex) < 0.12 && theta > ey + 0.07 && theta < ey + 0.088) c = [54, 38, 32];
    // Le sourcil : un trait de l'intérieur vers l'extérieur, incliné selon l'humeur.
    const interieur = cote * 0.15;
    const exterieur = cote * 0.44;
    const part = (phi - interieur) / (exterieur - interieur);
    if (part >= 0 && part <= 1) {
      const centre = 0.205 + vis.sourcil * (1 - part);
      if (Math.abs(theta - centre) < 0.02) c = vis.cheveux;
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Les cartes
// ---------------------------------------------------------------------------

/** Rugosité et métal de chaque case, dans `[0, 1]`. */
const MATIERES: Readonly<Record<NomCellule, { rugosite: number; metal: number }>> = {
  uniforme: { rugosite: 0.86, metal: 0 },
  casque: { rugosite: 0.42, metal: 0.08 },
  sac: { rugosite: 0.88, metal: 0 },
  pantalon: { rugosite: 0.82, metal: 0 },
  visage_0: { rugosite: 0.62, metal: 0 },
  visage_1: { rugosite: 0.62, metal: 0 },
  visage_2: { rugosite: 0.62, metal: 0 },
  peau_0: { rugosite: 0.62, metal: 0 },
  peau_1: { rugosite: 0.62, metal: 0 },
  peau_2: { rugosite: 0.62, metal: 0 },
  bottes: { rugosite: 0.5, metal: 0 },
  cuir: { rugosite: 0.55, metal: 0 },
  lanceur: { rugosite: 0.38, metal: 0.72 },
  signal: { rugosite: 0.45, metal: 0 },
  rebord: { rugosite: 0.5, metal: 0.2 },
  rouleau: { rugosite: 0.8, metal: 0 },
  socle: { rugosite: 0.92, metal: 0 },
};

/** Le gris neutre des zones d'équipe : ce qu'on voit dans une visionneuse, jamais en jeu. */
const NEUTRE: Rvb = [148, 148, 152];

function peindreAlbedo(): Image {
  const image = creerImage(RESOLUTIONS.albedo, RESOLUTIONS.albedo, [118, 118, 120]);
  peindre(image, CELLULES.uniforme, (_s, _t, x, y) => teinte(NEUTRE, 4 * tissage(x, y, 5)));
  peindre(image, CELLULES.casque, (_s, _t, x, y) => teinte([152, 152, 154], 3 * (bruit(x, y, 9, 2) - 0.5)));
  peindre(image, CELLULES.sac, (_s, _t, x, y) => teinte([146, 146, 150], 5 * tissage(x, y, 4)));
  peindre(image, CELLULES.pantalon, (_s, _t, x, y) => teinte([72, 78, 90], 4 * tissage(x, y, 5)));
  VISAGES.forEach((vis, i) => {
    peindre(image, CELLULES[`peau_${i}` as NomCellule], () => vis.peau);
    peindre(image, CELLULES[`visage_${i}` as NomCellule], (s, t, x, y) => couleurVisage(azimutDeU(s), (0.5 - t) * Math.PI, vis, x, y));
  });
  peindre(image, CELLULES.bottes, (_s, _t, x, y) => teinte([50, 40, 34], 4 * (bruit(x, y, 6, 3) - 0.5)));
  peindre(image, CELLULES.cuir, (_s, _t, x, y) => teinte([78, 58, 42], 6 * (bruit(x, y, 7, 4) - 0.5)));
  peindre(image, CELLULES.lanceur, (s, t) => {
    const rainure = Math.abs(s - 0.3) < 0.012 || Math.abs(s - 0.62) < 0.012 || Math.abs(t - 0.5) < 0.02;
    return rainure ? [40, 42, 48] : [58, 62, 70];
  });
  peindre(image, CELLULES.signal, () => [240, 126, 38]);
  peindre(image, CELLULES.rebord, () => [196, 198, 200]);
  peindre(image, CELLULES.rouleau, (s) => teinte([176, 168, 140], Math.round(s * 16) % 2 === 0 ? 4 : -4));
  peindre(image, CELLULES.socle, (_s, _t, x, y) => {
    const base = teinte([92, 104, 66], 28 * (bruit(x, y, 11, 5) - 0.5));
    return hachage(x, y, 6) < 0.05 ? [60, 70, 44] : base;
  });
  return image;
}

/** Encode une normale tangente `(nx, ny)` en couleur : plat = `(128, 128, 255)`. */
function normale(nx: number, ny: number): Rvb {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return [borne(128 + nx * 127), borne(128 + ny * 127), borne(128 + nz * 127)];
}

/** Un relief de tissage : la pente d'un champ de hauteur en sinus croisés. */
function reliefTissage(x: number, y: number, periode: number, amplitude: number): Rvb {
  const k = (2 * Math.PI) / periode;
  return normale(
    -amplitude * Math.cos(k * x) * Math.sin(k * y),
    -amplitude * Math.sin(k * x) * Math.cos(k * y),
  );
}

function peindreNormale(): Image {
  const image = creerImage(RESOLUTIONS.normale, RESOLUTIONS.normale, [128, 128, 255]);
  peindre(image, CELLULES.uniforme, (_s, _t, x, y) => reliefTissage(x, y, 5, 0.18));
  peindre(image, CELLULES.pantalon, (_s, _t, x, y) => reliefTissage(x, y, 5, 0.16));
  peindre(image, CELLULES.sac, (_s, _t, x, y) => reliefTissage(x, y, 4, 0.22));
  peindre(image, CELLULES.rouleau, (_s, _t, x, y) => reliefTissage(x, y, 6, 0.12));
  peindre(image, CELLULES.socle, (_s, _t, x, y) => {
    const h = (a: number, b: number): number => bruit(a, b, 9, 7);
    return normale((h(x - 1, y) - h(x + 1, y)) * 1.4, (h(x, y - 1) - h(x, y + 1)) * 1.4);
  });
  peindre(image, CELLULES.lanceur, (s, t) => {
    const rainureS = [0.3, 0.62].find((r) => Math.abs(s - r) < 0.02);
    if (rainureS !== undefined) return normale(s < rainureS ? 0.45 : -0.45, 0);
    if (Math.abs(t - 0.5) < 0.03) return normale(0, t < 0.5 ? 0.45 : -0.45);
    return normale(0, 0);
  });
  return image;
}

function peindreRugosite(): Image {
  const image = creerImage(RESOLUTIONS.rugosite, RESOLUTIONS.rugosite, [255, 230, 0]);
  for (const c of Object.values(CELLULES)) {
    const m = MATIERES[c.nom];
    peindre(image, c, () => [255, borne(m.rugosite * 255), borne(m.metal * 255)]);
  }
  return image;
}

/** Le masque : blanc sur les cases d'équipe, noir ailleurs, deux valeurs et rien entre elles. */
function peindreMasque(): Image {
  const image = creerImage(RESOLUTIONS.masque, RESOLUTIONS.masque, [0, 0, 0]);
  for (const c of Object.values(CELLULES)) {
    if (c.equipe) peindre(image, c, () => [255, 255, 255]);
  }
  return image;
}

/** Peint et encode les quatre cartes. */
export function peindreTextures(): TexturesPeintes {
  return {
    albedo: encoderPng(peindreAlbedo()),
    normale: encoderPng(peindreNormale()),
    rugosite: encoderPng(peindreRugosite()),
    masque: encoderPng(peindreMasque()),
  };
}
