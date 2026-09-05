/**
 * `POST /api/routines/missions/{id}/soumission` — le **seul point d'écriture de
 * contenu**, toutes routines confondues (`05-routines.md` §7.2).
 *
 * Trois principes gouvernent ce fichier :
 *
 *   - **Le serveur ne fait confiance à rien.** Toute charge utile passe par les
 *     validateurs de `schemas/`. Un objet non conforme est rejeté avec la liste des
 *     chemins fautifs, jamais « réparé » en silence.
 *   - **Il recalcule tout ce qui est calculable.** L'enveloppe (clé, version,
 *     statut, source, dates) est posée par le serveur ; une routine qui l'envoie
 *     voit sa soumission refusée en `champ_calcule`.
 *   - **Chaque réponse dit ce qui a été accepté et pourquoi le reste a été refusé**,
 *     objet par objet. On ne rejoue pas un volet dans le même run.
 */

import {
  cartes, commandants, communs, depeches, missions as requetesMissions, pays, reviews,
  runs, scenarios, unites,
} from '../db/requetes/index';
import {
  validerCommander, validerCountry, validerParametresCarte, validerReviewVerdict,
  validerScenario, type Erreur, type ReviewVerdict, type Statut,
} from '../schemas/index';
import { catalogueVersion, chainesVersion, doitEtreArchive, statutApresVerdict, transitionAutorisee } from './cycle';
import { generateurCourant, graineDe } from './generation';
import type { MissionMinimale } from './contexte';
import { erreur, json } from './reponses';

/** Les six champs d'enveloppe que le serveur pose lui-même. */
const CHAMPS_CALCULES = ['cle', 'version', 'statut', 'source', 'creeLe', 'majLe'] as const;

/** Un objet refusé, avec de quoi corriger au passage suivant. */
export interface Refus {
  objet: string;
  error: string;
  detail?: string;
  chemins?: string[];
}

/** La réponse d'une soumission : accepté d'un côté, refusé de l'autre. */
export interface ResultatSoumission {
  accepte: string[];
  refuse: Refus[];
  statut: Statut;
  [extra: string]: unknown;
}

/** Vrai si l'objet porte un champ que seul le serveur écrit. */
function champsCalculesPresents(o: Record<string, unknown>): string[] {
  return CHAMPS_CALCULES.filter((c) => c in o);
}

/** Complète l'enveloppe avant validation : c'est le serveur qui la pose. */
function envelopper(
  o: Record<string, unknown>,
  cle: string,
  source: 'atlas_lore' | 'atlas_map' | 'atlas_cerveau',
): Record<string, unknown> {
  const jour = communs.jourIso();
  return { ...o, cle, version: 1, statut: 'brouillon', source, creeLe: jour, majLe: jour };
}

