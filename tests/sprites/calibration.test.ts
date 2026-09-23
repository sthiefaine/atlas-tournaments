// La preuve par la mesure que la caméra de cuisson est celle du contrat, que
// la lumière rend les clartés visées et qu'elle est symétrique, et que le
// contour cerne sans déplacer : des modèles de calibration cuits par la vraie
// chaîne (`scripts/sprites/calibration/`), dont on mesure les images. Ce test
// lit les fichiers produits, il n'exige pas Blender ; pour les refaire :
//   npx tsx scripts/sprites/calibration/generer.ts
//   npm run cuire:sprites -- --liste scripts/sprites/calibration/liste.json --sortie tests/sprites/calibration --force
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  ECLAIRAGE_CUISSON, LACET_VUE, PIXELS_PAR_CASE, TANGAGE_CARTE, TANGAGE_PROFIL, VERSION_SPRITES,
  type AnimationSprite, type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import { ARETE_LUMIERE, HAUTEUR_BARRE, REPERES } from '../../scripts/sprites/calibration/generer';
import { cheminPage, problemesManifeste, type FichierEntree } from '../../scripts/sprites/manifeste';
import { CLARTES_VISEES, clarteFace } from '../../scripts/sprites/reglages';
import charte from '../../scripts/production/figurines/charte.json';

const RACINE = join(__dirname, 'calibration');
const manifeste = JSON.parse(readFileSync(join(RACINE, 'manifeste.json'), 'utf8')) as ManifesteSprites;

interface Pixels { largeur: number; hauteur: number; rgba: Uint8Array }

const pages = new Map<string, Promise<Pixels>>();
function page(chemin: string): Promise<Pixels> {
  let p = pages.get(chemin);
  if (!p) {
    p = sharp(cheminPage(RACINE, chemin)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ largeur: info.width, hauteur: info.height, rgba: new Uint8Array(data) }));
    pages.set(chemin, p);
  }
  return p;
}

/** Les pixels d'un cadre, en coordonnées du cadre (le pivot est en `px`, `py`). */
async function pixelsDe(e: EntreeSprite, a: AnimationSprite): Promise<{ l: number; h: number; px: number; py: number; lire: (x: number, y: number) => [number, number, number, number] }> {
  const c = a.cadres[0]!;
  const p = await page(e.pages[c.page]!.couleur);
  const lire = (x: number, y: number): [number, number, number, number] => {
    const i = ((c.y + y) * p.largeur + (c.x + x)) * 4;
    return [p.rgba[i]!, p.rgba[i + 1]!, p.rgba[i + 2]!, p.rgba[i + 3]!];
  };
  return { l: c.l, h: c.h, px: c.px, py: c.py, lire };
}

/**
 * Où tombe, dans le plan, un point du fichier glTF (x à gauche du modèle, y en
 * haut, z devant), relatif au pivot, pour un lacet et un tangage : la
 * conversion de l'importeur (glTF +Z → Blender −Y), la rotation du lacet
 * autour de la verticale, puis `versPlan`.
 */
function attendu(p: readonly [number, number, number], lacet: number, tangage: number): { X: number; Y: number } {
  const psi = (lacet * Math.PI) / 180;
  const t = (tangage * Math.PI) / 180;
  const [gx, gy, gz] = p;
  const x = gx * Math.cos(psi) + gz * Math.sin(psi);
  const yBlender = gx * Math.sin(psi) - gz * Math.cos(psi);
  // La ligne de la carte descend vers le joueur : elle vaut −y de Blender.
  const yCarte = -yBlender;
  return { X: x * PIXELS_PAR_CASE, Y: (yCarte * Math.sin(t) - gy * Math.cos(t)) * PIXELS_PAR_CASE };
}

