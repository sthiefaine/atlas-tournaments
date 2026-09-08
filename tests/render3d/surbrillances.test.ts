// La couche de surbrillances ne rebâtit une géométrie que si ses cases ont
// changé : au survol, la nappe verte reste, seuls la flèche et le curseur
// bougent. Depuis le 8 septembre 2026, « rebâtir » ne veut plus dire échanger la
// géométrie — sous WebGPU c'est le moyen sûr de dessiner celle d'avant — mais
// **remplir** des attributs préalloués et bouger la plage dessinée. Les tests
// portent donc sur la version des attributs et sur `drawRange`, pas sur
// l'identité des géométries, qui ne doit justement plus jamais changer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { creerSurbrillances } from '../../src/render3d/surbrillances';
import { construireNuanceur } from './nuanceur';
import type { Surbrillance } from '../../src/render/surbrillance';
import type { Case } from '../../src/schemas/types';

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

/** Ce qui dit qu'une maille a été réécrite : la version de ses tampons. */
function etat(m: THREE.Mesh): string {
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  return `${p?.version ?? -1}/${m.geometry.index?.version ?? -1}/${m.geometry.drawRange.count}`;
}

/** Les sommets réellement dessinés : le reste du tampon est du remplissage. */
function sommetsDessines(g: THREE.BufferGeometry): { x: number; y: number; z: number }[] {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const index = g.index;
  const vus = new Set<number>();
  if (index) {
    for (let i = g.drawRange.start; i < g.drawRange.start + g.drawRange.count; i += 1) vus.add(index.getX(i));
  } else {
    for (let i = g.drawRange.start; i < g.drawRange.start + g.drawRange.count; i += 1) vus.add(i);
  }
  return [...vus].map((i) => ({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) }));
}

/** `RenderObject.getGeometryCacheKey()` de r170 — voir `maillage.test.ts`. */
function cleGeometrie(g: THREE.BufferGeometry): string {
  let cle = '';
  for (const nom of Object.keys(g.attributes).sort()) {
    const a = g.attributes[nom] as THREE.BufferAttribute;
    cle += `${nom},`;
    if (a.itemSize) cle += `${a.itemSize},`;
    if (a.normalized) cle += 'n,';
  }
  if (g.index) cle += 'index,';
  return cle;
}

const vert: Surbrillance[] = [
  { case: { x: 1, y: 1 }, genre: 'deplacement' },
  { case: { x: 2, y: 1 }, genre: 'deplacement' },
  { case: { x: 3, y: 1 }, genre: 'attaque' },
];

test('le nuanceur d’un décalque ne lit que la position : aucune normale à calculer', () => {
  // C'est ce qui autorise les trois formes de la couche à ne poser qu'un seul
  // attribut. Une normale par sommet, calculée à chaque survol, ne servait à
  // rien : un matériau basique n'a pas d'éclairage.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  g.setIndex([0, 1, 2]);
  const mat = new THREE.MeshBasicNodeMaterial({
    color: 0x28ec96, transparent: true, opacity: 0.56, depthWrite: false, side: THREE.DoubleSide,
  });
  const { vertex } = construireNuanceur(new THREE.Mesh(g, mat));
  const entrees = vertex.split('\n').filter((l) => l.includes('fn main('));
  assert.equal(entrees.length, 1);
  assert.match(entrees[0]!, /position : vec3<f32>/);
  assert.ok(!/normal/.test(entrees[0]!), 'pas de normale en entrée de sommet');
  assert.ok(!/\buv\b/.test(entrees[0]!), 'pas d’UV non plus');
});

