import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCommandantJeu, resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { creerPartie, sceneDepuis } from '../../src/engine/index';
import { validerScenario } from '../../src/schemas/index';
import incarnationJson from '../../content/scenarios/couleurs_alliees.json';
import { carte, CAT } from './aides';

test('incarner Reiner pose son bonus défensif permanent au camp joueur', () => {
  const validation = validerScenario(incarnationJson);
  assert.ok(validation.ok);
  const scenario = validation.valeur;
  const etat = creerPartie(sceneDepuis(scenario, carte('plaine'), resoudreCommandantsScenario(scenario)), CAT, 'alliance');
  assert.equal(etat.camps[0]?.commandantCle, 'cmd_tomas_reiner');
  assert.ok(etat.modificateurs.some((m) => m.camp === 0 && m.source === 'passif'
    && m.effet.modificateur.quoi === 'defense' && m.effet.modificateur.valeur === 1.1
    && m.expire.type === 'permanent'));
  assert.ok(!etat.modificateurs.some((m) => m.camp === 1 && m.source === 'passif'));
});

test('Reiner conserve sa protection pendant le tour adverse et le super permet le repositionnement', () => {
  const reiner = chargerCommandantJeu('cmd_tomas_reiner');
  assert.equal(reiner.pouvoir.duree, 'tour_complet');
  assert.equal(reiner.superPouvoir.duree, 'tour_complet');
  assert.deepEqual(reiner.pouvoir.effets, [{ cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 1.25 } }]);
  assert.deepEqual(reiner.superPouvoir.effets, [
    { cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 1.5 } },
    { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } },
  ]);
});
