/**
 * Mouvement : coûts par type de mouvement et terrain, zone de contrôle, portée
 * de déplacement par Dijkstra (`doc/04-gameplay.md` §2 et §12.6).
 *
 * Un coût de case ne dépasse jamais 4 et ne descend jamais sous 1, quels que
 * soient les cumuls climat + mécanique (§12.6, règle 2).
 */

import type { Case, CampId, CleTerrain } from '../../schemas/index';
import { coutBase } from '../catalogue';
import { facteurMouvementClimat } from '../climat/index';
import { dansCarte, signatureTerrain, surcoutCase, terrainLogique } from '../hooks';
import type { Catalogue, EtatPartie, MotifRefus, Unite } from '../types';
import { manhattan, porte } from '../types';
import { additif } from './modificateurs';
import { unitesVues } from './vision';

/** Les quatre voisines d'une case, dans un ordre fixe. */
export function voisines(c: Case): Case[] {
  return [
    { x: c.x, y: c.y - 1 },
    { x: c.x - 1, y: c.y },
    { x: c.x + 1, y: c.y },
    { x: c.x, y: c.y + 1 },
  ];
}

/** Points de mouvement d'une unité ce tour, modificateurs et météo compris. */
export function pointsMouvement(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const type = cat.unites[u.type];
  if (!type) return 0;
  const brut = type.mouvement + additif(etat, cat, u, 'mouvement');
  const facteur = facteurMouvementClimat(etat, type.domaine);
  return Math.max(1, Math.floor(Math.max(1, brut) * facteur));
}

/** Coût d'entrée sur une case, ou `null` si elle est infranchissable. */
export function coutEntree(
  etat: EtatPartie, cat: Catalogue, u: Unite, c: Case,
): number | null {
  const type = cat.unites[u.type];
  if (!type || !dansCarte(etat, c)) return null;
  const terrain = terrainLogique(etat, cat, c);
  if (terrain === null) return null;
  const base = coutBase(cat, terrain, type.typeMouvement, type);
  if (base === null) return null;
  const total = base + surcoutCase(etat, cat, type.typeMouvement, terrain, type);
  return Math.min(4, Math.max(1, total));
}

/** Unité présente sur une case (hors unités embarquées). */
export function uniteSur(etat: EtatPartie, c: Case): Unite | undefined {
  return etat.unites.find((u) => !u.dansTransport && u.x === c.x && u.y === c.y);
}

/** Unité par identifiant. */
export function uniteParId(etat: EtatPartie, id: string): Unite | undefined {
  return etat.unites.find((u) => u.id === id);
}

/** Cases adverses connues du camp : elles bloquent le passage et posent la ZDC. */
export function adversesVisibles(etat: EtatPartie, cat: Catalogue, camp: CampId): Unite[] {
  return unitesVues(etat, cat, camp).filter((u) => u.camp !== camp);
}

/**
 * Résultat d'un calcul de portée. Les coûts sont indexés par `y * largeur + x`
 * (`-1` = hors de portée) : une portée se calcule des milliers de fois par
 * partie, et un tableau typé ne coûte ni clé de chaîne ni allocation.
 */
export interface Portee {
  largeur: number;
  hauteur: number;
  depart: Case;
  couts: Int32Array;
  precedents: Int32Array;
}

/** Coût pour atteindre une case, ou `null` si elle est hors de portée. */
export function coutVers(p: Portee, c: Case): number | null {
  if (c.x < 0 || c.y < 0 || c.x >= p.largeur || c.y >= p.hauteur) return null;
  const cout = p.couts[c.y * p.largeur + c.x] ?? -1;
  return cout < 0 ? null : cout;
}

/** Cases atteignables, dans l'ordre des indices : itération déterministe. */
export function casesAtteignables(p: Portee): Case[] {
  const sortie: Case[] = [];
  for (let i = 0; i < p.couts.length; i += 1) {
    if ((p.couts[i] ?? -1) < 0) continue;
    const x = i % p.largeur;
    sortie.push({ x, y: (i - x) / p.largeur });
  }
  return sortie;
}

/** Mémoire des tables de coûts, par état puis par signature de terrain. */
const TABLES = new WeakMap<
  EtatPartie, { journee: number; poses: number; tables: Map<string, (number | null)[]> }
>();
const TABLES_PARTAGEES = new Map<string, (number | null)[]>();

