/**
 * Les **hors-série** de l'opus 1 (`doc/refonte/opus1-hors-serie.md` et `.json`) :
 * leurs vingt-huit conditions d'ouverture se valident et s'évaluent, et chaque
 * décision qu'elles lisent est nommée **comme la campagne l'enregistre**.
 *
 * C'est la faute qui casserait en silence : une condition écrite contre la fiche
 * de conception — `opus1_br_04_decision` = `a` — ne s'ouvrirait jamais, parce que
 * la campagne enregistre `partager_releves` (tranché le 26 septembre 2026,
 * `13-campagne.md` §8.2, `src/app/campagne/decisions.ts`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

import { evaluerCondition } from '../../src/engine/deblocages';
import { validerCondition, type Condition, type ProfilCampagne } from '../../src/schemas/index';
import {
  LETTRES_OPTIONS, OPTIONS_DECISIONS_NATIONALES, choixDeSource, optionNationale,
} from '../../src/app/campagne/decisions';
import { SOURCES_DECISION, VERSION_CANON_AUBE, cleDecision, optionsDecision } from '../../src/app/campagne/consequences';
import { cleSourceBanc, cleSourceCommandant } from '../../src/app/campagne/bancs';
import { journalDeProgression, normaliserProgression, profilDepuisProgression } from '../../src/app/campagne/progression';

interface Option { id: string; texte: string; ecritFlags: string[] }
interface Episode {
  id: string;
  nation: string;
  ouverture: Condition;
  ancrage: string;
  choix: { cle: string; options: Option[] } | null;
  consequences: { type: string; paysCode?: string; relation?: string; flagTrace?: string; condition?: string }[];
  personnages: string[];
}
interface Registre { totalEpisodes: number; parNation: Record<string, number>; episodes: Episode[] }
interface MissionNationale { id: string; choixConsequence: { cle: string; options: { id: string }[] } | null }

const lire = <T>(chemin: string): T => JSON.parse(readFileSync(chemin, 'utf8')) as T;
const registre = lire<Registre>('doc/refonte/opus1-hors-serie.json');
const nationales = lire<{ missions: MissionNationale[] }>('doc/refonte/opus1-nations.json').missions
  .filter((m): m is MissionNationale & { choixConsequence: NonNullable<MissionNationale['choixConsequence']> } => m.choixConsequence !== null);
const flagsCanon = new Map(lire<{ flags: { cle: string; valeur: string }[] }>('content/flags.json').flags.map((f) => [f.cle, f.valeur]));
const JOUR = { aujourdhui: '2026-09-26' };

/** Les feuilles d'une condition, `et` et `ou` dépliés. */
function feuilles(c: Condition): Condition[] {
  return c.type === 'et' || c.type === 'ou' ? c.conditions.flatMap(feuilles) : [c];
}

/** Les options enregistrées d'une décision lue par un hors-série, ou `null` si elle n'existe nulle part. */
function optionsEnregistrees(cle: string): readonly string[] | null {
  if (nationales.some((m) => m.choixConsequence.cle === cle)) {
    return LETTRES_OPTIONS.map((l) => optionNationale(cle, l)).filter((o): o is string => o !== null);
  }
  const hs = registre.episodes.find((e) => e.choix?.cle === cle);
  return hs ? hs.choix!.options.map((o) => o.id) : null;
}

/** Un profil vide, puis ce qu'il faut pour qu'une feuille de condition soit vraie. */
function profilVide(): ProfilCampagne {
  return {
    cle: 'profil_hors_serie', paysDepart: 'fr', mode: 'normal',
    flags: { booleens: {}, compteurs: {}, journal: [] },
    deblocages: [], filsEnCours: [], filsFinis: [], scenariosFinis: [], secretsTrouves: [],
    paysVisites: [], modesFinis: [], relations: {}, confiance: {}, serieDepeches: 0,
    catalogueVersion: 6, chainesVersion: 1, creeLe: '2026-09-26', majLe: '2026-09-26',
  };
}
function satisfaire(p: ProfilCampagne, c: Condition): ProfilCampagne {
  const q = structuredClone(p);
  if (c.type === 'flag') q.flags.booleens[c.cle] = true;
  else if (c.type === 'compteur') q.flags.compteurs[c.cle] = c.min;
  else if (c.type === 'decision') {
    q.flags.journal.push({ journee: 0, scenarioCle: c.cle.replace(/_decision$/, ''), choixCle: c.cle, optionCle: c.option, flagsEcrits: [] });
  } else throw new Error(`feuille inattendue dans un hors-série : ${c.type}`);
  return q;
}

test('le registre compte vingt-huit hors-série, et chaque ouverture passe validerCondition', () => {
  assert.equal(registre.episodes.length, 28);
  assert.equal(registre.totalEpisodes, 28);
  assert.equal(Object.values(registre.parNation).reduce((a, b) => a + b, 0), 28);
  for (const e of registre.episodes) {
    const r = validerCondition(e.ouverture);
    assert.ok(r.ok, `${e.id} : ${JSON.stringify(r)}`);
  }
});

