/**
 * Les **bâtiments** de la peau 2D : l'image du bâtiment à la couleur de son
 * propriétaire, son pavillon, le fanion d'une capture en cours, la marque d'une
 * usine sous impulsion.
 *
 * Les règles sont celles du décor 3D (`render3d/decor.ts`), qui les a payées :
 *
 * - la couleur d'équipe est celle du **style de la nation** du propriétaire,
 *   la palette du camp à défaut, le gris neutre sans propriétaire ;
 * - un bâtiment **désaffecté** est terni : il ne sert à rien tant qu'on ne l'a
 *   pas remis en service (`04-gameplay.md` §6 bis) ;
 * - tout bâtiment **possédé** porte le pavillon de son camp ; un bâtiment neutre
 *   n'en a pas, et c'est ce qui le dit neutre. Une capture en cours **amène** les
 *   couleurs du propriétaire à proportion des points pris — ou **hisse** celles
 *   de qui capture un neutre —, sur le seuil du moteur (`seuilCapture` : un QG
 *   ou un désaffecté en demande le double) ;
 * - une unité **cachée** ne se trahit jamais par le décor : un drapeau qui
 *   descend sous une unité qu'on ne voit pas dirait qu'elle est là ;
 * - sous le brouillard, un bâtiment est **noir** comme sa case, drapeau compris.
 *
 * Pur (`tests/render2d/batiments.test.ts`).
 */

import type { EtatPartie, Unite } from '../engine/index';
import { cleCase } from '../engine/index';
import type { MarqueUnite } from '../render/rendu';
import { TERRAINS_CAPTURABLES, type CampId, type Case, type CleTerrain } from '../schemas/types';
import { COS_TANGAGE, PIXELS_PAR_CASE, type ClipSprite, type VueSprite } from './contrat';
import type { Pose } from './lot';
import { FORMES, HAUTEUR_MAT, TAILLE_DRAPEAU } from './replis';
import type { AnimationChoisie, Rvb } from './unites';

/** La teinte d'un bâtiment désaffecté : terni, un peu plus froid. */
export const TEINTE_DESAFFECTE: Rvb = [0.6, 0.6, 0.58];

/** Où se plante le mât sur sa case, au sol, en fraction de case. */
export const PIED_MAT = { x: 0.86, y: 0.3 } as const;

/** Ce qu'un pavillon montre : des couleurs, et une hauteur sur le mât. */
export interface PoseDrapeau {
  camp: CampId | null;
  /** 0 au pied du mât, 1 au sommet. */
  niveau: number;
}

/**
 * La pose d'un pavillon d'après l'état — la règle de la 3D, mot pour mot. Une
 * capture en cours **amène** les couleurs du propriétaire à proportion des
 * points pris ; sur un bâtiment neutre, elle **hisse** celles du camp qui
 * capture. Un mât neutre et tranquille reste nu.
 */
export function poseDrapeau(
  proprio: CampId | null, capture: { camp: CampId; points: number } | null, seuil: number,
): PoseDrapeau {
  const part = capture && capture.camp !== proprio
    ? Math.min(1, Math.max(0, capture.points / Math.max(1, seuil))) : 0;
  if (proprio === null) {
    return capture && part > 0 ? { camp: capture.camp, niveau: part } : { camp: null, niveau: 0 };
  }
  return { camp: proprio, niveau: 1 - part };
}

/** La hauteur du bas du drapeau sur le mât, en cases, pour un niveau de 0 à 1. */
export function hauteurDrapeau(niveau: number): number {
  const drapeau = TAILLE_DRAPEAU.h / (PIXELS_PAR_CASE * COS_TANGAGE);
  const bas = 0.12;
  const haut = HAUTEUR_MAT - drapeau - 0.02;
  return bas + (haut - bas) * Math.max(0, Math.min(1, niveau));
}

/** Ce que les poses de bâtiments doivent savoir, hors de l'état. */
export interface OptionsPosesBatiments {
  /** Les cases vues, `null` sans brouillard. */
  visibles: ReadonlySet<string> | null;
  /** Les unités vues, `null` ou absent : toutes. */
  unitesVues?: ReadonlySet<string> | null;
  /** Le brouillard par case (`niveauxBrouillard`), `null` : tout vu. */
  brouillard: Uint8Array | null;
  /** La couleur d'équipe d'un propriétaire, le gris neutre pour `null`. */
  equipe(camp: CampId | null): Rvb;
  /** L'entrée du manifeste d'un bâtiment (kit national ou base). */
  entree(terrain: CleTerrain, proprio: CampId | null): string;
  /** L'animation cuite d'une entrée, `null` : repli. */
  animation(entree: string, vue: VueSprite, clip: ClipSprite): AnimationChoisie | null;
  /** Le seuil de capture d'une case (`seuilCapture` du moteur). */
  seuil(c: Case): number;
  /** Les drapeaux qu'une animation impose, par clé de case. */
  forces?: ReadonlyMap<string, PoseDrapeau>;
  /** Les marques posées sur des cases (usine sous impulsion). */
  marquesCases?: ReadonlyMap<string, MarqueUnite> | null;
  /** L'horloge de rendu : le palan d'une usine tourne. */
  tempsMs: number;
  reduit: boolean;
}

