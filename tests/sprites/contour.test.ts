// Le contour cuit (`contourner`, `image.ts`), sur des images construites à la
// main : l'anneau part de la couverture et jamais de l'alpha, il a l'épaisseur
// dite, il passe sous le modèle, il n'entre pas dans le masque, il ne décale
// pas le pivot et il reste dans l'image rognée.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  contourner, decouper, distancesCarrees, emprise, reduire, srgbVersLineaire, versCalques,
  type ContourImage, type ImageBrute,
} from '../../scripts/sprites/image';
import { CONTOUR_PAR_FAMILLE, MARGE_CANEVAS, margeCanevas } from '../../scripts/sprites/reglages';
import charte from '../../scripts/production/figurines/charte.json';

const CANAUX = ['r', 'g', 'b', 'a', 'masque', 'couverture'] as const;

/** Une image brute `l × h` (échelle 4), valeurs dans [0, 1] par canal. */
function brute(l: number, h: number, f: (x: number, y: number) => number[]): ImageBrute {
  const d = new Uint16Array(l * h * CANAUX.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) f(x, y).forEach((v, k) => { d[(y * l + x) * CANAUX.length + k] = Math.round(v * 65535); });
  }
  return { largeur: l, hauteur: h, canaux: CANAUX, donnees: d };
}

const NOIR: ContourImage = { couleur: [0.01, 0.02, 0.03], opacite: 1, epaisseur: 12, seuil: 0.5 };

/** La valeur d'un canal d'une image brute, dans [0, 1]. */
function lire(b: ImageBrute, x: number, y: number, canal: string): number {
  return b.donnees[(y * b.largeur + x) * b.canaux.length + b.canaux.indexOf(canal)]! / 65535;
}

test('la distance au carré est exacte, de centre à centre', () => {
  // Un seul pixel dedans : la distance au carré est le carré de l'écart euclidien.
  const l = 21;
  const h = 17;
  const dedans = new Uint8Array(l * h);
  dedans[8 * l + 10] = 1;
  const d = distancesCarrees(dedans, l, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) assert.equal(d[y * l + x], (x - 10) ** 2 + (y - 8) ** 2);
  // Deux pixels : le plus proche l'emporte.
  dedans[2 * l + 2] = 1;
  const d2 = distancesCarrees(dedans, l, h);
  assert.equal(d2[3 * l + 3], 2);
  assert.equal(d2[8 * l + 13], 9);
  // Rien dedans : tout est loin.
  assert.ok(distancesCarrees(new Uint8Array(12), 4, 3).every((v) => v >= 1e20));
});

test('l’anneau a l’épaisseur dite autour de la couverture, et passe sous le modèle', () => {
  // Un carré de modèle de 40 × 40 pixels rendus, au milieu de 100 × 100.
  const b = brute(100, 100, (x, y) => (x >= 30 && x < 70 && y >= 30 && y < 70 ? [0.5, 0.5, 0.5, 1, 0, 1] : [0, 0, 0, 0, 0, 0]));
  const c = contourner(b, NOIR);
  assert.deepEqual(c.canaux, [...CANAUX, 'contour']);
  // Sur une ligne qui traverse le carré : 12 pixels d'anneau de chaque côté, rien au-delà.
  const ligne = Array.from({ length: 100 }, (_, x) => lire(c, x, 50, 'contour'));
  for (let x = 0; x < 100; x++) {
    const attendu = (x >= 18 && x < 30) || (x >= 70 && x < 82) ? 1 : 0;
    assert.equal(Math.round(ligne[x]!), attendu, `x = ${x}`);
  }
  // Le modèle garde sa couleur et son alpha ; l'anneau est opaque, de sa couleur.
  assert.equal(lire(c, 50, 50, 'r'), lire(b, 50, 50, 'r'));
  assert.equal(lire(c, 50, 50, 'a'), 1);
  assert.ok(Math.abs(lire(c, 20, 50, 'r') - 0.01) < 1e-4);
  assert.equal(lire(c, 20, 50, 'a'), 1);
  // Aux coins, l'anneau est rond : un pixel en diagonale à 9 × 9 du coin est dehors.
  assert.equal(lire(c, 30 - 9, 30 - 9, 'contour'), 0);
  assert.equal(lire(c, 30 - 8, 30 - 8, 'contour'), 1);
});

test('l’anneau part de la couverture, jamais de l’alpha : une ombre au sol n’est pas cernée', () => {
  // Un modèle de 8 × 8 et, à côté, une large ombre au sol (alpha sans couverture).
  const b = brute(120, 60, (x, y) => {
    if (x >= 20 && x < 28 && y >= 20 && y < 28) return [1, 1, 1, 1, 0, 1];
    if (x >= 34 && x < 110 && y >= 10 && y < 50) return [0, 0, 0, 0.5, 0, 0];
    return [0, 0, 0, 0, 0, 0];
  });
  const c = contourner(b, { ...NOIR, opacite: 0.5 });
  const proche = (v: number, attendu: number) => Math.abs(v - attendu) < 1e-4;
  // Loin du modèle, l'ombre est intacte : pas d'anneau autour d'elle.
  assert.equal(lire(c, 80, 30, 'contour'), 0);
  assert.ok(proche(lire(c, 80, 30, 'a'), 0.5));
  assert.equal(lire(c, 109, 30, 'contour'), 0);
  // Entre le modèle et l'ombre, l'anneau seul ; sur l'ombre, l'anneau posé sur elle.
  assert.ok(proche(lire(c, 30, 24, 'a'), 0.5), 'anneau à 50 % sur rien');
  assert.ok(proche(lire(c, 36, 24, 'contour'), 0.5));
  assert.ok(proche(lire(c, 36, 24, 'a'), 0.5 + 0.5 * 0.5), 'anneau à 50 % sur une ombre à 50 %');
  assert.equal(lire(c, 40, 24, 'contour'), 0, 'à 13 pixels du modèle, plus d’anneau');
});

