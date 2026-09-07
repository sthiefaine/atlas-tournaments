/**
 * Le verdict de la routine contrôle, **recalculé côté serveur**.
 *
 * `05-routines.md` §1.3 : « Il recalcule tout ce qui est calculable. La routine
 * contrôle n'envoie pas des statistiques de simulation, elle demande au serveur
 * de simuler et interprète ce que le serveur lui renvoie. » Ce fichier est la
 * moitié « interprète » : il prend une cible, le résultat d'une campagne et les
 * vérifications structurelles, applique les seuils de §4.3, et rend un
 * `ReviewVerdict` complet dont chaque motif porte la mesure qui l'a déclenché.
 *
 * Trois règles qui viennent du catalogue de motifs et qu'on ne discute pas :
 *
 * - les **codes** sont ceux de l'énumération fermée `MotifRejet` — jamais un
 *   code inventé, jamais un code renommé ;
 * - `mesure` n'accepte que des **nombres** : un taux s'écrit `0.61` ;
 * - la **gravité** n'est pas un champ du verdict : elle appartient au catalogue,
 *   ici, et ne sert qu'à trier les motifs quand il y en a plus que le schéma n'en
 *   accepte (six).
 *
 * Une lecture explicite, parce qu'elle n'allait pas de soi. **« Partie non
 * terminée » veut dire « partie sans résultat »** : une partie qui va au bout des
 * journées et se décide **aux points** est un match — c'est la règle de décision
 * du moteur, et Atlas est un sport, pas une guerre d'usure. Le nombre de parties
 * allées jusqu'à la limite reste publié dans `hors_schema.parties_a_la_limite`,
 * et c'est la **durée médiane** qui sanctionne une carte qui n'aboutit jamais.
 */

import { fnv1a } from '../../engine/index';
import type { MotifVerification } from '../../mapgen/index';
import type {
  Cle, CibleReview, DateIso, MotifRejet, ReviewVerdict, StatsSimulation,
} from '../../schemas/index';
import type { ConditionClimat, ResultatSimulation } from '../simulation';

/** Gravité d'un motif (`05-routines.md` §4.3). Elle vit ici, jamais dans le verdict. */
export type Gravite = 'bloquant' | 'majeur' | 'mineur';

/** Le catalogue des gravités, code par code. */
export const GRAVITE_MOTIF: Record<MotifRejet, Gravite> = {
  schema_invalide: 'bloquant',
  reference_inconnue: 'bloquant',
  champ_inconnu: 'bloquant',
  flag_inconnu: 'bloquant',
  qg_inaccessible: 'bloquant',
  zone_morte: 'mineur',
  usine_trop_loin: 'majeur',
  depart_bloque: 'bloquant',
  // Un port sans mer produit une flotte qui ne sort jamais ; deux ports que la
  // mer ne relie pas font une mer où l'on ne se rencontre pas — jouable, mais
  // la mer n'y sert à rien.
  port_sans_mer: 'bloquant',
  ports_isoles: 'majeur',
  grille_non_reproductible: 'bloquant',
  qg_menace_trop_tot: 'bloquant',
  economie_insuffisante: 'majeur',
  avantage_premier_joueur: 'bloquant',
  desequilibre_fonds: 'bloquant',
  desequilibre_villes: 'majeur',
  partie_trop_courte: 'majeur',
  partie_trop_longue: 'majeur',
  trop_de_parties_non_terminees: 'majeur',
  pouvoir_trop_fort: 'majeur',
  commandant_sans_faiblesse: 'majeur',
  mecanique_inutilisee: 'mineur',
  injouable_sous_meteo: 'bloquant',
  nuit_bloquante: 'majeur',
  ton_hors_bible: 'majeur',
  sujet_interdit: 'bloquant',
  personne_reelle: 'bloquant',
  cliche_deplace: 'bloquant',
  contredit_canon: 'bloquant',
  redite_commandant: 'mineur',
  choix_sans_consequence: 'mineur',
  dialogue_trop_long: 'mineur',
  categorie_hors_liste_blanche: 'bloquant',
  source_hors_liste_blanche: 'majeur',
  evenement_perime: 'mineur',
  unite_dominante: 'bloquant',
  unite_inutile: 'majeur',
  silhouette_invalide: 'bloquant',
  simulation_plantee: 'bloquant',
  moteur_non_deterministe: 'bloquant',
  objet_incomprehensible: 'bloquant',
};

