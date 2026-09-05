/**
 * Plomberie des hooks : la couche climat d'abord, la mécanique régionale ensuite,
 * sur chacun des cinq points de branchement (`doc/04-gameplay.md` §11.1 et §12.5).
 * Le local a donc le dernier mot sur le global.
 *
 * Les hooks sont purs : ils rendent des effets déclaratifs, jamais un état modifié.
 */

import type { CampId, Case, CleTerrain, TypeMouvement, UnitType } from '../schemas/index';
import { effetsSaisonPartie, MECANIQUE_CLIMAT } from './climat/index';
import { mecaniqueDe } from './mecaniques/registre';
import type {
  Catalogue, CtxMecanique, EffetMecanique, EtatPartie, EtatRng, InstantaneRng,
  Mecanique, Rng, Unite, VerdictMouvement,
} from './types';
import { cleCase } from './types';

/**
 * Flux muet : un hook de lecture (`modifTerrain`, `surCoutCase`) n'a pas le droit
 * de tirer un aléa. S'il le fait, on le voit tout de suite.
 */
export const RNG_LECTURE: Rng = {
  chemin: 'lecture',
  etat: [0, 0, 0, 0] as EtatRng,
  suivant(): number { throw new Error('un hook de lecture ne tire aucun aléa'); },
  entier(): number { throw new Error('un hook de lecture ne tire aucun aléa'); },
  branche(): Rng { return RNG_LECTURE; },
  instantane(): InstantaneRng { return {}; },
  restaurer(): void { /* rien */ },
};

/** Mécanique régionale déclarée par la partie, si elle est enregistrée. */
export function mecaniqueDeLaPartie(etat: EtatPartie): Mecanique<never> | undefined {
  return mecaniqueDe(etat.mecanique?.cle);
}

/**
 * Contextes de lecture, mémorisés par état : `modifTerrain` et `surCoutCase` sont
 * appelés des centaines de fois par recherche de chemin, et rien n'oblige à
 * rallouer un contexte à chaque fois. Les champs vivants (`journee`, `camp`,
 * `donnees`) sont des accesseurs, donc jamais périmés.
 */
const CONTEXTES = new WeakMap<EtatPartie, { climat: CtxMecanique; meca: CtxMecanique<never> }>();

function contextesDeLecture(
  etat: EtatPartie, cat: Catalogue,
): { climat: CtxMecanique; meca: CtxMecanique<never> } {
  const connu = CONTEXTES.get(etat);
  if (connu) return connu;
  const commun = {
    etat,
    catalogue: cat,
    rng: RNG_LECTURE,
    get journee(): number { return etat.journee; },
    get camp(): CampId { return etat.campCourant; },
  };
  const paire = {
    climat: {
      ...commun,
      parametres: {} as Record<string, never>,
      get donnees(): Record<string, number | string | boolean> { return {}; },
    } as CtxMecanique,
    meca: {
      ...commun,
      get parametres(): never { return (etat.mecanique?.parametres ?? {}) as never; },
      get donnees(): Record<string, number | string | boolean> {
        return etat.mecanique?.donnees ?? {};
      },
    } as unknown as CtxMecanique<never>,
  };
  CONTEXTES.set(etat, paire);
  return paire;
}

/** Contexte d'appel d'une mécanique régionale. */
function ctxMeca(etat: EtatPartie, cat: Catalogue, rng: Rng): CtxMecanique<never> {
  if (rng === RNG_LECTURE) return contextesDeLecture(etat, cat).meca;
  const bloc = etat.mecanique;
  return {
    etat,
    catalogue: cat,
    parametres: (bloc?.parametres ?? {}) as never,
    journee: etat.journee,
    camp: etat.campCourant,
    rng: rng.branche(`meca:${bloc?.cle ?? 'aucune'}`),
    donnees: bloc?.donnees ?? {},
  };
}

/** Contexte d'appel de la couche climat. */
function ctxClimat(etat: EtatPartie, cat: Catalogue, rng: Rng): CtxMecanique {
  if (rng === RNG_LECTURE) return contextesDeLecture(etat, cat).climat;
  return {
    etat,
    catalogue: cat,
    parametres: {} as Record<string, never>,
    journee: etat.journee,
    camp: etat.campCourant,
    rng: rng.branche('climat'),
    donnees: {},
  };
}

/** Terrain de grille d'une case, sans réinterprétation. `null` hors carte. */
export function terrainBrut(etat: EtatPartie, cat: Catalogue, c: Case): CleTerrain | null {
  const ligne = etat.grille[c.y];
  if (ligne === undefined) return null;
  const car = ligne[c.x];
  if (car === undefined) return null;
  return cat.parCaractere[car] ?? null;
}

