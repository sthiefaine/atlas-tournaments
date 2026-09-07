// La géométrie du plateau 3D : conversion case ↔ monde, relief par terrain et
// construction de la carte de mélange depuis une vraie `MapDef`. Aucun DOM,
// aucun WebGL : ces fonctions sont pures, elles se vérifient comme du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { chargerCatalogue } from '../../src/engine/index';
import {
  CASE, HAUTEURS, NIVEAU_EAU, REPLI_CENTRE, TERRAINS_BATIS, caseVersMonde, construireSplat,
  hauteurCase, hauteurEn, hauteurTerrain, mondeVersCase, repliCase, solDeCase, splatCase,
  splatTerrain, type GrilleTerrain,
} from '../../src/render3d/geometrie';
import { CLES_TERRAIN, validerMapDef, type CleTerrain, type MapDef } from '../../src/schemas/index';

const CAT = chargerCatalogue();

function carte(): MapDef {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  return r.valeur;
}

/** La grille lue par le rendu, tirée d'une `MapDef` par les caractères du canon. */
function grilleDe(m: MapDef): GrilleTerrain {
  return {
    largeur: m.largeur,
    hauteur: m.hauteur,
    terrainDe: (x, y): CleTerrain => {
      const car = m.grille[y]?.[x] ?? 'P';
      return CAT.parCaractere[car] ?? 'plaine';
    },
  };
}

test('case ↔ monde : le centre d’une case retombe sur la case', () => {
  assert.deepEqual(caseVersMonde({ x: 0, y: 0 }), { x: 0.5, z: 0.5 });
  assert.deepEqual(caseVersMonde({ x: 3, y: 7 }), { x: 3.5, z: 7.5 });
  for (let x = 0; x < 12; x += 1) {
    for (let y = 0; y < 9; y += 1) {
      const m = caseVersMonde({ x, y });
      assert.deepEqual(mondeVersCase(m.x, m.z), { x, y });
    }
  }
  // Les bords appartiennent à la case qui commence, jamais à celle qui finit.
  assert.deepEqual(mondeVersCase(0, 0), { x: 0, y: 0 });
  assert.deepEqual(mondeVersCase(0.999, 0.999), { x: 0, y: 0 });
  assert.deepEqual(mondeVersCase(1, 1), { x: 1, y: 1 });
  // Hors carte, la conversion reste totale : c'est à l'appelant de trancher.
  assert.deepEqual(mondeVersCase(-0.5, -0.5), { x: -1, y: -1 });
  assert.equal(CASE, 1);
});

test('le relief suit la table des terrains, et la table couvre les douze', () => {
  for (const t of CLES_TERRAIN) {
    assert.equal(typeof HAUTEURS[t], 'number', `${t} doit avoir une hauteur`);
    assert.equal(hauteurTerrain(t), HAUTEURS[t]);
  }
  assert.equal(hauteurTerrain('plaine'), 0);
  assert.equal(hauteurTerrain('route'), 0);
  assert.equal(hauteurTerrain('foret'), 0.05);
  assert.equal(hauteurTerrain('montagne'), 1);
  assert.equal(hauteurTerrain('riviere'), -0.25);
  assert.equal(hauteurTerrain('mer'), -0.4);
  assert.equal(hauteurTerrain('plage'), -0.05);
  // L'eau passe au-dessus des lits de rivière et des fonds marins, sous la plage.
  assert.ok(NIVEAU_EAU > hauteurTerrain('riviere'));
  assert.ok(NIVEAU_EAU > hauteurTerrain('mer'));
  assert.ok(NIVEAU_EAU < hauteurTerrain('plage'));
});

test('le champ d’altitude est continu, adouci, et exact au centre des cases', () => {
  const g: GrilleTerrain = {
    largeur: 3,
    hauteur: 3,
    terrainDe: (x, y): CleTerrain => (x === 1 && y === 1 ? 'montagne' : 'plaine'),
  };
  // Au centre d'une case, on retrouve exactement sa hauteur : un pic reste un pic.
  assert.equal(hauteurEn(g, 1.5, 1.5), 1);
  assert.equal(solDeCase(g, { x: 1, y: 1 }), 1);
  assert.equal(solDeCase(g, { x: 0, y: 0 }), 0);
  // À la frontière entre le pic et la plaine, on est à mi-chemin : la jonction
  // est adoucie, il n'y a pas de mur vertical entre deux cases.
  assert.equal(hauteurEn(g, 1, 1.5), 0.5);
  assert.equal(hauteurEn(g, 1.5, 1), 0.5);
  // Et le champ est monotone le long d'un profil qui monte vers le sommet.
  let precedent = -1;
  for (let x = 0.5; x <= 1.5; x += 0.1) {
    const h = hauteurEn(g, x, 1.5);
    assert.ok(h >= precedent - 1e-9, 'le profil ne doit pas redescendre');
    precedent = h;
  }
  // Hors carte, le bord est prolongé : le socle ne se déchire pas.
  assert.equal(hauteurCase(g, -5, -5), hauteurCase(g, 0, 0));
  assert.equal(hauteurEn(g, -3, -3), 0);
});

