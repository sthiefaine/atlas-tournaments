/**
 * Générateur d'aléas seedé, local à `mapgen/`.
 *
 * Le socle prévoit un RNG unique dans `engine/rng.ts` (`02-architecture.md` §7,
 * `xoshiro128**` amorcé par FNV-1a). Le moteur n'existe pas encore : ce fichier
 * en fournit un équivalent minimal (mulberry32) avec **la même interface**, pour
 * que le remplacement plus tard soit une ligne d'import.
 *
 * Interdits respectés : ni `Math.random`, ni horloge, ni état global.
 */

/** Flux d'aléas déterministe, sérialisable en un entier 32 bits. */
export interface Rng {
  /** État courant, pour rejouer un flux exactement. */
  readonly etat: number;
  /** Flottant dans [0, 1). */
  suivant(): number;
  /** Entier dans [0, borne). Renvoie 0 si `borne` est nulle ou négative. */
  entier(borne: number): number;
  /** Entier dans [min, max], bornes comprises. */
  entre(min: number, max: number): number;
  /** Vrai avec la probabilité `p`. */
  chance(p: number): boolean;
  /** Un élément de la liste ; lève si la liste est vide. */
  choisir<T>(liste: readonly T[]): T;
  /** Flux dérivé, indépendant du flux parent (`rng.branche('relief')`). */
  branche(nom: string): Rng;
}

/** Hachage FNV-1a 32 bits d'une chaîne, amorcé par `depart`. */
export function hacher(texte: string, depart = 0x811c9dc5): number {
  let h = depart >>> 0;
  for (let i = 0; i < texte.length; i += 1) {
    h = (h ^ texte.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Crée un flux mulberry32 à partir d'une graine entière. */
export function creerRng(graine: number): Rng {
  let etat = (Math.trunc(graine) >>> 0) || 0x9e3779b9;

  const suivant = (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    get etat() { return etat; },
    suivant,
    entier(borne: number): number {
      if (!(borne > 0)) return 0;
      return Math.floor(suivant() * borne) % Math.trunc(borne);
    },
    entre(min: number, max: number): number {
      if (max <= min) return min;
      return min + rng.entier(max - min + 1);
    },
    chance(p: number): boolean {
      return suivant() < p;
    },
    choisir<T>(liste: readonly T[]): T {
      if (liste.length === 0) throw new Error('choisir sur une liste vide');
      return liste[rng.entier(liste.length)] as T;
    },
    branche(nom: string): Rng {
      return creerRng(hacher(nom, etat));
    },
  };
  return rng;
}
