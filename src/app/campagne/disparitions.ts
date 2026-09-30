/**
 * # Le calendrier des disparitions
 *
 * Quatre chefs de nations alliées meurent au cours de l'opus 1 — Nikos Delis,
 * Mira Karki, Tomas Reiner et Samir El Hadi (décision du propriétaire du
 * 9 septembre 2026, `doc/refonte/opus1-hors-serie.md` §3). À partir de l'annonce,
 * le général n'est plus proposé au joueur : ni au vestiaire, ni comme banc prêté,
 * ni — le jour où la mécanique existera — comme co-commandant. Sa nation reste
 * engagée, sa relation ne bouge pas, et son banc est repris par une adjointe du
 * registre (`content/personnages.json`), qui joue ses couleurs sans son pouvoir.
 *
 * **C'est du code, et c'est tout l'intérêt** (tranché le 26 septembre 2026 par
 * délégation du propriétaire, `opus1-hors-serie.md` §5 point 2 ;
 * `13-campagne.md` §5.2). Aucun champ de contenu — `Scenario`, `Fil`,
 * `Consequence`, `Condition`, `Deblocage` — ne sait dire « ce général n'est plus
 * là » : la liste fermée des conséquences n'a pas reçu de onzième entrée. Une
 * routine qui voudrait écrire une mort n'a pas de mot pour le faire, et le
 * contrôle n'a rien à surveiller : la borne est dans le type. Les quatre sont
 * nommés ici, avec leurs épisodes, et ne peuvent l'être qu'ici, par une revue de
 * code.
 *
 * Deux règles de lecture :
 *
 * 1. **Une disparition est acquise quand l'épisode après lequel elle a lieu est
 *    remporté** (`apres`) : l'épisode suivant s'ouvre sur l'annonce. Le briefing
 *    qui l'annonce ne propose donc jamais le général qu'on y pleure.
 * 2. **Une branche se choisit par une décision retenue** (`si`), lue par
 *    `evaluerCondition` — le moteur, jamais une lecture maison. La branche sans
 *    `si` est le défaut et vient toujours en dernier : celle qui déplace le moment
 *    demande un geste du joueur (confier le passage à la recrue, garantir le
 *    crédit) ; sans ce geste, c'est l'autre.
 *
 * Et un invariant, que le contenu doit tenir : **une disparition ne se défait
 * jamais.** Le calendrier lit des victoires et des décisions, qui ne se retirent
 * pas ; le seul cas qui pourrait le prendre en défaut est une décision prise
 * *après* l'annonce qu'elle aurait dû précéder. Un épisode qui fait jouer un
 * général disparu ne s'ouvre donc plus : `opus1_hs_gr_2`, qui choisit la branche
 * de Nikos, se ferme quand la finale 2 annonce sa disparition par défaut.
 *
 * Aujourd'hui, **le calendrier est inerte** : aucun épisode d'ancrage (finales,
 * `opus1_jp_12`) n'existe encore, aucune progression ne peut en remporter un. Il
 * est branché là où un général est proposé (`vestiaire`, `bancsProposes`), et
 * tenu par des tests sur des progressions fictives.
 */
import { evaluerCondition, type ContexteDeblocage } from '../../engine/deblocages';
import type { Cle, CodePays, ProfilCampagne } from '../../schemas/types';

/** Une manière de disparaître : quand, où c'est annoncé, et qui reprend le banc. */
export interface BrancheDisparition {
  /**
   * La décision qui retient cette branche : son nom au journal et l'identifiant
   * **enregistré** de l'option. Absent pour la branche par défaut.
   */
  si?: { decision: Cle; option: Cle };
  /** L'épisode après lequel il disparaît : sa victoire rend la disparition acquise. */
  apres: Cle;
  /** L'épisode qui s'ouvre sur l'annonce — la plaque posée à plat au Tableau. */
  annonce: Cle;
  /**
   * Pour une annonce faite dans un hors-série : l'épisode de la trame où Vantour
   * le dit, en une phrase, à qui n'a pas joué l'arc (§5 point 5).
   */
  rappelTrame?: Cle;
  /** L'adjointe qui reprend le banc, par sa clé au registre ; `null` pour un intérim sans nom. */
  banc: Cle | null;
}

