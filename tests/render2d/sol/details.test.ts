// Les textures de détail du sol : onze couches synthétisées, bouclables et
// déterministes. Une couture se verrait des dizaines de fois sur la carte ; un
// octet qui change d'un chargement à l'autre ferait scintiller le sol.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bruitValeur, COUCHES_DETAIL, couchesDetail, oublierCouches, rangCouche, voronoi,
} from '../../../src/render2d/sol/details';

const TAILLE = 64;

/** L'écart moyen entre deux colonnes (ou deux lignes) d'une couche, sur un canal. */
function ecart(octets: Uint8Array, couche: number, taille: number, canal: number, a: number, b: number, colonnes: boolean): number {
  const base = couche * taille * taille * 4;
  let total = 0;
  for (let k = 0; k < taille; k += 1) {
    const ia = colonnes ? k * taille + a : a * taille + k;
    const ib = colonnes ? k * taille + b : b * taille + k;
    total += Math.abs((octets[base + ia * 4 + canal] ?? 0) - (octets[base + ib * 4 + canal] ?? 0));
  }
  return total / taille;
}

test('les bruits bouclent : le dernier texel rejoint le premier comme deux voisins', () => {
  const b = bruitValeur(TAILLE, 8, 4, 17);
  let bord = 0;
  let voisins = 0;
  for (let y = 0; y < TAILLE; y += 1) {
    bord += Math.abs(b[y * TAILLE]! - b[y * TAILLE + TAILLE - 1]!);
    voisins += Math.abs(b[y * TAILLE + 10]! - b[y * TAILLE + 11]!);
  }
  assert.ok(bord < voisins * 3 + 0.5, `couture horizontale : ${bord} contre ${voisins}`);
  const v = voronoi(TAILLE, 6, 3);
  // Le pavage boucle : la distance au germe le plus proche est continue à travers le bord.
  let saut = 0;
  for (let y = 0; y < TAILLE; y += 1) saut = Math.max(saut, Math.abs(v.f1[y * TAILLE]! - v.f1[y * TAILLE + TAILLE - 1]!));
  assert.ok(saut < 0.25, `saut de Voronoï au bord : ${saut}`);
});

test('chaque couche boucle, sur ses deux axes', () => {
  oublierCouches();
  const octets = couchesDetail('plaine', 'printemps', TAILLE);
  assert.equal(octets.length, TAILLE * TAILLE * 4 * COUCHES_DETAIL.length);
  for (const couche of COUCHES_DETAIL) {
    const r = rangCouche(couche);
    for (const canal of [0, 1]) {
      for (const colonnes of [true, false]) {
        const couture = ecart(octets, r, TAILLE, canal, 0, TAILLE - 1, colonnes);
        // La référence : l'écart moyen entre deux voisins ordinaires de la couche.
        let reference = 0;
        for (let k = 1; k < TAILLE - 2; k += 1) reference += ecart(octets, r, TAILLE, canal, k, k + 1, colonnes);
        reference /= TAILLE - 3;
        assert.ok(
          couture <= reference * 2.5 + 3,
          `${couche}, canal ${canal}, ${colonnes ? 'colonnes' : 'lignes'} : couture ${couture.toFixed(1)} contre ${reference.toFixed(1)}`,
        );
      }
    }
  }
});

test('la synthèse est déterministe, et mémorisée', () => {
  oublierCouches();
  const a = couchesDetail('desert', 'ete', TAILLE);
  oublierCouches();
  const b = couchesDetail('desert', 'ete', TAILLE);
  assert.notEqual(a, b, 'deux synthèses, deux tableaux');
  assert.deepEqual(a, b, 'mêmes octets, au bit près');
  assert.equal(couchesDetail('desert', 'ete', TAILLE), b, 'la même clé rend le même tableau');
});

test('la saison et le biome changent les motifs, pas seulement les couleurs', () => {
  oublierCouches();
  const herbe = rangCouche('herbe');
  const n = TAILLE * TAILLE * 4;
  const accent = (o: Uint8Array): number => {
    let s = 0;
    for (let i = herbe * n + 2; i < (herbe + 1) * n; i += 4) s += o[i]!;
    return s;
  };
  const printemps = couchesDetail('plaine', 'printemps', TAILLE);
  const automne = couchesDetail('plaine', 'automne', TAILLE);
  assert.notEqual(accent(printemps), accent(automne), 'les fleurs ne sont pas les feuilles');
  const sable = rangCouche('sable');
  const relief = (o: Uint8Array): number => {
    let s = 0;
    for (let i = sable * n + 1; i < (sable + 1) * n; i += 4) s += Math.abs(o[i]! - o[i + 4 * TAILLE]!);
    return s;
  };
  assert.ok(relief(couchesDetail('desert', 'ete', TAILLE)) > relief(couchesDetail('plaine', 'ete', TAILLE)),
    'les rides du désert sont plus marquées');
});

test('une taille qui n’est pas une puissance de deux est refusée', () => {
  oublierCouches();
  assert.throws(() => couchesDetail('plaine', 'ete', 100), /puissance de deux/);
});

test('la synthèse complète à 256², mesurée', () => {
  oublierCouches();
  const t0 = performance.now();
  const octets = couchesDetail('plaine', 'automne');
  const ms = performance.now() - t0;
  assert.equal(octets.length, 256 * 256 * 4 * COUCHES_DETAIL.length);
  // Une mesure, pas un seuil : la machine est partagée, un seuil de durée y
  // rougirait sans que le code ait changé (`CLAUDE.md`, le zombie de sept heures).
  console.log(`# synthèse des couches de détail à 256² : ${ms.toFixed(0)} ms`);
});