function cheminsDe(erreurs: Erreur[]): string[] {
  return erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`);
}

// ---------------------------------------------------------------------------
// atlas_lore
// ---------------------------------------------------------------------------

async function soumissionLore(corps: Record<string, unknown>): Promise<ResultatSoumission> {
  const accepte: string[] = [];
  const refuse: Refus[] = [];

  const traiter = async (nom: 'country' | 'commander' | 'scenario'): Promise<void> => {
    const brut = corps[nom];
    if (brut === undefined) return;
    if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
      refuse.push({ objet: nom, error: 'schema_invalide', detail: 'un objet est attendu' });
      return;
    }
    const o = brut as Record<string, unknown>;
    const calcules = champsCalculesPresents(o);
    if (calcules.length > 0) {
      refuse.push({ objet: nom, error: 'champ_calcule', detail: 'le serveur pose l’enveloppe', chemins: calcules });
      return;
    }
    const code = typeof o['code'] === 'string' ? o['code'] : '';
    if (code === '') {
      refuse.push({ objet: nom, error: 'schema_invalide', chemins: ['code — champ obligatoire manquant'] });
      return;
    }
    if (nom === 'country') {
      const r = validerCountry(envelopper(o, `pays_${code}`, 'atlas_lore'));
      if (!r.ok) { refuse.push({ objet: nom, error: 'schema_invalide', chemins: cheminsDe(r.erreurs) }); return; }
      await pays.deposer(r.valeur, 'atlas_lore');
    } else if (nom === 'commander') {
      const r = validerCommander(envelopper(o, code, 'atlas_lore'));
      if (!r.ok) { refuse.push({ objet: nom, error: 'schema_invalide', chemins: cheminsDe(r.erreurs) }); return; }
      await commandants.deposer(r.valeur, 'atlas_lore');
    } else {
      const r = validerScenario(envelopper(o, code, 'atlas_lore'));
      if (!r.ok) { refuse.push({ objet: nom, error: 'schema_invalide', chemins: cheminsDe(r.erreurs) }); return; }
      await scenarios.deposer({
        donnees: r.valeur, mapId: null,
        catalogueVersion: await catalogueVersion(), chainesVersion: await chainesVersion(),
        source: 'atlas_lore',
      });
    }
    accepte.push(nom);
  };

  await traiter('country');
  await traiter('commander');
  await traiter('scenario');

  if (accepte.length === 0 && refuse.length === 0) {
    refuse.push({ objet: '(racine)', error: 'charge_vide', detail: 'country, commander ou scenario attendu' });
  }
  return { accepte, refuse, statut: 'brouillon' };
}

// ---------------------------------------------------------------------------
// atlas_map
// ---------------------------------------------------------------------------

async function soumissionMap(
  mission: MissionMinimale,
  corps: Record<string, unknown>,
  base: string,
): Promise<ResultatSoumission | Response> {
  const brutParams = corps['parametres'];
  const r = validerParametresCarte(brutParams);
  if (!r.ok) {
    return { accepte: [], refuse: [{ objet: 'parametres', error: 'schema_invalide', chemins: cheminsDe(r.erreurs) }], statut: 'brouillon' };
  }
  // Le climat : la routine recopie la date et la saison, elle ne les choisit pas.
  const climat = corps['climat'];
  if (typeof climat === 'object' && climat !== null) {
    const c = climat as Record<string, unknown>;
    if ('meteo' in c) {
      return { accepte: [], refuse: [{ objet: 'climat', error: 'champ_calcule', detail: 'la météo est tirée par le moteur, jamais soumise', chemins: ['climat.meteo'] }], statut: 'brouillon' };
    }
    const fixe = c['climatFixe'];
    const cycle = c['cycleJourNuit'];
    const justifie = typeof c['justification'] === 'string' && c['justification'].trim() !== '';
    if ((fixe !== null && fixe !== undefined) || (cycle !== null && cycle !== undefined)) {
      if (!justifie) {
        return { accepte: [], refuse: [{ objet: 'climat', error: 'justification_manquante', detail: 'un scénario qui fige son climat doit dire pourquoi' }], statut: 'brouillon' };
      }
    }
    if (typeof cycle === 'object' && cycle !== null) {
      const cc = cycle as Record<string, unknown>;
      const j = Number(cc['jour']);
      const n = Number(cc['nuit']);
      if (!Number.isInteger(j) || !Number.isInteger(n) || j < 0 || n < 0 || j + n < 1 || j + n > 12) {
        return { accepte: [], refuse: [{ objet: 'climat', error: 'hors_bornes', detail: 'jour ≥ 0, nuit ≥ 0, 1 ≤ jour + nuit ≤ 12' }], statut: 'brouillon' };
      }
    }
  }

  // Le serveur génère : la routine ne transmet jamais de grille.
  if ('grille' in corps || 'carte' in corps) {
    return { accepte: [], refuse: [{ objet: 'parametres', error: 'champ_calcule', detail: 'la grille est produite par le serveur' }], statut: 'brouillon' };
  }

  const graine = graineDe(mission.cibleCle);
  const generateur = generateurCourant();
  const produit = await generateur.generer(r.valeur, graine); // lève tant que mapgen n'existe pas
  const code = `carte_${mission.cibleCle}`.slice(0, 48);
  const ligne = await cartes.deposer({
    code, graine, parametres: r.valeur, donnees: produit.carte,
    apercu: produit.apercu, diagnostic: produit.diagnostic, source: 'atlas_map',
  });
  return {
    accepte: ['parametres'],
    refuse: [],
    statut: 'brouillon',
    map_id: ligne.id,
    graine,
    version_generateur: generateur.version,
    apercu: { ...produit.apercu, commentUrl: `${base}/api/routines/map/cartes/${ligne.id}` },
  };
}

// ---------------------------------------------------------------------------
// atlas_controle
// ---------------------------------------------------------------------------

/** Les cibles pour lesquelles un verdict sans statistiques est refusé. */
const CIBLES_A_STATS = ['carte', 'scenario', 'unite'];

async function soumissionControle(
  mission: MissionMinimale,
  corps: Record<string, unknown>,
): Promise<ResultatSoumission> {
  const r = validerReviewVerdict(corps);
  if (!r.ok) {
    return { accepte: [], refuse: [{ objet: 'verdict', error: 'schema_invalide', chemins: cheminsDe(r.erreurs) }], statut: 'brouillon' };
  }
  const verdict: ReviewVerdict = r.valeur;

  // Le gardien lui-même est contrôlé (`05-routines.md` §4.2).
  if (verdict.verdict === 'rejete' && verdict.motifs.length === 0) {
    return { accepte: [], refuse: [{ objet: 'verdict', error: 'motif_manquant', detail: 'un rejet exige au moins un motif' }], statut: 'brouillon' };
  }
  const codes = verdict.motifs.map((m) => m.code);
  if (new Set(codes).size !== codes.length) {
    return { accepte: [], refuse: [{ objet: 'verdict', error: 'motif_duplique', detail: 'un même code ne peut apparaître deux fois' }], statut: 'brouillon' };
  }
  if (verdict.verdict === 'valide' && CIBLES_A_STATS.includes(verdict.cibleType) && verdict.stats === null) {
    return { accepte: [], refuse: [{ objet: 'verdict', error: 'stats_manquantes', detail: `un verdict sur ${verdict.cibleType} exige des statistiques de simulation` }], statut: 'brouillon' };
  }

  await reviews.enregistrer(verdict);

  // Le statut de la cible suit le verdict, sous le contrôle du cycle de vie.
  const nouveau = statutApresVerdict(verdict.verdict);
  const decision = transitionAutorisee('brouillon', nouveau, 'atlas_controle');
  if (!decision.ok) {
    return { accepte: [], refuse: [{ objet: 'verdict', error: decision.code, detail: decision.detail }], statut: 'brouillon' };
  }
  const rejets = await reviews.rejetsSurCible(verdict.cibleType, verdict.cibleCle);
  const final: Statut = verdict.verdict === 'rejete' && doitEtreArchive(rejets) ? 'retire' : nouveau;
  await appliquerStatutCible(mission.cibleType, verdict.cibleCle, final);

  return {
    accepte: ['verdict'],
    refuse: [],
    statut: final,
    cible: { type: verdict.cibleType, cle: verdict.cibleCle },
    rejets_cumules: rejets,
    ...(final === 'retire' ? { alerte: 'trois rejets : objet archivé, prompt ou générateur à revoir' } : {}),
  };
}

/** Applique un statut à la cible d'une mission, quel que soit son type. */
async function appliquerStatutCible(cibleType: string, cle: string, statut: Statut): Promise<void> {
  switch (cibleType) {
    case 'MapDef': {
      const c = await cartes.carteParCode(cle);
      if (c) await cartes.changerStatut(c.id, statut);
      break;
    }
    case 'Scenario': await scenarios.changerStatut(cle, statut); break;
    case 'Commander': await commandants.changerStatut(cle, statut); break;
    case 'Country': await pays.changerStatut(cle, statut); break;
    case 'UnitType': await unites.changerCycle(cle, statut); break;
    case 'MissionDuJour': await depeches.changerStatut(cle, statut); break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// Aiguillage
// ---------------------------------------------------------------------------

/** Traite une soumission et rend la réponse HTTP complète. */
export async function traiterSoumission(
  mission: MissionMinimale,
  corps: Record<string, unknown>,
  base: string,
  runId: string | null,
): Promise<Response> {
  if (runId) await runs.compter(runId, { appels: 1 });
  let resultat: ResultatSoumission | Response;
  switch (mission.routine) {
    case 'atlas_lore':
      resultat = await soumissionLore(corps);
      break;
    case 'atlas_map':
      resultat = await soumissionMap(mission, corps, base);
      break;
    case 'atlas_controle':
      resultat = await soumissionControle(mission, corps);
      break;
    case 'atlas_cerveau':
      return erreur('volet_dedie', 409,
        'le cerveau écrit par /api/routines/cerveau/{evenements,memoire,prompts,unites}');
    case 'atlas_traduction':
      return erreur('volet_dedie', 409, 'la traduction écrit par /api/routines/traduction/soumettre');
    default:
      return erreur('routine_inconnue', 400);
  }
  if (resultat instanceof Response) return resultat;

  // La mission se ferme dès qu'un objet a été accepté : un seul POST par volet.
  if (resultat.accepte.length > 0) {
    await requetesMissions.clore(mission.id, 'soumise', resultat as unknown as Record<string, unknown>);
    if (runId) await runs.compter(runId, { soumises: 1 });
  }
  return json(resultat, resultat.accepte.length > 0 ? 200 : 422);
}
