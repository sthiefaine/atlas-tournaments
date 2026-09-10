/**
 * Types partagés d'Atlas Tournament — contrat unique entre le moteur, le serveur,
 * le contenu canon et les routines. Document propriétaire : `doc/03-schemas.md`
 * (et `doc/09-i18n.md` §2 pour les quatre types d'internationalisation).
 *
 * Ce fichier n'importe rien (règle d'import de `doc/02-architecture.md` §5).
 * Chaque énumération est publiée deux fois : un tableau `as const` (pour énumérer
 * et valider) et l'union de littéraux qui en dérive (pour typer).
 */

// ---------------------------------------------------------------------------
// 0. Conventions communes
// ---------------------------------------------------------------------------

/**
 * Code de camp. Deux lettres pour une nation — ISO 3166-1 alpha-2 en minuscules :
 * 'fr', 'lu', 'jp' —, trois lettres pour une équipe sans drapeau, qui n'est pas un
 * pays et n'a pas de code ISO : 'atl', la Sélection Méridienne (`01-bible.md` §3.4).
 */
export type CodePays = string;

/** Identifiant stable, minuscules, chiffres et tirets bas. */
export type Cle = string;

/** Date ISO 8601, jour seul : '2026-09-04'. */
export type DateIso = string;

/** Couleur hexadécimale en minuscules : '#3f86e0'. */
export type Couleur = string;

/** Forme d'une `Cle` : minuscule initiale, 2 à 48 caractères. */
export const REGEX_CLE = /^[a-z][a-z0-9_]{1,47}$/;

/** Forme d'un `CodePays` : deux lettres minuscules (nation) ou trois (équipe sans drapeau). */
export const REGEX_CODE_PAYS = /^[a-z]{2,3}$/;

/** Forme d'une `DateIso` : année-mois-jour. */
export const REGEX_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Forme d'une `Couleur` : dièse et six chiffres hexadécimaux minuscules. */
export const REGEX_COULEUR = /^#[0-9a-f]{6}$/;

/**
 * Forme d'une clé de flag narratif (`01-bible.md` §8.1, `03-schemas.md` §8).
 * Le domaine `monde.secret` est celui des easter eggs (`doc/14-secrets.md`) : il est
 * accepté par la forme, mais aucun de ces flags n'entre dans `content/flags.json`
 * ni n'est servi aux routines.
 */
export const REGEX_FLAG =
  /^(pays\.[a-z]{2,3}|monde\.(atlas|cinquieme|regie|public|tournoi|carnet|depeche|secret)|cmd\.[a-z][a-z0-9_]{1,31})\.[a-z][a-z0-9_]{2,47}$/;

/** Forme du `Commander.code` : `cmd_<prenom>_<nom>`. */
export const REGEX_CODE_COMMANDANT = /^cmd_[a-z][a-z0-9_]{1,43}$/;

/** Forme d'une clé de mécanique régionale : préfixe `meca_`. */
export const REGEX_CLE_MECANIQUE = /^meca_[a-z][a-z0-9_]{1,42}$/;

/** Forme d'une clé de case de `MapDef.proprietaires` : "x,y". */
export const REGEX_CASE = /^\d{1,2},\d{1,2}$/;

/** Statuts du cycle de vie d'un objet de contenu. */
export const STATUTS = [
  'brouillon', 'en_controle', 'valide', 'rejete', 'en_ligne', 'quarantaine', 'retire',
] as const;
/** Statut du cycle de vie (`02-architecture.md` §6, étendu par `05-routines.md` §1.4). */
export type Statut = typeof STATUTS[number];

/** Auteurs possibles d'un objet enveloppé. */
export const SOURCES_ENVELOPPE = ['humain', 'atlas_lore', 'atlas_map', 'atlas_cerveau'] as const;
/** Source d'un objet enveloppé : un humain ou une routine. */
export type SourceEnveloppe = typeof SOURCES_ENVELOPPE[number];

/** Palette d'une nation, d'un terrain ou d'un biome. */
export interface Palette { main: Couleur; dark: Couleur; light: Couleur }

/** Coordonnée de grille, origine en haut à gauche. */
export interface Case { x: number; y: number }

/** Camps possibles dans une partie : 0 = premier à jouer. */
export const CAMPS = [0, 1, 2, 3] as const;
/** Camp dans une partie : 0 = premier à jouer. */
export type CampId = typeof CAMPS[number];

/** Enveloppe commune à tout objet stocké en base. */
export interface Enveloppe {
  cle: Cle;
  version: number;
  statut: Statut;
  source: SourceEnveloppe;
  creeLe: DateIso;
  majLe: DateIso;
}

// ---------------------------------------------------------------------------
// 1. Country — fiche pays
// ---------------------------------------------------------------------------

/** Continents servant d'actes au voyage. */
export const CONTINENTS = [
  'europe', 'amerique_nord', 'amerique_sud', 'afrique', 'asie', 'oceanie', 'outre_mer',
] as const;
/** Continent d'un pays. */
export type Continent = typeof CONTINENTS[number];

/** Climats d'un pays : décident de la table saison × météo. */
export const CLIMATS = [
  'tempere', 'mediterraneen', 'oceanique', 'continental',
  'tropical', 'aride', 'polaire', 'montagnard',
] as const;
/** Climat d'un pays ou d'une région. */
export type Climat = typeof CLIMATS[number];

/** Hémisphères possibles. */
export const HEMISPHERES = ['nord', 'sud', 'equateur'] as const;
/** Hémisphère du pays : détermine la saison à une date donnée. */
export type Hemisphere = typeof HEMISPHERES[number];

/** Biomes de carte et de palette. */
export const BIOMES = [
  'plaine', 'foret', 'montagne', 'desert', 'jungle',
  'neige', 'volcanique', 'cotier', 'archipel', 'marais',
] as const;
/** Biome dominant d'une carte, d'un pays ou d'une région. */
export type Biome = typeof BIOMES[number];

/** Familles de spécialité : ce qu'une spécialité renforce. */
export const FAMILLES_SPECIALITE = [
  'infanterie', 'blindes', 'artillerie', 'aerien',
  'mobilite', 'defense', 'economie', 'ingenierie', 'polyvalence',
] as const;
/** Famille d'une spécialité, pour le tri et l'équilibrage. */
export type FamilleSpecialite = typeof FAMILLES_SPECIALITE[number];

/** Liste fermée des traits de spécialité (`03-schemas.md` §1). */
export const TRAITS_SPECIALITE = [
  'franchissement_riviere', 'experience_rapide', 'ravitaillement_ville',
  'vision_nuit', 'pied_marin',
] as const;
/** Trait de spécialité : une capacité booléenne qui ne s'écrit pas en chiffres. */
export type TraitSpecialite = typeof TRAITS_SPECIALITE[number];

/** Familles compatibles avec chaque `TraitSpecialite` (`03-schemas.md` §1). */
export const FAMILLES_PAR_TRAIT_SPECIALITE: Record<TraitSpecialite, readonly FamilleSpecialite[]> = {
  franchissement_riviere: ['mobilite', 'ingenierie'],
  pied_marin: ['mobilite', 'ingenierie'],
  experience_rapide: ['infanterie', 'polyvalence'],
  ravitaillement_ville: ['economie', 'defense'],
  vision_nuit: ['defense', 'polyvalence'],
};

/** Contenu d'une spécialité : un modificateur, ou un trait de la liste fermée. */
export type ContenuSpecialite =
  | { variant: 'modificateur'; effets: EffetModificateur[] }
  | { variant: 'trait'; trait: TraitSpecialite };

/** Portées d'une spécialité. */
export const PORTEES_SPECIALITE = ['pays', 'region'] as const;
/** Portée d'une spécialité : celle d'un pays ou celle d'une région. */
export type PorteeSpecialite = typeof PORTEES_SPECIALITE[number];

/** Spécialité d'un pays ou d'une région : un bonus permanent déclaratif. */
export interface Specialite {
  cle: Cle;
  nom: string;
  portee: PorteeSpecialite;
  famille: FamilleSpecialite;
  contenu: ContenuSpecialite;
  description: string;
}

/** Les dix archétypes canon de commandant (`01-bible.md` §6). */
export const ARCHETYPES = [
  'stratege_prudent', 'fonceuse', 'veteran', 'ingenieur', 'diplomate',
  'showman', 'survivante', 'meteorologue', 'prodige', 'gardienne',
] as const;
/** Clé d'archétype de commandant : union fermée, gelée par le brief. */
export type Archetype = typeof ARCHETYPES[number];

/** Types de drapeau dessinés par code. */
export const TYPES_DRAPEAU = [
  'bandes_verticales', 'bandes_horizontales', 'croix', 'canton', 'embleme',
] as const;
/** Type de drapeau d'un pays. */
export type TypeDrapeau = typeof TYPES_DRAPEAU[number];

/** Fiche pays : la graine narrative d'un pays de départ. */
export interface Country extends Enveloppe {
  code: CodePays;
  nom: string;
  nomCourt: string;
  gentile: string;
  continent: Continent;
  climat: Climat;
  hemisphere: Hemisphere;
  biomes: Biome[];
  specialite: Specialite;
  archetypeCommandant: Archetype;
  rivalNaturel: CodePays;
  voisins: CodePays[];
  palette: Palette;
  drapeau: { type: TypeDrapeau; couleurs: Couleur[] };
  flagsDisponibles: Cle[];
  regions?: Cle[];
  phare: boolean;
  accroche: string;
  interdits: string[];
}

// ---------------------------------------------------------------------------
// 2. Commander — commandant
// ---------------------------------------------------------------------------

