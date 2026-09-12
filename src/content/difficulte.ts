import type { CampId, Mode, Scenario } from '../schemas/index';

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
