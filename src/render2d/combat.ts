/**
 * # L'écran de combat de la peau 2D — `ouvrirCombat`
 *
 * La signature d'Advance Wars : la vue de côté où deux formations se tirent
 * dessus. Ce que le propriétaire a demandé (`doc/refonte/mobile-formations-combat.md`,
 * `bataille-animation.md`), et que ce module tient point par point :
 *
 * - **chaque côté sur l'image de sa propre case** : le sol, le lointain et le
 *   ciel sont peints d'après le terrain de la case, les couleurs du sol du
 *   biome (`sol/couleurs.ts`) et la palette d'ambiance (saison, nuit, météo) ;
 *   la forêt y dresse ses arbres, la montagne sa montagne, la ville son
 *   bâtiment, aux couleurs de son propriétaire ;
 * - **10 PV = 10 figurines, 6 PV = 6** : les nombres viennent de `Geste.duel`,
 *   déjà en PV affichés ; une figurine perdue quitte la formation **à
 *   l'impact**, pas au départ du tir, et un côté qui tombe à zéro joue son
 *   `hors_jeu` en s'effaçant ;
 * - **la chronologie est celle de la partition, jamais une autre** : tir à 35 %
 *   du duel, riposte 80 ms plus tard (40 en cadence rapide), le vol d'un
 *   projectile est celui du geste `tirer`. Les **sons** du duel sont joués par
 *   les gestes `tirer` et `encaisser` de la carte, que le réalisateur cale sur
 *   ces mêmes instants (`ecrirePartition`) — comme en 3D : l'écran n'en joue
 *   aucun, sinon chacun s'entendrait deux fois ;
 * - **animations réduites** (ou une partition sans durée) : l'issue paraît
 *   d'emblée, sans un projectile ; **passer** saute à l'issue ; **fermer** rend
 *   tout, et deux fois sans dommage.
 *
 * ## Comment c'est dessiné
 *
 * Tout passe par les **encarts** du moteur (`Rendu2d.ouvrirEncart`) : une
 * scène de sprites dessinée dans la toile au rectangle d'un élément HTML, qui
 * partage le lot, l'atlas et les replis de la carte. Rien ne se charge ici :
 * l'atlas rend l'image cuite qu'il a, ou le repli qu'il sait peindre.
 *
 * Le décor d'une case est fait de **bandes** peintes sous les figurines, dans
 * le même encart (`EncartSprites.aplats`, `tracerBandes`) : le ciel, le
 * lointain et le sol de chaque moitié, et le filet qui les sépare. Des aplats,
 * comme les fonds de combat d'Advance Wars ; l'horizon tombe à `PART_HORIZON`
 * de la hauteur, et la disposition des figurines le sait. Un duel tient donc
 * en un seul encart — il en a demandé sept, un par bande, jusqu'au 23
 * septembre 2026 —, et ses bandes ne sont retracées que si l'hôte change de
 * taille.
 *
 * Les effets — éclair de bouche, projectile, traînée, éclat et poussière d'un
 * impact — sont la forme d'ombre du rendu (`FORMES.ombre`) poussée vers le
 * blanc par son `eclat` : une tache douce, blanche ou grise, sans une image de
 * plus. `doc/refonte/sprites-combat.md` dit ce qui manque pour mieux faire.
 *
 * **Aucune allocation par image** : toutes les poses sont créées à
 * l'ouverture et réécrites en place, une pose inutile passe à l'opacité 0 ; la
 * disposition ne se refait que si la taille de l'hôte change.
 *
 * Pur à ses bords : la chronologie, les effectifs, la disposition, le profil
 * d'un tir et les couleurs du décor se testent sans DOM ni WebGL
 * (`tests/render2d/combat.test.ts`) ; la scène reçoit tout ce qu'elle touche.
 */

import type { Catalogue } from '../engine/index';
import { lireCouleur, type Ambiance } from '../render/ambiance';
import { DUREES, MISE_EN_SCENE, type Geste } from '../render/partition';
import type { VueCombat } from '../render/rendu';
import { echelleTaille } from '../render/sprites/silhouettes';
import type { Biome, CampId, Case, CleTerrain, CleUnite, UnitType } from '../schemas/types';
import type { Trace } from './aplats';
import { cadreAuTemps, choisirAnimation } from './atlas';
import type { EtatCamera2d } from './camera';
import {
  COS_TANGAGE, idDecor, OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE,
  type CalqueRendu, type ClipSprite, type EntreeSprite, type EssenceDecor,
} from './contrat';
import type { AplatsEncart, EncartSprites } from './index';
import type { Pose } from './lot';
import { FORMES } from './replis';
import { couleursSol, DISPOSITION } from './sol/couleurs';
import { ARBRES, essenceMontagne, rocherDe } from './sol/decor';
import { MATIERES, poidsDe, type MatiereSol } from './sol/terrains';
import { solSousUnite, type AnimationChoisie, type Rvb } from './unites';

/** Le geste que le HUD passe à `ouvrirCombat`. */
export type Duel = Extract<Geste, { genre: 'duel' }>;

/** Les deux côtés d'un duel : l'attaquant à gauche, la cible à droite, comme les plaques du HUD et la 3D. */
export type CoteDuel = 'attaquant' | 'cible';

/** Les figurines d'une formation pleine : une par PV affiché. */
export const MAX_FIGURINES = 10;

// ---------------------------------------------------------------------------
// 1. La chronologie : celle de la partition, jamais une autre
// ---------------------------------------------------------------------------

/** L'écart entre deux tireurs d'une même formation, à cadence normale : un feu roulant, pas un bloc. */
export const ECART_TIREURS = 24;
/** L'arrêt sur image au coup, à cadence normale : court, il marque le coup sans le retarder. */
export const ARRET_IMAGE = 60;
/** La secousse qui suit l'arrêt. */
export const DUREE_SECOUSSE = 200;
/** Le recul d'un tireur. */
export const DUREE_RECUL = 180;
/** Le retour de l'éclat blanc d'une figurine touchée. */
const DUREE_ECLAT = 140;
/** L'éclair de bouche. */
const DUREE_ECLAIR = 90;
/** L'éclat et la poussière d'une figurine perdue. */
const DUREE_EXPLOSION = 220;
const DUREE_POUSSIERE = 460;
/** Un clip sans image cuite : la durée du geste qu'il remplace. */
const CLIP_REPLI = { tir: DUREES.tir, touche: DUREES.encaisser } as const;

/**
 * Les instants d'un duel, en millisecondes depuis son début. Ils sont déduits
 * **de la partition** (`ecrirePartition`, `MISE_EN_SCENE`) : le HUD fait
 * tomber ses jauges aux mêmes instants, et la carte y joue ses sons.
 */
export interface ChronologieDuel {
  /** La durée du duel ; 0 : la présentation est fixe, l'issue paraît d'emblée. */
  duree: number;
  /** La cadence : 1 normale, 0,5 rapide — ce que la partition a appliqué à toutes ses durées. */
  facteur: number;
  /** Le départ du tir de l'attaquant : 35 % du duel. */
  tir: number;
  /** Le vol d'un projectile : celui du geste `tirer`. */
  vol: number;
  /** L'arrivée du tir : les pertes de la cible tombent là. */
  impactCible: number;
  /** Le départ de la riposte (80 ms après le tir), `null` quand le moteur n'en a pas. */
  riposte: number | null;
  /** L'arrivée de la riposte : les pertes de l'attaquant tombent là. */
  impactAttaquant: number | null;
  /** L'arrêt sur image au coup. */
  arret: number;
  /** La secousse qui suit l'arrêt. */
  secousse: number;
  /** Le fondu d'une formation qui tombe à zéro. */
  fondu: number;
}