/** Cibles possibles d'un effet de pouvoir. */
export const CIBLES_EFFET = [
  'mes_unites', 'unites_adverses', 'terrain', 'economie', 'toutes_unites',
] as const;
/** Cible d'un `EffetModificateur`. */
export type CibleEffet = typeof CIBLES_EFFET[number];

/**
 * Grandeurs qu'un modificateur peut toucher.
 *
 * Depuis le 10 septembre 2026 (`04-gameplay.md` §7.2, « Familles d'effets »),
 * trois grandeurs neuves : `prix` (le coût d'achat du camp), `chance` (la
 * largeur de l'aléa de combat) et `etoiles` (les étoiles de terrain de la
 * cible). Deux grandeurs sont **instantanées** et ne posent jamais de
 * modificateur dans l'état : `soin` et `degats_directs` s'appliquent une fois,
 * au déclenchement (`QUOI_INSTANTANES`).
 */
export const QUOI_MODIFICATEUR = [
  'attaque', 'defense', 'mouvement', 'portee', 'vision',
  'soin', 'degats_directs', 'fonds', 'carburant', 'capture',
  'prix', 'chance', 'etoiles',
] as const;
/** Grandeur modifiée par un `EffetModificateur`. */
export type QuoiModificateur = typeof QUOI_MODIFICATEUR[number];

/** Grandeurs appliquées une fois au déclenchement, jamais posées en modificateur. */
export const QUOI_INSTANTANES: readonly QuoiModificateur[] = ['soin', 'degats_directs'];

/** Bornes de chaque modificateur : `mult` = multiplicatif, `entier` = additif entier. */
export const BORNES_MODIFICATEUR: Record<QuoiModificateur, { min: number; max: number; forme: 'mult' | 'entier' }> = {
  attaque: { min: 0.5, max: 2.0, forme: 'mult' },
  defense: { min: 0.5, max: 2.0, forme: 'mult' },
  mouvement: { min: -3, max: 4, forme: 'entier' },
  portee: { min: -2, max: 3, forme: 'entier' },
  vision: { min: -2, max: 5, forme: 'entier' },
  soin: { min: 0, max: 5, forme: 'entier' },
  degats_directs: { min: 0, max: 3, forme: 'entier' },
  fonds: { min: 0.5, max: 2.0, forme: 'mult' },
  carburant: { min: 0.5, max: 2.0, forme: 'mult' },
  capture: { min: 0.5, max: 3.0, forme: 'mult' },
  prix: { min: 0.5, max: 1.5, forme: 'mult' },
  chance: { min: -3, max: 3, forme: 'entier' },
  etoiles: { min: -2, max: 2, forme: 'entier' },
};

/** Filtre facultatif d'un effet : à qui, sur quoi, dans quel rayon. */
export interface FiltreEffet {
  types?: CleUnite[];
  mouvement?: TypeMouvement[];
  surTerrain?: CleTerrain[];
  rayon?: { centre: 'commandant' | 'toutes'; cases: number };
}

/** Effet chiffré d'un pouvoir, d'un passif, d'une faiblesse ou d'une spécialité. */
export interface EffetModificateur {
  cible: CibleEffet;
  filtre?: FiltreEffet;
  modificateur: { quoi: QuoiModificateur; valeur: number };
}

/** Les sept formes de pose de terrain, et sept seulement. */
export const FORMES_POSER_TERRAIN = [
  'pont', 'telepherique', 'cable', 'chenal', 'polder', 'ponton', 'banc_de_sable',
] as const;
/** Forme d'un `EffetPoserTerrain`. */
export type FormePoserTerrain = typeof FORMES_POSER_TERRAIN[number];

/** Couples `depuis → vers` autorisés par forme (`04-gameplay.md` §7.2, qui fait foi). */
export const TABLE_POSER_TERRAIN: Record<FormePoserTerrain, { depuis: readonly CleTerrain[]; vers: CleTerrain }> = {
  pont: { depuis: ['mer', 'riviere'], vers: 'pont' },
  telepherique: { depuis: ['montagne'], vers: 'route' },
  cable: { depuis: ['foret', 'riviere'], vers: 'route' },
  chenal: { depuis: ['plaine', 'plage'], vers: 'riviere' },
  polder: { depuis: ['mer'], vers: 'plaine' },
  ponton: { depuis: ['mer', 'riviere'], vers: 'pont' },
  banc_de_sable: { depuis: ['mer'], vers: 'plage' },
};

/** Seule famille d'effet nouvelle : poser du terrain (brief, arbitrage n° 4). */
export interface EffetPoserTerrain {
  cible: 'terrain';
  poserTerrain: {
    forme: FormePoserTerrain;
    depuis: CleTerrain[];
    vers: CleTerrain;
    casesMax: number;
    contigu: boolean;
    duree: 'permanent' | { type: 'journees'; n: 1 | 2 | 3 };
  };
}

/**
 * Ravitailler d'un coup (10 septembre 2026) : remet au plein ce qui est coché
 * sur les unités visées, instantanément. `mes_unites` seulement.
 */
export interface EffetRavitailler {
  cible: 'mes_unites';
  filtre?: FiltreEffet;
  ravitailler: { carburant: boolean; munitions: boolean };
}

/**
 * Réactiver (10 septembre 2026) : les unités visées qui ont déjà joué ce tour
 * repassent `prete`, **une fois** par tour. C'est la seule exception à
 * l'interdit « donner un tour supplémentaire » du §7.2, et elle est réservée
 * au **super pouvoir** : un pouvoir normal qui la porte est refusé.
 */
export interface EffetReactiver {
  cible: 'mes_unites';
  filtre?: FiltreEffet;
  reactiver: true;
}

/**
 * Forcer la météo (10 septembre 2026) : la journée courante et les
 * `journees − 1` suivantes, pour tous les camps. Le tirage du climat a lieu
 * comme d'habitude, sa valeur est remplacée : le rejeu ne bouge pas.
 * `journees: 2` est réservé au super pouvoir.
 */
export interface EffetMeteo {
  cible: 'terrain';
  meteo: { valeur: Meteo; journees: 1 | 2 };
}

/**
 * Effet d'un pouvoir : un modificateur, une pose de terrain, ou l'une des
 * trois familles instantanées du 10 septembre 2026 (`04-gameplay.md` §7.2).
 */
export type EffetPouvoir =
  | EffetModificateur | EffetPoserTerrain | EffetRavitailler | EffetReactiver | EffetMeteo;

/** Durées simples d'un pouvoir, hors durée en journées. */
export const DUREES_POUVOIR = ['ce_tour', 'tour_complet'] as const;
/** Durée d'un pouvoir : ce tour, le tour complet, ou 1 à 3 journées pleines. */
export type DureePouvoir = typeof DUREES_POUVOIR[number] | { type: 'journees'; n: 1 | 2 | 3 };

/** Pouvoir ou super pouvoir d'un commandant. */
export interface Pouvoir {
  nom: string;
  description: string;
  barres: number;
  effets: EffetPouvoir[];
  duree: DureePouvoir;
  replique: string;
}

/** Axes de faiblesse déclarables par un commandant. */
export const AXES_FAIBLESSE = [
  'aerien', 'artillerie', 'blindes', 'infanterie',
  'economie', 'mobilite', 'terrain_difficile', 'partie_longue',
] as const;
/** Axe sur lequel un commandant est structurellement moins bon. */
export type AxeFaiblesse = typeof AXES_FAIBLESSE[number];

/** Accessoires de portrait dessinés par code. */
export const ACCESSOIRES = ['beret', 'casque', 'lunettes', 'foulard', 'aucun'] as const;
/** Accessoire du portrait d'un commandant. */
export type Accessoire = typeof ACCESSOIRES[number];

/**
 * Commandant : passif, pouvoir, super pouvoir, faiblesse et répliques.
 *
 * `secret` et `deblocage` portent les **généraux secrets** (`doc/13-campagne.md` §7) :
 * absents de l'écran de sélection tant que le `Deblocage` désigné n'est pas acquis.
 * Un général secret est équilibré comme les autres et **jamais indispensable** :
 * il n'ouvre ni fin, ni fil, ni destination.
 */
export interface Commander extends Enveloppe {
  code: Cle;
  nom: string;
  paysCode: CodePays;
  archetype: Archetype;
  secret?: boolean;
  deblocage?: Cle;
  traits: [string, string, string];
  passif?: EffetModificateur;
  pouvoir: Pouvoir;
  superPouvoir: Pouvoir;
  faiblesse: { axe: AxeFaiblesse; effet: EffetModificateur; description: string };
  repliques: {
    ouverture: string[];
    victoire: string[];
    defaite: string[];
    unitePerdue: string[];
  };
  portrait: { teint: Couleur; cheveux: Couleur; accessoire: Accessoire };
}

// ---------------------------------------------------------------------------
// 3. UnitType — type d'unité
// ---------------------------------------------------------------------------

/** Les dix unités de base, statut `canon`, jamais retirées du catalogue. */
export const CLES_UNITE_CANON = [
  'infanterie', 'meca', 'recon', 'char_leger', 'char_lourd',
  'artillerie', 'roquettes', 'antiair', 'helico', 'transport',
] as const;
/** Clé d'une des dix unités canon. */
export type CleUniteCanon = typeof CLES_UNITE_CANON[number];

/** Clé d'unité : une des dix canon, ou une clé homologuée. Type ouvert. */
export type CleUnite = Cle;

/** Types de mouvement connus du moteur. */
export const TYPES_MOUVEMENT = [
  'pied', 'bottes', 'roues', 'chenilles', 'air', 'mer', 'amphibie',
] as const;
/** Mode de déplacement d'une unité. */
export type TypeMouvement = typeof TYPES_MOUVEMENT[number];

