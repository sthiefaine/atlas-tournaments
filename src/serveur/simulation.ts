/**
 * La simulation headless, côté serveur.
 *
 * La routine contrôle ne fait tourner aucun code : elle demande au serveur une
 * campagne et lit les statistiques renvoyées (`05-routines.md` §4.1). Le moteur
 * (`src/engine/`) et l'IA (`src/ai/`) tournent ici, dans la même version que
 * celle qui servira aux joueurs.
 *
 * Ce fichier est **la seule frontière** entre le serveur et le moteur. Il expose
 * trois choses :
 *
 * - `simuler(demande)` — la campagne pure : une carte (ou un scénario), une liste
 *   de conditions de climat, N parties par condition, et un `StatsSimulation`
 *   agrégé plus un par condition. Aucune base de données, aucune horloge dans le
 *   résultat sauf le temps mesuré : **même requête, mêmes chiffres** ;
 * - `simulateurCourant()` — l'implémentation branchée sur les routes, qui va
 *   chercher la carte ou l'unité candidate en base avant d'appeler `simuler` ;
 * - les bornes serveur (§4.2, §4.4) et la sérialisation JSON attendue par la
 *   routine.
 *
 * Le déterminisme vient d'une **graine dérivée de la demande** : la carte, les
 * conditions, le nombre de parties, les stratégies et la limite de journées sont
 * hachés ensemble, et chaque partie tire sa graine de ce condensé. Deux appels
 * identiques rejouent exactement les mêmes parties.
 */

import { strategie } from '../ai/index';
import {
  appliquer, catalogueDepuis, chargerCatalogue, creerPartie, creerRng, fnv1a,
  meteoDominante, meteoPossible, sceneDepuis,
  type Action, type Catalogue, type EtatPartie, type EvenementJeu, type Rng,
} from '../engine/index';
import { chargerDegats, chargerUnites } from '../content/index';
import { genererCarte } from '../mapgen/index';
import { cartes as requetesCartes, unites as requetesUnites } from '../db/requetes/index';
import type {
  CampId, Climat, Hemisphere, MapDef, Meteo, ParametresCarte, PhaseJour,
  Saison, Scenario, StatsSimulation, StrategieIa, Terrain, UnitType,
} from '../schemas/index';
import { erreur } from './reponses';

/** Une condition de climat d'une campagne : un triplet saison × météo × phase. */
export interface ConditionClimat {
  saison: Saison;
  meteo: Meteo;
  phase: PhaseJour;
}

/** Demande de campagne sur une carte, sous plusieurs climats. */
export interface DemandeCarte {
  mapId: string;
  parties: number;
  profilsIa: StrategieIa[];
  journeesMax: number;
  conditions: ConditionClimat[];
}

/** Demande de campagne sur un catalogue candidat : avec et sans l'unité. */
export interface DemandeCatalogue {
  uniteCle: string;
  catalogueVersion: number;
  parties: number;
  profilsIa: StrategieIa[];
  journeesMax: number;
}

/** Le détail d'une condition dans une réponse de campagne. */
export interface LigneCondition {
  condition: ConditionClimat;
  stats: StatsSimulation;
  horsSchema: Record<string, number>;
}

/** Réponse d'une campagne de carte. `stats` est l'agrégat de toutes les conditions. */
export interface ResultatCarte {
  simulationId: string;
  dureeCalculMs: number;
  stats: StatsSimulation;
  conditionsEcartees: ConditionClimat[];
  parCondition: LigneCondition[];
  horsSchema: Record<string, number>;
}

/** Réponse d'une campagne de catalogue. */
export interface ResultatCatalogue {
  simulationId: string;
  catalogueVersion: number;
  cartesReference: string[];
  avec: { stats: StatsSimulation };
  sans: { stats: StatsSimulation };
  horsSchema: Record<string, number>;
}

/** Ce que le serveur sait faire tourner. Une seule frontière avec `engine/` et `ai/`. */
export interface Simulateur {
  /** Vrai quand le moteur est branché : la sonde et l'administration le lisent. */
  readonly disponible: boolean;
  /** Nom de l'implémentation, pour le journal et l'administration. */
  readonly nom: string;
  simulerCarte(demande: DemandeCarte): Promise<ResultatCarte>;
  simulerCatalogue(demande: DemandeCatalogue): Promise<ResultatCatalogue>;
}

/** Erreur levée par un simulateur absent : elle se traduit en `503`. */
export class SimulationIndisponible extends Error {
  /** Code stable renvoyé au client. */
  readonly code = 'simulation_indisponible';

  constructor(detail = 'le moteur de simulation n’est pas encore branché sur ce serveur') {
    super(detail);
    this.name = 'SimulationIndisponible';
  }
}

/**
 * L'implémentation de repli : elle ne simule rien et le dit franchement. Mieux
 * vaut un `503` net qu'une statistique inventée — un verdict de contrôle fondé
 * sur des chiffres faux serait pire que pas de verdict du tout. Elle reste
 * exportée : c'est ce qu'on branche si le moteur venait à être retiré.
 */
export const simulateurIndisponible: Simulateur = {
  disponible: false,
  nom: 'indisponible',
  simulerCarte(): Promise<ResultatCarte> {
    return Promise.reject(new SimulationIndisponible());
  },
  simulerCatalogue(): Promise<ResultatCatalogue> {
    return Promise.reject(new SimulationIndisponible());
  },
};

/** La réponse `503 {"error":"simulation_indisponible"}`. */
export function reponseSimulationIndisponible(detail?: string): Response {
  return erreur('simulation_indisponible', 503, detail ?? new SimulationIndisponible().message);
}

/** Vrai si l'erreur attrapée est une indisponibilité de simulation. */
export function estIndisponible(e: unknown): e is SimulationIndisponible {
  return e instanceof SimulationIndisponible;
}