/** Les seuils de `05-routines.md` §4.3 et `02-architecture.md` §8. */
export const SEUILS_CONTROLE = {
  /** Taux de victoire du camp qui commence : hors de ces bornes, c'est un rejet. */
  avantagePremierJoueur: { min: 0.4, max: 0.6 },
  /** Part de parties sans résultat au-delà de laquelle la carte est rejetée. */
  nonTermineesMax: 0.2,
  /** Idem, sous **une seule** condition de climat : `injouable_sous_meteo`. */
  nonTermineesSousMeteoMax: 0.25,
  /** Idem, sous une condition de phase `nuit` : `nuit_bloquante`. */
  nonTermineesDeNuitMax: 0.2,
  /** Part de parties où la mécanique régionale doit s'être déclenchée. */
  mecaniqueMin: 0.6,
  /** Bornes de durée par défaut, quand l'intention n'en donne pas. */
  duree: { min: 8, max: 45 },
  /** Part de cases de terre jamais visitées au-delà de laquelle c'est une zone morte. */
  casesJamaisVisiteesMax: 0.25,
  /** Une candidate qui fait gagner plus que cela à son camp est dominante. */
  uniteDominanteVictoire: 0.6,
  /** Une candidate dont l'efficacité par coût dépasse cela est dominante. */
  uniteDominanteEfficacite: 1.3,
  /** Sous cette fréquence de production, la candidate ne sert à rien. */
  uniteInutileFrequence: 0.1,
  /** Sous cet écart de taux de victoire, la candidate ne change rien. */
  uniteInutileEcart: 0.02,
} as const;

/** Un motif structuré, tel que le schéma l'attend. */
export type Motif = ReviewVerdict['motifs'][number];

/** Ce qu'on contrôle : l'objet visé et ce que son intention promettait. */
export interface CibleControle {
  type: CibleReview;
  cle: Cle;
  version?: number;
  /** `duree_visee_journees` de l'intention de niveau, si la mission en donne une. */
  dureeVisee?: [number, number];
  /** Cohérence de lore, entre 0 et 1 ; 1 quand la cible n'a pas de lore à relire. */
  coherenceLore?: number;
  /** Identifiant du run, recopié dans le verdict. */
  routineRunId?: string;
  /** Date du verdict. Absente, c'est aujourd'hui. */
  creeLe?: DateIso;
  /** Clé du verdict. Absente, elle est dérivée de la cible et des motifs. */
  cleVerdict?: Cle;
  /** Motifs de lore déjà établis ailleurs (ton, flags, canon) : ils s'ajoutent. */
  motifsLore?: readonly Motif[];
}

/** Nombre maximal de motifs qu'un verdict porte (`03-schemas.md` §12). */
export const MOTIFS_MAX = 6;

/** Ordre de tri des gravités : le plus grave d'abord. */
const RANG: Record<Gravite, number> = { bloquant: 0, majeur: 1, mineur: 2 };

/** Une phrase de suggestion par famille de motif. */
const SUGGESTIONS: Partial<Record<MotifRejet, string>> = {
  avantage_premier_joueur:
    'Rééquilibrer l’accès aux propriétés proches du camp qui commence, ou reculer son QG de deux cases.',
  trop_de_parties_non_terminees:
    'Rapprocher les QG ou densifier l’économie : sans contact décisif, la manche ne se conclut pas.',
  partie_trop_longue:
    'Raccourcir la distance QG↔QG ou réduire le nombre de villes : la manche traîne.',
  partie_trop_courte:
    'Éloigner les QG ou retirer une usine avancée : la manche se termine avant d’avoir commencé.',
  mecanique_inutilisee:
    'Placer la mécanique régionale sur un chemin obligé, sinon l’IA la contourne.',
  zone_morte:
    'Retirer ou relier les zones que personne ne visite : elles agrandissent la carte sans la nourrir.',
  injouable_sous_meteo:
    'Une carte doit tenir sous toutes les conditions : revoir les coûts de terrain du chemin principal.',
  nuit_bloquante:
    'De nuit la vision tombe : ajouter des villes éclairées sur l’axe principal ou raccourcir l’approche.',
  unite_dominante:
    'Monter le coût de la candidate ou retirer une ligne de sa table de dégâts.',
  unite_inutile:
    'Baisser son coût ou lui donner un rôle qu’aucune unité canon ne remplit déjà.',
  qg_inaccessible: 'Ouvrir un chemin terrestre entre les QG : c’est une condition de jouabilité.',
  port_sans_mer: 'Poser le port sur une côte : un navire produit à sec ne sort jamais.',
  ports_isoles: 'Relier les mers des deux camps, ou retirer un port : une flotte doit pouvoir rencontrer l’autre.',
  grille_non_reproductible:
    'La grille stockée ne correspond plus à sa graine : régénérer, ou incrémenter mapgenVersion.',
};

