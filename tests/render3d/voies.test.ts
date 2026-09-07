// Les voies du rendu 3D : la pièce à poser sur une case de route ou de pont se
// décide depuis ses quatre voisines, sans three.js — c'est une fonction pure,
// elle se vérifie comme du moteur. L'atlas, lui, se peint en mémoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';

import { BIOMES, CARACTERE_PAR_TERRAIN, CLES_TERRAIN, type CleTerrain } from '../../src/schemas/index';
import {
  axePont, hauteurEn, hauteurSol, hauteurTerrain, LIAISONS_CANON, liaisonsVoie, pieceDeCase,
  pieceDepuisLiaisons, relieVoie, tournerLiaisons, type FormeVoie, type GrilleTerrain, type Liaisons,
} from '../../src/render3d/geometrie';
import {
  APPARENCES, atlasVoies, COLONNES_ATLAS, RANGS_ATLAS, TUILES_ATLAS, tuileDe, uvAtlas,
} from '../../src/render3d/textures-voies';

/** Une grille depuis des lignes de caractères, dans le vocabulaire du canon. */
function grille(lignes: readonly string[]): GrilleTerrain {
  const par: Record<string, CleTerrain> = Object.fromEntries(
    Object.entries(CARACTERE_PAR_TERRAIN).map(([cle, car]) => [car, cle as CleTerrain]),
  );
  return {
    largeur: lignes[0]!.length,
    hauteur: lignes.length,
    terrainDe: (x, y) => par[lignes[y]?.[x] ?? 'P'] ?? 'plaine',
  };
}

test('tourner des liaisons d’un quart de tour horaire envoie le nord à l’est', () => {
  const bout: Liaisons = [true, false, false, false];
  assert.deepEqual(tournerLiaisons(bout, 1), [false, true, false, false]);
  assert.deepEqual(tournerLiaisons(bout, 2), [false, false, true, false]);
  assert.deepEqual(tournerLiaisons(bout, 3), [false, false, false, true]);
  assert.deepEqual(tournerLiaisons(bout, 4), bout);
  assert.deepEqual(tournerLiaisons(bout, -1), tournerLiaisons(bout, 3));
});

test('les seize configurations de voisines se ramènent aux six pièces, et à une seule', () => {
  const formes = new Set<FormeVoie>();
  for (let masque = 0; masque < 16; masque += 1) {
    const l: Liaisons = [!!(masque & 1), !!(masque & 2), !!(masque & 4), !!(masque & 8)];
    const p = pieceDepuisLiaisons(l);
    // La pièce canonique tournée de `rotation` doit redonner exactement les
    // liaisons demandées : c'est ce que le décalque affiche.
    assert.deepEqual(tournerLiaisons(LIAISONS_CANON[p.forme], p.rotation), l, `masque ${masque}`);
    formes.add(p.forme);
  }
  assert.equal(formes.size, 6, 'les six formes servent toutes');
  // Quelques cas nommés, pour que l'erreur parle.
  assert.deepEqual(pieceDepuisLiaisons([true, false, true, false]), { forme: 'droite', rotation: 0 });
  assert.deepEqual(pieceDepuisLiaisons([false, true, false, true]), { forme: 'droite', rotation: 1 });
  assert.deepEqual(pieceDepuisLiaisons([false, true, true, false]), { forme: 'virage', rotation: 1 });
  assert.deepEqual(pieceDepuisLiaisons([true, true, true, false]), { forme: 'te', rotation: 0 });
  assert.deepEqual(pieceDepuisLiaisons([false, true, true, true]), { forme: 'te', rotation: 1 });
  assert.deepEqual(pieceDepuisLiaisons([true, true, true, true]).forme, 'croix');
  assert.deepEqual(pieceDepuisLiaisons([false, false, false, true]), { forme: 'bout', rotation: 3 });
  assert.deepEqual(pieceDepuisLiaisons([false, false, false, false]).forme, 'isole');
});

test('une route se raccorde aux routes, aux ponts et aux bâtiments, à rien d’autre', () => {
  const attendu: Record<CleTerrain, boolean> = {
    plaine: false, foret: false, montagne: false, route: true, ville: true, qg: true,
    usine: true, aeroport: true, mer: false, riviere: false, pont: true, plage: false, radar: true,
    // Un port est un bâtiment : la route y arrive, sinon un quai serait desservi
    // par rien et la voie s'arrêterait une case avant lui.
    port: true,
  };
  for (const t of CLES_TERRAIN) assert.equal(relieVoie(t), attendu[t], t);
});

