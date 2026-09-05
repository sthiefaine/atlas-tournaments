/**
 * Vision et brouillard de guerre (`doc/04-gameplay.md` §10, §12.3, §12.4).
 *
 * Le brouillard cache les unités, jamais le terrain. L'état filtré est calculé
 * ici, dans le moteur, jamais dans le rendu : un client ne reçoit pas ce qu'il
 * ne voit pas (`02-architecture.md` §8).
 */

import type { Case, CampId } from '../../schemas/index';
import { brouillardActif, foretCache } from '../climat/index';
import { dansCarte, terrainLogique } from '../hooks';
import type { Catalogue, EtatPartie, Unite } from '../types';
import { cleCase, manhattan, porte } from '../types';
import { additif } from './modificateurs';

/** Portée de vision d'une unité, climat compris. */
export function visionUnite(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const type = cat.unites[u.type];
  if (!type) return 0;
  const furtif = porte(type, 'furtif_nuit');
  let v = type.vision + additif(etat, cat, u, 'vision');
  if (etat.climat.meteo === 'brouillard') v = 1;
  else {
    if (etat.climat.phase === 'nuit' && !furtif) v = Math.max(1, v - 2);
    if (etat.climat.meteo === 'pluie') v = Math.max(1, v - 1);
  }
  const terrain = terrainLogique(etat, cat, u);
  if (terrain === 'montagne') {
    v += 2;
    if (porte(type, 'vision_etendue')) v += 1;
  }
  return Math.max(1, v);
}

/** Vrai si une unité posée là n'est repérée qu'au contact (distance 1). */
export function cacheeAuContact(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  if (type && porte(type, 'furtif_nuit') && etat.climat.phase === 'nuit') return true;
  const terrain = terrainLogique(etat, cat, u);
  if (terrain === null) return false;
  const t = cat.terrains[terrain];
  if (!t || !t.cacheEnBrouillard) return false;
  if (terrain === 'foret' && !foretCache(etat)) return false;
  return true;
}

/**
 * Mémoire des vues. Un état de travail est **modifié** pendant une action (les
 * unités bougent, un bâtiment change de main) : la mémoire est donc indexée par
 * une signature numérique de tout ce dont la vision dépend, et s'invalide d'elle-même.
 */
const VUES = new WeakMap<EtatPartie, { signature: number; table: Map<string, unknown> }>();

/** Signature de ce dont la vision dépend : positions, propriétaires, climat. */
export function signatureVue(etat: EtatPartie): number {
  let h = (etat.unites.length * 7919 + etat.journee * 131 + etat.modificateurs.length * 17) | 0;
  for (const u of etat.unites) {
    h = (h * 31 + u.x * 97 + u.y * 7 + u.camp + (u.dansTransport === null ? 0 : 1)) | 0;
  }
  // Somme commutative : l'ordre des clés d'un objet n'entre jamais dans un calcul.
  let bat = 0;
  for (const k of Object.keys(etat.proprietaires)) {
    bat = (bat + k.length * 13 + (k.charCodeAt(0) + k.charCodeAt(k.length - 1)) * ((etat.proprietaires[k] ?? 0) + 1)) | 0;
  }
  const climat = etat.climat.phase === 'nuit' ? 1 : 0;
  const meteo = etat.climat.meteo.length;
  return (h * 31 + bat * 7 + climat * 3 + meteo) | 0;
}

function memoireVue(etat: EtatPartie): Map<string, unknown> {
  const signature = signatureVue(etat);
  const connue = VUES.get(etat);
  if (connue && connue.signature === signature) return connue.table;
  const table = new Map<string, unknown>();
  VUES.set(etat, { signature, table });
  return table;
}

/** Cases éclairées par un camp : clés de case. */
export function casesVisibles(etat: EtatPartie, cat: Catalogue, camp: CampId): Set<string> {
  const memo = memoireVue(etat);
  const connue = memo.get(`cases|${camp}`) as Set<string> | undefined;
  if (connue) return connue;
  const vues = new Set<string>();
  const ajouter = (centre: Case, portee: number): void => {
    for (let dy = -portee; dy <= portee; dy += 1) {
      const reste = portee - Math.abs(dy);
      for (let dx = -reste; dx <= reste; dx += 1) {
        const c = { x: centre.x + dx, y: centre.y + dy };
        if (dansCarte(etat, c)) vues.add(cleCase(c));
      }
    }
  };
  for (const u of etat.unites) {
    if (u.camp !== camp || u.dansTransport) continue;
    ajouter(u, visionUnite(etat, cat, u));
  }
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    if (proprio !== camp) continue;
    const [x, y] = k.split(',');
    ajouter({ x: Number(x), y: Number(y) }, 2);
  }
  memo.set(`cases|${camp}`, vues);
  return vues;
}

/** Unités qu'un camp voit réellement, cachettes comprises. */
export function unitesVues(etat: EtatPartie, cat: Catalogue, camp: CampId): Unite[] {
  const memo = memoireVue(etat);
  const connues = memo.get(`unites|${camp}`) as Unite[] | undefined;
  if (connues) return connues;
  const calculees = calculerUnitesVues(etat, cat, camp);
  memo.set(`unites|${camp}`, calculees);
  return calculees;
}

function calculerUnitesVues(etat: EtatPartie, cat: Catalogue, camp: CampId): Unite[] {
  if (!brouillardActif(etat)) return etat.unites.filter((u) => !u.dansTransport);
  const vues = casesVisibles(etat, cat, camp);
  const miennes = etat.unites.filter((u) => u.camp === camp && !u.dansTransport);
  return etat.unites.filter((u) => {
    if (u.dansTransport) return false;
    if (u.camp === camp) return true;
    if (!vues.has(cleCase(u))) return false;
    if (!cacheeAuContact(etat, cat, u)) return true;
    return miennes.some((m) => manhattan(m, u) <= 1);
  });
}

/** Vrai si le camp voit cette case. */
export function voitCase(etat: EtatPartie, cat: Catalogue, camp: CampId, c: Case): boolean {
  if (!brouillardActif(etat)) return true;
  return casesVisibles(etat, cat, camp).has(cleCase(c));
}

/**
 * État filtré pour un camp : les unités invisibles n'y figurent pas du tout.
 * C'est une règle d'anti-triche, pas un confort de rendu.
 */
export function filtrerPourCamp(etat: EtatPartie, cat: Catalogue, camp: CampId): EtatPartie {
  const vues = unitesVues(etat, cat, camp);
  const gardees = new Set(vues.map((u) => u.id));
  return {
    ...etat,
    unites: etat.unites
      .filter((u) => gardees.has(u.id) || (u.dansTransport !== null && u.camp === camp))
      .map((u) => ({ ...u })),
    camps: etat.camps.map((c) => (c.id === camp ? { ...c } : { ...c, fonds: 0, jauge: c.jauge })),
    flux: {},
  };
}
