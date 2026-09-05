/**
 * Le catalogue : la seule façon dont le moteur connaît les unités et les terrains.
 *
 * Aucune clé d'unité n'est écrite en dur dans le moteur (`04-gameplay.md` §13.1,
 * `BRIEF.md` seconde relecture point 8). Les comportements viennent des `traits`,
 * les chiffres du catalogue, les dégâts de la matrice.
 */

import {
  chargerDegats, chargerTerrains, chargerUnites, degatsDe,
} from '../content/index';
import type {
  CleTerrain, CleUnite, TableDegats, Terrain, TypeMouvement, UnitType,
} from '../schemas/index';
import { CARACTERE_PAR_TERRAIN } from '../schemas/index';
import type { Catalogue } from './types';
import { porte } from './types';

/** Assemble un catalogue depuis des listes déjà validées. */
export function catalogueDepuis(
  version: number, unites: UnitType[], terrains: Terrain[], degats: TableDegats,
): Catalogue {
  const parCle: Record<CleUnite, UnitType> = {};
  const cles: CleUnite[] = [];
  for (const u of unites) {
    parCle[u.cle] = u;
    cles.push(u.cle);
  }
  const parTerrain: Record<string, Terrain> = {};
  const parCaractere: Record<string, CleTerrain> = {};
  for (const t of terrains) {
    parTerrain[t.cle] = t;
    parCaractere[t.car] = t.cle;
  }
  for (const [cle, car] of Object.entries(CARACTERE_PAR_TERRAIN)) {
    if (!(car in parCaractere)) parCaractere[car] = cle as CleTerrain;
  }
  return {
    version,
    cles,
    unites: parCle,
    terrains: parTerrain as Record<CleTerrain, Terrain>,
    parCaractere,
    degats,
  };
}

/** Charge le catalogue canon embarqué (`content/*.json`). */
export function chargerCatalogue(version = 1): Catalogue {
  return catalogueDepuis(version, chargerUnites(), chargerTerrains(), chargerDegats());
}

/** Type d'unité, ou `undefined` si la clé est inconnue du catalogue. */
export function typeUnite(cat: Catalogue, cle: CleUnite): UnitType | undefined {
  return cat.unites[cle];
}

/** Terrain d'une clé, ou `undefined`. */
export function terrainDe(cat: Catalogue, cle: CleTerrain): Terrain | undefined {
  return cat.terrains[cle];
}

/**
 * Valeur `base` de la formule de dégâts : ce que `att` inflige à `cible`.
 * La colonne fournie par la cible (`subitDegats`) l'emporte, puis la matrice,
 * puis la ligne de l'attaquant — une unité homologuée fournit les deux.
 */
export function degatsBase(cat: Catalogue, att: CleUnite, cible: CleUnite): number {
  const defenseur = cat.unites[cible];
  const colonne = defenseur?.subitDegats?.[att];
  if (typeof colonne === 'number') return colonne;
  const table = degatsDe(cat.degats, att, cible);
  if (table > 0) return table;
  return cat.unites[att]?.degats[cible] ?? 0;
}

/** Coût de terrain de base pour un type de mouvement, `null` si infranchissable. */
export function coutBase(
  cat: Catalogue, terrain: CleTerrain, mouvement: TypeMouvement, u?: UnitType,
): number | null {
  const t = cat.terrains[terrain];
  if (!t) return null;
  // `tout_terrain` : coût 1 sur montagne et rivière, quel que soit le mouvement.
  if (u && porte(u, 'tout_terrain') && (terrain === 'montagne' || terrain === 'riviere')) return 1;
  // `vol` : coût 1 partout.
  if (u && porte(u, 'vol')) return 1;
  const c = t.couts[mouvement];
  return typeof c === 'number' ? c : null;
}

/** Liste des unités qu'un terrain produit, filtrée sur le catalogue actif. */
export function produitesPar(cat: Catalogue, terrain: CleTerrain): CleUnite[] {
  const t = cat.terrains[terrain];
  if (!t) return [];
  return t.produit.filter((c) => {
    const u = cat.unites[c];
    return u !== undefined && u.statut !== 'retiree';
  });
}
