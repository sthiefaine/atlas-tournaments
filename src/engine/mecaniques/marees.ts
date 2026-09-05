/**
 * `meca_marees` — les marées de Bretagne (`doc/04-gameplay.md` §11.2).
 *
 * Une journée sur deux la mer se retire : toute case `mer` à `amplitudeCases` ou
 * moins d'une case `plage` est **vue comme** `plage`. La grille n'est jamais
 * réécrite. À la bascule vers la marée haute, une unité terrestre restée sur le
 * fond marin est repoussée vers la case libre la plus proche ; à défaut elle
 * subit 30 PV internes, jamais jusqu'à la mise hors jeu.
 */

import type { Case, CleTerrain } from '../../schemas/index';
import type { CtxMecanique, EffetMecanique, Mecanique } from '../types';
import { cleCase } from '../types';
import { coutBase } from '../catalogue';

/** Paramètres de `meca_marees`. */
export interface ParametresMarees {
  periodeJournees: number;
  amplitudeCases: number;
  phaseInitiale: number;
}

/** Vrai si la marée est basse à cette journée. */
export function mareeBasse(p: ParametresMarees, journee: number): boolean {
  const periode = Math.max(1, p.periodeJournees);
  return ((journee + p.phaseInitiale) % (2 * periode)) < periode;
}

/** Terrain de grille d'une case, sans aucune réinterprétation. */
function terrainBrut(grille: string[], parCaractere: Record<string, CleTerrain>, c: Case): CleTerrain | null {
  const ligne = grille[c.y];
  if (ligne === undefined) return null;
  const car = ligne[c.x];
  if (car === undefined) return null;
  return parCaractere[car] ?? null;
}

/** Vrai si cette case de mer découvre à marée basse. */
function decouvre(
  grille: string[], parCaractere: Record<string, CleTerrain>, c: Case, amplitude: number,
): boolean {
  for (let dy = -amplitude; dy <= amplitude; dy += 1) {
    for (let dx = -amplitude; dx <= amplitude; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > amplitude) continue;
      if (terrainBrut(grille, parCaractere, { x: c.x + dx, y: c.y + dy }) === 'plage') return true;
    }
  }
  return false;
}

/** Les marées de Bretagne. */
export const MECANIQUE_MAREES: Mecanique<ParametresMarees> = {
  cle: 'meca_marees',
  nom: 'Les marées',
  parametresParDefaut: { periodeJournees: 2, amplitudeCases: 1, phaseInitiale: 0 },
  hooks: {
    modifTerrain(ctx: CtxMecanique<ParametresMarees>, c, terrain: CleTerrain): CleTerrain {
      if (terrain !== 'mer') return terrain;
      if (!mareeBasse(ctx.parametres, ctx.journee)) return terrain;
      const amplitude = Math.max(0, Math.min(3, ctx.parametres.amplitudeCases));
      return decouvre(ctx.etat.grille, ctx.catalogue.parCaractere, c, amplitude) ? 'plage' : terrain;
    },

    debutTour(ctx: CtxMecanique<ParametresMarees>): EffetMecanique[] {
      const basse = mareeBasse(ctx.parametres, ctx.journee);
      const etaitBasse = ctx.donnees['basse'] === true;
      const effets: EffetMecanique[] = [{ type: 'donnee', cle: 'basse', valeur: basse }];
      if (basse === etaitBasse) return effets;
      effets.push({
        type: 'annonce',
        texte: basse ? 'La marée descend — la grève est ouverte.' : 'La marée monte — dégagez la grève.',
        icone: 'meca_marees',
      });
      if (basse) return effets;

      // Bascule vers la marée haute : on repousse ce qui traîne sur le fond marin.
      const amplitude = Math.max(0, Math.min(3, ctx.parametres.amplitudeCases));
      const occupees = new Set(ctx.etat.unites.map((u) => cleCase(u)));
      for (const u of ctx.etat.unites) {
        const type = ctx.catalogue.unites[u.type];
        if (!type || type.domaine !== 'terre') continue;
        const brut = terrainBrut(ctx.etat.grille, ctx.catalogue.parCaractere, u);
        if (brut !== 'mer') continue;
        if (!decouvre(ctx.etat.grille, ctx.catalogue.parCaractere, u, amplitude)) continue;
        const refuge = plusProcheTerre(ctx, u, occupees, type);
        if (refuge) {
          occupees.delete(cleCase(u));
          occupees.add(cleCase(refuge));
          effets.push({ type: 'repousser', case: { x: u.x, y: u.y }, vers: refuge });
        } else {
          effets.push({ type: 'degats', case: { x: u.x, y: u.y }, pv: 30 });
        }
      }
      return effets;
    },
  },
};

/** Case de terre libre la plus proche, en anneaux croissants, ordre déterministe. */
function plusProcheTerre(
  ctx: CtxMecanique<ParametresMarees>, depuis: Case, occupees: Set<string>, type: import('../../schemas/index').UnitType,
): Case | null {
  for (let rayon = 1; rayon <= 4; rayon += 1) {
    const candidats: Case[] = [];
    for (let dy = -rayon; dy <= rayon; dy += 1) {
      const dx = rayon - Math.abs(dy);
      for (const sx of dx === 0 ? [0] : [-dx, dx]) {
        candidats.push({ x: depuis.x + sx, y: depuis.y + dy });
      }
    }
    candidats.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    for (const c of candidats) {
      const brut = terrainBrut(ctx.etat.grille, ctx.catalogue.parCaractere, c);
      if (brut === null || brut === 'mer') continue;
      if (coutBase(ctx.catalogue, brut, type.typeMouvement, type) === null) continue;
      if (occupees.has(cleCase(c))) continue;
      return c;
    }
  }
  return null;
}
