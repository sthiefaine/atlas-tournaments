/** Lecture bornée de PNG 8 bits, sans moteur graphique ni dépendance native. */
import { inflateSync } from 'node:zlib';
export interface PixelsPng { largeur: number; hauteur: number; rgba: Uint8Array }
const TABLE_CRC = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let b = 0; b < 8; b++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crcPng(donnees: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of donnees) c = TABLE_CRC[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function lirePng(octets: Uint8Array): PixelsPng {
  const b = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength);
  if (b.length < 33 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('signature PNG absente');
  let largeur = 0, hauteur = 0, canaux = 0, couleur = -1, fin = false;
  const morceaux: Buffer[] = [];
  let palette: Buffer | undefined, alpha: Buffer | undefined;
  for (let p = 8; p < b.length;) {
    if (p + 12 > b.length) throw new Error('morceau PNG tronqué');
    const n = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), debut = p + 8;
    if (debut + n + 4 > b.length || crcPng(b.subarray(p + 4, debut + n)) !== b.readUInt32BE(debut + n)) throw new Error('longueur ou CRC PNG invalide');
    if (p === 8 && type !== 'IHDR') throw new Error('IHDR absent');
    if (type === 'IHDR') {
      if (largeur || n !== 13) throw new Error('IHDR invalide');
      largeur = b.readUInt32BE(debut); hauteur = b.readUInt32BE(debut + 4); couleur = b[debut + 9]!;
      canaux = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[couleur] ?? 0;
      if (!largeur || !hauteur || largeur > 4096 || hauteur > 4096 || b[debut + 8] !== 8 || !canaux
        || b[debut + 10] !== 0 || b[debut + 11] !== 0 || b[debut + 12] !== 0) throw new Error('PNG attendu : 8 bits, non entrelacé, au plus 4096 px');
    } else if (type === 'IDAT') morceaux.push(b.subarray(debut, debut + n));
    else if (type === 'PLTE') palette = b.subarray(debut, debut + n);
    else if (type === 'tRNS') alpha = b.subarray(debut, debut + n);
    else if (type === 'acTL') throw new Error('PNG animé non admis');
    else if (type === 'IEND') { fin = n === 0 && debut + 4 === b.length; break; }
    p = debut + n + 4;
  }
  if (!fin || !morceaux.length) throw new Error('fin ou pixels PNG absents');
  const pas = largeur * canaux, taille = (pas + 1) * hauteur;
  const brut = inflateSync(Buffer.concat(morceaux), { maxOutputLength: taille });
  if (brut.length !== taille) throw new Error('longueur des pixels PNG invalide');
  const pixels = new Uint8Array(pas * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const f = brut[y * (pas + 1)]!;
    if (f > 4) throw new Error('filtre PNG inconnu');
    for (let x = 0; x < pas; x++) {
      const i = y * pas + x, a = x >= canaux ? pixels[i - canaux]! : 0, h = y ? pixels[i - pas]! : 0;
      const c = y && x >= canaux ? pixels[i - pas - canaux]! : 0;
      const p = a + h - c, da = Math.abs(p - a), dh = Math.abs(p - h), dc = Math.abs(p - c);
      const prediction = f === 0 ? 0 : f === 1 ? a : f === 2 ? h : f === 3 ? Math.floor((a + h) / 2) : da <= dh && da <= dc ? a : dh <= dc ? h : c;
      pixels[i] = (brut[y * (pas + 1) + x + 1]! + prediction) & 255;
    }
  }
  const rgba = new Uint8Array(largeur * hauteur * 4);
  for (let i = 0; i < largeur * hauteur; i++) {
    const s = i * canaux, d = i * 4;
    if (couleur === 3) {
      const k = pixels[s]!;
      if (!palette || k * 3 + 2 >= palette.length) throw new Error('index de palette invalide');
      rgba.set(palette.subarray(k * 3, k * 3 + 3), d); rgba[d + 3] = alpha?.[k] ?? 255;
    } else {
      rgba[d] = pixels[s]!; rgba[d + 1] = pixels[s + (canaux >= 3 ? 1 : 0)]!;
      rgba[d + 2] = pixels[s + (canaux >= 3 ? 2 : 0)]!;
      rgba[d + 3] = couleur === 4 || couleur === 6 ? pixels[s + canaux - 1]! : 255;
      if (alpha && couleur === 0 && alpha.length === 2 && pixels[s] === alpha.readUInt16BE(0)) rgba[d + 3] = 0;
      if (alpha && couleur === 2 && alpha.length === 6 && [0, 1, 2].every((j) => pixels[s + j] === alpha.readUInt16BE(j * 2))) rgba[d + 3] = 0;
    }
  }
  return { largeur, hauteur, rgba };
}
