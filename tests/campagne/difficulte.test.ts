import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { scenarioPourMode, DIFFICULTES_AUBE } from '../../src/app/jeu/difficulte';
import { cleSauvegardeDe, lireDifficulte, ecrireDifficulte } from '../../src/app/preferences';
import { enregistrerVictoire, lireProgression } from '../../src/app/campagne/progression';
import { validerScenario, validerMapDef, type Scenario, type ParametresMode } from '../../src/schemas/index';
import { chargerCatalogue, creerPartie, sceneDepuis, revenuParTour } from '../../src/engine/index';
import { crediterJauge } from '../../src/engine/regles/combat';
import { textesObjectifs } from '../../src/render/objectifs';

function scenario(code: string): Scenario {
  const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}
function stockage(): void {
  const donnees = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
  } });
}

test('deux difficultés accessibles sans victoire, propres au profil et avec sauvegardes séparées', () => {
  stockage();
  assert.equal(lireDifficulte('a'), 'normal');
  assert.equal(ecrireDifficulte('a', 'difficile'), true);
  assert.equal(lireDifficulte('a'), 'difficile');
  assert.equal(lireDifficulte('b'), 'normal');
  assert.equal(cleSauvegardeDe('a', 'premier_contact', 'normal'), 'atlas:partie:premier_contact');
  assert.notEqual(cleSauvegardeDe('a', 'premier_contact', 'difficile'), cleSauvegardeDe('a', 'premier_contact'));
  enregistrerVictoire('premier_contact', 'a', 'difficile');
  assert.deepEqual(lireProgression('a').victoiresParMode?.difficile, ['premier_contact']);
  assert.deepEqual(lireProgression('a').victoiresParMode?.normal, []);
  assert.deepEqual(lireProgression('a').victoires, ['premier_contact'], 'le parcours commun progresse');
});

test('les cinq essais ont de vraies variantes difficiles sans modifier le canon ni aider les alliés', () => {
  for (const code of Object.keys(DIFFICULTES_AUBE)) {
    const base = scenario(code);
    const avant = JSON.stringify(base);
    assert.deepEqual(scenarioPourMode(base, 'normal'), base);
    const dur = scenarioPourMode(base, 'difficile');
    assert.ok(validerScenario(dur).ok, code);
    assert.equal(JSON.stringify(base), avant);
    assert.equal(dur.previsionJournees, 1);
    assert.deepEqual(dur.victoire, base.victoire, 'même intrigue et objectifs');
    assert.equal(dur.fondsDepartParCamp?.[0] ?? dur.fondsDepart, base.fondsDepartParCamp?.[0] ?? base.fondsDepart);
    if (code === 'aube_releve_1v3') assert.ok(dur.renforts!.length > base.renforts!.length, 'le siège sans économie reçoit une vraie vague supplémentaire');
    else assert.ok(dur.commandants.some((c) => (dur.fondsDepartParCamp?.[c.camp] ?? dur.fondsDepart) > (base.fondsDepartParCamp?.[c.camp] ?? base.fondsDepart)));
  }
});

test('les modes déclarés pilotent les budgets, revenus, brouillard, IA et jauge du moteur', () => {
  const base = scenario('aube_nuit_2v2');
  const p: ParametresMode = { fondsDepart: 2000, fondsDepartIa: 8000, revenusParBatiment: 500,
    revenusIaParBatiment: 1000, brouillard: true, previsionJournees: 1, vitesseJauge: 0.5,
    limiteJournees: 30, strategieIa: 'agressive', reprises: 0, dureeVisee: 20 };
  base.modes = { normal: p, difficile: p };
  const dur = scenarioPourMode(base, 'difficile');
  const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${base.carteCle}.json`, 'utf8')));
  assert.ok(carte.ok);
  const etat = creerPartie(sceneDepuis(dur, carte.valeur, []), chargerCatalogue(base.catalogueVersion), 'modes');
  assert.equal(etat.camps[1]!.fonds, 8000);
  assert.equal(etat.camps[0]!.fonds, 2000 + revenuParTour(etat, 0));
  assert.equal(etat.reglages.brouillard, true);
  assert.equal(etat.reglages.limiteJournees, 30);
  assert.equal(dur.commandants[1]!.ia, 'agressive');
  crediterJauge(etat, 0, 100);
  crediterJauge(etat, 1, 100);
  assert.equal(etat.camps[0]!.jauge, 50);
  assert.equal(etat.camps[1]!.jauge, 100);
});

test('une quête annonce sa condition impérative de porteur à préserver', () => {
  const base = scenario('aube_convoi_secondaire');
  const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${base.carteCle}.json`, 'utf8')));
  assert.ok(carte.ok);
  assert.ok(base.defaite.some((d) => d.type === 'unite_perdue'));
  const etat = creerPartie(sceneDepuis(base, carte.valeur, []), chargerCatalogue(base.catalogueVersion), 'porteur');
  assert.ok(textesObjectifs(etat, chargerCatalogue(base.catalogueVersion), (cle) => cle).includes('objectif.defaite_unite'));
});
