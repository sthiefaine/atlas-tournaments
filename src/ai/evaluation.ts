import { sontAllies } from '../engine/equipes';
/**
 * Les calculs communs aux stratégies : estimation de dégâts sans consommer le
 * flux de combat, carte de distance vers les objectifs, menace subie, et choix
 * d'achat. Tout est pur et déterministe.
 *
 * L'IA lit le climat **comme le joueur** (`doc/04-gameplay.md` §12.7) : la saison,
 * la phase, la météo du jour et deux journées de prévision, jamais plus. Depuis
 * le 7 septembre 2026 elle lit aussi les adversaires **comme le joueur** : sous
 * brouillard, seulement ceux que le moteur lui montre (`adversairesConnus`).
 */

import type {
  Catalogue, EtatPartie, Unite,
} from '../engine/index';
// Import direct des modules du moteur : c'est la même API publique, sans le
// détour par le baril de réexports, qui se paie cher dans une boucle serrée.
import { degatsBase, produitesPar } from '../engine/catalogue';
import { brouillardActif } from '../engine/climat/index';
import { degatsArme, ECHELLE_DEGATS, etoilesDefense, facteurTerrain, largeurAlea } from '../engine/regles/combat';
import { dansCarte, terrainBrut, terrainLogique } from '../engine/hooks';
import { batimentsDe, producteursDe } from '../engine/regles/economie';
import { multiplicateur, multiplicateurFonds } from '../engine/regles/modificateurs';
import {
  adversesVisibles, pointsMouvement, tableCouts, uniteSur,
} from '../engine/regles/mouvement';
import { cleCase, depuisCle, manhattan, porte, pvAffiches } from '../engine/types';
import type { Case, CampId, CleUnite, UnitType } from '../schemas/index';
import {
  aBesoin, batimentsRavitaillant, casesDepose, COUVERTURE_MIN, estSoutien, peutTirerSur,
} from './logistique';

/**
 * Brouillard honnête (7 septembre 2026) : les stratégies ne lisent que les
 * adversaires que le moteur montre à leur camp. Mis à `false`, l'IA relit tout
 * `etat.unites` comme avant — c'est le seul point sur lequel revenir si le
 * vérificateur de campagne tombait, et il se revient d'un mot.
 */
export const BROUILLARD_HONNETE = true;

/** Adversaires que ce camp connaît : ceux qu'il voit, ou tous si l'on triche. */
export function adversairesConnus(etat: EtatPartie, cat: Catalogue, camp: CampId): Unite[] {
  if (BROUILLARD_HONNETE) return adversesVisibles(etat, cat, camp);
  return etat.unites.filter((u) => !sontAllies(etat, u.camp, camp) && !u.dansTransport);
}

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
  // L'échelle et le terrain viennent du moteur (8 septembre 2026) : l'IA les
  // recopiait, et sa copie a menti dès que la formule a changé — elle jugeait
  // ses échanges deux fois trop meurtriers et se jetait sur tout. Les étoiles
  // comptent le modificateur `etoiles` d'un pouvoir, et l'aléa est pris à sa
  // **moyenne** : sans `chance`, exactement 1, comme avant (10 septembre 2026).
  const fTerrain = facteurTerrain(etoilesDefense(etat, cat, def));
  const mAtt = multiplicateur(etat, cat, att, 'attaque');
  const mDef = multiplicateur(etat, cat, def, 'defense');
  const aleaMoyen = 0.95 + largeurAlea(etat, cat, att) * 0.5;
  void depuis;
  const d = ECHELLE_DEGATS * base * (pvAffiches(att.pv) / 10) * mAtt * fTerrain / mDef * aleaMoyen;
  return Math.min(def.pv, Math.max(1, Math.round(d)));
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
      if (sontAllies(etat, etat.proprietaires[cleCase({ x, y })], camp)) continue;
      cases.push({ x, y });
    }
  }
  return cases;
}

/** Cases des unités adverses connues : l'objectif des unités qui ne capturent pas. */
export function objectifsCombat(etat: EtatPartie, cat: Catalogue, camp: CampId): Case[] {
  return adversairesConnus(etat, cat, camp).map((u) => ({ x: u.x, y: u.y }));
}

