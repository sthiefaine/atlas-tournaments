// Poser une géométrie sous WebGPU (8 septembre 2026).
//
// Le moteur ne reconstruit son objet de rendu que si la **clé** change, et cette
// clé ne retient des attributs que leurs noms et formats — jamais leur taille.
// Deux géométries de même structure sont donc indiscernables pour lui. La
// première parade, un attribut témoin qui **alternait** entre deux noms, était
// fausse : elle comptait les échanges, le moteur ne connaît que les géométries
// dessinées, et une maille invisible n'en crée aucune. D'où ces deux règles,
// vérifiées ici : le tampon n'échange plus rien du tout, et le remplacement,
// réservé à ce qui est rare, porte un témoin **monotone**.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';

import { creerTampon, remplacerGeometrie, temoinDe, PREFIXE_TEMOIN } from '../../src/render3d/maillage';

function maille(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicNodeMaterial());
}

/**
 * `RenderObject.getGeometryCacheKey()` de three r170, recopiée telle quelle.
 * Le test suivant échoue si la version installée cesse de dire la même chose :
 * c'est la seule chose qui autorise cette copie.
 */
function cleGeometrie(g: THREE.BufferGeometry): string {
  let cle = '';
  for (const nom of Object.keys(g.attributes).sort()) {
    const a = g.attributes[nom] as THREE.BufferAttribute & { data?: { stride: number }; offset?: number };
    cle += `${nom},`;
    if (a.data) cle += `${a.data.stride},`;
    if (a.offset) cle += `${a.offset},`;
    if (a.itemSize) cle += `${a.itemSize},`;
    if (a.normalized) cle += 'n,';
  }
  if (g.index) cle += 'index,';
  return cle;
}

test('la clé de géométrie de r170 ignore toujours la taille des tampons', () => {
  const source = readFileSync('node_modules/three/src/renderers/common/RenderObject.js', 'utf8');
  const corps = source.slice(source.indexOf('getGeometryCacheKey()'));
  const fin = corps.indexOf('getMaterialCacheKey()');
  const texte = corps.slice(0, fin);
  for (const champ of ['data.stride', 'attribute.offset', 'attribute.itemSize', 'attribute.normalized', 'geometry.index']) {
    assert.ok(texte.includes(champ), `la clé lit encore ${champ}`);
  }
  assert.ok(!/\.count\b/.test(texte), 'et toujours pas le nombre de sommets : c’est tout le problème');
  // Et l'objet de rendu capture bien sa géométrie une fois pour toutes.
  assert.ok(source.includes('this.geometry = object.geometry;'));
  assert.ok(source.includes('if ( this.attributes !== null ) return this.attributes;'));
});

/**
 * Le moteur, réduit à sa règle : un objet de rendu par maille, créé au premier
 * dessin **visible**, reconstruit seulement quand la clé change, et qui dessine
 * la géométrie qu'il a capturée — pas celle que porte la maille aujourd'hui.
 */
function moteur(m: THREE.Mesh) {
  let objet: { geo: THREE.BufferGeometry; cle: string } | null = null;
  return {
    /** Ce que le moteur dessinerait : les sommets, et d'où ils viennent. */
    dessiner(): { sommets: number; perimee: boolean } | null {
      if (!m.visible) return null;
      const cle = cleGeometrie(m.geometry);
      if (objet === null || objet.cle !== cle) objet = { geo: m.geometry, cle };
      const plage = objet.geo.drawRange;
      const total = objet.geo.index?.count ?? objet.geo.getAttribute('position')?.count ?? 0;
      return {
        sommets: Math.max(0, Math.min(plage.start + plage.count, total) - plage.start),
        perimee: objet.geo !== m.geometry,
      };
    },
  };
}

