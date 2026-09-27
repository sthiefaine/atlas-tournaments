/**
 * Le **calendrier des disparitions** (`src/app/campagne/disparitions.ts`) : les
 * quatre chefs de nations alliées qui meurent au cours de l'opus 1, écrits en dur
 * dans le code et nulle part ailleurs (tranché le 26 septembre 2026,
 * `doc/refonte/opus1-hors-serie.md` §5 point 2, `13-campagne.md` §5.2).
 *
 * Aujourd'hui, le calendrier est **inerte** : aucun épisode d'ancrage n'existe.
 * Ces tests le font donc tourner sur des progressions fictives, qui ont remporté
 * des finales que personne n'a encore écrites.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

import {
  CALENDRIER_DISPARITIONS, brancheRetenue, commandantsDisparus, type Disparition,
} from '../../src/app/campagne/disparitions';
import { optionNationale } from '../../src/app/campagne/decisions';
import { bancsProposes, optionsCommandant } from '../../src/app/campagne/commandants-jouables';
import { optionsBanc } from '../../src/app/campagne/bancs';
import { VERSION_CANON_AUBE, cleDecision, decisionsDeGraine, graineAube } from '../../src/app/campagne/consequences';
import { disparusDeProgression, normaliserProgression, profilDepuisProgression, vestiaire, type Progression } from '../../src/app/campagne/progression';
import {
  TYPES_CONDITION, TYPES_CONSEQUENCE, TYPES_RECOMPENSE_DEBLOCAGE, validerConsequence, validerScenario,
  type RosterJouables, type Scenario,
} from '../../src/schemas/index';

const lire = <T>(chemin: string): T => JSON.parse(readFileSync(chemin, 'utf8')) as T;
const JOUR = { aujourdhui: '2026-09-26' };
const LES_QUATRE = ['cmd_nikos_delis', 'cmd_mira_karki', 'cmd_tomas_reiner', 'cmd_samir_el_hadi'];

interface EpisodeHs { id: string; choix: { cle: string; options: { id: string }[] } | null }
interface DisparitionRegistre { personnage: string; nation: string; ou: string; ouAlternatif?: string; banc: { branche: string | null; cle: string | null }[] }
const registre = lire<{ episodes: EpisodeHs[]; disparitions: DisparitionRegistre[] }>('doc/refonte/opus1-hors-serie.json');
const nations = lire<{ missions: { id: string; choixConsequence: { cle: string } | null }[] }>('doc/refonte/opus1-nations.json');
const tutos = lire<{ tutoriels: { id: string }[]; finales: { id: string }[] }>('doc/refonte/opus1-tutoriels-final.json');
const episodesConnus = new Set([
  ...nations.missions.map((m) => m.id), ...tutos.tutoriels.map((t) => t.id), ...tutos.finales.map((f) => f.id),
  ...registre.episodes.map((e) => e.id),
]);

/** Une progression qui a remporté ces épreuves et retenu ces décisions (source → option). */
function progression(victoires: string[], decisions: Record<string, string> = {}): Progression {
  const entrees = Object.entries(decisions).map(([scenario, choix]) => [cleDecision(scenario, 1), { scenario, scenarioVersion: 1, canonVersion: VERSION_CANON_AUBE, choix }] as const);
  // `normaliserProgression` filtrerait des décisions dont le canon ne connaît pas
  // encore les options (les hors-série, le Maroc 8) : on la construit à la main.
  return { version: 1, victoires, canonVersion: VERSION_CANON_AUBE, decisions: Object.fromEntries(entrees), journal: entrees.map(([cle]) => cle) };
}
const disparus = (p: Progression): string[] => commandantsDisparus(profilDepuisProgression(p), JOUR);
const d = (cle: string): Disparition => CALENDRIER_DISPARITIONS.find((x) => x.commandantCle === cle)!;

test('le calendrier nomme les quatre, et chaque branche renvoie à un épisode et à une décision réels', () => {
  assert.deepEqual(CALENDRIER_DISPARITIONS.map((x) => x.commandantCle), LES_QUATRE);
  for (const x of CALENDRIER_DISPARITIONS) {
    const defauts = x.branches.filter((b) => b.si === undefined);
    assert.equal(defauts.length, 1, `${x.commandantCle} : une branche par défaut, une seule`);
    assert.equal(x.branches.at(-1), defauts[0], `${x.commandantCle} : le défaut vient en dernier`);
    for (const b of x.branches) {
      for (const ep of [b.apres, b.annonce, ...(b.rappelTrame ? [b.rappelTrame] : [])]) {
        assert.ok(episodesConnus.has(ep), `${x.commandantCle} : ${ep} n’est ni dans la trame ni dans les hors-série`);
      }
      if (!b.si) continue;
      // L'option est l'identifiant enregistré : la famille nationale, ou l'option
      // du hors-série telle que le registre la nomme.
      const hs = registre.episodes.find((e) => e.choix?.cle === b.si!.decision);
      const options = hs ? hs.choix!.options.map((o) => o.id) : [optionNationale(b.si.decision, 'a'), optionNationale(b.si.decision, 'b')];
      assert.ok(options.includes(b.si.option), `${x.commandantCle} : ${b.si.decision} n’enregistre pas ${b.si.option}`);
    }
  }
  // La branche qui déplace le moment demande un geste : garantir le crédit, c'est
  // l'option `a` de la fiche du Maroc 8.
  assert.equal(d('cmd_samir_el_hadi').branches[0]!.si!.option, optionNationale('opus1_ma_08_decision', 'a'));
});

