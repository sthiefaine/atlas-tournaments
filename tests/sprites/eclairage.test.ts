// La lumière de cuisson, recalculée : les forces de `reglages.ts` rendent les
// clartés visées par la charte, et la lumière est symétrique — deux faces en
// miroir reçoivent la même lumière. La calibration (`calibration.test.ts`,
// `calibration_lumiere`) les mesure sur des images réellement cuites.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ECLAIRAGE_CUISSON } from '../../src/render2d/contrat';
import { CLARTES_VISEES, ECLAIRAGE, clarteFace } from '../../scripts/sprites/reglages';

test('la lumière vient du joueur, en face ; le contour du haut de l’écran', () => {
  assert.deepEqual(ECLAIRAGE_CUISSON.principale, { azimut: 0, elevation: 60 });
  assert.deepEqual(ECLAIRAGE_CUISSON.contour, { azimut: 180, elevation: 30 });
  assert.equal(ECLAIRAGE.principale.azimut, 0);
  assert.equal(ECLAIRAGE.contour.azimut, 180);
});

test('une face blanche horizontale sort à 1, celle tournée vers le joueur à 0,68, les flancs à 0,45', () => {
  // Repère de Blender : x à droite, y vers le haut de l'écran, z en l'air.
  assert.ok(Math.abs(clarteFace([0, 0, 1]) - CLARTES_VISEES.horizontale) < 1e-9);
  assert.ok(Math.abs(clarteFace([0, -1, 0]) - CLARTES_VISEES.joueur) < 1e-9);
  assert.ok(Math.abs(clarteFace([1, 0, 0]) - CLARTES_VISEES.flanc) < 1e-9);
  assert.ok(Math.abs(clarteFace([-1, 0, 0]) - CLARTES_VISEES.flanc) < 1e-9);
  assert.equal(CLARTES_VISEES.horizontale, 1);
  assert.equal(CLARTES_VISEES.joueur, 0.68);
  assert.equal(CLARTES_VISEES.flanc, 0.45);
});

test('la lumière est symétrique : deux faces en miroir reçoivent la même lumière', () => {
  for (const [x, y, z] of [[0.7071, -0.7071, 0], [0.5, -0.5, 0.7071], [0.9, 0.3, 0.3], [0.2, -0.9, 0.39]] as const) {
    assert.ok(Math.abs(clarteFace([x, y, z]) - clarteFace([-x, y, z])) < 1e-12, `${x} ${y} ${z}`);
  }
  // Le cube de calibration tourné de 45° : ses deux faces avant à 0,61.
  assert.ok(Math.abs(clarteFace([Math.SQRT1_2, -Math.SQRT1_2, 0]) - 0.6126) < 1e-3);
  // Les forces restent raisonnables : la principale domine, le contour ne brûle rien.
  assert.ok(ECLAIRAGE.principale.force > 1.4 && ECLAIRAGE.principale.force < 1.5);
  assert.ok(ECLAIRAGE.contour.force > 0.9 && ECLAIRAGE.contour.force < 1);
  assert.equal(ECLAIRAGE.ciel, 0.45);
});
