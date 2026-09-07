/**
 * Les calculs communs aux stratégies : estimation de dégâts sans consommer le
 * flux de combat, carte de distance vers les objectifs, menace subie, et choix
 * d'achat. Tout est pur et déterministe.
 *
 * L'IA lit le climat **comme le joueur** (`doc/04-gameplay.md` §12.7) : la saison,
 * la phase, la météo du jour et deux journées de prévision, jamais plus.
 */

import type {
  Catalogue, EtatPartie, Unite,
} from '../engine/index';
// Import direct des modules du moteur : c'est la même API publique, sans le
// détour par le baril de réexports, qui se paie cher dans une boucle serrée.
import { degatsBase, produitesPar } from '../engine/catalogue';
import { brouillardActif } from '../engine/climat/index';
import { degatsArme } from '../engine/regles/combat';
import { terrainBrut, terrainLogique } from '../engine/hooks';
import { batimentsDe } from '../engine/regles/economie';
import { multiplicateur } from '../engine/regles/modificateurs';
import { pointsMouvement, tableCouts, uniteSur } from '../engine/regles/mouvement';
import { cleCase, depuisCle, manhattan, porte, pvAffiches } from '../engine/types';
import type { Case, CampId, CleUnite, UnitType } from '../schemas/index';
import { batimentsRavitaillant, estSoutien, peutTirerSur } from './logistique';

/**
 * Dégâts attendus d'une frappe, aléa neutre (A = 1) : sert au tri, pas au jeu.
 * La base est celle de l'arme que l'attaquant peut réellement servir
 * (`degatsArme`, §5.3) : pleine avec des munitions, réduite à sec hors cibles
 * secondaires, nulle s'il ne tire pas.
 */
export function degatsAttendus(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, depuis: Case,
): number {
  const base = degatsArme(cat, att, def.type);
  if (base <= 0) return 0;
  const terrain = terrainLogique(etat, cat, def);
  const etoiles = terrain ? (cat.terrains[terrain]?.defense ?? 0) : 0;
  const fTerrain = 1 - 0.05 * etoiles * (pvAffiches(def.pv) / 10);
  const mAtt = multiplicateur(etat, cat, att, 'attaque');
  const mDef = multiplicateur(etat, cat, def, 'defense');
  void depuis;
  return Math.min(def.pv, Math.max(1, Math.round(base * (pvAffiches(att.pv) / 10) * mAtt * fTerrain / mDef)));
}

/** Valeur en fonds d'une unité, au prorata de ses PV. */
export function valeur(cat: Catalogue, u: Unite): number {
  const t = cat.unites[u.type];
  return t ? t.cout * (pvAffiches(u.pv) / 10) : 0;
}

/**
 * Carte de distance en pas vers un ensemble de cases, pour le type de mouvement
 * d'une unité : un objectif inatteignable reste à l'infini, donc l'IA ne promet
 * jamais un chemin qui n'existe pas (§12.7).
 */
export function distances(
  etat: EtatPartie, cat: Catalogue, u: Unite, cibles: Case[], cleMemo?: string,
): Int32Array {
  const memo = cleMemo === undefined ? undefined : memoire(etat);
  if (memo) {
    const connue = memo.get(`dist|${cleMemo}`) as Int32Array | undefined;
    if (connue) return connue;
  }
  const largeur = etat.largeur;
  const total = largeur * etat.hauteur;
  const table = tableCouts(etat, cat, u);
  const dist = new Int32Array(total).fill(-1);
  const file: number[] = [];
  for (const c of cibles) {
    if (c.x < 0 || c.y < 0 || c.x >= largeur || c.y >= etat.hauteur) continue;
    const i = c.y * largeur + c.x;
    if (dist[i] === -1) {
      dist[i] = 0;
      file.push(i);
    }
  }
  const hauteur = etat.hauteur;
  for (let tete = 0; tete < file.length; tete += 1) {
    const i = file[tete]!;
    const x = i % largeur;
    const y = (i - x) / largeur;
    const suivant = (dist[i] ?? 0) + 1;
    if (y > 0) pousserVoisin(i - largeur, suivant);
    if (x > 0) pousserVoisin(i - 1, suivant);
    if (x < largeur - 1) pousserVoisin(i + 1, suivant);
    if (y < hauteur - 1) pousserVoisin(i + largeur, suivant);
  }

  function pousserVoisin(j: number, valeur: number): void {
    if (dist[j] !== -1) return;
    const pas = table[j];
    if (pas === null || pas === undefined) return;
    dist[j] = valeur;
    file.push(j);
  }

  if (memo && cleMemo !== undefined) memo.set(`dist|${cleMemo}`, dist);
  return dist;
}

