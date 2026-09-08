/**
 * Le moteur graphique et sa **boucle paresseuse**.
 *
 * Un tactique au tour par tour est immobile la plupart du temps : faire tourner
 * une boucle 3D à soixante images par seconde pour redessiner deux fois la même
 * chose vide une batterie en une heure. Le rendu ne dessine donc que lorsque
 * quelque chose a changé, qu'une animation court ou que des particules tombent —
 * et, au repos, **une image par seconde** suffit à faire vivre l'eau.
 *
 * WebGPU exclusivement : aucun paramètre d'adresse ni repli WebGL.
 * L'initialisation asynchrone expose `prete` ; aucun dessin ne la précède.
 * La rustine de r170 corrige la compilation des transparents, dont une erreur
 * laissait les pipelines inachevés et la boucle de jeu figée.
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
 * La calibration attend `renderer.waitForGPU()` : le temps mesuré comprend
 * le dessin effectif. Une seule mesure attend cette barrière à la fois.
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
  cadenceInsuffisante, decisionComposeur, IMAGES_CADENCE, mediane, msCadence,
  msCalibration, QUALITE_PAR_DEFAUT, type BackendRendu, type QualiteRendu,
} from '../render/qualite';
import { moteur3dDisponible, type MesuresRendu } from '../render/rendu';
import { creerEnvironnement, type Environnement } from './environnement';
import { compterFamilles, depuisInfo } from './mesures';
import { prechauffer, prechaufferOmbres } from './prechauffage';
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
   * WebGPU ne se monte pas, ou si la scène est
   * démontée avant.
   */
  readonly prete: Promise<void>;
  /** Vrai une fois `prete` tenue. */
  readonly pret: boolean;
  /** WebGPU, ou null pendant l'initialisation. */
  readonly backend: BackendRendu | null;
  /**
   * Dessine une image — par la chaîne si elle est active — et rend le temps
   * d'envoi en millisecondes ; zéro, et rien, tant que le moteur n'est pas prêt.
   */
  dessiner(camera: THREE.Camera, options?: OptionsImage): number;
  /**
   * Compile d'avance les programmes de la scène, lot par lot
   * (`prechauffage.ts`) : c'est ce qui évite qu'une seconde de traduction TSL →
   * WGSL et de création de pipelines tombe sur la première image. La passe
   * principale d'abord, la **passe d'ombres** ensuite, par de vrais rendus hors
   * écran — elle n'a pas d'autre porte. Rend quand tout est chaud, tout de
   * suite si le moteur n'est pas prêt — l'image le refera alors elle-même, au
   * prix qu'elle a toujours payé.
   *
   * S'appelle **plusieurs fois** sans dommage : ce qui est déjà chaud ne coûte
   * qu'une lecture de cache, et c'est ce qui permet de faire paraître le monde
   * **famille par famille** (`index.ts`) — le sol, le décor, les figurines.
   *
   * `cibles` dit quelles familles chauffer ; absentes, c'est toute la scène. Le
   * reste est caché pendant l'opération dans les deux cas. C'est là qu'est le
   * gain sur la première image : le plateau ne porte qu'une fraction des
   * programmes, et la grille paraît sans attendre ceux des arbres.
   *
   * `poursuivre` est relu **entre deux lots** : le rendre faux abandonne le
   * préchauffage proprement, à la frontière d'un lot. C'est ainsi qu'un budget
   * s'applique sans jamais interrompre une compilation en cours — la couper au
   * milieu laisserait le moteur incapable de dessiner.
   */
  prechauffer(
    camera: THREE.Camera, poursuivre?: () => boolean, cibles?: readonly THREE.Object3D[],
  ): Promise<void>;
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

/**
 * La borne de densité par défaut : **2 à la souris, 1,4 au doigt**.
 *
 * Un téléphone annonce couramment 2,5 ou 3 : rendre à 2 sur un écran de 390 par
 * 844 fait 1,3 million de pixels par image, pour une dalle où l'œil ne distingue
 * plus rien au-delà de 1,4 — et la moitié des pixels coûte la moitié du temps
 * d'image. C'est le levier le moins cher sur un appareil qui rame, et il ne
 * touche pas la souris, où la finesse se voit.
 *
 * On lit le **pointeur**, pas la largeur : une tablette large au doigt a la même
 * dalle dense et le même processeur graphique modeste qu'un téléphone.
 */
export function ratioMaxParDefaut(fenetre: Window | null): number {
  try {
    return fenetre?.matchMedia?.('(pointer: coarse)')?.matches === true ? 1.4 : 2;
  } catch {
    return 2;
  }
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

/** Exige un adaptateur WebGPU : aucun repli WebGL. */
export async function choisirBackend(navigateur: NavigateurGpu | null | undefined): Promise<BackendRendu> {
  const gpu = navigateur?.gpu;
  if (!gpu || typeof gpu.requestAdapter !== 'function') throw new Error('WebGPU indisponible dans ce navigateur.');
  const adaptateur = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adaptateur) throw new Error('Aucun adaptateur WebGPU disponible.');
  return 'webgpu';
}

/** Three r170 installe son propre repli : le désactiver avant init(). */
export function creerMoteurWebGPU(options: ConstructorParameters<typeof THREE.WebGPURenderer>[0]): THREE.WebGPURenderer {
  const moteur = new THREE.WebGPURenderer(options);
  moteur._getFallback = null;
  return moteur;
}

