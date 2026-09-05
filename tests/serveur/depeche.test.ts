// Les échéances de la Dépêche : Europe/Paris, changement d'heure compris (05 §7.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ETAPES, HEURES, echeance, instantLocal, jourLocal, minutesRestantes, passee } from '../../src/serveur/depeche';
import { estIndisponible, reponseSimulationIndisponible, simulateurIndisponible, bornerCampagne, conditionsSansDoublon, CONDITIONS_PAR_DEFAUT } from '../../src/serveur/simulation';

test('une heure murale d’été à Paris vaut UTC+2', () => {
  // 5 septembre : heure d'été, 07 h 00 à Paris = 05 h 00 UTC.
  assert.equal(instantLocal('2026-09-05', '07:00', 'Europe/Paris').toISOString(), '2026-09-05T05:00:00.000Z');
});

test('une heure murale d’hiver à Paris vaut UTC+1', () => {
  // 5 janvier : heure d'hiver, 18 h 00 à Paris = 17 h 00 UTC.
  assert.equal(instantLocal('2026-01-05', '18:00', 'Europe/Paris').toISOString(), '2026-01-05T17:00:00.000Z');
});

test('les cinq échéances de la journée sont dans l’ordre', () => {
  const jour = '2026-09-05';
  const heures = ETAPES.map((e) => echeance(jour, e.nom).getTime());
  for (let i = 1; i < heures.length; i += 1) {
    assert.ok((heures[i] ?? 0) > (heures[i - 1] ?? 0), `${ETAPES[i]?.nom} devrait suivre ${ETAPES[i - 1]?.nom}`);
  }
});

test('les heures sont celles de 05 §7.3', () => {
  assert.equal(HEURES.proposition, '07:00');
  assert.equal(HEURES.scenario, '09:30');
  assert.equal(HEURES.certification, '11:00');
  assert.equal(HEURES.validation, '17:00');
});

test('une échéance passée est passée, et le reste', () => {
  const jour = '2026-09-05';
  const apres = new Date('2026-09-05T06:00:00Z'); // 08 h 00 à Paris
  assert.equal(passee(jour, 'proposition', apres), true);
  assert.equal(passee(jour, 'certification', apres), false);
  assert.ok(minutesRestantes(jour, 'certification', apres) > 0);
  assert.ok(minutesRestantes(jour, 'proposition', apres) < 0);
});

test('jourLocal rend le jour parisien, pas le jour UTC', () => {
  // 23 h 30 UTC un 4 septembre = déjà le 5 à Paris (été).
  assert.equal(jourLocal(new Date('2026-09-04T23:30:00Z')), '2026-09-05');
});

test('le simulateur absent répond 503, il n’invente aucun chiffre', async () => {
  assert.equal(simulateurIndisponible.disponible, false);
  await assert.rejects(
    () => simulateurIndisponible.simulerCarte({ mapId: 'x', parties: 1, profilsIa: ['ponderee'], journeesMax: 10, conditions: [] }),
    (e: unknown) => estIndisponible(e),
  );
  const reponse = reponseSimulationIndisponible();
  assert.equal(reponse.status, 503);
  const corps = await reponse.json() as { error: string };
  assert.equal(corps.error, 'simulation_indisponible');
});

test('les bornes de campagne rétrogradent le nombre de parties', () => {
  assert.deepEqual(bornerCampagne(40, 6), { parties: 40, retrograde: false });
  assert.deepEqual(bornerCampagne(100, 6), { parties: 40, retrograde: true });
  assert.equal(bornerCampagne(500, 1).parties, 100);
});

test('les conditions par défaut sont six, sans doublon', () => {
  assert.equal(CONDITIONS_PAR_DEFAUT.length, 6);
  assert.equal(conditionsSansDoublon(CONDITIONS_PAR_DEFAUT), true);
  assert.equal(conditionsSansDoublon([CONDITIONS_PAR_DEFAUT[0]!, CONDITIONS_PAR_DEFAUT[0]!]), false);
});
