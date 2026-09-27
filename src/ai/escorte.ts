import { sontAllies } from '../engine/equipes';
/**
 * L'escorte (27 septembre 2026) : mener une unité à protéger jusqu'à sa
 * destination sans l'offrir en chemin (objectif `proteger`, `doc/03` §6).
 *
 * Trois règles, et elles tiennent en une phrase chacune :
 *
 * 1. **La protégée joue en dernier.** Ses escorteurs ont frappé, bouché ou
 *    dégagé avant qu'elle choisisse sa case : c'est ce qui rend une case
 *    « couverte ».
 * 2. **Elle ne va qu'où personne ne peut la frapper au prochain passage
 *    adverse**, et la plus proche de l'arrivée parmi celles-là ; sinon elle
 *    attend ou recule vers la case la moins exposée. Elle file dès que
 *    l'arrivée est à sa portée — au besoin grâce au pouvoir de son camp.
 * 3. **Quand il ne reste plus de journée à perdre**, elle prend la case la plus
 *    proche où elle survit au pire, et à défaut la plus proche : attendre
 *    encore serait perdre à coup sûr.
 *
 * Le « pire » est une borne, jamais une prévision : chaque adversaire connu
 * frappe depuis la meilleure case qu'il peut atteindre, l'aléa au plus haut,
 * avec le pouvoir que sa jauge paierait — plus une barre, parce qu'une jauge se
 * remplit aussi en frappant pendant son propre tour, et c'est exactement ce qui
 * a pris le convoi de FR03 quand la marge n'y était pas. Nos unités bloquent
 * leur case et tiennent leur zone de contrôle ; celles de l'adversaire peuvent
 * s'écarter. Deux attaquants directs ne partagent jamais une voisine.
 *
 * Rien n'est lu que le camp ne voie : les adversaires sont ceux que le moteur
 * lui montre (`adversesVisibles`), les jauges sont publiques, et les fonds
 * adverses, cachés sous brouillard, ne sont pas lus du tout — une usine
 * adverse libre est supposée pouvoir produire.
 *
 * Ce module ne remplace aucune stratégie : `jouerTourEscorte` fait jouer une
 * stratégie existante telle quelle, en ne lui retirant que la protégée, qu'il
 * joue lui-même à la fin du tour.
 */

import type {
  Action, Catalogue, Commandants, EtatPartie, Rng, Unite,
} from '../engine/index';
import { appliquer } from '../engine/actions';
import { brouillardActif } from '../engine/climat/index';
import { copierEtat } from '../engine/etat';
import { dansCarte } from '../engine/hooks';
import {
  largeurAlea, peutViser, porteeEffective, prevoirDuel,
} from '../engine/regles/combat';
import { producteursDe } from '../engine/regles/economie';
import {
  adversesVisibles, casesAtteignables, cheminVers, coutVers, pointsMouvement,
  tableCouts, voisines,
} from '../engine/regles/mouvement';
import {
  estModificateurDurable, POINTS_PAR_BARRE, poserModificateur, unitesVisees,
} from '../engine/regles/pouvoirs';
import { cleCase, depuisCle, manhattan, porte } from '../engine/types';
import type { Case, CampId, EffetPouvoir, ObjectifVictoire } from '../schemas/index';
import { porteePrudente } from './deplacement';
import type { Strategie } from './types';

/** Une escorte : quelle unité, et où elle doit arriver. */
export interface Escorte {
  uniteId: string;
  destination: Case;
}

/**
 * Jauge qu'on prête à l'adversaire en plus de la sienne : une barre. Une IA
 * déclenche son pouvoir dès qu'il est payable, y compris au milieu de son tour
 * après une frappe qui a rempli la barre qui manquait ; les unités qui n'ont
 * pas encore bougé en profitent. Mesuré sur FR03 : sans cette marge, le
 * convoi se croyait hors d'atteinte à 595 points sur 600, et deux fantassins
 * ont gagné la case de mouvement qui les amenait à son contact.
 */
export const MARGE_JAUGE_ESCORTE = POINTS_PAR_BARRE;

