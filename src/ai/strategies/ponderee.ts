import { sontAllies } from '../../engine/equipes';
/**
 * `ponderee` — l'adversaire par défaut (`doc/02-architecture.md` §3.2).
 *
 * Quatre termes portent la décision : la **capture** (c'est elle qui gagne les
 * matchs), la **valeur d'échange** (les fonds pris à l'adversaire moins les
 * fonds risqués), la **sécurité** (la menace subie sur la case d'arrivée) et la
 * **progression** vers l'objectif atteignable le plus proche. Depuis le
 * 7 septembre 2026, la **logistique** s'y ajoute (`../logistique.ts`) : l'arme
 * secondaire d'une unité à sec, le carburant qu'une unité aérienne garde pour
 * rentrer se poser — ou pour monter sur un porteur qui la ravitaille —, le
 * ravitaillement d'un voisin à court, le transport qui embarque un capteur
 * quand il le rapproche plus vite que ses jambes et vide sa cale en un ordre,
 * la furtivité qu'un chasseur furtif prend sous la menace et rend quand le
 * carburant presse, et l'escorte qu'une pièce sans anti-air attend avant de
 * s'avancer sous un ciel adverse. La production équilibre l'armée : d'abord de
 * quoi capturer, ensuite ce qui contre le mix adverse — présent ou que ses
 * bâtiments peuvent produire —, une pièce de soutien quand ses clients le
 * justifient, et l'épargne quand une unité hors de prix vaut deux journées
 * d'attente. Sous brouillard, elle ne lit que les adversaires qu'elle voit.
 *
 * L'IA ne fait que ce qu'un joueur peut faire : elle passe par `appliquer`, lit
 * le climat comme lui, et ne tire ses aléas que du flux qu'on lui donne.
 */

import type {
  Action, Catalogue, Debarquement, EtatPartie, Rng, Suite, Unite,
} from '../../engine/index';
import { constructionsPossibles } from '../../engine/regles/genie';
import { produitesPar } from '../../engine/catalogue';
import { terrainBrut, terrainLogique } from '../../engine/hooks';
import { peutCapturerIci, pointsGagnes, seuilCapture } from '../../engine/regles/capture';
import { brouillardActif } from '../../engine/climat/index';
import {
  degatsArme, ECHELLE_DEGATS, FACTEUR_RIPOSTE, facteurTerrain, peutViser, tireSansMunitions,
} from '../../engine/regles/combat';
import {
  batimentsDe, consommationParTour, SURCOUT_CARBURANT_FURTIF, verifierProduction,
} from '../../engine/regles/economie';
import { multiplicateurFonds } from '../../engine/regles/modificateurs';
import {
  cheminVers, coutEntree, pointsMouvement, voisines,
} from '../../engine/regles/mouvement';
import { casesVisibles } from '../../engine/regles/vision';
import { cleCase, manhattan, porte, pvAffiches } from '../../engine/types';
import type { Case, CampId, CleUnite } from '../../schemas/index';
import { porteePrudente } from '../deplacement';
import {
  adversairesConnus, armeeParType, capteur, compterCapteurs, degatsAttendus, distances, memoire,
  menaceParType, mixPotentiel, objectifsDe, scoreAchat, usinesLibres, type Contre,
} from '../evaluation';
import {
  aBesoin, autonomieSecurite, carburantFaible, casesDepose, casesRetour, estSoutien,
  estTransport, frappeLAir, manque, munitionsFaibles, peutEmbarquer, peutTirerSur,
  porteursRavitaillant, sourcesRavitaillement, toursPour, valeurEmbarquee,
} from '../logistique';
import type { Poids, Strategie } from '../types';

/** Poids de la stratégie pondérée : l'étalon dont dérivent les personnalités. */
export const POIDS_PONDEREE: Poids = {
  capture: 90,
  qg: 4,
  echange: 18,
  securite: 4,
  progression: 6,
  terrain: 1.2,
  capteursVises: 4,
  engagement: 1,
  seuil: -1e9,
  munitions: 1,
  carburant: 12,
  reserve: 1,
  ravitaillement: 12,
  embarquement: 20,
  debarquement: 15,
  contre: 0.1,
};

/**
 * Ce qu'il reste de la menace sur une unité furtive sous brouillard : elle
 * n'est repérée qu'au contact, un adversaire doit venir la toucher pour la
 * frapper, et il ne sait pas où elle est. Un quart, pas zéro : le hasard d'un
 * contact existe, et une pièce qui se croit invulnérable finit en mer.
 */
export const PART_MENACE_FURTIVE = 0.25;

/** Rayon dans lequel un allié qui frappe l'air escorte une pièce qui ne le frappe pas. */
export const RAYON_ESCORTE = 2;

/** Journées de revenus au plus pour qu'une unité inabordable vaille d'être attendue. */
export const TOURS_EPARGNE = 2;

