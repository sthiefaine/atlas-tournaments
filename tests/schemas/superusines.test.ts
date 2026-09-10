import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validerScenario } from '../../src/schemas/index';

const source = JSON.parse(readFileSync(new URL('../../content/scenarios/aube_essai_maritime_iem_climat.json', import.meta.url), 'utf8'));

test('superusines : une case, un camp connu, un type, un calendrier borné', () => {
  const s = structuredClone(source);
  s.superusines = [{ x: 1, y: 1, camp: 1, type: 'char_leger' }, { x: 2, y: 1, camp: 1, type: 'infanterie', depuisJournee: 3, chaque: 2, max: 4 }];
  const r = validerScenario(s);
  assert.ok(r.ok, r.ok ? '' : JSON.stringify(r.erreurs));
  assert.equal(r.ok && r.valeur.superusines?.length, 2);
});

test('superusines : ce qui est refusé', () => {
  for (const modifier of [
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 7, type: 'char_leger' }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1, type: 'char_leger', chaque: 0 }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1, type: 'char_leger', max: 0 }]; },
    (s: typeof source) => { s.superusines = [{ x: 60, y: 1, camp: 1, type: 'char_leger' }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1, type: 'Char Léger' }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1, type: 'char_leger' }, { x: 1, y: 1, camp: 1, type: 'infanterie' }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1, type: 'char_leger', gratuite: true }]; },
    (s: typeof source) => { s.superusines = [{ x: 1, y: 1, camp: 1 }]; },
  ]) {
    const s = structuredClone(source); modifier(s); assert.equal(validerScenario(s).ok, false);
  }
});
