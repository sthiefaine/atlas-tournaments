/**
 * La grille de travail du générateur : un tableau plat de terrains, ses écritures
 * symétriques, et les parcours (BFS, Dijkstra, composantes connexes) dont toutes
 * les passes ont besoin.
 *
 * Les coûts de déplacement ne sont **jamais** écrits en dur : ils sont lus dans
 * `content/terrains.json`, seule source de vérité (`04-gameplay.md` §4). Un terrain
 * sans entrée pour un type de mouvement est infranchissable — c'est la convention
 * de `03-schemas.md` §4, il n'existe pas de coût infini.
 */

import { chargerTerrains } from '../content/index';
import { CARACTERE_PAR_TERRAIN, type CleTerrain, type Terrain, type TypeMouvement } from '../schemas/types';
import type { Cadre } from './symetrie';

const TERRAINS: Terrain[] = chargerTerrains();

const PAR_CLE = ((): Record<string, Terrain> => {
  const table: Record<string, Terrain> = {};
  for (const t of TERRAINS) table[t.cle] = t;
  return table;
})();

/** Terrains portant un propriétaire (`03-schemas.md` §4). */
export const CAPTURABLES: readonly CleTerrain[] = ['ville', 'usine', 'aeroport', 'qg', 'radar'];

/** Terrains sur lesquels le générateur pose un bâtiment. */
export const CONSTRUCTIBLES: readonly CleTerrain[] = ['plaine', 'foret', 'plage', 'route'];

/** Coût d'entrée d'un terrain, ou `null` si infranchissable pour ce mouvement. */
export function coutDe(terrain: CleTerrain, mouvement: TypeMouvement): number | null {
  const fiche = PAR_CLE[terrain];
  if (!fiche) return null;
  const cout = fiche.couts[mouvement];
  return typeof cout === 'number' ? cout : null;
}

/** Vrai si ce terrain se franchit avec ce type de mouvement. */
export function franchissable(terrain: CleTerrain, mouvement: TypeMouvement): boolean {
  return coutDe(terrain, mouvement) !== null;
}

/** Caractère de grille d'un terrain. */
export function caractereDe(terrain: CleTerrain): string {
  return CARACTERE_PAR_TERRAIN[terrain];
}

/** Terrain correspondant à un caractère de grille, ou `null`. */
export function terrainDeCaractere(car: string): CleTerrain | null {
  for (const t of TERRAINS) if (t.car === car) return t.cle;
  return null;
}

/** Grille de travail : terrains, propriétaires, et le cadre de symétrie. */
export interface Toile {
  largeur: number;
  hauteur: number;
  cadre: Cadre;
  cases: CleTerrain[];
  /** Camp propriétaire par case, `-1` pour neutre ou non capturable. */
  proprietaires: Int8Array;
}

/** Crée une grille entièrement remplie d'un terrain de fond. */
export function creerToile(cadre: Cadre, fond: CleTerrain): Toile {
  const total = cadre.largeur * cadre.hauteur;
  return {
    largeur: cadre.largeur,
    hauteur: cadre.hauteur,
    cadre,
    cases: new Array<CleTerrain>(total).fill(fond),
    proprietaires: new Int8Array(total).fill(-1),
  };
}

/** Indice de case à partir de ses coordonnées. */
export function cellule(t: Toile, x: number, y: number): number {
  return y * t.largeur + x;
}

/** Abscisse d'une case. */
export function abscisse(t: Toile, c: number): number {
  return c % t.largeur;
}

/** Ordonnée d'une case. */
export function ordonnee(t: Toile, c: number): number {
  return Math.floor(c / t.largeur);
}

/** Terrain d'une case. */
export function lire(t: Toile, c: number): CleTerrain {
  return t.cases[c] ?? 'mer';
}

/** Écrit une case seule, sans propager la symétrie. */
export function poserBrut(t: Toile, c: number, terrain: CleTerrain): void {
  t.cases[c] = terrain;
  if (!CAPTURABLES.includes(terrain)) t.proprietaires[c] = -1;
}

/** Écrit une case **et toute son orbite** : la carte reste symétrique. */
export function poser(t: Toile, c: number, terrain: CleTerrain): void {
  for (const img of t.cadre.orbite(c)) poserBrut(t, img, terrain);
}

