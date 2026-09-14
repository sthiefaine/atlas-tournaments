/** Un seul dérivé de jeu ; lire une copie HD immuable, jamais le précédent dérivé. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { assemblerCompression, decompresserGlb, EXT_MESHOPT, morceauxGlb, type DocumentCompresse } from '../../src/assets/compression-glb';

interface Accesseur { bufferView: number; byteOffset?: number; componentType: number; type: string; count: number; normalized?: boolean; min?: number[]; max?: number[] }
interface Primitive { attributes: Record<string, number>; indices: number; material?: number; mode?: number; targets?: unknown; extensions?: unknown }
interface Document extends DocumentCompresse {
  accessors: Accesseur[];
  meshes: { name?: string; primitives: Primitive[] }[];
  animations: { samplers: { input: number; output: number }[] }[];
  images: { uri?: string; bufferView?: number }[];
  skins?: unknown[];
}
const PROFILS: Record<string, { maximum: number; cible: number; erreur: number }> = {
  unite_infanterie_base: { maximum: 55000, cible: 40000, erreur: .001 },
  unite_char_leger_base: { maximum: 60000, cible: 40000, erreur: .003 },
  unite_barge_base: { maximum: 50000, cible: 38000, erreur: .001 },
  batiment_qg_base: { maximum: 40000, cible: 35000, erreur: .001 },
};
const COMPOSANTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const OCTETS: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

async function main() {
  const [id, source, sortie] = process.argv.slice(2);
  if (!id || !source || !sortie || !PROFILS[id] || path.resolve(source) === path.resolve(sortie)) throw new Error('Usage : optimiser-lod0.ts <id> <dossier HD> <dossier sortie distinct>');
  const profil = PROFILS[id]!;
  const original = readFileSync(path.join(source, `${id}_lod0.glb`));
  const morceaux = morceauxGlb(decompresserGlb(original));
  const d = morceaux.document as Document, bin = morceaux.bin;
  if (d.skins?.length || d.meshes.some(m => m.primitives.some(p => p.targets || p.extensions || (p.mode ?? 4) !== 4))) throw new Error('Ce pipeline ne prépare que les maillages rigides triangulés');
  if (d.images.some(i => i.bufferView !== undefined || !i.uri || path.basename(i.uri) !== i.uri || !i.uri.endsWith('.png'))) throw new Error('PNG voisins externes attendus');
  const structure = JSON.stringify([d.nodes, d.scenes, d.materials, d.images]);
  const anciens = d.accessors;
  const cache = new Map<number, Float32Array | Uint32Array>();
  function lire(i: number): Float32Array | Uint32Array {
    const memo = cache.get(i); if (memo) return memo;
    const a = anciens[i]!, v = d.bufferViews[a.bufferView]!;
    const nc = COMPOSANTS[a.type]!, octets = OCTETS[a.componentType]!;
    if (!nc || !octets || a.normalized) throw new Error('Accesseur source non pris en charge');
    const valeurs = a.componentType === 5126 ? new Float32Array(a.count * nc) : new Uint32Array(a.count * nc);
    const vue = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    for (let j = 0; j < valeurs.length; j++) {
      const p = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + Math.floor(j / nc) * (v.byteStride ?? nc * octets) + j % nc * octets;
      valeurs[j] = a.componentType === 5126 ? vue.getFloat32(p, true) : a.componentType === 5125 ? vue.getUint32(p, true) : a.componentType === 5123 ? vue.getUint16(p, true) : vue.getUint8(p);
    }
    cache.set(i, valeurs); return valeurs;
  }
  const vues: Document['bufferViews'] = [], accesseurs: Accesseur[] = [], blocs: Uint8Array[] = [];
  let taille = 0;
  function ajouter(valeurs: Float32Array | Uint32Array, type: string): number {
    const nc = COMPOSANTS[type]!, count = valeurs.length / nc;
    const a: Accesseur = { bufferView: vues.length, componentType: valeurs instanceof Float32Array ? 5126 : 5125, count, type };
    if (!Number.isInteger(count) || !count || count > 1000000) throw new Error('Budget accesseur invalide');
    const min = Array(nc).fill(Infinity) as number[], max = Array(nc).fill(-Infinity) as number[];
    for (let i = 0; i < valeurs.length; i++) {
      const v = valeurs[i]!; if (!Number.isFinite(v)) throw new Error('Valeur non finie');
      min[i % nc] = Math.min(min[i % nc]!, v); max[i % nc] = Math.max(max[i % nc]!, v);
    }
    Object.assign(a, { min, max });
    const bytes = new Uint8Array(valeurs.buffer, valeurs.byteOffset, valeurs.byteLength);
    vues.push({ buffer: 0, byteOffset: taille, byteLength: bytes.length }); blocs.push(bytes); taille += bytes.length;
    accesseurs.push(a); return accesseurs.length - 1;
  }
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
  const trianglesAvant = d.meshes.reduce((s, m) => s + m.primitives.reduce((n, p) => n + anciens[p.indices]!.count / 3, 0), 0);
  const mesures: { maille: string; avant: number; apres: number; erreurRelative: number; erreurMetresEstimee: number }[] = [];
  for (const m of d.meshes) {
    // La préparation HD scinde les index à 999999 sans couper la surface.
    // Les réunir évite que ces frontières artificielles bloquent la réduction.
    const groupes = new Map<string, Primitive[]>();
    for (const p of m.primitives) {
      const cle = JSON.stringify(p.attributes) + ':' + p.material;
      groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
    }
    const primitives: Primitive[] = [];
    for (const groupe of groupes.values()) {
      const p = groupe[0]!, attributes = p.attributes;
      if (attributes.POSITION === undefined || attributes.NORMAL === undefined || attributes.TEXCOORD_0 === undefined) throw new Error('Position, normale et UV0 obligatoires');
      const ids = new Uint32Array(groupe.reduce((n, x) => n + anciens[x.indices]!.count, 0));
      let curseur = 0;
      for (const x of groupe) { const a = lire(x.indices); ids.set(a, curseur); curseur += a.length; }
      // Les sommets appartenant à une autre pièce ne doivent pas faire passer
      // une couture UV pour une jonction non-manifold (notamment la grue).
      const references = new Map<number, number>();
      for (const i of ids) if (!references.has(i)) references.set(i, references.size);
      const liste = [...references.keys()];
      const compacts = new Uint32Array(ids.length);
      for (let i = 0; i < ids.length; i++) compacts[i] = references.get(ids[i]!)!;
      const posSource = lire(attributes.POSITION), positions = new Float32Array(liste.length * 3);
      liste.forEach((id, i) => positions.set(posSource.subarray(id * 3, id * 3 + 3), i * 3));
      const cible = Math.max(36, Math.floor(ids.length / 3 * profil.cible / trianglesAvant) * 3);
      const [reduits, erreur] = ids.length <= 108 ? [compacts, 0] : MeshoptSimplifier.simplify(compacts, positions, 3, cible, profil.erreur, ['LockBorder']);
      const utilises = new Map<number, number>();
      for (const i of reduits) if (!utilises.has(i)) utilises.set(i, utilises.size);
      const nouveaux: Record<string, number> = {};
      for (const [nom, a] of Object.entries(attributes)) {
        const valeurs = lire(a), nc = COMPOSANTS[anciens[a]!.type]!;
        const dest = new Float32Array(utilises.size * nc);
        for (const [id, j] of utilises) {
          const origine = liste[id]!;
          dest.set(valeurs.subarray(origine * nc, origine * nc + nc), j * nc);
        }
        nouveaux[nom] = ajouter(dest, anciens[a]!.type);
      }
      const indices = new Uint32Array(reduits.length);
      for (let i = 0; i < indices.length; i++) indices[i] = utilises.get(reduits[i]!)!;
      primitives.push({ ...p, attributes: nouveaux, indices: ajouter(indices, 'SCALAR') });
      mesures.push({ maille: m.name ?? '', avant: ids.length / 3, apres: reduits.length / 3, erreurRelative: erreur, erreurMetresEstimee: erreur * MeshoptSimplifier.getScale(positions, 3) });
    }
    m.primitives = primitives;
  }
  const triangles = mesures.reduce((n, m) => n + m.apres, 0);
  if (triangles > profil.maximum) throw new Error(`Coutures préservées : ${triangles} triangles dépassent ${profil.maximum}. Ne pas relever la tolérance silencieusement.`);
  // Les valeurs et les cibles des animations restent exactes ; seuls les offsets changent.
  const animationsAvant = JSON.stringify(d.animations.map(a => [a, a.samplers.map(s => [Array.from(lire(s.input)), Array.from(lire(s.output))])]));
  const copieAnimations = structuredClone(d.animations);
  const remappage = new Map<number, number>();
  for (const a of d.animations) for (const s of a.samplers) for (const cle of ['input', 'output'] as const) {
    const ancien = s[cle];
    if (!remappage.has(ancien)) remappage.set(ancien, ajouter(lire(ancien), anciens[ancien]!.type));
    s[cle] = remappage.get(ancien)!;
  }
  d.accessors = accesseurs; d.bufferViews = vues; d.buffers = [{ byteLength: taille }];
  if (structure !== JSON.stringify([d.nodes, d.scenes, d.materials, d.images])) throw new Error('Structure source altérée');
  // Compression sans quantification : UV et normales conservés bit pour bit.
  const codes: Uint8Array[] = []; let position = 0;
  for (let i = 0; i < vues.length; i++) {
    const a = accesseurs[i]!, v = vues[i]!, stride = COMPOSANTS[a.type]! * 4;
    const mode = a.componentType === 5125 ? 'INDICES' : 'ATTRIBUTES';
    const code = MeshoptEncoder.encodeGltfBuffer(blocs[i]!, a.count, stride, mode);
    const padding = (4 - position % 4) % 4;
    if (padding) { codes.push(new Uint8Array(padding)); position += padding; }
    v.buffer = 1; v.extensions = { [EXT_MESHOPT]: { buffer: 0, byteOffset: position, byteLength: code.length, byteStride: stride, count: a.count, mode } };
    codes.push(code); position += code.length;
  }
  d.buffers = [{ byteLength: position }, { byteLength: taille, extensions: { [EXT_MESHOPT]: { fallback: true } } }];
  d.extensionsUsed = [...new Set([...(d.extensionsUsed ?? []), EXT_MESHOPT])];
  d.extensionsRequired = [...new Set([...(d.extensionsRequired ?? []), EXT_MESHOPT])];
  const glb = assemblerCompression(d, Buffer.concat(codes));
  // Vérifier les octets décodés avant de livrer : une compression acceptée
  // syntaxiquement n'est pas une preuve d'intégrité des positions.
  const retour = morceauxGlb(decompresserGlb(glb));
  if (!Buffer.from(retour.bin).equals(Buffer.concat(blocs))) throw new Error('Décodage différent des données optimisées');
  if (sha(readFileSync(path.join(source, `${id}_lod0.glb`))) !== sha(original)) throw new Error('La source a changé');
  mkdirSync(sortie, { recursive: true });
  writeFileSync(path.join(sortie, `${id}_lod0.glb`), glb);
  const rapport = { id, version: 1, sourcePrepareeSha256: sha(original), sourceDossier: path.relative(process.cwd(), source), glbSha256: sha(glb), trianglesAvant, triangles, glbOctetsAvant: original.length, glbOctets: glb.length, profil, mesures, methode: 'Meshopt QEM LockBorder ; UV et normales des sommets conservés, normales texturées existantes réutilisées, aucun nouveau bake HD vers low-poly', animationsSourceSha256: sha(Buffer.from(animationsAvant)), animationsSource: copieAnimations, approbationArtistique: false };
  writeFileSync(path.join(sortie, 'optimisation.json'), JSON.stringify(rapport, null, 2) + '\n');
  console.log(JSON.stringify({ id, trianglesAvant, triangles, octets: glb.length }));
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
