/**
 * Le banc prêté au briefing (`src/app/campagne/bancs.ts`, `doc/refonte/banc-prete.md`).
 *
 * Quatre choses à tenir : le schéma, la décision (enregistrée sans victoire,
 * rechoisie à chaque nouvelle partie, rejouable à l'identique par la graine),
 * l'échange des bancs sur le scénario effectif, et la mini-branche dans
 * l'épreuve suivante — avec des locuteurs qui existent.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { BANCS_PRETES, PROPRES_COULEURS, appliquerBanc, bancChoisi, cleSourceBanc, optionsBanc, scenarioDeSource } from '../../src/app/campagne/bancs';
import { SOURCES_DECISION, appliquerConsequences, decisionsDeGraine, graineAube, libelleDecision, optionsDecision } from '../../src/app/campagne/consequences';
import { enregistrerBanc, lireProgression, normaliserProgression, type DecisionLocale } from '../../src/app/campagne/progression';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { lireProfilCommandant } from '../../src/content/profils-commandants';
import { SOURCE_FR } from '../../src/i18n/index';
import { validerMapDef, validerScenario, type Scenario } from '../../src/schemas/index';
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
function carteDe(s: Scenario) {
  const r = validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`, 'utf8')));
  assert.ok(r.ok);
  return r.valeur;
}
const banc = (code: string, choix: string): DecisionLocale => ({ scenario: cleSourceBanc(code), scenarioVersion: 1, canonVersion: 1, choix });

/** Les locuteurs d'un scénario, toutes répliques confondues, contre sa distribution. */
function locuteursConnus(s: Scenario): void {
  const distribution = new Set(s.commandants.map((c) => c.commandantCle));
  const repliques = [...s.dialogueOuverture, ...s.dialogueVictoire, ...s.dialogueDefaite, ...(s.scenesDialogue ?? []).flatMap((sc) => sc.repliques)];
  for (const r of repliques) assert.ok(distribution.has(r.locuteur), `${s.code} : ${r.locuteur} parle sans être au tableau`);
}

test('schéma : un banc est un commandant connu, jamais celui du camp 0, jamais avec une incarnation', () => {
  const base = scenario('pacte_du_col');
  assert.ok(base.bancs && base.bancs.length === 1);
  const avec = (bancs: unknown, reste: Partial<Scenario> = {}) => validerScenario({ ...base, ...reste, bancs });
  assert.equal(avec([{ commandantCle: 'cmd_ariane_belloc', paysCode: 'fr', libelle: 'banc.x.y' }]).ok, false, 'le commandant du joueur est déjà le défaut');
  assert.equal(avec([...base.bancs!, ...base.bancs!]).ok, false, 'deux fois le même général');
  assert.equal(avec([{ commandantCle: 'tomas', paysCode: 'lu', libelle: 'banc.x.y' }]).ok, false, 'forme cmd_<prenom>_<nom>');
  assert.equal(avec([{ commandantCle: 'cmd_tomas_reiner', paysCode: 'lu', libelle: 'pas une clé' }]).ok, false, 'libellé : une clé i18n');
  assert.equal(avec([{ commandantCle: 'cmd_tomas_reiner', paysCode: 'lu', libelle: 'banc.x.y', couleur: 'rouge' }]).ok, false, 'clé inconnue');
  assert.equal(avec([]).ok, false, 'un tableau vide ne propose rien');
  assert.equal(avec(base.bancs, { incarnation: { paysCode: 'lu', commandantCle: 'cmd_tomas_reiner' } }).ok, false, 'incarnation et bancs');
  assert.ok(avec([{ commandantCle: 'cmd_solveig_tamm', paysCode: 'atl', libelle: 'banc.pacte_du_col.cmd_solveig_tamm' }]).ok, 'un banc de l’Intendance');
});

