import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validerScenario } from '../../src/schemas/index';
const source = JSON.parse(readFileSync(new URL('../../content/scenarios/aube_essai_maritime_iem_climat.json', import.meta.url), 'utf8'));
test('technologies : scénario vitrine et valeurs par défaut acceptés', () => {
  assert(validerScenario(source).ok);
  const s = structuredClone(source);
  delete s.installationsIem[0].rayon; delete s.installationsIem[0].intervalle;
  assert(validerScenario(s).ok);
});
test('technologies : télégraphie, bornes, camps et fenêtres refusent les configurations injustes', () => {
  for (const modifier of [
    (s: typeof source) => { s.installationsIem[0].premiereJournee = 1; },
    (s: typeof source) => { s.installationsIem[0].rayon = 60; },
    (s: typeof source) => { s.installationsIem[0].intervalle = 1; },
    (s: typeof source) => { s.installationsIem.push({...s.installationsIem[0], cle:'autre'}); },
    (s: typeof source) => { s.evenementsClimat[0].journee = 2; },
    (s: typeof source) => { s.evenementsClimat[0].duree = 4; },
    (s: typeof source) => { s.evenementsClimat[0].campsAdaptes = [3]; },
    (s: typeof source) => { s.evenementsClimat.push({...s.evenementsClimat[0], cle:'autre'}); },
  ]) {
    const s = structuredClone(source); modifier(s); assert(!validerScenario(s).ok);
  }
});
