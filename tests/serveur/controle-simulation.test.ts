/**
 * La campagne de simulation du serveur, moteur et IA branchés
 * (`doc/05-routines.md` §4.2, `doc/02-architecture.md` §8).
 *
 * Quatre choses y sont vérifiées, et elles font tourner de vraies parties :
 *
 * 1. le simulateur est **déterministe** — même demande, mêmes chiffres ;
 * 2. le générateur produit une carte qui **passe le contrôle** sous trois
 *    conditions de climat, dix parties chacune ;
 * 3. une **unité candidate absurde** (coût 1, cent points de dégâts sur toute la
 *    ligne) est rejetée en `unite_dominante` ;
 * 4. la **reproductibilité** d'une carte générée est vérifiée par le contrôle.
 *
 * Budget de temps : ce fichier reste sous la trentaine de secondes. Les seuils,
 * eux, sont testés sans simulation dans `controle.test.ts`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chargerUnites } from '../../src/content/index';
import { genererCarte } from '../../src/mapgen/index';
import { generateurMapgen, graineNumerique } from '../../src/serveur/generation';
import { rendreVerdict, verifierCarteControle } from '../../src/serveur/controle/index';
import {
  cartesDeReference, scenarioMinimal, simuler, type ConditionClimat,
} from '../../src/serveur/simulation';
import { validerMapDef, validerReviewVerdict } from '../../src/schemas/index';
import type { CleUnite, ParametresCarte, StatsSimulation, UnitType } from '../../src/schemas/index';

/** Les trois conditions du contrôle minimal : un climat clair, la neige, la nuit. */
const CONDITIONS: ConditionClimat[] = [
  { saison: 'ete', meteo: 'clair', phase: 'jour' },
  { saison: 'hiver', meteo: 'neige', phase: 'jour' },
  { saison: 'automne', meteo: 'brouillard', phase: 'nuit' },
];

/** Les paramètres de la carte d'essai : petite, symétrique, sans mécanique. */
const PARAMETRES: ParametresCarte = {
  largeur: 16, hauteur: 12, camps: 2, biome: 'plaine', ratioMer: 0, ratioRelief: 0.12,
  villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0,
  symetrie: 'point', densiteRoutes: 0.45,
};

/** Le temps mesuré ne peut pas être déterministe : on le retire avant de comparer. */
function sansChrono(s: StatsSimulation): Record<string, unknown> {
  const copie: Record<string, unknown> = { ...s };
  delete copie['dureeMoyenneMs'];
  return copie;
}

test('le simulateur est déterministe : même demande, mêmes statistiques', () => {
  const carte = genererCarte(PARAMETRES, 99);
  const demande = {
    carte, parties: 4, strategies: ['ponderee', 'agressive'] as const,
    journeesMax: 25, conditions: CONDITIONS.slice(0, 2),
  };
  const a = simuler({ ...demande, strategies: [...demande.strategies] });
  const b = simuler({ ...demande, strategies: [...demande.strategies] });
  assert.deepEqual(sansChrono(b.stats), sansChrono(a.stats));
  assert.equal(b.simulationId, a.simulationId);
  assert.deepEqual(b.horsSchema, a.horsSchema);
  assert.deepEqual(
    b.parCondition.map((l) => [l.condition, sansChrono(l.stats), l.horsSchema]),
    a.parCondition.map((l) => [l.condition, sansChrono(l.stats), l.horsSchema]),
  );
  // Les graines sont uniques et aussi nombreuses que les parties : le schéma l'exige.
  assert.equal(a.stats.graines.length, a.stats.parties);
  assert.equal(new Set(a.stats.graines).size, a.stats.parties);
  assert.ok(a.stats.graines.every((g) => g.length <= 64));
});

test('changer un seul paramètre de la demande change la graine, donc les parties', () => {
  const carte = genererCarte(PARAMETRES, 99);
  const base = {
    carte, parties: 4, strategies: ['ponderee', 'agressive'] as const,
    journeesMax: 25, conditions: CONDITIONS.slice(0, 2),
  };
  const a = simuler({ ...base, strategies: [...base.strategies] });
  const b = simuler({ ...base, strategies: [...base.strategies], journeesMax: 26 });
  assert.notEqual(b.simulationId, a.simulationId);
  assert.notDeepEqual(b.stats.graines, a.stats.graines);
});

test('les bornes serveur tiennent : 100 parties par condition, 240 au total', () => {
  const carte = genererCarte(PARAMETRES, 99);
  const r = simuler({
    carte, parties: 500, strategies: ['gloutonne', 'gloutonne'], journeesMax: 1, conditions: CONDITIONS,
  });
  assert.equal(r.partiesRetrogradees, 80);
  assert.equal(r.stats.parties, 240);
});

