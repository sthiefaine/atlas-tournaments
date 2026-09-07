/**
 * Logistique de l'IA : munitions et arme secondaire, carburant, ravitaillement,
 * transport (`doc/04-gameplay.md` §2 phases 3 et 4, §5.3, §13.2). Tout est pur
 * et déterministe, et rien ici ne nomme une unité : ce sont les traits,
 * `munitions`, `carburant`, `armeSecondaire`, `transport` et les colonnes de
 * dégâts du catalogue qui parlent, comme dans le moteur.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { degatsBase } from '../engine/catalogue';
import { dansCarte, terrainLogique } from '../engine/hooks';
import { degatsArme } from '../engine/regles/combat';
import { batimentsDe, consommationParTour, ravitailleCetteUnite } from '../engine/regles/economie';
import { pointsMouvement, tableCouts, voisines } from '../engine/regles/mouvement';
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

/**
 * Vrai si le carburant ne couvre plus deux tours pleins de déplacement — la
 * consommation par tour étant celle de l'unité telle qu'elle est, furtivité
 * comprise (`consommationParTour`, catalogue 6).
 */
export function carburantFaible(etat: EtatPartie, cat: Catalogue, type: UnitType, u: Unite): boolean {
  if (type.carburant === null || u.carburant === null) return false;
  const mouvement = pointsMouvement(etat, cat, u);
  return u.carburant <= 2 * (mouvement * type.carburant.parCase + consommationParTour(type, u));
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
 * elle est ravitaillée avant de consommer (phase 3 avant phase 4). `parTour`
 * est la consommation réelle de l'unité : celle du catalogue par défaut, plus
 * le surcoût de la furtivité quand l'appelant la connaît (`consommationParTour`).
 */
export function autonomieSecurite(
  type: UnitType, carburant: number, distanceRetour: number, mouvement: number, reserve: number,
  parTour: number = type.carburant?.parTour ?? 0,
): number {
  if (type.carburant === null) return Number.POSITIVE_INFINITY;
  if (distanceRetour <= 0) return carburant;
  const { parCase } = type.carburant;
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

/**
 * Transports alliés qui **ravitaillent leur cale** (`transport.ravitaille`,
 * catalogue 6) et acceptent cette unité : un porte-avions est un aéroport
 * flottant pour ce qu'il embarque, un camion de ravitaillement une station pour
 * l'infanterie mécanisée. L'unité elle-même et ce qui est déjà à bord sont exclus.
 */
export function porteursRavitaillant(etat: EtatPartie, cat: Catalogue, u: Unite): Unite[] {
  const sortie: Unite[] = [];
  for (const a of etat.unites) {
    if (a.camp !== u.camp || a.id === u.id || a.dansTransport) continue;
    const ta = cat.unites[a.type];
    if (!ta || !porte(ta, 'transport') || ta.transport === null || ta.transport.ravitaille !== true) continue;
    if (!ta.transport.accepte.includes(u.type)) continue;
    sortie.push(a);
  }
  return sortie;
}

/**
 * Où une unité aérienne va se poser : ses bâtiments qui la ravitaillent, et les
 * voisines d'un porteur allié qui fait le plein en cale — embarquer y vaut un
 * atterrissage quand aucun aéroport n'est à portée.
 */
export function casesRetour(etat: EtatPartie, cat: Catalogue, u: Unite): Case[] {
  const type = cat.unites[u.type];
  if (!type) return [];
  const cases = batimentsRavitaillant(etat, cat, u.camp, type.domaine);
  for (const p of porteursRavitaillant(etat, cat, u)) {
    for (const v of voisines(p)) if (dansCarte(etat, v)) cases.push(v);
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
  // Un porteur qui fait le plein en cale sert aussi : il faut y monter, mais on y est servi.
  for (const p of porteursRavitaillant(etat, cat, u)) {
    for (const v of voisines(p)) if (dansCarte(etat, v)) cases.push(v);
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

/**
 * Cases de dépose d'un transport pour un passager : celles où le transport peut
 * se tenir et dont une voisine, franchissable par le passager, est à un tour de
 * marche au plus de son objectif (`distPassager`, en pas depuis l'objectif).
 * C'est ce qui donne un sens à une coque : une barge ne va jamais **sur** la
 * ville, elle accoste à côté et le passager y agit au tour suivant. Sur terre,
 * la règle est la même, elle ne fait qu'élargir la voisine immédiate à un tour.
 */
export function casesDepose(
  etat: EtatPartie, cat: Catalogue, transport: Unite, passager: Unite, distPassager: Int32Array,
): Case[] {
  const largeur = etat.largeur;
  const rayon = pointsMouvement(etat, cat, passager);
  const tableT = tableCouts(etat, cat, transport);
  const tableP = tableCouts(etat, cat, passager);
  const sortie: Case[] = [];
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = y * largeur + x;
      if (tableT[i] === null || tableT[i] === undefined) continue;
      let utile = false;
      for (const v of voisines({ x, y })) {
        if (!dansCarte(etat, v)) continue;
        const iv = v.y * largeur + v.x;
        const d = distPassager[iv] ?? -1;
        if (d < 0 || d > rayon) continue;
        if (tableP[iv] === null || tableP[iv] === undefined) continue;
        utile = true;
        break;
      }
      if (utile) sortie.push({ x, y });
    }
  }
  return sortie;
}

/**
 * Base de dégâts à partir de laquelle une unité **couvre** une menace au lieu
 * de l'égratigner : en dessous, l'infanterie qui tire sur un bombardier à 8 ne
 * compte pour rien dans la défense anti-aérienne.
 */
export const COUVERTURE_MIN = 50;

/** Mémoire de `frappeLAir` par catalogue : la table ne change pas en cours de partie. */
const ANTI_AIR = new WeakMap<Catalogue, Map<CleUnite, boolean>>();

/** Vrai si ce type couvre au moins une unité qui vole : de l'anti-air, au sens de la table. */
export function frappeLAir(cat: Catalogue, cle: CleUnite): boolean {
  let memo = ANTI_AIR.get(cat);
  if (!memo) {
    memo = new Map<CleUnite, boolean>();
    ANTI_AIR.set(cat, memo);
  }
  const connu = memo.get(cle);
  if (connu !== undefined) return connu;
  const resultat = cat.cles.some((autre) => {
    const t = cat.unites[autre];
    return t !== undefined && porte(t, 'vol') && degatsBase(cat, cle, autre) >= COUVERTURE_MIN;
  });
  memo.set(cle, resultat);
  return resultat;
}