/** Vrai si la case est dans les bornes de la carte. */
export function dansCarte(etat: EtatPartie, c: Case): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < etat.largeur && c.y < etat.hauteur;
}

/** Mémoire du terrain logique, attachée à l'état : lecture la plus fréquente. */
const TERRAINS = new WeakMap<
  EtatPartie, { journee: number; poses: number; vue: (CleTerrain | null | undefined)[] }
>();

/**
 * Mémoire partagée entre états : deux parties à la même journée, sous le même
 * climat et sur la même carte lisent exactement le même terrain. C'est ce qui
 * rend une campagne de simulation abordable.
 */
const VUES_PARTAGEES = new Map<string, (CleTerrain | null | undefined)[]>();

/** Signature de tout ce dont dépend le terrain logique. */
export function signatureTerrain(etat: EtatPartie): string {
  const m = etat.mecanique;
  const poses = etat.terrainsPoses.map((p) => `${p.case}:${p.terrain}`).join(',');
  const meca = m === null ? '' : `${m.cle}|${JSON.stringify(m.parametres)}|${JSON.stringify(m.donnees)}|${m.gelable}`;
  return `${etat.carteCle}|${etat.largeur}x${etat.hauteur}|${etat.journee}|${etat.climat.saison}`
    + `|${etat.climat.meteo}|${etat.climat.phase}|${etat.reglages.climatPays}|${poses}|${meca}`;
}

/** Vue de terrain de cet état, partagée dès que la signature est connue. */
function vueTerrain(etat: EtatPartie): (CleTerrain | null | undefined)[] {
  const memo = TERRAINS.get(etat);
  if (memo && memo.journee === etat.journee && memo.poses === etat.terrainsPoses.length) {
    return memo.vue;
  }
  const signature = signatureTerrain(etat);
  let vue = VUES_PARTAGEES.get(signature);
  if (!vue) {
    vue = new Array<CleTerrain | null | undefined>(etat.largeur * etat.hauteur);
    if (VUES_PARTAGEES.size > 512) VUES_PARTAGEES.clear();
    VUES_PARTAGEES.set(signature, vue);
  }
  TERRAINS.set(etat, { journee: etat.journee, poses: etat.terrainsPoses.length, vue });
  return vue;
}

/**
 * Terrain **logique** d'une case : la grille, puis les poses de terrain, puis la
 * lecture du climat, puis celle de la mécanique régionale. La grille de la carte
 * n'est jamais réécrite : tout est vue.
 */
export function terrainLogique(etat: EtatPartie, cat: Catalogue, c: Case): CleTerrain | null {
  if (!dansCarte(etat, c)) return terrainBrut(etat, cat, c);
  const vue = vueTerrain(etat);
  const indice = c.y * etat.largeur + c.x;
  const connu = vue[indice];
  if (connu !== undefined) return connu;
  const calcule = calculerTerrain(etat, cat, c);
  vue[indice] = calcule;
  return calcule;
}

/** Le calcul lui-même, sans mémoire : grille, poses, climat, mécanique. */
function calculerTerrain(etat: EtatPartie, cat: Catalogue, c: Case): CleTerrain | null {
  const brut = terrainBrut(etat, cat, c);
  if (brut === null) return null;
  let terrain = brut;
  if (etat.terrainsPoses.length > 0) {
    const k = cleCase(c);
    for (const pose of etat.terrainsPoses) {
      if (pose.case === k) terrain = pose.terrain;
    }
  }
  const climat = MECANIQUE_CLIMAT.hooks.modifTerrain;
  if (climat) terrain = climat(ctxClimat(etat, cat, RNG_LECTURE), c, terrain);
  const meca = mecaniqueDeLaPartie(etat);
  if (meca?.hooks.modifTerrain) {
    terrain = meca.hooks.modifTerrain(ctxMeca(etat, cat, RNG_LECTURE), c, terrain);
  }
  return terrain;
}

/** Mémoire des surcoûts, par état et par journée : ce sont de petits entiers. */
const SURCOUTS = new WeakMap<EtatPartie, Map<string, number>>();

/** Mémoire de la question « cette journée surcharge-t-elle le mouvement ? ». */
const INERTES = new WeakMap<EtatPartie, { journee: number; inerte: boolean }>();

/**
 * Vrai si ni le climat ni la mécanique ne peuvent surcharger une case ce jour-là :
 * c'est le cas le plus fréquent, et il évite tout le calcul de surcoût.
 */