/** Une flèche : `n` sommets, un index, la structure de toutes les autres. */
function fleche(n: number): { attributs: Record<string, { valeurs: number[]; taille: number }>; indices: number[] } {
  return {
    attributs: { position: { valeurs: Array.from({ length: n * 3 }, (_, i) => i), taille: 3 } },
    indices: Array.from({ length: n }, (_, i) => i),
  };
}

test('la flèche survit à une image invisible : c’est le défaut que voyait le propriétaire', () => {
  // Clic sur une unité → chemin d'une case → flèche vide et invisible ; puis
  // survol. C'est exactement la suite qui décalait l'alternance d'un cran.
  const m = maille();
  m.frustumCulled = false;
  const tampon = creerTampon(m);
  const gpu = moteur(m);

  const poser = (n: number): void => {
    if (n === 0) tampon.vider();
    else tampon.ecrire(fleche(n));
    m.visible = n > 0;
  };

  poser(6);
  assert.deepEqual(gpu.dessiner(), { sommets: 6, perimee: false }, 'survol A');
  poser(9);
  assert.deepEqual(gpu.dessiner(), { sommets: 9, perimee: false }, 'survol B');
  poser(0);
  assert.equal(gpu.dessiner(), null, 'retour sur l’unité : rien de dessiné');
  poser(12);
  assert.deepEqual(gpu.dessiner(), { sommets: 12, perimee: false }, 'survol C, celui qui manquait');
  poser(0);
  poser(0);
  poser(4);
  assert.deepEqual(gpu.dessiner(), { sommets: 4, perimee: false }, 'et autant d’allers-retours qu’on veut');
});

test('un tampon n’échange jamais sa géométrie ni ses attributs tant qu’il a la place', () => {
  const m = maille();
  const tampon = creerTampon(m, { sommets: 64, indices: 128 });
  tampon.ecrire(fleche(6));
  const geo = m.geometry;
  const position = geo.getAttribute('position');
  const index = geo.index;
  const cle = cleGeometrie(geo);

  for (const n of [9, 3, 20, 1, 12]) tampon.ecrire(fleche(n));
  assert.equal(m.geometry, geo, 'la même géométrie');
  assert.equal(m.geometry.getAttribute('position'), position, 'le même attribut');
  assert.equal(m.geometry.index, index, 'le même index');
  assert.equal(cleGeometrie(m.geometry), cle, 'donc la même clé : le moteur n’a rien à réapprendre');
  assert.equal(tampon.reallocations, 1, 'une allocation, celle du départ');
  assert.equal(tampon.dessines, 12, 'et la plage suit le dernier contenu');
  assert.equal(m.geometry.drawRange.count, 12);
});

test('la plage dessinée borne le contenu, jamais la capacité', () => {
  const m = maille();
  const tampon = creerTampon(m, { sommets: 64, indices: 128 });
  tampon.ecrire(fleche(20));
  assert.equal(m.geometry.getAttribute('position').count, 64, 'la capacité est celle demandée');
  assert.equal(m.geometry.index!.count, 128);
  assert.equal(m.geometry.drawRange.count, 20, 'on ne dessine que ce qui est écrit');
  tampon.vider();
  assert.equal(m.geometry.drawRange.count, 0, 'et vider ne libère rien');
  assert.equal(m.geometry.getAttribute('position').count, 64);
  assert.equal(tampon.reallocations, 1);
});

test('les bornes ne comptent que les sommets écrits, pas le remplissage', () => {
  const m = maille();
  const tampon = creerTampon(m, { sommets: 4096 });
  // Un triangle loin de l'origine : une sphère qui engloberait le remplissage à
  // zéro tirerait le centre vers elle, et fausserait le cadrage d'ombre.
  tampon.ecrire({
    attributs: { position: { valeurs: [10, 0, 10, 11, 0, 10, 10, 0, 11], taille: 3 } },
    indices: [0, 1, 2],
  });
  const sphere = m.geometry.boundingSphere!;
  assert.ok(sphere.center.x > 9 && sphere.center.z > 9, 'le centre est sur le triangle');
  assert.ok(sphere.radius < 2, 'et le rayon ne va pas chercher l’origine');
});

