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
/** Le scénario derrière une source, de banc, de commandant ou de choix. */
export function scenarioDeSource(source: string): string {
  if (estSourceBanc(source)) return source.slice(0, -SUFFIXE_BANC.length);
  if (estSourceCommandant(source)) return source.slice(0, -SUFFIXE_COMMANDANT.length);
  return source;
}

// ---------------------------------------------------------------------------
// Le choix du commandant au briefing (`Scenario.choixCommandant`)
// ---------------------------------------------------------------------------
//
// Le banc prêté est un choix **nommé** : trois options écrites par un auteur,
// chacune avec sa conséquence. Le choix du commandant est le même geste ouvert
// à tout le roster débloqué — mêmes propriétés (choisi avant de jouer,
// rechoisi à chaque nouvelle partie, figé dans la graine, rejouable), autre
// source de vérité pour la liste. Ce qui suit est la part **pure** de ce
// mécanisme, celle dont la progression et les conséquences ont besoin sans
// charger le roster ; le reste vit dans `commandants-jouables.ts`.

/** Le suffixe de source d'un choix de commandant : `pacte_du_col:commandant`. */
export const SUFFIXE_COMMANDANT = ':commandant';
export function cleSourceCommandant(code: string): string {
  return `${code}${SUFFIXE_COMMANDANT}`;
}
export function estSourceCommandant(source: string): boolean {
  return source.endsWith(SUFFIXE_COMMANDANT);
}

/**
 * La marque du commandant choisi dans la graine, en dernier segment.
 *
 * Les décisions sont encodées **par position** — un chiffre par source, jamais
 * d'insertion au milieu ; un roster qui s'allonge ou se réordonne casserait ce
 * comptage, et une graine enregistrée relirait un autre général que celui qui a
 * été joué. Le commandant est donc écrit **par son nom**, en clair, à la fin.
 * Le `cmd_` est retiré parce que la graine tient en 64 caractères
 * (`validerSauvegarde`) et qu'il n'apporte rien : un test le vérifie sur tous
 * les couples scénario × roster.
 */
export const MARQUE_COMMANDANT_GRAINE = '@';
const PREFIXE_COMMANDANT = 'cmd_';

/** Le commandant écrit dans une graine, ou `null` si elle n'en porte pas. */
export function commandantDeGraine(graine: string): string | null {
  const dernier = graine.slice(graine.lastIndexOf(':') + 1);
  if (!graine.includes(':') || !dernier.startsWith(MARQUE_COMMANDANT_GRAINE)) return null;
  const nom = dernier.slice(MARQUE_COMMANDANT_GRAINE.length);
  return nom === '' ? null : `${PREFIXE_COMMANDANT}${nom}`;
}

/** La graine sans sa marque de commandant : celle que lisent les décisions. */
export function graineSansCommandant(graine: string): string {
  return commandantDeGraine(graine) === null ? graine : graine.slice(0, graine.lastIndexOf(':'));
}

/**
 * Ajoute (ou remplace) la marque de commandant d'une graine. `null` la retire —
 * jouer le commandant du scénario, c'est ne rien inscrire, de sorte qu'une
 * partie sans choix garde exactement la graine qu'elle avait avant.
 */
export function graineAvecCommandant(graine: string, cle: string | null): string {
  const base = graineSansCommandant(graine);
  if (cle === null) return base;
  const nom = cle.startsWith(PREFIXE_COMMANDANT) ? cle.slice(PREFIXE_COMMANDANT.length) : cle;
  return `${base}:${MARQUE_COMMANDANT_GRAINE}${nom}`;
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
  // Le témoin qui distingue un banc prêté d'un match d'incarnation : même forme,
  // pas les mêmes droits sur les flags. L'épreuve garde les siens — on la gagne
  // pour de bon, sous ses couleurs ou sous celles d'un autre (`01-bible.md`
  // §4.6). Sans lui, `validerScenario` refusait Le pacte du col sous Tomas,
  // parce qu'il écrit `monde.tournoi.pacte_du_col`.
  scenario.bancPrete = true;
  delete scenario.bancs;
}