test('le registre éditorial dit la même chose que le calendrier', () => {
  assert.deepEqual(registre.disparitions.map((x) => x.personnage), LES_QUATRE);
  for (const r of registre.disparitions) {
    const cal = d(r.personnage);
    assert.equal(r.nation, cal.paysCode);
    const annonces = new Set(cal.branches.map((b) => b.annonce));
    assert.ok(annonces.has(r.ou), `${r.personnage} : ${r.ou}`);
    if (r.ouAlternatif) assert.ok(annonces.has(r.ouAlternatif), `${r.personnage} : ${r.ouAlternatif}`);
    const bancs = new Set(cal.branches.map((b) => b.banc));
    for (const b of r.banc) assert.ok(bancs.has(b.cle), `${r.personnage} : banc ${b.cle}`);
  }
});

test('Nikos : sans geste du joueur, il disparaît après la finale 2 ; la recrue le mène à la finale 7', () => {
  assert.deepEqual(disparus(progression(['opus1_finale_01'])), []);
  assert.deepEqual(disparus(progression(['opus1_finale_02'])), ['cmd_nikos_delis'], 'défaut : hors-série non joué');
  assert.deepEqual(disparus(progression(['opus1_finale_02'], { opus1_hs_gr_2: 'garder_la_main' })), ['cmd_nikos_delis']);
  const recrue = { opus1_hs_gr_2: 'confier_recrue' };
  assert.deepEqual(disparus(progression(['opus1_finale_02'], recrue)), [], 'la recrue tient le passage : il reste au quai');
  assert.equal(brancheRetenue(d('cmd_nikos_delis'), profilDepuisProgression(progression([], recrue)), JOUR).banc, 'dafni_rallis');
  assert.deepEqual(disparus(progression(['opus1_finale_02', 'opus1_finale_07'], recrue)), ['cmd_nikos_delis', 'cmd_mira_karki'],
    'la finale 7 est aussi celle de Mira');
});

test('Mira et Tomas : un seul moment, quoi que le joueur ait choisi', () => {
  assert.deepEqual(disparus(progression(['opus1_finale_06'])), []);
  assert.ok(disparus(progression(['opus1_finale_07'], { opus1_hs_np_2: 'poser_pont' })).includes('cmd_mira_karki'));
  assert.ok(disparus(progression(['opus1_finale_07'], { opus1_hs_np_2: 'passer_col' })).includes('cmd_mira_karki'));
  assert.ok(!disparus(progression(['opus1_finale_10'])).includes('cmd_tomas_reiner'), 'le repli ne suffit pas');
  assert.ok(disparus(progression(['opus1_finale_11'])).includes('cmd_tomas_reiner'), 'la finale 12 s’ouvre sur l’annonce');
});

test('Samir : garantir le crédit lui donne une saison, le refuser l’annonce à l’Australie 1', () => {
  assert.deepEqual(disparus(progression(['opus1_jp_12'], { opus1_ma_08: 'refuser_garantie' })), ['cmd_samir_el_hadi']);
  assert.deepEqual(disparus(progression(['opus1_jp_12'])), ['cmd_samir_el_hadi'], 'sans garantie donnée, c’est la branche sans remplaçant');
  const garanti = { opus1_ma_08: 'garantir_livraison' };
  assert.deepEqual(disparus(progression(['opus1_jp_12'], garanti)), []);
  assert.deepEqual(disparus(progression(['opus1_jp_12', 'opus1_finale_13'], garanti)), ['cmd_samir_el_hadi']);
  assert.equal(brancheRetenue(d('cmd_samir_el_hadi'), profilDepuisProgression(progression([], garanti)), JOUR).annonce, 'opus1_finale_14');
});

/** Un roster d'exemple : Ariane d'entrée, Tomas et Mira gagnés au col, Samir aux réserves. */
const ROSTER: RosterJouables = {
  version: 1,
  statut: 'exemple_de_test',
  jouables: [
    { cle: 'cmd_ariane_belloc', ouvertPar: 'debut', gout: 'x' },
    { cle: 'cmd_tomas_reiner', ouvertPar: 'pacte_du_col', gout: 'x' },
    { cle: 'cmd_mira_karki', ouvertPar: 'pacte_du_col', gout: 'x' },
    { cle: 'cmd_samir_el_hadi', ouvertPar: 'aube_reserves_1v2', gout: 'x' },
  ],
  secrets: [{ cle: 'cmd_hadran_ost', libelle: 'x', indice: 'x', condition: { type: 'mode_fini', mode: 'difficile' } }],
};
function scenario(code: string): Scenario {
  const r = validerScenario(lire(`content/scenarios/${code}.json`));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}

