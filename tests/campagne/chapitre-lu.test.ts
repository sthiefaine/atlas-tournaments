/**
 * L'ouverture du chapitre luxembourgeois — Le relais de Tomas (`opus1_lu_01`)
 * — et la conséquence du choix de FR12, qui l'attendait depuis le 23 septembre.
 *
 * Ce qui est tenu ici : chaque option de FR12 n'agit que sur LU01, avec l'effet
 * de sa fiche et une réplique de Tomas ; la graine fige le choix ; la mission
 * reste gagnable sous chaque option et sans choix, dans les deux modes (par un
 * pilote simple, pas par un humain) ; le difficile durcit Lise et jamais le
 * joueur ; le parcours enchaîne le Luxembourg après FR12.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  appliquerConsequences, decisionsDeGraine, graineAube, libelleDecision, optionsDecision,
} from '../../src/app/campagne/consequences';
import { enregistrerDecision, enregistrerVictoire, lireProgression, type DecisionLocale } from '../../src/app/campagne/progression';
import { OUVERTURE_LUXEMBOURG, scenarioPourMode } from '../../src/content/difficulte';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { validerMapDef, validerScenario, type MapDef, type Scenario } from '../../src/schemas/index';
import {
  appliquer, chargerCatalogue, creerPartie, empreinte, enregistrerPartie, rejouer, restaurerRng, sceneDepuis,
  type Action, type EtatPartie,
} from '../../src/engine/index';
import { jouerTour, strategie } from '../../src/ai/index';
import { verifierCarte } from '../../src/mapgen/index';
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
const MISSIONS = (lire('content/campagne.json') as { missions: { scenarioCle: string; titre: string; biome: string; objectif: string; conseil: string; recit: string; conclusion: string; tutoriel: string[] }[] }).missions;
/** Les options de FR12 et l'effet que leur fiche leur donne dans Le relais de Tomas. */
const BRANCHES = [
  { choix: 'verser_reserve', effet: 'renfort' },
  { choix: 'preparation_locale', effet: 'fonds' },
] as const;
/** La case où la reconnaissance de la coalition entre : à l'ouest, contre le dépôt. */
const ENTREE_RECONNAISSANCE = { x: 0, y: 10 };

test('le choix de FR12 n’agit que sur Le relais de Tomas, avec l’effet de sa fiche et une réplique de Tomas', () => {
  const lu01 = scenario('opus1_lu_01');
  for (const b of BRANCHES) {
    for (const mode of ['normal', 'difficile'] as const) {
      const base = scenarioPourMode(lu01, mode);
      const { scenario: effectif, rappels } = appliquerConsequences(base, [decision('opus1_fr_12', b.choix)]);
      assert.equal(rappels.length, 1, `${b.choix} : un seul rappel au briefing`);
      assert.ok(rappels[0]!.startsWith(libelleDecision(decision('opus1_fr_12', b.choix))!.titre));
      assert.equal(effectif.dialogueOuverture.length, base.dialogueOuverture.length + 1);
      assert.equal(effectif.dialogueOuverture.at(-1)!.locuteur, 'cmd_tomas_reiner', 'Tomas rappelle la promesse');
      assert.ok(validerScenario(effectif).ok, `${b.choix}/${mode} : ${JSON.stringify(validerScenario(effectif))}`);
      if (b.effet === 'renfort') {
        assert.match(effectif.dialogueOuverture.at(-1)!.texte, /rend la monnaie/);
        assert.deepEqual(effectif.fondsDepartParCamp, base.fondsDepartParCamp, 'une reconnaissance, pas d’argent');
        assert.equal((effectif.renforts ?? []).length, (base.renforts ?? []).length + 1);
        const vague = effectif.renforts!.at(-1)!;
        assert.deepEqual({ journee: vague.journee, unites: vague.unites.map((u) => [u.camp, u.type, u.x, u.y]) },
          { journee: 2, unites: [[0, 'recon', ENTREE_RECONNAISSANCE.x, ENTREE_RECONNAISSANCE.y]] });
      } else {
        assert.equal(effectif.fondsDepartParCamp?.[0], (base.fondsDepartParCamp?.[0] ?? base.fondsDepart) + 1500);
        assert.equal(effectif.fondsDepartParCamp?.[1], base.fondsDepartParCamp?.[1], 'Lise n’y gagne rien');
        assert.deepEqual(effectif.renforts ?? [], base.renforts ?? [], 'des fonds, pas de reconnaissance');
      }
    }
    // Aucune autre épreuve du parcours ne lit ce choix.
    for (const m of MISSIONS.filter((x) => x.scenarioCle !== 'opus1_lu_01')) {
      const s = scenario(m.scenarioCle);
      assert.deepEqual(appliquerConsequences(s, [decision('opus1_fr_12', b.choix)]).scenario, s, `${b.choix} ne touche pas ${m.scenarioCle}`);
    }
  }
  // Les textes du choix ne disent plus « mission à venir » : elle est jouable.
  for (const o of optionsDecision('opus1_fr_12')) {
    assert.match(o.effet, /Le relais de Tomas/);
    assert.doesNotMatch(o.effet, /à venir/);
  }
});

