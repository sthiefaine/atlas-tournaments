import type { Scenario } from '../../schemas/index';
import type { DecisionLocale } from './progression';

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
export function optionsDecision(code: string): readonly { cle: string; titre: string; effet: string }[] {
  return CHOIX_AUBE[code as ScenarioDecision] ?? [];
}
export function cleDecision(scenario: string, version: number): string {
  return `${scenario}:${version}:${VERSION_CANON_AUBE}`;
}
export function libelleDecision(d: DecisionLocale): { titre: string; effet: string } | undefined {
  return optionsDecision(d.scenario).find((o) => o.cle === d.choix);
}

/** Repart toujours du canon : aucun bonus ne s'additionne au résultat précédent. */
export function appliquerConsequences(scenario: Scenario, decisions: readonly DecisionLocale[]): { scenario: Scenario; rappels: string[] } {
  const copie: Scenario = structuredClone(scenario);
  const rappels: string[] = [];
  const prises = new Map(decisions.filter((d) => d.canonVersion === VERSION_CANON_AUBE).map((d) => [d.scenario, d]));
  const appliquer = (origine: string, choix: string, effet: () => void): void => {
    const d = prises.get(origine);
    if (!d || d.choix !== choix) return;
    effet();
    const texte = libelleDecision(d);
    if (texte) rappels.push(`${texte.titre} — ${texte.effet}`);
  };
  const crediter = (): void => {
    copie.fondsDepartParCamp = { ...copie.fondsDepartParCamp, 0: (copie.fondsDepartParCamp?.[0] ?? scenario.fondsDepart) + 2000 };
  };
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
  return { scenario: copie, rappels };
}

/** Un chiffre par décision ; les anciennes graines à deux chiffres restent lisibles. */
export function graineAube(scenario: Scenario, decisions: readonly DecisionLocale[]): string {
  const chiffres = Object.keys(CHOIX_AUBE).map((source) => {
    const d = decisions.filter((x) => x.scenario === source && x.canonVersion === VERSION_CANON_AUBE).at(-1);
    return d ? optionsDecision(source).findIndex((o) => o.cle === d.choix) + 1 : 0;
  }).join('');
  return `${scenario.code}:a${VERSION_CANON_AUBE}:${chiffres}`;
}
export function decisionsDeGraine(scenario: Scenario, graine: string): DecisionLocale[] {
  const prefixe = `${scenario.code}:a${VERSION_CANON_AUBE}:`;
  if (!graine.startsWith(prefixe)) return [];
  const chiffres = graine.slice(prefixe.length);
  if (![2, 4, Object.keys(CHOIX_AUBE).length].includes(chiffres.length) || !/^[0-2]+$/.test(chiffres)) return [];
  return Object.keys(CHOIX_AUBE).flatMap((source, i) => {
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
