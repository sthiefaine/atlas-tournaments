/**
 * Encodeur PNG minimal, sans dépendance native : `zlib` de Node pour la
 * compression, une table CRC-32 pour les segments. Il ne sert qu'à l'aperçu de
 * relecture des cartes (`scripts/apercu-carte.ts`) — le rendu du jeu, lui, est
 * du Canvas 2D vectoriel (`02-architecture.md` §3.4).
 *
 * Format produit : PNG truecolor 8 bits (type 2, RVB), une image sans canal
 * alpha, filtre 0 sur chaque ligne. C'est le plus court chemin entre un tableau
 * d'octets et un fichier que n'importe quelle visionneuse ouvre.
 *
 * Ce sous-dossier n'importe que `schemas/` et `content/`, et ne touche pas au DOM.
 */

import { deflateSync } from 'node:zlib';

/** Image en mémoire : trois octets par pixel, lignes du haut vers le bas. */
export interface Image {
  largeur: number;
  hauteur: number;
  /** `largeur × hauteur × 3` octets, dans l'ordre R, V, B. */
  pixels: Uint8Array;
}

/** Couleur RVB, composantes de 0 à 255. */
export type Rvb = readonly [number, number, number];

/** Lit une couleur `#rrggbb` en composantes RVB. */
export function couleurHex(hex: string): Rvb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Crée une image unie. */
export function creerImage(largeur: number, hauteur: number, fond: Rvb): Image {
  const pixels = new Uint8Array(largeur * hauteur * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = fond[0];
    pixels[i + 1] = fond[1];
    pixels[i + 2] = fond[2];
  }
  return { largeur, hauteur, pixels };
}

/** Peint un pixel, en silence s'il tombe hors de l'image. */
export function pixel(image: Image, x: number, y: number, couleur: Rvb): void {
  if (x < 0 || y < 0 || x >= image.largeur || y >= image.hauteur) return;
  const i = (y * image.largeur + x) * 3;
  image.pixels[i] = couleur[0];
  image.pixels[i + 1] = couleur[1];
  image.pixels[i + 2] = couleur[2];
}

/** Peint un rectangle plein. */
export function rectangle(
  image: Image, x: number, y: number, largeur: number, hauteur: number, couleur: Rvb,
): void {
  for (let dy = 0; dy < hauteur; dy += 1) {
    for (let dx = 0; dx < largeur; dx += 1) pixel(image, x + dx, y + dy, couleur);
  }
}

/** Peint un disque plein. */
export function disque(image: Image, cx: number, cy: number, rayon: number, couleur: Rvb): void {
  const r2 = rayon * rayon;
  for (let dy = -rayon; dy <= rayon; dy += 1) {
    for (let dx = -rayon; dx <= rayon; dx += 1) {
      if (dx * dx + dy * dy <= r2) pixel(image, cx + dx, cy + dy, couleur);
    }
  }
}

/** Peint un triangle isocèle pointe en haut, base de `largeur` cases. */
export function triangle(
  image: Image, cx: number, bas: number, largeur: number, hauteur: number, couleur: Rvb,
): void {
  for (let ligne = 0; ligne < hauteur; ligne += 1) {
    const demi = Math.round((largeur / 2) * (ligne / Math.max(1, hauteur - 1)));
    for (let dx = -demi; dx <= demi; dx += 1) pixel(image, cx + dx, bas - hauteur + 1 + ligne, couleur);
  }
}

// ---------------------------------------------------------------------------
// Encodage
// ---------------------------------------------------------------------------

const TABLE_CRC = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (polynôme PNG) d'une suite d'octets. */
export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i += 1) {
    c = ((TABLE_CRC[(c ^ (octets[i] as number)) & 0xff] as number) ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Écrit un entier 32 bits gros-boutiste. */
function ecrire32(valeur: number): Uint8Array {
  return Uint8Array.from([
    (valeur >>> 24) & 255, (valeur >>> 16) & 255, (valeur >>> 8) & 255, valeur & 255,
  ]);
}

/** Assemble un segment PNG : longueur, type, données, CRC. */
function segment(type: string, donnees: Uint8Array): Uint8Array {
  const nom = Uint8Array.from([...type].map((c) => c.charCodeAt(0)));
  const corps = new Uint8Array(nom.length + donnees.length);
  corps.set(nom, 0);
  corps.set(donnees, nom.length);
  const sortie = new Uint8Array(4 + corps.length + 4);
  sortie.set(ecrire32(donnees.length), 0);
  sortie.set(corps, 4);
  sortie.set(ecrire32(crc32(corps)), 4 + corps.length);
  return sortie;
}

/** Signature d'un fichier PNG. */
export const SIGNATURE_PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Encode une image en PNG. Les lignes sont préfixées du filtre 0 (aucun) puis
 * compressées d'un bloc : `zlib.inflateSync` sur les données IDAT rend
 * exactement ces lignes, ce que le test de l'encodeur vérifie.
 */
export function encoderPng(image: Image): Uint8Array {
  const brut = new Uint8Array(image.hauteur * (1 + image.largeur * 3));
  for (let y = 0; y < image.hauteur; y += 1) {
    const depart = y * (1 + image.largeur * 3);
    brut[depart] = 0;
    brut.set(
      image.pixels.subarray(y * image.largeur * 3, (y + 1) * image.largeur * 3),
      depart + 1,
    );
  }
  const entete = new Uint8Array(13);
  entete.set(ecrire32(image.largeur), 0);
  entete.set(ecrire32(image.hauteur), 4);
  entete[8] = 8;   // profondeur : 8 bits par composante
  entete[9] = 2;   // type couleur : truecolor RVB
  entete[10] = 0;  // compression : deflate
  entete[11] = 0;  // filtrage : adaptatif standard
  entete[12] = 0;  // entrelacement : aucun

  const morceaux = [
    SIGNATURE_PNG,
    segment('IHDR', entete),
    segment('IDAT', new Uint8Array(deflateSync(brut, { level: 9 }))),
    segment('IEND', new Uint8Array(0)),
  ];
  const taille = morceaux.reduce((n, m) => n + m.length, 0);
  const fichier = new Uint8Array(taille);
  let offset = 0;
  for (const m of morceaux) { fichier.set(m, offset); offset += m.length; }
  return fichier;
}
