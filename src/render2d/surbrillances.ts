/**
 * Ce qui se **peint au sol** sans être une image : le fond coloré, les
 * surbrillances, la flèche de déplacement, le curseur, l'anneau de sélection, le
 * voile d'ambiance. Tout est tracé **au sol**, en cases, puis projeté par
 * `versPlan` : une case allumée a exactement l'emprise de la case que le lancer
 * de `versMonde` renvoie, et la flèche est couchée sur le terrain comme en 3D.
 *
 * Les couleurs sont celles de la 3D (`render3d/surbrillances.ts`), pour ne rien
 * réapprendre en changeant de peau : **vert, j'y vais ; rouge, j'y tire** ; l'or
 * pour un objectif, le bleu pour un chantier.
 *
 * Pur : des triangles dans une `Trace` (`tests/render2d/surbrillances.test.ts`).
 */

import type { PaletteTerrain } from '../render/ambiance';
import type { GenreSurbrillance, Surbrillance } from '../render/surbrillance';
import type { Case, CleTerrain } from '../schemas/types';
import { rvba, rvbaCss, type Rvba, type Trace } from './aplats';
import type { Emprise } from './camera';
import { versPlan } from './contrat';

/** Les couleurs et opacités des cinq genres. */
export const COULEURS_SURBRILLANCE: Readonly<Record<GenreSurbrillance, Rvba>> = {
  deplacement: rvba(0x28ec96, 0.5),
  attaque: rvba(0xff2e48, 0.58),
  capture: rvba(0xffc634, 0.52),
  production: rvba(0x4eaaff, 0.52),
  danger: rvba(0xff3c3c, 0.3),
};

/** Le retrait d'une case allumée depuis son bord, en cases : les cases voisines restent distinctes. */
export const RETRAIT_CASE = 0.045;

/** La flèche : corps, pointe et liseré, en fraction de case (ceux de la 3D). */
export const FLECHE = Object.freeze({
  corps: 0.3,
  tete: 0.34,
  aile: 0.27,
  /** Le liseré sombre déborde le corps de ce facteur. */
  lisere: 1.3,
  couleur: rvba(0xf4fff6, 0.96),
  couleurLisere: rvba(0x0d2419, 0.72),
  /** Le chemin aveugle (brouillard, ordre en deux temps) : des tirets, et leur pas. */
  tiret: 0.22,
  blanc: 0.14,
});

const CURSEUR = rvba(0xffffff, 0.85);
const ANNEAU = 0xffe27a;

/** Un point au sol (en cases) dans le plan. */
function sol(gx: number, gy: number): { X: number; Y: number } {
  return versPlan(gx, gy, 0);
}

/** Un rectangle au sol aligné sur la grille. */
function rectSol(t: Trace, x0: number, y0: number, x1: number, y1: number, c: Rvba): void {
  const a = sol(x0, y0);
  const b = sol(x1, y1);
  t.rectangle(a.X, a.Y, b.X, b.Y, c);
}

/** Les cases allumées, genre par genre, dans l'ordre où le jeu les apprend. */
export function tracerSurbrillances(t: Trace, surbrillances: readonly Surbrillance[]): void {
  const i = RETRAIT_CASE;
  for (const s of surbrillances) {
    rectSol(t, s.case.x + i, s.case.y + i, s.case.x + 1 - i, s.case.y + 1 - i, COULEURS_SURBRILLANCE[s.genre]);
  }
}

/** Un ruban au sol de `a` à `b`, de demi-largeur `demi` (en cases). */
function ruban(t: Trace, ax: number, ay: number, bx: number, by: number, demi: number, c: Rvba): void {
  const lx = bx - ax;
  const ly = by - ay;
  const n = Math.hypot(lx, ly);
  if (n < 1e-6) return;
  const nx = (-ly / n) * demi;
  const ny = (lx / n) * demi;
  const p1 = sol(ax + nx, ay + ny);
  const p2 = sol(bx + nx, by + ny);
  const p3 = sol(bx - nx, by - ny);
  const p4 = sol(ax - nx, ay - ny);
  t.quadrilatere(p1.X, p1.Y, p2.X, p2.Y, p3.X, p3.Y, p4.X, p4.Y, c);
}