/** Domaines d'évolution d'une unité. */
export const DOMAINES = ['terre', 'air', 'mer'] as const;
/** Domaine d'une unité. */
export type Domaine = typeof DOMAINES[number];

/** Les quatre statuts d'homologation. */
export const STATUTS_UNITE = ['canon', 'essai', 'homologuee', 'retiree'] as const;
/** Statut d'homologation d'une unité. */
export type StatutUnite = typeof STATUTS_UNITE[number];

/**
 * Liste fermée des quinze traits d'unité (`04-gameplay.md` §13.2). Le
 * quinzième, `furtif`, est entré le 7 septembre 2026 avec le catalogue 6 : une
 * furtivité **à la demande**, basculée par la suite d'ordre `furtivite`.
 */
export const TRAITS = [
  'transport', 'tir_indirect', 'anti_air', 'amphibie', 'vol',
  'furtif_nuit', 'vision_etendue', 'ravitaillement', 'tout_terrain', 'capture', 'genie',
  'drone', 'brouilleur', 'plongee', 'furtif',
] as const;
/** Trait d'unité : un comportement implémenté une seule fois dans le moteur. */
export type Trait = typeof TRAITS[number];

/** Bases de silhouette. */
export const BASES_SILHOUETTE = ['chenilles', 'roues', 'pattes', 'coque', 'rotor', 'ailes', 'rail'] as const;
/** Base d'une silhouette d'unité. */
export type BaseSilhouette = typeof BASES_SILHOUETTE[number];

/** Corps de silhouette. */
export const CORPS_SILHOUETTE = ['bloc', 'capsule', 'plateau'] as const;
/** Corps d'une silhouette d'unité. */
export type CorpsSilhouette = typeof CORPS_SILHOUETTE[number];

/** Modules posables sur un corps de silhouette, trois au plus. */
export const MODULES_SILHOUETTE = [
  'tourelle', 'canon_long', 'lance_roquettes', 'radar', 'antenne',
  'grue', 'panneaux_solaires', 'nacelle',
] as const;
/** Module d'une silhouette d'unité. */
export type ModuleSilhouette = typeof MODULES_SILHOUETTE[number];

/** Tailles de silhouette admises. */
export const TAILLES_SILHOUETTE = [1, 2, 3] as const;
/** Taille d'une silhouette d'unité. */
export type TailleSilhouette = typeof TAILLES_SILHOUETTE[number];

/** Dessin déclaratif d'une unité, composé par le code vectoriel. */
export interface Silhouette {
  base: BaseSilhouette;
  corps: CorpsSilhouette;
  modules: ModuleSilhouette[];
  taille: TailleSilhouette;
}

/** Type d'unité : tout ce qu'une unité est, en données et jamais en code. */
export interface UnitType {
  /** Matériel réservé au camp sans drapeau Atlas-Méridien. */
  factionExclusive?: 'atl';
  cle: CleUnite;
  nom: string;
  nomCourt: string;
  statut: StatutUnite;
  /** `catalogue` : la version de catalogue qui accueille l'unité (2 à défaut). */
  homologation?: { date: DateIso; sourceEventCode?: Cle; catalogue?: number };
  traits: Trait[];
  silhouette: Silhouette;
  cout: number;
  mouvement: number;
  typeMouvement: TypeMouvement;
  domaine: Domaine;
  portee: [number, number];
  vision: number;
  munitions: number | null;
  carburant: { max: number; parCase: number; parTour: number } | null;
  capture: boolean;
  /**
   * `ravitaille` (catalogue 6) : le transport remet munitions et carburant au
   * plein de ce qu'il porte à chaque début de tour — le porte-avions est une
   * base flottante, le camion de ravitaillement aussi ; la barge et le
   * transport d'assaut ne font que porter. Absent : faux.
   */
  transport: { places: number; accepte: CleUnite[]; ravitaille?: boolean } | null;
  degats: Partial<Record<CleUnite, number>>;
  subitDegats?: Partial<Record<CleUnite, number>>;
  /**
   * Arme secondaire (`04-gameplay.md` §5.3) : contre ces cibles, l'unité tire à
   * la mitrailleuse — aucune munition consommée, tir permis à zéro munition,
   * attaque comme riposte. Interdite à une unité sans munitions, qui n'en a
   * pas besoin. Absente ou `null` : tout tir consomme.
   */
  armeSecondaire?: CleUnite[] | null;
  /**
   * Base de dégâts de l'arme secondaire contre une cible **non listée**, quand
   * l'arme principale est vide (§5.3, 7 septembre 2026) : un char à sec
   * mitraille encore un char, pour peu. `null` ou absent : hors liste, pas de
   * tir à sec. Exige `armeSecondaire` et `munitions` non nuls.
   */
  degatsSecondaire?: number | null;
  peutRiposter: boolean;
  peutTirerApresMouvement: boolean;
}

// ---------------------------------------------------------------------------
// 4. Terrain
// ---------------------------------------------------------------------------

/**
 * Les quinze terrains du jeu. `herbe_haute` (7 septembre 2026 au soir) est le
 * quinzième : une plaine qui cache les fantassins au-delà du contact et laisse
 * voir les véhicules — « l'herbe cache ce qui est plus bas qu'un char ».
 */
export const CLES_TERRAIN = [
  'plaine', 'foret', 'montagne', 'route', 'ville', 'qg',
  'usine', 'aeroport', 'mer', 'riviere', 'pont', 'plage', 'radar', 'port',
  'herbe_haute',
] as const;
/** Clé d'un terrain. */
export type CleTerrain = typeof CLES_TERRAIN[number];

/** Caractère de grille de chaque terrain (`04-gameplay.md` §4). */
export const CARACTERE_PAR_TERRAIN: Record<CleTerrain, string> = {
  plaine: 'P', foret: 'F', montagne: 'M', route: 'R', ville: 'C', qg: 'H',
  usine: 'U', aeroport: 'A', mer: 'W', riviere: 'V', pont: 'N', plage: 'S', radar: 'T',
  port: 'O', herbe_haute: 'G',
};

/** Caractères de grille connus, dans l'ordre des terrains. */
export const CARACTERES_GRILLE = ['P', 'F', 'M', 'R', 'C', 'H', 'U', 'A', 'W', 'V', 'N', 'S', 'T', 'O', 'G'] as const;

/** Terrains capturables : les seuls à pouvoir porter un propriétaire. */
export const TERRAINS_CAPTURABLES = ['ville', 'usine', 'aeroport', 'qg', 'radar', 'port'] as const;

/**
 * Caractères de grille des terrains capturables : les seuls à pouvoir porter un
 * propriétaire dans une `MapDef`. Dérivé, jamais recopié — une liste écrite à la
 * main aurait oublié le port le jour où il est entré au canon.
 */
export const CARACTERES_CAPTURABLES: readonly string[] = TERRAINS_CAPTURABLES
  .map((t) => CARACTERE_PAR_TERRAIN[t]);

/** Terrain : coûts par type de mouvement, défense, revenu, rendu. */
export interface Terrain {
  cle: CleTerrain;
  car: string;
  nom: string;
  defense: number;
  couts: Partial<Record<TypeMouvement, number>>;
  capturable: boolean;
  revenus: number;
  produit: CleUnite[];
  ravitaille: boolean;
  soigne: number;
  cacheEnBrouillard: boolean;
  /**
   * La cachette ne vaut que pour ces types de mouvement (7 septembre 2026) :
   * l'herbe haute cache `pied` et `bottes`, un char y reste vu. Absent : la
   * cachette vaut pour tous (forêt, montagne). Exige `cacheEnBrouillard`.
   */
  cacheSeulement?: TypeMouvement[];
  palette: Palette;
}

// ---------------------------------------------------------------------------
// 5. MapDef — définition de carte
// ---------------------------------------------------------------------------

/** Symétries proposables au générateur de cartes. */
export const SYMETRIES = ['aucune', 'axe_vertical', 'axe_horizontal', 'point', 'rotation_90'] as const;
/** Symétrie d'une carte générée. */
export type Symetrie = typeof SYMETRIES[number];

/** Paramètres de génération d'une carte : l'intention, pas la grille. */
export interface ParametresCarte {
  largeur: number;
  hauteur: number;
  camps: 2 | 3 | 4;
  biome: Biome;
  ratioMer: number;
  ratioRelief: number;
  villesParCamp: number;
  villesNeutres: number;
  usinesParCamp: number;
  aeroportsParCamp: number;
  /** Ports par camp (0 à 2), posés sur une côte ; absent : 0. Sans port, aucun navire ne se produit. */
  portsParCamp?: number;
  /** Stations radar par camp (0 à 2) ; absent : 0. */
  radarsParCamp?: number;
  /** Part de la plaine semée d'herbe haute (0 à 0,5) ; absent : 0 — 7 septembre 2026. */
  ratioHerbesHautes?: number;
  symetrie: Symetrie;
  densiteRoutes: number;
  mecanique?: Cle;
}

/** Unité posée sur la carte au coup d'envoi. */
export interface UniteDepart {
  camp: CampId;
  type: CleUnite;
  x: number;
  y: number;
  pv?: number;
}

/** Définition d'une carte : grille de caractères, propriétaires, unités de départ. */
export interface MapDef extends Enveloppe {
  code: Cle;
  nom: string;
  largeur: number;
  hauteur: number;
  camps: 2 | 3 | 4;
  biome: Biome;
  grille: string[];
  proprietaires: Record<string, CampId>;
  unitesDepart: UniteDepart[];
  /**
   * Bâtiments désaffectés au départ : capturables, jamais le QG, sans
   * propriétaire. Ils ne rapportent rien tant qu'on ne les a pas remis en service.
   */
  desaffectes?: Case[];
  mecanique?: Cle;
  generation?: { graine: string; parametres: ParametresCarte; mapgenVersion: number };
  diagnostic?: {
    surfaceTerre: number;
    distanceQgQg: number;
    distanceQgUsine: number[];
    zonesIsolees: number;
  };
}

