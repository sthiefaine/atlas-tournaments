// Les images cuites qui ont perdu des faces : le contrôle, sur des mesures
// construites à la main, puis sur toutes les unités cuites du jeu — une
// cuisson du drone intercepteur avait rendu, à partir de sa 22e image, le
// dessus d'équipe sans masque, et une autre toute une vue de profil noire,
// sans qu'aucun contrôle le voie (24 septembre 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import type { ManifesteSprites } from '../../src/render2d/contrat';
import {
  SEUILS_ANOMALIE, anomaliesAnimation, anomaliesAnimations, anomaliesEntree, decrireAnomalie, mediane, mesurerImage, type MesureImage,
} from '../../scripts/sprites/anomalies';

const image = (opaques: number, partMasque: number, clarte = 150): MesureImage => ({ opaques, partMasque, clarte });

test('la médiane est celle de Python : la moyenne des deux du milieu pour un compte pair', () => {
  assert.equal(mediane([3, 1, 2]), 2);
  assert.equal(mediane([4, 1, 3, 2]), 2.5);
  assert.equal(mediane([]), 0);
});

test('une image se mesure sur ses pixels opaques : leur nombre, leur part de masque, leur luminance', () => {
  // Quatre pixels RVBA : blanc opaque sous le masque, noir opaque, un rouge à l'alpha 128 (il faut le dépasser), un vide.
  const page = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 200, 255, 0, 0, 128, 0, 0, 0, 0]);
  const masque = [255, 0, 255, 0];
  const m = mesurerImage(4, page, (i) => i * 4, (i) => masque[i]!);
  assert.equal(m.opaques, 2);
  assert.equal(m.partMasque, 0.5);
  assert.equal(m.clarte, (255 + 0) / 2);
});

test('dans une animation, une image qui perd un cinquième de sa silhouette ou les deux cinquièmes de son équipe est une alerte', () => {
  const saines = [image(1000, 0.45), image(1010, 0.46), image(990, 0.44), image(1005, 0.45)];
  assert.deepEqual(anomaliesAnimation('droite', 'tir', saines), []);
  const percee = [...saines, image(700, 0.45)];
  assert.deepEqual(anomaliesAnimation('droite', 'tir', percee).map((a) => [a.image, a.motif]), [[4, 'silhouette']]);
  const deteinte = [...saines, image(1000, 0.2)];
  assert.deepEqual(anomaliesAnimation('droite', 'tir', deteinte).map((a) => [a.image, a.motif]), [[4, 'masque']]);
  // Sous 0,2 de masque médian, la part de masque ne dit rien : une unité presque sans équipe varie beaucoup.
  assert.deepEqual(anomaliesAnimation('droite', 'tir', [image(1000, 0.15), image(1000, 0.05), image(1000, 0.14)]), []);
});

test('une animation entière qui perd son équipe, ou sa lumière, se voit contre les autres animations de l’entrée', () => {
  const saine = (vue: string, clip: string, masque: number, clarte = 150) => ({ vue, clip, mesures: [0, 1, 2].map(() => image(1000, masque, clarte)) });
  const entree = [saine('droite', 'repos', 0.45), saine('droite', 'tir', 0.44), saine('bas', 'deplacement', 0.3), saine('profil', 'repos', 0.4)];
  assert.deepEqual(anomaliesAnimations(entree), []);
  // Le drone intercepteur : toutes les animations d'après la 22e image sans masque — leur propre médiane tombe avec elles.
  const perdue = [...entree, saine('haut', 'deplacement', 0.0), saine('profil', 'tir', 0.0)];
  const a = anomaliesAnimations(perdue);
  assert.deepEqual(a.map((x) => [x.vue, x.clip, x.motif, x.image]), [['haut', 'deplacement', 'animation', null], ['profil', 'tir', 'animation', null]]);
  assert.match(decrireAnomalie(a[0]!), /toute l'animation : masque médian 0\.00 pour 0\.45/);
  // Le chasseur : une vue de profil noire, silhouette et masque intacts.
  const noire = [...entree, saine('profil', 'tir', 0.4, 60)];
  assert.deepEqual(anomaliesAnimations(noire).map((x) => [x.clip, x.motif]), [['tir', 'clarte']]);
  assert.equal(SEUILS_ANOMALIE.clarte, 0.6);
});

test('aucune unité cuite du jeu n’a perdu de faces', async () => {
  const racine = 'public/assets/sprites';
  const chemin = `${racine}/manifeste.json`;
  if (!existsSync(chemin)) return;
  const manifeste = JSON.parse(readFileSync(chemin, 'utf8')) as ManifesteSprites;
  const unites = Object.values(manifeste.entrees).filter((e) => e.famille === 'unite');
  assert.ok(unites.length > 0, 'le manifeste porte des unités');
  const alertes: string[] = [];
  for (const e of unites) for (const a of await anomaliesEntree(racine, 'unite', e.id)) alertes.push(`${e.id} ${decrireAnomalie(a)}`);
  assert.deepEqual(alertes, []);
});