const CAPTURABLES = new Set<string>(TERRAINS_CAPTURABLES);

/** Vrai si ce terrain est un bâtiment : les seuls à porter un propriétaire. */
export function estBatiment(t: CleTerrain | null): t is CleTerrain {
  return t !== null && CAPTURABLES.has(t);
}

/** Ce que rendent les poses de bâtiments. */
export interface PosesBatiments {
  poses: Pose[];
  /** Vrai si un bâtiment cuit s'anime : la boucle doit revenir, au pas de l'ambiance. */
  animees: boolean;
}

/**
 * Les poses des bâtiments (calque `volumes`) : l'image, puis le mât, le
 * drapeau et la marque, triés **avec** leur bâtiment.
 */
export function posesBatiments(
  etat: EtatPartie, terrainDe: (c: Case) => CleTerrain | null, o: OptionsPosesBatiments,
): PosesBatiments {
  const poses: Pose[] = [];
  let animees = false;
  // Les occupants **vus** de chaque case : un inconnu ne trahit pas sa capture.
  const occupants = new Map<string, Unite>();
  for (const u of etat.unites) {
    if (u.dansTransport) continue;
    const k = cleCase(u);
    if (o.visibles && !o.visibles.has(k)) continue;
    if (o.unitesVues && !o.unitesVues.has(u.id)) continue;
    occupants.set(k, u);
  }
  const desaffectes = new Set(etat.desaffectes);
  for (let y = 0; y < etat.hauteur; y++) {
    for (let x = 0; x < etat.largeur; x++) {
      const c = { x, y };
      const terrain = terrainDe(c);
      if (!estBatiment(terrain)) continue;
      const k = cleCase(c);
      const proprio = etat.proprietaires[k] ?? null;
      const vue = o.brouillard ? (o.brouillard[y * etat.largeur + x] ?? 255) / 255 : 1;
      const gx = x + 0.5;
      const gy = y + 0.5;
      const entree = o.entree(terrain, proprio);
      const anim = o.animation(entree, 'fixe', 'repos');
      let cadre = 0;
      if (anim && anim.cadres > 1 && anim.boucle && !o.reduit && vue > 0) {
        cadre = Math.floor((o.tempsMs * anim.ips) / 1000) % anim.cadres;
        animees = true;
      }
      poses.push({
        calque: 'volumes', ligne: gy, colonne: gx,
        instance: {
          entree, animation: anim?.index ?? -1, cadre, x: gx, y: gy, equipe: o.equipe(proprio), vue,
          ...(desaffectes.has(k) ? { teinte: TEINTE_DESAFFECTE } : {}),
        },
      });
      const u = occupants.get(k);
      const pose = o.forces?.get(k) ?? poseDrapeau(
        proprio, u && u.pointsCapture > 0 ? { camp: u.camp, points: u.pointsCapture } : null, o.seuil(c),
      );
      if (pose.camp !== null) {
        const mx = x + PIED_MAT.x;
        const my = y + PIED_MAT.y;
        poses.push({
          calque: 'volumes', ligne: gy, colonne: gx,
          instance: { entree: FORMES.mat, animation: -1, cadre: 0, x: mx, y: my, vue },
        });
        poses.push({
          calque: 'volumes', ligne: gy, colonne: gx,
          instance: {
            entree: FORMES.drapeau, animation: -1, cadre: 0, x: mx, y: my, h: hauteurDrapeau(pose.niveau),
            equipe: o.equipe(pose.camp), vue,
          },
        });
      }
      const marque = o.marquesCases?.get(k) ?? null;
      if (marque && vue > 0) {
        poses.push({
          calque: 'volumes', ligne: gy, colonne: gx,
          instance: { entree: FORMES.marque(marque), animation: -1, cadre: 0, x: gx, y: gy, h: 1.1 },
        });
      }
    }
  }
  return { poses, animees };
}
