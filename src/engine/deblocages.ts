/**
 * # Déblocages — évaluation des conditions composables
 *
 * Un `Deblocage` est `{ cle, condition, recompense }` (`doc/13-campagne.md` §8) : un
 * système unique pour tout ce qui s'ouvre — généraux secrets, cartes, cartes de
 * terrain, skins de style, fils, modes. Ce module l'évalue.
 *
 * Trois règles, dans cet ordre :
 *
 * 1. **Le rendu n'a aucune autorité.** Un déblocage est évalué ici, dans le moteur,
 *    ou par le serveur qui appelle ce même code. Jamais par une couche d'affichage.
 * 2. **Le moteur ne lit jamais l'horloge.** Une condition `date` compare à
 *    `Contexte.aujourdhui`, une date fournie par l'appelant — le serveur, qui est le
 *    seul à savoir quel jour on est (`PLAN.md`, étape 5).
 * 3. **Pur et total.** Aucune entrée n'est modifiée, aucune condition ne lève : une
 *    condition mal formée est fausse, pas une exception. C'est `validerCondition`
 *    qui refuse les données invalides, en amont.
 *
 * Ce fichier n'importe que `schemas/` (`doc/02-architecture.md` §5).
 */

import type {
  Cle, CodePays, Condition, DateIso, Deblocage, Mode, ProfilCampagne, RelationNation,
} from '../schemas/types';

/**
 * Ce que l'évaluation sait du monde en dehors du profil.
 *
 * Aujourd'hui, une seule chose : la date du jour, fournie par le serveur. Le champ
 * existe séparément du profil parce qu'il n'appartient pas à la sauvegarde : deux
 * évaluations du même profil à deux jours différents peuvent légitimement différer.
 */
export interface ContexteDeblocage {
  /** La date réelle, au format `AAAA-MM-JJ`, telle que le serveur la donne. */
  aujourdhui: DateIso;
}

/** Vrai si le flag booléen est posé dans le profil. */
function flagPose(profil: ProfilCampagne, cle: Cle): boolean {
  return profil.flags.booleens[cle] === true;
}

/**
 * Valeur d'un compteur du profil. Un compteur absent vaut zéro : ne l'avoir jamais
 * incrémenté et valoir zéro sont la même chose (`08-narration-choix.md` §2.1).
 */
function compteur(profil: ProfilCampagne, cle: Cle): number {
  const v = profil.flags.compteurs[cle];
  return typeof v === 'number' ? v : 0;
}

/** Vrai si le pays figure parmi ceux que le profil a visités. */
function visite(profil: ProfilCampagne, pays: CodePays): boolean {
  return profil.paysVisites.includes(pays);
}

/**
 * L'état de relation d'une nation dans ce profil.
 *
 * Une nation absente de `relations` est `neutre` : ne l'avoir jamais croisée et
 * n'avoir rien décidé la concernant sont la même chose, exactement comme un compteur
 * absent vaut zéro (`08-narration-choix.md` §2.1).
 */
function relation(profil: ProfilCampagne, pays: CodePays): RelationNation {
  return profil.relations[pays] ?? 'neutre';
}

/**
 * La confiance d'un général envers le joueur, de 0 à `CONFIANCE_MAX`.
 *
 * Un général absent de `confiance` est à zéro : ne l'avoir jamais incarné et ne pas
 * avoir sa confiance sont la même chose (`BRIEF.md`, « Le joueur et le départ »).
 * Le champ lui-même peut manquer — un profil écrit par une version antérieure à
 * l'incarnation reste lisible, il ouvre simplement moins de choses.
 */
function confiance(profil: ProfilCampagne, commandantCle: Cle): number {
  const v = profil.confiance?.[commandantCle];
  return typeof v === 'number' ? v : 0;
}

/** Vrai si le profil a mené une campagne à son terme dans ce mode. */
function modeFini(profil: ProfilCampagne, mode: Mode): boolean {
  return profil.modesFinis.includes(mode);
}

/**
 * Évalue une condition composable contre un profil de campagne.
 *
 * Les dix types sont ceux du brief : `flag`, `compteur`, `mode_fini`, `date`,
 * `pays_visite`, `secret`, `relation`, `confiance`, `et`, `ou`. Un `et` vide est vrai (toutes ses conditions
 * sont satisfaites, il n'y en a aucune) ; un `ou` vide est faux (aucune ne l'est).
 * C'est la convention usuelle, et `validerCondition` interdit de toute façon les
 * listes de moins de deux entrées.
 */
