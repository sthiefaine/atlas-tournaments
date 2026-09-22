/**
 * Lecture et mesure d'un GLB de source de décor, **sans aucune dépendance**.
 *
 * `src/assets/valider-gltf.ts` lit le document glTF et mesure une boîte à
 * partir des bornes déclarées par les accesseurs. Ici on va plus loin : on lit
 * le tampon binaire, on passe **chaque sommet** par la chaîne de ses nœuds, et
 * on le projette par la caméra de cuisson (`versPlan`). C'est ce qui permet de
 * dire, sans rien rendre, quelle place une source prendra à l'écran.
 *
 * Utilisé par `tests/decor-sprites/sources.test.ts` et par `mesurer.ts`, qui
 * relève les gabarits réels pour `doc/refonte/sprites-decor.md`.
 */

import { PIXELS_PAR_CASE, versPlan } from '../../src/render2d/contrat';

/** Ce que nous lisons du document glTF. */
export interface DocumentGlb {
  asset?: { version?: string; generator?: string };
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: {
    name?: string; mesh?: number; children?: number[];
    translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[];
  }[];
  meshes?: { name?: string; primitives?: { attributes?: Record<string, number>; indices?: number; mode?: number; material?: number }[] }[];
  accessors?: {
    bufferView?: number; byteOffset?: number; componentType?: number; count?: number; type?: string;
    min?: number[]; max?: number[];
  }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }[];
  buffers?: { byteLength?: number; uri?: string }[];
  materials?: { name?: string; doubleSided?: boolean }[];
  images?: { name?: string; uri?: string; bufferView?: number }[];
  textures?: unknown[];
  animations?: unknown[];
  skins?: unknown[];
}

/** Un GLB ouvert : son document et son tampon binaire. */
export interface Glb { document: DocumentGlb; bin: Uint8Array }

const MAGIE = 0x46546c67;
const MORCEAU_JSON = 0x4e4f534a;
const MORCEAU_BIN = 0x004e4942;

/** Ouvre un conteneur GLB ; lève sur toute anomalie, un fichier douteux ne se mesure pas. */
export function lireGlb(octets: Uint8Array): Glb {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (octets.byteLength < 20 || vue.getUint32(0, true) !== MAGIE) throw new Error('pas un GLB');
  if (vue.getUint32(4, true) !== 2) throw new Error('conteneur autre que glTF 2');
  if (vue.getUint32(8, true) !== octets.byteLength) throw new Error('longueur déclarée ≠ taille du fichier');
  let position = 12;
  let document: DocumentGlb | null = null;
  let bin: Uint8Array = new Uint8Array(0);
  while (position + 8 <= octets.byteLength) {
    const taille = vue.getUint32(position, true);
    const type = vue.getUint32(position + 4, true);
    const debut = position + 8;
    if (debut + taille > octets.byteLength) throw new Error('morceau qui déborde');
    if (type === MORCEAU_JSON && document === null) {
      document = JSON.parse(new TextDecoder().decode(octets.subarray(debut, debut + taille))) as DocumentGlb;
    } else if (type === MORCEAU_BIN) {
      bin = octets.subarray(debut, debut + taille);
    }
    position = debut + taille + ((4 - (taille % 4)) % 4);
  }
  if (document === null) throw new Error('aucun morceau JSON');
  return { document, bin };
}

const COMPOSANTES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const OCTETS: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** Lit un accesseur en nombres, quel que soit son type de composante. */
export function lireAccesseur(glb: Glb, index: number): { valeurs: Float64Array; composantes: number } {
  const a = glb.document.accessors?.[index];
  if (!a || a.bufferView === undefined || a.count === undefined) throw new Error(`accesseur ${index} illisible`);
  const vue = glb.document.bufferViews?.[a.bufferView];
  if (!vue) throw new Error(`vue ${a.bufferView} absente`);
  const composantes = COMPOSANTES[a.type ?? ''] ?? 0;
  const taille = OCTETS[a.componentType ?? 0] ?? 0;
  if (!composantes || !taille) throw new Error(`accesseur ${index} de type inconnu`);
  const pas = vue.byteStride ?? composantes * taille;
  const debut = (vue.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const fin = debut + pas * (a.count - 1) + composantes * taille;
  if (fin > debut + (vue.byteLength ?? 0) - (a.byteOffset ?? 0) || fin > glb.bin.byteLength) {
    throw new Error(`accesseur ${index} déborde de sa vue`);
  }
  const d = new DataView(glb.bin.buffer, glb.bin.byteOffset, glb.bin.byteLength);
  const valeurs = new Float64Array(a.count * composantes);
  for (let i = 0; i < a.count; i += 1) {
    for (let c = 0; c < composantes; c += 1) {
      const o = debut + i * pas + c * taille;
      let v: number;
      switch (a.componentType) {
        case 5126: v = d.getFloat32(o, true); break;
        case 5125: v = d.getUint32(o, true); break;
        case 5123: v = d.getUint16(o, true); break;
        case 5122: v = d.getInt16(o, true); break;
        case 5121: v = d.getUint8(o); break;
        default: v = d.getInt8(o);
      }
      valeurs[i * composantes + c] = v;
    }
  }
  return { valeurs, composantes };
}

/** Matrice 4 × 4 en colonnes, comme glTF. */
type Mat4 = number[];

function multiplier(a: Mat4, b: Mat4): Mat4 {
  const r = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let l = 0; l < 4; l += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + l]! * b[c * 4 + k]!;
      r[c * 4 + l] = s;
    }
  }
  return r;
}

