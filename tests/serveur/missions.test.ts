// La file de missions : tri, reprise, échéances, champ `apprise` (05 §1.5, §1.9).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BORNES_MISSIONS, FENETRE_REPRISE_MIN, PRIORITE, construireApprise, echeanceDepassee,
  habiller, reprisePossible, trierFile,
} from '../../src/serveur/missions';

const T0 = new Date('2026-09-05T08:00:00Z');

function m(id: string, priorite: number, minutes: number, echeance: Date | null = null) {
  return { id, priorite, ouverteDepuis: new Date(T0.getTime() - minutes * 60_000), echeance };
}

test('la Dépêche passe devant tout, quelle que soit l’ancienneté du reste', () => {
  const file = trierFile([
    m('vieille', PRIORITE.fond, 600),
    m('depeche', PRIORITE.depeche, 1, new Date(T0.getTime() + 3_600_000)),
    m('controle', PRIORITE.controle, 120),
  ]);
  assert.deepEqual(file.map((f) => f.id), ['depeche', 'controle', 'vieille']);
});

test('à priorité égale, la plus ancienne d’abord', () => {
  const file = trierFile([m('recente', 100, 5), m('ancienne', 100, 500)]);
  assert.deepEqual(file.map((f) => f.id), ['ancienne', 'recente']);
});

test('à priorité égale, une mission à échéance passe devant', () => {
  const file = trierFile([
    m('sans', 100, 500),
    m('avec', 100, 1, new Date(T0.getTime() + 60_000)),
  ]);
  assert.deepEqual(file.map((f) => f.id), ['avec', 'sans']);
});

test('une mission ouverte depuis moins de 30 minutes est reprise', () => {
  assert.equal(reprisePossible(m('a', 100, 29), T0), true);
  assert.equal(reprisePossible(m('a', 100, 30), T0), false);
  assert.equal(reprisePossible(m('a', 100, 90), T0), false);
  assert.equal(FENETRE_REPRISE_MIN, 30);
});

test('une échéance passée n’est pas rattrapée', () => {
  assert.equal(echeanceDepassee(m('a', 0, 1, new Date(T0.getTime() - 1)), T0), true);
  assert.equal(echeanceDepassee(m('a', 0, 1, new Date(T0.getTime() + 1)), T0), false);
  assert.equal(echeanceDepassee(m('a', 0, 1, null), T0), false);
});

test('apprise porte le code, la fréquence et la mesure, et s’arrête à huit', () => {
  const motifs = Array.from({ length: 12 }, (_, i) => ({ code: `motif_${i}`, n: 12 - i, mesure: null }));
  const apprise = construireApprise(motifs);
  assert.equal(apprise.length, 8);
  assert.equal(apprise[0], 'motif_0 ×12 (30 j)');

  const avecMesure = construireApprise([
    { code: 'avantage_premier_joueur', n: 3, mesure: { victoires_camp_1: 0.62 } },
  ]);
  assert.equal(avecMesure[0], 'avantage_premier_joueur ×3 (30 j, victoires_camp_1 0,62)');
});

test('apprise est trié par fréquence décroissante', () => {
  const apprise = construireApprise([
    { code: 'rare', n: 1, mesure: null },
    { code: 'frequent', n: 9, mesure: null },
  ]);
  assert.match(apprise[0] ?? '', /^frequent/);
});

test('une mission habillée porte ses deux URL et son échéance', () => {
  const servie = habiller(
    { id: 'msn_1', kind: 'map.depeche', cibleType: 'MissionDuJour', cibleCle: '2026-09-05', ouverteDepuis: T0, echeance: new Date(T0.getTime() + 60_000) },
    ['une leçon'],
    'https://exemple.test',
  );
  assert.equal(servie.promptUrl, 'https://exemple.test/api/routines/missions/msn_1');
  assert.equal(servie.submitUrl, 'https://exemple.test/api/routines/missions/msn_1/soumission');
  assert.ok(servie.echeance);
  assert.deepEqual(servie.cible, { type: 'MissionDuJour', cle: '2026-09-05' });
});

test('les bornes de missions par run sont celles de 05 §7.1', () => {
  assert.equal(BORNES_MISSIONS.atlas_lore, 6);
  assert.equal(BORNES_MISSIONS.atlas_map, 8);
  assert.equal(BORNES_MISSIONS.atlas_controle, 12);
  assert.equal(BORNES_MISSIONS.atlas_cerveau, 4);
  assert.equal(BORNES_MISSIONS.atlas_traduction, 1);
});