test('deux vues identiques ne réécrivent rien', () => {
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  couche.maj(vert, [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  const avant = { nappe: etat(m['deplacement']!), chemin: etat(m['chemin']!), curseur: etat(m['curseur']!) };
  const geo = m['deplacement']!.geometry;
  couche.maj([...vert], [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  assert.equal(etat(m['deplacement']!), avant.nappe);
  assert.equal(etat(m['chemin']!), avant.chemin);
  assert.equal(etat(m['curseur']!), avant.curseur);
  assert.equal(m['deplacement']!.geometry, geo, 'et la géométrie ne bouge jamais');
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

test('un survol ne réécrit que la flèche et le curseur, jamais les nappes', () => {
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  couche.maj(vert, [{ x: 1, y: 1 }, { x: 2, y: 1 }], { x: 2, y: 1 }, null);
  const avant = Object.fromEntries(Object.entries(m).map(([nom, maille]) => [nom, etat(maille)]));
  couche.maj(vert, [{ x: 1, y: 1 }], { x: 1, y: 1 }, null);
  assert.equal(etat(m['deplacement']!), avant['deplacement'], 'la nappe verte est intacte');
  assert.equal(etat(m['attaque']!), avant['attaque'], 'la nappe rouge aussi');
  assert.notEqual(etat(m['chemin']!), avant['chemin'], 'la flèche a changé');
  assert.notEqual(etat(m['lisere']!), avant['lisere']);
  assert.notEqual(etat(m['curseur']!), avant['curseur'], 'le curseur a changé');
  assert.equal(m['chemin']!.visible, false, 'un chemin d’une case n’a pas de flèche');
  couche.dispose();
});

test('la flèche revient après une image invisible : le défaut du 8 septembre', () => {
  // Cliquer sur une unité pose un chemin d'une seule case : la flèche est vide
  // et invisible, donc jamais dessinée. Avec un témoin qui alternait, le survol
  // suivant retombait sur la clé déjà capturée et le moteur redessinait la
  // flèche d'avant, sur des tampons libérés. Le tampon supprime la question :
  // la géométrie ne change plus, il n'y a plus rien à faire savoir au moteur.
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  const fleche = m['chemin']!;
  // La première écriture alloue le tampon ; c'est **après** elle que la
  // géométrie ne doit plus jamais changer d'identité.
  couche.maj([], [{ x: 0, y: 0 }, { x: 1, y: 0 }], null, null);
  const geo = fleche.geometry;

  const chemins: readonly Case[][] = [
    [{ x: 1, y: 1 }],
    [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
    [{ x: 1, y: 1 }],
    [{ x: 1, y: 1 }, { x: 1, y: 2 }],
    [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
    [{ x: 1, y: 1 }],
    [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  ];
  for (const chemin of chemins) {
    couche.maj([], chemin, null, null);
    if (chemin.length < 2) {
      assert.equal(fleche.visible, false);
      continue;
    }
    assert.equal(fleche.geometry, geo, 'toujours la même géométrie : le moteur ne perd rien');
    assert.ok(fleche.visible);
    assert.ok(fleche.geometry.drawRange.count > 0, 'et il y a bien quelque chose à dessiner');
    // La flèche pointe sur la dernière case du chemin, pas sur celle d'avant.
    const fin = chemin[chemin.length - 1]!;
    const sommets = sommetsDessines(fleche.geometry);
    const proche = sommets.some((s) => Math.abs(s.x - (fin.x + 0.5)) < 0.6 && Math.abs(s.z - (fin.y + 0.5)) < 0.6);
    assert.ok(proche, `la pointe est sur ${fin.x},${fin.y}`);
  }
  couche.dispose();
});

test('changer les cases réécrit la nappe, et invalider() la repose sur le relief courant', () => {
  let sol = 0;
  const couche = creerSurbrillances(() => sol);
  const m = mailles(couche.groupe);
  couche.maj(vert, [], { x: 1, y: 1 }, null);
  const nappe = etat(m['deplacement']!);
  couche.maj([...vert, { case: { x: 4, y: 4 }, genre: 'deplacement' }], [], { x: 1, y: 1 }, null);
  assert.notEqual(etat(m['deplacement']!), nappe);
  const apres = etat(m['deplacement']!);
  const curseur = etat(m['curseur']!);
  sol = 0.5;
  couche.invalider();
  assert.notEqual(etat(m['deplacement']!), apres, 'la nappe est réécrite');
  assert.notEqual(etat(m['curseur']!), curseur, 'le curseur aussi');
  const y = sommetsDessines(m['curseur']!.geometry).map((s) => s.y);
  assert.ok(y.every((v) => v > 0.5), 'sur le relief courant, pas l’ancien');
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

  // La nappe vue épouse le sol de sa case ; la nappe de brouillard est plate.
  assert.ok(m['attaque']!.visible, 'la case vue est peinte normalement');
  const plate = m['attaqueBrouillard']!;
  assert.ok(plate.visible, 'la case cachée est peinte aussi : on sait qu’on peut y tirer');
  const hauteurs = new Set(sommetsDessines(plate.geometry).map((s) => s.y.toFixed(6)));
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

test('cent survols n’allouent aucune géométrie : rien ne change d’identité', () => {
  const couche = creerSurbrillances(plat);
  const m = mailles(couche.groupe);
  // Une portée de mouvement 9 : 181 cases, le plus large qu'un décalque ait à
  // porter. Elle doit tenir dans la capacité de départ, sans réallocation.
  const portee: Surbrillance[] = [];
  for (let x = 0; x < 19; x += 1) {
    for (let y = 0; y < 19; y += 1) {
      if (Math.abs(x - 9) + Math.abs(y - 9) <= 9) portee.push({ case: { x, y }, genre: 'deplacement' });
    }
  }
  assert.equal(portee.length, 181);
  // Une passe complète d'abord : chaque tampon prend sa capacité une fois.
  couche.maj(portee, [{ x: 9, y: 9 }, { x: 9, y: 8 }], { x: 9, y: 8 }, null);
  const geos = Object.fromEntries(Object.entries(m).map(([nom, maille]) => [nom, maille.geometry]));
  // La clé que le moteur tire d'une géométrie : c'est elle, et rien d'autre, qui
  // décide s'il refait son objet de rendu et recompile un nuanceur.
  const cles = Object.fromEntries(Object.entries(m).map(([nom, maille]) => [nom, cleGeometrie(maille.geometry)]));
  for (let i = 0; i < 100; i += 1) {
    const cible = { x: 9 + (i % 5), y: 9 };
    couche.maj(portee, [{ x: 9, y: 9 }, { x: 9, y: 8 }, cible], cible, null);
  }
  for (const [nom, geo] of Object.entries(geos)) {
    assert.equal(m[nom]!.geometry, geo, `${nom} : la même géométrie du début à la fin`);
    assert.equal(cleGeometrie(m[nom]!.geometry), cles[nom], `${nom} : et la même clé pour le moteur`);
  }
  couche.dispose();
});
