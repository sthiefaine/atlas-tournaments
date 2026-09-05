/**
 * `ponderee` — l'adversaire par défaut (`doc/02-architecture.md` §3.2).
 *
 * Quatre termes, et quatre seulement : la **capture** (c'est elle qui gagne les
 * matchs), la **valeur d'échange** (les fonds pris à l'adversaire moins les
 * fonds risqués), la **sécurité** (la menace subie sur la case d'arrivée) et la
 * **progression** vers l'objectif atteignable le plus proche. La production
 * équilibre l'armée : d'abord de quoi capturer, ensuite ce qui contre le mix
 * adverse, sans jamais engager plus que sa part de fonds.
 *
 * L'IA ne fait que ce qu'un joueur peut faire : elle passe par `appliquer`, lit
 * le climat comme lui, et ne tire ses aléas que du flux qu'on lui donne.
 */

import type {
  Action, Catalogue, EtatPartie, Rng, Suite, Unite,
} from '../../engine/index';
import { constructionsPossibles } from '../../engine/regles/genie';
import { degatsBase, produitesPar } from '../../engine/catalogue';
import { terrainBrut, terrainLogique } from '../../engine/hooks';
import { peutCapturerIci, pointsGagnes, SEUIL_CAPTURE } from '../../engine/regles/capture';
import { peutViser } from '../../engine/regles/combat';
import { verifierProduction } from '../../engine/regles/economie';
import { cheminVers, pointsMouvement, portee } from '../../engine/regles/mouvement';
import { porte, pvAffiches } from '../../engine/types';
import type { Case, CampId } from '../../schemas/index';
import {
  armeeParType, capteur, compterCapteurs, degatsAttendus, distances, memoire,
  menaceParType, objectifsCapture, objectifsCombat, scoreAchat, usinesLibres,
} from '../evaluation';
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
};

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

/** Adversaires qui peuvent frapper une case, avec leur base de dégâts. */
interface Frappeur {
  base: number;
  pv: number;
  allonge: number;
  x: number;
  y: number;
  portee: number;
}

