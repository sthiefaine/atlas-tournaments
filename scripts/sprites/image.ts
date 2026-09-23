/**
 * De l'image rendue à quatre fois la taille à l'image livrée. Pur : ni fichier
 * ni `sharp` ici, des tableaux — c'est ce qui permet de le tester sur des
 * images construites à la main.
 *
 * La réduction est une **moyenne exacte** des 4 × 4 pixels rendus, faite en
 * lumière linéaire et sur des valeurs prémultipliées : c'est ce que ferait un
 * rendu à l'échelle 1 avec seize fois plus d'échantillons sur une grille
 * régulière. `sharp.resize` ne le garantit pas — son noyau et le `gap` de
 * libvips mélangent réduction par boîte et filtre —, et moyenner des valeurs
 * sRGB assombrit les bords contrastés. `sharp` ne sert donc qu'à encoder.
 *
 * Trois règles, et chacune évite un défaut connu :
 * 1. la couleur se moyenne **prémultipliée** : un bord à moitié couvert garde
 *    sa couleur au lieu de virer au noir du fond transparent ;
 * 2. le masque se divise par la **couverture du modèle**, pas par l'alpha :
 *    l'alpha compte aussi l'ombre au sol, qui n'a pas de masque ;
 * 3. l'émission reste prémultipliée par la couverture : c'est une lumière
 *    qu'on **ajoute**, un bord à moitié couvert en ajoute la moitié.
 */

