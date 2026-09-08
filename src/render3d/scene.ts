/**
 * Le moteur graphique et sa **boucle paresseuse**.
 *
 * Un tactique au tour par tour est immobile la plupart du temps : faire tourner
 * une boucle 3D à soixante images par seconde pour redessiner deux fois la même
 * chose vide une batterie en une heure. Le rendu ne dessine donc que lorsque
 * quelque chose a changé, qu'une animation court ou que des particules tombent —
 * et, au repos, **une image par seconde** suffit à faire vivre l'eau.
 *
 * Le moteur est `WebGPURenderer` (three r170, `three/webgpu`, depuis le
 * 7 septembre 2026) : il tourne sur **WebGPU** quand le navigateur donne un
 * adaptateur, et sur son **dos WebGL 2** sinon — mêmes nuanceurs, compilés en
 * GLSL au lieu de WGSL. Le choix se fait **avant** de construire le moteur
 * (`choisirBackend`) : `navigator.gpu` absent, ou `requestAdapter()` qui rend
 * `null` (Chromium sans carte, SwiftShader…), et c'est `forceWebGL`. Le
 * moteur s'initialise ensuite de façon **asynchrone** (`renderer.init()`), et
 * rien ne se dessine avant : `creerScene3d` reste synchrone — il crée le
 * canevas et l'objet —, expose la promesse `prete`, et `dessiner()` ne fait
 * rien tant qu'elle n'est pas tenue. L'environnement (`environnement.ts`) se
 * cuit juste après `init()`, parce que son générateur **rend**.
 *
 * Le reste est de l'hygiène : espace de couleur sRGB en sortie, cartographie
 * tonale filmique (c'est elle qui empêche un soleil d'été de brûler les blancs),
 * ombres PCF douces, ratio de pixels borné à 2 — au-delà, on paie quatre fois le
 * coût pour un gain invisible — et un `ResizeObserver` plutôt qu'un écouteur de
 * fenêtre, pour suivre aussi les changements de mise en page.
 *
 * Depuis le lot A de `16-realisme.md` (6 septembre 2026), la scène porte aussi
 * la **carte d'environnement** et, selon la qualité choisie, la **chaîne de
 * post-traitement** (`postraitement.ts`), qui remplace `renderer.render` dans
 * `dessiner()`. La chaîne ne tourne jamais seule : elle ne dessine que quand
 * la boucle le demande, exactement comme le rendu direct. En qualité `auto`,
 * les premières images sont **mesurées** sans elle, processeur graphique
 * compris, et elle ne s'allume que si l'appareil suit (`render/qualite.ts`) ;
 * une fois allumée, la **cadence** entre deux images consécutives est suivie,
 * et la chaîne s'éteint pour la session si elle fait manquer une image sur
 * deux. Ses modules sont chargés par `import()` au moment de s'allumer :
 * l'accueil, en `basse`, ne les télécharge pas.
 *
 * La **première image d'un moteur coûtait une seconde**, et c'est la seule
 * chose que le portage à WebGPU ait rendue pire. Mesuré le 8 septembre 2026 sur
 * le plateau de la mission 1 à 2560 × 1600, l'image suivante coûtant 2,5 ms :
 * **0,9 à 1,3 s sur WebGPU** (1,6 s pilote froid), **5 s sur le dos WebGL**
 * (15 s à froid). C'est la traduction TSL → WGSL du système de nœuds, en
 * JavaScript, plus la création des pipelines : le fil principal était bloqué,
 * souris comprise, au moment précis où le plateau apparaît. Deux remèdes,
 * posés le 8 septembre au soir : **moins de programmes** (`programmes.ts`, qui
 * efface les fausses différences dont three sépare ses clés) et un
 * **préchauffage** par lots (`prechauffage.ts`, et la méthode `prechauffer`
 * ci-dessous), qui compile tout d'avance et hors du fil principal. Le
 * `compileAsync` de three **fonctionne**, contrairement à ce qui était écrit
 * ici : il ne trouvait aucun objet parce qu'il projette la scène contre un
 * tronc de vue jamais renseigné avant la première image, et il suffit
 * d'éteindre `frustumCulled` le temps du préchauffage — c'est `prechauffage.ts`
 * qui l'explique.
 *
 * La **calibration** attend une barrière du processeur graphique, et WebGPU
 * n'en a **aucune de synchrone** : la mesure est donc asynchrone. Une image
 * mesurée part, et sa durée n'est retenue que lorsque le processeur graphique
 * a fini (`renderer.waitForGPU()`, c'est-à-dire `onSubmittedWorkDone` ; sur le
 * dos WebGL, `readPixels` d'un pixel, la seule barrière que WebGL ait — la
 * fence de `waitForGPU` y est scrutée à chaque image d'écran, ce qui arrondit
 * toute mesure à seize millisecondes). Une seule mesure court à la fois ; si la
 * boucle dessine d'autres images pendant qu'elle attend, la durée retenue les
 * englobe — elle **surestime**, jamais l'inverse, et une surestimation ne peut
 * qu'éteindre une chaîne, pas l'allumer sur un appareil qui ne suit pas.
 *
 * La **carte d'ombre** n'est recalculée que quand l'appelant le dit
 * (`dessiner(camera, { ombre })`) : en partie, la boucle ne dort jamais —
 * drapeaux, respiration des figurines — et redessiner 2048² d'ombres soixante
 * fois par seconde pour des porteurs immobiles était le premier coût de
 * l'image de base. Ce qui vaut une ombre se décide dans `index.ts`. Le moteur
 * WebGPU n'a plus de `shadowMap.autoUpdate` global : la règle est portée par
 * chaque lumière (`light.shadow.autoUpdate`, `needsUpdate`, lues par
 * `ShadowNode.updateBefore`), et c'est ici qu'on la pose sur toutes celles de
 * la scène, à chaque image.
 */

