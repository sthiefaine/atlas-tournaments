import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { BIOMES, type CleTerrain } from '../../src/schemas/types';
import {
  albedoMatiere, bruitFractal, jeuMatiere, jeuToit, normalesDepuis, normalesDonnees, oublierToiles,
  reliefToit, sorteToit, toilesEnMemoire,
} from '../../src/render3d/textures';
import { creerPlateau, tranchesToilesPlateau } from '../../src/render3d/terrain';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
import { parametresAmbiance } from '../../src/render3d/eclairage';

/** Toile mémoire : les recettes restent vérifiables sans navigateur/WebGL. */
function documentMemoire(): Document {
  return {
    createElement: () => {
      const canvas = {
        width: 0, height: 0, pixels: new Uint8ClampedArray() as Uint8ClampedArray,
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (image: { data: Uint8ClampedArray }) => { canvas.pixels = image.data; },
        }),
      };
      return canvas;
    },
  } as unknown as Document;
}

function pixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return (canvas as unknown as { pixels: Uint8ClampedArray }).pixels;
}

test('chaque biome possède une palette végétale distincte et reproductible', () => {
  const doc = documentMemoire();
  const palettes = BIOMES.map((biome) => {
    const a = albedoMatiere(doc, 'herbe', 32, biome);
    const b = albedoMatiere(doc, 'herbe', 32, biome);
    assert.deepEqual(pixels(a.canvas), pixels(b.canvas));
    assert.deepEqual(a.hauteur, b.hauteur);
    assert.ok(a.hauteur.every(Number.isFinite));
    return pixels(a.canvas).join(',');
  });
  assert.equal(new Set(palettes).size, BIOMES.length);
});

test('les normales produites restent valides, y compris sur les frontières répétées', () => {
  const doc = documentMemoire();
  for (const matiere of ['herbe', 'terre', 'roche', 'sable', 'neige'] as const) {
    const a = albedoMatiere(doc, matiere, 32);
    const normal = pixels(normalesDepuis(doc, a.hauteur, 32));
    for (let i = 0; i < normal.length; i += 4) {
      assert.equal(normal[i + 3], 255);
      assert.ok(normal[i + 2]! >= 128, 'la normale pointe au-dessus du terrain');
    }
  }
});

test('le plateau de chaque biome accepte les saisons et libère ses ressources', () => {
  const doc = documentMemoire();
  for (const biome of BIOMES) {
    const plateau = creerPlateau({ largeur: 2, hauteur: 2, terrainDe: (x) => x === 0 ? 'plage' : 'mer' }, doc, biome);
    plateau.appliquerAmbiance(parametresAmbiance('hiver', 'nuit', 'neige'));
    assert.equal(plateau.avancer(16), false);
    let texturesLiberees = 0;
    const material = plateau.sol.material as THREE.MeshStandardNodeMaterial;
    material.map?.addEventListener('dispose', () => { texturesLiberees += 1; });
    plateau.dispose();
    assert.equal(texturesLiberees, 1);
  }
});

// ---------------------------------------------------------------------------
// `majTerrain` face à un changement de carte
// ---------------------------------------------------------------------------

test('le plateau accepte une carte d’une autre taille sans déborder sa splat', () => {
  const doc = documentMemoire();
  const grille = (largeur: number, hauteur: number, terrain: CleTerrain): GrilleTerrain => ({
    largeur, hauteur, terrainDe: (): CleTerrain => terrain,
  });
  const plateau = creerPlateau(grille(16, 12, 'plaine'), doc);
  const sommets = (): number => plateau.sol.geometry.getAttribute('position').count;
  const depart = sommets();

  // Même taille : le chemin habituel, celui d'une marée ou d'un chantier du
  // génie. La géométrie est conservée, seules les altitudes glissent.
  plateau.majTerrain(grille(16, 12, 'montagne'));
  assert.equal(sommets(), depart);
  assert.ok(plateau.hauteurEn(8.5, 6.5) > 0.5, 'la montagne doit lever le sol');

  // Taille différente : c'est ce que fait l'atelier en changeant de monde sans
  // démonter la scène. Écrire la nouvelle splat dans l'ancienne texture levait
  // un RangeError qui blanchissait la page — elle doit être remplacée.
  assert.doesNotThrow(() => plateau.majTerrain(grille(20, 12, 'mer')));
  assert.ok(sommets() > depart, 'une carte plus large demande plus de sommets');
  assert.ok(plateau.hauteurEn(10.5, 6.5) < 0, 'la mer doit creuser le sol');

  // Et dans l'autre sens, une carte plus petite.
  assert.doesNotThrow(() => plateau.majTerrain(grille(12, 10, 'plaine')));
  assert.ok(sommets() < depart, 'une carte plus étroite en demande moins');
  assert.equal(plateau.hauteurEn(6.5, 5.5), 0);
});