function sansSurcout(etat: EtatPartie): boolean {
  const connu = INERTES.get(etat);
  if (connu && connu.journee === etat.journee) return connu.inerte;
  const meteoInerte = etat.climat.meteo === 'clair' || etat.climat.meteo === 'brouillard'
    || etat.climat.meteo === 'tempete' || etat.climat.meteo === 'canicule';
  const saisonInerte = effetsSaisonPartie(etat.reglages).every(
    (e) => e !== 'neige_plaines' && e !== 'sol_detrempe' && e !== 'cols_fermes'
      && e !== 'saison_des_pluies',
  );
  const meca = mecaniqueDeLaPartie(etat);
  const inerte = meteoInerte && saisonInerte && meca?.hooks.surCoutCase === undefined;
  INERTES.set(etat, { journee: etat.journee, inerte });
  return inerte;
}

/** Surcoût de case cumulé (climat puis mécanique), avant plafond et plancher. */
export function surcoutCase(
  etat: EtatPartie, cat: Catalogue, mouvement: TypeMouvement, terrain: CleTerrain, u: UnitType,
): number {
  if (sansSurcout(etat)) return 0;
  let memo = SURCOUTS.get(etat);
  if (!memo) {
    memo = new Map<string, number>();
    SURCOUTS.set(etat, memo);
  }
  const cle = `${etat.journee}|${u.cle}|${mouvement}|${terrain}`;
  const connu = memo.get(cle);
  if (connu !== undefined) return connu;
  let surcout = 0;
  const climat = MECANIQUE_CLIMAT.hooks.surCoutCase;
  if (climat) surcout += climat(ctxClimat(etat, cat, RNG_LECTURE), mouvement, terrain, u);
  const meca = mecaniqueDeLaPartie(etat);
  if (meca?.hooks.surCoutCase) {
    surcout += meca.hooks.surCoutCase(ctxMeca(etat, cat, RNG_LECTURE), mouvement, terrain, u);
  }
  memo.set(cle, surcout);
  return surcout;
}

/** Dégâts après les hooks `surAttaque` : climat, puis mécanique. */
export function surAttaqueHooks(
  etat: EtatPartie, cat: Catalogue, att: Unite, def: Unite, degats: number, rng: Rng,
): number {
  let d = degats;
  const climat = MECANIQUE_CLIMAT.hooks.surAttaque;
  if (climat) d = climat(ctxClimat(etat, cat, rng), att, def, d);
  const meca = mecaniqueDeLaPartie(etat);
  if (meca?.hooks.surAttaque) d = meca.hooks.surAttaque(ctxMeca(etat, cat, rng), att, def, d);
  return d;
}

/** Verdict cumulé des hooks `surMouvement` : le premier refus l'emporte. */
export function surMouvementHooks(
  etat: EtatPartie, cat: Catalogue, unite: Unite, chemin: Case[],
): VerdictMouvement {
  let courant: Case[] = chemin;
  const meca = mecaniqueDeLaPartie(etat);
  if (meca?.hooks.surMouvement) {
    const v = meca.hooks.surMouvement(ctxMeca(etat, cat, RNG_LECTURE), unite, courant);
    if (!v.ok) return v;
    if ('cheminTronque' in v) courant = v.cheminTronque;
  }
  return courant === chemin ? { ok: true } : { ok: true, cheminTronque: courant };
}

/** Effets d'un hook de tour, séparés par couche : climat d'abord, mécanique ensuite. */
export interface EffetsDeTour { climat: EffetMecanique[]; meca: EffetMecanique[] }

/** Effets du hook `debutTour`. */
export function debutTourHooks(etat: EtatPartie, cat: Catalogue, rng: Rng): EffetsDeTour {
  const climat = MECANIQUE_CLIMAT.hooks.debutTour
    ? MECANIQUE_CLIMAT.hooks.debutTour(ctxClimat(etat, cat, rng)) : [];
  const m = mecaniqueDeLaPartie(etat);
  const meca = m?.hooks.debutTour ? m.hooks.debutTour(ctxMeca(etat, cat, rng)) : [];
  return { climat, meca };
}

/** Effets du hook `finTour`. */
export function finTourHooks(etat: EtatPartie, cat: Catalogue, rng: Rng): EffetsDeTour {
  const climat = MECANIQUE_CLIMAT.hooks.finTour
    ? MECANIQUE_CLIMAT.hooks.finTour(ctxClimat(etat, cat, rng)) : [];
  const m = mecaniqueDeLaPartie(etat);
  const meca = m?.hooks.finTour ? m.hooks.finTour(ctxMeca(etat, cat, rng)) : [];
  return { climat, meca };
}
