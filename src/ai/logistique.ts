/**
 * Logistique de l'IA : munitions et arme secondaire, carburant, ravitaillement,
 * transport (`doc/04-gameplay.md` §2 phases 3 et 4, §5.3, §13.2). Tout est pur
 * et déterministe, et rien ici ne nomme une unité : ce sont les traits,
 * `munitions`, `carburant`, `armeSecondaire` et `transport` du catalogue qui
 * parlent, comme dans le moteur.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { terrainLogique } from '../engine/hooks';
import { degatsArme } from '../engine/regles/combat';
import { batimentsDe, ravitailleCetteUnite } from '../engine/regles/economie';
import { pointsMouvement, voisines } from '../engine/regles/mouvement';
import { depuisCle, porte } from '../engine/types';
import type { Case, CampId, CleUnite, UnitType } from '../schemas/index';

/**
 * Vrai si l'unité peut encore ouvrir le feu sur ce type de cible : c'est
 * `degatsArme` du moteur qui le dit — base pleine avec des munitions ou sur une
 * cible secondaire, base réduite à sec sur le reste, zéro si rien ne part (§5.3).
 */
export function peutTirerSur(cat: Catalogue, att: Unite, cible: CleUnite): boolean {
  return degatsArme(cat, att, cible) > 0;
}

/** Vrai si l'arme principale est à sa dernière munition, ou à sec. */
export function munitionsFaibles(type: UnitType, u: Unite): boolean {
  return type.munitions !== null && (u.munitions ?? 0) <= 1;
}

/** Vrai si le carburant ne couvre plus deux tours pleins de déplacement. */
export function carburantFaible(etat: EtatPartie, cat: Catalogue, type: UnitType, u: Unite): boolean {
  if (type.carburant === null || u.carburant === null) return false;
  const mouvement = pointsMouvement(etat, cat, u);
  return u.carburant <= 2 * (mouvement * type.carburant.parCase + type.carburant.parTour);
}

/**
 * Ce qui manque à une unité, en fonds : la part de munitions et de carburant
 * absente, au prorata de son coût. Une unité aérienne compte son carburant
 * double, parce qu'à zéro elle sort du jeu au lieu de s'arrêter.
 */
export function manque(cat: Catalogue, u: Unite): number {
  const t = cat.unites[u.type];
  if (!t) return 0;
  let total = 0;
  if (t.munitions !== null && u.munitions !== null && t.munitions > 0) {
    total += (1 - u.munitions / t.munitions) * t.cout;
  }
  if (t.carburant !== null && u.carburant !== null && t.carburant.max > 0) {
    total += (1 - u.carburant / t.carburant.max) * t.cout * (t.domaine === 'air' ? 2 : 1);
  }
  return Math.max(0, total);
}

/** Vrai si l'unité a réellement besoin d'un ravitaillement, pas d'un simple plein. */
export function aBesoin(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  if (!t) return false;
  return munitionsFaibles(t, u) || carburantFaible(etat, cat, t, u) || manque(cat, u) >= 0.4 * t.cout;
}

/**
 * Autonomie de sécurité d'une unité arrivée avec `carburant`, à `distanceRetour`
 * pas du bâtiment ami qui la ravitaille : ce qui lui reste une fois payés le
 * retour — `parCase` par pas, `parTour` par tour de route — et `reserve` tours
 * de marge. Négative, l'unité doit rentrer maintenant. Sur le bâtiment même,
 * elle est ravitaillée avant de consommer (phase 3 avant phase 4).
 */
export function autonomieSecurite(
  type: UnitType, carburant: number, distanceRetour: number, mouvement: number, reserve: number,
): number {
  if (type.carburant === null) return Number.POSITIVE_INFINITY;
  if (distanceRetour <= 0) return carburant;
  const { parCase, parTour } = type.carburant;
  const tours = Math.ceil(distanceRetour / Math.max(1, mouvement));
  return carburant - distanceRetour * parCase - parTour * (tours + reserve);
}

/** Bâtiments possédés par le camp qui ravitaillent ce domaine (§2, phase 3). */
export function batimentsRavitaillant(
  etat: EtatPartie, cat: Catalogue, camp: CampId, domaine: string,
): Case[] {
  const cases: Case[] = [];
  for (const k of batimentsDe(etat, camp)) {
    const c = depuisCle(k);
    const terrain = terrainLogique(etat, cat, c);
    if (terrain !== null && ravitailleCetteUnite(cat, terrain, domaine)) cases.push(c);
  }
  return cases;
}

/** Vrai si l'unité porte le trait `ravitaillement`. */
export function estRavitailleur(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'ravitaillement');
}

/** Vrai si l'unité est un transport : le trait et des places. */
export function estTransport(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'transport') && t.transport !== null;
}

/** Vrai si l'unité est une pièce de soutien : elle transporte ou ravitaille, elle ne tire pas. */
export function estSoutien(type: UnitType): boolean {
  return porte(type, 'transport') || porte(type, 'ravitaillement');
}

/**
 * Cases d'où une unité à court peut se faire servir : ses bâtiments, et les
 * voisines des ravitailleurs alliés (un ravitailleur sert à distance 1).
 */
export function sourcesRavitaillement(etat: EtatPartie, cat: Catalogue, u: Unite): Case[] {
  const type = cat.unites[u.type];
  if (!type) return [];
  const cases = batimentsRavitaillant(etat, cat, u.camp, type.domaine);
  for (const a of etat.unites) {
    if (a.camp !== u.camp || a.id === u.id || a.dansTransport || !estRavitailleur(cat, a)) continue;
    for (const v of voisines(a)) {
      if (v.x >= 0 && v.y >= 0 && v.x < etat.largeur && v.y < etat.hauteur) cases.push(v);
    }
  }
  return cases;
}

/** Vrai si `u` peut monter dans `transport` : mêmes couleurs, type accepté, une place, pas un transport. */
export function peutEmbarquer(cat: Catalogue, transport: Unite, u: Unite): boolean {
  if (transport.camp !== u.camp || transport.id === u.id || transport.dansTransport) return false;
  const tt = cat.unites[transport.type];
  const tu = cat.unites[u.type];
  if (!tt || !tu || !porte(tt, 'transport') || tt.transport === null) return false;
  if (porte(tu, 'transport')) return false;
  if (!tt.transport.accepte.includes(u.type)) return false;
  return transport.cargo.length < tt.transport.places;
}

/** Valeur en fonds de ce qu'un transport a à bord : un transport plein qui tombe perd tout. */
export function valeurEmbarquee(etat: EtatPartie, cat: Catalogue, transport: Unite): number {
  let total = 0;
  for (const id of transport.cargo) {
    const p = etat.unites.find((x) => x.id === id);
    if (p) total += cat.unites[p.type]?.cout ?? 0;
  }
  return total;
}

/** Tours nécessaires pour franchir `distance` pas à `mouvement` pas par tour. */
export function toursPour(distance: number, mouvement: number): number {
  if (distance <= 0) return 0;
  return Math.ceil(distance / Math.max(1, mouvement));
}