// ---------------------------------------------------------------------------
// Les couvertures des toits
// ---------------------------------------------------------------------------

const SORTES = ['tuile', 'ardoise', 'tole'] as const;

test('une couverture est déterministe, en relief, discrète, et de la taille demandée', () => {
  for (const sorte of SORTES) {
    const a = reliefToit(sorte, 32);
    const b = reliefToit(sorte, 32);
    assert.deepEqual(a.hauteur, b.hauteur, `${sorte} : même relief à chaque appel`);
    assert.deepEqual(a.albedo, b.albedo, `${sorte} : même albédo à chaque appel`);
    assert.equal(a.hauteur.length, 32 * 32);
    assert.ok(a.hauteur.every((h) => Number.isFinite(h) && h >= 0 && h <= 1));
    // Non plat : la variance du champ de hauteur est franche.
    const moyenne = a.hauteur.reduce((s, h) => s + h, 0) / a.hauteur.length;
    const variance = a.hauteur.reduce((s, h) => s + (h - moyenne) ** 2, 0) / a.hauteur.length;
    assert.ok(variance > 0.002, `${sorte} : relief plat (variance ${variance})`);
    // L'albédo est discret : un gris entre 0,7 et 1, opaque, à peine teinté.
    // La couleur vient du style régional, pas de la texture.
    for (let i = 0; i < a.albedo.length; i += 4) {
      assert.ok(a.albedo[i + 1]! >= Math.floor(0.7 * 255) && a.albedo[i + 1]! <= 255, `${sorte} : clarté ${a.albedo[i + 1]}`);
      assert.ok(Math.abs(a.albedo[i]! - a.albedo[i + 2]!) <= 14, `${sorte} : trop teinté`);
      assert.equal(a.albedo[i + 3], 255);
    }

    const jeu = jeuToit(sorte, 32);
    assert.equal(jeu.sorte, sorte);
    assert.equal(jeu.albedo.image.width, 32);
    assert.equal(jeu.normales.image.height, 32);
    assert.equal(jeu.albedo.colorSpace, THREE.SRGBColorSpace);
    assert.equal(jeu.normales.colorSpace, THREE.NoColorSpace);
    assert.equal(jeu.albedo.wrapS, THREE.RepeatWrapping);
    assert.equal(jeu.normales.wrapT, THREE.RepeatWrapping);
    assert.ok(jeu.normales.generateMipmaps, 'un motif répété quatre fois par case scintillerait sans mipmaps');
    // Des normales valides et non plates : elles pointent hors du toit, et
    // plus d'un texel sur quatre s'écarte de la verticale.
    const donnees = jeu.normales.image.data as Uint8Array;
    assert.equal(donnees.length, 32 * 32 * 4);
    let ecarts = 0;
    for (let i = 0; i < donnees.length; i += 4) {
      assert.ok(donnees[i + 2]! >= 128, 'la normale pointe hors du toit');
      assert.equal(donnees[i + 3], 255);
      if (donnees[i] !== 128 || donnees[i + 1] !== 128) ecarts += 1;
    }
    assert.ok(ecarts > (donnees.length / 4) / 4, `${sorte} : normales plates (${ecarts} écarts)`);
    // Deux jeux, mêmes octets : c'est la promesse de déterminisme, jusqu'à la texture.
    const bis = jeuToit(sorte, 32);
    assert.deepEqual([...(bis.normales.image.data as Uint8Array)], [...donnees]);
    bis.dispose();
    let liberees = 0;
    jeu.albedo.addEventListener('dispose', () => { liberees += 1; });
    jeu.normales.addEventListener('dispose', () => { liberees += 1; });
    jeu.dispose();
    assert.equal(liberees, 2, 'le jeu libère ses deux textures');
  }
});