/** Les quatre voisins orthogonaux d'une case, dans l'ordre haut, gauche, droite, bas. */
export function voisins4(t: Toile, c: number): number[] {
  const x = abscisse(t, c);
  const y = ordonnee(t, c);
  const out: number[] = [];
  if (y > 0) out.push(c - t.largeur);
  if (x > 0) out.push(c - 1);
  if (x < t.largeur - 1) out.push(c + 1);
  if (y < t.hauteur - 1) out.push(c + t.largeur);
  return out;
}

/** Distance de Tchebychev entre deux cases. */
export function distanceCases(t: Toile, a: number, b: number): number {
  return Math.max(
    Math.abs(abscisse(t, a) - abscisse(t, b)),
    Math.abs(ordonnee(t, a) - ordonnee(t, b)),
  );
}

/**
 * Distances en **nombre de cases** depuis un ou plusieurs départs, pour un type
 * de mouvement donné. `-1` marque l'inatteignable. On compte des pas et non des
 * coûts : c'est la mesure attendue par les diagnostics et par la valeur d'un camp,
 * et elle ne bouge pas quand le décor change (plaine ou forêt, un pas reste un pas).
 */
export function distances(t: Toile, departs: readonly number[], mouvement: TypeMouvement): Int32Array {
  const total = t.largeur * t.hauteur;
  const d = new Int32Array(total).fill(-1);
  const file: number[] = [];
  for (const dep of departs) {
    if (dep >= 0 && dep < total && d[dep] === -1 && franchissable(lire(t, dep), mouvement)) {
      d[dep] = 0;
      file.push(dep);
    }
  }
  for (let tete = 0; tete < file.length; tete += 1) {
    const c = file[tete] as number;
    const suivante = (d[c] as number) + 1;
    for (const v of voisins4(t, c)) {
      if (d[v] !== -1) continue;
      if (!franchissable(lire(t, v), mouvement)) continue;
      d[v] = suivante;
      file.push(v);
    }
  }
  return d;
}

/** Composantes connexes des cases franchissables : étiquette par case, `-1` hors graphe. */
export function composantes(t: Toile, mouvement: TypeMouvement): {
  etiquettes: Int32Array;
  tailles: number[];
} {
  const total = t.largeur * t.hauteur;
  const etiquettes = new Int32Array(total).fill(-1);
  const tailles: number[] = [];
  for (let depart = 0; depart < total; depart += 1) {
    if (etiquettes[depart] !== -1) continue;
    if (!franchissable(lire(t, depart), mouvement)) continue;
    const numero = tailles.length;
    const file = [depart];
    etiquettes[depart] = numero;
    let taille = 0;
    for (let tete = 0; tete < file.length; tete += 1) {
      const c = file[tete] as number;
      taille += 1;
      for (const v of voisins4(t, c)) {
        if (etiquettes[v] !== -1) continue;
        if (!franchissable(lire(t, v), mouvement)) continue;
        etiquettes[v] = numero;
        file.push(v);
      }
    }
    tailles.push(taille);
  }
  return { etiquettes, tailles };
}

/**
 * Chemin le moins coûteux entre deux cases, avec un coût libre par case
 * (`null` = case interdite). Dijkstra à file triée : les cartes font au plus
 * 1 200 cases, la simplicité prime sur le tas binaire.
 * Renvoie les cases du chemin, départ compris, ou `null` s'il n'en existe pas.
 */
export function cheminMoinsCher(
  t: Toile,
  depart: number,
  arrivee: number,
  cout: (terrain: CleTerrain, c: number) => number | null,
): number[] | null {
  const total = t.largeur * t.hauteur;
  const dist = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const vus = new Uint8Array(total);
  dist[depart] = 0;
  for (;;) {
    let courant = -1;
    let meilleure = Infinity;
    for (let c = 0; c < total; c += 1) {
      if (vus[c] === 1) continue;
      const dc = dist[c] as number;
      if (dc < meilleure) { meilleure = dc; courant = c; }
    }
    if (courant === -1) return null;
    if (courant === arrivee) break;
    vus[courant] = 1;
    for (const v of voisins4(t, courant)) {
      if (vus[v] === 1) continue;
      const c = cout(lire(t, v), v);
      if (c === null) continue;
      const candidate = meilleure + c;
      if (candidate < (dist[v] as number)) {
        dist[v] = candidate;
        parent[v] = courant;
      }
    }
  }
  const chemin: number[] = [];
  let c = arrivee;
  while (c !== -1) {
    chemin.push(c);
    if (c === depart) break;
    c = parent[c] as number;
  }
  chemin.reverse();
  return chemin[0] === depart ? chemin : null;
}
