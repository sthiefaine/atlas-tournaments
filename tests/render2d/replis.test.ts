// Les replis se lisent sur l'identifiant d'une entrée : ce test tient la
// correspondance avec les noms du contrat, et la peinture sur une toile factice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idBatiment, idDecor, idUnite } from '../../src/render2d/contrat';
import {
  creerPeintreRepli, DENSITE_REPLI, FORMES, identiteRepli, paletteEquipe, sansOmbresInternes,
  type FabriqueToile,
} from '../../src/render2d/replis';
import type { Pinceau } from '../../src/render/sprites/formes';
import { CAT } from '../engine/aides';

test('les identifiants du contrat se lisent par les bouts', () => {
  assert.deepEqual(identiteRepli(idUnite('char_leger')), { famille: 'unite', cle: 'char_leger' });
  assert.deepEqual(identiteRepli(idUnite('meridien_automate')), { famille: 'unite', cle: 'meridien_automate' });
  assert.deepEqual(identiteRepli(idBatiment('qg', 'fr')), { famille: 'batiment', cle: 'qg' });
  assert.deepEqual(identiteRepli(idDecor('montagne_aride', 'toutes', 2)), { famille: 'decor', essence: 'montagne_aride', saison: 'toutes' });
  assert.deepEqual(identiteRepli('decor_rocher_cotier'), { famille: 'decor', essence: 'rocher', saison: 'toutes' });
  assert.deepEqual(identiteRepli(FORMES.pv(7, true)), { famille: 'pv', pv: 7, agie: true });
  assert.deepEqual(identiteRepli(FORMES.marque('menacee')), { famille: 'marque', genre: 'menacee' });
  assert.equal(identiteRepli('decor_inconnue_ete_1'), null);
  assert.equal(identiteRepli('n_importe_quoi'), null);
});

test('la pastille de PV reste dans 0 à 9, et 0 veut dire « le cadenas seul »', () => {
  assert.equal(FORMES.pv(12, false), 'forme_pv_9');
  assert.equal(FORMES.pv(0, true), 'forme_pv_0_a');
});

test('une palette d’équipe fonce et éclaircit la couleur ; sans couleur, le gris neutre', () => {
  const p = paletteEquipe([1, 0, 0]);
  assert.equal(p.main, 'rgb(255,0,0)');
  assert.equal(p.dark, 'rgb(158,0,0)');
  assert.equal(p.light, 'rgb(255,115,115)');
  assert.notEqual(paletteEquipe(null).main, p.main);
});

/** Un pinceau qui note ce qu'on lui fait faire. */
function pinceauEspion(): { g: Pinceau; remplis: string[] } {
  const remplis: string[] = [];
  let style = '';
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_c, nom) => {
      if (nom === 'fillStyle') return style;
      if (nom === 'fill') return () => { remplis.push(style); };
      if (nom === 'createLinearGradient' || nom === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      return () => undefined;
    },
    set: (_c, nom, v) => { if (nom === 'fillStyle') style = String(v); return true; },
  }) as unknown as Pinceau;
  return { g, remplis };
}

test('les silhouettes perdent leurs ombres internes, et seulement elles', () => {
  const { g, remplis } = pinceauEspion();
  const s = sansOmbresInternes(g);
  s.fillStyle = 'rgba(0,0,0,0.25)';
  s.fill();
  s.fillStyle = '#2e3238';
  s.fill();
  s.fillStyle = 'rgba(0,0,0,0.18)';
  s.fill();
  assert.deepEqual(remplis, ['#2e3238']);
});

test('le peintre mesure, peint à sa densité, et place le pivot au sol', () => {
  const toiles: { l: number; h: number }[] = [];
  const fabrique: FabriqueToile = (l, h) => {
    toiles.push({ l, h });
    return { toile: {} as never, g: pinceauEspion().g };
  };
  const peintre = creerPeintreRepli(fabrique, () => CAT);
  const u = peintre.peindre(idUnite('char_leger'), [0, 0, 1]);
  assert.ok(u);
  assert.equal(u!.echelle, 1 / DENSITE_REPLI);
  assert.ok(u!.py > u!.h / 2, 'le pivot, au sol, est dans la moitié basse');
  assert.ok(Math.abs(u!.px - u!.l / 2) < 1, 'une unité est centrée sur sa case');
  assert.equal(peintre.peindre(idUnite('unite_inconnue'), null), null, 'une clé absente du catalogue n’a pas de repli');
  for (const id of [idBatiment('ville'), idBatiment('port'), idDecor('conifere', 'hiver', 1), FORMES.ombre, FORMES.drapeau, FORMES.pv(3, false)]) {
    assert.ok(peintre.peindre(id, [1, 0, 0]), id);
  }
});
