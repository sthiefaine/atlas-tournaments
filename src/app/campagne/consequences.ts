import type { Dialogue, Scenario } from '../../schemas/index';
import type { DecisionLocale } from './progression';
import { BANCS_PRETES, CLES_I18N_BANC, appliquerBanc, bancChoisi, cleSourceBanc, estSourceBanc, graineSansCommandant, optionsBanc, scenarioDeSource } from './bancs';

export const VERSION_CANON_AUBE = 1;
export const CHOIX_AUBE = {
  aube_batteries_2v1: [
    { cle: 'mutualiser_reserves', titre: 'Mutualiser les réserves', effet: 'À la prochaine nouvelle partie de La quarantième relève, un char léger de votre camp arrive à la journée 20 ; la quête du convoi reçoit aussi une reconnaissance à J2, près du point d’entrée prévu ; si les cases proches sont occupées, son arrivée est reportée.' },
    { cle: 'credit_immediat', titre: 'Mobiliser un crédit', effet: 'À la prochaine nouvelle partie de Ligne de nuit, votre camp commence avec 2 000 fonds supplémentaires.' },
  ],
  aube_nuit_2v2: [
    { cle: 'publier_preuve', titre: 'Publier les preuves', effet: 'À la prochaine nouvelle partie des Routes d’Aube, votre camp reçoit 2 000 fonds supplémentaires grâce au soutien public.' },
    { cle: 'securiser_routes', titre: 'Sécuriser les routes', effet: 'À la prochaine nouvelle partie des Routes d’Aube, un génie de votre camp arrive à la journée 2 ; la quête des archives reçoit aussi une infanterie à J2, près du point d’entrée prévu ; si les cases proches sont occupées, son arrivée est reportée.' },
  ],
  aube_convoi_secondaire: [
    { cle: 'convoi_reserves', titre: 'Envoyer le convoi à la relève', effet: 'À la prochaine partie de La quarantième relève, un transport et une infanterie de votre camp arrivent à J2, près du point d’entrée.' },
    { cle: 'convoi_routes', titre: 'Financer les routes d’Aube', effet: 'À la prochaine partie des Routes d’Aube, votre camp commence avec 2 000 fonds supplémentaires.' },
  ],
  aube_archives_secondaire: [
    { cle: 'archives_reconnaissance', titre: 'Partager les relevés techniques', effet: 'À la prochaine partie des Routes d’Aube, un drone d’observation de votre camp arrive à J2. Le carnet conserve la preuve certifiée.' },
    { cle: 'archives_publiques', titre: 'Verser les preuves au dossier public', effet: 'À la prochaine partie des Routes d’Aube, votre camp reçoit 2 000 fonds de soutien. Le carnet conserve la preuve certifiée.' },
  ],
  opus1_tutoriel_10: [
    { cle: 'maintenance_partagee', titre: 'Partager les moyens de maintenance', effet: 'À la prochaine nouvelle partie de Sous les couleurs alliées, votre camp reçoit 2 000 fonds pour préparer l’équipe commune.' },
    { cle: 'fonds_immediats', titre: 'Financer la qualification', effet: 'À la prochaine nouvelle partie du Pacte du col, votre camp reçoit 2 000 fonds pour ouvrir et protéger le passage.' },
  ],
} as const;
export type ScenarioDecision = keyof typeof CHOIX_AUBE;
/**
 * Toutes les sources de décision, dans l'ordre des chiffres de la graine : les
 * choix de fin de match, puis les bancs prêtés. **On n'y insère jamais au
 * milieu** — une graine enregistrée lit ses chiffres par position.
 */
export const SOURCES_DECISION: readonly string[] = [
  ...Object.keys(CHOIX_AUBE),
  ...Object.keys(BANCS_PRETES).map(cleSourceBanc),
];
/**
 * Les options d'une source. Pour un choix de fin de match, `titre` et `effet`
 * sont des textes ; pour un banc (`<scenario>:banc`), ce sont des **clés i18n**
 * — `estSourceBanc` dit lequel des deux on tient.
 */
