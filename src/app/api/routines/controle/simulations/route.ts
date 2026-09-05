/**
 * `POST /api/routines/controle/simulations` — la campagne de simulation headless
 * (`05-routines.md` §4.2).
 *
 * Deux formes sur le même endpoint : une **carte** sous plusieurs conditions de
 * climat, ou un **catalogue candidat** joué avec et sans l'unité. Dans les deux
 * cas, le moteur tourne **sur le serveur** : la routine ne simule rien elle-même.
 *
 * Le moteur est branché : `simulateurCourant()` va chercher la carte ou l'unité
 * candidate en base et fait tourner `engine/` et `ai/` ici même. Si la cible est
 * introuvable, la campagne échoue en `503 {"error":"simulation_indisponible"}` —
 * un chiffre inventé serait pire qu'un refus net, parce qu'un verdict
 * s'appuierait dessus.
 */

import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import {
  BORNES_SIMULATION, bornerCampagne, CONDITIONS_PAR_DEFAUT, conditionsSansDoublon,
  jsonCarte, jsonCatalogue, simulateurCourant, type ConditionClimat,
} from '@/serveur/simulation';
import { METEOS, PHASES_JOUR, SAISONS, STRATEGIES_IA, type StrategieIa } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function lireProfils(brut: unknown): StrategieIa[] | null {
  if (brut === undefined || brut === null) return ['ponderee'];
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > 4) return null;
  const profils: StrategieIa[] = [];
  for (const p of brut) {
    if (typeof p !== 'string' || !(STRATEGIES_IA as readonly string[]).includes(p)) return null;
    profils.push(p as StrategieIa);
  }
  return profils;
}

function lireConditions(brut: unknown): ConditionClimat[] | 'invalide' {
  if (brut === undefined || brut === null) return [...CONDITIONS_PAR_DEFAUT];
  if (!Array.isArray(brut)) return 'invalide';
  const conditions: ConditionClimat[] = [];
  for (const c of brut) {
    if (typeof c !== 'object' || c === null) return 'invalide';
    const o = c as Record<string, unknown>;
    const saison = o['saison'];
    const meteo = o['meteo'];
    const phase = o['phase'];
    if (typeof saison !== 'string' || !(SAISONS as readonly string[]).includes(saison)) return 'invalide';
    if (typeof meteo !== 'string' || !(METEOS as readonly string[]).includes(meteo)) return 'invalide';
    if (typeof phase !== 'string' || !(PHASES_JOUR as readonly string[]).includes(phase)) return 'invalide';
    conditions.push({ saison, meteo, phase } as ConditionClimat);
  }
  return conditions;
}

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  if (typeof corps.valeur !== 'object' || corps.valeur === null) {
    return erreur('charge_invalide', 400, 'un objet JSON est attendu');
  }
  const o = corps.valeur as Record<string, unknown>;

  const profils = lireProfils(o['profils_ia']);
  if (!profils) return erreur('profils_invalides', 422, `profils attendus parmi : ${STRATEGIES_IA.join(', ')}`);
  const journeesMax = Math.min(Number(o['journees_max'] ?? 60) || 60, BORNES_SIMULATION.journeesMaxMax);
  const partiesDemandees = Math.max(1, Number(o['parties'] ?? 40) || 40);

  // Forme « catalogue » : une unité candidate, jouée avec et sans.
  const candidat = o['catalogueCandidat'];
  if (candidat !== undefined && candidat !== null) {
    if (typeof candidat !== 'object') return erreur('charge_invalide', 422, 'catalogueCandidat doit être un objet');
    const c = candidat as Record<string, unknown>;
    const uniteCle = c['uniteCle'];
    const version = c['catalogueVersion'];
    if (typeof uniteCle !== 'string' || !Number.isInteger(version)) {
      return erreur('charge_invalide', 422, 'catalogueCandidat = {uniteCle, catalogueVersion}');
    }
    const { parties } = bornerCampagne(partiesDemandees, 1);
    const resultat = await simulateurCourant().simulerCatalogue({
      uniteCle, catalogueVersion: version as number, parties, profilsIa: profils, journeesMax,
    });
    return json(jsonCatalogue(resultat));
  }

  // Forme « carte » : au moins trois conditions, six au plus, sans doublon.
  const mapId = o['map_id'];
  if (typeof mapId !== 'string' || mapId === '') {
    return erreur('charge_invalide', 422, 'map_id ou catalogueCandidat attendu');
  }
  const conditions = lireConditions(o['conditions']);
  if (conditions === 'invalide') {
    return erreur('conditions_invalides', 422, 'chaque condition est un triplet {saison, meteo, phase}');
  }
  if (conditions.length < BORNES_SIMULATION.conditionsMin || conditions.length > BORNES_SIMULATION.conditionsMax) {
    return erreur('conditions_hors_bornes', 422,
      `${BORNES_SIMULATION.conditionsMin} conditions au minimum, ${BORNES_SIMULATION.conditionsMax} au maximum`);
  }
  if (!conditionsSansDoublon(conditions)) {
    return erreur('condition_dupliquee', 422, 'deux fois la même condition n’apporte rien');
  }

  const { parties, retrograde } = bornerCampagne(partiesDemandees, conditions.length);
  const resultat = await simulateurCourant().simulerCarte({
    mapId, parties, profilsIa: profils, journeesMax, conditions,
  });
  return json(jsonCarte(resultat, retrograde ? parties : undefined));
});
