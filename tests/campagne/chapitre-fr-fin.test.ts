/**
 * La fin du chapitre français (FR10 à FR12) et les trois choix qui la
 * traversent : FR08 → FR10, FR10 → FR12, FR12 → Le relais de Tomas.
 *
 * Ce qui est tenu ici : chaque choix n'agit que sur l'épreuve qu'il annonce,
 * avec l'effet de sa fiche et une réplique dite par quelqu'un de présent ; la
 * graine fige le choix au lancement et une graine d'avant relit toujours les
 * siens ; le mode difficile durcit l'adversaire et jamais l'allié ; le parcours
 * range le chapitre dans l'ordre de ses fiches.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  CHOIX_FRANCE, SOURCES_DECISION, appliquerConsequences, decisionsDeGraine, graineAube, libelleDecision, optionsDecision,
} from '../../src/app/campagne/consequences';
import { enregistrerDecision, enregistrerVictoire, lireProgression, type DecisionLocale } from '../../src/app/campagne/progression';
import { FIN_CHAPITRE_FR, scenarioPourMode } from '../../src/content/difficulte';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { LONGUEUR_MAX_GRAINE, validerMapDef, validerSauvegarde, validerScenario, type MapDef, type Scenario } from '../../src/schemas/index';
import { appliquer, chargerCatalogue, creerPartie, empreinte, enregistrerPartie, rejouer, sceneDepuis } from '../../src/engine/index';
import { POSITIONS_PARCOURS } from '../../src/app/campagne/paysage-campagne';

function stockage(): void {
  const donnees = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
  } });
}
const lire = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
function scenario(code: string): Scenario {
  const r = validerScenario(lire(`content/scenarios/${code}.json`));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}
function carte(s: Scenario): MapDef {
  const r = validerMapDef(lire(`content/cartes/${s.carteCle}.json`));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}
const decision = (source: string, choix: string): DecisionLocale => ({ scenario: source, scenarioVersion: 1, canonVersion: 1, choix });
const CHAPITRE = ['opus1_fr_10', 'opus1_fr_11', 'opus1_fr_12'] as const;
/** Chaque choix, sa cible jouable (ou `null`) et l'effet que sa fiche lui donne. */
const BRANCHES = [
  { source: 'opus1_fr_08', choix: 'garantir_livraison', cible: 'opus1_fr_10', effet: 'renfort' },
  { source: 'opus1_fr_08', choix: 'refuser_garantie', cible: 'opus1_fr_10', effet: 'fonds' },
  { source: 'opus1_fr_10', choix: 'retour_sous_audit', cible: 'opus1_fr_12', effet: 'renfort' },
  { source: 'opus1_fr_10', choix: 'fin_du_mandat', cible: 'opus1_fr_12', effet: 'fonds' },
] as const;

test('les trois choix du chapitre portent les clés de leurs fiches, et s’ajoutent après FR04 dans la graine', () => {
  assert.deepEqual(Object.keys(CHOIX_FRANCE), ['opus1_fr_04', 'opus1_fr_08', 'opus1_fr_10', 'opus1_fr_12']);
  assert.deepEqual(optionsDecision('opus1_fr_08').map((o) => o.cle), ['garantir_livraison', 'refuser_garantie']);
  assert.deepEqual(optionsDecision('opus1_fr_10').map((o) => o.cle), ['retour_sous_audit', 'fin_du_mandat']);
  assert.deepEqual(optionsDecision('opus1_fr_12').map((o) => o.cle), ['verser_reserve', 'preparation_locale']);
  // Les neuf premières sources ne bougent pas : c'est leur position qui donne
  // leur sens aux chiffres d'une graine enregistrée.
  assert.equal(SOURCES_DECISION.indexOf('opus1_fr_04'), 8);
  assert.deepEqual(SOURCES_DECISION.slice(9), ['opus1_fr_08', 'opus1_fr_10', 'opus1_fr_12']);
  for (const o of Object.values(CHOIX_FRANCE).flat()) {
    assert.ok(o.titre.length > 0 && o.titre.length <= 60, o.titre);
    assert.ok(!/délégation|intendance/i.test(`${o.titre} ${o.effet}`), `mot retiré : ${o.titre}`);
  }
});