/** Arrondit un taux à quatre décimales : `mesure` n'accepte que des nombres. */
function taux(n: number, sur: number): number {
  return Number((n / Math.max(1, sur)).toFixed(4));
}

/** Le libellé d'une condition, pour un `detail` lisible. */
function nommer(c: ConditionClimat): string {
  return `${c.saison} / ${c.meteo} / ${c.phase}`;
}

/**
 * Les motifs que la **simulation** justifie, dans l'ordre du catalogue. Les
 * vérifications structurelles sont ajoutées à part : elles ne dépendent pas
 * d'une campagne, et elles priment.
 */
export function motifsDeSimulation(
  r: ResultatSimulation, dureeVisee?: readonly [number, number],
): Motif[] {
  const motifs: Motif[] = [];
  const s = r.stats;
  const n = Math.max(1, s.parties);

  // 1. L'avantage du camp qui commence. Le camp 0 ouvre toujours la manche ; les
  //    profils d'IA tournent d'une partie à l'autre, donc ce taux ne mesure que
  //    la place, pas la personnalité.
  const premier = taux(s.victoiresCamp[0] ?? 0, n);
  if (premier < SEUILS_CONTROLE.avantagePremierJoueur.min
    || premier > SEUILS_CONTROLE.avantagePremierJoueur.max) {
    motifs.push({
      code: 'avantage_premier_joueur',
      detail: `Le camp qui commence gagne ${(premier * 100).toFixed(0)} % sur ${n} parties, toutes conditions confondues.`,
      mesure: { victoires_camp_1: premier, parties: n },
    });
  }

  // 2. Les parties sans résultat.
  const sansResultat = taux(s.nonTerminees, n);
  if (sansResultat > SEUILS_CONTROLE.nonTermineesMax) {
    motifs.push({
      code: 'trop_de_parties_non_terminees',
      detail: `${(sansResultat * 100).toFixed(0)} % des parties se terminent sans vainqueur.`,
      mesure: { non_terminees: sansResultat, parties: n },
    });
  }

  // 3. La durée médiane, contre l'intention de niveau ou contre les bornes de CI.
  const bornes = dureeVisee ?? [SEUILS_CONTROLE.duree.min, SEUILS_CONTROLE.duree.max] as const;
  const min = Math.min(bornes[0], bornes[1]);
  const max = Math.max(bornes[0], bornes[1]);
  if (s.journeesMediane < min) {
    motifs.push({
      code: 'partie_trop_courte',
      detail: `Durée médiane de ${s.journeesMediane} journées, sous le plancher de ${min}.`,
      mesure: { journees_mediane: s.journeesMediane, plancher: min },
    });
  } else if (s.journeesMediane > max) {
    motifs.push({
      code: 'partie_trop_longue',
      detail: `Durée médiane de ${s.journeesMediane} journées, au-dessus du plafond de ${max}.`,
      mesure: { journees_mediane: s.journeesMediane, plafond: max },
    });
  }

  // 4. La mécanique régionale déclarée mais jamais déclenchée.
  if (s.mecaniqueDeclenchee !== null) {
    const part = taux(s.mecaniqueDeclenchee, n);
    if (part < SEUILS_CONTROLE.mecaniqueMin) {
      motifs.push({
        code: 'mecanique_inutilisee',
        detail: `La mécanique régionale ne s’est déclenchée que dans ${(part * 100).toFixed(0)} % des parties.`,
        mesure: { mecanique_declenchee: part, parties: n },
      });
    }
  }

  // 5. Les cases que personne ne visite jamais.
  const partMorte = r.horsSchema['part_cases_jamais_visitees'] ?? 0;
  if (partMorte > SEUILS_CONTROLE.casesJamaisVisiteesMax) {
    motifs.push({
      code: 'zone_morte',
      detail: `${(partMorte * 100).toFixed(0)} % des cases de terre ne sont jamais visitées.`,
      mesure: { part_cases_jamais_visitees: partMorte, cases_jamais_visitees: s.casesJamaisVisitees },
    });
  }

  // 6. Le climat : une carte doit tenir sous toutes les conditions demandées.
  //    On retient la pire — un motif ne se répète jamais dans un verdict.
  let pireMeteo: { c: ConditionClimat; part: number } | null = null;
  let pireNuit: { c: ConditionClimat; part: number } | null = null;
  for (const ligne of r.parCondition) {
    const part = ligne.horsSchema['non_terminees'] ?? 0;
    if (part > SEUILS_CONTROLE.nonTermineesSousMeteoMax
      && (pireMeteo === null || part > pireMeteo.part)) {
      pireMeteo = { c: ligne.condition, part };
    }
    if (ligne.condition.phase === 'nuit' && part > SEUILS_CONTROLE.nonTermineesDeNuitMax
      && (pireNuit === null || part > pireNuit.part)) {
      pireNuit = { c: ligne.condition, part };
    }
  }
  if (pireMeteo) {
    const sansContact = r.parCondition.find((l) => l.condition === pireMeteo?.c)
      ?.horsSchema['journees_sans_contact'] ?? 0;
    motifs.push({
      code: 'injouable_sous_meteo',
      detail: `Sous ${nommer(pireMeteo.c)}, ${(pireMeteo.part * 100).toFixed(0)} % des parties n’aboutissent pas.`,
      mesure: { non_terminees: pireMeteo.part, journees_sans_contact: sansContact },
    });
  }
  if (pireNuit && (pireMeteo === null || pireNuit.c !== pireMeteo.c)) {
    motifs.push({
      code: 'nuit_bloquante',
      detail: `Sous ${nommer(pireNuit.c)}, la vision réduite laisse ${(pireNuit.part * 100).toFixed(0)} % des parties sans issue.`,
      mesure: { non_terminees: pireNuit.part },
    });
  }

  return motifs;
}

