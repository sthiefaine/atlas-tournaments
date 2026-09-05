/**
 * Lecteur GLB minimal et contrôle d'un asset livré, **sans aucune dépendance**.
 *
 * Un fichier `.glb` est un conteneur trivial : un en-tête de douze octets, puis
 * des morceaux (`chunks`) longueur-type-données. Le premier morceau est le
 * document glTF en JSON, le second — facultatif ici — le tampon binaire. Nous
 * n'avons besoin que du JSON : nombres de triangles, bornes de position, noms de
 * nœuds, de matériaux, d'images et d'animations y sont tous déclarés. Charger
 * `three/examples/GLTFLoader` pour cela reviendrait à démarrer un moteur de rendu
 * dans un test, et cette couche n'a pas le droit d'importer `render3d/`.
 *
 * ```
 * octets 0..3   magie 'glTF'
 * octets 4..7   version (2)
 * octets 8..11  longueur totale du fichier
 * puis, tant qu'il reste des octets :
 *   4 octets  longueur du morceau
 *   4 octets  type du morceau ('JSON' ou 'BIN\0')
 *   n octets  données, complétées à un multiple de quatre
 * ```
 *
 * Le verdict a la forme de `ReviewVerdict` : `{ ok, motifs[] }`, chaque motif
 * portant un code, un détail et, quand la mesure a un sens, des chiffres.
 * Document propriétaire : `doc/11-assets-spec.md` §7.
 */

import {
  budgetDe, nomTexture,
  type AssetSpec, type CanalTexture, type MotifAsset, type NiveauLod, type VerdictAsset,
} from './spec';

// ---------------------------------------------------------------------------
// 1. Le document glTF, vu de très loin
// ---------------------------------------------------------------------------

/** Un accesseur : ce qui porte le nombre d'éléments et, pour les positions, les bornes. */
export interface AccesseurGltf { count?: number; type?: string; min?: number[]; max?: number[] }
/** Une primitive : ses attributs, ses indices, son mode de tracé (4 = triangles). */
export interface PrimitiveGltf { attributes?: Record<string, number>; indices?: number; mode?: number }
/** Une maille : une liste de primitives. */
export interface MailleGltf { primitives?: PrimitiveGltf[] }
/** Un nœud : un nom, éventuellement une maille et une transformation. */
export interface NoeudGltf {
  name?: string; mesh?: number; children?: number[];
  translation?: number[]; scale?: number[];
}
/** Un objet nommé quelconque du document (matériau, image, animation). */
export interface NommeGltf { name?: string; uri?: string }
/** Le document glTF, réduit à ce que nous lisons. */
export interface DocumentGltf {
  asset?: { version?: string };
  accessors?: AccesseurGltf[];
  meshes?: MailleGltf[];
  nodes?: NoeudGltf[];
  materials?: NommeGltf[];
  images?: NommeGltf[];
  animations?: NommeGltf[];
}

/** Une boîte englobante alignée sur les axes. */
export interface Aabb { min: [number, number, number]; max: [number, number, number] }

/** Ce que rend la lecture d'un GLB : le document, ou le motif qui l'a fait refuser. */
export type LectureGlb =
  | { ok: true; document: DocumentGltf; octetsBin: number }
  | { ok: false; motif: MotifAsset };

/** Magie `glTF`, lue en entier de 32 bits petit-boutiste. */
const MAGIE = 0x46546c67;
/** Type du morceau JSON. */
const MORCEAU_JSON = 0x4e4f534a;
/** Type du morceau binaire. */
const MORCEAU_BIN = 0x004e4942;

/** Compose un motif de refus. */
function motif(code: MotifAsset['code'], detail: string, mesure?: Record<string, number>): MotifAsset {
  return mesure === undefined ? { code, detail } : { code, detail, mesure };
}

// ---------------------------------------------------------------------------
// 2. Lecture du conteneur
// ---------------------------------------------------------------------------