test('une graine d’avant se relit sans rien perdre, une graine neuve tient dans la borne des sauvegardes', () => {
  const fr06 = scenario('opus1_fr_06');
  // Enregistrée le 14 septembre : neuf chiffres, FR04 au neuvième.
  const ancienne = `${fr06.code}:a1:000000001`;
  assert.deepEqual(decisionsDeGraine(fr06, ancienne), [decision('opus1_fr_04', 'partager_releves')]);
  const relue = appliquerConsequences(fr06, decisionsDeGraine(fr06, ancienne));
  assert.ok(relue.scenario.renforts?.some((r) => r.journee === 2 && r.unites.some((u) => u.camp === 0 && u.type === 'recon')), 'le renfort de FR04 est toujours là');
  assert.equal(validerSauvegarde({ scenarioCle: fr06.code, graine: ancienne, catalogueVersion: 0, engineVersion: 1, mapgenVersion: 1, contentVersion: 1, actions: [] }).ok, true);
  // La graine neuve porte les douze chiffres, et relit les trois choix neufs.
  const fr12 = scenario('opus1_fr_12');
  const prises = [decision('opus1_fr_04', 'garder_reserve'), decision('opus1_fr_08', 'refuser_garantie'), decision('opus1_fr_10', 'fin_du_mandat'), decision('opus1_fr_12', 'verser_reserve')];
  const graine = graineAube(fr12, prises);
  assert.equal(graine, `${fr12.code}:a1:000000002221`);
  assert.deepEqual(decisionsDeGraine(fr12, graine), prises);
  assert.ok(graine.length <= LONGUEUR_MAX_GRAINE);
  // Onze chiffres n'ont jamais été une longueur : on ne devine pas.
  assert.deepEqual(decisionsDeGraine(fr12, `${fr12.code}:a1:00000000222`), []);
});

test('chaque choix n’agit que sur l’épreuve qu’il annonce, avec l’effet de sa fiche et une réplique d’Ariane', () => {
  for (const b of BRANCHES) {
    for (const mode of ['normal', 'difficile'] as const) {
      const base = scenarioPourMode(scenario(b.cible), mode);
      const { scenario: effectif, rappels } = appliquerConsequences(base, [decision(b.source, b.choix)]);
      assert.equal(rappels.length, 1, `${b.choix} : un seul rappel au briefing`);
      assert.ok(rappels[0]!.startsWith(libelleDecision(decision(b.source, b.choix))!.titre));
      assert.equal(effectif.dialogueOuverture.length, base.dialogueOuverture.length + 1);
      assert.ok(validerScenario(effectif).ok, `${b.choix}/${mode} : ${JSON.stringify(validerScenario(effectif))}`);
      const distribution = new Set(effectif.commandants.map((c) => c.commandantCle));
      assert.ok(distribution.has(effectif.dialogueOuverture.at(-1)!.locuteur), 'la réplique est dite par quelqu’un de présent');
      if (b.effet === 'renfort') {
        assert.deepEqual(effectif.fondsDepartParCamp, base.fondsDepartParCamp, 'une reconnaissance, pas d’argent');
        const ajoutes = (effectif.renforts ?? []).length - (base.renforts ?? []).length;
        assert.equal(ajoutes, 1);
        const vague = effectif.renforts!.at(-1)!;
        assert.deepEqual({ journee: vague.journee, unites: vague.unites.map((u) => [u.camp, u.type]) }, { journee: 2, unites: [[0, 'recon']] });
      } else {
        assert.equal(effectif.fondsDepartParCamp?.[0], (base.fondsDepartParCamp?.[0] ?? base.fondsDepart) + 1500);
        for (const c of effectif.commandants.filter((x) => x.camp !== 0)) assert.equal(effectif.fondsDepartParCamp?.[c.camp], base.fondsDepartParCamp?.[c.camp]);
        assert.deepEqual(effectif.renforts ?? [], base.renforts ?? [], 'des fonds, pas de reconnaissance');
      }
    }
    // Aucune autre épreuve du chapitre ne bouge.
    for (const autre of CHAPITRE.filter((c) => c !== b.cible)) {
      const s = scenario(autre);
      assert.deepEqual(appliquerConsequences(s, [decision(b.source, b.choix)]).scenario, s, `${b.choix} ne touche pas ${autre}`);
    }
  }
});