/** La chronologie d'un duel, déduite de sa durée : la cadence rapide est une durée divisée par deux. */
export function chronologieDuel(duel: Pick<Duel, 'duree' | 'riposte'>): ChronologieDuel {
  const duree = Number.isFinite(duel.duree) ? Math.max(0, duel.duree) : 0;
  const facteur = duree / DUREES.duel;
  const tir = duree * MISE_EN_SCENE.partCoup;
  const vol = DUREES.tir * facteur;
  const riposte = duel.riposte ? tir + MISE_EN_SCENE.delaiRiposte * facteur : null;
  return {
    duree, facteur, tir, vol,
    impactCible: tir + vol,
    riposte,
    impactAttaquant: riposte === null ? null : riposte + vol,
    arret: ARRET_IMAGE * facteur,
    secousse: DUREE_SECOUSSE * facteur,
    fondu: DUREES.sortir * facteur,
  };
}

/** L'écart entre deux tireurs d'une salve de `n` : tous partent avant la moitié du vol, et arrivent ensemble. */
export function ecartTireurs(chrono: ChronologieDuel, n: number): number {
  return n > 1 ? Math.min(ECART_TIREURS * chrono.facteur, (chrono.vol * 0.5) / (n - 1)) : 0;
}

/** Des PV affichés en figurines : un entier de 0 à 10. */
export function figurines(pv: number): number {
  return Number.isFinite(pv) ? Math.max(0, Math.min(MAX_FIGURINES, Math.round(pv))) : 0;
}

/** Les figurines debout d'**un** côté à l'instant `t`. */
export function effectifAu(duel: Duel, chrono: ChronologieDuel, cote: CoteDuel, t: number): number {
  const u = cote === 'attaquant' ? duel.attaquant : duel.cible;
  const impact = cote === 'attaquant' ? chrono.impactAttaquant : chrono.impactCible;
  if (chrono.duree <= 0 || t >= chrono.duree) return figurines(u.pvApres);
  return impact !== null && t >= impact ? figurines(u.pvApres) : figurines(u.pvAvant);
}

/**
 * Les figurines **debout** de chaque côté à l'instant `t` : les PV d'avant
 * jusqu'à l'impact qui touche ce côté, ceux d'après ensuite. Sans riposte,
 * l'attaquant garde les siens ; à la fin du duel, chacun a ceux d'après.
 */
export function effectifsAu(duel: Duel, chrono: ChronologieDuel, t: number): { attaquant: number; cible: number } {
  return { attaquant: effectifAu(duel, chrono, 'attaquant', t), cible: effectifAu(duel, chrono, 'cible', t) };
}

// ---------------------------------------------------------------------------
// 2. Le profil d'un tir : ce que l'arme envoie, lu sur les données
// ---------------------------------------------------------------------------

/** Ce qui traverse l'écran : une rafale, un obus en cloche, un missile, un traçant. */
export type ProfilTir2d = 'rafale' | 'obus' | 'missile' | 'marqueur';

/**
 * Le profil d'un tir, lu sur les **données** de l'unité, jamais sur son nom —
 * la lecture du son (`animations.ts`, `sonTir`), prolongée : la mitrailleuse
 * contre ses cibles secondaires, le lance-roquettes, le tir indirect en
 * cloche, la bombe d'un appareil à nacelle, le missile d'un avion ; la rafale
 * de ce qui marche, vole en rotor ou tire au radar ; le traçant d'un canon
 * pour le reste.
 */
export function profilTir2d(type?: UnitType, cible?: UnitType): ProfilTir2d {
  if (!type) return 'marqueur';
  const s = type.silhouette;
  if (cible && type.armeSecondaire?.includes(cible.cle)) return 'rafale';
  if (s.modules.includes('lance_roquettes')) return 'missile';
  if (type.portee[0] > 1) return 'obus';
  if (s.base === 'ailes') return s.modules.includes('nacelle') ? 'obus' : 'missile';
  if (s.base === 'pattes' || s.base === 'rotor') return 'rafale';
  if (s.modules.includes('radar') && !s.modules.includes('canon_long')) return 'rafale';
  return 'marqueur';
}

// ---------------------------------------------------------------------------
// 3. La disposition : des rangs lisibles, dans le rectangle de l'hôte
// ---------------------------------------------------------------------------

/** La part de la hauteur donnée au ciel, puis au lointain ; l'horizon tombe à leur somme. */
export const PART_CIEL = 0.34;
export const PART_LOINTAIN = 0.1;
export const PART_HORIZON = PART_CIEL + PART_LOINTAIN;
/** Le filet qui sépare les deux cases, en pixels CSS. */
export const SEPARATION = 3;

/** Le pas entre deux colonnes d'une formation, en cases (une figurine vaut à peu près une case). */
const PAS_X = 0.62;
/** Le pas entre deux rangs, en cases d'écran : les rangs se chevauchent, comme de profil. */
const PAS_Y = 0.3;
/** La boîte nominale d'une figurine, en cases : ce qu'on garde dans le rectangle. */
export const LARGEUR_FIGURE = 0.95;
export const HAUTEUR_FIGURE = 0.9;
/** La place sous le premier rang, pour son ombre, en cases. */
export const PIED_FIGURE = 0.12;
/** Les pieds du dernier rang, sous l'horizon, en cases. */
const SOUS_HORIZON = 0.12;
/** La marge du rectangle, en pixels CSS. */
const MARGE = 4;
/** La hauteur d'un appareil peint en repli, en cases : l'image cuite porte déjà la sienne. */
const VOL_REPLI = 0.45;
/** Une figurine ne dépasse ni cette part de la hauteur, ni ce nombre de pixels : le ciel reste. */
const PART_TAILLE_MAX = 0.42;
const TAILLE_MAX = 160;
/** Les formations essayées : colonnes et rangs pour dix places. */
const CONFIGURATIONS: readonly (readonly [colonnes: number, rangs: number])[] = [[2, 5], [3, 4], [4, 3], [5, 2]];

/** Ce qu'une formation sait de son unité pour se disposer. */
export interface GabaritFormation {
  /** Le facteur de taille de la silhouette (`echelleTaille`). */
  taille: number;
  /** De combien la figurine est levée au-dessus de ses pieds, en cases. */
  vol: number;
}

/** Une place : les pieds d'une figurine, en pixels CSS dans le rectangle de l'hôte. */
export interface PlaceFigurine { u: number; v: number }

/** Une formation disposée. */
export interface Formation {
  /** Les dix places, dans l'ordre de remplissage : les `n` premières portent `n` figurines. */
  places: PlaceFigurine[];
  /** Les places, de la plus proche de l'adversaire à la plus lointaine : l'ordre du feu. */
  proximite: number[];
  /** +1 regarde vers la droite (l'attaquant), −1 vers la gauche. */
  sens: 1 | -1;
  gabarit: GabaritFormation;
}

