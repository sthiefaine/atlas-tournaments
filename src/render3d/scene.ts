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
 */

import * as THREE from 'three';

/** Ce que `creerScene3d` rend à l'appelant. */
export interface Scene3d {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  readonly largeur: number;
  readonly hauteur: number;
  /** Dessine une image et rend sa durée en millisecondes. */
  dessiner(camera: THREE.Camera): number;
  /** Durée moyenne des dernières images, en millisecondes. */
  readonly msParImage: number;
  dispose(): void;
}

/** Réglages du contexte. */
export interface OptionsScene3d {
  /** Appelée à chaque redimensionnement, en pixels logiques. */
  surRedimension?(largeur: number, hauteur: number): void;
  /** Ratio de pixels maximal. Deux suffit, même sur un écran à trois. */
  ratioMax?: number;
}

/** Le ratio de pixels courant, borné. */
export function ratioPixels(fenetre: Window | null, max = 2): number {
  const brut = fenetre?.devicePixelRatio;
  const valeur = typeof brut === 'number' && brut > 0 ? brut : 1;
  return Math.max(1, Math.min(max, valeur));
}

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
  renderer.setPixelRatio(ratioPixels(doc.defaultView, options.ratioMax ?? 2));

  const scene = new THREE.Scene();

  let largeur = 1;
  let hauteur = 1;
  let msParImage = 0;

  function mesurer(): void {
    const boite = conteneur.getBoundingClientRect();
    const l = Math.max(1, Math.round(boite.width));
    const h = Math.max(1, Math.round(boite.height));
    if (l === largeur && h === hauteur) return;
    largeur = l;
    hauteur = h;
    renderer.setPixelRatio(ratioPixels(doc.defaultView, options.ratioMax ?? 2));
    renderer.setSize(l, h, false);
    options.surRedimension?.(l, h);
  }

  const observateur = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => mesurer())
    : null;
  observateur?.observe(conteneur);
  mesurer();

  const horloge = doc.defaultView?.performance ?? { now: (): number => Date.now() };

  return {
    renderer,
    scene,
    canvas,
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get msParImage() { return msParImage; },

    dessiner(camera: THREE.Camera): number {
      const debut = horloge.now();
      renderer.render(scene, camera);
      const duree = horloge.now() - debut;
      msParImage = msParImage === 0 ? duree : msParImage * 0.85 + duree * 0.15;
      return duree;
    },

    dispose(): void {
      observateur?.disconnect();
      renderer.dispose();
      canvas.remove();
    },
  };
}
