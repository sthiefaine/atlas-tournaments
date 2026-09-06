/**
 * Le contexte WebGL et sa **boucle paresseuse**.
 *
 * Un tactique au tour par tour est immobile la plupart du temps : faire tourner
 * une boucle 3D à soixante images par seconde pour redessiner deux fois la même
 * chose vide une batterie en une heure. Le rendu ne dessine donc que lorsque
 * quelque chose a changé, qu'une animation court ou que des particules tombent —
 * et, au repos, **une image par seconde** suffit à faire vivre l'eau.
 *
 * Le reste est de l'hygiène : espace de couleur sRGB en sortie, cartographie
 * tonale filmique (c'est elle qui empêche un soleil d'été de brûler les blancs),
 * ombres PCF douces, ratio de pixels borné à 2 — au-delà, on paie quatre fois le
 * coût pour un gain invisible — et un `ResizeObserver` plutôt qu'un écouteur de
 * fenêtre, pour suivre aussi les changements de mise en page.
 *
 * Depuis le lot A de `16-realisme.md` (6 septembre 2026), la scène porte aussi
 * la **carte d'environnement** (`environnement.ts`) et, selon la qualité
 * choisie, la **chaîne de post-traitement** (`postraitement.ts`), qui remplace
 * `renderer.render` dans `dessiner()`. La chaîne ne tourne jamais seule : elle
 * ne dessine que quand la boucle le demande, exactement comme le rendu direct.
 * En qualité `auto`, les premières images sont **mesurées** sans elle, GPU
 * compris, et elle ne s'allume que si l'appareil suit (`render/qualite.ts`).
 * Ses modules sont chargés par `import()` au moment de s'allumer : l'accueil,
 * en `basse`, ne les télécharge pas.
 */

import * as THREE from 'three';

import {
  composeurPossible, decisionComposeur, msCalibration, QUALITE_PAR_DEFAUT, type QualiteRendu,
} from '../render/qualite';
import type { MesuresRendu } from '../render/rendu';
import { creerEnvironnement, type Environnement } from './environnement';
import type { Composeur, creerComposeur } from './postraitement';