test('la carte de mélange se construit case par case depuis la MapDef', () => {
  const m = carte();
  const g = grilleDe(m);

  // Chaque terrain donne un mélange normalisé sur ses quatre canaux.
  for (const t of CLES_TERRAIN) {
    const s = splatTerrain(t);
    assert.equal(s.length, 4, `${t} : quatre canaux`);
    const somme = s[0] + s[1] + s[2] + s[3];
    assert.ok(Math.abs(somme - 1) < 1e-9, `${t} : la somme doit valoir 1 (${somme})`);
    for (const canal of s) assert.ok(canal >= 0 && canal <= 1, `${t} : canal hors bornes`);
  }

  // Les valeurs par case correspondent au terrain lu dans la grille.
  assert.deepEqual(splatCase(g, 0, 0), splatTerrain('plaine'));
  assert.deepEqual(splatCase(g, 7, 1), splatTerrain('montagne'));
  assert.deepEqual(splatCase(g, 2, 1), splatTerrain('foret'));
  assert.deepEqual(splatCase(g, 2, 2), splatTerrain('ville'));
  assert.deepEqual(splatCase(g, 2, 4), splatTerrain('qg'));
  assert.deepEqual(splatCase(g, 3, 4), splatTerrain('usine'));
  assert.deepEqual(splatCase(g, 5, 2), splatTerrain('route'));

  // La roche ne sort que sur la montagne, l'herbe domine partout ailleurs.
  assert.ok(splatTerrain('montagne')[2] > 0.5);
  assert.equal(splatTerrain('plaine')[2], 0);
  assert.ok(splatTerrain('plaine')[0] > splatTerrain('route')[0]);

  // La texture fait un texel RGBA par case, dans l'ordre des lignes.
  const donnees = construireSplat(g);
  assert.equal(donnees.length, m.largeur * m.hauteur * 4);
  const texel = (x: number, y: number): number[] => {
    const i = (y * m.largeur + x) * 4;
    return [donnees[i], donnees[i + 1], donnees[i + 2], donnees[i + 3]] as number[];
  };
  assert.deepEqual(texel(0, 0), splatTerrain('plaine').map((v) => Math.round(v * 255)));
  assert.deepEqual(texel(7, 1), splatTerrain('montagne').map((v) => Math.round(v * 255)));
  assert.deepEqual(texel(5, 2), splatTerrain('route').map((v) => Math.round(v * 255)));
});

// ---------------------------------------------------------------------------
// Le centre de chaque case est plat (`10-rendu-3d.md` §4.2)
// ---------------------------------------------------------------------------

test('le centre d’une case reste plat, même au bord d’une montagne', () => {
  // Une plaine et une montagne côte à côte : le dénivelé maximal du jeu.
  const g: GrilleTerrain = {
    largeur: 3,
    hauteur: 1,
    terrainDe: (x): CleTerrain => (x === 1 ? 'montagne' : 'plaine'),
  };
  const centre = CASE * 1.5;
  const au = (dx: number): number => hauteurEn(g, centre + dx, CASE * 0.5);
  const reference = au(0);

  // Un bâtiment tient dans ce disque : il ne doit y voir aucune pente, sinon il
  // s'enfonce d'un côté et flotte de l'autre.
  for (const dx of [-0.26, -0.15, 0, 0.15, 0.26]) {
    assert.ok(
      Math.abs(au(dx * CASE) - reference) < 1e-9,
      `pente au centre à ${dx} case : ${au(dx * CASE)} ≠ ${reference}`,
    );
  }
  // Le dénivelé n'a pas disparu : il est reporté sur la jonction.
  assert.ok(au(0.5 * CASE) < reference - 0.05, 'la jonction descend vers la plaine');
  assert.ok(Math.abs(au(CASE) - hauteurEn(g, CASE * 2.5, CASE * 0.5)) < 1e-9, 'et retrouve le centre voisin');
});