// ---------------------------------------------------------------------------
// 6. Scenario — une mission
// ---------------------------------------------------------------------------

/** Types d'objectif de victoire. */
export const TYPES_OBJECTIF_VICTOIRE = [
  'capture_qg', 'hors_jeu_total', 'capturer', 'tenir', 'survivre', 'proteger', 'relais', 'points',
] as const;
/** Nom du type d'un objectif de victoire, sans ses paramètres. */
export type TypeObjectifVictoire = typeof TYPES_OBJECTIF_VICTOIRE[number];
/** Condition de victoire d'un scénario : en satisfaire une suffit. */
export type ObjectifVictoire =
  | { type: 'capture_qg' }
  | { type: 'hors_jeu_total' }
  | { type: 'capturer'; cases: Case[]; combien: number }
  | { type: 'tenir'; cases: Case[]; journees: number }
  | { type: 'survivre'; journees: number }
  | { type: 'proteger'; uniteRef: string; destination?: Case }
  | { type: 'relais'; cases: Case[] }
  | { type: 'points'; seuil: number };

/** Types d'objectif de défaite. */
export const TYPES_OBJECTIF_DEFAITE = [
  'qg_perdu', 'toutes_unites_hors_jeu', 'limite_journees', 'unite_perdue', 'case_perdue',
] as const;
/** Nom du type d'un objectif de défaite, sans ses paramètres. */
export type TypeObjectifDefaite = typeof TYPES_OBJECTIF_DEFAITE[number];
/** Condition de défaite d'un scénario : en subir une suffit. */
export type ObjectifDefaite =
  | { type: 'qg_perdu' }
  | { type: 'toutes_unites_hors_jeu' }
  | { type: 'limite_journees'; journees: number }
  | { type: 'unite_perdue'; uniteRef: string }
  | { type: 'case_perdue'; cases: Case[] };

/** Émotions jouables par le rendu sur une réplique. */
export const EMOTIONS = ['neutre', 'joie', 'colere', 'surprise', 'doute', 'triomphe'] as const;
/** Émotion d'une réplique de dialogue. */
export type Emotion = typeof EMOTIONS[number];

/** Réplique d'un dialogue de scénario. */
export interface Dialogue {
  locuteur: Cle;
  texte: string;
  emotion?: Emotion;
}

/** Ce qui peut ouvrir une scène de dialogue pendant un match. */
export const DECLENCHEURS_SCENE = [
  'ouverture', 'journee', 'premier_combat', 'capture', 'perte', 'panne_seche', 'production',
  'pouvoir', 'etape',
] as const;
/** Nom du type d'un déclencheur de scène, sans ses paramètres. */
export type TypeDeclencheurScene = typeof DECLENCHEURS_SCENE[number];

/**
 * Déclencheur d'une scène de dialogue **en cours de match**.
 *
 * Tous se lisent sur les événements que le moteur vient de rendre, jamais sur
 * une horloge ni sur un sondage : une scène se joue parce qu'une chose s'est
 * produite dans la partie, et se rejoue à l'identique au rejeu.
 */
export type DeclencheurScene =
  /** À l'ouverture, une fois la carte à l'écran. */
  | { type: 'ouverture' }
  /** Au début du tour du joueur, à partir de cette journée. */
  | { type: 'journee'; journee: number }
  /** À la première attaque de la partie, quel qu'en soit l'auteur. */
  | { type: 'premier_combat' }
  /** Quand un bâtiment change de main ; `camp` restreint au camp qui l'acquiert. */
  | { type: 'capture'; camp?: CampId }
  /** Quand une unité sort du jeu ; `camp` restreint au camp qui la perd. */
  | { type: 'perte'; camp?: CampId }
  /**
   * Quand une unité aérienne tombe en panne sèche (`04-gameplay.md` §2) ;
   * `camp` restreint au camp qui la perd. C'est une perte sans combat, et un
   * commandant a autre chose à en dire qu'après un tir.
   */
  | { type: 'panne_seche'; camp?: CampId }
  /** Quand une unité est produite ; `unite` restreint à ce type. */
  | { type: 'production'; unite?: CleUnite }
  /** Quand un commandant déclenche un pouvoir. */
  | { type: 'pouvoir'; camp?: CampId }
  /** Quand un objectif à relais franchit son n-ième jalon. */
  | { type: 'etape'; etape: number };

/**
 * Une **scène de dialogue** : quelques répliques et ce qui les fait venir.
 *
 * C'est la brique qui manquait pour tenir la promesse d'Advance Wars — les
 * commandants parlent *pendant* le match, pas seulement avant. Une scène ne se
 * joue **qu'une fois** par partie, identifiée par sa `cle` : un dialogue qui
 * revient à chaque capture cesse d'être une scène et devient une gêne.
 *
 * La fin de match n'a pas de déclencheur : elle appartient à `dialogueVictoire`
 * et `dialogueDefaite`, qui existaient avant et restent les propriétaires du
 * moment. Deux façons de dire la même chose seraient une de trop.
 */
export interface SceneDialogue {
  cle: Cle;
  declencheur: DeclencheurScene;
  repliques: Dialogue[];
}

/** Moments où un choix peut se présenter dans un match. */
export const MOMENTS_CHOIX = ['ouverture', 'mi_partie', 'fin'] as const;
/** Moment d'un `ChoixScenario`. */
export type MomentChoix = typeof MOMENTS_CHOIX[number];

/** Scène de choix d'un scénario : une question, deux ou trois options, des flags. */
export interface ChoixScenario {
  cle: Cle;
  question: string;
  moment: MomentChoix;
  declencheur?: { journee?: number; flagRequis?: Cle };
  litFlags: Cle[];
  options: {
    cle: Cle;
    libelle: string;
    ecritFlags: { cle: Cle; valeur: true | number }[];
    effetImmediat?: EffetPouvoir;
  }[];
}

/** Stratégies d'IA disponibles pour un camp non joueur. */
export const STRATEGIES_IA = ['gloutonne', 'ponderee', 'agressive', 'defensive'] as const;
/** Stratégie d'IA d'un camp. */
export type StrategieIa = typeof STRATEGIES_IA[number];

/**
 * Match d'**incarnation** : le joueur joue entièrement une nation alliée (`BRIEF.md`,
 * « Le joueur et le départ »).
 *
 * Le camp du joueur prend **le général de cette nation** — ses pouvoirs et sa jauge —,
 * **son catalogue** (unité spéciale comprise), sa spécialité et son style visuel ; le
 * commandant d'origine du joueur reste au banc en **co-commandant passif**, de sorte
 * que le lien avec sa campagne ne se perd jamais.
 *
 * Trois bornes, toutes tenues ailleurs qu'ici :
 *
 * 1. **Aucun flag de la trame principale.** Un scénario d'incarnation n'écrit que
 *    `pays.<paysCode>.*` et `cmd.*` — jamais `monde.*`. C'est un invariant de schéma,
 *    refusé par `validerScenario` (`08-narration-choix.md` §4.5).
 * 2. **La nation incarnée ne se retire pas pendant qu'on la joue** : garantie de
 *    contenu, portée par la colonne vertébrale (`13-campagne.md` §3.4).
 * 3. **Incarner est toujours proposé, jamais imposé**, sauf à l'acte III où le joueur
 *    choisit à chaque bataille parmi ses alliées.
 */
export interface Incarnation {
  /** La nation jouée. Une nation `alliee` du profil, jamais celle du joueur. */
  paysCode: CodePays;
  /** Son général, celui que prend le camp du joueur. Forme `cmd_<prenom>_<nom>`. */
  commandantCle: Cle;
}

/**
 * Un **banc prêté** au briefing (`01-bible.md` §4.6, « La délégation prête son banc »).
 *
 * Un scénario qui en porte propose au joueur, avant le montage, de jouer l'épreuve
 * **sous les couleurs** d'une autre délégation : son général et ses pouvoirs au camp
 * du joueur, ce qui n'est rien d'autre qu'une `Incarnation` choisie au briefing
 * plutôt qu'écrite dans le scénario. Le commandant d'origine ne quitte pas le
 * terrain : si le général prêté y jouait déjà, les deux **échangent** leurs bancs —
 * c'est un échange d'entraîneurs, jamais un changement de camp.
 *
 * Deux différences avec `Scenario.incarnation`, qui justifient un champ à part :
 * un banc est **toujours proposé, jamais imposé** (le commandant du scénario reste
 * le défaut), et l'épreuve garde ses flags — c'est une variante d'une étape, pas
 * un match d'incarnation (`13-campagne.md` §3.4 bis). Un scénario ne porte donc
 * jamais les deux.
 */
export interface BancPrete {
  /** Le général prêté. Forme `cmd_<prenom>_<nom>` ; jamais celui du camp 0. */
  commandantCle: Cle;
  /** La délégation dont on joue les couleurs (`atl` pour un banc de l'Intendance). */
  paysCode: CodePays;
  /**
   * Clé i18n du libellé de l'option, sous la forme d'un complément — « sous les
   * couleurs du Luxembourg, avec Tomas Reiner » — que le briefing et le carnet
   * préfixent chacun de leur verbe.
   */
  libelle: string;
}