/** Tout ce que la scène sait de son rectangle. */
export interface DispositionCombat {
  largeur: number;
  hauteur: number;
  /** La largeur d'une moitié, filet déduit. */
  demi: number;
  /** L'horizon, en pixels CSS depuis le haut. */
  horizon: number;
  /** Pixels CSS par case : la taille d'une figurine. */
  taille: number;
  colonnes: number;
  rangs: number;
  attaquant: Formation;
  cible: Formation;
}

/**
 * La disposition des deux formations dans un rectangle de `largeur × hauteur`
 * pixels CSS. Quatre formations s'essaient — deux colonnes de cinq rangs sur
 * un téléphone en portrait, cinq colonnes de deux rangs sur une bande basse —
 * et on garde celle qui donne les plus grandes figurines, les deux côtés à la
 * même échelle ; à égalité, la plus large. Chaque figurine tient dans le
 * rectangle et dans sa moitié : les pieds dans le sol, la tête sous le bord.
 */
export function disposerCombat(
  largeur: number, hauteur: number, attaquant: GabaritFormation, cible: GabaritFormation,
): DispositionCombat {
  const W = Math.max(1, largeur);
  const H = Math.max(1, hauteur);
  const demi = Math.max(1, (W - SEPARATION) / 2);
  const marge = Math.max(6, 0.035 * W);
  const horizon = H * PART_HORIZON;
  const t = Math.max(attaquant.taille, cible.taille);
  const vol = Math.max(attaquant.vol, cible.vol);
  let meilleure = { taille: 0, colonnes: 4, rangs: 3 };
  for (const [colonnes, rangs] of CONFIGURATIONS) {
    const bloc = t * ((colonnes - 1) * PAS_X + (rangs > 1 ? PAS_X / 2 : 0) + LARGEUR_FIGURE);
    const parLargeur = (demi - 2 * marge) / bloc;
    const parSol = (H - horizon - MARGE) / (SOUS_HORIZON + (rangs - 1) * PAS_Y * t + PIED_FIGURE);
    const parTete = (horizon - MARGE) / Math.max(0.1, t * HAUTEUR_FIGURE + vol - SOUS_HORIZON);
    const taille = Math.max(1, Math.min(parLargeur, parSol, parTete, H * PART_TAILLE_MAX, TAILLE_MAX));
    const egale = Math.abs(taille - meilleure.taille) <= 0.5;
    if ((!egale && taille > meilleure.taille) || (egale && colonnes > meilleure.colonnes)) {
      meilleure = { taille, colonnes, rangs };
    }
  }
  const { taille, colonnes, rangs } = meilleure;

  const formation = (cote: CoteDuel, gabarit: GabaritFormation): Formation => {
    const pasX = PAS_X * gabarit.taille * taille;
    const pasY = PAS_Y * gabarit.taille * taille;
    const etendue = (rangs - 1) * pasY;
    // Le sol qui reste sous la formation se partage : elle ne colle pas à l'horizon.
    const libre = H - horizon - MARGE - (SOUS_HORIZON * taille + etendue + PIED_FIGURE * taille);
    const fond = horizon + SOUS_HORIZON * taille + Math.max(0, libre) * 0.5;
    const centreU = demi / 2;
    const centreV = fond + etendue / 2;
    // `ug` est la place vue depuis la gauche : la cible, à droite, en est le miroir.
    const grille: { ug: number; v: number; i: number; j: number }[] = [];
    for (let j = 0; j < rangs; j++) {
      for (let i = 0; i < colonnes; i++) {
        // Un rang sur deux est décalé d'un quart de pas : on voit les figurines entre celles de devant.
        const decalage = rangs > 1 ? ((j % 2) - 0.5) * pasX * 0.5 : 0;
        grille.push({ ug: centreU + (i - (colonnes - 1) / 2) * pasX + decalage, v: fond + j * pasY, i, j });
      }
    }
    // Remplir du centre vers les bords : une formation entamée reste groupée,
    // et les pertes partent des bords. À égalité, le rang de devant, puis le
    // côté de l'adversaire.
    const distance = (p: { ug: number; v: number }): number => {
      const du = (p.ug - centreU) / Math.max(1, pasX);
      const dv = ((p.v - centreV) / Math.max(1, pasY)) * 1.4;
      return du * du + dv * dv;
    };
    grille.sort((a, b) => (distance(a) - distance(b)) || (b.j - a.j) || (b.i - a.i));
    const retenues = grille.slice(0, MAX_FIGURINES);
    const places = retenues.map(({ ug, v }) => ({ u: cote === 'attaquant' ? ug : W - ug, v }));
    const proximite = retenues.map((_, k) => k)
      .sort((a, b) => ((retenues[b]?.ug ?? 0) - (retenues[a]?.ug ?? 0)) || ((retenues[b]?.v ?? 0) - (retenues[a]?.v ?? 0)));
    return { places, proximite, sens: cote === 'attaquant' ? 1 : -1, gabarit };
  };

  return {
    largeur: W, hauteur: H, demi, horizon, taille, colonnes, rangs,
    attaquant: formation('attaquant', attaquant),
    cible: formation('cible', cible),
  };
}

// ---------------------------------------------------------------------------
// 4. Le décor d'une case : ses couleurs, et ce qui se dresse à l'horizon
// ---------------------------------------------------------------------------

/** Ce qui se dresse sur l'horizon d'une case. */
export interface ElementDecor {
  entree: string;
  /** La place sur la moitié, de 0 (le bord extérieur) à 1 (le filet). */
  position: number;
  /** La taille, en figurines (une figurine vaut une case). */
  echelle: number;
  /** La couleur du propriétaire d'un bâtiment ; `null` : aucune teinte. */
  equipe: Rvb | null;
}

/** Le décor d'une case : le lointain au-dessus de l'horizon, le sol au-dessous, et ce qui s'y dresse. */
export interface DecorCase {
  lointain: Rvb;
  sol: Rvb;
  elements: ElementDecor[];
}

/** Ce que le décor d'une case doit savoir d'elle. */
export interface ContexteDecor {
  terrain: CleTerrain | null;
  biome: Biome;
  ambiance: Ambiance;
  /** L'entrée du bâtiment de la case, et la couleur de son propriétaire (gris neutre sans propriétaire). */
  batiment?: { entree: string; equipe: Rvb } | null;
  /** Vrai si l'entrée est cuite : une saison absente retombe sur `toutes`, sinon sur le repli. */
  existe?(id: string): boolean;
}

const hex = (c: string): Rvb => {
  const l = lireCouleur(c);
  return [l.r / 255, l.v / 255, l.b / 255];
};

const mel = (a: Rvb, b: Rvb, t: number): Rvb => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

/** Trois flottants d'un tableau de couleurs, en couleur. */
const lire3 = (s: Float32Array, i: number): Rvb => [s[i] ?? 0, s[i + 1] ?? 0, s[i + 2] ?? 0];

/** Le voile d'ambiance posé sur une couleur : la nuit, la brume, la tempête — comme sur la carte. */
function voiler(c: Rvb, ambiance: Ambiance): Rvb {
  const v = ambiance.voile;
  return v ? mel(c, hex(v.couleur), v.alpha) : c;
}

/**
 * Le ciel : le bleu de la palette d'ambiance (déjà assombri la nuit, grisé
 * sous la pluie), éclairci le jour, enfoncé la nuit, puis voilé comme la carte.
 */
