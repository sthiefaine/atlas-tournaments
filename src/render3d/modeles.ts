/**
 * Les modèles livrés : **chargement** d'un GLB et **conformation** de ce qu'il
 * contient en une pièce prête pour la scène (`doc/16-realisme.md` §3.1, B0).
 *
 * Deux moitiés, séparées à dessein. La première est de l'I/O mince — un
 * `GLTFLoader`, un nom de fichier, un 404 mémorisé — et ne se teste pas sous
 * Node. La seconde est **pure** : elle prend ce que le chargeur a lu (une scène
 * par niveau de détail, des clips, kit ou base) et rend un objet orienté, mis au
 * gabarit, assemblé en niveaux de détail, teinté selon la règle du masque. C'est
 * elle que les tests exercent avec des groupes construits en mémoire.
 *
 * Ce que la conformation règle, et pourquoi :
 *
 * 1. **L'orientation.** La spécification impose l'avant en `+Z`
 *    (`doc/11-assets-spec.md` §4.2) ; le placeholder et le calque des unités
 *    regardent `+X` — le cap d'un déplacement est un angle autour de Y qui part
 *    de `+X`. On tourne donc le modèle à l'arrivée, et la spécification reste ce
 *    qu'elle est. Le signe est celui que three impose, vérifié par un test et
 *    non supposé : `+π/2` autour de Y envoie `+Z` sur `+X`.
 * 2. **L'échelle et le gabarit.** Une case vaut un mètre dans la spécification et
 *    une unité de scène dans le rendu : aucune échelle de taille sur un modèle
 *    livré. Le gabarit `a | b | c` de la nation, lui, s'applique au modèle comme
 *    au placeholder, avec les mêmes proportions.
 * 3. **Le masque et le liseré.** Une géométrie de base est neutre et prend la
 *    palette de la nation (ou du camp) ; un kit arrive peint et ne prend que la
 *    couleur de camp sur son liseré. Quand un matériau porte le masque d'équipe,
 *    le mélange `albédo × (1 − masque) + palette × masque` se fait dans le
 *    shader ; sans masque, on teinte `color`.
 * 4. **Les niveaux de détail.** Un `THREE.LOD` aux distances des paliers de zoom ;
 *    un seul niveau livré est posé tel quel, sans seuil.
 *
 * Le remplacement d'un placeholder reste **un changement de fichier** : aucune
 * unité n'est connue ici par son nom, seulement par ce que ses fichiers disent.
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  CLIPS_ANIMATION, estInventaireModeles, gabaritDe, NIVEAUX_LOD,
  type ClipAnimation, type Gabarit, type InventaireModeles, type NiveauLod, type StyleNation,
} from '../assets/spec';
import { chargerStyleNation } from '../assets/styles';
import { paletteDe } from '../render/palettes';
import type { CampId, CleUnite, CodePays, Couleur, Palette } from '../schemas/types';
import { PALIERS_DISTANCE } from './camera';

// ---------------------------------------------------------------------------
// 1. Le vocabulaire : clips, gabarits, seuils
// ---------------------------------------------------------------------------

/** Le nom d'un clip logique : la liste fermée de `doc/11-assets-spec.md` §5.4. */
export type NomClip = ClipAnimation;

/** Les six noms, dans l'ordre de la spécification. */
export const NOMS_CLIPS: readonly NomClip[] = CLIPS_ANIMATION;

/** Vrai si `nom` est l'un des six clips connus. */
export function estNomClip(nom: string): nom is NomClip {
  return (NOMS_CLIPS as readonly string[]).includes(nom);
}

/**
 * `repos` et `deplacement` bouclent ; les quatre autres jouent une fois puis
 * rendent la main au repos. C'est la règle de `doc/11` §5.4 (« `repos` boucle
 * toujours, `hors_jeu` jamais »), tenue ici parce qu'un GLB ne porte pas de
 * drapeau de boucle : c'est le rendu qui décide.
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
 * La rotation qui amène l'avant d'un modèle livré (`+Z`) sur l'avant du rendu
 * (`+X`) : `+π/2` autour de Y dans la convention de three. Le signe est vérifié
 * par `tests/render3d/modeles.test.ts` — `−π/2` enverrait l'avant sur `−X`.
 */
export const ROTATION_AVANT = Math.PI / 2;

