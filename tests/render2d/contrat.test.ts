// Le contrat de la peau 2D : la projection que la cuisson et le rendu partagent,
// et les quelques règles de nommage qui les font se trouver sans se parler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIPS, COS_TANGAGE, ESSENCES_DECOR, LACET_VUE, ORDRE_CALQUES, PIXELS_PAR_CASE, SIN_TANGAGE,
  TANGAGE_CARTE, VUES, caseDepuisPlan, centreCase, idBatiment, idBatimentEtat, idDecor, idUnite,
  niveauxBrouillard, solDepuisPlan, taillePlan, versPlan,
} from '../../src/render2d/contrat';

test('la projection au sol et son inverse se répondent', () => {
  for (const [x, y] of [[0, 0], [3.5, 7.25], [19.99, 13.01], [0.5, 0.5]] as const) {
    const p = versPlan(x, y, 0);
    const s = solDepuisPlan(p.X, p.Y);
    assert.ok(Math.abs(s.x - x) < 1e-9 && Math.abs(s.y - y) < 1e-9, `${x},${y}`);
  }
});

test('une hauteur monte à l’écran, une profondeur descend', () => {
  const sol = versPlan(2, 3, 0);
  const haut = versPlan(2, 3, 1);
  assert.equal(haut.X, sol.X);
  assert.ok(haut.Y < sol.Y);
  assert.ok(Math.abs((sol.Y - haut.Y) - COS_TANGAGE * PIXELS_PAR_CASE) < 1e-9);
  assert.ok(versPlan(2, 4, 0).Y > sol.Y);
});

test('une case est plus large que haute, au tangage de carte', () => {
  assert.ok(TANGAGE_CARTE > 0 && TANGAGE_CARTE < 90);
  const t = taillePlan(1, 1);
  assert.equal(t.largeur, PIXELS_PAR_CASE);
  assert.ok(Math.abs(t.hauteur - SIN_TANGAGE * PIXELS_PAR_CASE) < 1e-9);
  assert.ok(t.hauteur < t.largeur);
});

test('la case sous un point, et rien hors de la carte', () => {
  const c = centreCase({ x: 4, y: 2 });
  assert.deepEqual(caseDepuisPlan(c.X, c.Y, 10, 8), { x: 4, y: 2 });
  assert.equal(caseDepuisPlan(-1, c.Y, 10, 8), null);
  const bord = versPlan(10, 8, 0);
  assert.equal(caseDepuisPlan(bord.X, bord.Y, 10, 8), null);
  assert.deepEqual(caseDepuisPlan(bord.X - 0.001, bord.Y - 0.001, 10, 8), { x: 9, y: 7 });
});

test('chaque vue a son lacet, et les listes fermées sont sans doublon', () => {
  for (const v of VUES) assert.equal(typeof LACET_VUE[v], 'number', v);
  for (const liste of [VUES, CLIPS, ESSENCES_DECOR, ORDRE_CALQUES] as readonly (readonly string[])[]) {
    assert.equal(new Set(liste).size, liste.length);
  }
});

test('les identifiants suivent ceux des GLB', () => {
  assert.equal(idUnite('char_leger'), 'unite_char_leger_base');
  assert.equal(idBatiment('ville'), 'batiment_ville_base');
  assert.equal(idBatiment('qg', 'fr'), 'batiment_qg_fr');
  assert.equal(idBatimentEtat('ville', 'desaffecte'), 'batiment_ville_desaffecte');
  assert.equal(idBatimentEtat('superusine', 'inerte'), 'batiment_superusine_inerte');
  assert.equal(idDecor('feuillu', 'automne', 2), 'decor_feuillu_automne_2');
  assert.match(idDecor('montagne_aride', 'toutes', 1), /^decor_[a-z_]+_[a-z]+_\d+$/);
});

test('le brouillard : vu à 255, caché à 0, tout vu sans brouillard', () => {
  const n = niveauxBrouillard(3, 2, new Set(['0,0', '2,1']));
  assert.deepEqual([...n], [255, 0, 0, 0, 0, 255]);
  assert.ok(niveauxBrouillard(3, 2, null).every(v => v === 255));
});
