import type { CampId, Dialogue, Mode, RenfortScenario, Scenario } from '../schemas/index';

/**
 * La fin du chapitre français (FR07 à FR12) : ce que chaque mode ajoute
 * par-dessus ses paramètres (`Scenario.modes`), et rien qui ne soit annoncé.
 *
 * - `alliesPropres` : les colonnes alliées pilotées par l'IA gardent les fonds,
 *   les revenus et la stratégie que le scénario leur donne. Les paramètres de
 *   mode ne connaissent qu'un « budget IA » et une stratégie, qui valent pour
 *   l'adversaire ; appliqués à Tomas ou à Solveig, ils feraient jouer la
 *   coalition à la place du joueur, et le difficile la rendrait plus riche. Le
 *   mode durcit l'adversaire, jamais l'allié — c'est la règle que FR04 tenait
 *   déjà pour les fonds de Tomas, ligne à part.
 * - `difficile` : la réplique qui le dit au briefing, les renforts qu'il
 *   ajoute, et le rappel joué la veille de leur arrivée. Aucun dégât ni
 *   déplacement ne change ; les conditions de victoire non plus.
 */
export interface DurcissementChapitre {
  alliesPropres?: boolean;
  difficile?: { annonce: Dialogue; renforts?: RenfortScenario[]; rappel?: { journee: number; replique: Dialogue } };
}
const ARIANE = 'cmd_ariane_belloc';
export const FIN_CHAPITRE_FR: Readonly<Record<string, DurcissementChapitre>> = {
  // FR07 à FR09 : proposés par le lot qui les a écrits
  // (`apercus/fr07-09/propositions-hors-lot.ts.txt`), repris tels quels.
  // La fiche : « une unité de couverture supplémentaire protège les indirects ».
  opus1_fr_07: {
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, Ost commence avec 1 500 fonds de plus et poste à J2 un char léger devant son artillerie de l’est. Les relais ne changent pas. Le Bulletin ne voit qu’une journée.' },
      // J2 et non J1 : le difficile ne donne jamais d'unité à l'IA au départ
      // (`doc/13` §6.3) — il annonce un renfort, il ne change pas le scénario.
      renforts: [{ journee: 2, unites: [{ camp: 1, type: 'char_leger', x: 21, y: 13 }] }],
    },
  },
  // La fiche : « crédit adverse de 1 500 fonds » — le crédit de Méridien ; Tomas n'en reçoit pas.
  opus1_fr_08: {
    alliesPropres: true,
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, Méridien avance 1 500 fonds à l’équipe de l’Est et au convoi de Solveig. Tomas n’en reçoit pas. Le Bulletin ne voit qu’une journée.' },
    },
  },
  // La fiche : « réserve adverse décalée sur un axe secondaire annoncé dès le briefing ».
  opus1_fr_09: {
    alliesPropres: true,
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, Edran commence avec 1 500 fonds de plus, et sa relève entre au sud-est à J5 : un char léger et une infanterie. Gardez de quoi couvrir le dépôt du sud.' },
      renforts: [{ journee: 5, unites: [{ camp: 1, type: 'char_leger', x: 17, y: 12 }, { camp: 1, type: 'infanterie', x: 17, y: 13 }] }],
      rappel: { journee: 4, replique: { locuteur: ARIANE, emotion: 'neutre', texte: 'Demain, la relève d’Edran entre au sud-est : un char léger et une infanterie.' } },
    },
  },
  // La fiche : « une unité de couverture supplémentaire protège les indirects ».
  // Les 1 500 fonds viennent des paramètres du mode, comme de FR03 à FR06.
  opus1_fr_10: {
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, chaque équipe adverse a 1 500 fonds de plus, et une infanterie rejoint l’artillerie d’Edran au sud à J2 pour la couvrir. Les centres ne changent pas. Le Bulletin ne voit qu’une journée.' },
      renforts: [{ journee: 2, unites: [{ camp: 1, type: 'infanterie', x: 16, y: 11 }] }],
    },
  },
  // Les colonnes n'ont ni usine ni caisse ici : le « crédit adverse » de la
  // fiche ne leur achèterait rien. Il devient une réserve, annoncée : un char
  // léger qui rejoint Ost à J3 par la route de l'est.
  opus1_fr_11: {
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, Ost garde un char léger en réserve : il entre par la route de l’est à J3. Le Bulletin ne voit qu’une journée.' },
      renforts: [{ journee: 3, unites: [{ camp: 1, type: 'char_leger', x: 19, y: 7 }] }],
      rappel: { journee: 2, replique: { locuteur: ARIANE, emotion: 'neutre', texte: 'Demain, la réserve d’Ost entre par la route de l’est : un char léger.' } },
    },
  },
  // La fiche : « réserve adverse décalée sur un axe secondaire annoncé dès le briefing ».
  // Les 1 500 fonds et la stratégie défensive d'Edran (il tient le siège)
  // viennent des paramètres du mode.
  opus1_fr_12: {
    alliesPropres: true,
    difficile: {
      annonce: { locuteur: ARIANE, emotion: 'neutre', texte: 'En difficile, Edran a 1 500 fonds de plus et ne quitte pas ses portes. Sa réserve, un char léger et une infanterie, entre par la porte sud à J4. Le Bulletin ne voit qu’une journée.' },
      renforts: [{ journee: 4, unites: [{ camp: 3, type: 'char_leger', x: 18, y: 11 }, { camp: 3, type: 'infanterie', x: 19, y: 11 }] }],
      rappel: { journee: 3, replique: { locuteur: ARIANE, emotion: 'neutre', texte: 'Demain, la réserve d’Edran entre par la porte sud : un char léger et une infanterie.' } },
    },
  },
};