test('la reconnaissance de la coalition entre à J2 contre le dépôt, sous les ordres du joueur', () => {
  const base = scenario('opus1_lu_01');
  const effectif = appliquerConsequences(scenarioPourMode(base, 'normal'), [decision('opus1_fr_12', 'verser_reserve')]).scenario;
  const cat = chargerCatalogue(effectif.catalogueVersion);
  const commandants = resoudreCommandantsScenario(effectif);
  let e = creerPartie(sceneDepuis(effectif, carte(base), commandants), cat, 'opus1_lu_01:branche');
  const avant = e.unites.filter((u) => u.camp === 0 && u.type === 'recon').length;
  for (let i = 0; e.journee < 2 && i < 4; i += 1) {
    const r = appliquer(e, { type: 'finTour' }, cat, commandants);
    assert.ok(r.ok);
    e = r.etat;
  }
  assert.equal(e.journee, 2);
  const arrivees = e.unites.filter((u) => u.camp === 0 && u.type === 'recon'
    && Math.abs(u.x - ENTREE_RECONNAISSANCE.x) + Math.abs(u.y - ENTREE_RECONNAISSANCE.y) <= 2);
  assert.equal(e.unites.filter((u) => u.camp === 0 && u.type === 'recon').length, avant + 1);
  assert.equal(arrivees.length, 1, 'elle est arrivée à l’ouest du dépôt');
});

test('la graine d’une partie neuve fige le choix de FR12, et une graine sans choix ne donne rien', () => {
  stockage();
  const lu01 = scenario('opus1_lu_01');
  enregistrerVictoire('opus1_fr_12', 'a');
  assert.equal(enregistrerDecision('opus1_fr_12', 1, 'preparation_locale', 'a'), true);
  const prises = Object.values(lireProgression('a').decisions ?? {});
  const graine = graineAube(lu01, prises);
  assert.equal(graine, `${lu01.code}:a1:000000000002`, 'FR12 garde son chiffre, le douzième');
  const relue = appliquerConsequences(scenarioPourMode(lu01, 'normal'), decisionsDeGraine(lu01, graine));
  assert.equal(relue.scenario.fondsDepartParCamp?.[0], 3000 + 1500);
  // Le joueur ne peut plus changer d'avis : la partie lancée garde sa graine.
  assert.equal(enregistrerDecision('opus1_fr_12', 1, 'verser_reserve', 'a'), false);
  const sansChoix = appliquerConsequences(scenarioPourMode(lu01, 'normal'), decisionsDeGraine(lu01, `${lu01.code}:a1:000000000000`));
  assert.deepEqual(sansChoix.rappels, []);
  assert.deepEqual(sansChoix.scenario, scenarioPourMode(lu01, 'normal'));
});

/**
 * Joue une partie entière, le camp du joueur tenu par l'IA `pilote` et
 * l'adversaire par la sienne, avec le flux d'aléa de `scripts/verifier-campagne.ts`.
 * Ce n'est pas une mesure de difficulté humaine : c'est la preuve qu'une
 * solution légale et simple gagne, et que son rejeu donne la même partie.
 */
