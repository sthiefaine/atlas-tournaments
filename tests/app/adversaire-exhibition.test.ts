// L'exhibition de l'écran-titre confie ses tours au Web Worker de la page de
// jeu (`src/app/adversaire-exhibition.ts`, 23 septembre 2026). Rien ne doit
// changer à l'écran : ce test rejoue la partie d'exhibition et vérifie, tour
// après tour et dans les deux camps, que l'adversaire en fond choisit
// exactement ce que la boucle de l'attract choisissait — `jouerTour`, la
// pondérée au camp 0, l'agressive au camp 1.
//
// Sous Node il n'y a pas de `Worker` : l'adversaire en fond joue alors sur le
// fil principal, avec les mêmes paramètres que ceux qu'il enverrait au worker
// (`tests/jeu/ia-en-fond.test.ts` vérifie que le worker rend la même suite
// que le fil). Les deux calculs se font sur une copie de l'état, comme le
// worker : le moteur partage entre deux états la cale d'un transport vide, et
// un tour calculé sur l'état vivant pourrait l'écrire (`adversaire-fond.ts`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jouerTour, strategie } from '../../src/ai/index';
import { adversaireExhibition, STRATEGIES_EXHIBITION } from '../../src/app/adversaire-exhibition';
import {
  appliquer, chargerCatalogue, creerPartie, restaurerRng, sceneDepuis, type Action, type EtatPartie,
} from '../../src/engine/index';
import { commandantsDuScenario } from '../../src/render/index';
import { validerMapDef, validerScenario } from '../../src/schemas/index';
import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../content/scenarios/demo.json';

test('l’exhibition garde ses deux styles : la pondérée au camp 0, l’agressive au camp 1', () => {
  assert.deepEqual({ ...STRATEGIES_EXHIBITION }, { 0: 'ponderee', 1: 'agressive' });
  assert.ok(Object.isFrozen(STRATEGIES_EXHIBITION));
});

test('l’adversaire en fond joue, tour après tour, ce que la boucle de l’attract jouait', async () => {
  const s = validerScenario(scenarioDemo);
  const c = validerMapDef(carteDemo);
  assert.ok(s.ok && c.ok, 'le scénario d’exhibition se valide');
  const cat = chargerCatalogue(s.valeur.catalogueVersion);
  const commandants = commandantsDuScenario(s.valeur);
  const fond = adversaireExhibition(s.valeur.catalogueVersion, commandants, {
    creerWorker: () => null,
    surRepli: () => undefined,
  });
  assert.equal(fond.mode, 'fil', 'sans Worker, l’exhibition joue sur le fil principal');

  // La formule de la boucle d'avant, telle qu'elle était écrite dans `attract.tsx`.
  const commeAvant = (etat: EtatPartie): Action[] => jouerTour(
    etat, strategie(etat.campCourant === 0 ? 'ponderee' : 'agressive'),
    restaurerRng(etat.graine, etat.flux), cat, commandants,
  ).actions;

  let etat = creerPartie(sceneDepuis(s.valeur, c.valeur, commandants), cat, 'accueil:1');
  const campsVus = new Set<number>();
  let actionsJouees = 0;
  for (let tour = 0; tour < 12 && !etat.partie.terminee; tour += 1) {
    const attendu = commeAvant(structuredClone(etat));
    const obtenu = await fond.adversaire(etat);
    assert.deepEqual(obtenu, attendu, `tour ${tour}, camp ${etat.campCourant}`);
    campsVus.add(etat.campCourant);
    // On avance comme l'attract : ses actions une à une, sinon la fin du tour.
    const campAvant = etat.campCourant;
    for (const action of obtenu.length > 0 ? obtenu : [{ type: 'finTour' } as Action]) {
      const r = appliquer(etat, action, cat, commandants);
      if (!r.ok) continue;
      etat = r.etat;
      actionsJouees += 1;
    }
    if (etat.campCourant === campAvant && !etat.partie.terminee) {
      const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
      assert.ok(r.ok, 'la fin de tour passe');
      etat = r.etat;
    }
  }
  assert.deepEqual([...campsVus].sort(), [0, 1], 'les deux camps ont joué');
  assert.ok(actionsJouees > 12, `la partie a avancé (${actionsJouees} actions)`);
  fond.fermer();
  assert.equal(fond.mode, 'ferme');
  assert.deepEqual(await fond.adversaire(etat), [], 'fermé, l’adversaire ne joue plus');
});