export function evaluerCondition(
  condition: Condition,
  profil: ProfilCampagne,
  contexte: ContexteDeblocage,
): boolean {
  switch (condition.type) {
    case 'flag':
      return flagPose(profil, condition.cle);
    case 'compteur':
      return compteur(profil, condition.cle) >= condition.min;
    case 'mode_fini':
      return modeFini(profil, condition.mode);
    case 'date': {
      // Comparaison lexicographique : le format ISO 8601 « AAAA-MM-JJ » se trie
      // comme il se date. Bornes incluses des deux côtés.
      const jour = contexte.aujourdhui;
      if (condition.du !== undefined && jour < condition.du) return false;
      if (condition.au !== undefined && jour > condition.au) return false;
      return true;
    }
    case 'pays_visite': {
      let n = 0;
      for (const pays of condition.pays) {
        if (visite(profil, pays)) n += 1;
        if (n >= condition.combien) return true;
      }
      return n >= condition.combien;
    }
    case 'secret':
      return profil.secretsTrouves.includes(condition.cle);
    case 'relation': {
      // « Au moins `combien` de ces nations sont dans cet état. » C'est ainsi qu'une
      // nation alliée ouvre son départ de Nouvelle Ronde (`13-campagne.md` §3.5) et
      // que la borne « au moins deux alliées » se lit sans code particulier.
      let n = 0;
      for (const pays of condition.pays) {
        if (relation(profil, pays) === condition.relation) n += 1;
        if (n >= condition.combien) return true;
      }
      return n >= condition.combien;
    }
    case 'confiance':
      // Incarner une nation fait monter la confiance de son général ; à
      // `CONFIANCE_MAX`, elle ouvre le co-commandant à jauge entière et le départ de
      // Nouvelle Ronde, exactement par où passe une relation `alliee`.
      return confiance(profil, condition.commandantCle) >= condition.min;
    case 'et':
      return condition.conditions.every((c) => evaluerCondition(c, profil, contexte));
    case 'ou':
      return condition.conditions.some((c) => evaluerCondition(c, profil, contexte));
    default:
      // Une condition d'un type inconnu est fausse, jamais une exception : un profil
      // ouvert par une version plus récente ne doit pas casser une version plus vieille.
      return false;
  }
}

/**
 * Les clés des déblocages dont la condition est satisfaite, dans l'ordre de la liste.
 *
 * La fonction ne tient pas compte de ce que le profil possède déjà : elle répond
 * « ce qui est acquis », pas « ce qui vient de s'ouvrir ». Pour la seconde question,
 * voir `deblocagesNouveaux`.
 */
export function deblocagesAcquis(
  profil: ProfilCampagne,
  deblocages: readonly Deblocage[],
  contexte: ContexteDeblocage,
): Cle[] {
  const acquis: Cle[] = [];
  for (const d of deblocages) {
    if (evaluerCondition(d.condition, profil, contexte)) acquis.push(d.cle);
  }
  return acquis;
}

/**
 * Les déblocages acquis que le profil ne connaissait pas encore : c'est ce que le
 * serveur annonce au joueur et ce qu'il ajoute à `ProfilCampagne.deblocages`.
 */
export function deblocagesNouveaux(
  profil: ProfilCampagne,
  deblocages: readonly Deblocage[],
  contexte: ContexteDeblocage,
): Cle[] {
  const deja = new Set(profil.deblocages);
  return deblocagesAcquis(profil, deblocages, contexte).filter((c) => !deja.has(c));
}

/**
 * Vrai si ce commandant est jouable par ce profil.
 *
 * Un commandant ordinaire l'est toujours ; un général secret ne l'est que si le
 * `Deblocage` qu'il désigne est acquis. La doctrine « jamais indispensable » vit
 * ailleurs — dans le contenu, pas ici : aucun fil, aucune fin, aucune destination
 * ne dépend d'un général secret.
 */
export function commandantJouable(
  commandant: { secret?: boolean; deblocage?: Cle },
  profil: ProfilCampagne,
): boolean {
  if (commandant.secret !== true) return true;
  if (commandant.deblocage === undefined) return false;
  return profil.deblocages.includes(commandant.deblocage);
}
