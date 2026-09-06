/**
 * L'écriture d'un GLB depuis une scène three, sous Node.
 *
 * `GLTFExporter` fait tout le travail difficile — accesseurs, peau, matrices
 * de liaison inverses, animations — mais il a été écrit pour un navigateur :
 * il lit ses `Blob` avec un `FileReader`, et il encode les images par un
 * canvas. Deux cales suffisent : un `FileReader` de quelques lignes quand il
 * manque, et **aucune image donnée à l'exportateur** — les matériaux partent
 * sans carte, et les images, échantillonneurs, textures et références sont
 * **injectés** ensuite dans le JSON du GLB, par `uri` vers les PNG livrés à
 * côté. Le conteneur est réécrit à la main (`doc/11-assets-spec.md` §7.1 :
 * douze octets d'en-tête et deux morceaux).
 */

import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Un document glTF, vu comme un objet JSON libre. */
export type DocumentGltf = Record<string, unknown>;

/** La cale : `readAsArrayBuffer` par `Blob.arrayBuffer()`, `onloadend` à la fin. */
class FileReaderCale {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
}

/** Installe la cale si l'environnement n'a pas de `FileReader` (Node). */
export function installerFileReader(): void {
  const g = globalThis as { FileReader?: unknown };
  if (typeof g.FileReader === 'undefined') g.FileReader = FileReaderCale;
}

/** Exporte une racine et ses clips en GLB binaire. */
export function exporterGlb(racine: THREE.Object3D, clips: readonly THREE.AnimationClip[]): Promise<Uint8Array> {
  installerFileReader();
  return new Promise<Uint8Array>((resoudre, rejeter) => {
    new GLTFExporter().parse(
      racine,
      (resultat) => {
        if (resultat instanceof ArrayBuffer) resoudre(new Uint8Array(resultat));
        else rejeter(new Error('l’exportateur n’a pas rendu de binaire'));
      },
      (erreur) => rejeter(erreur instanceof Error ? erreur : new Error(String(erreur))),
      { binary: true, animations: [...clips], onlyVisible: false },
    );
  });
}

const MAGIE = 0x46546c67;
const MORCEAU_JSON = 0x4e4f534a;
const MORCEAU_BIN = 0x004e4942;

/** Découpe un GLB en son document et son tampon binaire. */
export function decouperGlb(octets: Uint8Array): { document: DocumentGltf; bin: Uint8Array } {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (vue.getUint32(0, true) !== MAGIE) throw new Error('magie glTF absente');
  let position = 12;
  let texte: string | null = null;
  let bin = new Uint8Array(0);
  while (position + 8 <= octets.byteLength) {
    const taille = vue.getUint32(position, true);
    const type = vue.getUint32(position + 4, true);
    const debut = position + 8;
    if (type === MORCEAU_JSON) texte = new TextDecoder().decode(octets.subarray(debut, debut + taille));
    else if (type === MORCEAU_BIN) bin = octets.slice(debut, debut + taille);
    position = debut + taille + ((4 - (taille % 4)) % 4);
  }
  if (texte === null) throw new Error('aucun morceau JSON');
  return { document: JSON.parse(texte) as DocumentGltf, bin };
}

/** Assemble un GLB : en-tête, morceau JSON complété d'espaces, morceau binaire complété de zéros. */
export function assemblerGlb(document: DocumentGltf, bin: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const caleJson = (4 - (json.length % 4)) % 4;
  const caleBin = (4 - (bin.length % 4)) % 4;
  const tailleJson = json.length + caleJson;
  const tailleBin = bin.length + caleBin;
  const total = 12 + 8 + tailleJson + 8 + tailleBin;
  const sortie = new Uint8Array(total);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, MAGIE, true);
  vue.setUint32(4, 2, true);
  vue.setUint32(8, total, true);
  vue.setUint32(12, tailleJson, true);
  vue.setUint32(16, MORCEAU_JSON, true);
  sortie.set(json, 20);
  for (let i = 0; i < caleJson; i += 1) sortie[20 + json.length + i] = 0x20;
  const debutBin = 20 + tailleJson;
  vue.setUint32(debutBin, tailleBin, true);
  vue.setUint32(debutBin + 4, MORCEAU_BIN, true);
  sortie.set(bin, debutBin + 8);
  return sortie;
}

/** Un accesseur, réduit à ce qu'on relit ; le reste est recopié tel quel. */
interface AccesseurGltf extends Record<string, unknown> {
  bufferView?: number;
}

/** Une vue de tampon : l'exportateur en écrit une par accesseur. */
interface VueTamponGltf extends Record<string, unknown> {
  byteOffset?: number;
  byteLength: number;
}

/**
 * Dédoublonne les vues de tampon et les accesseurs identiques, et réécrit le
 * tampon binaire. `GLTFExporter` écrit **un accesseur et une vue par piste** :
 * les trente-six pistes d'un clip partagent pourtant les mêmes temps, et les
 * os immobiles la même paire de quaternions identité. Sur trois niveaux de
 * détail, cela fait cent kilo-octets de JSON pour rien par fichier. Les
 * références — attributs et indices des primitives, matrices de liaison des
 * peaux, entrées et sorties des échantillonneurs — sont renumérotées.
 */