/**
 * Les distances de bascule des niveaux de détail, en unités de scène : lod0
 * jusqu'au premier seuil, lod1 jusqu'au second, lod2 au-delà.
 *
 * Elles se déduisent des paliers de zoom plutôt que d'être écrites : lod0 pour
 * les quatre premiers paliers (jusqu'à 13), lod1 pour 17,5 et 24, lod2 pour 33
 * et 45. Chaque seuil est posé **à mi-chemin** entre deux paliers, pour qu'une
 * unité au centre de la vue ne tombe jamais exactement sur une bascule — au
 * palier 13, tout ce qui entoure la cible reste en lod0, seul le bord du champ
 * passe en lod1. À 24 et au-delà, une figurine fait moins de trente pixels : le
 * budget de `doc/10` §9.2 (2 000 triangles par unité) est celui du lod1.
 */
export const SEUILS_LOD: readonly [number, number] = [
  (PALIERS_DISTANCE[3] + PALIERS_DISTANCE[4]) / 2,
  (PALIERS_DISTANCE[5] + PALIERS_DISTANCE[6]) / 2,
];

/** Hystérésis des bascules : cinq pour cent, pour qu'un léger recul ne fasse pas clignoter. */
const HYSTERESIS_LOD = 0.05;

/** Nom du groupe qui porte la figurine, celui que le calque enfonce et anime. */
export const NOM_FIGURINE = 'figurine_modele';

/** Nom du groupe intérieur qui ramène l'avant du fichier (`+Z`) sur celui du rendu (`+X`). */
export const NOM_ORIENTATION = 'orientation';

/** Nom de l'objet `THREE.LOD` dans une figurine à plusieurs niveaux. */
export const NOM_NIVEAUX = 'niveaux_de_detail';

// ---------------------------------------------------------------------------
// 2. Le masque d'équipe dans le shader
// ---------------------------------------------------------------------------

/**
 * Le masque d'un matériau, tenu **à côté** de lui plutôt que dans `userData` :
 * `Material.clone()` sérialise `userData` en JSON, ce qui ferait d'une texture
 * une description de texture. Une `WeakMap` suit les clones sans rien retenir.
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

/** La clé de programme partagée par tous les matériaux masqués : un seul shader compilé. */
const CLE_PROGRAMME_MASQUE = 'atlas_masque_equipe';

/**
 * Fait mélanger la couleur d'équipe par le masque, dans le shader standard :
 * `albédo × (1 − masque) + couleur × masque`, juste après la lecture de la carte
 * d'albédo. `USE_UV` est défini par nous, parce que three ne déclare `vUv` que
 * si un matériau a une raison de le faire — et un modèle de base sans carte
 * d'albédo n'en aurait aucune. La couleur reste un uniforme : deux unités d'un
 * même modèle partagent le programme et diffèrent par leur uniforme.
 */
export function appliquerMasque(
  materiau: THREE.MeshStandardMaterial, masque: THREE.Texture, couleur: THREE.Color,
): void {
  materiau.defines = { ...(materiau.defines ?? {}), USE_UV: '' };
  const uniformes = {
    atlasMasqueEquipe: { value: masque },
    atlasCouleurEquipe: { value: couleur },
  };
  materiau.onBeforeCompile = (shader): void => {
    Object.assign(shader.uniforms, uniformes);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D atlasMasqueEquipe;\nuniform vec3 atlasCouleurEquipe;',
      )
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, atlasCouleurEquipe, texture2D( atlasMasqueEquipe, vUv ).r );',
      );
  };
  materiau.customProgramCacheKey = (): string => CLE_PROGRAMME_MASQUE;
  masques.set(materiau, masque);
  materiau.needsUpdate = true;
}

/** La couleur d'équipe que chaque matériau masqué mélange, pour la retrouver au ternissement. */
const couleursMasquees = new WeakMap<THREE.Material, THREE.Color>();

/** La couleur d'équipe mélangée par le masque d'un matériau, ou `null` s'il n'en a pas. */
export function couleurMasquee(materiau: THREE.Material): THREE.Color | null {
  return couleursMasquees.get(materiau) ?? null;
}

