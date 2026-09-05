/**
 * Fabrique de GLB en mémoire, pour les tests de `src/assets/valider-gltf.ts`.
 *
 * Aucun fichier binaire n'est versionné : un asset de test qu'on ne peut pas lire
 * en revue de code est un asset de test qui ment. On construit donc le conteneur
 * à la main — c'est douze octets d'en-tête et deux morceaux — et on garde le
 * document glTF en clair dans le test qui s'en sert.
 */

/** Un document glTF de test, volontairement libre : c'est le validateur qui juge. */
export type DocumentTest = Record<string, unknown>;

/** Complète une longueur au multiple de quatre supérieur. */
function cale(n: number): number {
  return (4 - (n % 4)) % 4;
}

/**
 * Assemble un GLB : en-tête, morceau JSON, morceau binaire facultatif.
 * `versionConteneur` et `magie` sont paramétrables pour fabriquer des fichiers
 * volontairement cassés.
 */
export function construireGlb(
  document: DocumentTest,
  bin?: Uint8Array,
  options: { magie?: number; versionConteneur?: number; longueurFausse?: number } = {},
): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const caleJson = cale(json.length);
  const caleBin = bin ? cale(bin.length) : 0;
  const tailleJson = json.length + caleJson;
  const tailleBin = bin ? bin.length + caleBin : 0;
  const total = 12 + 8 + tailleJson + (bin ? 8 + tailleBin : 0);

  const octets = new Uint8Array(total);
  const vue = new DataView(octets.buffer);
  vue.setUint32(0, options.magie ?? 0x46546c67, true);
  vue.setUint32(4, options.versionConteneur ?? 2, true);
  vue.setUint32(8, options.longueurFausse ?? total, true);

  vue.setUint32(12, tailleJson, true);
  vue.setUint32(16, 0x4e4f534a, true);
  octets.set(json, 20);
  for (let i = 0; i < caleJson; i += 1) octets[20 + json.length + i] = 0x20; // espaces

  if (bin) {
    const debut = 20 + tailleJson;
    vue.setUint32(debut, tailleBin, true);
    vue.setUint32(debut + 4, 0x004e4942, true);
    octets.set(bin, debut + 8);
  }
  return octets;
}

/** Trois sommets en float32, de quoi rendre le tampon crédible. */
export function binTriangle(x: number, y: number, z: number): Uint8Array {
  const positions = new Float32Array([
    -x / 2, 0, -z / 2,
    x / 2, 0, z / 2,
    0, y, 0,
  ]);
  return new Uint8Array(positions.buffer.slice(0));
}

/** Options d'un document de test : chaque défaut peut être introduit à la demande. */
export interface OptionsDocument {
  /** Dimensions de la boîte englobante déclarée. */
  taille?: { x: number; y: number; z: number };
  /** Décalage du centre au sol, pour casser le pivot. */
  decalage?: { x: number; y: number; z: number };
  /** Nombre de sommets déclaré : trois par triangle. */
  sommets?: number;
  /** Noms de nœuds. */
  noeuds?: string[];
  /** Noms de matériaux. */
  materiaux?: string[];
  /** Noms d'images. */
  images?: string[];
  /** Noms d'animations. */
  animations?: string[];
  /** Version glTF déclarée dans le document. */
  version?: string;
}

/**
 * Un document glTF minimal mais complet : un nœud porteur d'une maille à une
 * primitive, un accesseur de positions avec ses bornes, des matériaux, une image
 * de masque d'équipe et des animations, tous nommés.
 */
export function documentTest(options: OptionsDocument = {}): DocumentTest {
  const taille = options.taille ?? { x: 0.62, y: 0.5, z: 0.85 };
  const d = options.decalage ?? { x: 0, y: 0, z: 0 };
  const sommets = options.sommets ?? 3;
  const noeuds = options.noeuds ?? ['racine', 'corps', 'base', 'module_tourelle'];
  const materiaux = options.materiaux ?? ['mat_corps', 'mat_details'];
  const images = options.images ?? ['unite_char_leger_masque_equipe'];
  const animations = options.animations
    ?? ['repos', 'deplacement', 'tir', 'touche', 'hors_jeu'];

  return {
    asset: { version: options.version ?? '2.0', generator: 'atlas-tests' },
    scene: 0,
    scenes: [{ nodes: noeuds.map((_, i) => i) }],
    nodes: noeuds.map((name, i) => (i === 1 ? { name, mesh: 0 } : { name })),
    meshes: [{
      name: 'maille',
      primitives: [{ attributes: { POSITION: 0 }, material: 0, mode: 4 }],
    }],
    accessors: [{
      bufferView: 0,
      componentType: 5126,
      count: sommets,
      type: 'VEC3',
      min: [-taille.x / 2 + d.x, d.y, -taille.z / 2 + d.z],
      max: [taille.x / 2 + d.x, taille.y + d.y, taille.z / 2 + d.z],
    }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
    materials: materiaux.map((name) => ({ name, pbrMetallicRoughness: {} })),
    images: images.map((name) => ({ name, mimeType: 'image/png', bufferView: 0 })),
    textures: images.map((_, i) => ({ source: i })),
    animations: animations.map((name) => ({ name, channels: [], samplers: [] })),
  };
}