test('chaque décision lue par un hors-série est nommée et optée comme la campagne l’enregistre', () => {
  let lues = 0;
  for (const e of registre.episodes) {
    for (const f of feuilles(e.ouverture)) {
      if (f.type !== 'decision') continue;
      lues += 1;
      const options = optionsEnregistrees(f.cle);
      assert.ok(options, `${e.id} lit une décision qui n’existe ni dans la trame ni dans les hors-série : ${f.cle}`);
      assert.ok(options.includes(f.option), `${e.id} : ${f.cle} n’enregistre pas l’option ${f.option} (options : ${options.join(', ')})`);
      assert.ok(!(LETTRES_OPTIONS as readonly string[]).includes(f.option), `${e.id} : une lettre de fiche n’est pas une option enregistrée`);
    }
  }
  // Douze lectures de décision nationale, dont deux pour la Mongolie, la seule
  // à s'ouvrir sur un refus : si ce nombre change, c'est un registre retouché.
  assert.equal(lues, 12);
});

test('les lettres des fiches se lisent une fois : la France, seule codée, enregistre les quatre familles', () => {
  // L'option `a` est la première enregistrée, `b` la seconde — la position qui fait
  // aussi le chiffre de la graine.
  for (const [famille, attendues] of Object.entries(OPTIONS_DECISIONS_NATIONALES)) {
    assert.deepEqual(optionsDecision(`opus1_fr_${famille}`).map((o) => o.cle), [...attendues], `famille ${famille}`);
  }
  // Les quarante-huit décisions de la trame : deux options, a puis b, et un nom
  // au journal qui est exactement celui de la fiche.
  assert.equal(nationales.length, 48);
  for (const m of nationales) {
    assert.deepEqual(m.choixConsequence.options.map((o) => o.id), [...LETTRES_OPTIONS], m.id);
    assert.equal(choixDeSource(m.id), m.choixConsequence.cle, `${m.id} : le journal ne la nommerait pas comme sa fiche`);
    for (const l of LETTRES_OPTIONS) assert.ok(optionNationale(m.choixConsequence.cle, l), `${m.id} ${l}`);
  }
  assert.equal(optionNationale('opus1_hs_gr_2_decision', 'a'), null, 'un hors-série n’est pas une famille nationale');
  assert.equal(optionNationale('opus1_fr_05_decision', 'a'), null, 'aucune décision au cinquième épisode');
});

test('toute décision nationale codée enregistre les identifiants de sa famille', () => {
  // Aujourd'hui la France ; demain le Luxembourg, la Suisse… Une nation codée avec
  // d'autres clés fermerait en silence les hors-série qui la lisent.
  const nationalesCodees = SOURCES_DECISION.filter((s) => /^opus1_[a-z]{2}_(04|08|10|12)$/.test(s));
  assert.ok(nationalesCodees.length >= 4, 'la France au moins');
  for (const source of nationalesCodees) {
    const famille = source.slice(-2) as keyof typeof OPTIONS_DECISIONS_NATIONALES;
    assert.deepEqual(optionsDecision(source).map((o) => o.cle), [...OPTIONS_DECISIONS_NATIONALES[famille]], source);
  }
});

test('chaque flag lu ou écrit par un hors-série existe au canon, avec son type', () => {
  for (const e of registre.episodes) {
    for (const f of feuilles(e.ouverture)) {
      if (f.type === 'flag') assert.equal(flagsCanon.get(f.cle), 'booleen', `${e.id} lit ${f.cle}`);
      if (f.type === 'compteur') assert.equal(flagsCanon.get(f.cle), 'compteur', `${e.id} lit ${f.cle}`);
    }
    for (const o of e.choix?.options ?? []) {
      for (const f of o.ecritFlags) assert.ok(flagsCanon.has(f), `${e.id} ${o.id} écrit un flag absent du canon : ${f}`);
    }
    for (const c of e.consequences) if (c.flagTrace) assert.ok(flagsCanon.has(c.flagTrace), `${e.id} trace ${c.flagTrace}`);
  }
});

test('les règles dures du registre tiennent : ni retrait, ni secret, une option par identifiant', () => {
  for (const e of registre.episodes) {
    for (const c of e.consequences) {
      if (c.type === 'relation_nation') assert.ok(c.relation === 'alliee' || c.relation === 'rivale', `${e.id} : ${c.relation}`);
      // Une trace conditionnelle nomme l'option qui la pose, par son identifiant.
      if (c.condition !== undefined) {
        const option = /^option ([a-z][a-z0-9_]+)$/.exec(c.condition)?.[1];
        assert.ok(option && e.choix?.options.some((o) => o.id === option), `${e.id} : « ${c.condition} »`);
      }
    }
    for (const o of e.choix?.options ?? []) {
      assert.ok(o.ecritFlags.every((f) => !f.startsWith('monde.secret.')), `${e.id} écrit un secret`);
      assert.ok(validerCondition({ type: 'decision', cle: e.choix!.cle, option: o.id }).ok, `${e.id} : ${o.id} n’est pas une clé`);
    }
  }
});

