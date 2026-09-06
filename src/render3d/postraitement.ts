/**
 * La **chaîne de post-traitement** (`16-realisme.md` A3 et A4) : occlusion
 * ambiante d'écran, puis vignettage, grain et saturation.
 *
 * Quatre passes, dans cet ordre : `RenderPass` (la scène, en linéaire et en
 * demi-flottants, avec l'anticrénelage à quatre échantillons que le tampon
 * d'écran avait déjà — sans lui, la chaîne rendrait des bords en escalier),
 * `GTAOPass` (les creux s'assombrissent : jonctions bâtiment-sol, entre les
 * figurines), `OutputPass` (la cartographie tonale ACES et le passage en sRGB,
 * que le rendu direct faisait dans chaque matériau), puis le **grain**.
 *
 * Le grain vient **après** l'`OutputPass`, donc en espace d'affichage, et c'est
 * réfléchi. Un grain ajouté avant la cartographie tonale, en linéaire, serait
 * écrasé dans les hautes lumières et **décuplé dans les ombres** par la courbe
 * de codage sRGB, qui dilate les petites valeurs : le bruit serait invisible
 * au soleil et grouillant dans chaque ombre. En espace d'affichage, deux pour
 * cent sont deux pour cent partout — c'est ce qu'un grain de pellicule fait —,
 * et le même bruit, posé juste avant la quantification à huit bits, **casse le
 * banding** des dégradés du ciel et du brouillard, qui est le défaut le plus
 * visible d'une scène en aplats lisses. La vignette et la saturation suivent
 * pour la même raison : ce sont des retouches de tirage, pas des faits de
 * lumière.
 *
 * Ce module importe les modules complémentaires de three.js de façon
 * **statique** ; c'est `scene.ts` qui l'importe, lui, dynamiquement, au moment
 * d'activer la chaîne. L'écran-titre, en qualité `basse`, ne le télécharge
 * jamais.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Ce que la scène pilote : dessiner, redimensionner, libérer. */
export interface Composeur {
  rendre(camera: THREE.Camera): void;
  /** Taille en pixels logiques et ratio de pixels, comme `WebGLRenderer.setSize`. */
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

/**
 * Le grain et la vignette, en un seul programme. Le bruit est un **hachage
 * entier** des coordonnées du pixel et du compteur d'images : le même pixel de
 * la même image rend toujours la même valeur, sans texture ni horloge, et deux
 * pixels voisins ne se ressemblent pas — c'est ce qui le distingue d'un motif.
 */
const SHADER_GRAIN = {
  name: 'atlas-grain',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    vignette: { value: VIGNETTE },
    grain: { value: GRAIN },
    saturation: { value: SATURATION },
    image: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float grain;
    uniform float saturation;
    uniform float image;
    varying vec2 vUv;

    // Hachage à trois composantes (Dave Hoskins), sur des entiers de pixel :
    // déterministe, sans corrélation visible entre voisins ni entre images.
    float hachage( vec2 pixel, float compteur ) {
      vec3 p = fract( vec3( pixel.x, pixel.y, pixel.x + compteur ) * 0.1031 );
      p += dot( p, p.yzx + 33.33 );
      return fract( ( p.x + p.y ) * p.z );
    }

    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );
      vec3 c = texel.rgb;
      // La saturation autour de la luminance perçue (Rec. 709).
      float luma = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
      c = mix( vec3( luma ), c, saturation );
      // La vignette : nulle au centre, pleine dans les coins, en carré de la
      // distance — le profil d'un objectif, pas un cache posé sur l'image.
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * min( 1.0, dot( d, d ) * 2.0 );
      // Le grain, centré : il éclaircit autant qu'il assombrit.
      float g = hachage( floor( gl_FragCoord.xy ), image ) - 0.5;
      c += g * grain * 2.0;
      gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), texel.a );
    }
  `,
};

/**
 * Monte la chaîne sur un rendu et une scène. La caméra est celle du premier
 * appel ; `rendre()` la remplace si elle change, ce qui n'arrive qu'au
 * remontage d'un monde.
 */
export function creerComposeur(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  largeur: number, hauteur: number, ratio: number,
): Composeur {
  const cible = new THREE.WebGLRenderTarget(
    Math.max(1, Math.round(largeur * ratio)), Math.max(1, Math.round(hauteur * ratio)),
    { type: THREE.HalfFloatType, samples: 4 },
  );
  const composeur = new EffectComposer(renderer, cible);
  const passeScene = new RenderPass(scene, camera);
  const occlusion = new GTAOPass(scene, camera, largeur, hauteur);
  occlusion.output = GTAOPass.OUTPUT.Default;
  occlusion.blendIntensity = INTENSITE_OCCLUSION;
  occlusion.updateGtaoMaterial({
    radius: RAYON_OCCLUSION,
    distanceExponent: 1,
    thickness: 1,
    distanceFallOff: 1,
    scale: 1,
    samples: 16,
    screenSpaceRadius: false,
  });
  occlusion.updatePdMaterial({
    lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16,
  });
  const sortie = new OutputPass();
  const grain = new ShaderPass(SHADER_GRAIN);
  composeur.addPass(passeScene);
  composeur.addPass(occlusion);
  composeur.addPass(sortie);
  composeur.addPass(grain);

  let compteur = 0;
  // Ce que le composeur croit savoir de sa taille. Le ratio est celui du rendu
  // à sa création ; les dimensions sont laissées inconnues, parce qu'avec une
  // cible fournie le constructeur prend la taille **physique** de la cible
  // pour taille logique : le premier `setSize` ci-dessous le remet d'aplomb.
  let ratioConnu = ratio;
  let largeurConnue = -1;
  let hauteurConnue = -1;

  function redimensionner(l: number, h: number, r: number): void {
    // `setPixelRatio` appelle `setSize` de lui-même : on ne redimensionne
    // qu'une fois par changement. Le ratio ne bouge qu'en changeant d'écran.
    if (r !== ratioConnu) {
      ratioConnu = r;
      composeur.setPixelRatio(r);
    }
    if (l !== largeurConnue || h !== hauteurConnue) {
      largeurConnue = l;
      hauteurConnue = h;
      composeur.setSize(l, h);
    }
    // L'occlusion se calcule en **pixels logiques**, pas physiques : sur un
    // écran à ratio 2, c'est quatre fois moins de prélèvements pour un flou que
    // le débruitage lisse de toute façon. Le composeur vient de lui donner la
    // taille physique ; on la reprend.
    occlusion.setSize(Math.max(1, Math.round(l)), Math.max(1, Math.round(h)));
  }
  redimensionner(largeur, hauteur, ratio);

  return {
    rendre(cam: THREE.Camera): void {
      if (passeScene.camera !== cam) {
        passeScene.camera = cam;
        occlusion.camera = cam;
      }
      compteur = (compteur + 1) % 4096;
      grain.uniforms['image']!.value = compteur;
      composeur.render();
    },
    redimensionner,
    dispose(): void {
      occlusion.dispose();
      sortie.dispose();
      grain.dispose();
      passeScene.dispose();
      composeur.dispose();
      cible.dispose();
    },
  };
}