export function optionsDecision(code: string): readonly { cle: string; titre: string; effet: string }[] {
  if (estSourceBanc(code)) return optionsBanc(scenarioDeSource(code));
  return CHOIX_AUBE[code as ScenarioDecision] ?? [];
}
export function cleDecision(scenario: string, version: number): string {
  return `${scenario}:${version}:${VERSION_CANON_AUBE}`;
}
export function libelleDecision(d: DecisionLocale): { titre: string; effet: string } | undefined {
  return optionsDecision(d.scenario).find((o) => o.cle === d.choix);
}

/** Ce qu'il faut pour traduire un rappel de banc ; les rappels de choix sont déjà des textes. */
export type Traduire = (cle: string, params?: Record<string, string | number>) => string;

/**
 * Les répliques ajoutées par une branche. Du **contenu**, écrit ici comme
 * `difficulte.ts` écrit les siennes, et jamais avec un locuteur absent de la
 * distribution de l'épreuve qui les joue — un test le vérifie sur les
 * scénarios effectifs.
 */
const REPLIQUES_BANC = {
  pacte_du_col_echange: { locuteur: 'cmd_tomas_reiner', emotion: 'neutre', texte: 'Formation terminée : voici votre premier vrai front. Vantour est à l’antenne, Nera Aldouin arbitre, et nous échangeons les bancs pour cette épreuve : vous jouez mes couleurs et mon matériel, Ariane tient le mien. Elle joue pour gagner, c’est la règle.' },
  couleurs_transport: { locuteur: 'cmd_ariane_belloc', emotion: 'joie', texte: 'Vous avez déjà joué les couleurs de Tomas au col, commandant. Le bureau d’Atlas vous laisse un transport de plus à la deuxième journée ; je n’ai pas oublié comment vous vous en servez.' },
  nuit_fonds: { locuteur: 'cmd_tomas_reiner', emotion: 'neutre', texte: 'Vous avez tenu mon banc au détour des batteries. Le bureau d’Atlas a validé mille cinq cents fonds de plus pour la ligne de nuit : ne les gardez pas pour la fin.' },
  routes_solveig: { locuteur: 'cmd_ariane_belloc', emotion: 'doute', texte: 'Solveig ne l’a pas oublié : vous avez tenu son banc sur la ligne de nuit. Ce soir elle est en face, et elle sait exactement comment vous couvrez un convoi.' },
  routes_wren: { locuteur: 'cmd_ariane_belloc', emotion: 'neutre', texte: 'Wren a homologué votre relevé de la ligne de nuit, joué sous ses couleurs. Trois délégations d’un côté, Solveig de l’autre : voyez loin avant d’avancer.' },
} as const satisfies Record<string, Dialogue>;

/**
 * Repart toujours du canon : aucun bonus ne s'additionne au résultat précédent.
 *
 * `traduire` ne sert qu'aux rappels de banc, dont les libellés sont des clés ;
 * sans lui, ces rappels portent la clé — les tests et le vérificateur s'en
 * contentent, une page passe `t()`.
 */