/** L'escorte que les objectifs du camp 0 demandent, ou `null` : une protégée sans destination n'a qu'à survivre. */
export function escorteDuScenario(victoire: readonly ObjectifVictoire[]): Escorte | null {
  for (const v of victoire) {
    if (v.type === 'proteger' && v.destination) return { uniteId: v.uniteRef, destination: { x: v.destination.x, y: v.destination.y } };
  }
  return null;
}

/**
 * Dernière journée où une arrivée compte encore : la plus proche des limites
 * du scénario (`limiteJournees`, défaite `limite_journees`), qui se jouent
 * toutes deux jusqu'au bout de la journée dite. Sans limite, l'infini.
 */
export function derniereJournee(etat: EtatPartie): number {
  let derniere = etat.reglages.limiteJournees ?? Number.POSITIVE_INFINITY;
  for (const d of etat.reglages.defaite) {
    if (d.type === 'limite_journees') derniere = Math.min(derniere, d.journees);
  }
  return derniere;
}

/**
 * Coût de terrain qui reste à payer, depuis chaque case, pour arriver sur
 * `destination` avec le mouvement de cette unité ; les unités ne comptent pas.
 * `-1` là où l'arrivée est hors d'atteinte. C'est la mesure de « plus proche » :
 * un pas en forêt en vaut deux pour des chenilles, et la carte de pas de l'IA
 * (`distances`) l'ignore.
 */
export function coutsJusqua(etat: EtatPartie, cat: Catalogue, u: Unite, destination: Case): Int32Array {
  const largeur = etat.largeur;
  const hauteur = etat.hauteur;
  const table = tableCouts(etat, cat, u);
  const couts = new Int32Array(largeur * hauteur).fill(-1);
  if (!dansCarte(etat, destination)) return couts;
  const depart = destination.y * largeur + destination.x;
  if (table[depart] === null || table[depart] === undefined) return couts;
  couts[depart] = 0;
  const seaux: number[][] = [[depart]];
  for (let cout = 0; cout < seaux.length; cout += 1) {
    for (const i of seaux[cout] ?? []) {
      if (couts[i] !== cout) continue;
      // Entrer sur `i` coûte son pas : c'est ce que paie qui vient d'une voisine.
      const pas = table[i]!;
      const x = i % largeur;
      const y = (i - x) / largeur;
      const suivantes = [y > 0 ? i - largeur : -1, x > 0 ? i - 1 : -1, x < largeur - 1 ? i + 1 : -1, y < hauteur - 1 ? i + largeur : -1];
      for (const j of suivantes) {
        if (j < 0 || table[j] === null || table[j] === undefined) continue;
        const total = cout + pas;
        const connu = couts[j] ?? -1;
        if (connu >= 0 && connu <= total) continue;
        couts[j] = total;
        (seaux[total] ??= []).push(j);
      }
    }
  }
  return couts;
}

/** Ce qu'un adversaire connu peut faire à son prochain tour, dans un scénario de pouvoir. */
interface Attaquant {
  unite: Unite;
  /** Coût pour atteindre chaque case à son prochain tour, `-1` si hors d'atteinte. */
  couts: Int32Array;
  min: number;
  max: number;
  bougeEtTire: boolean;
  /** Pire aléa rapporté à l'aléa médian de la prévision. */
  alea: number;
}

/** Un état supposé : chaque camp adverse avec ou sans l'un de ses pouvoirs payables. */
interface ScenarioMenace {
  etat: EtatPartie;
  attaquants: Attaquant[];
  /** Effets instantanés déclenchés dans ce scénario, par camp. */
  instantanes: { camp: CampId; effets: EffetPouvoir[] }[];
  /** Un super qui réactive : les attaquants peuvent frapper deux fois. */
  reactive: boolean;
}

/** La menace qui pèse sur une protégée, préparée une fois par décision. */
export interface MenaceEscorte {
  protegee: Unite;
  scenarios: ScenarioMenace[];
}

/**
 * Les états que chaque camp adverse peut produire à son prochain tour avec
 * un pouvoir : aucun, le pouvoir, le super — ceux que sa jauge paie à
 * `MARGE_JAUGE_ESCORTE` près. Les modificateurs durables sont posés sur une
 * copie ; les effets instantanés sont gardés pour la lecture des dégâts.
 */