test('le renfort d’une branche se pose sur la carte et la partie se joue', () => {
  for (const b of BRANCHES.filter((x) => x.effet === 'renfort')) {
    const base = scenario(b.cible);
    const effectif = appliquerConsequences(scenarioPourMode(base, 'normal'), [decision(b.source, b.choix)]).scenario;
    const cat = chargerCatalogue(effectif.catalogueVersion);
    const commandants = resoudreCommandantsScenario(effectif);
    let e = creerPartie(sceneDepuis(effectif, carte(base), commandants), cat, `${b.cible}:branche`);
    // Deux tours de chaque camp : la reconnaissance entre au début de J2.
    for (let i = 0; e.journee < 2 && i < 8; i += 1) {
      const r = appliquer(e, { type: 'finTour' }, cat, commandants);
      assert.ok(r.ok);
      e = r.etat;
    }
    assert.equal(e.journee, 2);
    const vague = effectif.renforts!.at(-1)!.unites[0]!;
    assert.ok(e.unites.some((u) => u.camp === 0 && u.type === 'recon' && Math.abs(u.x - vague.x) + Math.abs(u.y - vague.y) <= 2),
      `${b.choix} : la reconnaissance est arrivée près de (${vague.x},${vague.y})`);
  }
});

test('le choix de FR12 s’enregistre et se fige, sans rien changer tant que Le relais de Tomas n’existe pas', () => {
  stockage();
  assert.equal(enregistrerDecision('opus1_fr_12', 1, 'verser_reserve', 'a'), false, 'pas de choix sans victoire');
  enregistrerVictoire('opus1_fr_12', 'a');
  assert.equal(enregistrerDecision('opus1_fr_12', 1, 'verser_reserve', 'a'), true);
  assert.equal(enregistrerDecision('opus1_fr_12', 1, 'preparation_locale', 'a'), false, 'un choix fait ne se refait pas');
  const prises = Object.values(lireProgression('a').decisions ?? {});
  assert.deepEqual(prises.map((d) => [d.scenario, d.choix]), [['opus1_fr_12', 'verser_reserve']]);
  for (const option of optionsDecision('opus1_fr_12')) assert.match(option.effet, /Le relais de Tomas \(mission à venir\)/);
  for (const code of [...CHAPITRE, 'opus1_fr_06', 'pacte_du_col']) {
    const s = scenario(code);
    assert.deepEqual(appliquerConsequences(s, prises).scenario, s, `${code} ne lit pas encore ce choix`);
  }
});

test('un vrai rejeu de FR10 garde la branche de la graine, même si le joueur choisit autre chose ensuite', () => {
  stockage();
  const base = scenario('opus1_fr_10');
  const cat = chargerCatalogue(base.catalogueVersion);
  const graine = graineAube(base, [decision('opus1_fr_08', 'refuser_garantie')]);
  const initiale = appliquerConsequences(scenarioPourMode(base, 'normal'), decisionsDeGraine(base, graine)).scenario;
  const commandants = resoudreCommandantsScenario(initiale);
  const depart = creerPartie(sceneDepuis(initiale, carte(base), commandants), cat, graine);
  const temoin = creerPartie(sceneDepuis(scenarioPourMode(base, 'normal'), carte(base), commandants), cat, graine);
  assert.equal(depart.camps[0]!.fonds - temoin.camps[0]!.fonds, 1500, 'la branche, et rien d’autre');
  assert.equal(depart.camps[1]!.fonds, temoin.camps[1]!.fonds, 'l’adversaire n’y gagne rien');
  const avance = appliquer(depart, { type: 'finTour' }, cat, commandants);
  assert.ok(avance.ok);
  const sauvegarde = enregistrerPartie(avance.etat, [{ type: 'finTour' }]);
  enregistrerVictoire('opus1_fr_08', 'a');
  enregistrerDecision('opus1_fr_08', 1, 'garantir_livraison', 'a');
  const retrouvee = appliquerConsequences(scenarioPourMode(base, 'normal'), decisionsDeGraine(base, sauvegarde.graine)).scenario;
  const reprise = rejouer(sceneDepuis(retrouvee, carte(base), commandants), cat, sauvegarde, commandants);
  assert.deepEqual(reprise.refus, []);
  assert.equal(empreinte(reprise.etat), empreinte(avance.etat));
});