test('quand la capacité déborde, on réalloue une fois et on tient longtemps', () => {
  const m = maille();
  const tampon = creerTampon(m, { sommets: 4, indices: 4, facteur: 2 });
  tampon.ecrire(fleche(4));
  assert.equal(tampon.reallocations, 1);
  const geo = m.geometry;

  tampon.ecrire(fleche(10));
  assert.equal(tampon.reallocations, 2, 'la capacité a débordé');
  assert.notEqual(m.geometry, geo, 'une géométrie neuve');
  assert.equal(m.geometry.getAttribute('position').count, 20, 'au double du besoin');
  // Et l'ancienne clé ne peut pas revenir : le témoin ne recule jamais.
  assert.notEqual(cleGeometrie(m.geometry), cleGeometrie(geo));

  for (const n of [11, 12, 20, 6]) tampon.ecrire(fleche(n));
  assert.equal(tampon.reallocations, 2, 'et plus rien ne bouge sous la capacité');
});

test('le témoin d’un remplacement est monotone : aucune clé ne peut revenir', () => {
  const m = maille();
  const vues = new Set<string>();
  for (let i = 0; i < 8; i += 1) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    remplacerGeometrie(m, g);
    const t = temoinDe(m.geometry);
    assert.ok(t?.startsWith(PREFIXE_TEMOIN), 'un témoin est posé');
    assert.equal(vues.has(t!), false, 'et il n’a jamais servi');
    vues.add(t!);
  }
  const portes = Object.keys(m.geometry.attributes).filter((n) => n.startsWith(PREFIXE_TEMOIN));
  assert.equal(portes.length, 1, 'un seul témoin à la fois, jamais cumulé');
  assert.equal(m.geometry.getAttribute(portes[0]!)!.count, 1, 'un sommet, qu’aucun nuanceur ne lit');
});

test('remplacer pose la neuve et libère l’ancienne', () => {
  const m = maille();
  const ancienne = m.geometry;
  let liberee = false;
  ancienne.addEventListener('dispose', () => { liberee = true; });

  const neuve = new THREE.BufferGeometry();
  neuve.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  remplacerGeometrie(m, neuve);

  assert.equal(m.geometry, neuve);
  assert.equal(liberee, true);
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

test('absorber une géométrie bâtie ailleurs la recopie, puis la libère', () => {
  const m = maille();
  const tampon = creerTampon(m);
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  source.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  source.setIndex([0, 1, 2]);
  let liberee = false;
  source.addEventListener('dispose', () => { liberee = true; });

  tampon.poser(source);

  assert.equal(liberee, true, 'la temporaire ne survit pas');
  assert.notEqual(m.geometry, source, 'le tampon garde la sienne');
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute;
  assert.equal(p.getX(1), 1, 'les valeurs sont là');
  assert.ok(m.geometry.getAttribute('normal'), 'les normales aussi');
  assert.equal(m.geometry.drawRange.count, 3);

  // Une seconde absorption de même structure ne rebâtit rien.
  const geo = m.geometry;
  const autre = new THREE.BufferGeometry();
  autre.setAttribute('position', new THREE.Float32BufferAttribute([2, 0, 0, 3, 0, 0, 2, 0, 1], 3));
  autre.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  autre.setIndex([0, 1, 2]);
  tampon.poser(autre);
  assert.equal(m.geometry, geo);
  assert.equal((m.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0), 2);
  assert.equal(tampon.reallocations, 1);
});

test('poser null vide le tampon sans rien libérer', () => {
  const m = maille();
  const tampon = creerTampon(m);
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  source.setIndex([0, 1, 2]);
  tampon.poser(source);
  const geo = m.geometry;
  tampon.poser(null);
  assert.equal(m.geometry, geo);
  assert.equal(tampon.dessines, 0);
  assert.equal(m.geometry.drawRange.count, 0);
});
