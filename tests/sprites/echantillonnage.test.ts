// Les instants photographiés d'un clip : la cadence du contrat, un plafond
// d'images, et une durée lue qui reste la vraie.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { IMAGES_PAR_SECONDE } from '../../src/render2d/contrat';
import { echantillonner } from '../../scripts/sprites/echantillonnage';
import { IMAGES_MAX_PAR_CLIP } from '../../scripts/sprites/reglages';

test('un clip qui boucle se découpe sur [0, durée[ à la cadence du contrat', () => {
  const e = echantillonner(1, true);
  assert.equal(e.temps.length, IMAGES_PAR_SECONDE);
  assert.equal(e.ips, IMAGES_PAR_SECONDE);
  assert.equal(e.temps[0], 0);
  assert.ok(e.temps.at(-1)! < 1, 'la dernière image précède la première');
});

test('un clip qui joue une fois garde sa première et sa dernière pose', () => {
  for (const duree of [0.5, 0.7, 0.9]) {
    const e = echantillonner(duree, false);
    assert.equal(e.temps[0], 0);
    assert.ok(Math.abs(e.temps.at(-1)! - duree) < 1e-6, `${duree}`);
    // La dernière image tombe à la fin du clip, à la cadence de lecture.
    assert.ok(Math.abs((e.temps.length - 1) / e.ips - duree) < 1e-4, `${duree}`);
  }
});

test('un clip long est plafonné, et sa cadence baisse pour garder sa durée', () => {
  const repos = echantillonner(2.4, true);
  assert.equal(repos.temps.length, IMAGES_MAX_PAR_CLIP);
  assert.ok(Math.abs(repos.temps.length / repos.ips - 2.4) < 1e-4);
  const capture = echantillonner(1.3, false);
  assert.equal(capture.temps.length, IMAGES_MAX_PAR_CLIP);
  assert.ok(Math.abs((capture.temps.length - 1) / capture.ips - 1.3) < 1e-4);
});

test('les instants croissent, et une durée nulle donne une image', () => {
  for (const [d, b] of [[0.7, false], [2.4, true], [3.2, true], [1.3, false]] as const) {
    const t = echantillonner(d, b).temps;
    for (let i = 1; i < t.length; i++) assert.ok(t[i]! > t[i - 1]!);
  }
  assert.deepEqual(echantillonner(0, true).temps, [0]);
  assert.deepEqual(echantillonner(Number.NaN, false).temps, [0]);
});