import * as THREE from 'three/webgpu';

import {
  cadenceInsuffisante, composeurPossible, decisionComposeur, IMAGES_CADENCE, mediane, msCadence,
  msCalibration, QUALITE_PAR_DEFAUT, type BackendRendu, type QualiteRendu,
} from '../render/qualite';
import { webgl2Disponible, type MesuresRendu } from '../render/rendu';
import { creerEnvironnement, type Environnement } from './environnement';
import { compterFamilles, depuisInfo } from './mesures';
import { prechauffer } from './prechauffage';
import type { Composeur, creerComposeur } from './postraitement';

/** Ce que `creerScene3d` rend à l'appelant. */
export interface Scene3d {
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  readonly largeur: number;
  readonly hauteur: number;
  /**
   * Tenue quand le moteur est initialisé et l'environnement cuit : rien ne se
   * dessine avant, et `surChangement` est appelée à ce moment-là. Rejetée si
   * aucun dos ne se monte — ni WebGPU, ni WebGL 2 —, ou si la scène est
   * démontée avant.
   */
  readonly prete: Promise<void>;
  /** Vrai une fois `prete` tenue. */
  readonly pret: boolean;
  /** Le dos qui tourne réellement, ou `null` tant que le moteur n'est pas prêt. */
  readonly backend: BackendRendu | null;
  /**
   * Dessine une image — par la chaîne si elle est active — et rend le temps
   * d'envoi en millisecondes ; zéro, et rien, tant que le moteur n'est pas prêt.
   */
  dessiner(camera: THREE.Camera, options?: OptionsImage): number;
  /**
   * Compile d'avance les programmes de la scène, lot par lot
   * (`prechauffage.ts`) : c'est ce qui évite qu'une seconde de traduction TSL →
   * WGSL et de création de pipelines tombe sur la première image. Rend quand
   * tout est chaud, tout de suite si le moteur n'est pas prêt — l'image le
   * refera alors elle-même, au prix qu'elle a toujours payé.
   */
  prechauffer(camera: THREE.Camera): Promise<void>;
  /** Durée **médiane** d'envoi des dernières images, en millisecondes. */
  readonly msParImage: number;
  /**
   * La médiane des intervalles entre les dernières images **consécutives**, en
   * millisecondes ; `null` sans assez d'images. Mesurée avec ou sans chaîne.
   */
  readonly msCadence: number | null;
  /** Vrai quand la chaîne de post-traitement dessine l'image. */
  readonly composeurActif: boolean;
  /** Vrai tant que les premières images sont mesurées pour la qualité `auto`. */
  readonly calibration: boolean;
  /** Le coût de la dernière image dessinée. */
  mesures(): MesuresRendu;
  /** Change la qualité sans remonter : la chaîne se monte ou se démonte à l'image suivante. */
  reglerQualite(qualite: QualiteRendu): void;
  dispose(): void;
}

