/**
 * Types propres au moteur — tout ce que `src/schemas/types.ts` ne publie pas.
 * Aucun type du contrat partagé n'est redéfini ici : on l'importe.
 *
 * Références : `doc/02-architecture.md` §3.1 et §7, `doc/04-gameplay.md` §2, §11.
 */

import type {
  Case, CampId, Cle, CleTerrain, CleUnite, DateIso, Climat, Hemisphere,
  EtatClimat, Meteo, ObjectifDefaite, ObjectifVictoire, Saison, TableDegats,
  Terrain, Trait, TypeMouvement, UnitType, EffetModificateur, EffetPouvoir,
} from '../schemas/index';

// ---------------------------------------------------------------------------
// 1. Aléa seedé
// ---------------------------------------------------------------------------

/** État interne sérialisable d'un flux : quatre entiers 32 bits. */
export type EtatRng = [number, number, number, number];

/** Instantané d'un arbre de flux : chemin du flux → son état. */
export type InstantaneRng = Record<string, EtatRng>;

/**
 * Générateur seedé à flux dérivés (`02-architecture.md` §7). `branche(nom)`
 * rend toujours le même flux pour un même nom : ajouter un tirage dans l'IA
 * ne décale ni le combat ni la météo.
 */
export interface Rng {
  /** Chemin du flux depuis la racine : '', 'combat', 'ia:0'… */
  readonly chemin: string;
  /** État courant, sérialisable. */
  readonly etat: EtatRng;
  /** Flottant dans [0, 1). */
  suivant(): number;
  /** Entier dans [0, borne). */
  entier(borne: number): number;
  /** Flux dérivé nommé, mémorisé : deux appels rendent le même flux. */
  branche(nom: string): Rng;
  /** Instantané de ce flux et de tous ses descendants déjà créés. */
  instantane(): InstantaneRng;
  /** Restaure les états d'un instantané dans cet arbre de flux. */
  restaurer(flux: InstantaneRng): void;
}

// ---------------------------------------------------------------------------
// 2. Catalogue
// ---------------------------------------------------------------------------

/**
 * Catalogue chargé : le moteur ne connaît aucune unité par son nom, il lit
 * ce catalogue et les `traits` (`04-gameplay.md` §13.1).
 */
export interface Catalogue {
  version: number;
  /** Clés d'unités dans l'ordre du catalogue : itération déterministe. */
  cles: CleUnite[];
  unites: Record<CleUnite, UnitType>;
  terrains: Record<CleTerrain, Terrain>;
  /** Caractère de grille → clé de terrain. */
  parCaractere: Record<string, CleTerrain>;
  degats: TableDegats;
}

// ---------------------------------------------------------------------------
// 3. État de partie
// ---------------------------------------------------------------------------

/** États d'ordre d'une unité pendant un tour. */
export type EtatUnite = 'prete' | 'agi' | 'produite';

/** Une unité en jeu. PV internes sur 100, affichés sur 10. */
export interface Unite {
  id: string;
  camp: CampId;
  type: CleUnite;
  x: number;
  y: number;
  /** PV internes, 1 à 100. `pvAffiches = ceil(pv / 10)`. */
  pv: number;
  munitions: number | null;
  carburant: number | null;
  etat: EtatUnite;
  /** Points de capture accumulés sur la case courante (seuil 20). */
  pointsCapture: number;
  /** Identifiants des unités embarquées (trait `transport`). */
  cargo: string[];
  /** Identifiant du transport qui la porte, ou null. */
  dansTransport: string | null;
}

/** Ce qu'un camp possède hors de la carte. */
export interface EtatCamp {
  id: CampId;
  fonds: number;
  /** Jauge de pouvoir, 100 points par barre. */
  jauge: number;
  /** Plafond de jauge = coût du super pouvoir, en points. */
  jaugeMax: number;
  commandantCle: Cle | null;
  /** Clé de case du QG de départ : le perdre élimine le camp. */
  qgCase: string | null;
  /** Un seul déclenchement de pouvoir par tour. */
  pouvoirUtiliseCeTour: boolean;
  elimine: boolean;
  /**
   * Cases visitées par ce camp, une chaîne de '0' et de '1' indexée par
   * `y * largeur + x` : une chaîne se copie sans coût, un tableau non.
   */
  visitees: string;
}

