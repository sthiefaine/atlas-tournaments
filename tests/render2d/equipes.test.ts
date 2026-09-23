// Les couleurs d'armée de la peau 2D (`src/render2d/equipes.ts`) : d'un pays à
// une couleur, par la règle de l'écran (`render/couleur-equipe.ts`). Une seule
// règle — la carte, la vignette du carnet et de l'atelier, les poses d'unités
// l'appellent toutes, aucune ne la recopie.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerStyleNation, chargerStylesNations } from '../../src/assets/styles';
import { projeterCouleurEquipe } from '../../src/render/couleur-equipe';
import { PALETTES } from '../../src/render/palettes';
import {
  couleurEquipeSeule, paletteArmee, paletteDuPays, palettesDeLaCarte, rvbDe,
} from '../../src/render2d/equipes';
import { couleurEquipeDe } from '../../src/render2d/unites';
import { couleurEquipe } from '../../src/render2d/vignette';
import type { CampId, CodePays } from '../../src/schemas/types';

const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

test('la palette d’un pays est celle de son style ; sans style, aucune', () => {
  const fr = chargerStyleNation('fr')!.palette;
  assert.deepEqual(paletteDuPays('fr'), { main: fr.main, dark: fr.dark, light: fr.light });
  assert.equal(paletteDuPays(null), null);
  assert.equal(paletteDuPays(undefined), null);
  assert.equal(paletteDuPays('zz' as CodePays), null, 'un pays qui n’est pas un pays de départ');
});

test('la palette d’armée d’un camp seul : sa nation projetée, son camp sans nation, le neutre sans camp', () => {
  const fr = chargerStyleNation('fr')!.palette;
  assert.deepEqual(paletteArmee(0, 'fr'), { main: '#4578ec', dark: fr.dark, light: fr.light });
  assert.deepEqual(paletteArmee(1, 'fr'), paletteArmee(0, 'fr'), 'un camp seul : la nation ne dépend pas du rang');
  assert.deepEqual(paletteArmee(2, null), PALETTES.vert);
  assert.equal(paletteArmee(3).main, '#d9aa23', 'l’or de camp, projeté');
  assert.deepEqual(paletteArmee(null, 'fr'), PALETTES.neutre, 'un pays ne colore pas un bâtiment sans propriétaire');
  assert.deepEqual(paletteArmee(null), PALETTES.neutre);
});

test('une seule règle : la carte, la vignette et les poses d’unités donnent la même couleur, pour tout camp et tout pays', () => {
  const pays: (CodePays | null)[] = [null, ...chargerStylesNations().map((s) => s.code)];
  const camps: (CampId | null)[] = [null, 0, 1, 2, 3];
  for (const c of camps) {
    for (const p of pays) {
      const attendu = rvbDe(paletteArmee(c, p).main);
      assert.deepEqual(couleurEquipeSeule(c, p), attendu, `${String(c)} ${String(p)}`);
      assert.deepEqual(couleurEquipeDe(c, p), attendu, `unites.ts : ${String(c)} ${String(p)}`);
      assert.deepEqual(couleurEquipe(c, p), attendu, `vignette.ts : ${String(c)} ${String(p)}`);
      // Et c'est la couleur projetée, jamais la brute.
      if (c !== null && p) assert.equal(hex(attendu), projeterCouleurEquipe(chargerStyleNation(p)!.palette.main));
    }
  }
});

test('rvbDe lit un #rrggbb en sRGB de 0 à 1, comme le lot', () => {
  assert.deepEqual([...rvbDe('#b9bec7')], [0xb9 / 255, 0xbe / 255, 0xc7 / 255]);
  assert.equal(hex(rvbDe('#4578ec')), '#4578ec');
});

test('la carte sépare ses camps : Suisse et Canada, France et Luxembourg', () => {
  const suisse = palettesDeLaCarte([0, 1], { 0: 'ch', 1: 'ca' });
  assert.equal(suisse.get(0)!.main, '#d44c40');
  assert.deepEqual(suisse.get(1), PALETTES.bleu);
  const partie = palettesDeLaCarte([0, 1], { 0: 'fr', 1: 'lu' });
  assert.equal(partie.get(0)!.main, '#4578ec');
  assert.deepEqual(partie.get(1), PALETTES.rouge);
  // Sans nations, les couleurs de camp — l'or projeté.
  const nus = palettesDeLaCarte([0, 1, 2, 3], null);
  assert.deepEqual([...nus.values()].map((p) => p.main), ['#3f86e0', '#e04b45', '#37b35a', '#d9aa23']);
  // Un camp absent de la carte n'est pas servi.
  assert.equal(palettesDeLaCarte([0, 1], { 0: 'fr', 2: 'ch' }).has(2), false);
});
