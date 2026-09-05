/**
 * Ce qu'il y a à faire, routine par routine.
 *
 * La file de missions (`missions.ts`) sait trier, reprendre et habiller ; ce
 * fichier-ci sait **d'où vient le travail**. Séparer les deux évite qu'une règle
 * de priorité se cache dans une requête SQL.
 *
 * Le principe est toujours le même : le serveur regarde l'état de la base, en
 * déduit des cibles, et une mission naît par cible. Une routine ne devine jamais.
 */

import {
  cartes, commandants, depeches as requetesDepeches, evenements, pays, scenarios,
  traductions, unites,
} from '../db/requetes/index';
import { echeance, jourLocal, passee } from './depeche';
import { PRIORITE, type CandidatMission } from './missions';
import type { ClePrompt } from '../schemas/index';

/** Le travail en attente pour `atlas_lore` : ce qui a été rejeté revient. */
export async function candidatsLore(): Promise<CandidatMission[]> {
  const sortie: CandidatMission[] = [];
  for (const p of await pays.parStatut(['rejete'])) {
    sortie.push({ kind: 'lore.pays', cibleType: 'Country', cibleCle: p.code, priorite: p.donnees.phare ? PRIORITE.phare : PRIORITE.fond });
  }
  for (const c of await commandants.parStatut(['rejete'])) {
    sortie.push({ kind: 'lore.commandant', cibleType: 'Commander', cibleCle: c.code, priorite: PRIORITE.fond });
  }
  return sortie;
}

/**
 * Le travail de `atlas_map`. La Dépêche du jour passe devant tout : sa mission
 * porte une `echeance`, et elle n'est ouverte que si l'événement du jour existe
 * et que l'échéance de scénario n'est pas passée.
 */
export async function candidatsMap(maintenant = new Date()): Promise<CandidatMission[]> {
  const sortie: CandidatMission[] = [];
  const jour = jourLocal(maintenant);
  const depeche = await requetesDepeches.depeche(jour);
  if (depeche && depeche.scenarioId === null && !passee(jour, 'scenario', maintenant)) {
    sortie.push({
      kind: 'map.depeche',
      cibleType: 'MissionDuJour',
      cibleCle: jour,
      priorite: PRIORITE.depeche,
      echeance: echeance(jour, 'scenario'),
      contexte: { jour },
    });
  }
  for (const c of await cartes.parStatut(['rejete'], 20)) {
    sortie.push({ kind: 'map.carte', cibleType: 'MapDef', cibleCle: c.code, priorite: PRIORITE.fond });
  }
  return sortie;
}

/**
 * Le travail de `atlas_controle` : tout ce qui est en brouillon. C'est la routine
 * la plus fréquente parce qu'elle est le goulot — tout attend son passage.
 */
export async function candidatsControle(maintenant = new Date()): Promise<CandidatMission[]> {
  const sortie: CandidatMission[] = [];
  const jour = jourLocal(maintenant);
  const depeche = await requetesDepeches.depeche(jour);
  if (depeche && depeche.scenarioId !== null && depeche.statut === 'brouillon'
      && !passee(jour, 'certification', maintenant)) {
    sortie.push({
      kind: 'controle.depeche',
      cibleType: 'MissionDuJour',
      cibleCle: jour,
      priorite: PRIORITE.depeche,
      echeance: echeance(jour, 'certification'),
      contexte: { jour },
    });
  }
  for (const c of await cartes.parStatut(['brouillon'], 20)) {
    sortie.push({ kind: 'controle.map', cibleType: 'MapDef', cibleCle: c.code, priorite: PRIORITE.controle });
  }
  for (const s of await scenarios.parStatut(['brouillon'], 20)) {
    sortie.push({ kind: 'controle.scenario', cibleType: 'Scenario', cibleCle: s.code, priorite: PRIORITE.controle });
  }
  for (const c of await commandants.parStatut(['brouillon'])) {
    sortie.push({ kind: 'controle.lore', cibleType: 'Commander', cibleCle: c.code, priorite: PRIORITE.controle });
  }
  for (const p of await pays.parStatut(['brouillon'])) {
    sortie.push({ kind: 'controle.lore', cibleType: 'Country', cibleCle: p.code, priorite: PRIORITE.controle });
  }
  for (const e of await evenements.parStatut(['brouillon'], 20)) {
    sortie.push({ kind: 'controle.evenement', cibleType: 'Event', cibleCle: e.code, priorite: PRIORITE.controle });
  }
  for (const u of await unites.catalogue()) {
    if (u.statutCycle === 'brouillon') {
      sortie.push({ kind: 'controle.unite', cibleType: 'UnitType', cibleCle: u.cle, priorite: PRIORITE.controle });
    }
  }
  return sortie;
}

/**
 * Le travail de `atlas_cerveau`. Les cinq volets sont combinables : le serveur
 * décide de la composition du run, la routine traite ce qu'on lui donne.
 * `cerveau.depeche` est le seul qui porte une heure limite.
 */
export async function candidatsCerveau(maintenant = new Date()): Promise<CandidatMission[]> {
  const sortie: CandidatMission[] = [];
  const jour = jourLocal(maintenant);
  const dejaPropose = await evenements.depecheDuJour(jour);
  if (!dejaPropose && !passee(jour, 'proposition', maintenant)) {
    sortie.push({
      kind: 'cerveau.depeche',
      cibleType: 'MissionDuJour',
      cibleCle: jour,
      priorite: PRIORITE.depeche,
      echeance: echeance(jour, 'proposition'),
      contexte: { jour },
    });
  }
  sortie.push({ kind: 'cerveau.actualite', cibleType: 'Fenetre', cibleCle: jour, priorite: PRIORITE.fond });
  sortie.push({ kind: 'cerveau.memoire', cibleType: 'Fenetre', cibleCle: jour, priorite: PRIORITE.fond });
  // Volets hebdomadaires : le lundi, comme la tâche planifiée `40 5 * * 1`.
  if (maintenant.getUTCDay() === 1) {
    sortie.push({ kind: 'cerveau.prompts', cibleType: 'Semaine', cibleCle: jour, priorite: PRIORITE.fond });
    sortie.push({ kind: 'cerveau.homologation', cibleType: 'Semaine', cibleCle: jour, priorite: PRIORITE.fond });
  }
  return sortie;
}

/**
 * Le travail de `atlas_traduction` : **une seule langue par run**, la plus en
 * retard, choisie par le serveur. La routine ne connaît pas la liste des langues.
 */
export async function candidatsTraduction(): Promise<CandidatMission[]> {
  const penuries = await traductions.penuries();
  const cible = penuries.find((p) => p.manquantes + p.perimees > 0);
  if (!cible) return [];
  return [{
    kind: 'traduction.lot',
    cibleType: 'Locale',
    cibleCle: cible.locale,
    priorite: PRIORITE.fond,
    contexte: { penurie: cible },
  }];
}

/** Le travail en attente d'une routine, quelle qu'elle soit. */
export async function candidatsDe(routine: ClePrompt, maintenant = new Date()): Promise<CandidatMission[]> {
  switch (routine) {
    case 'atlas_lore': return candidatsLore();
    case 'atlas_map': return candidatsMap(maintenant);
    case 'atlas_controle': return candidatsControle(maintenant);
    case 'atlas_cerveau': return candidatsCerveau(maintenant);
    case 'atlas_traduction': return candidatsTraduction();
    default: return [];
  }
}