/**
 * Scénario : une mission jouable, sa carte, son climat, ses objectifs et ses choix.
 *
 * Les champs de campagne (`doc/13-campagne.md`) sont facultatifs pour ne pas invalider
 * le contenu antérieur, mais **obligatoires pour tout scénario de campagne** produit à
 * partir de l'étape « Campagne » du plan :
 *
 * - `gabarit` : le gabarit de mission dont le scénario est une instance ;
 * - `dureeVisee` : la durée d'une partie en minutes, en mode `normal` — une **mesure**
 *   certifiée par simulation, pas une intention (`05-routines.md` §4) ;
 * - `modes` : les deux jeux de paramètres, certifiés tous les deux par le contrôle.
 *   Absent, le scénario se joue en `normal` avec ses champs de premier niveau.
 */
export interface InstallationIem { cle: Cle; x: number; y: number; rayon?: number; premiereJournee: number; intervalle?: number }
export interface EvenementClimatScenario { cle: Cle; journee: number; meteo: Meteo; duree: number; campsAdaptes: CampId[] }

export interface RenfortScenario {
  journee: number;
  unites: { camp: CampId; type: CleUnite; x: number; y: number; pv?: number }[];
}

export interface Scenario extends Enveloppe {
  installationsIem?: InstallationIem[];
  evenementsClimat?: EvenementClimatScenario[];
  factionsParCamp?: Partial<Record<CampId, 'atl'>>;
  /** Partition des camps. Absent : chacun pour soi. */
  equipes?: CampId[][];
  renforts?: RenfortScenario[];
  code: Cle;
  nom: string;
  acte: number;
  gabarit?: CleGabarit;
  dureeVisee?: number;
  modes?: ModesScenario;
  /**
   * Présent, ce scénario est un **match d'incarnation** : le joueur joue la nation
   * désignée, avec son général au camp 0. Voir `Incarnation`.
   */
  incarnation?: Incarnation;
  /**
   * Les bancs proposés au briefing, en plus du commandant du scénario. Voir
   * `BancPrete`. Incompatible avec `incarnation`.
   */
  bancs?: BancPrete[];
  paysCode: CodePays;
  regionCle?: Cle;
  carteCle: Cle;
  date: DateIso;
  climatFixe?: { saison?: Saison; meteo?: Meteo };
  cycleJourNuit: { jour: number; nuit: number };
  catalogueVersion: number;
  /** Révision des capacités ; absence conserve la sélection historique par catalogue. */
  commandantsVersion?: 1 | 2 | 3 | 4;
  commandants: { camp: CampId; commandantCle: Cle; ia?: StrategieIa }[];
  fondsDepartParCamp?: Partial<Record<CampId, number>>;
  revenusParBatimentParCamp?: Partial<Record<CampId, number>>;
  vitesseJaugeJoueur?: number;
  previsionJournees?: number;
  fondsDepart: number;
  revenusParBatiment: number;
  brouillard: boolean;
  limiteJournees: number | null;
  victoire: ObjectifVictoire[];
  defaite: ObjectifDefaite[];
  dialogueOuverture: Dialogue[];
  dialogueVictoire: Dialogue[];
  dialogueDefaite: Dialogue[];
  /**
   * Les scènes jouées **pendant** le match. Facultatif pour ne pas invalider le
   * contenu antérieur : un scénario sans scène se joue exactement comme avant.
   */
  scenesDialogue?: SceneDialogue[];
  choix: ChoixScenario[];
  flagsRequis: Cle[];
  flagsInterdits: Cle[];
  recompenses: { flags: Cle[]; fonds?: number; coCommandant?: Cle; carteMonde?: Cle[] };
}

// ---------------------------------------------------------------------------
// 7. Region
// ---------------------------------------------------------------------------

/** Types de région d'un pays phare. */
export const TYPES_REGION = ['metropolitaine', 'outre_mer', 'collectivite'] as const;
/** Type d'une région. */
export type TypeRegion = typeof TYPES_REGION[number];

/** Région : une sous-étape d'un pays phare, avec sa mécanique et son ton local. */
export interface Region extends Enveloppe {
  code: Cle;
  paysCode: CodePays;
  nom: string;
  type: TypeRegion;
  ordreConseille: number;
  biome: Biome;
  climat: Climat;
  specialiteLocale: Specialite;
  mecanique: {
    cle: Cle;
    parametres: Record<string, number | string | boolean>;
    description: string;
  };
  commandantCle: Cle;
  scenarios: Cle[];
  accroche: string;
  motsCles: string[];
  flagsPropres: Cle[];
}

// ---------------------------------------------------------------------------
// 8. Flag — le système narratif
// ---------------------------------------------------------------------------

/** Portées possibles d'un flag narratif. */
export const PORTEES_FLAG = ['pays', 'monde', 'commandant'] as const;
/** Portée d'un flag. */
export type PorteeFlag = typeof PORTEES_FLAG[number];

/** Types de valeur d'un flag. */
export const VALEURS_FLAG = ['booleen', 'compteur', 'relation'] as const;
/** Type de valeur d'un flag : booléen, compteur borné, relation signée. */
export type ValeurFlag = typeof VALEURS_FLAG[number];

/** Domaines d'impact déclarables par un flag. */
export const IMPACTS_FLAG = ['fin', 'recrutement', 'dialogue', 'economie', 'carte_monde'] as const;
/** Domaine impacté par un flag. */
export type ImpactFlag = typeof IMPACTS_FLAG[number];

/** Flag narratif : un fait acquis, écrit par un choix, une trame ou le moteur. */
export interface Flag {
  cle: Cle;
  portee: PorteeFlag;
  paysCode?: CodePays;
  commandantCle?: Cle;
  libelle: string;
  description: string;
  valeur: ValeurFlag;
  min: number | null;
  max: number | null;
  exclusifAvec: Cle[];
  impacte: ImpactFlag[];
  perenne: boolean;
}

/** État runtime des flags, dans la sauvegarde : le carnet de voyage. */
export interface EtatFlags {
  booleens: Record<Cle, true>;
  compteurs: Record<Cle, number>;
  journal: {
    journee: number;
    scenarioCle: Cle;
    choixCle: Cle;
    optionCle: Cle;
    flagsEcrits: Cle[];
  }[];
}

// ---------------------------------------------------------------------------
// 9. Event — événement de jeu issu de l'actualité
// ---------------------------------------------------------------------------

/** Liste blanche fermée des catégories d'événement. */
export const CATEGORIES_EVENT = [
  'competition_sportive', 'festival', 'meteo', 'decouverte', 'culture', 'anniversaire',
] as const;
/** Catégorie d'un `Event`, prise dans la liste blanche. */
export type CategorieEvent = typeof CATEGORIES_EVENT[number];

/** Effet d'un événement sur des parties existantes. */
export type EffetEvent =
  | { type: 'bonus_pays'; paysCode: CodePays; modificateur: EffetPouvoir }
  | { type: 'carte_bonus'; carteCle: Cle }
  | { type: 'dialogue_bonus'; commandantCle: Cle; repliques: string[] }
  | { type: 'meteo_globale'; mecaniqueCle: Cle; parametres: Record<string, number> }
  | { type: 'cosmetique'; palette: Palette };

/** Types d'effet d'événement. */
export const TYPES_EFFET_EVENT = [
  'bonus_pays', 'carte_bonus', 'dialogue_bonus', 'meteo_globale', 'cosmetique',
] as const;

/** Événement de jeu inspiré d'une actualité de la liste blanche. */
export interface Event extends Enveloppe {
  code: Cle;
  titre: string;
  resume: string;
  categorie: CategorieEvent;
  sourceUrl: string;
  sourceNom: string;
  paysConcernes: CodePays[];
  debut: DateIso;
  fin: DateIso;
  effet: EffetEvent;
  valideParHumain: boolean;
  motifRefusHumain?: string;
}

// ---------------------------------------------------------------------------
// 10. MemoryEntry — mémoire structurée
// ---------------------------------------------------------------------------

/** Portées d'une entrée de mémoire. */
export const PORTEES_MEMOIRE = [
  'global', 'atlas_lore', 'atlas_map', 'atlas_controle', 'atlas_cerveau',
  'atlas_traduction', 'pays', 'region', 'commandant', 'carte',
] as const;
/** Portée d'une entrée de mémoire. */
export type PorteeMemoire = typeof PORTEES_MEMOIRE[number];

/** Portées de mémoire exigeant un `porteeRef`. */
export const PORTEES_MEMOIRE_REFERENCEES = ['pays', 'region', 'commandant', 'carte'] as const;

/** Sujets d'une entrée de mémoire. */
export const SUJETS_MEMOIRE = [
  'preference_humaine', 'motif_rejet_recurrent', 'regle_de_ton',
  'equilibrage', 'fait_de_lore', 'incident_technique',
] as const;
/** Sujet d'une entrée de mémoire. */
export type SujetMemoire = typeof SUJETS_MEMOIRE[number];

/** Sources d'une entrée de mémoire. */
export const SOURCES_MEMOIRE = ['humain', 'atlas_controle', 'atlas_cerveau', 'simulation', 'incident'] as const;
/** Source d'une entrée de mémoire. */
export type SourceMemoire = typeof SOURCES_MEMOIRE[number];

/** Entrée de mémoire : un fait court, daté, sourcé, borné dans le temps. */
export interface MemoryEntry {
  cle: Cle;
  date: DateIso;
  source: SourceMemoire;
  sourceRef?: string;
  sujet: SujetMemoire;
  portee: PorteeMemoire;
  porteeRef: Cle | null;
  contenu: string;
  poids: number;
  occurrences: number;
  expireLe: DateIso | null;
}

// ---------------------------------------------------------------------------
// 11. PromptVersion — prompt métier versionné
// ---------------------------------------------------------------------------

/** Les cinq routines qui portent un prompt métier. */
export const CLES_PROMPT = [
  'atlas_lore', 'atlas_map', 'atlas_controle', 'atlas_cerveau', 'atlas_traduction',
] as const;
/** Clé de prompt métier. */
export type ClePrompt = typeof CLES_PROMPT[number];