/** Ce qu'une unité attendue doit valoir de plus que la meilleure abordable pour qu'on épargne. */
export const MARGE_EPARGNE = 1.3;

/** Étoiles de défense de chaque case, mémorisées par état. */
function defenses(etat: EtatPartie, cat: Catalogue): Int8Array {
  const memo = memoire(etat);
  const connue = memo.get('defenses') as Int8Array | undefined;
  if (connue) return connue;
  const table = new Int8Array(etat.largeur * etat.hauteur);
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < etat.largeur; x += 1) {
      const terrain = terrainLogique(etat, cat, { x, y });
      table[y * etat.largeur + x] = terrain ? (cat.terrains[terrain]?.defense ?? 0) : 0;
    }
  }
  memo.set('defenses', table);
  return table;
}

/** Cases capturables, mémorisées par état : 1 là où un bâtiment se prend. */
function capturables(etat: EtatPartie, cat: Catalogue): Uint8Array {
  const memo = memoire(etat);
  const connue = memo.get('capturables') as Uint8Array | undefined;
  if (connue) return connue;
  const table = new Uint8Array(etat.largeur * etat.hauteur);
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < etat.largeur; x += 1) {
      const terrain = terrainBrut(etat, cat, { x, y });
      if (terrain !== null && cat.terrains[terrain]?.capturable) table[y * etat.largeur + x] = 1;
    }
  }
  memo.set('capturables', table);
  return table;
}

/** Rayon dans lequel un capteur ami rend un bâtiment « à lui » : le laisser libre. */
const RAYON_CAPTEUR_PROCHE = 3;

/** Vrai si un capteur ami, autre que `u`, peut venir prendre cette case sous peu. */
function capteursProches(etat: EtatPartie, cat: Catalogue, u: Unite, c: Case): boolean {
  return etat.unites.some((a) => sontAllies(etat, a.camp, u.camp) && a.id !== u.id && !a.dansTransport
    && capteur(cat, a) && manhattan(a, c) <= RAYON_CAPTEUR_PROCHE);
}

/** Adversaires connus qui peuvent frapper une case, avec leur base de dégâts. */
interface Frappeur {
  base: number;
  pv: number;
  allonge: number;
  x: number;
  y: number;
  portee: number;
  minimum: number;
  /** L'adversaire vole : c'est lui qu'une escorte anti-aérienne tient à distance. */
  vol: boolean;
}

function frappeurs(etat: EtatPartie, cat: Catalogue, u: Unite): Frappeur[] {
  const memo = memoire(etat);
  const cle = `frappeurs|${u.camp}|${u.type}`;
  const connus = memo.get(cle) as Frappeur[] | undefined;
  if (connus) return connus;
  const sortie: Frappeur[] = [];
  for (const a of adversairesConnus(etat, cat, u.camp)) {
    const ta = cat.unites[a.type];
    if (!ta) continue;
    // La base de l'arme que l'adversaire peut servir : réduite s'il est à sec
    // hors de ses cibles secondaires, nulle s'il ne tire pas (§5.3).
    const base = degatsArme(cat, a, u.type);
    if (base <= 0) continue;
    sortie.push({
      base,
      pv: pvAffiches(a.pv),
      allonge: (porte(ta, 'tir_indirect') ? 0 : pointsMouvement(etat, cat, a)) + ta.portee[1],
      x: a.x,
      y: a.y,
      portee: ta.portee[1],
      minimum: porte(ta, 'tir_indirect') ? ta.portee[0] : 0,
      vol: porte(ta, 'vol'),
    });
  }
  memo.set(cle, sortie);
  return sortie;
}

/** Menace en fonds sur une case, sans relire le terrain (il est déjà tabulé). */
function menace(
  liste: Frappeur[], c: Case, etoiles: number, pvMoi: number, coutMoi: number,
): number {
  let total = 0;
  for (const f of liste) {
    const d = Math.abs(f.x - c.x) + Math.abs(f.y - c.y);
    if (d > f.allonge || d < f.minimum) continue;
    // La formule du moteur, jamais une copie (8 septembre 2026).
    const fTerrain = facteurTerrain(etoiles);
    const degats = ECHELLE_DEGATS * f.base * (f.pv / 10) * fTerrain;
    total += (degats / 100) * coutMoi * (d <= f.portee ? 1 : 0.6);
  }
  return total;
}

/**
 * Cases que le camp voit, ou `null` hors brouillard. Une attaque sur une case
 * invisible est refusée par le moteur, et un refus ferme le tour de l'IA : il
 * faut donc ne jamais la proposer (§10).
 */
function visibles(etat: EtatPartie, cat: Catalogue, camp: CampId): Set<string> | null {
  if (!brouillardActif(etat)) return null;
  const memo = memoire(etat);
  const cle = `visibles|${camp}`;
  const connues = memo.get(cle) as Set<string> | undefined;
  if (connues) return connues;
  const ensemble = casesVisibles(etat, cat, camp);
  memo.set(cle, ensemble);
  return ensemble;
}

