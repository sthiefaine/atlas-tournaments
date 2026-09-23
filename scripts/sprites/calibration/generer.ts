/**
 * Les modèles de calibration de la cuisson, écrits en GLB sans dépendance :
 *
 *   npx tsx scripts/sprites/calibration/generer.ts
 *   npm run cuire:sprites -- --liste scripts/sprites/calibration/liste.json --sortie tests/sprites/calibration --force
 *
 * Trois modèles, chacun une question à laquelle un test répond en mesurant
 * les images cuites (`tests/sprites/calibration.test.ts`) :
 *
 * - `calibration_carre` : un carré de 1 m × 1 m posé au sol. Son emprise doit
 *   faire 128 × 98 pixels (`PIXELS_PAR_CASE` × `sin 50°`), centrée sur le pivot.
 * - `calibration_reperes` : quatre cubes de couleur — rouge devant (+Z du
 *   fichier), vert à la droite du modèle (−X), bleu en l'air au-dessus de
 *   l'origine, gris sur l'origine. Dans chaque vue, le centre de chaque cube
 *   doit tomber là où `versPlan` et `LACET_VUE` le mettent : c'est ce qui
 *   prouve que `droite` regarde la droite de l'écran, que la hauteur monte et
 *   que le profil a son tangage.
 * - `calibration_ombre` : une barre grise en l'air, à `HAUTEUR_BARRE`, ombre
 *   cuite. Son ombre doit tomber droit vers le haut de l'écran, à l'opposé de
 *   la principale qui vient du joueur, à `h / tan(élévation)` derrière le point
 *   du sol sous la barre. Pas un pilier : la lumière vient presque de la
 *   caméra, un pilier cache toute son ombre derrière lui.
 * - `calibration_lumiere_face` et `calibration_lumiere_biais` : un cube blanc
 *   mat, droit puis tourné de 45°. Le dessus doit sortir à 1, la face tournée
 *   vers le joueur à 0,68, les deux faces du cube tourné à la même clarté
 *   (0,61) : la lumière est symétrique (`reglages.ts`, `CLARTES_VISEES`). Deux
 *   modèles et non un : deux cubes voisins se prendraient un peu de ciel.
 *
 * La liste cuit aussi le carré **avec** son contour (`calibration_carre_contour`) :
 * les autres entrées le refusent (`"contour": false`), elles mesurent la
 * caméra au pixel près.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Un parallélépipède, en coordonnées glTF (Y en haut, avant en +Z), tourné de
 * `lacet` degrés autour de la verticale qui passe par son centre.
 */
interface Boite { min: [number, number, number]; max: [number, number, number]; materiau: number; lacet?: number }

interface Materiau { nom: string; couleur: [number, number, number] }

interface Modele { materiaux: Materiau[]; boites: Boite[]; carres?: { cote: number; materiau: number }[] }

