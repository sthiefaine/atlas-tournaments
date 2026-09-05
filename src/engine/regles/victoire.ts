/**
 * Conditions de victoire et de défaite, et décision aux points
 * (`doc/04-gameplay.md` §9). Elles sont évaluées après chaque action et en
 * fin de tour : une capture de QG termine la partie sur-le-champ.
 */

import type { CampId } from '../../schemas/index';
import { terrainBrut } from '../hooks';
import type { Catalogue, EtatPartie, EvenementJeu } from '../types';
import { cleCase, depuisCle } from '../types';
import { batimentsDe, producteursDe, valeurArmee } from './economie';

/**
 * Score d'un camp pour la décision aux points (§9.1) :
 * `5 × bâtiments + 10 × QG + valeur d'armée / 1000 + fonds / 2000`.
 */
export function score(etat: EtatPartie, cat: Catalogue, camp: CampId): number {
  const batiments = batimentsDe(etat, camp);
  let qg = 0;
  for (const k of batiments) {
    if (terrainBrut(etat, cat, depuisCle(k)) === 'qg') qg += 1;
  }
  const caisse = etat.camps.find((c) => c.id === camp);
  return 5 * batiments.length
    + 10 * qg
    + valeurArmee(etat, cat, camp) / 1000
    + (caisse ? caisse.fonds / 2000 : 0);
}

/** Neutralise les bâtiments d'un camp éliminé (§6). */
function neutraliser(etat: EtatPartie, camp: CampId): void {
  for (const [k, c] of Object.entries(etat.proprietaires)) {
    if (c === camp) delete etat.proprietaires[k];
  }
}

/** Met à jour l'élimination de chaque camp : QG perdu, ou plus rien en jeu. */
export function majEliminations(
  etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[],
): void {
  for (const camp of etat.camps) {
    if (camp.elimine) continue;
    const unites = etat.unites.filter((u) => u.camp === camp.id).length;
    const producteurs = producteursDe(etat, cat, camp.id).length;
    const qgPerdu = camp.qgCase !== null && etat.proprietaires[camp.qgCase] !== camp.id;
    if (!qgPerdu && (unites > 0 || producteurs > 0)) continue;
    camp.elimine = true;
    neutraliser(etat, camp.id);
    etat.unites = etat.unites.filter((u) => u.camp !== camp.id);
    evts.push({
      type: 'annonce',
      texte: qgPerdu
        ? `Le camp ${camp.id} perd son QG : il quitte le match.`
        : `Le camp ${camp.id} n'a plus rien en jeu.`,
      icone: 'elimination',
    });
  }
}

/** Camp gagnant aux points, ou `null` en cas d'égalité parfaite. */
export function vainqueurAuxPoints(etat: EtatPartie, cat: Catalogue): CampId | null {
  let meilleur: CampId | null = null;
  let meilleurScore = -Infinity;
  let egalite = false;
  for (const camp of etat.camps) {
    if (camp.elimine) continue;
    const s = score(etat, cat, camp.id);
    if (s > meilleurScore + 1e-9) {
      meilleurScore = s;
      meilleur = camp.id;
      egalite = false;
    } else if (Math.abs(s - meilleurScore) <= 1e-9) {
      egalite = true;
    }
  }
  return egalite ? null : meilleur;
}

/** Objectifs de scénario du camp 0, évalués après chaque action. */
function objectifsCamp0(etat: EtatPartie, cat: Catalogue): string | null {
  for (const v of etat.reglages.victoire) {
    if (v.type === 'capturer') {
      const pris = v.cases.filter((c) => etat.proprietaires[cleCase(c)] === 0).length;
      if (pris >= v.combien) return 'objectif_capturer';
    } else if (v.type === 'survivre') {
      if (etat.journee >= v.journees) return 'objectif_survivre';
    } else if (v.type === 'tenir') {
      const tout = v.cases.every((c) => etat.proprietaires[cleCase(c)] === 0);
      if (tout && etat.journee >= v.journees) return 'objectif_tenir';
    } else if (v.type === 'points') {
      if (score(etat, cat, 0) >= v.seuil) return 'objectif_points';
    }
  }
  return null;
}

/** Défaites de scénario du camp 0. */
function defaitesCamp0(etat: EtatPartie): string | null {
  for (const d of etat.reglages.defaite) {
    if (d.type === 'unite_perdue') {
      if (!etat.unites.some((u) => u.camp === 0 && u.id === d.uniteRef)) return 'unite_protegee_perdue';
    } else if (d.type === 'case_perdue') {
      if (d.cases.some((c) => {
        const p = etat.proprietaires[cleCase(c)];
        return p !== undefined && p !== 0;
      })) return 'case_perdue';
    }
  }
  return null;
}

/**
 * Évalue la fin de partie et écrit `etat.partie`. Un seul camp restant gagne ;
 * la limite de journées se décide aux points.
 */
export function evaluerFin(
  etat: EtatPartie, cat: Catalogue, evts: EvenementJeu[],
): void {
  if (etat.partie.terminee) return;
  majEliminations(etat, cat, evts);
  const restants = etat.camps.filter((c) => !c.elimine);
  const finir = (vainqueur: CampId | null, motif: string, nul = false): void => {
    etat.partie = { terminee: true, vainqueur, nul, motif };
    evts.push({ type: 'fin_partie', vainqueur, nul, motif });
  };
  if (restants.length <= 1) {
    const seul = restants[0];
    finir(seul ? seul.id : null, 'hors_jeu_total', seul === undefined);
    return;
  }
  const objectif = objectifsCamp0(etat, cat);
  if (objectif) {
    finir(0, objectif);
    return;
  }
  const defaite = defaitesCamp0(etat);
  if (defaite) {
    const autre = restants.find((c) => c.id !== 0);
    finir(autre ? autre.id : null, defaite);
    return;
  }
  const limite = etat.reglages.limiteJournees;
  if (limite !== null && etat.journee > limite) {
    const vainqueur = vainqueurAuxPoints(etat, cat);
    finir(vainqueur, 'limite_journees', vainqueur === null);
  }
}
