import { test } from 'node:test';
import assert from 'node:assert/strict';
import carteJson from '../../content/cartes/carte_essai_maritime_iem_climat.json';
import scenarioJson from '../../content/scenarios/aube_essai_maritime_iem_climat.json';
import { validerMapDef, validerScenario } from '../../src/schemas';
import { appliquer, chargerCatalogue, creerPartie, sceneDepuis } from '../../src/engine';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';

test('la rade des signaux annonce ses menaces et traverse leurs premières activations', () => {
  const vs = validerScenario(scenarioJson);
  const vm = validerMapDef(carteJson);
  assert.ok(vs.ok, vs.ok ? '' : JSON.stringify(vs.erreurs));
  assert.ok(vm.ok, vm.ok ? '' : JSON.stringify(vm.erreurs));
  if (!vs.ok || !vm.ok) return;
  const scenario = vs.valeur;
  const carte = vm.valeur;
  const cat = chargerCatalogue(0);
  const commandants = resoudreCommandantsScenario(scenario);
  assert.equal(carte.grille[5]?.[6], 'T');
  assert.equal(carte.proprietaires['6,5'], 1);
  assert.ok(carte.unitesDepart.some(u => u.camp === 0 && u.type === 'drone_marin'));
  assert.equal(scenario.installationsIem?.[0]?.premiereJournee, 3);
  assert.equal(scenario.evenementsClimat?.[0]?.journee, 4);
  assert.deepEqual(scenario.evenementsClimat?.[0]?.campsAdaptes, [1]);
  const briefing = scenario.dialogueOuverture.map(r => r.texte).join(' ');
  assert.match(briefing, /J3/);
  assert.match(briefing, /J4 et J5/);
  assert.match(briefing, /ne change pas ce calendrier/);
  let etat = creerPartie(sceneDepuis(scenario, carte, commandants), cat, 'rade:contrat');
  for (let i = 0; i < 12; i++) {
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.ok(r.ok, r.ok ? '' : JSON.stringify(r));
    if (!r.ok) return;
    etat = r.etat;
  }
  assert.equal(etat.journee, 7);
  assert.equal(etat.partie.terminee, false);
});