/** Ce que l'appelant sait d'une image et que la scène ne peut pas deviner. */
export interface OptionsImage {
  /**
   * Recalculer la carte d'ombre. Vrai par défaut ; l'appelant le met à faux
   * quand aucun porteur d'ombre, ni le soleil, ni la caméra n'ont bougé — la
   * respiration d'une figurine ou un drapeau qui flotte n'en valent pas une.
   * Pendant la calibration, l'ombre est recalculée quoi qu'il en soit : c'est
   * l'image d'une animation qu'on veut mesurer, pas celle d'un plateau figé.
   */
  ombre?: boolean;
  /**
   * Vrai si l'image précédente a été dessinée à l'image d'écran juste avant
   * celle-ci — la boucle n'a pas dormi entre les deux. C'est la condition pour
   * que l'intervalle mesuré dise ce que l'image coûte, et non depuis quand
   * personne n'a bougé.
   */
  continu?: boolean;
  /**
   * L'exposition de la cartographie tonale pour cette image : celle de
   * l'ambiance, multipliée par l'éclat d'un pouvoir. Inchangée si absente.
   */
  exposition?: number;
}

/** Réglages du contexte. */
export interface OptionsScene3d {
  /** Appelée à chaque redimensionnement, en pixels logiques. */
  surRedimension?(largeur: number, hauteur: number): void;
  /** Ratio de pixels maximal. Deux suffit, même sur un écran à trois. */
  ratioMax?: number;
  /** La qualité d'affichage : `auto` par défaut. */
  qualite?: QualiteRendu;
  /**
   * Lue à chaque décision : vrai quand le joueur ou l'appareil demande moins de
   * mouvement. La chaîne reste alors éteinte, quelle que soit la qualité.
   */
  reduit?(): boolean;
  /**
   * Appelée quand la chaîne a changé d'état, ou qu'il faut une image de plus
   * (moteur prêt, calibration en cours, module arrivé) : l'appelant salit sa boucle.
   */
  surChangement?(): void;
  /** Faux pour se passer de la carte d'environnement. Vrai par défaut. */
  environnement?: boolean;
}

/** Le ratio de pixels courant, borné. */
export function ratioPixels(fenetre: Window | null, max = 2): number {
  const brut = fenetre?.devicePixelRatio;
  const valeur = typeof brut === 'number' && brut > 0 ? brut : 1;
  return Math.max(1, Math.min(max, valeur));
}

/** Ce qu'on regarde du navigateur pour choisir le dos : `navigator.gpu`, s'il existe. */
export interface NavigateurGpu {
  gpu?: {
    requestAdapter(options?: { powerPreference?: 'high-performance' | 'low-power' }): Promise<unknown>;
  } | undefined;
}

/**
 * Sur quel dos le moteur va-t-il tourner ? WebGPU si le navigateur expose
 * `navigator.gpu` **et** rend un adaptateur ; WebGL 2 sinon. La question de
 * l'adaptateur doit être posée : Chromium expose `navigator.gpu` sur des
 * machines où `requestAdapter()` rend `null` — sans carte, sous SwiftShader —,
 * et three r170 ne retombe pas de lui-même sur WebGL dans tous ces cas, il
 * lève. Une demande qui lève vaut un refus. Pur : reçoit le navigateur.
 */
export async function choisirBackend(navigateur: NavigateurGpu | null | undefined): Promise<BackendRendu> {
  const gpu = navigateur?.gpu;
  if (!gpu || typeof gpu.requestAdapter !== 'function') return 'webgl';
  try {
    const adaptateur = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    return adaptateur ? 'webgpu' : 'webgl';
  } catch {
    return 'webgl';
  }
}

/**
 * Vrai si le navigateur courant peut faire tourner le moteur : WebGPU
 * (`navigator.gpu`, sans garantie d'adaptateur — c'est `choisirBackend` qui la
 * demande, et le repli prend alors) ou, à défaut, un contexte WebGL 2.
 */