test('le manifeste de calibration est bien formé et ses cuissons sans avertissement', () => {
  assert.equal(manifeste.version, VERSION_SPRITES);
  assert.deepEqual(problemesManifeste(manifeste), []);
  const ids = ['calibration_carre', 'calibration_carre_contour', 'calibration_reperes', 'calibration_ombre', 'calibration_lumiere_face', 'calibration_lumiere_biais'];
  assert.deepEqual(Object.keys(manifeste.entrees).sort(), [...ids].sort());
  for (const id of ids) {
    assert.ok(manifeste.entrees[id], id);
    const f = JSON.parse(readFileSync(join(RACINE, 'decors', `${id}.json`), 'utf8')) as FichierEntree;
    assert.deepEqual(f.cuisson.avertissements, [], id);
  }
});

test('un carré de 1 m au sol fait 128 × 98 pixels, centré sur le pivot', async () => {
  const e = manifeste.entrees['calibration_carre']!;
  const { l, h, px, py, lire } = await pixelsDe(e, e.animations[0]!);
  let aire = 0;
  let cx = 0;
  let cy = 0;
  let colonnesPleines = 0;
  let hauteurLignes = 0;
  const maxLigne = new Array<number>(h).fill(0);
  for (let x = 0; x < l; x++) {
    let maxColonne = 0;
    for (let y = 0; y < h; y++) {
      const a = lire(x, y)[3] / 255;
      aire += a;
      cx += a * (x + 0.5);
      cy += a * (y + 0.5);
      maxColonne = Math.max(maxColonne, a);
      maxLigne[y] = Math.max(maxLigne[y]!, a);
    }
    if (maxColonne >= 0.5) colonnesPleines++;
  }
  for (const m of maxLigne) hauteurLignes += m;
  const hauteurAttendue = PIXELS_PAR_CASE * Math.sin((TANGAGE_CARTE * Math.PI) / 180);
  assert.equal(colonnesPleines, PIXELS_PAR_CASE, `largeur ${colonnesPleines}`);
  assert.ok(Math.abs(hauteurLignes - hauteurAttendue) <= 0.25, `hauteur ${hauteurLignes.toFixed(2)} pour ${hauteurAttendue.toFixed(2)}`);
  assert.ok(Math.abs(aire - PIXELS_PAR_CASE * hauteurAttendue) / (PIXELS_PAR_CASE * hauteurAttendue) < 0.0025, `aire ${aire.toFixed(0)}`);
  assert.ok(Math.abs(cx / aire - px) < 0.1 && Math.abs(cy / aire - py) < 0.1, `centre (${(cx / aire).toFixed(2)}, ${(cy / aire).toFixed(2)}) pour le pivot (${px}, ${py})`);
});

/** Le centre d'un repère de couleur dans un cadre, relatif au pivot, pondéré par l'alpha. */
async function centreRepere(e: EntreeSprite, a: AnimationSprite, dominante: 0 | 1 | 2): Promise<{ X: number; Y: number; poids: number }> {
  const { l, h, px, py, lire } = await pixelsDe(e, a);
  let poids = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const v = lire(x, y);
      const autres = [0, 1, 2].filter((k) => k !== dominante).map((k) => v[k]!);
      if (v[3] === 0 || v[dominante]! < 30 || v[dominante]! < 2 * Math.max(...autres)) continue;
      const w = v[3] / 255;
      poids += w;
      sx += w * (x + 0.5);
      sy += w * (y + 0.5);
    }
  }
  return { X: sx / poids - px, Y: sy / poids - py, poids };
}

test('chaque vue tourne le modèle vers son lacet, et la hauteur monte à l’écran', async () => {
  const e = manifeste.entrees['calibration_reperes']!;
  const vues = e.animations.map((a) => a.vue).sort();
  assert.deepEqual(vues, ['bas', 'droite', 'fixe', 'haut', 'profil', 'travers']);
  for (const a of e.animations) {
    const tangage = a.vue === 'profil' ? TANGAGE_PROFIL : TANGAGE_CARTE;
    for (const [nom, dominante] of [['rouge', 0], ['vert', 1], ['bleu', 2]] as const) {
      const m = await centreRepere(e, a, dominante);
      const t = attendu(REPERES[nom], LACET_VUE[a.vue], tangage);
      assert.ok(m.poids > 20, `${a.vue} ${nom} : repère invisible`);
      const ecart = Math.hypot(m.X - t.X, m.Y - t.Y);
      assert.ok(ecart < 0.5, `${a.vue} ${nom} : mesuré (${m.X.toFixed(2)}, ${m.Y.toFixed(2)}), attendu (${t.X.toFixed(2)}, ${t.Y.toFixed(2)})`);
    }
  }
});

