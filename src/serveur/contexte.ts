/**
 * Le contexte de travail d'une mission — ce que rend `GET /api/routines/missions/{id}`
 * (le `promptUrl`).
 *
 * On y met tout ce dont la routine a besoin **et rien de plus** : la cible, les
 * catalogues en lecture seule, les bornes, le champ `apprise`. Jamais une
 * autorisation : le prompt métier est une suggestion de travail, les garanties
 * sont côté serveur (`05-routines.md` §1.3).
 */

import { chargerGlossaireFr, chargerMecaniques, chargerTerrains, chargerUnites } from '../content/index';
import {
  cartes, commandants, depeches, evenements, glossaires, localesReq, pays, reviews,
  scenarios, traductions, unites,
} from '../db/requetes/index';
import { catalogueVersion } from './cycle';
import { echeance, HEURES } from './depeche';
import { construireApprise, CIBLES_PAR_ROUTINE } from './missions';
import { BIOMES, CLES_TERRAIN, SYMETRIES, type ClePrompt } from '../schemas/index';

/** Une ligne de mission, réduite à ce dont le contexte a besoin. */
export interface MissionMinimale {
  id: string;
  routine: ClePrompt;
  kind: string;
  cibleType: string;
  cibleCle: string;
  echeance: Date | null;
  contexte: Record<string, unknown>;
}

/** Bornes servies avec chaque mission : la routine les lit, le serveur les applique. */
export const BORNES_PAR_KIND: Record<string, Record<string, unknown>> = {
  'lore.pays': { post_max: 2, signes_max: 9000 },
  'lore.commandant': { post_max: 2, signes_max: 9000 },
  'map.carte': { post_max: 1, iterations_apercu: 1 },
  'map.depeche': { post_max: 1, iterations_apercu: 1, journees_visees: [10, 15], flags_autorises: [] },
  'controle.map': { post_max: 1, conditions_min: 3, conditions_max: 6, parties_max: 100 },
  'controle.scenario': { post_max: 1, conditions_min: 3, conditions_max: 6, parties_max: 100 },
  'controle.depeche': { post_max: 1, conditions_min: 3, conditions_max: 6, parties_max: 100 },
  'controle.lore': { post_max: 1 },
  'controle.evenement': { post_max: 1 },
  'controle.unite': { post_max: 1, cartes_reference: 8 },
  'cerveau.depeche': { post_max: 1, evenements_max: 1 },
  'cerveau.actualite': { post_max: 2 },
  'cerveau.memoire': { post_max: 4 },
  'cerveau.prompts': { post_max: 1 },
  'cerveau.homologation': { post_max: 1, traits_max: 2, modules_max: 3 },
  'traduction.lot': { post_max: 1, chaines_max: 60 },
};

/** Le schéma attendu en soumission, par `kind`. */
export const SCHEMA_PAR_KIND: Record<string, string> = {
  'lore.pays': 'Country+Commander+Scenario',
  'lore.commandant': 'Commander',
  'map.carte': 'ParametresCarte',
  'map.depeche': 'ParametresCarte+Scenario',
  'controle.map': 'ReviewVerdict',
  'controle.scenario': 'ReviewVerdict',
  'controle.depeche': 'ReviewVerdict',
  'controle.lore': 'ReviewVerdict',
  'controle.evenement': 'ReviewVerdict',
  'controle.unite': 'ReviewVerdict',
  'cerveau.depeche': 'Event',
  'cerveau.actualite': 'Event',
  'cerveau.memoire': 'MemoryEntry',
  'cerveau.prompts': 'PromptVersion',
  'cerveau.homologation': 'UnitType',
  'traduction.lot': 'Traduction[]',
};

/** Les extraits de bible servis au lore et au contrôle. */
export function extraitsBible(): Record<string, unknown> {
  const glossaire = chargerGlossaireFr();
  return {
    ton: 'Sport de haut niveau, jamais la guerre. On dit adversaire, match, manche, journée. Les unités sont mises hors jeu.',
    vocabulaire_interdit: glossaire.termesInterdits,
    charte_sensibilite:
      'Pays réels, jamais de conflit réel, de politique, d’élection, de religion, de catastrophe, '
      + 'de fait divers ni de personne réelle. Les clichés sont affectueux ou n’existent pas.',
  };
}