/**
 * Le double terni d'une couleur d'équipe : les mêmes nombres que
 * `Materiaux.terni()` (un quart de la saturation, les deux tiers de la clarté),
 * pour qu'une zone masquée ternisse comme le reste de la pièce. Un test vérifie
 * que les deux calculs restent alignés.
 */
export function couleurTernie(couleur: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  couleur.getHSL(hsl, THREE.SRGBColorSpace);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.25, hsl.l * 0.62, THREE.SRGBColorSpace);
}

// ---------------------------------------------------------------------------
// 3. La teinte : quelle couleur pour quel matériau
// ---------------------------------------------------------------------------

/** Ce que la teinte a besoin de savoir : le style de la nation, kit ou base. */
export interface OptionsTeinte {
  /** Le style national du camp, s'il est connu : c'est lui qui donne la palette. */
  style?: StyleNation | null;
  /** Vrai pour un kit national, qui arrive peint. */
  kit?: boolean;
}

/**
 * La règle de couleur d'un matériau, par son nom, pure et testée.
 *
 * Sur une **base** (neutre) : `mat_corps` prend la couleur principale,
 * `mat_details` la sombre, et par tolérance `equipe*` la principale et
 * `accent*` le premier accent — les noms qu'un premier lot pourrait livrer.
 * Sur un **kit** (peint) : rien du corps n'est touché ; seuls les matériaux
 * `equipe*` — le liseré que le kit porte lui-même — prennent la couleur du camp.
 * `null` dit « laisser tel quel ».
 */
export function couleurPour(
  nomMateriau: string, kit: boolean, palette: Palette & { accents?: readonly Couleur[] }, lisere: Couleur,
): Couleur | null {
  const nom = nomMateriau.toLowerCase();
  if (kit) return nom.startsWith('equipe') ? lisere : null;
  if (nom === 'mat_corps' || nom.startsWith('equipe')) return palette.main;
  if (nom === 'mat_details') return palette.dark;
  if (nom.startsWith('accent')) return palette.accents?.[0] ?? palette.light;
  return null;
}

/**
 * Teinte un modèle conformé pour un camp. Les matériaux recolorés sont
 * **clonés** avant de l'être : un clone d'objet partage ses matériaux avec
 * l'original, et teinter en place repeindrait toutes les unités du même type.
 * Un matériau qui porte le masque d'équipe garde son albédo et mélange la
 * couleur dans le shader ; les autres prennent la couleur dans `color`.
 */
export function teinterModele(
  objet: THREE.Object3D, camp: CampId | null, options: OptionsTeinte = {},
): THREE.MeshStandardMaterial[] {
  const kit = options.kit ?? false;
  const palette = options.style?.palette ?? paletteDe(camp);
  const lisere = paletteDe(camp).main;
  // Les clones créés ici n'appartiennent qu'à cet objet : c'est à qui le retire
  // de la scène de les libérer, et il faut pour cela savoir lesquels.
  const clones: THREE.MeshStandardMaterial[] = [];
  objet.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    n.castShadow = true;
    n.receiveShadow = true;
    const liste: THREE.Material[] = Array.isArray(n.material) ? n.material : [n.material];
    const teintes = liste.map((m) => {
      if (!(m instanceof THREE.MeshStandardMaterial)) return m;
      const couleur = couleurPour(m.name, kit, palette, lisere);
      if (couleur === null) return m;
      const teinte = m.clone();
      const masque = masqueDe(m);
      if (masque) {
        const c = new THREE.Color(couleur);
        appliquerMasque(teinte, masque, c);
        couleursMasquees.set(teinte, c);
      } else {
        teinte.color.set(couleur);
      }
      clones.push(teinte);
      return teinte;
    });
    n.material = Array.isArray(n.material) ? teintes : teintes[0]!;
  });
  return clones;
}

// ---------------------------------------------------------------------------
// 4. La conformation : ce que le chargeur a lu → une pièce prête
// ---------------------------------------------------------------------------

/** Ce que le chargeur a lu, avant conformation. */
export interface ModeleLu {
  /** Une scène par niveau de détail, dans l'ordre : l'index 0 est le lod0, obligatoire. */
  niveaux: readonly THREE.Object3D[];
  /** Les clips du lod0, tels que livrés. */
  clips: readonly THREE.AnimationClip[];
  /** Vrai si le fichier est un kit national, faux pour une géométrie de base. */
  kit: boolean;
}