function jouerAvecPilote(s: Scenario, m: MapDef, pilote: 'agressive' | 'ponderee', graine: string): EtatPartie {
  const cat = chargerCatalogue(s.catalogueVersion);
  const commandants = resoudreCommandantsScenario(s);
  const scene = sceneDepuis(s, m, commandants);
  let e = creerPartie(scene, cat, graine);
  const actions: Action[] = [];
  for (let tour = 0; tour < 200 && !e.partie.terminee; tour += 1) {
    const ia = e.campCourant === 0 ? pilote : (s.commandants.find((c) => c.camp === e.campCourant)?.ia ?? 'ponderee');
    const r = jouerTour(e, strategie(ia), restaurerRng(e.graine, e.flux), cat, commandants);
    assert.deepEqual(r.refus, []);
    e = r.etat;
    actions.push(...r.actions);
  }
  const repetition = rejouer(scene, cat, enregistrerPartie(e, actions), commandants);
  assert.deepEqual(repetition.refus, []);
  assert.equal(empreinte(repetition.etat), empreinte(e), 'rejeu conforme');
  return e;
}

test('Le relais de Tomas se gagne sans choix et sous chaque option de FR12, dans les deux modes', () => {
  const lu01 = scenario('opus1_lu_01');
  const m = carte(lu01);
  for (const mode of ['normal', 'difficile'] as const) {
    for (const choix of [null, 'verser_reserve', 'preparation_locale'] as const) {
      const s = appliquerConsequences(scenarioPourMode(lu01, mode), choix ? [decision('opus1_fr_12', choix)] : []).scenario;
      const fin = jouerAvecPilote(s, m, 'agressive', `${lu01.code}:1`);
      assert.equal(fin.partie.vainqueur, 0, `${mode}/${choix ?? 'sans choix'} : ${JSON.stringify(fin.partie)} à J${fin.journee}`);
      assert.equal(fin.partie.motif, 'objectif_capture_qg');
      assert.ok(fin.journee <= s.limiteJournees!, `${mode}/${choix ?? 'sans choix'} : J${fin.journee}`);
    }
  }
});

test('le difficile durcit Lise et l’annonce par Tomas ; le normal ne reçoit rien', () => {
  const base = scenario('opus1_lu_01');
  const normal = scenarioPourMode(base, 'normal');
  const dur = scenarioPourMode(base, 'difficile');
  const reglage = OUVERTURE_LUXEMBOURG['opus1_lu_01']!;
  assert.equal(dur.dialogueOuverture.length, normal.dialogueOuverture.length + 1);
  assert.deepEqual(dur.dialogueOuverture.at(-1), reglage.difficile!.annonce);
  assert.deepEqual(normal.renforts ?? [], []);
  assert.deepEqual(dur.renforts, reglage.difficile!.renforts);
  for (const u of dur.renforts!.flatMap((r) => r.unites)) assert.equal(u.camp, 1, 'un renfort de difficile va à Lise');
  assert.equal((dur.fondsDepartParCamp?.[1] ?? 0) - (normal.fondsDepartParCamp?.[1] ?? 0), 1500);
  assert.equal(dur.fondsDepartParCamp?.[0], normal.fondsDepartParCamp?.[0], 'le joueur garde ses fonds');
  assert.deepEqual(dur.victoire, base.victoire, 'même objectif');
  assert.equal(dur.previsionJournees, 1);
  const cat = chargerCatalogue(dur.catalogueVersion);
  assert.doesNotThrow(() => creerPartie(sceneDepuis(dur, carte(base), resoudreCommandantsScenario(dur)), cat, 'opus1_lu_01:difficile'));
  for (const r of [...dur.dialogueOuverture, ...(dur.scenesDialogue ?? []).flatMap((s) => s.repliques)]) {
    assert.ok(dur.commandants.some((c) => c.commandantCle === r.locuteur), `${r.locuteur} parle sans être là`);
  }
});