test('deux cases voisines restent soudées : le champ d’altitude est continu', () => {
  const g: GrilleTerrain = {
    largeur: 2,
    hauteur: 1,
    terrainDe: (x): CleTerrain => (x === 0 ? 'montagne' : 'mer'),
  };
  let precedent = hauteurEn(g, 0, CASE * 0.5);
  for (let x = 1; x <= 200; x += 1) {
    const h = hauteurEn(g, (x / 200) * 2 * CASE, CASE * 0.5);
    assert.ok(Math.abs(h - precedent) < 0.05, 'aucune marche dans le champ d’altitude');
    precedent = h;
  }
});

// ---------------------------------------------------------------------------
// Les cases de bâtiment sont plates d'un bord à l'autre (`10-rendu-3d.md` §4.2)
// ---------------------------------------------------------------------------

test('une case bâtie est plate sur toute sa surface, pas seulement en son centre', () => {
  // Le pire cas du jeu : une ville collée à une montagne, et une montagne en
  // diagonale — c'est le coin du socle qui se faisait couper.
  const g: GrilleTerrain = {
    largeur: 3,
    hauteur: 3,
    terrainDe: (x, y): CleTerrain => (x === 0 && y === 0 ? 'ville' : 'montagne'),
  };
  const sol = hauteurTerrain('ville');
  assert.equal(solDeCase(g, { x: 0, y: 0 }), sol);

  // Le socle fait 0,83 de côté et le liseré de camp va à ±0,4575 : on vérifie
  // au-delà, jusqu'au bord exact de la case.
  for (const dx of [-0.5, -0.4575, -0.28, 0, 0.28, 0.4575, 0.5]) {
    for (const dz of [-0.5, -0.4575, -0.28, 0, 0.28, 0.4575, 0.5]) {
      const h = hauteurEn(g, 0.5 + dx * CASE, 0.5 + dz * CASE);
      assert.ok(
        Math.abs(h - sol) < 1e-9,
        `la case bâtie penche en (${dx}, ${dz}) : ${h} au lieu de ${sol}`,
      );
    }
  }
});

test('le dénivelé est reporté sur la jonction, la montagne garde sa hauteur', () => {
  const g: GrilleTerrain = {
    largeur: 2,
    hauteur: 1,
    terrainDe: (x): CleTerrain => (x === 0 ? 'qg' : 'montagne'),
  };
  // Le QG est plat jusqu'à sa frontière…
  assert.ok(Math.abs(hauteurEn(g, 0.999, 0.5) - hauteurTerrain('qg')) < 1e-9);
  // …et la montagne retrouve toute sa hauteur au centre de sa propre case :
  // aplanir la voisine effacerait un relief qui coûte du mouvement et donne
  // de la défense, donc mentirait sur les règles.
  assert.equal(hauteurEn(g, 1.5, 0.5), hauteurTerrain('montagne'));

  // Le champ reste continu : une marche franche déchirerait le maillage.
  let precedent = hauteurEn(g, 0, 0.5);
  for (let i = 1; i <= 400; i += 1) {
    const h = hauteurEn(g, (i / 400) * 2 * CASE, 0.5);
    assert.ok(h >= precedent - 1e-9, 'le profil ne redescend pas');
    assert.ok(h - precedent < 0.2, `marche trop franche : ${h - precedent}`);
    precedent = h;
  }
});

test('le repli d’une case dit si elle est bâtie, et les six terrains bâtis y sont', () => {
  const g: GrilleTerrain = {
    largeur: 8,
    hauteur: 1,
    terrainDe: (x): CleTerrain => (
      ['ville', 'qg', 'usine', 'aeroport', 'radar', 'port', 'plaine', 'montagne'] as const)[x] ?? 'plaine',
  };
  for (let x = 0; x < 6; x += 1) assert.equal(repliCase(g, x, 0), 0.5, `case ${x} bâtie`);
  assert.equal(repliCase(g, 6, 0), REPLI_CENTRE);
  assert.equal(repliCase(g, 7, 0), REPLI_CENTRE);
  // Les six terrains capturables du jeu, et eux seuls : un pont ou une route
  // n'a pas de socle à protéger. Le port en est un : son quai fait 0,86 case de
  // côté, il déborde du disque plat du centre comme les autres.
  assert.deepEqual([...TERRAINS_BATIS].sort(), ['aeroport', 'port', 'qg', 'radar', 'usine', 'ville']);
});
