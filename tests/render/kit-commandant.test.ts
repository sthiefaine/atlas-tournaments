/**
 * Les lectures défensives d'un profil de commandant : un kit de révision 4 a
 * une faiblesse et deux répliques, un kit d'avant n'en a pas, et un champ
 * malformé ne fait pas planter la page — il se tait.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { effetsDeCapacite, faiblesseDuProfil, repliquesDuProfil } from '../../src/render/kit-commandant';

const v4 = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', '..', 'doc', 'refonte', 'pouvoirs-v4.json'), 'utf8')) as { commandants: unknown[] }).commandants;

test('un kit de révision 4 rend sa faiblesse, ses répliques et ses effets', () => {
  for (const profil of v4) {
    const f = faiblesseDuProfil(profil);
    assert.ok(f, 'faiblesse');
    assert.equal(typeof f.description, 'string');
    assert.ok('modificateur' in f.effet);
    const r = repliquesDuProfil(profil);
    assert.ok(r && r.pouvoir && r.super, 'répliques');
    const p = profil as { pouvoir: unknown; superPouvoir: unknown };
    assert.ok(effetsDeCapacite(p.pouvoir).length > 0);
    assert.ok(effetsDeCapacite(p.superPouvoir).length > 0);
  }
});

test('un kit d’avant, ou un champ malformé, rend null plutôt qu’une faiblesse inventée', () => {
  assert.equal(faiblesseDuProfil({ cle: 'x', pouvoir: { effets: [] } }), null);
  assert.equal(faiblesseDuProfil(null), null);
  assert.equal(faiblesseDuProfil({ faiblesse: { axe: 'inconnu', effet: { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } }, description: 'x' } }), null);
  assert.equal(faiblesseDuProfil({ faiblesse: { axe: 'economie', effet: { cible: 'economie' }, description: 'x' } }), null);
  assert.equal(faiblesseDuProfil({ faiblesse: { axe: 'economie', effet: { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } } } }), null);
  assert.equal(repliquesDuProfil({ replique: { pouvoir: 'seule' } }), null);
  assert.equal(repliquesDuProfil({}), null);
  assert.deepEqual(effetsDeCapacite({ effets: 'non' }), []);
  assert.deepEqual(effetsDeCapacite(undefined), []);
});