test('Tomas commande le camp du joueur, Lise l’adversaire, et personne ne parle de famille', () => {
  const s = scenario('opus1_lu_01');
  assert.equal(s.paysCode, 'lu');
  assert.deepEqual(s.commandants.map((c) => [c.camp, c.commandantCle, c.ia ?? null]),
    [[0, 'cmd_tomas_reiner', null], [1, 'cmd_lise_orven', 'ponderee']]);
  // Pas un match d'incarnation (jamais imposé, et il n'écrirait rien de la
  // trame) ni un vestiaire : c'est la colonne de Tomas, comme celle d'Ariane
  // en France.
  assert.equal(s.incarnation, undefined);
  assert.equal(s.choixCommandant, undefined);
  assert.deepEqual(s.victoire, [{ type: 'capture_qg' }]);
  const textes = JSON.stringify([s.dialogueOuverture, s.dialogueVictoire, s.dialogueDefaite, s.scenesDialogue]);
  assert.ok(!/Lise Orven|\b(frère|sœur|père|fille|fils)\b/i.test(textes));
});

test('la carte du relais : le relais au joueur, le QG de Lise sur l’autre rive, aucun défaut de structure', () => {
  const s = scenario('opus1_lu_01');
  const m = carte(s);
  assert.equal(m.biome, 'foret', 'l’Oesling boisé de la fiche pays');
  const relais = Object.entries(m.proprietaires).filter(([k]) => { const [x, y] = k.split(',').map(Number); return m.grille[y!]![x!] === 'T'; });
  assert.deepEqual(relais, [['7,3', 0]], 'le relais de Tomas est une station radar, au joueur');
  const qg = Object.entries(m.proprietaires).filter(([k]) => { const [x, y] = k.split(',').map(Number); return m.grille[y!]![x!] === 'H'; });
  assert.deepEqual(qg.map(([, camp]) => camp).sort(), [0, 1]);
  // La rivière coupe la carte : on la passe à trois ponts ou au gué, et nulle
  // part ailleurs sans mouiller ses bottes.
  const riviere = m.grille.map((l) => l[10]).join('');
  assert.equal(riviere.replace(/V/g, ''), 'NNN');
  const rapport = verifierCarte(m);
  const structurels = rapport.motifs.map((x) => x.code).filter((c) => !['desequilibre_fonds', 'desequilibre_villes'].includes(c));
  assert.deepEqual(structurels, [], JSON.stringify(rapport.motifs));
});

test('le parcours enchaîne le Luxembourg après FR12, et chaque épreuve tient ses textes', () => {
  const codes = MISSIONS.map((m) => m.scenarioCle);
  assert.equal(codes.indexOf('opus1_lu_01'), codes.indexOf('opus1_fr_12') + 1);
  assert.ok(POSITIONS_PARCOURS.length >= MISSIONS.length);
  const luxembourgeoises = MISSIONS.filter((m) => m.scenarioCle.startsWith('opus1_lu_'));
  for (const m of luxembourgeoises) {
    const s = scenario(m.scenarioCle);
    assert.equal(m.titre, s.nom);
    assert.ok(m.titre.startsWith('Saison 1 · '));
    assert.equal(m.biome, carte(s).biome);
    assert.equal(s.version, 1);
    assert.ok(m.tutoriel.length >= 3);
    const textes = [...s.dialogueOuverture, ...s.dialogueVictoire, ...s.dialogueDefaite, ...(s.scenesDialogue ?? []).flatMap((x) => x.repliques)].map((r) => r.texte);
    assert.equal(textes.filter((t) => t.includes('Vous vous souvenez')).length, 1, `${m.scenarioCle} : un rappel « vous vous souvenez », pas plus`);
    for (const t of [...textes, m.objectif, m.conseil, m.recit, m.conclusion, ...m.tutoriel]) {
      assert.ok(t.length <= 240, t);
      assert.ok(((t.match(/\*\*/g) ?? []).length / 2) <= 2, `au plus deux passages en gras : ${t}`);
      assert.ok(!/délégation|intendance|\bronde\b/i.test(t), `mot retiré : ${t}`);
    }
  }
});
