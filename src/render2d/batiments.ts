/**
 * Les **bâtiments** de la peau 2D : l'image du bâtiment à la couleur de son
 * propriétaire, son pavillon, le fanion d'une capture en cours, la marque d'une
 * usine sous impulsion.
 *
 * Les règles sont celles du décor 3D (`render3d/decor.ts`), qui les a payées :
 *
 * - la couleur d'équipe est celle du **style de la nation** du propriétaire,
 *   la palette du camp à défaut, le gris neutre sans propriétaire ;
 * - un bâtiment **désaffecté** est endormi : il ne sert à rien tant qu'on ne
 *   l'a pas remis en service (`04-gameplay.md` §6 bis). Il prend son image à
 *   lui si elle est cuite, sinon l'image du bâtiment terni, et **jamais de mât**
 *   — le sien est couché, dans l'image ; rien ne s'y hisse avant la remise en
 *   service (`doc/refonte/plan-batiments.md` §4) ;
 * - la **superusine** d'un scénario prend son image, active tant qu'elle est à
 *   son camp, inerte sinon ; l'image de l'usine à défaut ;
 * - tout autre bâtiment porte un **mât** : pavoisé aux couleurs de son camp,
 *   **nu** sans propriétaire — jamais de drapeau gris (charte des figurines
 *   §3.12). Une capture en cours **amène** les couleurs du propriétaire à
 *   proportion des points pris — ou **hisse** celles de qui capture un neutre —,
 *   sur le seuil du moteur (`seuilCapture` : un QG en demande le double) ;
 * - une unité **cachée** ne se trahit jamais par le décor : un drapeau qui
 *   descend sous une unité qu'on ne voit pas dirait qu'elle est là ;
 * - sous le brouillard, un bâtiment est **noir** comme sa case, mât et drapeau
 *   compris.
 *
 * Pur (`tests/render2d/batiments.test.ts`).
 */

import { CLE_SUPERUSINE } from '../assets/spec';
import type { EtatPartie, Unite } from '../engine/index';
import { cleCase, superusineSur } from '../engine/index';
import type { MarqueUnite } from '../render/rendu';
import { TERRAINS_CAPTURABLES, type CampId, type Case, type CleTerrain } from '../schemas/types';
import { COS_TANGAGE, idBatiment, idBatimentEtat, PIXELS_PAR_CASE, type ClipSprite, type VueSprite } from './contrat';
import type { Pose } from './lot';
import { FORMES, HAUTEUR_MAT, TAILLE_DRAPEAU, TEINTE_DESAFFECTE } from './replis';
import type { AnimationChoisie, Rvb } from './unites';

// Le terni vit avec les replis, qui le peignent aussi ; on le lit ici, où il sert d'abord.
export { TEINTE_DESAFFECTE };

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

/**
 * La pose du pavillon d'une case bâtie dans un état : `poseDrapeau`, sauf sur
 * un **désaffecté**, où rien n'est hissé — son mât est couché — tant que la
 * remise en service n'est pas faite. `occupant` est celui qu'on a le droit de
 * voir : une unité cachée ne se trahit pas par le drapeau.
 */
export function poseDrapeauCase(
  s: EtatPartie, c: Case, occupant: Unite | null | undefined, seuil: number,
): PoseDrapeau {
  const k = cleCase(c);
  if (s.desaffectes.includes(k)) return { camp: null, niveau: 0 };
  const capture = occupant && occupant.pointsCapture > 0 ? { camp: occupant.camp, points: occupant.pointsCapture } : null;
  return poseDrapeau(s.proprietaires[k] ?? null, capture, seuil);
}

/** La hauteur du bas du drapeau sur le mât, en cases, pour un niveau de 0 à 1. */
export function hauteurDrapeau(niveau: number): number {
  const drapeau = TAILLE_DRAPEAU.h / (PIXELS_PAR_CASE * COS_TANGAGE);
  const bas = 0.12;
  const haut = HAUTEUR_MAT - drapeau - 0.02;
  return bas + (haut - bas) * Math.max(0, Math.min(1, niveau));
}

/** Ce que la règle des images de bâtiment demande à l'atlas. */
export interface ImagesBatiments {
  /** L'entrée ordinaire d'un bâtiment pour son propriétaire : le kit national s'il est cuit, sinon la base. */
  entree(terrain: CleTerrain, proprio: CampId | null): string;
  /**
   * Vrai si le manifeste porte cette entrée. Une image d'état (désaffecté,
   * superusine) ne se montre que si elle a été cuite : absente, c'est l'image
   * ordinaire qui la remplace. Sans cette fonction, aucune ne l'est.
   */
  existe?(id: string): boolean;
}