/** Une option évaluée : où aller, quoi faire, et ce que ça vaut. */
interface Option {
  score: number;
  action: Action;
}

/**
 * Ordre de jeu des unités : finir les captures, frapper, avancer, et le soutien
 * en dernier — un transport qui joue après ses passagers peut les embarquer et
 * les porter dans le même tour, un ravitailleur sert ceux qui viennent de tirer.
 */
function prioriteUnite(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const t = cat.unites[u.type];
  if (!t) return 9;
  if (estSoutien(t)) return 4;
  if (capteur(cat, u) && peutCapturerIci(etat, cat, u)) return 0;
  if (porte(t, 'tir_indirect')) return 1;
  if (!capteur(cat, u)) return 2;
  return 3;
}

/**
 * Cases de dépose d'un transport pour un passager, mémorisées par état : elles
 * ne dépendent que des deux types et de l'objectif du passager.
 */
function deposesPour(
  etat: EtatPartie, cat: Catalogue, transport: Unite, passager: Unite, distPassager: Int32Array, cleObjectif: string,
): Case[] {
  const memo = memoire(etat);
  const cle = `depose|${transport.camp}|${transport.type}|${passager.type}|${cleObjectif}`;
  const connues = memo.get(cle) as Case[] | undefined;
  if (connues) return connues;
  const cases = casesDepose(etat, cat, transport, passager, distPassager);
  memo.set(cle, cases);
  return cases;
}

/**
 * Ce qu'un transport ou un ravitailleur cherche quand il n'a rien à bord : une
 * unité à court est une cliente ; un capteur loin de son objectif — ou coupé
 * de lui, sur une île — un passager.
 */
function objectifsSoutien(etat: EtatPartie, cat: Catalogue, u: Unite): Case[] {
  const cibles: Case[] = [];
  for (const a of etat.unites) {
    if (!sontAllies(etat, a.camp, u.camp) || a.id === u.id || a.dansTransport) continue;
    const ta = cat.unites[a.type];
    if (!ta || estSoutien(ta)) continue;
    if (aBesoin(etat, cat, a)) { cibles.push({ x: a.x, y: a.y }); continue; }
    if (a.camp !== u.camp || !estTransport(cat, u) || !peutEmbarquer(cat, u, a)) continue;
    const obj = objectifsDe(etat, cat, a);
    const dist = distances(etat, cat, a, obj.cibles, `${a.camp}|${a.type}|${obj.cle}`);
    const d = dist[a.y * etat.largeur + a.x] ?? -1;
    if (d < 0 || d > 2 * pointsMouvement(etat, cat, a)) cibles.push({ x: a.x, y: a.y });
  }
  return cibles;
}

/** Un transport allié dans lequel monter, et les tours que cela ferait gagner. */
interface Embarquement { transport: Unite; gain: number }

/**
 * Transports alliés qui rapprochent l'unité de son objectif plus vite que ses
 * jambes : on compare les tours à pied aux tours embarqué — monter ce tour-ci,
 * rouler jusqu'à une case de dépose (`casesDepose` : d'où le passager agit au
 * tour suivant), débarquer, et agir seulement le tour suivant, puisqu'un
 * débarqué ne joue plus (§2, phase 6). Une île ne se rejoint qu'ainsi : à pied,
 * l'objectif est à l'infini, et le transport est alors le seul chemin.
 */
function embarquementsUtiles(
  etat: EtatPartie, cat: Catalogue, u: Unite, dist: Int32Array, cleCibles: string, distDepart: number,
): Embarquement[] {
  if (distDepart === 0) return [];
  const type = cat.unites[u.type]!;
  if (estSoutien(type)) return [];
  const toursPied = distDepart < 0 ? Number.POSITIVE_INFINITY : toursPour(distDepart, pointsMouvement(etat, cat, u));
  const sortie: Embarquement[] = [];
  for (const t of etat.unites) {
    if (t.camp !== u.camp || t.dansTransport || !peutEmbarquer(cat, t, u)) continue;
    const depose = deposesPour(etat, cat, t, u, dist, cleCibles);
    const distT = distances(etat, cat, t, depose, `${t.camp}|${t.type}|depose|${u.type}|${cleCibles}`);
    const d = distT[t.y * etat.largeur + t.x] ?? -1;
    if (d < 0) continue;
    const attente = t.etat === 'prete' ? 0 : 1;
    const tours = attente + toursPour(d, pointsMouvement(etat, cat, t)) + 1;
    const gain = Number.isFinite(toursPied) ? toursPied - tours : Math.max(1, 6 - tours);
    if (gain >= 1) sortie.push({ transport: t, gain });
  }
  return sortie;
}

/** Une dépose possible : quel passager, où, et ce qu'elle vaut. */
interface Depose {
  passager: Unite;
  vers: Case;
  score: number;
}

