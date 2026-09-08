// Échanger une géométrie sous WebGPU (7 septembre 2026, nuit). Le moteur ne
// reconstruit son objet de rendu que si la **clé** change, et cette clé ne
// retient des attributs que leurs noms et formats — jamais leur taille. Deux
// géométries de même structure sont donc indiscernables pour lui : la flèche de
// chemin ne s'affichait qu'une fois. Un attribut témoin au nom alterné suffit à
// faire changer la clé ; aucun nuanceur ne le lit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { remplacerGeometrie, temoinDe, TEMOINS } from '../../src/render3d/maillage';

function maille(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicNodeMaterial());
}

/** Une géométrie de même structure qu'une autre : c'est le cas qui piégeait. */
function fleche(sommets: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sommets * 3), 3));
  return g;
}

test('deux géométries de même structure ne portent pas le même témoin', () => {
  const m = maille();
  remplacerGeometrie(m, fleche(6));
  const premier = temoinDe(m.geometry);
  assert.ok(premier, 'la première porte un témoin');

  remplacerGeometrie(m, fleche(9));
  const second = temoinDe(m.geometry);
  assert.ok(second, 'la seconde aussi');
  assert.notEqual(second, premier, 'et ce n’est pas le même : la clé du moteur change');

  remplacerGeometrie(m, fleche(12));
  assert.equal(temoinDe(m.geometry), premier, 'le troisième revient au premier nom : deux états suffisent');
});

test('le témoin ne coûte rien et ne se cumule jamais', () => {
  const m = maille();
  remplacerGeometrie(m, fleche(6));
  remplacerGeometrie(m, fleche(9));
  const portes = TEMOINS.filter((nom) => m.geometry.getAttribute(nom) !== undefined);
  assert.equal(portes.length, 1, 'un seul témoin à la fois');
  assert.equal(m.geometry.getAttribute(portes[0]!)!.count, 1, 'un sommet, jamais lu');
  assert.equal(m.geometry.getAttribute('position')!.count, 9, 'la vraie géométrie est intacte');
});

test('remplacer pose la neuve et libère l’ancienne', () => {
  const m = maille();
  const ancienne = m.geometry;
  let liberee = false;
  ancienne.addEventListener('dispose', () => { liberee = true; });

  const neuve = fleche(3);
  remplacerGeometrie(m, neuve);

  assert.equal(m.geometry, neuve);
  assert.equal(liberee, true);
});

test('remplacer par la même géométrie ne fait rien : on ne libère pas ce qu’on garde', () => {
  const m = maille();
  let liberee = false;
  m.geometry.addEventListener('dispose', () => { liberee = true; });
  remplacerGeometrie(m, m.geometry);
  assert.equal(liberee, false);
});

test('une géométrie partagée ne se libère pas sous les pieds de l’autre maille', () => {
  const partagee = fleche(4);
  const m = maille();
  m.geometry = partagee;
  let liberee = false;
  partagee.addEventListener('dispose', () => { liberee = true; });

  remplacerGeometrie(m, fleche(5), false);

  assert.equal(liberee, false, 'la partagée survit');
});
