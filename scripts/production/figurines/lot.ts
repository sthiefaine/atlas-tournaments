/**
 * Le lot d'une figurine : le GLB brut de Blender, complété de ses cartes et
 * de ses clips, et les PNG de l'atlas nommés par la fiche. Pur : des octets
 * en entrée, des octets en sortie (`fabriquer.ts` lit et écrit les fichiers).
 *
 * Trois règles, et chacune est celle du contrôle du dépôt
 * (`src/serveur/depot-modeles.ts`, `controlerDepot`) :
 * - les images sont des **PNG voisins**, sous les noms exacts de la fiche
 *   (`nomTexture`), aucune embarquée ; le masque d'équipe est une image du
 *   document que nul matériau ne lit — c'est ainsi que la cuisson le trouve ;
 * - les matériaux sont ceux de la fiche, dans son ordre, sans en ajouter ;
 * - les clips commencent à zéro, finissent à la durée de la fiche, et leurs
 *   temps portent leurs bornes.
 */

import { assemblerGlb, decouperGlb, dedoublonner, type DocumentGltf } from '../../infanterie/gltf';
import { nomModele, nomTexture, type AssetSpec, type CanalTexture } from '../../../src/assets/spec';
import { mesurerGltf, type DocumentGltf as DocumentLu } from '../../../src/assets/valider-gltf';

import { pngAtlas, type Charte } from './charte';

/** Une piste de clip, telle que `bibliotheque.py` l'échantillonne : valeurs absolues, repère glTF. */
export interface PisteClip {
  noeud: string;
  chemin: 'translation' | 'rotation' | 'scale';
  temps: number[];
  valeurs: number[][];
}

export interface ClipFigurine {
  nom: string;
  duree: number;
  boucle: boolean;
  pistes: PisteClip[];
}

/** Ce que `fabriquer.py` rapporte et que le lot lit. */
export interface RapportBlender {
  cle: string;
  id: string;
  teintes: string[];
  clips: ClipFigurine[];
  /** `mobile` : a le droit de bouger au repos ; `tournant` : tourne sans fin, cuit net (un tournant est mobile). */
  noeuds: { nom: string; parent: string | null; translation: number[]; tournant: boolean; mobile?: boolean }[];
  materiaux: string[];
}

interface NoeudDoc { name?: string; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: Record<string, unknown> }
interface AccesseurDoc { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }
interface VueDoc { buffer: number; byteOffset?: number; byteLength: number; target?: number }
interface MateriauDoc {
  name?: string;
  pbrMetallicRoughness?: Record<string, unknown>;
  normalTexture?: unknown;
  emissiveTexture?: unknown;
  emissiveFactor?: number[];
  doubleSided?: boolean;
  [cle: string]: unknown;
}

/**
 * Ajoute les clips au document et au binaire, et rend le binaire complété.
 * Chaque piste devient un échantillonneur linéaire (temps FLOAT avec leurs
 * bornes, valeurs VEC3 ou VEC4) et un canal vers le nœud nommé.
 *
 * Deux vérifications, qui tomberaient autrement à la cuisson sans un mot :
 * le nœud doit exister, et sa translation au repos (première clé d'une piste
 * qui ne fait que bouger) n'a pas à le démentir — sinon la conversion des
 * axes entre Blender et glTF s'est trompée quelque part.
 */
