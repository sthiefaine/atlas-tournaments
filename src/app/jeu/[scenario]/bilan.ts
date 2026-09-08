import type { EtatPartie } from '@/engine/index';
import type { CampId, MapDef } from '@/schemas/index';

/**
 * Le **bilan de fin de manche** : ce que la partie qui vient de s'achever dit
 * d'elle-même, et la note qu'on en tire.
 *
 * L'écran de fin d'une mission était un titre et deux boutons. Un joueur
 * d'Advance Wars l'a relevé comme le manque le plus net du lot : « AW donne un
 * rang, et c'est ce qui fait rejouer ». Il a raison sur le fond — sans mesure,
 * une victoire au forceps en dix-huit journées et une victoire propre en six se
 * ressemblent —, et tout ce qu'il faut pour la calculer était déjà dans l'état
 * de la partie, affiché nulle part.
 *
 * Le calcul sort du composant, comme `campagne/itineraire.ts` pour le fil et
 * `parties-libres.ts` pour `/jeu` : c'est une fonction pure, testée, sans DOM,
 * sans horloge et sans `t()`.
 *
 * **Ce qu'il ne fait pas**, et c'est délibéré : il ne lit pas `etat.journal`.
 * Le journal est une **fenêtre** de 120 événements (`engine/etat.ts`,
 * `JOURNAL_MAX`), pas une archive : un bilan qui compterait les mises hors jeu
 * dans le journal serait juste sur une manche courte et faux sur une longue,
 * c'est-à-dire faux. Tout ce qui suit se lit sur des grandeurs que l'état porte
 * en entier : la journée, les unités encore en jeu, celles que chaque camp a
 * produites, les bâtiments possédés, et les unités de départ de la carte.
 */

/** Le rang d'une manche gagnée. Quatre paliers, comme le genre l'a fixé. */
export type Rang = 'S' | 'A' | 'B' | 'C';

/** Les trois axes notés, plus les faits bruts d'où ils sortent. */
export interface Bilan {
  /** La journée à laquelle la manche s'est achevée. */
  journees: number;
  /** L'échéance du scénario, quand il en pose une. */
  limite: number | null;
  /** Unités du joueur mises en jeu : celles du départ plus celles produites. */
  engagees: number;
  /** Unités du joueur encore en jeu à la fin. */
  survivantes: number;
  /** Unités du joueur mises hors jeu. */
  perdues: number;
  /** Unités adverses mises hors jeu. */
  neutralisees: number;
  /** Bâtiments tenus par le joueur à la fin. */
  batiments: number;
  /** Vite fait : ce qui reste de l'échéance, en centièmes. */
  rythme: number;
  /** Bien fait : la part de la force adverse mise hors jeu, en centièmes. */
  puissance: number;
  /** Sans casse : la part de sa propre force encore debout, en centièmes. */
  tenue: number;
  /** La moyenne des trois axes, entière. */
  note: number;
  /** Le palier de la note. */
  rang: Rang;
}

/**
 * L'échéance retenue quand le scénario n'en pose aucune. Vingt journées est la
 * médiane mesurée d'une partie décidée sur `plaine.json` au 8 septembre 2026
 * (34 à 37 journées pour deux IA qui s'équivalent, la moitié pour un joueur qui
 * sait ce qu'il veut) : ce n'est pas une vérité, c'est une référence écrite, et
 * elle ne sert qu'aux scénarios sans limite.
 */
export const JOURNEES_REFERENCE = 20;

/** Les paliers, du plus haut au plus bas. Un rang se gagne, il ne se donne pas. */
const PALIERS: readonly { note: number; rang: Rang }[] = [
  { note: 90, rang: 'S' }, { note: 75, rang: 'A' }, { note: 55, rang: 'B' }, { note: 0, rang: 'C' },
];

/** Ramène une part dans 0–100, en centièmes entiers. */
function part(numerateur: number, denominateur: number): number {
  if (denominateur <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((numerateur / denominateur) * 100)));
}

/** Ce qu'un camp a produit depuis le début, tous types confondus. */
function produites(etat: EtatPartie, camp: CampId): number {
  const prefixe = `${camp}:`;
  let total = 0;
  for (const [cle, n] of Object.entries(etat.produites)) {
    if (cle.startsWith(prefixe)) total += n;
  }
  return total;
}

/** Ce qu'un camp avait sur la carte au premier coup de sifflet. */
function depart(carte: MapDef, camp: CampId): number {
  return carte.unitesDepart.filter((u) => u.camp === camp).length;
}

/** Ce qu'un camp a encore en jeu, cales comprises : une unité embarquée est en jeu. */
function enJeu(etat: EtatPartie, camp: CampId): number {
  return etat.unites.filter((u) => u.camp === camp).length;
}

/**
 * Le bilan d'une manche, du point de vue de `camp`.
 *
 * Les trois axes sont des **parts**, jamais des seuils absolus : une mission à
 * trois unités et une bataille à trente se notent avec la même règle. Le rang
 * n'est rendu que par courtoisie du calcul — c'est à l'écran de décider s'il
 * l'affiche, et il ne l'affiche pas sur une défaite : on ne classe pas une
 * manche perdue, on la rejoue.
 */
export function bilanDeFin(etat: EtatPartie, carte: MapDef, camp: CampId): Bilan {
  const engagees = depart(carte, camp) + produites(etat, camp);
  const survivantes = enJeu(etat, camp);
  // Les autres camps comptent ensemble : à trois ou quatre camps, ce que le
  // joueur affronte est tout ce qui n'est pas à lui.
  const autres = etat.camps.map((c) => c.id).filter((id) => id !== camp);
  let adverseEngagees = 0;
  let adverseEnJeu = 0;
  for (const id of autres) {
    adverseEngagees += depart(carte, id) + produites(etat, id);
    adverseEnJeu += enJeu(etat, id);
  }
  const echeance = etat.reglages.limiteJournees;
  const budget = echeance ?? JOURNEES_REFERENCE;
  // La première journée ne coûte rien : gagner le jour même est un sans-faute.
  const consommees = Math.max(0, etat.journee - 1);
  const rythme = part(budget - consommees, budget);
  const puissance = part(adverseEngagees - adverseEnJeu, adverseEngagees);
  const tenue = part(survivantes, engagees);
  const note = Math.round((rythme + puissance + tenue) / 3);
  return {
    journees: Math.max(1, etat.journee),
    limite: echeance,
    engagees,
    survivantes,
    perdues: Math.max(0, engagees - survivantes),
    neutralisees: Math.max(0, adverseEngagees - adverseEnJeu),
    batiments: Object.values(etat.proprietaires).filter((c) => c === camp).length,
    rythme,
    puissance,
    tenue,
    note,
    rang: PALIERS.find((p) => note >= p.note)?.rang ?? 'C',
  };
}