/** Ce que `creerScene3d` rend à l'appelant. */
export interface Scene3d {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  readonly largeur: number;
  readonly hauteur: number;
  /** Dessine une image — par la chaîne si elle est active — et rend sa durée en millisecondes. */
  dessiner(camera: THREE.Camera): number;
  /** Durée moyenne des dernières images, en millisecondes. */
  readonly msParImage: number;
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
   * (calibration en cours, module arrivé) : l'appelant salit sa boucle.
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

/**
 * L'intensité d'environnement avant que l'éclairage n'ait parlé : celle d'un
 * jour clair. `eclairage.ts` la remplace dès la première ambiance appliquée.
 */
const INTENSITE_ENVIRONNEMENT_DEPART = 0.3;

/** Monte le contexte WebGL dans un conteneur. Lève si WebGL 2 est indisponible. */
export function creerScene3d(conteneur: HTMLElement, options: OptionsScene3d = {}): Scene3d {
  const doc = conteneur.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'atlas-toile';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.outline = 'none';
  canvas.style.touchAction = 'none';
  canvas.setAttribute('tabindex', '0');
  conteneur.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // La carte d'ombre se calcule **une fois par image**, pas une fois par
  // `render()` : la chaîne de post-traitement dessine la scène deux fois (la
  // couleur, puis les normales et la profondeur pour l'occlusion), et sans ce
  // réglage la seconde passe recalculait 2048² d'ombres dont elle ne se sert
  // pas. `dessiner()` lève `needsUpdate` à chaque image, donc l'ombre suit la
  // caméra comme avant, dès la première image.
  renderer.shadowMap.autoUpdate = false;
  renderer.setPixelRatio(ratioPixels(doc.defaultView, options.ratioMax ?? 2));
  // Les compteurs ne se remettent plus à zéro à chaque `render()` : une image
  // composée en fait plusieurs, et c'est l'image entière qu'on veut mesurer.
  // `dessiner()` les remet à zéro lui-même, une fois par image.
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();

  let environnement: Environnement | null = null;
  if (options.environnement !== false) {
    environnement = creerEnvironnement(renderer);
    scene.environment = environnement.texture;
    scene.environmentIntensity = INTENSITE_ENVIRONNEMENT_DEPART;
  }

  let largeur = 1;
  let hauteur = 1;
  let msParImage = 0;
  let vivante = true;

  // --- La chaîne de post-traitement et sa décision.
  let qualite: QualiteRendu = options.qualite ?? QUALITE_PAR_DEFAUT;
  let composeur: Composeur | null = null;
  let fabrique: typeof creerComposeur | null = null;
  let chargement: Promise<void> | null = null;
  /** La chaîne a refusé de se monter (tampon flottant multi-échantillons absent, par exemple) : on n'insiste pas. */
  let echec = false;
  const durees: number[] = [];
  let msMesurees: number | null = null;

  const ratio = (): number => ratioPixels(doc.defaultView, options.ratioMax ?? 2);
  const reduit = (): boolean => options.reduit?.() ?? false;
  const voulu = (): boolean => !echec && decisionComposeur(qualite, msMesurees, reduit());
  /** Mesure-t-on encore ? Seulement en `auto`, sans chaîne, tant que la médiane manque. */
  const calibration = (): boolean => qualite === 'auto' && msMesurees === null && composeur === null && !reduit();

  function demonterComposeur(): void {
    if (!composeur) return;
    composeur.dispose();
    composeur = null;
    options.surChangement?.();
  }

  /**
   * Aligne la chaîne sur la décision du moment : la monte si elle est voulue
   * et que son module est là, lance le chargement du module sinon, la démonte
   * si elle ne l'est plus. Sans caméra, on ne peut que charger ou démonter ;
   * l'image suivante fera le reste.
   */
  function aligner(camera: THREE.Camera | null): void {
    if (!vivante) return;
    if (!voulu()) {
      demonterComposeur();
      return;
    }
    if (composeur) return;
    // three ne lève pas quand une cible flottante n'est pas dessinable : sans
    // l'extension, la chaîne rendrait un écran noir en silence. On le sait
    // avant de charger quoi que ce soit, et on reste sur le rendu direct.
    if (!composeurPossible((nom) => renderer.extensions.has(nom))) {
      echec = true;
      console.warn('Chaîne de post-traitement indisponible', 'aucune cible flottante dessinable (EXT_color_buffer_float)');
      return;
    }
    if (fabrique) {
      if (!camera) return;
      try {
        composeur = fabrique(renderer, scene, camera, largeur, hauteur, ratio());
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
    renderer.setPixelRatio(r);
    renderer.setSize(l, h, false);
    composeur?.redimensionner(l, h, r);
    options.surRedimension?.(l, h);
  }

  const observateur = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => mesurer())
    : null;
  observateur?.observe(conteneur);
  mesurer();
  aligner(null);

  const horloge = doc.defaultView?.performance ?? { now: (): number => Date.now() };

  /**
   * Attend que le processeur graphique ait **fini** l'image mesurée. Sans cela
   * on mesurerait l'envoi des commandes, pas le dessin, et un appareil lent
   * passerait pour rapide. `finish()` ne suffit pas : Chrome le traite comme un
   * `flush()` et rend la main aussitôt — sous SwiftShader, une image d'une
   * seconde se mesurait à zéro et la chaîne s'allumait sur l'appareil le plus
   * lent qui soit. Lire un pixel, lui, ne peut pas rendre avant que le dessin
   * soit terminé : c'est la seule barrière synchrone dont WebGL dispose, et
   * elle ne coûte que sur ces quelques images.
   */
  const pixel = new Uint8Array(4);
  function attendreDessin(): void {
    try {
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    } catch {
      // Un contexte perdu ne se mesure pas ; on gardera le temps d'envoi.
    }
  }

  return {
    renderer,
    scene,
    canvas,
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get msParImage() { return msParImage; },
    get composeurActif() { return composeur !== null; },
    get calibration() { return calibration(); },

    dessiner(camera: THREE.Camera): number {
      aligner(camera);
      const mesure = calibration();
      const debut = horloge.now();
      renderer.info.reset();
      // Le premier `render()` de l'image — le rendu direct, ou la passe de
      // couleur de la chaîne — calcule les ombres et rabaisse le drapeau ; la
      // passe des normales, qui vient après, les trouve faites.
      renderer.shadowMap.needsUpdate = true;
      if (composeur) composeur.rendre(camera);
      else renderer.render(scene, camera);
      if (mesure) attendreDessin();
      const duree = horloge.now() - debut;
      msParImage = msParImage === 0 ? duree : msParImage * 0.85 + duree * 0.15;
      if (mesure) {
        durees.push(duree);
        msMesurees = msCalibration(durees);
        // Une image de plus, tout de suite : la mesure ne doit pas attendre
        // qu'une animation veuille bien réveiller la boucle.
        options.surChangement?.();
      }
      return duree;
    },

    mesures(): MesuresRendu {
      return {
        triangles: renderer.info.render.triangles,
        appels: renderer.info.render.calls,
        msParImage,
        composeur: composeur !== null,
        msCalibration: msMesurees,
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
      renderer.dispose();
      canvas.remove();
    },
  };
}
