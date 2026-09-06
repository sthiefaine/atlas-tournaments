// La qualité d'affichage et la décision d'allumer la chaîne de post-traitement
// (`16-realisme.md` A3) : trois valeurs fermées, une mesure sur les premières
// images, un seuil. Le rasteriseur logiciel du test de fumée ne doit jamais
// l'allumer ; un circuit graphique intégré, si.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMAGES_CALIBRATION, QUALITE_PAR_DEFAUT, QUALITES_RENDU, SEUIL_MS_COMPOSEUR,
  composeurPossible, decisionComposeur, msCalibration, normaliserQualite,
} from '../../src/render/qualite';

test('la chaîne ne se monte que si une cible flottante est dessinable', () => {
  // Sans extension, three ne lèverait pas et l'écran serait noir : on refuse avant.
  assert.equal(composeurPossible(() => false), false);
  assert.equal(composeurPossible((nom) => nom === 'OES_texture_float'), false);
  assert.equal(composeurPossible((nom) => nom === 'WEBGL_color_buffer_float'), false);
  // L'extension complète, ou sa version demi-flottante seule, suffit.
  assert.equal(composeurPossible((nom) => nom === 'EXT_color_buffer_float'), true);
  assert.equal(composeurPossible((nom) => nom === 'EXT_color_buffer_half_float'), true);
  assert.equal(composeurPossible(() => true), true);
  // Et la question est posée au contexte, pas devinée : les deux noms sont demandés.
  const demandes: string[] = [];
  composeurPossible((nom) => { demandes.push(nom); return false; });
  assert.deepEqual(demandes, ['EXT_color_buffer_float', 'EXT_color_buffer_half_float']);
});

test('la liste des qualités est fermée, et l’inconnu retombe sur `auto`', () => {
  assert.deepEqual([...QUALITES_RENDU], ['auto', 'haute', 'basse']);
  assert.equal(QUALITE_PAR_DEFAUT, 'auto');
  for (const q of QUALITES_RENDU) assert.equal(normaliserQualite(q), q);
  for (const brut of [undefined, null, '', 'HAUTE', 'moyenne', 'ultra', 0, 1, true, {}, []]) {
    assert.equal(normaliserQualite(brut), 'auto', `${String(brut)} doit redevenir auto`);
  }
});

test('la calibration attend une image de plus que le compte, et ignore la première', () => {
  assert.ok(IMAGES_CALIBRATION >= 5 && IMAGES_CALIBRATION <= 30);
  // Pas assez d'images : pas de verdict.
  assert.equal(msCalibration([]), null);
  assert.equal(msCalibration(Array.from({ length: IMAGES_CALIBRATION }, () => 4)), null);
  // La première image compile les programmes : à 400 ms, elle ne compte pas.
  const durees = [400, ...Array.from({ length: IMAGES_CALIBRATION }, () => 4)];
  assert.equal(msCalibration(durees), 4);
  // C'est une médiane : une image lente sur dix ne fait pas un appareil lent.
  const avecPic = [400, 4, 4, 4, 90, 4, 4, 4, 4, 4, 4];
  assert.equal(avecPic.length, IMAGES_CALIBRATION + 1);
  assert.equal(msCalibration(avecPic), 4);
  // Les images au-delà du compte ne changent rien : la décision est prise.
  assert.equal(msCalibration([...durees, 300, 300, 300]), 4);
  // Une médiane sur un nombre pair d'images est la moyenne des deux du milieu.
  assert.equal(msCalibration([50, 2, 4], 2), 3);
});

test('la décision : réduction d’abord, puis la qualité, puis la mesure', () => {
  assert.ok(SEUIL_MS_COMPOSEUR > 0 && SEUIL_MS_COMPOSEUR < 16.7, 'sous une image à 60 Hz');
  // La réduction de mouvement éteint tout, même `haute`.
  for (const q of QUALITES_RENDU) assert.equal(decisionComposeur(q, 1, true), false);
  // `basse` : jamais ; `haute` : toujours, mesure ou pas.
  assert.equal(decisionComposeur('basse', 1, false), false);
  assert.equal(decisionComposeur('basse', null, false), false);
  assert.equal(decisionComposeur('haute', null, false), true);
  assert.equal(decisionComposeur('haute', 300, false), true);
  // `auto` : rien tant qu'on n'a pas mesuré, puis le seuil.
  assert.equal(decisionComposeur('auto', null, false), false);
  assert.equal(decisionComposeur('auto', 300, false), false, 'SwiftShader, ~300 ms : jamais');
  assert.equal(decisionComposeur('auto', 5, false), true, 'un circuit intégré, ~5 ms : oui');
  assert.equal(decisionComposeur('auto', SEUIL_MS_COMPOSEUR, false), true, 'au seuil, on allume');
  assert.equal(decisionComposeur('auto', SEUIL_MS_COMPOSEUR + 0.01, false), false);
});

test('la mesure d’un rasteriseur logiciel ne franchit jamais le seuil, celle d’un circuit intégré si', () => {
  const logiciel = [900, ...Array.from({ length: IMAGES_CALIBRATION }, (_, i) => 280 + (i % 3) * 20)];
  assert.equal(decisionComposeur('auto', msCalibration(logiciel), false), false);
  const integre = [120, ...Array.from({ length: IMAGES_CALIBRATION }, (_, i) => 4 + (i % 2))];
  assert.equal(decisionComposeur('auto', msCalibration(integre), false), true);
});
