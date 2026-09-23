/**
 * Le **ciel** de la peau 2D : la météo qui tombe devant la carte, et
 * l'**étalonnage** d'ambiance qui assombrit ou voile tout ce qui est du monde.
 *
 * ## La météo (`Meteo2d`)
 *
 * Pluie, averse de tempête, neige, nappes de brume, poussière de canicule, lues
 * sur `ambiance.particules` (`render/ambiance.ts`, les chiffres de l'ancien
 * rendu vectoriel : densité par case, vitesse et vent en pixels par seconde).
 * Elles se posent **en espace écran**, dans le calque `meteo` — ce qui tombe
 * devant la caméra ne glisse pas avec la carte — et elles sont **bon marché** :
 *
 * - chaque particule est une **fonction du temps** (une position de départ tirée
 *   une fois, une vitesse, un repli modulo l'écran) : rien ne s'accumule, rien ne
 *   dérive, et la même heure rend la même image ;
 * - un **plafond** : `PLAFOND_METEO` particules, `PLAFOND_METEO_TACTILE` au doigt
 *   (`pointer: coarse`) ; toutes créées au montage, poses réécrites en place ;
 * - **rien** sous animations réduites : la météo se lit alors au Bulletin et
 *   dans l'étalonnage, pas dans une pluie qui tombe.
 *
 * ## L'étalonnage (`voileDuLot`, `etalonnerPose`)
 *
 * Le sol peint la palette de **jour** (`render2d/sol/`, `doc/refonte/sprites-terrain.md`
 * §4) : la nuit, la brume, la tempête sont l'affaire du moteur, **une seule
 * fois** pour tout ce qui est du monde. Le voile d'ambiance (`ambiance.voile`,
 * une couleur `V` et une part `a`) donne à une couleur `c` : `c·(1 − a) + V·a`.
 *
 * - **le sol** le reçoit tel quel : un aplat de voile peint juste après lui, et
 *   **sous** les surbrillances, qui restent lisibles ;
 * - **les images du monde** — bâtiments, mâts et drapeaux, décor, figurines —
 *   le reçoivent dans le nuanceur du lot, **exactement** : le voile est un
 *   réglage de l'appel de calque (`voileDuLot`), la pose ne porte que le
 *   drapeau qui dit qu'elle est du monde (`etalonnerPose`). Cela remplace, le
 *   23 septembre 2026, une teinte et un éclat par instance, justes sur le blanc
 *   et à 0,05 près ailleurs (`doc/refonte/sprites-reglages.md`) ;
 * - **ne le reçoivent pas** : les pastilles de PV, les marques du télégraphage,
 *   les ombres (posées sur un sol déjà voilé), les effets (ils sont de la
 *   lumière), la météo (elle a sa propre nuit). Les fenêtres des villes
 *   éclairées (pages d'émission) s'ajoutent **après** le voile, dans le lot :
 *   elles ressortent sur le monde assombri.
 *
 * Pur (`tests/render2d/meteo.test.ts`).
 */

import { lireCouleur, type Ambiance, type Particules } from '../render/ambiance';
import { EMISSION_JOUR, EMISSION_NUIT, PIXELS_PAR_CASE, SIN_TANGAGE, type InstanceSprite } from './contrat';
import { ANGLES_GOUTTE, ID_EFFET, IDS_GOUTTE, type Rvb } from './effets';
import type { Pose } from './lot';
import { FORMES } from './replis';

// ---------------------------------------------------------------------------
// 1. La météo
// ---------------------------------------------------------------------------

/** Les particules de météo qu'on ne dépasse jamais, sur un écran d'ordinateur. */
export const PLAFOND_METEO = 260;
/** Au doigt : un téléphone paie chaque particule plus cher, et l'écran est petit. */
export const PLAFOND_METEO_TACTILE = 110;
/** La cadence de la météo au repos, en millisecondes : 30 images par seconde, 20 au doigt. */
export const MS_METEO = 1000 / 30;
export const MS_METEO_TACTILE = 1000 / 20;

/** L'aire d'écran, en pixels CSS², qui porte une particule à densité 1, par type. */
const AIRE_PAR_PARTICULE = { pluie: 4096, neige: 3600, brume: 90_000, poussiere: 5000 } as const;
/** Une part des gouttes tombe en éclaboussure : de petits anneaux qui s'ouvrent au sol. */
const PART_ECLABOUSSURES = 0.12;
/** La vie d'une éclaboussure, en millisecondes. */
const MS_ECLABOUSSURE = 420;
/** Ce qui dépasse de l'écran de chaque côté, en pixels : une particule entre et sort, elle ne naît pas au bord. */
const DEBORD = 48;