/** Durée résolue d'un modificateur actif, en données pures. */
export type ExpirationModificateur =
  | { type: 'ce_tour' }
  | { type: 'tour_complet' }
  | { type: 'journees'; jusqu: number }
  | { type: 'permanent' };

/** Origine d'un modificateur : sert au retrait et à la lecture du HUD. */
export type SourceModificateur =
  | 'passif' | 'pouvoir' | 'super' | 'climat' | 'mecanique' | 'specialite';

/** Un modificateur actif, posé par un passif, un pouvoir, le climat ou une mécanique. */
export interface ModificateurActif {
  id: number;
  camp: CampId;
  source: SourceModificateur;
  effet: EffetModificateur;
  expire: ExpirationModificateur;
}

/** Case de terrain posée par `poser_terrain` ou par une mécanique. */
export interface TerrainPose {
  /** Clé de case, 'x,y'. */
  case: string;
  terrain: CleTerrain;
  /** Journée après laquelle la pose disparaît, ou null si permanente. */
  jusqu: number | null;
}

/** Réglages figés du scénario : le moteur ne lit jamais l'horloge. */
export interface ReglagesPartie {
  date: DateIso;
  climatPays: Climat;
  hemisphere: Hemisphere;
  saisonForcee: Saison | null;
  meteoForcee: Meteo | null;
  cycleJourNuit: { jour: number; nuit: number };
  fondsDepart: number;
  revenusParBatiment: number;
  brouillard: boolean;
  limiteJournees: number | null;
  victoire: ObjectifVictoire[];
  defaite: ObjectifDefaite[];
}

/** Bloc mécanique régionale de l'état : ses paramètres et son seul état persistant. */
export interface EtatMecanique {
  cle: Cle;
  parametres: Record<string, number | string | boolean>;
  gelable: boolean;
  donnees: Record<string, number | string | boolean>;
  /** Nombre de fois où la mécanique a produit un effet : métrique de simulation. */
  declenchements: number;
}

/** Issue d'une partie terminée. */
export interface FinPartie {
  terminee: boolean;
  vainqueur: CampId | null;
  nul: boolean;
  motif: string | null;
}

/** L'état complet d'une partie : JSON pur, `JSON.parse(JSON.stringify(e))` est l'identité. */
export interface EtatPartie {
  engineVersion: number;
  catalogueVersion: number;
  contentVersion: number;
  mapgenVersion: number;
  scenarioCle: Cle;
  carteCle: Cle;
  graine: string;
  /** Instantané des flux d'aléa : chemin du flux → état. */
  flux: InstantaneRng;
  largeur: number;
  hauteur: number;
  /** Grille de la carte, jamais réécrite (`04-gameplay.md` §11.1). */
  grille: string[];
  proprietaires: Record<string, CampId>;
  /**
   * Bâtiments **désaffectés**, clés de case : neutres, sans revenu ni production
   * tant qu'une unité ne les a pas remis en service (`04-gameplay.md` §6 bis).
   */
  desaffectes: string[];
  unites: Unite[];
  prochainId: number;
  /** Prochaine balise à capturer, indexée par objectif. */
  relais?: Record<string, number>;
  journee: number;
  campCourant: CampId;
  camps: EtatCamp[];
  climat: EtatClimat;
  terrainsPoses: TerrainPose[];
  modificateurs: ModificateurActif[];
  prochainModificateur: number;
  mecanique: EtatMecanique | null;
  reglages: ReglagesPartie;
  partie: FinPartie;
  journal: EvenementJeu[];
  /** Unités produites par type et par camp : métrique de simulation. */
  produites: Record<string, number>;
}

// ---------------------------------------------------------------------------
// 4. Actions et résultats
// ---------------------------------------------------------------------------

/** Suite d'un ordre : ce que l'unité fait une fois arrivée (`04-gameplay.md` §2). */
export type Suite =
  | { type: 'rien' }
  | { type: 'attaquer'; cible: Case }
  | { type: 'capturer' }
  | { type: 'construire'; cible: Case }
  | { type: 'embarquer'; transport: string }
  | { type: 'debarquer'; vers: Case }
  | { type: 'fusionner'; avec: string }
  | { type: 'ravitailler'; cible: Case };

/** Les quatre actions du moteur (`04-gameplay.md` §2, qui fait foi). */
export type Action =
  | { type: 'ordre'; uniteId: string; chemin: Case[]; suite: Suite }
  | { type: 'produire'; batiment: Case; unite: CleUnite }
  | { type: 'pouvoir'; niveau: 'normal' | 'super'; cases?: Case[] }
  | { type: 'finTour' };

