/**
 * Schéma Drizzle d'Atlas Tournament — miroir exact de `drizzle/0000_init.sql`.
 *
 * La migration SQL fait foi : ce fichier ne la génère pas, il la décrit pour que
 * les requêtes soient typées. Toute colonne ajoutée ici doit l'être là-bas, dans
 * une nouvelle migration `NNNN_*.sql`, jamais par modification d'une migration
 * déjà appliquée (`scripts/migrate.mjs`).
 *
 * Cette couche n'importe que `schemas` (`02-architecture.md` §5).
 */

import {
  boolean, char, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import type {
  CategorieEvent, ClePrompt, Commander, Country, Event, MapDef, MemoryEntry, MetriquesPrompt,
  ParametresCarte, Scenario, Silhouette, StatsSimulation, Statut, StatutPrompt, StatutUnite,
  Trait, UnitType,
} from '../schemas/index';

// ---------------------------------------------------------------------------
// 0. Compteurs globaux
// ---------------------------------------------------------------------------

/** `catalogue_version` et `chaines_version` : les deux entiers que le serveur incrémente. */
export const compteurs = pgTable('compteurs', {
  cle: text('cle').primaryKey().$type<'catalogue_version' | 'chaines_version'>(),
  valeur: integer('valeur').notNull().default(1),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 1. ai_prompts
// ---------------------------------------------------------------------------

/** Empreintes SHA-256 des sections verrouillées d'un prompt (`05-routines.md` §5.4). */
export type SectionsVerrouillees = Record<string, string>;

/** Historique complet des prompts métier : une seule ligne `courant` par clé. */
export const aiPrompts = pgTable('ai_prompts', {
  id: text('id').primaryKey(),
  cle: text('cle').notNull().$type<ClePrompt>(),
  version: integer('version').notNull(),
  corps: text('corps').notNull(),
  sections: jsonb('sections').notNull().$type<SectionsVerrouillees>().default({}),
  auteur: text('auteur').notNull().$type<'humain' | 'atlas_cerveau'>(),
  auteurRef: text('auteur_ref'),
  statut: text('statut').notNull().$type<StatutPrompt>().default('propose'),
  justification: text('justification').notNull().default(''),
  diffResume: jsonb('diff_resume').notNull().$type<string[]>().default([]),
  metriques: jsonb('metriques').$type<MetriquesPrompt | null>(),
  parentVersion: integer('parent_version'),
  valideParHumain: boolean('valide_par_humain').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  activeLe: timestamp('active_le', { withTimezone: true }),
}, (t) => [
  uniqueIndex('ai_prompts_cle_version_uniq').on(t.cle, t.version),
  uniqueIndex('ai_prompts_un_courant').on(t.cle).where(sql`statut = 'courant'`),
]);

// ---------------------------------------------------------------------------
// 2. routine_runs
// ---------------------------------------------------------------------------

/** Statut de fin d'un run de routine. */
export type StatutRun = 'en_cours' | 'ok' | 'partiel' | 'echec' | 'coupe';

/** Une erreur consignée dans un run : ni contenu, ni prose libre (`05` §1.8). */
export interface ErreurRun {
  missionId?: string;
  etape: string;
  code: string;
  detail?: string;
}

/** Journal des runs : une ligne par exécution, ouverte au premier `GET /missions`. */
export const routineRuns = pgTable('routine_runs', {
  id: text('id').primaryKey(),
  routine: text('routine').notNull().$type<ClePrompt>(),
  promptVersion: integer('prompt_version'),
  demarreLe: timestamp('demarre_le', { withTimezone: true }).notNull().defaultNow(),
  finiLe: timestamp('fini_le', { withTimezone: true }),
  statut: text('statut').notNull().$type<StatutRun>().default('en_cours'),
  missionsRecues: integer('missions_recues').notNull().default(0),
  missionsSoumises: integer('missions_soumises').notNull().default(0),
  appels: integer('appels').notNull().default(0),
  bilan: text('bilan'),
  erreurs: jsonb('erreurs').notNull().$type<ErreurRun[]>().default([]),
}, (t) => [
  index('routine_runs_routine_demarre').on(t.routine, t.demarreLe),
]);

// ---------------------------------------------------------------------------
// 3. routine_missions
// ---------------------------------------------------------------------------

/** Statut d'une mission de routine dans sa file. */
export type StatutMission = 'ouverte' | 'soumise' | 'rendue' | 'quarantaine' | 'expiree';

/** Missions réservées : c'est ce qui rend la reprise après run coupé possible. */
export const routineMissions = pgTable('routine_missions', {
  id: text('id').primaryKey(),
  routine: text('routine').notNull().$type<ClePrompt>(),
  kind: text('kind').notNull(),
  cibleType: text('cible_type').notNull(),
  cibleCle: text('cible_cle').notNull(),
  statut: text('statut').notNull().$type<StatutMission>().default('ouverte'),
  priorite: integer('priorite').notNull().default(100),
  echeance: timestamp('echeance', { withTimezone: true }),
  ouverteDepuis: timestamp('ouverte_depuis', { withTimezone: true }).notNull().defaultNow(),
  closeLe: timestamp('close_le', { withTimezone: true }),
  runId: text('run_id'),
  contexte: jsonb('contexte').notNull().$type<Record<string, unknown>>().default({}),
  reponse: jsonb('reponse').$type<Record<string, unknown> | null>(),
  idempotencyKey: text('idempotency_key'),
}, (t) => [
  index('routine_missions_file').on(t.routine, t.statut, t.priorite, t.ouverteDepuis),
]);

// ---------------------------------------------------------------------------
// 4. countries / commanders
// ---------------------------------------------------------------------------

/** Les 24 nations, copie miroir du canon pour que les routines lisent une seule source. */
export const countries = pgTable('countries', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  donnees: jsonb('donnees').notNull().$type<Country>(),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().default('atlas_lore'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('countries_statut').on(t.statut)]);

/** Les commandants, un par pays et par région phare. */
export const commanders = pgTable('commanders', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  paysCode: text('pays_code').notNull(),
  donnees: jsonb('donnees').notNull().$type<Commander>(),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().default('atlas_lore'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('commanders_pays').on(t.paysCode), index('commanders_statut').on(t.statut)]);

// ---------------------------------------------------------------------------
// 5. maps / scenarios
// ---------------------------------------------------------------------------

/** Aperçu texte d'une carte, renvoyé à la routine map après génération. */
export interface ApercuCarte {
  ascii: string;
  legende: Record<string, string>;
  mesures: Record<string, number | boolean>;
  commentaire?: string;
}

/** Cartes générées : `graine` + `parametres` suffisent à reconstruire `donnees`. */
export const maps = pgTable('maps', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  donnees: jsonb('donnees').$type<MapDef | null>(),
  graine: text('graine').notNull(),
  parametres: jsonb('parametres').notNull().$type<ParametresCarte>(),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  diagnostic: jsonb('diagnostic').$type<Record<string, number> | null>(),
  apercu: jsonb('apercu').$type<ApercuCarte | null>(),
  iterations: integer('iterations').notNull().default(0),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().default('atlas_map'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('maps_statut').on(t.statut)]);

/** Scénarios : `date` et `catalogue_version` sont des colonnes, pas seulement du jsonb. */
export const scenarios = pgTable('scenarios', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  mapId: text('map_id'),
  donnees: jsonb('donnees').notNull().$type<Scenario>(),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  acte: integer('acte').notNull().default(0),
  paysCode: text('pays_code').notNull(),
  date: date('date').notNull(),
  catalogueVersion: integer('catalogue_version').notNull().default(1),
  chainesVersion: integer('chaines_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().default('atlas_map'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('scenarios_date').on(t.date), index('scenarios_statut').on(t.statut)]);

// ---------------------------------------------------------------------------
// 6. reviews
// ---------------------------------------------------------------------------

/** Verdicts de contrôle : on ne supprime jamais une review. */
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  cle: text('cle').notNull(),
  cibleType: text('cible_type').notNull(),
  cibleCle: text('cible_cle').notNull(),
  cibleVersion: integer('cible_version').notNull().default(1),
  verdict: text('verdict').notNull().$type<'valide' | 'rejete'>(),
  motifs: jsonb('motifs').notNull().$type<{ code: string; detail?: string; mesure?: Record<string, number> }[]>().default([]),
  codesMotifs: text('codes_motifs').array().notNull().default(sql`'{}'`),
  stats: jsonb('stats').$type<StatsSimulation | { avec: StatsSimulation; sans: StatsSimulation } | null>(),
  coherenceLore: numeric('coherence_lore', { precision: 4, scale: 3 }),
  suggestions: jsonb('suggestions').notNull().$type<string[]>().default([]),
  routineRunId: text('routine_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('reviews_cible').on(t.cibleType, t.cibleCle),
  index('reviews_date').on(t.createdAt),
]);

// ---------------------------------------------------------------------------
// 7. events / actualite_items
// ---------------------------------------------------------------------------

/** Événements de jeu : aucun passage en ligne sans `valide_par_humain`. */
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  sourceUrl: text('source_url').notNull().default(''),
  sourceNom: text('source_nom').notNull().default(''),
  categorie: text('categorie').notNull().$type<CategorieEvent>(),
  donnees: jsonb('donnees').notNull().$type<Event>(),
  inspiration: jsonb('inspiration').$type<{ item_id: string; categorie: string } | null>(),
  depecheJour: date('depeche_jour'),
  debut: date('debut'),
  fin: date('fin'),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  valideParHumain: boolean('valide_par_humain').notNull().default(false),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().default('atlas_cerveau'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('events_statut').on(t.statut)]);

/** Le calendrier de récurrences et le digest : la première barrière de la liste blanche. */
export const actualiteItems = pgTable('actualite_items', {
  id: text('id').primaryKey(),
  categorie: text('categorie').notNull().$type<CategorieEvent>(),
  titre: text('titre').notNull(),
  date: date('date').notNull(),
  source: text('source').notNull().$type<'calendrier_interne' | 'digest_admin'>().default('calendrier_interne'),
  pays: text('pays').array().notNull().default(sql`'{}'`),
  utiliseLe: date('utilise_le'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('actualite_items_date').on(t.date)]);

// ---------------------------------------------------------------------------
// 8. memory
// ---------------------------------------------------------------------------

/** Mémoire structurée, datée, sourcée, expirante : jamais un texte qui grossit. */
export const memory = pgTable('memory', {
  id: text('id').primaryKey(),
  cle: text('cle').notNull().unique(),
  date: date('date').notNull(),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  sujet: text('sujet').notNull(),
  portee: text('portee').notNull(),
  porteeRef: text('portee_ref'),
  contenu: jsonb('contenu').notNull().$type<MemoryEntry>(),
  poids: integer('poids').notNull().default(1),
  occurrences: integer('occurrences').notNull().default(1),
  expireLe: date('expire_le'),
  archivee: boolean('archivee').notNull().default(false),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('memory_portee').on(t.portee, t.archivee, t.expireLe)]);

// ---------------------------------------------------------------------------
// 9. unit_types
// ---------------------------------------------------------------------------

/**
 * Le catalogue vivant. Deux axes cohabitent et ne se confondent jamais
 * (`05-routines.md` §1.4) : `statut` est la place dans le catalogue,
 * `statut_cycle` l'avancement de la candidate dans le pipeline de contenu.
 */
export const unitTypes = pgTable('unit_types', {
  id: text('id').primaryKey(),
  cle: text('cle').notNull().unique(),
  donnees: jsonb('donnees').notNull().$type<UnitType>(),
  statut: text('statut').notNull().$type<StatutUnite>().default('essai'),
  statutCycle: text('statut_cycle').notNull().$type<Statut>().default('brouillon'),
  catalogueVersion: integer('catalogue_version').notNull().default(1),
  traits: text('traits').array().notNull().$type<Trait[]>().default(sql`'{}'`),
  silhouette: jsonb('silhouette').notNull().$type<Silhouette>(),
  essaiJusquAu: date('essai_jusqu_au'),
  homologueeLe: date('homologuee_le'),
  sourceEventId: text('source_event_id'),
  version: integer('version').notNull().default(1),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('unit_types_statut').on(t.statut)]);

// ---------------------------------------------------------------------------
// 10. daily_missions
// ---------------------------------------------------------------------------

/** La Dépêche du jour. L'unicité de `date` est la garantie du « une par jour réel ». */
export const dailyMissions = pgTable('daily_missions', {
  id: text('id').primaryKey(),
  date: date('date').notNull().unique(),
  eventId: text('event_id'),
  scenarioId: text('scenario_id'),
  paysCode: text('pays_code'),
  statut: text('statut').notNull().$type<Statut>().default('brouillon'),
  expireLe: date('expire_le'),
  catalogueVersion: integer('catalogue_version').notNull().default(1),
  chainesVersion: integer('chaines_version').notNull().default(1),
  etapeManquee: text('etape_manquee'),
  validePar: text('valide_par'),
  valideLe: timestamp('valide_le', { withTimezone: true }),
  motifRefus: text('motif_refus'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('daily_missions_statut').on(t.statut, t.date)]);

// ---------------------------------------------------------------------------
// 11. locales / chaines_source / traductions / glossaires
// ---------------------------------------------------------------------------

/** Les langues. Ajouter une langue est une ligne ici, et rien d'autre. */
export const locales = pgTable('locales', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  nom: text('nom').notNull(),
  script: text('script').notNull(),
  sens: text('sens').notNull().default('ltr'),
  statut: text('statut').notNull().$type<'en_preparation' | 'active'>().default('en_preparation'),
  seuilCouverture: numeric('seuil_couverture', { precision: 4, scale: 3 }).notNull().default('1.0'),
  facteurLongueur: numeric('facteur_longueur', { precision: 4, scale: 3 }).notNull().default('1.0'),
  echantillonHumain: integer('echantillon_humain').notNull().default(20),
  ordre: integer('ordre').notNull().default(100),
  registre: text('registre').notNull().default(''),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('locales_ordre').on(t.ordre)]);

/** Les originaux français : `source_hash` et `placeholders` sont calculés par le serveur. */
export const chainesSource = pgTable('chaines_source', {
  cle: text('cle').primaryKey(),
  texte: text('texte').notNull(),
  origine: text('origine').notNull().$type<'interface' | 'canon' | 'genere'>(),
  contexte: jsonb('contexte').notNull().$type<{ ecran?: string; locuteur?: string; note?: string }>().default({}),
  longueurMax: integer('longueur_max'),
  placeholders: text('placeholders').array().notNull().default(sql`'{}'`),
  pluriel: boolean('pluriel').notNull().default(false),
  sourceHash: char('source_hash', { length: 16 }).notNull(),
  versionChaine: integer('version_chaine').notNull().default(1),
  objetRef: jsonb('objet_ref').$type<{ type: string; cle: string; champ: string } | null>(),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('chaines_source_origine').on(t.origine)]);

/** Les traductions : jamais de locale `fr`, unicité (clé, locale). */
export const traductions = pgTable('traductions', {
  id: text('id').primaryKey(),
  cleChaine: text('cle_chaine').notNull(),
  locale: text('locale').notNull(),
  texte: text('texte'),
  statut: text('statut').notNull().$type<'manquante' | 'brouillon' | 'validee' | 'perimee'>().default('manquante'),
  sourceHash: char('source_hash', { length: 16 }).notNull(),
  versionChaine: integer('version_chaine').notNull().default(1),
  auteur: text('auteur').notNull().$type<'atlas_traduction' | 'humain'>().default('atlas_traduction'),
  relueParHumain: boolean('relue_par_humain').notNull().default(false),
  runRef: text('run_ref'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('traductions_cle_locale').on(t.cleChaine, t.locale),
  index('traductions_penurie').on(t.locale, t.statut),
]);

/** Glossaires : propriété du canon, écrits par déploiement, jamais par une routine. */
export const glossaires = pgTable('glossaires', {
  id: text('id').primaryKey(),
  locale: text('locale').notNull().unique(),
  entrees: jsonb('entrees').notNull().$type<unknown[]>().default([]),
  termesInterdits: text('termes_interdits').array().notNull().default(sql`'{}'`),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});
