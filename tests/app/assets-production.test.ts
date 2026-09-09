import test from 'node:test';
import assert from 'node:assert/strict';
import { genererSpecs } from '../../src/assets/index';
import { fileProduction, jalonsProduction, manifesteAsset } from '../../src/app/admin/assets/parcours-production';
import type { ReceptionAsset } from '../../src/serveur/reception-assets';
const vide: ReceptionAsset = {etat: 'a_produire', revision: null, fichiers: [], octets: 0, motifs: [], precedente: null, revue: null};
const specs = genererSpecs();
const base = specs.find(s => s.id === 'unite_antiair_base')!;
const kit = specs.find(s => s.id === 'kit_fr_antiair')!;
test('production : un candidat et une conformité ne valent jamais validation artistique', () => {
  assert.deepEqual(jalonsProduction(vide), {candidat:false, technique:false, artistique:false, enJeu:false});
  const conforme = {...vide, etat:'conforme' as const, fichiers:['candidat.glb'], revision:'a'.repeat(64)};
  assert.deepEqual(jalonsProduction(conforme), {candidat:true, technique:true, artistique:false, enJeu:false});
  assert(!jalonsProduction({...conforme, etat:'approuve'}).artistique);
  assert(jalonsProduction({...conforme, etat:'approuve', revue:{decision:'approuve', date:'2026-09-09', note:'Contrôle humain'}}).artistique);
});
test('chantier : un candidat conforme attend la revue, ses kits restent bloqués', () => {
  const receptions = new Map([[base.id, {...vide, etat:'conforme' as const}], [kit.id, vide]]);
  const file = fileProduction([base, kit], receptions);
  assert.equal(file.length, 1); assert.equal(file[0]!.spec.id, kit.id); assert.equal(file[0]!.bloquePar, base.id);
  const approuve: ReceptionAsset = {...vide, fichiers:['candidat.glb'], revision:'a'.repeat(64), etat:'approuve', revue:{decision:'approuve', date:'2026-09-09', note:'Revue humaine'}};
  assert.equal(fileProduction([base, kit], new Map([[base.id, approuve], [kit.id, vide]]))[0]!.bloquePar, null);
});
test('manifeste : contrat, fichiers exacts, prompt et réception séparés', () => {
  const m = manifesteAsset(kit, vide);
  assert.equal(m.asset, kit.id); assert.equal(m.baseRequise, base.id);
  assert(m.fichiersObligatoires.includes(`${kit.id}_lod0.glb`));
  assert(m.prompt.includes(kit.id)); assert(m.prompt.includes('assets/specs/'));
  assert(!m.reception.jalons.artistique);
  assert(JSON.parse(JSON.stringify(m)).avertissement.includes('approbation artistique'));
});
