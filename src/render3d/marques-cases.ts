/**
 * Les **marques posées sur des cases** (`VueInteraction.marquesCases`) : le
 * « ! » d'une usine qu'une impulsion tient.
 *
 * Ce sont les mêmes pastilles que celles du télégraphage sur les figurines
 * (`materiauMarque`, `unites.ts`) : un signe appris une fois sert partout. Le
 * calque est une poignée de sprites, comparés par clé de case à chaque `maj` —
 * un survol ne crée ni ne détruit rien —, posés au-dessus du relief et relus
 * après une mutation (`majRelief`), comme tout ce qui repose sur le sol.
 */

import * as THREE from 'three/webgpu';

import { depuisCle } from '../engine/index';
import type { MarqueUnite } from '../render/rendu';
import { caseVersMonde } from './geometrie';
import { materiauMarque } from './unites';

/** Hauteur de la pastille au-dessus du sol de la case, en unités de scène. */
const HAUTEUR_MARQUE = 0.62;
/** Côté de la pastille : un peu plus grande que sur une figurine, la case est plus large. */
const TAILLE_MARQUE = 0.42;

export interface CalqueMarquesCases {
  readonly groupe: THREE.Group;
  /** Pose, retire ou change les marques ; rend vrai si quelque chose a bougé. */
  maj(marques: ReadonlyMap<string, MarqueUnite> | null): boolean;
  /** Le relief a bougé : les pastilles se reposent à la nouvelle altitude. */
  majRelief(): void;
  dispose(): void;
}

export function creerMarquesCases(
  doc: Document, hauteurEn: (x: number, z: number) => number,
): CalqueMarquesCases {
  const groupe = new THREE.Group();
  groupe.name = 'marques_cases';
  const posees = new Map<string, { genre: MarqueUnite; sprite: THREE.Sprite }>();

  function poser(sprite: THREE.Sprite, cle: string): void {
    const p = caseVersMonde(depuisCle(cle));
    sprite.position.set(p.x, hauteurEn(p.x, p.z) + HAUTEUR_MARQUE, p.z);
  }

  return {
    groupe,
    maj(marques) {
      let change = false;
      for (const [cle, entree] of posees) {
        if (marques?.get(cle) === entree.genre) continue;
        groupe.remove(entree.sprite);
        posees.delete(cle);
        change = true;
      }
      if (marques) {
        for (const [cle, genre] of marques) {
          if (posees.has(cle)) continue;
          const sprite = new THREE.Sprite(materiauMarque(doc, genre));
          sprite.scale.set(TAILLE_MARQUE, TAILLE_MARQUE, 1);
          sprite.renderOrder = 6;
          poser(sprite, cle);
          groupe.add(sprite);
          posees.set(cle, { genre, sprite });
          change = true;
        }
      }
      return change;
    },
    majRelief() {
      for (const [cle, entree] of posees) poser(entree.sprite, cle);
    },
    dispose() {
      // Les matériaux sont ceux du calque des unités, qui les libère ; les
      // sprites, eux, ne portent aucune géométrie à eux.
      for (const entree of posees.values()) groupe.remove(entree.sprite);
      posees.clear();
    },
  };
}