// ---------------------------------------------------------------------------
// Bornes serveur des campagnes (`05-routines.md` §4.2 et §4.4)
// ---------------------------------------------------------------------------

/** Bornes que le serveur applique lui-même, quoi que demande la routine. */
export const BORNES_SIMULATION = {
  partiesParCondition: 100,
  partiesTotal: 240,
  conditionsMin: 3,
  conditionsMax: 6,
  journeesMaxMax: 120,
  cartesReferenceCatalogue: 8,
} as const;

/** Le sextuor par défaut, servi quand la routine envoie `conditions: null`. */
export const CONDITIONS_PAR_DEFAUT: readonly ConditionClimat[] = [
  { saison: 'ete', meteo: 'clair', phase: 'jour' },
  { saison: 'hiver', meteo: 'neige', phase: 'jour' },
  { saison: 'automne', meteo: 'brouillard', phase: 'nuit' },
  { saison: 'printemps', meteo: 'pluie', phase: 'jour' },
  { saison: 'ete', meteo: 'canicule', phase: 'jour' },
  { saison: 'hiver', meteo: 'tempete', phase: 'nuit' },
];

/**
 * Applique les bornes serveur : `parties` est rétrogradé si le produit
 * `parties × conditions` dépasse 240, et la réponse le dit.
 */
export function bornerCampagne(parties: number, conditions: number): { parties: number; retrograde: boolean } {
  const borne = Math.min(parties, BORNES_SIMULATION.partiesParCondition);
  const total = borne * Math.max(1, conditions);
  if (total <= BORNES_SIMULATION.partiesTotal) return { parties: borne, retrograde: borne !== parties };
  const reduit = Math.max(1, Math.floor(BORNES_SIMULATION.partiesTotal / Math.max(1, conditions)));
  return { parties: reduit, retrograde: true };
}

/** Refuse les doublons de conditions : deux fois la même case n'apporte rien. */
export function conditionsSansDoublon(conditions: readonly ConditionClimat[]): boolean {
  const vues = new Set(conditions.map((c) => `${c.saison}|${c.meteo}|${c.phase}`));
  return vues.size === conditions.length;
}

/**
 * Écarte les conditions impossibles pour le climat du pays — pas de `neige` en
 * climat tropical. Ce n'est pas une erreur, c'est une information (§4.2). Si tout
 * est écarté, on rend la météo dominante de chaque saison demandée : une carte
 * doit être jouée, pas classée sans suite.
 */
export function conditionsAtteignables(
  conditions: readonly ConditionClimat[], climat: Climat,
): { retenues: ConditionClimat[]; ecartees: ConditionClimat[] } {
  const retenues: ConditionClimat[] = [];
  const ecartees: ConditionClimat[] = [];
  for (const c of conditions) {
    if (meteoPossible(climat, c.saison, c.meteo)) retenues.push(c);
    else ecartees.push(c);
  }
  if (retenues.length > 0) return { retenues, ecartees };
  const repli: ConditionClimat[] = [];
  const vues = new Set<string>();
  for (const c of ecartees) {
    const remplacante: ConditionClimat = {
      saison: c.saison, meteo: meteoDominante(climat, c.saison), phase: c.phase,
    };
    const k = `${remplacante.saison}|${remplacante.meteo}|${remplacante.phase}`;
    if (vues.has(k)) continue;
    vues.add(k);
    repli.push(remplacante);
  }
  return { retenues: repli, ecartees };
}

// ---------------------------------------------------------------------------
// La campagne : partie pure, sans base de données
// ---------------------------------------------------------------------------

/** Une unité candidate soumise au catalogue existant (§9). */
export interface CatalogueCandidat {
  unite: UnitType;
  catalogueVersion: number;
}

/** Ce qu'on demande au moteur : une carte ou un scénario, et des conditions. */
export interface DemandeSimulation {
  /** La carte à jouer. Obligatoire : un scénario ne porte que sa clé de carte. */
  carte: MapDef;
  /** Le scénario, s'il existe. Sinon un scénario minimal est construit. */
  scenario?: Scenario;
  /** Les conditions de climat. Vide ou absent : le sextuor par défaut. */
  conditions?: readonly ConditionClimat[];
  /** Parties **par condition**, bornées à 100 et à 240 au total. */
  parties: number;
  /** Les profils d'IA, un par camp, tournants d'une partie à l'autre. */
  strategies: StrategieIa[];
  /** Limite de journées d'une partie. */
  journeesMax?: number;
  /** Climat du pays qui reçoit : il décide des conditions atteignables. */
  climatPays?: Climat;
  /** Hémisphère du pays : il décide de la saison à une date donnée. */
  hemisphere?: Hemisphere;
  /** Graine explicite. Absente, elle est dérivée de la demande. */
  graine?: string;
  /** Une unité candidate : la campagne est alors jouée deux fois (§9). */
  catalogueCandidat?: CatalogueCandidat;
  /** Le lot de cartes de référence d'une campagne de catalogue. */
  cartesReference?: readonly MapDef[];
}

/** Ce que rend une campagne. */
export interface ResultatSimulation {
  simulationId: string;
  dureeCalculMs: number;
  stats: StatsSimulation;
  conditionsEcartees: ConditionClimat[];
  parCondition: LigneCondition[];
  horsSchema: Record<string, number>;
  /** Renseignés seulement pour une campagne de catalogue. */
  avec?: { stats: StatsSimulation };
  sans?: { stats: StatsSimulation };
  cartesReference?: string[];
  catalogueVersion?: number;
  partiesRetrogradees?: number;
}

/** Cycle jour/nuit qui force une phase entière : le pire cas de vision. */
export function cycleDePhase(phase: PhaseJour): { jour: number; nuit: number } {
  return phase === 'nuit' ? { jour: 0, nuit: 6 } : { jour: 6, nuit: 0 };
}