/** Un modèle conformé, prêt à être cloné dans la scène. */
export interface ModeleCharge {
  /** La figurine : orientée, au gabarit, en niveaux de détail. Nommée `figurine_modele`. */
  objet: THREE.Group;
  /** Les clips livrés, tous noms confondus ; `nomsClips()` en tire les six connus. */
  clips: readonly THREE.AnimationClip[];
  /** Nombre de niveaux de détail livrés, de 1 à 3. */
  lods: number;
  kit: boolean;
  /** Hauteur de la figurine au gabarit, en unités de scène : là où s'accroche l'étiquette. */
  hauteur: number;
}

/** Les noms de clips connus parmi ceux d'un modèle, dans l'ordre de la spécification. */
export function nomsClips(clips: readonly THREE.AnimationClip[]): NomClip[] {
  const presents = new Set(clips.map((c) => c.name));
  return NOMS_CLIPS.filter((nom) => presents.has(nom));
}

/**
 * Clone une figurine, squelettes compris : `Object3D.clone()` copierait un
 * `SkinnedMesh` en le laissant lié aux os de l'original, et deux unités
 * partageraient alors une seule pose.
 */
export function clonerFigurine(objet: THREE.Object3D): THREE.Object3D {
  return clonerSquelette(objet);
}

// ---------------------------------------------------------------------------
// 4 bis. Le lecteur de clips : un mixer, six noms, un fondu
// ---------------------------------------------------------------------------

/** Durée du fondu entre deux clips, en secondes : cent cinquante millisecondes. */
export const FONDU_CLIPS = 0.15;

/** Ce qui joue les clips d'une figurine : le calque des unités et la vitrine s'en servent tous deux. */
export interface LecteurClips {
  /** Le clip qui joue, `null` avant le premier. */
  readonly courant: NomClip | null;
  /** Les clips connus que le modèle porte, dans l'ordre de la spécification. */
  readonly clips: readonly NomClip[];
  /**
   * Vrai tant que le fondu du dernier `jouer` n'a pas fini de porter le poids
   * sur le clip courant : un appelant qui cesse d'avancer le mixer avant la fin
   * du fondu figerait la pièce sur la dernière image du clip précédent.
   */
  readonly enTransition: boolean;
  /**
   * Fait jouer un clip, avec un fondu depuis celui qui joue. Un clip absent
   * retombe sur `repos` sans erreur — le validateur l'a déjà signalé à la
   * livraison (`doc/10` §7.3) — et `repos` absent laisse la pose telle quelle.
   * `duree`, en millisecondes, ajuste un clip qui ne boucle pas au geste qu'il
   * accompagne ; `0` garde la durée naturelle. Un clip qui boucle garde toujours
   * sa cadence propre. `fondu` à faux coupe net et saute à la première image
   * du clip demandé — c'est ce qu'il faut sous réduction des animations. La
   * première image du clip est appliquée tout de suite, sans attendre `avancer`.
   */
  jouer(nom: NomClip, duree?: number, fondu?: boolean): void;
  /** Avance le mixer de `dt` secondes ; vrai tant qu'un clip joue encore. */
  avancer(dt: number): boolean;
  dispose(): void;
}

