// La qualité d'affichage et la décision d'allumer la chaîne de post-traitement
// (`16-realisme.md` A3) : trois valeurs fermées, une mesure sur les premières
// images, un seuil tiré du **budget** d'une image — puis, la chaîne allumée, une
// rétroaction sur la cadence réelle qui l'éteint pour la session si elle fait
// manquer une image sur deux. Le rasteriseur logiciel du test de fumée ne doit
// jamais l'allumer ; un circuit graphique intégré à cinq millisecondes, si ; le
// M1 de référence, à 12–18 ms l'image nue, non plus — c'était le délai senti.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDGET_MS_IMAGE, FACTEUR_COMPOSEUR, IMAGES_CADENCE, IMAGES_CALIBRATION, QUALITE_PAR_DEFAUT, QUALITES_RENDU,
  SEUIL_MS_CADENCE, SEUIL_MS_COMPOSEUR, cadenceInsuffisante, composeurPossible, decisionComposeur, msCadence,
  msCalibration, normaliserQualite,
} from '../../src/render/qualite';

test('la chaîne ne se monte que si une cible flottante est dessinable', () => {
  // Sur le dos WebGL, sans extension, three ne lèverait pas et l'écran serait
  // noir : on refuse avant.
  assert.equal(composeurPossible('webgl', () => false), false);
  assert.equal(composeurPossible('webgl', (nom) => nom === 'OES_texture_float'), false);
  assert.equal(composeurPossible('webgl', (nom) => nom === 'WEBGL_color_buffer_float'), false);
  // L'extension complète, ou sa version demi-flottante seule, suffit.
  assert.equal(composeurPossible('webgl', (nom) => nom === 'EXT_color_buffer_float'), true);
  assert.equal(composeurPossible('webgl', (nom) => nom === 'EXT_color_buffer_half_float'), true);
  assert.equal(composeurPossible('webgl', () => true), true);
  // Et la question est posée au contexte, pas devinée : les deux noms sont demandés.
  const demandes: string[] = [];
  composeurPossible('webgl', (nom) => { demandes.push(nom); return false; });
  assert.deepEqual(demandes, ['EXT_color_buffer_float', 'EXT_color_buffer_half_float']);
  // Sur WebGPU, `rgba16float` est dessinable par le cœur de l'API : oui, sans
  // rien demander — une question posée là serait posée à un dos qui n'a pas
  // d'extensions WebGL.
  const posees: string[] = [];
  assert.equal(composeurPossible('webgpu', (nom) => { posees.push(nom); return false; }), true);
  assert.deepEqual(posees, []);
});