/** Mémoire de décision, attachée à un état : elle meurt avec lui. */
const MEMOIRE = new WeakMap<EtatPartie, Map<string, unknown>>();

/** Table de mémoire d'un état, créée à la demande. */
export function memoire(etat: EtatPartie): Map<string, unknown> {
  let m = MEMOIRE.get(etat);
  if (!m) {
    m = new Map<string, unknown>();
    MEMOIRE.set(etat, m);
  }
  return m;
}

/** Cases capturables que le camp ne possède pas encore. */
export function objectifsCapture(etat: EtatPartie, cat: Catalogue, camp: CampId): Case[] {
  const cases: Case[] = [];
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < etat.largeur; x += 1) {
      const terrain = terrainBrut(etat, cat, { x, y });
      if (terrain === null || !cat.terrains[terrain]?.capturable) continue;
      if (etat.proprietaires[cleCase({ x, y })] === camp) continue;
      cases.push({ x, y });
    }
  }
  return cases;
}

/** Cases des unités adverses : l'objectif des unités qui ne capturent pas. */
export function objectifsCombat(etat: EtatPartie, camp: CampId): Case[] {
  return etat.unites
    .filter((u) => u.camp !== camp && !u.dansTransport)
    .map((u) => ({ x: u.x, y: u.y }));
}

/**
 * Objectifs d'une unité : ce vers quoi elle marche. Les capteurs vont aux
 * bâtiments à prendre, le génie à ce qui est désaffecté, les autres aux unités
 * adverses et aux bâtiments. `cle` identifie l'ensemble pour la mémoire.
 */
export function objectifsDe(
  etat: EtatPartie, cat: Catalogue, u: Unite,
): { cibles: Case[]; cle: string } {
  const type = cat.unites[u.type];
  if (capteur(cat, u)) return { cibles: objectifsCapture(etat, cat, u.camp), cle: 'c' };
  if (type && porte(type, 'genie') && etat.desaffectes.length > 0) {
    return { cibles: etat.desaffectes.map(depuisCle), cle: 'g' };
  }
  return {
    cibles: [...objectifsCombat(etat, u.camp), ...objectifsCapture(etat, cat, u.camp)],
    cle: 'x',
  };
}

/**
 * Menace attendue sur une case, en fonds risqués. Un adversaire à sec menace
 * avec ce qui lui reste (§5.3) : pleinement les cibles de son arme secondaire,
 * à dégâts réduits les autres — une infanterie à côté d'un char sans munitions
 * reste menacée, un char à côté du même char l'est bien moins.
 */
export function menaceSur(
  etat: EtatPartie, cat: Catalogue, u: Unite, c: Case,
): number {
  const fictive: Unite = { ...u, x: c.x, y: c.y };
  let total = 0;
  for (const a of etat.unites) {
    if (a.camp === u.camp || a.dansTransport) continue;
    const ta = cat.unites[a.type];
    if (!ta) continue;
    if (!peutTirerSur(cat, a, u.type)) continue;
    const allonge = pointsMouvement(etat, cat, a) + ta.portee[1];
    const d = manhattan(a, c);
    if (d > allonge) continue;
    const degats = degatsAttendus(etat, cat, a, fictive, { x: a.x, y: a.y });
    if (degats <= 0) continue;
    const proximite = d <= ta.portee[1] ? 1 : 0.6;
    total += (degats / 100) * (cat.unites[u.type]?.cout ?? 0) * proximite;
  }
  return total;
}