export function appliquerConsequences(scenario: Scenario, decisions: readonly DecisionLocale[], traduire: Traduire = (cle) => cle): { scenario: Scenario; rappels: string[] } {
  const copie: Scenario = structuredClone(scenario);
  const rappels: string[] = [];
  const prises = new Map(decisions.filter((d) => d.canonVersion === VERSION_CANON_AUBE).map((d) => [d.scenario, d]));
  const appliquer = (origine: string, choix: string, effet: () => void): void => {
    const d = prises.get(origine);
    if (!d || d.choix !== choix) return;
    effet();
    const texte = libelleDecision(d);
    if (!texte) return;
    rappels.push(estSourceBanc(origine)
      ? `${traduire(CLES_I18N_BANC.journal, { banc: traduire(texte.titre) })} — ${traduire(texte.effet)}`
      : `${texte.titre} — ${texte.effet}`);
  };
  const crediterDe = (montant: number): void => {
    copie.fondsDepartParCamp = { ...copie.fondsDepartParCamp, 0: (copie.fondsDepartParCamp?.[0] ?? scenario.fondsDepart) + montant };
  };
  const crediter = (): void => crediterDe(2000);
  const ouvrir = (replique: Dialogue): void => { copie.dialogueOuverture = [...copie.dialogueOuverture, replique]; };
  if (scenario.code === 'pacte_du_col') appliquer('opus1_tutoriel_10', 'fonds_immediats', crediter);
  if (scenario.code === 'couleurs_alliees') appliquer('opus1_tutoriel_10', 'maintenance_partagee', crediter);
  if (scenario.code === 'aube_nuit_2v2') appliquer('aube_batteries_2v1', 'credit_immediat', crediter);
  if (scenario.code === 'aube_routes_3v1') {
    appliquer('aube_nuit_2v2', 'publier_preuve', crediter);
    appliquer('aube_nuit_2v2', 'securiser_routes', () => {
      copie.renforts = [...(copie.renforts ?? []), { journee: 2, unites: [{ camp: 0, type: 'genie', x: 10, y: 2 }] }];
    });
  }
  if (scenario.code === 'aube_releve_1v3') {
    appliquer('aube_batteries_2v1', 'mutualiser_reserves', () => {
      copie.renforts = [...(copie.renforts ?? []), { journee: 20, unites: [{ camp: 0, type: 'char_leger', x: 11, y: 16 }] }];
    });
  }
  const renfort = (journee: number, type: string, x: number, y: number): void => {
    copie.renforts = [...(copie.renforts ?? []), { journee, unites: [{ camp: 0, type, x, y }] }];
  };
  if (scenario.code === 'aube_convoi_secondaire') appliquer('aube_batteries_2v1', 'mutualiser_reserves', () => {
    renfort(2, 'recon', 1, 1);
    rappels.push('Les réserves mutualisées permettent à une reconnaissance de rejoindre le convoi à J2.');
  });
  if (scenario.code === 'aube_archives_secondaire') appliquer('aube_nuit_2v2', 'securiser_routes', () => {
    renfort(2, 'infanterie', 1, 1);
    rappels.push('La route sécurisée permet à une infanterie de rejoindre les archives à J2.');
  });
  if (scenario.code === 'aube_releve_1v3') appliquer('aube_convoi_secondaire', 'convoi_reserves', () => {
    renfort(2, 'transport', 11, 16); renfort(2, 'infanterie', 12, 16);
  });
  if (scenario.code === 'aube_routes_3v1') {
    appliquer('aube_convoi_secondaire', 'convoi_routes', crediter);
    appliquer('aube_archives_secondaire', 'archives_publiques', crediter);
    appliquer('aube_archives_secondaire', 'archives_reconnaissance', () => renfort(2, 'drone', 10, 2));
  }

  // --- Les mini-branches des bancs prêtés (`bancs.ts`). Chacune est bornée à
  // l'épreuve suivante et annoncée au briefing où l'on choisit le banc.
  if (scenario.code === 'couleurs_alliees') appliquer(cleSourceBanc('pacte_du_col'), 'cmd_tomas_reiner', () => {
    // Une case de plaine libre contre le QG du joueur (1,1) ; le moteur reporte
    // l'arrivée si elle est occupée, comme pour tout renfort.
    renfort(2, 'transport', 0, 2);
    ouvrir(REPLIQUES_BANC.couleurs_transport);
  });
  if (scenario.code === 'aube_nuit_2v2') appliquer(cleSourceBanc('aube_batteries_2v1'), 'cmd_tomas_reiner', () => {
    crediterDe(1500);
    ouvrir(REPLIQUES_BANC.nuit_fonds);
  });
  if (scenario.code === 'aube_routes_3v1') {
    appliquer(cleSourceBanc('aube_nuit_2v2'), 'cmd_solveig_tamm', () => ouvrir(REPLIQUES_BANC.routes_solveig));
    appliquer(cleSourceBanc('aube_nuit_2v2'), 'cmd_wren_osoko', () => ouvrir(REPLIQUES_BANC.routes_wren));
  }

  // --- Le banc de **cette** épreuve, appliqué en dernier : les répliques
  // ajoutées ci-dessus ont été écrites pour la distribution du canon, et
  // l'échange des bancs ne retire personne du terrain — seul un général venu
  // d'ailleurs (Wren à la ligne de nuit) fait quitter le sien au commandant du
  // joueur, et aucune branche ne le fait parler là.
  const banc = bancChoisi(scenario.code, prises.get(cleSourceBanc(scenario.code))?.choix);
  if (banc) {
    appliquerBanc(copie, banc);
    if (scenario.code === 'pacte_du_col') {
      // La première réplique disait « Tomas tient l'autre banc » : c'est
      // désormais Ariane, et c'est Tomas qui le dit.
      copie.dialogueOuverture = [REPLIQUES_BANC.pacte_du_col_echange, ...copie.dialogueOuverture.slice(1)];
    }
  }
  return { scenario: copie, rappels };
}

