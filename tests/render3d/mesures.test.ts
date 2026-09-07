/**
 * La mesure par famille (`src/render3d/mesures.ts`) : des groupes three.js
 * construits en mémoire, sans moteur, comptés comme `renderer.info` du moteur
 * WebGPU (`Info.update`) les compterait — et la lecture de ces compteurs-là.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { compterFamilles, depuisInfo } from '../../src/render3d/mesures';

/** Un quad indexé : quatre sommets, six indices, donc deux triangles — l'index compte, pas les positions. */
function quad(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

/** `n` triangles sans index : trois sommets par triangle. */
function soupe(n: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array<number>(n * 9).fill(0), 3));
  return geo;
}

const MAT = new THREE.MeshBasicMaterial();

function groupe(nom: string, ...enfants: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.name = nom;
  // `add()` sans argument avertit dans la console : un groupe vide reste vide.
  if (enfants.length > 0) g.add(...enfants);
  return g;
}

test('les familles sont les groupes de premier niveau : index ou positions, instances multipliées, sprites et points', () => {
  const scene = new THREE.Scene();
  const instancie = new THREE.InstancedMesh(soupe(4), MAT, 3);
  const points = new THREE.Points(soupe(2), new THREE.PointsMaterial());
  scene.add(
    groupe('plateau', new THREE.Mesh(quad(), MAT), new THREE.Mesh(soupe(5), MAT)),
    groupe('decor', groupe('arbres', instancie)),
    groupe('unites', new THREE.Sprite(new THREE.SpriteMaterial()), points),
    groupe('surbrillances'),
    groupe('effets', new THREE.Mesh(new THREE.BufferGeometry(), MAT)),
    new THREE.DirectionalLight(),
  );
  const familles = compterFamilles(scene);
  assert.deepEqual(familles, {
    plateau: { triangles: 7, mailles: 2 },
    decor: { triangles: 12, mailles: 1 },
    unites: { triangles: 2, mailles: 2 },
    // Un groupe nommé apparaît même vide : la table du budget attend ses familles.
    surbrillances: { triangles: 0, mailles: 0 },
    // Une géométrie vide ne fait pas de tirage.
    effets: { triangles: 0, mailles: 0 },
  });
  assert.ok(!('autres' in familles), 'une lumière sans nom ne dessine rien et n’apparaît pas');
  // Un objet sans nom qui dessine tombe dans « autres ».
  scene.add(new THREE.Mesh(quad(), MAT));
  assert.deepEqual(compterFamilles(scene)['autres'], { triangles: 2, mailles: 1 });
});

test('seul ce qui est visible compte, et d’un LOD le seul niveau courant', () => {
  const cache = new THREE.Mesh(soupe(9), MAT);
  cache.visible = false;
  const sousGroupeCache = groupe('cache', new THREE.Mesh(soupe(9), MAT));
  sousGroupeCache.visible = false;
  const lod = new THREE.LOD();
  lod.addLevel(new THREE.Mesh(quad(), MAT), 0);
  lod.addLevel(new THREE.Mesh(soupe(5), MAT), 50);
  const scene = new THREE.Scene();
  scene.add(groupe('unites', cache, sousGroupeCache, lod));

  // Avant toute image, three tient le niveau 0 pour courant.
  assert.deepEqual(compterFamilles(scene), { unites: { triangles: 2, mailles: 1 } });

  // Une caméra à cent unités : three bascule sur le second niveau.
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 100);
  camera.updateMatrixWorld();
  lod.updateMatrixWorld(true);
  lod.update(camera);
  assert.deepEqual(compterFamilles(scene), { unites: { triangles: 5, mailles: 1 } });

  // Un niveau forcé à la main (`forcerLod`) : c'est la visibilité qui décide.
  lod.autoUpdate = false;
  lod.levels[0]!.object.visible = true;
  lod.levels[1]!.object.visible = false;
  assert.deepEqual(compterFamilles(scene), { unites: { triangles: 2, mailles: 1 } });
});

test('drawRange, groupes de matériaux et instances à zéro se comptent comme le rendu les dessine', () => {
  const partiel = new THREE.Mesh(soupe(4), MAT);
  partiel.geometry.setDrawRange(0, 6);
  const invisible = new THREE.MeshBasicMaterial();
  invisible.visible = false;
  const groupee = new THREE.Mesh(soupe(6), [MAT, invisible, MAT]);
  groupee.geometry.addGroup(0, 9, 0);
  groupee.geometry.addGroup(9, 3, 1);
  groupee.geometry.addGroup(12, 6, 2);
  const vide = new THREE.InstancedMesh(soupe(4), MAT, 0);
  const eteint = new THREE.Mesh(soupe(4), invisible);
  const scene = new THREE.Scene();
  scene.add(groupe('decor', partiel, groupee, vide, eteint));
  // 2 (plage) + 3 + 2 (les deux groupes visibles) ; trois tirages, rien pour
  // le lot instancié sans instance ni pour la maille au matériau invisible.
  assert.deepEqual(compterFamilles(scene), { decor: { triangles: 7, mailles: 3 } });
});

test('les compteurs de l’image se lisent sur `drawCalls` et `triangles`, jamais sur `calls`', () => {
  // La forme d'`Info` du moteur WebGPU : `render.calls` y compte les passes
  // (`render()`), et c'est ce que `WebGLRenderer` appelait les appels de
  // dessin. Lire `calls` compterait trois passes au lieu de trois cents tirages.
  const info = { render: { calls: 3, drawCalls: 336, triangles: 41_000 } };
  assert.deepEqual(depuisInfo(info), { triangles: 41_000, appels: 336 });
  // `Info.update` cumule `instances × sommets / 3` sans arrondir : une fraction
  // de triangle n'existe pas à l'affichage.
  assert.deepEqual(depuisInfo({ render: { drawCalls: 1, triangles: 2 * (4 / 3) } }), { triangles: 3, appels: 1 });
  // Sans moteur — avant `init()` —, rien n'a été dessiné.
  assert.deepEqual(depuisInfo(null), { triangles: 0, appels: 0 });
  assert.deepEqual(depuisInfo(undefined), { triangles: 0, appels: 0 });
});

test('la mesure par famille imite le compte du moteur : un tirage, puis instances × sommets / 3', () => {
  // Le même lot instancié, compté par la scène et tel que le moteur le
  // compterait par `Info.update(objet, sommets, instances)` : quatre triangles
  // de trois sommets, trois instances, un tirage.
  const scene = new THREE.Scene();
  scene.add(groupe('decor', new THREE.InstancedMesh(soupe(4), MAT, 3)));
  const famille = compterFamilles(scene)['decor'];
  const compteurs = { render: { drawCalls: 0, triangles: 0 } };
  compteurs.render.drawCalls += 1;
  compteurs.render.triangles += 3 * (12 / 3);
  assert.deepEqual(famille, { triangles: depuisInfo(compteurs).triangles, mailles: depuisInfo(compteurs).appels });
});
