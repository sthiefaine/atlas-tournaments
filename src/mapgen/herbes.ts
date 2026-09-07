/**
 * Passe 6 du pipeline (7 septembre 2026) : les hautes herbes.
 *
 * Une part de la plaine (`ratioHerbesHautes`) devient `herbe_haute`, en **taches**
 * de deux à six cases — jamais des cases isolées éparpillées : une touffe seule
 * ne cache personne et se lit comme du bruit. Chaque tache pousse d'un germe,
 * case par case, sur ses voisines de plaine ; deux taches ne partagent pas un
 * côté, sans quoi elles se lisent comme une seule nappe.
 *
 * La symétrie est exacte par construction : une tache se choisit dans le domaine
 * fondamental et chaque case est posée sur toute son orbite (`poser`), donc
 * l'image d'une herbe est une herbe. Une tache ne touche pas non plus sa propre
 * image — deux copies en miroir se souderaient au milieu de la carte en une
 * nappe double — et n'en chevauche aucune : l'axe de symétrie reste sans herbe.
 *
 * L'herbe vient **après** le bâti et les routes, sur la plaine qu'ils ont
 * laissée. Semée avant, elle se faisait écraser comme la forêt — et bien plus
 * qu'elle, parce que routes et bâtiments se concentrent dans le même couloir
 * de plaine que les taches : sur une plaine 20 × 14 à 0,2, la part finale
 * tombait jusqu'à 0,08 et un quart des taches finissaient en cases isolées.
 * Semée après, chaque tache reste entière, la part vaut le ratio, et aucune
 * herbe ne se trouve sous un bâtiment, sous une route ni dans la cour d'un QG.
 * Rien ne change pour le reste : l'herbe coûte ce que coûte la plaine pour tous
 * les mouvements (`terrains.json`), donc ni un chemin, ni une distance, ni une
 * valeur de camp ne la voient — une carte avec herbe, herbe remise en plaine,
 * est la carte sans herbe.
 */

import { distanceCases, lire, poser, voisins4, type Toile } from './grille';
import type { Rng } from './rng';

/** Taille d'une tache, en cases du domaine fondamental (une par copie symétrique). */
export const TAILLE_TACHE_MIN = 2;
export const TAILLE_TACHE_MAX = 6;

/** Distance de Tchebychev minimale entre une herbe et un QG : la cour reste nue. */
export const DEGAGEMENT_QG = 2;

/** Mélange de Fisher-Yates sur le flux seedé : l'ordre des germes est celui de la graine. */
function melanger(liste: number[], rng: Rng): void {
  for (let i = liste.length - 1; i > 0; i -= 1) {
    const j = rng.entier(i + 1);
    const a = liste[i] as number;
    liste[i] = liste[j] as number;
    liste[j] = a;
  }
}

/** Vrai si les deux cases partagent un côté. */
function adjacentes(t: Toile, a: number, b: number): boolean {
  return voisins4(t, a).includes(b);
}

/**
 * Masque de la cour des QG : les cases à moins de `DEGAGEMENT_QG` de chaque QG
 * **et de chacune de ses images** — à trois camps, la ville neutre qui tient
 * lieu de quatrième QG a la même cour, sans quoi le masque ne serait pas
 * invariant par le groupe et une herbe pourrait avoir pour image une case
 * interdite. On ne tend pas d'embuscade sur le pas de la porte.
 */
function courDesQg(t: Toile, qg: readonly number[]): Uint8Array {
  const total = t.largeur * t.hauteur;
  const cour = new Uint8Array(total);
  for (const q of qg) {
    if (q < 0 || q >= total) continue;
    for (const image of t.cadre.orbite(q)) {
      for (let c = 0; c < total; c += 1) {
        if (distanceCases(t, c, image) < DEGAGEMENT_QG) cour[c] = 1;
      }
    }
  }
  return cour;
}

/**
 * Vrai si `v` peut rejoindre la tache `cellules` (ses cases du domaine
 * fondamental, `v` non compris). Quatre refus : une case interdite ; une autre
 * tache par un côté ; une copie de la tache qui en chevaucherait une autre — la
 * case serait sur un axe, sa propre image — ; deux copies qui se toucheraient
 * par un côté.
 *
 * Les autres taches et le masque sont des unions d'orbites, donc invariants par
 * le groupe : si une image de `v` touchait une tache ou tombait dans la cour
 * d'un QG, `v` aussi. Regarder `v` seule suffit pour eux ; les copies de la
 * tache en cours, elles, ne sont pas encore posées et se comparent explicitement.
 */
