// L'emballage en pages : rien ne déborde, rien ne se chevauche, l'espacement tient.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emballer, type Taille } from '../../scripts/sprites/emballage';

function verifier(tailles: Taille[], max: number, espacement: number): void {
  const e = emballer(tailles, max, espacement);
  assert.equal(e.placements.length, tailles.length);
  for (const p of e.pages) assert.ok(p.largeur <= max && p.hauteur <= max && p.largeur % 4 === 0 && p.hauteur % 4 === 0);
  tailles.forEach((t, i) => {
    const a = e.placements[i]!;
    const page = e.pages[a.page]!;
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + t.l <= page.largeur && a.y + t.h <= page.hauteur, `image ${i} hors de sa page`);
    tailles.forEach((u, j) => {
      if (j <= i) return;
      const b = e.placements[j]!;
      if (b.page !== a.page) return;
      const separees = a.x + t.l + espacement <= b.x || b.x + u.l + espacement <= a.x
        || a.y + t.h + espacement <= b.y || b.y + u.h + espacement <= a.y;
      assert.ok(separees, `images ${i} et ${j} trop proches`);
    });
  });
}

test('des images d’un même modèle tiennent dans une page', () => {
  const tailles = Array.from({ length: 120 }, (_, i) => ({ l: 100 + (i % 17), h: 90 + (i % 13) }));
  verifier(tailles, 2048, 4);
  assert.equal(emballer(tailles, 2048, 4).pages.length, 1);
});

test('trop d’images ouvrent une seconde page', () => {
  const tailles = Array.from({ length: 60 }, () => ({ l: 400, h: 400 }));
  verifier(tailles, 2048, 4);
  assert.ok(emballer(tailles, 2048, 4).pages.length >= 2);
});

test('une image plus grande qu’une page est refusée', () => {
  assert.throws(() => emballer([{ l: 3000, h: 10 }], 2048, 4));
  assert.deepEqual(emballer([], 2048, 4), { placements: [], pages: [] });
});
