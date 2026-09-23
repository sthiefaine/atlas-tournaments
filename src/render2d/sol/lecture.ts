/**
 * La **lecture** de la grille : ce que le moteur dit d'une case aujourd'hui.
 *
 * Une marée ou un chantier du génie changent la lecture de la carte en cours de
 * partie sans jamais écrire sa grille : c'est le moteur qui sait ce qu'une case
 * *est* (`terrainLogique`), et `signatureTerrain` qui dit quand il faut la
 * relire. Une copie prise au montage gèlerait le sol au premier jour — la faute
 * qui rendait les marées invisibles en 3D (`CLAUDE.md`, « le terrain qui
 * bouge »).
 */

import {
  signatureTerrain, terrainLogique, type Catalogue, type EtatPartie,
} from '../../engine/index';
import type { CleTerrain } from '../../schemas/types';
import { memesTerrains, type GrilleSol } from './grille';

/** Lit la grille logique d'un état. Une case illisible se lit comme la plaine. */
export function lireGrille(etat: EtatPartie, cat: Catalogue): GrilleSol {
  const terrains: CleTerrain[] = new Array<CleTerrain>(etat.largeur * etat.hauteur);
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < etat.largeur; x += 1) {
      terrains[y * etat.largeur + x] = terrainLogique(etat, cat, { x, y }) ?? 'plaine';
    }
  }
  return { largeur: etat.largeur, hauteur: etat.hauteur, terrains };
}

/** Ce que la relecture a trouvé. */
export type ChangementTerrain = 'rien' | 'premier' | 'terrain' | 'dimensions';

/**
 * Le lecteur de terrain : il ne relit la grille que si `signatureTerrain` a
 * bougé, et ne déclare un changement que si une case a **vraiment** changé.
 *
 * La signature porte la journée et le climat : elle change chaque jour, qu'il y
 * ait une marée ou non. Jouer un fondu de 1,4 s chaque matin pour un sol
 * identique garderait la boucle éveillée pour rien ; c'est la comparaison case
 * à case qui tranche. On compare des chaînes, jamais des identités d'état : le
 * moteur écrit **en place** sur son état de travail.
 */
export class LecteurTerrain {
  private signature: string | null = null;
  private courante: GrilleSol | null = null;

  /** La grille courante, ou `null` avant la première lecture. */
  get grille(): GrilleSol | null {
    return this.courante;
  }

  lire(etat: EtatPartie, cat: Catalogue): ChangementTerrain {
    const signature = signatureTerrain(etat);
    if (signature === this.signature && this.courante !== null) return 'rien';
    this.signature = signature;
    const neuve = lireGrille(etat, cat);
    const avant = this.courante;
    this.courante = neuve;
    if (avant === null) return 'premier';
    if (avant.largeur !== neuve.largeur || avant.hauteur !== neuve.hauteur) return 'dimensions';
    if (memesTerrains(avant, neuve)) {
      // Rien n'a bougé : on garde l'ancienne grille, que d'autres ont peut-être
      // déjà comparée par identité.
      this.courante = avant;
      return 'rien';
    }
    return 'terrain';
  }
}