/** Les sommets, normales et indices d'une boîte : six faces, quatre sommets chacune. */
function geometrieBoite(b: Boite): { positions: number[]; normales: number[]; indices: number[] } {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  const faces: [number[][], number[]][] = [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
    [[[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]],
    [[[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]],
    [[[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]],
  ];
  const positions: number[] = [];
  const normales: number[] = [];
  const indices: number[] = [];
  // Le lacet, autour de la verticale du centre : x' = x cos + z sin, z' = −x sin + z cos.
  const a = ((b.lacet ?? 0) * Math.PI) / 180;
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const tourner = (x: number, z: number): [number, number] => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  for (const [coins, n] of faces) {
    const base = positions.length / 3;
    for (const c of coins) {
      if (a === 0) {
        // Sans lacet, les sommets tels quels, au bit près : les modèles d'avant ne changent pas.
        positions.push(...c);
        normales.push(...n);
        continue;
      }
      const [x, z] = tourner(c[0]! - cx, c[2]! - cz);
      positions.push(x + cx, c[1]!, z + cz);
      const [nx, nz] = tourner(n[0]!, n[2]!);
      normales.push(nx, n[1]!, nz);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normales, indices };
}

/** Un carré au sol, face vers le haut, centré sur l'origine. */
function geometrieCarre(cote: number): { positions: number[]; normales: number[]; indices: number[] } {
  const d = cote / 2;
  return {
    positions: [-d, 0, -d, -d, 0, d, d, 0, d, d, 0, -d],
    normales: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

/** Écrit un GLB : un nœud `racine`, un nœud par pièce, un matériau PBR par couleur. */
function ecrireGlb(modele: Modele): Uint8Array {
  const pieces = [
    ...(modele.carres ?? []).map((c) => ({ g: geometrieCarre(c.cote), materiau: c.materiau })),
    ...modele.boites.map((b) => ({ g: geometrieBoite(b), materiau: b.materiau })),
  ];
  const morceaux: Uint8Array[] = [];
  let longueur = 0;
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const ajouter = (octets: Uint8Array, cible: number): number => {
    const alignement = (4 - (longueur % 4)) % 4;
    if (alignement) {
      morceaux.push(new Uint8Array(alignement));
      longueur += alignement;
    }
    bufferViews.push({ buffer: 0, byteOffset: longueur, byteLength: octets.length, target: cible });
    morceaux.push(octets);
    longueur += octets.length;
    return bufferViews.length - 1;
  };
  const meshes: object[] = [];
  const nodes: object[] = [{ name: 'racine', children: pieces.map((_, i) => i + 1) }];
  pieces.forEach(({ g, materiau }, i) => {
    const pos = new Float32Array(g.positions);
    const min = [0, 1, 2].map((k) => Math.min(...g.positions.filter((_, j) => j % 3 === k)));
    const max = [0, 1, 2].map((k) => Math.max(...g.positions.filter((_, j) => j % 3 === k)));
    const vPos = ajouter(new Uint8Array(pos.buffer), 34962);
    const vNor = ajouter(new Uint8Array(new Float32Array(g.normales).buffer), 34962);
    const vInd = ajouter(new Uint8Array(new Uint16Array(g.indices).buffer), 34963);
    accessors.push({ bufferView: vPos, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
    accessors.push({ bufferView: vNor, componentType: 5126, count: pos.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: vInd, componentType: 5123, count: g.indices.length, type: 'SCALAR' });
    meshes.push({ name: `piece_${i}`, primitives: [{ attributes: { POSITION: i * 3, NORMAL: i * 3 + 1 }, indices: i * 3 + 2, material: materiau }] });
    nodes.push({ name: `piece_${i}`, mesh: i });
  });
  const bin = new Uint8Array(longueur);
  let o = 0;
  for (const m of morceaux) {
    bin.set(m, o);
    o += m.length;
  }
  const document = {
    asset: { version: '2.0', generator: 'atlas-tournaments scripts/sprites/calibration' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials: modele.materiaux.map((m) => ({
      name: m.nom,
      pbrMetallicRoughness: { baseColorFactor: [...m.couleur, 1], metallicFactor: 0, roughnessFactor: 1 },
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const nj = (json.length + 3) & ~3;
  const nb = (bin.length + 3) & ~3;
  const glb = new Uint8Array(28 + nj + nb);
  const v = new DataView(glb.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, glb.length, true);
  v.setUint32(12, nj, true);
  v.setUint32(16, 0x4e4f534a, true);
  glb.fill(0x20, 20, 20 + nj);
  glb.set(json, 20);
  v.setUint32(20 + nj, nb, true);
  v.setUint32(24 + nj, 0x004e4942, true);
  glb.set(bin, 28 + nj);
  return glb;
}

/** Un cube d'arête `a` centré en `c`. */
function cube(c: [number, number, number], a: number, materiau: number): Boite {
  return { min: [c[0] - a / 2, c[1] - a / 2, c[2] - a / 2], max: [c[0] + a / 2, c[1] + a / 2, c[2] + a / 2], materiau };
}

/** Les repères, partagés avec le test : où est le centre de chaque cube, en coordonnées glTF. */
export const REPERES = {
  rouge: [0, 0.05, 0.35],
  vert: [-0.35, 0.05, 0],
  bleu: [0, 0.7, 0],
  gris: [0, 0.05, 0],
} as const satisfies Record<string, readonly [number, number, number]>;

/** L'arête des cubes repères, en mètres. */
export const ARETE_REPERE = 0.1;

/** L'arête des cubes de lumière, en mètres : centrés sur l'origine, posés au sol. */
export const ARETE_LUMIERE = 0.4;

/** La hauteur de la barre d'ombre, en mètres : son ombre tombe à `HAUTEUR_BARRE / tan(élévation)` derrière. */
export const HAUTEUR_BARRE = 0.4;

export function modelesCalibration(): Record<string, Modele> {
  return {
    calibration_carre: {
      materiaux: [{ nom: 'mat_blanc', couleur: [1, 1, 1] }],
      boites: [],
      carres: [{ cote: 1, materiau: 0 }],
    },
    calibration_reperes: {
      materiaux: [
        { nom: 'mat_rouge', couleur: [1, 0, 0] },
        { nom: 'mat_vert', couleur: [0, 1, 0] },
        { nom: 'mat_bleu', couleur: [0, 0, 1] },
        { nom: 'mat_gris', couleur: [0.25, 0.25, 0.25] },
      ],
      boites: [
        cube([...REPERES.rouge], ARETE_REPERE, 0),
        cube([...REPERES.vert], ARETE_REPERE, 1),
        cube([...REPERES.bleu], ARETE_REPERE, 2),
        cube([...REPERES.gris], ARETE_REPERE, 3),
      ],
    },
    calibration_ombre: {
      materiaux: [{ nom: 'mat_gris', couleur: [0.5, 0.5, 0.5] }],
      boites: [{ min: [-0.3, HAUTEUR_BARRE - 0.02, -0.02], max: [0.3, HAUTEUR_BARRE + 0.02, 0.02], materiau: 0 }],
    },
    calibration_lumiere_face: {
      materiaux: [{ nom: 'mat_blanc', couleur: [1, 1, 1] }],
      boites: [{ min: [-ARETE_LUMIERE / 2, 0, -ARETE_LUMIERE / 2], max: [ARETE_LUMIERE / 2, ARETE_LUMIERE, ARETE_LUMIERE / 2], materiau: 0 }],
    },
    calibration_lumiere_biais: {
      materiaux: [{ nom: 'mat_blanc', couleur: [1, 1, 1] }],
      boites: [{ min: [-ARETE_LUMIERE / 2, 0, -ARETE_LUMIERE / 2], max: [ARETE_LUMIERE / 2, ARETE_LUMIERE, ARETE_LUMIERE / 2], materiau: 0, lacet: 45 }],
    },
  };
}

if (require.main === module) {
  const dossier = join(__dirname);
  mkdirSync(dossier, { recursive: true });
  for (const [id, modele] of Object.entries(modelesCalibration())) {
    writeFileSync(join(dossier, `${id}.glb`), ecrireGlb(modele));
    console.log(`${id}.glb`);
  }
}