export function injecterClips(document: DocumentGltf, bin: Uint8Array, clips: readonly ClipFigurine[]): Uint8Array {
  const noeuds = (document['nodes'] ?? []) as NoeudDoc[];
  const indice = new Map(noeuds.map((n, i) => [n.name ?? '', i]));
  const vues = (document['bufferViews'] ?? []) as VueDoc[];
  const accesseurs = (document['accessors'] ?? []) as AccesseurDoc[];
  const morceaux: Uint8Array[] = [bin];
  let longueur = bin.length;
  const ajouterFlottants = (valeurs: readonly number[]): number => {
    const cale = (4 - (longueur % 4)) % 4;
    if (cale) {
      morceaux.push(new Uint8Array(cale));
      longueur += cale;
    }
    const octets = new Uint8Array(new Float32Array(valeurs).buffer);
    vues.push({ buffer: 0, byteOffset: longueur, byteLength: octets.length });
    morceaux.push(octets);
    longueur += octets.length;
    return vues.length - 1;
  };
  const animations: unknown[] = [];
  for (const clip of clips) {
    const samplers: unknown[] = [];
    const channels: unknown[] = [];
    for (const p of clip.pistes) {
      const i = indice.get(p.noeud);
      if (i === undefined) throw new Error(`${clip.nom} : nœud ${p.noeud} absent du GLB`);
      if (p.temps.length !== p.valeurs.length || p.temps.length < 2) throw new Error(`${clip.nom} : piste ${p.noeud}.${p.chemin} mal formée`);
      if (p.temps[0] !== 0 || Math.abs(p.temps.at(-1)! - clip.duree) > 1e-6) throw new Error(`${clip.nom} : piste ${p.noeud}.${p.chemin} hors de [0, ${clip.duree}]`);
      const largeur = p.chemin === 'rotation' ? 4 : 3;
      if (p.valeurs.some((v) => v.length !== largeur || v.some((c) => !Number.isFinite(c)))) throw new Error(`${clip.nom} : valeurs de ${p.noeud}.${p.chemin} invalides`);
      const tempsF = Array.from(new Float32Array(p.temps));
      const vueTemps = ajouterFlottants(p.temps);
      accesseurs.push({ bufferView: vueTemps, componentType: 5126, count: p.temps.length, type: 'SCALAR', min: [tempsF[0]!], max: [tempsF.at(-1)!] });
      const entree = accesseurs.length - 1;
      const vueValeurs = ajouterFlottants(p.valeurs.flat());
      accesseurs.push({ bufferView: vueValeurs, componentType: 5126, count: p.valeurs.length, type: largeur === 4 ? 'VEC4' : 'VEC3' });
      samplers.push({ input: entree, output: accesseurs.length - 1, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: i, path: p.chemin } });
    }
    if (channels.length === 0) throw new Error(`le clip ${clip.nom} n'anime rien`);
    animations.push({ name: clip.nom, samplers, channels });
  }
  document['bufferViews'] = vues;
  document['accessors'] = accesseurs;
  document['animations'] = animations;
  const sortie = new Uint8Array(longueur);
  let o = 0;
  for (const m of morceaux) {
    sortie.set(m, o);
    o += m.length;
  }
  document['buffers'] = [{ byteLength: sortie.length }];
  return sortie;
}

/**
 * Vérifie que les nœuds du GLB ont, au repos, la translation que la
 * bibliothèque leur a donnée : la conversion d'axes de l'exportateur et celle
 * de `bibliotheque.py` doivent dire la même chose.
 */
export function verifierReposNoeuds(document: DocumentGltf, rapport: RapportBlender): string[] {
  const noeuds = (document['nodes'] ?? []) as NoeudDoc[];
  const problemes: string[] = [];
  for (const n of rapport.noeuds) {
    const d = noeuds.find((x) => x.name === n.nom);
    if (!d) { problemes.push(`nœud ${n.nom} absent du GLB`); continue; }
    const t = d.translation ?? [0, 0, 0];
    if (t.some((v, k) => Math.abs(v - n.translation[k]!) > 1e-4)) problemes.push(`nœud ${n.nom} : translation ${t.map((v) => v.toFixed(4))} au lieu de ${n.translation.map((v) => v.toFixed(4))}`);
    if ((d.rotation ?? [0, 0, 0, 1]).some((v, k) => Math.abs(v - (k === 3 ? 1 : 0)) > 1e-6)) problemes.push(`nœud ${n.nom} : une rotation au repos`);
  }
  return problemes;
}

/**
 * Marque les pièces qui tournent sans fin — un nœud déclaré `tournant`, et
 * tout ce qui y est accroché — d'un `extras.flouDeBouge: false` : la cuisson
 * les photographie nettes (`scripts/sprites/glb.ts`, `sansFlou`). Un rotor
 * flouté sur la moitié du pas entre deux images devient un disque ; net, il
 * garde ses pales, et c'est son pas d'une image à l'autre qui dit qu'il tourne
 * (`bibliotheque.py`, `rotor`). Rend les noms marqués.
 */
export function marquerTournants(document: DocumentGltf, rapport: RapportBlender): string[] {
  const parent = new Map(rapport.noeuds.map((n) => [n.nom, n.parent]));
  const tournants = new Set(rapport.noeuds.filter((n) => n.tournant).map((n) => n.nom));
  const sousUnTournant = (nom: string): boolean => {
    for (let p: string | null | undefined = nom; p; p = parent.get(p)) if (tournants.has(p)) return true;
    return false;
  };
  const marques: string[] = [];
  for (const d of (document['nodes'] ?? []) as NoeudDoc[]) {
    if (!d.name || !sousUnTournant(d.name)) continue;
    d.extras = { ...(d.extras ?? {}), flouDeBouge: false };
    marques.push(d.name);
  }
  return marques;
}

/**
 * Ce qui distingue deux GLB, lisible : rien s'ils sont identiques à l'octet ;
 * sinon les clés du document qui diffèrent, puis, accesseur par accesseur —
 * nommé par la maille ou le clip qui le lit —, combien de ses valeurs changent.
 * Deux fabrications d'un même module doivent rendre le même GLB : la cuisson
 * ne recuit que ce dont l'empreinte change.
 */