test('le difficile durcit l’adversaire et l’annonce, jamais l’allié ; le normal ne reçoit rien', () => {
  for (const code of CHAPITRE) {
    const base = scenario(code);
    const normal = scenarioPourMode(base, 'normal');
    const dur = scenarioPourMode(base, 'difficile');
    const reglage = FIN_CHAPITRE_FR[code]!;
    assert.equal(dur.dialogueOuverture.length, normal.dialogueOuverture.length + 1, `${code} : le difficile se dit au briefing`);
    assert.deepEqual(dur.dialogueOuverture.at(-1), reglage.difficile!.annonce);
    assert.deepEqual(normal.renforts ?? [], base.renforts ?? [], `${code} : aucun renfort en normal`);
    assert.equal((dur.renforts ?? []).length, (base.renforts ?? []).length + (reglage.difficile!.renforts?.length ?? 0));
    assert.deepEqual(dur.victoire, base.victoire, 'même objectif');
    assert.equal(dur.previsionJournees, 1);
    const allies = base.equipes?.find((e) => e.includes(0)) ?? [0];
    for (const c of base.commandants) {
      if (c.camp === 0) continue;
      if (allies.includes(c.camp)) {
        // L'allié garde ses fonds, ses revenus et sa stratégie, dans les deux modes.
        for (const s of [normal, dur]) {
          assert.equal(s.fondsDepartParCamp?.[c.camp], base.fondsDepartParCamp?.[c.camp], `${code} : fonds de l’allié ${c.camp}`);
          assert.equal(s.revenusParBatimentParCamp?.[c.camp], base.revenusParBatimentParCamp?.[c.camp]);
          assert.equal(s.commandants.find((x) => x.camp === c.camp)?.ia, c.ia);
        }
      } else {
        assert.ok((dur.fondsDepartParCamp?.[c.camp] ?? 0) >= (normal.fondsDepartParCamp?.[c.camp] ?? 0), `${code} : l’adversaire n’est jamais plus pauvre`);
        for (const u of (dur.renforts ?? []).flatMap((r) => r.unites)) assert.ok(!allies.includes(u.camp), 'un renfort de difficile va à l’adversaire');
      }
    }
    // Un renfort de difficile se pose sur une case que son unité peut tenir.
    const cat = chargerCatalogue(dur.catalogueVersion);
    assert.doesNotThrow(() => creerPartie(sceneDepuis(dur, carte(base), resoudreCommandantsScenario(dur)), cat, `${code}:difficile`));
    for (const r of [...dur.dialogueOuverture, ...(dur.scenesDialogue ?? []).flatMap((s) => s.repliques)]) {
      assert.ok(dur.commandants.some((c) => c.commandantCle === r.locuteur), `${code} : ${r.locuteur} parle sans être là`);
    }
  }
  // FR04 garde sa ligne à part, inchangée.
  const fr04 = scenario('opus1_fr_04');
  assert.equal(scenarioPourMode(fr04, 'difficile').fondsDepartParCamp?.[1], fr04.fondsDepartParCamp?.[1]);
});