test('vestiaire : un général annoncé disparu n’est plus proposé, où qu’il ait été gagné', () => {
  const avant = progression(['pacte_du_col', 'aube_reserves_1v2']);
  assert.deepEqual(vestiaire(avant, ROSTER), ['cmd_ariane_belloc', 'cmd_tomas_reiner', 'cmd_mira_karki', 'cmd_samir_el_hadi']);
  const apres = progression(['pacte_du_col', 'aube_reserves_1v2', 'opus1_finale_07', 'opus1_finale_11']);
  assert.deepEqual(vestiaire(apres, ROSTER), ['cmd_ariane_belloc', 'cmd_samir_el_hadi']);
  assert.deepEqual(disparusDeProgression(apres), ['cmd_mira_karki', 'cmd_tomas_reiner']);
  // Le briefing lit la même liste : `optionsCommandant` passe par `vestiaire`.
  const routes = scenario('aube_routes_3v1');
  assert.deepEqual(optionsCommandant(routes, avant, ROSTER).map((o) => o.cle), ['cmd_ariane_belloc', 'cmd_tomas_reiner', 'cmd_mira_karki', 'cmd_samir_el_hadi']);
  assert.deepEqual(optionsCommandant(routes, apres, ROSTER).map((o) => o.cle), ['cmd_ariane_belloc', 'cmd_samir_el_hadi']);
  // Une épreuve se joue toujours avec le commandant qu'elle déclare.
  const sousTomas: Scenario = { ...routes, commandants: routes.commandants.map((c) => (c.camp === 0 ? { ...c, commandantCle: 'cmd_tomas_reiner' } : c)) };
  const options = optionsCommandant(sousTomas, apres, ROSTER);
  assert.equal(options[0]?.cle, 'cmd_tomas_reiner');
  assert.equal(options[0]?.defaut, true);
});

test('bancs : le banc d’un disparu n’est plus proposé, et la partie jouée sous ses couleurs se relit', () => {
  const avant = progression(['opus1_tutoriel_10']);
  const apres = progression(['opus1_tutoriel_10', 'opus1_finale_11']);
  assert.deepEqual(bancsProposes('pacte_du_col', avant).map((o) => o.cle), ['propres_couleurs', 'cmd_tomas_reiner']);
  assert.deepEqual(bancsProposes('pacte_du_col', apres).map((o) => o.cle), ['propres_couleurs'], 'jouer ses couleurs reste proposé');
  // `optionsBanc` ne bouge pas : il fait le chiffre de la graine et relit ce qui a été joué.
  assert.deepEqual(optionsBanc('pacte_du_col').map((o) => o.cle), ['propres_couleurs', 'cmd_tomas_reiner']);
  const pacte = scenario('pacte_du_col');
  const joue = [{ scenario: 'pacte_du_col:banc', scenarioVersion: pacte.version, canonVersion: VERSION_CANON_AUBE, choix: 'cmd_tomas_reiner' }];
  const relu = decisionsDeGraine(pacte, graineAube(pacte, joue));
  assert.ok(relu.some((x) => x.scenario === 'pacte_du_col:banc' && x.choix === 'cmd_tomas_reiner'), 'la reprise rejoue le banc de Tomas');
});

test('le calendrier est inerte tant qu’aucun épisode d’ancrage n’existe', () => {
  // Toutes les épreuves du canon remportées, en normal et en difficile : aucune
  // n'est une ancre. Le jour où une finale ou la Japon 12 entre au canon, ce test
  // tombe — c'est le moment de donner à la grille du vestiaire un quatrième état
  // (la plaque posée à plat) au lieu du « verrouillé » qu'elle montrerait.
  const codes = readdirSync('content/scenarios').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const ancres = CALENDRIER_DISPARITIONS.flatMap((x) => x.branches.map((b) => b.apres));
  assert.deepEqual(codes.filter((c) => ancres.includes(c)), [], 'un épisode d’ancrage existe désormais');
  const tout = normaliserProgression({ version: 1, victoires: codes, victoiresParMode: { difficile: codes } });
  assert.deepEqual(disparusDeProgression(tout, { modesFinis: ['normal', 'difficile'] }), []);
});

test('aucun schéma de contenu ne sait dire une disparition', () => {
  // La liste fermée des conséquences reste à dix : retirer un général n'en est pas une.
  assert.equal(TYPES_CONSEQUENCE.length, 10);
  const mots = /retir|dispar|mort|deces|deuil/;
  for (const t of [...TYPES_CONSEQUENCE, ...TYPES_CONDITION, ...TYPES_RECOMPENSE_DEBLOCAGE]) assert.ok(!mots.test(t), t);
  assert.equal(validerConsequence({ type: 'co_commandant_retire', commandantCle: 'cmd_tomas_reiner' }).ok, false);
  assert.equal(validerConsequence({ type: 'co_commandant', commandantCle: 'cmd_tomas_reiner' }).ok, true,
    'rendre un général recrutable, oui ; le retirer, jamais');
});