/** Date de référence d'une saison, hémisphère nord : le cœur de la saison. */
export function dateDeSaison(saison: Saison, hemisphere: Hemisphere = 'nord'): string {
  const nord: Record<Saison, string> = {
    printemps: '2026-04-15', ete: '2026-07-15', automne: '2026-10-15', hiver: '2026-01-15',
  };
  const sud: Record<Saison, string> = {
    printemps: '2026-10-15', ete: '2026-01-15', automne: '2026-04-15', hiver: '2026-07-15',
  };
  return hemisphere === 'sud' ? sud[saison] : nord[saison];
}

/**
 * Construit un scénario minimal depuis une carte seule : deux camps (ou autant
 * que la carte en déclare), commandants neutres, cycle jour/nuit par défaut,
 * version de catalogue courante. La date est imposée par la condition jouée —
 * c'est elle qui fixe la saison quand aucun `climatFixe` ne la force.
 */
export function scenarioMinimal(carte: MapDef, catalogueVersion = 1, date = '2026-09-05'): Scenario {
  const commandants = [];
  for (let camp = 0; camp < carte.camps; camp += 1) {
    commandants.push({ camp: camp as CampId, commandantCle: 'cmd_neutre' });
  }
  return {
    cle: `sim_${carte.code}`,
    version: 1,
    statut: 'brouillon',
    source: 'atlas_map',
    creeLe: date,
    majLe: date,
    code: `sim_${carte.code}`.slice(0, 48),
    nom: `Simulation — ${carte.nom}`,
    acte: 0,
    paysCode: 'fr',
    carteCle: carte.code,
    date,
    cycleJourNuit: { jour: 4, nuit: 2 },
    catalogueVersion,
    commandants,
    fondsDepart: 5000,
    revenusParBatiment: 1000,
    brouillard: false,
    limiteJournees: 40,
    victoire: [{ type: 'capture_qg' }, { type: 'hors_jeu_total' }],
    defaite: [{ type: 'qg_perdu' }, { type: 'toutes_unites_hors_jeu' }],
    dialogueOuverture: [],
    dialogueVictoire: [],
    dialogueDefaite: [],
    choix: [],
    flagsRequis: [],
    flagsInterdits: [],
    recompenses: { flags: [] },
  };
}

/** Le catalogue d'une campagne : le canon, plus l'unité candidate s'il y en a une. */
export function catalogueAvec(candidat: UnitType | null, version = 1): Catalogue {
  const base = chargerCatalogue(version);
  const unites = base.cles.map((c) => base.unites[c]!);
  const terrains = Object.values(base.terrains);
  if (candidat === null) return catalogueDepuis(version, unites, terrains, chargerDegats());
  // Une unité nouvelle doit pouvoir être produite quelque part, sinon la
  // campagne « avec » est identique à la campagne « sans » et ne mesure rien.
  const batiment = candidat.domaine === 'air' ? 'aeroport' : 'usine';
  const enrichis: Terrain[] = terrains.map((t) => (
    t.cle === batiment && !t.produit.includes(candidat.cle)
      ? { ...t, produit: [...t.produit, candidat.cle] }
      : t
  ));
  return catalogueDepuis(version, [...unites, candidat], enrichis, chargerDegats());
}

/** Mesures d'une partie jouée, au-delà de ce que le moteur garde dans l'état. */
interface BilanPartie {
  journees: number;
  terminee: boolean;
  vainqueur: number | null;
  motif: string | null;
  fonds: number[];
  produites: Record<string, number>;
  producteurs: Record<string, Set<number>>;
  mecaniqueDeclenchee: boolean;
  premierContact: number | null;
  degatsParType: Record<string, number>;
  capturesParType: Record<string, number>;
  visitees: string[];
}

/**
 * Joue une partie entière et rend, en plus de l'état final, le flux d'événements
 * agrégé. C'est la boucle de `ai/jouerPartie`, pas pour pas : même branchement de
 * flux (`camp<n>` puis `ia`), même garde-fou d'actions, même sortie sur tour
 * vide. La seule différence est qu'on lit les événements que `appliquer` rend,
 * au lieu de les laisser filer — le journal de l'état est plafonné et ne suffit
 * pas à mesurer une partie longue.
 */
function jouerPartieInstrumentee(
  depart: EtatPartie, strategies: StrategieIa[], rng: Rng, cat: Catalogue, toursMax: number,
): BilanPartie {
  const degatsParType: Record<string, number> = {};
  const capturesParType: Record<string, number> = {};
  let premierContact: number | null = null;
  let courant = depart;

  for (let tour = 0; tour < toursMax && !courant.partie.terminee; tour += 1) {
    const strat = strategie(strategies[courant.campCourant] ?? 'ponderee');
    const flux = rng.branche(`camp${courant.campCourant}`).branche('ia');
    const campDepart = courant.campCourant;
    let jouees = 0;

    for (let i = 0; i < ACTIONS_MAX_PAR_TOUR; i += 1) {
      if (courant.partie.terminee) break;
      const typeParId = new Map<string, string>();
      for (const u of courant.unites) typeParId.set(u.id, u.type);
      const action: Action = strat.choisirAction(courant, courant.campCourant, flux, cat);
      const r = appliquer(courant, action, cat, []);
      if (!r.ok) {
        if (action.type === 'finTour') break;
        const fin = appliquer(courant, { type: 'finTour' }, cat, []);
        if (fin.ok) {
          courant = fin.etat;
          jouees += 1;
        }
        break;
      }
      lireEvenements(r.evenements, typeParId, degatsParType, capturesParType, courant.journee, (j) => {
        if (premierContact === null) premierContact = j;
      });
      courant = r.etat;
      jouees += 1;
      if (action.type === 'finTour') break;
      if (courant.campCourant !== campDepart) break;
    }
    if (jouees === 0) break;
  }

  const produites: Record<string, number> = {};
  const producteurs: Record<string, Set<number>> = {};
  for (const [k, n] of Object.entries(courant.produites)) {
    const morceaux = k.split(':');
    const camp = Number(morceaux[0]);
    const type = morceaux[1] ?? k;
    produites[type] = (produites[type] ?? 0) + n;
    (producteurs[type] ??= new Set<number>()).add(Number.isFinite(camp) ? camp : 0);
  }

  return {
    journees: courant.journee,
    terminee: courant.partie.terminee,
    vainqueur: courant.partie.vainqueur,
    motif: courant.partie.motif,
    fonds: courant.camps.map((c) => c.fonds),
    produites,
    producteurs,
    mecaniqueDeclenchee: (courant.mecanique?.declenchements ?? 0) > 0,
    premierContact,
    degatsParType,
    capturesParType,
    visitees: courant.camps.map((c) => c.visitees),
  };
}