test('la pièce d’une case se lit sur la carte : bout, droite, virage, T, croix', () => {
  const g = grille([
    'PPRPP',
    'PPRPP',
    'RRRRR',
    'PPRPC',
    'PPRPP',
  ]);
  assert.deepEqual(pieceDeCase(g, 2, 2), { forme: 'croix', rotation: 0 });
  assert.deepEqual(pieceDeCase(g, 2, 1), { forme: 'droite', rotation: 0 });
  assert.deepEqual(pieceDeCase(g, 1, 2), { forme: 'droite', rotation: 1 });
  // Au bord de la carte, la route continue : pas de moignon sur le diorama.
  assert.deepEqual(pieceDeCase(g, 2, 0), { forme: 'droite', rotation: 0 });
  // ... et une ville au sud fait de ce bord un T : la route y mène aussi.
  assert.deepEqual(pieceDeCase(g, 4, 2), { forme: 'te', rotation: 1 });
  // Une plaine ne porte rien, une ville non plus : la route mène à elle, elle
  // ne la traverse pas.
  assert.equal(pieceDeCase(g, 0, 0), null);
  assert.equal(pieceDeCase(g, 4, 3), null);

  const h = grille([
    'PPPP',
    'PRRP',
    'PRPP',
    'PPPP',
  ]);
  assert.deepEqual(pieceDeCase(h, 1, 1), { forme: 'virage', rotation: 1 });
  assert.deepEqual(pieceDeCase(h, 2, 1), { forme: 'bout', rotation: 3 });
  assert.deepEqual(pieceDeCase(h, 1, 2), { forme: 'bout', rotation: 0 });
  assert.deepEqual(liaisonsVoie(h, 1, 1), [false, true, true, false]);

  // Un T dont la barre mène à une usine : le bâtiment compte comme liaison.
  const u = grille([
    'PUP',
    'RRR',
    'PPP',
  ]);
  assert.deepEqual(pieceDeCase(u, 1, 1), { forme: 'te', rotation: 3 });
});

test('un pont s’oriente d’une rive à l’autre, jamais dans le sens du courant', () => {
  // Rivière nord-sud, route est-ouest : le pont suit la route.
  const g = grille([
    'PPVPP',
    'RRNRR',
    'PPVPP',
  ]);
  assert.equal(axePont(g, 2, 1), 'eo');
  assert.deepEqual(pieceDeCase(g, 2, 1), { forme: 'droite', rotation: 1 });

  // Sans route, l'eau seule décide : elle est **à côté** du pont, pas dans son axe.
  const seul = grille([
    'PPPPP',
    'PPPPP',
    'VVNVV',
    'PPPPP',
    'PPPPP',
  ]);
  assert.equal(axePont(seul, 2, 2), 'ns');
  // Un pont isolé ne finit pas en moignon : il traverse.
  assert.deepEqual(pieceDeCase(seul, 2, 2), { forme: 'droite', rotation: 0 });

  // Deux ponts bout à bout sur une rivière large se raccordent l'un à l'autre.
  const large = grille([
    'PPRPP',
    'VVNVV',
    'VVNVV',
    'PPRPP',
  ]);
  assert.equal(axePont(large, 2, 1), 'ns');
  assert.equal(axePont(large, 2, 2), 'ns');
  assert.deepEqual(pieceDeCase(large, 2, 1), { forme: 'droite', rotation: 0 });
});