test('« droite » regarde la droite de l’écran, « haut » s’éloigne, « bas » vient vers le joueur', async () => {
  const e = manifeste.entrees['calibration_reperes']!;
  const avant = async (vue: string) => centreRepere(e, e.animations.find((a) => a.vue === vue)!, 0);
  const droite = await avant('droite');
  assert.ok(droite.X > 30, `l'avant est à ${droite.X.toFixed(1)} px du pivot`);
  assert.ok((await avant('travers')).X > 40);
  assert.ok((await avant('haut')).Y < -20);
  assert.ok((await avant('bas')).Y > 20);
  // Le repère en l'air est au-dessus du pivot, d'autant plus haut que la vue est rasante.
  const enHaut = async (vue: string) => centreRepere(e, e.animations.find((a) => a.vue === vue)!, 2);
  assert.ok((await enHaut('fixe')).Y < -50);
  assert.ok((await enHaut('profil')).Y < (await enHaut('fixe')).Y);
});

test('l’ombre cuite part à l’opposé de la lumière principale, qui vient du joueur : droit vers le haut', async () => {
  const e = manifeste.entrees['calibration_ombre']!;
  const { l, h, px, py, lire } = await pixelsDe(e, e.animations[0]!);
  let poids = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [r, g, b, a] = lire(x, y);
      // L'ombre est noire et translucide ; la barre, grise et opaque.
      if (a === 0 || a > 240 || Math.max(r, g, b) > 24) continue;
      poids += a / 255;
      sx += (a / 255) * (x + 0.5);
      sy += (a / 255) * (y + 0.5);
    }
  }
  assert.ok(poids > 50, `ombre de ${poids.toFixed(0)} pixels`);
  // La lumière est symétrique : l'ombre ne dérive ni à gauche ni à droite.
  assert.ok(Math.abs(sx / poids - px) < 1, `ombre centrée à ${(sx / poids - px).toFixed(1)} px du pivot`);
  // Elle tombe derrière le point du sol sous la barre, à h / tan(élévation) :
  // droit vers le haut de l'écran.
  const recul = HAUTEUR_BARRE / Math.tan((ECLAIRAGE_CUISSON.principale.elevation * Math.PI) / 180);
  const attenduY = -recul * Math.sin((TANGAGE_CARTE * Math.PI) / 180) * PIXELS_PAR_CASE;
  assert.ok(Math.abs(sy / poids - py - attenduY) < 3, `ombre centrée à ${(sy / poids - py).toFixed(1)} px du pivot, attendue à ${attenduY.toFixed(1)}`);
});

/** La couleur moyenne, sRGB de 0 à 255, d'une fenêtre de 5 × 5 pixels autour du point `p` (glTF) de la vue `fixe`. */
async function fenetre(id: string, p: readonly [number, number, number]): Promise<number[]> {
  const e = manifeste.entrees[id]!;
  const { px, py, lire } = await pixelsDe(e, e.animations[0]!);
  const t = attendu(p, LACET_VUE.fixe, TANGAGE_CARTE);
  const x0 = Math.floor(px + t.X);
  const y0 = Math.floor(py + t.Y);
  const somme = [0, 0, 0, 0];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) lire(x0 + dx, y0 + dy).forEach((v, k) => { somme[k]! += v; });
  return somme.map((v) => v / 25);
}

/** L'inverse de la fonction sRGB, sur un niveau de 0 à 255. */
const lineaire = (s: number): number => (s / 255 <= 0.04045 ? s / 255 / 12.92 : ((s / 255 + 0.055) / 1.055) ** 2.4);

