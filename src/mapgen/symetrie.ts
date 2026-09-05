/**
 * Cadre de symétrie : le groupe d'isométries de la grille sous lequel la carte
 * est invariante. Tout ce que le générateur écrit passe par l'orbite d'une case,
 * donc la carte reste symétrique **à chaque instant**, sans passe de miroir finale.
 *
 * Pourquoi un groupe et pas un simple miroir : la valeur d'un camp est la somme
 * des propriétés pondérées par leur distance à son QG. Si une isométrie du plateau
 * envoie le QG du camp A sur celui du camp B et laisse l'ensemble des propriétés
 * invariant, les deux multiensembles de distances sont identiques, donc les deux
 * valeurs sont **exactement** égales. C'est ce qui rend l'équité démontrable
 * plutôt que mesurée.
 *
 * À trois ou quatre camps, aucun groupe de rectangle n'agit transitivement sur
 * trois quadrants seulement : on prend le groupe de Klein (quatre quadrants) et,
 * à trois camps, le quatrième quadrant devient neutre — ses bâtiments restent en
 * place, ils changent seulement de propriétaire.
 */

import type { Symetrie } from '../schemas/types';

/** Motif de symétrie effectivement appliqué à la grille. */
export type MotifSymetrie =
  | 'axe_vertical' | 'axe_horizontal' | 'point' | 'klein' | 'rotation_90';

type Isometrie = (x: number, y: number) => readonly [number, number];

/** Le groupe d'isométries retenu, plus ce qu'il faut pour l'appliquer. */
export interface Cadre {
  largeur: number;
  hauteur: number;
  motif: MotifSymetrie;
  /** Taille du groupe : 2 ou 4. */
  ordre: number;
  /** Indice de transformation attribué à chaque camp, `camps` entrées. */
  transformationsCamps: number[];
  /** Image de la case `cellule` par la i-ème transformation. */
  image(i: number, cellule: number): number;
  /** Orbite d'une case : ses images distinctes, triées par indice croissant. */
  orbite(cellule: number): number[];
  /** Représentant canonique d'une orbite : sa case d'indice minimal. */
  representant(cellule: number): number;
  /** Domaine fondamental : les cases qui sont leur propre représentant. */
  base: number[];
}

/** Liste des isométries d'un motif, la première étant toujours l'identité. */
function isometries(motif: MotifSymetrie, largeur: number, hauteur: number): Isometrie[] {
  const identite: Isometrie = (x, y) => [x, y];
  const miroirX: Isometrie = (x, y) => [largeur - 1 - x, y];
  const miroirY: Isometrie = (x, y) => [x, hauteur - 1 - y];
  const demiTour: Isometrie = (x, y) => [largeur - 1 - x, hauteur - 1 - y];
  switch (motif) {
    case 'axe_vertical': return [identite, miroirX];
    case 'axe_horizontal': return [identite, miroirY];
    case 'point': return [identite, demiTour];
    case 'klein': return [identite, miroirX, miroirY, demiTour];
    case 'rotation_90':
      return [
        identite,
        (x, y) => [hauteur - 1 - y, x],
        demiTour,
        (x, y) => [y, largeur - 1 - x],
      ];
  }
}

/**
 * Choisit le motif applicable : `symetrie` est une intention, la géométrie
 * tranche. `rotation_90` exige une grille carrée ; trois ou quatre camps
 * exigent un groupe d'ordre quatre ; `aucune` prend l'axe le plus naturel
 * (le générateur brouillera ensuite le décor, voir `generer.ts`).
 */
export function choisirMotif(
  symetrie: Symetrie,
  camps: number,
  largeur: number,
  hauteur: number,
): MotifSymetrie {
  if (camps >= 3) {
    return symetrie === 'rotation_90' && largeur === hauteur ? 'rotation_90' : 'klein';
  }
  switch (symetrie) {
    case 'axe_vertical': return 'axe_vertical';
    case 'axe_horizontal': return 'axe_horizontal';
    case 'point': return 'point';
    case 'rotation_90': return 'point';
    case 'aucune': return largeur >= hauteur ? 'axe_vertical' : 'axe_horizontal';
  }
}

/** Répartit les camps sur les transformations du groupe, de façon stable. */
function attribuerCamps(ordre: number, camps: number): number[] {
  if (ordre === 2) return camps >= 2 ? [0, 1] : [0];
  // Ordre 4 : à deux camps on prend deux transformations opposées.
  if (camps === 2) return [0, 3];
  const liste: number[] = [];
  for (let i = 0; i < Math.min(camps, ordre); i += 1) liste.push(i);
  return liste;
}

/**
 * Cadre sans symétrie : groupe réduit à l'identité. Sert à relire une carte déjà
 * écrite (vérification, aperçu, rendu), où rien n'est propagé.
 */
export function creerCadreTrivial(largeur: number, hauteur: number): Cadre {
  return {
    largeur,
    hauteur,
    motif: 'point',
    ordre: 1,
    transformationsCamps: [0],
    image: (_i: number, c: number) => c,
    orbite: (c: number) => [c],
    representant: (c: number) => c,
    base: Array.from({ length: largeur * hauteur }, (_v, i) => i),
  };
}

/** Construit le cadre de symétrie d'une grille. */
export function creerCadre(
  symetrie: Symetrie,
  camps: number,
  largeur: number,
  hauteur: number,
): Cadre {
  const motif = choisirMotif(symetrie, camps, largeur, hauteur);
  const isos = isometries(motif, largeur, hauteur);
  const ordre = isos.length;
  const total = largeur * hauteur;

  // Tables précalculées : image[i][cellule]. Une carte fait au plus 1 200 cases.
  const images: Int32Array[] = isos.map((iso) => {
    const table = new Int32Array(total);
    for (let y = 0; y < hauteur; y += 1) {
      for (let x = 0; x < largeur; x += 1) {
        const [ax, ay] = iso(x, y);
        table[y * largeur + x] = ay * largeur + ax;
      }
    }
    return table;
  });

  const representants = new Int32Array(total);
  for (let c = 0; c < total; c += 1) {
    let min = c;
    for (let i = 0; i < ordre; i += 1) {
      const img = images[i]?.[c] ?? c;
      if (img < min) min = img;
    }
    representants[c] = min;
  }

  const base: number[] = [];
  for (let c = 0; c < total; c += 1) if (representants[c] === c) base.push(c);

  return {
    largeur,
    hauteur,
    motif,
    ordre,
    transformationsCamps: attribuerCamps(ordre, camps),
    image(i: number, cellule: number): number {
      return images[i]?.[cellule] ?? cellule;
    },
    orbite(cellule: number): number[] {
      const vues: number[] = [];
      for (let i = 0; i < ordre; i += 1) {
        const img = images[i]?.[cellule] ?? cellule;
        if (!vues.includes(img)) vues.push(img);
      }
      vues.sort((a, b) => a - b);
      return vues;
    },
    representant(cellule: number): number {
      return representants[cellule] ?? cellule;
    },
    base,
  };
}
