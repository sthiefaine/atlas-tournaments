/**
 * **Choisir son commandant au briefing** (`Scenario.choixCommandant`), la
 * généralisation du banc prêté à tout le roster débloqué.
 *
 * Le banc prêté (`bancs.ts`) est un choix **nommé** : deux ou trois options
 * écrites par un auteur, chacune avec sa conséquence annoncée et sa mini-branche
 * dans l'épreuve suivante. Le choix du commandant est le même geste, avec une
 * autre source de vérité pour la liste — ce que le joueur a débloqué
 * (`content/commandants-jouables.json`, `progression.ts`) — et **sans branche** :
 * prendre Ren Mizuno plutôt qu'Ariane change la partie, pas la suite du fil.
 * C'est pour cela que les deux champs sont exclusifs au schéma.
 *
 * Ce qui est **réutilisé tel quel**, et c'est le fond de l'affaire :
 *
 * - `appliquerBanc`, donc l'échange d'entraîneurs — si le commandant choisi
 *   joue déjà sur le terrain, les deux échangent leurs bancs ; sinon les
 *   consignes du commandant d'origine passent au général choisi, qui prend sa
 *   place au camp 0 ;
 * - `Incarnation`, qui n'est rien d'autre que « ce camp joue ces couleurs » —
 *   aucune ligne d'`etat.ts` n'est dupliquée, `sceneDepuis` lit déjà tout ;
 * - la graine, où le choix est **figé** pour que la reprise d'une partie rejoue
 *   exactement la même, et le journal des décisions pour l'enregistrer.
 *
 * Ce qui n'est **pas** réutilisé : la table `BANCS_PRETES` et ses clés i18n de
 * conséquence. Un choix ouvert n'a pas de conséquence à annoncer.
 */
import type { CodePays, Scenario } from '../../schemas/index';
import { chargerCommandantJeu, revisionCommandants, type CommandantJeu } from '../../content/commandants-jeu';
import { chargerCommandantsJouables, type RosterJouables } from '../../content/commandants-jouables';
import { lireProfilCommandant } from '../../content/profils-commandants';
import { appliquerBanc, commandantDeGraine } from './bancs';
import { vestiaire, type EtatCampagne, type Progression } from './progression';

export { commandantDeGraine, graineAvecCommandant, cleSourceCommandant, estSourceCommandant } from './bancs';

/**
 * Les couleurs d'un commandant sans nation : l'Intendance et la Sélection
 * Méridienne jouent sous le code de camp `atl` (`01-bible.md` §3.4).
 */
export const CODE_SANS_NATION: CodePays = 'atl';

/** Une option du briefing. `cle` est ce qui s'enregistre et ce qui va dans la graine. */
export interface OptionCommandant {
  cle: string;
  /** La clé i18n de son nom, comme partout ailleurs : `commandant.<cle>.nom`. */
  nom: string;
  /** Vrai pour le commandant du scénario : premier de la liste, et défaut. */
  defaut: boolean;
  /** Vrai s'il vient de la liste des secrets du roster. */
  secret: boolean;
  /** La ligne de goût du roster, ou le libellé du secret. Vide hors roster. */
  gout: string;
  /** La délégation dont on jouerait les couleurs ; `null` pour le défaut. */
  paysCode: CodePays | null;
  /** Le kit **tel qu'il sera joué** : la révision de ce scénario, jamais une autre. */
  kit: CommandantJeu | null;
}

/** La délégation d'un commandant, `atl` pour qui n'en a pas. */
export function paysDuCommandant(cle: string): CodePays {
  return (lireProfilCommandant(cle)?.paysCode as CodePays | undefined) ?? CODE_SANS_NATION;
}

/** Le commandant que le scénario met au camp du joueur. */
export function commandantDuScenario(scenario: Scenario): string | null {
  return scenario.commandants.find((c) => c.camp === 0)?.commandantCle ?? null;
}

/** Le kit d'un commandant à la révision d'un scénario ; `null` si le catalogue l'ignore. */
function kitDe(cle: string, scenario: Scenario): CommandantJeu | null {
  try { return chargerCommandantJeu(cle, revisionCommandants(scenario)); }
  catch { return null; }
}

