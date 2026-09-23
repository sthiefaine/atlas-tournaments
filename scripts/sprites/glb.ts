/**
 * Ce que la cuisson lit d'un GLB, et la copie qu'elle en donne à Blender.
 *
 * L'importeur glTF de Blender 5.1 ne connaît pas `EXT_meshopt_compression`,
 * que portent six des GLB livrés (`doc/11-assets-spec.md`, « Diffusion
 * Meshopt ») : on les décompresse d'abord, avec le décodeur de contrôle du
 * dépôt (`src/assets/compression-glb.ts`), sans perte. La copie est écrite
 * dans les brouillons, et ses images pointent en chemin absolu vers les PNG
 * voisins de la source — l'importeur résout une URI relative au dossier du
 * fichier qu'il lit, qui n'est plus celui de la source.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { assemblerCompression, decompresserGlb, morceauxGlb } from '../../src/assets/compression-glb';

/** Le document glTF, réduit à ce que la cuisson en lit. */
export interface DocumentGltf {
  images?: { name?: string; uri?: string; bufferView?: number }[];
  materials?: { name?: string; emissiveFactor?: number[]; emissiveTexture?: unknown }[];
  animations?: { name?: string; samplers: { input: number }[] }[];
  nodes?: { name?: string; extras?: Record<string, unknown> }[];
  accessors: { max?: number[] }[];
  [cle: string]: unknown;
}

export interface ClipGlb { nom: string; duree: number }

/** Ce qui se lit dans le document seul, sans décompresser ni résoudre de fichier. */
export interface LectureDocument {
  /** Les clips, avec leur durée réelle en secondes. */
  clips: ClipGlb[];
  /** L'URI de l'image du masque d'équipe, telle qu'écrite, ou `null`. */
  uriMasque: string | null;
  /** Vrai si un matériau émet : une texture d'émission, ou un facteur non nul. */
  emission: boolean;
  materiaux: string[];
  /**
   * Les nœuds à photographier nets, sans flou de bouge : ceux que le document
   * marque `extras.flouDeBouge: false` — les pièces qui tournent sans fin d'une
   * figurine (`scripts/production/figurines/lot.ts`, `marquerTournants`).
   */
  sansFlou: string[];
}

export interface InfosGlb extends LectureDocument {
  /** SHA-256 du fichier source, tel quel. */
  sha256: string;
  /** Le masque d'équipe, chemin absolu, ou `null`. */
  masque: string | null;
  /** Les images externes, chemins absolus, dans l'ordre du document. */
  images: string[];
  /** Vrai si la source était compressée par meshopt. */
  compresse: boolean;
}

/** SHA-256 hexadécimal d'octets. */
export function empreinte(octets: Uint8Array | string): string {
  return createHash('sha256').update(octets).digest('hex');
}

/** Vrai si un nom d'image désigne le masque d'équipe : la règle du validateur et de la 3D. */
export function estNomDeMasque(nom: string): boolean {
  const n = nom.toLowerCase();
  return n.includes('masque_equipe') || n.includes('team_mask');
}

/** Le document JSON d'un GLB : le premier bloc, lisible même compressé. */
export function documentGlb(octets: Uint8Array): DocumentGltf {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (octets.length < 20 || v.getUint32(0, true) !== 0x46546c67 || v.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB invalide');
  return JSON.parse(new TextDecoder().decode(octets.subarray(20, 20 + v.getUint32(12, true)))) as DocumentGltf;
}

/** Clips, masque, émission et matériaux d'un document. */
export function lireDocument(document: DocumentGltf): LectureDocument {
  const image = (document.images ?? []).find((i) => estNomDeMasque(`${i.name ?? ''} ${i.uri ?? ''}`));
  return {
    clips: (document.animations ?? []).map((a, i) => ({
      nom: a.name ?? `clip_${i}`,
      duree: Math.max(0, ...a.samplers.map((s) => document.accessors[s.input]?.max?.[0] ?? 0)),
    })),
    uriMasque: image?.uri ?? null,
    emission: (document.materials ?? []).some(
      (m) => m.emissiveTexture !== undefined || (m.emissiveFactor ?? [0, 0, 0]).some((v) => v > 0),
    ),
    materiaux: (document.materials ?? []).map((m, i) => m.name ?? `materiau_${i}`),
    sansFlou: (document.nodes ?? []).filter((n) => n.extras?.['flouDeBouge'] === false && n.name).map((n) => n.name!),
  };
}

/**
 * Lit une source, la décompresse au besoin, réécrit ses URI d'images en
 * chemins absolus et écrit la copie `destination` pour Blender.
 */
export function preparerGlb(source: string, destination: string): InfosGlb {
  const octets = new Uint8Array(readFileSync(source));
  const sha256 = empreinte(octets);
  const decompresse = decompresserGlb(octets);
  const { document: brut, bin } = morceauxGlb(decompresse);
  const document = brut as unknown as DocumentGltf;
  const lecture = lireDocument(document);
  const dossier = dirname(resolve(source));
  const images: string[] = [];
  let masque: string | null = null;
  for (const image of document.images ?? []) {
    if (!image.uri || image.uri.startsWith('data:')) continue;
    const ecrite = image.uri;
    const chemin = resolve(dossier, decodeURIComponent(ecrite));
    if (!existsSync(chemin)) throw new Error(`image introuvable : ${ecrite} (${source})`);
    // Le chemin résolu, liens suivis : l'importeur le charge tel quel.
    const reel = realpathSync(chemin);
    image.uri = reel;
    images.push(reel);
    if (ecrite === lecture.uriMasque) masque = reel;
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, assemblerCompression(brut, bin));
  return { ...lecture, sha256, masque, images, compresse: decompresse !== octets };
}