/**
 * Lit un GLB et rend son document glTF. Toute anomalie de conteneur est un
 * `asset_format` : on ne va pas plus loin, les contrôles suivants n'auraient rien
 * à lire.
 */
export function lireGlb(octets: Uint8Array): LectureGlb {
  if (octets.byteLength < 20) {
    return { ok: false, motif: motif('asset_format', 'fichier trop court pour être un GLB', { octets: octets.byteLength }) };
  }
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (vue.getUint32(0, true) !== MAGIE) {
    return { ok: false, motif: motif('asset_format', 'magie glTF absente : ce n’est pas un fichier .glb') };
  }
  const version = vue.getUint32(4, true);
  if (version !== 2) {
    return { ok: false, motif: motif('asset_format', 'conteneur glTF autre que la version 2', { version }) };
  }
  const longueur = vue.getUint32(8, true);
  if (longueur !== octets.byteLength) {
    return {
      ok: false,
      motif: motif('asset_format', 'longueur déclarée différente de la taille du fichier', {
        declaree: longueur, reelle: octets.byteLength,
      }),
    };
  }

  let position = 12;
  let texteJson: string | undefined;
  let octetsBin = 0;
  let premier = true;
  while (position + 8 <= octets.byteLength) {
    const taille = vue.getUint32(position, true);
    const type = vue.getUint32(position + 4, true);
    const debut = position + 8;
    const fin = debut + taille;
    if (fin > octets.byteLength) {
      return { ok: false, motif: motif('asset_format', 'morceau qui déborde de la fin du fichier') };
    }
    if (premier && type !== MORCEAU_JSON) {
      return { ok: false, motif: motif('asset_format', 'le premier morceau d’un GLB doit être le JSON') };
    }
    premier = false;
    if (type === MORCEAU_JSON && texteJson === undefined) {
      texteJson = new TextDecoder().decode(octets.subarray(debut, fin));
    } else if (type === MORCEAU_BIN) {
      octetsBin = taille;
    }
    position = fin + ((4 - (taille % 4)) % 4);
  }

  if (texteJson === undefined) {
    return { ok: false, motif: motif('asset_format', 'aucun morceau JSON dans le GLB') };
  }
  let document: DocumentGltf;
  try {
    document = JSON.parse(texteJson) as DocumentGltf;
  } catch {
    return { ok: false, motif: motif('asset_format', 'le morceau JSON n’est pas du JSON lisible') };
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, motif: motif('asset_format', 'le morceau JSON ne porte pas un objet glTF') };
  }
  return { ok: true, document, octetsBin };
}

// ---------------------------------------------------------------------------
// 3. Mesures : triangles et boîte englobante
// ---------------------------------------------------------------------------

/** Nombre de triangles d'une maille, indices lus quand ils existent. */
function trianglesMaille(document: DocumentGltf, index: number): number {
  const maille = document.meshes?.[index];
  if (!maille?.primitives) return 0;
  let total = 0;
  for (const primitive of maille.primitives) {
    const mode = primitive.mode ?? 4;
    if (mode !== 4) continue; // seuls les triangles comptent dans le budget
    const iIndices = primitive.indices;
    const iPositions = primitive.attributes?.['POSITION'];
    const accesseur = iIndices !== undefined
      ? document.accessors?.[iIndices]
      : (iPositions !== undefined ? document.accessors?.[iPositions] : undefined);
    total += Math.floor((accesseur?.count ?? 0) / 3);
  }
  return total;
}

