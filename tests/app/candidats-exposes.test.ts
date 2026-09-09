import test from 'node:test';
import assert from 'node:assert/strict';
import { lireExposition, PREFIXE_CANDIDATS } from '../../src/app/admin/assets/candidats';
import { cheminInspection } from '../../src/app/admin/assets/[cle]/chemins-inspection';
const asset = {id:'unite_drone_marin_base', revision:'a'.repeat(64), fichiers:['unite_drone_marin_base_lod0.glb','unite_drone_marin_base_albedo.png']};
const manifeste = {version:1, prefixe:PREFIXE_CANDIDATS, assets:[asset]};
test('exposition : lecture des candidats distincte de toute approbation', () => {
  const candidats = lireExposition({...manifeste, assets:[{...asset, fichiers:[...asset.fichiers,asset.fichiers[0]]}]});
  assert.deepEqual(candidats.get(asset.id), {...asset,prefixe:PREFIXE_CANDIDATS});
  assert.equal(candidats.size,1);
});
test('exposition : refuse URL externe, chemin traversant et métadonnées incomplètes', () => {
  for (const valeur of [null, {...manifeste, version:2}, {...manifeste,prefixe:'https://example.com'}]) assert.equal(lireExposition(valeur).size,0);
  for (const modification of [{id:'../base'}, {revision:'courante'}, {fichiers:['../base_lod0.glb']}, {fichiers:[asset.fichiers[1]]}, {fichiers:[...asset.fichiers,'https://example.com/image.png']}]) {
    assert.equal(lireExposition({...manifeste, assets:[{...asset,...modification}]}).size,0);
  }
});
test('inspection : chemins reçus et candidats restent séparés, révisions encodées', () => {
  assert.equal(cheminInspection(undefined,'modele_lod0.glb',null),'/assets/modeles/modele_lod0.glb');
  assert.equal(cheminInspection('/assets/candidats/','base_lod0.glb','a b'),'/assets/candidats/base_lod0.glb?v=a%20b');
  assert.equal(cheminInspection('/api/admin/assets/base/historique/abc','base_lod0.glb','abc'),'/api/admin/assets/base/historique/abc/base_lod0.glb?v=abc');
});