export function moteur3dDisponible(): boolean {
  try {
    const g = globalThis as { navigator?: NavigateurGpu };
    if (g.navigator?.gpu) return true;
  } catch {
    // Un `navigator` qui refuse de se laisser lire n'a pas de WebGPU.
  }
  return webgl2Disponible();
}

/**
 * L'intensité d'environnement avant que l'éclairage n'ait parlé : celle d'un
 * jour clair. `eclairage.ts` la remplace dès la première ambiance appliquée.
 */
const INTENSITE_ENVIRONNEMENT_DEPART = 0.3;

/** Le dos qui tourne réellement : c'est le moteur qui le dit, pas la décision. */
function backendDe(renderer: THREE.WebGPURenderer): BackendRendu {
  return (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true ? 'webgpu' : 'webgl';
}

/**
 * Pose la règle des ombres sur toutes les lumières de la scène : jamais
 * automatiques, recalculées seulement quand l'image le demande. Un parcours de
 * la scène par image — quelques centaines d'objets, une fraction de ce que le
 * moteur parcourt lui-même pour trier ce qu'il dessine.
 */
function poserOmbres(scene: THREE.Scene, recalculer: boolean): void {
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if (l.isLight !== true || l.castShadow !== true || !l.shadow) return;
    l.shadow.autoUpdate = false;
    if (recalculer) l.shadow.needsUpdate = true;
  });
}

/**
 * Attend que le processeur graphique ait **fini** l'image mesurée. Sans cela
 * on mesurerait l'envoi des commandes, pas le dessin, et un appareil lent
 * passerait pour rapide. Sur WebGPU, `waitForGPU()` est `onSubmittedWorkDone`,
 * la barrière de l'API. Sur le dos WebGL, `finish()` ne suffit pas — Chrome le
 * traite comme un `flush()` et rend la main aussitôt ; sous SwiftShader, une
 * image d'une seconde se mesurait à zéro et la chaîne s'allumait sur
 * l'appareil le plus lent qui soit — et la fence de `waitForGPU()` y est
 * scrutée à chaque image d'écran, ce qui arrondit la mesure à seize
 * millisecondes : lire un pixel, lui, ne peut pas rendre avant que le dessin
 * soit terminé, et ne coûte que sur ces quelques images.
 */
const pixel = new Uint8Array(4);
function attendreDessin(renderer: THREE.WebGPURenderer, backend: BackendRendu): Promise<void> {
  if (backend === 'webgpu') return renderer.waitForGPU();
  try {
    const gl = renderer.getContext() as unknown as WebGL2RenderingContext | null;
    gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  } catch {
    // Un contexte perdu ne se mesure pas ; on gardera le temps d'envoi.
  }
  return Promise.resolve();
}

/**
 * Monte le moteur dans un conteneur. Lève tout de suite si ni WebGPU ni WebGL 2
 * n'est disponible ; sinon `prete` dit quand — ou si — le moteur a démarré.
 */
