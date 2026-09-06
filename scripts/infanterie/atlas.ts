/**
 * L'atlas UV de l'infanterie : une grille de cases nommées sur une texture
 * carrée, **partagée** par le maillage (qui y place ses UV) et par les peintres
 * de textures (qui y posent leurs couleurs, leur relief et leur rugosité).
 *
 * Une case est une matière : un maillot, un pantalon, une peau, un visage, un
 * lanceur. Le masque d'équipe se déduit de la case (`equipe`) : c'est ce qui
 * garantit que la géométrie, l'albédo et le masque ne divergent jamais — une
 * pièce qui change de case change de matière et de masque du même coup.
 *
 * Les trois visages ont chacun leur case, et chaque peau la sienne : trois
 * figurines d'une même escouade ne sont pas trois jumeaux.
 */

/** Côté de l'atlas de référence, en pixels ; les cartes plus petites sont à l'échelle. */
export const COTE_ATLAS = 1024;

/** Les cases nommées de l'atlas. */
export const NOMS_CELLULES = [
  'uniforme', 'casque', 'sac', 'pantalon',
  'visage_0', 'visage_1', 'visage_2', 'peau_0', 'peau_1', 'peau_2',
  'bottes', 'cuir', 'lanceur', 'signal', 'rebord', 'rouleau', 'socle',
] as const;
/** Nom d'une case de l'atlas. */
export type NomCellule = typeof NOMS_CELLULES[number];

/** Une case de l'atlas : un rectangle en pixels et sa règle de masque. */
export interface Cellule {
  nom: NomCellule;
  /** Coin haut-gauche, en pixels d'un atlas de `COTE_ATLAS`. */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Vrai si la case prend la couleur d'équipe : blanc dans le masque. */
  equipe: boolean;
}

function cellule(nom: NomCellule, x: number, y: number, largeur: number, hauteur: number, equipe = false): Cellule {
  return { nom, x, y, largeur, hauteur, equipe };
}

/**
 * La disposition. Les grandes cases vont aux grandes surfaces (le maillot, le
 * pantalon), les visages ont 256 pixels de côté pour que deux yeux et une
 * bouche se lisent de près, le reste tient dans 128.
 */
export const CELLULES: Readonly<Record<NomCellule, Cellule>> = {
  uniforme: cellule('uniforme', 0, 0, 512, 256, true),
  casque: cellule('casque', 512, 0, 256, 256, true),
  sac: cellule('sac', 768, 0, 256, 256, true),
  pantalon: cellule('pantalon', 0, 256, 256, 256),
  visage_0: cellule('visage_0', 256, 256, 256, 256),
  visage_1: cellule('visage_1', 512, 256, 256, 256),
  visage_2: cellule('visage_2', 768, 256, 256, 256),
  peau_0: cellule('peau_0', 0, 512, 128, 128),
  peau_1: cellule('peau_1', 128, 512, 128, 128),
  peau_2: cellule('peau_2', 0, 640, 128, 128),
  bottes: cellule('bottes', 128, 640, 128, 128),
  cuir: cellule('cuir', 256, 512, 128, 128),
  lanceur: cellule('lanceur', 384, 512, 256, 128),
  signal: cellule('signal', 640, 512, 128, 128),
  rebord: cellule('rebord', 768, 512, 128, 128),
  rouleau: cellule('rouleau', 896, 512, 128, 128),
  socle: cellule('socle', 256, 640, 256, 128),
};

/**
 * Marge intérieure des UV, en pixels d'atlas : le filtrage linéaire et les
 * mipmaps lisent quelques texels autour d'un point, et la couleur d'une case
 * voisine ne doit jamais baver dans une case. Les peintres, eux, remplissent la
 * case entière.
 */
export const MARGE_UV = 6;

/** Les UV d'un point `(s, t)` de `[0, 1]²` dans une case, marge déduite ; `t` va vers le bas. */
export function uvDans(c: Cellule, s: number, t: number): [number, number] {
  const u = (c.x + MARGE_UV + s * (c.largeur - 2 * MARGE_UV)) / COTE_ATLAS;
  const v = (c.y + MARGE_UV + t * (c.hauteur - 2 * MARGE_UV)) / COTE_ATLAS;
  return [u, v];
}

/** La réciproque de `uvDans` : le `(s, t)` d'un point de texture, pour le peintre ; déborde de `[0, 1]` dans la marge. */
export function parametreDans(c: Cellule, u: number, v: number): [number, number] {
  const s = (u * COTE_ATLAS - c.x - MARGE_UV) / (c.largeur - 2 * MARGE_UV);
  const t = (v * COTE_ATLAS - c.y - MARGE_UV) / (c.hauteur - 2 * MARGE_UV);
  return [s, t];
}

/**
 * Le dépliage d'un visage : l'azimut autour de la tête, `0` devant, va sur la
 * largeur de la case en donnant **soixante-dix pour cent** de la largeur à
 * l'hémisphère avant — c'est là que sont les yeux, la bouche et les sourcils ;
 * l'arrière, sous le casque, se contente du reste. `inverseAzimut` est la
 * réciproque, celle du peintre. Les deux fonctions vivent ici parce qu'elles
 * doivent être **la même** : un œil peint à un azimut doit se retrouver au même
 * azimut sur la sphère.
 */
export const PART_AVANT = 0.7;

export function uDeAzimut(phi: number): number {
  const demi = Math.PI / 2;
  if (Math.abs(phi) <= demi) return 0.5 + (phi / Math.PI) * PART_AVANT;
  const reste = (1 - PART_AVANT) / 2;
  const depasse = (Math.abs(phi) - demi) / demi;
  return phi > 0 ? 0.5 + PART_AVANT / 2 + depasse * reste : 0.5 - PART_AVANT / 2 - depasse * reste;
}

export function azimutDeU(u: number): number {
  const demi = Math.PI / 2;
  const bord = PART_AVANT / 2;
  const reste = (1 - PART_AVANT) / 2;
  if (Math.abs(u - 0.5) <= bord) return ((u - 0.5) / PART_AVANT) * Math.PI;
  const depasse = (Math.abs(u - 0.5) - bord) / reste;
  return u > 0.5 ? demi + depasse * demi : -demi - depasse * demi;
}
