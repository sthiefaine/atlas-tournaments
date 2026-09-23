// La preuve par la mesure que la caméra de cuisson est celle du contrat :
// des modèles de calibration cuits par la vraie chaîne
// (`scripts/sprites/calibration/`), dont on mesure les images. Ce test lit les
// fichiers produits, il n'exige pas Blender ; pour les refaire :
//   npx tsx scripts/sprites/calibration/generer.ts
//   npm run cuire:sprites -- --liste scripts/sprites/calibration/liste.json --sortie tests/sprites/calibration --force
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  LACET_VUE, PIXELS_PAR_CASE, TANGAGE_CARTE, TANGAGE_PROFIL, VERSION_SPRITES,
  type AnimationSprite, type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import { REPERES } from '../../scripts/sprites/calibration/generer';
import { cheminPage, problemesManifeste, type FichierEntree } from '../../scripts/sprites/manifeste';

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
  for (const id of ['calibration_carre', 'calibration_reperes', 'calibration_ombre']) {
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

test('l’ombre cuite part à l’opposé de la lumière principale : vers le haut et la droite', async () => {
  const e = manifeste.entrees['calibration_ombre']!;
  const { l, h, px, py, lire } = await pixelsDe(e, e.animations[0]!);
  let poids = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [r, g, b, a] = lire(x, y);
      // L'ombre est noire et translucide ; le pilier, gris et opaque.
      if (a === 0 || a > 240 || Math.max(r, g, b) > 24) continue;
      poids += a / 255;
      sx += (a / 255) * (x + 0.5);
      sy += (a / 255) * (y + 0.5);
    }
  }
  assert.ok(poids > 50, `ombre de ${poids.toFixed(0)} pixels`);
  assert.ok(sx / poids - px > 5, `ombre centrée à ${(sx / poids - px).toFixed(1)} px du pivot`);
  assert.ok(sy / poids - py < 0, `ombre centrée à ${(sy / poids - py).toFixed(1)} px sous le pivot`);
});