/** Les motifs qu'une campagne de catalogue justifie (`05-routines.md` §9). */
export function motifsDeCatalogue(r: ResultatSimulation): Motif[] {
  const motifs: Motif[] = [];
  const h = r.horsSchema;
  const victoire = h['taux_victoire_camp_qui_la_produit'] ?? 0;
  const efficacite = h['efficacite_par_cout'] ?? 0;
  const frequence = h['frequence_production_ia'] ?? 0;
  const ecart = h['ecart_taux_victoire'] ?? 0;

  if (victoire > SEUILS_CONTROLE.uniteDominanteVictoire
    || efficacite > SEUILS_CONTROLE.uniteDominanteEfficacite) {
    motifs.push({
      code: 'unite_dominante',
      detail: `Le camp qui la produit gagne ${(victoire * 100).toFixed(0)} % des parties, pour une efficacité par coût de ${efficacite.toFixed(2)}.`,
      mesure: {
        taux_victoire_camp_qui_la_produit: victoire,
        efficacite_par_cout: efficacite,
        frequence_production_ia: frequence,
      },
    });
  } else if (frequence < SEUILS_CONTROLE.uniteInutileFrequence
    || ecart < SEUILS_CONTROLE.uniteInutileEcart) {
    motifs.push({
      code: 'unite_inutile',
      detail: `L’IA la produit dans ${(frequence * 100).toFixed(0)} % des parties et l’écart de taux de victoire avec et sans est de ${ecart.toFixed(2)}.`,
      mesure: {
        frequence_production_ia: frequence,
        ecart_taux_victoire: ecart,
        efficacite_par_cout: efficacite,
      },
    });
  }
  return motifs;
}