/** Bornes locales d'une maille, prises sur les accesseurs de position. */
function bornesMaille(document: DocumentGltf, index: number): Aabb | null {
  const maille = document.meshes?.[index];
  if (!maille?.primitives) return null;
  let boite: Aabb | null = null;
  for (const primitive of maille.primitives) {
    const iPositions = primitive.attributes?.['POSITION'];
    if (iPositions === undefined) continue;
    const accesseur = document.accessors?.[iPositions];
    const min = accesseur?.min;
    const max = accesseur?.max;
    if (!min || !max || min.length < 3 || max.length < 3) continue;
    const bas: [number, number, number] = [min[0] ?? 0, min[1] ?? 0, min[2] ?? 0];
    const haut: [number, number, number] = [max[0] ?? 0, max[1] ?? 0, max[2] ?? 0];
    boite = boite === null
      ? { min: bas, max: haut }
      : {
        min: [Math.min(boite.min[0], bas[0]), Math.min(boite.min[1], bas[1]), Math.min(boite.min[2], bas[2])],
        max: [Math.max(boite.max[0], haut[0]), Math.max(boite.max[1], haut[1]), Math.max(boite.max[2], haut[2])],
      };
  }
  return boite;
}

/**
 * Triangles et boîte englobante de tout le document, en parcourant les nœuds.
 *
 * On applique l'échelle puis la translation de chaque nœud porteur de maille ; on
 * ignore la rotation, volontairement : le format impose l'avant vers `+Z` et le
 * haut vers `+Y`, donc un asset conforme n'a pas de rotation à la racine, et un
 * asset qui en a une doit être refusé par le contrôle d'échelle plutôt que
 * rattrapé par le validateur.
 */
export function mesurerGltf(document: DocumentGltf): { triangles: number; boite: Aabb | null } {
  let triangles = 0;
  let boite: Aabb | null = null;
  const noeuds = document.nodes ?? [];
  const vus = new Set<number>();
  for (let i = 0; i < noeuds.length; i += 1) {
    const noeud = noeuds[i];
    if (!noeud || noeud.mesh === undefined || vus.has(i)) continue;
    vus.add(i);
    triangles += trianglesMaille(document, noeud.mesh);
    const locale = bornesMaille(document, noeud.mesh);
    if (!locale) continue;
    const e = noeud.scale ?? [1, 1, 1];
    const t = noeud.translation ?? [0, 0, 0];
    const bas: [number, number, number] = [0, 0, 0];
    const haut: [number, number, number] = [0, 0, 0];
    for (let a = 0; a < 3; a += 1) {
      const facteur = e[a] ?? 1;
      const decalage = t[a] ?? 0;
      const p1 = (locale.min[a] ?? 0) * facteur + decalage;
      const p2 = (locale.max[a] ?? 0) * facteur + decalage;
      bas[a] = Math.min(p1, p2);
      haut[a] = Math.max(p1, p2);
    }
    boite = boite === null ? { min: bas, max: haut } : {
      min: [Math.min(boite.min[0], bas[0]), Math.min(boite.min[1], bas[1]), Math.min(boite.min[2], bas[2])],
      max: [Math.max(boite.max[0], haut[0]), Math.max(boite.max[1], haut[1]), Math.max(boite.max[2], haut[2])],
    };
  }
  if (boite === null && noeuds.length === 0) {
    // Un document sans nœud : on mesure quand même les mailles, pour dire quelque
    // chose d'utile au générateur plutôt que « rien trouvé ».
    for (let i = 0; i < (document.meshes?.length ?? 0); i += 1) {
      triangles += trianglesMaille(document, i);
      const locale = bornesMaille(document, i);
      if (locale) boite = locale;
    }
  }
  return { triangles, boite };
}

// ---------------------------------------------------------------------------
// 4. Le contrôle complet
// ---------------------------------------------------------------------------

/** Options de contrôle : quel niveau de détail on est en train de relire. */
export interface OptionsGlb {
  /** Niveau de détail du fichier présenté. Par défaut 0. */
  lod?: NiveauLod;
  /**
   * Les fichiers **livrés à côté du GLB**, tels quels : `kit_fr_char_leger_albedo.png`.
   * Un kit national peut livrer ses textures dans le GLB **ou** en fichiers
   * séparés — les deux sont acceptés, mais l'un des deux est obligatoire.
   */
  fichiersLivres?: readonly string[];
}