/**
 * Table des coûts d'entrée de toute la carte pour une unité : `null` là où c'est
 * infranchissable. Elle ne dépend que du **type** de l'unité et du terrain
 * logique, jamais des positions : deux parties au même terrain la partagent.
 */
export function tableCouts(etat: EtatPartie, cat: Catalogue, u: Unite): (number | null)[] {
  let memo = TABLES.get(etat);
  if (!memo || memo.journee !== etat.journee || memo.poses !== etat.terrainsPoses.length) {
    memo = { journee: etat.journee, poses: etat.terrainsPoses.length, tables: new Map() };
    TABLES.set(etat, memo);
  }
  const connue = memo.tables.get(u.type);
  if (connue) return connue;
  const signature = `${signatureTerrain(etat)}|${u.type}`;
  let table = TABLES_PARTAGEES.get(signature);
  if (!table) {
    table = new Array<number | null>(etat.largeur * etat.hauteur);
    for (let y = 0; y < etat.hauteur; y += 1) {
      for (let x = 0; x < etat.largeur; x += 1) {
        table[y * etat.largeur + x] = coutEntree(etat, cat, u, { x, y });
      }
    }
    if (TABLES_PARTAGEES.size > 512) TABLES_PARTAGEES.clear();
    TABLES_PARTAGEES.set(signature, table);
  }
  memo.tables.set(u.type, table);
  return table;
}

/**
 * Portée de déplacement, bornée par les points de mouvement **et** le carburant.
 * Une case adjacente à une unité adverse visible est atteignable mais terminale :
 * c'est la zone de contrôle (§2). Dijkstra à seaux, les coûts étant de petits
 * entiers bornés par 4.
 */
export function portee(etat: EtatPartie, cat: Catalogue, u: Unite): Portee {
  const largeur = etat.largeur;
  const hauteur = etat.hauteur;
  const total = largeur * hauteur;
  const couts = new Int32Array(total).fill(-1);
  const precedents = new Int32Array(total).fill(-1);
  const p: Portee = { largeur, hauteur, depart: { x: u.x, y: u.y }, couts, precedents };
  const type = cat.unites[u.type];
  if (!type) return p;
  const max = pointsMouvement(etat, cat, u);
  const carburantMax = u.carburant === null || type.carburant === null
    ? Number.POSITIVE_INFINITY
    : Math.floor(u.carburant / Math.max(1, type.carburant.parCase));
  const plafond = Math.min(max, carburantMax);
  const table = tableCouts(etat, cat, u);
  const adverses = adversesVisibles(etat, cat, u.camp);
  const vol = porte(type, 'vol');
  const bloquee = new Uint8Array(total);
  const zdc = new Uint8Array(total);
  for (const a of adverses) {
    bloquee[a.y * largeur + a.x] = 1;
    if (vol) continue;
    for (const v of voisines(a)) {
      if (v.x >= 0 && v.y >= 0 && v.x < largeur && v.y < hauteur) zdc[v.y * largeur + v.x] = 1;
    }
  }

  const seaux: number[][] = [];
  const pousser = (indice: number, cout: number): void => {
    (seaux[cout] ??= []).push(indice);
  };
  const depart = u.y * largeur + u.x;
  couts[depart] = 0;
  pousser(depart, 0);

  for (let cout = 0; cout <= plafond; cout += 1) {
    const seau = seaux[cout];
    if (!seau) continue;
    seau.sort((a, b) => a - b);
    for (const indice of seau) {
      if (couts[indice] !== cout) continue;
      if (indice !== depart && zdc[indice] === 1) continue;
      const x = indice % largeur;
      const y = (indice - x) / largeur;
      if (y > 0) relacher(indice, indice - largeur);
      if (x > 0) relacher(indice, indice - 1);
      if (x < largeur - 1) relacher(indice, indice + 1);
      if (y < hauteur - 1) relacher(indice, indice + largeur);
    }
  }

  function relacher(depuis: number, vers: number): void {
    if (bloquee[vers] === 1) return;
    const pas = table[vers];
    if (pas === null || pas === undefined) return;
    const total2 = (couts[depuis] ?? 0) + pas;
    if (total2 > plafond) return;
    const connu = couts[vers] ?? -1;
    if (connu >= 0 && connu <= total2) return;
    couts[vers] = total2;
    precedents[vers] = depuis;
    pousser(vers, total2);
  }

  return p;
}