/** Trie par gravité, dédoublonne par code, et coupe à six : le schéma n'en veut pas plus. */
export function ordonnerMotifs(motifs: readonly Motif[]): Motif[] {
  const vus = new Set<MotifRejet>();
  const uniques: Motif[] = [];
  for (const m of motifs) {
    if (vus.has(m.code)) continue;
    vus.add(m.code);
    uniques.push(m);
  }
  return uniques
    .map((m, i) => ({ m, i }))
    .sort((a, b) => RANG[GRAVITE_MOTIF[a.m.code]] - RANG[GRAVITE_MOTIF[b.m.code]] || a.i - b.i)
    .slice(0, MOTIFS_MAX)
    .map((e) => e.m);
}

/** Le bloc `stats` du verdict : l'agrégat, ou la paire `{ avec, sans }` d'une unité. */
function statsDuVerdict(
  cible: CibleControle, r: ResultatSimulation | null,
): StatsSimulation | { avec: StatsSimulation; sans: StatsSimulation } | null {
  if (r === null) return null;
  if (cible.type === 'unite') {
    if (!r.avec || !r.sans) return null;
    return { avec: r.avec.stats, sans: r.sans.stats };
  }
  return r.stats;
}

/**
 * Rend le verdict. Le serveur recalcule : il ne recopie aucune statistique que la
 * routine lui aurait envoyée, et il n'accepte aucun motif qu'elle aurait choisi.
 *
 * - `cible` — l'objet visé et ce que son intention promettait ;
 * - `resultat` — la campagne rendue par `simuler`, ou `null` si elle a échoué ;
 * - `verifications` — les motifs structurels de `verifierCarteControle`.
 */
export function rendreVerdict(
  cible: CibleControle,
  resultat: ResultatSimulation | null,
  verifications: readonly MotifVerification[] = [],
): ReviewVerdict {
  const exigeStats = cible.type === 'carte' || cible.type === 'scenario' || cible.type === 'unite';
  const bruts: Motif[] = [];

  // Le structurel prime : il ne dépend d'aucune simulation et il est bloquant.
  for (const v of verifications) bruts.push({ code: v.code, detail: v.detail, mesure: v.mesure });
  for (const m of cible.motifsLore ?? []) bruts.push(m);

  if (resultat === null) {
    if (exigeStats) {
      bruts.push({
        code: 'simulation_plantee',
        detail: 'la campagne de simulation n’a pas abouti : aucun chiffre à interpréter',
        mesure: { parties: 0 },
      });
    }
  } else if (cible.type === 'unite') {
    bruts.push(...motifsDeCatalogue(resultat));
  } else {
    bruts.push(...motifsDeSimulation(resultat, cible.dureeVisee));
  }

  const motifs = ordonnerMotifs(bruts);
  const verdict = motifs.length === 0 ? 'valide' : 'rejete';
  const suggestions: string[] = [];
  for (const m of motifs) {
    const phrase = SUGGESTIONS[m.code];
    if (phrase && !suggestions.includes(phrase) && suggestions.length < 3) suggestions.push(phrase);
  }

  const resume = verdict === 'valide'
    ? `La cible tient les seuils sous ${resultat?.parCondition.length ?? 0} condition(s) de climat.`
    : `${motifs.length} motif(s), dont ${motifs.filter((m) => GRAVITE_MOTIF[m.code] === 'bloquant').length} bloquant(s).`;

  const empreinte = fnv1a(`${cible.type}:${cible.cle}:${cible.version ?? 1}:${motifs.map((m) => m.code).join(',')}`);
  return {
    cle: cible.cleVerdict ?? `review_${empreinte.toString(36)}`,
    cibleType: cible.type,
    cibleCle: cible.cle,
    cibleVersion: cible.version ?? 1,
    verdict,
    motifs,
    detail: resume.slice(0, 500),
    stats: statsDuVerdict(cible, resultat),
    coherenceLore: cible.coherenceLore ?? 1,
    suggestions,
    routineRunId: cible.routineRunId ?? 'run_serveur',
    creeLe: cible.creeLe ?? (new Date().toISOString().slice(0, 10) as DateIso),
  };
}