/** Un des quatre, et ses branches, la branche par défaut en dernier. */
export interface Disparition {
  commandantCle: Cle;
  paysCode: CodePays;
  branches: readonly BrancheDisparition[];
}

/**
 * Le calendrier, **complet** : quatre généraux, pas un de plus. Il ne se lit
 * nulle part ailleurs que dans ce module, et il ne s'étend que par une décision
 * du propriétaire écrite dans `BRIEF.md` (« Quatre disparitions »).
 */
export const CALENDRIER_DISPARITIONS: readonly Disparition[] = Object.freeze([
  {
    // Le cœur, un matin d'hiver. Branche « confier_recrue » : il reste au quai et
    // la méthode passe à la recrue ; sinon, il fait la traversée seul chaque matin.
    commandantCle: 'cmd_nikos_delis',
    paysCode: 'gr',
    branches: [
      { si: { decision: 'opus1_hs_gr_2_decision', option: 'confier_recrue' }, apres: 'opus1_finale_07', annonce: 'opus1_hs_gr_3', rappelTrame: 'opus1_finale_08', banc: 'dafni_rallis' },
      { apres: 'opus1_finale_02', annonce: 'opus1_hs_gr_3', rappelTrame: 'opus1_finale_03', banc: null },
    ],
  },
  {
    // La montagne et l'épuisement. Le pont de corde change ce que l'atelier a
    // reçu, jamais le moment : une seule branche.
    commandantCle: 'cmd_mira_karki',
    paysCode: 'np',
    branches: [
      { apres: 'opus1_finale_07', annonce: 'opus1_hs_np_3', rappelTrame: 'opus1_finale_08', banc: 'anju_basnet' },
    ],
  },
  {
    // La route, de nuit, après le repli de la finale 10. Le choix de la finale 9
    // change qui voyage avec lui, jamais le moment : une seule branche.
    commandantCle: 'cmd_tomas_reiner',
    paysCode: 'lu',
    branches: [
      { apres: 'opus1_finale_11', annonce: 'opus1_finale_12', banc: 'lea_wagener' },
    ],
  },
  {
    // Une maladie longue, la sienne. Garantir le crédit libère un remplaçant et
    // lui donne une saison ; sans garantie, il tient les étapes au lieu de se soigner.
    commandantCle: 'cmd_samir_el_hadi',
    paysCode: 'ma',
    branches: [
      // `garantir_livraison` est l'option `a` de la fiche (`decisions.ts`).
      { si: { decision: 'opus1_ma_08_decision', option: 'garantir_livraison' }, apres: 'opus1_finale_13', annonce: 'opus1_finale_14', banc: 'nadia_berrada' },
      { apres: 'opus1_jp_12', annonce: 'opus1_au_01', banc: 'nadia_berrada' },
    ],
  },
]);

/** La branche que ce profil a retenue : la première dont la décision est prise, sinon le défaut. */
export function brancheRetenue(
  d: Disparition,
  profil: ProfilCampagne,
  contexte: ContexteDeblocage,
): BrancheDisparition {
  const choisie = d.branches.find((b) => b.si !== undefined
    && evaluerCondition({ type: 'decision', cle: b.si.decision, option: b.si.option }, profil, contexte));
  // Le défaut est la branche sans décision ; le calendrier en porte toujours une,
  // en dernier, et un test le vérifie.
  return choisie ?? d.branches.find((b) => b.si === undefined) ?? d.branches[d.branches.length - 1]!;
}

/**
 * Les généraux disparus pour ce profil, dans l'ordre du calendrier : ceux dont
 * l'épisode d'ancrage de la branche retenue est remporté.
 */
export function commandantsDisparus(profil: ProfilCampagne, contexte: ContexteDeblocage): Cle[] {
  const finis = new Set(profil.scenariosFinis);
  return CALENDRIER_DISPARITIONS
    .filter((d) => finis.has(brancheRetenue(d, profil, contexte).apres))
    .map((d) => d.commandantCle);
}
