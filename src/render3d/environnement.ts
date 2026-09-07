/**
 * La **carte d'environnement** (`16-realisme.md` A1) : ce que les matières
 * réfléchissent.
 *
 * Sans elle, `scene.environment` est vide : un métal ne reflète rien, un verre
 * est un aplat gris, et le PBR ne sert qu'à moitié. On prend la pièce de studio
 * de three.js (`RoomEnvironment` : des murs blancs, des boîtes, des panneaux
 * lumineux), qu'on **préfiltre une fois** au montage en carte de radiance
 * (`PMREMGenerator`) : c'est la référence du brief — une maquette photographiée
 * en studio —, et c'est le levier au meilleur rapport, puisqu'il change tous les
 * matériaux d'un coup sans en toucher un seul.
 *
 * L'intensité, elle, suit l'ambiance (`eclairage.ts`, `environnement.intensite`)
 * par `scene.environmentIntensity`, qui existe depuis r163 et que le moteur
 * WebGPU lit aussi (`EnvironmentNode`). La **teinte** que l'ambiance calcule
 * aussi n'a pas de prise propre en r170 : il n'existe ni `environmentColor` ni
 * multiplicateur par couleur, et la seule voie serait de recuire la pièce
 * teintée à chaque changement d'ambiance. Elle est donc calculée, interpolée
 * et gardée pour le jour où une HDRI par phase du jour remplacera la pièce (le
 * plan la prévoit), sans être appliquée aujourd'hui.
 *
 * Depuis le moteur WebGPU (7 septembre 2026), le générateur est celui de
 * `three/webgpu` (`renderers/common/extras/PMREMGenerator`), et il **rend** :
 * il exige un moteur initialisé (`await renderer.init()`). Appelé avant, le
 * moteur avertit, bascule en asynchrone et la carte reviendrait vide — c'est
 * `scene.ts` qui cuit la pièce, une fois `init()` tenu.
 */

import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** La carte préfiltrée, et de quoi la libérer. */
export interface Environnement {
  readonly texture: THREE.Texture;
  dispose(): void;
}

/**
 * L'adoucissement du préfiltrage. C'est la valeur des exemples de three.js :
 * elle gomme les arêtes des panneaux lumineux sans noyer les reflets.
 */
const SIGMA = 0.04;

/**
 * Préfiltre la pièce de studio en carte d'environnement. À appeler **une fois**
 * par moteur, et **après** son `init()` : le générateur et la pièce sont
 * libérés aussitôt, seule la texture reste, et c'est elle qu'on libère au
 * démontage.
 */
export function creerEnvironnement(renderer: THREE.WebGPURenderer): Environnement {
  const generateur = new THREE.PMREMGenerator(renderer);
  const piece = new RoomEnvironment();
  const cible = generateur.fromScene(piece, SIGMA);
  piece.dispose();
  generateur.dispose();
  return {
    texture: cible.texture,
    dispose: () => cible.dispose(),
  };
}
