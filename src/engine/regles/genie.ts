/** Travaux de terrain : coût fixe, une seule case, accessibles aux deux camps. */
import type { Case, CleTerrain } from '../../schemas/index';
import type { Catalogue, EtatPartie, Unite } from '../types';
import { cleCase, manhattan, porte } from '../types';
import { terrainLogique } from '../hooks';
import { uniteSur, voisines } from './mouvement';

export const COUT_CONSTRUCTION = 1500;

/** Le génie ouvre un col ou rétablit un pont ; jamais de chaussée en pleine mer. */
export function terrainConstruction(etat: EtatPartie, cat: Catalogue, u: Unite, cible: Case): CleTerrain | null {
  const type = cat.unites[u.type];
  if (!type || !porte(type, 'genie') || manhattan(u, cible) !== 1) return null;
  if (!Number.isInteger(cible.x) || !Number.isInteger(cible.y) || uniteSur(etat, cible)) return null;
  if ((etat.camps.find((c) => c.id === u.camp)?.fonds ?? 0) < COUT_CONSTRUCTION) return null;
  const terrain = terrainLogique(etat, cat, cible);
  // Une pose existante ne peut pas être écrasée par des travaux.
  if (etat.terrainsPoses.some((p) => p.case === cleCase(cible))) return null;
  return terrain === 'riviere' ? 'pont' : terrain === 'montagne' ? 'route' : null;
}

export function constructionsPossibles(etat: EtatPartie, cat: Catalogue, u: Unite): Case[] {
  return voisines(u).filter((c) => terrainConstruction(etat, cat, u, c) !== null);
}