test('sous un pont le sol se creuse au lit de la rivière, la surface reste à hauteur de berge', () => {
  const g = grille([
    'PPPPP',
    'VVNVV',
    'PPPPP',
  ]);
  // La surface — là où roule une unité — est celle du terrain `pont`.
  assert.equal(hauteurEn(g, 2.5, 1.5), hauteurTerrain('pont'));
  // Le sol, lui, descend au niveau du lit pour laisser passer l'eau.
  assert.equal(hauteurSol(g, 2.5, 1.5), hauteurTerrain('riviere'));
  // La berge tient sa hauteur jusqu'à la culée : à son bord, elle est encore à zéro.
  assert.ok(Math.abs(hauteurSol(g, 2.5, 0.999)) < 1e-9, 'la berge doit tenir jusqu’au bord de sa case');
  // Et partout ailleurs, sol et surface ne font qu'un.
  for (const [x, z] of [[0.5, 0.5], [0.5, 1.5], [2.5, 0.5], [4.9, 2.9], [1.5, 1.5]]) {
    assert.equal(hauteurSol(g, x!, z!), hauteurEn(g, x!, z!), `(${x}, ${z})`);
  }
  // Une grille sans pont : les deux champs sont identiques au bit près.
  const relief = grille(['PMR', 'CVS', 'FWA']);
  for (let i = 0; i <= 30; i += 1) {
    for (let j = 0; j <= 30; j += 1) {
      assert.equal(hauteurSol(relief, i / 10, j / 10), hauteurEn(relief, i / 10, j / 10));
    }
  }
});

test('les UV de l’atlas tournent avec la pièce et restent dans leur tuile', () => {
  for (const forme of TUILES_ATLAS) {
    const { colonne, rang } = tuileDe(forme);
    for (const rotation of [0, 1, 2, 3]) {
      for (const [a, b] of [[0, 0], [1, 0], [0.5, 0.5], [0.25, 0.9], [1, 1]] as const) {
        const [u, v] = uvAtlas(forme, rotation, a, b);
        assert.ok(u >= colonne / COLONNES_ATLAS - 1e-9 && u <= (colonne + 1) / COLONNES_ATLAS + 1e-9, `${forme} u`);
        assert.ok(v >= rang / RANGS_ATLAS - 1e-9 && v <= (rang + 1) / RANGS_ATLAS + 1e-9, `${forme} v`);
      }
    }
  }
  // Le centre ne bouge pas en tournant ; le nord d'une pièce tournée d'un
  // quart va chercher... l'est de la tuile : c'est le sens horaire.
  const centre = uvAtlas('droite', 0, 0.5, 0.5);
  assert.deepEqual(uvAtlas('droite', 1, 0.5, 0.5), centre);
  const [u0, v0] = uvAtlas('bout', 0, 0.5, 0.1);
  const [u1, v1] = uvAtlas('bout', 1, 0.9, 0.5);
  assert.ok(Math.abs(u0 - u1) < 1e-9 && Math.abs(v0 - v1) < 1e-9, 'le bras est de la pièce tournée lit le bras nord de la tuile');
});

/** Toile mémoire : l'atlas se vérifie sans navigateur. */
function documentMemoire(): Document {
  return {
    createElement: () => {
      const canvas = {
        width: 0, height: 0, pixels: new Uint8ClampedArray() as Uint8ClampedArray,
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (image: { data: Uint8ClampedArray }) => { canvas.pixels = image.data; },
        }),
      };
      return canvas;
    },
  } as unknown as Document;
}

test('chaque biome peint un atlas distinct, plein sur la chaussée et vide hors de la voie', () => {
  const doc = documentMemoire();
  const taille = 32;
  const L = taille * COLONNES_ATLAS;
  const empreintes = new Set<string>();
  for (const biome of BIOMES) {
    assert.ok(APPARENCES[biome], `apparence manquante : ${biome}`);
    const atlas = atlasVoies(doc, biome, taille) as unknown as { pixels: Uint8ClampedArray };
    const px = atlas.pixels;
    assert.equal(px.length, L * taille * RANGS_ATLAS * 4);
    const alpha = (forme: FormeVoie, a: number, b: number): number => {
      const { colonne, rang } = tuileDe(forme);
      const x = colonne * taille + Math.floor(a * taille);
      const y = rang * taille + Math.floor(b * taille);
      return px[(y * L + x) * 4 + 3]!;
    };
    // Le centre d'une droite est de la chaussée ; son coin est de l'herbe.
    assert.equal(alpha('droite', 0.5, 0.5), 255, `${biome} : chaussée au centre`);
    assert.equal(alpha('droite', 0.02, 0.02), 0, `${biome} : rien dans le coin`);
    // Un bout ne va que vers le nord : le sud de sa tuile est vide.
    assert.equal(alpha('bout', 0.5, 0.95), 0, `${biome} : le bout ne traverse pas`);
    assert.equal(alpha('bout', 0.5, 0.05), 255, `${biome} : le bout part au nord`);
    // La croix rejoint ses quatre bords à largeur constante.
    for (const [a, b] of [[0.5, 0.02], [0.98, 0.5], [0.5, 0.98], [0.02, 0.5]] as const) {
      assert.equal(alpha('croix', a, b), 255, `${biome} : bras de croix (${a}, ${b})`);
    }
    empreintes.add(px.join(','));
  }
  assert.equal(empreintes.size, BIOMES.length, 'deux biomes peignent la même voie');
});