/** Vrai si un nom d'image ou d'URI désigne la carte de masque d'équipe. */
function estMasqueEquipe(nomme: NommeGltf): boolean {
  const nom = `${nomme.name ?? ''} ${nomme.uri ?? ''}`.toLowerCase();
  return nom.includes('masque_equipe') || nom.includes('team_mask');
}

/**
 * Vrai si la carte `canal` est **présente** : référencée par le GLB (une image
 * dont le nom ou l'URI porte le nom du canal) ou livrée à côté sous le nom que
 * le gabarit de nommage impose, variante saisonnière comprise.
 *
 * C'est la règle des kits, et elle est délibérément permissive sur la **forme**
 * (GLB ou fichier voisin) et stricte sur le **nom** : un kit dont l'albédo
 * s'appelle `final_v3.png` est un kit qu'on ne saura pas charger.
 */
function texturePresente(
  spec: AssetSpec, canal: CanalTexture, images: readonly NommeGltf[], livres: readonly string[],
): boolean {
  const dansGlb = images.some((i) => {
    const nom = `${i.name ?? ''} ${i.uri ?? ''}`.toLowerCase();
    return nom.includes(canal);
  });
  if (dansGlb) return true;
  const attendus = new Set<string>([nomTexture(spec, canal)]);
  for (const saison of spec.variantes.saisons) attendus.add(nomTexture(spec, canal, saison));
  return livres.some((f) => {
    const base = f.split('/').pop() ?? f;
    if (attendus.has(base)) return true;
    // Le format de livraison peut différer (png relu, ktx2 compressé) : on
    // compare alors sans l'extension, le reste du nom faisant foi.
    const sansExt = base.replace(/\.[a-z0-9]+$/i, '');
    for (const a of attendus) if (a.replace(/\.[a-z0-9]+$/i, '') === sansExt) return true;
    return false;
  });
}

/**
 * Contrôle un fichier GLB contre sa spécification.
 *
 * L'ordre est celui du coût croissant : format d'abord (si le conteneur est
 * cassé, rien d'autre n'a de sens), puis noms, puis mesures. Un contrôle absent
 * de `spec.verification.controles` n'est pas exécuté — c'est ce qui permet à un
 * terrain de ne pas se voir reprocher l'absence d'animations.
 */
