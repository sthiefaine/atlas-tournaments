/**
 * L'IA de jeu : elle ne joue que des actions légales, elle termine ses tours,
 * elle bat une IA passive, et elle est déterministe (`doc/02-architecture.md` §3.2).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AGRESSIVE, DEFENSIVE, GLOUTONNE, jouerPartie, jouerTour, PASSIVE, PONDEREE,
  strategie,
} from '../../src/ai/index';
import {
  appliquer, brouillardActif, creerPartie, creerRng, empreinte, reglagesParDefaut, sceneDeCarte,
  type EtatPartie,
} from '../../src/engine/index';
import { CAT, carte } from '../engine/aides';

/** Partie de test sur une carte manuelle. */
function ouvrir(nom: string, graine: string, journees = 30): EtatPartie {
  const scene = sceneDeCarte(carte(nom), reglagesParDefaut({ limiteJournees: journees }));
  return creerPartie(scene, CAT, graine);
}

test('les quatre stratégies annoncent leur identifiant', () => {
  assert.equal(PONDEREE.id, 'ponderee');
  assert.equal(AGRESSIVE.id, 'agressive');
  assert.equal(DEFENSIVE.id, 'defensive');
  assert.equal(GLOUTONNE.id, 'gloutonne');
  assert.equal(strategie('ponderee').id, 'ponderee');
  assert.equal(strategie('agressive').id, 'agressive');
  assert.equal(strategie('defensive').id, 'defensive');
  assert.equal(strategie('gloutonne').id, 'gloutonne');
});

test('un tour joué par l’IA se termine et n’essuie aucun refus', () => {
  const etat = ouvrir('plaine', 'tour');
  const r = jouerTour(etat, PONDEREE, creerRng('ia'), CAT);
  assert.deepEqual(r.refus, []);
  assert.ok(r.actions.length > 1);
  assert.equal(r.actions[r.actions.length - 1]?.type, 'finTour');
  assert.equal(r.etat.campCourant, 1);
  // Toutes les unités du camp ont reçu un ordre.
  assert.ok(etat.unites.filter((u) => u.camp === 0).length <= r.actions.length);
});

test("l'IA n'utilise que l'API publique : chaque action passe par appliquer", () => {
  const etat = ouvrir('relief', 'api');
  let courant = etat;
  for (let i = 0; i < 40; i += 1) {
    const action = PONDEREE.choisirAction(courant, courant.campCourant, creerRng('ia'), CAT);
    const r = appliquer(courant, action, CAT);
    if (!r.ok && action.type === 'ordre' && r.motif === 'case_occupee' && brouillardActif(courant)) {
      // Une seule tolérance, et elle n'est pas une faute de stratégie : sous
      // brouillard, l'IA ne lit que ce qu'elle voit, et le moteur refuse une
      // arrivée occupée par une unité **cachée** au lieu d'interrompre le
      // déplacement. `jouerTour` fait alors attendre l'unité sur place.
      const attente = appliquer(courant, { type: 'ordre', uniteId: action.uniteId, chemin: [action.chemin[0]!], suite: { type: 'rien' } }, CAT);
      assert.equal(attente.ok, true);
      if (attente.ok) courant = attente.etat;
      continue;
    }
    assert.equal(r.ok, true, `action refusée : ${JSON.stringify(action)}`);
    if (!r.ok) return;
    courant = r.etat;
  }
});

test('la stratégie pondérée bat une IA passive et termine la partie', () => {
  let victoires = 0;
  let journees = 0;
  for (let i = 0; i < 6; i += 1) {
    const etat = ouvrir('plaine', `passive-${i}`, 40);
    const r = jouerPartie(etat, [PONDEREE, PASSIVE], creerRng(`passive-${i}:ia`), CAT);
    assert.equal(r.terminee, true, 'la partie doit se terminer');
    if (r.vainqueur === 0) victoires += 1;
    journees += r.journees;
  }
  assert.equal(victoires, 6, 'l’IA pondérée doit gagner toutes les parties contre une IA passive');
  assert.ok(journees / 6 < 30, 'et les gagner franchement');
});

test('les trois personnalités terminent leurs parties sur les trois cartes', () => {
  for (const nom of ['plaine', 'riviere', 'relief']) {
    for (const [a, b] of [[PONDEREE, AGRESSIVE], [DEFENSIVE, PONDEREE], [GLOUTONNE, AGRESSIVE]]) {
      const etat = ouvrir(nom, `personnalites-${nom}-${a!.id}`);
      const r = jouerPartie(etat, [a!, b!], creerRng('ia'), CAT);
      assert.equal(r.terminee, true, `${nom} : ${a!.id} contre ${b!.id} n'a pas fini`);
      assert.ok(r.journees <= 31, `${nom} : ${r.journees} journées`);
    }
  }
});

test('deux exécutions de la même graine donnent la même partie, coup pour coup', () => {
  const jouer = (): { empreinte: string; actions: number } => {
    const etat = ouvrir('riviere', 'determinisme');
    const r = jouerPartie(etat, [PONDEREE, AGRESSIVE], creerRng('determinisme:ia'), CAT);
    return { empreinte: empreinte(r.etat), actions: r.actions.length };
  };
  assert.deepEqual(jouer(), jouer());
});

test('un tirage supplémentaire dans le flux de l’IA ne change pas la partie', () => {
  const etat = ouvrir('plaine', 'flux-ia');
  const sans = jouerTour(etat, PONDEREE, creerRng('x'), CAT);
  const rng = creerRng('x');
  const flux = rng.branche('ia');
  for (let i = 0; i < 25; i += 1) flux.suivant();
  const avec = jouerTour(etat, PONDEREE, rng, CAT);
  assert.equal(empreinte(sans.etat), empreinte(avec.etat));
});

test('une IA passive ne fait rien de plus que finir son tour', () => {
  const etat = ouvrir('plaine', 'passive');
  const r = jouerTour(etat, PASSIVE, creerRng('ia'), CAT);
  assert.deepEqual(r.actions, [{ type: 'finTour' }]);
});
