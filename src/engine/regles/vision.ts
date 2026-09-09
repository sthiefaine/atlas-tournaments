import { sontAllies } from '../equipes';
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
/** Une station radar possédée voit à cinq cases, contre une pour tout autre bâtiment. */
export const VISION_STATION_RADAR = 5;
/**
 * Vision d'un bâtiment possédé (7 septembre 2026 au soir) : une case, plus deux.
 * À deux, dix villes éclairaient la moitié d'une carte 12 × 10 sans qu'une
 * unité ait bougé ; à une, un bâtiment sent qu'on vient le prendre, et le
 * brouillard redevient un jeu d'éclaireurs. Tranché par deux personas.
 */
export const VISION_BATIMENT = 1;
/** La montagne : le mirador du fantassin, +3 — et rien pour ce qui vole au-dessus. */
export const BONUS_VISION_MONTAGNE = 3;
/** La forêt bouche la vue de qui s'y trouve : −1, plancher 1. */
export const MALUS_VISION_FORET = 1;
/** La nuit ôte deux cases de vue, sauf sur un bâtiment possédé : la ville est éclairée. */
export const MALUS_VISION_NUIT = 2;

/** Vrai si un drone adverse posé sur cette case serait brouillé par ce camp. */
export function brouilleParCamp(etat: EtatPartie, cat: Catalogue, camp: CampId, c: Case): boolean {
  for (const z of etat.unites) {
    if (z.camp !== camp || z.dansTransport) continue;
    const t = cat.unites[z.type];
    if (t && porte(t, 'brouilleur') && manhattan(z, c) <= RAYON_BROUILLEUR_MOBILE) return true;
  }
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    if (!sontAllies(etat, proprio, camp)) continue;
    const station = depuisCle(k);
    if (terrainLogique(etat, cat, station) === 'radar' && manhattan(station, c) <= RAYON_STATION_RADAR) return true;
  }
  return false;
}

/** Vrai si cette unité est un drone actuellement brouillé par un adversaire. */
export function estBrouillee(etat: EtatPartie, cat: Catalogue, u: Unite): boolean {
  const type = cat.unites[u.type];
  if (!type || !porte(type, 'drone')) return false;
  return etat.camps.some((c) => !sontAllies(etat, c.id, u.camp) && !c.elimine && brouilleParCamp(etat, cat, c.id, u));
}

/** Portée de vision d'une unité, climat compris. */
export function visionUnite(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const type = cat.unites[u.type];
  if (!type) return 0;
  const furtif = porte(type, 'furtif_nuit');
  const terrain = terrainLogique(etat, cat, u);
  const aPied = type.typeMouvement === 'pied' || type.typeMouvement === 'bottes';
  // Un bâtiment à soi est éclairé : la nuit n'y ôte rien (`04-gameplay.md` §12.3).
  const eclairee = terrain !== null && cat.terrains[terrain]?.capturable === true
    && etat.proprietaires[cleCase(u)] === u.camp;
  let v = type.vision + additif(etat, cat, u, 'vision');
  if (etat.climat.meteo === 'brouillard') v = 1;
  else {
    if (etat.climat.phase === 'nuit' && !furtif && !eclairee) v = Math.max(1, v - MALUS_VISION_NUIT);
    if (etat.climat.meteo === 'pluie') v = Math.max(1, v - 1);
  }
  // Le terrain (7 septembre 2026 au soir) : la montagne est le mirador du
  // fantassin — seul ce qui y a grimpé voit plus loin, un hélicoptère posé sur
  // un caillou ne gagne rien — ; la forêt cache et bouche la vue à la fois.
  if (terrain === 'montagne' && aPied) {
    v += BONUS_VISION_MONTAGNE;
    if (porte(type, 'vision_etendue')) v += 1;
  }
  if (terrain === 'foret') v = Math.max(1, v - MALUS_VISION_FORET);
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
  // Une cachette réservée (`cacheSeulement`, l'herbe haute) ne vaut que pour
  // les types de mouvement qu'elle nomme : un char dans l'herbe se voit.
  if (t.cacheSeulement && type && !t.cacheSeulement.includes(type.typeMouvement)) return false;
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
  // La montagne coupe la ligne de vue (7 septembre 2026, nuit) : ce qui est
  // derrière elle ne se voit pas — sauf pour qui est lui-même sur une montagne,
  // ou qui vole. La case de la montagne, elle, se voit : c'est ce qu'il y a
  // derrière qui est caché.
  const ajouter = (centre: Case, portee: number, parDessus: boolean): void => {
    for (let dy = -portee; dy <= portee; dy += 1) {
      const reste = portee - Math.abs(dy);
      for (let dx = -reste; dx <= reste; dx += 1) {
        const c = { x: centre.x + dx, y: centre.y + dy };
        if (!dansCarte(etat, c)) continue;
        if (!parDessus && ligneCoupee(etat, cat, centre, c)) continue;
        vues.add(cleCase(c));
      }
    }
  };
  for (const u of etat.unites) {
    if (!sontAllies(etat, u.camp, camp) || u.dansTransport) continue;
    const type = cat.unites[u.type];
    const parDessus = type?.domaine === 'air' || terrainLogique(etat, cat, u) === 'montagne';
    ajouter(u, visionUnite(etat, cat, u), parDessus);
  }
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    if (!sontAllies(etat, proprio, camp)) continue;
    const c = depuisCle(k);
    ajouter(c, terrainLogique(etat, cat, c) === 'radar' ? VISION_STATION_RADAR : VISION_BATIMENT, false);
  }
  memo.set(`cases|${camp}`, vues);
  return vues;
}

/**
 * Vrai si une montagne se dresse **entre** deux cases, sur la ligne qui les
 * joint (Bresenham, extrémités exclues). Deux cases voisines ne sont jamais
 * coupées ; une ligne en diagonale passe par une case sur deux, ce qui suffit à
 * un jeu de cases — on ne trace pas des rayons, on lit une carte.
 */
export function ligneCoupee(etat: EtatPartie, cat: Catalogue, de: Case, vers: Case): boolean {
  const dx = Math.abs(vers.x - de.x);
  const dy = Math.abs(vers.y - de.y);
  if (dx + dy <= 1) return false;
  const sx = de.x < vers.x ? 1 : -1;
  const sy = de.y < vers.y ? 1 : -1;
  let erreur = dx - dy;
  let x = de.x;
  let y = de.y;
  for (;;) {
    const e2 = 2 * erreur;
    if (e2 > -dy) { erreur -= dy; x += sx; }
    if (e2 < dx) { erreur += dx; y += sy; }
    if (x === vers.x && y === vers.y) return false;
    if (terrainLogique(etat, cat, { x, y }) === 'montagne') return true;
  }
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
  const miennes = etat.unites.filter((u) => sontAllies(etat, u.camp, camp) && !u.dansTransport);
  return etat.unites.filter((u) => {
    if (u.dansTransport) return false;
    if (sontAllies(etat, u.camp, camp)) return true;
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
      .filter((u) => gardees.has(u.id) || (u.dansTransport !== null && sontAllies(etat, u.camp, camp)))
      .map((u) => ({ ...u })),
    camps: etat.camps.map((c) => (c.id === camp ? { ...c } : { ...c, fonds: 0, jauge: c.jauge })),
    flux: {},
  };
}