function scenariosDePouvoir(
  etat: EtatPartie, camp: CampId, commandants: Commandants,
): { etat: EtatPartie; instantanes: { camp: CampId; effets: EffetPouvoir[] }[]; reactive: boolean }[] {
  let sortie: { etat: EtatPartie; instantanes: { camp: CampId; effets: EffetPouvoir[] }[]; reactive: boolean }[] = [
    { etat, instantanes: [], reactive: false },
  ];
  for (const adverse of etat.camps) {
    if (adverse.elimine || sontAllies(etat, adverse.id, camp)) continue;
    const commandant = commandants[adverse.id] ?? null;
    if (!commandant) continue;
    const suivants: typeof sortie = [];
    for (const base of sortie) {
      suivants.push(base);
      for (const niveau of ['normal', 'super'] as const) {
        const p = niveau === 'super' ? commandant.superPouvoir : commandant.pouvoir;
        if (adverse.jauge + MARGE_JAUGE_ESCORTE < p.barres * POINTS_PAR_BARRE) continue;
        const copie = copierEtat(base.etat);
        const instantanes: EffetPouvoir[] = [];
        for (const effet of p.effets) {
          if (estModificateurDurable(effet)) {
            poserModificateur(copie, adverse.id, niveau === 'super' ? 'super' : 'pouvoir', effet, { type: 'ce_tour' });
          } else {
            instantanes.push(effet);
          }
        }
        suivants.push({
          etat: copie,
          instantanes: [...base.instantanes, { camp: adverse.id, effets: instantanes }],
          reactive: base.reactive || instantanes.some((e) => 'reactiver' in e),
        });
      }
    }
    sortie = suivants;
  }
  return sortie;
}

/**
 * Cases qu'un adversaire peut atteindre à son prochain tour : ses points de
 * mouvement et son carburant, nos unités qui bloquent leur case et tiennent
 * leur zone de contrôle (sauf pour qui vole). La protégée n'y compte pas : elle
 * va bouger, et sa future case n'est jamais une case de tir.
 */
function atteintes(etat: EtatPartie, cat: Catalogue, z: Unite, bloquee: Uint8Array, zdc: Uint8Array): Int32Array {
  const largeur = etat.largeur;
  const hauteur = etat.hauteur;
  const couts = new Int32Array(largeur * hauteur).fill(-1);
  const type = cat.unites[z.type];
  if (!type) return couts;
  const carburant = z.carburant === null || type.carburant === null
    ? Number.POSITIVE_INFINITY
    : Math.floor(z.carburant / Math.max(1, type.carburant.parCase));
  const plafond = Math.min(pointsMouvement(etat, cat, z), carburant);
  const table = tableCouts(etat, cat, z);
  const vol = porte(type, 'vol');
  const depart = z.y * largeur + z.x;
  couts[depart] = 0;
  const seaux: number[][] = [[depart]];
  for (let cout = 0; cout <= plafond && cout < seaux.length; cout += 1) {
    for (const i of seaux[cout] ?? []) {
      if (couts[i] !== cout) continue;
      if (i !== depart && !vol && zdc[i] === 1) continue;
      const x = i % largeur;
      const y = (i - x) / largeur;
      const suivantes = [y > 0 ? i - largeur : -1, x > 0 ? i - 1 : -1, x < largeur - 1 ? i + 1 : -1, y < hauteur - 1 ? i + largeur : -1];
      for (const j of suivantes) {
        if (j < 0 || bloquee[j] === 1) continue;
        const pas = table[j];
        if (pas === null || pas === undefined) continue;
        const total = cout + pas;
        if (total > plafond) continue;
        const connu = couts[j] ?? -1;
        if (connu >= 0 && connu <= total) continue;
        couts[j] = total;
        (seaux[total] ??= []).push(j);
      }
    }
  }
  return couts;
}