/** Garde-fou d'actions par tour, aligné sur `ai/index.ts`. */
const ACTIONS_MAX_PAR_TOUR = 200;

/** Dépouille les événements d'une action : dégâts, captures, premier contact. */
function lireEvenements(
  evenements: EvenementJeu[], typeParId: Map<string, string>,
  degats: Record<string, number>, captures: Record<string, number>,
  journee: number, contact: (journee: number) => void,
): void {
  for (const e of evenements) {
    if (e.type === 'attaque') {
      const type = typeParId.get(e.attaquantId);
      if (type !== undefined) degats[type] = (degats[type] ?? 0) + e.degats;
      const cible = typeParId.get(e.cibleId);
      if (cible !== undefined && e.riposte > 0) degats[cible] = (degats[cible] ?? 0) + e.riposte;
      contact(journee);
    } else if (e.type === 'capture' && e.acquis) {
      const type = typeParId.get(e.uniteId);
      if (type !== undefined) captures[type] = (captures[type] ?? 0) + 1;
    }
  }
}

/** Médiane d'une liste de nombres. */
function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 0
    ? ((tri[milieu - 1] ?? 0) + (tri[milieu] ?? 0)) / 2
    : (tri[milieu] ?? 0);
}

/** Écart-type d'une liste de nombres. */
function ecartType(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const variance = valeurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / valeurs.length;
  return Math.sqrt(variance);
}

/** Nombre de cases de terre d'une carte : le dénominateur de `casesJamaisVisitees`. */
export function surfaceTerre(carte: MapDef): number {
  let terre = 0;
  for (const ligne of carte.grille) {
    for (const car of ligne) if (car !== 'W') terre += 1;
  }
  return terre;
}

/** Ce qu'un lot de parties accumule avant d'être réduit en `StatsSimulation`. */
interface Cumul {
  parties: number;
  camps: number;
  graines: string[];
  victoires: number[];
  nonTerminees: number;
  journees: number[];
  fonds: number[];
  visitees: Set<number>;
  terre: number;
  mecaniqueDeclaree: boolean;
  mecaniqueDeclenchee: number;
  contacts: number[];
  sansContact: number;
  aLaLimite: number;
  produites: Record<string, number>;
  degatsParType: Record<string, number>;
  capturesParType: Record<string, number>;
  partiesAvecProduction: Record<string, number>;
  victoiresDuProducteur: { gagnees: number; jouees: number };
  dureeMs: number;
}

/** Un cumul vierge pour `camps` camps. */
function cumulVierge(camps: number): Cumul {
  return {
    parties: 0, camps, graines: [], victoires: new Array<number>(camps).fill(0),
    nonTerminees: 0, journees: [], fonds: new Array<number>(camps).fill(0),
    visitees: new Set<number>(), terre: 0, mecaniqueDeclaree: false, mecaniqueDeclenchee: 0,
    contacts: [], sansContact: 0, aLaLimite: 0, produites: {}, degatsParType: {}, capturesParType: {},
    partiesAvecProduction: {}, victoiresDuProducteur: { gagnees: 0, jouees: 0 }, dureeMs: 0,
  };
}

/** Ajoute une partie à un cumul. `cible` est la clé de l'unité observée, s'il y en a une. */
function cumuler(c: Cumul, b: BilanPartie, graine: string, cible: string | null): void {
  c.parties += 1;
  c.graines.push(graine);
  if (b.vainqueur !== null) c.victoires[b.vainqueur] = (c.victoires[b.vainqueur] ?? 0) + 1;
  // « Non terminée » = une partie qui ne rend aucun résultat : nulle, ou boucle
  // épuisée. Une partie qui va au bout des journées et se décide **aux points**
  // est un match, pas un abandon — c'est la règle de décision du moteur
  // (`04-gameplay.md`, `vainqueurAuxPoints`), et Atlas est un sport. Le nombre de
  // parties allées jusqu'à la limite reste publié dans `hors_schema`.
  if (!b.terminee || b.vainqueur === null) c.nonTerminees += 1;
  if (b.motif === 'limite_journees' || !b.terminee) c.aLaLimite += 1;
  c.journees.push(b.journees);
  b.fonds.forEach((f, i) => { c.fonds[i] = (c.fonds[i] ?? 0) + f; });
  for (const bits of b.visitees) {
    for (let j = 0; j < bits.length; j += 1) if (bits[j] === '1') c.visitees.add(j);
  }
  if (b.mecaniqueDeclenchee) c.mecaniqueDeclenchee += 1;
  if (b.premierContact === null) c.sansContact += 1;
  else c.contacts.push(b.premierContact);
  for (const [t, n] of Object.entries(b.produites)) {
    c.produites[t] = (c.produites[t] ?? 0) + n;
    c.partiesAvecProduction[t] = (c.partiesAvecProduction[t] ?? 0) + 1;
  }
  for (const [t, n] of Object.entries(b.degatsParType)) c.degatsParType[t] = (c.degatsParType[t] ?? 0) + n;
  for (const [t, n] of Object.entries(b.capturesParType)) c.capturesParType[t] = (c.capturesParType[t] ?? 0) + n;
  if (cible !== null) {
    const camps = b.producteurs[cible];
    if (camps && camps.size === 1) {
      const producteur = [...camps][0] ?? 0;
      c.victoiresDuProducteur.jouees += 1;
      if (b.vainqueur === producteur) c.victoiresDuProducteur.gagnees += 1;
    }
  }
}