/** La fonction sRGB par morceaux : la vue « Standard » de Blender. */
export function lineaireVersSrgb(x: number): number {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/** L'inverse exact de `lineaireVersSrgb`. */
export function srgbVersLineaire(s: number): number {
  if (!(s > 0)) return 0;
  if (s >= 1) return 1;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Une image telle que Blender l'écrit : entiers de 16 bits, canaux entrelacés, ligne du haut d'abord. */
export interface ImageBrute {
  largeur: number;
  hauteur: number;
  canaux: readonly string[];
  donnees: Uint16Array;
}

/** La même, réduite : moyennes dans [0, 1]. */
export interface ImageReduite {
  largeur: number;
  hauteur: number;
  canaux: readonly string[];
  donnees: Float32Array;
}

/** Moyenne exacte des blocs `facteur × facteur`, canal par canal. */
export function reduire(brute: ImageBrute, facteur: number): ImageReduite {
  const { largeur: L, hauteur: H, canaux } = brute;
  if (L % facteur !== 0 || H % facteur !== 0) throw new Error(`image ${L}×${H} non divisible par ${facteur}`);
  const c = canaux.length;
  const l = L / facteur;
  const h = H / facteur;
  const somme = new Float64Array(l * c);
  const donnees = new Float32Array(l * h * c);
  const norme = 1 / (facteur * facteur * 65535);
  for (let y = 0; y < h; y++) {
    somme.fill(0);
    for (let fy = 0; fy < facteur; fy++) {
      let i = (y * facteur + fy) * L * c;
      for (let x = 0; x < l; x++) {
        const base = x * c;
        for (let fx = 0; fx < facteur; fx++) {
          for (let k = 0; k < c; k++) somme[base + k]! += brute.donnees[i + k]!;
          i += c;
        }
      }
    }
    const ligne = y * l * c;
    for (let j = 0; j < l * c; j++) donnees[ligne + j] = somme[j]! * norme;
  }
  return { largeur: l, hauteur: h, canaux, donnees };
}

/** Les calques livrés, à l'échelle 1, sur tout le canevas. */
export interface Calques {
  largeur: number;
  hauteur: number;
  /** RVBA, 8 bits, alpha non prémultiplié, couleur encodée sRGB. */
  couleur: Uint8Array;
  /** Masque d'équipe, 8 bits ; `null` sans masque. */
  masque: Uint8Array | null;
  /** Lumière propre, RVB 8 bits encodé sRGB, prémultipliée par la couverture ; `null` sans émission. */
  emission: Uint8Array | null;
  /** Couverture du modèle, 8 bits : ce qui n'est pas de l'ombre. */
  couverture: Uint8Array;
}

function index(canaux: readonly string[], nom: string): number {
  return canaux.indexOf(nom);
}

/**
 * Passe une image réduite en calques de 8 bits. Là où le modèle n'est pas —
 * une ombre cuite —, `seuilOmbre` efface ce qui est plus faible que lui (sur
 * 255), et `fonduOmbre` fait descendre l'ombre à zéro sur autant de pixels
 * avant le bord du canevas : l'occlusion du ciel d'un bâtiment assombrit le
 * sol à plus d'un mètre, aucun canevas ne la contient toute, et une ombre
 * coupée net dessinerait un trait droit sur l'herbe.
 */
export function versCalques(
  r: ImageReduite,
  options: { masque: boolean; emission: boolean; seuilOmbre: number; fonduOmbre?: number },
): Calques {
  const { largeur, hauteur, canaux, donnees } = r;
  const c = canaux.length;
  const [iR, iG, iB, iA] = ['r', 'g', 'b', 'a'].map((n) => index(canaux, n));
  const iM = index(canaux, 'masque');
  const iC = index(canaux, 'couverture');
  const iE = ['er', 'eg', 'eb'].map((n) => index(canaux, n));
  if ([iR, iG, iB, iA, iC].some((i) => i === undefined || i < 0)) throw new Error('canaux de couleur ou de couverture absents');
  const avecMasque = options.masque && iM >= 0;
  const avecEmission = options.emission && iE.every((i) => i !== undefined && i >= 0);
  const n = largeur * hauteur;
  const couleur = new Uint8Array(n * 4);
  const masque = avecMasque ? new Uint8Array(n) : null;
  const emission = avecEmission ? new Uint8Array(n * 3) : null;
  const couverture = new Uint8Array(n);
  const fondu = options.fonduOmbre ?? 0;
  for (let p = 0; p < n; p++) {
    const o = p * c;
    const a = donnees[o + iA!]!;
    const cov = donnees[o + iC!]!;
    let a8 = Math.round(Math.min(1, a) * 255);
    const cov8 = Math.round(Math.min(1, cov) * 255);
    if (cov8 === 0 && fondu > 0 && a8 > 0) {
      const x = p % largeur;
      const y = (p - x) / largeur;
      const bord = Math.min(x, y, largeur - 1 - x, hauteur - 1 - y);
      if (bord < fondu) a8 = Math.round((a8 * bord) / fondu);
    }
    if (cov8 === 0 && a8 < options.seuilOmbre) a8 = 0;
    couverture[p] = cov8;
    if (a8 > 0) {
      couleur[p * 4] = Math.round(lineaireVersSrgb(donnees[o + iR!]! / a) * 255);
      couleur[p * 4 + 1] = Math.round(lineaireVersSrgb(donnees[o + iG!]! / a) * 255);
      couleur[p * 4 + 2] = Math.round(lineaireVersSrgb(donnees[o + iB!]! / a) * 255);
      couleur[p * 4 + 3] = a8;
    }
    if (masque && cov > 1e-6 && a8 > 0) masque[p] = Math.round(Math.min(1, donnees[o + iM]! / cov) * 255);
    if (emission && a8 > 0) {
      for (let k = 0; k < 3; k++) emission[p * 3 + k] = Math.round(lineaireVersSrgb(donnees[o + iE[k]!]!) * 255);
    }
  }
  return { largeur, hauteur, couleur, masque, emission, couverture };
}

/** Un rectangle, en pixels. */
export interface Rectangle { x: number; y: number; l: number; h: number }

/**
 * L'enveloppe des pixels visibles (alpha non nul), agrandie de `bordure` et
 * bornée au canevas ; `null` pour une image vide. `touche` dit si un pixel
 * visible est sur le bord du canevas : le canevas était trop juste, et
 * l'image est coupée.
 */
export function emprise(c: Calques, bordure: number): { rect: Rectangle; touche: boolean } | null {
  const { largeur, hauteur, couleur } = c;
  let x0 = largeur;
  let y0 = hauteur;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (couleur[(y * largeur + x) * 4 + 3]! === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const touche = x0 === 0 || y0 === 0 || x1 === largeur - 1 || y1 === hauteur - 1;
  const gx = Math.max(0, x0 - bordure);
  const gy = Math.max(0, y0 - bordure);
  const dx = Math.min(largeur - 1, x1 + bordure);
  const dy = Math.min(hauteur - 1, y1 + bordure);
  return { rect: { x: gx, y: gy, l: dx - gx + 1, h: dy - gy + 1 }, touche };
}

/** Une image découpée dans des calques : ce qui part dans une page. */
export interface Decoupe {
  l: number;
  h: number;
  couleur: Uint8Array;
  masque: Uint8Array | null;
  emission: Uint8Array | null;
}

/** Découpe `rect` dans des calques. */
export function decouper(c: Calques, rect: Rectangle): Decoupe {
  const { l, h } = rect;
  const couleur = new Uint8Array(l * h * 4);
  const masque = c.masque ? new Uint8Array(l * h) : null;
  const emission = c.emission ? new Uint8Array(l * h * 3) : null;
  for (let y = 0; y < h; y++) {
    const source = (rect.y + y) * c.largeur + rect.x;
    couleur.set(c.couleur.subarray(source * 4, (source + l) * 4), y * l * 4);
    if (masque) masque.set(c.masque!.subarray(source, source + l), y * l);
    if (emission) emission.set(c.emission!.subarray(source * 3, (source + l) * 3), y * l * 3);
  }
  return { l, h, couleur, masque, emission };
}

/**
 * Étend la couleur des pixels visibles sur leurs voisins transparents, `passes`
 * fois, sans toucher l'alpha. Un rendu qui filtre une texture non prémultipliée
 * mélange au bord la couleur des pixels transparents : noire, elle ferait un
 * liseré sombre ; étendue, elle ne se voit pas.
 */
export function etendreCouleur(d: Decoupe, passes: number): void {
  const { l, h, couleur } = d;
  const connu = new Uint8Array(l * h);
  for (let p = 0; p < l * h; p++) connu[p] = couleur[p * 4 + 3]! > 0 ? 1 : 0;
  for (let passe = 0; passe < passes; passe++) {
    const neufs: [number, number, number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        const p = y * l + x;
        if (connu[p]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= l || yy >= h) continue;
            const q = yy * l + xx;
            if (!connu[q]) continue;
            r += couleur[q * 4]!;
            g += couleur[q * 4 + 1]!;
            b += couleur[q * 4 + 2]!;
            n++;
          }
        }
        if (n > 0) neufs.push([p, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
      }
    }
    for (const [p, r, g, b] of neufs) {
      couleur[p * 4] = r;
      couleur[p * 4 + 1] = g;
      couleur[p * 4 + 2] = b;
      connu[p] = 1;
    }
  }
}

/**
 * Une empreinte de découpe, pour trouver vite deux images identiques : elles
 * partageront leur rectangle. Deux FNV-1a de 32 bits (couleur, puis masque et
 * émission) ; une empreinte commune ne suffit jamais, `memesDecoupes` compare
 * ensuite octet pour octet.
 */
export function signature(d: Decoupe): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < d.couleur.length; i++) {
    h1 ^= d.couleur[i]!;
    h1 = Math.imul(h1, 0x01000193);
  }
  let h2 = 0x811c9dc5;
  for (const t of [d.masque, d.emission]) {
    if (!t) continue;
    for (let i = 0; i < t.length; i++) {
      h2 ^= t[i]!;
      h2 = Math.imul(h2, 0x01000193);
    }
  }
  return `${d.l}x${d.h}:${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}`;
}

/** Vrai si deux découpes sont identiques octet pour octet. */
export function memesDecoupes(a: Decoupe, b: Decoupe): boolean {
  const egaux = (x: Uint8Array | null, y: Uint8Array | null): boolean => {
    if (x === null || y === null) return x === y;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  };
  return a.l === b.l && a.h === b.h && egaux(a.couleur, b.couleur) && egaux(a.masque, b.masque) && egaux(a.emission, b.emission);
}