/** Prépare la menace sur la protégée : adversaires connus, portées, pouvoirs. */
export function menaceEscorte(
  etat: EtatPartie, cat: Catalogue, protegee: Unite, commandants: Commandants = [],
): MenaceEscorte {
  const largeur = etat.largeur;
  const total = largeur * etat.hauteur;
  const bloquee = new Uint8Array(total);
  const zdc = new Uint8Array(total);
  for (const u of etat.unites) {
    if (u.dansTransport !== null || u.id === protegee.id || !sontAllies(etat, u.camp, protegee.camp)) continue;
    bloquee[u.y * largeur + u.x] = 1;
    for (const v of voisines(u)) if (dansCarte(etat, v)) zdc[v.y * largeur + v.x] = 1;
  }
  const connus = adversesVisibles(etat, cat, protegee.camp).filter((z) => z.dansTransport === null);
  const scenarios = scenariosDePouvoir(etat, protegee.camp, commandants).map((s): ScenarioMenace => ({
    ...s,
    attaquants: connus.flatMap((z0): Attaquant[] => {
      const z = s.etat.unites.find((u) => u.id === z0.id) ?? z0;
      const type = cat.unites[z.type];
      if (!type) return [];
      const [min, max] = porteeEffective(s.etat, cat, z);
      if (max <= 0) return [];
      const largeurA = largeurAlea(s.etat, cat, z);
      return [{
        unite: z,
        couts: atteintes(s.etat, cat, z, bloquee, zdc),
        min,
        max,
        bougeEtTire: type.peutTirerApresMouvement,
        alea: (0.95 + largeurA) / (0.95 + largeurA / 2),
      }];
    }),
  }));
  return { protegee, scenarios };
}

/** Affectation de poids maximal : chaque attaquant choisit au plus une case de tir, chaque case sert une fois. */
function affectation(options: Map<string, number>[]): number {
  const tries = options.filter((o) => o.size > 0).map((o) => ({ o, max: Math.max(...o.values()) }))
    .sort((a, b) => b.max - a.max);
  // Au-delà, la recherche exacte coûterait trop : on borne par excès, ce qui
  // ne fait que rendre la protégée plus prudente.
  if (tries.length > 12) return tries.reduce((s, t) => s + t.max, 0);
  const restes = tries.map((_, i) => tries.slice(i).reduce((s, t) => s + t.max, 0));
  let meilleur = 0;
  const prises = new Set<string>();
  const chercher = (i: number, somme: number): void => {
    if (somme + (restes[i] ?? 0) <= meilleur) return;
    if (i === tries.length) {
      meilleur = somme;
      return;
    }
    for (const [k, d] of tries[i]!.o) {
      if (prises.has(k)) continue;
      prises.add(k);
      chercher(i + 1, somme + d);
      prises.delete(k);
    }
    chercher(i + 1, somme);
  };
  chercher(0, 0);
  return meilleur;
}

/**
 * Dégâts des effets instantanés d'un pouvoir adverse sur la protégée posée en
 * `c`, au pire : les dégâts directs qui la visent, une frappe de zone centrée
 * sur elle, un laser qui la choisirait, une impulsion qui l'abattrait. Ce qui
 * ne se chiffre pas en PV — une météo, une pose de terrain, une impulsion qui
 * immobilise — n'y est pas.
 */
function degatsInstantanes(
  futur: EtatPartie, cat: Catalogue, protegee: Unite, instantanes: { camp: CampId; effets: EffetPouvoir[] }[],
): number {
  let total = 0;
  const plancher = (pv: number): number => Math.max(0, Math.min(protegee.pv - 1, pv * 10));
  for (const { camp, effets } of instantanes) {
    for (const effet of effets) {
      if ('modificateur' in effet && effet.modificateur.quoi === 'degats_directs') {
        if (unitesVisees(futur, cat, camp, effet, true).some((u) => u.id === protegee.id)) total += plancher(effet.modificateur.valeur);
      } else if ('frappe' in effet) {
        total += plancher(effet.frappe.pv);
      } else if ('laser' in effet) {
        if (laserLaVise(futur, cat, camp, protegee, effet.laser)) total += plancher(effet.laser.pv);
      } else if ('iem' in effet && effet.iem.abattre && cat.unites[protegee.type]?.domaine === 'air') {
        total += protegee.pv;
      }
    }
  }
  return total;
}

/**
 * Vrai si un laser adverse pourrait prendre la protégée : on classe nos
 * propres unités — que nous connaissons toutes — selon son critère. Sous
 * brouillard, il en voit peut-être moins : on suppose le pire.
 */
