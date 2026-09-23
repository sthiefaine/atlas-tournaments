/**
 * Lire un GLB livré **comme three le lit**, et le mettre au repère des images :
 * de quoi vérifier une livraison au-delà de ce que le validateur mesure dans
 * l'octet — que three l'analyse, que le masque d'équipe s'attache aux bons
 * matériaux, que la mise au gabarit tient dans la tolérance de la
 * spécification, que les clips font bouger les os.
 *
 * Ces fonctions vivaient dans le chargeur de la peau 3D (`render3d/modeles.ts`),
 * qui s'en servait à l'écran. La 3D temps réel a été retirée le 23 septembre
 * 2026 : le jeu affiche des images cuites depuis les GLB (`doc/18-rendu-sprites.md`),
 * et ne lit plus un seul GLB. Il n'en reste que ce dont les **tests de
 * production** ont besoin pour juger un fichier livré (`tests/assets/`), sorti
 * ici à l'identique, avec deux différences qui ne changent aucun verdict :
 *
 * - three **classique** (`three`), celui des scripts de production, et plus
 *   `three/webgpu` : les matériaux restent ceux que `GLTFLoader` fabrique, sans
 *   jumeau à nœuds — la conversion n'existait que pour le nœud de couleur du
 *   masque sous `WebGPURenderer`, et pour réaligner des attributs quantifiés
 *   que WebGPU refusait ;
 * - aucune I/O réseau : le lecteur de fichiers est **donné** par l'appelant
 *   (un test lit le disque), et l'inventaire aussi.
 *
 * Aucune unité n'y est connue par son nom : seulement par ce que ses fichiers
 * disent.
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';

import {
  CLIPS_ANIMATION, gabaritDe, NIVEAUX_LOD,
  type ClipAnimation, type Gabarit, type InventaireModeles, type NiveauLod,
} from '../../src/assets/spec';
import { chargerStyleNation } from '../../src/assets/styles';
import type { CleUnite, CodePays } from '../../src/schemas/types';

// ---------------------------------------------------------------------------
// 1. Le vocabulaire : clips et gabarits
// ---------------------------------------------------------------------------

/** Le nom d'un clip logique : la liste fermée de `doc/11-assets-spec.md` §5.4. */
export type NomClip = ClipAnimation;

/** Les six noms, dans l'ordre de la spécification. */
export const NOMS_CLIPS: readonly NomClip[] = CLIPS_ANIMATION;

/**
 * `repos` et `deplacement` bouclent ; les autres jouent une fois, et `hors_jeu`
 * garde sa pose finale (`doc/11` §5.4). Un GLB ne porte pas de drapeau de
 * boucle : c'est le lecteur qui décide.
 */
export function clipEnBoucle(nom: NomClip): boolean {
  return nom === 'repos' || nom === 'deplacement';
}

/** Proportions d'un gabarit : longueur (X), hauteur (Y), largeur (Z). */
export const PROPORTIONS: Readonly<Record<Gabarit, [number, number, number]>> = {
  a: [0.9, 0.98, 1.06],
  b: [1, 1, 1],
  c: [1.14, 1.06, 0.95],
};

/**
 * La rotation qui amène l'avant d'un modèle livré (`+Z`, `doc/11` §4.2) sur
 * `+X` : `+π/2` autour de Y dans la convention de three — `−π/2` enverrait
 * l'avant sur `−X`, un test le vérifie.
 */
export const ROTATION_AVANT = Math.PI / 2;

/** Nom du groupe qui porte la figurine conformée. */
export const NOM_FIGURINE = 'figurine_modele';

/** Nom du groupe intérieur qui ramène l'avant du fichier (`+Z`) sur `+X`. */
export const NOM_ORIENTATION = 'orientation';

// ---------------------------------------------------------------------------
// 2. Le masque d'équipe, tenu à côté du matériau
// ---------------------------------------------------------------------------

/**
 * Le masque d'un matériau, tenu **à côté** de lui plutôt que dans `userData` :
 * `Material.clone()` sérialise `userData` en JSON, ce qui ferait d'une texture
 * une description de texture.
 */
const masques = new WeakMap<THREE.Material, THREE.Texture>();