/** Motifs de refus : une action illégale ne lève jamais, elle refuse. */
export const MOTIFS_REFUS = [
  'partie_terminee', 'unite_inconnue', 'pas_mon_unite', 'unite_deja_agi',
  'chemin_invalide', 'chemin_trop_cher', 'case_occupee', 'terrain_infranchissable',
  'zone_de_controle', 'carburant_insuffisant', 'cible_hors_portee', 'cible_absente',
  'cible_amie', 'sans_munitions', 'ne_peut_pas_viser', 'a_bouge', 'cible_invisible',
  'capture_impossible', 'batiment_non_capturable', 'batiment_deja_possede',
  'transport_impossible', 'transport_plein', 'debarquement_impossible',
  'fusion_impossible', 'ravitaillement_impossible', 'construction_impossible',
  'batiment_inconnu', 'batiment_adverse', 'batiment_occupe', 'unite_non_produite_ici',
  'fonds_insuffisants', 'catalogue_inconnu',
  'pas_de_commandant', 'jauge_insuffisante', 'pouvoir_deja_utilise', 'pose_invalide',
  'action_inconnue',
] as const;
/** Motif d'un refus d'action. */
export type MotifRefus = typeof MOTIFS_REFUS[number];

/** Événement de jeu : ce que le rendu rejoue et ce que le journal garde. */
export type EvenementJeu =
  | { type: 'debut_journee'; journee: number; camp: CampId; saison: Saison; phase: string; meteo: Meteo }
  | { type: 'debut_tour'; journee: number; camp: CampId }
  | { type: 'revenus'; camp: CampId; montant: number }
  | { type: 'reparation'; uniteId: string; pv: number; cout: number }
  | { type: 'panne_seche'; uniteId: string }
  /**
   * Un déplacement, **avec le chemin réellement emprunté** — celui que
   * `verifierChemin` a validé, tronqué à la case d'arrêt en cas d'interruption.
   *
   * Le chemin fait partie de l'événement parce que le rendu ne doit rien
   * inventer : sans lui, une peau ne connaît que le départ et l'arrivée et
   * fabrique un trajet à elle, qui traverse allègrement les montagnes et les
   * unités adverses.
   */
  | { type: 'deplacement'; uniteId: string; de: Case; vers: Case; chemin: Case[]; interrompu: boolean }
  | { type: 'attaque'; attaquantId: string; cibleId: string; degats: number; riposte: number }
  | { type: 'hors_jeu'; uniteId: string; camp: CampId; unite: CleUnite }
  | { type: 'capture'; uniteId: string; case: Case; points: number; acquis: boolean; camp: CampId }
  /** Un bâtiment désaffecté vient d'être remis en service par ce camp. */
  | { type: 'remise_en_service'; uniteId: string; case: Case; camp: CampId }
  | { type: 'production'; camp: CampId; unite: CleUnite; case: Case; cout: number }
  | { type: 'embarquement'; uniteId: string; transportId: string }
  | { type: 'debarquement'; uniteId: string; transportId: string; vers: Case }
  | { type: 'fusion'; uniteId: string; avecId: string; rembourse: number }
  | { type: 'ravitaillement'; uniteId: string; cibleId: string }
  | { type: 'pouvoir'; camp: CampId; niveau: 'normal' | 'super'; nom: string }
  | { type: 'terrain_pose'; case: Case; terrain: CleTerrain }
  | { type: 'terrain_retire'; case: Case }
  | { type: 'repousse'; uniteId: string; vers: Case }
  | { type: 'degats_mecanique'; uniteId: string; pv: number }
  | { type: 'annonce'; texte: string; icone?: string }
  | { type: 'fin_tour'; camp: CampId }
  | { type: 'fin_partie'; vainqueur: CampId | null; nul: boolean; motif: string };

/** Résultat d'une action (`02-architecture.md` §3.1). */
export type Resultat =
  | { ok: true; etat: EtatPartie; evenements: EvenementJeu[] }
  | { ok: false; motif: MotifRefus; detail?: string };

// ---------------------------------------------------------------------------
// 5. Contrat des mécaniques (`04-gameplay.md` §11.1)
// ---------------------------------------------------------------------------