function laserLaVise(
  etat: EtatPartie, cat: Catalogue, camp: CampId, protegee: Unite,
  laser: { nombre: number; choix: 'plus_cheres' | 'plus_avancees' },
): boolean {
  if (brouillardActif(etat)) return true;
  const miennes = etat.unites.filter((u) => u.dansTransport === null && sontAllies(etat, u.camp, protegee.camp));
  const cout = (u: Unite): number => cat.unites[u.type]?.cout ?? 0;
  if (laser.choix === 'plus_cheres') {
    return miennes.filter((u) => cout(u) > cout(protegee)).length < laser.nombre;
  }
  const qg = etat.camps.find((c) => c.id === camp)?.qgCase;
  if (!qg) return true;
  const repere = depuisCle(qg);
  return miennes.filter((u) => manhattan(u, repere) < manhattan(protegee, repere)).length < laser.nombre;
}

/**
 * Pire dégât, en PV internes, que la protégée subirait posée en `c` d'ici son
 * prochain tour, pris sur tous les scénarios de pouvoir. `0` : aucune case de
 * tir ne lui est ouverte — elle est hors d'atteinte, ou couverte.
 */
export function degatsAuPire(etat: EtatPartie, cat: Catalogue, c: Case, menace: MenaceEscorte): number {
  const protegee = menace.protegee;
  const largeur = etat.largeur;
  const occupees = new Set<string>();
  for (const u of etat.unites) {
    if (u.dansTransport === null && u.id !== protegee.id && sontAllies(etat, u.camp, protegee.camp)) occupees.add(cleCase(u));
  }
  let pire = 0;
  for (const s of menace.scenarios) {
    const posee: Unite = { ...protegee, x: c.x, y: c.y };
    const futur: EtatPartie = { ...s.etat, unites: s.etat.unites.map((u) => (u.id === protegee.id ? posee : u)) };
    const options: Map<string, number>[] = [];
    for (const a of s.attaquants) {
      const parCase = new Map<string, number>();
      for (let dy = -a.max; dy <= a.max; dy += 1) {
        const reste = a.max - Math.abs(dy);
        for (let dx = -reste; dx <= reste; dx += 1) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d === 0 || d < a.min) continue;
          const v = { x: c.x + dx, y: c.y + dy };
          if (!dansCarte(futur, v) || (a.couts[v.y * largeur + v.x] ?? -1) < 0) continue;
          const bouge = v.x !== a.unite.x || v.y !== a.unite.y;
          if ((bouge && !a.bougeEtTire) || occupees.has(cleCase(v))) continue;
          if (!peutViser(futur, cat, a.unite, posee, v, bouge).ok) continue;
          const prevision = prevoirDuel(futur, cat, a.unite, posee, v);
          parCase.set(cleCase(v), Math.ceil((prevision.degats + 0.5) * a.alea));
        }
      }
      options.push(parCase);
    }
    const frappes = affectation(options) * (s.reactive ? 2 : 1);
    pire = Math.max(pire, frappes + degatsInstantanes(futur, cat, posee, s.instantanes));
  }
  return pire;
}

/**
 * Producteurs adverses à `rayon` pas au plus de la destination : ce qui y naît
 * frapperait la protégée à l'arrivée et fermerait l'approche de sa zone de
 * contrôle. Ce sont les bâtiments que l'escorte doit prendre ou tenir.
 */
