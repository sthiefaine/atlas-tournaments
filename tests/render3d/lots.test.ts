/**
 * Le lot instancié qui ne coûte pas son programme (`render3d/lots.ts`).
 *
 * Ce que ces tests tiennent, et qui est tout l'enjeu : **deux lots de tailles
 * différentes ne font qu'un programme**, dans la passe principale comme dans la
 * passe d'ombres, là où deux `InstancedMesh` en faisaient quatre. Le reste
 * — comptes, matrices, teintes — n'est là que pour que le remplacement soit
 * sans douleur aux points d'appel.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { estLotInstancie, LotInstancie } from '../../src/render3d/lots';
import { signatureOmbre } from '../../src/render3d/prechauffage';
import { cleProgramme } from './compter-programmes';
import { construireNuanceur } from './nuanceur';

function forme(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

test('ni `count` ni `instanceColor` : ce sont les deux noms que three interroge', () => {
  const lot = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 8);
  lot.compte = 5;
  lot.setColorAt(0, new THREE.Color(1, 0, 0));
  // `getMaterialCacheKey` fait `if ( object.count > 1 ) cacheKey += object.uuid`.
  // Porter ce nom-là rendrait un programme par lot, c'est-à-dire tout ce que le
  // module défait — et sans bruit, puisque tout continuerait de s'afficher.
  assert.equal((lot as unknown as { count?: number }).count, undefined);
  // `setupDiffuseColor` fait `if ( object.instanceColor )` et multiplie alors
  // par le varying `vInstanceColor`, que seul `InstanceNode` écrit. Porter ce
  // nom-là teindrait le lot par une valeur **non initialisée** : les drapeaux
  // sortaient noirs, sans une erreur, et c'est le dump du WGSL qui l'a montré.
  assert.equal((lot as unknown as { instanceColor?: unknown }).instanceColor, undefined);
  assert.ok(lot.teintes, 'la teinte se lit sous un nom à nous');
});

test('le WGSL d’un lot teinté ne lit aucun varying que rien n’écrit', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const lot = new LotInstancie(forme(), mat, 8);
  lot.compte = 4;
  lot.setColorAt(0, new THREE.Color(1, 0, 0));
  const { vertex, fragment } = construireNuanceur(lot);
  assert.ok(!fragment.includes('vInstanceColor'), 'le varying de three n’est pas convoqué');
  assert.match(vertex, /iTeinte/, 'la teinte entre par son attribut');
  // Ce que le sommet écrit, le fragment le lit : le varying a un auteur.
  const ecrit = /varyings\.(\w+) = iTeinte;/.exec(vertex)?.[1];
  assert.ok(ecrit, 'le sommet passe la teinte au fragment');
  assert.ok(fragment.includes(ecrit!), 'et le fragment lit celui-là');
});

test('deux lots de tailles différentes ne font qu’un seul programme', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const petit = new LotInstancie(forme(), mat, 4);
  const grand = new LotInstancie(forme(), mat, 400);
  petit.compte = 3;
  grand.compte = 250;
  assert.equal(cleProgramme(petit, mat), cleProgramme(grand, mat));

  // Et la comparaison qui dit pourquoi ce module existe : les mêmes en
  // `InstancedMesh` en font deux, parce que r170 met l'`uuid` de la maille dans
  // la clé dès que le compte dépasse un.
  const a = new THREE.InstancedMesh(forme(), mat, 4);
  const b = new THREE.InstancedMesh(forme(), mat, 400);
  assert.notEqual(cleProgramme(a, mat), cleProgramme(b, mat));
});

test('et un seul programme d’ombre, là où deux lots instanciés en faisaient deux', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const petit = new LotInstancie(forme(), mat, 4);
  const grand = new LotInstancie(forme(), mat, 400);
  petit.castShadow = true; grand.castShadow = true;
  assert.equal(signatureOmbre(petit), signatureOmbre(grand));

  const a = new THREE.InstancedMesh(forme(), mat, 4);
  const b = new THREE.InstancedMesh(forme(), mat, 400);
  assert.notEqual(signatureOmbre(a), signatureOmbre(b));
});

test('le compte de dessin passe par la géométrie, jamais par la maille', () => {
  const lot = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 10);
  const geo = lot.geometry as THREE.InstancedBufferGeometry;
  assert.equal(geo.isInstancedBufferGeometry, true, 'c’est elle que `getDrawParameters` lit d’abord');
  assert.equal(lot.compte, 0, 'un lot naît vide');
  lot.compte = 6;
  assert.equal(geo.instanceCount, 6);
  // Le compte n'est plus écrit dans le WGSL : le régler ne rebâtit rien, et
  // c'est ce qui permet au décor de cesser de refaire ses arbres à chaque marée.
  lot.compte = 2;
  assert.equal(geo.instanceCount, 2);
  // Zéro ne dessine plus une instance dégénérée : `getDrawParameters` rend
  // `null`. C'était le piège que `allumer` contournait en éteignant la maille.
  lot.compte = 0;
  assert.equal(geo.instanceCount, 0);
  lot.compte = 99;
  assert.equal(geo.instanceCount, 10, 'et la capacité borne, plutôt que d’écrire hors du tampon');
});

test('une matrice se range en quatre colonnes, comme `Matrix4.elements` les donne', () => {
  const lot = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 3);
  const m = new THREE.Matrix4().makeTranslation(2, 3, 4).scale(new THREE.Vector3(5, 5, 5));
  lot.setMatrixAt(1, m);
  const geo = lot.geometry;
  for (let c = 0; c < 4; c += 1) {
    const attr = geo.getAttribute(`iCol${c}`);
    assert.ok(attr, `la colonne ${c} est un attribut`);
    assert.equal((attr as THREE.InstancedBufferAttribute).isInstancedBufferAttribute, true, 'par instance');
    for (let k = 0; k < 4; k += 1) {
      assert.equal(attr.array[1 * 4 + k], m.elements[c * 4 + k], `colonne ${c}, composante ${k}`);
    }
  }
  // Écrire hors de la capacité ne fait rien, plutôt que de déborder.
  lot.setMatrixAt(9, m);
  lot.setMatrixAt(-1, m);
});

test('la teinte n’arrive qu’à qui la demande, et branche la couleur du matériau', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const lot = new LotInstancie(forme(), mat, 4);
  assert.equal(lot.teintes, null, 'un lot sans teinte n’a pas d’attribut de teinte');
  assert.equal((mat as unknown as { colorNode: unknown }).colorNode ?? null, null);

  lot.setColorAt(2, new THREE.Color(0.25, 0.5, 0.75));
  assert.ok(lot.teintes, 'le premier appel crée le tampon');
  const teintes = lot.geometry.getAttribute('iTeinte');
  assert.deepEqual([...teintes.array.slice(6, 9)], [0.25, 0.5, 0.75]);
  assert.deepEqual([...teintes.array.slice(0, 3)], [1, 1, 1], 'les autres restent neutres');
  assert.ok((mat as unknown as { colorNode: unknown }).colorNode, 'et branche la couleur, sinon rien ne la lit');
});

test('les matrices se téléversent ensemble', () => {
  const lot = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 2);
  assert.equal(lot.instanceMatrix.needsUpdate, false);
  lot.instanceMatrix.needsUpdate = true;
  for (let c = 0; c < 4; c += 1) {
    // `needsUpdate` d'un attribut s'écrit sans se lire : c'est `version` qui
    // en garde la trace, et c'est elle que le moteur regarde.
    const col = lot.geometry.getAttribute(`iCol${c}`) as THREE.BufferAttribute;
    assert.equal(col.version, 1, `la colonne ${c} part aussi`);
  }
  assert.equal(lot.instanceMatrix.needsUpdate, true);
});

test('libérer un lot ne tue pas la forme qu’il partage', () => {
  const partagee = forme();
  const a = new LotInstancie(partagee, new THREE.MeshStandardNodeMaterial(), 4);
  const b = new LotInstancie(partagee, new THREE.MeshStandardNodeMaterial(), 4);
  let libereesA = 0;
  a.geometry.addEventListener('dispose', () => { libereesA += 1; });
  a.dispose();
  assert.equal(libereesA, 0, 'la géométrie du lot ne se libère pas d’elle-même');
  assert.equal(b.geometry.getAttribute('position'), partagee.getAttribute('position'), 'l’autre lot garde sa forme');
  // Une forme taillée pour ce lot seul, elle, se libère sur demande.
  const propre = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 4);
  let liberee = 0;
  propre.geometry.addEventListener('dispose', () => { liberee += 1; });
  propre.dispose(true);
  assert.equal(liberee, 1);
});

test('un lot se reconnaît, et une maille ordinaire n’en est pas un', () => {
  const lot = new LotInstancie(forme(), new THREE.MeshStandardNodeMaterial(), 2);
  assert.equal(estLotInstancie(lot), true);
  assert.equal(estLotInstancie(new THREE.Mesh(forme(), new THREE.MeshStandardNodeMaterial())), false);
});

test('le WGSL du lot instancie bien, et transforme aussi la normale', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const lot = new LotInstancie(forme(), mat, 32);
  lot.compte = 20;
  const { vertex } = construireNuanceur(lot);
  // Les quatre colonnes entrent comme attributs de sommet, une par instance.
  for (const c of ['iCol0', 'iCol1', 'iCol2', 'iCol3']) {
    assert.ok(vertex.includes(c), `${c} est un attribut du sommet`);
  }
  // Et le compte n'est **nulle part** dans le texte : c'est exactement ce qui
  // permet à deux lots de tailles différentes de partager leur programme, là où
  // `InstanceNode` écrit `array<mat4x4<f32>, 20>`.
  assert.ok(!/array<\s*mat4x4<f32>\s*,/.test(vertex), 'aucun tableau de matrices dimensionné dans le WGSL');
  assert.ok(!vertex.includes('instanceMatrix'), 'et pas le chemin d’instanciation de three');
  // La matrice se reconstruit de ses colonnes, et sert **aux deux** : la
  // normale d'abord, sans quoi un arbre tourné s'éclairerait de travers, la
  // position ensuite.
  assert.match(vertex, /nodeVar\d+ = mat4x4<f32>\( iCol0, iCol1, iCol2, iCol3 \)/);
  assert.match(vertex, /normalLocal = \( mat3x3<f32>\(nodeVar/, 'la normale passe par la matrice d’instance');
  assert.match(
    vertex, /varyings\.positionLocal = \( nodeVar\d+ \* vec4<f32>\( varyings\.positionLocal, 1\.0 \) \)\.xyz/,
  );
  // Et dans cet ordre : la position monde se calcule **après**, sinon tout le
  // lot lirait la case de son origine — la faute que le brouillard avait déjà
  // trouvée une fois (`terrain.ts`).
  assert.ok(
    vertex.indexOf('varyings.positionLocal = ( nodeVar') < vertex.indexOf('modelViewMatrix = '),
    'l’instance avant le modèle',
  );
});

test('le même lot en `InstancedMesh` écrit son compte dans le WGSL — la raison de tout ceci', () => {
  const mat = new THREE.MeshStandardNodeMaterial();
  const ancien = new THREE.InstancedMesh(forme(), mat, 20);
  const { vertex } = construireNuanceur(ancien);
  assert.match(vertex, /array<\s*mat4x4<f32>\s*,\s*20\s*>/, 'vingt, en dur : d’où un programme par lot');
});
