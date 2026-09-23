// Le manifeste des images cuites, tel qu'il est livré sous `public/` : sa
// forme, ce qu'il couvre du catalogue, et qu'il dit vrai sur le disque. Ce test
// lit les fichiers produits par `npm run cuire:sprites -- --tout` ; il n'exige
// pas Blender.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  CLIPS, PIXELS_PAR_CASE, TANGAGE_CARTE, TANGAGE_PROFIL, VERSION_SPRITES, idBatiment, idUnite,
  type ClipSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';
import { documentGlb, empreinte, lireDocument } from '../../scripts/sprites/glb';
import { cheminPage, composerManifeste, lireEntrees, problemesManifeste } from '../../scripts/sprites/manifeste';
import { RACINE_SORTIE } from '../../scripts/sprites/reglages';

const manifeste = JSON.parse(readFileSync(join(RACINE_SORTIE, 'manifeste.json'), 'utf8')) as ManifesteSprites;
const unites = (JSON.parse(readFileSync('content/unites.json', 'utf8')) as { unites: { cle: string; domaine: string }[] }).unites;

/** Ce que le GLB source d'une entrée porte : ses clips, son masque, son émission. */
function source(id: string) {
  const e = manifeste.entrees[id]!;
  return lireDocument(documentGlb(new Uint8Array(readFileSync(e.source.fichier))));
}

test('le manifeste suit le contrat : version et projection', () => {
  assert.equal(manifeste.version, VERSION_SPRITES);
  assert.equal(manifeste.pixelsParCase, PIXELS_PAR_CASE);
  assert.equal(manifeste.tangage, TANGAGE_CARTE);
  assert.equal(manifeste.tangageProfil, TANGAGE_PROFIL);
});

test('le manifeste est celui des fichiers d’entrée, rien de plus', () => {
  assert.deepEqual(manifeste, composerManifeste(lireEntrees(RACINE_SORTIE)));
});

test('chaque page existe à la taille dite, et chaque image tient dans sa page', async () => {
  const tailles = new Map<string, { largeur: number; hauteur: number }>();
  for (const e of Object.values(manifeste.entrees)) {
    for (const p of e.pages) {
      for (const c of [p.couleur, p.masque, p.emission]) {
        if (c === undefined) continue;
        const m = await sharp(cheminPage(RACINE_SORTIE, c)).metadata();
        tailles.set(c, { largeur: m.width ?? 0, hauteur: m.height ?? 0 });
      }
    }
  }
  assert.deepEqual(problemesManifeste(manifeste, (c) => tailles.get(c) ?? null), []);
});

test('chaque unité du catalogue est cuite, avec exactement les clips que son GLB porte', () => {
  assert.equal(unites.length, 30);
  for (const { cle } of unites) {
    const id = idUnite(cle);
    const e = manifeste.entrees[id];
    assert.ok(e, `${id} absente`);
    assert.equal(e.famille, 'unite');
    assert.equal(e.cle, cle);
    const clips = new Set(source(id).clips.map((c) => c.nom));
    const garder = (voulus: readonly ClipSprite[]) => voulus.filter((c) => clips.has(c));
    const marche = garder(['deplacement']).length > 0 ? ['deplacement'] : garder(['repos']);
    const attendues = [
      ...garder(CLIPS).map((c) => `droite/${c}`),
      ...marche.map((c) => `bas/${c}`),
      ...marche.map((c) => `haut/${c}`),
      ...garder(['repos', 'tir', 'touche', 'hors_jeu']).map((c) => `profil/${c}`),
    ].sort();
    assert.deepEqual(e.animations.map((a) => `${a.vue}/${a.clip}`).sort(), attendues, id);
    assert.ok(attendues.includes('droite/deplacement') && attendues.includes('bas/deplacement') && attendues.includes('haut/deplacement'), id);
    for (const a of e.animations) {
      assert.equal(a.boucle, a.clip === 'repos' || a.clip === 'deplacement', `${id} ${a.vue}/${a.clip}`);
      assert.ok(a.cadres.length >= 1 && a.ips > 0);
    }
  }
});

test('les bâtiments, les rochers et le pont sont cuits dans leurs vues', () => {
  for (const cle of ['ville', 'usine', 'aeroport', 'port', 'radar', 'qg']) {
    const e = manifeste.entrees[idBatiment(cle)];
    assert.ok(e, idBatiment(cle));
    assert.equal(e.famille, 'batiment');
    assert.ok(e.animations.some((a) => a.vue === 'fixe' && a.clip === 'repos'), idBatiment(cle));
    assert.ok(e.animations.every((a) => a.vue === 'fixe'));
  }
  for (const pays of ['fr', 'lu']) assert.equal(manifeste.entrees[idBatiment('qg', pays)]?.variante, pays);
  for (const id of ['decor_rocher_archipel', 'decor_rocher_cotier']) {
    assert.deepEqual(manifeste.entrees[id]?.animations.map((a) => `${a.vue}/${a.clip}/${a.cadres.length}`), ['fixe/repos/1'], id);
  }
  assert.deepEqual(manifeste.entrees['terrain_pont']?.animations.map((a) => a.vue), ['fixe', 'travers']);
});