/** Statuts d'une version de prompt. */
export const STATUTS_PROMPT = ['propose', 'courant', 'retire'] as const;
/** Statut d'une version de prompt. */
export type StatutPrompt = typeof STATUTS_PROMPT[number];

/** Auteurs possibles d'une version de prompt. */
export const AUTEURS_PROMPT = ['humain', 'atlas_cerveau'] as const;
/** Auteur d'une version de prompt. */
export type AuteurPrompt = typeof AUTEURS_PROMPT[number];

/** Métriques mesurées pendant qu'une version de prompt était courante. */
export interface MetriquesPrompt {
  runs: number;
  objetsProduits: number;
  tauxRejet: number;
  motifsTop: { motif: string; n: number }[];
  coherenceLore: number;
  dureeMoyenneMs: number;
  fenetre: { du: DateIso; au: DateIso };
}

/** Version d'un prompt métier : historique complet, retour arrière possible. */
export interface PromptVersion {
  cle: ClePrompt;
  version: number;
  corps: string;
  auteur: AuteurPrompt;
  auteurRef?: string;
  statut: StatutPrompt;
  parentVersion: number | null;
  justification: string;
  diffResume: string[];
  metriques: MetriquesPrompt | null;
  valideParHumain: boolean;
  creeLe: DateIso;
  activeLe: DateIso | null;
}

// ---------------------------------------------------------------------------
// 12. ReviewVerdict — verdict de la routine contrôle
// ---------------------------------------------------------------------------

/** Cibles possibles d'une review. */
export const CIBLES_REVIEW = [
  'carte', 'scenario', 'commandant', 'pays', 'region', 'evenement', 'unite',
] as const;
/** Type d'objet visé par un `ReviewVerdict`. */
export type CibleReview = typeof CIBLES_REVIEW[number];

/** Catalogue fermé des motifs de rejet de la routine contrôle. */
export const MOTIFS_REJET = [
  'schema_invalide', 'reference_inconnue', 'champ_inconnu', 'flag_inconnu',
  'qg_inaccessible', 'zone_morte', 'usine_trop_loin', 'depart_bloque',
  // Motifs navals (7 septembre 2026) : un port sans mer voisine, des ports que la mer ne relie pas.
  'port_sans_mer', 'ports_isoles',
  'grille_non_reproductible', 'qg_menace_trop_tot', 'economie_insuffisante',
  'avantage_premier_joueur', 'desequilibre_fonds', 'desequilibre_villes',
  'partie_trop_courte', 'partie_trop_longue', 'trop_de_parties_non_terminees',
  'pouvoir_trop_fort', 'commandant_sans_faiblesse', 'mecanique_inutilisee',
  'injouable_sous_meteo', 'nuit_bloquante',
  'ton_hors_bible', 'sujet_interdit', 'personne_reelle', 'cliche_deplace',
  'contredit_canon', 'redite_commandant',
  'choix_sans_consequence', 'dialogue_trop_long',
  'categorie_hors_liste_blanche', 'source_hors_liste_blanche', 'evenement_perime',
  'unite_dominante', 'unite_inutile', 'silhouette_invalide',
  'simulation_plantee', 'moteur_non_deterministe', 'objet_incomprehensible',
] as const;
/** Motif de rejet d'un verdict de contrôle. */
export type MotifRejet = typeof MOTIFS_REJET[number];

/** Statistiques d'une campagne de simulation headless. */
export interface StatsSimulation {
  parties: number;
  strategie: string;
  graines: string[];
  victoiresCamp: number[];
  nonTerminees: number;
  journeesMediane: number;
  journeesEcartType: number;
  fondsMoyenParCamp: number[];
  casesJamaisVisitees: number;
  mecaniqueDeclenchee: number | null;
  climat: { saison: Saison; meteo: Meteo | 'tiree'; phase: PhaseJour | 'cycle' };
  dureeMoyenneMs: number;
}

/** Verdict de la routine contrôle : le seul objet qui valide un contenu. */
export interface ReviewVerdict {
  cle: Cle;
  cibleType: CibleReview;
  cibleCle: Cle;
  cibleVersion: number;
  verdict: 'valide' | 'rejete';
  motifs: { code: MotifRejet; detail?: string; mesure?: Record<string, number> }[];
  detail?: string;
  stats: StatsSimulation | { avec: StatsSimulation; sans: StatsSimulation } | null;
  coherenceLore: number;
  suggestions: string[];
  routineRunId: string;
  creeLe: DateIso;
}

// ---------------------------------------------------------------------------
// 13. EtatClimat — saison, jour et nuit, météo
// ---------------------------------------------------------------------------

/** Les quatre saisons, toujours. */
export const SAISONS = ['printemps', 'ete', 'automne', 'hiver'] as const;
/** Saison d'un match, fixe pendant toute sa durée. */
export type Saison = typeof SAISONS[number];

/** Les deux phases du jour. */
export const PHASES_JOUR = ['jour', 'nuit'] as const;
/** Phase du jour d'une journée de match. */
export type PhaseJour = typeof PHASES_JOUR[number];

/** Les six météos tirées du RNG seedé. */
export const METEOS = ['clair', 'pluie', 'neige', 'brouillard', 'tempete', 'canicule'] as const;
/** Météo d'une journée de match. */
export type Meteo = typeof METEOS[number];

/** Bloc climatique de l'état de partie : calculé, jamais soumis. */
export interface EtatClimat {
  saison: Saison;
  phase: PhaseJour;
  journeeDansCycle: number;
  meteo: Meteo;
  previsions: [Meteo, Meteo];
}

// ---------------------------------------------------------------------------
// 14. MissionDuJour et Sauvegarde — la Dépêche et le catalogue vivant
// ---------------------------------------------------------------------------

/** Dépêche du jour : au plus une mission par jour réel, hors campagne. */
export interface MissionDuJour {
  cle: Cle;
  date: DateIso;
  eventCode: Cle;
  scenarioCle: Cle;
  paysCode: CodePays;
  statut: Statut;
  expireLe: DateIso;
}

/** Sauvegarde : une partie est ses actions, plus les versions qu'elle a figées. */
export interface Sauvegarde {
  /** Version du scénario au départ ; absente dans les anciennes sauvegardes (révision 1). */
  scenarioVersion?: number;
  scenarioCle: Cle;
  graine: string;
  catalogueVersion: number;
  engineVersion: number;
  mapgenVersion: number;
  contentVersion: number;
  actions: unknown[];
}

// ---------------------------------------------------------------------------
// 15. Internationalisation (`09-i18n.md` §2, propriétaire)
// ---------------------------------------------------------------------------

/** Code de langue BCP 47 en minuscules : 'fr', 'pt-br', 'zh-hans'. */
export type CodeLocale = string;

/** Forme d'un `CodeLocale`. */
export const REGEX_CODE_LOCALE = /^[a-z]{2}(-[a-z0-9]{2,8})?$/;

/** Clé de chaîne traduisible, en segments pointés : 'hud.fin_de_tour'. */
export type CleChaine = string;

/** Forme d'une `CleChaine` : 2 à 6 segments, 120 caractères au plus. */
export const REGEX_CLE_CHAINE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){1,5}$/;

/** Les neuf langues du lancement, dans l'ordre d'affichage. */
export const LOCALES = ['fr', 'en', 'de', 'pt-br', 'es', 'it', 'ru', 'zh-hans', 'ja'] as const;

/** Locales dont le glossaire exige une translittération des noms propres. */
export const LOCALES_TRANSLITTEREES = ['ru', 'zh-hans', 'ja'] as const;

/** Statuts d'une langue. */
export const STATUTS_LOCALE = ['en_preparation', 'active'] as const;
/** Statut d'une langue. */
export type StatutLocale = typeof STATUTS_LOCALE[number];

/** Sens d'écriture possibles. */
export const SENS_ECRITURE = ['ltr', 'rtl'] as const;
/** Sens d'écriture d'une langue. */
export type SensEcriture = typeof SENS_ECRITURE[number];

/** Scripts pris en charge par les polices du rendu. */
export const SCRIPTS_LOCALE = ['latin', 'cyrillique', 'han_simplifie', 'kana_kanji'] as const;
/** Script d'une langue. */
export type ScriptLocale = typeof SCRIPTS_LOCALE[number];

/** Langue du jeu : ajouter une langue est une ligne de configuration. */
export interface Locale {
  code: CodeLocale;
  nom: string;
  script: ScriptLocale;
  sens: SensEcriture;
  statut: StatutLocale;
  seuilCouverture: number;
  facteurLongueur: number;
  echantillonHumain: number;
  ordre: number;
}

/** Origines possibles d'une chaîne source. */
export const ORIGINES_CHAINE = ['interface', 'canon', 'genere'] as const;
/** Origine d'une chaîne source. */
export type OrigineChaine = typeof ORIGINES_CHAINE[number];

/** Types d'objet pouvant produire une chaîne source. */
export const TYPES_OBJET_REF = [
  'Commander', 'Scenario', 'Event', 'MissionDuJour', 'UnitType', 'Region',
] as const;
/** Type d'objet d'où provient une chaîne source de canon ou générée. */
export type TypeObjetRef = typeof TYPES_OBJET_REF[number];

/** Chaîne source : le texte français, sa forme, son empreinte et son contexte. */
export interface ChaineSource {
  cle: CleChaine;
  texte: string;
  origine: OrigineChaine;
  contexte: { ecran?: string; locuteur?: Cle; note?: string };
  longueurMax: number | null;
  placeholders: string[];
  pluriel: boolean;
  sourceHash: string;
  versionChaine: number;
  objetRef?: { type: TypeObjetRef; cle: Cle; champ: string };
  creeLe: DateIso;
  majLe: DateIso;
}