/** Réduit un cumul en `StatsSimulation`. */
function statsDe(c: Cumul, nomStrategie: string, climat: StatsSimulation['climat']): StatsSimulation {
  return {
    parties: c.parties,
    strategie: nomStrategie,
    graines: c.graines,
    victoiresCamp: c.victoires,
    nonTerminees: c.nonTerminees,
    journeesMediane: mediane(c.journees),
    journeesEcartType: Number(ecartType(c.journees).toFixed(2)),
    fondsMoyenParCamp: c.fonds.map((f) => Math.round(f / Math.max(1, c.parties))),
    // Le schéma borne ce champ à 100 (`03-schemas.md` §12) : la part réelle vit
    // dans `hors_schema.part_cases_jamais_visitees`, qui n'est bornée par rien.
    casesJamaisVisitees: Math.min(100, Math.max(0, c.terre - c.visitees.size)),
    mecaniqueDeclenchee: c.mecaniqueDeclaree ? c.mecaniqueDeclenchee : null,
    climat,
    dureeMoyenneMs: Number((c.dureeMs / Math.max(1, c.parties)).toFixed(2)),
  };
}

/** Les mesures hors schéma d'un lot : elles ne se recopient que dans `motifs[].mesure`. */
function horsSchemaDe(c: Cumul): Record<string, number> {
  const n = Math.max(1, c.parties);
  return {
    victoires_camp_1: Number(((c.victoires[0] ?? 0) / n).toFixed(4)),
    non_terminees: Number((c.nonTerminees / n).toFixed(4)),
    parties_a_la_limite: Number((c.aLaLimite / n).toFixed(4)),
    journees_sans_contact: c.contacts.length === 0 ? mediane(c.journees) : mediane(c.contacts),
    parties_sans_contact: c.sansContact,
    part_cases_jamais_visitees: c.terre === 0
      ? 0
      : Number((Math.max(0, c.terre - c.visitees.size) / c.terre).toFixed(4)),
  };
}

/** Empreinte d'une demande : c'est elle qui rend la campagne reproductible. */
export function empreinteDemande(d: DemandeSimulation, conditions: readonly ConditionClimat[]): string {
  const morceaux = [
    d.carte.code,
    d.carte.grille.join('/'),
    d.scenario?.code ?? 'sans_scenario',
    conditions.map((c) => `${c.saison}|${c.meteo}|${c.phase}`).join(','),
    String(d.parties),
    d.strategies.join('+'),
    String(d.journeesMax ?? 60),
    d.climatPays ?? 'tempere',
    d.catalogueCandidat?.unite.cle ?? 'sans_candidat',
    String(d.catalogueCandidat?.catalogueVersion ?? 0),
  ];
  return fnv1a(morceaux.join('#')).toString(36);
}

/**
 * Nom de campagne inscrit dans `StatsSimulation.strategie`, borné à 24 signes par
 * le schéma : trois profils écrits en toutes lettres n'y tiennent pas.
 */
export function nomDeCampagne(strategies: readonly StrategieIa[]): string {
  const complet = strategies.join(' vs ');
  if (complet.length <= 24) return complet;
  return `${strategies[0] ?? 'ponderee'}+${strategies.length - 1}`;
}

/**
 * Joue un lot de parties d'une même condition sur une même carte. `prefixe` est
 * la graine du lot : elle reste courte (le schéma borne une graine à 64 signes)
 * et ne dépend que de la demande, de la condition et de la carte.
 */
function jouerLot(
  carte: MapDef, scenario: Scenario, condition: ConditionClimat, parties: number,
  strategies: StrategieIa[], cat: Catalogue, climatPays: Climat, hemisphere: Hemisphere,
  prefixe: string, cumul: Cumul, cible: string | null,
): void {
  const date = dateDeSaison(condition.saison, hemisphere);
  const applique: Scenario = {
    ...scenario,
    date,
    climatFixe: { saison: condition.saison, meteo: condition.meteo },
    cycleJourNuit: cycleDePhase(condition.phase),
    limiteJournees: scenario.limiteJournees,
  };
  const commandants = new Array<null>(carte.camps).fill(null);
  const toursMax = Math.max(8, (applique.limiteJournees ?? 40) * carte.camps + 4);

  for (let i = 0; i < parties; i += 1) {
    const graine = `${prefixe}:${i}`;
    // On alterne qui porte quelle personnalité : le camp qui commence ne doit
    // pas être le seul à jouer la stratégie la plus forte.
    const tournantes = strategies.map((_, k) => strategies[(k + i) % strategies.length] as StrategieIa);
    const scene = sceneDepuis(applique, carte, commandants, climatPays, hemisphere);
    const etat = creerPartie(scene, cat, graine);
    const debut = Date.now();
    const bilan = jouerPartieInstrumentee(etat, tournantes, creerRng(`${graine}:ia`), cat, toursMax);
    cumul.dureeMs += Date.now() - debut;
    cumuler(cumul, bilan, graine, cible);
  }
}