test('canon : chaque banc a un profil, ses chaînes, et la table de bancs.ts ne dérive pas des scénarios', () => {
  const lus = readdirSync('content/scenarios').filter((f) => f.endsWith('.json')).map((f) => scenario(f.slice(0, -5)));
  const avecBancs = lus.filter((s) => s.bancs);
  assert.deepEqual(avecBancs.map((s) => s.code).sort(), Object.keys(BANCS_PRETES).sort(), 'un scénario à bancs par entrée de la table, et réciproquement');
  for (const s of avecBancs) {
    assert.deepEqual(s.bancs, BANCS_PRETES[s.code]!.map(({ commandantCle, paysCode, libelle }) => ({ commandantCle, paysCode, libelle })), s.code);
    for (const b of BANCS_PRETES[s.code]!) {
      // « Le registre » : un banc sans profil n'aurait ni style ni kit à montrer.
      assert.ok(lireProfilCommandant(b.commandantCle), `${s.code} : ${b.commandantCle} absent du catalogue des commandants`);
      assert.ok(SOURCE_FR[b.libelle], `${b.libelle} sans chaîne`);
      assert.ok(SOURCE_FR[b.effet], `${b.effet} sans chaîne`);
      assert.ok(SOURCE_FR[`commandant.${b.commandantCle}.nom`], `${b.commandantCle} sans nom`);
      assert.notEqual(b.commandantCle, s.commandants.find((c) => c.camp === 0)?.commandantCle);
    }
  }
  for (const cle of ['banc.choisir', 'banc.note', 'banc.jouer', 'banc.journal', 'banc.en_cours', 'banc.kit', 'banc.propres_couleurs', 'banc.sans_suite']) {
    assert.ok(SOURCE_FR[cle], `${cle} sans chaîne`);
  }
});

test('options : ses propres couleurs d’abord, puis les bancs ; rien pour un scénario sans banc', () => {
  assert.deepEqual(optionsBanc('premier_contact'), []);
  const options = optionsBanc('aube_nuit_2v2');
  assert.deepEqual(options.map((o) => o.cle), [PROPRES_COULEURS, 'cmd_solveig_tamm', 'cmd_wren_osoko']);
  assert.deepEqual(optionsDecision(cleSourceBanc('aube_nuit_2v2')), options, 'optionsDecision répond pour une source de banc');
  assert.equal(scenarioDeSource(cleSourceBanc('pacte_du_col')), 'pacte_du_col');
  assert.equal(bancChoisi('pacte_du_col', PROPRES_COULEURS), null);
  assert.equal(bancChoisi('pacte_du_col', 'cmd_wren_osoko'), null, 'un banc étranger à l’épreuve');
  assert.equal(bancChoisi('pacte_du_col', 'cmd_tomas_reiner')?.paysCode, 'lu');
  assert.ok(SOURCES_DECISION.indexOf(cleSourceBanc('pacte_du_col')) > SOURCES_DECISION.indexOf('opus1_tutoriel_10'), 'les bancs viennent après les choix dans la graine');
});

test('décision : enregistrée avant toute victoire, rechoisie à la partie suivante, refusée si inconnue', () => {
  stockage();
  assert.equal(enregistrerBanc('pacte_du_col', 2, 'cmd_wren_osoko', 'a'), false, 'un banc que l’épreuve ne propose pas');
  assert.equal(enregistrerBanc('pacte_du_col', 2, 'cmd_tomas_reiner', 'a'), true);
  let p = lireProgression('a');
  assert.equal(p.journal?.length, 1);
  assert.equal(Object.values(p.decisions ?? {})[0]?.choix, 'cmd_tomas_reiner');
  assert.equal(libelleDecision(Object.values(p.decisions ?? {})[0]!)?.titre, 'banc.pacte_du_col.cmd_tomas_reiner');
  // Une nouvelle partie sous ses propres couleurs remplace, sans doubler la ligne.
  assert.equal(enregistrerBanc('pacte_du_col', 2, PROPRES_COULEURS, 'a'), true);
  p = lireProgression('a');
  assert.equal(p.journal?.length, 1);
  assert.equal(Object.values(p.decisions ?? {})[0]?.choix, PROPRES_COULEURS);
  assert.equal(lireProgression('b').journal?.length ?? 0, 0, 'la décision appartient au profil');
  // La normalisation garde une décision de banc et jette une source inconnue.
  const brut = { version: 1, victoires: [], canonVersion: 1, decisions: {
    x: { scenario: cleSourceBanc('aube_nuit_2v2'), scenarioVersion: 2, canonVersion: 1, choix: 'cmd_solveig_tamm' },
    y: { scenario: cleSourceBanc('premier_contact'), scenarioVersion: 1, canonVersion: 1, choix: 'cmd_tomas_reiner' },
  }, journal: ['x', 'y'] };
  const n = normaliserProgression(brut);
  assert.equal(Object.keys(n.decisions ?? {}).length, 1);
});