/** Meilleure action pour une unité donnée, tous déplacements et suites confondus. */
export function meilleureOption(
  etat: EtatPartie, cat: Catalogue, u: Unite, poids: Poids,
): Option {
  const type = cat.unites[u.type]!;
  const p = porteePrudente(etat, cat, u);
  const etoiles = defenses(etat, cat);
  const liste = frappeurs(etat, cat, u);
  const listeAir = liste.filter((f) => f.vol);
  const estCapteur = capteur(cat, u);
  const soutien = estSoutien(type);
  const passagers = u.cargo
    .map((id) => etat.unites.find((x) => x.id === id))
    .filter((x): x is Unite => x !== undefined);
  const premier = passagers[0];

  // Vers quoi marcher : un transport chargé va déposer son premier passager là
  // où celui-ci agit au tour suivant, un soutien vide cherche ses clients, les
  // autres leurs objectifs propres.
  let cibles: Case[];
  let cleCibles: string;
  if (soutien && premier) {
    const obj = objectifsDe(etat, cat, premier);
    const distPremier = distances(etat, cat, premier, obj.cibles, `${premier.camp}|${premier.type}|${obj.cle}`);
    cibles = deposesPour(etat, cat, u, premier, distPremier, obj.cle);
    cleCibles = `t|${premier.type}|${obj.cle}|depose`;
  } else if (soutien) {
    cibles = objectifsSoutien(etat, cat, u);
    cleCibles = `t|${u.id}|soutien`;
  } else {
    const obj = objectifsDe(etat, cat, u);
    cibles = obj.cibles;
    cleCibles = obj.cle;
  }
  const dist = distances(etat, cat, u, cibles, `${u.camp}|${u.type}|${cleCibles}`);
  const largeur = etat.largeur;
  const depart = u.y * largeur + u.x;
  const distDepart = dist[depart] ?? -1;
  const coutMoi = type.cout;
  const pvMoi = pvAffiches(u.pv);
  const mouvement = pointsMouvement(etat, cat, u);
  // Un transport plein risque aussi ce qu'il porte.
  const coutMenace = coutMoi + valeurEmbarquee(etat, cat, u);

  // On retient la case et la suite, jamais le chemin : il ne se reconstruit
  // qu'une fois, pour l'option gagnante.
  let meilleurScore = -Infinity;
  let meilleureCase: Case = { x: u.x, y: u.y };
  let meilleureSuite: Suite = { type: 'rien' };
  const retenir = (score: number, c: Case, suite: Suite): void => {
    if (score <= meilleurScore) return;
    meilleurScore = score;
    meilleureCase = c;
    meilleureSuite = suite;
  };

  // Occupation, adversaires connus et alliés, lus une fois pour toute la décision.
  const occupees = new Uint8Array(largeur * etat.hauteur);
  const adversaires = adversairesConnus(etat, cat, u.camp);
  const allies: Unite[] = [];
  for (const autre of etat.unites) {
    if (autre.dansTransport || !sontAllies(etat, autre.camp, u.camp)) continue;
    if (autre.id !== u.id) {
      occupees[autre.y * largeur + autre.x] = 1;
      allies.push(autre);
    }
  }
  for (const a of adversaires) occupees[a.y * largeur + a.x] = 1;

  // Logistique : ce dont cette unité a besoin, et où elle le trouve.
  const aerienne = type.domaine === 'air' && type.carburant !== null && u.carburant !== null;
  const distRetour = aerienne
    ? distances(etat, cat, u, casesRetour(etat, cat, u), `${u.camp}|${u.type}|retour|${u.id}`)
    : null;
  const enManque = !soutien && (munitionsFaibles(type, u) || carburantFaible(etat, cat, type, u));
  const distSources = enManque
    ? distances(etat, cat, u, sourcesRavitaillement(etat, cat, u), `${u.camp}|${u.type}|sources`)
    : null;
  const distSourcesDepart = distSources ? (distSources[depart] ?? -1) : -1;
  const embarquements = soutien ? [] : embarquementsUtiles(etat, cat, u, dist, cleCibles, distDepart);
  const porteurs = aerienne ? porteursRavitaillant(etat, cat, u) : [];
  const vues = visibles(etat, cat, u.camp);
  const capturable = capturables(etat, cat);

  // Furtivité (trait `furtif`, catalogue 6) : cachée, l'unité n'est repérée
  // qu'au contact sous brouillard, et brûle `SURCOUT_CARBURANT_FURTIF` de plus
  // par tour — un prix en fonds, la part du plein qu'un tour de cachette coûte.
  const furtif = porte(type, 'furtif') && type.carburant !== null;
  const cachee = u.furtive === true;
  const brume = brouillardActif(etat);
  const prixFurtivite = furtif && type.carburant
    ? (poids.echange * coutMoi * SURCOUT_CARBURANT_FURTIF) / Math.max(1, type.carburant.max) / 1000
    : 0;
  const parTour = consommationParTour(type, u);
  const parTourBascule = furtif ? consommationParTour(type, { ...u, furtive: !cachee }) : parTour;

  // Escorte : une pièce qui ne frappe pas l'air ne s'avance pas seule sous un
  // ciel adverse ; la menace aérienne compte double loin de tout allié anti-air.
  const sansAntiAir = listeAir.length > 0 && !frappeLAir(cat, u.type);
  const escortes = sansAntiAir ? allies.filter((a) => frappeLAir(cat, a.type)) : [];

  // Ce que chaque passager gagnerait à être posé : calculé par case de dépose.
  const distPassagers = new Map<string, Int32Array>();
  for (const passager of passagers) {
    const obj = objectifsDe(etat, cat, passager);
    distPassagers.set(passager.id, distances(etat, cat, passager, obj.cibles, `${passager.camp}|${passager.type}|${obj.cle}`));
  }

  /** Pénalité de carburant d'une unité aérienne arrivée en `c`, pour une consommation par tour donnée. */
  const penaliteCarburant = (indice: number, coutChemin: number, conso: number): number => {
    if (!aerienne || !distRetour || !type.carburant) return 0;
    let penalite = 0;
    const restant = u.carburant! - coutChemin * type.carburant.parCase;
    const dRetour = distRetour[indice] ?? -1;
    if (dRetour >= 0) {
      const autonomie = autonomieSecurite(type, restant, dRetour, mouvement, poids.reserve, conso);
      if (autonomie < 0) penalite += poids.carburant * -autonomie;
    }
    // À sec au prochain réveil, elle est perdue — sauf posée là où l'on fait le plein.
    if (dRetour !== 0 && restant - conso <= 0) penalite += (poids.echange * coutMoi) / 1000;
    return penalite;
  };

  for (let indice = 0; indice < p.couts.length; indice += 1) {
    const coutChemin = p.couts[indice] ?? -1;
    if (coutChemin < 0) continue;
    if (occupees[indice] === 1) continue;
    const x = indice % largeur;
    const c: Case = { x, y: (indice - x) / largeur };
    const etoilesIci = etoiles[indice] ?? 0;
    const aBouge = c.x !== u.x || c.y !== u.y;

    // À valeur égale, une unité bouge le moins possible : c'est ce qui garde
    // les groupes soudés et rend les choix reproductibles.
    let base = poids.terrain * etoilesIci - 0.01 * coutChemin;
    const d = dist[indice] ?? -1;
    if (d >= 0 && distDepart >= 0) base += poids.progression * (distDepart - d);
    else if (d >= 0) base += poids.progression;
    const menacePleine = menace(liste, c, etoilesIci, pvMoi, coutMenace);
    const menaceCachee = brume ? menacePleine * PART_MENACE_FURTIVE : menacePleine;
    const menaceIci = cachee ? menaceCachee : menacePleine;
    base -= (poids.securite * menaceIci) / 1000;
    if (cachee) base -= prixFurtivite;

    // Carburant : une unité aérienne garde de quoi rentrer se poser — sur un
    // bâtiment ou un porteur —, avec la réserve de sa personnalité.
    const penalite = penaliteCarburant(indice, coutChemin, parTour);
    base -= penalite;

    // À court de munitions ou de carburant : chaque pas vers une source compte.
    if (distSources && distSourcesDepart >= 0) {
      const dS = distSources[indice] ?? -1;
      if (dS >= 0) base += poids.ravitaillement * (distSourcesDepart - dS);
    }

    // Sous un ciel adverse, sans escorte à portée : la menace aérienne compte double.
    if (sansAntiAir) {
      const menaceAir = menace(listeAir, c, etoilesIci, pvMoi, coutMenace) * (cachee && brume ? PART_MENACE_FURTIVE : 1);
      if (menaceAir > 0 && !escortes.some((a) => manhattan(a, c) <= RAYON_ESCORTE)) {
        base -= (poids.securite * menaceAir) / 1000;
      }
    }

    // Une unité qui ne capture pas ne campe pas sur un bâtiment à prendre quand
    // un capteur ami est tout près : elle bloquerait sa propre capture. Loin de
    // tout capteur, occuper une usine adverse reste une façon de la boucher.
    if (!estCapteur && capturable[indice] === 1 && etat.proprietaires[cleCase(c)] !== u.camp
      && !(porte(type, 'genie') && peutCapturerIci(etat, cat, { ...u, x: c.x, y: c.y }))
      && capteursProches(etat, cat, u, c)) {
      base -= poids.capture * 0.5;
    }

    // Une pièce indirecte garde ses distances au lieu de gagner quelques cases
    // de progression au prix d'un contact sans riposte. Les menaces restent
    // exclusivement celles que son équipe connaît.
    if (porte(type, 'tir_indirect')) {
      base -= (poids.securite * menaceIci) / 1000;
      for (const a of adversaires) {
        if (manhattan(a, c) < type.portee[0] && degatsArme(cat, a, u.type) > 0) {
          base -= poids.progression * 2;
        }
      }
    }

    // Attendre sur place ou se replacer.
    retenir(base, c, { type: 'rien' });

    // Se cacher quand une menace peut atteindre l'arrivée et que le carburant
    // le permet ; se montrer quand rien ne menace et que le carburant presse.
    // On ne se cache que sous brouillard : au grand jour, la furtivité ne
    // cache rien et ne fait que brûler du carburant.
    if (furtif && (cachee || brume)) {
      let bascule = base + (poids.securite * menaceIci) / 1000 - (poids.securite * (cachee ? menacePleine : menaceCachee)) / 1000;
      bascule += cachee ? prixFurtivite : -prixFurtivite;
      bascule += penalite - penaliteCarburant(indice, coutChemin, parTourBascule);
      retenir(bascule, c, { type: 'furtivite' });
    }

    // Ouvrir un passage seulement si une unité amie mécanisée peut en profiter.
    if (porte(type, 'genie')) {
      const fictive: Unite = { ...u, ...c };
      for (const cible of constructionsPossibles(etat, cat, fictive)) {
        const utile = etat.unites.some((a) => a.camp === u.camp && a.id !== u.id
          && ['roues', 'chenilles'].includes(cat.unites[a.type]?.typeMouvement ?? '')
          && Math.abs(a.x - cible.x) + Math.abs(a.y - cible.y) <= 4);
        if (utile) retenir(base + 2, c, { type: 'construire', cible });
      }
    }

    // Capturer, ou remettre en service pour le génie : `peutCapturerIci` sait lequel.
    if (estCapteur || porte(type, 'genie')) {
      const fictive: Unite = { ...u, x: c.x, y: c.y };
      if (peutCapturerIci(etat, cat, fictive)) {
        const points = pointsGagnes(etat, cat, fictive);
        const terrain = terrainBrut(etat, cat, c);
        const facteur = terrain === 'qg' ? poids.qg : 1;
        const seuil = seuilCapture(etat, cat, fictive);
        const acquis = aBouge ? 0 : u.pointsCapture;
        const acheve = points + acquis >= seuil ? 1.5 : 1;
        retenir(base + poids.capture * ((points + acquis) / seuil) * facteur * acheve, c, { type: 'capturer' });
      }
    }

    // Embarquer : la voisine d'un transport qui fait gagner des tours.
    for (const { transport, gain } of embarquements) {
      if (manhattan(c, transport) !== 1) continue;
      retenir(base + poids.embarquement * gain, c, { type: 'embarquer', transport: transport.id });
    }

    // Se poser sur un porteur : une unité aérienne qui n'a plus l'autonomie de
    // rentrer, ou qui est à court, monte dans un porteur allié qui fait le
    // plein en cale — c'est son aéroport quand aucun n'est à portée.
    if (penalite > 0 || enManque) {
      for (const porteur of porteurs) {
        if (manhattan(c, porteur) !== 1 || !peutEmbarquer(cat, porteur, u)) continue;
        retenir(base + penalite + (poids.ravitaillement * manque(cat, u)) / 1000, c, { type: 'embarquer', transport: porteur.id });
      }
    }

    // Ravitailler un voisin à court : gratuit, et d'autant plus utile qu'il manque.
    if (porte(type, 'ravitaillement')) {
      for (const a of allies) {
        if (manhattan(a, c) !== 1) continue;
        const m = manque(cat, a);
        if (m <= 0) continue;
        retenir(base + (poids.ravitaillement * m) / 1000, c, { type: 'ravitailler', cible: { x: a.x, y: a.y } });
      }
    }

    // Débarquer : chaque passager là où il agit au tour suivant, ou dès que le
    // transport est menacé — un transport plein qui tombe perd tout ce qu'il
    // porte. Deux passagers qui ont chacun une case utile sortent en un ordre.
    if (passagers.length > 0) {
      const deposes: Depose[] = [];
      for (const passager of passagers) {
        const typePassager = cat.unites[passager.type];
        const distPassager = distPassagers.get(passager.id);
        if (!typePassager || !distPassager) continue;
        const listePassager = frappeurs(etat, cat, passager);
        const coutPassager = typePassager.cout;
        const pvPassager = pvAffiches(passager.pv);
        const risqueGarde = menace(liste, c, etoilesIci, pvMoi, coutPassager);
        for (const v of voisines(c)) {
          if (v.x < 0 || v.y < 0 || v.x >= largeur || v.y >= etat.hauteur) continue;
          const iv = v.y * largeur + v.x;
          if (occupees[iv] === 1 || iv === depart) continue;
          if (coutEntree(etat, cat, passager, v) === null) continue;
          const dv = distPassager[iv] ?? -1;
          const pose: Unite = { ...passager, x: v.x, y: v.y, dansTransport: null };
          let valeur = 0;
          if (dv === 0 && peutCapturerIci(etat, cat, pose)) valeur = 3;
          else if (dv >= 0 && dv <= pointsMouvement(etat, cat, passager)) valeur = 2;
          else if (dv >= 0 && dv <= 2 * pointsMouvement(etat, cat, passager)) valeur = 0.5;
          const etoilesV = etoiles[iv] ?? 0;
          const risquePose = menace(listePassager, v, etoilesV, pvPassager, coutPassager);
          const securite = (poids.securite * (risqueGarde - risquePose)) / 1000;
          if (valeur <= 0 && securite <= 0) continue;
          deposes.push({ passager, vers: v, score: poids.debarquement * valeur + securite });
        }
      }
      if (deposes.length > 0) {
        // Le meilleur d'abord, à égalité l'ordre de la cale : déterministe.
        deposes.sort((a, b) => b.score - a.score
          || u.cargo.indexOf(a.passager.id) - u.cargo.indexOf(b.passager.id)
          || (a.vers.y * largeur + a.vers.x) - (b.vers.y * largeur + b.vers.x));
        const casesPrises = new Set<string>();
        const passagersPoses = new Set<string>();
        const retenues: Depose[] = [];
        let total = 0;
        for (const dep of deposes) {
          const k = cleCase(dep.vers);
          if (casesPrises.has(k) || passagersPoses.has(dep.passager.id)) continue;
          casesPrises.add(k);
          passagersPoses.add(dep.passager.id);
          retenues.push(dep);
          total += dep.score;
        }
        const [tete, ...reste] = retenues;
        if (tete) {
          const suite: Suite = { type: 'debarquer', vers: tete.vers };
          if (tete.passager.id !== u.cargo[0]) suite.passager = tete.passager.id;
          if (reste.length > 0) {
            suite.autres = reste.map((dep): Debarquement => ({ vers: dep.vers, passager: dep.passager.id }));
          }
          retenir(base + total, c, suite);
        }
      }
    }

    // Attaquer : valeur d'échange, riposte comprise. Une unité à sec tire avec
    // ce qui lui reste (`degatsArme`), et la dernière munition a un prix.
    for (const cible of adversaires) {
      const distance = Math.abs(cible.x - c.x) + Math.abs(cible.y - c.y);
      if (distance < type.portee[0] || distance > type.portee[1]) continue;
      if (!peutTirerSur(cat, u, cible.type)) continue;
      if (vues && !vues.has(cleCase(cible))) continue;
      const fictive: Unite = { ...u, x: c.x, y: c.y };
      if (!peutViser(etat, cat, fictive, cible, c, aBouge).ok) continue;
      const degats = degatsAttendus(etat, cat, fictive, cible, c);
      const coutCible = cat.unites[cible.type]?.cout ?? 0;
      const gain = (degats / 100) * coutCible;
      let perte = 0;
      const tc = cat.unites[cible.type];
      const survivant = cible.pv - degats;
      if (tc && tc.peutRiposter && distance === 1 && survivant > 0
        && peutTirerSur(cat, { ...cible, pv: survivant }, u.type)) {
        const riposteur: Unite = { ...cible, pv: survivant };
        // La riposte est atténuée par le moteur (`FACTEUR_RIPOSTE`) : l'IA lit
        // le facteur au lieu d'en garder une copie. Sans lui, elle surestimerait
        // ce qu'elle encaisse et refuserait des échanges qu'elle gagne — c'est
        // exactement la faute du 8 septembre, où sa copie de la formule de
        // dégâts a menti dès que l'originale a changé.
        perte = (degatsAttendus(etat, cat, riposteur, fictive, cible) / 100) * coutMoi * FACTEUR_RIPOSTE;
      }
      const acheve = survivant <= 0 ? coutCible * 0.25 : 0;
      // Une munition ne part que si l'unité en a et que la cible n'est pas secondaire.
      let prixMunition = 0;
      if (type.munitions !== null && (u.munitions ?? 0) > 0 && !tireSansMunitions(type, cible.type)) {
        prixMunition = (poids.munitions * coutMoi) / 1000 / Math.max(1, u.munitions ?? 1);
      }
      retenir(
        base + (poids.echange * (gain - perte + acheve)) / 1000 - prixMunition,
        c,
        { type: 'attaquer', cible: { x: cible.x, y: cible.y } },
      );
    }
  }

  const chemin = cheminVers(p, { x: u.x, y: u.y }, meilleureCase)
    ?? [{ x: u.x, y: u.y }];
  return {
    score: meilleurScore,
    action: { type: 'ordre', uniteId: u.id, chemin, suite: meilleureSuite },
  };
}