test('les trois couvertures se distinguent, et la matière du style choisit la sienne', () => {
  const champs = SORTES.map((s) => reliefToit(s, 32).hauteur.join(','));
  assert.equal(new Set(champs).size, 3, 'trois motifs, pas un seul sous trois noms');
  assert.equal(sorteToit('tuile'), 'tuile');
  assert.equal(sorteToit('terre_cuite'), 'tuile', 'ce qui se cuit va à la tuile');
  assert.equal(sorteToit('ardoise'), 'ardoise');
  assert.equal(sorteToit('tole_ondulee'), 'tole');
  assert.equal(sorteToit('cuivre'), 'tole', 'ce qui se plie va à la tôle');
  assert.equal(sorteToit('bois'), 'ardoise', 'ce qui se pose en plaques va à l’ardoise');
  assert.equal(sorteToit('pierre_seche'), 'ardoise');
  assert.equal(sorteToit(null), 'ardoise', 'sans style, l’ardoise');
  assert.equal(sorteToit(undefined), 'ardoise');
});

test('normalesDonnees et normalesDepuis rendent les mêmes octets : le sol n’a pas changé', () => {
  const doc = documentMemoire();
  const { hauteur } = albedoMatiere(doc, 'roche', 32);
  assert.deepEqual([...pixels(normalesDepuis(doc, hauteur, 32, 2.6))], [...normalesDonnees(hauteur, 32, 2.6)]);
});

// ---------------------------------------------------------------------------
// Ce que la vitesse ne doit pas changer, et ce que la mémoire doit gagner
// ---------------------------------------------------------------------------
//
// Les boucles de synthèse ont été réécrites le 8 septembre 2026 pour que le
// premier montage d'une page cesse de geler le fil principal (`10-rendu-3d.md`
// §9.6). Une texture procédurale n'a pas de valeur de vérité : la seule garantie
// qui vaille est qu'elle n'a pas **changé**. Ces tests la tiennent en rejouant
// la formule d'origine — celle d'avant l'optimisation — et en comparant octet
// par octet.

/** `bruitFractal` tel qu'il était : bilinéaire en une passe, quatre lectures par pixel. */
function bruitFractalOrigine(taille: number, octaves: number, periodeBase: number, graine: number): Float32Array {
  const adoucir = (t: number): number => t * t * (3 - 2 * t);
  const rng = (g: number): (() => number) => {
    let e = g >>> 0;
    return (): number => {
      e = (e + 0x6d2b79f5) >>> 0;
      let t = Math.imul(e ^ (e >>> 15), 1 | e);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
  };
  const bruit = (periode: number, g: number): Float32Array => {
    const alea = rng(g);
    const grille = new Float32Array(periode * periode);
    for (let i = 0; i < grille.length; i += 1) grille[i] = alea();
    const sortie = new Float32Array(taille * taille);
    const pas = periode / taille;
    for (let y = 0; y < taille; y += 1) {
      const fy = y * pas;
      const y0 = Math.floor(fy) % periode;
      const y1 = (y0 + 1) % periode;
      const ty = adoucir(fy - Math.floor(fy));
      for (let x = 0; x < taille; x += 1) {
        const fx = x * pas;
        const x0 = Math.floor(fx) % periode;
        const x1 = (x0 + 1) % periode;
        const tx = adoucir(fx - Math.floor(fx));
        const a = grille[y0 * periode + x0]! + (grille[y0 * periode + x1]! - grille[y0 * periode + x0]!) * tx;
        const b = grille[y1 * periode + x0]! + (grille[y1 * periode + x1]! - grille[y1 * periode + x0]!) * tx;
        sortie[y * taille + x] = a + (b - a) * ty;
      }
    }
    return sortie;
  };
  const sortie = new Float32Array(taille * taille);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const couche = bruit(Math.max(2, Math.round(periodeBase * 2 ** o)), graine + o * 7919);
    for (let i = 0; i < sortie.length; i += 1) sortie[i] = sortie[i]! + couche[i]! * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < sortie.length; i += 1) sortie[i] = sortie[i]! / total;
  return sortie;
}