export function couleurCiel(ambiance: Ambiance): Rvb {
  const eau = hex(ambiance.palette.eauHaut);
  const brut = ambiance.phase === 'nuit' ? mel(eau, hex('#0a1428'), 0.35) : mel(eau, [1, 1, 1], 0.38);
  return voiler(brut, ambiance);
}

/** La couleur du filet entre les deux cases. */
export const COULEUR_SEPARATION: Rvb = hex('#0b141a');

/** Une matière du sol : entre son ombre et sa lumière, là où la lumière domine. */
function matiere(s: Float32Array, m: MatiereSol): Rvb {
  const base = DISPOSITION.matieres + Math.max(0, MATIERES.indexOf(m)) * 9;
  return mel(lire3(s, base), lire3(s, base + 3), 0.55);
}

/** Les bâtiments : leur case est une cour pavée, et leur silhouette se dresse à l'horizon. */
const BATIS: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['ville', 'qg', 'usine', 'aeroport', 'radar', 'port']);

/** Vrai pour un terrain bâti. */
export function estBati(t: CleTerrain | null): t is CleTerrain {
  return t !== null && BATIS.has(t);
}

/**
 * L'arbre d'une forêt, par biome : la première essence du tirage du placement
 * (`sol/decor.ts`, `ARBRES`) — lue là, jamais recopiée : deux listes finissent
 * toujours par diverger.
 */
export function arbreDuBiome(biome: Biome): EssenceDecor {
  return ARBRES[biome]?.[0]?.[0] ?? 'feuillu';
}

/**
 * Le décor d'une case. Le sol est le mélange de matières du terrain
 * (`poidsDe`) dans les couleurs du biome et de la saison (`couleursSol`),
 * couvert de neige autant que la carte l'est ; l'eau, la chaussée et le pont
 * ont leurs propres couleurs ; le lointain est la mer d'une plage, la roche
 * d'une montagne, la lisière d'une forêt, la ville derrière une cour, sinon
 * le sol voilé par la distance. Tout passe sous le voile d'ambiance, comme la
 * carte : la nuit tombe aussi sur l'écran de combat.
 */
export function decorDeCase(ctx: ContexteDecor): DecorCase {
  const { terrain, biome, ambiance } = ctx;
  const s = couleursSol(biome, ambiance.saison, ambiance.meteo);
  const ciel = couleurCiel(ambiance);
  const neige = s[DISPOSITION.climat] ?? 0;
  const neigeClaire = lire3(s, DISPOSITION.neige + 3);
  const eauProfonde = lire3(s, DISPOSITION.eau);
  const eauClaire = lire3(s, DISPOSITION.eau + 3);
  const t: CleTerrain = terrain ?? 'plaine';

  // Le sol : ce que la case a sous les pieds.
  let sol: Rvb;
  if (t === 'mer') sol = mel(eauProfonde, eauClaire, 0.3);
  else if (t === 'riviere') sol = lire3(s, DISPOSITION.eau + 6);
  else if (t === 'pont') sol = lire3(s, DISPOSITION.voie + 12);
  else if (t === 'route') sol = mel(lire3(s, DISPOSITION.voie), lire3(s, DISPOSITION.voie + 3), 0.5);
  else {
    const poids = poidsDe(t);
    const c: [number, number, number] = [0, 0, 0];
    MATIERES.forEach((m, i) => {
      const w = poids[i] ?? 0;
      if (w <= 0) return;
      const couleur = matiere(s, m);
      c[0] += w * couleur[0];
      c[1] += w * couleur[1];
      c[2] += w * couleur[2];
    });
    // La neige couvre ce qui est à terre, bien moins une cour qu'on déneige.
    sol = mel(c, neigeClaire, neige * (BATIS.has(t) ? 0.35 : 0.85));
  }

  // Le lointain : ce qu'on voit derrière, au-dessus de l'horizon.
  let lointain: Rvb;
  if (t === 'mer') lointain = eauProfonde;
  else if (t === 'plage') lointain = mel(eauProfonde, eauClaire, 0.5);
  else if (t === 'montagne') lointain = mel(mel(matiere(s, 'roche'), neigeClaire, neige * 0.6), ciel, 0.28);
  else if (t === 'foret') lointain = mel(lire3(s, DISPOSITION.feuillage), ciel, 0.2);
  else if (BATIS.has(t)) lointain = mel(matiere(s, 'pave'), ciel, 0.3);
  else if (t === 'riviere' || t === 'pont') lointain = mel(mel(matiere(s, 'herbe'), neigeClaire, neige * 0.85), ciel, 0.35);
  else lointain = mel(sol, ciel, 0.35);

  // Ce qui se dresse : la saison du moment, la variante `toutes` si seule elle est cuite.
  const saison = ambiance.saison;
  const decor = (essence: EssenceDecor, n: number): string => {
    const id = idDecor(essence, saison, n);
    if (!ctx.existe || ctx.existe(id)) return id;
    const toutes = idDecor(essence, 'toutes', n);
    return ctx.existe(toutes) ? toutes : id;
  };
  const elements: ElementDecor[] = [];
  const poser = (entree: string, position: number, echelle: number, equipe: Rvb | null = null): void => {
    elements.push({ entree, position, echelle, equipe });
  };
  if (t === 'foret') {
    const arbre = arbreDuBiome(biome);
    poser(decor(arbre, 1), 0.14, 1.35);
    poser(decor(arbre, 2), 0.47, 1.55);
    poser(decor(arbre, 1), 0.8, 1.25);
  } else if (t === 'montagne') {
    const montagne = essenceMontagne(biome);
    poser(decor(montagne, 1), 0.3, 1.3);
    poser(decor(montagne, 2), 0.74, 0.9);
  } else if (BATIS.has(t)) {
    if (ctx.batiment) poser(ctx.batiment.entree, 0.5, 1.2, ctx.batiment.equipe);
  } else if (t === 'herbe_haute') {
    poser(decor('touffe', 1), 0.18, 1.2);
    poser(decor('touffe', 2), 0.5, 1.3);
    poser(decor('touffe', 1), 0.8, 1.15);
  } else if (t === 'plaine') {
    poser(decor('buisson', 1), 0.14, 0.9);
    poser(decor('buisson', 2), 0.86, 0.75);
  } else if (t === 'route') {
    poser(decor('buisson', 2), 0.12, 0.8);
  } else if (t === 'plage') {
    const rocher = rocherDe(biome);
    if (biome === 'archipel' || biome === 'jungle' || biome === 'desert') poser(decor('palmier', 1), 0.24, 1.3);
    else if (rocher) poser(rocher, 0.24, 1.1);
  }
  return { lointain: voiler(lointain, ambiance), sol: voiler(sol, ambiance), elements };
}

/** Les couleurs des bandes du décor : le ciel commun, le lointain et le sol de chaque case. */
export interface CouleursBandes {
  ciel: Rvb;
  gauche: DecorCase;
  droite: DecorCase;
}

/**
 * Peint les bandes du décor dans `trace`, en pixels du plan de l'encart
 * (centre du rectangle à l'origine, `zoom` pixels CSS par pixel de plan) : le
 * ciel sur toute la largeur, le lointain puis le sol de chaque moitié sous
 * l'horizon, et le filet qui sépare les deux cases, peint en dernier — il
 * coupe le ciel aussi. Ce sont les fonds d'Advance Wars : des aplats, et une
 * seule scène pour tout le duel. Rend le nombre de rectangles.
 */