/** Construit le contexte complet d'une mission. */
export async function contexteDeMission(mission: MissionMinimale, base: string): Promise<Record<string, unknown>> {
  const cibles = CIBLES_PAR_ROUTINE[mission.routine];
  const apprise = cibles.length > 0
    ? construireApprise(await reviews.motifsRecents(cibles, 30))
    : [];

  const commun: Record<string, unknown> = {
    mission: mission.id,
    kind: mission.kind,
    schema: SCHEMA_PAR_KIND[mission.kind] ?? 'inconnu',
    cible: { type: mission.cibleType, cle: mission.cibleCle },
    bornes: BORNES_PAR_KIND[mission.kind] ?? { post_max: 1 },
    apprise,
    submitUrl: `${base}/api/routines/missions/${mission.id}/soumission`,
    ...(mission.echeance ? { echeance: mission.echeance.toISOString() } : {}),
  };

  if (mission.routine === 'atlas_lore') {
    const fiche = mission.cibleType === 'Country'
      ? (await pays.pays(mission.cibleCle))?.donnees ?? null
      : (await commandants.commandant(mission.cibleCle))?.donnees ?? null;
    return { ...commun, fiche, bible: extraitsBible() };
  }

  if (mission.routine === 'atlas_map') {
    const actives = (await unites.catalogue(['canon', 'homologuee', 'essai'])).map((u) => u.cle);
    const jour = String(mission.contexte['jour'] ?? new Date().toISOString().slice(0, 10));
    return {
      ...commun,
      intention: mission.contexte['intention'] ?? null,
      climat: {
        date: jour,
        note: 'date et saison sont calculées par le serveur : recopie-les, ne les modifie pas.',
        cycleJourNuitDefaut: { jour: 4, nuit: 2 },
      },
      catalogue: {
        biomes: BIOMES,
        terrains: CLES_TERRAIN,
        symetries: SYMETRIES,
        mecaniques_regionales: chargerMecaniques().map((m) => m.cle),
        catalogueVersion: await catalogueVersion(),
        unites_actives: actives.length > 0 ? actives : chargerUnites().map((u) => u.cle),
      },
      ...(mission.kind === 'map.depeche'
        ? { evenement: (await evenements.depecheDuJour(jour))?.donnees ?? null }
        : {}),
    };
  }

  if (mission.routine === 'atlas_controle') {
    return { ...commun, objet: await objetControle(mission), bible: extraitsBible() };
  }

  if (mission.routine === 'atlas_cerveau') {
    const jour = String(mission.contexte['jour'] ?? new Date().toISOString().slice(0, 10));
    return {
      ...commun,
      jour,
      ...(mission.kind === 'cerveau.depeche'
        ? { echeance: echeance(jour, 'proposition').toISOString(), heures: HEURES }
        : {}),
    };
  }

  if (mission.routine === 'atlas_traduction') {
    const locale = await localesReq.locale(mission.cibleCle);
    const glossaire = await glossaires.glossaire(mission.cibleCle);
    return {
      ...commun,
      locale,
      penurie: await traductions.penurie(mission.cibleCle),
      glossaire_present: glossaire !== null,
      lotUrl: `${base}/api/routines/traduction/lot?locale=${mission.cibleCle}&limite=60`,
    };
  }

  return commun;
}

/** L'objet à contrôler, quel que soit son type. */
async function objetControle(mission: MissionMinimale): Promise<unknown> {
  switch (mission.cibleType) {
    case 'MapDef': return (await cartes.carteParCode(mission.cibleCle)) ?? null;
    case 'Scenario': return (await scenarios.scenario(mission.cibleCle))?.donnees ?? null;
    case 'Commander': return (await commandants.commandant(mission.cibleCle))?.donnees ?? null;
    case 'Country': return (await pays.pays(mission.cibleCle))?.donnees ?? null;
    case 'Event': return (await evenements.evenement(mission.cibleCle))?.donnees ?? null;
    case 'UnitType': return (await unites.unite(mission.cibleCle))?.donnees ?? null;
    case 'MissionDuJour': return (await depeches.depeche(mission.cibleCle)) ?? null;
    default: return null;
  }
}

/** Les terrains canon, servis en lecture seule à la routine map. */
export function terrainsCanon(): unknown[] {
  return chargerTerrains();
}
