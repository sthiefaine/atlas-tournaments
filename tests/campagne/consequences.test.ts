import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { appliquerConsequences, decisionsDeGraine, graineAube } from '../../src/app/campagne/consequences';
import { enregistrerDecision, enregistrerVictoire, lireProgression, normaliserProgression, type DecisionLocale } from '../../src/app/campagne/progression';
import { validerScenario, validerMapDef, type Scenario } from '../../src/schemas/index';
import { chargerCatalogue, creerPartie, sceneDepuis, appliquer, enregistrerPartie, rejouer, empreinte } from '../../src/engine/index';

function stockage(): Map<string, string> {
  const donnees = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
  } });
  return donnees;
}
function scenario(code: string): Scenario {
  const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}
const decision = (scenario: string, choix: string): DecisionLocale => ({ scenario, scenarioVersion: 1, canonVersion: 1, choix });

test('les décisions requièrent une victoire, restent idempotentes et appartiennent au profil', () => {
  stockage();
  assert.equal(enregistrerDecision('aube_batteries_2v1', 1, 'credit_immediat', 'a'), false);
  enregistrerVictoire('aube_batteries_2v1', 'a');
  assert.equal(enregistrerDecision('aube_batteries_2v1', 1, 'credit_immediat', 'a'), true);
  assert.equal(enregistrerDecision('aube_batteries_2v1', 1, 'credit_immediat', 'a'), true);
  assert.equal(enregistrerDecision('aube_batteries_2v1', 1, 'mutualiser_reserves', 'a'), false);
  assert.equal(lireProgression('a').journal?.length, 1);
  assert.equal(lireProgression('b').journal?.length ?? 0, 0);
  enregistrerVictoire('aube_nuit_2v2', 'a');
  assert.equal(lireProgression('a').journal?.length, 1, 'une victoire ultérieure conserve le journal');
  assert.deepEqual(normaliserProgression({ version: 1, victoires: ['premier_contact'] }), { version: 1, victoires: ['premier_contact'] });
});

test('la graine sauvegardée fige les conséquences, sans empiler les fonds à la reprise', () => {
  const base = scenario('aube_nuit_2v2');
  const choix = [decision('aube_batteries_2v1', 'credit_immediat')];
  const graine = graineAube(base, choix);
  assert.ok(graine.length <= 64);
  const une = appliquerConsequences(base, decisionsDeGraine(base, graine));
  const reprise = appliquerConsequences(base, decisionsDeGraine(base, graine));
  assert.deepEqual(reprise, une);
  assert.equal(une.scenario.fondsDepartParCamp?.[0], (base.fondsDepartParCamp?.[0] ?? base.fondsDepart) + 2000);
  assert.equal(une.scenario.fondsDepartParCamp?.[1], base.fondsDepartParCamp?.[1]);
  assert.equal(appliquerConsequences(base, decisionsDeGraine(base, `${base.code}:1`)).rappels.length, 0, 'ancienne partie sans bonus conservée');
  assert.notDeepEqual(graineAube(base, []), graine, 'nouvelle partie sans décision distincte');
  assert.equal(base.fondsDepartParCamp?.[0] ?? base.fondsDepart, 4000, 'canon non muté');
});

test('les réserves et routes déclenchent les vrais renforts prévus', () => {
  const siege = appliquerConsequences(scenario('aube_releve_1v3'), [decision('aube_batteries_2v1', 'mutualiser_reserves')]).scenario;
  assert.ok(siege.renforts?.some((r) => r.journee === 20 && r.unites.some((u) => u.camp === 0 && u.type === 'char_leger')));
  const routes = appliquerConsequences(scenario('aube_routes_3v1'), [decision('aube_nuit_2v2', 'securiser_routes')]).scenario;
  assert.ok(routes.renforts?.some((r) => r.journee === 2 && r.unites.some((u) => u.camp === 0 && u.type === 'genie')));
  assert.ok(validerScenario(routes).ok);
  assert.ok(validerScenario(siege).ok, 'un siège peut avoir zéro revenu');
});

