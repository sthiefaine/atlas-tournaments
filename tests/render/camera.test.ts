// La caméra : conversions écran ↔ monde, paliers de zoom, recadrage et inertie.
// Rien ici ne touche au DOM — c'est la condition pour que ce soit testable.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  avancerInertie, casesVisibles, centrerSur, couperInertie, creerCamera, ecranVersCase,
  ecranVersMonde, glisser, lancerInertie, mondeVersEcran, PALIERS_ZOOM, palierZoom,
  redimensionner, TUILE, zoomerAutour, zoomerPalier, zoomMinimal,
} from '../../src/render/camera';

function camera() {
  const cam = creerCamera({ largeur: 16, hauteur: 12 });
  return redimensionner(cam, 800, 600);
}

test('monde et écran sont réciproques, à tout zoom', () => {
  const cam = camera();
  for (const zoom of [0.5, 1, 1.5, 2]) {
    cam.zoom = zoom;
    for (const p of [{ x: 0, y: 0 }, { x: 512, y: 384 }, { x: 1023, y: 767 }]) {
      const aller = mondeVersEcran(cam, p);
      const retour = ecranVersMonde(cam, aller);
      assert.ok(Math.abs(retour.x - p.x) < 1e-9, `x ${retour.x} ≠ ${p.x}`);
      assert.ok(Math.abs(retour.y - p.y) < 1e-9, `y ${retour.y} ≠ ${p.y}`);
    }
  }
});

test('le centre de l’écran tombe sur la case visée', () => {
  const cam = camera();
  centrerSur(cam, { x: 7, y: 5 });
  const c = ecranVersCase(cam, { x: cam.vue.largeur / 2, y: cam.vue.hauteur / 2 });
  assert.deepEqual(c, { x: 7, y: 5 });
});

test('centrer sur un bord recadre au lieu de sortir la carte de l’écran', () => {
  const cam = camera();
  centrerSur(cam, { x: 0, y: 0 });
  const coin = mondeVersEcran(cam, { x: 0, y: 0 });
  assert.ok(coin.x <= 0.001 && coin.y <= 0.001, 'le coin du monde reste au bord de la vue');
});

test('le palier de zoom est toujours l’un des paliers déclarés', () => {
  for (const z of [0.3, 0.6, 0.9, 1.1, 1.4, 1.9, 2.6, 5]) {
    assert.ok(PALIERS_ZOOM.includes(palierZoom(z) as (typeof PALIERS_ZOOM)[number]));
  }
  assert.equal(palierZoom(1.02), 1);
  assert.equal(palierZoom(1.9), 2);
});

test('zoomer autour d’un point laisse ce point sous le doigt', () => {
  const cam = camera();
  const ancre = { x: 200, y: 150 };
  const avant = ecranVersMonde(cam, ancre);
  zoomerAutour(cam, 1.5, ancre);
  const apres = ecranVersMonde(cam, ancre);
  assert.ok(Math.abs(avant.x - apres.x) < 0.5, `dérive en x : ${avant.x} → ${apres.x}`);
  assert.ok(Math.abs(avant.y - apres.y) < 0.5, `dérive en y : ${avant.y} → ${apres.y}`);
});

test('le zoom par paliers monte et descend d’un cran', () => {
  const cam = camera();
  cam.zoom = 1;
  zoomerPalier(cam, 1);
  assert.equal(palierZoom(cam.zoom), 1.25);
  zoomerPalier(cam, -1);
  assert.equal(palierZoom(cam.zoom), 1);
});

test('le recadrage garde la carte dans la vue', () => {
  const cam = camera();
  cam.zoom = 2;
  glisser(cam, -100000, -100000);
  const monde = { largeur: 16 * TUILE, hauteur: 12 * TUILE };
  assert.ok(cam.x <= monde.largeur && cam.x >= 0);
  assert.ok(cam.y <= monde.hauteur && cam.y >= 0);
  assert.ok(cam.zoom >= zoomMinimal(cam));
});

test('l’inertie s’amortit et finit par s’arrêter', () => {
  const cam = camera();
  cam.zoom = 2;
  centrerSur(cam, { x: 8, y: 6 });
  lancerInertie(cam, 900, 0);
  let images = 0;
  while (avancerInertie(cam, 16) && images < 1000) images += 1;
  assert.ok(images > 0, 'l’inertie devrait durer plus d’une image');
  assert.ok(images < 1000, 'l’inertie devrait finir par s’arrêter');
  assert.equal(cam.vx, 0);
  couperInertie(cam);
  assert.equal(avancerInertie(cam, 16), false);
});

test('le rectangle visible borne le culling à la carte', () => {
  const cam = camera();
  cam.zoom = 0.5;
  const f = casesVisibles(cam, { largeur: 16, hauteur: 12 });
  assert.ok(f.x0 >= 0 && f.y0 >= 0);
  assert.ok(f.x1 <= 15 && f.y1 <= 11);
});