/** Un tirage déterministe dans [0, 1[ : la particule `i`, le tirage `k`. */
export function tirage(i: number, k: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Le reste positif : une particule qui sort d'un côté rentre de l'autre. */
function modulo(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Une particule de météo : ses tirages, faits une fois, et sa pose réécrite en place. */
class Grain {
  readonly r: number[];
  readonly teinte: [number, number, number] = [1, 1, 1];
  readonly instance: InstanceSprite;
  readonly pose: Pose;

  constructor(i: number) {
    this.r = [0, 1, 2, 3, 4, 5].map((k) => tirage(i, k));
    this.instance = { entree: ID_EFFET.grain, animation: -1, cadre: 0, x: 0, y: 0, h: 0, teinte: this.teinte, opacite: 1, echelle: 1 };
    this.pose = { calque: 'meteo', ligne: 0, colonne: 0, instance: this.instance };
  }

  /** Pose la particule au pixel d'écran `(sx, sy)` : la matrice du calque `meteo` est celle de l'écran. */
  placer(entree: string, sx: number, sy: number, echelle: number, opacite: number, c: Rvb, nuit: number): Pose {
    const inst = this.instance;
    inst.entree = entree;
    inst.x = sx / PIXELS_PAR_CASE;
    inst.y = sy / (PIXELS_PAR_CASE * SIN_TANGAGE);
    inst.echelle = echelle;
    inst.opacite = opacite;
    this.teinte[0] = c[0] * nuit;
    this.teinte[1] = c[1] * nuit;
    this.teinte[2] = c[2] * nuit;
    this.pose.ligne = inst.y;
    this.pose.colonne = inst.x;
    return this.pose;
  }
}

const COULEURS = {
  pluie: [0.68, 0.8, 0.94] as Rvb,
  tempete: [0.78, 0.85, 0.94] as Rvb,
  neige: [1, 1, 1] as Rvb,
  brume: [0.9, 0.93, 0.95] as Rvb,
  poussiere: [0.92, 0.82, 0.6] as Rvb,
};

/** Le nombre de particules d'une météo sur un écran, avant plafond. */
export function nombreParticules(p: Particules, largeur: number, hauteur: number): number {
  if (p.type === 'aucune' || p.densite <= 0) return 0;
  const aire = Math.max(0, largeur) * Math.max(0, hauteur);
  const n = Math.round((p.densite * aire) / AIRE_PAR_PARTICULE[p.type]);
  return p.type === 'brume' ? Math.max(3, n) : n;
}

/** L'inclinaison peinte la plus proche d'une pluie poussée par le vent. */
export function goutteDe(vitesse: number, vent: number): string {
  const angle = (Math.atan2(Math.abs(vent), Math.max(1, vitesse)) * 180) / Math.PI;
  let meilleur = 0;
  ANGLES_GOUTTE.forEach((a, i) => {
    if (Math.abs(a - angle) < Math.abs((ANGLES_GOUTTE[meilleur] ?? 0) - angle)) meilleur = i;
  });
  return IDS_GOUTTE[meilleur]!;
}

/** La météo de la peau : un plafond, des particules créées une fois. */
export class Meteo2d {
  private readonly grains: Grain[] = [];
  private readonly eclaboussures: Grain[] = [];

  constructor(readonly plafond = PLAFOND_METEO) {
    const n = Math.max(0, Math.floor(plafond));
    for (let i = 0; i < n; i++) this.grains.push(new Grain(i));
    const e = Math.ceil(n * PART_ECLABOUSSURES);
    for (let i = 0; i < e; i++) this.eclaboussures.push(new Grain(10_000 + i));
  }

  /**
   * Ajoute à `sortie` les particules de la météo au temps `tempsMs`, sur un
   * écran de `vue` pixels CSS. Rend le nombre posé : zéro sous animations
   * réduites, sans météo, ou sur un écran vide.
   */
  poses(p: Particules, nuit: boolean, tempsMs: number, vue: { largeur: number; hauteur: number }, reduit: boolean, sortie: Pose[]): number {
    if (reduit || p.type === 'aucune') return 0;
    const W = vue.largeur;
    const H = vue.hauteur;
    if (W < 1 || H < 1) return 0;
    const n = Math.min(this.grains.length, nombreParticules(p, W, H));
    if (n <= 0) return 0;
    const s = tempsMs / 1000;
    const larg = W + 2 * DEBORD;
    const haut = H + 2 * DEBORD;
    let poses = 0;
    switch (p.type) {
      case 'pluie': {
        // Une tempête est une pluie plus forte, plus couchée, plus claire.
        const tempete = p.vitesse >= 800;
        const couleur = tempete ? COULEURS.tempete : COULEURS.pluie;
        const entree = goutteDe(p.vitesse, p.vent);
        const lumiere = nuit ? 0.6 : 1;
        for (let i = 0; i < n; i++) {
          const g = this.grains[i]!;
          const [r0, r1, r2, r3, r4, r5] = g.r as [number, number, number, number, number, number];
          const v = p.vitesse * (0.85 + 0.3 * r2);
          const w = p.vent * (0.9 + 0.2 * r3);
          const sx = modulo(r1 * larg + w * s, larg) - DEBORD;
          const sy = modulo(r0 * haut + v * s, haut) - DEBORD;
          const echelle = (0.8 + 0.5 * r4) * (tempete ? 1.2 : 1);
          sortie.push(g.placer(entree, sx, sy, echelle, (tempete ? 0.45 : 0.35) + 0.2 * r5, couleur, lumiere));
          poses += 1;
        }
        // Les éclaboussures : un anneau qui s'ouvre et s'éteint, ailleurs à chaque cycle.
        const e = Math.min(this.eclaboussures.length, Math.round(n * PART_ECLABOUSSURES));
        for (let i = 0; i < e; i++) {
          const g = this.eclaboussures[i]!;
          const decale = tempsMs + (g.r[0] ?? 0) * MS_ECLABOUSSURE;
          const cycle = Math.floor(decale / MS_ECLABOUSSURE);
          const u = (decale - cycle * MS_ECLABOUSSURE) / MS_ECLABOUSSURE;
          const sx = tirage(i + 20_000, cycle) * W;
          const sy = tirage(i + 30_000, cycle) * H;
          const largeur = 7 + 9 * u;
          sortie.push(g.placer(ID_EFFET.anneau, sx, sy, largeur / PIXELS_PAR_CASE, 0.5 * (1 - u), couleur, lumiere));
          poses += 1;
        }
        break;
      }
      case 'neige': {
        const lumiere = nuit ? 0.75 : 1;
        for (let i = 0; i < n; i++) {
          const g = this.grains[i]!;
          const [r0, r1, r2, r3, r4, r5] = g.r as [number, number, number, number, number, number];
          const v = p.vitesse * (0.6 + 0.8 * r2);
          const balancement = 18 * Math.sin(s * (1.6 + 2 * r3) + r1 * 20);
          const sx = modulo(r1 * larg + p.vent * s + balancement, larg) - DEBORD;
          const sy = modulo(r0 * haut + v * s, haut) - DEBORD;
          sortie.push(g.placer(ID_EFFET.flocon, sx, sy, 0.6 + 0.8 * r4, 0.55 + 0.35 * r5, COULEURS.neige, lumiere));
          poses += 1;
        }
        break;
      }
      case 'brume': {
        const lumiere = nuit ? 0.55 : 1;
        const largB = W + 2 * 260;
        for (let i = 0; i < n; i++) {
          const g = this.grains[i]!;
          const [r0, r1, , r3, r4, r5] = g.r as [number, number, number, number, number, number];
          const sx = modulo(r1 * largB + p.vent * (0.6 + 0.8 * r3) * s, largB) - 260;
          const sy = r0 * H + 22 * Math.sin(s * 0.35 + r3 * 9);
          sortie.push(g.placer(ID_EFFET.brume, sx, sy, 0.9 + 0.8 * r4, (0.1 + 0.08 * r5) * Math.min(1, p.densite + 0.3), COULEURS.brume, lumiere));
          poses += 1;
        }
        break;
      }
      case 'poussiere': {
        const lumiere = nuit ? 0.6 : 1;
        for (let i = 0; i < n; i++) {
          const g = this.grains[i]!;
          const [r0, r1, r2, r3, r4, r5] = g.r as [number, number, number, number, number, number];
          const vent = p.vent * (0.7 + 0.6 * r2);
          const sx = modulo(r1 * larg + vent * s + 10 * Math.sin(s * (0.9 + r3) + r0 * 11), larg) - DEBORD;
          const sy = modulo(r0 * haut + p.vitesse * (0.3 + 0.4 * r3) * s + 8 * Math.sin(s * 1.3 + r1 * 7), haut) - DEBORD;
          sortie.push(g.placer(ID_EFFET.grain, sx, sy, 0.8 + 0.8 * r4, 0.35 + 0.2 * r5, COULEURS.poussiere, lumiere));
          poses += 1;
        }
        break;
      }
      default:
        break;
    }
    return poses;
  }
}

/**
 * La matrice de l'écran : pixels CSS de la toile → espace de découpe, colonne
 * par colonne, écrite dans `sortie` sans rien allouer. C'est celle du calque
 * `meteo` : la pluie ne glisse pas avec la carte, elle tombe devant la caméra.
 */
export function matriceEcran(largeur: number, hauteur: number, sortie: Float32Array): Float32Array {
  const sx = 2 / Math.max(1, largeur);
  const sy = -2 / Math.max(1, hauteur);
  sortie[0] = sx; sortie[1] = 0; sortie[2] = 0;
  sortie[3] = 0; sortie[4] = sy; sortie[5] = 0;
  sortie[6] = -1; sortie[7] = 1; sortie[8] = 1;
  return sortie;
}

// ---------------------------------------------------------------------------
// 2. L'étalonnage d'ambiance
// ---------------------------------------------------------------------------

/**
 * Le voile d'une ambiance tel que le lot le reçoit, **par appel de calque** :
 * sa couleur sRGB et sa part, `[r, g, b, part]`, écrits dans `sortie` sans
 * rien allouer ; une part nulle de jour par temps clair. Le nuanceur en tire
 * exactement ce que le sol reçoit, `c·(1 − a) + V·a` (`lot.ts`) : la nuit est
 * juste sur toute couleur, et plus seulement sur le blanc — l'ancienne
 * approximation par instance (une teinte et un éclat) s'écartait jusqu'à 0,042,
 * dans les noirs d'une nuit de brouillard. Et comme elle ne vit plus dans les
 * instances, un changement d'ambiance ne refait plus aucune image.
 */
export function voileDuLot(a: Pick<Ambiance, 'voile'>, sortie: Float32Array = new Float32Array(4)): Float32Array {
  const voile = a.voile;
  if (!voile || !(voile.alpha > 0)) {
    sortie.fill(0);
    return sortie;
  }
  const c = lireCouleur(voile.couleur);
  sortie[0] = c.r / 255;
  sortie[1] = c.v / 255;
  sortie[2] = c.b / 255;
  sortie[3] = Math.min(1, voile.alpha);
  return sortie;
}

/**
 * Le poids de la page d'émission (fenêtres, feux) : presque rien le jour —
 * une lampe allumée ne se voit pas au soleil —, pleine quand les villes
 * s'éclairent (`ambiance.villesEclairees`). Les valeurs sont celles du contrat,
 * c'est-à-dire de la cuisson, qui a retiré cette lumière de la couleur.
 */
export function poidsEmission(a: Pick<Ambiance, 'villesEclairees'>): number {
  return a.villesEclairees ? EMISSION_NUIT : EMISSION_JOUR;
}

/** Ce que le voile donne à un canal opaque `c` du sol. */
export function voileSurCanal(c: number, canal: 0 | 1 | 2, voile: { couleur: string; alpha: number } | null): number {
  if (!voile) return c;
  const v = lireCouleur(voile.couleur);
  const composante = [v.r, v.v, v.b][canal]! / 255;
  return c * (1 - voile.alpha) + composante * voile.alpha;
}

/**
 * Ce que le lot donne à un canal `c` d'une image voilée de couverture `alpha`
 * — le mélange du nuanceur, `mix(c, V·alpha, part)`, sur une couleur
 * prémultipliée. Opaque, c'est `voileSurCanal` au bit près.
 */
export function voileImageSurCanal(c: number, alpha: number, canal: 0 | 1 | 2, voile: Float32Array): number {
  const part = voile[3] ?? 0;
  return c * (1 - part) + (voile[canal] ?? 0) * alpha * part;
}

/**
 * Vrai si une pose est du **monde** et reçoit le voile : ce qui est dans les
 * volumes ou dans le calque des unités, sauf ce qui se lit — pastilles de PV,
 * marques du télégraphage. Les ombres, les effets et la météo n'y sont pas ;
 * l'**écume** d'un navire, si : elle est de l'eau, claire, et la nuit la
 * laisserait briller seule sur une mer éteinte.
 */
export function doitEtalonner(p: Pose): boolean {
  if (p.calque === 'ombres_unites') return p.instance.entree === FORMES.ecume;
  if (p.calque !== 'volumes' && p.calque !== 'unites') return false;
  const id = p.instance.entree;
  return !id.startsWith('forme_pv_') && !id.startsWith('forme_marque_');
}

/**
 * Marque une pose du monde : le lot lui posera le voile du calque. Rien n'est
 * écrit dans l'instance — ni teinte, ni éclat —, si bien qu'une instance prêtée
 * par le sol se pose telle quelle, et qu'on peut marquer deux fois sans rien
 * assombrir deux fois.
 */
export function etalonnerPose(p: Pose): Pose {
  p.voilee = doitEtalonner(p);
  return p;
}