export function dedoublonner(document: DocumentGltf, bin: Uint8Array): Uint8Array {
  const vues = (document['bufferViews'] ?? []) as VueTamponGltf[];
  const accesseurs = (document['accessors'] ?? []) as AccesseurGltf[];

  const clesVues = new Map<string, number>();
  const vuesUniques: VueTamponGltf[] = [];
  const morceaux: Uint8Array[] = [];
  const renumVues = new Map<number, number>();
  let decalage = 0;
  vues.forEach((vue, i) => {
    const debut = vue.byteOffset ?? 0;
    const octets = bin.subarray(debut, debut + vue.byteLength);
    const reste: VueTamponGltf = { ...vue };
    delete reste.byteOffset;
    const cle = `${JSON.stringify(reste)}:${createHash('sha1').update(octets).digest('hex')}`;
    let j = clesVues.get(cle);
    if (j === undefined) {
      j = vuesUniques.length;
      clesVues.set(cle, j);
      vuesUniques.push({ ...reste, byteOffset: decalage });
      morceaux.push(octets);
      decalage += octets.byteLength + ((4 - (octets.byteLength % 4)) % 4);
    }
    renumVues.set(i, j);
  });

  const clesAccesseurs = new Map<string, number>();
  const accesseursUniques: AccesseurGltf[] = [];
  const renumAccesseurs = new Map<number, number>();
  accesseurs.forEach((a, i) => {
    const def: AccesseurGltf = a.bufferView === undefined ? { ...a } : { ...a, bufferView: renumVues.get(a.bufferView) };
    const cle = JSON.stringify(def);
    let j = clesAccesseurs.get(cle);
    if (j === undefined) {
      j = accesseursUniques.length;
      clesAccesseurs.set(cle, j);
      accesseursUniques.push(def);
    }
    renumAccesseurs.set(i, j);
  });
  const renum = (i: unknown): unknown => (typeof i === 'number' ? renumAccesseurs.get(i) ?? i : i);

  for (const maille of (document['meshes'] ?? []) as { primitives?: { attributes?: Record<string, unknown>; indices?: unknown }[] }[]) {
    for (const p of maille.primitives ?? []) {
      for (const [nom, i] of Object.entries(p.attributes ?? {})) p.attributes![nom] = renum(i);
      if (p.indices !== undefined) p.indices = renum(p.indices);
    }
  }
  for (const peau of (document['skins'] ?? []) as { inverseBindMatrices?: unknown }[]) {
    if (peau.inverseBindMatrices !== undefined) peau.inverseBindMatrices = renum(peau.inverseBindMatrices);
  }
  for (const animation of (document['animations'] ?? []) as { samplers?: { input?: unknown; output?: unknown }[] }[]) {
    for (const s of animation.samplers ?? []) {
      s.input = renum(s.input);
      s.output = renum(s.output);
    }
  }

  const sortie = new Uint8Array(decalage);
  let position = 0;
  for (const m of morceaux) {
    sortie.set(m, position);
    position += m.byteLength + ((4 - (m.byteLength % 4)) % 4);
  }
  document['bufferViews'] = vuesUniques;
  document['accessors'] = accesseursUniques;
  document['buffers'] = [{ byteLength: sortie.byteLength }];
  return sortie;
}

/**
 * Retire les bornes `min`/`max` des accesseurs qui ne portent pas de
 * positions : glTF ne les exige que sur `POSITION`, et l'exportateur les écrit
 * partout — quatre nombres à dix-sept chiffres par piste d'animation, vingt
 * kilo-octets de JSON par fichier. Les bornes des positions restent : c'est
 * sur elles que le validateur mesure l'emprise (`doc/11-assets-spec.md` §7.1).
 */
export function alleger(document: DocumentGltf): void {
  const positions = new Set<number>();
  for (const maille of (document['meshes'] ?? []) as { primitives?: { attributes?: Record<string, number> }[] }[]) {
    for (const p of maille.primitives ?? []) {
      const i = p.attributes?.['POSITION'];
      if (i !== undefined) positions.add(i);
    }
  }
  ((document['accessors'] ?? []) as AccesseurGltf[]).forEach((a, i) => {
    if (positions.has(i)) return;
    delete a['min'];
    delete a['max'];
  });
}

/** Les cartes à référencer : le nom de fichier voisin de chaque canal. */
export interface CartesVoisines {
  albedo: string;
  normale: string;
  rugosite: string;
  masque_equipe: string;
}

/** Ce que lit un matériau dans le document, réduit à ce qu'on touche. */
interface MateriauGltf {
  name?: string;
  pbrMetallicRoughness?: Record<string, unknown>;
  normalTexture?: unknown;
}

/**
 * Injecte les images par `uri`, un échantillonneur, les textures et leurs
 * références dans chaque matériau : albédo, métal-rugosité, normales. Le masque
 * d'équipe n'est référencé par aucun matériau — il n'a rien à faire dans un
 * matériau PBR — mais il est bien une texture du document, nommée : c'est par
 * ce nom que le chargeur (`render3d/modeles.ts`, `indexTextureMasque`) et le
 * validateur le retrouvent.
 */
export function injecterCartes(document: DocumentGltf, cartes: CartesVoisines): void {
  const canaux = ['albedo', 'normale', 'rugosite', 'masque_equipe'] as const;
  document['images'] = canaux.map((canal) => ({
    name: cartes[canal].replace(/\.png$/, ''), uri: cartes[canal], mimeType: 'image/png',
  }));
  // Linéaire avec mipmaps, bords pincés : un atlas ne se répète pas.
  document['samplers'] = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  document['textures'] = canaux.map((canal, i) => ({ name: canal, sampler: 0, source: i }));
  const materiaux = (document['materials'] ?? []) as MateriauGltf[];
  for (const m of materiaux) {
    const pbr = m.pbrMetallicRoughness ?? {};
    pbr['baseColorTexture'] = { index: 0 };
    pbr['metallicRoughnessTexture'] = { index: 2 };
    m.pbrMetallicRoughness = pbr;
    m.normalTexture = { index: 1, scale: 1 };
  }
}