export function ecartsGlb(a: Uint8Array, b: Uint8Array): string[] {
  if (a.length === b.length && a.every((v, i) => v === b[i])) return [];
  const A = decouperGlb(a);
  const B = decouperGlb(b);
  const ecarts: string[] = [];
  const cles = [...new Set([...Object.keys(A.document), ...Object.keys(B.document)])].sort();
  const autres = cles.filter((k) => JSON.stringify(A.document[k]) !== JSON.stringify(B.document[k]));
  if (autres.length) ecarts.push(`document : ${autres.join(', ')} diffèrent`);
  const libelles = new Map<number, string>();
  const maillages = (A.document['meshes'] ?? []) as { name?: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  maillages.forEach((m, i) => m.primitives.forEach((p, k) => {
    for (const [nom, acc] of Object.entries(p.attributes)) libelles.set(acc, `maille ${m.name ?? i}${k ? ` (${k})` : ''}, ${nom}`);
    if (p.indices !== undefined) libelles.set(p.indices, `maille ${m.name ?? i}${k ? ` (${k})` : ''}, indices`);
  }));
  const clips = (A.document['animations'] ?? []) as { name?: string; samplers: { input: number; output: number }[] }[];
  clips.forEach((c, i) => c.samplers.forEach((s, k) => {
    libelles.set(s.input, `clip ${c.name ?? i}, temps ${k}`);
    libelles.set(s.output, `clip ${c.name ?? i}, valeurs ${k}`);
  }));
  const octets = (g: typeof A, i: number): Uint8Array | null => {
    const acc = ((g.document['accessors'] ?? []) as AccesseurDoc[])[i];
    const vue = acc?.bufferView === undefined ? undefined : ((g.document['bufferViews'] ?? []) as VueDoc[])[acc.bufferView];
    if (!acc || !vue) return null;
    const debut = (vue.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    return g.bin.subarray(debut, debut + vue.byteLength - (acc.byteOffset ?? 0));
  };
  const n = Math.max(((A.document['accessors'] ?? []) as unknown[]).length, ((B.document['accessors'] ?? []) as unknown[]).length);
  for (let i = 0; i < n; i++) {
    const x = octets(A, i);
    const y = octets(B, i);
    if (!x || !y) { ecarts.push(`accesseur ${i} (${libelles.get(i) ?? '?'}) : absent d’un des deux`); continue; }
    if (x.length !== y.length) { ecarts.push(`accesseur ${i} (${libelles.get(i) ?? '?'}) : ${x.length} octets contre ${y.length}`); continue; }
    let differents = 0;
    for (let k = 0; k < x.length; k += 4) if (x[k] !== y[k] || x[k + 1] !== y[k + 1] || x[k + 2] !== y[k + 2] || x[k + 3] !== y[k + 3]) differents++;
    if (differents) ecarts.push(`accesseur ${i} (${libelles.get(i) ?? '?'}) : ${differents} mots de 4 octets sur ${Math.ceil(x.length / 4)} diffèrent`);
  }
  if (!ecarts.length) ecarts.push('les octets diffèrent hors du document et des accesseurs (remplissage, en-tête)');
  return ecarts;
}

/**
 * Les canaux que le lot livre : ceux de la fiche, l'émission seulement si une
 * teinte émissive est portée — ou si la fiche l'exige : un bâtiment désaffecté
 * n'allume rien, mais sa fiche, celle du bâtiment, attend sa carte (noire là
 * où il a des pièces).
 */
export function canauxLivres(spec: AssetSpec, emissive: boolean): CanalTexture[] {
  return spec.textures.filter((t) => t.canal !== 'emission' || emissive || t.obligatoire).map((t) => t.canal);
}

/**
 * Pose les cartes : images par `uri` vers les PNG voisins, un échantillonneur
 * (linéaire, mipmaps, bords pincés : un atlas ne se répète pas), les textures,
 * et chaque matériau lit l'albédo, la rugosité-métal (G et B), la normale — et
 * l'émission quand il y en a. Le masque est une texture du document qu'aucun
 * matériau ne lit. Les matériaux de la fiche qui manquent (une maille qui n'en
 * porte aucune pièce) sont ajoutés, dans l'ordre de la fiche.
 */
export function injecterCartes(document: DocumentGltf, spec: AssetSpec, canaux: readonly CanalTexture[]): void {
  const references: CanalTexture[] = canaux.filter((c) => c !== 'metal');
  document['images'] = references.map((c) => ({ name: c, uri: nomTexture(spec, c), mimeType: 'image/png' }));
  document['samplers'] = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  document['textures'] = references.map((c, i) => ({ name: c, sampler: 0, source: i }));
  const texture = (c: CanalTexture) => references.indexOf(c);
  const materiaux = ((document['materials'] ?? []) as MateriauDoc[]);
  const parNom = new Map(materiaux.map((m) => [m.name ?? '', m]));
  const ordonnes: MateriauDoc[] = [];
  const renumeroter = new Map<number, number>();
  for (const nom of spec.format.materiauxAttendus) {
    const m = parNom.get(nom) ?? { name: nom };
    const avant = materiaux.indexOf(m);
    if (avant >= 0) renumeroter.set(avant, ordonnes.length);
    ordonnes.push(m);
  }
  const etrangers = materiaux.filter((m) => !spec.format.materiauxAttendus.includes(m.name ?? ''));
  if (etrangers.length) throw new Error(`matériaux hors de la fiche : ${etrangers.map((m) => m.name).join(', ')}`);
  for (const m of ordonnes) {
    for (const cle of Object.keys(m)) if (cle !== 'name') delete m[cle];
    m.pbrMetallicRoughness = {
      baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 1,
      baseColorTexture: { index: texture('albedo') },
      ...(texture('rugosite') >= 0 ? { metallicRoughnessTexture: { index: texture('rugosite') } } : {}),
    };
    if (texture('normale') >= 0) m.normalTexture = { index: texture('normale'), scale: 1 };
    if (texture('emission') >= 0) {
      m.emissiveTexture = { index: texture('emission') };
      m.emissiveFactor = [1, 1, 1];
    }
  }
  document['materials'] = ordonnes;
  for (const maille of (document['meshes'] ?? []) as { primitives?: { material?: number }[] }[]) {
    for (const p of maille.primitives ?? []) {
      if (p.material !== undefined) p.material = renumeroter.get(p.material) ?? p.material;
    }
  }
}

/** Les PNG de l'atlas que la fiche nomme, variantes de saison comprises. */
export function pngsDuLot(spec: AssetSpec, charte: Charte, canaux: readonly CanalTexture[]): Map<string, Uint8Array> {
  const sortie = new Map<string, Uint8Array>();
  for (const canal of canaux) {
    const t = spec.textures.find((x) => x.canal === canal);
    if (!t) continue;
    sortie.set(nomTexture(spec, canal), pngAtlas(charte, canal, t.resolution));
    for (const saison of spec.variantes.saisons) sortie.set(nomTexture(spec, canal, saison), pngAtlas(charte, canal, t.resolution, saison));
  }
  return sortie;
}

/**
 * La copie d'une fiche aux dimensions **mesurées** d'un modèle (son emprise,
 * au millimètre) et au budget uniforme de la charte : ce contre quoi une
 * figurine se contrôle tant que le catalogue garde les gabarits d'avant la
 * charte. Le reste de la fiche — noms, textures, clips, matériaux — ne bouge pas.
 */
export function ficheMesuree(officielle: AssetSpec, document: DocumentGltf, budget: number): AssetSpec {
  const { boite } = mesurerGltf(document as unknown as DocumentLu);
  if (!boite) throw new Error('le GLB n’a pas d’emprise mesurable');
  const taille = (a: 0 | 1 | 2): number => Math.round((boite.max[a] - boite.min[a]) * 1000) / 1000;
  return {
    ...officielle,
    echelle: {
      ...officielle.echelle,
      x: { ...officielle.echelle.x, cible: taille(0) },
      y: { ...officielle.echelle.y, cible: taille(1) },
      z: { ...officielle.echelle.z, cible: taille(2) },
    },
    budget: { ...officielle.budget, lod0: budget },
  };
}

/**
 * Le lot entier : le GLB de la fiche (brut de Blender, cartes et clips posés,
 * accesseurs dédoublonnés) et ses PNG.
 */
export function assemblerLot(glbBlender: Uint8Array, rapport: RapportBlender, spec: AssetSpec, charte: Charte): Map<string, Uint8Array> {
  const { document, bin } = decouperGlb(glbBlender);
  const problemes = verifierReposNoeuds(document, rapport);
  if (problemes.length) throw new Error(`le GLB de Blender ne dit pas ce que la bibliothèque a construit : ${problemes.join(' ; ')}`);
  marquerTournants(document, rapport);
  const emissive = rapport.teintes.some((nom) => charte.teintes.find((t) => t.nom === nom)?.emission);
  const canaux = canauxLivres(spec, emissive);
  injecterCartes(document, spec, canaux);
  const avecClips = injecterClips(document, bin, rapport.clips);
  const binaire = dedoublonner(document, avecClips);
  document['asset'] = { version: '2.0', generator: 'atlas-tournaments scripts/production/figurines' };
  const fichiers = new Map<string, Uint8Array>([[nomModele(spec, 0), assemblerGlb(document, binaire)]]);
  for (const [nom, png] of pngsDuLot(spec, charte, canaux)) fichiers.set(nom, png);
  return fichiers;
}
