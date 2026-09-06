// La fiche du menu de production : ce qu'elle dit d'une unité se calcule sans
// DOM, sur le vrai catalogue. « Bonne contre / faible contre » est lu sur la
// table de dégâts, jamais écrit à la main ; la première unité abordable est
// celle que le menu met en avant à l'ouverture.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue, degatsBase } from '../../src/engine/index';
import { bilanDegats, premiereAbordable } from '../../src/render/hud-html';

const CAT = chargerCatalogue(3);

test('bonne contre / faible contre : trois cibles de chaque côté, lues sur la table', () => {
  const b = bilanDegats(CAT, 'antiair');
  assert.equal(b.fortes.length, 3);
  assert.equal(b.faibles.length, 3);
  // L'anti-aérien frappe d'abord ce qui vole : le drone et l'hélico sont en tête.
  assert.ok(b.fortes.includes('helico'));
  assert.ok(b.fortes.includes('drone'));
  // Le char lourd est sa pire cible (5), il ouvre la liste des faibles.
  assert.equal(b.faibles[0], 'char_lourd');
  // Aucune cible n'est des deux côtés à la fois.
  for (const c of b.fortes) assert.ok(!b.faibles.includes(c));
  // Les fortes sont triées par dégâts décroissants, les faibles croissants.
  const d = (c: string) => degatsBase(CAT, 'antiair', c);
  for (let i = 1; i < b.fortes.length; i++) assert.ok(d(b.fortes[i - 1]!) >= d(b.fortes[i]!));
  for (let i = 1; i < b.faibles.length; i++) assert.ok(d(b.faibles[i - 1]!) <= d(b.faibles[i]!));
});

test('les pires cibles comptent celles qu’on ne peut pas toucher du tout', () => {
  const b = bilanDegats(CAT, 'char_lourd');
  // Le char lourd ne tire ni sur l'hélico ni sur les drones : base 0.
  for (const c of b.faibles) assert.equal(degatsBase(CAT, 'char_lourd', c), 0);
  assert.ok(b.faibles.includes('helico'));
});

test('une unité sans arme n’a ni fortes ni faibles', () => {
  for (const cle of ['transport', 'drone', 'brouilleur'] as const) {
    assert.deepEqual(bilanDegats(CAT, cle), { fortes: [], faibles: [] }, cle);
  }
});

test('le bilan est déterministe et suit l’ordre du catalogue à égalité', () => {
  assert.deepEqual(bilanDegats(CAT, 'infanterie'), bilanDegats(CAT, 'infanterie'));
  // L'infanterie frappe la recon, le transport et le brouilleur à 70 : l'ordre
  // du catalogue départage, recon d'abord.
  assert.deepEqual(bilanDegats(CAT, 'infanterie').fortes, ['recon', 'transport', 'brouilleur']);
});

test('la première unité abordable est mise en avant, sinon la première', () => {
  const unites = ['char_lourd', 'char_leger', 'infanterie'] as const;
  assert.equal(premiereAbordable(CAT, unites, 7000), 'char_leger');
  assert.equal(premiereAbordable(CAT, unites, 20000), 'char_lourd');
  assert.equal(premiereAbordable(CAT, unites, 500), 'char_lourd');
  assert.equal(premiereAbordable(CAT, [], 500), null);
});
