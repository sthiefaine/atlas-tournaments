/**
 * Ce qui se cuit, et comment : les sources et leur plan de vues et de clips.
 *
 * Deux origines. Le **catalogue** est ce que le jeu a livré dans
 * `public/assets/modeles/` : les unités communes, les bâtiments (bases et QG
 * nationaux), les rochers et le pont. Les autres terrains livrés (plaine,
 * forêt, rivière, route) ne se cuisent pas : le sol est un nuanceur
 * (`render2d/sol/`), et la forêt vient des essences de décor. Une **liste**
 * (`--liste`) apporte des sources d'ailleurs — le décor procédural,
 * la calibration —, au format de `assets/sources-sprites/decor/liste.json`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import {
  CLIPS, FAMILLES_SPRITE, IMAGES_PAR_SECONDE, LACET_VUE, TANGAGE_CARTE, TANGAGE_PROFIL, VUES,
  type ClipSprite, type FamilleSprite, type VueSprite,
} from '../../src/render2d/contrat';

import { echantillonner } from './echantillonnage';
import type { ClipGlb } from './glb';
import { RACINE_MODELES } from './reglages';

/** Sur quels matériaux le masque d'équipe agit (voir `cuire_entree.py`, `materiau_teinte`). */
export type RegleMasque = 'tous' | 'base' | 'kit' | 'aucun';

/** Une source à cuire. */
export interface SourceSprite {
  id: string;
  famille: FamilleSprite;
  cle: string;
  variante?: string;
  /** Le GLB, relatif à la racine du dépôt. */
  fichier: string;
  /** Les vues imposées par une liste ; sinon, celles de la famille. */
  vues?: VueSprite[];
  /** Ombre au sol cuite (attrapeur d'ombre). */
  ombre: boolean;
  regleMasque: RegleMasque;
  /** L'émission part dans sa page, hors de la couleur : les fenêtres d'un bâtiment, allumées la nuit. */
  emissionSeparee: boolean;
  /**
   * Faux pour une source cuite **sans** le contour de sa famille
   * (`CONTOUR_PAR_FAMILLE`) : la calibration de la caméra, qui mesure des
   * emprises au pixel près. Absent : le contour de la famille.
   */
  contour?: boolean;
}

/** Un clip à photographier dans une vue. */
export interface AnimationPlan {
  clip: ClipSprite;
  /** Faux pour une image fixe : la pose de repos, sans action. */
  anime: boolean;
  boucle: boolean;
  temps: number[];
  ips: number;
}

export interface VuePlan {
  vue: VueSprite;
  lacet: number;
  tangage: number;
  animations: AnimationPlan[];
}

/** Classe un identifiant livré ; `null` pour ce qui ne se cuit pas. */
export function classer(id: string): Omit<SourceSprite, 'fichier'> | null {
  let m = /^unite_([a-z0-9_]+)_base$/.exec(id);
  if (m) return { id, famille: 'unite', cle: m[1]!, ombre: false, regleMasque: 'base', emissionSeparee: false };
  m = /^batiment_([a-z]+)_base$/.exec(id);
  if (m) return { id, famille: 'batiment', cle: m[1]!, ombre: true, regleMasque: 'tous', emissionSeparee: true };
  m = /^batiment_([a-z]+)_([a-z]{2,3})$/.exec(id);
  if (m) return { id, famille: 'batiment', cle: m[1]!, variante: m[2]!, ombre: true, regleMasque: 'tous', emissionSeparee: true };
  m = /^decor_rocher_([a-z0-9_]+)$/.exec(id);
  if (m) return { id, famille: 'decor', cle: 'rocher', variante: m[1]!, ombre: true, regleMasque: 'aucun', emissionSeparee: false };
  if (id === 'terrain_pont') {
    return { id, famille: 'terrain', cle: 'pont', vues: ['fixe', 'travers'], ombre: true, regleMasque: 'aucun', emissionSeparee: false };
  }
  return null;
}

/** Les sources du catalogue livré, triées par identifiant, et ce qui a été écarté. */
export function sourcesCatalogue(racine = RACINE_MODELES): { sources: SourceSprite[]; ecartes: string[] } {
  const sources: SourceSprite[] = [];
  const ecartes: string[] = [];
  for (const nom of readdirSync(racine).sort()) {
    const m = /^(.+)_lod0\.glb$/.exec(nom);
    if (!m) continue;
    const classe = classer(m[1]!);
    if (classe) sources.push({ ...classe, fichier: join(racine, nom) });
    else ecartes.push(m[1]!);
  }
  return { sources, ecartes };
}

/** Une entrée de liste, telle que l'agent du décor l'écrit. */
interface EntreeListe {
  id: string;
  famille: string;
  cle: string;
  variante?: string;
  fichier: string;
  vues?: string[];
  ombre?: boolean;
  contour?: boolean;
}

/**
 * Les sources d'une liste. Lève sur tout champ faux : une liste se corrige, elle ne se devine pas.
 *
 * Une entrée de la famille `unite` se cuit comme une unité du catalogue (la
 * cuisson d'essai d'une figurine, `scripts/production/figurines/`) : sans
 * `vues`, le plan des unités — la marche dans trois vues, tous les clips à
 * droite, le combat de profil —, pas d'ombre cuite, et le masque sur les
 * matériaux d'une base commune.
 */