/** Ce qu'un bâtiment montre : son image, son terni, et s'il porte un mât. */
export interface AspectBatiment {
  /** L'entrée du manifeste. */
  entree: string;
  /** Le terni d'un désaffecté qui n'a pas d'image à lui ; `null` : aucun. */
  teinte: Rvb | null;
  /** Faux sur un désaffecté : son mât est couché, dans son image ou nulle part. */
  mat: boolean;
}

/**
 * L'aspect d'une case bâtie — la même règle pour la carte et pour l'écran de
 * combat, qui pose le même bâtiment :
 *
 * - une case d'une **superusine** (`etat.reglages.superusines`) prend
 *   `batiment_superusine_base` tant qu'elle est au camp de sa superusine et
 *   pas désaffectée, `batiment_superusine_inerte` sinon ; l'image ordinaire de
 *   la case (l'usine) si l'état voulu n'est pas cuit ;
 * - un **désaffecté** prend `batiment_<clé>_desaffecte`, sans teinte ; à
 *   défaut, l'image ordinaire ternie (`TEINTE_DESAFFECTE`) ; sans mât, jamais ;
 * - tout autre bâtiment, son image ordinaire et son mât.
 */
export function aspectBatiment(etat: EtatPartie, c: Case, terrain: CleTerrain, images: ImagesBatiments): AspectBatiment {
  const k = cleCase(c);
  const proprio = etat.proprietaires[k] ?? null;
  const desaffecte = etat.desaffectes.includes(k);
  const cuite = (id: string): string | null => (images.existe?.(id) ? id : null);
  const superusine = superusineSur(etat, c);
  if (superusine) {
    const active = proprio === superusine.camp && !desaffecte;
    const id = cuite(active ? idBatiment(CLE_SUPERUSINE) : idBatimentEtat(CLE_SUPERUSINE, 'inerte'));
    if (id) return { entree: id, teinte: null, mat: !desaffecte };
  }
  if (desaffecte) {
    const id = cuite(idBatimentEtat(terrain, 'desaffecte'));
    return id
      ? { entree: id, teinte: null, mat: false }
      : { entree: images.entree(terrain, proprio), teinte: TEINTE_DESAFFECTE, mat: false };
  }
  return { entree: images.entree(terrain, proprio), teinte: null, mat: true };
}

/** Ce que les poses de bâtiments doivent savoir, hors de l'état. */
export interface OptionsPosesBatiments extends ImagesBatiments {
  /** Les cases vues, `null` sans brouillard. */
  visibles: ReadonlySet<string> | null;
  /** Les unités vues, `null` ou absent : toutes. */
  unitesVues?: ReadonlySet<string> | null;
  /** Le brouillard par case (`niveauxBrouillard`), `null` : tout vu. */
  brouillard: Uint8Array | null;
  /** La couleur d'équipe d'un propriétaire, le gris neutre pour `null`. */
  equipe(camp: CampId | null): Rvb;
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
 * Les poses des bâtiments (calque `volumes`) : l'image (`aspectBatiment`), puis
 * le mât, le drapeau et la marque, triés **avec** leur bâtiment.
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
      const aspect = aspectBatiment(etat, c, terrain, o);
      const anim = o.animation(aspect.entree, 'fixe', 'repos');
      let cadre = 0;
      if (anim && anim.cadres > 1 && anim.boucle && !o.reduit && vue > 0) {
        cadre = Math.floor((o.tempsMs * anim.ips) / 1000) % anim.cadres;
        animees = true;
      }
      poses.push({
        calque: 'volumes', ligne: gy, colonne: gx,
        instance: {
          entree: aspect.entree, animation: anim?.index ?? -1, cadre, x: gx, y: gy, equipe: o.equipe(proprio), vue,
          ...(aspect.teinte ? { teinte: aspect.teinte } : {}),
        },
      });
      // Le mât : nu sur un neutre, pavoisé sinon ; aucun sur un désaffecté, dont le mât est couché.
      if (aspect.mat) {
        const pose = o.forces?.get(k) ?? poseDrapeauCase(etat, c, occupants.get(k), o.seuil(c));
        const mx = x + PIED_MAT.x;
        const my = y + PIED_MAT.y;
        poses.push({
          calque: 'volumes', ligne: gy, colonne: gx,
          instance: { entree: FORMES.mat, animation: -1, cadre: 0, x: mx, y: my, vue },
        });
        if (pose.camp !== null) {
          poses.push({
            calque: 'volumes', ligne: gy, colonne: gx,
            instance: {
              entree: FORMES.drapeau, animation: -1, cadre: 0, x: mx, y: my, h: hauteurDrapeau(pose.niveau),
              equipe: o.equipe(pose.camp), vue,
            },
          });
        }
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