/**
 * Un chiffre par source de décision, dans l'ordre de `SOURCES_DECISION` ; les
 * anciennes graines, plus courtes, restent lisibles (`LONGUEURS_GRAINE`).
 */
export function graineAube(scenario: Scenario, decisions: readonly DecisionLocale[]): string {
  const chiffres = SOURCES_DECISION.map((source) => {
    const d = decisions.filter((x) => x.scenario === source && x.canonVersion === VERSION_CANON_AUBE).at(-1);
    return d ? optionsDecision(source).findIndex((o) => o.cle === d.choix) + 1 : 0;
  }).join('');
  return `${scenario.code}:a${VERSION_CANON_AUBE}:${chiffres}`;
}
/** Chaque longueur qu'une graine a pu avoir : deux, quatre, puis cinq choix, puis les bancs. */
const LONGUEURS_GRAINE = [2, 4, Object.keys(CHOIX_AUBE).length, SOURCES_DECISION.length];
export function decisionsDeGraine(scenario: Scenario, graine: string): DecisionLocale[] {
  const prefixe = `${scenario.code}:a${VERSION_CANON_AUBE}:`;
  if (!graine.startsWith(prefixe)) return [];
  // Le commandant choisi au briefing s'écrit en dernier segment de la graine et
  // ne se compte pas par position (`bancs.ts`) : on le retire avant de lire les
  // chiffres, sans quoi une longueur inattendue ferait perdre **toutes** les
  // décisions de l'épreuve.
  const chiffres = graineSansCommandant(graine).slice(prefixe.length);
  if (!LONGUEURS_GRAINE.includes(chiffres.length) || !/^[0-9]+$/.test(chiffres)) return [];
  return SOURCES_DECISION.flatMap((source, i) => {
    const option = optionsDecision(source)[Number(chiffres[i]) - 1];
    return option ? [{ scenario: source, scenarioVersion: 1, canonVersion: VERSION_CANON_AUBE, choix: option.cle }] : [];
  });
}
export const ETAPES_AUBE = ['aube_batteries_2v1', 'aube_reserves_1v2', 'aube_nuit_2v2', 'aube_releve_1v3', 'aube_routes_3v1'] as const;

export const CLES_QUETES_AUBE = ['aube_convoi_secondaire', 'aube_archives_secondaire'] as const;
export function estMissionAube(cle: string): boolean { return [...ETAPES_AUBE, ...CLES_QUETES_AUBE].some(c => c === cle); }
export function queteOuverte(cle: string, decisions: readonly DecisionLocale[]): boolean {
  const origine = cle === 'aube_convoi_secondaire' ? 'aube_batteries_2v1' : cle === 'aube_archives_secondaire' ? 'aube_nuit_2v2' : null;
  return origine !== null && decisions.some(d => d.scenario === origine && d.canonVersion === VERSION_CANON_AUBE && optionsDecision(origine).some(o => o.cle === d.choix));
}