export function sourcesListe(chemin: string, racineDepot = process.cwd()): SourceSprite[] {
  const brut: unknown = JSON.parse(readFileSync(chemin, 'utf8'));
  const liste = brut as { version?: unknown; entrees?: unknown };
  if (liste.version !== 1 || !Array.isArray(liste.entrees)) throw new Error(`${chemin} : version 1 et « entrees » attendues`);
  const dossier = dirname(resolve(chemin));
  const vus = new Set<string>();
  return (liste.entrees as EntreeListe[]).map((e, i) => {
    const ou = `${chemin}, entrée ${i}`;
    if (typeof e.id !== 'string' || !/^[a-z0-9_]+$/.test(e.id)) throw new Error(`${ou} : identifiant invalide`);
    if (vus.has(e.id)) throw new Error(`${ou} : identifiant ${e.id} en double`);
    vus.add(e.id);
    if (!(FAMILLES_SPRITE as readonly string[]).includes(e.famille)) throw new Error(`${ou} : famille ${e.famille} inconnue`);
    if (typeof e.cle !== 'string' || e.cle.length === 0) throw new Error(`${ou} : clé absente`);
    const unite = e.famille === 'unite';
    const vues = e.vues ?? (unite ? undefined : ['fixe']);
    for (const v of vues ?? []) if (!(VUES as readonly string[]).includes(v)) throw new Error(`${ou} : vue ${v} inconnue`);
    if (e.contour !== undefined && typeof e.contour !== 'boolean') throw new Error(`${ou} : « contour » vrai ou faux`);
    const fichier = resolve(dossier, e.fichier);
    if (!existsSync(fichier)) throw new Error(`${ou} : fichier ${e.fichier} introuvable`);
    return {
      id: e.id,
      famille: e.famille as FamilleSprite,
      cle: e.cle,
      ...(e.variante ? { variante: e.variante } : {}),
      fichier: relative(racineDepot, fichier),
      ...(vues ? { vues: vues as VueSprite[] } : {}),
      ombre: e.ombre ?? !unite,
      regleMasque: unite ? 'base' : 'tous',
      emissionSeparee: e.famille === 'batiment',
      ...(e.contour === false ? { contour: false } : {}),
    };
  });
}

/** Les clips connus d'un GLB, dans l'ordre du contrat. */
function clipsConnus(clips: readonly ClipGlb[]): Map<ClipSprite, number> {
  const m = new Map<ClipSprite, number>();
  for (const nom of CLIPS) {
    const c = clips.find((x) => x.nom === nom);
    if (c) m.set(nom, c.duree);
  }
  return m;
}

/** `repos` et `deplacement` bouclent, les autres jouent une fois : la règle de la 3D (`clipEnBoucle`). */
export function clipEnBoucle(clip: ClipSprite): boolean {
  return clip === 'repos' || clip === 'deplacement';
}

function animation(clip: ClipSprite, duree: number): AnimationPlan {
  const boucle = clipEnBoucle(clip);
  const e = echantillonner(duree, boucle);
  return { clip, anime: true, boucle, temps: e.temps, ips: e.ips };
}

/** Une image fixe : la pose de repos du modèle, sans clip. */
function fixe(): AnimationPlan {
  return { clip: 'repos', anime: false, boucle: true, temps: [0], ips: IMAGES_PAR_SECONDE };
}

/**
 * Le plan d'une source : quelles vues, et dans chacune quels clips. Rien n'est
 * inventé — un clip absent du GLB n'est pas photographié —, mais une vue sans
 * aucun clip reçoit une image fixe, la pose de repos : un modèle rigide a
 * besoin d'une image.
 *
 * - unité : `deplacement` en `droite`, `bas`, `haut` ; tous ses clips en
 *   `droite` ; `repos`, `tir`, `touche`, `hors_jeu` en `profil` ;
 * - bâtiment, terrain, décor : tous leurs clips dans chacune de leurs vues
 *   (`fixe` ; le pont, `fixe` et `travers`).
 */
export function planVues(source: SourceSprite, clips: readonly ClipGlb[]): VuePlan[] {
  const connus = clipsConnus(clips);
  const pris = (voulus: readonly ClipSprite[]): AnimationPlan[] =>
    voulus.filter((c) => connus.has(c)).map((c) => animation(c, connus.get(c)!));
  const vue = (v: VueSprite, animations: AnimationPlan[]): VuePlan => ({
    vue: v,
    lacet: LACET_VUE[v],
    tangage: v === 'profil' ? TANGAGE_PROFIL : TANGAGE_CARTE,
    animations: animations.length > 0 ? animations : [fixe()],
  });
  if (source.famille === 'unite' && !source.vues) {
    const marche = pris(['deplacement']);
    const deReserve = marche.length > 0 ? marche : pris(['repos']);
    return [
      vue('droite', pris(CLIPS)),
      vue('bas', deReserve),
      vue('haut', deReserve),
      vue('profil', pris(['repos', 'tir', 'touche', 'hors_jeu'])),
    ];
  }
  const vues = source.vues ?? ['fixe'];
  return VUES.filter((v) => vues.includes(v)).map((v) => vue(v, pris(CLIPS)));
}
