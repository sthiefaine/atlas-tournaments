// La source des nuanceurs du sol, lue comme un texte : ses constantes viennent
// des tables TypeScript, chaque uniforme posé est déclaré, et aucune lecture de
// texture ne dépend des dérivées implicites. Sa compilation réelle est dans
// `e2e/sol-2d.spec.ts`, sous Chromium et WebKit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COS_TANGAGE, SIN_TANGAGE } from '../../../src/render2d/contrat';
import { REPLI, TRANSITION_BROUILLARD } from '../../../src/render2d/sol/decor';
import { COUCHES_DETAIL, rangCouche } from '../../../src/render2d/sol/details';
import { BITS } from '../../../src/render2d/sol/grille';
import { decalageOmbre, lumiereEcran, lumiereSol } from '../../../src/render2d/sol/lumiere';
import {
  HAUT_FRONDAISON, NB_COUCHES, SOURCE_FRAGMENT_SOL, SOURCE_SOMMET_SOL, UNIFORMES_SOL,
} from '../../../src/render2d/sol/nuanceurs';
import { codeDe, NB_CODES } from '../../../src/render2d/sol/terrains';

/** La valeur d'un `#define` de la source. */
function defini(nom: string): string | undefined {
  return new RegExp(`^#define ${nom} (.+)$`, 'm').exec(SOURCE_FRAGMENT_SOL)?.[1];
}

test('les deux sources sont du GLSL ES 3.0, la version en première ligne', () => {
  for (const s of [SOURCE_SOMMET_SOL, SOURCE_FRAGMENT_SOL]) assert.ok(s.startsWith('#version 300 es\n'));
  assert.match(SOURCE_FRAGMENT_SOL, /precision highp float;/);
  assert.match(SOURCE_FRAGMENT_SOL, /precision highp sampler2DArray;/);
});

test('les constantes viennent des tables, pas d’une copie', () => {
  assert.equal(defini('CODE_MER'), String(codeDe('mer')));
  assert.equal(defini('CODE_PONT'), String(codeDe('pont')));
  assert.equal(defini('CODE_VILLE'), String(codeDe('ville')));
  assert.equal(defini('NB_CODES'), String(NB_CODES));
  assert.equal(defini('BIT_VOIE'), String(BITS.VOIE));
  assert.equal(defini('BIT_AXE_EO'), String(BITS.AXE_EO));
  assert.equal(Number(defini('COUCHE_BRUIT')), rangCouche('bruit'));
  assert.equal(Number(defini('SIN_TANGAGE')), Number(SIN_TANGAGE.toFixed(6)));
  assert.equal(Number(defini('COS_TANGAGE')), Number(COS_TANGAGE.toFixed(6)));
  assert.equal(Number(defini('REPLI_HERBE_HAUTE')), REPLI.HERBE_HAUTE);
  assert.equal(Number(defini('TRANSITION_BROUILLARD')), TRANSITION_BROUILLARD);
  assert.equal(NB_COUCHES, COUCHES_DETAIL.length);
});

test('chaque uniforme posé par le sol est déclaré dans une des deux sources', () => {
  for (const nom of UNIFORMES_SOL) {
    const declare = new RegExp(`uniform [a-zA-Z0-9]+ ${nom}(\\[|;)`);
    assert.ok(declare.test(SOURCE_FRAGMENT_SOL) || declare.test(SOURCE_SOMMET_SOL), nom);
  }
});

test('aucune lecture de texture à dérivées implicites dans le nuanceur de fragments', () => {
  // `texture(` dans une branche qui dépend du fragment n'a pas de niveau de
  // détail défini : tout passe par `textureGrad` ou `texelFetch`.
  assert.doesNotMatch(SOURCE_FRAGMENT_SOL, /[^a-zA-Z]texture\(/);
  // Et les dérivées ne se prennent qu'une fois, en tête de `main`.
  const main = SOURCE_FRAGMENT_SOL.slice(SOURCE_FRAGMENT_SOL.indexOf('void main()'));
  const avant = SOURCE_FRAGMENT_SOL.slice(0, SOURCE_FRAGMENT_SOL.indexOf('void main()'));
  assert.doesNotMatch(avant, /dFd[xy]\(|fwidth\(/);
  assert.equal(main.match(/dFd[xy]\(/g)?.length, 4);
});

test('la lumière du sol est celle de la cuisson : de l’avant-gauche, au-dessus de l’horizon', () => {
  const [x, y, z] = lumiereSol();
  assert.ok(x < 0, 'elle vient de la gauche');
  assert.ok(y > 0, 'elle vient du joueur');
  assert.ok(z > 0.7, 'elle est haute');
  assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-9);
  const e = lumiereEcran();
  assert.ok(Math.abs(Math.hypot(...e) - 1) < 1e-9, 'un changement de repère garde la norme');
  assert.ok(e[2] > 0, 'elle éclaire ce que la caméra voit');
  // Les ombres tombent vers la droite et vers le haut de l'écran, d'autant plus
  // loin que ce qui les porte est haut.
  const o = decalageOmbre(HAUT_FRONDAISON);
  assert.ok(o.x > 0 && o.y < 0);
  assert.ok(Math.hypot(o.x, o.y) < HAUT_FRONDAISON);
});