/**
 * Vrai si le navigateur courant peut faire tourner le moteur. Elle vit
 * désormais dans `render/rendu.ts` — l'écran-titre doit pouvoir la poser sans
 * faire entrer le moteur WebGPU dans son paquet — et se relaie ici, où tout le
 * rendu 3D la cherche.
 */
export { moteur3dDisponible };

/**
 * L'intensité d'environnement avant que l'éclairage n'ait parlé : celle d'un
 * jour clair. `eclairage.ts` la remplace dès la première ambiance appliquée.
 */
const INTENSITE_ENVIRONNEMENT_DEPART = 0.3;

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
    l.shadow.needsUpdate = recalculer;
  });
}

/** Attend la fin effective du dessin sur le GPU. */
function attendreDessin(renderer: THREE.WebGPURenderer): Promise<void> {
  return renderer.waitForGPU();
}

/**
 * Monte le moteur dans un conteneur. Lève tout de suite si WebGPU
 * n'est pas disponible ; sinon `prete` dit quand — ou si — le moteur a démarré.
 */
export function creerScene3d(conteneur: HTMLElement, options: OptionsScene3d = {}): Scene3d {
  if (!moteur3dDisponible()) {
    throw new Error('Rendu 3D indisponible : WebGPU requis.');
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
  /**
   * Les signatures de forme dont la passe d'ombres est déjà chaude
   * (`prechaufferOmbres`). Elle vit ici, et non dans l'appelant, parce qu'elle
   * décrit l'état du **moteur** : les pipelines créés survivent à toutes les
   * révélations, et une forme chauffée pour le sol ne se rechauffe pas pour le
   * décor.
   */
  const ombresChaudes = new Set<string>();

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

  const ratio = (): number => ratioPixels(fenetre, options.ratioMax ?? ratioMaxParDefaut(fenetre));
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

  /**
   * La taille de l'image se prend sur **la toile**, pas sur le conteneur.
   *
   * Depuis que le HUD réserve une colonne à droite sur grand écran
   * (`render/hud-html.ts`), le conteneur est plus large que l'image : la mesurer
   * lui donnerait un tampon plus large que ce qui s'affiche, donc une caméra au
   * mauvais rapport, un cadrage qui déborde et un `versEcran` faux de la largeur
   * du rail — tout ce que le HUD ancre sur une case aurait glissé. Le conteneur
   * ne sert plus que de repli, le temps qu'une toile encore hors flux ait une
   * boîte.
   */
  function mesurer(): void {
    const boiteToile = canvas.getBoundingClientRect();
    const boite = boiteToile.width > 0 && boiteToile.height > 0
      ? boiteToile
      : conteneur.getBoundingClientRect();
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
  // Les deux sont observés : la toile parce que c'est elle qu'on mesure, le
  // conteneur pour le cas où elle n'aurait pas encore de boîte. `mesurer` sort
  // sans rien faire quand la taille n'a pas changé, deux notifications pour un
  // même redimensionnement ne coûtent donc qu'une comparaison.
  observateur?.observe(canvas);
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
    await choisirBackend(fenetre?.navigator as NavigateurGpu | undefined);
    if (!vivante) throw new Error('Scène démontée avant que le moteur soit prêt.');
    const r = creerMoteurWebGPU({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
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
    backend = 'webgpu';
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
        void attendreDessin(r).then(() => {
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

    async prechauffer(
      camera: THREE.Camera, poursuivre?: () => boolean, cibles?: readonly THREE.Object3D[],
    ): Promise<void> {
      const r = renderer;
      if (!r || !vivante) return;
      const encore = (): boolean => vivante && (poursuivre?.() ?? true);
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
      // avant, et c'est `prechaufferOmbres` qui la leur redemandera, lot par
      // lot, une fois la passe principale chaude.
      poserOmbres(scene, false);
      try {
        await prechauffer(r, scene, camera, { vivante: encore, cibles });
      } finally {
        // Garde-fou : `compileAsync` remplace la fonction qui traite chaque
        // objet par celle qui **crée un pipeline sans dessiner**, et ne la
        // remet qu'à sa dernière ligne. Une exception en route laisserait le
        // moteur muet pour toujours ; on la remet, comme three la remet.
        moteur._handleObjectFunction = moteur._renderObjectDirect;
      }
      try {
        // **Puis la passe d'ombres**, et dans cet ordre : elle se préchauffe
        // par de vrais rendus (`prechaufferOmbres`), qui rejouent la passe
        // principale à chaque lot. Celle-ci doit donc être chaude, sans quoi on
        // la recompilerait autant de fois qu'il y a de lots d'ombre.
        // `ombresChaudes` traverse les appels : une forme d'ombre payée quand le
        // sol a paru ne se repaie pas quand le décor paraît. Un lot d'ombre
        // coûte un rendu entier — c'est le poste le plus cher du préchauffage.
        if (encore()) {
          await prechaufferOmbres(r, scene, camera, { vivante: encore, cibles, connues: ombresChaudes });
        }
      } catch {
        // Un préchauffage d'ombres qui échoue ne coûte qu'une première image
        // plus chère : elle refera le travail elle-même.
      } finally {
        r.setRenderTarget(cibleAvant);
        // Ces rendus-là ne sont **pas** des images : personne ne les voit, ils
        // vont dans une cible hors écran. Or `etapeChargement` lit le nombre de
        // tirages pour savoir si le plateau est à l'écran (`render/jeu.ts`), et
        // les compteurs ne se remettent à zéro qu'à chaque image dessinée
        // (`info.autoReset` éteint). Sans cette remise, l'écran de chargement
        // s'effacerait sur un canevas encore vide.
        r.info.reset();
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
