import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { activerPremierContact } from '../../scripts/production/activer-premier-contact';
import { lireInventaireModeles } from '../../src/serveur/modeles';
import { analyserGlb, creerChargeurModeles } from '../../src/render3d/modeles';

test('activation dédupliquée, inventaire des alias, rejeu et conservation des fichiers ordinaires', () => {
  const racine = mkdtempSync(path.join(os.tmpdir(), 'atlas-activer-'));
  try {
    mkdirSync(path.join(racine, 'assets/missions/premier_contact'), { recursive: true });
    mkdirSync(path.join(racine, 'lot'));
    const nom = 'unite_infanterie_base_lod0.glb';
    writeFileSync(path.join(racine, 'lot', nom), 'glb-fixture');
    writeFileSync(path.join(racine, 'assets/missions/premier_contact/manifest.json'), JSON.stringify({ assets: [{ id:'unite_infanterie_base', categorie:'base_unite', source:'lot', fichiers:[`modeles/base/${nom}`] }] }));
    const premier = activerPremierContact(racine);
    const alias = path.join(racine, 'public/assets/modeles', nom);
    assert.match(readlinkSync(alias), /^\.\.\/donnees\/[a-f0-9]{64}\.glb$/);
    assert.deepEqual(lireInventaireModeles(path.dirname(alias)).modeles.unite_infanterie_base, [0]);
    symlinkSync('../absent', path.join(path.dirname(alias), 'unite_absente_base_lod0.glb'));
    assert.equal(lireInventaireModeles(path.dirname(alias)).modeles.unite_absente_base, undefined);
    assert.deepEqual(activerPremierContact(racine), premier);
    rmSync(alias); writeFileSync(alias, 'glb-fixture');
    assert.deepEqual(activerPremierContact(racine), premier);
    writeFileSync(alias, 'modèle conservé');
    assert.throws(() => activerPremierContact(racine), /existant différent/);
    assert.equal(readFileSync(alias, 'utf8'), 'modèle conservé');
  } finally { rmSync(racine, { recursive:true, force:true }); }
});

test('les dix couples Premier contact sélectionnent et conforment leurs vrais GLB nationaux publiés', async () => {
  const dossier = path.resolve('public/assets/modeles');
  const inventaire = lireInventaireModeles(dossier);
  const demandes: string[] = [];
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.png$/i, { load(_url: string, onLoad: (t: THREE.Texture) => void) {
    const texture = new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1); onLoad(texture); return texture;
  } } as unknown as THREE.Loader);
  const charger = creerChargeurModeles({ inventaire: async () => inventaire, lecteur: async nom => {
    demandes.push(nom); const octets = readFileSync(path.join(dossier, nom));
    const document = JSON.parse(octets.subarray(20, 20 + octets.readUInt32LE(12)).toString());
    for (const image of document.images ?? []) if (image.uri) assert.ok(readFileSync(path.join(dossier,image.uri)).length > 0);
    return analyserGlb(octets.buffer.slice(octets.byteOffset,octets.byteOffset+octets.byteLength) as ArrayBuffer, new GLTFLoader(manager));
  } });
  for (const pays of ['fr','lu']) for (const unite of ['infanterie','char_leger','recon','meca','genie']) {
    const modele = await charger(unite,pays); assert.ok(modele, `${pays}/${unite}`);
    assert.ok(modele.objet.getObjectByName('lod0')); assert.ok(modele.clips.length >= 5);
    assert.ok(demandes.includes(`kit_${pays}_${unite}_lod0.glb`));
  }
  assert.equal(demandes.length,20);
  assert.ok(demandes.every(nom => nom.startsWith('kit_')));
});