/** La matrice locale d'un nœud : `matrix`, ou translation × rotation × échelle. */
function locale(n: NonNullable<DocumentGlb['nodes']>[number]): Mat4 {
  if (n.matrix?.length === 16) return [...n.matrix];
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const r = [
    1 - 2 * (y! * y! + z! * z!), 2 * (x! * y! + z! * w!), 2 * (x! * z! - y! * w!),
    2 * (x! * y! - z! * w!), 1 - 2 * (x! * x! + z! * z!), 2 * (y! * z! + x! * w!),
    2 * (x! * z! + y! * w!), 2 * (y! * z! - x! * w!), 1 - 2 * (x! * x! + y! * y!),
  ];
  return [
    r[0]! * sx!, r[1]! * sx!, r[2]! * sx!, 0,
    r[3]! * sy!, r[4]! * sy!, r[5]! * sy!, 0,
    r[6]! * sz!, r[7]! * sz!, r[8]! * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}

function determinant3(m: Mat4): number {
  return m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!)
    - m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!)
    + m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!);
}

/** Ce qu'on mesure d'une source. */
export interface MesureGlb {
  triangles: number;
  sommets: number;
  /** Boîte englobante dans le repère de la scène, sur les sommets eux-mêmes. */
  min: [number, number, number];
  max: [number, number, number];
  /** Un nœud porte une échelle négative, ou une chaîne de nœuds retourne l'espace. */
  echelleNegative: boolean;
  /** Primitives qui ne sont pas des triangles. */
  autresPrimitives: number;
  /** Ressources hors du fichier (`uri`) : une source doit se suffire. */
  ressourcesExternes: string[];
  materiaux: string[];
  noeuds: string[];
  /** L'image cuite, en pixels de plan (`versPlan`) : largeur et hauteur de la silhouette. */
  planLargeur: number;
  planHauteur: number;
  /** Les triangles projetés sur le plan, pour `silhouette` : x0 y0 x1 y1 x2 y2 à la suite. */
  plan: Float64Array;
}

/**
 * La silhouette qu'aura l'image cuite, sans rien rendre : chaque triangle est
 * projeté par `versPlan` et rastérisé au centre des pixels, à la densité de la
 * cuisson (`PIXELS_PAR_CASE`, 128 pixels par case). Rend la boîte en pixels et
 * la **couverture** — la part des pixels de cette boîte que le modèle remplit :
 * un arbre nu couvre moins qu'un arbre feuillu, et c'est ce chiffre qui dit s'il
 * se lit encore. L'ombre portée, cuite à part, n'y est pas.
 */
export function silhouette(m: MesureGlb): { largeur: number; hauteur: number; couverture: number } {
  const p = m.plan;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!);
    y0 = Math.min(y0, p[i + 1]!); y1 = Math.max(y1, p[i + 1]!);
  }
  const l = Math.ceil(x1 - x0) + 1;
  const h = Math.ceil(y1 - y0) + 1;
  const grille = new Uint8Array(l * h);
  for (let t = 0; t < p.length; t += 6) {
    const ax = p[t]! - x0, ay = p[t + 1]! - y0;
    const bx = p[t + 2]! - x0, by = p[t + 3]! - y0;
    const cx = p[t + 4]! - x0, cy = p[t + 5]! - y0;
    const aire = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(aire) < 1e-12) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(l - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        const w1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
        const w2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
        // Les deux sens de parcours : une face vue de dos couvre aussi.
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) grille[y * l + x] = 1;
      }
    }
  }
  let pleins = 0;
  for (const v of grille) pleins += v;
  return { largeur: x1 - x0, hauteur: y1 - y0, couverture: pleins / (l * h) };
}