test('chaque entrée a été cuite depuis la source présente : même empreinte', () => {
  for (const e of Object.values(manifeste.entrees)) {
    assert.equal(e.source.sha256, empreinte(new Uint8Array(readFileSync(e.source.fichier))), `${e.id} : source changée, à recuire`);
  }
});

test('une entrée à masque a une page de masque non vide, une entrée sans masque n’en a pas', async () => {
  for (const e of Object.values(manifeste.entrees)) {
    const aUnMasque = source(e.id).uriMasque !== null;
    for (const p of e.pages) assert.equal(p.masque !== undefined, aUnMasque, e.id);
    if (!aUnMasque) continue;
    let allumes = 0;
    for (const p of e.pages) {
      const { data } = await sharp(cheminPage(RACINE_SORTIE, p.masque!)).greyscale().raw().toBuffer({ resolveWithObject: true });
      for (const v of data) if (v > 127) allumes++;
    }
    assert.ok(allumes > 20, `${e.id} : masque de ${allumes} pixels`);
  }
  for (const { cle } of unites) assert.ok(manifeste.entrees[idUnite(cle)]!.pages.every((p) => p.masque), cle);
});

test('le masque n’est pas la couverture : le char léger et l’infanterie ne sont teints qu’en partie', async () => {
  // Une page de masque pleine dirait que la passe lue n'est pas la bonne
  // (c'est arrivé : la combinée relue sous le nom du masque). Depuis la charte
  // des figurines (23 septembre 2026), la couleur d'équipe couvre 40 à 60 %
  // d'une unité, jamais toute sa silhouette — ni le contour, ni le graphite.
  for (const cle of ['char_leger', 'infanterie']) {
    const e = manifeste.entrees[idUnite(cle)]!;
    const c = e.animations.find((a) => a.vue === 'droite' && a.clip === 'repos')!.cadres[0]!;
    const page = e.pages[c.page]!;
    const couleur = await sharp(cheminPage(RACINE_SORTIE, page.couleur)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const masque = await sharp(cheminPage(RACINE_SORTIE, page.masque!)).greyscale().raw().toBuffer();
    let visibles = 0;
    let teints = 0;
    for (let y = c.y; y < c.y + c.h; y++) {
      for (let x = c.x; x < c.x + c.l; x++) {
        const i = y * couleur.info.width + x;
        if (couleur.data[i * 4 + 3]! < 128) continue;
        visibles++;
        if (masque[i]! > 127) teints++;
      }
    }
    assert.ok(teints > 0.01 * visibles && teints < 0.8 * visibles, `${cle} : ${teints} pixels teints sur ${visibles}`);
  }
});

test('un bâtiment dont un matériau émet a sa page d’émission ; une unité n’en a jamais', () => {
  for (const e of Object.values(manifeste.entrees)) {
    const attendue = e.famille === 'batiment' && source(e.id).emission;
    for (const p of e.pages) assert.equal(p.emission !== undefined, attendue, e.id);
  }
  assert.ok(Object.values(manifeste.entrees).some((e) => e.pages.some((p) => p.emission)), 'aucune page d’émission');
});

test('le pied d’une unité au sol est dans son image, au centre de sa largeur', () => {
  for (const { cle, domaine } of unites) {
    const e = manifeste.entrees[idUnite(cle)]!;
    for (const a of e.animations) {
      if (a.vue === 'profil') continue;
      const c = a.cadres[0]!;
      assert.ok(Math.abs(c.px - c.l / 2) < 0.3 * c.l, `${cle} ${a.vue} : pivot ${c.px} pour ${c.l} de large`);
      if (domaine !== 'air') assert.ok(c.py > 0 && c.py < c.h, `${cle} ${a.vue} : pivot ${c.py} pour ${c.h} de haut`);
    }
  }
});

test('l’ensemble tient sous 40 Mo', () => {
  const taille = (d: string): number => readdirSync(d, { withFileTypes: true })
    .reduce((s, f) => s + (f.isDirectory() ? taille(join(d, f.name)) : statSync(join(d, f.name)).size), 0);
  assert.ok(taille(RACINE_SORTIE) < 40 * 1024 * 1024, `${(taille(RACINE_SORTIE) / 1024 / 1024).toFixed(1)} Mo`);
});