test('chaque ouverture s’évalue : rien n’est ouvert d’avance, et chaque porte ouvre seule', () => {
  for (const e of registre.episodes) {
    assert.equal(evaluerCondition(e.ouverture, profilVide(), JOUR), false, `${e.id} s’ouvre sur un profil vide`);
    // Une porte à la fois : chaque feuille, seule, ouvre l'épisode — c'est la règle
    // des deux portes (un `ou`) et celle des épisodes d'un arc (un flag).
    const portes = e.ouverture.type === 'ou' ? e.ouverture.conditions : [e.ouverture];
    for (const porte of portes) {
      assert.equal(evaluerCondition(e.ouverture, satisfaire(profilVide(), porte), JOUR), true, `${e.id} : ${JSON.stringify(porte)}`);
      // L'autre option d'une décision n'ouvre rien.
      if (porte.type === 'decision') {
        const autre = optionsEnregistrees(porte.cle)!.find((o) => o !== porte.option)!;
        const faux: Condition = { ...porte, option: autre };
        assert.equal(evaluerCondition(e.ouverture, satisfaire(profilVide(), faux), JOUR), false, `${e.id} s’ouvre sur ${porte.cle} = ${autre}`);
      }
    }
  }
});

test('de la progression locale au journal : une décision se lit sous le nom de sa fiche', () => {
  const d = (scenario: string, version: number, choix: string) => ({ scenario, scenarioVersion: version, canonVersion: VERSION_CANON_AUBE, choix });
  const p = normaliserProgression({
    version: 1, victoires: ['opus1_fr_04', 'pacte_du_col'],
    decisions: {
      [cleDecision('opus1_fr_04', 3)]: d('opus1_fr_04', 3, 'partager_releves'),
      [cleDecision(cleSourceBanc('pacte_du_col'), 2)]: d(cleSourceBanc('pacte_du_col'), 2, 'cmd_tomas_reiner'),
      [cleDecision(cleSourceCommandant('aube_routes_3v1'), 1)]: d(cleSourceCommandant('aube_routes_3v1'), 1, 'cmd_ren_mizuno'),
      [cleDecision('opus1_fr_04', 4)]: d('opus1_fr_04', 4, 'garder_reserve'),
    },
    journal: [cleDecision('opus1_fr_04', 3), cleDecision(cleSourceBanc('pacte_du_col'), 2), cleDecision(cleSourceCommandant('aube_routes_3v1'), 1), cleDecision('opus1_fr_04', 4)],
  });
  const journal = journalDeProgression(p);
  assert.deepEqual(journal.map((j) => [j.scenarioCle, j.choixCle, j.optionCle]), [
    ['opus1_fr_04', 'opus1_fr_04_decision', 'partager_releves'],
    ['pacte_du_col', 'pacte_du_col_banc', 'cmd_tomas_reiner'],
    ['aube_routes_3v1', 'aube_routes_3v1_commandant', 'cmd_ren_mizuno'],
    ['opus1_fr_04', 'opus1_fr_04_decision', 'garder_reserve'],
  ]);
  const profil = profilDepuisProgression(p);
  // Une épreuve révisée a reposé sa question : la réponse d'après est la retenue.
  assert.equal(evaluerCondition({ type: 'decision', cle: 'opus1_fr_04_decision', option: 'garder_reserve' }, profil, JOUR), true);
  assert.equal(evaluerCondition({ type: 'decision', cle: 'opus1_fr_04_decision', option: 'partager_releves' }, profil, JOUR), false);
  assert.equal(evaluerCondition({ type: 'decision', cle: 'pacte_du_col_banc', option: 'cmd_tomas_reiner' }, profil, JOUR), true);
  // Un journal donné par l'appelant l'emporte sur celui qu'on déduit.
  const donne = profilDepuisProgression(p, { flags: { booleens: {}, compteurs: {}, journal: [] } });
  assert.equal(evaluerCondition({ type: 'decision', cle: 'opus1_fr_04_decision', option: 'garder_reserve' }, donne, JOUR), false);
  // Une progression d'avant le journal garde ses décisions lisibles.
  const sansJournal = normaliserProgression({ version: 1, victoires: [], decisions: { x: d('opus1_fr_08', 1, 'refuser_garantie') } });
  assert.equal(evaluerCondition({ type: 'decision', cle: 'opus1_fr_08_decision', option: 'refuser_garantie' }, profilDepuisProgression(sansJournal), JOUR), true);
});
