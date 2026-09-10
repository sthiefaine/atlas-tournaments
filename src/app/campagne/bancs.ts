/**
 * Les **bancs prêtés** : choisir son héros au briefing (`01-bible.md` §4.6,
 * `13-campagne.md` §3.4 bis, « Le banc prêté au briefing »).
 *
 * Un scénario qui porte `bancs` propose, avant le montage, de jouer l'épreuve sous
 * les couleurs d'une autre délégation. Le choix est une **décision** comme celles
 * de fin de match (`consequences.ts`) : enregistrée dans la progression sous la
 * source `<scenario>:banc`, figée dans la graine de la partie, rejouable à
 * l'identique, et lue par l'épreuve suivante pour sa mini-branche.
 *
 * Ce module est pur : aucun stockage, aucun `t()`. Il ne connaît que la table des
 * bancs et la règle de l'échange.
 */
import type { BancPrete, Dialogue, Scenario } from '../../schemas/index';

/** Le suffixe qui distingue la source d'une décision de banc de celle d'un choix. */
export const SUFFIXE_BANC = ':banc';

/** L'option « ses propres couleurs » : le commandant du scénario, toujours proposée en premier. */
export const PROPRES_COULEURS = 'propres_couleurs';

/** Clés i18n communes à tous les bancs. */
export const CLES_I18N_BANC = {
  /** Le libellé de l'option par défaut, un complément comme les autres. */
  propresCouleurs: 'banc.propres_couleurs',
  /** L'effet de l'option par défaut : aucun. */
  sansSuite: 'banc.sans_suite',
  /** « Vous avez joué {banc} » — le carnet et les rappels. */
  journal: 'banc.journal',
} as const;

/**
 * Les bancs du canon, avec la conséquence annoncée de chacun (une clé i18n).
 *
 * La table recopie `bancs` des scénarios, et c'est voulu : `optionsDecision` doit
 * répondre sans lire un scénario — la progression se normalise hors de toute
 * page —, et la conséquence est une propriété de la branche, pas de l'épreuve
 * d'origine. Un test lit les scénarios et échoue si la copie dérive.
 */
export const BANCS_PRETES: Readonly<Record<string, readonly (BancPrete & { effet: string })[]>> = {
  pacte_du_col: [
    { commandantCle: 'cmd_tomas_reiner', paysCode: 'lu', libelle: 'banc.pacte_du_col.cmd_tomas_reiner', effet: 'banc.pacte_du_col.cmd_tomas_reiner.effet' },
  ],
  aube_batteries_2v1: [
    { commandantCle: 'cmd_tomas_reiner', paysCode: 'lu', libelle: 'banc.aube_batteries_2v1.cmd_tomas_reiner', effet: 'banc.aube_batteries_2v1.cmd_tomas_reiner.effet' },
  ],
  aube_nuit_2v2: [
    { commandantCle: 'cmd_solveig_tamm', paysCode: 'atl', libelle: 'banc.aube_nuit_2v2.cmd_solveig_tamm', effet: 'banc.aube_nuit_2v2.cmd_solveig_tamm.effet' },
    { commandantCle: 'cmd_wren_osoko', paysCode: 'atl', libelle: 'banc.aube_nuit_2v2.cmd_wren_osoko', effet: 'banc.aube_nuit_2v2.cmd_wren_osoko.effet' },
  ],
};

/** La source de décision d'un scénario : `pacte_du_col` → `pacte_du_col:banc`. */
export function cleSourceBanc(code: string): string {
  return `${code}${SUFFIXE_BANC}`;
}
export function estSourceBanc(source: string): boolean {
  return source.endsWith(SUFFIXE_BANC);
}
/** Le scénario derrière une source, de banc ou de choix. */
export function scenarioDeSource(source: string): string {
  return estSourceBanc(source) ? source.slice(0, -SUFFIXE_BANC.length) : source;
}

/**
 * Les options de banc d'un scénario, dans l'ordre des chiffres de la graine :
 * ses propres couleurs d'abord, puis chaque banc de la table. Vide pour un
 * scénario sans banc. `titre` et `effet` sont des **clés i18n**, à traduire.
 */
export function optionsBanc(code: string): readonly { cle: string; titre: string; effet: string }[] {
  const bancs = BANCS_PRETES[code];
  if (!bancs) return [];
  return [
    { cle: PROPRES_COULEURS, titre: CLES_I18N_BANC.propresCouleurs, effet: CLES_I18N_BANC.sansSuite },
    ...bancs.map((b) => ({ cle: b.commandantCle, titre: b.libelle, effet: b.effet })),
  ];
}

/** Le banc que désigne un choix, ou `null` pour ses propres couleurs et pour l'inconnu. */
export function bancChoisi(code: string, choix: string | undefined): (BancPrete & { effet: string }) | null {
  return (BANCS_PRETES[code] ?? []).find((b) => b.commandantCle === choix) ?? null;
}

/**
 * Applique un banc à un scénario, **en place** — l'appelant passe une copie.
 *
 * Le général prêté prend le camp du joueur, et le scénario devient une
 * `Incarnation` de sa délégation : c'est exactement ce que `sceneDepuis` lit, et
 * `commandantsIncarnes` n'a plus rien à faire puisque le général est déjà au
 * camp 0. Si ce général jouait ailleurs sur le terrain, il y laisse le
 * commandant d'origine du joueur : un banc prêté est un **échange
 * d'entraîneurs** (`01-bible.md` §4.6), jamais deux fois le même général sur la
 * carte. S'il vient de l'extérieur, le commandant d'origine quitte le terrain,
 * et **ses répliques passent au général prêté** : ce sont des consignes de
 * banc, dites au joueur par qui tient son banc — sans quoi elles nommeraient un
 * locuteur que la distribution n'a plus. Les bancs proposés s'effacent du
 * scénario effectif : le choix est fait.
 */
export function appliquerBanc(scenario: Scenario, banc: BancPrete): void {
  const joueur = scenario.commandants.find((c) => c.camp === 0);
  if (!joueur) return;
  const origine = joueur.commandantCle;
  const porteur = scenario.commandants.find((c) => c.camp !== 0 && c.commandantCle === banc.commandantCle);
  if (porteur) porteur.commandantCle = origine;
  else {
    const reattribuer = (repliques: Dialogue[]): Dialogue[] => repliques.map((r) => (r.locuteur === origine ? { ...r, locuteur: banc.commandantCle } : r));
    scenario.dialogueOuverture = reattribuer(scenario.dialogueOuverture);
    scenario.dialogueVictoire = reattribuer(scenario.dialogueVictoire);
    scenario.dialogueDefaite = reattribuer(scenario.dialogueDefaite);
    if (scenario.scenesDialogue) scenario.scenesDialogue = scenario.scenesDialogue.map((s) => ({ ...s, repliques: reattribuer(s.repliques) }));
  }
  joueur.commandantCle = banc.commandantCle;
  scenario.incarnation = { paysCode: banc.paysCode, commandantCle: banc.commandantCle };
  delete scenario.bancs;
}