/** Vrai si un nom d'image ou d'URI désigne la carte de masque d'équipe — la règle du validateur. */
export function estNomDeMasque(nom: string): boolean {
  const n = nom.toLowerCase();
  return n.includes('masque_equipe') || n.includes('team_mask');
}

/** Associe un masque d'équipe à un matériau. */
export function definirMasque(materiau: THREE.Material, masque: THREE.Texture): void {
  masques.set(materiau, masque);
}

/** Le masque d'équipe d'un matériau, ou `null`. */
export function masqueDe(materiau: THREE.Material): THREE.Texture | null {
  return masques.get(materiau) ?? null;
}

/** Vrai pour un matériau standard — `MeshPhysicalMaterial` compris. */
export function estMateriauStandard(m: THREE.Material): boolean {
  return (m as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial === true;
}

/** Le document glTF tel que le parseur le garde, réduit à ce que nous y lisons. */
interface DocumentGltfParseur {
  images?: { name?: string; uri?: string }[];
  textures?: { source?: number }[];
}

/** L'index de la texture qui porte le masque d'équipe dans un document glTF, ou `-1`. */
export function indexTextureMasque(document: DocumentGltfParseur | undefined): number {
  if (!document?.textures) return -1;
  return document.textures.findIndex((t) => {
    const image = t.source === undefined ? undefined : document.images?.[t.source];
    return image !== undefined && estNomDeMasque(`${image.name ?? ''} ${image.uri ?? ''}`);
  });
}

// ---------------------------------------------------------------------------
// 3. La lecture d'un fichier
// ---------------------------------------------------------------------------

/** Une lecture de fichier : la scène, ses clips, rien de plus. */
export interface LectureFichier {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

/**
 * Tire d'un `GLTF` analysé la lecture qui nous sert : la scène et ses clips,
 * et le masque d'équipe attaché aux matériaux standard quand le fichier en
 * porte un — une image nommée `masque_equipe` (ou `team_mask`), la convention
 * du validateur, référencée par une texture du document. Un masque qui ne se
 * charge pas ne bloque jamais le modèle.
 */
export async function lectureDepuisGltf(gltf: GLTF): Promise<LectureFichier> {
  const parseur = gltf.parser as unknown as {
    json?: DocumentGltfParseur;
    getDependency?: (type: string, index: number) => Promise<unknown>;
  };
  const index = indexTextureMasque(parseur.json);
  if (index >= 0 && parseur.getDependency) {
    try {
      const texture = await parseur.getDependency('texture', index);
      if (texture instanceof THREE.Texture) {
        // Un masque est une donnée, pas une couleur : il ne doit pas être
        // converti comme un albédo.
        texture.colorSpace = THREE.NoColorSpace;
        gltf.scene.traverse((n) => {
          if (!(n instanceof THREE.Mesh)) return;
          const liste: THREE.Material[] = Array.isArray(n.material) ? n.material : [n.material];
          for (const m of liste) if (estMateriauStandard(m)) definirMasque(m, texture);
        });
      }
    } catch {
      // Le modèle vaut mieux sans son masque que pas du tout.
    }
  }
  return { scene: gltf.scene, clips: gltf.animations };
}

/**
 * Analyse un GLB déjà en mémoire, sans réseau.
 *
 * Dès qu'un fichier porte une image, `GLTFLoader` lit `self.URL`, et `self`
 * n'existe pas hors d'un navigateur : on le pose sur `globalThis` quand il
 * manque, ce qui est ce qu'il vaut dans un navigateur. Les images ne se
 * décodent pas sous Node : une carte vaut alors `null` et le modèle passe sans
 * elle, sauf si le gestionnaire de chargement du `chargeur` fourni sait la
 * produire. Rend `null` — jamais une exception — sur un fichier illisible.
 */
export function analyserGlb(donnees: ArrayBuffer, chargeur = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)): Promise<LectureFichier | null> {
  const global = globalThis as { self?: unknown };
  if (typeof global.self === 'undefined') global.self = globalThis;
  return new Promise<LectureFichier | null>((resoudre) => {
    try {
      chargeur.parse(donnees, '', (gltf) => { void lectureDepuisGltf(gltf).then(resoudre, () => resoudre(null)); }, () => resoudre(null));
    } catch {
      resoudre(null);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. La conformation : ce que le lecteur a lu → une figurine au repère
// ---------------------------------------------------------------------------

/** Ce que le lecteur a lu, avant conformation. */
export interface ModeleLu {
  /** Une scène par niveau de détail ; l'index 0 est le lod0, obligatoire, et le seul retenu. */
  niveaux: readonly THREE.Object3D[];
  /** Les clips du lod0, tels que livrés. */
  clips: readonly THREE.AnimationClip[];
  /** Vrai si le fichier est un kit national, faux pour une géométrie de base. */
  kit: boolean;
}

/** Un modèle conformé. */
export interface ModeleCharge {
  /** La figurine : orientée, au gabarit. Nommée `figurine_modele`. */
  objet: THREE.Group;
  /** Les clips livrés, tous noms confondus ; `nomsClips()` en tire les six connus. */
  clips: readonly THREE.AnimationClip[];
  /** Nombre de modèles retenus : toujours 1, le lod0. */
  lods: number;
  kit: boolean;
  /** Hauteur de la figurine au gabarit, en mètres (une case vaut un mètre). */
  hauteur: number;
}

/** Les noms de clips connus parmi ceux d'un modèle, dans l'ordre de la spécification. */
export function nomsClips(clips: readonly THREE.AnimationClip[]): NomClip[] {
  const presents = new Set(clips.map((c) => c.name));
  return NOMS_CLIPS.filter((nom) => presents.has(nom));
}

/**
 * Conforme un modèle lu : rotation de l'avant, gabarit, lod0 seul.
 *
 * Le niveau est **cloné** (squelettes compris) plutôt que déplacé : une lecture
 * peut servir deux conformations, et l'ajouter à la seconde la volerait à la
 * première. La rotation et le gabarit vont sur des groupes enveloppants, jamais
 * sur les nœuds du modèle : les clips animent ces nœuds par leur nom, et une
 * transformation posée dessus serait écrasée à la première image.
 *
 * Deux groupes, et non un : three compose une transformation en `T·R·S`,
 * l'échelle avant la rotation ; une échelle posée sur le même nœud que la
 * rotation s'appliquerait dans le repère **du fichier**, et la longueur du
 * gabarit tomberait sur la largeur du modèle. Le gabarit va donc sur
 * l'enveloppe, la rotation sur un groupe intérieur qu'il enveloppe.
 */
export function conformerModele(lu: ModeleLu, gabarit: Gabarit = 'b'): ModeleCharge {
  const premier = lu.niveaux[0];
  if (!premier) throw new Error('un modèle lu doit porter au moins son lod0');
  const objet = new THREE.Group();
  objet.name = NOM_FIGURINE;
  const [gx, gy, gz] = PROPORTIONS[gabarit];
  objet.scale.set(gx, gy, gz);
  const orientation = new THREE.Group();
  orientation.name = NOM_ORIENTATION;
  orientation.rotation.y = ROTATION_AVANT;
  objet.add(orientation);

  const lod0 = clonerSquelette(premier);
  lod0.name = 'lod0';
  orientation.add(lod0);

  objet.updateMatrixWorld(true);
  const boite = new THREE.Box3().setFromObject(objet);
  const hauteur = boite.isEmpty() ? 0 : Math.max(0, boite.max.y);
  return { objet, clips: lu.clips, lods: 1, kit: lu.kit, hauteur };
}

// ---------------------------------------------------------------------------
// 5. Le lecteur de clips : un mixer, six noms, un fondu
// ---------------------------------------------------------------------------

/** Durée du fondu entre deux clips, en secondes : cent cinquante millisecondes. */
export const FONDU_CLIPS = 0.15;

/** Ce qui joue les clips d'une figurine conformée. */
export interface LecteurClips {
  /** Le clip qui joue, `null` avant le premier. */
  readonly courant: NomClip | null;
  /** Les clips connus que le modèle porte, dans l'ordre de la spécification. */
  readonly clips: readonly NomClip[];
  /** Vrai tant que le fondu du dernier `jouer` porte encore le poids. */
  readonly enTransition: boolean;
  /**
   * Fait jouer un clip, avec un fondu depuis celui qui joue. Un clip absent
   * retombe sur `repos` sans erreur, et `repos` absent laisse la pose telle
   * quelle. `duree`, en millisecondes, ajuste un clip qui ne boucle pas ; `0`
   * garde la durée naturelle. `fondu` à faux coupe net. La première image du
   * clip est appliquée tout de suite, sans attendre `avancer`.
   */
  jouer(nom: NomClip, duree?: number, fondu?: boolean): void;
  /** Avance le mixer de `dt` secondes ; vrai tant qu'un clip joue encore. */
  avancer(dt: number): boolean;
  dispose(): void;
}

/**
 * Prépare le mixer d'une figurine conformée. Chaque clip reçoit **une action
 * par niveau** (`lod0`, …), liée à ce niveau, que le mixer avance ensemble.
 * Rend `null` si le modèle ne porte aucun des six clips.
 */
export function creerLecteurClips(
  figurine: THREE.Object3D, clips: readonly THREE.AnimationClip[],
): LecteurClips | null {
  const noms = nomsClips(clips);
  if (noms.length === 0) return null;
  const niveaux: THREE.Object3D[] = [];
  figurine.traverse((o) => { if (/^lod\d$/.test(o.name)) niveaux.push(o); });
  const racines = niveaux.length > 0 ? niveaux : [figurine];
  const mixer = new THREE.AnimationMixer(figurine);
  const actions = new Map<NomClip, THREE.AnimationAction[]>();
  for (const nom of noms) {
    const clip = clips.find((c) => c.name === nom);
    if (!clip) continue;
    actions.set(nom, racines.map((racine) => {
      const action = mixer.clipAction(clip, racine);
      if (clipEnBoucle(nom)) action.setLoop(THREE.LoopRepeat, Infinity);
      else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      return action;
    }));
  }
  let courant: NomClip | null = null;
  /** Le temps du mixer, en secondes : la somme de ce que `avancer` lui a donné. */
  let tempsMixer = 0;
  /** L'instant du mixer où le fondu en cours aura fini ; `-1` sans fondu. */
  let finFondu = -1;
  /** Le clip qu'un `update` vient de terminer, à traiter une fois sorti du mixer. */
  let termine: NomClip | null = null;

  function jouer(nom: NomClip, duree = 0, fondu = true): void {
    const cible: NomClip = actions.has(nom) ? nom : 'repos';
    const liste = actions.get(cible);
    if (!liste || cible === courant) return;
    const anciennes = courant === null ? [] : actions.get(courant) ?? [];
    liste.forEach((action, i) => {
      action.reset();
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      if (!clipEnBoucle(cible) && duree > 0) action.setDuration(duree / 1000);
      action.setEffectiveWeight(1);
      action.play();
      const ancienne = anciennes[i];
      if (!ancienne) return;
      if (fondu) action.crossFadeFrom(ancienne, FONDU_CLIPS, false);
      else ancienne.stop();
    });
    courant = cible;
    finFondu = fondu && anciennes.length > 0 ? tempsMixer + FONDU_CLIPS : -1;
    // La première image du clip s'applique tout de suite : un rig dont le
    // mixer n'avance pas resterait sinon dans sa pose de liaison.
    mixer.update(0);
  }

  // Un clip qui ne boucle pas rend la main au repos, sauf `hors_jeu`. L'événement
  // part du milieu d'un `update` : on le note et on agit une fois sorti, parce
  // que `jouer` appelle lui-même le mixer et qu'un mixer ne se rentre pas.
  mixer.addEventListener('finished', (e) => {
    const nom = [...actions].find(([, liste]) => liste.includes(e.action))?.[0];
    if (nom !== undefined && nom === courant && !clipEnBoucle(nom)) termine = nom;
  });

  return {
    get courant(): NomClip | null { return courant; },
    get enTransition(): boolean { return tempsMixer < finFondu; },
    clips: noms,
    jouer,
    avancer(dt: number): boolean {
      if (courant === null) return false;
      tempsMixer += dt;
      mixer.update(dt);
      if (termine !== null) {
        const fini = termine;
        termine = null;
        if (fini === courant && fini !== 'hors_jeu') jouer('repos');
      }
      return clipEnBoucle(courant) || (actions.get(courant) ?? []).some((a) => a.isRunning());
    },
    dispose(): void {
      mixer.stopAllAction();
      for (const clip of clips) mixer.uncacheClip(clip);
      actions.clear();
      courant = null;
      finFondu = -1;
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Le choix du fichier : le kit de la nation, puis la base
// ---------------------------------------------------------------------------

/**
 * Le nom de fichier d'un niveau de détail : le gabarit `{id}_lod{lod}.glb` de
 * `doc/11-assets-spec.md` §4.5, celui que `nomModele()` applique côté
 * spécification. Un test vérifie que les deux composent le même nom.
 */
export function nomFichierModele(id: string, lod: NiveauLod): string {
  return `${id}_lod${lod}.glb`;
}

/**
 * Les identifiants à essayer pour un couple (unité, nation), dans l'ordre de
 * repli : le kit national, puis la géométrie de base — l'ordre que le jeu
 * applique aussi à ses images cuites (`Atlas.idPour`, `render2d/atlas.ts`).
 */
export function candidatsModele(cle: CleUnite, pays: CodePays | null): { id: string; kit: boolean }[] {
  const base = { id: `unite_${cle}_base`, kit: false };
  return pays === null ? [base] : [{ id: `kit_${pays}_${cle}`, kit: true }, base];
}

/** Ce qu'un chargeur de modèles se laisse donner : ni réseau, ni fichier supposé. */
export interface OptionsChargeur {
  /** Ce qui lit un fichier par son nom, ou rend `null` s'il n'existe pas. */
  lecteur: (nom: string) => Promise<LectureFichier | null>;
  /**
   * L'inventaire des fichiers livrés (`src/serveur/modeles.ts`), ou `null`
   * quand il est inconnu — chaque candidat est alors essayé. Par défaut : inconnu.
   */
  inventaire?: () => Promise<InventaireModeles | null>;
}

/** Ce qui charge et conforme le modèle d'un couple (unité, nation). */
export type ChargeurModeles = (cle: CleUnite, pays?: CodePays | null) => Promise<ModeleCharge | null>;

/**
 * Fabrique un chargeur, avec ses propres mémos. Il choisit le fichier d'une
 * unité **pour une nation donnée** — le kit national s'il est livré, sinon la
 * géométrie de base —, le lit et le conforme au gabarit de la nation.
 *
 * L'inventaire décide de ce qui est demandé : s'il est connu, seuls les fichiers
 * qu'il liste sont lus, et un couple sans fichier ne coûte aucune lecture ; s'il
 * est inconnu, chaque candidat est essayé, un nom au plus une fois. Seul le
 * lod0 est demandé. Une lecture est mémorisée par nom, le résultat conformé par
 * couple. Rend `null` — jamais une exception — quand rien n'existe.
 */
export function creerChargeurModeles(options: OptionsChargeur): ChargeurModeles {
  const lectures = new Map<string, Promise<LectureFichier | null>>();
  const modeles = new Map<string, Promise<ModeleCharge | null>>();
  let inventaire: Promise<InventaireModeles | null> | null = null;

  const lire = (nom: string): Promise<LectureFichier | null> => {
    const memo = lectures.get(nom);
    if (memo) return memo;
    const promesse = options.lecteur(nom).catch(() => null);
    lectures.set(nom, promesse);
    return promesse;
  };

  return (cle, pays = null) => {
    const memoCle = `${pays ?? ''}:${cle}`;
    const memo = modeles.get(memoCle);
    if (memo) return memo;
    const promesse = (async (): Promise<ModeleCharge | null> => {
      inventaire = inventaire ?? (options.inventaire ?? (async () => null))().catch(() => null);
      const connu = await inventaire;
      for (const { id, kit } of candidatsModele(cle, pays)) {
        // Inventaire connu : ce qu'il liste, et rien d'autre ; inconnu : on essaie tout.
        const listes: readonly NiveauLod[] = connu ? connu.modeles[id] ?? [] : NIVEAUX_LOD;
        if (!listes.includes(0)) continue;
        const lod0 = await lire(nomFichierModele(id, 0));
        if (!lod0) continue;
        const style = pays === null ? null : chargerStyleNation(pays);
        return conformerModele({ niveaux: [lod0.scene], clips: lod0.clips, kit }, style ? gabaritDe(style, cle) : 'b');
      }
      return null;
    })();
    modeles.set(memoCle, promesse);
    return promesse;
  };
}
