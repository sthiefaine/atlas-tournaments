/**
 * Le terrain : les couches fusionnées de la démo — eau et vaguelettes, halo de
 * sable, herbe, texture, rivières, ponts, routes, grille discrète.
 *
 * Deux corrections par rapport à la démo (`02-architecture.md` §3.4) :
 *
 * 1. la graine de la texture d'herbe et des vaguelettes vient de la **carte**,
 *    jamais de l'horloge : sinon la texture bouge à chaque image et à chaque
 *    redimensionnement ;
 * 2. les jonctions de route sont calculées sur les **quatre** voisins, pas
 *    seulement est et sud, sinon les extrémités restent des moignons.
 *
 * Le repère est le monde : `(0, 0)` au coin haut gauche de la carte, une tuile
 * fait `TUILE` pixels.
 */

import type { CleTerrain } from '../../schemas/types';
import type { PaletteTerrain } from '../ambiance';
import { TUILE } from '../camera';
import { bruit, ell, ombre, rr, type Pinceau } from './formes';

/** Ce que la couche terrain a besoin de savoir d'une carte. */
export interface CarteRendu {
  largeur: number;
  hauteur: number;
  /** Terrain d'une case ; hors carte, rendre `'mer'`. */
  terrainDe(x: number, y: number): CleTerrain;
}

/** Terrains qui portent une chaussée : la route s'y raccorde. */
const CHAUSSEE: ReadonlySet<CleTerrain> = new Set<CleTerrain>([
  'route', 'pont', 'ville', 'usine', 'aeroport', 'qg',
]);

/** Vrai si la case est de la terre ferme (tout sauf la mer). */
export function estTerre(t: CleTerrain): boolean {
  return t !== 'mer';
}

/** Vrai si la case porte une chaussée. */
export function estChaussee(t: CleTerrain): boolean {
  return CHAUSSEE.has(t);
}

