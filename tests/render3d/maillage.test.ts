// Échanger une géométrie sous WebGPU (7 septembre 2026, nuit). Le moteur tient
// un objet de rendu par couple objet + matériau, y capture la géométrie une
// fois et mémoïse ses tampons : rien ne l'invalide quand on l'échange. Lever
// `needsUpdate` sur le matériau — donc sa version — est ce qui le fait
// reconstruire. Sans cette règle, la flèche de chemin ne s'affichait qu'une
// fois, puis plus jamais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { invaliderMaille, remplacerGeometrie } from '../../src/render3d/maillage';

function maille(materiau?: THREE.Material | THREE.Material[]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), materiau ?? new THREE.MeshBasicNodeMaterial());
}

test('remplacer une géométrie pose la neuve, libère l’ancienne et invalide l’objet de rendu', () => {
  const m = maille();
  const materiau = m.material as THREE.Material;
  const ancienne = m.geometry;
  let liberee = false;
  ancienne.addEventListener('dispose', () => { liberee = true; });
  const version = materiau.version;

  const neuve = new THREE.BufferGeometry();
  remplacerGeometrie(m, neuve);

  assert.equal(m.geometry, neuve, 'la neuve est posée');
  assert.equal(liberee, true, 'l’ancienne est libérée');
  assert.ok(materiau.version > version, 'le matériau change de version : l’objet de rendu sera refait');
});

test('remplacer par la même géométrie ne fait rien : on ne libère pas ce qu’on garde', () => {
  const m = maille();
  const materiau = m.material as THREE.Material;
  const version = materiau.version;
  let liberee = false;
  m.geometry.addEventListener('dispose', () => { liberee = true; });

  remplacerGeometrie(m, m.geometry);

  assert.equal(liberee, false);
  assert.equal(materiau.version, version);
});

test('une géométrie partagée ne se libère pas sous les pieds de l’autre maille', () => {
  const partagee = new THREE.BufferGeometry();
  const m = maille();
  m.geometry = partagee;
  let liberee = false;
  partagee.addEventListener('dispose', () => { liberee = true; });

  remplacerGeometrie(m, new THREE.BufferGeometry(), false);

  assert.equal(liberee, false, 'la partagée survit');
});

test('une maille à plusieurs matériaux les invalide tous', () => {
  const materiaux = [new THREE.MeshBasicNodeMaterial(), new THREE.MeshBasicNodeMaterial()];
  const m = maille(materiaux);
  const versions = materiaux.map((x) => x.version);

  invaliderMaille(m);

  for (const [i, x] of materiaux.entries()) assert.ok(x.version > versions[i]!, `matériau ${i}`);
});