/**
 * La campagne. Une carte (ou un scénario), une liste de conditions, N parties par
 * condition : un `StatsSimulation` agrégé, un par condition, et — pour une unité
 * candidate — les deux blocs `avec` et `sans`.
 */
export function simuler(d: DemandeSimulation): ResultatSimulation {
  const climatPays = d.climatPays ?? 'tempere';
  const hemisphere = d.hemisphere ?? 'nord';
  const journeesMax = Math.min(d.journeesMax ?? 60, BORNES_SIMULATION.journeesMaxMax);
  const strategies = d.strategies.length > 0 ? d.strategies : (['ponderee'] as StrategieIa[]);
  const demandees = d.conditions && d.conditions.length > 0 ? d.conditions : CONDITIONS_PAR_DEFAUT;
  const { retenues, ecartees } = conditionsAtteignables(demandees, climatPays);
  const { parties, retrograde } = bornerCampagne(Math.max(1, d.parties), retenues.length);
  const graineBase = d.graine ?? empreinteDemande(d, retenues);
  const simulationId = `sim_${graineBase}`;
  const debutTotal = Date.now();

  if (d.catalogueCandidat) {
    const resultat = simulerCatalogueCandidat(
      d, retenues, ecartees, parties, strategies, journeesMax, climatPays, hemisphere,
      graineBase, simulationId,
    );
    resultat.dureeCalculMs = Date.now() - debutTotal;
    if (retrograde) resultat.partiesRetrogradees = parties;
    return resultat;
  }

  const cat = catalogueAvec(null, d.scenario?.catalogueVersion ?? 1);
  const scenario = scenarioLimite(d, journeesMax);
  const terre = surfaceTerre(d.carte);
  const nomStrategies = nomDeCampagne(strategies);

  const parCondition: LigneCondition[] = [];
  const global = cumulVierge(d.carte.camps);
  global.terre = terre;
  global.mecaniqueDeclaree = d.carte.mecanique !== undefined;

  for (let k = 0; k < retenues.length; k += 1) {
    const condition = retenues[k] as ConditionClimat;
    const cumul = cumulVierge(d.carte.camps);
    cumul.terre = terre;
    cumul.mecaniqueDeclaree = global.mecaniqueDeclaree;
    jouerLot(d.carte, scenario, condition, parties, strategies, cat, climatPays, hemisphere,
      `${graineBase}:c${k}`, cumul, null);
    fusionner(global, cumul);
    parCondition.push({
      condition,
      stats: statsDe(cumul, nomStrategies, { ...condition }),
      horsSchema: horsSchemaDe(cumul),
    });
  }

  const saisonAgregee = retenues[0]?.saison ?? 'ete';
  const resultat: ResultatSimulation = {
    simulationId,
    dureeCalculMs: Date.now() - debutTotal,
    stats: statsDe(global, nomStrategies, { saison: saisonAgregee, meteo: 'tiree', phase: 'cycle' }),
    conditionsEcartees: ecartees,
    parCondition,
    horsSchema: {
      ...horsSchemaDe(global),
      conditions: retenues.length,
      parties_par_condition: parties,
    },
  };
  if (retrograde) resultat.partiesRetrogradees = parties;
  return resultat;
}

/** Le scénario appliqué : celui fourni, ou un minimal, avec la limite de journées demandée. */
function scenarioLimite(d: DemandeSimulation, journeesMax: number): Scenario {
  const base = d.scenario ?? scenarioMinimal(d.carte, d.catalogueCandidat?.catalogueVersion ?? 1);
  return { ...base, limiteJournees: journeesMax };
}

/** Verse un cumul de condition dans le cumul global. */
function fusionner(global: Cumul, part: Cumul): void {
  global.parties += part.parties;
  global.graines.push(...part.graines);
  part.victoires.forEach((v, i) => { global.victoires[i] = (global.victoires[i] ?? 0) + v; });
  global.nonTerminees += part.nonTerminees;
  global.journees.push(...part.journees);
  part.fonds.forEach((f, i) => { global.fonds[i] = (global.fonds[i] ?? 0) + f; });
  for (const j of part.visitees) global.visitees.add(j);
  global.mecaniqueDeclenchee += part.mecaniqueDeclenchee;
  global.contacts.push(...part.contacts);
  global.sansContact += part.sansContact;
  global.aLaLimite += part.aLaLimite;
  for (const [t, n] of Object.entries(part.produites)) global.produites[t] = (global.produites[t] ?? 0) + n;
  for (const [t, n] of Object.entries(part.degatsParType)) global.degatsParType[t] = (global.degatsParType[t] ?? 0) + n;
  for (const [t, n] of Object.entries(part.capturesParType)) global.capturesParType[t] = (global.capturesParType[t] ?? 0) + n;
  for (const [t, n] of Object.entries(part.partiesAvecProduction)) {
    global.partiesAvecProduction[t] = (global.partiesAvecProduction[t] ?? 0) + n;
  }
  global.victoiresDuProducteur.gagnees += part.victoiresDuProducteur.gagnees;
  global.victoiresDuProducteur.jouees += part.victoiresDuProducteur.jouees;
  global.dureeMs += part.dureeMs;
}

// ---------------------------------------------------------------------------
// Campagne de catalogue : le même lot de graines, avec et sans la candidate
// ---------------------------------------------------------------------------

