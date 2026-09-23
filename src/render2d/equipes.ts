/**
 * Les **couleurs d'armée** de la peau 2D : ce que la règle de l'écran
 * (`render/couleur-equipe.ts`) fait des nations — la projection dans la fenêtre
 * lisible, la séparation des camps d'une carte — une fois leurs couleurs lues
 * dans leurs styles (`content/styles/<code>.json`, `palette`).
 *
 * C'est ici, et nulle part ailleurs, que la peau passe d'un pays à une couleur :
 * la carte (`creerRendu2d`), l'écran de combat qu'elle ouvre, la vignette du
 * carnet et de l'atelier (`vignette.ts`, `couleurEquipe`) et les poses d'unités
 * (`unites.ts`, `couleurEquipeDe`) appellent ces fonctions, elles ne les
 * recopient plus. La règle, elle, vit dans `render/` parce que l'interface la
 * partage — et que `render/` n'a pas le droit de lire les styles, qui vivent
 * dans `assets/`.
 *
 * Pur : ni DOM, ni WebGL (`tests/render2d/equipes.test.ts`).
 */

import { chargerStyleNation } from '../assets/styles';
import { canauxDe, paletteArmeeParDefaut, paletteProjetee, palettesDesCamps } from '../render/couleur-equipe';
import type { CampId, CodePays, Palette } from '../schemas/types';

/** Une couleur d'équipe, sRGB de 0 à 1 : ce que le lot multiplie au masque. */
export type Rvb = readonly [number, number, number];

/** Une couleur `#rrggbb` en sRGB de 0 à 1, telle que le lot la lit. */
export function rvbDe(hex: string): Rvb {
  return canauxDe(hex);
}

/**
 * La palette **brute** d'une nation : les trois couleurs de son style, telles
 * que le style les déclare. `null` sans pays, ou pour un pays qui n'a pas de
 * style (il n'est pas un pays de départ).
 */
export function paletteDuPays(pays: CodePays | null | undefined): Palette | null {
  const style = pays ? chargerStyleNation(pays) : null;
  return style ? { main: style.palette.main, dark: style.palette.dark, light: style.palette.light } : null;
}

/**
 * La palette d'armée d'un **camp seul** : sa nation projetée dans la fenêtre
 * lisible, sinon la couleur de son camp projetée, et le gris neutre sans camp —
 * un pays ne colore jamais un bâtiment sans propriétaire. Sans voisin à qui se
 * comparer, il n'y a rien à séparer : c'est la règle de la vignette, qui ne
 * montre qu'une pièce, et le point de départ de la carte.
 */
export function paletteArmee(camp: CampId | null, pays?: CodePays | null): Palette {
  if (camp === null) return paletteArmeeParDefaut(null);
  const nation = paletteDuPays(pays);
  return nation ? paletteProjetee(nation) : paletteArmeeParDefaut(camp);
}

/**
 * Les palettes d'armée d'une carte : chaque camp prend sa nation projetée, et
 * celui qui joue après reprend la couleur de son camp s'il tombe trop près d'un
 * autre (`palettesDesCamps`). C'est ce que la peau peint, et ce que l'interface
 * reprend (`Rendu.paletteArmee`).
 */
export function palettesDeLaCarte(
  camps: readonly CampId[], paysParCamp?: Partial<Record<CampId, CodePays>> | null,
): Map<CampId, Palette> {
  return palettesDesCamps(camps.map((camp) => ({ camp, nation: paletteDuPays(paysParCamp?.[camp]) })));
}

/**
 * La couleur d'équipe d'un camp seul, sRGB de 0 à 1 : la couleur principale de
 * `paletteArmee`. Jamais le blanc : les zones d'équipe d'une image cuite sont
 * peintes en blanc et ne se teignent que par cette couleur — un bâtiment
 * neutre laissé sans elle les montrerait blanches, là où la 3D le laissait gris.
 */
export function couleurEquipeSeule(camp: CampId | null, pays?: CodePays | null): Rvb {
  return rvbDe(paletteArmee(camp, pays).main);
}
