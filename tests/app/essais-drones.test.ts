import { test } from 'node:test';
import assert from 'node:assert/strict';
import carteJson from '../../content/cartes/carte_essais_drones.json';
import scenarioJson from '../../content/scenarios/aube_essais_drones.json';
import { validerMapDef, validerScenario } from '../../src/schemas';
import { appliquer, chargerCatalogue, creerPartie, sceneDepuis } from '../../src/engine';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';

test('l’essai du catalogue 7 place le matériel exclusif uniquement dans le camp méridien', () => {
  const vs = validerScenario(scenarioJson);
  const vm = validerMapDef(carteJson);
  assert.ok(vs.ok, vs.ok ? '' : JSON.stringify(vs.erreurs));
  assert.ok(vm.ok, vm.ok ? '' : JSON.stringify(vm.erreurs));
  if (!vs.ok || !vm.ok) return;
  const scenario = vs.valeur, carte = vm.valeur;
  assert.equal(scenario.statut, 'brouillon');
  assert.equal(scenario.catalogueVersion, 0);
  assert.deepEqual(scenario.factionsParCamp, { 1: 'atl' });
  assert.equal(scenario.limiteJournees, 15);
  const cat = chargerCatalogue(0);
  for (const u of carte.unitesDepart) {
    const type = cat.unites[u.type];
    assert.ok(type, u.type);
    if (type.factionExclusive) assert.equal(scenario.factionsParCamp?.[u.camp], type.factionExclusive);
    if (u.camp === 0) assert.equal(type.factionExclusive, undefined, 'le joueur ne reçoit pas une unité méridienne');
  }
  for (const cle of ['drone_intercepteur', 'drone_ravitailleur']) assert.ok(carte.unitesDepart.some(u => u.camp === 0 && u.type === cle));
  for (const cle of ['meridien_veilleur', 'meridien_bastion', 'helico']) assert.ok(carte.unitesDepart.some(u => u.camp === 1 && u.type === cle));
  const commandants = resoudreCommandantsScenario(scenario);
  let etat = creerPartie(sceneDepuis(scenario, carte, commandants), cat, 'drones:contrat');
  assert.deepEqual(etat.reglages.factionsParCamp, { 1: 'atl' });
  for (let i = 0; i < 2; i++) {
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.ok(r.ok);
    if (!r.ok) return;
    etat = r.etat;
  }
  assert.equal(etat.journee, 2);
  assert.equal(etat.partie.terminee, false);
});
