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

test('les pierres se posent en couronne, enfoncées dans le sol et jamais identiques', () => {
  const etat = partie('plaine');
  // Une seule case, tout en montagne : on inspecte exactement une case.
  const grille = { largeur: 1, hauteur: 1, terrainDe: (): 'montagne' => 'montagne' };
  const solide = 0.4;
  const decor = creerDecor(grille, etat, () => solide);
  const lots = [0, 1, 2].map((v) => decor.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh);

  for (const lot of lots) assert.ok(lot instanceof THREE.InstancedMesh, 'trois silhouettes, trois lots');
  // Trois volumes distincts : c'est tout l'objet de la reprise. Un seul
  // polyèdre régulier répété donnait une caillasse de dés.
  const sommets = lots.map((l) => l.geometry.getAttribute('position').count);
  assert.equal(new Set(lots.map((l) => l.geometry.uuid)).size, 3);
  assert.ok(sommets.every((n) => n > 0));

  const total = lots.reduce((n, l) => n + l.count, 0);
  assert.ok(total >= 3 && total <= 5, `trois à cinq pierres par case, vu ${total}`);
  assert.ok(lots[0]!.count + lots[2]!.count === 1, 'un seul gros bloc, ou une seule dalle');

  const mat = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const couleur = new THREE.Color();
  const teintes = new Set<string>();
  for (const lot of lots) {
    for (let i = 0; i < lot.count; i += 1) {
      lot.getMatrixAt(i, mat);
      mat.decompose(position, rotation, echelle);
      // Le centre de la case reste dégagé : c'est là que se pose une unité.
      const ecart = Math.hypot(position.x - 0.5, position.z - 0.5);
      assert.ok(ecart > 0.15, `pierre trop au centre : ${ecart}`);
      assert.ok(ecart < 0.45, `pierre débordant de sa case : ${ecart}`);
      // Elle s'enfonce au lieu de se poser : une pierre posée flotte sur sa
      // facette d'appui, ce que faisait l'ancien dodécaèdre relevé de 0,06.
      assert.ok(position.y < solide, `pierre flottante à ${position.y} sur un sol à ${solide}`);
      assert.ok(position.y > solide - 0.12, 'mais pas engloutie');
      lot.getColorAt(i, couleur);
      teintes.add(couleur.getHexString());
    }
  }
  assert.ok(teintes.size > 1, 'deux pierres voisines n’ont pas le même gris');

  // Déterminisme : deux montages rendent exactement le même éboulis.
  const bis = creerDecor(grille, etat, () => solide);
  for (let v = 0; v < 3; v += 1) {
    const a = decor.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh;
    const b = bis.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh;
    assert.equal(a.count, b.count);
    assert.deepEqual([...a.instanceMatrix.array], [...b.instanceMatrix.array]);
  }
  bis.dispose();
  decor.dispose();
});

test('les pierres se reposent quand le terrain bouge', () => {
  const etat = partie('plaine');
  let sol = 0.4;
  const decor = creerDecor(
    { largeur: 1, hauteur: 1, terrainDe: (): 'montagne' => 'montagne' }, etat, () => sol,
  );
  const lot = decor.groupe.getObjectByName('rochers-1') as THREE.InstancedMesh;
  const mat = new THREE.Matrix4();
  lot.getMatrixAt(0, mat);
  const avant = mat.elements[13]!;
  // Une marée ou un chantier du génie fait descendre le sol : les pierres
  // doivent suivre, sinon elles restent suspendues au-dessus du vide.
  sol = -0.1;
  decor.majRelief();
  lot.getMatrixAt(0, mat);
  assert.ok(mat.elements[13]! < avant - 0.4, 'la pierre a suivi le sol qui descend');
  decor.dispose();
});