/**
 * Les options du briefing : **le commandant du scénario d'abord**, puis les
 * débloqués dans l'ordre du roster.
 *
 * Vide pour un scénario qui n'ouvre pas le choix — comme `optionsBanc` pour un
 * scénario sans banc : l'écran n'a pas à connaître la politique, il regarde si
 * la liste est vide.
 *
 * Le commandant du scénario est toujours proposé, **même absent du roster** :
 * un scénario se joue avec le commandant qu'il déclare, et un vestiaire encore
 * vide ne doit pas rendre une épreuve injouable.
 *
 * C'est la liste des **prenables**, et rien d'autre. L'écran du briefing passe
 * par `grilleCommandants` (`roster.ts`), qui montre en plus les verrouillés et
 * les silhouettes des secrets ; les deux lisent le même acquis, calculé une
 * seule fois par `vestiaire()`, de sorte qu'aucune règle n'est écrite deux fois.
 */
export function optionsCommandant(
  scenario: Scenario,
  progression: Progression,
  roster: RosterJouables = chargerCommandantsJouables(),
  etat: EtatCampagne = {},
): OptionCommandant[] {
  if (scenario.choixCommandant !== 'debloques') return [];
  const defaut = commandantDuScenario(scenario);
  if (defaut === null) return [];
  const gouts = new Map<string, { gout: string; secret: boolean }>([
    ...roster.jouables.map((j) => [j.cle, { gout: j.gout, secret: false }] as const),
    ...roster.secrets.map((s) => [s.cle, { gout: s.libelle, secret: true }] as const),
  ]);
  const option = (cle: string, estDefaut: boolean): OptionCommandant => ({
    cle,
    nom: `commandant.${cle}.nom`,
    defaut: estDefaut,
    secret: gouts.get(cle)?.secret ?? false,
    gout: gouts.get(cle)?.gout ?? '',
    paysCode: estDefaut ? null : paysDuCommandant(cle),
    kit: kitDe(cle, scenario),
  });
  return [
    option(defaut, true),
    ...vestiaire(progression, roster, etat).filter((cle) => cle !== defaut).map((cle) => option(cle, false)),
  ];
}

/**
 * Applique un choix de commandant à un scénario et rend **une copie** — le canon
 * importé ne se mute jamais.
 *
 * Choisir le commandant du scénario (ou une clé qu'il ne propose pas) ne change
 * rien : la copie est le scénario. Autrement, c'est exactement le chemin du banc
 * prêté, sans libellé de conséquence puisqu'il n'y en a pas.
 */
export function appliquerChoixCommandant(scenario: Scenario, cle: string | null): Scenario {
  const copie: Scenario = structuredClone(scenario);
  if (cle === null || cle === commandantDuScenario(scenario)) return copie;
  if (scenario.choixCommandant !== 'debloques') return copie;
  const paysCode = paysDuCommandant(cle);
  appliquerBanc(copie, { commandantCle: cle, paysCode, libelle: `commandant.${cle}.nom` });
  // Un général des Gris amène son matériel : `frappe`, `laser` et `iem` sont
  // refusées à un camp que `factionsParCamp` ne déclare pas (`doc/04` §7.2), et
  // un Ost qui ne peut pas tirer sa Grêle n'est pas Ost. Le camp du joueur
  // passe donc à la faction — ce qui lui ouvre aussi les prototypes exclusifs,
  // Veilleur, Bastion et Automate : c'est ce que vaut un secret, et c'est le
  // même drapeau des deux côtés (`estCampFaction`, `uniteAutorisee`).
  if (paysCode === CODE_SANS_NATION) copie.factionsParCamp = { ...copie.factionsParCamp, 0: 'atl' };
  delete copie.choixCommandant;
  return copie;
}

/**
 * Le scénario tel qu'il se joue sous la graine enregistrée : la reprise d'une
 * partie relit son commandant dans la graine, jamais dans la progression — le
 * joueur a pu en rechoisir un autre entre-temps, et une partie en cours ne
 * change pas de général.
 */
export function appliquerCommandantDeGraine(scenario: Scenario, graine: string): Scenario {
  return appliquerChoixCommandant(scenario, commandantDeGraine(graine));
}