/**
 * Cases d'où une pièce à tir indirect frappe ses cibles : la couronne entre sa
 * portée minimale et maximale autour de chacune. C'est ce qui donne un sens à
 * une pièce qui ne va pas **sur** sa cible — une artillerie s'arrête à trois
 * cases, un cuirassé bombarde la côte depuis le large sans jamais y accoster.
 */
export function casesDeTir(etat: EtatPartie, type: UnitType, cibles: Case[]): Case[] {
  const [min, max] = type.portee;
  const vues = new Set<string>();
  const sortie: Case[] = [];
  for (const cible of cibles) {
    for (let dy = -max; dy <= max; dy += 1) {
      const reste = max - Math.abs(dy);
      for (let dx = -reste; dx <= reste; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) < min) continue;
        const c = { x: cible.x + dx, y: cible.y + dy };
        if (!dansCarte(etat, c)) continue;
        const k = cleCase(c);
        if (vues.has(k)) continue;
        vues.add(k);
        sortie.push(c);
      }
    }
  }
  return sortie;
}

/**
 * Objectifs d'une unité : ce vers quoi elle marche. Les capteurs vont aux
 * bâtiments à prendre, le génie à ce qui est désaffecté, les pièces à tir
 * indirect à portée de tir des adversaires, les autres aux unités adverses et
 * aux bâtiments. `cle` identifie l'ensemble pour la mémoire.
 */