test('graine : le banc y est figé, une reprise le relit, les anciennes graines restent lisibles', () => {
  const base = scenario('pacte_du_col');
  const graine = graineAube(base, [banc('pacte_du_col', 'cmd_tomas_reiner')]);
  assert.ok(graine.length <= 64);
  assert.notEqual(graine, graineAube(base, []));
  assert.notEqual(graine, graineAube(base, [banc('pacte_du_col', PROPRES_COULEURS)]));
  const relues = decisionsDeGraine(base, graine);
  assert.deepEqual(relues.filter((d) => d.scenario === cleSourceBanc('pacte_du_col')).map((d) => d.choix), ['cmd_tomas_reiner']);
  // Le dernier banc choisi gagne sur une entrée plus ancienne.
  const derniere = graineAube(base, [banc('pacte_du_col', PROPRES_COULEURS), banc('pacte_du_col', 'cmd_tomas_reiner')]);
  assert.equal(derniere, graine);
  // Les graines d'avant les bancs : deux, quatre et cinq chiffres.
  assert.equal(decisionsDeGraine(base, `${base.code}:a1:00002`).length, 1);
  assert.equal(decisionsDeGraine(base, `${base.code}:a1:21`).length, 2);
  assert.equal(decisionsDeGraine(base, `${base.code}:a1:0000200000`).length, 0, 'une longueur inconnue ne se devine pas');
});

test('effectif : l’échange des bancs met le général prêté au camp 0 et le commandant du joueur à sa place', () => {
  const base = scenario('pacte_du_col');
  const tomas = appliquerConsequences(base, [banc('pacte_du_col', 'cmd_tomas_reiner')]).scenario;
  assert.equal(tomas.commandants.find((c) => c.camp === 0)?.commandantCle, 'cmd_tomas_reiner');
  assert.equal(tomas.commandants.find((c) => c.camp === 1)?.commandantCle, 'cmd_ariane_belloc', 'Ariane tient le banc de Tomas');
  assert.equal(tomas.commandants.find((c) => c.camp === 1)?.ia, 'ponderee', 'l’IA reste au camp, pas au commandant');
  assert.deepEqual(tomas.incarnation, { paysCode: 'lu', commandantCle: 'cmd_tomas_reiner' });
  assert.equal(tomas.bancs, undefined, 'le choix est fait');
  assert.equal(tomas.dialogueOuverture[0]?.locuteur, 'cmd_tomas_reiner', 'c’est Tomas qui annonce l’échange');
  assert.equal(tomas.dialogueOuverture.length, base.dialogueOuverture.length);
  locuteursConnus(tomas);
  assert.equal(base.commandants.find((c) => c.camp === 0)?.commandantCle, 'cmd_ariane_belloc', 'canon non muté');
  // Ses propres couleurs : rien ne bouge, et les bancs proposés restent.
  const propres = appliquerConsequences(base, [banc('pacte_du_col', PROPRES_COULEURS)]).scenario;
  assert.deepEqual(propres.commandants, base.commandants);
  assert.equal(propres.incarnation, undefined);
  // Un général venu d'ailleurs ne renvoie personne : Wren prend le camp 0, Solveig garde le sien.
  const nuit = scenario('aube_nuit_2v2');
  const wren = appliquerConsequences(nuit, [banc('aube_nuit_2v2', 'cmd_wren_osoko')]).scenario;
  assert.equal(wren.commandants.find((c) => c.camp === 0)?.commandantCle, 'cmd_wren_osoko');
  assert.equal(wren.commandants.find((c) => c.camp === 3)?.commandantCle, 'cmd_solveig_tamm');
  assert.ok(!wren.commandants.some((c) => c.commandantCle === 'cmd_ariane_belloc'), 'Ariane a quitté le terrain');
  assert.equal(wren.dialogueOuverture[0]?.locuteur, 'cmd_wren_osoko', 'ses consignes de banc passent à Wren');
  locuteursConnus(wren);
  const solveig = appliquerConsequences(nuit, [banc('aube_nuit_2v2', 'cmd_solveig_tamm')]).scenario;
  assert.equal(solveig.commandants.find((c) => c.camp === 3)?.commandantCle, 'cmd_ariane_belloc');
  assert.ok(validerScenario(solveig).ok, 'un essai Aube sous un banc reste un scénario valide');
  // `appliquerBanc` seul, sur une copie : la même règle, sans conséquence.
  const copie = structuredClone(nuit);
  appliquerBanc(copie, { commandantCle: 'cmd_solveig_tamm', paysCode: 'atl', libelle: 'banc.aube_nuit_2v2.cmd_solveig_tamm' });
  assert.deepEqual(copie.commandants, solveig.commandants);
});