/**
 * La **flèche** d'un chemin : un ruban coudé qui suit les cases traversées, une
 * pointe sur l'arrivée, un liseré sombre dessous. Un chemin **aveugle** — il
 * sort de la vue, l'unité avancera d'abord et décidera arrivée — se trace en
 * tirets : on dit qu'on ne sait pas ce qu'il y a au bout.
 */
export function tracerFleche(t: Trace, chemin: readonly Case[], aveugle = false): void {
  if (chemin.length < 2) return;
  for (const [echelle, couleur] of [[FLECHE.lisere, FLECHE.couleurLisere], [1, FLECHE.couleur]] as const) {
    const centres = chemin.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
    const fin = centres[centres.length - 1]!;
    const avant = centres[centres.length - 2]!;
    const dx = Math.sign(fin.x - avant.x);
    const dy = Math.sign(fin.y - avant.y);
    const tete = FLECHE.tete * echelle;
    // Le corps s'arrête au ras de la pointe : sans ce retrait, la jonction gonfle.
    const corps = [...centres.slice(0, -1), { x: fin.x - dx * tete, y: fin.y - dy * tete }];
    const demi = (FLECHE.corps * echelle) / 2;
    if (aveugle) {
      // Des tirets le long du trajet, sans bouchons : ils se lisent comme un
      // pointillé. Le tiret `k` occupe `[k·pas, k·pas + tiret]` le long du
      // chemin entier : on en coupe la part de chaque segment, sans boucle qui
      // dépende d'un reste flottant.
      const pas = FLECHE.tiret + FLECHE.blanc;
      let depart = 0;
      for (let i = 0; i < corps.length - 1; i++) {
        const a = corps[i]!;
        const b = corps[i + 1]!;
        const longueur = Math.hypot(b.x - a.x, b.y - a.y);
        if (longueur < 1e-9) continue;
        const fin = depart + longueur;
        for (let k = Math.floor(depart / pas); k * pas < fin; k++) {
          const d0 = Math.max(depart, k * pas);
          const d1 = Math.min(fin, k * pas + FLECHE.tiret);
          if (d1 - d0 < 1e-6) continue;
          const k0 = (d0 - depart) / longueur;
          const k1 = (d1 - depart) / longueur;
          ruban(t, a.x + (b.x - a.x) * k0, a.y + (b.y - a.y) * k0, a.x + (b.x - a.x) * k1, a.y + (b.y - a.y) * k1, demi, couleur);
        }
        depart = fin;
      }
    } else {
      for (let i = 0; i < corps.length - 1; i++) {
        const a = corps[i]!;
        const b = corps[i + 1]!;
        ruban(t, a.x, a.y, b.x, b.y, demi, couleur);
      }
      // Les coudes bouchés d'un carré : la grille est orthogonale, il recouvre l'angle.
      for (let i = 1; i < corps.length - 1; i++) {
        const j = corps[i]!;
        rectSol(t, j.x - demi, j.y - demi, j.x + demi, j.y + demi, couleur);
      }
    }
    // La pointe : un triangle dont la base est posée au bout du corps.
    const aile = FLECHE.aile * echelle;
    const base = { x: fin.x - dx * tete, y: fin.y - dy * tete };
    const nx = -dy * aile;
    const ny = dx * aile;
    const p1 = sol(base.x + nx, base.y + ny);
    const p2 = sol(base.x - nx, base.y - ny);
    const bout = sol(fin.x + dx * 0.06 * echelle, fin.y + dy * 0.06 * echelle);
    t.triangle(p1.X, p1.Y, bout.X, bout.Y, p2.X, p2.Y, couleur);
  }
}