export function objectifsDe(
  etat: EtatPartie, cat: Catalogue, u: Unite,
): { cibles: Case[]; cle: string } {
  const type = cat.unites[u.type];
  if (capteur(cat, u)) return { cibles: objectifsCapture(etat, cat, u.camp), cle: 'c' };
  if (type && porte(type, 'genie') && etat.desaffectes.length > 0) {
    return { cibles: etat.desaffectes.map(depuisCle), cle: 'g' };
  }
  if (type && porte(type, 'tir_indirect')) {
    return {
      cibles: [...casesDeTir(etat, type, objectifsCombat(etat, cat, u.camp)), ...objectifsCapture(etat, cat, u.camp)],
      cle: `i${type.portee[0]}-${type.portee[1]}`,
    };
  }
  return {
    cibles: [...objectifsCombat(etat, cat, u.camp), ...objectifsCapture(etat, cat, u.camp)],
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
  for (const a of adversairesConnus(etat, cat, u.camp)) {
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

/** Répartition des unités adverses connues par clé : sert à choisir un achat. */
export function menaceParType(etat: EtatPartie, cat: Catalogue, camp: CampId): Record<CleUnite, number> {
  const compte: Record<CleUnite, number> = {};
  for (const u of adversairesConnus(etat, cat, camp)) {
    compte[u.type] = (compte[u.type] ?? 0) + 1;
  }
  return compte;
}

/**
 * Poids total, par bâtiment producteur adverse, des unités qu'il **pourrait**
 * produire : une menace en puissance vaut la moitié d'une unité présente,
 * répartie entre ce que le bâtiment sait faire, et au prorata de ce que
 * l'adversaire peut se payer d'ici `TOURS_POTENTIEL` journées de revenus.
 */
export const POIDS_POTENTIEL = 0.5;
/** Journées de revenus adverses comptées dans l'accessibilité d'un achat potentiel. */
export const TOURS_POTENTIEL = 2;

/**
 * Ce que l'adversaire peut produire mais n'a pas encore : un aéroport adverse
 * est une menace aérienne en puissance, un port une menace navale. Le poids
 * croît avec ses fonds. Les pièces qui ne tirent pas (transports, drones) n'y
 * entrent pas : elles ne sont une menace pour personne.
 */
export function mixPotentiel(etat: EtatPartie, cat: Catalogue, camp: CampId): Record<CleUnite, number> {
  const mix: Record<CleUnite, number> = {};
  for (const adverse of etat.camps) {
    if (sontAllies(etat, adverse.id, camp) || adverse.elimine) continue;
    const revenus = batimentsDe(etat, adverse.id).length * etat.reglages.revenusParBatiment
      * multiplicateurFonds(etat, adverse.id);
    const portee = adverse.fonds + TOURS_POTENTIEL * revenus;
    for (const k of producteursDe(etat, cat, adverse.id)) {
      const terrain = terrainLogique(etat, cat, depuisCle(k));
      if (terrain === null) continue;
      const armees = produitesPar(cat, terrain, etat, adverse.id).filter((cle) => estArmee(cat, cle));
      if (armees.length === 0) continue;
      for (const cle of armees) {
        const t = cat.unites[cle]!;
        const accessible = Math.min(1, portee / Math.max(1, t.cout));
        mix[cle] = (mix[cle] ?? 0) + (POIDS_POTENTIEL / armees.length) * accessible;
      }
    }
  }
  return mix;
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
      if (terrain === null || produitesPar(cat, terrain, etat, camp).length === 0) return false;
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
 * Unités de ce type déjà **perdues** par le camp : produites moins en jeu. Une
 * pièce de soutien qu'on a déjà perdue vaut moins la prochaine fois — c'est la
 * seule mémoire dont l'IA dispose, et elle est dans l'état.
 */
export function pertes(etat: EtatPartie, camp: CampId, cle: CleUnite): number {
  const produites = etat.produites[`${camp}:${cle}`] ?? 0;
  const enJeu = etat.unites.filter((u) => u.camp === camp && u.type === cle).length;
  return Math.max(0, produites - enJeu);
}

/** Vrai si un adversaire connu est assez près d'une de nos unités pour qu'il faille recruter du feu demain. */
function combatImminent(etat: EtatPartie, cat: Catalogue, camp: CampId): boolean {
  const miennes = etat.unites.filter((m) => m.camp === camp && !m.dansTransport);
  return adversairesConnus(etat, cat, camp)
    .some((a) => miennes.some((m) => manhattan(a, m) <= RAYON_COMBAT_IMMINENT));
}

/** Unité fictive d'un type, posée sur une case : de quoi interroger le moteur sur un achat qui n'existe pas encore. */
function fictive(cat: Catalogue, cle: CleUnite, camp: CampId, c: Case): Unite {
  const t = cat.unites[cle]!;
  return {
    id: `fictive:${cle}`, camp, type: cle, x: c.x, y: c.y, pv: 100,
    munitions: t.munitions, carburant: t.carburant ? t.carburant.max : null,
    etat: 'prete', pointsCapture: 0, cargo: [], dansTransport: null,
  };
}

/** Ce qu'un transport d'un type donné aurait à faire : ses clients, et les places déjà offertes. */
export interface BesoinTransport {
  /** Unités que ce transport accepte et qui en ont réellement besoin. */
  clients: number;
  /** Places qu'offrent déjà les transports du camp acceptant les mêmes passagers. */
  places: number;
}

/**
 * Le besoin réel de transport d'un camp, pour un type de transport : ses
 * clients sont les unités qu'il accepte et dont l'objectif est **hors de
 * portée à pied** — une île — ou à plus de deux tours de marche, pourvu qu'un
 * transport neuf, produit là où le camp le produit, puisse accoster près de
 * cet objectif ; et, si le transport ravitaille sa cale, celles qui sont à
 * court. Les places déjà offertes par les transports en jeu qui acceptent les
 * mêmes passagers se retranchent : on n'achète pas une seconde barge pour
 * deux fantassins.
 */
export function besoinTransport(
  etat: EtatPartie, cat: Catalogue, cle: CleUnite, camp: CampId,
): BesoinTransport {
  const t = cat.unites[cle];
  if (!t || !porte(t, 'transport') || t.transport === null) return { clients: 0, places: 0 };
  const accepte = t.transport.accepte;
  let places = 0;
  for (const a of etat.unites) {
    if (a.camp !== camp) continue;
    const ta = cat.unites[a.type];
    if (!ta || !porte(ta, 'transport') || ta.transport === null) continue;
    if (ta.transport.accepte.some((x) => accepte.includes(x))) places += ta.transport.places;
  }
  // D'où partirait un transport neuf : le premier bâtiment du camp qui le produit.
  const chantier = producteursDe(etat, cat, camp)
    .map(depuisCle)
    .find((c) => {
      const terrain = terrainLogique(etat, cat, c);
      return terrain !== null && produitesPar(cat, terrain, etat, camp).includes(cle);
    });
  let clients = 0;
  for (const a of etat.unites) {
    if (a.camp !== camp || a.dansTransport !== null || !accepte.includes(a.type)) continue;
    const ta = cat.unites[a.type];
    if (!ta || estSoutien(ta)) continue;
    if (t.transport.ravitaille === true && aBesoin(etat, cat, a)) { clients += 1; continue; }
    const obj = objectifsDe(etat, cat, a);
    if (obj.cibles.length === 0) continue;
    const distA = distances(etat, cat, a, obj.cibles, `${a.camp}|${a.type}|${obj.cle}`);
    const d = distA[a.y * etat.largeur + a.x] ?? -1;
    if (d >= 0 && d <= 2 * pointsMouvement(etat, cat, a)) continue;
    if (!chantier) continue;
    const neuf = fictive(cat, cle, camp, chantier);
    const depose = casesDepose(etat, cat, neuf, a, distA);
    const distT = distances(etat, cat, neuf, depose, `${camp}|${cle}|depose|${a.type}|${obj.cle}`);
    if ((distT[chantier.y * etat.largeur + chantier.x] ?? -1) >= 0) clients += 1;
  }
  return { clients, places };
}

/**
 * Valeur d'une unité qui ne tire pas (`04-gameplay.md` §10 bis, §10 ter) : le
 * soutien — transport, ravitailleur — vaut par les unités qu'il sert, l'œil —
 * drone, brouilleur — par le brouillard qu'il perce ou impose. Toujours modérée :
 * une armée de transports ne prend rien. Un transport vaut par ses **clients**
 * réels moins les places déjà offertes (`besoinTransport`), un ravitailleur par
 * les unités à munitions ou à carburant, un soutien par tranche de
 * `ARMEES_PAR_SOUTIEN` armées ; chaque exemplaire déjà perdu divise la valeur.
 * Sans armée (trois unités armées), c'est **possible mais rare** : seul un
 * besoin réel justifie un premier transport, à demi-valeur. On n'achète jamais
 * ce qui empêche de recruter une unité armée au tour suivant — sauf si le
 * transport est le seul besoin réel, c'est-à-dire qu'aucun adversaire connu
 * n'est à `RAYON_COMBAT_IMMINENT` d'une de nos unités.
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
  let ravitailleurs = 0;
  let dependantes = 0;
  let yeux = 0;
  let brouilleurs = 0;
  for (const u of etat.unites) {
    if (u.camp !== camp) continue;
    const tu = cat.unites[u.type];
    if (!tu) continue;
    if (estSoutien(tu)) {
      if (porte(tu, 'ravitaillement')) ravitailleurs += 1;
    } else if (porte(tu, 'drone')) yeux += 1;
    else if (porte(tu, 'brouilleur')) brouilleurs += 1;
    else if (estArmee(cat, u.type)) {
      armees += 1;
      if (tu.munitions !== null || tu.carburant !== null) dependantes += 1;
    }
  }
  const perdus = pertes(etat, camp, cle);
  if (!soutien) {
    if (armees < 3) return 0;
    if (porte(t, 'drone')) {
      if (!brouillardActif(etat)) return 0;
      return 0.12 / (1 + 3 * yeux) / (1 + perdus);
    }
    const dronesAdverses = adversairesConnus(etat, cat, camp).filter((u) => {
      const tu = cat.unites[u.type];
      return tu !== undefined && porte(tu, 'drone');
    }).length;
    return dronesAdverses > 0 && brouilleurs === 0 ? 0.12 / (1 + perdus) : 0;
  }
  // Le transport vaut par ses clients ; le ravitailleur par les unités à réserves.
  let valeurTransport = 0;
  let besoinReel = false;
  if (porte(t, 'transport') && t.transport !== null) {
    const b = besoinTransport(etat, cat, cle, camp);
    const manquantes = b.clients - b.places;
    if (manquantes > 0) {
      besoinReel = true;
      valeurTransport = VALEUR_SOUTIEN * Math.min(1, manquantes / t.transport.places);
    }
  }
  let valeurRavitailleur = 0;
  if (porte(t, 'ravitaillement') && ravitailleurs * ARMEES_PAR_SOUTIEN < armees) {
    valeurRavitailleur = (VALEUR_SOUTIEN * Math.min(1, dependantes / ARMEES_PAR_SOUTIEN)) / (1 + 2 * ravitailleurs);
  }
  const sansArmee = armees < 3;
  if (sansArmee && !besoinReel) return 0;
  // Jamais si l'on ne peut plus recruter une unité armée au tour suivant — sauf
  // si le transport est le seul besoin réel, personne n'étant à portée de combat.
  const caisse = etat.camps.find((c) => c.id === camp);
  const revenus = batimentsDe(etat, camp).length * etat.reglages.revenusParBatiment;
  const bloqueArmee = caisse !== undefined && caisse.fonds - t.cout + revenus < coutArmeeMinimal(cat);
  if (bloqueArmee && !(besoinReel && !combatImminent(etat, cat, camp))) return 0;
  const brute = Math.max(sansArmee ? valeurTransport / 2 : valeurTransport, sansArmee ? 0 : valeurRavitailleur);
  return brute / (1 + perdus);
}

/**
 * Ce qu'un achat **contre** : la part des menaces adverses — présentes et en
 * puissance — que l'armée du camp ne couvre pas encore et que ce type
 * couvrirait. Une menace est couverte quand l'armée aligne, en unités qui la
 * frappent à `COUVERTURE_MIN` ou plus, de quoi la mettre hors jeu une fois par
 * exemplaire ; en deçà, la lacune se paie au prix de la menace. Rendu en
 * milliers de fonds de menace nouvellement couverte : un bombardier adverse à
 * 18 000 que rien ne touche vaut 18 à qui le frappe à 100.
 */
export function contreAchat(
  cat: Catalogue, cle: CleUnite, menaces: Record<CleUnite, number>, mienne: Record<CleUnite, number>,
): number {
  let total = 0;
  for (const [adverse, poids] of Object.entries(menaces)) {
    if (poids <= 0 || !estArmee(cat, adverse)) continue;
    const apport = degatsBase(cat, cle, adverse);
    if (apport < COUVERTURE_MIN) continue;
    let capacite = 0;
    for (const [mien, n] of Object.entries(mienne)) {
      const d = degatsBase(cat, mien, adverse);
      if (d >= COUVERTURE_MIN) capacite += (n * d) / 100;
    }
    const lacune = Math.max(0, 1 - capacite / poids);
    if (lacune <= 0) continue;
    total += (apport / 100) * lacune * poids * ((cat.unites[adverse]?.cout ?? 0) / 1000);
  }
  return total;
}

/** Ce que `scoreAchat` reçoit pour compter ce qu'un achat contre. */
export interface Contre {
  /** Menaces à couvrir : adversaires connus **et** ce qu'ils peuvent produire. */
  menaces: Record<CleUnite, number>;
  /** Poids du terme (`Poids.contre`). */
  poids: number;
}

/**
 * Score d'achat d'un type d'unité : ce qu'il inflige au mix adverse connu,
 * multiplié par ce qu'il encaisse de ce même mix, rapporté au millier de fonds —
 * puis corrigé par la météo annoncée (§12.7) et par ce que le camp possède déjà.
 * C'est ce dernier terme qui empêche une armée d'un seul modèle. S'y ajoute,
 * quand on le lui donne, ce que l'achat **contre** (`contreAchat`) : c'est lui
 * qui rend achetable un chasseur ou un lance-missiles face à un aéroport
 * adverse, quand la moyenne sur le mix ne les verrait jamais. Sans adversaire
 * connu, le mix est ce que l'adversaire peut produire, puis tout le catalogue.
 * Une unité qui ne tire pas vaut par `valeurSoutien`, si l'on sait pour quel
 * camp on achète.
 */
export function scoreAchat(
  etat: EtatPartie, cat: Catalogue, cle: CleUnite,
  mix: Record<CleUnite, number>, mienne: Record<CleUnite, number>,
  manqueCapteurs: boolean, camp?: CampId, contre?: Contre,
): number {
  const t = cat.unites[cle];
  if (!t || t.statut === 'retiree') return -1;
  if (!estArmee(cat, cle)) return camp === undefined ? 0 : valeurSoutien(etat, cat, cle, camp);
  let adverses = Object.entries(mix).filter(([, n]) => n > 0);
  if (adverses.length === 0 && contre) adverses = Object.entries(contre.menaces).filter(([, n]) => n > 0);
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
  const parMillier = Math.max(100, t.cout) / 1000;
  let score = (offensif * survie) / 100 / parMillier;
  if (contre) score += (contre.poids * contreAchat(cat, cle, contre.menaces, mienne)) / parMillier;
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

/** Bâtiments qui ravitaillent un domaine, réexporté pour les stratégies. */
export { batimentsRavitaillant };