/**
 * Prépare le mixer d'une figurine conformée. Le mixer a pour racine la
 * figurine entière ; ses niveaux de détail sont des sous-arbres aux nœuds
 * homonymes, et un clip lie ses pistes par nom de nœud : chaque clip reçoit
 * donc **une action par niveau**, liée à ce niveau, et le mixer les avance
 * toutes ensemble pour qu'un changement de niveau ne fasse pas sauter la pose.
 * Le coût de ces actions supplémentaires se mesure en A6 (`doc/16` §2).
 *
 * Rend `null` si le modèle ne porte aucun des six clips : un placeholder, ou un
 * modèle rigide livré sans animation, n'a pas de lecteur.
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
    // La première image du clip s'applique tout de suite. Sans cela, un rig
    // dont le mixer n'avance pas — animations réduites, unité qui a joué —
    // resterait dans sa pose de liaison, bras en croix. Un pas de zéro ne fait
    // ni avancer ni finir un clip : three le court-circuite.
    mixer.update(0);
  }

  // Un clip qui ne boucle pas rend la main au repos de lui-même. L'événement
  // part du milieu d'un `update` : on le note et on agit une fois sorti, parce
  // que `jouer` appelle lui-même le mixer et qu'un mixer ne se rentre pas. La
  // demande des animations, elle, n'est pas touchée : c'est à l'appelant de ne
  // pas relancer un tir déjà joué.
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
        if (fini === courant) jouer('repos');
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

/**
 * Conforme un modèle lu : rotation de l'avant, gabarit, niveaux de détail.
 *
 * Les niveaux sont **clonés** (squelettes compris) plutôt que déplacés : une
 * lecture de fichier est partagée par toutes les nations qui retombent sur la
 * même géométrie de base, et l'ajouter à deux `LOD` la volerait à l'un des deux.
 * La rotation et le gabarit vont sur des groupes enveloppants, jamais sur les
 * nœuds du modèle : les clips animent ces nœuds par leur nom, et une
 * transformation posée dessus serait écrasée à la première image.
 *
 * Deux groupes, et non un : three compose une transformation en `T·R·S`,
 * l'échelle avant la rotation, donc une échelle posée sur le même nœud que la
 * rotation s'appliquerait dans le repère **du fichier** — la longueur du
 * gabarit tomberait sur la largeur du modèle. Le gabarit se lit dans le repère
 * du rendu (longueur en X, largeur en Z) : il va sur l'enveloppe, et la
 * rotation sur un groupe intérieur qu'il enveloppe.
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

  const niveaux = lu.niveaux.slice(0, 3).map((n, i) => {
    const copie = clonerSquelette(n);
    copie.name = `lod${i}`;
    return copie;
  });
  if (niveaux.length === 1) {
    orientation.add(niveaux[0]!);
  } else {
    // Un seul LOD sans seuil serait un objet de plus pour rien ; à partir de
    // deux niveaux, c'est three qui choisit à chaque image selon la caméra.
    const lod = new THREE.LOD();
    lod.name = NOM_NIVEAUX;
    niveaux.forEach((n, i) => lod.addLevel(n, i === 0 ? 0 : SEUILS_LOD[i - 1] ?? 0, i === 0 ? 0 : HYSTERESIS_LOD));
    orientation.add(lod);
  }

  objet.updateMatrixWorld(true);
  const boite = new THREE.Box3().setFromObject(objet);
  const hauteur = boite.isEmpty() ? 0 : Math.max(0, boite.max.y);
  return { objet, clips: lu.clips, lods: niveaux.length, kit: lu.kit, hauteur };
}

/**
 * Force un niveau de détail — la vitrine s'en sert pour juger un lod2 de près —
 * ou rend la main à three avec `null`. Sans `THREE.LOD` dans l'objet (un seul
 * niveau livré), il n'y a rien à forcer et l'appel ne fait rien.
 */
export function forcerLod(objet: THREE.Object3D, niveau: NiveauLod | null): void {
  objet.traverse((o) => {
    if (!(o instanceof THREE.LOD)) return;
    if (niveau === null) {
      o.autoUpdate = true;
      return;
    }
    o.autoUpdate = false;
    const choisi = Math.min(niveau, o.levels.length - 1);
    o.levels.forEach((l, i) => { l.object.visible = i === choisi; });
  });
}

/** Le niveau forcé d'un objet, `null` si three choisit. */
export function lodForce(objet: THREE.Object3D): NiveauLod | null {
  let resultat: NiveauLod | null = null;
  objet.traverse((o) => {
    if (!(o instanceof THREE.LOD) || o.autoUpdate) return;
    const i = o.levels.findIndex((l) => l.object.visible);
    if (i >= 0 && i <= 2) resultat = i as NiveauLod;
  });
  return resultat;
}

// ---------------------------------------------------------------------------
// 5. Le chargement : des fichiers, dans l'ordre de repli
// ---------------------------------------------------------------------------

/** Racine des modèles livrés par le générateur externe. */
export const RACINE_MODELES = '/assets/modeles';

/**
 * Le nom de fichier d'un niveau de détail : le gabarit `{id}_lod{lod}.glb` de
 * `doc/11-assets-spec.md` §4.5, celui que `nomModele()` applique côté
 * spécification. Un test vérifie que les deux composent le même nom ; le nom
 * sans suffixe n'est plus essayé.
 */
