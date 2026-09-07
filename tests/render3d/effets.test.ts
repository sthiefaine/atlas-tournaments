/**
 * Le pool d'effets transitoires : borné, recyclé, sans allocation par image, et
 * libéré au démontage. Aucun contexte WebGL : un document qui sait créer un
 * canevas sans contexte suffit, la texture reste blanche.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { CAPACITE, creerEffets } from '../../src/render3d/effets';

function documentSansToile(): Document {
  return {
    createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  } as unknown as Document;
}

test('un effet naît visible à sa position, vit sa durée, puis rend sa place', () => {
  const effets = creerEffets(documentSansToile());
  assert.equal(effets.groupe.name, 'effets', 'le groupe porte le nom de sa famille pour la mesure');
  const e = effets.emettre({ genre: 'etincelle', position: { x: 1, y: 0.3, z: 2 }, duree: 300, vitesse: { x: 1, y: 0, z: 0 } });
  assert.equal(e.vivant, true);
  assert.equal(effets.vivants, 1);
  const sprite = effets.groupe.children.find((o) => o.visible);
  assert.ok(sprite instanceof THREE.Sprite, 'une étincelle est un sprite face à la caméra');
  assert.ok(sprite.material instanceof THREE.SpriteNodeMaterial, 'en matériau à nœuds, mélange additif sans écriture de profondeur');
  assert.equal(sprite.material.blending, THREE.AdditiveBlending);
  assert.equal(sprite.material.depthWrite, false);
  assert.deepEqual([sprite.position.x, sprite.position.y, sprite.position.z], [1, 0.3, 2]);

  assert.equal(effets.avancer(100), true, 'il reste un effet : il faut redessiner');
  assert.ok(Math.abs(sprite.position.x - 1.1) < 1e-9, 'la vitesse est en unités par seconde');
  const mat = sprite.material;
  assert.ok(mat.opacity > 0 && mat.opacity < 1, `à un tiers de sa vie, l’étincelle s’éteint déjà (${mat.opacity})`);

  assert.equal(effets.avancer(250), false, 'plus rien à redessiner');
  assert.equal(e.vivant, false);
  assert.equal(effets.vivants, 0);
  assert.equal(sprite.visible, false);
  effets.dispose();
});

test('halo et anneau sont couchés au sol, les autres genres font face à la caméra', () => {
  const effets = creerEffets(documentSansToile());
  effets.emettre({ genre: 'halo', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  effets.emettre({ genre: 'anneau', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  effets.emettre({ genre: 'poussiere', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  effets.emettre({ genre: 'caisse', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  effets.emettre({ genre: 'halo', plat: false, position: { x: 0, y: 1, z: 0 }, duree: 100 });
  const vivants = effets.groupe.children.filter((o) => o.visible);
  assert.equal(vivants.filter((o) => o instanceof THREE.Mesh).length, 2, 'deux quads au sol');
  assert.equal(vivants.filter((o) => o instanceof THREE.Sprite).length, 3, 'trois sprites, dont un halo forcé debout');
  for (const o of vivants) assert.equal(o.castShadow, false, 'un effet ne porte jamais d’ombre');
  effets.dispose();
});

test('la courbe d’opacité monte puis descend, et l’échelle va de la taille de départ à celle d’arrivée', () => {
  const effets = creerEffets(documentSansToile());
  effets.emettre({ genre: 'halo', position: { x: 0, y: 0, z: 0 }, duree: 1000, montee: 0.5, opacite: 0.8, taille: 1, tailleFin: 3 });
  const quad = effets.groupe.children.find((o) => o.visible) as THREE.Mesh;
  const mat = quad.material as THREE.MeshBasicNodeMaterial;
  assert.equal(mat.opacity, 0, 'à la naissance, une montée à 0,5 part de zéro');
  assert.equal(quad.scale.x, 1);
  effets.avancer(500);
  assert.ok(Math.abs(mat.opacity - 0.8) < 1e-9, 'au sommet, l’opacité demandée');
  assert.ok(Math.abs(quad.scale.x - 2) < 1e-9, 'à mi-vie, à mi-chemin des deux tailles');
  effets.avancer(250);
  assert.ok(Math.abs(mat.opacity - 0.4) < 1e-9, 'puis elle redescend');
  effets.dispose();
});

test('le pool est borné : au-delà de la capacité, le plus ancien est recyclé, et rien n’est alloué', () => {
  const effets = creerEffets(documentSansToile(), 8);
  assert.equal(effets.capacite, 8);
  const premiers = Array.from({ length: 6 }, (_, i) => effets.emettre({
    genre: 'etincelle', position: { x: i, y: 0, z: 0 }, duree: 10_000,
  }));
  const enfants = effets.groupe.children.length;
  // La capacité se partage entre sprites et quads ; six sprites remplissent la part des sprites.
  const septieme = effets.emettre({ genre: 'etincelle', position: { x: 9, y: 0, z: 0 }, duree: 10_000 });
  assert.equal(effets.groupe.children.length, enfants, 'un pool plein n’alloue plus : il recycle');
  assert.equal(premiers[0]!.vivant, false, 'le plus ancien a rendu sa place');
  assert.equal(premiers[1]!.vivant, true);
  assert.equal(septieme.vivant, true);
  assert.ok(effets.vivants <= effets.capacite);
  // Cent émissions de plus : jamais plus que la capacité, jamais un enfant de plus.
  for (let i = 0; i < 100; i++) effets.emettre({ genre: 'poussiere', position: { x: 0, y: 0, z: 0 }, duree: 10_000 });
  for (let i = 0; i < 100; i++) effets.emettre({ genre: 'anneau', position: { x: 0, y: 0, z: 0 }, duree: 10_000 });
  assert.ok(effets.vivants <= 8, `${effets.vivants} vivants pour une capacité de 8`);
  assert.ok(effets.groupe.children.length <= 8);
  effets.dispose();
});

test('libérer une poignée périmée ne touche pas l’effet qui a repris la place', () => {
  const effets = creerEffets(documentSansToile(), 4);
  const a = effets.emettre({ genre: 'etincelle', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  effets.avancer(200);
  assert.equal(a.vivant, false);
  const b = effets.emettre({ genre: 'etincelle', position: { x: 0, y: 0, z: 0 }, duree: 100 });
  a.liberer();
  assert.equal(b.vivant, true, 'la place a été reprise : l’ancienne poignée est inerte');
  b.liberer();
  assert.equal(b.vivant, false);
  b.liberer();
  assert.equal(effets.vivants, 0, 'libérer deux fois ne fait rien');
  effets.dispose();
});

test('couper retire tout ce qui vit et les objets attachés ; dispose libère la mémoire graphique', () => {
  const effets = creerEffets(documentSansToile());
  for (let i = 0; i < 5; i++) effets.emettre({ genre: 'eclair', position: { x: 0, y: 0, z: 0 }, duree: 1000 });
  const pan = new THREE.Group();
  effets.attacher(pan);
  assert.ok(effets.groupe.children.includes(pan));
  effets.couper();
  assert.equal(effets.vivants, 0);
  assert.equal(effets.groupe.children.includes(pan), false, 'ce qu’on a attaché part avec le reste');
  assert.equal(effets.avancer(16), false);
  // Après la coupe, le pool sert encore.
  const e = effets.emettre({ genre: 'anneau', position: { x: 0, y: 0, z: 0 }, duree: 1000 });
  assert.equal(e.vivant, true);

  let liberes = 0;
  for (const o of effets.groupe.children) {
    const m = (o as THREE.Sprite | THREE.Mesh).material as THREE.Material;
    const original = m.dispose.bind(m);
    m.dispose = () => { liberes += 1; original(); };
  }
  effets.dispose();
  assert.ok(liberes > 0, 'les matériaux du pool sont libérés');
  assert.equal(effets.groupe.children.length, 0);
  assert.equal(effets.vivants, 0);
});

test('la capacité par défaut est celle du budget', () => {
  assert.equal(CAPACITE, 64);
  const effets = creerEffets(documentSansToile());
  assert.equal(effets.capacite, 64);
  effets.dispose();
});