/** Statuts d'une traduction. */
export const STATUTS_TRADUCTION = ['manquante', 'brouillon', 'validee', 'perimee'] as const;
/** Statut d'une traduction. */
export type StatutTraduction = typeof STATUTS_TRADUCTION[number];

/** Auteurs possibles d'une traduction. */
export const AUTEURS_TRADUCTION = ['atlas_traduction', 'humain'] as const;
/** Auteur d'une traduction. */
export type AuteurTraduction = typeof AUTEURS_TRADUCTION[number];

/** Traduction d'une chaîne source dans une langue, jamais en 'fr'. */
export interface Traduction {
  cleChaine: CleChaine;
  locale: CodeLocale;
  texte: string | null;
  statut: StatutTraduction;
  sourceHash: string;
  versionChaine: number;
  auteur: AuteurTraduction;
  relueParHumain: boolean;
  runRef: string | null;
  creeLe: DateIso;
  majLe: DateIso;
}

/** Catégories d'entrée de glossaire. */
export const CATEGORIES_GLOSSAIRE = ['nom_propre', 'terme_impose', 'unite', 'terrain'] as const;
/** Catégorie d'une entrée de glossaire. */
export type CategorieGlossaire = typeof CATEGORIES_GLOSSAIRE[number];

/** Entrée de glossaire : un terme français et ce qu'on en fait dans la langue cible. */
export interface EntreeGlossaire {
  terme: string;
  categorie: CategorieGlossaire;
  traduction: string | null;
  translitteration?: string;
  note?: string;
}

/** Glossaire d'une langue : propriété du canon, jamais écrit par une routine. */
export interface Glossaire {
  locale: CodeLocale;
  termesInterdits: string[];
  entrees: EntreeGlossaire[];
  majLe: DateIso;
}

// ---------------------------------------------------------------------------
// 16. Fichiers de contenu canon (`02-architecture.md` §3.5)
// ---------------------------------------------------------------------------

/** Catalogue d'unités embarqué : sa version et ses types d'unité. */
export interface CatalogueUnites {
  catalogueVersion: number;
  unites: UnitType[];
}

/** Catalogue de terrains embarqué : les quatorze terrains. */
export interface CatalogueTerrains {
  terrains: Terrain[];
}

/** Table de dégâts : lignes = attaquant, colonnes = cible, valeurs en points internes. */
export interface TableDegats {
  unites: CleUnite[];
  matrice: number[][];
}

/** Fiche d'archétype : les colonnes d'équilibrage de `01-bible.md` §6. */
export interface FicheArchetype {
  cle: Archetype;
  libelle: string;
  temperament: string;
  famillePouvoir: string;
  courbe: string;
  contrePar: Archetype[];
}

/** Catalogue des dix archétypes. */
export interface CatalogueArchetypes {
  archetypes: FicheArchetype[];
}

/** Les cinq hooks du contrat des mécaniques (`04-gameplay.md` §11.1). */
export const HOOKS_MECANIQUE = [
  'debutTour', 'finTour', 'surMouvement', 'surAttaque', 'modifTerrain',
] as const;
/** Point de branchement d'une mécanique régionale. */
export type HookMecanique = typeof HOOKS_MECANIQUE[number];

/** Fiche de mécanique régionale : sa clé et ses hooks, sans implémentation. */
export interface FicheMecanique {
  cle: Cle;
  nom: string;
  paysCode: CodePays;
  regionCle: Cle;
  hookPrincipal: HookMecanique;
  hookSecondaire: HookMecanique | null;
  description: string;
}

/** Catalogue des mécaniques régionales déclarées. */
export interface CatalogueMecaniques {
  mecaniques: FicheMecanique[];
}

// ---------------------------------------------------------------------------
// 17. Campagne : modes, gabarits, fils, conséquences, déblocages, profil
//     (`doc/13-campagne.md`, propriétaire ; `doc/03-schemas.md` §15 en donne
//     les exemples JSON)
// ---------------------------------------------------------------------------

/** Les deux modes de jeu. Le mode ne change **aucune règle**, seulement des paramètres. */
export const MODES = ['normal', 'difficile'] as const;
/** Mode de jeu d'une campagne : `normal` par défaut, changeable à tout moment. */
export type Mode = typeof MODES[number];

/**
 * Jeu de paramètres d'un scénario pour un mode donné (`13-campagne.md` §6).
 *
 * Aucune de ces valeurs n'ouvre une règle nouvelle : ce sont les mêmes leviers que
 * ceux déjà portés par `Scenario`, plus la vitesse de jauge, la profondeur de la
 * prévision du Bulletin et le droit de reprendre une journée.
 */
export interface ParametresMode {
  /** Fonds de départ du joueur, multiple de 100. */
  fondsDepart: number;
  /** Fonds de départ de chaque camp IA, multiple de 100. */
  fondsDepartIa: number;
  /** Revenu du joueur par bâtiment capturable et par journée. */
  revenusParBatiment: number;
  /** Revenu d'un camp IA par bâtiment capturable et par journée. */
  revenusIaParBatiment: number;
  /** Brouillard de guerre imposé par le scénario dans ce mode. */
  brouillard: boolean;
  /** Profondeur du Bulletin de Vantour, en journées : 2 en `normal`, 1 en `difficile`. */
  previsionJournees: number;
  /** Multiplicateur des points de jauge gagnés par le joueur : 0,5 à 1,5. */
  vitesseJauge: number;
  /** Limite de journées, ou `null` pour un match sans limite. */
  limiteJournees: number | null;
  /** Stratégie des camps IA dans ce mode. */
  strategieIa: StrategieIa;
  /** Nombre de reprises d'une journée autorisées : 0 en `difficile`. */
  reprises: number;
  /** Durée d'une partie mesurée par simulation dans ce mode, en minutes. */
  dureeVisee: number;
}

/** Les deux jeux de paramètres d'un scénario. La routine contrôle certifie **les deux**. */
export interface ModesScenario {
  normal: ParametresMode;
  difficile: ParametresMode;
}

/** Les neuf gabarits de mission (`13-campagne.md` §4). Liste fermée. */
export const CLES_GABARIT = [
  'capture_qg', 'tenir', 'escorte', 'relais', 'course',
  'survie', 'siege', 'revanche', 'exhibition',
] as const;
/** Clé d'un gabarit de mission. */
export type CleGabarit = typeof CLES_GABARIT[number];

/**
 * Gabarit de mission : la forme qu'une mission générée doit prendre.
 *
 * C'est le contrat entre la routine lore, la routine map et la routine contrôle :
 * la routine lore choisit un gabarit et l'habille, la routine map produit une carte
 * qui rentre dans ses bornes, la routine contrôle vérifie que la partie simulée
 * tombe dans la fenêtre `dureeVisee` **dans les deux modes**.
 */
export interface GabaritMission {
  cle: CleGabarit;
  nom: string;
  /** Ce que le gabarit fait vivre au joueur, en une phrase. */
  intention: string;
  /** Types d'objectif de victoire autorisés par ce gabarit. */
  victoire: TypeObjectifVictoire[];
  /** Types d'objectif de défaite autorisés par ce gabarit. */
  defaite: TypeObjectifDefaite[];
  /** Fenêtre de durée visée en mode `normal`, en minutes. */
  dureeVisee: { min: number; max: number };
  /** Fenêtre de `limiteJournees` admissible. */
  journees: { min: number; max: number };
  /** Fenêtre du plus grand côté de la carte, en cases. */
  cote: { min: number; max: number };
  /** Brouillard conseillé par défaut pour ce gabarit. */
  brouillardConseille: boolean;
  /** Accroches narratives que ce gabarit sait porter : 2 à 6. */
  hooksNarratifs: string[];
  /** Ce que le gabarit interdit, en une phrase. */
  interdit: string;
}

/** Catalogue des gabarits de mission (`content/gabarits-missions.json`). */
export interface CatalogueGabarits {
  gabarits: GabaritMission[];
}

/**
 * État de relation d'une nation avec le joueur (`BRIEF.md`, « Le joueur et le
 * départ », révisé le 5 septembre 2026 au soir).
 *
 * Tout le monde part de France ; les vingt-quatre nations ne sont donc pas un menu
 * de départ mais des **relations** qui évoluent au fil des choix, et qui se voient
 * sur la carte du monde. Une nation `alliee` prête son commandant en co-commandant,
 * rend son unité spéciale produisible (quantité bornée par match), donne sa carte de
 * terrain et son soutien à l'acte III, et **se débloque comme départ de Nouvelle
 * Ronde**. Une `rivale` revient avec un grief et peut fermer une destination. Une
 * `retiree` a quitté la Ronde à cause du joueur : destination fermée, territoire
 * grisé, absence ou passage à la Cinquième Manche à l'acte III.
 */
export const RELATIONS_NATION = ['neutre', 'alliee', 'rivale', 'retiree'] as const;
/** L'un des quatre états de relation d'une nation. */
export type RelationNation = typeof RELATIONS_NATION[number];

/**
 * Bornes anti-blocage des relations (`BRIEF.md`). `retireesMax` est un invariant de
 * schéma, vérifié par `validerProfilCampagne` ; `allieesGaranties` est une garantie
 * de **contenu** portée par la colonne vertébrale (`13-campagne.md` §3.4) — un profil
 * au tout début d'une partie n'a légitimement aucune alliée, le schéma ne peut donc
 * pas l'exiger.
 */