test('le banc d’essai aligne les six pièces et un pont dans l’axe de sa route', async () => {
  const { carteBanc } = await import('../../src/app/atelier/banc');
  const { chargerCatalogue } = await import('../../src/engine/index');
  const cat = chargerCatalogue();
  const carte = carteBanc();
  const g: GrilleTerrain = {
    largeur: carte.largeur,
    hauteur: carte.hauteur,
    terrainDe: (x, y) => cat.parCaractere[carte.grille[y]?.[x] ?? 'P'] ?? 'plaine',
  };
  const formes = new Set<FormeVoie>();
  let ponts = 0;
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const p = pieceDeCase(g, x, y);
      if (p) formes.add(p.forme);
      if (g.terrainDe(x, y) === 'pont') {
        ponts += 1;
        // Chaque pont du banc franchit de l'eau : il a une rive de chaque côté
        // de son axe, sinon il ne montre rien d'un pont.
        const axe = axePont(g, x, y);
        const [dx, dy] = axe === 'ns' ? [1, 0] : [0, 1];
        const eau = (t: CleTerrain): boolean => t === 'mer' || t === 'riviere';
        assert.ok(eau(g.terrainDe(x + dx, y + dy)) || eau(g.terrainDe(x - dx, y - dy)), `pont sans eau en ${x},${y}`);
      }
    }
  }
  for (const f of ['bout', 'droite', 'virage', 'te', 'croix'] as const) {
    assert.ok(formes.has(f), `pièce jamais montrée par le banc : ${f}`);
  }
  assert.ok(ponts >= 2, 'le banc doit montrer un pont dans chaque axe');
});

test('le plateau coud un décalque par case de voie et un ouvrage par pont, et les libère', async () => {
  const { creerPlateau } = await import('../../src/render3d/terrain');
  const doc = documentMemoire();
  const g = grille([
    'PPRPP',
    'RRRRP',
    'VVNVV',
    'PPRPP',
  ]);
  const plateau = creerPlateau(g, doc, 'montagne');
  const voies = plateau.groupe.getObjectByName('voies') as THREE.Mesh;
  const ponts = plateau.groupe.getObjectByName('ponts') as THREE.Mesh;
  assert.ok(voies.visible && ponts.visible);
  // Seize sommets par case de voie : une nappe 3 × 3, aux sommets du sol.
  assert.equal(voies.geometry.getAttribute('position').count, 7 * 16);
  // Un pont : tablier, deux parapets, quatre piles — sept boîtes de 24 sommets.
  assert.equal(ponts.geometry.getAttribute('position').count, 7 * 24);
  // Le décalque sur le pont est à hauteur de tablier, le sol dessous au lit.
  assert.ok(plateau.hauteurEn(2.5, 2.5) === 0, 'la surface du pont est à zéro');
  const y = plateau.sol.geometry.getAttribute('position') as THREE.BufferAttribute;
  let creux = Infinity;
  for (let i = 0; i < y.count; i += 1) {
    if (Math.abs(y.getX(i) - 2.5) < 0.2 && Math.abs(y.getZ(i) - 2.5) < 0.2) creux = Math.min(creux, y.getY(i));
  }
  assert.ok(creux < -0.2, `le sol sous le pont doit être creusé (${creux})`);

  // Le génie retire la route : le décalque suit, et rien ne fuit.
  let liberees = 0;
  voies.geometry.addEventListener('dispose', () => { liberees += 1; });
  plateau.majTerrain(grille(['PPPPP', 'PPPPP', 'VVVVV', 'PPPPP']));
  assert.equal(liberees, 1, 'l’ancienne géométrie des voies est libérée');
  assert.equal(voies.visible, false);
  assert.equal(ponts.visible, false);
  plateau.dispose();
});