/** Vrai si cette unité peut capturer (trait `capture`). */
export function capteur(cat: Catalogue, u: Unite): boolean {
  const t = cat.unites[u.type];
  return t !== undefined && porte(t, 'capture') && t.capture;
}

/** Nombre d'unités capables de capturer dans un camp. */
export function compterCapteurs(etat: EtatPartie, cat: Catalogue, camp: CampId): number {
  return etat.unites.filter((u) => u.camp === camp && capteur(cat, u)).length;
}

/** Répartition des unités adverses par clé : sert à choisir un achat. */
export function menaceParType(etat: EtatPartie, camp: CampId): Record<CleUnite, number> {
  const compte: Record<CleUnite, number> = {};
  for (const u of etat.unites) {
    if (u.camp === camp || u.dansTransport) continue;
    compte[u.type] = (compte[u.type] ?? 0) + 1;
  }
  return compte;
}

/** Bâtiments producteurs libres d'un camp, ordre déterministe. */
export function usinesLibres(etat: EtatPartie, cat: Catalogue, camp: CampId): Case[] {
  return batimentsDe(etat, camp)
    .map((k) => {
      const [x, y] = k.split(',');
      return { x: Number(x), y: Number(y) };
    })
    .filter((c) => {
      const terrain = terrainLogique(etat, cat, c);
      if (terrain === null || produitesPar(cat, terrain).length === 0) return false;
      return uniteSur(etat, c) === undefined;
    });
}

/** Répartition des unités d'un camp par clé : sert à diversifier les achats. */
export function armeeParType(etat: EtatPartie, camp: CampId): Record<CleUnite, number> {
  const compte: Record<CleUnite, number> = {};
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    compte[u.type] = (compte[u.type] ?? 0) + 1;
  }
  return compte;
}

/** Vrai si ce type inflige des dégâts à quelqu'un : une unité armée. */
export function estArmee(cat: Catalogue, cle: CleUnite): boolean {
  return cat.cles.some((autre) => degatsBase(cat, cle, autre) > 0);
}

/** Coût de l'unité armée la moins chère du catalogue : ce qu'il faut garder pour recruter demain. */
function coutArmeeMinimal(cat: Catalogue): number {
  let minimal = Number.POSITIVE_INFINITY;
  for (const cle of cat.cles) {
    const t = cat.unites[cle];
    if (t && t.statut !== 'retiree' && estArmee(cat, cle)) minimal = Math.min(minimal, t.cout);
  }
  return Number.isFinite(minimal) ? minimal : 0;
}

/** Une pièce de soutien par tranche de tant d'unités armées : au-delà, le suivant ne vaut rien. */
export const ARMEES_PAR_SOUTIEN = 6;

/**
 * Score plein d'une pièce de soutien, à comparer aux 0,1 à 0,4 d'une unité
 * armée : sous la plupart d'entre elles, pour qu'elle ne s'achète que quand
 * l'armée est déjà là et que la diversité a usé les autres choix.
 */
export const VALEUR_SOUTIEN = 0.12;

/** Au-delà de cette distance, un adversaire n'impose pas de recruter une unité armée demain. */
const RAYON_COMBAT_IMMINENT = 8;

/**
 * Vrai si un capteur ami accepté par ce transport est à plus de deux tours de
 * son objectif : un transport neuf l'y mènerait plus vite que ses jambes. C'est
 * le cas rare où un transport s'achète sans armée derrière lui.
 */
