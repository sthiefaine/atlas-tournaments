/**
 * L'escorte (27 septembre 2026) : la protégée ne va que là où aucun adversaire
 * connu ne peut la frapper au prochain passage, file dès que l'arrivée est à sa
 * portée, et prend ce qui reste de risque quand le temps manque. Chaque règle
 * sur une situation construite à la main, où la bonne case se compte au doigt.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coutsJusqua, degatsAuPire, derniereJournee, escorteDuScenario, jouerTourEscorte, menaceEscorte,
  planEscorte, producteursAdversesPres, type Escorte,
} from '../../src/ai/escorte';
import type { Strategie } from '../../src/ai/index';
import {
  appliquer, creerPartie, creerRng, type Action, type CommandantMoteur, type Commandants, type EtatPartie,
  type ReglagesPartie,
} from '../../src/engine/index';
import type { CampId, CleUnite } from '../../src/schemas/index';
import { CAT, scenePersonnalisee } from '../engine/aides';

type Pose = { camp: CampId; type: CleUnite; x: number; y: number; pv?: number };

/** Une partie sur une grille écrite à la main : la protégée est toujours la première unité posée (`u1`). */
function partie(grille: string[], unites: Pose[], reglages: Partial<ReglagesPartie> = {}, proprietaires: Record<string, CampId> = {}): EtatPartie {
  return creerPartie(scenePersonnalisee(grille, proprietaires, unites, {
    brouillard: false, saisonForcee: 'ete', fondsDepart: 0, limiteJournees: 30, ...reglages,
  }), CAT, 'escorte');
}

const PLAINE = ['PPPPPPPPPPPPPP', 'PPPPPPPPPPPPPP', 'PPPPPPPPPPPPPP'];
const LOIN: Escorte = { uniteId: 'u1', destination: { x: 13, y: 1 } };

/** Un adversaire dont le super donne +1 de mouvement à toutes ses unités, pour six barres. */
const PRESSE: CommandantMoteur = {
  cle: 'cmd_essai', nom: 'essai', passif: null,
  pouvoir: { nom: 'p', barres: 3, effets: [], duree: 'ce_tour' },
  superPouvoir: {
    nom: 's', barres: 6, duree: 'ce_tour',
    effets: [{ cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } }],
  },
};

test('escorte : la protégée file sur l’arrivée dès qu’elle est à sa portée, et gagne', () => {
  const e = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'char_leger', x: 8, y: 1 },
  ], { victoire: [{ type: 'proteger', uniteRef: 'u1', destination: { x: 5, y: 1 } }] });
  const plan = planEscorte(e, CAT, { uniteId: 'u1', destination: { x: 5, y: 1 } });
  assert.ok(plan);
  assert.equal(plan.regle, 'destination');
  assert.deepEqual(plan.vers, { x: 5, y: 1 });
  // Le char pourrait frapper la case d'arrivée : cela ne compte pas, l'arrivée
  // gagne sur-le-champ, avant que l'adversaire ait rejoué.
  let etat = e;
  for (const a of plan.actions) {
    const r = appliquer(etat, a, CAT);
    assert.equal(r.ok, true);
    if (r.ok) etat = r.etat;
  }
  assert.deepEqual(etat.partie, { terminee: true, vainqueur: 0, nul: false, motif: 'objectif_proteger' });
});

test('escorte : elle n’avance pas sous le feu et s’arrête sur la case sûre la plus proche', () => {
  // Une infanterie en (9,1) frappe tout ce qui est à quatre pas d'elle (trois de
  // marche, un de tir). Le transport atteint (6,1), mais la première case hors
  // d'atteinte vers l'arrivée est (4,1).
  const e = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ]);
  const protegee = e.unites.find((u) => u.id === 'u1')!;
  const menace = menaceEscorte(e, CAT, protegee);
  assert.ok(degatsAuPire(e, CAT, { x: 6, y: 1 }, menace) > 0, 'à trois pas, elle se fait frapper');
  assert.ok(degatsAuPire(e, CAT, { x: 5, y: 1 }, menace) > 0, 'à quatre pas aussi');
  assert.equal(degatsAuPire(e, CAT, { x: 4, y: 1 }, menace), 0, 'à cinq pas, plus personne ne l’atteint');
  const plan = planEscorte(e, CAT, LOIN);
  assert.ok(plan);
  assert.equal(plan.regle, 'couverte');
  assert.deepEqual(plan.vers, { x: 4, y: 1 });
  assert.equal(plan.risque, 0);
});