test('une carte générée reçoit un verdict mesuré sous trois conditions, dix parties chacune', () => {
  const carte = genererCarte(PARAMETRES, 99);
  assert.ok(validerMapDef(carte).ok, 'la carte générée doit être conforme au schéma');

  const controle = verifierCarteControle(carte);
  assert.deepEqual(controle.motifs, [], 'aucun motif structurel attendu');
  assert.equal(controle.mesures['reproductible'], 1);

  const resultat = simuler({
    carte, parties: 10, strategies: ['ponderee', 'agressive'], journeesMax: 30,
    conditions: CONDITIONS,
  });
  assert.equal(resultat.parCondition.length, 3);
  assert.equal(resultat.stats.parties, 30);

  const verdict = rendreVerdict(
    { type: 'carte', cle: carte.code, version: carte.version }, resultat, controle.motifs,
  );
  const avantage = resultat.stats.victoiresCamp[0]! / resultat.stats.parties;
  assert.equal(verdict.motifs.some((m) => m.code === 'avantage_premier_joueur'), avantage < .4 || avantage > .6);
  assert.equal(verdict.verdict, verdict.motifs.length === 0 ? 'valide' : 'rejete');
  const conforme = validerReviewVerdict(verdict);
  assert.ok(conforme.ok, `verdict non conforme : ${JSON.stringify(conforme.ok ? [] : conforme.erreurs)}`);
});

test('une unité candidate absurde est rejetée en unite_dominante', () => {
  const degats: Partial<Record<CleUnite, number>> = {};
  for (const u of chargerUnites()) degats[u.cle] = 100;
  const absurde: UnitType = {
    cle: 'char_absurde',
    nom: 'Char absurde',
    nomCourt: 'Absurde',
    statut: 'essai',
    traits: ['capture'],
    silhouette: { base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 },
    cout: 1,
    mouvement: 9,
    typeMouvement: 'chenilles',
    domaine: 'terre',
    portee: [1, 1],
    vision: 5,
    munitions: null,
    carburant: null,
    capture: true,
    transport: null,
    degats,
    peutRiposter: true,
    peutTirerApresMouvement: true,
  };

  const cartes = cartesDeReference(2);
  const premiere = cartes[0];
  assert.ok(premiere, 'le lot de cartes de référence ne peut pas être vide');
  const resultat = simuler({
    carte: premiere,
    cartesReference: cartes,
    parties: 12,
    strategies: ['ponderee', 'agressive'],
    journeesMax: 20,
    catalogueCandidat: { unite: absurde, catalogueVersion: 12 },
  });
  assert.ok(resultat.avec && resultat.sans, 'la campagne de catalogue rend deux blocs');
  assert.equal(resultat.cartesReference?.length, 2);
  // L'IA la produit — sans quoi la comparaison ne mesurerait rien.
  assert.ok((resultat.horsSchema['frequence_production_ia'] ?? 0) > 0.5);
  assert.ok((resultat.horsSchema['efficacite_par_cout'] ?? 0) > 1.3);

  const verdict = rendreVerdict({ type: 'unite', cle: absurde.cle, version: 1 }, resultat);
  assert.equal(verdict.verdict, 'rejete');
  assert.deepEqual(verdict.motifs.map((m) => m.code), ['unite_dominante']);
  assert.ok((verdict.motifs[0]?.mesure?.['efficacite_par_cout'] ?? 0) > 1.3);
  const conforme = validerReviewVerdict(verdict);
  assert.ok(conforme.ok, `verdict non conforme : ${JSON.stringify(conforme.ok ? [] : conforme.erreurs)}`);
});

test('le générateur vérifie la reproductibilité et rend un aperçu commentable', async () => {
  const produit = await generateurMapgen.generer(PARAMETRES, 'mission_essai:2026-09-05:1');
  assert.ok(validerMapDef(produit.carte).ok);
  assert.ok(produit.apercu.ascii.length > 0);
  assert.equal(produit.apercu.mesures['reproductible'], true);
  assert.equal(produit.diagnostic['mapgen_version'], produit.carte.generation?.mapgenVersion);
  // Même graine, même carte : c'est la garantie de `02-architecture.md` §7.
  const bis = await generateurMapgen.generer(PARAMETRES, 'mission_essai:2026-09-05:1');
  assert.deepEqual(bis.carte, produit.carte);
  // Une graine numérique est reprise telle quelle, pour qu'une carte se régénère.
  assert.equal(graineNumerique('4242'), 4242);
  assert.notEqual(graineNumerique('mission:1'), graineNumerique('mission:2'));
});

test('une grille trafiquée est prise en défaut par le contrôle de reproductibilité', () => {
  const carte = genererCarte(PARAMETRES, 99);
  const trafiquee = {
    ...carte,
    grille: carte.grille.map((l, i) => (i === 1 ? `${'P'.repeat(carte.largeur)}` : l)),
  };
  const codes = verifierCarteControle(trafiquee).motifs.map((m) => m.code);
  assert.ok(codes.includes('grille_non_reproductible'), `motifs : ${codes.join(', ')}`);
});

test('un scénario minimal se construit depuis une carte seule', () => {
  const carte = genererCarte(PARAMETRES, 99);
  const s = scenarioMinimal(carte, 12);
  assert.equal(s.carteCle, carte.code);
  assert.equal(s.commandants.length, carte.camps);
  assert.deepEqual(s.cycleJourNuit, { jour: 4, nuit: 2 });
  assert.equal(s.catalogueVersion, 12);
  assert.ok(s.commandants.every((c) => c.commandantCle === 'cmd_neutre'));
});
