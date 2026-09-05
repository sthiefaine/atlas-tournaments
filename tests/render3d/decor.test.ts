import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parametresAmbiance } from '../../src/render3d/eclairage';
import { creerDecor } from '../../src/render3d/decor';
import { partie } from '../engine/aides';

test('un bâtiment occupé dégage la silhouette sans révéler une unité hors vision', () => {
  const etat = partie('plaine');
  const unite = etat.unites[0]!;
  const cle = `${unite.x},${unite.y}`;
  const decor = creerDecor({ largeur: etat.largeur, hauteur: etat.hauteur, terrainDe: () => 'ville' }, etat, () => 0);
  const batiment = decor.groupe.getObjectByName('batiments')!.children.find((b) => b.userData['case'] === cle)!;
  decor.majProprietaires(etat, new Set([cle]));
  assert.equal(batiment.scale.y, 0.12);
  decor.majProprietaires(etat, new Set());
  assert.equal(batiment.scale.y, 1, 'le bâtiment ne révèle pas l’occupation cachée');
  decor.majProprietaires({ ...etat, unites: [] }, null);
  assert.equal(batiment.scale.y, 1, 'la hauteur revient après le départ sans changer le propriétaire');
  decor.dispose();
});

test('les détails architecturaux restent fusionnés par matériau et libérés après capture', () => {
  const etat = partie('plaine');
  const types = ['ville', 'qg', 'usine', 'aeroport'] as const;
  const decor = creerDecor({ largeur: 4, hauteur: 1, terrainDe: (x) => types[x]! }, etat, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  let geometriesLiberees = 0;
  const nombre = batiments.children.reduce((n, b) => {
    assert.ok(b.children.length <= 7, 'les détails ne multiplient pas les appels de dessin');
    b.children.forEach((m) => {
      assert.ok(m instanceof THREE.Mesh);
      m.geometry.addEventListener('dispose', () => { geometriesLiberees += 1; });
    });
    return n + b.children.length;
  }, 0);
  decor.majProprietaires({ ...etat, proprietaires: { ...etat.proprietaires, '0,0': 1 } });
  assert.equal(geometriesLiberees, nombre, 'une capture libère toute la génération précédente');
  decor.dispose();
});

test('les biomes portent des silhouettes de végétation distinctes sans multiplier les instances', () => {
  const etat = partie('plaine');
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'foret' as const };
  const alpine = creerDecor(grille, etat, () => 0, 'montagne');
  const tropical = creerDecor(grille, etat, () => 0, 'archipel');
  const coniferes = alpine.groupe.getObjectByName('coniferes') as THREE.InstancedMesh;
  const palmes = tropical.groupe.getObjectByName('palmes') as THREE.InstancedMesh;
  assert.equal(coniferes.count, 3);
  assert.equal(palmes.count, 3);
  assert.notEqual(coniferes.geometry.getAttribute('position').count, palmes.geometry.getAttribute('position').count);
  alpine.dispose(); tropical.dispose();
});

test('la réduction hivernale des couronnes conserve leurs positions sur le plateau', () => {
  const etat = partie('plaine');
  const decor = creerDecor({ largeur: 3, hauteur: 3, terrainDe: () => 'foret' }, etat, () => 0, 'marais');
  const feuillus = decor.groupe.getObjectByName('feuillus') as THREE.InstancedMesh;
  const avant = new THREE.Matrix4(); const apres = new THREE.Matrix4();
  feuillus.getMatrixAt(12, avant);
  decor.appliquerAmbiance(parametresAmbiance('hiver', 'jour', 'clair'), 'hiver');
  feuillus.getMatrixAt(12, apres);
  assert.deepEqual(apres.elements.slice(12, 15), avant.elements.slice(12, 15));
  assert.ok(Math.abs(apres.elements[0]!) < Math.abs(avant.elements[0]!));
  decor.dispose();
});