function frappeurs(etat: EtatPartie, cat: Catalogue, u: Unite): Frappeur[] {
  const memo = memoire(etat);
  const cle = `frappeurs|${u.camp}|${u.type}`;
  const connus = memo.get(cle) as Frappeur[] | undefined;
  if (connus) return connus;
  const sortie: Frappeur[] = [];
  for (const a of etat.unites) {
    if (a.camp === u.camp || a.dansTransport) continue;
    const ta = cat.unites[a.type];
    if (!ta) continue;
    const base = degatsBase(cat, a.type, u.type);
    if (base <= 0) continue;
    sortie.push({
      base,
      pv: pvAffiches(a.pv),
      allonge: pointsMouvement(etat, cat, a) + ta.portee[1],
      x: a.x,
      y: a.y,
      portee: ta.portee[1],
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
    if (d > f.allonge) continue;
    const fTerrain = 1 - 0.05 * etoiles * (pvMoi / 10);
    const degats = f.base * (f.pv / 10) * fTerrain;
    total += (degats / 100) * coutMoi * (d <= f.portee ? 1 : 0.6);
  }
  return total;
}

/** Une option évaluée : où aller, quoi faire, et ce que ça vaut. */
interface Option {
  score: number;
  action: Action;
}

/** Ordre de jeu des unités : finir les captures, frapper, puis avancer. */
function prioriteUnite(etat: EtatPartie, cat: Catalogue, u: Unite): number {
  const t = cat.unites[u.type];
  if (!t) return 9;
  if (capteur(cat, u) && peutCapturerIci(etat, cat, u)) return 0;
  if (porte(t, 'tir_indirect')) return 1;
  if (!capteur(cat, u)) return 2;
  return 3;
}

/** Meilleure action pour une unité donnée, tous déplacements et suites confondus. */
export function meilleureOption(
  etat: EtatPartie, cat: Catalogue, u: Unite, poids: Poids,
): Option {
  const type = cat.unites[u.type]!;
  const p = portee(etat, cat, u);
  const etoiles = defenses(etat, cat);
  const liste = frappeurs(etat, cat, u);
  const estCapteur = capteur(cat, u);
  const cibles = estCapteur
    ? objectifsCapture(etat, cat, u.camp)
    : [...objectifsCombat(etat, u.camp), ...objectifsCapture(etat, cat, u.camp)];
  const dist = distances(etat, cat, u, cibles, `${u.camp}|${u.type}|${estCapteur ? 'c' : 'x'}`);
  const depart = u.y * etat.largeur + u.x;
  const distDepart = dist[depart] ?? -1;
  const coutMoi = type.cout;
  const pvMoi = pvAffiches(u.pv);

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

  // Occupation et adversaires, lus une fois pour toute la décision.
  const occupees = new Uint8Array(etat.largeur * etat.hauteur);
  const adversaires: Unite[] = [];
  for (const autre of etat.unites) {
    if (autre.dansTransport) continue;
    if (autre.id !== u.id) occupees[autre.y * etat.largeur + autre.x] = 1;
    if (autre.camp !== u.camp) adversaires.push(autre);
  }
  const aDesMunitions = type.munitions === null || (u.munitions ?? 0) > 0;

  for (let indice = 0; indice < p.couts.length; indice += 1) {
    if ((p.couts[indice] ?? -1) < 0) continue;
    if (occupees[indice] === 1) continue;
    const x = indice % etat.largeur;
    const c: Case = { x, y: (indice - x) / etat.largeur };
    const etoilesIci = etoiles[indice] ?? 0;
    const aBouge = c.x !== u.x || c.y !== u.y;

    // À valeur égale, une unité bouge le moins possible : c'est ce qui garde
    // les groupes soudés et rend les choix reproductibles.
    let base = poids.terrain * etoilesIci - 0.01 * (p.couts[indice] ?? 0);
    const d = dist[indice] ?? -1;
    if (d >= 0 && distDepart >= 0) base += poids.progression * (distDepart - d);
    else if (d >= 0) base += poids.progression;
    base -= (poids.securite * menace(liste, c, etoilesIci, pvMoi, coutMoi)) / 1000;

    // Attendre sur place ou se replacer.
    retenir(base, c, { type: 'rien' });

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

    // Capturer.
    if (estCapteur) {
      const fictive: Unite = { ...u, x: c.x, y: c.y };
      if (peutCapturerIci(etat, cat, fictive)) {
        const points = pointsGagnes(etat, cat, fictive);
        const terrain = terrainBrut(etat, cat, c);
        const facteur = terrain === 'qg' ? poids.qg : 1;
        const acheve = points >= SEUIL_CAPTURE ? 1.5 : 1;
        retenir(base + poids.capture * (points / SEUIL_CAPTURE) * facteur * acheve, c, { type: 'capturer' });
      }
    }

    // Attaquer : valeur d'échange, riposte comprise.
    if (aDesMunitions) {
      for (const cible of adversaires) {
        const portee = Math.abs(cible.x - c.x) + Math.abs(cible.y - c.y);
        if (portee < type.portee[0] || portee > type.portee[1]) continue;
        const fictive: Unite = { ...u, x: c.x, y: c.y };
        if (!peutViser(etat, cat, fictive, cible, c, aBouge).ok) continue;
        const degats = degatsAttendus(etat, cat, fictive, cible, c);
        const coutCible = cat.unites[cible.type]?.cout ?? 0;
        const gain = (degats / 100) * coutCible;
        let perte = 0;
        const tc = cat.unites[cible.type];
        const survivant = cible.pv - degats;
        if (tc && tc.peutRiposter && portee === 1 && survivant > 0) {
          const riposteur: Unite = { ...cible, pv: survivant };
          perte = (degatsAttendus(etat, cat, riposteur, fictive, cible) / 100) * coutMoi;
        }
        const acheve = survivant <= 0 ? coutCible * 0.25 : 0;
        retenir(
          base + (poids.echange * (gain - perte + acheve)) / 1000,
          c,
          { type: 'attaquer', cible: { x: cible.x, y: cible.y } },
        );
      }
    }
  }

  const chemin = cheminVers(p, { x: u.x, y: u.y }, meilleureCase)
    ?? [{ x: u.x, y: u.y }];
  return {
    score: meilleurScore,
    action: { type: 'ordre', uniteId: u.id, chemin, suite: meilleureSuite },
  };
}

/** Achat : d'abord de quoi capturer, ensuite ce qui contre le mix adverse. */
export function meilleureProduction(
  etat: EtatPartie, cat: Catalogue, camp: CampId, poids: Poids,
): Action | null {
  const caisse = etat.camps.find((c) => c.id === camp);
  if (!caisse) return null;
  const manque = compterCapteurs(etat, cat, camp) < poids.capteursVises;
  const mix = menaceParType(etat, camp);
  const mienne = armeeParType(etat, camp);
  const budget = Math.max(0, caisse.fonds * poids.engagement);
  let meilleur: { score: number; action: Action } | null = null;
  for (const usine of usinesLibres(etat, cat, camp)) {
    const terrain = terrainLogique(etat, cat, usine);
    if (terrain === null) continue;
    for (const cle of produitesPar(cat, terrain)) {
      const t = cat.unites[cle];
      if (!t || t.cout > budget) continue;
      if (!verifierProduction(etat, cat, camp, usine, cle).ok) continue;
      const score = scoreAchat(etat, cat, cle, mix, mienne, manque);
      if (!meilleur || score > meilleur.score) {
        meilleur = { score, action: { type: 'produire', batiment: usine, unite: cle } };
      }
    }
  }
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