test('le parcours range le chapitre français dans l’ordre de ses fiches, et chaque épreuve tient ses textes', () => {
  const missions = (lire('content/campagne.json') as { missions: { scenarioCle: string; titre: string; biome: string; objectif: string; tutoriel: string[] }[] }).missions;
  const francaises = missions.map((m) => m.scenarioCle).filter((c) => c.startsWith('opus1_fr_'));
  assert.deepEqual(francaises, Array.from({ length: 12 }, (_, i) => `opus1_fr_${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual(missions.slice(-3).map((m) => m.scenarioCle), [...CHAPITRE]);
  for (const code of CHAPITRE) {
    const m = missions.find((x) => x.scenarioCle === code)!;
    const s = scenario(code);
    assert.equal(m.titre, s.nom);
    assert.equal(m.biome, carte(s).biome);
    assert.equal(s.version, 1);
    assert.ok(m.tutoriel.length >= 3);
    const textes = [...s.dialogueOuverture, ...s.dialogueVictoire, ...s.dialogueDefaite, ...(s.scenesDialogue ?? []).flatMap((x) => x.repliques)].map((r) => r.texte);
    const rappels = textes.filter((t) => t.includes('Vous vous souvenez')).length;
    assert.equal(rappels, 1, `${code} : un rappel « vous vous souvenez », pas plus`);
    for (const t of [...textes, m.objectif, ...m.tutoriel]) {
      assert.ok(t.length <= 240, t);
      assert.ok(((t.match(/\*\*/g) ?? []).length / 2) <= 2, `au plus deux passages en gras : ${t}`);
      assert.ok(!/délégation|intendance|\bronde\b/i.test(t), `mot retiré : ${t}`);
    }
  }
});

test('FR11 : trois colonnes des Gris sans QG ni usine, que seule la mise hors jeu arrête', () => {
  const s = scenario('opus1_fr_11');
  const m = carte(s);
  assert.deepEqual(s.victoire, [{ type: 'hors_jeu_total' }]);
  assert.deepEqual(s.equipes, [[0], [1, 2, 3]]);
  assert.deepEqual(s.commandants.map((c) => c.commandantCle), ['cmd_ariane_belloc', 'cmd_hadran_ost', 'cmd_mael_orven', 'cmd_lise_orven']);
  const cat = chargerCatalogue(s.catalogueVersion);
  const e = creerPartie(sceneDepuis(s, m, resoudreCommandantsScenario(s)), cat, 'fr11');
  for (const camp of [1, 2, 3] as const) {
    assert.equal(e.camps.find((c) => c.id === camp)!.qgCase, null, `camp ${camp} sans QG`);
    assert.ok(!Object.values(e.proprietaires).includes(camp), `camp ${camp} sans bâtiment`);
    // Aucune unité capable de capturer : les Gris cassent, ils ne prennent pas.
    assert.ok(e.unites.filter((u) => u.camp === camp).every((u) => !cat.unites[u.type]!.traits.includes('capture')));
  }
  // Aucun lien de famille n'est dit : Lise garde son nom public.
  const textes = JSON.stringify([s.dialogueOuverture, s.dialogueVictoire, s.dialogueDefaite, s.scenesDialogue]);
  assert.ok(!/Lise Orven|\b(frère|sœur|père|fille|fils)\b/i.test(textes));
});

test('la carte de campagne pose chaque étape, les anciennes à leur place et FR07 à FR12 sans chevauchement', () => {
  const missions = (lire('content/campagne.json') as { missions: { scenarioCle: string }[] }).missions;
  assert.ok(POSITIONS_PARCOURS.length >= missions.length, 'chaque étape du parcours a sa position');
  // Les dix-huit d'avant, telles que `carte-parcours.tsx` les tenait : un
  // joueur retrouve ses étapes où il les a laissées.
  assert.deepEqual(POSITIONS_PARCOURS.slice(0, 18), [
    [205, 185], [325, 275], [435, 225], [542, 290], [478, 411], [594, 482], [721, 431], [798, 334], [903, 262],
    [1050, 340], [1054, 460], [945, 565], [813, 636], [1000, 690], [710, 747], [552, 671], [403, 735], [251, 641],
  ]);
  assert.equal(missions.findIndex((m) => m.scenarioCle === 'opus1_fr_07'), 18);
  for (const [x, y] of POSITIONS_PARCOURS) {
    assert.ok(x >= 40 && x <= 1160 && y >= 40 && y <= 747, `(${x}, ${y}) dans le dessin, sans agrandir la carte`);
  }
  for (let i = 18; i < POSITIONS_PARCOURS.length; i += 1) {
    for (let j = 0; j < POSITIONS_PARCOURS.length; j += 1) {
      if (i === j) continue;
      const [ax, ay] = POSITIONS_PARCOURS[i]!;
      const [bx, by] = POSITIONS_PARCOURS[j]!;
      assert.ok(Math.hypot(ax - bx, ay - by) >= 90, `les étapes ${i + 1} et ${j + 1} ne se chevauchent pas`);
    }
  }
});
