import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { validerScenario, validerMapDef } from '../../src/schemas/index';
import { scenarioPourMode } from '../../src/app/jeu/difficulte';
import { etatStation, stationParDefaut } from '../../src/app/campagne/itineraire';
const lire = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const manifeste = lire('content/campagne.json') as { missions: { scenarioCle: string; entrainement: boolean; tutoriel: string[] }[] };

test('dix tutoriels distincts précèdent les deux matchs officiels et sont valides dans les deux modes', () => {
  assert.equal(manifeste.missions.length, 12);
  const tutoriels = manifeste.missions.filter(m => m.entrainement);
  assert.equal(tutoriels.length, 10);
  assert.deepEqual(manifeste.missions.slice(0, 10), tutoriels);
  const grilles = new Set<string>();
  for (const m of tutoriels) {
    assert.ok(m.tutoriel.length >= 3, m.scenarioCle);
    const scenario = validerScenario(lire(`content/scenarios/${m.scenarioCle}.json`));
    assert.ok(scenario.ok, JSON.stringify(scenario));
    const s = scenario.valeur;
    assert.equal(s.statut, 'en_ligne');
    assert.ok(s.dialogueOuverture.length > 0 && s.dialogueVictoire.length > 0);
    assert.ok(s.scenesDialogue?.length);
    const carte = validerMapDef(lire(`content/cartes/${s.carteCle}.json`));
    assert.ok(carte.ok, JSON.stringify(carte));
    grilles.add(JSON.stringify(carte.valeur.grille));
    assert.ok(s.modes, `modes explicites : ${s.code}`);
    for (const mode of ['normal', 'difficile'] as const) {
      const variant = scenarioPourMode(s, mode);
      assert.ok(validerScenario(variant).ok, `${s.code}/${mode}`);
      assert.deepEqual(variant.victoire, s.victoire);
    }
  }
  assert.equal(grilles.size, 10, 'aucune carte recopiée');
});

test('un ancien profil poursuit au cinquième tutoriel et conserve ses matchs remportés', () => {
  const codes = manifeste.missions.map(m => m.scenarioCle);
  const anciennesVictoires = [...codes.slice(0, 4), 'pacte_du_col', 'couleurs_alliees'];
  assert.equal(stationParDefaut(codes, anciennesVictoires), 4);
  assert.equal(etatStation(codes, 4, anciennesVictoires, true), 'ouverte');
  assert.equal(etatStation(codes, 5, anciennesVictoires, true), 'verrouillee');
  assert.equal(etatStation(codes, 10, anciennesVictoires, true), 'gagnee');
});

test('les premiers exercices ne déclenchent pas de brouillard nocturne avant sa leçon', () => {
  for (const m of manifeste.missions.slice(0, 5)) {
    const s = lire(`content/scenarios/${m.scenarioCle}.json`);
    assert.equal(s.brouillard, false, s.code);
    assert.equal(s.cycleJourNuit.nuit, 0, s.code);
  }
  const s = lire('content/scenarios/opus1_tutoriel_06.json');
  assert.equal(s.brouillard, true);
  assert.deepEqual(s.cycleJourNuit, { jour: 2, nuit: 2 });
  for (const journee of [2, 3, 5]) assert.ok(s.scenesDialogue.some((scene: { declencheur: {type: string; journee?: number} }) => scene.declencheur.type === 'journee' && scene.declencheur.journee === journee));
});
