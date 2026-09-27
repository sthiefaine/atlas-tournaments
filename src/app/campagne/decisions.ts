/**
 * Les **décisions** telles que la campagne les écrit au journal, et telles qu'une
 * `Condition` de type `decision` les lit (`13-campagne.md` §8.2, tranché le
 * 26 septembre 2026).
 *
 * Deux conventions, écrites ici une fois, et c'est tout ce module :
 *
 * 1. **Le nom d'une décision.** La progression locale range une décision sous sa
 *    **source** — le code du scénario pour un choix de fin de match
 *    (`opus1_fr_04`), `<scénario>:banc` pour un banc prêté, `<scénario>:commandant`
 *    pour le vestiaire. Le journal d'un profil la range sous un `choixCle`, qui est
 *    une clé : `opus1_fr_04_decision`, exactement le nom que la fiche de conception
 *    lui donne (`opus1-nations.json`, `choixConsequence.cle`), `pacte_du_col_banc`,
 *    `aube_routes_3v1_commandant`. Une condition nomme donc une décision comme
 *    l'auteur l'a nommée, sans savoir où la page l'a rangée.
 *
 * 2. **L'option d'une décision nationale.** Les fiches disent `a` et `b` ; le code
 *    enregistre `partager_releves` et `garder_reserve`. La lettre n'est qu'une
 *    **position** — c'est aussi le chiffre de la graine, qui fige l'ordre des
 *    options pour toujours —, l'identifiant enregistré est la clé. Les
 *    quarante-huit décisions nationales de l'opus suivent quatre familles, une
 *    par numéro d'épisode (04, 08, 10, 12), aux mêmes deux options pour les
 *    douze nations ; `OPTIONS_DECISIONS_NATIONALES` fixe leurs identifiants, et un
 *    test vérifie que la France, seule codée aujourd'hui, les enregistre ainsi, et
 *    que toute nation codée demain fera de même.
 *
 * Ce module est pur : aucun stockage, aucun contenu chargé.
 */
import { SUFFIXE_BANC, SUFFIXE_COMMANDANT, estSourceBanc, estSourceCommandant, scenarioDeSource } from './bancs';

/** Le suffixe du nom d'une décision de fin de match : `opus1_fr_04` → `opus1_fr_04_decision`. */
export const SUFFIXE_DECISION = '_decision';

/**
 * Le nom d'une décision au journal, depuis sa source dans la progression locale.
 *
 * Un choix de fin de match prend le suffixe `_decision` ; un banc et un choix de
 * commandant gardent leur nature dans le nom (`_banc`, `_commandant`), le `:` des
 * sources n'étant pas permis dans une clé.
 */
export function choixDeSource(source: string): string {
  const scenario = scenarioDeSource(source);
  if (estSourceBanc(source)) return `${scenario}_${SUFFIXE_BANC.slice(1)}`;
  if (estSourceCommandant(source)) return `${scenario}_${SUFFIXE_COMMANDANT.slice(1)}`;
  return `${scenario}${SUFFIXE_DECISION}`;
}

/**
 * Les identifiants enregistrés des quatre familles de décisions nationales, dans
 * l'ordre des lettres des fiches : l'option `a` est la première, `b` la seconde.
 *
 * - **04** — partager les relevés, ou garder la réserve financière ;
 * - **08** — garantir la livraison au signataire, ou refuser de garantir son crédit ;
 * - **10** — accepter un retour sous audit, ou exiger d'abord la fin du mandat privé ;
 * - **12** — verser une réserve à la coalition, ou financer la préparation locale.
 *
 * Ce sont les clés de `CHOIX_FRANCE` (`consequences.ts`), qui les enregistre depuis
 * le 14 et le 23 septembre 2026 ; une nation codée après la France les reprend,
 * faute de quoi une condition de hors-série écrite contre la fiche ne s'ouvrirait
 * jamais — en silence.
 */
export const OPTIONS_DECISIONS_NATIONALES = {
  '04': ['partager_releves', 'garder_reserve'],
  '08': ['garantir_livraison', 'refuser_garantie'],
  '10': ['retour_sous_audit', 'fin_du_mandat'],
  '12': ['verser_reserve', 'preparation_locale'],
} as const satisfies Record<string, readonly [string, string]>;

/** Les lettres d'options d'une fiche de conception, dans l'ordre. */
export const LETTRES_OPTIONS = ['a', 'b'] as const;
/** Une lettre d'option de fiche. */
export type LettreOption = typeof LETTRES_OPTIONS[number];

/** Le nom d'une décision nationale : `opus1_<nation>_<04|08|10|12>_decision`. */
const FORME_DECISION_NATIONALE = /^opus1_[a-z]{2}_(04|08|10|12)_decision$/;

/**
 * L'identifiant enregistré de l'option `lettre` d'une décision nationale, ou
 * `null` si la clé ne nomme pas une décision nationale de l'opus.
 */
export function optionNationale(decision: string, lettre: LettreOption): string | null {
  const famille = FORME_DECISION_NATIONALE.exec(decision)?.[1] as keyof typeof OPTIONS_DECISIONS_NATIONALES | undefined;
  if (famille === undefined) return null;
  return OPTIONS_DECISIONS_NATIONALES[famille][LETTRES_OPTIONS.indexOf(lettre)] ?? null;
}