export function creerScene3d(conteneur: HTMLElement, options: OptionsScene3d = {}): Scene3d {
  if (!moteur3dDisponible()) {
    throw new Error('Rendu 3D indisponible : ni WebGPU ni WebGL 2.');
  }
  const doc = conteneur.ownerDocument;
  const fenetre = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.className = 'atlas-toile';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.outline = 'none';
  canvas.style.touchAction = 'none';
  canvas.setAttribute('tabindex', '0');
  conteneur.appendChild(canvas);

  const scene = new THREE.Scene();
  // L'intensité se pose sur la scène avant même que la carte existe : c'est
  // une propriété de la scène, que l'éclairage remplace quand il veut, et la
  // carte, elle, arrive avec le moteur.
  if (options.environnement !== false) scene.environmentIntensity = INTENSITE_ENVIRONNEMENT_DEPART;

  let renderer: THREE.WebGPURenderer | null = null;
  let backend: BackendRendu | null = null;
  let environnement: Environnement | null = null;
  let largeur = 1;
  let hauteur = 1;
  let exposition = 1;
  let vivante = true;
  /** Les derniers temps d'envoi, dont `msParImage` prend la médiane. */
  const envois: number[] = [];

  // --- La chaîne de post-traitement et sa décision.
  let qualite: QualiteRendu = options.qualite ?? QUALITE_PAR_DEFAUT;
  let composeur: Composeur | null = null;
  let fabrique: typeof creerComposeur | null = null;
  let chargement: Promise<void> | null = null;
  /** La chaîne a refusé de se monter (cible flottante non dessinable, par exemple) : on n'insiste pas. */
  let echec = false;
  const durees: number[] = [];
  let msMesurees: number | null = null;
  /** Une image mesurée attend sa barrière : on n'en mesure pas deux à la fois. */
  let mesureEnCours = false;
  // --- La cadence : les intervalles entre images consécutives, mesurés avec
  //     ou sans chaîne — c'est le chiffre qui répond à « ça lag ». La
  //     rétroaction qui en tire un refus, elle, ne juge que la chaîne, et une
  //     cadence refusée le reste pour la session.
  const intervalles: number[] = [];
  let msCadenceMesuree: number | null = null;
  let cadenceRefusee = false;
  let derniereImage: number | null = null;

  const ratio = (): number => ratioPixels(fenetre, options.ratioMax ?? 2);
  const reduit = (): boolean => options.reduit?.() ?? false;
  const voulu = (): boolean => !echec && decisionComposeur(qualite, msMesurees, reduit(), cadenceRefusee);
  /** Mesure-t-on encore ? Seulement en `auto`, sans chaîne, tant que la médiane manque. */
  const calibration = (): boolean => qualite === 'auto' && msMesurees === null && composeur === null && !reduit();

  function demonterComposeur(): void {
    if (!composeur) return;
    composeur.dispose();
    composeur = null;
    // Les deux régimes ne se mélangent pas dans la même médiane : ce qui suit
    // ne coûte plus la chaîne, et le dire sur des intervalles qui la comptent
    // encore serait un mensonge de trente images.
    intervalles.length = 0;
    msCadenceMesuree = null;
    options.surChangement?.();
  }


  /**
   * Aligne la chaîne sur la décision du moment : la monte si elle est voulue
   * et que son module est là, lance le chargement du module sinon, la démonte
   * si elle ne l'est plus. Sans caméra, ou sans moteur prêt, on ne peut que
   * charger ou démonter ; l'image suivante fera le reste.
   */
  function aligner(camera: THREE.Camera | null): void {
    if (!vivante) return;
    if (!voulu()) {
      demonterComposeur();
      return;
    }
    if (composeur) return;
    const r = renderer;
    const dos = backend;
    if (!r || !dos) return;
    // three ne lève pas quand une cible flottante n'est pas dessinable : sans
    // l'extension, la chaîne rendrait un écran noir en silence. On le sait
    // avant de charger quoi que ce soit, et on reste sur le rendu direct. La
    // question se pose aux extensions du dos WebGL, pas à `renderer.hasFeature`,
    // qui ne connaît que la poignée de noms de sa table (`GLFeatureName`) et
    // répondrait non à `EXT_color_buffer_float` sans même regarder.
    const extensions = (r.backend as { extensions?: { has(nom: string): boolean } }).extensions;
    if (!composeurPossible(dos, (nom) => extensions?.has(nom) === true)) {
      echec = true;
      console.warn('Chaîne de post-traitement indisponible', 'aucune cible flottante dessinable (EXT_color_buffer_float)');
      return;
    }
    if (fabrique) {
      if (!camera) return;
      try {
        composeur = fabrique(r, scene, camera);
        // La chaîne repart mesurée de zéro : sa première image compile ses
        // programmes, la médiane des trente suivantes l'absorbe.
        intervalles.length = 0;
        msCadenceMesuree = null;
      } catch (cause) {
        echec = true;
        console.warn('Chaîne de post-traitement indisponible', cause);
      }
      options.surChangement?.();
      return;
    }
    if (chargement) return;
    chargement = import('./postraitement')
      .then((module) => {
        fabrique = module.creerComposeur;
        chargement = null;
        options.surChangement?.();
      })
      .catch((cause: unknown) => {
        chargement = null;
        echec = true;
        console.warn('Chaîne de post-traitement indisponible', cause);
      });
  }

  function mesurer(): void {
    const boite = conteneur.getBoundingClientRect();
    const l = Math.max(1, Math.round(boite.width));
    const h = Math.max(1, Math.round(boite.height));
    if (l === largeur && h === hauteur) return;
    largeur = l;
    hauteur = h;
    const r = ratio();
    if (renderer) {
      renderer.setPixelRatio(r);
      renderer.setSize(l, h, false);
    }
    composeur?.redimensionner(l, h, r);
    options.surRedimension?.(l, h);
  }

  const observateur = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => mesurer())
    : null;
  observateur?.observe(conteneur);
  mesurer();

  const horloge = fenetre?.performance ?? { now: (): number => Date.now() };

  /**
   * Le moteur : le dos décidé, l'objet construit, `init()` attendu, puis
   * l'environnement cuit. Une scène démontée entre-temps jette ce qu'elle a
   * commencé et rejette — sans que personne n'attende forcément : le rejet est
   * tenu pour traité ici, et reste visible à qui attend `prete`.
   */
  const prete: Promise<void> = (async () => {
    const dos = await choisirBackend(fenetre?.navigator as NavigateurGpu | undefined);
    if (!vivante) throw new Error('Scène démontée avant que le moteur soit prêt.');
    const r = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      forceWebGL: dos === 'webgl',
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = exposition;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Les compteurs ne se remettent pas à zéro à chaque passe : une image en
    // fait plusieurs — ombres, scène, quads —, et c'est l'image entière qu'on
    // veut mesurer. `dessiner()` les remet à zéro lui-même, une fois par image.
    r.info.autoReset = false;
    r.setPixelRatio(ratio());
    r.setSize(largeur, hauteur, false);
    await r.init();
    if (!vivante) {
      r.dispose();
      throw new Error('Scène démontée avant que le moteur soit prêt.');
    }
    renderer = r;
    backend = backendDe(r);
    if (options.environnement !== false) {
      environnement = creerEnvironnement(r);
      scene.environment = environnement.texture;
    }
    aligner(null);
    options.surChangement?.();
  })();
  prete.catch(() => undefined);

  return {
    scene,
    canvas,
    prete,
    get pret() { return renderer !== null; },
    get backend() { return backend; },
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get msParImage() { return mediane(envois) ?? 0; },
    get msCadence() { return msCadenceMesuree; },
    get composeurActif() { return composeur !== null; },
    get calibration() { return calibration(); },

    dessiner(camera: THREE.Camera, image: OptionsImage = {}): number {
      const r = renderer;
      const dos = backend;
      if (image.exposition !== undefined) exposition = image.exposition;
      if (!r || !dos) return 0;
      const debut = horloge.now();
      // L'intervalle depuis l'image précédente est ce qu'elle a coûté, chaîne
      // comprise, si la boucle n'a pas dormi entre-temps. C'est la seule mesure
      // qui compte le processeur graphique en jeu, et elle se prend **tout le
      // temps** : « ça lag » se répond par ce chiffre, chaîne ou pas. Elle se
      // lit **avant** `aligner` : `composeur` dit encore si cette image
      // précédente était de la chaîne, et un refus la démonte dès celle-ci.
      if (image.continu && derniereImage !== null) {
        intervalles.push(debut - derniereImage);
        if (intervalles.length > IMAGES_CADENCE) intervalles.shift();
        msCadenceMesuree = msCadence(intervalles);
        // La rétroaction, elle, ne juge que la chaîne : une cadence basse sans
        // chaîne n'accuse pas la chaîne, et l'éteindre pour la session serait
        // punir l'innocent.
        if (composeur && qualite === 'auto' && cadenceInsuffisante(msCadenceMesuree)) cadenceRefusee = true;
      }
      derniereImage = debut;
      aligner(camera);
      const mesure = calibration() && !mesureEnCours;
      r.info.reset();
      r.toneMappingExposure = exposition;
      // La première passe de l'image qui trouve `needsUpdate` levé calcule les
      // ombres et le rabaisse ; les suivantes les trouvent faites. Et si rien
      // qui porte ombre n'a bougé, la carte de l'image précédente sert encore.
      poserOmbres(scene, image.ombre !== false || mesure);
      if (composeur) composeur.rendre(camera);
      else r.render(scene, camera);
      const envoi = horloge.now() - debut;
      // Médiane, pas moyenne glissante : une moyenne à 0,85 garde une image
      // exceptionnelle pendant une centaine d'images — après un montage, elle
      // affichait 9,8 ms sur WebGPU et 29,2 sur le dos WebGL quand la médiane
      // valait 2,5 et 5,9. Le chiffre qu'on lit juste après avoir chargé une
      // partie est justement celui-là.
      envois.push(envoi);
      if (envois.length > IMAGES_CADENCE) envois.shift();
      if (mesure) {
        mesureEnCours = true;
        void attendreDessin(r, dos).then(() => {
          mesureEnCours = false;
          if (!vivante) return;
          durees.push(horloge.now() - debut);
          msMesurees = msCalibration(durees);
          // Une image de plus, tout de suite : la mesure ne doit pas attendre
          // qu'une animation veuille bien réveiller la boucle.
          options.surChangement?.();
        });
      }
      return envoi;
    },

    async prechauffer(camera: THREE.Camera): Promise<void> {
      const r = renderer;
      if (!r || !vivante) return;
      const moteur = r as unknown as {
        _handleObjectFunction: unknown;
        _renderObjectDirect: unknown;
        _getFrameBufferTarget?(): THREE.RenderTarget | null;
      };
      // **Sur la même cible que l'image vraie.** Un pipeline est compilé pour
      // un format de couleur, un format de profondeur et un nombre
      // d'échantillons donnés (`WebGPUBackend.getRenderCacheKey`). Or
      // `render()` ne dessine pas dans la toile : dès qu'il y a une
      // cartographie tonale ou un espace de couleur non linéaire — les deux
      // ici —, il passe par une cible intermédiaire en demi-flottants
      // (`_getFrameBufferTarget`), tandis que `compileAsync` prend la cible
      // courante, nulle par défaut. Préchauffer sans elle réchauffait des
      // pipelines en `bgra8unorm` dont la première image n'avait que faire :
      // mesuré, cela ne gagnait que 13 %, le temps du WGSL et rien du pilote.
      const cible = moteur._getFrameBufferTarget?.() ?? null;
      const cibleAvant = r.getRenderTarget();
      r.setRenderTarget(cible);
      // **Pas de passe d'ombres pendant le préchauffage.** `compileAsync`
      // appelle `updateBefore` sur chaque objet, et un `ShadowNode` y répond en
      // lançant un `renderer.render()` complet — au milieu d'une compilation,
      // avec la fonction qui crée des pipelines au lieu de dessiner. Il pose au
      // passage un `overrideMaterial` sur la scène et lève avant de le retirer :
      // trois lots sur huit échouaient ainsi, mesuré. Les lumières savent déjà
      // ne recalculer leur carte que sur ordre (`poserOmbres`) ; on le leur dit
      // avant, et la première image la demandera comme d'habitude.
      poserOmbres(scene, false);
      try {
        await prechauffer(r, scene, camera, { vivante: () => vivante });
      } finally {
        r.setRenderTarget(cibleAvant);
        // Garde-fou : `compileAsync` remplace la fonction qui traite chaque
        // objet par celle qui **crée un pipeline sans dessiner**, et ne la
        // remet qu'à sa dernière ligne. Une exception en route laisserait le
        // moteur muet pour toujours ; on la remet, comme three la remet.
        moteur._handleObjectFunction = moteur._renderObjectDirect;
      }
    },

    mesures(): MesuresRendu {
      return {
        ...depuisInfo(renderer?.info),
        msParImage: mediane(envois) ?? 0,
        msCadence: msCadenceMesuree,
        composeur: composeur !== null,
        msCalibration: msMesurees,
        backend,
        // Le détail par famille se lit sur la scène, pas sur `info` : c'est un
        // parcours de quelques centaines d'objets, et on ne le demande qu'à la
        // mesure, jamais à l'image.
        familles: compterFamilles(scene),
      };
    },

    reglerQualite(q: QualiteRendu): void {
      if (q === qualite) return;
      qualite = q;
      aligner(null);
      options.surChangement?.();
    },

    dispose(): void {
      vivante = false;
      observateur?.disconnect();
      composeur?.dispose();
      composeur = null;
      if (environnement) {
        scene.environment = null;
        environnement.dispose();
        environnement = null;
      }
      // Un moteur non initialisé ne se libère pas — `dispose()` y déréférence
      // ce qu'`init()` n'a pas encore créé — : c'est la chaîne d'initialisation
      // qui le jette elle-même en trouvant la scène démontée.
      renderer?.dispose();
      renderer = null;
      backend = null;
      canvas.remove();
    },
  };
}
