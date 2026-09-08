// La couche de surbrillances ne rebâtit une géométrie que si ses cases ont
// changé : au survol, la nappe verte reste, seuls la flèche et le curseur
// bougent. Testé sur l'identité des géométries, avec un relief plat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { creerSurbrillances } from '../../src/render3d/surbrillances';
import { temoinDe } from '../../src/render3d/maillage';
import type { Surbrillance } from '../../src/render/surbrillance';

const plat = (): number => 0;

function mailles(groupe: THREE.Group): Record<string, THREE.Mesh> {
  const sortie: Record<string, THREE.Mesh> = {};
  // L'ordre d'ajout est celui de la fabrique : pour chacun des cinq genres, la
  // nappe puis sa jumelle à plat pour le brouillard ; ensuite liseré, chemin,
  // curseur, anneau.
  const noms = ['deplacement', 'attaque', 'capture', 'production', 'danger']
    .flatMap((g) => [g, `${g}Brouillard`])
    .concat(['lisere', 'chemin', 'curseur']);
  const enfants = groupe.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  noms.forEach((nom, i) => { sortie[nom] = enfants[i]!; });
  return sortie;
}

const vert: Surbrillance[] = [
  { case: { x: 1, y: 1 }, genre: 'deplacement' },
  { case: { x: 2, y: 1 }, genre: 'deplacement' },
  { case: { x: 3, y: 1 }, genre: 'attaque' },
];