/** La densité de la silhouette, redite ici pour que `mesurer.ts` l'affiche. */
export const PIXELS_SILHOUETTE = PIXELS_PAR_CASE;

/** Parcourt la scène, pose chaque sommet dans le repère de la scène, et mesure. */
export function mesurerGlb(glb: Glb): MesureGlb {
  const doc = glb.document;
  const noeuds = doc.nodes ?? [];
  const racines = doc.scenes?.[doc.scene ?? 0]?.nodes ?? noeuds.map((_, i) => i);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let planMin = [Infinity, Infinity];
  let planMax = [-Infinity, -Infinity];
  let triangles = 0;
  let sommets = 0;
  let echelleNegative = false;
  let autresPrimitives = 0;
  const plan: number[] = [];
  const pile: { i: number; parent: Mat4 }[] = racines.map((i) => ({ i, parent: locale({}) }));
  const vus = new Set<number>();
  while (pile.length > 0) {
    const { i, parent } = pile.pop()!;
    if (vus.has(i)) throw new Error(`nœud ${i} atteint deux fois`);
    vus.add(i);
    const n = noeuds[i];
    if (!n) throw new Error(`nœud ${i} absent`);
    if ((n.scale ?? []).some((s) => s < 0)) echelleNegative = true;
    const monde = multiplier(parent, locale(n));
    if (determinant3(monde) <= 0) echelleNegative = true;
    for (const enfant of n.children ?? []) pile.push({ i: enfant, parent: monde });
    if (n.mesh === undefined) continue;
    for (const p of doc.meshes?.[n.mesh]?.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) { autresPrimitives += 1; continue; }
      const iPos = p.attributes?.['POSITION'];
      if (iPos === undefined) throw new Error('primitive sans POSITION');
      const { valeurs } = lireAccesseur(glb, iPos);
      const compte = valeurs.length / 3;
      sommets += compte;
      const indices = p.indices !== undefined
        ? lireAccesseur(glb, p.indices).valeurs
        : Float64Array.from({ length: compte - (compte % 3) }, (_, k) => k);
      for (const k of indices) if (k >= compte) throw new Error('indice hors des sommets');
      triangles += Math.floor(indices.length / 3);
      const projetes = new Float64Array(2 * compte);
      for (let k = 0; k < compte; k += 1) {
        const x = valeurs[3 * k]!, y = valeurs[3 * k + 1]!, z = valeurs[3 * k + 2]!;
        const w = [
          monde[0]! * x + monde[4]! * y + monde[8]! * z + monde[12]!,
          monde[1]! * x + monde[5]! * y + monde[9]! * z + monde[13]!,
          monde[2]! * x + monde[6]! * y + monde[10]! * z + monde[14]!,
        ] as const;
        for (let a = 0; a < 3; a += 1) {
          min[a] = Math.min(min[a]!, w[a]!);
          max[a] = Math.max(max[a]!, w[a]!);
        }
        // Le plan de la cuisson : `x` va à droite, la profondeur `z` (vers le
        // joueur) descend l'écran, la hauteur `y` le remonte.
        const q = versPlan(w[0], w[2], w[1]);
        projetes[2 * k] = q.X;
        projetes[2 * k + 1] = q.Y;
        planMin = [Math.min(planMin[0]!, q.X), Math.min(planMin[1]!, q.Y)];
        planMax = [Math.max(planMax[0]!, q.X), Math.max(planMax[1]!, q.Y)];
      }
      for (let t = 0; t + 2 < indices.length; t += 3) {
        for (let c = 0; c < 3; c += 1) {
          const k = indices[t + c]!;
          plan.push(projetes[2 * k]!, projetes[2 * k + 1]!);
        }
      }
    }
  }
  const externes = [
    ...(doc.buffers ?? []).filter((b) => b.uri !== undefined).map((b) => b.uri!),
    ...(doc.images ?? []).filter((im) => im.uri !== undefined).map((im) => im.uri!),
  ];
  return {
    triangles,
    sommets,
    min,
    max,
    echelleNegative,
    autresPrimitives,
    ressourcesExternes: externes,
    materiaux: (doc.materials ?? []).map((m) => m.name ?? ''),
    noeuds: noeuds.map((n) => n.name ?? ''),
    planLargeur: planMax[0]! - planMin[0]!,
    planHauteur: planMax[1]! - planMin[1]!,
    plan: Float64Array.from(plan),
  };
}