test('le budget individuel se retrouve dans le moteur sans enrichir les adversaires', () => {
  const base = scenario('aube_nuit_2v2');
  const modifie = appliquerConsequences(base, [decision('aube_batteries_2v1', 'credit_immediat')]).scenario;
  const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${base.carteCle}.json`, 'utf8')));
  assert.ok(carte.ok);
  const etat = creerPartie(sceneDepuis(modifie, carte.valeur, []), chargerCatalogue(base.catalogueVersion), 'budget');
  const temoin = creerPartie(sceneDepuis(base, carte.valeur, []), chargerCatalogue(base.catalogueVersion), 'budget');
  assert.equal(etat.camps[0]!.fonds - temoin.camps[0]!.fonds, 2000);
  assert.equal(etat.camps[1]!.fonds, temoin.camps[1]!.fonds);
  assert.equal(validerScenario({ ...base, fondsDepartParCamp: { 9: 1000 } }).ok, false);
  assert.equal(validerScenario({ ...base, fondsDepartParCamp: { 0: -100 } }).ok, false);
});


test('un vrai rejeu conserve le bonus initial même après une nouvelle décision locale', () => {
  stockage();
  const base = scenario('aube_nuit_2v2');
  const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${base.carteCle}.json`, 'utf8')));
  assert.ok(carte.ok);
  const cat = chargerCatalogue(base.catalogueVersion);
  const graine = graineAube(base, [decision('aube_batteries_2v1', 'credit_immediat')]);
  const initiale = appliquerConsequences(base, decisionsDeGraine(base, graine)).scenario;
  const depart = creerPartie(sceneDepuis(initiale, carte.valeur, []), cat, graine);
  const avance = appliquer(depart, { type: 'finTour' }, cat);
  assert.ok(avance.ok);
  const sauvegarde = enregistrerPartie(avance.etat, [{ type: 'finTour' }]);
  enregistrerVictoire('aube_nuit_2v2', 'a');
  enregistrerDecision('aube_nuit_2v2', 1, 'publier_preuve', 'a');
  const retrouvee = appliquerConsequences(base, decisionsDeGraine(base, sauvegarde.graine)).scenario;
  const reprise = rejouer(sceneDepuis(retrouvee, carte.valeur, []), cat, sauvegarde);
  assert.deepEqual(reprise.refus, []);
  assert.equal(empreinte(reprise.etat), empreinte(avance.etat));
});

test('les quêtes secondaires modifient la trame et les anciennes graines restent lisibles', () => {
  const routes = scenario('aube_routes_3v1');
  const choix = [decision('aube_nuit_2v2', 'publier_preuve'), decision('aube_convoi_secondaire', 'convoi_routes'), decision('aube_archives_secondaire', 'archives_publiques')];
  const graine = graineAube(routes, choix);
  const copie = appliquerConsequences(routes, decisionsDeGraine(routes, graine));
  assert.equal(copie.scenario.fondsDepartParCamp?.[0], (routes.fondsDepartParCamp?.[0] ?? routes.fondsDepart) + 6000);
  assert.equal(copie.rappels.length, 3);
  assert.deepEqual(appliquerConsequences(routes, decisionsDeGraine(routes, graine)), copie);
  const ancienne = decisionsDeGraine(routes, `${routes.code}:a1:21`);
  assert.equal(ancienne.length, 2);
});

test('chaque récompense de quête référence des unités présentes et se monte dans son vrai scénario', () => {
  for (const [source, choix, cible] of [
    ['aube_convoi_secondaire', 'convoi_reserves', 'aube_releve_1v3'],
    ['aube_archives_secondaire', 'archives_reconnaissance', 'aube_routes_3v1'],
    ['aube_batteries_2v1', 'mutualiser_reserves', 'aube_convoi_secondaire'],
    ['aube_nuit_2v2', 'securiser_routes', 'aube_archives_secondaire'],
  ] as const) {
    const base = scenario(cible);
    const modifie = appliquerConsequences(base, [decision(source, choix)]).scenario;
    const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${base.carteCle}.json`, 'utf8')));
    assert.ok(carte.ok);
    assert.doesNotThrow(() => creerPartie(sceneDepuis(modifie, carte.valeur, []), chargerCatalogue(base.catalogueVersion), 'recompense-valide'));
  }
});

test('le choix du dixième tutoriel persiste et finance uniquement le match annoncé', () => {
  stockage();
  assert.equal(enregistrerDecision('opus1_tutoriel_10', 1, 'fonds_immediats', 'a'), false);
  enregistrerVictoire('opus1_tutoriel_10', 'a');
  assert.equal(enregistrerDecision('opus1_tutoriel_10', 1, 'fonds_immediats', 'a'), true);
  const decisions = Object.values(lireProgression('a').decisions ?? {});
  const pacte = scenario('pacte_du_col');
  const graine = graineAube(pacte, decisions);
  const prepare = appliquerConsequences(pacte, decisionsDeGraine(pacte, graine));
  assert.equal(prepare.scenario.fondsDepartParCamp?.[0], pacte.fondsDepart + 2000);
  assert.equal(prepare.rappels.length, 1);
  assert.deepEqual(appliquerConsequences(scenario('couleurs_alliees'), decisions).rappels, []);
  assert.deepEqual(decisionsDeGraine(pacte, `${pacte.code}:1`), [], 'les anciennes parties ne changent pas');
  const partage = appliquerConsequences(scenario('couleurs_alliees'), [decision('opus1_tutoriel_10', 'maintenance_partagee')]);
  assert.equal(partage.scenario.fondsDepartParCamp?.[0], scenario('couleurs_alliees').fondsDepart + 2000);
});
