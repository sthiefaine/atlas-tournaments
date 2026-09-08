/**
 * La **chaîne de post-traitement** (`16-realisme.md` A3 et A4) : occlusion
 * ambiante d'écran, puis vignettage, grain et saturation — écrite en **TSL**
 * pour le moteur WebGPU (7 septembre 2026).
 *
 * Une passe de scène et un quad. La passe de scène (`pass`) écrit **en une
 * fois**, par cibles multiples (`mrt`), la couleur en demi-flottants et les
 * normales de vue, et garde sa profondeur : l'ancienne chaîne (`EffectComposer`,
 * `GTAOPass`) redessinait la scène une seconde fois pour les normales, celle-ci
 * ne la dessine qu'une. L'occlusion (`GTAONode`) se calcule dans sa propre
 * cible à partir de la profondeur et des normales ; le quad final la
 * **débruite** (`DenoiseNode`, seize prélèvements en disque de Poisson, ce que
 * `GTAOPass` faisait aussi), la fond dans la couleur, applique la sortie —
 * cartographie tonale ACES et passage en sRGB, exactement ce que le rendu
 * direct fait sur son propre tampon —, puis la saturation, la vignette et le
 * grain.
 *
 * Le grain vient **après** la sortie, donc en espace d'affichage, et c'est
 * réfléchi. Un grain ajouté avant la cartographie tonale, en linéaire, serait
 * écrasé dans les hautes lumières et **décuplé dans les ombres** par la courbe
 * de codage sRGB, qui dilate les petites valeurs : le bruit serait invisible
 * au soleil et grouillant dans chaque ombre. En espace d'affichage, deux pour
 * cent sont deux pour cent partout — c'est ce qu'un grain de pellicule fait —,
 * et le même bruit, posé juste avant la quantification à huit bits, **casse le
 * banding** des dégradés du ciel et du brouillard, qui est le défaut le plus
 * visible d'une scène en aplats lisses. La vignette et la saturation suivent
 * pour la même raison : ce sont des retouches de tirage, pas des faits de
 * lumière. `PostProcessing` appliquerait la sortie lui-même, en tout dernier
 * (`outputColorTransform`) ; on la lui retire pour la poser à la main **avant**
 * le grain, ce qui est toute la raison de cette chaîne.
 *
 * La passe de scène utilise les échantillons du moteur WebGPU.
 *
 * Ce module importe les compléments de three.js de façon **statique** ; c'est
 * `scene.ts` qui l'importe, lui, dynamiquement, au moment d'activer la chaîne.
 * L'écran-titre, en qualité `basse`, ne le télécharge jamais.
 */

import * as THREE from 'three/webgpu';
import {
  Fn, clamp, dot, float, floor, fract, min, mix, mrt, normalView, output, pass,
  renderOutput, screenCoordinate, uniform, uv, vec3, vec4,
  type Node, type ShaderNodeObject,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';

/** Ce que la scène pilote : dessiner, redimensionner, libérer. */
export interface Composeur {
  rendre(camera: THREE.Camera): void;
  /** Taille en pixels logiques et ratio de pixels, comme `renderer.setSize`. */
  redimensionner(largeur: number, hauteur: number, ratio: number): void;
  dispose(): void;
}

/** Assombrissement dans les coins de l'image, en fraction. */
export const VIGNETTE = 0.12;
/** Amplitude du grain, en fraction de la pleine échelle, de part et d'autre. */
export const GRAIN = 0.02;
/** La pointe de saturation : un, c'est l'image telle quelle. */
export const SATURATION = 1.08;

/**
 * Le rayon d'occlusion, en unités de scène — donc en cases. Un tiers de case :
 * assez pour assombrir le pied d'un bâtiment ou l'entre-deux de deux figurines,
 * pas assez pour noircir une vallée entière. Le rayon est **du monde**, pas de
 * l'écran : rapprocher la caméra grossit les creux, elle ne les invente pas.
 */
const RAYON_OCCLUSION = 0.35;

/** Le fondu de l'occlusion sur l'image : un, c'est le calcul brut. */
const INTENSITE_OCCLUSION = 0.85;

/** Les prélèvements de l'occlusion : seize, comme la passe d'avant. */
const PRELEVEMENTS_OCCLUSION = 16;

/**
 * Le débruitage de l'occlusion, tel que `GTAOPass.updatePdMaterial` le
 * recevait : tolérances de luminance, de profondeur et de normale, et rayon en
 * pixels. Les seize prélèvements sur deux anneaux sont ceux du nœud lui-même.
 */
const DEBRUITAGE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4 };

/**
 * Hachage à trois composantes (Dave Hoskins), sur des entiers de pixel et le
 * compteur d'images : le même pixel de la même image rend toujours la même
 * valeur, sans texture ni horloge, et deux pixels voisins ne se ressemblent
 * pas — c'est ce qui le distingue d'un motif.
 */