function acceptable(
  t: Toile,
  v: number,
  cellules: readonly number[],
  taches: Int32Array,
  interdites: Uint8Array,
): boolean {
  if (interdites[v] === 1 || taches[v] !== -1) return false;
  if (voisins4(t, v).some((n) => taches[n] !== -1)) return false;
  const ensemble = [...cellules, v];
  for (let i = 0; i < t.cadre.ordre; i += 1) {
    const x = t.cadre.image(i, v);
    for (let j = 0; j < t.cadre.ordre; j += 1) {
      if (j === i) continue;
      for (const b of ensemble) {
        const y = t.cadre.image(j, b);
        if (x === y || adjacentes(t, x, y)) return false;
      }
    }
  }
  return true;
}

/**
 * Fait pousser une tache depuis un germe jusqu'à `cible` cases, ou moins si la
 * plaine manque autour. Une tache qui n'atteint pas la taille minimale est
 * abandonnée : rien n'est écrit, le germe reste de la plaine.
 */
function pousser(
  t: Toile,
  rng: Rng,
  germe: number,
  cible: number,
  taches: Int32Array,
  interdites: Uint8Array,
): number[] | null {
  const cellules: number[] = [];
  if (!acceptable(t, germe, cellules, taches, interdites)) return null;
  cellules.push(germe);
  while (cellules.length < cible) {
    // Le bord : les plaines qui touchent la tache par un côté, dans un ordre
    // qui ne dépend que de la tache — le tirage qui suit reste rejouable.
    const bord: number[] = [];
    for (const u of cellules) {
      for (const v of voisins4(t, u)) {
        if (bord.includes(v) || cellules.includes(v)) continue;
        if (lire(t, v) !== 'plaine') continue;
        if (!acceptable(t, v, cellules, taches, interdites)) continue;
        bord.push(v);
      }
    }
    if (bord.length === 0) break;
    cellules.push(bord[rng.entier(bord.length)] as number);
  }
  return cellules.length >= TAILLE_TACHE_MIN ? cellules : null;
}

/**
 * Sème les hautes herbes : `ratio` de la plaine, en taches, hors de la cour des
 * QG donnés. Renvoie le nombre de cases posées, sur toute la carte. Un ratio nul
 * ne touche à rien et ne tire aucun aléa : les cartes générées avant la passe
 * restent les mêmes.
 *
 * Le budget se compte en cases de la carte, et chaque case retenue en coûte
 * `ordre` — les cases d'orbite courte (sur un axe) sont refusées par
 * `acceptable`, donc toutes les cases d'une tache ont une orbite pleine. Un
 * ratio que la séparation des taches ne permet pas d'atteindre (vers 0,5, le
 * plafond du schéma) est posé en moins : la mesure `herbe_haute_part` le dit.
 */
export function semerHerbes(t: Toile, rng: Rng, ratio: number, qg: readonly number[] = []): number {
  if (!(ratio > 0)) return 0;
  const total = t.largeur * t.hauteur;
  let plaines = 0;
  const germes: number[] = [];
  for (let c = 0; c < total; c += 1) {
    if (lire(t, c) !== 'plaine') continue;
    plaines += 1;
    if (t.cadre.representant(c) === c) germes.push(c);
  }
  const budget = Math.round(ratio * plaines);
  melanger(germes, rng);
  const interdites = courDesQg(t, qg);

  // Numéro de tache par case, `-1` sans herbe : c'est ce qui tient les taches
  // séparées, et ce que `acceptable` consulte.
  const taches = new Int32Array(total).fill(-1);
  let posees = 0;
  let numero = 0;
  for (const germe of germes) {
    const reste = Math.floor((budget - posees) / t.cadre.ordre);
    if (reste < TAILLE_TACHE_MIN) break;
    if (taches[germe] !== -1) continue;
    const cible = Math.min(rng.entre(TAILLE_TACHE_MIN, TAILLE_TACHE_MAX), reste);
    const tache = pousser(t, rng, germe, cible, taches, interdites);
    if (tache === null) continue;
    for (const c of tache) {
      poser(t, c, 'herbe_haute');
      for (const image of t.cadre.orbite(c)) taches[image] = numero;
    }
    posees += tache.length * t.cadre.ordre;
    numero += 1;
  }
  return posees;
}