/** Distance à laquelle un capteur adverse justifie de boucher le QG d'une recrue. */
const RAYON_MENACE_QG = 8;

/**
 * Achat : d'abord de quoi capturer, ensuite ce qui contre le mix adverse —
 * connu, et ce que ses bâtiments peuvent produire (`mixPotentiel`) —, et
 * l'épargne : si une unité hors de prix, atteignable en `TOURS_EPARGNE`
 * journées de revenus, vaut `MARGE_EPARGNE` fois la meilleure abordable, on
 * n'achète rien ce tour. Sauf quand les capteurs manquent : la capture n'attend pas.
 */
export function meilleureProduction(
  etat: EtatPartie, cat: Catalogue, camp: CampId, poids: Poids,
): Action | null {
  const caisse = etat.camps.find((c) => c.id === camp);
  if (!caisse) return null;
  const manque = compterCapteurs(etat, cat, camp) < poids.capteursVises;
  const mix = menaceParType(etat, cat, camp);
  const menaces: Record<CleUnite, number> = { ...mix };
  for (const [cle, n] of Object.entries(mixPotentiel(etat, cat, camp))) menaces[cle] = (menaces[cle] ?? 0) + n;
  const contre: Contre = { menaces, poids: poids.contre };
  const mienne = armeeParType(etat, camp);
  const budget = Math.max(0, caisse.fonds * poids.engagement);
  const revenus = batimentsDe(etat, camp).length * etat.reglages.revenusParBatiment * multiplicateurFonds(etat, camp);
  const atteignable = Math.max(0, (caisse.fonds + TOURS_EPARGNE * revenus) * poids.engagement);
  let meilleur: { score: number; action: Action } | null = null;
  let attendu: { score: number } | null = null;
  const scores = new Map<CleUnite, number>();
  const scoreDe = (cle: CleUnite): number => {
    let s = scores.get(cle);
    if (s === undefined) {
      s = scoreAchat(etat, cat, cle, mix, mienne, manque, camp, contre);
      scores.set(cle, s);
    }
    return s;
  };
  // Le QG ne sert de chaîne de montage qu'en dernier recours : une recrue posée
  // dessus chaque journée le rend imprenable par occupation, et un QG qu'on ne
  // peut jamais prendre vide la condition de victoire `capture_qg` de son sens.
  // Sauf quand un capteur adverse connu est déjà à portée : là, boucher le QG
  // d'une recrue est la seule défense qui ne coûte pas un tour.
  const caisseQg = caisse.qgCase;
  const menace = caisseQg !== null && adversairesConnus(etat, cat, camp).some((u) => {
    if (!capteur(cat, u)) return false;
    const [x, y] = caisseQg.split(',');
    return Math.abs(u.x - Number(x)) + Math.abs(u.y - Number(y)) <= RAYON_MENACE_QG;
  });
  const libres = usinesLibres(etat, cat, camp);
  const horsQg = menace ? libres : libres.filter((c) => cleCase(c) !== caisseQg);
  for (const usine of horsQg.length > 0 ? horsQg : libres) {
    const terrain = terrainLogique(etat, cat, usine);
    if (terrain === null) continue;
    for (const cle of produitesPar(cat, terrain, etat, camp)) {
      const t = cat.unites[cle];
      if (!t || t.cout > atteignable) continue;
      const verdict = verifierProduction(etat, cat, camp, usine, cle);
      if (t.cout > budget) {
        // Inabordable aujourd'hui, atteignable demain : ne bute que sur les fonds.
        if (!verdict.ok && verdict.motif !== 'fonds_insuffisants') continue;
        const score = scoreDe(cle);
        if (!attendu || score > attendu.score) attendu = { score };
        continue;
      }
      if (!verdict.ok) continue;
      const score = scoreDe(cle);
      if (!meilleur || score > meilleur.score) {
        meilleur = { score, action: { type: 'produire', batiment: usine, unite: cle } };
      }
    }
  }
  if (attendu && !manque && (!meilleur || attendu.score > MARGE_EPARGNE * meilleur.score)) return null;
  return meilleur ? meilleur.action : null;
}

/** Fabrique une stratégie à partir d'un jeu de poids. */
export function strategieAvec(id: string, poids: Poids): Strategie {
  return {
    id,
    poids,
    choisirAction(etat: EtatPartie, camp: CampId, rng: Rng, cat: Catalogue): Action {
      void rng;
      const pretes = etat.unites
        .filter((u) => u.camp === camp && u.etat === 'prete' && u.dansTransport === null)
        .sort((a, b) => {
          const pa = prioriteUnite(etat, cat, a);
          const pb = prioriteUnite(etat, cat, b);
          if (pa !== pb) return pa - pb;
          const ca = cat.unites[b.type]?.cout ?? 0;
          const cb = cat.unites[a.type]?.cout ?? 0;
          if (ca !== cb) return ca - cb;
          return a.id < b.id ? -1 : 1;
        });
      const unite = pretes[0];
      if (unite) {
        const option = meilleureOption(etat, cat, unite, poids);
        return option.action;
      }
      const achat = meilleureProduction(etat, cat, camp, poids);
      if (achat) return achat;
      return { type: 'finTour' };
    },
  };
}

/** La stratégie pondérée. */
export const PONDEREE: Strategie = strategieAvec('ponderee', POIDS_PONDEREE);