test('deux vues identiques gardent les mêmes géométries', () => {
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  couche.maj(vert, [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  const avant = { nappe: m['deplacement']!.geometry, chemin: m['chemin']!.geometry, curseur: m['curseur']!.geometry };
  couche.maj([...vert], [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  assert.equal(m['deplacement']!.geometry, avant.nappe);
  assert.equal(m['chemin']!.geometry, avant.chemin);
  assert.equal(m['curseur']!.geometry, avant.curseur);
  assert.ok(m['deplacement']!.visible);
  // Des décalques en matériau à nœuds, qui testent la profondeur sans l'écrire.
  for (const nom of ['deplacement', 'chemin', 'lisere', 'curseur'] as const) {
    const mat = m[nom]!.material;
    assert.ok(mat instanceof THREE.MeshBasicNodeMaterial, `${nom} : un matériau à nœuds`);
    assert.equal(mat.depthWrite, false, `${nom} : sans écriture de profondeur`);
    assert.equal(mat.depthTest, true, `${nom} : un décalque ne passe jamais devant une unité`);
    assert.equal(mat.transparent, true);
  }
  couche.dispose();
});

test('un survol ne rebâtit que la flèche et le curseur, jamais les nappes', () => {
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  couche.maj(vert, [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  const nappe = m['deplacement']!.geometry;
  const rouge = m['attaque']!.geometry;
  const chemin = m['chemin']!.geometry;
  const lisere = m['lisere']!.geometry;
  const curseur = m['curseur']!.geometry;
  couche.maj(vert, [{ x: 1, y: 1 }], { x: 1, y: 1 }, null);
  assert.equal(m['deplacement']!.geometry, nappe, 'la nappe verte est la même');
  assert.equal(m['attaque']!.geometry, rouge, 'la nappe rouge aussi');
  assert.notEqual(m['chemin']!.geometry, chemin, 'la flèche a changé');
  assert.notEqual(m['lisere']!.geometry, lisere);
  assert.notEqual(m['curseur']!.geometry, curseur, 'le curseur a changé');
  assert.equal(m['chemin']!.visible, false, 'un chemin d’une case n’a pas de flèche');
  couche.dispose();
});

test('changer les cases rebâtit la nappe, et invalider() rebâtit tout sur le relief courant', () => {
  let sol = 0;
  const couche = creerSurbrillances(() => sol);
  const m = mailles(couche.groupe);
  couche.maj(vert, [], { x: 1, y: 1 }, null);
  const nappe = m['deplacement']!.geometry;
  couche.maj([...vert, { case: { x: 4, y: 4 }, genre: 'deplacement' }], [], { x: 1, y: 1 }, null);
  assert.notEqual(m['deplacement']!.geometry, nappe);
  const apres = m['deplacement']!.geometry;
  const curseur = m['curseur']!.geometry;
  sol = 0.5;
  couche.invalider();
  assert.notEqual(m['deplacement']!.geometry, apres, 'la nappe est rebâtie');
  assert.notEqual(m['curseur']!.geometry, curseur, 'le curseur aussi');
  const y = (m['curseur']!.geometry.getAttribute('position') as THREE.BufferAttribute).getY(0);
  assert.ok(y > 0.5, 'sur le relief courant, pas l’ancien');
  couche.dispose();
});

test('sous brouillard, une case hors de vue reçoit un décalque plat qui ne trahit pas le relief', () => {
  // Un relief marqué : sans mise à plat, la nappe le dessinerait.
  const couche = creerSurbrillances((x) => (x > 2 ? 1.4 : 0));
  const m = mailles(couche.groupe);
  const vues: Surbrillance[] = [
    { case: { x: 1, y: 0 }, genre: 'attaque' },
    { case: { x: 4, y: 0 }, genre: 'attaque' },
  ];
  couche.majVisibles(new Set(['1,0']));
  couche.maj(vues, [], null, null);

  const y = (g: THREE.BufferGeometry): number[] => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    return Array.from({ length: p.count }, (_, i) => p.getY(i));
  };
  // La nappe vue épouse le sol de sa case ; la nappe de brouillard est plate.
  assert.ok(m['attaque']!.visible, 'la case vue est peinte normalement');
  const plate = m['attaqueBrouillard']!;
  assert.ok(plate.visible, 'la case cachée est peinte aussi : on sait qu’on peut y tirer');
  const hauteurs = new Set(y(plate.geometry).map((v) => v.toFixed(6)));
  assert.equal(hauteurs.size, 1, 'tous ses sommets sont à la même altitude : aucun relief');
  assert.equal((plate.material as THREE.Material & { depthTest: boolean }).depthTest, false,
    'et rien ne peut y découper un trou en forme de montagne');
  // La même couleur et la même opacité que la nappe vue : en r170, un matériau
  // à nœuds cloné perd sa couleur, la nappe de brouillard est donc construite.
  const vueMat = m['attaque']!.material as THREE.MeshBasicNodeMaterial;
  const plateMat = plate.material as THREE.MeshBasicNodeMaterial;
  assert.ok(plateMat instanceof THREE.MeshBasicNodeMaterial);
  assert.equal(plateMat.color.getHex(), vueMat.color.getHex(), 'le rouge de l’enveloppe de tir, pas du blanc');
  assert.equal(plateMat.opacity, vueMat.opacity);
  assert.equal(plateMat.depthWrite, false);

  // Tout redevient visible : plus rien à plat.
  couche.majVisibles(null);
  assert.equal(m['attaqueBrouillard']!.visible, false);
  assert.ok(m['attaque']!.visible);
  couche.dispose();
});

test('la flèche de chemin se redessine à chaque survol : sa géométrie change et le moteur le sait', () => {
  // Le bug du 7 septembre 2026 au soir : sous WebGPU, l'objet de rendu capture
  // la géométrie à sa création et mémoïse ses tampons. Une flèche dont on
  // échangeait la géométrie sans lever `needsUpdate` s'affichait au premier
  // survol, puis plus jamais — le moteur dessinait les tampons libérés.
  const couche = creerSurbrillances(plat);
  const fleche = couche.groupe.getObjectByName('chemin') as THREE.Mesh;
  assert.ok(fleche, 'la flèche est dans le groupe');
  couche.maj([], [{ x: 1, y: 1 }, { x: 2, y: 1 }], null, null);
  const premiere = fleche.geometry;
  assert.ok(premiere.getAttribute('position'), 'la première flèche a des sommets');

  couche.maj([], [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], null, null);
  assert.notEqual(fleche.geometry, premiere, 'un autre chemin, une autre géométrie');
  assert.ok(fleche.geometry.getAttribute('position'), 'la seconde flèche a des sommets');
  // Le témoin change de nom, donc la clé du moteur aussi : sans cela, il
  // continuerait de dessiner les tampons de la première, déjà libérés.
  assert.notEqual(temoinDe(fleche.geometry), temoinDe(premiere), 'la clé du moteur change');
});
