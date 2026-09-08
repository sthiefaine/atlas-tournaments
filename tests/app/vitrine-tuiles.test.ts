// Le rectangle d'une tuile de la vitrine, sous WebGPU.
//
// `setScissorRect` et `setViewport` y prennent des entiers **non signés** : un
// `y` négatif lève « Value is outside the 'unsigned long' value range », et
// l'exception remonte jusqu'à la limite d'erreur de React, qui remplace la page
// par « Application error: a client-side exception has occurred ». C'est ce que
// le propriétaire a vu sur /atelier/unites. WebGL s'en accommodait sans rien
// dire — d'où un défaut qui n'existait pas avant le portage.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rectangleTuile } from '../../src/app/atelier/unites/tuiles';

const CADRE = { left: 100, top: 50 };

test('une tuile dans le cadre rend son rectangle, origine en bas', () => {
  // Cadre 400 × 300 ; tuile de 200 × 150 posée en haut à gauche.
  const r = rectangleTuile(CADRE, { left: 100, top: 50, width: 200, height: 150 }, 400, 300);
  assert.deepEqual(r, { x: 0, y: 150, l: 200, h: 150 }, 'le moteur compte depuis le bas');

  // La même, en bas à droite : elle touche l'origine du moteur.
  const bas = rectangleTuile(CADRE, { left: 300, top: 200, width: 200, height: 150 }, 400, 300);
  assert.deepEqual(bas, { x: 200, y: 0, l: 200, h: 150 });
});

test('une tuile qui déborde est sautée, jamais rognée', () => {
  // Le cas réel : pendant un redimensionnement, le cadre est déjà mesuré petit
  // et les tuiles portent encore leur ancienne taille. « y » vaudrait −50.
  assert.equal(rectangleTuile(CADRE, { left: 100, top: 50, width: 200, height: 150 }, 400, 100), null,
    'plus haute que le cadre : sautée');
  assert.equal(rectangleTuile(CADRE, { left: 350, top: 50, width: 200, height: 150 }, 400, 300), null,
    'dépasse à droite : sautée');
  assert.equal(rectangleTuile(CADRE, { left: 50, top: 50, width: 200, height: 150 }, 400, 300), null,
    'commence avant le cadre : sautée');
});

test('une tuile sans surface est sautée', () => {
  // Une tuile jamais mise en page mesure zéro : un ciseau de largeur nulle est
  // refusé aussi, et ne montrerait rien de toute façon.
  assert.equal(rectangleTuile(CADRE, { left: 100, top: 50, width: 0, height: 150 }, 400, 300), null);
  assert.equal(rectangleTuile(CADRE, { left: 100, top: 50, width: 200, height: 0 }, 400, 300), null);
});

test('aucun rectangle rendu ne sort jamais des bornes du moteur', () => {
  // La propriété qui compte, sur tout un balayage : ce qui sort est nul, ce qui
  // reste tient entièrement dans la cible. C'est exactement ce que WebGPU exige.
  for (let gauche = 40; gauche <= 360; gauche += 20) {
    for (let haut = 20; haut <= 340; haut += 20) {
      const r = rectangleTuile(CADRE, { left: CADRE.left + gauche, top: CADRE.top + haut, width: 120, height: 90 }, 400, 300);
      if (r === null) continue;
      assert.ok(r.x >= 0 && r.y >= 0, 'jamais négatif');
      assert.ok(r.x + r.l <= 400 && r.y + r.h <= 300, 'jamais hors de la cible');
    }
  }
});