function capteurLoin(etat: EtatPartie, cat: Catalogue, t: UnitType, camp: CampId): boolean {
  if (!porte(t, 'transport') || t.transport === null) return false;
  for (const a of etat.unites) {
    if (a.camp !== camp || a.dansTransport || !t.transport.accepte.includes(a.type) || !capteur(cat, a)) continue;
    const obj = objectifsDe(etat, cat, a);
    const dist = distances(etat, cat, a, obj.cibles, `${a.camp}|${a.type}|${obj.cle}`);
    const d = dist[a.y * etat.largeur + a.x] ?? -1;
    if (d > 2 * pointsMouvement(etat, cat, a)) return true;
  }
  return false;
}

/** Vrai si une unité aérienne amie est à plus d'un tour du bâtiment qui la ravitaille. */
function aerienneIsolee(etat: EtatPartie, cat: Catalogue, camp: CampId): boolean {
  for (const a of etat.unites) {
    const ta = cat.unites[a.type];
    if (a.camp !== camp || a.dansTransport || !ta || ta.domaine !== 'air' || ta.carburant === null) continue;
    const bases = batimentsRavitaillant(etat, cat, camp, ta.domaine);
    const dist = distances(etat, cat, a, bases, `${a.camp}|${a.type}|retour`);
    const d = dist[a.y * etat.largeur + a.x] ?? -1;
    if (d < 0 || d > pointsMouvement(etat, cat, a)) return true;
  }
  return false;
}

/** Vrai si un adversaire est assez près d'une de nos unités pour qu'il faille recruter du feu demain. */
function combatImminent(etat: EtatPartie, camp: CampId): boolean {
  return etat.unites.some((a) => a.camp !== camp && !a.dansTransport
    && etat.unites.some((m) => m.camp === camp && !m.dansTransport && manhattan(a, m) <= RAYON_COMBAT_IMMINENT));
}

/**
 * Valeur d'une unité qui ne tire pas (`04-gameplay.md` §10 bis, §10 ter) : le
 * soutien — transport, ravitailleur — vaut par les unités qu'il sert, l'œil —
 * drone, brouilleur — par le brouillard qu'il perce ou impose. Toujours modérée :
 * une armée de transports ne prend rien. Avec une armée (trois unités armées),
 * un soutien par tranche de `ARMEES_PAR_SOUTIEN`. Sans armée, c'est **possible
 * mais rare** : un capteur à plus de deux tours de son objectif, ou une unité
 * aérienne loin de tout ravitaillement, justifient un premier transport à demi-
 * valeur. On n'achète jamais ce qui empêche de recruter une unité armée au tour
 * suivant — sauf si le transport est le seul besoin réel, c'est-à-dire qu'aucun
 * adversaire n'est à `RAYON_COMBAT_IMMINENT` d'une de nos unités.
 */