test('moteur : le camp du joueur porte le général prêté, et un rejeu sous la même graine est identique', () => {
  const base = scenario('pacte_du_col');
  const carte = carteDe(base);
  const cat = chargerCatalogue(base.catalogueVersion);
  const graine = graineAube(base, [banc('pacte_du_col', 'cmd_tomas_reiner')]);
  const effectif = appliquerConsequences(base, decisionsDeGraine(base, graine)).scenario;
  const scene = sceneDepuis(effectif, carte, resoudreCommandantsScenario(effectif));
  const depart = creerPartie(scene, cat, graine);
  assert.equal(depart.camps[0]?.commandantCle, 'cmd_tomas_reiner');
  assert.equal(depart.camps[1]?.commandantCle, 'cmd_ariane_belloc');
  const avance = appliquer(depart, { type: 'finTour' }, cat);
  assert.ok(avance.ok);
  const sauvegarde = enregistrerPartie(avance.etat, [{ type: 'finTour' }]);
  const retrouve = appliquerConsequences(base, decisionsDeGraine(base, sauvegarde.graine)).scenario;
  const reprise = rejouer(sceneDepuis(retrouve, carte, resoudreCommandantsScenario(retrouve)), cat, sauvegarde, resoudreCommandantsScenario(retrouve));
  assert.deepEqual(reprise.refus, []);
  assert.equal(empreinte(reprise.etat), empreinte(avance.etat));
  // Le témoin : sans banc, c'est Ariane, et l'empreinte diffère.
  const temoin = creerPartie(sceneDepuis(base, carte, resoudreCommandantsScenario(base)), cat, graineAube(base, []));
  assert.equal(temoin.camps[0]?.commandantCle, 'cmd_ariane_belloc');
});