export function producteursAdversesPres(
  etat: EtatPartie, cat: Catalogue, camp: CampId, destination: Case, rayon: number,
): Case[] {
  const sortie: Case[] = [];
  for (const adverse of etat.camps) {
    if (adverse.elimine || sontAllies(etat, adverse.id, camp)) continue;
    for (const k of producteursDe(etat, cat, adverse.id)) {
      const c = depuisCle(k);
      if (manhattan(c, destination) <= rayon) sortie.push(c);
    }
  }
  return sortie.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Pourquoi la protégée va où elle va. */
export type RegleEscorte = 'destination' | 'couverte' | 'moindre_risque' | 'echeance';

/** Ce que la protégée fait ce tour. */
export interface PlanEscorte {
  /** Les actions, dans l'ordre : le pouvoir du camp s'il ouvre l'arrivée, puis l'ordre. */
  actions: Action[];
  vers: Case;
  /** Pire dégât prévu sur la case d'arrivée, en PV internes. */
  risque: number;
  regle: RegleEscorte;
  /** Journées qu'elle peut encore perdre avant de ne plus arriver à temps. */
  marge: number;
}

/**
 * Vrai si le camp sait la case occupée : par l'un des siens, ou par un
 * adversaire qu'il voit. Une unité cachée n'y est pas — si elle tient la case,
 * le moteur arrêtera l'ordre en chemin, comme il le fait pour tout le monde.
 */
function occupeeConnue(etat: EtatPartie, cat: Catalogue, camp: CampId, c: Case, sauf: string): boolean {
  return etat.unites.some((z) => z.id !== sauf && z.dansTransport === null && z.x === c.x && z.y === c.y
    && sontAllies(etat, z.camp, camp))
    || adversesVisibles(etat, cat, camp).some((z) => z.x === c.x && z.y === c.y);
}

/** Chemin vers la destination si la protégée l'atteint dans cet état, sinon `null`. */
function cheminDArrivee(etat: EtatPartie, cat: Catalogue, uniteId: string, destination: Case): Case[] | null {
  const u = etat.unites.find((z) => z.id === uniteId);
  if (!u || u.dansTransport !== null || u.etat !== 'prete') return null;
  const p = porteePrudente(etat, cat, u);
  if (coutVers(p, destination) === null || occupeeConnue(etat, cat, u.camp, destination, uniteId)) return null;
  return cheminVers(p, u, destination);
}

/**
 * Le tour de la protégée. `null` si elle n'est pas en état de jouer
 * (embarquée, déjà jouée, absente). Déterministe : à égalité, la case la plus
 * proche, puis la moins exposée, puis celle qui coûte le moins de mouvement,
 * puis l'ordre des cases.
 */
export function planEscorte(
  etat: EtatPartie, cat: Catalogue, escorte: Escorte, commandants: Commandants = [],
): PlanEscorte | null {
  const u = etat.unites.find((z) => z.id === escorte.uniteId);
  if (!u || u.dansTransport !== null || u.etat !== 'prete' || u.camp !== etat.campCourant) return null;
  const { destination } = escorte;
  const ordre = (chemin: Case[]): Action => ({ type: 'ordre', uniteId: u.id, chemin, suite: { type: 'rien' } });

  const direct = cheminDArrivee(etat, cat, u.id, destination);
  if (direct) return { actions: [ordre(direct)], vers: destination, risque: 0, regle: 'destination', marge: 0 };
  // Le pouvoir du camp, s'il ouvre l'arrivée ce tour : un mouvement de plus
  // vaut une journée de moins à tenir sous le feu.
  for (const niveau of ['normal', 'super'] as const) {
    const essai = appliquer(etat, { type: 'pouvoir', niveau }, cat, commandants);
    if (!essai.ok) continue;
    const chemin = cheminDArrivee(essai.etat, cat, u.id, destination);
    if (chemin) return { actions: [{ type: 'pouvoir', niveau }, ordre(chemin)], vers: destination, risque: 0, regle: 'destination', marge: 0 };
  }

  const p = porteePrudente(etat, cat, u);
  const libres = casesAtteignables(p).filter((c) => !occupeeConnue(etat, cat, u.camp, c, u.id));
  const reste = coutsJusqua(etat, cat, u, destination);
  const largeur = etat.largeur;
  const distance = (c: Case): number => {
    const d = reste[c.y * largeur + c.x] ?? -1;
    return d < 0 ? Number.POSITIVE_INFINITY : d;
  };
  const mouvement = Math.max(1, pointsMouvement(etat, cat, u));
  const marge = derniereJournee(etat) - etat.journee + 1 - Math.ceil(distance(u) / mouvement);
  const menace = menaceEscorte(etat, cat, u, commandants);
  // Une voisine d'un producteur adverse libre n'est jamais une case d'attente :
  // ce qui y naîtrait la frapperait au tour suivant et tiendrait l'approche.
  const berceaux = etat.camps.filter((a) => !a.elimine && !sontAllies(etat, a.id, u.camp))
    .flatMap((a) => producteursDe(etat, cat, a.id).map(depuisCle))
    .filter((c) => !occupeeConnue(etat, cat, u.camp, c, u.id));
  const notes = libres.map((c) => ({
    c,
    risque: degatsAuPire(etat, cat, c, menace),
    piege: berceaux.some((b) => manhattan(b, c) <= 1),
    distance: distance(c),
    cout: coutVers(p, c) ?? 0,
    indice: c.y * largeur + c.x,
  }));
  type Note = typeof notes[number];
  const proche = (a: Note, b: Note): number => a.distance - b.distance || a.risque - b.risque
    || a.cout - b.cout || a.indice - b.indice;
  const sure = (a: Note, b: Note): number => a.risque - b.risque || Number(a.piege) - Number(b.piege)
    || a.distance - b.distance || a.cout - b.cout || a.indice - b.indice;
  let choix: Note | undefined;
  let regle: RegleEscorte;
  if (marge >= 1) {
    choix = notes.filter((n) => n.risque === 0 && !n.piege).sort(proche)[0];
    regle = 'couverte';
    if (!choix) {
      choix = [...notes].sort(sure)[0];
      regle = 'moindre_risque';
    }
  } else {
    choix = notes.filter((n) => n.risque < u.pv).sort(proche)[0] ?? [...notes].sort(proche)[0];
    regle = 'echeance';
  }
  if (!choix) return null;
  const chemin = cheminVers(p, u, choix.c) ?? [{ x: u.x, y: u.y }];
  return { actions: [ordre(chemin)], vers: choix.c, risque: choix.risque, regle, marge };
}

/** Garde-fou, comme `jouerTour` : au-delà, la stratégie tourne en rond. */
const ACTIONS_MAX = 200;

/** Ce que rend un tour joué avec escorte : la forme de `ResultatTour`. */
export interface TourEscorte {
  etat: EtatPartie;
  actions: Action[];
  refus: { action: Action; motif: string }[];
}

/**
 * Joue le tour du camp courant avec une stratégie existante, qui ne touche pas
 * à la protégée : elle décide sur un état où la protégée a déjà joué, et joue
 * donc toute son armée avant elle. Quand il ne lui reste qu'à produire ou à
 * finir le tour, la protégée joue son `planEscorte`, puis la stratégie
 * reprend la main. Tout passe par `appliquer`, comme dans `jouerTour`, et un
 * refus ferme le tour de la même façon.
 */
export function jouerTourEscorte(
  etat: EtatPartie, strat: Strategie, rng: Rng, cat: Catalogue, commandants: Commandants, escorte: Escorte,
): TourEscorte {
  const flux = rng.branche('ia');
  const actions: Action[] = [];
  const refus: { action: Action; motif: string }[] = [];
  let courant = etat;
  const camp = courant.campCourant;
  let escortee = false;
  const jouer = (action: Action): boolean => {
    const r = appliquer(courant, action, cat, commandants);
    if (!r.ok) {
      refus.push({ action, motif: r.motif });
      const fin = appliquer(courant, { type: 'finTour' }, cat, commandants);
      if (fin.ok) {
        courant = fin.etat;
        actions.push({ type: 'finTour' });
      }
      return false;
    }
    courant = r.etat;
    actions.push(action);
    return true;
  };
  for (let i = 0; i < ACTIONS_MAX; i += 1) {
    if (courant.partie.terminee || courant.campCourant !== camp) break;
    const protegee = courant.unites.find((u) => u.id === escorte.uniteId);
    const retenue = !escortee && protegee !== undefined && protegee.camp === camp
      && protegee.etat === 'prete' && protegee.dansTransport === null;
    const vue: EtatPartie = retenue
      ? { ...courant, unites: courant.unites.map((u) => (u.id === escorte.uniteId ? { ...u, etat: 'agi' as const } : u)) }
      : courant;
    const action = strat.choisirAction(vue, camp, flux, cat, commandants);
    if (retenue && (action.type === 'produire' || action.type === 'finTour')) {
      escortee = true;
      const plan = planEscorte(courant, cat, escorte, commandants);
      let ok = true;
      for (const a of plan?.actions ?? []) {
        ok = jouer(a);
        if (!ok || courant.partie.terminee) break;
      }
      if (!ok) break;
      continue;
    }
    if (!jouer(action)) break;
    if (action.type === 'finTour') break;
  }
  return { etat: courant, actions, refus };
}