const hachage = Fn(([pixel, compteur]: [ShaderNodeObject<Node>, ShaderNodeObject<Node>]) => {
  const p = fract(vec3(pixel.x, pixel.y, pixel.x.add(compteur)).mul(0.1031)).toVar();
  p.addAssign(dot(p, p.yzx.add(33.33)));
  return fract(p.x.add(p.y).mul(p.z));
});

/**
 * Monte la chaîne sur un moteur initialisé et une scène. La caméra est celle
 * du premier appel ; `rendre()` la remplace si elle change, ce qui n'arrive
 * qu'au remontage d'un monde.
 *
 * Les tailles ne se règlent pas ici : la passe de scène relit la taille et le
 * ratio du moteur à chaque image, l'occlusion relit le tampon de dessin, le
 * débruitage lit la cible de l'occlusion. `redimensionner` reste dans le
 * contrat et n'a rien à faire.
 */
export function creerComposeur(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): Composeur {
  const post = new THREE.PostProcessing(renderer);
  // La sortie se pose à la main, avant le grain : voir l'en-tête.
  post.outputColorTransform = false;

  const passeScene = pass(scene, camera);
  passeScene.setMRT(mrt({ output, normal: normalView }));
  const couleur = passeScene.getTextureNode('output');
  const normales = passeScene.getTextureNode('normal');
  const profondeur = passeScene.getTextureNode('depth');

  const occlusion = ao(profondeur, normales, camera);
  occlusion.radius.value = RAYON_OCCLUSION;
  occlusion.thickness.value = 1;
  occlusion.distanceExponent.value = 1;
  occlusion.distanceFallOff.value = 1;
  occlusion.scale.value = 1;
  occlusion.SAMPLES.value = PRELEVEMENTS_OCCLUSION;
  // Le débruitage tourne ses prélèvements par le bruit de l'occlusion elle-même
  // (un carré magique 5 × 5, répété) : pas de texture à charger.
  const debruitee = denoise(occlusion.getTextureNode(), profondeur, normales, occlusion.noiseNode, camera);
  debruitee.lumaPhi.value = DEBRUITAGE.lumaPhi;
  debruitee.depthPhi.value = DEBRUITAGE.depthPhi;
  debruitee.normalPhi.value = DEBRUITAGE.normalPhi;
  debruitee.radius.value = DEBRUITAGE.radius;

  const compteur = uniform(0);
  const vignette = uniform(VIGNETTE);
  const grain = uniform(GRAIN);
  const saturation = uniform(SATURATION);

  // La couleur occultée, en linéaire ; puis la sortie, avec la cartographie
  // tonale et l'espace de couleur du moteur — passés en clair plutôt que lus
  // dans le contexte du quad, que le quad de l'anticrénelage ne partagerait
  // pas. L'exposition, elle, est une référence au moteur, relue à chaque image.
  const facteur = mix(float(1), debruitee.r, INTENSITE_OCCLUSION);
  const lineaire = vec4(couleur.rgb.mul(facteur), couleur.a);
  const sortie = renderOutput(lineaire, renderer.toneMapping, renderer.outputColorSpace);
  const affichee = sortie;

  const tirage = Fn(() => {
    const c = affichee.rgb.toVar();
    // La saturation autour de la luminance perçue (Rec. 709).
    const luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c.assign(mix(vec3(luma), c, saturation));
    // La vignette : nulle au centre, pleine dans les coins, en carré de la
    // distance — le profil d'un objectif, pas un cache posé sur l'image.
    const d = uv().sub(0.5);
    c.mulAssign(float(1).sub(vignette.mul(min(dot(d, d).mul(2), 1))));
    // Le grain, centré : il éclaircit autant qu'il assombrit.
    const g = hachage(floor(screenCoordinate), compteur).sub(0.5);
    c.addAssign(g.mul(grain).mul(2));
    return vec4(clamp(c, 0, 1), affichee.a);
  });
  post.outputNode = tirage();

  return {
    rendre(cam: THREE.Camera): void {
      if (passeScene.camera !== cam) {
        passeScene.camera = cam;
        // Les matrices de projection sont des références aux objets de la
        // caméra : une caméra neuve, ce sont des objets neufs.
        occlusion.cameraProjectionMatrix.value = cam.projectionMatrix;
        occlusion.cameraProjectionMatrixInverse.value = cam.projectionMatrixInverse;
        (debruitee as unknown as { cameraProjectionMatrixInverse: { value: THREE.Matrix4 } })
          .cameraProjectionMatrixInverse.value = cam.projectionMatrixInverse;
      }
      compteur.value = (compteur.value + 1) % 4096;
      post.render();
    },
    redimensionner(): void {
      // Rien : voir l'en-tête de `creerComposeur`.
    },
    dispose(): void {
      passeScene.dispose();
      occlusion.dispose();
    },
  };
}