export function nomFichierModele(id: string, lod: NiveauLod): string {
  return `${id}_lod${lod}.glb`;
}

/**
 * Les identifiants à essayer pour un couple (unité, nation), dans l'ordre de
 * repli de `doc/10` §7.1 : le kit national, puis la géométrie de base.
 */
export function candidatsModele(cle: CleUnite, pays: CodePays | null): { id: string; kit: boolean }[] {
  const base = { id: `unite_${cle}_base`, kit: false };
  return pays === null ? [base] : [{ id: `kit_${pays}_${cle}`, kit: true }, base];
}

/** Une lecture de fichier : la scène, ses clips, rien de plus. */
export interface LectureFichier {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
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

/**
 * Tire d'un `GLTF` analysé la lecture qui nous sert, et attache le masque
 * d'équipe aux matériaux standard du modèle quand le fichier en porte un —
 * une image nommée `masque_equipe` (ou `team_mask`), la convention du
 * validateur, référencée par une texture du document. Un masque qui ne se
 * charge pas ne bloque jamais le modèle : il se teindra dans `color`.
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
          for (const m of liste) if (m instanceof THREE.MeshStandardMaterial) definirMasque(m, texture);
        });
      }
    } catch {
      // Le modèle vaut mieux sans son masque que pas du tout.
    }
  }
  return { scene: gltf.scene, clips: gltf.animations };
}

/** Analyse un GLB déjà en mémoire : le chemin des tests, sans réseau. */
export function analyserGlb(donnees: ArrayBuffer, chargeur = new GLTFLoader()): Promise<LectureFichier | null> {
  return new Promise<LectureFichier | null>((resoudre) => {
    try {
      chargeur.parse(donnees, '', (gltf) => { void lectureDepuisGltf(gltf).then(resoudre, () => resoudre(null)); }, () => resoudre(null));
    } catch {
      resoudre(null);
    }
  });
}

let chargeur: GLTFLoader | null = null;

/** Lit un seul fichier par le réseau. Rend `null` — jamais une exception — s'il n'existe pas. */
function lireFichierReseau(nom: string): Promise<LectureFichier | null> {
  return new Promise<LectureFichier | null>((resoudre) => {
    try {
      chargeur = chargeur ?? new GLTFLoader();
      chargeur.load(
        `${RACINE_MODELES}/${nom}`,
        (gltf) => { void lectureDepuisGltf(gltf).then(resoudre, () => resoudre(null)); },
        undefined,
        () => resoudre(null),
      );
    } catch {
      resoudre(null);
    }
  }).catch(() => null);
}

// ---------------------------------------------------------------------------
// 6. L'inventaire : savoir d'avance ce qui existe, au lieu de sonder
// ---------------------------------------------------------------------------

/** La route qui sert l'inventaire des fichiers livrés (`src/app/api/modeles/route.ts`). */
export const ROUTE_INVENTAIRE = '/api/modeles';

/**
 * Demande l'inventaire des modèles livrés. Toute erreur — pas de réseau, route
 * absente, réponse d'une autre forme — rend `null`, jamais une exception : le
 * chargeur retombe alors sur le sondage fichier par fichier. `requete` est
 * injectable pour les tests, qui n'ont pas de serveur.
 */
export async function lireInventaireReseau(
  requete: (url: string) => Promise<Response> = (url) => fetch(url, { cache: 'no-store' }),
): Promise<InventaireModeles | null> {
  try {
    const reponse = await requete(ROUTE_INVENTAIRE);
    if (!reponse.ok) return null;
    const corps: unknown = await reponse.json();
    return estInventaireModeles(corps) ? corps : null;
  } catch {
    return null;
  }
}

let inventairePartage: Promise<InventaireModeles | null> | null = null;

/**
 * L'inventaire de la page, demandé une fois : c'est ce qui remplace la
 * quarantaine de sondes en 404 qu'une page coûtait tant que rien n'est livré.
 * Un fichier déposé est vu au prochain chargement de page, pas avant — c'est
 * le prix d'une seule requête, et c'est un prix de développement.
 */
export function chargerInventaire(): Promise<InventaireModeles | null> {
  inventairePartage = inventairePartage ?? lireInventaireReseau();
  return inventairePartage;
}

/** Ce qu'un chargeur de modèles se laisse injecter : les tests n'ont ni réseau ni fichier. */
export interface OptionsChargeur {
  /** L'inventaire des fichiers livrés, ou `null` pour sonder ; par défaut, la route `/api/modeles`. */
  inventaire?: () => Promise<InventaireModeles | null>;
  /** Ce qui lit un fichier par son nom ; par défaut `GLTFLoader` sous `RACINE_MODELES`. */
  lecteur?: (nom: string) => Promise<LectureFichier | null>;
}

/** Ce qui charge et conforme le modèle d'un couple (unité, nation). */
export type ChargeurModeles = (cle: CleUnite, pays?: CodePays | null) => Promise<ModeleCharge | null>;

/**
 * Fabrique un chargeur, avec ses propres mémos. Il charge et conforme le
 * modèle d'une unité **pour une nation donnée**, dans l'ordre de repli de
 * `doc/10-rendu-3d.md` §7.1 :
 *
 * ```
 * 1. kit national      kit_<pays>_<unite>_lod0.glb   (+ _lod1, _lod2 s'ils existent)
 * 2. géométrie de base unite_<cle>_base_lod0.glb     (idem)
 * 3. rien              → le placeholder reste en place
 * ```
 *
 * L'inventaire décide de ce qui est demandé. S'il est connu, seuls les
 * fichiers qu'il liste sont lus, aux niveaux qu'il liste, et un couple sans
 * fichier ne coûte **aucune** requête. S'il vaut `null` — route absente, hors
 * ligne —, chaque candidat est sondé comme avant, et un 404 n'est demandé
 * qu'une fois. Dans les deux cas le lod0 est obligatoire, les niveaux suivants
 * sont pris dans l'ordre et l'on s'arrête au premier absent — un lod2 sans
 * lod1 ne serait pas un jeu de niveaux. Une lecture est mémorisée par nom (une
 * base sur laquelle retombent vingt-trois nations n'est lue qu'une fois), le
 * résultat conformé par couple. Rend `null` — jamais une exception — quand rien
 * n'existe, ce qui est l'état normal du projet.
 */
export function creerChargeurModeles(options: OptionsChargeur = {}): ChargeurModeles {
  const lectures = new Map<string, Promise<LectureFichier | null>>();
  const modeles = new Map<string, Promise<ModeleCharge | null>>();
  const lireUn = options.lecteur ?? lireFichierReseau;
  let inventaire: Promise<InventaireModeles | null> | null = null;

  const lire = (nom: string): Promise<LectureFichier | null> => {
    const memo = lectures.get(nom);
    if (memo) return memo;
    const promesse = lireUn(nom).catch(() => null);
    lectures.set(nom, promesse);
    return promesse;
  };

  return (cle, pays = null) => {
    const memoCle = `${pays ?? ''}:${cle}`;
    const memo = modeles.get(memoCle);
    if (memo) return memo;
    const promesse = (async (): Promise<ModeleCharge | null> => {
      inventaire = inventaire ?? (options.inventaire ?? chargerInventaire)().catch(() => null);
      const connu = await inventaire;
      for (const { id, kit } of candidatsModele(cle, pays)) {
        // Inventaire connu : ce qu'il liste, et rien d'autre ; inconnu : on sonde tout.
        const listes: readonly NiveauLod[] = connu ? connu.modeles[id] ?? [] : NIVEAUX_LOD;
        if (!listes.includes(0)) continue;
        const lod0 = await lire(nomFichierModele(id, 0));
        if (!lod0) continue;
        const niveaux: THREE.Object3D[] = [lod0.scene];
        for (const lod of [1, 2] as const) {
          if (!listes.includes(lod)) break;
          const suivant = await lire(nomFichierModele(id, lod));
          if (!suivant) break;
          niveaux.push(suivant.scene);
        }
        const style = pays === null ? null : chargerStyleNation(pays);
        return conformerModele({ niveaux, clips: lod0.clips, kit }, style ? gabaritDe(style, cle) : 'b');
      }
      return null;
    })();
    modeles.set(memoCle, promesse);
    return promesse;
  };
}

/** Le chargeur de la page : l'inventaire de la route, les fichiers par le réseau. */
export const chargerModele: ChargeurModeles = creerChargeurModeles();
