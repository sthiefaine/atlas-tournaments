// La géométrie d'un déplacement (`src/render/chemin.ts`), commune au jeu et à
// la peau : le chemin en L, sa longueur, la position et le cap le long du trajet
// que le moteur a validé. La peau 2D y fait glisser ses figurines
// (`render2d/animations.ts`).
//
// Ce test vivait dans `tests/render3d/camera.test.ts`, avec la caméra de la
// peau 3D ; il en a été sorti quand la 3D temps réel a été retirée
// (23 septembre 2026), parce que ce qu'il vérifie n'était pas à elle.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cheminEnL, longueurChemin, surChemin } from '../../src/render/chemin';

test('le chemin d’animation suit la grille et s’oriente dans le bon sens', () => {
  const pas = cheminEnL({ x: 2, y: 3 }, { x: 5, y: 1 });
  assert.deepEqual(pas, [{ x: 2, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 1 }]);
  assert.equal(longueurChemin(pas), 5);
  // Aux extrémités, on est exactement sur les cases de départ et d'arrivée.
  const debut = surChemin(pas, 0);
  assert.equal(debut.x, 2);
  assert.equal(debut.y, 3);
  const fin = surChemin(pas, 1);
  assert.equal(fin.x, 5);
  assert.equal(fin.y, 1);
  // À 3/5, on vient de finir le segment horizontal.
  const milieu = surChemin(pas, 0.6);
  assert.ok(Math.abs(milieu.x - 5) < 1e-9);
  assert.ok(Math.abs(milieu.y - 3) < 1e-9);
  // Le cap regarde vers l'est sur le premier segment, vers le nord sur le second.
  assert.ok(Math.abs(surChemin(pas, 0.2).cap) < 1e-9);
  assert.ok(Math.abs(surChemin(pas, 0.9).cap - Math.PI / 2) < 1e-9);
  // Un déplacement nul ne fait pas bouger et ne divise pas par zéro.
  const surplace = cheminEnL({ x: 4, y: 4 }, { x: 4, y: 4 });
  assert.equal(longueurChemin(surplace), 0);
  assert.deepEqual(surChemin(surplace, 0.5), { x: 4, y: 4, cap: 0 });
  // La progression est bornée : au-delà de 1, on reste à l'arrivée.
  assert.equal(surChemin(pas, 4).x, 5);
});
