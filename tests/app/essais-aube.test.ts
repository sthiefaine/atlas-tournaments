import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLES_ESSAIS_AUBE, essaisAube, formatCoalitions, partiesLibres } from '../../src/app/jeu/parties-libres';
import { validerMapDef, validerScenario, type MapDef, type Scenario } from '../../src/schemas';
import { appliquer, chargerCatalogue, creerPartie, sceneDepuis } from '../../src/engine';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';

function charger(cle: string): { scenario: Scenario; carte: MapDef } {
  const scenario = validerScenario(JSON.parse(readFileSync(`content/scenarios/${cle}.json`, 'utf8')));
  assert.equal(scenario.ok, true, scenario.ok ? '' : JSON.stringify(scenario.erreurs));
  if (!scenario.ok) throw new Error(cle);
  const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${scenario.valeur.carteCle}.json`, 'utf8')));
  assert.equal(carte.ok, true, carte.ok ? '' : JSON.stringify(carte.erreurs));
  if (!carte.ok) throw new Error(cle);
  return { scenario: scenario.valeur, carte: carte.valeur };
}
for (const cle of CLES_ESSAIS_AUBE) {
  test(`${cle} charge son catalogue et parcourt tous ses camps sans fin prématurée`, () => {
    const { scenario, carte } = charger(cle);
    const commandants = resoudreCommandantsScenario(scenario);
    const cat = chargerCatalogue(scenario.catalogueVersion);
    let etat = creerPartie(sceneDepuis(scenario, carte, commandants), cat, 'essais-aube:contrat');
    const camps = new Set<number>();
    for (let i = 0; i < carte.camps; i++) {
      camps.add(etat.campCourant);
      const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
      assert.equal(r.ok, true);
      if (!r.ok) return;
      etat = r.etat;
    }
    assert.equal(camps.size, carte.camps);
    assert.equal(etat.journee, 2);
    assert.equal(etat.partie.terminee, false);
    assert.deepEqual(etat.reglages.equipes, scenario.equipes);
  });
}
test('les cinq formats sont accessibles comme essais sans publier les autres brouillons', () => {
  const contenus = CLES_ESSAIS_AUBE.map(charger);
  const scenarios = contenus.map(c => c.scenario);
  const cartes = new Map(contenus.map(c => [c.carte.cle, c.carte]));
  assert.deepEqual(scenarios.map(formatCoalitions).sort(), ['1 contre 2', '1 contre 3', '2 contre 1', '2 contre 2', '3 contre 1']);
  assert.equal(partiesLibres(scenarios, cartes, []).length, 0);
  const prive = { ...scenarios[0]!, cle: 'essai_prive', code: 'essai_prive' };
  assert.equal(essaisAube([...scenarios, prive], cartes).length, 5);
  assert.equal(essaisAube(scenarios, new Map()).length, 0);
  const batteries = essaisAube(scenarios, cartes).find(p => p.cle === 'aube_batteries_2v1');
  assert.equal(batteries?.adversaire?.commandantCle, 'cmd_hadran_ost', 'Tomas est allié, pas adversaire');
});
test('le siège annonce ses réserves finies, sa relève et la victoire anticipée par QG', () => {
  const { scenario, carte } = charger('aube_releve_1v3');
  assert.equal(scenario.revenusParBatiment, 0);
  assert.deepEqual(scenario.victoire, [{ type: 'survivre', journees: 40 }, { type: 'capture_qg' }]);
  assert.deepEqual(scenario.renforts?.map(r => r.journee), [10, 20, 30, 34, 38, 41]);
  const commandants = resoudreCommandantsScenario(scenario);
  const cat = chargerCatalogue(scenario.catalogueVersion);
  let etat = creerPartie(sceneDepuis(scenario, carte, commandants), cat, 'essais-aube:releve');
  const initial = etat.unites.filter(u => u.camp === 0).length;
  // Ceci vérifie l'horloge et le raccordement des données, pas une victoire contre l'IA.
  for (let i = 0; i < 160 && !etat.partie.terminee; i++) {
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    etat = r.etat;
  }
  assert.equal(etat.journee, 41);
  assert.ok(etat.partie.terminee);
  assert.equal(etat.unites.filter(u => u.camp === 0).length, initial + 3);
});
