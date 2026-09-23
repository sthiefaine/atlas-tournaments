// De quoi fabriquer une partie d'essai en quelques lignes : une grille écrite
// en caractères, le catalogue canon, et au besoin une mécanique régionale.
import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte, type Catalogue, type EtatPartie,
  type ReglagesPartie,
} from '../../../src/engine/index';
import { niveauxBrouillard } from '../../../src/render2d/contrat';
import type { MapDef } from '../../../src/schemas/types';
import type { GrilleSol } from '../../../src/render2d/sol/grille';
import { grilleBrute } from '../../../src/render2d/sol/grille';

let catalogue: Catalogue | null = null;

/** Le catalogue canon, chargé une fois. */
export function cat(): Catalogue {
  catalogue ??= chargerCatalogue(6);
  return catalogue;
}

/** Une partie sur une grille donnée. */
export function partie(
  grille: string[],
  options: {
    mecanique?: { cle: string; parametres: Record<string, number | string | boolean> };
    reglages?: Partial<ReglagesPartie>;
  } = {},
): EtatPartie {
  const carte = {
    code: 'essai_sol',
    largeur: grille[0]!.length,
    hauteur: grille.length,
    camps: 2,
    grille,
    proprietaires: {},
    unitesDepart: [],
  } as unknown as MapDef;
  const scene = sceneDeCarte(carte, reglagesParDefaut(options.reglages ?? {}), [], options.mecanique ?? null);
  return creerPartie(scene, cat(), 'sol:essai');
}

/** La grille brute d'une grille écrite, sans passer par une partie. */
export function grilleDe(lignes: string[]): GrilleSol {
  return grilleBrute({ largeur: lignes[0]!.length, hauteur: lignes.length, grille: lignes } as unknown as EtatPartie);
}

/** Le brouillard d'une partie sans brouillard : tout est vu. */
export function toutVu(e: EtatPartie): Uint8Array {
  return niveauxBrouillard(e.largeur, e.hauteur, null);
}