export function tracerBandes(trace: Trace, d: Pick<DispositionCombat, 'largeur' | 'hauteur' | 'demi'>, zoom: number, c: CouleursBandes): number {
  const z = Math.max(1e-6, zoom);
  const W = d.largeur;
  const H = d.hauteur;
  const X = (u: number): number => (u - W / 2) / z;
  const Y = (v: number): number => (v - H / 2) / z;
  const ciel = PART_CIEL * H;
  const horizon = PART_HORIZON * H;
  const rectangle = (u0: number, v0: number, u1: number, v1: number, couleur: Rvb): void => {
    trace.rectangle(X(u0), Y(v0), X(u1), Y(v1), [couleur[0], couleur[1], couleur[2], 1]);
  };
  rectangle(0, 0, W, ciel, c.ciel);
  rectangle(0, ciel, d.demi, horizon, c.gauche.lointain);
  rectangle(W - d.demi, ciel, W, horizon, c.droite.lointain);
  rectangle(0, horizon, d.demi, H, c.gauche.sol);
  rectangle(W - d.demi, horizon, W, H, c.droite.sol);
  rectangle(d.demi, 0, W - d.demi, H, COULEUR_SEPARATION);
  return 6;
}

// ---------------------------------------------------------------------------
// 5. La scène
// ---------------------------------------------------------------------------

/** Ce que la scène demande à la peau : rien qu'elle ne sache déjà. */
export interface DependancesCombat2d {
  /** Ouvre un encart dans la toile ; rend sa fermeture. */
  ouvrirEncart(encart: EncartSprites): () => void;
  /** Une image est à refaire. */
  salir(): void;
  catalogue: Catalogue;
  /** Le terrain d'une case, tel que la carte le lit. */
  terrain(c: Case): CleTerrain | null;
  /** Le propriétaire d'une case bâtie, `null` si elle est neutre. */
  proprietaire(c: Case): CampId | null;
  ambiance: Ambiance;
  biome: Biome;
  /** La couleur d'équipe d'un camp ; `null` : le gris neutre. */
  equipe(camp: CampId | null): Rvb;
  /** L'entrée du manifeste d'une unité de ce camp (kit national ou base). */
  entreeUnite(type: CleUnite, camp: CampId): string;
  /** L'entrée d'un bâtiment pour son propriétaire. */
  entreeBatiment(terrain: CleTerrain, proprietaire: CampId | null): string;
  /** L'entrée du manifeste, si elle est cuite. */
  entree(id: string): EntreeSprite | null;
  /** Animations réduites : l'issue paraît d'emblée. */
  reduit(): boolean;
}

/** L'écran de combat de la peau 2D : ce que le HUD pilote, plus de quoi le regarder. */
export interface Combat2d extends VueCombat {
  /** Saute à l'issue : les effectifs d'après, plus un projectile. */
  passer(): void;
  /** Les figurines debout d'un côté, maintenant. */
  effectif(cote: CoteDuel): number;
  /** Les projectiles qu'un côté a en vol, maintenant : la salve se lit sans regarder l'image. */
  enVol(cote: CoteDuel): number;
  /** Vrai jusqu'à la fermeture. */
  readonly ouvert: boolean;
}

/** Les quatre clips de profil d'une entrée cuite. */
export type ClipsProfil = Readonly<Record<'repos' | 'tir' | 'touche' | 'hors_jeu', AnimationChoisie>>;

/**
 * Les clips de **profil** d'une entrée cuite, ou `null`. Une entrée sans vue de
 * profil n'en rend aucun : une image de trois quarts, cuite pour la carte, n'a
 * rien à faire dans une vue de côté — c'est alors le repli, la silhouette du
 * HUD, qui est elle-même de profil. Un clip absent retombe sur un autre clip
 * de profil (`choisirAnimation`), jamais sur une autre vue.
 */
export function clipsProfil(e: EntreeSprite | null): ClipsProfil | null {
  if (!e) return null;
  const premiere = e.animations.findIndex((a) => a.vue === 'profil');
  if (premiere < 0) return null;
  const choisir = (clip: ClipSprite): AnimationChoisie => {
    let i = choisirAnimation(e, 'profil', clip);
    if (e.animations[i]?.vue !== 'profil') i = premiere;
    const a = e.animations[i]!;
    return { index: i, cadres: a.cadres.length, ips: a.ips, boucle: a.boucle };
  };
  return { repos: choisir('repos'), tir: choisir('tir'), touche: choisir('touche'), hors_jeu: choisir('hors_jeu') };
}

/** La durée d'un clip cuit, en millisecondes à cadence normale. */
function dureeClip(a: AnimationChoisie): number {
  return a.ips > 0 ? (a.cadres / a.ips) * 1000 : 0;
}

/** Une pose neuve, cachée, tous ses champs présents : la scène la réécrit en place à chaque image. */
function nouvellePose(calque: CalqueRendu, entree: string): Pose {
  return {
    calque, ligne: 0, colonne: 0,
    instance: { entree, animation: -1, cadre: 0, x: 0, y: 0, h: 0, miroir: false, equipe: null, opacite: 0, eclat: 0, echelle: 1 },
  };
}

/** L'échelle de la forme d'ombre pour une tache de `largeur` cases : son ellipse fait `OMBRE_UNITE.largeur` case. */
const echelleTache = (largeur: number): number => largeur / OMBRE_UNITE.largeur;

/** Ce qu'un côté porte, lu et créé une fois. */
interface Cote {
  cote: CoteDuel;
  duel: Duel['attaquant'];
  type: UnitType;
  equipe: Rvb;
  clips: ClipsProfil | null;
  avant: number;
  apres: number;
  /** Le départ de sa salve, `null` s'il ne tire pas. */
  salve: number | null;
  /** L'arrivée de la salve adverse sur lui, `null` s'il n'est pas visé. */
  impact: number | null;
  /** Combien tirent : ceux qui sont debout quand la salve part — la riposte part avant l'impact qui la décime. */
  nTireurs: number;
  /** Les tireurs de sa salve, dans l'ordre du feu : des places. */
  tireurs: number[];
  /** Le rang de chaque place dans la salve, `-1` si elle ne tire pas. */
  rangTir: number[];
  /** Les places visées chez l'adversaire, dans l'ordre du feu. */
  visees: number[];
  profil: ProfilTir2d;
  /** Ce qu'il pose sous chaque figurine : l'ombre, ou l'écume d'un navire (`solSousUnite`). */
  sous: ReturnType<typeof solSousUnite>['forme'];
  corps: Pose[];
  ombres: Pose[];
  eclairs: Pose[];
  projectiles: Pose[];
  trainees: Pose[];
  eclats: Pose[];
  poussieres: Pose[];
}

/**
 * Ouvre l'écran de combat dans `hote` — l'élément transparent que le HUD pose
 * par-dessus la toile. Rend `null` si le duel ne se dessine pas (une unité
 * inconnue du catalogue) : le HUD garde alors ses plaques peintes.
 */
