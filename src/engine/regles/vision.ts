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
import { cleCase, depuisCle, manhattan, porte } from '../types';
import { additif } from './modificateurs';

/**
 * Brouillage (`04-gameplay.md` §10 bis). Un drone est un œil qu'on peut
 * aveugler : à portée d'un brouilleur mobile adverse ou d'une station radar
 * adverse, il perd 90 % de sa vision. Les rayons sont en cases de Manhattan.
 * Seul le trait compte : un œil volant sans le trait `drone` (l'hélicoptère)
 * voit comme avant.
 */
export const RAYON_BROUILLEUR_MOBILE = 10;
export const RAYON_STATION_RADAR = 12;
/** Ce qu'il reste à un drone brouillé : un dixième, jamais moins d'une case. */
export const PART_VISION_BROUILLEE = 0.1;
/** Une station radar possédée voit à cinq cases, contre deux pour tout autre bâtiment. */
export const VISION_STATION_RADAR = 5;

/** Vrai si un drone adverse posé sur cette case serait brouillé par ce camp. */
export function brouilleParCamp(etat: EtatPartie, cat: Catalogue, camp: CampId, c: Case): boolean {
  for (const z of etat.unites) {
    if (z.camp !== camp || z.dansTransport) continue;
    const t = cat.unites[z.type];
    if (t && porte(t, 'brouilleur') && manhattan(z, c) <= RAYON_BROUILLEUR_MOBILE) return true;
  }
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    if (proprio !== camp) continue;
    const station = depuisCle(k);
    if (terrainLogique(etat, cat, station) === 'radar' && manhattan(station, c) <= RAYON_STATION_RADAR) return true;
  }
  return false;
}

/** Vrai si cette unité est un drone actuellement brouillé par un adversaire. */
export function estBrouillee(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  if (!type || !porte(type, 'drone')) return false;
  return etat.camps.some((c) => c.id !== u.camp && !c.elimine && brouilleParCamp(etat, cat, c.id, u));
}

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
  if (estBrouillee(etat, cat, u)) v = Math.round(v * PART_VISION_BROUILLEE);
  return Math.max(1, v);
}

/** Vrai si une unité posée là n'est repérée qu'au contact (distance 1). */
export function cacheeAuContact(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  // `plongee` (`04-gameplay.md` §13.2, catalogue 5) : une coque sous la surface
  // se cache d'elle-même, sans terrain et par tout temps. Qui peut la frapper
  // reste une affaire de données — sa colonne de dégâts —, jamais de règle.
  if (type && porte(type, 'plongee')) return true;
  // `furtif` (catalogue 6) : la furtivité demandée par l'ordre `furtivite` cache
  // l'unité au-delà du contact, par tout temps, jusqu'à l'ordre inverse.
  if (u.furtive === true) return true;
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

/** Signature de ce dont la vision dépend : positions, propriétaires, climat, furtivité. */
export function signatureVue(etat: EtatPartie): number {
  let h = (etat.unites.length * 7919 + etat.journee * 131 + etat.modificateurs.length * 17) | 0;
  for (const u of etat.unites) {
    // La furtivité (catalogue 6) bascule **sans** que l'unité bouge : sans ce
    // terme, la vue mémoïsée par `verifierChemin` avant la suite `furtivite`
    // survivrait à la bascule sur le même état de travail.
    h = (h * 31 + u.x * 97 + u.y * 7 + u.camp + (u.dansTransport === null ? 0 : 1) + (u.furtive === true ? 3 : 0)) | 0;
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
    const c = depuisCle(k);
    ajouter(c, terrainLogique(etat, cat, c) === 'radar' ? VISION_STATION_RADAR : 2);
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
