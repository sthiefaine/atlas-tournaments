/**
 * Ce que le sol sait d'un terrain : son **code** dans la texture de données, et
 * les **matières** qui le peignent.
 *
 * Tout est pur et sert deux lecteurs : le TypeScript qui encode la grille
 * (`grille.ts`) et le nuanceur, qui reçoit ces tables en constantes et en
 * uniformes (`nuanceurs.ts`). Une seule source : un code écrit à la main dans
 * le GLSL divergerait le jour où un terrain entre au canon — la faute déjà
 * commise quatre fois sur les listes de bâtiments (`CLAUDE.md`, catalogue 5).
 */

import type { Biome, CleTerrain } from '../../schemas/types';

/**
 * L'ordre des codes. Il n'a rien de canonique — c'est une clé de texture — mais
 * les bâtiments sont **contigus en fin de liste** : le nuanceur reconnaît une
 * case bâtie par `code >= CODE_VILLE`, sans table de plus.
 */
export const ORDRE_CODES = [
  'plaine', 'herbe_haute', 'foret', 'montagne', 'route', 'plage', 'riviere', 'pont', 'mer',
  'ville', 'usine', 'aeroport', 'qg', 'radar', 'port',
] as const satisfies readonly CleTerrain[];

/** La taille des tables indexées par code, dans le nuanceur : de la place pour grandir. */
export const NB_CODES = 16;

const CODES = new Map<CleTerrain, number>(ORDRE_CODES.map((t, i) => [t, i]));

/** Le code d'un terrain ; un terrain inconnu se peint comme la plaine plutôt que de lever. */
export function codeDe(t: CleTerrain): number {
  return CODES.get(t) ?? 0;
}

/** Le terrain d'un code, pour les tests et le débogage. */
export function terrainDuCode(code: number): CleTerrain {
  return ORDRE_CODES[code] ?? 'plaine';
}

/**
 * Les terrains qui portent une construction : leur case est une cour propre,
 * que le sprite du bâtiment couvre. Même liste que la 3D (`TERRAINS_BATIS`),
 * reprise ici parce que `render2d/` ne lit jamais `render3d/`.
 */
export const TERRAINS_BATIS: ReadonlySet<CleTerrain> = new Set<CleTerrain>([
  'ville', 'qg', 'usine', 'aeroport', 'radar', 'port',
]);

/** L'eau libre : la mer, et le chenal des rivières. Sous un pont, le chenal continue. */
export const TERRAINS_EAU: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['mer', 'riviere']);

/** Vrai pour ce sous quoi l'eau passe : la mer, la rivière, le pont. */
export function porteEau(t: CleTerrain): boolean {
  return TERRAINS_EAU.has(t) || t === 'pont';
}

/**
 * Les matières que la grille répartit, dans l'ordre des deux textures de poids
 * du nuanceur : `herbe, terre, roche, sable` puis `galets, pave, sousbois,
 * herbehaute`. La neige n'en est pas : elle **couvre** les autres, selon le
 * climat, au lieu d'être posée par un terrain.
 */
export const MATIERES = [
  'herbe', 'terre', 'roche', 'sable', 'galets', 'pave', 'sousbois', 'herbehaute',
] as const;
export type MatiereSol = typeof MATIERES[number];

/**
 * Le mélange de matières d'un terrain. La somme d'une ligne vaut 1 ; le nuanceur
 * renormalise quand même. Ce qui dessine un terrain n'est pas sa matière seule :
 * la route a sa chaussée (`voies`), l'eau son chenal, la forêt ses arbres — la
 * matière dit ce qu'il y a **dessous et autour**.
 */
const MELANGES: Readonly<Record<CleTerrain, Partial<Record<MatiereSol, number>>>> = {
  plaine: { herbe: 1 },
  // L'herbe haute est une herbe plus drue et plus sombre : ce sont ses touffes
  // qui la disent, la matière ne fait que la préparer.
  herbe_haute: { herbehaute: 0.85, herbe: 0.15 },
  // Les arbres identifient la forêt. Le gazon reste continu sous leur sprite,
  // sans assombrissement de toute la case qui ressemble à une ombre carrée.
  foret: { herbe: 1 },
  // Le relief est porté par le sprite : pas de dalle rocheuse pleine case.
  montagne: { herbe: 0.72, terre: 0.18, roche: 0.1 },
  // La chaussée est tracée par-dessus ; la matière n'apporte que ses bas-côtés.
  route: { herbe: 0.6, terre: 0.4 },
  plage: { sable: 1 },
  // Le lit de la rivière, que l'on voit sur ses berges et au travers de l'eau.
  riviere: { galets: 0.12, sable: 0.13, terre: 0.3, herbe: 0.45 },
  pont: { galets: 0.12, sable: 0.13, terre: 0.3, herbe: 0.45 },
  // Le fond marin : il ne se voit que par les hauts-fonds.
  mer: { sable: 0.8, galets: 0.2 },
  // Les bâtiments sont des sprites détourés : aucun socle carré ajouté par
  // le terrain. Leur sol reste celui de la plaine du biome (et reçoit la neige).
  ville: { herbe: 1 },
  usine: { herbe: 1 },
  aeroport: { herbe: 1 },
  qg: { herbe: 1 },
  radar: { herbe: 1 },
  // Le quai du port forme réellement la limite entre terre et mer.
  port: { pave: 1 },
};

/** Les huit poids d'un terrain, dans l'ordre de `MATIERES`, normalisés. */
export function poidsDe(t: CleTerrain, biome: Biome = 'plaine'): number[] {
  const m = { ...(MELANGES[t] ?? MELANGES.plaine) };
  // La case tactique « plaine » garde ses règles, mais le désert est du sable
  // et le volcan de la cendre. Le même fond traverse les silhouettes bâties.
  const herbe = m.herbe ?? 0;
  if (biome === 'desert') {
    m.sable = (m.sable ?? 0) + herbe;
    m.herbe = 0;
  } else if (biome === 'volcanique') {
    m.roche = (m.roche ?? 0) + herbe * 0.65;
    m.terre = (m.terre ?? 0) + herbe * 0.35;
    m.herbe = 0;
  }
  const poids = MATIERES.map((cle) => m[cle] ?? 0);
  const somme = poids.reduce((a, b) => a + b, 0) || 1;
  return poids.map((p) => p / somme);
}

/**
 * Les deux tableaux d'uniformes `uPoidsA` et `uPoidsB` : quatre poids par
 * code, `NB_CODES` codes chacun. Les codes sans terrain valent la plaine.
 */
export function tablesPoids(biome: Biome = 'plaine'): { a: Float32Array; b: Float32Array } {
  const a = new Float32Array(NB_CODES * 4);
  const b = new Float32Array(NB_CODES * 4);
  for (let code = 0; code < NB_CODES; code += 1) {
    const p = poidsDe(terrainDuCode(code), biome);
    for (let k = 0; k < 4; k += 1) {
      a[code * 4 + k] = p[k] ?? 0;
      b[code * 4 + k] = p[k + 4] ?? 0;
    }
  }
  return { a, b };
}
