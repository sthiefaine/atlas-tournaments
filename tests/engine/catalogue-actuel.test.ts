import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { chargerCatalogue, creerPartie, enregistrerPartie, rejouer } from '../../src/engine/index';
import { scenePersonnalisee } from './aides';

test('la base zéro conserve les trente unités et leurs homologations', () => {
  const cat = chargerCatalogue();
  assert.equal(cat.version, 0);
  assert.equal(cat.cles.length, 30);
  for (const u of Object.values(cat.unites)) {
    if (u.homologation) assert.equal(u.homologation.catalogue ?? 0, 0);
  }
  for (const nom of readdirSync('content/scenarios').filter((n) => n.endsWith('.json'))) {
    const scenario = JSON.parse(readFileSync('content/scenarios/' + nom, 'utf8'));
    assert.equal(scenario.catalogueVersion, 0, nom);
    assert.ok(scenario.commandantsVersion >= 1, nom);
  }
});

test('un ancien catalogue ne se rejoue pas silencieusement sur la base zéro', () => {
  const cat = chargerCatalogue();
  const scene = scenePersonnalisee(['PP', 'PP'], {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 1 },
  ]);
  const sauvegarde = enregistrerPartie(creerPartie(scene, cat, 'catalogue-zero'), []);
  assert.equal(rejouer(scene, cat, sauvegarde).etat.catalogueVersion, 0);
  assert.throws(() => rejouer(scene, cat, { ...sauvegarde, catalogueVersion: 9 }), /Catalogue de sauvegarde incompatible/);
});