export const BORNES_RELATIONS = {
  /** Au plus cinq nations retirées par partie : jamais de fin rendue inaccessible. */
  retireesMax: 5,
  /** Au moins deux alliées avant l'acte III, garanties par la colonne vertébrale. */
  allieesGaranties: 2,
} as const;

/**
 * Ce qu'une conséquence de fil a le droit de poser comme relation. Un fil rallie ou
 * fâche ; il ne **retire** jamais une nation (un retrait vient des choix de la
 * campagne principale) et ne remet jamais une relation à `neutre` — une conséquence
 * qui ne change rien n'est pas une conséquence.
 */
export const RELATIONS_CONSEQUENCE = ['alliee', 'rivale'] as const;
/** Relation qu'une conséquence de fil peut poser. */
export type RelationConsequence = typeof RELATIONS_CONSEQUENCE[number];

/** Union fermée des conséquences qu'un fil peut avoir sur la campagne (`BRIEF.md`). */
export const TYPES_CONSEQUENCE = [
  'variante_dialogue', 'co_commandant', 'unite_offerte', 'trace_carte',
  'remise_production', 'objectif_alternatif', 'allie_acte_iii', 'entree_carnet',
  'deblocage', 'relation_nation',
] as const;
/** Type d'une conséquence de fil. */
export type TypeConsequence = typeof TYPES_CONSEQUENCE[number];

/** Bornes numériques des conséquences paramétrées : petites mais réelles. */
export const BORNES_CONSEQUENCE = {
  /** Unités offertes par une conséquence : une ou deux, jamais davantage. */
  uniteOfferte: { min: 1, max: 2 },
  /** Remise à la production : multiplicateur du coût, 0,80 à 0,95. */
  remiseProduction: { min: 0.8, max: 0.95 },
} as const;

/**
 * Conséquence d'un fil sur la campagne principale. Union **fermée** : la routine
 * lore ne peut rien produire d'autre, et le contrôle rejette tout le reste.
 */
export type Consequence =
  | { type: 'variante_dialogue'; scenarioCle: Cle; varianteCle: Cle }
  | { type: 'co_commandant'; commandantCle: Cle }
  | { type: 'unite_offerte'; uniteCle: CleUnite; combien: number }
  | { type: 'trace_carte'; paysCode: CodePays; flagTrace: Cle }
  | { type: 'remise_production'; uniteCle: CleUnite; remise: number }
  | { type: 'objectif_alternatif'; scenarioCle: Cle; objectif: ObjectifVictoire }
  | { type: 'allie_acte_iii'; paysCode: CodePays }
  | { type: 'entree_carnet'; carnetCle: Cle }
  | { type: 'deblocage'; deblocageCle: Cle }
  | { type: 'relation_nation'; paysCode: CodePays; relation: RelationConsequence };

/**
 * La **confiance** d'un général envers le joueur, de 0 à 3 (`BRIEF.md`, « Le joueur
 * et le départ »). Elle monte en incarnant sa nation, et elle est bornée : à 3, le
 * général devient co-commandant **à jauge entière** et sa nation se débloque comme
 * départ de Nouvelle Ronde (`13-campagne.md` §3.5).
 */
export const CONFIANCE_MAX = 3;
/** Un des quatre niveaux de confiance d'un général. */
export type NiveauConfiance = 0 | 1 | 2 | 3;

/** Types de condition composables d'un `Deblocage` (`BRIEF.md`). Liste fermée. */
export const TYPES_CONDITION = [
  'flag', 'compteur', 'mode_fini', 'date', 'pays_visite', 'secret', 'relation',
  'confiance', 'et', 'ou',
] as const;
/** Type d'une condition de déblocage. */
export type TypeCondition = typeof TYPES_CONDITION[number];

/** Profondeur maximale d'imbrication d'une condition composée. */
export const PROFONDEUR_CONDITION_MAX = 3;

/**
 * Condition composable, évaluée **par le moteur ou le serveur, jamais par le rendu**
 * (`src/engine/deblocages.ts`). Aucune expression, aucun code : des données.
 */
export type Condition =
  | { type: 'flag'; cle: Cle }
  | { type: 'compteur'; cle: Cle; min: number }
  | { type: 'mode_fini'; mode: Mode }
  | { type: 'date'; du?: DateIso; au?: DateIso }
  | { type: 'pays_visite'; pays: CodePays[]; combien: number }
  | { type: 'secret'; cle: Cle }
  | { type: 'relation'; pays: CodePays[]; relation: RelationNation; combien: number }
  | { type: 'confiance'; commandantCle: Cle; min: NiveauConfiance }
  | { type: 'et'; conditions: Condition[] }
  | { type: 'ou'; conditions: Condition[] };

/**
 * Ce qu'un déblocage ouvre. Liste fermée.
 *
 * `depart_nation` est la porte de la **Nouvelle Ronde** : une nation devenue alliée
 * pendant une partie s'ouvre comme pays de départ pour la suivante. Sa `ref` est un
 * `CodePays`, jamais une `Cle`. Elle s'ouvre indifféremment sur une `relation`
 * `alliee` ou sur une `confiance` de `CONFIANCE_MAX` envers son général : rallier et
 * incarner sont deux chemins vers la même porte (`13-campagne.md` §3.5).
 */
export const TYPES_RECOMPENSE_DEBLOCAGE = [
  'general_secret', 'carte', 'carte_terrain', 'skin_style', 'fil', 'mode',
  'entree_carnet', 'depart_nation',
] as const;
/** Type de récompense d'un déblocage. */
export type TypeRecompenseDeblocage = typeof TYPES_RECOMPENSE_DEBLOCAGE[number];

/** Déblocage : un système unique pour tout ce qui s'ouvre (`13-campagne.md` §8). */
export interface Deblocage {
  cle: Cle;
  libelle: string;
  condition: Condition;
  recompense: { type: TypeRecompenseDeblocage; ref: Cle };
  /** Vrai si l'existence même du déblocage est cachée avant son acquisition. */
  cache: boolean;
}

/** Une étape d'un fil : un scénario, son gabarit, sa durée mesurée. */
export interface EtapeFil {
  ordre: number;
  scenarioCle: Cle;
  gabarit: CleGabarit;
  dureeVisee: number;
  titre: string;
}

/**
 * Fil secondaire : une suite ordonnée de 3 à 8 missions avec un arc propre, une
 * condition d'ouverture et des conséquences bornées sur la campagne principale.
 *
 * Contrairement à la Dépêche du jour, **un fil écrit des flags de campagne**
 * (`01-bible.md` §4.7, `08-narration-choix.md` §4.4).
 */
export interface Fil extends Enveloppe {
  code: Cle;
  titre: string;
  /** L'arc en quelques phrases : d'où l'on part, où l'on arrive. */
  arc: string;
  /** Accroche d'une phrase, affichée au carnet. */
  accroche: string;
  /** Pays d'ancrage, quand le fil en a un. */
  paysCode?: CodePays;
  /** Acte à partir duquel le fil peut s'ouvrir : 0 (qualification) à 3. */
  acteMin: number;
  missions: EtapeFil[];
  deblocage: Condition;
  consequences: Consequence[];
  /** Flags de campagne que le fil écrit, tous connus de `01-bible.md` §8. */
  flagsEcrits: Cle[];
}

/** Un fil en cours dans un profil : où en est le joueur. */
export interface FilEnCours {
  filCle: Cle;
  /** Numéro d'étape atteinte, 1 à 8. */
  etape: number;
}

/**
 * Sauvegarde de campagne (`13-campagne.md` §9). Un profil = un parcours.
 *
 * `catalogueVersion` et `chainesVersion` sont figées à la création et suivent la
 * campagne : un profil ouvert avant une homologation continue de se jouer et de se
 * rejouer avec le catalogue qu'il connaissait.
 */
export interface ProfilCampagne {
  cle: Cle;
  paysDepart: CodePays;
  mode: Mode;
  flags: EtatFlags;
  /** Déblocages déjà acquis, par clé de `Deblocage`. */
  deblocages: Cle[];
  filsEnCours: FilEnCours[];
  filsFinis: Cle[];
  scenariosFinis: Cle[];
  /** Easter eggs trouvés, par nom court : le flag est `monde.secret.<nom>`. */
  secretsTrouves: Cle[];
  paysVisites: CodePays[];
  /** Modes dans lesquels ce profil a déjà mené une campagne à son terme. */
  modesFinis: Mode[];
  /**
   * L'état de relation de chaque nation avec le joueur, par code pays. Une nation
   * absente est `neutre` : ne l'avoir jamais croisée et n'avoir rien décidé la
   * concernant sont la même chose. Le champ est **calculé** par le moteur ou le
   * serveur depuis les flags (respect, grief, choix), jamais par le rendu, et il ne
   * contient jamais `paysDepart` — la nation du joueur n'est pas une relation.
   * Invariant de schéma : au plus `BORNES_RELATIONS.retireesMax` nations `retiree`.
   */
  relations: Record<CodePays, RelationNation>;
  /**
   * La confiance de chaque général envers le joueur, par clé de commandant, de 0 à
   * `CONFIANCE_MAX`. Elle monte en **incarnant** sa nation (`Scenario.incarnation`).
   * Un général absent est à 0 : ne l'avoir jamais incarné et ne pas avoir sa
   * confiance sont la même chose, comme un compteur absent vaut zéro. À
   * `CONFIANCE_MAX`, il devient co-commandant à **jauge entière** et sa nation
   * s'ouvre comme départ de Nouvelle Ronde.
   */
  confiance: Record<Cle, NiveauConfiance>;
  /** Compteur de Dépêches enchaînées : vit au profil, hors flags de campagne. */
  serieDepeches: number;
  catalogueVersion: number;
  chainesVersion: number;
  creeLe: DateIso;
  majLe: DateIso;
}