export function valeurSoutien(
  etat: EtatPartie, cat: Catalogue, cle: CleUnite, camp: CampId,
): number {
  const t = cat.unites[cle];
  if (!t) return 0;
  const soutien = estSoutien(t);
  const oeil = porte(t, 'drone') || porte(t, 'brouilleur');
  if (!soutien && !oeil) return 0;
  let armees = 0;
  let soutiens = 0;
  let dependantes = 0;
  let passagers = 0;
  let yeux = 0;
  let brouilleurs = 0;
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    const tu = cat.unites[u.type];
    if (!tu) continue;
    if (estSoutien(tu)) soutiens += 1;
    else if (porte(tu, 'drone')) yeux += 1;
    else if (porte(tu, 'brouilleur')) brouilleurs += 1;
    else if (estArmee(cat, u.type)) {
      armees += 1;
      if (tu.munitions !== null || tu.carburant !== null) dependantes += 1;
      if (t.transport && t.transport.accepte.includes(u.type)) passagers += 1;
    }
  }
  // Sans armée, seul un besoin de transport réel justifie une pièce qui ne tire pas.
  const sansArmee = armees < 3;
  const besoinReel = soutien && soutiens === 0
    && (capteurLoin(etat, cat, t, camp) || (porte(t, 'ravitaillement') && aerienneIsolee(etat, cat, camp)));
  if (sansArmee && !besoinReel) return 0;
  // Jamais si l'on ne peut plus recruter une unité armée au tour suivant — sauf
  // si le transport est le seul besoin réel, personne n'étant à portée de combat.
  const caisse = etat.camps.find((c) => c.id === camp);
  const revenus = batimentsDe(etat, camp).length * etat.reglages.revenusParBatiment;
  const bloqueArmee = caisse !== undefined && caisse.fonds - t.cout + revenus < coutArmeeMinimal(cat);
  if (bloqueArmee && !(besoinReel && !combatImminent(etat, camp))) return 0;
  if (soutien) {
    if (sansArmee) return VALEUR_SOUTIEN / 2;
    if (soutiens * ARMEES_PAR_SOUTIEN >= armees) return 0;
    const besoin = Math.min(1, (dependantes + passagers / 2) / ARMEES_PAR_SOUTIEN);
    return (VALEUR_SOUTIEN * besoin) / (1 + 2 * soutiens);
  }
  if (porte(t, 'drone')) {
    if (!brouillardActif(etat)) return 0;
    return 0.12 / (1 + 3 * yeux);
  }
  const dronesAdverses = etat.unites.filter((u) => {
    const tu = cat.unites[u.type];
    return u.camp !== camp && tu !== undefined && porte(tu, 'drone');
  }).length;
  return dronesAdverses > 0 && brouilleurs === 0 ? 0.12 : 0;
}

/**
 * Score d'achat d'un type d'unité : ce qu'il inflige au mix adverse, multiplié
 * par ce qu'il encaisse de ce même mix, rapporté au millier de fonds — puis
 * corrigé par la météo annoncée (§12.7) et par ce que le camp possède déjà.
 * C'est ce dernier terme qui empêche une armée d'un seul modèle. Une unité qui
 * ne tire pas vaut par `valeurSoutien`, si l'on sait pour quel camp on achète.
 */
export function scoreAchat(
  etat: EtatPartie, cat: Catalogue, cle: CleUnite,
  mix: Record<CleUnite, number>, mienne: Record<CleUnite, number>,
  manqueCapteurs: boolean, camp?: CampId,
): number {
  const t = cat.unites[cle];
  if (!t || t.statut === 'retiree') return -1;
  if (!estArmee(cat, cle)) return camp === undefined ? 0 : valeurSoutien(etat, cat, cle, camp);
  const adverses = Object.entries(mix);
  let offensif = 0;
  let subi = 0;
  let poids = 0;
  if (adverses.length > 0) {
    for (const [adverse, n] of adverses) {
      offensif += degatsBase(cat, cle, adverse) * n;
      subi += degatsBase(cat, adverse, cle) * n;
      poids += n;
    }
  } else {
    for (const autre of cat.cles) {
      offensif += degatsBase(cat, cle, autre);
      subi += degatsBase(cat, autre, cle);
      poids += 1;
    }
  }
  offensif /= Math.max(1, poids);
  subi /= Math.max(1, poids);
  const survie = 100 / Math.max(20, subi);
  let score = (offensif * survie) / 100 / (Math.max(100, t.cout) / 1000);
  // Diversité : chaque exemplaire déjà en jeu rend le suivant moins intéressant.
  score /= 1 + (mienne[cle] ?? 0) / 2;
  if (manqueCapteurs && porte(t, 'capture')) score *= 3;
  const annonces = [etat.climat.meteo, ...etat.climat.previsions];
  if (t.domaine === 'air' && annonces.includes('tempete')) score *= 0.3;
  if (annonces.includes('neige') && (t.typeMouvement === 'roues' || t.typeMouvement === 'bottes')) {
    score *= 0.7;
  }
  if (annonces.includes('canicule') && t.domaine === 'terre' && t.cout >= 7000) score *= 0.8;
  return score;
}
