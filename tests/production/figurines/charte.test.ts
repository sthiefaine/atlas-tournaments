// La charte des figurines et l'atlas qu'elle peint : les valeurs arrêtées le
// 23 septembre 2026, la règle des cases (partagée avec `bibliotheque.py`), un
// masque d'équipe binaire, et des cartes que le contrôle du dépôt accepte.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARTE, caseAtlas, couleurTeinte, indiceTeinte, limiteReflet, peindreAtlas, pngAtlas, teintePermise, type Charte,
} from '../../../scripts/production/figurines/charte';
import { pngsDuLot } from '../../../scripts/production/figurines/lot';
import { controlerTextures } from '../../../src/serveur/controle-textures';
import type { AssetSpec } from '../../../src/assets/spec';
import ficheCharLeger from '../../../assets/specs/unite_char_leger_base.json';

/** La couleur d'un pixel d'une image RVB. */
function pixel(image: { largeur: number; pixels: Uint8Array }, x: number, y: number): number[] {
  const i = (y * image.largeur + x) * 3;
  return [image.pixels[i]!, image.pixels[i + 1]!, image.pixels[i + 2]!];
}

test('la palette est celle arrêtée par le coordinateur', () => {
  const hex = (nom: string) => CHARTE.teintes.find((t) => t.nom === nom)?.hex;
  assert.equal(hex('graphite'), '#30343b');
  assert.equal(hex('caoutchouc'), '#222428');
  assert.equal(hex('os'), '#d8d0bf');
  assert.equal(hex('acier_clair'), '#aab0b7');
  assert.equal(hex('verre'), '#22313b');
  assert.equal(hex('feux'), '#f3ead2');
  assert.equal(hex('appret'), '#8b9097');
  assert.equal(hex('orange'), '#f0761e');
  assert.equal(CHARTE.contour.hex, '#15181d');
  assert.equal(CHARTE.contour.epaisseurEchelle4, 12);
  assert.deepEqual(CHARTE.contour.opacite, { unite: 1, batiment: 0.85, terrain: 0.85, decor: 0.6 });
  // Métallicité nulle partout : c'est de la peinture. Laque 0,35 sur l'équipe.
  assert.ok(CHARTE.teintes.every((t) => t.metal === 0));
  assert.equal(CHARTE.teintes.find((t) => t.equipe)?.rugosite, 0.35);
  assert.equal(CHARTE.budget.triangles, 60000);
});