/** Voisins d'une case, dans l'ordre est, sud, ouest, nord. */
const VOISINS: readonly [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/**
 * Dessine tout le terrain d'une carte. C'est la couche la plus lourde et la plus
 * stable : la scène la met en cache dans un canvas hors écran et se contente de
 * la blitter tant que l'ambiance et le palier de zoom ne changent pas.
 */
export function dessinerTerrain(
  g: Pinceau, carte: CarteRendu, p: PaletteTerrain, graine: number, grille = true,
): void {
  const { largeur, hauteur } = carte;
  const L = largeur * TUILE;
  const H = hauteur * TUILE;
  const t = (x: number, y: number): CleTerrain => carte.terrainDe(x, y);

  // Eau : dégradé plein écran, puis vaguelettes seedées par la carte.
  const eau = g.createLinearGradient(0, 0, 0, H);
  eau.addColorStop(0, p.eauHaut);
  eau.addColorStop(1, p.eauBas);
  g.fillStyle = eau;
  g.fillRect(0, 0, L, H);

  const rnd = bruit(graine);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.lineCap = 'round';
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (t(x, y) !== 'mer') continue;
      for (let i = 0; i < 2; i += 1) {
        const wx = x * TUILE + 10 + rnd() * 40;
        const wy = y * TUILE + 12 + rnd() * 40;
        g.beginPath();
        g.moveTo(wx, wy);
        g.quadraticCurveTo(wx + 6, wy - 3, wx + 12, wy);
        g.stroke();
      }
    }
  }

  // Halo de sable puis herbe : deux passes de rectangles arrondis qui fusionnent
  // en côtes rondes. C'est tout le secret du style de la démo.
  ombre(g, true);
  g.fillStyle = p.sable;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!estTerre(t(x, y))) continue;
      rr(g, x * TUILE - 7, y * TUILE - 7, TUILE + 14, TUILE + 14, 14);
      g.fill();
    }
  }
  ombre(g, false);

  g.fillStyle = p.herbe;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const c = t(x, y);
      if (!estTerre(c) || c === 'plage') continue;
      rr(g, x * TUILE - 1, y * TUILE - 1, TUILE + 2, TUILE + 2, 10);
      g.fill();
    }
  }

  // Texture d'herbe : quelques touffes claires et sombres, seedées.
  const rnd2 = bruit(graine + 7);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const c = t(x, y);
      if (!estTerre(c) || c === 'plage') continue;
      for (let i = 0; i < 4; i += 1) {
        ell(
          g,
          x * TUILE + 8 + rnd2() * 48,
          y * TUILE + 8 + rnd2() * 48,
          5 + rnd2() * 6,
          3 + rnd2() * 3,
          rnd2() < 0.5 ? p.herbeSombre : p.herbeClair,
        );
      }
    }
  }

  // Rivières : une bande d'eau qui court dans la case, arrondie aux jonctions.
  g.strokeStyle = p.riviere;
  g.lineWidth = 34;
  g.lineJoin = 'round';
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (t(x, y) !== 'riviere') continue;
      const cx = x * TUILE + TUILE / 2;
      const cy = y * TUILE + TUILE / 2;
      let jonction = false;
      for (const [dx, dy] of VOISINS) {
        const v = t(x + dx, y + dy);
        if (v !== 'riviere' && v !== 'mer' && v !== 'pont') continue;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + dx * TUILE * 0.5, cy + dy * TUILE * 0.5);
        g.stroke();
        jonction = true;
      }
      if (!jonction) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx, cy);
        g.stroke();
      }
    }
  }

  // Routes : chaussée large, jonctions sur les quatre voisins, ligne médiane.
  g.strokeStyle = p.route;
  g.lineWidth = 24;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!estChaussee(t(x, y))) continue;
      const cx = x * TUILE + TUILE / 2;
      const cy = y * TUILE + TUILE / 2;
      let jonction = false;
      for (const [dx, dy] of VOISINS) {
        if (!estChaussee(t(x + dx, y + dy))) continue;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + dx * TUILE * 0.5, cy + dy * TUILE * 0.5);
        g.stroke();
        jonction = true;
      }
      if (!jonction) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx, cy);
        g.stroke();
      }
    }
  }

  g.strokeStyle = p.routeLigne;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.setLineDash([6, 8]);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const c = t(x, y);
      if (c !== 'route' && c !== 'pont') continue;
      const cx = x * TUILE + TUILE / 2;
      const cy = y * TUILE + TUILE / 2;
      for (const [dx, dy] of VOISINS) {
        if (!estChaussee(t(x + dx, y + dy))) continue;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + dx * TUILE * 0.5, cy + dy * TUILE * 0.5);
        g.stroke();
      }
    }
  }
  g.setLineDash([]);
  g.globalAlpha = 1;

  // Ponts : un tablier de bois par-dessus la rivière.
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (t(x, y) !== 'pont') continue;
      const px = x * TUILE;
      const py = y * TUILE;
      const horizontal = estChaussee(t(x - 1, y)) || estChaussee(t(x + 1, y));
      g.fillStyle = p.pont;
      if (horizontal) {
        rr(g, px - 2, py + 14, TUILE + 4, TUILE - 28, 4);
        g.fill();
      } else {
        rr(g, px + 14, py - 2, TUILE - 28, TUILE + 4, 4);
        g.fill();
      }
    }
  }

  if (!grille) return;
  g.strokeStyle = 'rgba(0,0,0,0.07)';
  g.lineWidth = 1;
  for (let x = 0; x <= largeur; x += 1) {
    g.beginPath();
    g.moveTo(x * TUILE, 0);
    g.lineTo(x * TUILE, H);
    g.stroke();
  }
  for (let y = 0; y <= hauteur; y += 1) {
    g.beginPath();
    g.moveTo(0, y * TUILE);
    g.lineTo(L, y * TUILE);
    g.stroke();
  }
}