/** Les paramètres des huit cartes de référence : petites, variées, sans mécanique. */
const PARAMETRES_REFERENCE: readonly ParametresCarte[] = [
  { largeur: 16, hauteur: 12, camps: 2, biome: 'plaine', ratioMer: 0, ratioRelief: 0.12, villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0, symetrie: 'point', densiteRoutes: 0.4 },
  { largeur: 16, hauteur: 12, camps: 2, biome: 'foret', ratioMer: 0, ratioRelief: 0.18, villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0, symetrie: 'axe_vertical', densiteRoutes: 0.35 },
  { largeur: 18, hauteur: 12, camps: 2, biome: 'montagne', ratioMer: 0, ratioRelief: 0.3, villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0, symetrie: 'point', densiteRoutes: 0.5 },
  { largeur: 16, hauteur: 14, camps: 2, biome: 'desert', ratioMer: 0, ratioRelief: 0.15, villesParCamp: 4, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 1, symetrie: 'axe_horizontal', densiteRoutes: 0.5 },
  { largeur: 18, hauteur: 14, camps: 2, biome: 'cotier', ratioMer: 0.18, ratioRelief: 0.12, villesParCamp: 4, villesNeutres: 3, usinesParCamp: 2, aeroportsParCamp: 0, symetrie: 'point', densiteRoutes: 0.45 },
  { largeur: 16, hauteur: 12, camps: 2, biome: 'neige', ratioMer: 0, ratioRelief: 0.2, villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0, symetrie: 'axe_vertical', densiteRoutes: 0.3 },
  { largeur: 20, hauteur: 14, camps: 2, biome: 'jungle', ratioMer: 0.08, ratioRelief: 0.16, villesParCamp: 4, villesNeutres: 3, usinesParCamp: 2, aeroportsParCamp: 1, symetrie: 'point', densiteRoutes: 0.4 },
  { largeur: 16, hauteur: 12, camps: 2, biome: 'marais', ratioMer: 0.1, ratioRelief: 0.08, villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0, symetrie: 'rotation_90', densiteRoutes: 0.35 },
];

/** Le lot de cartes de référence, régénéré à l'identique à chaque appel. */
export function cartesDeReference(combien: number = BORNES_SIMULATION.cartesReferenceCatalogue): MapDef[] {
  const cartes: MapDef[] = [];
  for (let i = 0; i < Math.min(combien, PARAMETRES_REFERENCE.length); i += 1) {
    const p = PARAMETRES_REFERENCE[i] as ParametresCarte;
    const carte = genererCarte(p, fnv1a(`carte_ref_${String(i + 1).padStart(2, '0')}`));
    cartes.push({ ...carte, code: `carte_ref_${String(i + 1).padStart(2, '0')}`, nom: `Référence ${i + 1}` });
  }
  return cartes;
}

/** Une campagne de catalogue : même lot de graines, avec et sans la candidate. */
function simulerCatalogueCandidat(
  d: DemandeSimulation, retenues: ConditionClimat[], ecartees: ConditionClimat[],
  parties: number, strategies: StrategieIa[], journeesMax: number,
  climatPays: Climat, hemisphere: Hemisphere, graineBase: string, simulationId: string,
): ResultatSimulation {
  const candidat = d.catalogueCandidat as CatalogueCandidat;
  const cartes = (d.cartesReference && d.cartesReference.length > 0
    ? [...d.cartesReference]
    : cartesDeReference()).slice(0, BORNES_SIMULATION.cartesReferenceCatalogue);
  const condition: ConditionClimat = retenues[0] ?? { saison: 'ete', meteo: 'clair', phase: 'jour' };
  const nomStrategies = nomDeCampagne(strategies);
  const camps = cartes[0]?.camps ?? 2;

  const lot = (avecCandidat: boolean): Cumul => {
    const cat = catalogueAvec(avecCandidat ? candidat.unite : null, candidat.catalogueVersion);
    const cumul = cumulVierge(camps);
    // Chaque carte reçoit sa part du budget de parties, au moins une.
    const parCarte = Math.max(1, Math.round(parties / Math.max(1, cartes.length)));
    for (let k = 0; k < cartes.length; k += 1) {
      const carte = cartes[k] as MapDef;
      const scenario = { ...scenarioMinimal(carte, candidat.catalogueVersion), limiteJournees: journeesMax };
      jouerLot(carte, scenario, condition, parCarte, strategies, cat, climatPays, hemisphere,
        `${graineBase}:m${k}`, cumul, candidat.unite.cle);
    }
    return cumul;
  };

  const avec = lot(true);
  const sans = lot(false);
  const climat = { ...condition };

  return {
    simulationId,
    dureeCalculMs: 0,
    stats: statsDe(avec, nomStrategies, climat),
    conditionsEcartees: ecartees,
    parCondition: [
      { condition, stats: statsDe(avec, nomStrategies, climat), horsSchema: horsSchemaDe(avec) },
    ],
    horsSchema: mesuresCatalogue(avec, sans, candidat.unite),
    avec: { stats: statsDe(avec, nomStrategies, climat) },
    sans: { stats: statsDe(sans, nomStrategies, climat) },
    cartesReference: cartes.map((c) => c.code),
    catalogueVersion: candidat.catalogueVersion,
  };
}

/**
 * Les deux mesures qui fondent `unite_dominante` et `unite_inutile` (§4.2) :
 *
 * - `efficacite_par_cout` : « dégâts infligés + valeur capturée » par unité
 *   produite et par millier de fonds dépensés, **normalisé à 1,0** sur la moyenne
 *   des unités canon effectivement produites dans la même campagne ;
 * - `frequence_production_ia` : part des parties où l'IA l'a produite au moins
 *   une fois.
 */