export function ouvrirCombat2d(hote: HTMLElement, duel: Duel, deps: DependancesCombat2d): Combat2d | null {
  const typeA = deps.catalogue.unites[duel.attaquant.type];
  const typeC = deps.catalogue.unites[duel.cible.type];
  const doc = hote.ownerDocument;
  if (!typeA || !typeC || !doc) return null;

  const chrono = chronologieDuel(duel);
  // Sans durée, ou animations réduites : l'issue, tout de suite.
  const fixe = chrono.duree <= 0 || deps.reduit();

  // --- Les deux côtés : ce qui se lit une fois.
  const nouvelles = (n: number, calque: CalqueRendu, id: string): Pose[] =>
    Array.from({ length: n }, () => nouvellePose(calque, id));
  const monter = (cote: CoteDuel, d: Duel['attaquant'], type: UnitType, adverse: UnitType): Cote => {
    const entree = deps.entreeUnite(d.type, d.camp);
    const avant = figurines(d.pvAvant);
    const apres = figurines(d.pvApres);
    const salve = cote === 'attaquant' ? chrono.tir : chrono.riposte;
    const impact = cote === 'cible' ? chrono.impactCible : chrono.impactAttaquant;
    // Sous un navire, l'écume et non l'ombre : la règle de la carte.
    const sous = solSousUnite(type);
    const c: Cote = {
      cote, duel: d, type, equipe: deps.equipe(d.camp), clips: clipsProfil(deps.entree(entree)),
      avant, apres, salve, impact,
      nTireurs: salve === null ? 0 : impact !== null && salve >= impact ? apres : avant,
      tireurs: [], rangTir: new Array<number>(MAX_FIGURINES).fill(-1), visees: [],
      profil: profilTir2d(type, adverse),
      sous: sous.forme,
      corps: nouvelles(MAX_FIGURINES, 'unites', entree),
      ombres: nouvelles(MAX_FIGURINES, 'ombres_unites', sous.entree),
      eclairs: nouvelles(MAX_FIGURINES, 'effets', FORMES.ombre),
      projectiles: nouvelles(MAX_FIGURINES, 'effets', FORMES.ombre),
      trainees: nouvelles(MAX_FIGURINES * 2, 'effets', FORMES.ombre),
      eclats: nouvelles(MAX_FIGURINES, 'effets', FORMES.ombre),
      poussieres: nouvelles(MAX_FIGURINES, 'effets', FORMES.ombre),
    };
    for (const p of c.corps) {
      p.instance.equipe = c.equipe;
      p.instance.miroir = cote === 'cible';
    }
    return c;
  };
  const A = monter('attaquant', duel.attaquant, typeA, typeC);
  const C = monter('cible', duel.cible, typeC, typeA);
  const gabarit = (c: Cote): GabaritFormation => ({
    taille: echelleTaille(c.type.silhouette.taille),
    // L'image cuite d'un appareil porte déjà sa hauteur de vol ; le repli non.
    vol: c.type.domaine === 'air' && !c.clips ? VOL_REPLI : 0,
  });

  // --- Le décor de chaque case, et ce qui se dresse sur son horizon.
  const decorDe = (c: Cote): DecorCase => {
    const terrain = deps.terrain(c.duel.case);
    const proprio = estBati(terrain) ? deps.proprietaire(c.duel.case) : null;
    return decorDeCase({
      terrain, biome: deps.biome, ambiance: deps.ambiance,
      batiment: estBati(terrain) ? { entree: deps.entreeBatiment(terrain, proprio), equipe: deps.equipe(proprio) } : null,
      existe: (id) => deps.entree(id) !== null,
    });
  };
  const decorA = decorDe(A);
  const decorC = decorDe(C);
  const elements = [
    ...decorA.elements.map((e) => ({ e, gauche: true })),
    ...decorC.elements.map((e) => ({ e, gauche: false })),
  ];
  const posesDecor = elements.map(({ e }) => {
    const pose = nouvellePose('volumes', e.entree);
    const entree = deps.entree(e.entree);
    // Le décor est cuit pour la carte, en vue fixe : c'est celle qu'il a.
    pose.instance.animation = entree ? choisirAnimation(entree, 'fixe', 'repos') : -1;
    pose.instance.equipe = e.equipe;
    pose.instance.echelle = e.echelle;
    return pose;
  });

  // --- Les poses, toutes créées ici : l'image ne fait que les réécrire.
  const poses: Pose[] = [...posesDecor];
  for (const c of [A, C]) {
    poses.push(...c.ombres, ...c.corps, ...c.eclairs, ...c.trainees, ...c.projectiles, ...c.eclats, ...c.poussieres);
  }

  // --- La racine de l'écran dans l'hôte : un élément vide, qui porte ce que
  //     les tests de fumée lisent (`data-combat2d`, `data-effectifs`). Le décor,
  //     lui, est peint dans la toile, sous les figurines (`tracerBandes`).
  const racine = doc.createElement('div');
  racine.dataset['combat2d'] = 'ouvert';
  racine.setAttribute('aria-hidden', 'true');
  racine.style.cssText = 'width:100%;height:100%;pointer-events:none';
  hote.appendChild(racine);
  const couleursBandes: CouleursBandes = { ciel: couleurCiel(deps.ambiance), gauche: decorA, droite: decorC };

  // --- L'état : l'instant du duel, et la disposition du rectangle.
  let t = fixe ? chrono.duree : 0;
  let passe = fixe;
  let vivant = true;
  let disposition: DispositionCombat | null = null;
  /** Change avec la disposition : le décor peint n'est retracé qu'alors. */
  let versionDisposition = 0;
  let largeurVue = 0;
  let hauteurVue = 0;
  const camera: EtatCamera2d = { cx: 0, cy: 0, zoom: 1 };
  const aucune: readonly Pose[] = Object.freeze([]);
  // Le point courant d'une trajectoire : réécrit, jamais alloué.
  let trajetU = 0;
  let trajetV = 0;

  /** Les tireurs de chaque salve et les places qu'ils visent : lus une fois par disposition. */
  function preparerSalves(d: DispositionCombat): void {
    for (const c of [A, C]) {
      const adverse = c === A ? C : A;
      const formation = c === A ? d.attaquant : d.cible;
      const formationAdverse = c === A ? d.cible : d.attaquant;
      c.tireurs = formation.proximite.filter((k) => k < c.nTireurs);
      c.rangTir.fill(-1);
      c.tireurs.forEach((k, rang) => { c.rangTir[k] = rang; });
      c.visees = formationAdverse.proximite.filter((k) => k < adverse.avant);
    }
  }

  /** Pose une instance aux pixels CSS `(u, v)` du rectangle, levée de `leve` pixels. */
  function placer(pose: Pose, d: DispositionCombat, u: number, v: number, leve: number): void {
    const z = Math.max(1e-6, camera.zoom);
    const inst = pose.instance;
    inst.x = (u - d.largeur / 2) / z / PIXELS_PAR_CASE;
    inst.y = (v - d.hauteur / 2) / z / (PIXELS_PAR_CASE * SIN_TANGAGE);
    inst.h = leve / z / (PIXELS_PAR_CASE * COS_TANGAGE);
    pose.ligne = inst.y;
    pose.colonne = inst.x;
  }

  /** Relit la taille de l'hôte ; la disposition ne se refait que si elle a changé. */
  function majDisposition(): DispositionCombat | null {
    const l = hote.clientWidth;
    const h = hote.clientHeight;
    if (l < 1 || h < 1) return disposition;
    if (disposition && l === largeurVue && h === hauteurVue) return disposition;
    largeurVue = l;
    hauteurVue = h;
    const d = disposerCombat(l, h, gabarit(A), gabarit(C));
    disposition = d;
    versionDisposition += 1;
    // Le centre du plan est celui du rectangle ; une case y vaut `taille` pixels.
    camera.cx = 0;
    camera.cy = 0;
    camera.zoom = d.taille / PIXELS_PAR_CASE;
    preparerSalves(d);
    // Le décor ne bouge pas : il se pose une fois par taille, les pieds sur l'horizon.
    elements.forEach(({ e, gauche }, i) => {
      const pose = posesDecor[i];
      if (!pose) return;
      const ug = e.position * d.demi;
      placer(pose, d, gauche ? ug : d.largeur - ug, d.horizon + 0.03 * d.taille, 0);
      pose.instance.opacite = 1;
    });
    return d;
  }

  function cacher(pose: Pose): void {
    pose.instance.opacite = 0;
  }

  /** Une tache blanche ou grise : éclair, projectile, éclat, poussière. `largeur` en cases. */
  function tache(pose: Pose, d: DispositionCombat, u: number, v: number, largeur: number, blanc: number, opacite: number): void {
    placer(pose, d, u, v, 0);
    const inst = pose.instance;
    inst.echelle = echelleTache(largeur);
    inst.eclat = blanc;
    inst.opacite = Math.max(0, Math.min(1, opacite));
  }

  /** L'image d'un clip commencé à `debut`, lu à la cadence du duel : deux fois plus vite en cadence rapide. */
  function cadre(a: AnimationChoisie, debut: number, instant: number): number {
    const vitesse = chrono.facteur > 0 ? 1 / chrono.facteur : 1;
    return cadreAuTemps(a.cadres, a.ips, a.boucle, (instant - debut) * vitesse);
  }

  /** Une figurine debout, ou qui tombe : sa pose, son ombre, son clip, son recul, son éclat. */
  function poserFigurine(c: Cote, f: Formation, k: number, d: DispositionCombat, final: boolean): void {
    const corps = c.corps[k]!;
    const ombre = c.ombres[k]!;
    const place = f.places[k];
    if (!place || k >= c.avant) {
      cacher(corps);
      cacher(ombre);
      return;
    }
    const s = d.taille;
    const tailleUnite = f.gabarit.taille;
    const leve = f.gabarit.vol * s;
    const touche = !final && c.impact !== null && t >= c.impact;
    const perdue = k >= c.apres;
    let opacite = 1;
    let enfonce = 0;
    let clip: 'repos' | 'tir' | 'touche' | 'hors_jeu' = 'repos';
    let debut = 0;
    let instant = t;
    let dx = 0;
    let eclat = 0;

    if (final) {
      if (perdue) {
        cacher(corps);
        cacher(ombre);
        return;
      }
    } else if (perdue && touche && c.impact !== null) {
      // Perdue à l'impact : elle quitte la formation. Un côté qui tombe à zéro
      // joue son `hors_jeu` en s'effaçant ; sinon l'éclat de l'impact la remplace.
      const age = t - c.impact;
      if (c.apres > 0 || age >= chrono.fondu) {
        cacher(corps);
        cacher(ombre);
        return;
      }
      clip = 'hors_jeu';
      debut = c.impact;
      opacite = 1 - age / Math.max(1, chrono.fondu);
      enfonce = (age / Math.max(1, chrono.fondu)) * 0.08 * s;
    } else {
      const rang = c.rangTir[k] ?? -1;
      const depart = rang >= 0 && c.salve !== null ? c.salve + rang * ecartTireurs(chrono, c.nTireurs) : -1;
      if (depart >= 0 && t >= depart) {
        const dureeTir = (c.clips ? dureeClip(c.clips.tir) : CLIP_REPLI.tir) * chrono.facteur;
        if (t < depart + dureeTir) {
          clip = 'tir';
          debut = depart;
        }
        const recul = DUREE_RECUL * chrono.facteur;
        // Le recul du coup : la figurine part en arrière et revient.
        if (t < depart + recul) dx -= f.sens * 0.05 * tailleUnite * s * Math.sin((Math.PI * (t - depart)) / Math.max(1, recul));
      }
      if (touche && c.impact !== null) {
        const reprise = c.impact + chrono.arret;
        if (t < reprise) {
          // L'arrêt sur image : l'image du coup tient, blanche.
          instant = c.impact;
          eclat = 1;
        } else {
          eclat = Math.max(0, 1 - (t - reprise) / Math.max(1, DUREE_ECLAT * chrono.facteur));
          const dureeTouche = (c.clips ? dureeClip(c.clips.touche) : CLIP_REPLI.touche) * chrono.facteur;
          if (t < reprise + dureeTouche) {
            clip = 'touche';
            debut = reprise;
          }
          if (t < reprise + chrono.secousse) {
            // La secousse, sobre : trois allers-retours qui s'éteignent.
            const age = (t - reprise) / Math.max(1, chrono.secousse);
            dx += 0.035 * s * Math.sin(age * Math.PI * 6) * (1 - age);
          }
        }
      }
    }

    const inst = corps.instance;
    placer(corps, d, place.u + dx, place.v + enfonce, leve);
    inst.opacite = Math.max(0, Math.min(1, opacite));
    inst.eclat = eclat;
    const clips = c.clips;
    if (clips) {
      const a = clips[clip];
      inst.animation = a.index;
      // Le repos respire, chaque figurine à sa phase ; un clip qui ne boucle pas se lit depuis son départ.
      inst.cadre = clip === 'repos'
        ? cadreAuTemps(a.cadres, a.ips, a.boucle, instant + k * 137 + (c.cote === 'cible' ? 61 : 0))
        : cadre(a, debut, instant);
    } else {
      inst.animation = -1;
      inst.cadre = 0;
    }
    placer(ombre, d, place.u + dx + c.sous.decalageX * s, place.v, 0);
    ombre.instance.echelle = tailleUnite * (leve > 0 ? 0.8 : 1);
    ombre.instance.opacite = c.sous.opacite * inst.opacite * (leve > 0 ? 0.7 : 1);
  }

  /** Le point d'une trajectoire à la part `p` : droite, en cloche ou à peine arquée. */
  function trajet(bu: number, bv: number, gu: number, gv: number, cloche: number, p: number): void {
    trajetU = bu + (gu - bu) * p;
    trajetV = bv + (gv - bv) * p - 4 * cloche * p * (1 - p);
  }

  /** La salve d'un côté : éclairs de bouche, projectiles, et leurs traînées. */
  function poserSalve(c: Cote, f: Formation, fa: Formation, adverse: Cote, d: DispositionCombat, final: boolean): void {
    const s = d.taille;
    const arrivee = adverse.impact;
    const ecart = ecartTireurs(chrono, c.nTireurs);
    const tu = f.gabarit.taille;
    for (let k = 0; k < MAX_FIGURINES; k++) {
      const eclair = c.eclairs[k]!;
      const projectile = c.projectiles[k]!;
      const t1 = c.trainees[2 * k]!;
      const t2 = c.trainees[2 * k + 1]!;
      const tireur = c.tireurs[k];
      const place = tireur === undefined ? undefined : f.places[tireur];
      if (final || c.salve === null || arrivee === null || !place) {
        cacher(eclair);
        cacher(projectile);
        cacher(t1);
        cacher(t2);
        continue;
      }
      const depart = c.salve + k * ecart;
      const bu = place.u + f.sens * 0.42 * tu * s;
      const bv = place.v - (0.38 * tu + f.gabarit.vol) * s;
      const visee = c.visees.length > 0 ? fa.places[c.visees[k % c.visees.length]!] : undefined;
      const gu = visee ? visee.u : d.largeur - bu;
      const gv = visee ? visee.v - (0.3 * fa.gabarit.taille + fa.gabarit.vol) * s : bv;
      // L'éclair de bouche : bref, et il papillote pour une rafale.
      const ageEclair = t - depart;
      const dureeEclair = DUREE_ECLAIR * chrono.facteur * (c.profil === 'rafale' ? 1.8 : 1);
      const papillote = c.profil !== 'rafale' || Math.floor(ageEclair / Math.max(1, 30 * chrono.facteur)) % 2 === 0;
      if (ageEclair >= 0 && ageEclair < dureeEclair && papillote) {
        const q = ageEclair / Math.max(1, dureeEclair);
        tache(eclair, d, bu + f.sens * 0.06 * s, bv, (0.34 - 0.2 * q) * tu, 1, 0.95 * (1 - q * 0.6));
      } else {
        cacher(eclair);
      }
      // Le projectile : parti avec son tireur, il arrive à l'impact — ni avant, ni après.
      if (t >= depart && t < arrivee) {
        const phi = (t - depart) / Math.max(1, arrivee - depart);
        const portee = Math.abs(gu - bu);
        const cloche = c.profil === 'obus' ? 0.22 * portee : c.profil === 'missile' ? 0.05 * portee : 0;
        trajet(bu, bv, gu, gv, cloche, phi);
        const largeur = c.profil === 'missile' ? 0.26 : c.profil === 'obus' ? 0.2 : c.profil === 'rafale' ? 0.12 : 0.17;
        tache(projectile, d, trajetU, trajetV, largeur, 1, 1);
        if (c.profil === 'missile' || c.profil === 'obus') {
          // La traînée : deux bouffées grises derrière, qui pâlissent.
          trajet(bu, bv, gu, gv, cloche, Math.max(0, phi - 0.1));
          tache(t1, d, trajetU, trajetV, 0.2, 0.62, 0.5);
          trajet(bu, bv, gu, gv, cloche, Math.max(0, phi - 0.22));
          tache(t2, d, trajetU, trajetV, 0.24, 0.55, 0.3);
        } else {
          cacher(t1);
          cacher(t2);
        }
      } else {
        cacher(projectile);
        cacher(t1);
        cacher(t2);
      }
    }
  }

  /** L'éclat et la poussière des figurines perdues, à l'impact. */
  function poserPertes(c: Cote, f: Formation, d: DispositionCombat, final: boolean): void {
    const s = d.taille;
    const tu = f.gabarit.taille;
    for (let k = 0; k < MAX_FIGURINES; k++) {
      const eclat = c.eclats[k]!;
      const poussiere = c.poussieres[k]!;
      const place = f.places[k];
      const age = c.impact === null ? -1 : t - c.impact;
      if (final || !place || k >= c.avant || k < c.apres || age < 0) {
        cacher(eclat);
        cacher(poussiere);
        continue;
      }
      const dureeEclat = DUREE_EXPLOSION * chrono.facteur;
      const dureePoussiere = DUREE_POUSSIERE * chrono.facteur;
      if (age < dureeEclat) {
        const q = age / Math.max(1, dureeEclat);
        tache(eclat, d, place.u, place.v - (0.3 * tu + f.gabarit.vol) * s, (0.3 + 0.6 * q) * tu, 1, 1 - q);
      } else {
        cacher(eclat);
      }
      if (age < dureePoussiere) {
        const q = age / Math.max(1, dureePoussiere);
        tache(poussiere, d, place.u, place.v - q * 0.18 * s, (0.5 + 0.6 * q) * tu, 0.5, 0.65 * (1 - q));
      } else {
        cacher(poussiere);
      }
    }
  }

  /** Réécrit toutes les poses pour l'instant courant. */
  function poserScene(d: DispositionCombat): void {
    const final = passe || t >= chrono.duree;
    for (let k = 0; k < MAX_FIGURINES; k++) {
      poserFigurine(A, d.attaquant, k, d, final);
      poserFigurine(C, d.cible, k, d, final);
    }
    poserSalve(A, d.attaquant, d.cible, C, d, final);
    poserSalve(C, d.cible, d.attaquant, A, d, final);
    poserPertes(A, d.attaquant, d, final);
    poserPertes(C, d.cible, d, final);
  }

  /** Les figurines debout d'un côté, maintenant. */
  function effectif(cote: CoteDuel): number {
    if (passe) return cote === 'attaquant' ? A.apres : C.apres;
    return effectifAu(duel, chrono, cote, t);
  }

  // Les effectifs, écrits sur la racine pour qui regarde de dehors (les tests
  // de fumée) : seulement quand ils changent — deux ou trois fois par duel.
  let dernierA = -1;
  let dernierC = -1;
  function majEffectifs(): void {
    const a = effectif('attaquant');
    const c = effectif('cible');
    if (a === dernierA && c === dernierC) return;
    dernierA = a;
    dernierC = c;
    racine.dataset['effectifs'] = `${a}:${c}`;
  }

  // --- Un seul encart : le décor peint en aplats, les figurines par-dessus.
  const fermetures: (() => void)[] = [];
  const aplats: AplatsEncart = {
    version: () => versionDisposition,
    tracer: (trace) => {
      const d = majDisposition();
      if (d) tracerBandes(trace, d, camera.zoom, couleursBandes);
    },
  };
  const scene: EncartSprites = {
    hote,
    // Lue par le moteur avant le décor et les poses : c'est là qu'une nouvelle taille se voit.
    get camera(): EtatCamera2d {
      majDisposition();
      return camera;
    },
    fond: null,
    aplats,
    poses: () => {
      const d = majDisposition();
      if (!d) return aucune;
      poserScene(d);
      return poses;
    },
    enMouvement: () => vivant && !passe && t < chrono.duree,
  };
  fermetures.push(deps.ouvrirEncart(scene));
  majEffectifs();
  deps.salir();

  return {
    get ouvert(): boolean {
      return vivant;
    },
    avancer(p: number): void {
      if (!vivant) return;
      const cible = fixe ? chrono.duree : Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0)) * chrono.duree;
      // Le temps ne recule jamais : une image en retard ne rejoue pas un coup.
      t = Math.max(t, cible);
      majEffectifs();
      deps.salir();
    },
    passer(): void {
      if (!vivant) return;
      passe = true;
      t = chrono.duree;
      majEffectifs();
      deps.salir();
    },
    effectif,
    enVol(cote: CoteDuel): number {
      const c = cote === 'attaquant' ? A : C;
      const arrivee = (cote === 'attaquant' ? C : A).impact;
      if (!vivant || passe || t >= chrono.duree || c.salve === null || arrivee === null) return 0;
      const ecart = ecartTireurs(chrono, c.nTireurs);
      let n = 0;
      for (let k = 0; k < c.nTireurs; k++) {
        const depart = c.salve + k * ecart;
        if (t >= depart && t < arrivee) n += 1;
      }
      return n;
    },
    fermer(): void {
      if (!vivant) return;
      vivant = false;
      for (let i = fermetures.length - 1; i >= 0; i--) fermetures[i]?.();
      fermetures.length = 0;
      racine.remove();
      deps.salir();
    },
  };
}
