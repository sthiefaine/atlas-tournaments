/** Vérifications des données réelles, en complément du contrat déclaratif glTF. */
import { lireGlb } from './valider-gltf';
import { contratProduction } from './production';
import { nomTexture, type AssetSpec, type MotifAsset } from './spec';
interface Accesseur { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string; min?: number[]; max?: number[]; sparse?: unknown }
interface Document {
  buffers?: { uri?: string; byteLength: number }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  accessors?: Accesseur[];
  meshes?: { primitives: { mode?: number; attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  nodes?: { name?: string; children?: number[]; translation?: number[]; scale?: number[]; rotation?: number[]; mesh?: number; matrix?: number[] }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string; name?: string }[];
  materials?: { name?: string; pbrMetallicRoughness?: Record<string, unknown>; extensions?: Record<string, unknown> }[];
  animations?: { name?: string; samplers: { input: number; output: number; interpolation?: string }[]; channels: { sampler: number; target: { node: number; path: string } }[] }[];
}
export function controlerBinaire(octets: Uint8Array, spec: AssetSpec): MotifAsset[] {
  const motifs: MotifAsset[] = [];
  const refuser = (detail: string) => motifs.push({ code: 'asset_format', detail });
  try {
    const lu = lireGlb(octets);
    if (!lu.ok) return [lu.motif];
    const d = lu.document as Document, vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    let bin: Uint8Array = new Uint8Array();
    for (let p = 12; p + 8 <= octets.length;) {
      const n = vue.getUint32(p, true);
      if (vue.getUint32(p + 4, true) === 0x004e4942) bin = octets.subarray(p + 8, p + 8 + n);
      p += 8 + n;
    }
    if (d.buffers?.length !== 1 || d.buffers[0]?.uri || d.buffers[0]!.byteLength > bin.length) throw new Error('un buffer binaire embarqué est requis');
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const autorisees = new Set(spec.textures.flatMap((t) => [nomTexture(spec, t.canal), ...spec.variantes.saisons.map((s) => nomTexture(spec, t.canal, s))]));
    for (const image of d.images ?? []) if (!image.uri || !autorisees.has(image.uri) || image.bufferView !== undefined) refuser('image attendue en PNG voisin : URI exacte du contrat, aucune copie embarquée');
    for (const v of d.bufferViews ?? []) if (v.buffer !== 0 || (v.byteOffset ?? 0) < 0 || v.byteLength < 0 || (v.byteOffset ?? 0) + v.byteLength > bin.length) throw new Error('bufferView hors du binaire');
    const cache = new Map<number, number[]>();
    function valeurs(index: number): number[] {
      const deja = cache.get(index); if (deja) return deja;
      const a = d.accessors?.[index];
      if (!a || !Number.isInteger(a.count) || a.count < 1 || a.count > 1000000 || a.sparse) throw new Error(`accesseur ${index} absent, sparse ou hors budget`);
      const v = d.bufferViews?.[a.bufferView ?? -1];
      const taille = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType];
      const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 } as Record<string, number>)[a.type];
      if (!v || !taille || !n) throw new Error(`format d’accesseur ${index} non pris en charge`);
      const pas = v.byteStride ?? taille * n, relatif = a.byteOffset ?? 0, debut = (v.byteOffset ?? 0) + relatif;
      if (pas < taille * n || relatif < 0 || relatif + (a.count - 1) * pas + taille * n > v.byteLength) throw new Error(`accesseur ${index} déborde de sa vue`);
      const sortie: number[] = [];
      for (let i = 0; i < a.count; i++) for (let j = 0; j < n; j++) {
        const p = debut + i * pas + j * taille;
        const x = a.componentType === 5126 ? dv.getFloat32(p, true) : a.componentType === 5125 ? dv.getUint32(p, true)
          : a.componentType === 5123 ? dv.getUint16(p, true) : a.componentType === 5122 ? dv.getInt16(p, true) : a.componentType === 5121 ? dv.getUint8(p) : dv.getInt8(p);
        if (!Number.isFinite(x)) throw new Error(`valeur non finie dans l’accesseur ${index}`);
        sortie.push(x);
      }
      cache.set(index, sortie); return sortie;
    }
    for (let i = 0; i < (d.accessors?.length ?? 0); i++) valeurs(i);
    for (const maille of d.meshes ?? []) for (const p of maille.primitives) {
      if ((p.mode ?? 4) !== 4) refuser('seules les primitives triangulées sont admises');
      for (const nom of ['POSITION', 'NORMAL', 'TEXCOORD_0']) if (p.attributes[nom] === undefined) refuser(`attribut ${nom} absent`);
      const index = p.attributes['POSITION']; if (index === undefined) continue;
      const a = d.accessors![index]!, positions = valeurs(index), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      if (a.type !== 'VEC3') throw new Error('POSITION doit être VEC3');
      positions.forEach((v, i) => { const j = i % 3; min[j] = Math.min(min[j]!, v); max[j] = Math.max(max[j]!, v); });
      if ([0, 1, 2].some((i) => a.min?.[i] === undefined || a.max?.[i] === undefined || Math.abs(a.min[i]! - min[i]!) > 1e-5 || Math.abs(a.max[i]! - max[i]!) > 1e-5)) refuser('bornes POSITION déclarées différentes des sommets réels');
      const indices = p.indices === undefined ? null : valeurs(p.indices);
      if ((indices?.length ?? a.count) % 3 || indices?.some((i) => !Number.isInteger(i) || i < 0 || i >= a.count)) refuser('indices de triangles invalides');
      for (const nom of ['NORMAL', 'TEXCOORD_0']) { const k = p.attributes[nom]; if (k !== undefined && d.accessors?.[k]?.count !== a.count) refuser(`nombre de ${nom} différent des positions`); }
    }
    const nomsMateriaux = new Set<string>();
    for (const m of d.materials ?? []) {
      if (!m.name || !spec.format.materiauxAttendus.includes(m.name) || nomsMateriaux.has(m.name)) refuser(`matériau inattendu ou dupliqué : ${m.name}`);
      if (!m.pbrMetallicRoughness || m.extensions?.KHR_materials_unlit) refuser(`matériau PBR metallic-roughness requis : ${m.name}`);
      if (m.name) nomsMateriaux.add(m.name);
    }
    const nomsClips = new Set<string>();
    for (const a of d.animations ?? []) {
      if (!a.name || nomsClips.has(a.name) || !spec.animations.some((s) => s.nom === a.name)) refuser(`clip inattendu ou dupliqué : ${a.name}`);
      if (a.name) nomsClips.add(a.name);
    }
    const noms = new Set<string>(), parents = new Map<number, number>();
    for (const [i, n] of (d.nodes ?? []).entries()) {
      if (n.name && noms.has(n.name)) refuser(`nom de nœud dupliqué : ${n.name}`);
      if (n.name) noms.add(n.name);
      if (n.name === 'racine' && ((n.translation ?? []).some((v) => v !== 0) || (n.scale ?? []).some((v) => v !== 1) || (n.rotation ?? [0, 0, 0, 1]).some((v, j) => v !== (j === 3 ? 1 : 0)) || n.matrix)) refuser('racine : transformation identité requise');
      if ([...(n.translation ?? []), ...(n.rotation ?? []), ...(n.scale ?? []), ...(n.matrix ?? [])].some((v) => !Number.isFinite(v)) || n.scale?.some((v) => v < 0)) refuser(`transformation invalide : ${n.name}`);
      for (const enfant of n.children ?? []) {
        if (!d.nodes?.[enfant] || parents.has(enfant)) throw new Error('parent multiple ou enfant absent');
        parents.set(enfant, i);
      }
    }
    for (const i of parents.keys()) { const vus = new Set<number>(); let n: number | undefined = i; while (n !== undefined) { if (vus.has(n)) throw new Error('cycle de nœuds'); vus.add(n); n = parents.get(n); } }
    for (const attendu of contratProduction(spec).assemblage) {
      const i = d.nodes?.findIndex((n) => n.name === attendu.nom) ?? -1, n = d.nodes?.[i];
      if (!n) continue;
      const parent = d.nodes?.[parents.get(i) ?? -1]?.name ?? null;
      if (parent !== attendu.parent) refuser(`${attendu.nom} : parent attendu ${attendu.parent ?? 'scène'}`);
      if (attendu.pivot && attendu.pivot.some((v, j) => Math.abs(v - (n.translation?.[j] ?? 0)) > .001)) refuser(`${attendu.nom} : pivot local différent du contrat`);
    }
    for (const attendu of spec.animations) {
      const clip = d.animations?.find((a) => a.name === attendu.nom); if (!clip) continue;
      let fin = 0;
      if (!clip.channels?.length || !clip.samplers?.length) { refuser(`${attendu.nom} : clip vide`); continue; }
      for (const canal of clip.channels) {
        const s = clip.samplers[canal.sampler]; if (!s) throw new Error('sampler d’animation absent');
        const temps = valeurs(s.input), sortie = valeurs(s.output), a = d.accessors![s.output]!;
        if (d.accessors![s.input]!.type !== 'SCALAR' || temps[0] !== 0 || temps.some((t, i) => i > 0 && t <= temps[i - 1]!)) refuser(`${attendu.nom} : temps croissants à partir de zéro requis`);
        fin = Math.max(fin, temps.at(-1)!);
        const n = d.nodes?.[canal.target.node];
        if (!n || n.name === 'racine' || !['translation', 'rotation', 'scale', 'weights'].includes(canal.target.path)) refuser(`${attendu.nom} : cible absente ou mouvement de racine`);
        const facteur = s.interpolation === 'CUBICSPLINE' ? 3 : 1;
        if (canal.target.path !== 'weights' && a.count !== temps.length * facteur) refuser(`${attendu.nom} : nombre de clés incohérent`);
        const largeur = canal.target.path === 'rotation' ? 4 : 3;
        if (canal.target.path !== 'weights' && a.type !== (largeur === 4 ? 'VEC4' : 'VEC3')) refuser(`${attendu.nom} : format de clés invalide`);
        if (canal.target.path === 'scale' && facteur === 1 && sortie.some((v) => v < 0)) refuser(`${attendu.nom} : échelle négative`);
        if (attendu.boucle && canal.target.path !== 'weights') {
          const debut = facteur === 3 ? largeur : 0, fin = sortie.length - largeur * (facteur === 3 ? 2 : 1);
          const ecart = (signe: number) => Math.max(...Array.from({ length: largeur }, (_, j) => Math.abs(sortie[debut + j]! - signe * sortie[fin + j]!)));
          if (Math.min(ecart(1), canal.target.path === 'rotation' ? ecart(-1) : Infinity) > .0001) refuser(`${attendu.nom} : raccord de boucle discontinu`);
        }
      }
      if (Math.abs(fin * 1000 - attendu.dureeMs) > 1) refuser(`${attendu.nom} : durée ${fin * 1000} ms, attendue ${attendu.dureeMs} ms`);
    }
  } catch (e) { refuser(e instanceof Error ? e.message : String(e)); }
  return motifs;
}