function mesuresCatalogue(avec: Cumul, sans: Cumul, unite: UnitType): Record<string, number> {
  const canon = chargerUnites();
  const rendement = (cle: string, cout: number): number | null => {
    const produites = avec.produites[cle] ?? 0;
    if (produites === 0 || cout <= 0) return null;
    const valeur = (avec.degatsParType[cle] ?? 0) + 100 * (avec.capturesParType[cle] ?? 0);
    return valeur / (produites * (cout / 1000));
  };
  const references: number[] = [];
  for (const u of canon) {
    if (u.statut !== 'canon') continue;
    const r = rendement(u.cle, u.cout);
    if (r !== null) references.push(r);
  }
  const moyenne = references.length === 0
    ? 0
    : references.reduce((a, b) => a + b, 0) / references.length;
  const brut = rendement(unite.cle, unite.cout);
  const efficacite = brut === null || moyenne <= 0 ? 0 : brut / moyenne;

  const nAvec = Math.max(1, avec.parties);
  const nSans = Math.max(1, sans.parties);
  const tauxAvec = (avec.victoires[0] ?? 0) / nAvec;
  const tauxSans = (sans.victoires[0] ?? 0) / nSans;
  const producteur = avec.victoiresDuProducteur;
  const tauxProducteur = producteur.jouees === 0
    ? 0.5
    : producteur.gagnees / producteur.jouees;

  return {
    taux_victoire_camp_qui_la_produit: Number(tauxProducteur.toFixed(4)),
    efficacite_par_cout: Number(efficacite.toFixed(4)),
    frequence_production_ia: Number(((avec.partiesAvecProduction[unite.cle] ?? 0) / nAvec).toFixed(4)),
    ecart_taux_victoire: Number(Math.abs(tauxAvec - tauxSans).toFixed(4)),
    journees_mediane_avec: mediane(avec.journees),
    journees_mediane_sans: mediane(sans.journees),
    parties_avec: avec.parties,
    parties_sans: sans.parties,
    parties_du_producteur: producteur.jouees,
  };
}

// ---------------------------------------------------------------------------
// Le simulateur branché : il va chercher la carte et l'unité en base
// ---------------------------------------------------------------------------

/** Reconstruit une carte depuis sa ligne de base : la grille, ou sa régénération. */
export function carteDeLigne(
  ligne: { donnees: MapDef | null; parametres: ParametresCarte | null; graine: string },
): MapDef | null {
  if (ligne.donnees) return ligne.donnees;
  if (!ligne.parametres) return null;
  const brute = Number(ligne.graine);
  return genererCarte(ligne.parametres, Number.isFinite(brute) ? brute : fnv1a(ligne.graine));
}

/** L'implémentation réelle : le moteur, l'IA et le générateur, sur le serveur. */
export const simulateurMoteur: Simulateur = {
  disponible: true,
  nom: 'moteur',

  async simulerCarte(demande: DemandeCarte): Promise<ResultatCarte> {
    const ligne = await requetesCartes.carte(demande.mapId);
    if (!ligne) throw new SimulationIndisponible(`carte inconnue : ${demande.mapId}`);
    const carte = carteDeLigne(ligne);
    if (!carte) throw new SimulationIndisponible(`carte ${demande.mapId} sans grille ni paramètres`);
    const r = simuler({
      carte,
      conditions: demande.conditions,
      parties: demande.parties,
      strategies: demande.profilsIa,
      journeesMax: demande.journeesMax,
    });
    return {
      simulationId: r.simulationId,
      dureeCalculMs: r.dureeCalculMs,
      stats: r.stats,
      conditionsEcartees: r.conditionsEcartees,
      parCondition: r.parCondition,
      horsSchema: r.horsSchema,
    };
  },

  async simulerCatalogue(demande: DemandeCatalogue): Promise<ResultatCatalogue> {
    const ligne = await requetesUnites.unite(demande.uniteCle);
    const candidate = ligne?.donnees ?? null;
    if (!candidate) throw new SimulationIndisponible(`unité candidate inconnue : ${demande.uniteCle}`);
    const cartes = cartesDeReference();
    const premiere = cartes[0];
    if (!premiere) throw new SimulationIndisponible('aucune carte de référence constructible');
    const r = simuler({
      carte: premiere,
      cartesReference: cartes,
      conditions: [{ saison: 'ete', meteo: 'clair', phase: 'jour' }],
      parties: demande.parties,
      strategies: demande.profilsIa,
      journeesMax: demande.journeesMax,
      catalogueCandidat: { unite: candidate, catalogueVersion: demande.catalogueVersion },
    });
    if (!r.avec || !r.sans) throw new SimulationIndisponible('campagne de catalogue sans résultat');
    return {
      simulationId: r.simulationId,
      catalogueVersion: demande.catalogueVersion,
      cartesReference: r.cartesReference ?? [],
      avec: r.avec,
      sans: r.sans,
      horsSchema: r.horsSchema,
    };
  },
};

/** Le simulateur branché sur les routes. */
export function simulateurCourant(): Simulateur {
  return simulateurMoteur;
}

// ---------------------------------------------------------------------------
// Sérialisation : la forme JSON de `05-routines.md` §4.2, en serpent
// ---------------------------------------------------------------------------

/** La réponse JSON d'une campagne de carte, telle que la routine l'attend. */
export function jsonCarte(r: ResultatCarte, partiesRetrogradees?: number): Record<string, unknown> {
  return {
    simulation_id: r.simulationId,
    duree_calcul_ms: r.dureeCalculMs,
    stats: r.stats,
    conditions_ecartees: r.conditionsEcartees,
    par_condition: r.parCondition.map((l) => ({
      condition: l.condition, stats: l.stats, hors_schema: l.horsSchema,
    })),
    hors_schema: r.horsSchema,
    ...(partiesRetrogradees === undefined ? {} : { parties_retrogradees: partiesRetrogradees }),
  };
}

/** La réponse JSON d'une campagne de catalogue. */
export function jsonCatalogue(r: ResultatCatalogue): Record<string, unknown> {
  return {
    simulation_id: r.simulationId,
    catalogueVersion: r.catalogueVersion,
    cartes_reference: r.cartesReference,
    avec: r.avec,
    sans: r.sans,
    hors_schema: r.horsSchema,
  };
}
