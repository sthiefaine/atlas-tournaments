/**
 * Déplacement prudent sous brouillard (7 septembre 2026).
 *
 * Le moteur laisse un chemin **traverser** un allié, et sous brouillard il
 * arrête net une unité sur la case en cours dès qu'une unité adverse cachée
 * se révèle à côté du trajet (`executerOrdre`). Si cette case est celle d'un
 * allié, l'ordre est refusé pour `case_occupee` — et un refus ferme le tour de
 * l'IA. Une unité de l'IA ne connaît pas les unités cachées, par construction :
 * elle ne peut donc éviter ce refus qu'en ne traversant jamais un allié tant
 * que le brouillard est actif. Hors brouillard, la portée du moteur suffit.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { brouillardActif } from '../engine/climat/index';
import { dansCarte } from '../engine/hooks';
import {
  adversesVisibles, pointsMouvement, portee, tableCouts, voisines, type Portee,
} from '../engine/regles/mouvement';
import { porte } from '../engine/types';

/**
 * Portée de déplacement de l'IA : celle du moteur, et sous brouillard son
 * intersection avec les cases atteignables **sans traverser un allié**. La
 * Dijkstra reprend les règles du moteur — zone de contrôle des adversaires
 * visibles, plafond de carburant, seaux triés — et ne garde que ce que le
 * moteur atteint aussi : un désaccord de règle ne peut qu'enlever une case,
 * jamais en promettre une.
 */
export function porteePrudente(etat: EtatPartie, cat: Catalogue, u: Unite): Portee {
  const p = portee(etat, cat, u);
  if (!brouillardActif(etat)) return p;
  const type = cat.unites[u.type];
  if (!type) return p;
  const largeur = etat.largeur;
  const hauteur = etat.hauteur;
  const total = largeur * hauteur;
  const couts = new Int32Array(total).fill(-1);
  const precedents = new Int32Array(total).fill(-1);
  const max = pointsMouvement(etat, cat, u);
  const carburantMax = u.carburant === null || type.carburant === null
    ? Number.POSITIVE_INFINITY
    : Math.floor(u.carburant / Math.max(1, type.carburant.parCase));
  const plafond = Math.min(max, carburantMax);
  const table = tableCouts(etat, cat, u);
  const vol = porte(type, 'vol');
  const bloquee = new Uint8Array(total);
  const zdc = new Uint8Array(total);
  for (const a of adversesVisibles(etat, cat, u.camp)) {
    bloquee[a.y * largeur + a.x] = 1;
    if (vol) continue;
    for (const v of voisines(a)) if (dansCarte(etat, v)) zdc[v.y * largeur + v.x] = 1;
  }
  for (const a of etat.unites) {
    if (a.camp === u.camp && a.id !== u.id && !a.dansTransport) bloquee[a.y * largeur + a.x] = 1;
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

  // Ce que le moteur n'atteint pas, on ne l'atteint pas non plus.
  for (let i = 0; i < total; i += 1) {
    if ((p.couts[i] ?? -1) < 0) couts[i] = -1;
  }
  return { largeur, hauteur, depart: { x: u.x, y: u.y }, couts, precedents };
}