/** Réglages assumés des essais Aube : aucun multiplicateur caché de dégâts. */
export const DIFFICULTES_AUBE: Readonly<Record<string, { fondsAdverses: number; brouillard?: boolean }>> = {
  aube_batteries_2v1: { fondsAdverses: 2000 },
  aube_reserves_1v2: { fondsAdverses: 1500 },
  aube_nuit_2v2: { fondsAdverses: 2000, brouillard: true },
  aube_releve_1v3: { fondsAdverses: 0 },
  aube_routes_3v1: { fondsAdverses: 3000 },
};

/** S'applique au canon, avant les conséquences narratives du profil. */
export function scenarioPourMode(base: Scenario, mode: Mode): Scenario {
  const scenario = structuredClone(base);
  const parametres = base.modes?.[mode];
  if (parametres) {
    scenario.fondsDepart = parametres.fondsDepart;
    scenario.fondsDepartParCamp = Object.fromEntries(base.commandants.map((c) => [c.camp, c.camp === 0 ? parametres.fondsDepart : parametres.fondsDepartIa]));
    scenario.revenusParBatiment = parametres.revenusParBatiment;
    scenario.revenusParBatimentParCamp = Object.fromEntries(base.commandants.map((c) => [c.camp, c.camp === 0 ? parametres.revenusParBatiment : parametres.revenusIaParBatiment]));
    scenario.brouillard = parametres.brouillard;
    scenario.limiteJournees = parametres.limiteJournees;
    scenario.vitesseJaugeJoueur = parametres.vitesseJauge;
    scenario.previsionJournees = parametres.previsionJournees;
    scenario.commandants = base.commandants.map((c) => c.ia ? { ...c, ia: parametres.strategieIa } : c);
    if (base.code === 'opus1_fr_04') scenario.fondsDepartParCamp[1] = base.fondsDepartParCamp?.[1] ?? 3000;
    if (/^opus1_fr_0[3-6]$/.test(base.code) && mode === 'difficile') {
      scenario.dialogueOuverture.push({locuteur:'cmd_ariane_belloc',emotion:'neutre',texte:'En difficile, chaque équipe adverse dispose de 1 500 fonds supplémentaires. Leurs dégâts restent identiques et le Bulletin montre une seule journée à l’avance.'});
    }
    const chapitre = FIN_CHAPITRE_FR[base.code];
    if (chapitre?.alliesPropres) {
      const allies = base.equipes?.find((e) => e.includes(0)) ?? [0];
      const fonds = { ...scenario.fondsDepartParCamp };
      const revenus = { ...scenario.revenusParBatimentParCamp };
      // `scenario.commandants` suit l'ordre de `base.commandants` : la stratégie
      // d'origine de l'allié se lit au même rang.
      scenario.commandants = scenario.commandants.map((c, i) => {
        if (c.camp === 0 || !allies.includes(c.camp)) return c;
        fonds[c.camp] = base.fondsDepartParCamp?.[c.camp] ?? parametres.fondsDepartIa;
        revenus[c.camp] = base.revenusParBatimentParCamp?.[c.camp] ?? parametres.revenusIaParBatiment;
        return { ...c, ia: base.commandants[i]!.ia ?? parametres.strategieIa };
      });
      scenario.fondsDepartParCamp = fonds;
      scenario.revenusParBatimentParCamp = revenus;
    }
    if (chapitre?.difficile && mode === 'difficile') {
      const { annonce, renforts, rappel } = chapitre.difficile;
      scenario.dialogueOuverture = [...scenario.dialogueOuverture, annonce];
      if (renforts?.length) scenario.renforts = [...(scenario.renforts ?? []), ...structuredClone(renforts)];
      if (rappel) {
        scenario.scenesDialogue = [...(scenario.scenesDialogue ?? []), {
          cle: `${base.code}_difficile_rappel`, declencheur: { type: 'journee', journee: rappel.journee }, repliques: [rappel.replique],
        }];
      }
    }
    return scenario;
  }
  if (mode === 'normal') return scenario;
  const reglage = DIFFICULTES_AUBE[base.code] ?? { fondsAdverses: 1500 };
  const allies = base.equipes?.find((e) => e.includes(0)) ?? [0];
  const adverses = base.commandants.filter((c) => !allies.includes(c.camp));
  scenario.fondsDepartParCamp = { ...base.fondsDepartParCamp };
  for (const c of adverses) {
    scenario.fondsDepartParCamp[c.camp] = Math.min(30000, (base.fondsDepartParCamp?.[c.camp] ?? base.fondsDepart) + reglage.fondsAdverses);
  }
  scenario.commandants = base.commandants.map((c) => c.ia && !allies.includes(c.camp) ? { ...c, ia: 'ponderee' } : c);
  scenario.previsionJournees = 1;
  if (reglage.brouillard !== undefined) scenario.brouillard = reglage.brouillard;
  if (base.code === 'aube_releve_1v3') {
    // Le siège a zéro revenu et pas d'usine adverse : des fonds ne le durciraient pas.
    // Renforts supplémentaires aux entrées des deux armées latérales, visibles dans le briefing.
    const camps: CampId[] = adverses.slice(0, 2).map((c) => c.camp);
    scenario.dialogueOuverture = [...scenario.dialogueOuverture, {
      locuteur: 'cmd_ariane_belloc', emotion: 'neutre',
      texte: 'En difficile, deux infanteries supplémentaires arrivent à la journée 18 par les accès ouest et est. Conservez une réserve pour les intercepter.',
    }];
    scenario.scenesDialogue = [...(scenario.scenesDialogue ?? []), {
      cle: 'releve_alerte_difficile_18', declencheur: { type: 'journee', journee: 17 },
      repliques: [{ locuteur: 'cmd_ariane_belloc', emotion: 'neutre',
        texte: 'Demain, les deux infanteries de réserve du mode difficile arrivent aux accès ouest et est.' }],
    }];
    scenario.renforts = [...(scenario.renforts ?? []), {
      journee: 18,
      unites: camps.map((camp, i) => ({ camp, type: 'infanterie' as const, x: [2, 20, 11][i]!, y: [2, 2, 1][i]! })),
    }];
  }
  return scenario;
}