test('le masque et la couverture ne bougent pas : l’anneau n’entre jamais dans la page de masque', () => {
  const b = brute(64, 64, (x, y) => {
    const dedans = (x - 32) ** 2 + (y - 32) ** 2 < 15 ** 2;
    return dedans ? [0.8, 0.8, 0.8, 1, x < 32 ? 1 : 0, 1] : [0, 0, 0, 0, 0, 0];
  });
  const c = contourner(b, NOIR);
  const calquesSans = versCalques(reduire(b, 4), { masque: true, emission: false, seuilOmbre: 3 });
  const calquesAvec = versCalques(reduire(c, 4), { masque: true, emission: false, seuilOmbre: 3 });
  assert.deepEqual([...calquesAvec.masque!], [...calquesSans.masque!]);
  assert.deepEqual([...calquesAvec.couverture], [...calquesSans.couverture]);
  // Un pixel d'anneau pur (sans couverture) a un masque nul et un alpha plein.
  let anneauPur = 0;
  for (let p = 0; p < 16 * 16; p++) {
    if (calquesAvec.couverture[p] === 0 && calquesAvec.couleur[p * 4 + 3] === 255) {
      anneauPur++;
      assert.equal(calquesAvec.masque![p], 0);
    }
  }
  assert.ok(anneauPur > 10, `${anneauPur} pixels d'anneau pur`);
});

test('l’anneau ne se fond pas au bord du canevas comme une ombre, et ne décale pas le pivot', () => {
  // Un modèle de 16 × 16 rendus (4 × 4 livrés), la marge du canevas d'une unité autour.
  const marge = margeCanevas(CONTOUR_PAR_FAMILLE.unite, 4);
  const cote = 4 + 2 * marge;
  const b = brute(cote * 4, cote * 4, (x, y) => {
    const m = marge * 4;
    return x >= m && x < m + 16 && y >= m && y < m + 16 ? [0.7, 0.7, 0.7, 1, 0, 1] : [0, 0, 0, 0, 0, 0];
  });
  const options = { masque: false, emission: false, seuilOmbre: 3, fonduOmbre: 10 };
  const sans = versCalques(reduire(b, 4), options);
  const avec = versCalques(reduire(contourner(b, NOIR), 4), options);
  const e0 = emprise(sans, 1)!;
  const e1 = emprise(avec, 1)!;
  // L'anneau, 3 pixels livrés de chaque côté, n'a pas touché le bord : la marge suffit.
  assert.equal(e1.touche, false);
  assert.deepEqual(e1.rect, { x: e0.rect.x - 3, y: e0.rect.y - 3, l: e0.rect.l + 6, h: e0.rect.h + 6 });
  // Et il n'a pas été effacé par le fondu des ombres, pourtant à moins de 10 pixels du bord.
  const alpha = (c: typeof avec, x: number, y: number) => c.couleur[(y * c.largeur + x) * 4 + 3];
  assert.equal(alpha(avec, marge - 2, marge + 2), 255);
  // Le pivot se calcule depuis le rectangle (`px = −x0 − rect.x`) : le même point du
  // modèle tombe au même endroit par rapport à lui, avec ou sans contour.
  const pivot = { x: marge + 2, y: marge + 2 };
  const px0 = pivot.x - e0.rect.x;
  const px1 = pivot.x - e1.rect.x;
  const d0 = decouper(sans, e0.rect);
  const d1 = decouper(avec, e1.rect);
  const au = (d: typeof d0, x: number, y: number) => [...d.couleur.subarray((y * d.l + x) * 4, (y * d.l + x) * 4 + 4)];
  assert.deepEqual(au(d1, px1, pivot.y - e1.rect.y), au(d0, px0, pivot.y - e0.rect.y));
});

test('le contour de chaque famille vient de la charte, et une marge le contient', () => {
  const lin = srgbVersLineaire(0x15 / 255);
  for (const [famille, opacite] of Object.entries(charte.contour.opacite)) {
    const c = CONTOUR_PAR_FAMILLE[famille as keyof typeof CONTOUR_PAR_FAMILLE];
    assert.ok(c, famille);
    assert.equal(c.opacite, opacite);
    assert.equal(c.epaisseur, 12);
    assert.ok(Math.abs(c.couleur[0] - lin) < 1e-12);
  }
  assert.equal(CONTOUR_PAR_FAMILLE.unite?.opacite, 1);
  assert.ok(margeCanevas(CONTOUR_PAR_FAMILLE.unite, 4) >= MARGE_CANEVAS + 3);
  assert.equal(margeCanevas(null, 4), MARGE_CANEVAS);
});