/** Vrai si une unité amie occupe déjà cette case d'arrivée. */
export function arriveeLibre(etat: EtatPartie, c: Case, sauf: string): boolean {
  const occupant = uniteSur(etat, c);
  return occupant === undefined || occupant.id === sauf;
}

/** Reconstruit le chemin d'une portée jusqu'à une case, départ compris. */
export function cheminVers(p: Portee, depart: Case, arrivee: Case): Case[] | null {
  if (coutVers(p, arrivee) === null) return null;
  const indices: number[] = [];
  let i = arrivee.y * p.largeur + arrivee.x;
  const vu = new Set<number>();
  while (i >= 0 && !vu.has(i)) {
    vu.add(i);
    indices.push(i);
    if (i === depart.y * p.largeur + depart.x) break;
    i = p.precedents[i] ?? -1;
  }
  indices.reverse();
  const premier = indices[0];
  if (premier === undefined || premier !== depart.y * p.largeur + depart.x) return null;
  return indices.map((indice) => {
    const x = indice % p.largeur;
    return { x, y: (indice - x) / p.largeur };
  });
}

/** Verdict de vérification d'un chemin explicite. */
export type VerdictChemin =
  | { ok: true; cout: number; arrivee: Case }
  | { ok: false; motif: MotifRefus; detail?: string };

/**
 * Vérifie un chemin explicite : contiguïté, coût, cases libres, franchissabilité,
 * zone de contrôle. Un chemin invalide est un refus, jamais une correction.
 */
export function verifierChemin(
  etat: EtatPartie, cat: Catalogue, u: Unite, chemin: Case[],
): VerdictChemin {
  const type = cat.unites[u.type];
  if (!type) return { ok: false, motif: 'catalogue_inconnu' };
  const premier = chemin[0];
  if (!premier) return { ok: false, motif: 'chemin_invalide', detail: 'chemin vide' };
  if (premier.x !== u.x || premier.y !== u.y) {
    return { ok: false, motif: 'chemin_invalide', detail: "le chemin ne part pas de l'unité" };
  }
  const max = pointsMouvement(etat, cat, u);
  const largeur = etat.largeur;
  const table = tableCouts(etat, cat, u);
  const vol = porte(type, 'vol');
  const adverses = adversesVisibles(etat, cat, u.camp);
  const bloquee = new Uint8Array(largeur * etat.hauteur);
  const zdc = new Uint8Array(largeur * etat.hauteur);
  for (const a of adverses) {
    bloquee[a.y * largeur + a.x] = 1;
    if (vol) continue;
    for (const v of voisines(a)) {
      if (v.x >= 0 && v.y >= 0 && v.x < largeur && v.y < etat.hauteur) zdc[v.y * largeur + v.x] = 1;
    }
  }
  let cout = 0;
  for (let i = 1; i < chemin.length; i += 1) {
    const c = chemin[i]!;
    const p = chemin[i - 1]!;
    if (manhattan(c, p) !== 1) {
      return { ok: false, motif: 'chemin_invalide', detail: 'cases non contiguës' };
    }
    if (!dansCarte(etat, c)) return { ok: false, motif: 'chemin_invalide', detail: 'case hors carte' };
    const indice = c.y * largeur + c.x;
    if (bloquee[indice] === 1) return { ok: false, motif: 'case_occupee' };
    const pas = table[indice];
    if (pas === null || pas === undefined) return { ok: false, motif: 'terrain_infranchissable' };
    cout += pas;
    if (cout > max) return { ok: false, motif: 'chemin_trop_cher' };
    if (i < chemin.length - 1 && zdc[indice] === 1) {
      return { ok: false, motif: 'zone_de_controle' };
    }
  }
  if (type.carburant !== null && u.carburant !== null) {
    if (cout * type.carburant.parCase > u.carburant) {
      return { ok: false, motif: 'carburant_insuffisant' };
    }
  }
  const arrivee = chemin[chemin.length - 1]!;
  if (!arriveeLibre(etat, arrivee, u.id)) return { ok: false, motif: 'case_occupee' };
  return { ok: true, cout, arrivee };
}

/** Terrain logique sous une unité, pour la défense et la lisibilité. */
export function terrainSous(etat: EtatPartie, cat: Catalogue, u: Unite): CleTerrain | null {
  return terrainLogique(etat, cat, u);
}