/** `normalesDonnees` tel qu'il était : une fermeture à deux modulos et `Math.hypot`. */
function normalesOrigine(hauteur: Float32Array, taille: number, force: number): Uint8ClampedArray {
  const donnees = new Uint8ClampedArray(taille * taille * 4);
  const h = (x: number, y: number): number => hauteur[(((y % taille) + taille) % taille) * taille
    + (((x % taille) + taille) % taille)] ?? 0;
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * force;
      const dy = (h(x, y + 1) - h(x, y - 1)) * force;
      const l = Math.hypot(dx, dy, 1);
      const j = (y * taille + x) * 4;
      donnees[j] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      donnees[j + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      donnees[j + 2] = Math.round((1 / l) * 0.5 * 255 + 127);
      donnees[j + 3] = 255;
    }
  }
  return donnees;
}

test('le bruit en deux passes rend exactement le même champ qu’en une', () => {
  // Les tailles et périodes réellement demandées par les matières et par l'eau.
  for (const [taille, octaves, periode, graine] of [
    [64, 2, 6, 11], [64, 3, 8, 112], [64, 2, 10, 222], [128, 3, 5, 907], [128, 4, 6, 4111],
  ] as const) {
    assert.deepEqual(
      [...bruitFractal(taille, octaves, periode, graine)],
      [...bruitFractalOrigine(taille, octaves, periode, graine)],
      `bruit ${taille}/${octaves}/${periode}`,
    );
  }
});

test('les normales par tables rendent exactement les mêmes octets qu’avec hypot', () => {
  const doc = documentMemoire();
  for (const matiere of ['herbe', 'roche', 'neige'] as const) {
    const { hauteur } = albedoMatiere(doc, matiere, 64);
    for (const force of [1.25, 2.6, 1.5, 2.2]) {
      assert.deepEqual(
        [...normalesDonnees(hauteur, 64, force)],
        [...normalesOrigine(hauteur, 64, force)],
        `${matiere} à ${force}`,
      );
    }
  }
});

test('une matière n’est peinte qu’une fois par document, et jamais partagée entre deux', () => {
  const doc = documentMemoire();
  oublierToiles(doc);
  const avant = toilesEnMemoire(doc);
  const a = jeuMatiere(doc, 'herbe', 32, 'foret');
  const apresUn = toilesEnMemoire(doc);
  const b = jeuMatiere(doc, 'herbe', 32, 'foret');
  assert.equal(toilesEnMemoire(doc), apresUn, 'la seconde demande ne peint rien');
  assert.equal(apresUn - avant, 2, 'une matière tient en deux toiles : albédo et normales');
  // Les pixels sont partagés, les textures non : chaque plateau libère les
  // siennes sans emporter celles du montage suivant.
  assert.equal(a.albedo.image, b.albedo.image, 'même toile');
  assert.notEqual(a.albedo, b.albedo, 'texture propre');
  a.albedo.dispose();
  a.normales.dispose();
  b.albedo.dispose();
  b.normales.dispose();
  // Un autre document ne lit pas les toiles du premier : un canvas appartient au sien.
  const autre = documentMemoire();
  assert.equal(toilesEnMemoire(autre), 0);
  jeuMatiere(autre, 'herbe', 32, 'foret');
  assert.equal(toilesEnMemoire(autre), 2);
});

test('les tranches préparent exactement ce que creerPlateau demande', () => {
  // C'est le garde-fou de la seule copie possible : `tranchesToilesPlateau` et
  // `creerPlateau` lisent la même liste de matières. Si l'une demandait une
  // toile que l'autre ne prépare pas, le compte monterait après coup — et le
  // premier montage repeindrait ce qu'il croyait déjà peint.
  for (const biome of ['plaine', 'archipel'] as const) {
    const doc = documentMemoire();
    for (const tranche of tranchesToilesPlateau(doc, biome)) tranche();
    const prepare = toilesEnMemoire(doc);
    assert.ok(prepare > 0, 'les tranches peignent quelque chose');
    const plateau = creerPlateau({ largeur: 3, hauteur: 3, terrainDe: () => 'plaine' }, doc, biome);
    assert.equal(toilesEnMemoire(doc), prepare, `${biome} : le plateau ne peint plus rien`);
    plateau.dispose();
  }
});
