import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cibleLien, empreinte, nomsObsoletes, revisionLot } from '../../../scripts/production/figurines/installer';

test('la révision d’un lot ne dépend pas de l’ordre de lecture, et change avec un seul fichier', () => {
  const a = { nom: 'unite_x_base_lod0.glb', sha256: 'aa' };
  const b = { nom: 'unite_x_base_albedo.png', sha256: 'bb' };
  assert.equal(revisionLot([a, b]), revisionLot([b, a]));
  assert.notEqual(revisionLot([a, b]), revisionLot([a, { ...b, sha256: 'bc' }]));
});

test('seuls les noms de l’unité que le lot ne livre plus sont retirés', () => {
  const installes = [
    'unite_char_leger_base_lod0.glb', 'unite_char_leger_base_albedo.png', 'unite_char_leger_base_emission.png',
    'unite_char_lourd_base_lod0.glb', 'batiment_ville_base_lod0.glb',
  ];
  const livres = ['unite_char_leger_base_lod0.glb', 'unite_char_leger_base_albedo.png', 'unite_char_leger_base_albedo_hiver.png'];
  assert.deepEqual(nomsObsoletes('unite_char_leger_base', installes, livres), ['unite_char_leger_base_emission.png']);
});

test('le lien pointe vers les données par empreinte, comme les autres modèles', () => {
  const sha = empreinte(new Uint8Array([1, 2, 3]));
  assert.match(sha, /^[0-9a-f]{64}$/);
  assert.equal(cibleLien(sha, 'unite_x_base_albedo.png'), `../donnees/${sha}.png`);
  assert.equal(cibleLien(sha, 'unite_x_base_lod0.glb'), `../donnees/${sha}.glb`);
});
