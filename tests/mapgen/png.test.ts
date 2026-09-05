// L'encodeur PNG d'aperçu : un fichier relu par `zlib.inflateSync`, aux bonnes
// dimensions, sans dépendance native. Le test refait le décodage à la main, ce
// qui vérifie du même coup la signature, l'en-tête IHDR et les CRC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { genererCarte } from '../../src/mapgen/index';
import {
  SIGNATURE_PNG, crc32, creerImage, encoderPng, rasteriserCarte, rectangle, TUILE,
} from '../../src/render/apercu/index';
import type { ParametresCarte } from '../../src/schemas/types';

/** Segments d'un fichier PNG, dans l'ordre, CRC vérifié. */
function segments(fichier: Uint8Array): { type: string; donnees: Uint8Array }[] {
  assert.deepEqual([...fichier.slice(0, 8)], [...SIGNATURE_PNG], 'signature PNG');
  const lus: { type: string; donnees: Uint8Array }[] = [];
  let i = 8;
  while (i < fichier.length) {
    const vue = new DataView(fichier.buffer, fichier.byteOffset + i, 8);
    const taille = vue.getUint32(0);
    const type = String.fromCharCode(...fichier.slice(i + 4, i + 8));
    const donnees = fichier.slice(i + 8, i + 8 + taille);
    const attendu = new DataView(fichier.buffer, fichier.byteOffset + i + 8 + taille, 4).getUint32(0);
    assert.equal(crc32(fichier.slice(i + 4, i + 8 + taille)), attendu, `CRC du segment ${type}`);
    lus.push({ type, donnees });
    i += 12 + taille;
  }
  return lus;
}

/** Décode un PNG produit ici : lignes brutes filtre 0, RVB 8 bits. */
function decoder(fichier: Uint8Array): { largeur: number; hauteur: number; pixels: Uint8Array } {
  const lus = segments(fichier);
  assert.deepEqual(lus.map((s) => s.type), ['IHDR', 'IDAT', 'IEND']);
  const entete = lus[0]?.donnees as Uint8Array;
  const vue = new DataView(entete.buffer, entete.byteOffset, entete.byteLength);
  const largeur = vue.getUint32(0);
  const hauteur = vue.getUint32(4);
  assert.equal(entete[8], 8, 'profondeur de 8 bits');
  assert.equal(entete[9], 2, 'truecolor RVB');
  assert.equal(entete[10], 0, 'compression deflate');
  assert.equal(entete[12], 0, 'sans entrelacement');

  const brut = new Uint8Array(inflateSync(Buffer.from(lus[1]?.donnees as Uint8Array)));
  assert.equal(brut.length, hauteur * (1 + largeur * 3), 'longueur des lignes brutes');
  const pixels = new Uint8Array(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    const depart = y * (1 + largeur * 3);
    assert.equal(brut[depart], 0, `filtre de la ligne ${y}`);
    pixels.set(brut.subarray(depart + 1, depart + 1 + largeur * 3), y * largeur * 3);
  }
  return { largeur, hauteur, pixels };
}

test('l\'encodeur produit un PNG relu par inflateSync, pixel pour pixel', () => {
  const image = creerImage(7, 5, [10, 20, 30]);
  rectangle(image, 2, 1, 3, 2, [255, 128, 0]);
  const relue = decoder(encoderPng(image));
  assert.equal(relue.largeur, 7);
  assert.equal(relue.hauteur, 5);
  assert.deepEqual([...relue.pixels], [...image.pixels]);
  // Le rectangle est bien là où il a été peint.
  const i = (1 * 7 + 2) * 3;
  assert.deepEqual([relue.pixels[i], relue.pixels[i + 1], relue.pixels[i + 2]], [255, 128, 0]);
});

test('une image d\'un seul pixel reste un PNG valide', () => {
  const relue = decoder(encoderPng(creerImage(1, 1, [1, 2, 3])));
  assert.deepEqual([...relue.pixels], [1, 2, 3]);
});

const parametres: ParametresCarte = {
  largeur: 16,
  hauteur: 12,
  camps: 2,
  biome: 'cotier',
  ratioMer: 0.3,
  ratioRelief: 0.2,
  villesParCamp: 3,
  villesNeutres: 2,
  usinesParCamp: 1,
  aeroportsParCamp: 0,
  symetrie: 'aucune',
  densiteRoutes: 0.5,
};

test('le rasteriseur rend 16 px par tuile, aux dimensions de la carte', () => {
  const carte = genererCarte(parametres, 7);
  const image = rasteriserCarte(carte);
  assert.equal(TUILE, 16);
  assert.equal(image.largeur, carte.largeur * 16);
  assert.equal(image.hauteur, carte.hauteur * 16);
  assert.equal(image.pixels.length, image.largeur * image.hauteur * 3);

  const relue = decoder(encoderPng(image));
  assert.equal(relue.largeur, 256);
  assert.equal(relue.hauteur, 192);
  assert.deepEqual([...relue.pixels], [...image.pixels]);
});

test('le rendu est déterministe et suit la taille de tuile demandée', () => {
  const carte = genererCarte(parametres, 7);
  const a = encoderPng(rasteriserCarte(carte));
  const b = encoderPng(rasteriserCarte(carte));
  assert.deepEqual([...a], [...b]);
  const grande = rasteriserCarte(carte, { tuile: 24 });
  assert.equal(grande.largeur, carte.largeur * 24);
});

test('les couleurs des camps se retrouvent dans l\'image', () => {
  const carte = genererCarte(parametres, 7);
  const image = rasteriserCarte(carte, { grille: false });
  const presente = (r: number, v: number, b: number): boolean => {
    for (let i = 0; i < image.pixels.length; i += 3) {
      if (image.pixels[i] === r && image.pixels[i + 1] === v && image.pixels[i + 2] === b) return true;
    }
    return false;
  };
  assert.ok(presente(0x57, 0xb0, 0xea), 'eau #57b0ea');
  assert.ok(presente(0xa3, 0xd9, 0x6b), 'herbe #a3d96b');
  assert.ok(presente(0x3f, 0x86, 0xe0), 'camp 0 #3f86e0');
  assert.ok(presente(0xe0, 0x4b, 0x45), 'camp 1 #e04b45');
});
