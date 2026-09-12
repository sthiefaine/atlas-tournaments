import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererSpecs } from '../../src/assets/index';
import { familleAsset, regrouperAssets, correspondRecherche, paginer } from '../../src/app/admin/assets/exploration';
import { promptProduction } from '../../src/app/admin/assets/prompt-production';
const specs = genererSpecs();
test('une unité et ses 24 kits se parcourent dans une seule famille sans perte', () => {
  const groupes = regrouperAssets(specs);
  assert.equal(groupes.reduce((n, g) => n + g.specs.length, 0), specs.length);
  const groupe = groupes.find(g => g.cle === 'unite_antiair');
  assert.ok(groupe); assert.equal(groupe.specs.length, 25);
  assert.ok(groupe.specs.every(s => familleAsset(s) === 'unite_antiair'));
});
test('la recherche porte sur les mots, la description et le territoire, sans accents', () => {
  const spec = specs.find(s => s.id === 'unite_artillerie_base')!;
  assert.ok(correspondRecherche(spec, 'artillerie base'));
  assert.ok(correspondRecherche(spec, 'ile', 'Île'));
  assert.equal(correspondRecherche(spec, 'inexistant'), false);
});
test('pagination bornée et prompt local exécutable avec base commune', () => {
  assert.deepEqual(paginer([1,2,3], '999', 2).elements, [3]);
  assert.equal(paginer([], '-4').page, 1);
  const spec = specs.find(s => s.id === 'kit_fr_antiair')!;
  const prompt = promptProduction(spec, []);
  assert.ok(prompt.includes('--base public/assets/modeles'));
  assert.ok(prompt.includes('Fichiers obligatoires manquants'));
});

test('le prompt exige la source uploadée même si le lot est complet', () => {
  const spec = specs.find(s => s.id === 'unite_antiair_base')!;
  const revision = 'a'.repeat(64);
  const prompt = promptProduction(spec, ['unite_antiair_base_lod0.glb'], { revision });
  assert.ok(prompt.includes(`/sources?revision=${revision}`));
  assert.ok(prompt.includes('aucun repli silencieux'));
  assert.ok(prompt.includes('ne le remplace jamais par une génération procédurale'));
  assert.ok(promptProduction(spec, []).includes('Recherche la dernière source déposée'));
});