/** Contexte d'un hook : lecture seule, aléa dérivé, rien d'autre. */
export interface CtxMecanique<P = Record<string, never>> {
  readonly etat: EtatPartie;
  readonly catalogue: Catalogue;
  readonly parametres: P;
  readonly journee: number;
  readonly camp: CampId;
  readonly rng: Rng;
  /** Données persistantes de la mécanique (`etat.mecanique.donnees`). */
  readonly donnees: Record<string, number | string | boolean>;
}

/** Effet déclaratif renvoyé par un hook : le moteur seul écrit dans l'état. */
export type EffetMecanique =
  | { type: 'changer_terrain'; case: Case; vers: CleTerrain; journees?: number }
  | { type: 'degats'; case: Case; pv: number }
  | { type: 'repousser'; case: Case; vers: Case }
  | {
      type: 'modificateur';
      effet: EffetModificateur;
      duree: 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 };
    }
  | { type: 'annonce'; texte: string; icone?: string }
  | { type: 'donnee'; cle: string; valeur: number | string | boolean };

/** Verdict d'un hook `surMouvement`. */
export type VerdictMouvement =
  | { ok: true }
  | { ok: true; cheminTronque: Case[] }
  | { ok: false; motif: string };

/** Greffon enregistré par clé, appelé aux points de branchement fixes. */
export interface Mecanique<P = Record<string, never>> {
  cle: Cle;
  nom: string;
  /** Paramètres par défaut : sert aussi de schéma minimal. */
  parametresParDefaut: P;
  hooks: {
    debutTour?(ctx: CtxMecanique<P>): EffetMecanique[];
    finTour?(ctx: CtxMecanique<P>): EffetMecanique[];
    surMouvement?(ctx: CtxMecanique<P>, unite: Unite, chemin: Case[]): VerdictMouvement;
    surAttaque?(ctx: CtxMecanique<P>, att: Unite, def: Unite, degats: number): number;
    modifTerrain?(ctx: CtxMecanique<P>, c: Case, terrain: CleTerrain): CleTerrain;
    /**
     * Extension du moteur, hors des cinq hooks : surcoût par case, en points.
     * `04-gameplay.md` §12.5 confie les surcoûts de case à `surMouvement`, dont la
     * signature ne travaille que sur un chemin entier ; la portée de déplacement
     * (Dijkstra) a besoin du coût case par case. C'est une lecture pure, sans aléa.
     */
    surCoutCase?(ctx: CtxMecanique<P>, mouvement: TypeMouvement, terrain: CleTerrain, u: UnitType): number;
  };
}

// ---------------------------------------------------------------------------
// 6. Divers
// ---------------------------------------------------------------------------

/** Un commandant réduit à ce que le moteur en utilise. */
export interface CommandantMoteur {
  cle: Cle;
  nom: string;
  passif: EffetModificateur | null;
  pouvoir: { nom: string; barres: number; effets: EffetPouvoir[]; duree: 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 } };
  superPouvoir: { nom: string; barres: number; effets: EffetPouvoir[]; duree: 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 } };
}

/** Ce qu'il faut pour créer une partie : la carte, le scénario, les commandants. */
export interface Scene {
  scenarioCle: Cle;
  carteCle: Cle;
  largeur: number;
  hauteur: number;
  grille: string[];
  proprietaires: Record<string, CampId>;
  /** Bâtiments désaffectés au départ, clés de case. */
  desaffectes?: string[];
  unitesDepart: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[];
  camps: CampId[];
  commandants: (CommandantMoteur | null)[];
  mecanique: { cle: Cle; parametres: Record<string, number | string | boolean> } | null;
  reglages: ReglagesPartie;
}

/** Une unité vue par un trait : le moteur ne teste jamais une clé d'unité. */
export function porte(u: UnitType, t: Trait): boolean {
  return u.traits.includes(t);
}

/** Clé de case, 'x,y' — la seule forme de clé de case du moteur. */
export function cleCase(c: Case): string {
  return `${c.x},${c.y}`;
}

/** Lit une clé de case. */
export function depuisCle(k: string): Case {
  const [x, y] = k.split(',');
  return { x: Number(x), y: Number(y) };
}

/** PV affichés (1 à 10) d'un nombre de PV internes. */
export function pvAffiches(pv: number): number {
  return Math.max(0, Math.ceil(pv / 10));
}

/** Distance de Manhattan. */
export function manhattan(a: Case, b: Case): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