test('les teintes sont uniques, tiennent dans l’atlas, et les réservées le restent', () => {
  const noms = CHARTE.teintes.map((t) => t.nom);
  assert.equal(new Set(noms).size, noms.length);
  assert.ok(noms.length <= CHARTE.atlas.colonnes * CHARTE.atlas.lignes);
  assert.ok(CHARTE.teintes.every((t) => /^#[0-9a-f]{6}$/.test(t.hex)));
  // L'équipe est la première case : ajouter une teinte en fin de liste ne déplace aucun modèle.
  assert.equal(indiceTeinte(CHARTE, 'equipe'), 0);
  const orange = CHARTE.teintes.find((t) => t.nom === 'orange')!;
  assert.ok(teintePermise(orange, 'meridien_bastion'));
  assert.ok(!teintePermise(orange, 'char_leger'), 'aucune unité nationale n’a d’orange');
  assert.ok(!teintePermise(CHARTE.teintes.find((t) => t.nom === 'appret')!, 'char_leger'), 'ni de gris moyen');
  assert.ok(!teintePermise(CHARTE.teintes.find((t) => t.nom === 'enduit')!, 'meridien_bastion'), 'les teintes de bâtiment ne vont pas aux unités');
  assert.ok(teintePermise(CHARTE.teintes.find((t) => t.nom === 'peau_meca')!, 'meca'));
  assert.ok(!teintePermise(CHARTE.teintes.find((t) => t.nom === 'peau_meca')!, 'infanterie'), 'une peau par fantassin');
});

test('chaque teinte remplit sa case, dans le rectangle utile que la bibliothèque vise', () => {
  const n = 512;
  const albedo = peindreAtlas(CHARTE, 'albedo', n);
  const { colonnes, lignes, remplissage } = CHARTE.atlas;
  const marge = (1 - remplissage) / 2;
  CHARTE.teintes.forEach((t, i) => {
    // La règle de `bibliotheque.py` (`Charte.case`), recopiée : UV glTF, v vers le bas.
    const col = i % colonnes;
    const lig = Math.floor(i / colonnes);
    const u0 = (col + marge) / colonnes;
    const u1 = (col + 1 - marge) / colonnes;
    const v0 = (lig + marge) / lignes;
    const v1 = (lig + 1 - marge) / lignes;
    const attendue = t.equipe ? [255, 255, 255] : [...couleurTeinte(CHARTE, t)];
    const bas = Math.floor(v1 * n) - 1;
    assert.deepEqual(pixel(albedo, Math.floor(u0 * n), bas), attendue, `${t.nom}, coin bas-gauche`);
    assert.deepEqual(pixel(albedo, Math.floor(u1 * n) - 1, bas), attendue, `${t.nom}, coin bas-droit`);
    if (!t.reflet) assert.deepEqual(pixel(albedo, Math.floor(u0 * n), Math.floor(v0 * n)), attendue, `${t.nom}, coin haut`);
    else {
      // Le reflet peint : le tiers haut de la zone utile — la bibliothèque y envoie le haut de chaque pièce.
      const c = caseAtlas(CHARTE, i, n);
      const limite = c.y0 + limiteReflet(CHARTE, t.reflet.part, c.y1 - c.y0);
      assert.deepEqual(pixel(albedo, Math.floor(u0 * n), Math.floor(v0 * n)), [0xcf, 0xe2, 0xec], 'le reflet en haut');
      assert.deepEqual(pixel(albedo, Math.floor(u0 * n), limite), attendue, 'le verre sous le reflet');
      assert.ok(Math.abs((limite - v0 * n) / ((v1 - v0) * n) - t.reflet.part) < 0.02);
    }
  });
  // Une case sans teinte est criarde : une pièce mal dépliée se verrait.
  assert.deepEqual(pixel(albedo, n - 1, n - 1), [255, 0, 255]);
});

test('le masque d’équipe est binaire, blanc sur l’équipe seulement, et l’albédo y est blanc', () => {
  for (const n of [256, 512]) {
    const masque = peindreAtlas(CHARTE, 'masque_equipe', n);
    const albedo = peindreAtlas(CHARTE, 'albedo', n);
    let blancs = 0;
    for (let p = 0; p < n * n; p++) {
      const v = masque.pixels[p * 3]!;
      assert.ok(v === 0 || v === 255);
      if (v === 255) {
        blancs++;
        assert.deepEqual([...albedo.pixels.subarray(p * 3, p * 3 + 3)], [255, 255, 255]);
      }
    }
    assert.equal(blancs, (n / CHARTE.atlas.colonnes) * (n / CHARTE.atlas.lignes), 'une seule case d’équipe');
  }
});

test('rugosité en G, métal en B, normale plate, émission des seules teintes qui émettent', () => {
  const n = 256;
  const rug = peindreAtlas(CHARTE, 'rugosite', n);
  const nor = peindreAtlas(CHARTE, 'normale', n);
  const emi = peindreAtlas(CHARTE, 'emission', n);
  CHARTE.teintes.forEach((t, i) => {
    const c = caseAtlas(CHARTE, i, n);
    const x = Math.floor((c.x0 + c.x1) / 2);
    const y = c.y1 - 2;
    assert.deepEqual(pixel(rug, x, y), [255, Math.round(t.rugosite * 255), 0], t.nom);
    assert.deepEqual(pixel(nor, x, y), [128, 128, 255]);
    assert.deepEqual(pixel(emi, x, y), t.emission ? [...couleurTeinte(CHARTE, t)] : [0, 0, 0], t.nom);
  });
});

test('une saison surcharge ses teintes, et rien d’autre', () => {
  const charte: Charte = { ...CHARTE, saisons: { ...CHARTE.saisons, hiver: { os: '#eeeeee' } } };
  const n = 256;
  const base = peindreAtlas(charte, 'albedo', n);
  const hiver = peindreAtlas(charte, 'albedo', n, 'hiver');
  const c = caseAtlas(charte, indiceTeinte(charte, 'os'), n);
  assert.deepEqual(pixel(hiver, c.x0 + 5, c.y1 - 5), [0xee, 0xee, 0xee]);
  const g = caseAtlas(charte, indiceTeinte(charte, 'graphite'), n);
  assert.deepEqual(pixel(hiver, g.x0 + 5, g.y1 - 5), pixel(base, g.x0 + 5, g.y1 - 5));
});

test('les PNG sont déterministes, et le contrôle des textures du dépôt les accepte', () => {
  assert.deepEqual(pngAtlas(CHARTE, 'albedo', 256), pngAtlas(CHARTE, 'albedo', 256));
  // La fiche du char léger, aux petites résolutions : les mêmes règles, plus vite.
  const spec = { ...ficheCharLeger, textures: ficheCharLeger.textures.map((t) => ({ ...t, resolution: 256 })) } as unknown as AssetSpec;
  const canaux = spec.textures.map((t) => t.canal);
  const fichiers = pngsDuLot(spec, CHARTE, canaux);
  assert.equal(fichiers.size, canaux.length * 2, 'chaque canal, et sa variante d’hiver');
  assert.deepEqual(controlerTextures(spec, fichiers), []);
});