/** Le curseur : le contour d'une case, quatre bandes fines. */
export function tracerCurseur(t: Trace, c: Case): void {
  const e = 0.055;
  const i = 0.035;
  const x0 = c.x + i;
  const y0 = c.y + i;
  const x1 = c.x + 1 - i;
  const y1 = c.y + 1 - i;
  rectSol(t, x0, y0, x1, y0 + e, CURSEUR);
  rectSol(t, x0, y1 - e, x1, y1, CURSEUR);
  rectSol(t, x0, y0 + e, x0 + e, y1 - e, CURSEUR);
  rectSol(t, x1 - e, y0 + e, x1, y1 - e, CURSEUR);
}

/**
 * L'anneau de sélection, au pied de l'unité : c'est la seule chose qui bat à
 * l'écran quand rien ne se joue, et elle suffit à dire « c'est celle-ci ». Sous
 * animations réduites, il est posé et ne bat pas.
 */
export function tracerAnneau(t: Trace, gx: number, gy: number, tempsMs: number, reduit: boolean): void {
  const battement = reduit ? 0 : Math.sin(tempsMs / 340);
  const rayon = 0.4 * (1 + battement * 0.08);
  const epaisseur = 0.055;
  const couleur = rvba(ANNEAU, 0.82 + battement * 0.14);
  const segments = 40;
  for (let k = 0; k < segments; k++) {
    const a0 = (k / segments) * Math.PI * 2;
    const a1 = ((k + 1) / segments) * Math.PI * 2;
    const i0 = sol(gx + Math.cos(a0) * (rayon - epaisseur), gy + Math.sin(a0) * (rayon - epaisseur));
    const o0 = sol(gx + Math.cos(a0) * (rayon + epaisseur), gy + Math.sin(a0) * (rayon + epaisseur));
    const i1 = sol(gx + Math.cos(a1) * (rayon - epaisseur), gy + Math.sin(a1) * (rayon - epaisseur));
    const o1 = sol(gx + Math.cos(a1) * (rayon + epaisseur), gy + Math.sin(a1) * (rayon + epaisseur));
    t.quadrilatere(i0.X, i0.Y, o0.X, o0.Y, o1.X, o1.Y, i1.X, i1.Y, couleur);
  }
}

/**
 * Le **fond** : une couleur par case, lue dans la palette d'ambiance, sous le
 * sol. Le lot du terrain le recouvre ; tant qu'il ne dessine rien — ou s'il
 * laisse passer une case —, le plateau reste lisible, terrain et brouillard
 * compris. Une case cachée est **noire** (décision du 7 septembre 2026).
 */
export function tracerFond(
  t: Trace, largeur: number, hauteur: number, couleurDe: (x: number, y: number) => string,
  brouillard: Uint8Array | null,
): void {
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const vue = brouillard ? (brouillard[y * largeur + x] ?? 255) / 255 : 1;
      const c = rvbaCss(couleurDe(x, y), 1);
      rectSol(t, x, y, x + 1, y + 1, [c[0] * vue, c[1] * vue, c[2] * vue, 1]);
    }
  }
}

/**
 * La couleur de fond d'un terrain dans la palette d'ambiance : la saison, la
 * nuit et la météo y sont déjà (`render/ambiance.ts`). Un bâtiment se pose sur
 * du pavé, un pont sur sa rivière.
 */
export function couleurTerrainFond(terrain: CleTerrain | null, p: PaletteTerrain): string {
  switch (terrain) {
    case 'foret': return p.feuillage;
    case 'montagne': return p.roche;
    case 'route': return p.route;
    case 'mer': return p.eauBas;
    case 'riviere': return p.riviere;
    case 'pont': return p.pont;
    case 'plage': return p.sable;
    case 'herbe_haute': return p.herbeSombre;
    case 'ville': case 'qg': case 'usine': case 'aeroport': case 'radar': case 'port': return p.route;
    default: return p.herbe;
  }
}

/** Le voile d'ambiance (nuit, brume, tempête…) sur tout le champ. */
export function tracerVoile(t: Trace, champ: Emprise, couleur: string, alpha: number): void {
  if (alpha <= 0) return;
  t.rectangle(champ.minX, champ.minY, champ.maxX, champ.maxY, rvbaCss(couleur, alpha));
}
