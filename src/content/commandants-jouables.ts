/**
 * Le **roster jouable** : qui le joueur peut prendre au briefing, et à partir de
 * quand (`content/commandants-jouables.json`, `doc/13-campagne.md` §8).
 *
 * Le fichier est importé statiquement comme tout le canon — il est dans le
 * paquet, jamais récupéré par le réseau — et **validé au chargement** : un
 * roster cassé arrête le build et les tests, il ne produit jamais un vestiaire
 * bancal. Le validateur reçoit ici la seule référence qu'il ne peut pas
 * résoudre seul, le catalogue des capacités : `schemas` n'importe rien
 * (`02-architecture.md` §5), c'est donc à cette couche de la lui passer.
 *
 * Ce module ne décide **rien** de ce qui est débloqué : il lit le contenu.
 * L'application des `ouvertPar` aux victoires et l'évaluation des conditions
 * secrètes vivent dans `src/app/campagne/progression.ts`, qui a la progression
 * du profil sous la main.
 */
import rosterJson from '../../content/commandants-jouables.json';
import { listerProfilsCommandants, type RevisionCapacites, VERSION_CAPACITES_COMMANDANTS } from './profils-commandants';
import {
  validerRosterJouables,
  type CommandantJouableRoster, type CommandantSecretRoster, type RosterJouables,
} from '../schemas/index';

export type { CommandantJouableRoster, CommandantSecretRoster, RosterJouables };

/** Les clés du catalogue des capacités, la référence contre laquelle le roster se lit. */
function clesConnues(revision: RevisionCapacites): string[] {
  return listerProfilsCommandants(revision).map((p) => p.cle);
}

let cache: RosterJouables | null = null;

/**
 * Charge le roster jouable. Le résultat est **mémorisé puis recopié** : la
 * validation ne se paie qu'une fois, et personne ne peut modifier le canon
 * importé en manipulant ce qu'il a reçu.
 */
export function chargerCommandantsJouables(
  revision: RevisionCapacites = VERSION_CAPACITES_COMMANDANTS,
): RosterJouables {
  if (cache === null || revision !== VERSION_CAPACITES_COMMANDANTS) {
    const r = validerRosterJouables(rosterJson, { commandants: clesConnues(revision) });
    if (!r.ok) {
      const details = r.erreurs
        .map((e) => `  - ${e.chemin === '' ? '(racine)' : e.chemin} : ${e.message}`)
        .join('\n');
      throw new Error(`Contenu canon invalide dans content/commandants-jouables.json :\n${details}`);
    }
    if (revision !== VERSION_CAPACITES_COMMANDANTS) return structuredClone(r.valeur);
    cache = r.valeur;
  }
  return structuredClone(cache);
}

/** Toutes les clés du roster, ouvertes et secrètes, dans l'ordre du fichier. */
export function clesDuRoster(roster: RosterJouables = chargerCommandantsJouables()): string[] {
  return [...roster.jouables.map((j) => j.cle), ...roster.secrets.map((s) => s.cle)];
}

/** L'entrée du roster qui porte cette clé, ouverte ou secrète, ou `null`. */
export function entreeDuRoster(
  cle: string,
  roster: RosterJouables = chargerCommandantsJouables(),
): CommandantJouableRoster | CommandantSecretRoster | null {
  return roster.jouables.find((j) => j.cle === cle)
    ?? roster.secrets.find((s) => s.cle === cle)
    ?? null;
}
