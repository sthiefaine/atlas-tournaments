// La réduction de l'échelle 4 à l'échelle 1, sur des images construites à la
// main : moyenne de lumière prémultipliée, masque divisé par la couverture,
// rognage et bords.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decouper, emprise, etendreCouleur, lineaireVersSrgb, memesDecoupes, reduire, signature, srgbVersLineaire, versCalques,
  type ImageBrute,
} from '../../scripts/sprites/image';

const CANAUX = ['r', 'g', 'b', 'a', 'masque', 'couverture'] as const;

/** Une image brute `l × h` (échelle 4) remplie par une fonction de pixel, valeurs dans [0, 1]. */
function brute(l: number, h: number, f: (x: number, y: number) => number[]): ImageBrute {
  const d = new Uint16Array(l * h * CANAUX.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      f(x, y).forEach((v, k) => { d[(y * l + x) * CANAUX.length + k] = Math.round(v * 65535); });
    }
  }
  return { largeur: l, hauteur: h, canaux: CANAUX, donnees: d };
}

test('la fonction sRGB et son inverse se répondent', () => {
  for (let i = 0; i <= 255; i++) {
    const s = i / 255;
    assert.ok(Math.abs(lineaireVersSrgb(srgbVersLineaire(s)) - s) < 1e-9);
  }
  assert.equal(lineaireVersSrgb(-1), 0);
  assert.equal(lineaireVersSrgb(2), 1);
});

test('un bord blanc à moitié couvert reste blanc, pas gris', () => {
  // Une moitié du bloc 4 × 4 est blanche et opaque, l'autre transparente : le
  // pixel livré est blanc à 50 % d'alpha — moyenner des couleurs non
  // prémultipliées l'aurait rendu gris.
  const r = reduire(brute(4, 4, (x) => (x < 2 ? [1, 1, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0])), 4);
  const c = versCalques(r, { masque: true, emission: false, seuilOmbre: 3 });
  assert.deepEqual([...c.couleur], [255, 255, 255, 128]);
});

test('la réduction moyenne la lumière, pas les valeurs encodées', () => {
  // Deux moitiés opaques, noire et blanche : la moyenne linéaire vaut 0,5,
  // soit 188 en sRGB — et non 128, ce que donnerait une moyenne d'encodés.
  const r = reduire(brute(4, 4, (x) => (x < 2 ? [0, 0, 0, 1, 0, 1] : [1, 1, 1, 1, 0, 1])), 4);
  const c = versCalques(r, { masque: false, emission: false, seuilOmbre: 3 });
  assert.equal(c.couleur[0], Math.round(lineaireVersSrgb(0.5) * 255));
  assert.equal(c.couleur[3], 255);
});

test('le masque se divise par la couverture du modèle, pas par l’alpha', () => {
  // Un quart du bloc est du modèle entièrement masqué ; le reste est une ombre
  // au sol opaque à 50 %. Le masque livré vaut 1 : l'ombre n'en a pas, et ne
  // doit pas le diluer.
  const r = reduire(brute(4, 4, (x, y) => (x < 2 && y < 2 ? [0.8, 0.8, 0.8, 1, 1, 1] : [0, 0, 0, 0.5, 0, 0])), 4);
  const c = versCalques(r, { masque: true, emission: false, seuilOmbre: 3 });
  assert.equal(c.masque![0], 255);
  assert.ok(c.couleur[3]! > 128 && c.couleur[3]! < 255);
});

test('une ombre très faible hors du modèle est effacée, pas le bord du modèle', () => {
  const ombre = versCalques(reduire(brute(4, 4, () => [0, 0, 0, 0.004, 0, 0]), 4), { masque: false, emission: false, seuilOmbre: 3 });
  assert.equal(ombre.couleur[3], 0);
  const bord = versCalques(reduire(brute(4, 4, (x, y) => (x === 0 && y === 0 ? [1, 1, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0])), 4), { masque: false, emission: false, seuilOmbre: 3 });
  assert.equal(bord.couleur[3], 16);
});

test('une ombre cuite descend à zéro au bord du canevas, jamais le modèle', () => {
  // 30 × 30 pixels livrés d'ombre à 50 %, et un pixel de modèle collé au bord.
  const r = reduire(brute(120, 120, (x, y) => (x < 4 && y >= 40 && y < 44 ? [1, 1, 1, 1, 0, 1] : [0, 0, 0, 0.5, 0, 0])), 4);
  const c = versCalques(r, { masque: false, emission: false, seuilOmbre: 3, fonduOmbre: 10 });
  const alpha = (x: number, y: number) => c.couleur[(y * 30 + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0);
  assert.equal(alpha(15, 0), 0);
  assert.equal(alpha(15, 5), Math.round((128 * 5) / 10));
  assert.equal(alpha(15, 15), 128);
  assert.equal(alpha(0, 10), 255, 'le modèle garde son alpha au bord');
});

test('le rognage prend les pixels visibles, une bordure, et dit si le canevas était trop juste', () => {
  const r = reduire(brute(16, 12, (x, y) => (x >= 4 && x < 8 && y >= 4 && y < 8 ? [1, 0, 0, 1, 0, 1] : [0, 0, 0, 0, 0, 0])), 4);
  const c = versCalques(r, { masque: false, emission: false, seuilOmbre: 3 });
  const e = emprise(c, 1)!;
  assert.deepEqual(e.rect, { x: 0, y: 0, l: 3, h: 3 });
  assert.equal(e.touche, false);
  const d = decouper(c, e.rect);
  assert.equal(d.couleur[(1 * 3 + 1) * 4 + 3], 255);
  const coin = versCalques(reduire(brute(8, 8, (x, y) => (x < 4 && y < 4 ? [1, 1, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0])), 4), { masque: false, emission: false, seuilOmbre: 3 });
  assert.equal(emprise(coin, 1)!.touche, true);
  assert.equal(emprise(versCalques(reduire(brute(8, 8, () => [0, 0, 0, 0, 0, 0]), 4), { masque: false, emission: false, seuilOmbre: 3 }), 1), null);
});

test('la couleur s’étend sur les voisins transparents sans toucher leur alpha', () => {
  const r = reduire(brute(12, 4, (x) => (x >= 4 && x < 8 ? [0.2, 0.4, 0.6, 1, 0, 1] : [0, 0, 0, 0, 0, 0])), 4);
  const c = versCalques(r, { masque: false, emission: false, seuilOmbre: 3 });
  const d = decouper(c, { x: 0, y: 0, l: 3, h: 1 });
  etendreCouleur(d, 1);
  assert.deepEqual([...d.couleur.subarray(0, 4)], [...d.couleur.subarray(4, 7), 0]);
  assert.equal(d.couleur[11], 0);
});

test('deux découpes identiques ont la même signature', () => {
  const r = reduire(brute(8, 8, (x, y) => ((x + y) % 3 === 0 ? [0.5, 0.2, 0.1, 1, 1, 1] : [0, 0, 0, 0, 0, 0])), 4);
  const c = versCalques(r, { masque: true, emission: false, seuilOmbre: 3 });
  const a = decouper(c, { x: 0, y: 0, l: 2, h: 2 });
  const b = decouper(c, { x: 0, y: 0, l: 2, h: 2 });
  assert.equal(signature(a), signature(b));
  assert.ok(memesDecoupes(a, b));
  const autre = decouper(c, { x: 0, y: 0, l: 2, h: 1 });
  assert.ok(!memesDecoupes(a, autre));
});