test('escorte : une case que l’escorte ferme redevient sûre', () => {
  // Un couloir d'une case entre deux mers, un char adverse en (11,1) qui court
  // six cases. Seule, la protégée doit rester à (3,1). Avec un fantassin posé
  // en (7,1), le char bute sur lui — il ne le traverse pas et s'arrête à son
  // contact —, et (6,1) n'a plus de voisine d'où on puisse la frapper.
  const COULOIR = ['WWWWWWWWWWWWWW', 'PPPPPPPPPPPPPP', 'WWWWWWWWWWWWWW'];
  const seule = partie(COULOIR, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'char_leger', x: 11, y: 1 },
  ]);
  assert.deepEqual(planEscorte(seule, CAT, LOIN)?.vers, { x: 3, y: 1 }, 'seule, elle reste hors de la course du char');
  const couverte = partie(COULOIR, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'char_leger', x: 11, y: 1 },
    { camp: 0, type: 'infanterie', x: 7, y: 1 },
  ]);
  const plan = planEscorte(couverte, CAT, LOIN);
  assert.equal(plan?.regle, 'couverte');
  assert.deepEqual(plan?.vers, { x: 6, y: 1 }, 'derrière son escorteur, elle gagne trois cases');
  assert.equal(plan?.risque, 0);
});

test('escorte : un pouvoir adverse que la jauge paierait à une barre près compte déjà', () => {
  // Le super donne +1 de mouvement : l'infanterie frappe alors à cinq pas.
  // À 550 points sur 600, une frappe pendant son propre tour lui suffit : on
  // le compte. À 400, non.
  const commandants: Commandants = [null, PRESSE];
  const pres = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ]);
  pres.camps.find((c) => c.id === 1)!.jauge = 550;
  assert.deepEqual(planEscorte(pres, CAT, LOIN, commandants)?.vers, { x: 3, y: 1 });
  const loin = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ]);
  loin.camps.find((c) => c.id === 1)!.jauge = 400;
  assert.deepEqual(planEscorte(loin, CAT, LOIN, commandants)?.vers, { x: 4, y: 1 });
});

test('escorte : sans journée à perdre, elle prend la case la plus proche où elle survit au pire', () => {
  // Treize cases à couvrir à six par tour : trois ordres, et il n'en reste
  // que deux. Attendre serait perdre à coup sûr ; une infanterie ne la met pas
  // hors jeu d'un coup.
  const e = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ], { limiteJournees: 2 });
  assert.equal(derniereJournee(e), 2);
  const plan = planEscorte(e, CAT, LOIN);
  assert.ok(plan);
  assert.equal(plan.regle, 'echeance');
  assert.ok(plan.marge <= 0);
  assert.deepEqual(plan.vers, { x: 6, y: 1 });
  assert.ok(plan.risque > 0 && plan.risque < 100, 'elle prend un coup, elle y survit');
});

test('escorte : elle n’attend jamais à côté d’une usine adverse libre', () => {
  // Rien ne la menace aujourd'hui, mais ce qui naîtrait en (6,0) la frapperait
  // au tour suivant et tiendrait sa zone : (6,1) n'est pas une case d'attente.
  const e = partie(PLAINE.map((l, y) => (y === 0 ? 'PPPPPPUPPPPPPP' : l)), [
    { camp: 0, type: 'transport', x: 0, y: 1 },
  ], {}, { '6,0': 1 });
  const plan = planEscorte(e, CAT, LOIN);
  assert.equal(plan?.regle, 'couverte');
  assert.deepEqual(plan?.vers, { x: 5, y: 1 });
});

test('escorte : sous brouillard, un adversaire caché ne compte pas — rien n’est lu que le camp ne voie', () => {
  const cachee = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ], { brouillard: true });
  const vide = partie(PLAINE, [{ camp: 0, type: 'transport', x: 0, y: 1 }], { brouillard: true });
  const plan = planEscorte(cachee, CAT, LOIN);
  assert.deepEqual(plan, planEscorte(vide, CAT, LOIN));
  assert.deepEqual(plan?.vers, { x: 6, y: 1 }, 'elle avance comme sur une carte vide');
});