test('branche : chaque banc a sa suite bornée dans l’épreuve suivante, annoncée et parlée par quelqu’un de présent', () => {
  const traduire = (cle: string, params?: Record<string, string | number>) => `[${cle}${params ? ':' + Object.values(params).join(',') : ''}]`;
  // Pacte du col sous Tomas → un transport à J2 aux couleurs alliées, et Ariane s'en souvient.
  const couleurs = scenario('couleurs_alliees');
  const suite = appliquerConsequences(couleurs, [banc('pacte_du_col', 'cmd_tomas_reiner')], traduire);
  assert.ok(suite.scenario.renforts?.some((r) => r.journee === 2 && r.unites.some((u) => u.camp === 0 && u.type === 'transport')));
  assert.equal(suite.scenario.dialogueOuverture.length, couleurs.dialogueOuverture.length + 1);
  assert.equal(suite.scenario.dialogueOuverture.at(-1)?.locuteur, 'cmd_ariane_belloc');
  assert.equal(suite.rappels.length, 1);
  assert.match(suite.rappels[0]!, /banc\.journal:\[banc\.pacte_du_col\.cmd_tomas_reiner\]/);
  assert.match(suite.rappels[0]!, /banc\.pacte_du_col\.cmd_tomas_reiner\.effet/);
  locuteursConnus(suite.scenario);
  assert.ok(validerScenario(suite.scenario).ok);
  assert.doesNotThrow(() => creerPartie(sceneDepuis(suite.scenario, carteDe(couleurs), []), chargerCatalogue(couleurs.catalogueVersion), 'transport'));
  // Ses propres couleurs au col : rien.
  const sans = appliquerConsequences(couleurs, [banc('pacte_du_col', PROPRES_COULEURS)]);
  assert.deepEqual(sans.scenario, couleurs);
  assert.deepEqual(sans.rappels, []);
  // Le détour des batteries sous Tomas → 1 500 fonds à la ligne de nuit, dits par Tomas.
  const nuit = scenario('aube_nuit_2v2');
  const fonds = appliquerConsequences(nuit, [banc('aube_batteries_2v1', 'cmd_tomas_reiner')]).scenario;
  assert.equal(fonds.fondsDepartParCamp?.[0], (nuit.fondsDepartParCamp?.[0] ?? nuit.fondsDepart) + 1500);
  assert.equal(fonds.fondsDepartParCamp?.[1], nuit.fondsDepartParCamp?.[1]);
  assert.equal(fonds.dialogueOuverture.at(-1)?.locuteur, 'cmd_tomas_reiner');
  assert.ok(validerScenario(fonds).ok);
  // Et si la ligne de nuit se joue elle-même sous Wren, Tomas est toujours là pour le dire.
  const cumul = appliquerConsequences(nuit, [banc('aube_batteries_2v1', 'cmd_tomas_reiner'), banc('aube_nuit_2v2', 'cmd_wren_osoko')]).scenario;
  locuteursConnus(cumul);
  assert.equal(cumul.fondsDepartParCamp?.[0], (nuit.fondsDepartParCamp?.[0] ?? nuit.fondsDepart) + 1500);
  // La ligne de nuit sous Solveig ou sous Wren → une réplique différente aux routes d'Aube.
  const routes = scenario('aube_routes_3v1');
  const parSolveig = appliquerConsequences(routes, [banc('aube_nuit_2v2', 'cmd_solveig_tamm')]).scenario;
  const parWren = appliquerConsequences(routes, [banc('aube_nuit_2v2', 'cmd_wren_osoko')]).scenario;
  assert.equal(parSolveig.dialogueOuverture.length, routes.dialogueOuverture.length + 1);
  assert.equal(parWren.dialogueOuverture.length, routes.dialogueOuverture.length + 1);
  assert.notEqual(parSolveig.dialogueOuverture.at(-1)?.texte, parWren.dialogueOuverture.at(-1)?.texte);
  locuteursConnus(parSolveig);
  locuteursConnus(parWren);
  assert.ok(validerScenario(parSolveig).ok && validerScenario(parWren).ok);
  assert.deepEqual(appliquerConsequences(routes, [banc('aube_nuit_2v2', PROPRES_COULEURS)]).scenario, routes);
  // Les répliques ajoutées tiennent en une à trois phrases (`01-bible.md` §5).
  for (const s of [suite.scenario, fonds, parSolveig, parWren]) {
    const derniere = s.dialogueOuverture.at(-1)!.texte;
    const phrases = derniere.split(/[.!?]\s+|[.!?]$/).filter((x) => x.trim() !== '').length;
    assert.ok(phrases >= 1 && phrases <= 3, `${s.code} : ${phrases} phrases`);
  }
});
