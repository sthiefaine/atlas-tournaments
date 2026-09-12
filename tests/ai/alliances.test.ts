import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meilleureOption, POIDS_PONDEREE } from '../../src/ai';
import { appliquer, chargerCatalogue, creerPartie } from '../../src/engine';
import { scenePersonnalisee } from '../engine/aides';

test('une infanterie IA ne termine pas son déplacement sur une unité d’un autre camp allié', () => {
  const cat = chargerCatalogue(0);
  const scene = scenePersonnalisee(
    ['HPPCHPH'],
    { '0,0': 0, '4,0': 1, '6,0': 2 },
    [
      { camp: 0, type: 'infanterie', x: 1, y: 0 },
      { camp: 1, type: 'artillerie', x: 3, y: 0 },
      { camp: 2, type: 'infanterie', x: 6, y: 0 },
    ],
    { equipes: [[0, 1], [2]], fondsDepart: 0, brouillard: false, cycleJourNuit: { jour: 6, nuit: 0 } },
  );
  scene.camps = [0, 1, 2];
  const etat = creerPartie(scene, cat, 'alliances:arrivee');
  const unite = etat.unites.find(u => u.camp === 0)!;
  const action = meilleureOption(etat, cat, unite, POIDS_PONDEREE).action;
  assert.equal(action.type, 'ordre');
  if (action.type !== 'ordre') return;
  assert.notDeepEqual(action.chemin.at(-1), { x: 3, y: 0 }, 'la ville neutre est déjà occupée par un allié');
  const resultat = appliquer(etat, action, cat);
  assert.equal(resultat.ok, true, resultat.ok ? '' : resultat.motif);
});