test('escorte : la stratégie joue toute l’armée, la protégée joue son plan en dernier', () => {
  const e = partie(PLAINE, [
    { camp: 0, type: 'transport', x: 0, y: 1 },
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 1 },
  ]);
  // Une stratégie de papier : elle fait attendre la première unité prête
  // qu'elle voit, puis finit le tour. Elle ne doit jamais voir la protégée prête.
  const vues: EtatPartie[] = [];
  const papier: Strategie = {
    id: 'papier',
    poids: {} as Strategie['poids'],
    choisirAction(etat: EtatPartie, camp: CampId): Action {
      vues.push(etat);
      const u = etat.unites.find((z) => z.camp === camp && z.etat === 'prete' && z.dansTransport === null);
      return u ? { type: 'ordre', uniteId: u.id, chemin: [{ x: u.x, y: u.y }], suite: { type: 'rien' } } : { type: 'finTour' };
    },
  };
  // Ce que la protégée doit jouer : son plan, une fois l'infanterie restée sur place.
  const apres = appliquer(e, { type: 'ordre', uniteId: 'u2', chemin: [{ x: 1, y: 0 }], suite: { type: 'rien' } }, CAT);
  if (!apres.ok) throw new Error(apres.motif);
  const attendu = planEscorte(apres.etat, CAT, LOIN);
  const tour = jouerTourEscorte(e, papier, creerRng('escorte'), CAT, [], LOIN);
  assert.deepEqual(tour.refus, []);
  assert.ok(vues.every((v) => v.unites.find((u) => u.id === 'u1')?.etat !== 'prete'), 'la stratégie ne voit jamais la protégée prête');
  const ordres = tour.actions.filter((a): a is Extract<Action, { type: 'ordre' }> => a.type === 'ordre').map((a) => a.uniteId);
  assert.deepEqual(ordres, ['u2', 'u1'], 'l’armée d’abord, la protégée ensuite');
  assert.deepEqual(tour.actions[1], attendu?.actions[0], 'son ordre est celui de son plan');
  assert.deepEqual(tour.actions.at(-1), { type: 'finTour' });
  assert.equal(tour.etat.campCourant, 1);
});

test('escorte : les producteurs adverses près de l’arrivée, et eux seuls', () => {
  const e = partie(['PUPPPPPPPUPU', 'PPPPPPPPPPPP'], [
    { camp: 0, type: 'transport', x: 0, y: 1 },
  ], {}, { '9,0': 1, '11,0': 0 });
  // (1,0) est neutre, (11,0) est à nous, (9,0) est adverse et à deux pas de (10,1).
  assert.deepEqual(producteursAdversesPres(e, CAT, 0, { x: 10, y: 1 }, 6), [{ x: 9, y: 0 }]);
  assert.deepEqual(producteursAdversesPres(e, CAT, 0, { x: 3, y: 1 }, 5), [], 'trop loin de l’arrivée');
});

test('escorte : l’objectif se lit dans les conditions de victoire, la distance dans le terrain', () => {
  assert.deepEqual(
    escorteDuScenario([{ type: 'capture_qg' }, { type: 'proteger', uniteRef: 'u4', destination: { x: 2, y: 3 } }]),
    { uniteId: 'u4', destination: { x: 2, y: 3 } },
  );
  assert.equal(escorteDuScenario([{ type: 'proteger', uniteRef: 'u4' }]), null, 'sans destination, rien à escorter');
  // Pour des chenilles, un pas en forêt en vaut deux : de (0,1), trois pas
  // coûtent 4 par la forêt, et le détour par le haut 5.
  const e = partie(['PPPP', 'PFPP'], [{ camp: 0, type: 'transport', x: 0, y: 0 }]);
  const couts = coutsJusqua(e, CAT, e.unites[0]!, { x: 3, y: 1 });
  assert.equal(couts[1 * 4 + 0], 4);
  assert.equal(couts[0 * 4 + 0], 4);
  assert.equal(couts[1 * 4 + 3], 0);
});