export function validerGlb(octets: Uint8Array, spec: AssetSpec, options: OptionsGlb = {}): VerdictAsset {
  const lecture = lireGlb(octets);
  if (!lecture.ok) return { ok: false, motifs: [lecture.motif] };

  const document = lecture.document;
  const controles = spec.verification.controles;
  const motifs: MotifAsset[] = [];

  // --- format : la version du document lui-même
  const versionDeclaree = document.asset?.version;
  if (versionDeclaree !== '2.0') {
    motifs.push(motif('asset_format', `version glTF attendue 2.0, reçue ${String(versionDeclaree ?? 'aucune')}`));
    return { ok: false, motifs };
  }

  // --- nœuds imposés
  if (controles.includes('noeuds')) {
    const noms = new Set((document.nodes ?? []).map((n) => n.name).filter((n): n is string => typeof n === 'string'));
    for (const attendu of spec.format.noeuds) {
      if (!noms.has(attendu)) motifs.push(motif('asset_format', `nœud attendu absent : ${attendu}`));
    }
  }

  // --- matériaux imposés
  if (controles.includes('materiaux')) {
    const noms = new Set((document.materials ?? []).map((m) => m.name).filter((n): n is string => typeof n === 'string'));
    for (const attendu of spec.format.materiauxAttendus) {
      if (!noms.has(attendu)) motifs.push(motif('asset_format', `matériau attendu absent : ${attendu}`));
    }
    if ((document.materials ?? []).length > spec.budget.materiauxMax) {
      motifs.push(motif('asset_format', 'plus de matériaux que le budget n’en admet', {
        trouves: (document.materials ?? []).length, budget: spec.budget.materiauxMax,
      }));
    }
  }

  const mesure = mesurerGltf(document);

  // --- budget de triangles
  if (controles.includes('budget')) {
    const lod = options.lod ?? 0;
    const plafond = budgetDe(spec.budget, lod);
    if (mesure.triangles > plafond) {
      motifs.push(motif('asset_budget', `triangles au-dessus du budget du lod${lod}`, {
        triangles: mesure.triangles, budget: plafond, lod,
      }));
    }
    if (mesure.triangles === 0) {
      motifs.push(motif('asset_budget', 'aucun triangle : le fichier ne porte pas de géométrie', { triangles: 0 }));
    }
  }

  // --- échelle et pivot
  if (controles.includes('echelle')) {
    const boite = mesure.boite;
    if (boite === null) {
      motifs.push(motif('asset_echelle', 'aucune borne de position lisible : accesseurs POSITION sans min/max'));
    } else {
      const axes = ['x', 'y', 'z'] as const;
      for (let a = 0; a < 3; a += 1) {
        const axe = axes[a] as 'x' | 'y' | 'z';
        const attendu = spec.echelle[axe];
        const taille = (boite.max[a] ?? 0) - (boite.min[a] ?? 0);
        const marge = Math.max(attendu.tolerance, attendu.cible * spec.verification.toleranceAabb);
        if (Math.abs(taille - attendu.cible) > marge) {
          motifs.push(motif('asset_echelle', `dimension ${axe} hors tolérance`, {
            mesure: Number(taille.toFixed(4)), cible: attendu.cible, marge: Number(marge.toFixed(4)),
          }));
        }
      }
      const margeY = Math.max(spec.echelle.y.tolerance, spec.echelle.y.cible * spec.verification.toleranceAabb);
      if (spec.pivot.poseAuSol && Math.abs(boite.min[1]) > margeY) {
        motifs.push(motif('asset_echelle', 'pivot : la géométrie ne repose pas sur le sol (min.y ≠ 0)', {
          minY: Number(boite.min[1].toFixed(4)), marge: Number(margeY.toFixed(4)),
        }));
      }
      for (const [axe, i] of [['x', 0], ['z', 2]] as const) {
        const centre = ((boite.min[i] ?? 0) + (boite.max[i] ?? 0)) / 2;
        const marge = Math.max(spec.echelle[axe].tolerance, spec.echelle[axe].cible * spec.verification.toleranceAabb);
        if (Math.abs(centre) > marge) {
          motifs.push(motif('asset_echelle', `pivot : l’emprise n’est pas centrée sur l’axe ${axe}`, {
            centre: Number(centre.toFixed(4)), marge: Number(marge.toFixed(4)),
          }));
        }
      }
    }
  }

  // --- masque de couleur d'équipe
  const images = document.images ?? [];
  const livres = options.fichiersLivres ?? [];
  if (controles.includes('masque_equipe')) {
    const dansGlb = images.some(estMasqueEquipe);
    const aCote = livres.some((f) => f.toLowerCase().includes('masque_equipe'));
    if (!dansGlb && !aCote) {
      motifs.push(motif('asset_masque_absent',
        'aucune image nommée masque_equipe, ni dans le fichier ni parmi les fichiers livrés'));
    }
  }

  // --- textures attendues : dans le GLB, ou livrées à côté
  if (controles.includes('textures')) {
    for (const t of spec.textures) {
      if (!t.obligatoire) continue;
      if (!texturePresente(spec, t.canal, images, livres)) {
        motifs.push(motif('asset_texture_absente',
          `carte obligatoire absente : ${t.canal} (attendue dans le GLB ou en ${nomTexture(spec, t.canal)})`));
      }
    }
  }

  // --- animations attendues
  if (controles.includes('animations')) {
    const noms = new Set((document.animations ?? []).map((a) => a.name).filter((n): n is string => typeof n === 'string'));
    for (const clip of spec.animations) {
      if (clip.obligatoire && !noms.has(clip.nom)) {
        motifs.push(motif('asset_animation_absente', `clip obligatoire absent : ${clip.nom}`));
      }
    }
  }

  return { ok: motifs.length === 0, motifs };
}
