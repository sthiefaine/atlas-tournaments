/**
 * # Moteur de règles d'Atlas Tournament — API publique
 *
 * TypeScript pur, sans dépendance, sans accès au navigateur et sans horloge :
 * il tourne dans le canvas comme sous Node (`doc/02-architecture.md` §3.1).
 * C'est ce fichier qu'importent `render/`, `mapgen/`, `ai/` et `serveur/`.
 *
 * ## Le contrat
 *
 * ```ts
 * creerPartie(scene: Scene, cat: Catalogue, graine: string): EtatPartie
 * appliquer(etat: EtatPartie, action: Action, cat?, commandants?): Resultat
 *
 * type Resultat =
 *   | { ok: true;  etat: EtatPartie; evenements: EvenementJeu[] }
 *   | { ok: false; motif: MotifRefus; detail?: string }
 * ```
 *
 * - **Pur** : `appliquer` ne modifie jamais son entrée, il rend un nouvel état.
 * - **Total** : une action illégale rend un refus motivé, jamais une exception.
 * - **Sérialisable** : `EtatPartie` est du JSON pur.
 * - **Déterministe** : `graine` + suite d'actions ⇒ même `empreinte(etat)`.
 *
 * ## Les quatre actions (`04-gameplay.md` §2)
 *
 * ```ts
 * { type: 'ordre'; uniteId; chemin: Case[]; suite: Suite }   // déplacer + faire
 * { type: 'produire'; batiment: Case; unite: CleUnite }
 * { type: 'pouvoir'; niveau: 'normal' | 'super'; cases?: Case[] }
 * { type: 'finTour' }
 * ```
 *
 * `Suite` couvre attendre (`rien`), attaquer, capturer, embarquer, débarquer,
 * fusionner et ravitailler.
 *
 * ## Lectures utiles
 *
 * `portee`, `verifierChemin`, `coutEntree`, `ciblesDepuis` (déplacement et
 * attaque), `unitesVues`, `casesVisibles`, `filtrerPourCamp` (brouillard),
 * `score` (décision aux points), `empreinte` et `rejouer` (rejeu),
 * `chargerCatalogue` (catalogue canon), `MECANIQUE_CLIMAT` et le registre des
 * mécaniques (greffons).
 *
 * Le moteur ne connaît **aucune unité par son nom** : tout passe par le
 * catalogue et par les `traits`.
 */

// Types du moteur
export type {
  Action, Catalogue, CommandantMoteur, CtxMecanique, EffetMecanique, EtatCamp,
  EtatMecanique, EtatPartie, EtatRng, EvenementJeu, ExpirationModificateur,
  FinPartie, InstantaneRng, Mecanique, ModificateurActif, MotifRefus, ReglagesPartie,
  Resultat, Rng, Scene, SourceModificateur, Suite, TerrainPose, Unite, EtatUnite,
  VerdictMouvement,
} from './types';
export { cleCase, depuisCle, manhattan, MOTIFS_REFUS, porte, pvAffiches } from './types';

// Aléa
export { amorcer, creerRng, fnv1a, restaurerRng } from './rng';

// Catalogue
export {
  catalogueDepuis, chargerCatalogue, coutBase, degatsBase, produitesPar,
  terrainDe, typeUnite,
} from './catalogue';

// État et création de partie
export {
  aVisite, CAMP_JOUEUR, commandantsIncarnes, copier, copierEtat, creerPartie,
  JAUGE_MAX_DEFAUT, JOURNAL_MAX,
  marquerVisite, proprietaire, reglagesParDefaut, sceneDeCarte, sceneDepuis,
  VERSION_MOTEUR,
} from './etat';

// Actions
export {
  appliquer, catalogueParDefaut, ciblesDepuis, voisinesLibres, type Commandants,
} from './actions';

// Règles
export {
  adversesVisibles, arriveeLibre, casesAtteignables, cheminVers, coutEntree,
  coutVers, pointsMouvement, portee, tableCouts, terrainSous, uniteParId, uniteSur,
  verifierChemin, voisines, type Portee, type VerdictChemin,
} from './regles/mouvement';
export {
  calculerDegats, crediterJauge, estIndirecte, JAUGE_PAR_PV_INFLIGE,
  JAUGE_PAR_PV_SUBI, mettreHorsJeu, peutViser, prevoirDuel, resoudreAttaque,
  type PrevisionDuel,
} from './regles/combat';
export {
  avancerCapture, peutCapturerIci, pointsGagnes, reinitialiserCapture, SEUIL_CAPTURE,
} from './regles/capture';
export {
  batimentsDe, consommerCarburant, estRavitailleur, producteursDe, produire,
  ravitailleCetteUnite, reparerEtRavitailler, reveiller, valeurArmee,
  verifierProduction, verserRevenus,
} from './regles/economie';
export {
  appliquerPouvoir, estPoseTerrain, expirationDe, expirerPoses, POINTS_PAR_BARRE,
  poserModificateur, verifierPose, verifierPouvoir,
} from './regles/pouvoirs';
export { additif, multiplicateur, multiplicateurFonds, viseUnite } from './regles/modificateurs';
export {
  evaluerFin, majEliminations, score, vainqueurAuxPoints,
} from './regles/victoire';
export { appliquerEffets, campSuivant, fermerTour, ouvrirTour } from './regles/tour';
export {
  cacheeAuContact, casesVisibles, filtrerPourCamp, unitesVues, visionUnite, voitCase,
} from './regles/vision';

// Hooks, climat, mécaniques
export {
  dansCarte, debutTourHooks, finTourHooks, mecaniqueDeLaPartie, signatureTerrain,
  surAttaqueHooks, surcoutCase, surMouvementHooks, terrainBrut, terrainLogique,
} from './hooks';
export {
  avancerClimat, brouillardActif, bulletin, cycleEffectif, effetsSaison,
  effetsSaisonPartie, facteurMouvementMeteo, foretCache, initialiserClimat, MECANIQUE_CLIMAT, meteoDominante,
  meteoPossible, phaseDe, saisonDe, saisonEffective, surcoutMeteo, TABLE_CLIMAT_SAISON, TABLE_METEO,
  tirerMeteo, unitesLourdes, unitesTerrestres, type EffetSaison,
} from './climat/index';
export {
  clesMecaniques, enregistrer, mecaniqueDe, MECANIQUE_MAREES, MECANIQUE_TEST,
} from './mecaniques/registre';

// Campagne : déblocages et conditions composables (`13-campagne.md` §8)
export {
  commandantJouable, deblocagesAcquis, deblocagesNouveaux, evaluerCondition,
  type ContexteDeblocage,
} from './deblocages';

// Rejeu
export {
  canonique, empreinte, enregistrer as enregistrerPartie, rejouer,
  type ResultatRejeu, type SauvegardeMoteur,
} from './rejeu';

export { COUT_CONSTRUCTION, terrainConstruction, constructionsPossibles } from './regles/genie';