test('la liste des qualités est fermée, et l’inconnu retombe sur `auto`', () => {
  assert.deepEqual([...QUALITES_RENDU], ['auto', 'basse']);
  assert.equal(QUALITE_PAR_DEFAUT, 'auto');
  for (const q of QUALITES_RENDU) assert.equal(normaliserQualite(q), q);
  // `haute` a été retirée : un réglage enregistré avant redevient `auto`.
  for (const brut of [undefined, null, '', 'haute', 'HAUTE', 'moyenne', 'ultra', 0, 1, true, {}, []]) {
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

test('le seuil de `auto` est le budget d’une image divisé par le coût de la chaîne', () => {
  // Soixante hertz, et une chaîne mesurée à ×2,3 sur le M1 de référence.
  assert.ok(Math.abs(BUDGET_MS_IMAGE - 1000 / 60) < 1e-9);
  assert.ok(FACTEUR_COMPOSEUR >= 2 && FACTEUR_COMPOSEUR <= 2.6, 'le facteur mesuré, ni flatté ni noirci');
  // Le seuil n'est pas réglé sur la machine qu'on a sous la main : une image
  // composée à ce seuil tient encore dans le budget, et jamais plus d'un
  // demi-millimètre au-dessus par l'arrondi.
  assert.ok(SEUIL_MS_COMPOSEUR * FACTEUR_COMPOSEUR <= BUDGET_MS_IMAGE + 0.5, 'l’image composée tient dans une image d’écran');
  assert.ok(SEUIL_MS_COMPOSEUR >= 5, 'un circuit intégré à cinq millisecondes doit encore l’allumer');
  // Le M1 de référence mesure 12 à 18 ms l'image nue (`doc/10` §9.2) : à ces
  // valeurs la chaîne divisait la cadence par deux, elle ne doit pas s'allumer.
  for (const ms of [12, 14.5, 17.5, 18]) {
    assert.equal(decisionComposeur('auto', ms, false), false, `${ms} ms l'image nue : la chaîne coûterait ${ms * FACTEUR_COMPOSEUR} ms`);
  }
});

test('la décision : réduction d’abord, puis la qualité, puis la mesure, puis la rétroaction', () => {
  // La réduction de mouvement éteint tout.
  for (const q of QUALITES_RENDU) assert.equal(decisionComposeur(q, 1, true), false);
  // `basse` : jamais, mesure ou pas.
  assert.equal(decisionComposeur('basse', 1, false), false);
  assert.equal(decisionComposeur('basse', null, false), false);
  // `auto` : rien tant qu'on n'a pas mesuré, puis le seuil.
  assert.equal(decisionComposeur('auto', null, false), false);
  assert.equal(decisionComposeur('auto', 300, false), false, 'SwiftShader, ~300 ms : jamais');
  assert.equal(decisionComposeur('auto', 5, false), true, 'un circuit intégré, ~5 ms : oui');
  assert.equal(decisionComposeur('auto', SEUIL_MS_COMPOSEUR, false), true, 'au seuil, on allume');
  assert.equal(decisionComposeur('auto', SEUIL_MS_COMPOSEUR + 0.01, false), false);
  // Et une cadence refusée l'emporte sur une calibration flatteuse : la chaîne
  // ne se rallume pas dans la session.
  assert.equal(decisionComposeur('auto', 5, false, true), false);
  assert.equal(decisionComposeur('auto', 1, false, true), false);
});

test('la cadence : la médiane des dernières images consécutives, ou rien', () => {
  assert.ok(IMAGES_CADENCE >= 10 && IMAGES_CADENCE <= 120, 'assez pour lisser une compilation, moins de deux secondes');
  // Entre une image tenue (16,7) et une image sur deux manquée (33,3).
  assert.ok(SEUIL_MS_CADENCE > 1000 / 60 && SEUIL_MS_CADENCE < 1000 / 30);
  assert.equal(msCadence([]), null);
  assert.equal(msCadence(Array.from({ length: IMAGES_CADENCE - 1 }, () => 16.7)), null, 'pas assez d’images : pas de verdict');
  // La première image de la chaîne compile ses programmes : à 400 ms, la
  // médiane ne la voit pas.
  const tenue = [400, ...Array.from({ length: IMAGES_CADENCE - 1 }, () => 16.7)];
  assert.equal(msCadence(tenue), 16.7);
  assert.equal(cadenceInsuffisante(msCadence(tenue)), false);
  // Seules les dernières comptent : une chaîne qui a fini par peiner est jugée
  // sur ce qu'elle fait maintenant.
  const derive = [...Array.from({ length: 200 }, () => 16.7), ...Array.from({ length: IMAGES_CADENCE }, () => 33.3)];
  assert.equal(msCadence(derive), 33.3);
  assert.equal(cadenceInsuffisante(msCadence(derive)), true);
  // Une image manquée de temps en temps n'est pas une cadence manquée.
  const rare = Array.from({ length: IMAGES_CADENCE }, (_, i) => (i % 5 === 0 ? 33.3 : 16.7));
  assert.equal(cadenceInsuffisante(msCadence(rare)), false);
  // Une médiane sur un nombre pair est la moyenne des deux du milieu.
  assert.equal(msCadence([50, 2, 4], 2), 3);
  assert.equal(cadenceInsuffisante(null), false);
});

test('le M1 de référence : la calibration l’écarte, et si elle passait, la cadence la rattraperait', () => {
  // La campagne du 6 septembre 2026 : 14,5 ms en calibration, 33,4 ms entre
  // deux images la chaîne allumée. La calibration seule suffit à l'écarter.
  const m1 = [120, ...Array.from({ length: IMAGES_CALIBRATION }, (_, i) => 14 + (i % 2))];
  assert.equal(decisionComposeur('auto', msCalibration(m1), false), false);
  // Et une machine qui aurait passé la calibration — 6 ms — mais dont la chaîne
  // ferait manquer une image sur deux est rattrapée par la rétroaction, qui
  // vaut pour le reste de la session.
  const flatteuse = [120, ...Array.from({ length: IMAGES_CALIBRATION }, () => 6)];
  assert.equal(decisionComposeur('auto', msCalibration(flatteuse), false), true, 'la calibration l’allume');
  const cadence = Array.from({ length: IMAGES_CADENCE }, (_, i) => (i === 0 ? 180 : 33.4));
  const refusee = cadenceInsuffisante(msCadence(cadence));
  assert.equal(refusee, true);
  assert.equal(decisionComposeur('auto', msCalibration(flatteuse), false, refusee), false, 'la cadence l’éteint');
});

test('la mesure d’un rasteriseur logiciel ne franchit jamais le seuil, celle d’un circuit intégré si', () => {
  const logiciel = [900, ...Array.from({ length: IMAGES_CALIBRATION }, (_, i) => 280 + (i % 3) * 20)];
  assert.equal(decisionComposeur('auto', msCalibration(logiciel), false), false);
  const integre = [120, ...Array.from({ length: IMAGES_CALIBRATION }, (_, i) => 4 + (i % 2))];
  assert.equal(decisionComposeur('auto', msCalibration(integre), false), true);
});