test('la lumière rend un blanc horizontal à 1, la face tournée vers le joueur à 0,68', async () => {
  const a = ARETE_LUMIERE;
  const dessus = await fenetre('calibration_lumiere_face', [0, a, 0]);
  const joueur = await fenetre('calibration_lumiere_face', [0, a / 2, a / 2]);
  assert.ok(dessus.slice(0, 3).every((v) => v >= 253), `dessus ${dessus.map((v) => v.toFixed(0))}`);
  assert.ok(Math.abs(lineaire(joueur[0]!) - CLARTES_VISEES.joueur) < 0.015, `face au joueur ${lineaire(joueur[0]!).toFixed(3)}`);
  assert.equal(joueur[3], 255);
});

test('la lumière est symétrique : les deux faces d’un cube tourné de 45° ont la même clarté', async () => {
  const a = ARETE_LUMIERE;
  const d = (a / 2) * Math.SQRT1_2;
  const gauche = await fenetre('calibration_lumiere_biais', [-d, a / 2, d]);
  const droite = await fenetre('calibration_lumiere_biais', [d, a / 2, d]);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(gauche[k]! - droite[k]!) <= 2, `gauche ${gauche.map((v) => v.toFixed(1))}, droite ${droite.map((v) => v.toFixed(1))}`);
  // Prévu 0,613 pour un blanc lambertien (`clarteFace`) ; le reflet spéculaire du matériau glTF y ajoute un peu.
  const attendue = clarteFace([Math.SQRT1_2, -Math.SQRT1_2, 0]);
  assert.ok(Math.abs(lineaire(gauche[0]!) - attendue) < 0.02, `${lineaire(gauche[0]!).toFixed(3)} pour ${attendue.toFixed(3)}`);
});

test('le contour cerne le carré sur trois pixels, sans le toucher ni déplacer le pivot', async () => {
  const sans = manifeste.entrees['calibration_carre']!;
  const avec = manifeste.entrees['calibration_carre_contour']!;
  const s = await pixelsDe(sans, sans.animations[0]!);
  const c = await pixelsDe(avec, avec.animations[0]!);
  const opacite = charte.contour.opacite.decor;
  // Le carré se retrouve tel quel, au même endroit par rapport au pivot : deux
  // rendus différents ne diffèrent que du bruit de Cycles, quelques niveaux.
  let compares = 0;
  let ecart = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.l; x++) {
      const v = s.lire(x, y);
      if (v[3] < 255) continue;
      const w = c.lire(x - s.px + c.px, y - s.py + c.py);
      assert.equal(w[3], 255, `(${x}, ${y})`);
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(v[k]! - w[k]!) <= 10, `(${x}, ${y}) : ${v} contre ${w}`);
        ecart += Math.abs(v[k]! - w[k]!);
      }
      compares++;
    }
  }
  assert.ok(compares > 12000, `${compares} pixels comparés`);
  assert.ok(ecart / (3 * compares) < 1, `écart moyen ${(ecart / (3 * compares)).toFixed(2)} niveau`);
  // Autour, l'anneau : sombre, à l'opacité de sa famille, trois pixels d'épaisseur au plus.
  const colonne = Math.round(c.px);
  const anneau: number[] = [];
  for (let y = 0; y < c.h; y++) {
    const [r, g, b, a] = c.lire(colonne, y);
    if (a > 0 && Math.max(r, g, b) < 60) anneau.push(a);
  }
  assert.equal(anneau.length, 4, `pixels d'anneau purs dans la colonne du pivot : ${anneau}`);
  for (const a of anneau) assert.ok(Math.abs(a - opacite * 255) <= 3, `alpha d'anneau ${a}`);
  // Le rectangle rogné grandit de l'anneau, et le pivot le suit : il n'a pas bougé sur le modèle.
  assert.equal(c.l - s.l, c.h - s.h);
  assert.equal(c.px - s.px, (c.l - s.l) / 2);
  assert.equal(c.py - s.py, (c.h - s.h) / 2);
  assert.ok(c.l - s.l >= 4 && c.l - s.l <= 6, `le rectangle grandit de ${c.l - s.l}`);
});
