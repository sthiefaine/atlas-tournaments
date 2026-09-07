# Atlas Tournament — Schémas JSON

> Document 03. Découle du canon `BRIEF.md` et de `02-architecture.md`. Les propositions hors brief sont marquées **[proposition]**.
>
> Ces schémas sont la frontière entre le cerveau (routines) et le jeu. **Tout ce qu'une routine produit est du JSON qui respecte un de ces schémas**, jamais du texte libre. Le serveur valide avant d'écrire ; ce qui ne valide pas est refusé avec un motif codé, pas corrigé en silence.

---

## 0. Conventions communes

**Langue.** Les clés et les valeurs d'énumération sont en français, **sans accent ni espace** (`char_leger`, `en_ligne`, `valide`). Les accents ne vivent que dans les champs de texte destinés à l'affichage. **[proposition]**

**Types de base partagés**, définis une fois dans `src/schemas/types.ts` :

```ts
/** Code de camp : ISO 3166-1 alpha-2 en minuscules pour une nation ('fr', 'lu', 'jp'), trois lettres pour une équipe sans drapeau ('atl'). Regex : ^[a-z]{2,3}$ */
export type CodePays = string;

/** Identifiant stable, minuscules, chiffres et tirets bas. Regex : ^[a-z][a-z0-9_]{1,47}$ */
export type Cle = string;

/** Date ISO 8601, jour seul : '2026-09-04'. */
export type DateIso = string;

/** Couleur hexadécimale : '#3f86e0'. Regex : ^#[0-9a-f]{6}$ */
export type Couleur = string;

/** Statut du cycle de vie (02-architecture §6, étendu par 05-routines §1.4). */
export type Statut =
  | 'brouillon' | 'en_controle' | 'valide' | 'rejete'
  | 'en_ligne' | 'quarantaine' | 'retire';

/** Palette d'une nation ou d'un biome, conventions de la démo de rendu. */
export interface Palette { main: Couleur; dark: Couleur; light: Couleur; }

/** Coordonnée de grille, origine en haut à gauche. */
export interface Case { x: number; y: number; }

/** Camp dans une partie : 0 = premier à jouer. */
export type CampId = 0 | 1 | 2 | 3;

/** Enveloppe commune à tout objet stocké en base. */
export interface Enveloppe {
  cle: Cle;
  version: number;          // entier ≥ 1, incrémenté à chaque écriture
  statut: Statut;
  /** Clés de routine : celles de 05-routines, qui fait foi. */
  source: 'humain' | 'atlas_lore' | 'atlas_map' | 'atlas_cerveau';
  creeLe: DateIso;
  majLe: DateIso;
}
```

**Trois règles de validation transversales**, appliquées à tous les schémas :

1. **Clés inconnues refusées.** Un champ non prévu par le schéma fait échouer la validation (`motif: 'champ_inconnu'`). Cela empêche une routine d'inventer une structure que le jeu ignorera silencieusement.
2. **Bornes numériques toujours explicites.** Aucun nombre n'est libre : chaque champ a un minimum, un maximum et un pas (entier ou décimal).
3. **Références vérifiées.** Tout identifiant qui pointe vers un autre objet (`paysCode`, `commandantCle`, `carteCle`, un flag) est résolu contre le canon ou la base au moment de la validation ; une référence pendante est un refus (`motif: 'reference_inconnue'`).

**Les types d'internationalisation ne sont pas ici.** `Locale`, `ChaineSource`, `Traduction`, `Glossaire`, ainsi que `CodeLocale` et `CleChaine`, sont définis par **`09-i18n.md` §2, qui en est propriétaire**. Deux raisons : ce ne sont pas des objets de jeu — aucun n'étend `Enveloppe`, aucun ne suit le cycle `brouillon → valide → en_ligne`, aucun ne reçoit de `ReviewVerdict` —, et leurs clés ne sont pas des `Cle` (une `CleChaine` porte des points, un `CodeLocale` un tiret). Les champs de texte des schémas ci-dessous **deviennent** des chaînes source à la validation (`09-i18n.md` §3.3) ; ce document ne décrit que leur forme en français, qui reste la source.

---

## 1. `Country` — fiche pays

La fiche est la **graine narrative** d'un pays : elle contient assez pour que la routine lore écrive un début de partie sans inventer de géographie.

```ts
export type Continent =
  | 'europe' | 'amerique_nord' | 'amerique_sud' | 'afrique'
  | 'asie' | 'oceanie' | 'outre_mer';

export type Climat =
  | 'tempere' | 'mediterraneen' | 'oceanique' | 'continental'
  | 'tropical' | 'aride' | 'polaire' | 'montagnard';

/** Hémisphère du pays. Détermine la saison à une date donnée (§13). */
export type Hemisphere = 'nord' | 'sud' | 'equateur';

export type Biome =
  | 'plaine' | 'foret' | 'montagne' | 'desert' | 'jungle'
  | 'neige' | 'volcanique' | 'cotier' | 'archipel' | 'marais';

/** Famille d'une spécialité : ce qu'elle renforce. Sert au tri et à l'équilibrage. */
export type FamilleSpecialite =
  | 'infanterie' | 'blindes' | 'artillerie' | 'aerien'
  | 'mobilite' | 'defense' | 'economie' | 'ingenierie' | 'polyvalence';

/**
 * Trait de spécialité : une capacité booléenne qui ne s'écrit pas en chiffres.
 * **Liste fermée**, propriété de ce document (`BRIEF.md`, seconde relecture, point 1).
 * Sur le modèle exact de `Trait` d'unité (§3) : chaque trait est implémenté **une
 * seule fois** dans le moteur, une spécialité ne fait que le déclarer. La liste peut
 * grandir **par arbitrage**, jamais par une routine : une valeur inconnue est refusée
 * (`motif: 'schema_invalide'`).
 *
 * - `franchissement_riviere` : les unités à pied et à bottes traversent une `riviere`
 *   au coût de 2, sans pont (le génie du Grand Est, le gué de Mayotte).
 * - `experience_rapide` : une unité gagne son rang au bout d'une mise hors jeu de
 *   moins que la normale.
 * - `ravitaillement_ville` : une `ville` amie ravitaille et répare même sans usine.
 * - `vision_nuit` : les unités ignorent le malus de vision de la phase `nuit` (§13).
 * - `pied_marin` : les unités ignorent le malus de mouvement des terrains `cotier`
 *   et `plage`, et le débarquement ne coûte pas la fin du tour.
 */
export type TraitSpecialite =
  | 'franchissement_riviere' | 'experience_rapide' | 'ravitaillement_ville'
  | 'vision_nuit' | 'pied_marin';

/**
 * Spécialité **d'un pays ou d'une région** : un bonus permanent, écrit de façon
 * déclarative. Deux variants et deux seulement (`BRIEF.md`, seconde relecture,
 * point 1) : soit un **modificateur** avec le même vocabulaire que les pouvoirs
 * (`EffetModificateur`, §2), soit un **trait** pris dans `TraitSpecialite` ci-dessus.
 * Les 18 spécialités régionales de `07-france-regions.md` (Pied marin, Couvert,
 * Vigie…) et les 24 spécialités de pays de `06-pays-de-depart.md` sont exactement
 * ce type. Le cumul est borné (validations ci-dessous).
 */
export type ContenuSpecialite =
  | { variant: 'modificateur'; effets: EffetModificateur[] }  // 1 à 2, permanents
  | { variant: 'trait'; trait: TraitSpecialite };

export interface Specialite {
  cle: Cle;                       // 'spec_fr_bretagne_pied_marin'
  nom: string;                    // 'Pied marin' — ≤ 32 caractères
  portee: 'pays' | 'region';
  famille: FamilleSpecialite;
  contenu: ContenuSpecialite;     // modificateur (1 à 2 effets) ou trait ; jamais `EffetPoserTerrain`
  description: string;            // ≤ 200 caractères, lisible par le joueur
}

/**
 * Clé d'archétype de commandant. La liste est **gelée** (`BRIEF.md`, arbitrage n° 1) :
 * dix archétypes, ceux de `06-pays-de-depart.md` §2 (déjà affectés aux 24 pays),
 * enrichis des colonnes de `01-bible.md` §6 (tempérament, famille de pouvoir, courbe
 * de puissance, contré par) — le stratège prudent, la fonceuse, le vétéran,
 * l'ingénieur, la diplomate, le showman, la survivante, **la météorologue** (qui
 * remplace « le professeur »), le prodige, la gardienne. `01-bible.md` §6 est
 * propriétaire des libellés **et des clés**, publiées dans sa table ; c'est une
 * union fermée, reprise ici mot pour mot.
 */
export type Archetype =
  | 'stratege_prudent' | 'fonceuse' | 'veteran' | 'ingenieur' | 'diplomate'
  | 'showman' | 'survivante' | 'meteorologue' | 'prodige' | 'gardienne';

export interface Country extends Enveloppe {
  code: CodePays;
  nom: string;                    // 'France'
  nomCourt: string;               // 'France' — pour le HUD, ≤ 14 caractères
  gentile: string;                // 'français'
  continent: Continent;
  climat: Climat;
  hemisphere: Hemisphere;         // décide de la saison à une date donnée (§13)
  biomes: Biome[];                // 1 à 4, du plus au moins représentatif
  specialite: Specialite;         // permanente, effet déclaratif (ci-dessus)
  archetypeCommandant: Archetype;
  rivalNaturel: CodePays;         // le rival scénarisé, pas forcément un voisin
  voisins: CodePays[];            // 0 à 12, frontières ou proximité maritime
  palette: Palette;
  drapeau: {                      // dessiné par code, pas une image
    type: 'bandes_verticales' | 'bandes_horizontales' | 'croix' | 'canton' | 'embleme';
    couleurs: Couleur[];          // 1 à 4
  };
  flagsDisponibles: Cle[];        // flags que ce pays peut écrire (voir §8)
  regions?: Cle[];                // pays phare uniquement : clés de Region
  phare: boolean;                 // prologue scénarisé écrit à la main
  accroche: string;               // 1 phrase de ton, ≤ 160 caractères
  interdits: string[];            // rappels de bible spécifiques à ce pays
}
```

**Validations serveur.** `code` unique et présent dans la liste ISO fermée embarquée dans le canon. `nomCourt` ≤ 14 caractères (contrainte de HUD). `biomes` : 1 à 4, sans doublon, valeurs de l'énumération. `voisins` : ≤ 12, sans doublon, chaque code existe, ne contient pas `code` lui-même. `rivalNaturel ≠ code` et existe. `palette` : les trois couleurs distinctes, et un contraste minimum de 3:1 entre `main` et `light` pour rester lisible sur le canvas **[proposition]**. `flagsDisponibles` : chaque clé existe dans `flags.json` et respecte la convention `pays.<code>.*` ou `monde.<domaine>.*` (§8) ; un pays ne peut déclarer que ses propres flags de pays. `regions` : présent **si et seulement si** `phare === true`. `accroche` et `interdits` passent le filtre de bible (aucun terme de la liste noire : conflit, politique, religion, catastrophe, dirigeant réel).

`hemisphere` est obligatoire et cohérent avec `continent` (`equateur` réservé aux pays traversés par la zone intertropicale) : c'est lui, et non le continent, qui décide de la saison d'un match — jouer le Brésil en janvier, c'est jouer en été (§13). `specialite` : un `contenu` d'un seul variant. Variant `modificateur` : 1 à 2 effets, tous du variant `EffetModificateur` (**une spécialité ne pose jamais de terrain**), tous permanents, chacun dans les bornes du §2. Variant `trait` : exactement une valeur de `TraitSpecialite`, et le trait doit être cohérent avec la `famille` (`franchissement_riviere` et `pied_marin` relèvent de `mobilite` ou `ingenierie`, `experience_rapide` de `infanterie` ou `polyvalence`, `ravitaillement_ville` de `economie` ou `defense`, `vision_nuit` de `defense` ou `polyvalence`) ; une valeur hors liste est un refus (`motif: 'schema_invalide'`), une routine ne peut jamais en inventer une. **Plafond de cumul : une seule spécialité active à la fois** (`BRIEF.md`, seconde relecture, point 2) — le joueur en possède jusqu'à **cinq** et en **équipe une par match**, exactement comme les co-commandants (trois recrutés, un actif ; `04-gameplay.md` §7.5). Il n'y a donc pas de produit de multiplicateurs entre spécialités à saturer : les bornes du §2 s'appliquent effet par effet, et la routine contrôle vérifie l'équilibre spécialité par spécialité. Enfin, **il n'existe pas de `rival_secondaire`** : la rivalité est unique et réciproque (`BRIEF.md`, points mineurs du 5 septembre 2026) ; un champ de ce nom est refusé comme `champ_inconnu`.

```json
{
  "cle": "pays_fr",
  "version": 3,
  "statut": "en_ligne",
  "source": "humain",
  "creeLe": "2026-09-04",
  "majLe": "2026-09-04",
  "code": "fr",
  "nom": "France",
  "nomCourt": "France",
  "gentile": "français",
  "continent": "europe",
  "climat": "tempere",
  "hemisphere": "nord",
  "biomes": ["plaine", "foret", "montagne", "cotier"],
  "specialite": {
    "cle": "spec_fr_polyvalence",
    "nom": "École de tous les terrains",
    "portee": "pays",
    "famille": "polyvalence",
    "contenu": {
      "variant": "modificateur",
      "effets": [
        { "cible": "mes_unites", "modificateur": { "quoi": "defense", "valeur": 1.05 } }
      ]
    },
    "description": "Aucun terrain ne la surprend : un peu plus solide partout, jamais la meilleure nulle part."
  },
  "archetypeCommandant": "prodige",
  "rivalNaturel": "lu",
  "voisins": ["be", "lu", "de", "ch", "it", "es", "gb"],
  "palette": { "main": "#3f6fe0", "dark": "#1f3f8e", "light": "#9dbcf7" },
  "drapeau": { "type": "bandes_verticales", "couleurs": ["#2b4a9b", "#ffffff", "#d0353c"] },
  "flagsDisponibles": [
    "pays.fr.tour_complet",
    "pays.fr.regions_visitees",
    "pays.fr.bretagne_maree_lue",
    "pays.fr.rival_respecte",
    "pays.fr.rival_humilie",
    "monde.atlas.sponsor_meridien"
  ],
  "regions": [
    "region_fr_bretagne", "region_fr_normandie", "region_fr_pays_de_la_loire",
    "region_fr_centre_val_de_loire", "region_fr_hauts_de_france",
    "…", "region_fr_ile_de_france"
  ],
  "phare": true,
  "accroche": "Dix-huit régions à convaincre avant d'avoir le droit de porter le maillot.",
  "interdits": ["ne jamais évoquer de conflit réel impliquant la France"]
}
```

---

## 2. `Commander` — commandant

```ts
export interface EffetModificateur {
  cible: 'mes_unites' | 'unites_adverses' | 'terrain' | 'economie' | 'toutes_unites';
  filtre?: {
    types?: CleUnite[];               // restreint à certains types d'unité
    mouvement?: TypeMouvement[];      // ou à certains modes de déplacement
    surTerrain?: CleTerrain[];        // ou à certains terrains
    rayon?: { centre: 'commandant' | 'toutes'; cases: number };
  };
  modificateur:
    | { quoi: 'attaque'; valeur: number }        // ×, 0.5 à 2.0
    | { quoi: 'defense'; valeur: number }        // ×, 0.5 à 2.0
    | { quoi: 'mouvement'; valeur: number }      // +, -3 à +4 (entier)
    | { quoi: 'portee'; valeur: number }         // +, -2 à +3 (entier)
    | { quoi: 'vision'; valeur: number }         // +, -2 à +5 (entier)
    | { quoi: 'soin'; valeur: number }           // + PV affichés, 0 à 5 (entier)
    | { quoi: 'degats_directs'; valeur: number } // - PV affichés, 0 à 3 (entier)
    | { quoi: 'fonds'; valeur: number }          // ×, 0.5 à 2.0
    | { quoi: 'carburant'; valeur: number }      // ×, 0.5 à 2.0
    | { quoi: 'capture'; valeur: number };       // ×, 0.5 à 3.0 — sous 1.0, `cible: 'unites_adverses'` obligatoire
}

/**
 * **Seule famille d'effet nouvelle** (`BRIEF.md`, arbitrage n° 4) : poser du terrain.
 * **Sept formes, et sept seulement** (`BRIEF.md`, seconde relecture, point 3) : pont,
 * téléphérique, câble, chenal, polder, ponton, banc de sable. Tout ce qui tient du
 * climat — source chaude, glace, dégel — n'est **pas** un pouvoir : c'est une saison
 * (`04-gameplay.md` §12) ou une mécanique régionale (§11). La roche neuve d'un
 * volcan est une mécanique régionale, pas une forme de plus. Rejouer un tour,
 * échanger des positions et produire gratuitement restent **interdits** — les
 * interdits de `04-gameplay.md` §7.2 sont inchangés.
 */
export interface EffetPoserTerrain {
  cible: 'terrain';
  poserTerrain: {
    forme: 'pont' | 'telepherique' | 'cable' | 'chenal' | 'polder' | 'ponton' | 'banc_de_sable';
    depuis: CleTerrain[];             // terrains cibles autorisés, 1 à 3
    vers: CleTerrain;                 // terrain posé
    casesMax: number;                 // 1 à 4 cases par déclenchement
    contigu: boolean;                 // true = les cases posées se touchent
    duree: 'permanent' | { type: 'journees'; n: 1 | 2 | 3 };
  };
}

export type EffetPouvoir = EffetModificateur | EffetPoserTerrain;

export interface Pouvoir {
  nom: string;                    // 'Levée en masse'
  description: string;            // ≤ 200 caractères, ton sportif
  barres: number;                 // coût en barres de jauge, 2 à 9
  effets: EffetPouvoir[];         // 1 à 3
  /** `journees` : 1 à 3 journées pleines (`BRIEF.md`, arbitrage n° 4). */
  duree: 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 };
  replique: string;               // dite au déclenchement, ≤ 120 caractères
}

export interface Commander extends Enveloppe {
  code: Cle;                      // 'cmd_camille_aubertin' — prénom + nom, jamais un numéro
  nom: string;
  paysCode: CodePays;
  archetype: Archetype;
  traits: [string, string, string];   // exactement 3, ≤ 24 caractères chacun
  passif?: EffetModificateur;         // toujours actif, effet faible
  pouvoir: Pouvoir;                   // barres 2 à 4
  superPouvoir: Pouvoir;              // barres 5 à 9, > pouvoir.barres
  faiblesse: {
    axe: 'aerien' | 'artillerie' | 'blindes' | 'infanterie'
       | 'economie' | 'mobilite' | 'terrain_difficile' | 'partie_longue';
    effet: EffetModificateur;         // permanent, défavorable
    description: string;
  };
  repliques: {
    ouverture: string[];              // 1 à 3
    victoire: string[];               // 1 à 3
    defaite: string[];                // 1 à 3
    unitePerdue: string[];            // 1 à 3
  };
  portrait: {                         // dessiné par code
    teint: Couleur; cheveux: Couleur; accessoire: 'beret' | 'casque' | 'lunettes' | 'foulard' | 'aucun';
  };
}
```

**Validations serveur.** `code` a la forme `cmd_<prenom>_<nom>` ; **c'est lui qui fournit l'identifiant des flags de commandant** : `cmd_mireille_bousquet` donne `cmd.mireille_bousquet.respect` (convention de `01-bible.md` §8.1). `paysCode` existe et `archetype === Country.archetypeCommandant` (le commandant ne contredit pas sa fiche). `traits` : exactement 3, distincts. `superPouvoir.barres > pouvoir.barres` et `superPouvoir.barres ≤ 9`. Chaque `modificateur.valeur` est dans la borne de son `quoi` ; une valeur multiplicative hors [0,5 ; 2,0] est refusée (`motif: 'effet_hors_bornes'`), **`capture` excepté, dont la borne est [0,5 ; 3,0]** (`BRIEF.md`, seconde relecture, point 4). Une valeur de `capture` **inférieure à 1,0 n'est acceptée que si `cible === 'unites_adverses'`** — ralentir la capture chez soi est un outil de défense, se ralentir soi-même n'a pas de sens et un malus de capture ne s'applique jamais à `toutes_unites` ; toute autre cible sous 1,0 est un refus (`motif: 'effet_hors_bornes'`). C'est ce qui rend sa famille de pouvoir à **la gardienne** (`01-bible.md` §6) : elle peut enfin ralentir ce qui approche de ses villes. Un pouvoir a 1 à 3 effets — au-delà, c'est illisible en jeu. **Invariant d'équilibrage** **[proposition]** : le « poids » d'un pouvoir, somme des écarts à la neutralité pondérés par une table, doit être ≤ 3 pour le pouvoir normal et ≤ 7 pour le super ; la routine contrôle vérifie ce poids et rejette au-delà. `faiblesse` est obligatoire et son effet doit être **défavorable** (multiplicateur < 1 ou additif < 0) : un commandant sans faiblesse réelle est refusé. Toutes les répliques passent le filtre de bible et le filtre de ton (vocabulaire sportif : « adversaire », « mise hors jeu », jamais « ennemi », « tuer », « détruire »).

**Validations propres aux deux ajouts de l'arbitrage n° 4.** `duree` de la forme `{ type: 'journees', n }` : `n` entier de 1 à 3, et **réservé au super pouvoir** au-delà de `n = 2` **[proposition]** — un pouvoir à 2 barres qui dure trois journées est un super pouvoir déguisé. `EffetPoserTerrain` : `casesMax` entier de 1 à 4 (**3 au plus pour un pouvoir normal**), `depuis` de 1 à 3 terrains, chaque terrain de `depuis` **non capturable** (jamais `ville`, `usine`, `aeroport`, `qg`), `vers` différent de chaque entrée de `depuis`, et `duree: 'permanent'` **réservée au super pouvoir**. Les **sept** formes ont chacune leur couple `depuis → vers` autorisé, fixé par `04-gameplay.md` §7.2, qui fait foi ; un couple hors table est un refus (`motif: 'effet_hors_bornes'`), et **la table ne s'ouvre pas** : une forme nouvelle demande un arbitrage, une routine n'en invente jamais. Ni `source_chaude` ni `glace` n'en font partie (`BRIEF.md`, seconde relecture, point 3). Un `EffetPoserTerrain` est refusé partout où le schéma attend un `EffetModificateur` : `Commander.passif`, `Commander.faiblesse.effet`, le variant `modificateur` de `Specialite.contenu`, `ChoixScenario.options[].effetImmediat` et `Event.effet.modificateur` n'acceptent **que** le variant modificateur.

L'exemple ci-dessous est le commandant **canon** de la France, tel que le fixe `06-pays-de-depart.md` §5.1 : les noms propres, l'archétype et les noms de pouvoirs viennent de là et ne s'inventent pas ici.

```json
{
  "cle": "cmd_camille_aubertin",
  "version": 2,
  "statut": "valide",
  "source": "humain",
  "creeLe": "2026-09-04",
  "majLe": "2026-09-04",
  "code": "cmd_camille_aubertin",
  "nom": "Camille Aubertin",
  "paysCode": "fr",
  "archetype": "prodige",
  "traits": ["curieux", "gourmand", "complexé par sa jeunesse"],
  "passif": {
    "cible": "mes_unites",
    "filtre": { "surTerrain": ["ville"] },
    "modificateur": { "quoi": "soin", "valeur": 1 }
  },
  "pouvoir": {
    "nom": "Tour de France",
    "description": "Toute l'équipe avance d'une case de plus, et chaque région déjà remportée ajoute un peu de mordant.",
    "barres": 3,
    "effets": [
      { "cible": "mes_unites", "modificateur": { "quoi": "mouvement", "valeur": 1 } },
      { "cible": "mes_unites", "modificateur": { "quoi": "attaque", "valeur": 1.2 } }
    ],
    "duree": "ce_tour",
    "replique": "On repart, et cette fois on ne s'arrête pas au ravitaillement."
  },
  "superPouvoir": {
    "nom": "Le drapeau à damier",
    "description": "Une relance générale : tout le monde repart devant, et les unités en ville se refont une santé.",
    "barres": 6,
    "effets": [
      { "cible": "mes_unites", "modificateur": { "quoi": "mouvement", "valeur": 3 } },
      { "cible": "mes_unites", "filtre": { "surTerrain": ["ville"] },
        "modificateur": { "quoi": "soin", "valeur": 2 } }
    ],
    "duree": "tour_complet",
    "replique": "Dernier tour ! Tout le monde devant !"
  },
  "faiblesse": {
    "axe": "economie",
    "effet": {
      "cible": "economie",
      "modificateur": { "quoi": "fonds", "valeur": 0.9 }
    },
    "description": "L'école coûte cher : ses villes rapportent moins que celles des autres."
  },
  "repliques": {
    "ouverture": ["J'ai dix-huit régions dans les jambes. On verra bien.", "On joue chez moi, on joue bien."],
    "victoire": ["Voilà. Et je suis jeune, en plus."],
    "defaite": ["Bien joué. Sincèrement. Ça m'agace, mais bien joué."],
    "unitePerdue": ["Rentrez au vestiaire, on vous remplace."]
  },
  "portrait": { "teint": "#e8c39e", "cheveux": "#3a2a22", "accessoire": "foulard" }
}
```

---

## 3. `UnitType` — type d'unité

```ts
/** Les **dix** unités de base. Statut `canon`, jamais retirées du catalogue. */
export type CleUniteCanon =
  | 'infanterie' | 'meca' | 'recon' | 'char_leger' | 'char_lourd'
  | 'artillerie' | 'roquettes' | 'antiair' | 'helico' | 'transport';

/**
 * Clé d'unité : une des dix `CleUniteCanon`, ou une clé **homologuée** par la
 * Commission d'homologation d'Atlas (§14). Le type est ouvert parce que le catalogue
 * est vivant ; il est borné par le plafond de **24 unités actives** et par le
 * versionnage (`catalogueVersion`), pas par l'énumération.
 */
export type CleUnite = Cle;

export type TypeMouvement =
  | 'pied' | 'bottes' | 'roues' | 'chenilles' | 'air' | 'mer' | 'amphibie';

export type Domaine = 'terre' | 'air' | 'mer';

/** Statut d'homologation. Liste fermée (`BRIEF.md`, « Le jeu vivant »). */
export type StatutUnite = 'canon' | 'essai' | 'homologuee' | 'retiree';

/**
 * Liste **fermée** des traits. Une unité en porte **deux au plus**. Chaque trait est
 * implémenté une seule fois dans le moteur ; une unité nouvelle ne fait que le
 * déclarer, ce qui est ce que veut dire « entièrement en données, jamais en code ».
 * Effet exact de chaque trait : `04-gameplay.md` §13.2, qui fait foi.
 */
export type Trait =
  | 'transport' | 'tir_indirect' | 'anti_air' | 'amphibie' | 'vol'
  | 'furtif_nuit' | 'vision_etendue' | 'ravitaillement' | 'tout_terrain' | 'capture'
  | 'genie' | 'drone' | 'brouilleur' | 'plongee'   // catalogues 2 à 5
  | 'furtif';                                            // catalogue 6 (7 septembre 2026) : furtivité à la demande

/**
 * Dessin déclaratif, composé par les pièces de `render3d/pieces.ts` : base + corps + modules,
 * puis palette swap comme pour les dix unités canon (`02-architecture.md` §3.4).
 */
export interface Silhouette {
  base: 'chenilles' | 'roues' | 'pattes' | 'coque' | 'rotor' | 'ailes' | 'rail';
  corps: 'bloc' | 'capsule' | 'plateau';
  modules: ('tourelle' | 'canon_long' | 'lance_roquettes' | 'radar' | 'antenne'
          | 'grue' | 'panneaux_solaires' | 'nacelle')[];   // 0 à 3
  taille: 1 | 2 | 3;
}

export interface UnitType {
  cle: CleUnite;
  nom: string;                    // 'Char léger'
  nomCourt: string;               // ≤ 12 caractères, pour le HUD
  statut: StatutUnite;
  /** Présent dès que `statut !== 'canon'`. `sourceEventCode` : l'`Event` de la
   *  liste blanche (technologie civile réelle) qui a inspiré l'unité (§9). */
  homologation?: { date: DateIso; sourceEventCode?: Cle };
  traits: Trait[];                // 0 à 2, sans doublon
  silhouette: Silhouette;
  cout: number;                   // multiple de 100, 1000 à 20000
  mouvement: number;              // 1 à 9
  typeMouvement: TypeMouvement;
  domaine: Domaine;
  portee: [number, number];       // [min, max] ; [1,1] = tir direct
  vision: number;                 // 0 à 6
  munitions: number | null;       // null = arme sans munitions (infanterie)
  carburant: {                    // null = illimité (unités terrestres simples)
    max: number;                  // 30 à 99
    parCase: number;              // 1 à 2
    parTour: number;              // consommation passive : 0 au sol, 2 en vol
  } | null;
  capture: boolean;               // peut capturer un bâtiment
  transport: {                    // null = ne transporte rien
    places: number;               // 1 à 2
    accepte: CleUnite[];
    ravitaille?: boolean;         // catalogue 6 : le plein de la cale à chaque début de tour (porte-avions, camion) ; absent = false
  } | null;
  /** **Ligne** de la table de dégâts : ce que cette unité inflige. 0 à 130, base en points. */
  degats: Partial<Record<CleUnite, number>>;
  /** **Colonne** de la table de dégâts : ce que chaque unité active inflige à celle-ci.
   *  Obligatoire dès que `statut !== 'canon'` — une unité neuve n'existe dans le `degats`
   *  d'aucune unité existante, et une homologation ne modifie jamais une valeur du canon
   *  (`04-gameplay.md` §13.3, qui fait foi sur les contraintes de forme). Absent pour les
   *  dix unités `canon`, dont la colonne se lit dans la table 10 × 10 de `04-gameplay.md` §8. */
  subitDegats?: Partial<Record<CleUnite, number>>;
  peutRiposter: boolean;          // faux pour les unités indirectes
  peutTirerApresMouvement: boolean; // faux pour les unités indirectes
}
```

**Validations serveur.** `cle` : une des dix `CleUniteCanon`, ou une clé neuve non déjà prise (toutes versions de catalogue confondues — une clé n'est **jamais** réutilisée). `cout` multiple de 100 dans [1000, 20000]. `portee[0] ≤ portee[1]` ; si `portee[1] > 1` alors `peutRiposter === false` et `peutTirerApresMouvement === false` (invariant : une pièce indirecte ne riposte pas et ne tire pas après avoir bougé). `degats` : toute valeur est un entier de 0 à 130 ; toute clé absente vaut 0 ; **si toutes les valeurs sont 0, alors `munitions === null`** (une unité sans arme ne porte pas de munitions). `subitDegats` : **obligatoire et complète** dès que `statut !== 'canon'` (une entrée par unité active, elle-même comprise), refusée si `statut === 'canon'` ; mêmes bornes que `degats`, et les quatre contraintes de forme de `04-gameplay.md` §13.3 (diagonale < 100, au moins un contre à ≥ 70, au plus universelle, règle des quatre viseurs si `vol`) sont vérifiées par la routine contrôle. Une case manquante est un refus, jamais un zéro implicite : oublier une colonne, c'est livrer une unité invulnérable. `transport.accepte` n'inclut pas de transport (pas de poupées russes) — depuis le catalogue 5, le domaine des passagers est celui que le transport déclare : une barge porte du sol, un porte-avions de l'air. `capture === true` implique `typeMouvement ∈ {pied, bottes}`. Une unité de `domaine === 'air'` a obligatoirement un `carburant` non nul avec `parTour ≥ 1` — sans quoi rien ne limite le camping aérien.

**Validations propres au catalogue vivant.** `statut === 'canon'` **implique** `cle ∈ CleUniteCanon` et l'absence d'`homologation` ; réciproquement une des dix clés canon ne peut pas prendre un autre statut (`motif: 'schema_invalide'`) — les dix ne se retirent jamais. `traits` : 0 à 2 valeurs de la liste fermée, sans doublon, **cohérentes avec les champs chiffrés** — `capture` ⟺ `capture === true` et `typeMouvement ∈ {pied, bottes}` ; `transport` ⟺ `transport !== null` ; `tir_indirect` ⟺ `portee[0] ≥ 2` ; `vol` ⟺ `domaine === 'air'` ; `vision_etendue` implique `vision ≥ 5` ; `amphibie` implique `typeMouvement === 'amphibie'` et est **refusé tant que le paquet naval n'est pas ouvert** (`04-gameplay.md` §3) ; `ravitaillement` implique que toutes les valeurs de `degats` sont à 0. Une incohérence est un refus, pas une correction. `silhouette` : `modules` de 0 à 3 sans doublon, `taille` cohérente avec le coût (**1** sous 5 000 fonds, **3** au-dessus de 12 000) **[proposition]** ; une silhouette invalide ou strictement identique à celle d'une autre unité active est refusée (`motif: 'silhouette_invalide'`). Le **catalogue actif** (`canon` + `essai` + `homologuee`) est plafonné à **24 unités** : une insertion qui ferait dépasser est refusée tant qu'une `homologuee` n'est pas passée `retiree`. Une unité `retiree` reste en base et reste résolvable par les `catalogueVersion` antérieures — c'est ce qui garde les rejeux valides.

```json
{
  "cle": "char_leger",
  "nom": "Char léger",
  "nomCourt": "Char lég.",
  "statut": "canon",
  "traits": [],
  "silhouette": {
    "base": "chenilles",
    "corps": "bloc",
    "modules": ["tourelle"],
    "taille": 2
  },
  "cout": 6500,
  "mouvement": 6,
  "typeMouvement": "chenilles",
  "domaine": "terre",
  "portee": [1, 1],
  "vision": 3,
  "munitions": 9,
  "carburant": { "max": 70, "parCase": 1, "parTour": 0 },
  "capture": false,
  "transport": null,
  "degats": {
    "infanterie": 75, "meca": 70, "recon": 85, "char_leger": 55, "char_lourd": 15,
    "artillerie": 70, "roquettes": 85, "antiair": 75, "helico": 0, "transport": 90
  },
  "peutRiposter": true,
  "peutTirerApresMouvement": true
}
```

---

## 4. `Terrain`

```ts
export type CleTerrain =
  | 'plaine' | 'foret' | 'montagne' | 'route' | 'ville' | 'qg'
  | 'usine' | 'aeroport' | 'mer' | 'riviere' | 'pont' | 'plage'
  | 'radar' | 'port'          // catalogues 3 et 5
  | 'herbe_haute';             // 7 septembre 2026 au soir : cache les fantassins, laisse voir les chars (`G`)

export interface Terrain {
  cle: CleTerrain;
  car: string;                    // 1 caractère de grille : 'P','F','M','R','C','H','U','A','W','V','N','S'
  nom: string;
  defense: number;                // étoiles, 0 à 4
  couts: Partial<Record<TypeMouvement, number>>; // 1 à 4 ; absent = infranchissable
  capturable: boolean;
  revenus: number;                // fonds par tour si possédé, 0 ou multiple de 100
  produit: CleUnite[];            // types produisibles ici ; [] si non producteur
  ravitaille: boolean;            // remet munitions et carburant au plein en début de tour
  soigne: number;                 // PV affichés rendus par tour au propriétaire, 0 à 2
  cacheEnBrouillard: boolean;     // une unité dessus n'est vue qu'à distance 1
  cacheSeulement?: TypeMouvement[]; // 7 septembre 2026 : la cachette ne vaut que pour ces types (herbe haute : pied, bottes) ; exige cacheEnBrouillard
  palette: Palette;
}
```

**Validations serveur.** `car` : un seul caractère, unique dans l'ensemble des terrains (index unique). `defense` entier 0 à 4. `couts` : au moins une entrée, valeurs entières 1 à 4 ; un type de mouvement absent signifie **infranchissable** (c'est la convention, il n'existe pas de coût infini). `capturable === true` implique `revenus > 0` **ou** `produit.length > 0` **ou** `cle === 'qg'`. `produit.length > 0` implique `capturable === true` et `ravitaille === true`. `qg` est capturable, produit de l'infanterie et déclenche la victoire — c'est le seul terrain dont la capture termine la partie. `mer` et `riviere` : `couts` ne contient jamais `pied`, `bottes`, `roues` ni `chenilles`. `pont` : coût 1 pour tous les types terrestres et franchissable en `mer` **[proposition]** (un bateau passe sous un pont) — décision à trancher quand la mer arrivera.

```json
{
  "cle": "foret",
  "car": "F",
  "nom": "Forêt",
  "defense": 2,
  "couts": { "pied": 1, "bottes": 1, "roues": 3, "chenilles": 2, "air": 1 },
  "capturable": false,
  "revenus": 0,
  "produit": [],
  "ravitaille": false,
  "soigne": 0,
  "cacheEnBrouillard": true,
  "palette": { "main": "#2f9a48", "dark": "#1e6b32", "light": "#8fdc9a" }
}
```

---

## 5. `MapDef` — définition de carte

La grille reprend **exactement** la convention de `doc/assets/atlas-render-vector.html` : un tableau de chaînes, une chaîne par ligne, un caractère par case. Les caractères de la démo (`W P F M R C H`) sont conservés ; cinq sont ajoutés (`U A V N S`).

```ts
export type Symetrie = 'aucune' | 'axe_vertical' | 'axe_horizontal' | 'point' | 'rotation_90';

export interface ParametresCarte {
  largeur: number;                // 10 à 40
  hauteur: number;                // 10 à 30
  camps: 2 | 3 | 4;
  biome: Biome;
  ratioMer: number;               // 0.0 à 0.6
  ratioRelief: number;            // 0.0 à 0.4  (montagnes + forêts)
  villesParCamp: number;          // 2 à 10
  villesNeutres: number;          // 0 à 12 — minimum de villes neutres sur la carte
  usinesParCamp: number;          // 1 à 3
  aeroportsParCamp: number;       // 0 à 2
  portsParCamp?: number;          // 0 à 2, facultatif (absent = 0) — 7 septembre 2026 : un port par camp sur une côte, relié par la mer
  radarsParCamp?: number;         // 0 à 2, facultatif (absent = 0) — une station radar dans l’orbite du camp
  ratioHerbesHautes?: number;     // 0 à 0,5, facultatif (absent = 0) — part de la plaine semée d’herbe haute (7 septembre 2026)
  symetrie: Symetrie;
  densiteRoutes: number;          // 0.0 à 1.0
  mecanique?: Cle;                // clé de mécanique régionale
}

export interface UniteDepart {
  camp: CampId;
  type: CleUnite;
  x: number; y: number;
  pv?: number;                    // 1 à 100, défaut 100
}

export interface MapDef extends Enveloppe {
  code: Cle;                      // 'carte_fr_bretagne_01'
  nom: string;
  largeur: number;
  hauteur: number;
  camps: 2 | 3 | 4;
  biome: Biome;
  grille: string[];               // hauteur chaînes de largeur caractères
  proprietaires: Record<string, CampId>;  // clé "x,y" — convention de la démo
  unitesDepart: UniteDepart[];
  /** Bâtiments désaffectés au départ (`04-gameplay.md` §6 bis) : capturables, jamais le QG, sans propriétaire. */
  desaffectes?: Case[];
  mecanique?: Cle;
  generation?: {                  // présent si générée, absent si écrite à la main
    graine: string;
    parametres: ParametresCarte;
    mapgenVersion: number;
  };
  diagnostic?: {                  // rempli par mapgen, relu par la routine contrôle
    surfaceTerre: number;
    distanceQgQg: number;
    distanceQgUsine: number[];    // une entrée par camp
    zonesIsolees: number;
  };
}
```

**Validations serveur.** `grille.length === hauteur` et chaque ligne a exactement `largeur` caractères, tous dans l'ensemble des `Terrain.car` connus. Exactement **un QG (`H`) par camp**, ni plus ni moins. Chaque clé de `proprietaires` a la forme `"x,y"` avec `0 ≤ x < largeur`, `0 ≤ y < hauteur`, et **désigne une case capturable** ; un propriétaire sur une plaine est un refus. Un QG a toujours un propriétaire ; une ville peut être neutre (clé absente). `desaffectes`, s'il est présent : ≤ 12 cases, toutes capturables et **jamais un QG**, aucune dans `proprietaires`, sans doublon. `camp < camps` pour chaque valeur. `unitesDepart` : ≤ 40, chaque unité sur une case franchissable par son `typeMouvement`, pas deux unités sur la même case, `camp < camps`. Si `generation` est présent, le serveur **rejoue `genererCarte(parametres, graine)` et compare la grille produite** : une divergence est un refus (`motif: 'grille_non_reproductible'`). C'est ce qui garantit qu'aucune grille n'a été bricolée à la main dans une soumission de routine. `villesNeutres` est un **minimum**, pas une consigne exacte : le générateur en pose au moins ce nombre, à distance équivalente des camps, et la routine contrôle rejette une carte qui n'en a aucune quand le paramètre en demandait (une carte sans ville neutre n'a pas d'économie à disputer — motif `economie_insuffisante`). `mecanique`, si présente, existe dans le registre des mécaniques du moteur. Enfin, les invariants de jouabilité du §8 de `02-architecture.md` (accessibilité, zones mortes, équité) sont recalculés côté serveur, jamais crus sur parole.

```json
{
  "cle": "carte_fr_bretagne_01",
  "version": 1,
  "statut": "valide",
  "source": "atlas_map",
  "creeLe": "2026-09-06",
  "majLe": "2026-09-06",
  "code": "carte_fr_bretagne_01",
  "nom": "Pointe du Raz",
  "largeur": 16,
  "hauteur": 12,
  "camps": 2,
  "biome": "cotier",
  "grille": [
    "WWWWPPPPPPPPWWWW",
    "WWSPPFFPPMMPPSWW",
    "WSPCRRRRRRRRRCSW",
    "WPFPRPPFPPMPRPFW",
    "PPHPRPPVVPPPRPPP",
    "PPPPRPCNNCPPRPPP",
    "PPPPRPPVVPPPRHPP",
    "WPFPRPMPPFPPRPFW",
    "WSPCRRRRRRRRRCSW",
    "WWPPUMMPPFFUPPWW",
    "WWWWPPPPPPPPWWWW",
    "WWWWWWPPPPWWWWWW"
  ],
  "proprietaires": {
    "2,4": 0, "3,2": 0, "6,5": 0, "4,9": 0,
    "13,6": 1, "13,2": 1, "9,5": 1, "11,9": 1
  },
  "unitesDepart": [
    { "camp": 0, "type": "infanterie", "x": 3, "y": 5 },
    { "camp": 0, "type": "char_leger", "x": 4, "y": 4 },
    { "camp": 1, "type": "infanterie", "x": 12, "y": 5 },
    { "camp": 1, "type": "char_leger", "x": 11, "y": 6 }
  ],
  "mecanique": "meca_marees",
  "generation": {
    "graine": "fr-bretagne-2026-0006",
    "parametres": {
      "largeur": 16, "hauteur": 12, "camps": 2, "biome": "cotier",
      "ratioMer": 0.22, "ratioRelief": 0.14,
      "villesParCamp": 2, "villesNeutres": 2, "usinesParCamp": 1, "aeroportsParCamp": 0,
      "symetrie": "aucune", "densiteRoutes": 0.6, "mecanique": "meca_marees"
    },
    "mapgenVersion": 1
  },
  "diagnostic": {
    "surfaceTerre": 148, "distanceQgQg": 22,
    "distanceQgUsine": [7, 7], "zonesIsolees": 0
  }
}
```

---

## 6. `Scenario` — une mission

```ts
export type ObjectifVictoire =
  | { type: 'capture_qg' }
  | { type: 'hors_jeu_total' }
  | { type: 'capturer'; cases: Case[]; combien: number }
  | { type: 'tenir'; cases: Case[]; journees: number }
  | { type: 'survivre'; journees: number }
  | { type: 'proteger'; uniteRef: string }        // référence d'unite de depart
  | { type: 'points'; seuil: number };

export type ObjectifDefaite =
  | { type: 'qg_perdu' }
  | { type: 'toutes_unites_hors_jeu' }
  | { type: 'limite_journees'; journees: number }
  | { type: 'unite_perdue'; uniteRef: string }
  | { type: 'case_perdue'; cases: Case[] };

export interface Dialogue {
  locuteur: Cle;                  // clé de Commander, ou 'narrateur'
  texte: string;                  // ≤ 240 caractères
  emotion?: 'neutre' | 'joie' | 'colere' | 'surprise' | 'doute' | 'triomphe';
}

export interface ChoixScenario {
  cle: Cle;                       // 'choix_fr_lu_fin_de_match'
  question: string;               // ≤ 160 caractères
  moment: 'ouverture' | 'mi_partie' | 'fin';
  declencheur?: { journee?: number; flagRequis?: Cle };
  litFlags: Cle[];                // 0 à 4 — ce que la scène consulte (bloc `lit` de 08 §2.4)
  options: {
    cle: Cle;
    libelle: string;              // ≤ 90 caractères
    /** 1 à 3 écritures. `valeur` : `true` pour un booléen, un delta signé pour un compteur
     *  ou une relation (le moteur borne et sature). Voir `08-narration-choix.md` §2.4. */
    ecritFlags: { cle: Cle; valeur: true | number }[];
    effetImmediat?: EffetPouvoir; // bonus/malus appliqué tout de suite
  }[];                            // 2 ou 3 options
}

export interface Incarnation {
  paysCode: CodePays;             // la nation alliée que le joueur joue entièrement
  commandantCle: Cle;             // son général, forme `cmd_<prenom>_<nom>`
}

export interface Scenario extends Enveloppe {
  code: Cle;
  nom: string;
  acte: number;                   // 0 = prologue (qualification nationale), 1 à 3 = les trois actes/continents (08-narration-choix §6)
  /** Présent : **match d'incarnation** — le joueur joue cette nation, avec son
   *  général au camp 0, son catalogue et sa spécialité (§15.2 bis). */
  incarnation?: Incarnation;
  paysCode: CodePays;
  regionCle?: Cle;
  carteCle: Cle;
  /** Date **réelle** du jour où le match commence, figée à la création et jamais
   *  recalculée : c'est elle qui donne la saison, via `Country.hemisphere` (§13).
   *  Le moteur ne lit jamais l'horloge (`02-architecture.md` §3.1 et §7). */
  date: DateIso;
  /** Force la saison et/ou la météo au lieu de les déduire de `date`.
   *  Une météo forcée l'est pour toute la partie et les prévisions l'annoncent. */
  climatFixe?: { saison?: Saison; meteo?: Meteo };
  /** Journées de jour puis de nuit dans un cycle. Défaut `{ jour: 4, nuit: 2 }` ;
   *  `{ jour: 0, nuit: 6 }` est la nuit polaire. */
  cycleJourNuit: { jour: number; nuit: number };
  /** Version du catalogue d'unités figée par ce scénario (§14). */
  catalogueVersion: number;
  commandants: { camp: CampId; commandantCle: Cle; ia?: 'gloutonne' | 'ponderee' | 'agressive' | 'defensive' }[];
  fondsDepart: number;            // 0 à 30000, multiple de 100
  revenusParBatiment: number;     // 500 à 2000, multiple de 100
  brouillard: boolean;
  limiteJournees: number | null;  // 5 à 60, null = illimité
  victoire: ObjectifVictoire[];   // 1 à 3, satisfaire UN suffit
  defaite: ObjectifDefaite[];     // 1 à 3, en subir UN suffit
  dialogueOuverture: Dialogue[];  // 1 à 8
  dialogueVictoire: Dialogue[];   // 1 à 6
  dialogueDefaite: Dialogue[];    // 1 à 4
  scenesDialogue?: SceneDialogue[]; // 0 à 12, jouées PENDANT le match
  choix: ChoixScenario[];         // 0 à 3
  flagsRequis: Cle[];             // conditions d'accès
  flagsInterdits: Cle[];
  recompenses: {
    flags: Cle[];                 // écrits en cas de victoire
    fonds?: number;
    coCommandant?: Cle;           // commandant recrutable débloqué
    carteMonde?: Cle[];           // destinations ouvertes
  };
}
```

**Les scènes de dialogue** (`scenesDialogue`) sont ce qui manquait pour que les commandants parlent *pendant* un match, et pas seulement avant et après.

```ts
type DeclencheurScene =
  | { type: 'ouverture' }                          // une fois la carte à l'écran
  | { type: 'journee'; journee: number }           // au début du tour du joueur
  | { type: 'premier_combat' }                     // à la première attaque
  | { type: 'capture'; camp?: CampId }             // un bâtiment change de main
  | { type: 'perte'; camp?: CampId }               // une unité sort du jeu
  | { type: 'panne_seche'; camp?: CampId }         // une unité aérienne tombe à sec (ajouté le 6 septembre 2026)
  | { type: 'production'; unite?: CleUnite }       // une unité entre en jeu
  | { type: 'pouvoir'; camp?: CampId }             // un commandant déclenche
  | { type: 'etape'; etape: number };              // un relais franchit un jalon

interface SceneDialogue {
  cle: Cle;
  declencheur: DeclencheurScene;
  repliques: Dialogue[];          // 1 à 6
}
```

Trois règles, et elles tiennent tout : un déclencheur se juge sur les **événements** que le moteur vient de rendre — jamais sur une horloge, jamais sur un sondage —, ce qui rend les dialogues rejouables à l'identique ; une scène ne se joue **qu'une fois** par partie, identifiée par sa `cle`, sans quoi une scène de capture reviendrait à chaque ville prise ; et l'ordre de sortie est celui du scénario, pas celui des événements, pour qu'un auteur entende ses scènes dans l'ordre où il les a écrites. La fin de match n'a **pas** de déclencheur : elle appartient à `dialogueVictoire` et `dialogueDefaite`, qui existaient avant et restent propriétaires du moment. Le champ est facultatif : un scénario sans scène se joue exactement comme avant.

**Validations serveur.** `date` est une `DateIso` valide, écrite **une seule fois** : une soumission qui modifie la `date` d'un scénario déjà validé est refusée (`motif: 'champ_calcule'`), sans quoi un rejeu changerait de saison. `cycleJourNuit` : deux entiers ≥ 0 dont la somme est comprise entre 1 et 12 ; `{ jour: 4, nuit: 2 }` à défaut. `climatFixe`, s'il est présent, ne contient que des valeurs des énumérations `Saison` et `Meteo` (§13) ; une météo forcée hors de la table de probabilités du climat du pays est acceptée mais signalée à la routine contrôle (c'est un scénario scripté, pas un tirage). `catalogueVersion` désigne une version de catalogue existante, et **toute** `CleUnite` citée par la carte, les unités de départ et les objectifs se résout dans **cette** version, avec un statut `canon` ou `homologuee` — une unité en `essai` n'est autorisée que dans le scénario d'une `MissionDuJour` (§14). `carteCle` existe et son statut est au moins `valide`. `commandants` : un par camp de la carte, exactement, pas deux fois le même `camp` ; le camp 0 sans `ia` est le joueur, tous les autres doivent avoir une `ia`. `victoire` et `defaite` : 1 à 3 entrées, non vides — un scénario sans condition de défaite est refusé. Toute `Case` citée dans un objectif est dans les bornes de la carte et sur une case pertinente (`capturer` et `tenir` exigent un terrain capturable). `uniteRef` référence une unité de `unitesDepart` (identifiée par son index ou une clé). `limiteJournees` cohérent avec `defaite` : si un objectif `survivre` existe, `limiteJournees` doit être ≥ ses journées ou nul. Tous les flags de `ecritFlags`, `flagsRequis`, `flagsInterdits` et `recompenses.flags` existent dans `flags.json` et respectent la convention de portée (§8) : un scénario de pays ne peut écrire que `pays.<son code>.*` et `monde.*`. **Un scénario d'`incarnation` est plus serré encore** : il n'écrit **aucun** flag de la trame principale du joueur, donc rien en `monde.*`, et ses flags de pays sont ceux de la **nation incarnée** — `pays.<incarnation.paysCode>.*` et `cmd.*`, et rien d'autre, ni en récompense ni dans une option de choix (§15.2 bis). Son `commandants[camp 0].commandantCle` est **exactement** `incarnation.commandantCle` : le joueur joue le général de la nation, pas le sien. Les dialogues passent le filtre de bible et de ton. `scenesDialogue` : 0 à 12 scènes, **clés distinctes** (deux scènes de même clé ne se distingueraient plus, et la seconde ne se jouerait jamais), 1 à 6 répliques chacune ; un déclencheur `journee` porte une journée de 1 à 60, un déclencheur `etape` un jalon de 1 à 12, et chacun des deux est **obligatoire** — un `{ type: 'journee' }` sans journée passerait sinon, et la scène ne se jouerait jamais sans que personne ne sache pourquoi. `choix` : chaque `ChoixScenario` a 2 ou 3 options, chaque option écrit au moins un flag, et **deux options d'un même choix n'écrivent jamais le même ensemble de flags** (sinon le choix est décoratif — `motif: 'choix_sans_consequence'`).

```json
{
  "cle": "scen_fr_bretagne_01",
  "version": 4,
  "statut": "en_ligne",
  "source": "atlas_lore",
  "creeLe": "2026-09-06",
  "majLe": "2026-09-08",
  "code": "scen_fr_bretagne_01",
  "nom": "Bretagne — La marée n'attend personne",
  "acte": 0,
  "paysCode": "fr",
  "regionCle": "region_fr_bretagne",
  "carteCle": "carte_fr_bretagne_01",
  "date": "2026-09-06",
  "cycleJourNuit": { "jour": 4, "nuit": 2 },
  "catalogueVersion": 1,
  "commandants": [
    { "camp": 0, "commandantCle": "cmd_camille_aubertin" },
    { "camp": 1, "commandantCle": "cmd_maelle_kerdraon", "ia": "defensive" }
  ],
  "fondsDepart": 6000,
  "revenusParBatiment": 1000,
  "brouillard": false,
  "limiteJournees": 20,
  "victoire": [
    { "type": "capture_qg" },
    { "type": "capturer", "cases": [{ "x": 6, "y": 5 }, { "x": 9, "y": 5 }], "combien": 2 }
  ],
  "defaite": [{ "type": "qg_perdu" }, { "type": "limite_journees", "journees": 20 }],
  "dialogueOuverture": [
    { "locuteur": "cmd_maelle_kerdraon", "texte": "Bienvenue chez moi. Regarde bien l'eau : elle joue pour moi.", "emotion": "joie" },
    { "locuteur": "cmd_camille_aubertin", "texte": "Alors je jouerai plus vite qu'elle.", "emotion": "triomphe" }
  ],
  "dialogueVictoire": [
    { "locuteur": "cmd_maelle_kerdraon", "texte": "Tu as compris la marée avant moi. C'est rare.", "emotion": "surprise" }
  ],
  "dialogueDefaite": [
    { "locuteur": "cmd_maelle_kerdraon", "texte": "Reviens à marée basse. On recommencera.", "emotion": "neutre" }
  ],
  "choix": [
    {
      "cle": "choix_fr_bretagne_fin",
      "question": "Maëlle s'est fait piéger par sa propre marée. Tu la laisses replier ses unités ?",
      "moment": "fin",
      "litFlags": ["cmd.maelle_kerdraon.respect"],
      "options": [
        { "cle": "laisser", "libelle": "La laisser sauver la face.",
          "ecritFlags": [
            { "cle": "pays.fr.bretagne_maelle_respectee", "valeur": true },
            { "cle": "monde.tournoi.serie_propre", "valeur": 1 }
          ] },
        { "cle": "achever", "libelle": "Finir le match proprement, sans cadeau.",
          "ecritFlags": [{ "cle": "pays.fr.bretagne_maelle_humiliee", "valeur": true }],
          "effetImmediat": { "cible": "economie", "modificateur": { "quoi": "fonds", "valeur": 1.2 } } }
      ]
    }
  ],
  "flagsRequis": [],
  "flagsInterdits": ["pays.fr.tour_complet"],
  "recompenses": {
    "flags": ["pays.fr.bretagne_maree_lue"],
    "fonds": 2000,
    "coCommandant": "cmd_maelle_kerdraon",
    "carteMonde": ["scen_fr_normandie_01", "scen_fr_pays_de_la_loire_01"]
  }
}
```

---

## 7. `Region`

Une région est une **sous-étape d'un pays phare** : une carte, une mécanique, un ton local. Le schéma est générique pour que le système serve plus tard le Japon ou le Brésil.

```ts
export interface Region extends Enveloppe {
  code: Cle;                      // 'region_fr_bretagne'
  paysCode: CodePays;
  nom: string;
  type: 'metropolitaine' | 'outre_mer' | 'collectivite';
  ordreConseille: number;         // 1..n, sert de progression suggérée
  biome: Biome;
  climat: Climat;
  specialiteLocale: Specialite;   // `portee: 'region'` — voir §1
  mecanique: {
    cle: Cle;                     // registre du moteur
    parametres: Record<string, number | string | boolean>;
    description: string;          // ≤ 240 caractères, lisible par le joueur
  };
  commandantCle: Cle;
  scenarios: Cle[];               // 1 à 3
  accroche: string;               // ≤ 160 caractères
  motsCles: string[];             // 3 à 8, pour la routine lore (gastronomie, paysage…)
  flagsPropres: Cle[];
}
```

**Validations serveur.** `paysCode` désigne un pays avec `phare === true` et `code` figure dans son tableau `regions`. `specialiteLocale.portee === 'region'`, et elle est soumise au plafond du §1 : **une seule spécialité équipée par match**, la spécialité régionale entrant dans la collection de cinq. `ordreConseille` unique au sein d'un pays. `mecanique.cle` existe dans le registre du moteur, respecte le préfixe `meca_`, et **ses `parametres` valident contre le schéma déclaré par la mécanique** (chaque mécanique publie son propre schéma de paramètres — contrat et noms de hooks dans `04-gameplay.md` §11, qui fait foi). Toute mécanique accepte en outre le paramètre commun **`gelable: boolean` (défaut `true`)** : à `false`, aucun effet de saison ne peut rendre franchissables ni neutraliser les cases que la mécanique régit — c'est ainsi que le Grand Est garde son fleuve libre en hiver (`BRIEF.md`, seconde relecture, point 5 ; ordre de résolution dans `04-gameplay.md` §12). `scenarios` : 1 à 3, chacun avec `regionCle === code`. Une région peut **porter plusieurs `MapDef`** : `scenarios` désigne jusqu'à trois scénarios, et deux scénarios d'une même région peuvent référencer deux cartes distinctes plutôt qu'une seule carte à paramètres variables — c'est la règle retenue pour Mayotte, dont la version de repli et la version maritime sont **deux `MapDef` distinctes** aux deux clés `carte_fr_mayotte_repli_01` et `carte_fr_mayotte_01` (`BRIEF.md`, seconde relecture, point 6 ; `07-france-regions.md` §4.17). Une `MapDef` certifiée ne change jamais de ratio après coup : on en publie une seconde. `motsCles` : 3 à 8, tous filtrés par la bible — c'est le champ le plus exposé aux clichés qui dérapent, il est donc relu par la routine contrôle avec un seuil de tolérance bas. `type === 'collectivite'` implique `ordreConseille > 18` (les 18 régions occupent les rangs 1 à 18 ; les collectivités — Nouvelle-Calédonie, Polynésie — sont des étapes bonus, voir `07-france-regions.md` §5).

```json
{
  "cle": "region_fr_bretagne",
  "version": 2,
  "statut": "en_ligne",
  "source": "humain",
  "creeLe": "2026-09-05",
  "majLe": "2026-09-06",
  "code": "region_fr_bretagne",
  "paysCode": "fr",
  "nom": "Bretagne",
  "type": "metropolitaine",
  "ordreConseille": 3,
  "biome": "cotier",
  "climat": "oceanique",
  "specialiteLocale": {
    "cle": "spec_fr_bretagne_pied_marin",
    "nom": "Pied marin",
    "portee": "region",
    "famille": "mobilite",
    "contenu": {
      "variant": "modificateur",
      "effets": [
        { "cible": "mes_unites", "filtre": { "surTerrain": ["plage"] },
          "modificateur": { "quoi": "mouvement", "valeur": 1 } }
      ]
    },
    "description": "Sur la grève, les Bretons avancent d'une case de plus. Personne d'autre ne sait courir là-dessus."
  },
  "mecanique": {
    "cle": "meca_marees",
    "parametres": { "periodeJournees": 2, "amplitudeCases": 1, "phaseInitiale": 0, "gelable": true },
    "description": "Une journée sur deux, la mer se retire : les plages deviennent praticables, puis se referment."
  },
  "commandantCle": "cmd_maelle_kerdraon",
  "scenarios": ["scen_fr_bretagne_01"],
  "accroche": "Ici, l'horaire compte plus que le terrain.",
  "motsCles": ["marée", "granit", "phare", "crêpe", "voile", "vent"],
  "flagsPropres": [
    "pays.fr.bretagne_maree_lue",
    "pays.fr.bretagne_maelle_respectee",
    "pays.fr.bretagne_maelle_humiliee"
  ]
}
```

---

## 8. `Choice` / `Flag` — le système narratif

Le catalogue de flags vit dans `content/flags.json` et **fait autorité** techniquement ; **`01-bible.md` §8 fait foi sur les noms, les types et les portées**, et `08-narration-choix.md` sur les usages. Aucune routine ne crée un flag, elle ne peut qu'en utiliser un existant. Créer un flag est une opération humaine, ou une proposition de la routine cerveau validée à la main.

**Convention de nommage** (`01-bible.md` §8.1) : `<portee>.<domaine>.<nom>`, soit `pays.<iso2>.<nom>`, `monde.<domaine>.<nom>` (domaines : `atlas`, `cinquieme`, `regie`, `public`, `tournoi`, `carnet`, `depeche`) et `cmd.<id>.<nom>` où `<id>` est le `Commander.code` privé de son préfixe `cmd_`. Le `<nom>` est en minuscules avec des tirets bas, et **décrit un fait acquis, pas une question** : `rival_respecte`, pas `respecter_le_rival`.

```ts
export type PorteeFlag = 'pays' | 'monde' | 'commandant';

export interface Flag {
  cle: Cle;                       // 'pays.fr.rival_respecte' | 'monde.atlas.soupcon' | 'cmd.maelle_kerdraon.respect'
  portee: PorteeFlag;
  paysCode?: CodePays;            // requis si portee === 'pays'
  commandantCle?: Cle;            // requis si portee === 'commandant'
  libelle: string;                // affiché dans le carnet de voyage, ≤ 90 caractères
  description: string;            // ≤ 240 caractères, pour les routines
  valeur: 'booleen' | 'compteur' | 'relation'; // compteur : entier borné croissant ; relation : entier signé −3…+3
  min: number | null;             // requis si valeur === 'relation' (−3) ; null sinon
  max: number | null;             // requis si valeur === 'compteur' (1 à 99) ou 'relation' (+3) ; null sinon
  exclusifAvec: Cle[];            // flags qui ne peuvent coexister
  impacte: ('fin' | 'recrutement' | 'dialogue' | 'economie' | 'carte_monde')[];
  perenne: boolean;               // survit d'un acte à l'autre (toujours vrai pour 'monde')
}

/** État runtime, dans la sauvegarde. */
export interface EtatFlags {
  booleens: Record<Cle, true>;    // absence = faux ; on ne stocke jamais un false
  compteurs: Record<Cle, number>;
  journal: {                      // le carnet de voyage
    journee: number;
    scenarioCle: Cle;
    choixCle: Cle;
    optionCle: Cle;
    flagsEcrits: Cle[];
  }[];
}
```

**Validations serveur.** `cle` respecte `^(pays\.[a-z]{2}|monde\.(atlas|cinquieme|regie|public|tournoi|carnet|depeche)|cmd\.[a-z][a-z0-9_]{1,31})\.[a-z][a-z0-9_]{2,47}$`. Le domaine `depeche` est celui de `monde.depeche.serie` (`01-bible.md` §8.4) : il vit au profil du joueur, hors sauvegarde de campagne, et c'est le seul domaine `monde.*` qu'une scène de mission du jour a le droit d'écrire (`08-narration-choix.md` §4.4). `portee === 'pays'` implique `paysCode` présent et cohérent avec le segment de la clé ; `portee === 'commandant'` implique `commandantCle` présent et cohérent. `valeur === 'compteur'` implique `max` ; `valeur === 'relation'` implique `min === -3` et `max === 3`. `exclusifAvec` est **symétrique** : si A déclare B, B doit déclarer A (vérifié à l'écriture du catalogue, pas à l'exécution). `impacte` non vide — un flag qui n'impacte rien est du bruit et il est refusé. `perenne === true` obligatoire quand `portee === 'monde'`. À l'exécution, écrire un flag dont l'exclusif est déjà posé est une erreur bloquante du moteur : elle signale un scénario mal écrit, pas un cas de jeu.

```json
{
  "cle": "pays.fr.rival_respecte",
  "portee": "pays",
  "paysCode": "fr",
  "libelle": "Tu as laissé le Luxembourg sortir la tête haute.",
  "description": "Posé quand le joueur refuse d'aggraver le score contre le rival naturel de la France. Ouvre son recrutement comme co-commandant et adoucit ses répliques ultérieures.",
  "valeur": "booleen",
  "min": null,
  "max": null,
  "exclusifAvec": ["pays.fr.rival_humilie"],
  "impacte": ["recrutement", "dialogue", "fin"],
  "perenne": true
}
```

---

## 9. `Event` — événement de jeu issu de l'actualité

Produit par le volet actualité de la routine cerveau. **Rien ne passe en ligne sans validation humaine** (brief). Le champ `categorie` est fermé sur la liste blanche ; la liste noire n'existe pas comme valeur, elle existe comme refus.

L'`Event` a deux débouchés, et deux seulement : l'**effet** décrit ci-dessous, appliqué à des parties existantes ; et la **Dépêche du jour** — une `MissionDuJour` (§14) qui le cite par `eventCode` et lui donne un scénario à elle. Un `Event` peut aussi inspirer une `UnitType` candidate, qui le cite alors par `homologation.sourceEventCode` (§3). Dans les trois cas c'est l'`Event` qui porte la source, l'URL et la catégorie : rien d'issu de l'actualité n'entre dans le jeu sans passer par ce type.

```ts
export type CategorieEvent =
  | 'competition_sportive' | 'festival' | 'meteo'
  | 'decouverte' | 'culture' | 'anniversaire';

export interface Event extends Enveloppe {
  code: Cle;
  titre: string;                  // ≤ 80 caractères
  resume: string;                 // ≤ 240 caractères, ton du jeu, pas du journalisme
  categorie: CategorieEvent;
  sourceUrl: string;              // https obligatoire
  sourceNom: string;
  paysConcernes: CodePays[];      // 0 à 6 ; vide = mondial
  debut: DateIso;
  fin: DateIso;
  effet:
    | { type: 'bonus_pays'; paysCode: CodePays; modificateur: EffetPouvoir }
    | { type: 'carte_bonus'; carteCle: Cle }
    | { type: 'dialogue_bonus'; commandantCle: Cle; repliques: string[] }
    | { type: 'meteo_globale'; mecaniqueCle: Cle; parametres: Record<string, number> }
    | { type: 'cosmetique'; palette: Palette };
  valideParHumain: boolean;
  motifRefusHumain?: string;
}
```

**Validations serveur.** `categorie` dans l'énumération fermée ; toute autre valeur est un refus immédiat sans discussion (`motif: 'categorie_hors_liste_blanche'`). `sourceUrl` en `https://` et son domaine figure dans une **liste blanche de domaines** tenue à la main **[proposition]** — sans cela, la liste blanche de catégories est contournable par une source douteuse rangée sous « culture ». `debut ≤ fin`, et `fin − debut ≤ 60 jours` : un événement d'actualité est temporaire par nature. `titre` et `resume` passent le filtre de bible **avec un seuil renforcé** : c'est le point d'entrée le plus risqué du projet, un événement réel mal transposé peut faire dire au jeu exactement ce que le brief interdit. `effet.type === 'bonus_pays'` : le modificateur multiplicatif est borné à [0,9 ; 1,15] — un événement ne doit jamais déséquilibrer une partie sérieusement. Passage en `en_ligne` **impossible** tant que `valideParHumain !== true` : la transition est refusée au niveau de la couche `serveur/cycle.ts`, pas seulement dans l'interface d'administration.

```json
{
  "cle": "evt_2026_09_vendee",
  "version": 1,
  "statut": "valide",
  "source": "atlas_cerveau",
  "creeLe": "2026-09-10",
  "majLe": "2026-09-11",
  "code": "evt_2026_09_vendee",
  "titre": "Grande course au large",
  "resume": "Les commandants côtiers se prennent au jeu : cette semaine, tout ce qui flotte ou longe la côte va plus vite.",
  "categorie": "competition_sportive",
  "sourceUrl": "https://www.exemple-officiel.fr/calendrier/course-au-large",
  "sourceNom": "Calendrier officiel de la compétition",
  "paysConcernes": ["fr"],
  "debut": "2026-11-08",
  "fin": "2026-11-30",
  "effet": {
    "type": "bonus_pays",
    "paysCode": "fr",
    "modificateur": {
      "cible": "mes_unites",
      "filtre": { "surTerrain": ["plage", "mer"] },
      "modificateur": { "quoi": "mouvement", "valeur": 1 }
    }
  },
  "valideParHumain": true
}
```

---

## 10. `MemoryEntry` — mémoire structurée

Le brief est explicite : des **entrées structurées, datées, sourcées, jamais un texte qui grossit indéfiniment**. La mémoire est donc une table de faits courts, avec une portée et une expiration, pas un journal.

```ts
export type PorteeMemoire =
  | 'global'          // vaut pour toutes les routines
  | 'atlas_lore' | 'atlas_map' | 'atlas_controle' | 'atlas_cerveau'
  | 'atlas_traduction'   // 09-i18n.md §8 ; `porteeRef` reste null, comme pour les autres routines
  | 'pays' | 'region' | 'commandant' | 'carte';

export type SujetMemoire =
  | 'preference_humaine'    // « Thief préfère les cartes compactes »
  | 'motif_rejet_recurrent'
  | 'regle_de_ton'
  | 'equilibrage'
  | 'fait_de_lore'
  | 'incident_technique';

export interface MemoryEntry {
  cle: Cle;
  date: DateIso;
  source: 'humain' | 'atlas_controle' | 'atlas_cerveau' | 'simulation' | 'incident';
  sourceRef?: string;             // id de run, de review, ou URL
  sujet: SujetMemoire;
  portee: PorteeMemoire;
  porteeRef: Cle | null;          // requis si portee ∈ {pays, region, commandant, carte}
  contenu: string;                // ≤ 300 caractères, une seule affirmation
  poids: number;                  // 1 à 5 : importance, sert au tri d'injection
  occurrences: number;            // ≥ 1, incrémenté au lieu de dupliquer
  expireLe: DateIso | null;       // null = permanent (réservé à source 'humain')
}
```

**Validations serveur.** `contenu` ≤ 300 caractères et **une seule affirmation** — la validation refuse la présence de plus d'une phrase terminée ainsi que les puces **[proposition]** ; c'est grossier mais c'est ce qui empêche la mémoire de redevenir un texte. `expireLe === null` autorisé uniquement si `source === 'humain'` ; toute entrée produite par une routine expire, par défaut à 90 jours. `poids` 1 à 5. **Déduplication** : avant insertion, le serveur cherche une entrée de même `sujet` + `portee` + `porteeRef` avec un contenu de similarité élevée ; s'il en trouve une, il incrémente `occurrences` et repousse `expireLe` au lieu d'insérer. **Plafond** : au plus 200 entrées vivantes par `portee`; au-delà, les plus faibles (`poids` puis `occurrences` puis ancienneté) sont retirées. C'est ce plafond, plus que l'expiration, qui garantit que la mémoire ne grossit pas.

```json
{
  "cle": "mem_2026_09_12_cartes_compactes",
  "date": "2026-09-12",
  "source": "atlas_controle",
  "sourceRef": "review_8841",
  "sujet": "motif_rejet_recurrent",
  "portee": "atlas_map",
  "porteeRef": null,
  "contenu": "Les cartes de plus de 26 cases de large sont rejetées neuf fois sur dix pour zone morte au centre.",
  "poids": 4,
  "occurrences": 9,
  "expireLe": "2026-12-11"
}
```

---

## 11. `PromptVersion` — prompt métier versionné

Reprend le modèle Flecho : le prompt bootstrap vit dans la tâche planifiée, le **prompt métier vit ici**, versionné, avec historique et retour arrière, validé par un humain avant de devenir courant.

```ts
export type ClePrompt =
  | 'atlas_lore' | 'atlas_map' | 'atlas_controle' | 'atlas_cerveau'
  | 'atlas_traduction';   // cinquième routine, canon « Langues » — 09-i18n.md §8

export interface MetriquesPrompt {
  runs: number;
  objetsProduits: number;
  tauxRejet: number;              // 0.0 à 1.0
  motifsTop: { motif: string; n: number }[];   // 0 à 5
  coherenceLore: number;          // 0.0 à 1.0, note de la routine contrôle
  dureeMoyenneMs: number;
  fenetre: { du: DateIso; au: DateIso };
}

export interface PromptVersion {
  cle: ClePrompt;
  version: number;                // entier ≥ 1, strictement croissant par clé
  corps: string;                  // le prompt métier, 200 à 20000 caractères
  auteur: 'humain' | 'atlas_cerveau';
  auteurRef?: string;
  statut: 'propose' | 'courant' | 'retire';
  parentVersion: number | null;   // version dont celle-ci dérive
  justification: string;          // ≤ 500 caractères — pourquoi ce changement
  diffResume: string[];           // 1 à 8 puces de ce qui change
  metriques: MetriquesPrompt | null;  // mesurées pendant que la version était courante
  valideParHumain: boolean;
  creeLe: DateIso;
  activeLe: DateIso | null;
}
```

**Validations serveur.** Une seule ligne `courant` par `cle` — index unique partiel en base, pas une vérification applicative. `version` strictement croissante par clé, jamais réutilisée. `auteur === 'atlas_cerveau'` force `statut === 'propose'` à l'insertion : **une routine ne peut pas activer son propre prompt**. La transition `propose → courant` exige `valideParHumain === true` et renseigne `activeLe` ; elle passe automatiquement l'ancienne version courante en `retire`. Le retour arrière est la même opération dans l'autre sens : réactiver une version `retire` crée une nouvelle `version` avec le même `corps` et `parentVersion` pointant sur l'ancienne — on n'écrase jamais l'histoire. `metriques` est écrit par le serveur, jamais par la routine (`motif: 'champ_calcule'` si soumis). `corps` ne peut pas contenir d'URL vers un domaine autre que celui du site : les invariants de sécurité du bootstrap priment, mais autant refuser au dépôt.

```json
{
  "cle": "atlas_map",
  "version": 7,
  "corps": "Tu produis des PARAMÈTRES de carte, jamais une grille. Pour chaque mission reçue…",
  "auteur": "atlas_cerveau",
  "auteurRef": "run_2026_09_12_0310",
  "statut": "propose",
  "parentVersion": 6,
  "justification": "Le taux de rejet pour zone morte est passé de 12 % à 31 % sur les grandes cartes ; la version 7 borne la largeur à 26 et impose une densité de routes minimale.",
  "diffResume": [
    "largeur maximale abaissée de 40 à 26",
    "densiteRoutes minimale portée à 0.5",
    "ajout d'un rappel : une usine par camp au minimum"
  ],
  "metriques": null,
  "valideParHumain": false,
  "creeLe": "2026-09-12",
  "activeLe": null
}
```

---

## 12. `ReviewVerdict` — verdict de la routine contrôle

Le gardien. C'est le **seul** objet capable de faire passer un contenu de `brouillon` à `valide`.

```ts
export type CibleReview =
  | 'carte' | 'scenario' | 'commandant' | 'pays' | 'region' | 'evenement'
  | 'unite';        // UnitType candidate, simulée dans le catalogue (§14) [proposition]
// Pas de valeur `traduction` : le canon « Langues » confie la relecture des traductions
// à la validation serveur (chaîne par chaîne) et à un échantillon humain, jamais à
// `atlas_controle`. Ses motifs de refus — `placeholder_manquant`, `trop_long`,
// `glossaire_non_respecte`, `terme_interdit`, `langue_incorrecte` — sont des refus de la
// couche API (voir l'encadré ci-dessous), listés par `09-i18n.md` §8.4, et n'entrent
// donc pas dans `MotifRejet`.

/**
 * Catalogue **fermé** des motifs. C'est le vocabulaire du contrôle : `05-routines.md` §4.3
 * en donne la famille, la gravité par défaut et le déclencheur de chacun, mais les **noms**
 * sont ceux-ci et ne se déclinent pas en anglais. Ajouter un motif est une décision humaine.
 */
export type MotifRejet =
  // structure
  | 'schema_invalide' | 'reference_inconnue' | 'champ_inconnu' | 'flag_inconnu'
  // jouabilité
  | 'qg_inaccessible' | 'zone_morte' | 'usine_trop_loin' | 'depart_bloque'
  | 'grille_non_reproductible' | 'qg_menace_trop_tot' | 'economie_insuffisante'
  // équilibrage
  | 'avantage_premier_joueur' | 'desequilibre_fonds' | 'desequilibre_villes'
  | 'partie_trop_courte' | 'partie_trop_longue' | 'trop_de_parties_non_terminees'
  | 'pouvoir_trop_fort' | 'commandant_sans_faiblesse' | 'mecanique_inutilisee'
  // climat (simulation multi-condition, 05-routines §4.2)
  | 'injouable_sous_meteo' | 'nuit_bloquante'
  // contenu
  | 'ton_hors_bible' | 'sujet_interdit' | 'personne_reelle' | 'cliche_deplace'
  | 'contredit_canon' | 'redite_commandant'
  | 'choix_sans_consequence' | 'dialogue_trop_long'
  // événement d'actualité
  | 'categorie_hors_liste_blanche' | 'source_hors_liste_blanche' | 'evenement_perime'
  // catalogue d'unités (§14)
  | 'unite_dominante' | 'unite_inutile' | 'silhouette_invalide'
  // technique
  | 'simulation_plantee' | 'moteur_non_deterministe' | 'objet_incomprehensible';
```

> **Deux vocabulaires à ne pas confondre.** `MotifRejet` est le vocabulaire du **verdict** de la routine contrôle. Les codes cités ailleurs dans ce document sous la forme `motif: '…'` par une *validation d'écriture* — `champ_calcule`, `effet_hors_bornes`, `version_perimee` — sont des **refus de la couche API**, renvoyés par un `POST` refusé, et n'appartiennent pas à cette énumération. Une routine ne peut pas les employer dans un `ReviewVerdict`.

```ts
export interface StatsSimulation {
  parties: number;                    // ≥ 10 pour un verdict valide
  strategie: string;                  // 'ponderee'
  graines: string[];                  // les graines utilisées, pour rejouer
  victoiresCamp: number[];            // une entrée par camp, somme ≤ parties
  nonTerminees: number;
  journeesMediane: number;
  journeesEcartType: number;
  fondsMoyenParCamp: number[];
  casesJamaisVisitees: number;        // en pourcentage de la surface de terre
  /** Parties (sur `parties`) où la mécanique régionale a produit au moins un effet.
   *  `null` si la carte n'en déclare aucune. C'est la mesure qui fonde le motif
   *  `mecanique_inutilisee` : sans elle, le motif n'était pas vérifiable. */
  mecaniqueDeclenchee: number | null;
  /** Configuration climatique du lot : ce qui a été joué, pas ce qui était possible.
   *  Une campagne multi-climat produit une ligne de `StatsSimulation` par case de la
   *  matrice (`02-architecture.md` §8). */
  climat: { saison: Saison; meteo: Meteo | 'tiree'; phase: PhaseJour | 'cycle' };
  dureeMoyenneMs: number;
}

export interface ReviewVerdict {
  cle: Cle;
  cibleType: CibleReview;
  cibleCle: Cle;
  cibleVersion: number;
  verdict: 'valide' | 'rejete';
  /**
   * Structuré depuis `BRIEF.md`, arbitrage n° 5. Vide si validé, 1 à 6 sinon.
   * `detail` : une phrase par motif, ≤ 240 caractères. `mesure` : les chiffres qui
   * fondent **ce** motif, pour que l'administration puisse les rejouer
   * (`{ "victoires_camp_0": 13, "parties": 20 }`).
   * La **gravité** reste une propriété du catalogue de motifs (`05-routines.md` §4.3),
   * jamais du verdict : c'est le catalogue qu'on relit pour trier une file, pas les
   * verdicts un par un.
   */
  motifs: { code: MotifRejet; detail?: string; mesure?: Record<string, number> }[];
  detail?: string;                    // ≤ 500 caractères, synthèse humainement lisible
  /**
   * Un seul `StatsSimulation` (l'agrégat de la campagne) pour `cibleType ∈ {carte, scenario}` ;
   * **deux** pour `cibleType === 'unite'` — le catalogue joué `avec` et `sans` la candidate,
   * sur les mêmes graines (`05-routines.md` §4.2 et §9.2). `null` pour les autres cibles.
   */
  stats: StatsSimulation | { avec: StatsSimulation; sans: StatsSimulation } | null;
  coherenceLore: number;              // 0.0 à 1.0
  suggestions: string[];              // 0 à 3, remontent dans le champ `apprise`
  routineRunId: string;
  creeLe: DateIso;
}
```

**Validations serveur.** `cibleCle` + `cibleVersion` doivent désigner un objet **actuellement en `brouillon`** : on ne révise pas un objet déjà validé, et si la version a changé depuis le `GET`, le verdict est refusé (`motif: 'version_perimee'`) — c'est le verrou optimiste qui évite qu'un verdict s'applique à un contenu qu'il n'a pas vu. `verdict === 'rejete'` exige `motifs.length ≥ 1` ; `verdict === 'valide'` exige `motifs.length === 0`. Deux entrées de `motifs` n'ont jamais le même `code` (on complète le `detail`, on ne répète pas le motif). Pour `cibleType ∈ {carte, scenario}`, `stats` est obligatoire avec `parties ≥ 10`, et le serveur **recalcule les seuils lui-même** à partir des statistiques fournies : si `victoiresCamp[0] / parties` sort de [0,40 ; 0,60], le serveur transforme un `valide` en `rejete` avec `{ code: 'avantage_premier_joueur', mesure: { victoires_camp_0, parties } }` — c'est le serveur qui remplit alors la `mesure`, la routine ne peut pas la maquiller. Pour `cibleType === 'unite'`, `stats` prend la forme `{ avec, sans }` — le catalogue simulé avec et sans la candidate, sur les mêmes graines, chacun avec `parties ≥ 10` — et les motifs `unite_dominante` / `unite_inutile` sont recalculés côté serveur selon les bornes de `04-gameplay.md` §13.4. Une forme simple sur une cible `unite`, ou une forme `{ avec, sans }` sur une cible `carte`, est refusée (`motif: 'schema_invalide'`). Autrement dit, la routine propose un verdict, **le serveur le confirme ou le corrige** — cohérent avec le principe Flecho « le serveur recalcule et refuse ce qu'il n'a pas lui-même produit ». `graines` doit contenir `parties` entrées distinctes, ce qui permet de rejouer n'importe quelle partie du lot. `motifs` alimente automatiquement `MemoryEntry` (sujet `motif_rejet_recurrent`) et les `MetriquesPrompt` de la routine émettrice.

```json
{
  "cle": "review_8841",
  "cibleType": "carte",
  "cibleCle": "carte_fr_bretagne_02",
  "cibleVersion": 1,
  "verdict": "rejete",
  "motifs": [
    {
      "code": "zone_morte",
      "detail": "Le quart nord-est n'est relié au reste que par une case de pont ; l'IA n'y va jamais.",
      "mesure": { "cases_isolees": 18, "cases_jamais_visitees_pct": 28 }
    },
    {
      "code": "avantage_premier_joueur",
      "detail": "Le camp 0 gagne 13 fois sur 20, hors de la fourchette 40–60 %.",
      "mesure": { "victoires_camp_0": 13, "parties": 20, "taux": 0.65 }
    }
  ],
  "detail": "Carte jouable mais déséquilibrée : la liaison unique vers le nord-est concentre tout le jeu au sud.",
  "stats": {
    "parties": 20,
    "strategie": "ponderee",
    "graines": ["s01","s02","s03","s04","s05","s06","s07","s08","s09","s10",
                "s11","s12","s13","s14","s15","s16","s17","s18","s19","s20"],
    "victoiresCamp": [13, 5],
    "nonTerminees": 2,
    "journeesMediane": 19,
    "journeesEcartType": 6.4,
    "fondsMoyenParCamp": [41200, 33900],
    "casesJamaisVisitees": 28,
    "mecaniqueDeclenchee": 20,
    "climat": { "saison": "automne", "meteo": "tiree", "phase": "cycle" },
    "dureeMoyenneMs": 412
  },
  "coherenceLore": 0.91,
  "suggestions": [
    "Poser une seconde liaison vers le nord-est ou supprimer la zone.",
    "Rapprocher l'usine du camp 1 de son QG d'une case."
  ],
  "routineRunId": "run_2026_09_12_0310",
  "creeLe": "2026-09-12"
}
```

---

## 13. `EtatClimat` — saison, jour et nuit, météo

Le climat est une **mécanique globale du moteur** (`BRIEF.md`, « Climat »). Ce paragraphe fixe les types ; **`04-gameplay.md` §12 fait foi sur les effets, les tables et les hooks**.

```ts
/** Quatre valeurs, toujours. La saison est **fixe pendant un match**. */
export type Saison = 'printemps' | 'ete' | 'automne' | 'hiver';

export type PhaseJour = 'jour' | 'nuit';

export type Meteo = 'clair' | 'pluie' | 'neige' | 'brouillard' | 'tempete' | 'canicule';

/**
 * Bloc climatique de `EtatPartie`. `EtatPartie` appartient au moteur
 * (`02-architecture.md` §3.1) ; ce schéma n'en fixe que ce bloc, parce qu'il est
 * sérialisé dans la sauvegarde et lu par la routine contrôle.
 */
export interface EtatClimat {
  saison: Saison;
  phase: PhaseJour;
  /** 0 à (cycleJourNuit.jour + cycleJourNuit.nuit − 1). Avance d'un cran par journée. */
  journeeDansCycle: number;
  meteo: Meteo;
  /** Météo des deux journées suivantes, **annoncée au joueur** : le climat n'est
   *  jamais une surprise, il est tiré du RNG seedé et publié d'avance. */
  previsions: [Meteo, Meteo];
}
```

`EtatPartie` gagne donc exactement un champ :

```ts
export interface EtatPartie {
  // … champs existants (grille, unités, camps, fonds, rng, journee, mecanique…)
  climat: EtatClimat;
}
```

**Validations et invariants.**

- `EtatClimat` est **calculé**, jamais soumis par une routine (`motif: 'champ_calcule'`). Il se dérive de `Scenario.date`, `Country.hemisphere`, `Scenario.cycleJourNuit`, `Scenario.climatFixe` et de la graine de la partie.
- `saison` : dérivée du couple (`date`, `hemisphere`) par la table de `04-gameplay.md` §12.1, ou imposée par `climatFixe.saison`. Elle ne change pas en cours de match.
- `phase` : `journeeDansCycle < cycleJourNuit.jour ? 'jour' : 'nuit'`. Avec `{ jour: 0, nuit: 6 }` la partie entière est de nuit (nuit polaire) ; avec `{ jour: 6, nuit: 0 }` elle est entièrement de jour.
- `meteo` et `previsions` : tirées du flux `rng.branche('climat')` dans la table de probabilités (climat du pays × saison) de `04-gameplay.md` §12.4. `previsions` est **toujours** rempli de deux valeurs, y compris à la journée 1. Un `climatFixe.meteo` force les trois valeurs à la même météo.
- Rejeu : deux parties de même graine, même `Scenario.date` et même `catalogueVersion` produisent exactement la même suite de météos. C'est la raison pour laquelle `date` est figée dans le scénario et jamais relue à l'horloge.

```json
{
  "saison": "hiver",
  "phase": "nuit",
  "journeeDansCycle": 4,
  "meteo": "neige",
  "previsions": ["neige", "clair"]
}
```

---

## 14. `MissionDuJour` — la Dépêche, et le catalogue vivant

Au plus **une mission par jour réel**, courte, inspirée d'un `Event` de la liste blanche (§9), indépendante de la campagne. Le flux quotidien qui la produit est décrit par `02-architecture.md` §6.1 ; ce paragraphe fixe l'objet.

```ts
export interface MissionDuJour {
  cle: Cle;                       // 'mdj_2026_09_12'
  /** Jour réel de la Dépêche. **Unique** : au plus une mission par date. */
  date: DateIso;
  /** `Event.code` dont la mission est tirée. La source, l'URL et la catégorie
   *  restent portées par l'`Event` (§9) : la mission ne les recopie pas. */
  eventCode: Cle;
  scenarioCle: Cle;               // le Scenario produit par la routine map
  paysCode: CodePays;             // le pays où la mission se situe
  statut: Statut;
  /** `date` + 7 jours. Passée cette date, la mission quitte la Dépêche pour les
   *  archives ; elle reste jouable et n'est jamais supprimée. */
  expireLe: DateIso;
}
```

**Validations serveur.** `date` unique (contrainte d'unicité en base, pas une vérification applicative). `eventCode` désigne un `Event` de statut `valide` ou `en_ligne`, avec `valideParHumain === true` ; sans événement validé, **il n'y a pas de mission ce jour-là** — le vide vaut mieux qu'une erreur. `scenarioCle` désigne un `Scenario` dont `paysCode` est celui de la mission, dont `date` est la `date` de la mission, dont `limiteJournees` est comprise entre **10 et 15**, et dont `recompenses.flags` est **vide** : une mission du jour n'écrit aucun flag de campagne, sa récompense est cosmétique ou une carte de terrain, au plus une. `expireLe === date + 7 jours`, calculé par le serveur. Le scénario d'une mission du jour **fige sa date, son climat et son `catalogueVersion`** : c'est le seul contexte où une `UnitType` de statut `essai` est autorisée (§3).

```json
{
  "cle": "mdj_2026_09_12",
  "date": "2026-09-12",
  "eventCode": "evt_2026_09_vendee",
  "scenarioCle": "scen_mdj_2026_09_12_fr",
  "paysCode": "fr",
  "statut": "en_ligne",
  "expireLe": "2026-09-19"
}
```

**Le catalogue d'unités est versionné.** `catalogueVersion` est un entier ≥ 1, incrémenté à **chaque** changement du catalogue (homologation, passage en `essai`, retrait). Il apparaît à trois endroits, et à trois seulement :

| Où | Rôle |
|---|---|
| `Scenario.catalogueVersion` (§6) | la version dans laquelle les `CleUnite` du scénario se résolvent |
| `Sauvegarde.catalogueVersion` (ci-dessous) | la version figée par la partie, recopiée du scénario au coup d'envoi |
| `MissionDuJour` → son `Scenario` | la mission fige sa version comme n'importe quel scénario |

```ts
/** Format de sauvegarde (`02-architecture.md` §7) : une partie est ses actions. */
export interface Sauvegarde {
  scenarioCle: Cle;
  graine: string;
  catalogueVersion: number;       // figée au coup d'envoi, jamais mise à jour
  engineVersion: number;
  mapgenVersion: number;
  contentVersion: number;
  actions: unknown[];             // le journal d'actions, type du moteur
}
```

Une sauvegarde ne « migre » jamais vers une version de catalogue plus récente : un rejeu reste identique quoi qu'il arrive au catalogue ensuite. Une version de catalogue n'est ni réécrite ni supprimée ; une unité `retiree` reste résolvable par les versions qui la contenaient.

---

## 15. Campagne — `Mode`, `GabaritMission`, `Fil`, `Consequence`, `Deblocage`, `ProfilCampagne`

*Document propriétaire du sujet : `13-campagne.md`. Ce paragraphe fixe les types ; c'est `13` qui dit pourquoi ils ont ces bornes.*

### 15.1 `Mode` et `ParametresMode`

Le mode ne change **aucune règle** : il change des paramètres, et rien d'autre (`13-campagne.md` §6). Un scénario porte ses **deux** jeux de paramètres et la routine contrôle certifie **les deux**.

```ts
export const MODES = ['normal', 'difficile'] as const;
export type Mode = typeof MODES[number];

export interface ParametresMode {
  fondsDepart: number;            // joueur, multiple de 100, 0…30 000
  fondsDepartIa: number;          // chaque camp IA
  revenusParBatiment: number;     // joueur, 500…2 000
  revenusIaParBatiment: number;   // camp IA, 500…3 000
  brouillard: boolean;
  previsionJournees: number;      // profondeur du Bulletin : 0, 1 ou 2
  vitesseJauge: number;           // multiplicateur des points de jauge du joueur, 0,5…1,5
  limiteJournees: number | null;  // 5…60, ou null
  strategieIa: StrategieIa;
  reprises: number;               // reprises d'une journée : 0…5, et 0 en `difficile`
  dureeVisee: number;             // minutes, mesurées par simulation : 10…120
}

export interface ModesScenario { normal: ParametresMode; difficile: ParametresMode }
```

**Validations.** Le validateur refuse un `difficile` plus facile que le `normal` sur **chaque** axe : IA moins riche (`fondsDepartIa`, `revenusIaParBatiment`), Bulletin plus long (`previsionJournees`), jauge plus rapide (`vitesseJauge`), brouillard levé alors qu'il était imposé, limite de journées relâchée ou levée, et **toute** reprise accordée (le brief impose 0). Un « mode difficile » plus facile est le bug le plus facile à écrire et le plus difficile à voir en jouant : il est attrapé au schéma. **[Proposition]**

### 15.2 Ce que `Scenario` gagne

Trois champs, **facultatifs** pour ne pas invalider le contenu antérieur, **obligatoires** pour tout scénario de campagne produit à partir de l'étape « Campagne » du plan :

```ts
export interface Scenario extends Enveloppe {
  // …
  gabarit?: CleGabarit;    // le gabarit dont ce scénario est une instance
  dureeVisee?: number;     // minutes, mode `normal` — une mesure, pas une intention
  modes?: ModesScenario;   // absent : le scénario se joue en `normal` avec ses champs de premier niveau
}
```

`dureeVisee`, quand `modes` est présent, doit **égaler** `modes.normal.dureeVisee` : une seule vérité, et elle est celle du mode par défaut.

### 15.2 bis `Incarnation` — jouer une nation alliée

Le brief (« Le joueur et le départ ») ajoute un quatrième champ facultatif : une nation alliée ne se contente pas d'aider, le joueur peut **la jouer entièrement**.

```ts
export interface Incarnation {
  paysCode: CodePays;      // la nation jouée : une `alliee` du profil, jamais celle du joueur
  commandantCle: Cle;      // son général, forme `cmd_<prenom>_<nom>`
}

export interface Scenario extends Enveloppe {
  // …
  incarnation?: Incarnation;   // présent : ce match est un match d'incarnation
}
```

Le camp du joueur prend alors **le général de cette nation** (ses pouvoirs, sa jauge), **son catalogue** (unité spéciale comprise), sa **spécialité** et son **style visuel** ; le commandant d'origine du joueur reste au banc en **co-commandant passif** (`04-gameplay.md` §7.5), de sorte que le lien avec sa campagne ne se perd jamais.

**Trois bornes, et où chacune est tenue.**

| Borne | Tenue par |
|---|---|
| **Aucun flag de la trame principale.** Un match d'incarnation n'écrit que `pays.<nation incarnée>.*` et `cmd.*` — jamais `monde.*` | Le **schéma** : `validerScenario` refuse un `monde.*` et un `pays.*` étranger, en récompense comme dans une option de `choix` |
| **La nation incarnée ne se retire pas pendant qu'on la joue** | Le **contenu** : un match d'incarnation ne peut pas poser le second grief d'un retrait, puisqu'il n'écrit rien qui le compte (`08-narration-choix.md` §4.5) — et la colonne vertébrale ne place aucune scène de retrait dans un fil d'incarnation (`13-campagne.md` §3.4) |
| **Incarner est proposé, jamais imposé**, sauf à l'acte III où le joueur choisit parmi ses alliées | Le **contenu** : un scénario d'incarnation est toujours une variante offerte d'une étape, jamais l'unique chemin — sauf à l'acte III, où la variante *est* le choix |

**Ce que l'incarnation fait monter.** La **confiance** du général incarné, rangée dans `ProfilCampagne.confiance` (§15.9) et lisible par une `Condition` (§15.5) :

```ts
export const CONFIANCE_MAX = 3;
export type NiveauConfiance = 0 | 1 | 2 | 3;
```

Un seul palier compte, `CONFIANCE_MAX` : le général y devient co-commandant à jauge entière (`04-gameplay.md` §7.5) et sa nation s'ouvre comme départ de Nouvelle Ronde (§15.6). Les niveaux 1 et 2 n'ouvrent que des dialogues — une échelle de puissance à quatre crans serait une seconde monnaie à équilibrer.

**Le catalogue n'est pas dans le scénario.** `catalogueVersion` fige la version, pas le contenu : c'est l'appelant — le serveur ou la page — qui passe à `creerPartie` le catalogue de la nation incarnée. Le moteur ne charge rien de lui-même (`02-architecture.md` §3.1), il compose le camp du joueur avec le général que `sceneDepuis` y place. **[Proposition]**

### 15.3 `GabaritMission`

Neuf gabarits, liste fermée, publiés en `content/gabarits-missions.json`. C'est le contrat entre la routine lore (qui habille), la routine map (qui produit une carte dans les bornes) et la routine contrôle (qui vérifie la durée simulée).

```ts
export const CLES_GABARIT = [
  'capture_qg', 'tenir', 'escorte', 'relais', 'course',
  'survie', 'siege', 'revanche', 'exhibition',
] as const;
export type CleGabarit = typeof CLES_GABARIT[number];

export interface GabaritMission {
  cle: CleGabarit;
  nom: string;
  intention: string;                     // ≤ 240 signes
  victoire: TypeObjectifVictoire[];      // types autorisés, 1 à 4
  defaite: TypeObjectifDefaite[];        // 1 à 4
  dureeVisee: { min: number; max: number };  // minutes, 10…120
  journees: { min: number; max: number };    // 5…60
  cote: { min: number; max: number };        // plus grand côté de carte, 6…40
  brouillardConseille: boolean;
  hooksNarratifs: string[];              // 2 à 6
  interdit: string;                      // ce que le gabarit refuse, en une phrase
}
export interface CatalogueGabarits { gabarits: GabaritMission[] }
```

**Validations.** Toute fenêtre `{min, max}` est non vide. Le gabarit `survie` porte l'objectif `survivre`, `escorte` porte `proteger`, et `exhibition` ne dépasse pas quinze journées (`01-bible.md` §4.7). `validerCatalogueGabaritsComplet` exige en plus que les neuf clés canon soient toutes présentes.

### 15.3 bis `RelationNation` — l'état d'une nation vis-à-vis du joueur

Le brief révisé du 5 septembre 2026 au soir change la nature des vingt-quatre fiches pays : **tout le monde part de France**, et les nations ne sont plus un menu de départ mais des **relations** qui évoluent pendant la partie, puis des **départs débloqués** pour une Nouvelle Ronde.

```ts
export const RELATIONS_NATION = ['neutre', 'alliee', 'rivale', 'retiree'] as const;
export type RelationNation = typeof RELATIONS_NATION[number];

export const BORNES_RELATIONS = {
  retireesMax: 5,        // invariant de schéma
  allieesGaranties: 2,   // garantie de contenu, pas de schéma
} as const;

export const RELATIONS_CONSEQUENCE = ['alliee', 'rivale'] as const;  // ce qu'un fil peut poser
```

| État | Ce qu'il apporte au joueur |
|---|---|
| `neutre` | Rien. C'est l'état par défaut : une nation absente de `relations` est neutre, comme un compteur absent vaut zéro |
| `alliee` | Son commandant recrutable en co-commandant, son **unité spéciale produisible** (quantité bornée par match), sa carte de terrain, son **soutien à l'acte III**, et son **déblocage comme pays de départ** de la prochaine Nouvelle Ronde |
| `rivale` | Un grief : IA plus dure, dialogue de revanche, et la possibilité que sa destination se ferme |
| `retiree` | Elle a quitté la Ronde à cause du joueur : destination fermée, territoire grisé, absence à l'acte III ou passage à la Cinquième Manche |

**Les deux bornes, et où chacune est tenue.** `retireesMax: 5` est un **invariant de schéma**, refusé par `validerProfilCampagne` : au-delà, une fin devient inaccessible, et le brief l'interdit. `allieesGaranties: 2` est une garantie de **contenu**, portée par la colonne vertébrale (`13-campagne.md` §3.4) — un profil au premier match n'a légitimement aucune alliée, le schéma ne peut donc pas l'exiger sans refuser tous les débuts de partie. **[Proposition]**

**Qui calcule.** La relation est **dérivée** des flags (respect, grief, choix de scène, sponsor, fair-play) par le moteur ou le serveur, et écrite dans `ProfilCampagne.relations` — **jamais par le rendu**, exactement comme un déblocage (§15.5).

### 15.4 `Consequence` — la liste fermée

Ce qu'un fil peut changer dans la campagne principale. **Union fermée**, avec des paramètres bornés : au-delà, un joueur qui fait tous les fils arrive à la finale avec une campagne qu'on n'a pas équilibrée.

```ts
export type Consequence =
  | { type: 'variante_dialogue'; scenarioCle: Cle; varianteCle: Cle }
  | { type: 'co_commandant'; commandantCle: Cle }              // forme `cmd_<prenom>_<nom>`
  | { type: 'unite_offerte'; uniteCle: CleUnite; combien: number }   // 1 à 2
  | { type: 'trace_carte'; paysCode: CodePays; flagTrace: Cle }      // flagTrace ∈ pays.<paysCode>.*
  | { type: 'remise_production'; uniteCle: CleUnite; remise: number } // 0,80 à 0,95
  | { type: 'objectif_alternatif'; scenarioCle: Cle; objectif: ObjectifVictoire }
  | { type: 'allie_acte_iii'; paysCode: CodePays }
  | { type: 'entree_carnet'; carnetCle: Cle }
  | { type: 'deblocage'; deblocageCle: Cle }
  | { type: 'relation_nation'; paysCode: CodePays; relation: RelationConsequence };
```

Les bornes numériques sont publiées comme données (`BORNES_CONSEQUENCE`), pour que le validateur et la documentation ne puissent pas diverger.

**`relation_nation` est bornée par son type**, et c'est délibéré : `RelationConsequence` ne vaut que `alliee` ou `rivale`. Un fil **rallie ou fâche** ; il ne **retire** jamais une nation de la Ronde — un retrait est la conséquence d'un choix de la campagne principale, pas d'un contenu facultatif — et il ne remet jamais une relation à `neutre`, ce qui serait une conséquence qui ne change rien. Le validateur refuse les deux, et la routine lore ne peut donc pas produire un fil qui vide la carte du monde. **[Proposition]**

### 15.5 `Condition` — composable, évaluée par le moteur

```ts
export type Condition =
  | { type: 'flag'; cle: Cle }                        // un booléen posé
  | { type: 'compteur'; cle: Cle; min: number }       // compteur ≥ min ; absent = 0
  | { type: 'mode_fini'; mode: Mode }                 // avoir fini, pas avoir joué
  | { type: 'date'; du?: DateIso; au?: DateIso }      // au moins une borne, bornes incluses
  | { type: 'pays_visite'; pays: CodePays[]; combien: number }
  | { type: 'secret'; cle: Cle }                      // un easter egg de `doc/14-secrets.md`
  | { type: 'relation'; pays: CodePays[]; relation: RelationNation; combien: number }
  | { type: 'confiance'; commandantCle: Cle; min: NiveauConfiance }  // 1 à 3 ; absent = 0
  | { type: 'et'; conditions: Condition[] }           // 2 à 4
  | { type: 'ou'; conditions: Condition[] };          // 2 à 4
```

**`confiance` a exactement la forme de `compteur`**, parce qu'elle est un compteur : la confiance d'un général envers le joueur, de 0 à `CONFIANCE_MAX` (3), montée en **incarnant** sa nation (§15.2 bis). Un général absent de `ProfilCampagne.confiance` est à 0 — l'oubli et l'indifférence sont le même état. Le `min` vaut 1 à 3 : exiger 0 serait une condition toujours vraie, exiger 4 une condition inatteignable, et les deux sont refusées.

**`relation` a exactement la forme de `pays_visite`**, parce qu'elle répond à la même famille de questions : « le Japon est-il allié » (`pays: ['jp'], combien: 1`) et « ai-je au moins deux alliées » (une liste, `combien: 2`) s'écrivent avec un seul type. Une nation absente de `ProfilCampagne.relations` est `neutre` — l'oubli et la neutralité sont le même état. Comme pour `pays_visite`, exiger plus de nations qu'on n'en liste est refusé : une condition inatteignable est un bug. **[Proposition]**

**Profondeur bornée à trois** (`PROFONDEUR_CONDITION_MAX`). Une condition `date` sans borne, une fenêtre de dates vide, ou un `pays_visite` qui exige plus de pays qu'il n'en liste sont refusés : une condition inatteignable est un bug, pas une difficulté.

**Qui évalue.** `src/engine/deblocages.ts`, code pur qui n'importe que `schemas/` : `evaluerCondition(condition, profil, contexte)`, `deblocagesAcquis`, `deblocagesNouveaux`, `commandantJouable`. La date du jour arrive par `ContexteDeblocage.aujourdhui` — **le moteur ne lit jamais l'horloge**. Une condition d'un type inconnu est *fausse*, jamais une exception.

### 15.6 `Deblocage`

```ts
export const TYPES_RECOMPENSE_DEBLOCAGE = [
  'general_secret', 'carte', 'carte_terrain', 'skin_style', 'fil', 'mode',
  'entree_carnet', 'depart_nation',
] as const;

export interface Deblocage {
  cle: Cle;
  libelle: string;                // ≤ 80 signes
  condition: Condition;
  recompense: { type: TypeRecompenseDeblocage; ref: Cle };
  cache: boolean;                 // l'existence même du déblocage est-elle une surprise
}
```

Une récompense `general_secret` référence un `Commander.code` (forme `cmd_<prenom>_<nom>`) ; une récompense `mode` référence un `Mode` ; une récompense **`depart_nation` référence un `CodePays`**, jamais une `Cle`. C'est la porte de la **Nouvelle Ronde** : une nation devenue alliée pendant une partie s'ouvre comme pays de départ de la suivante, et l'unique déblocage type s'écrit `{ condition: { type: 'relation', pays: ['jp'], relation: 'alliee', combien: 1 }, recompense: { type: 'depart_nation', ref: 'jp' } }`. **[Proposition]**

**Une confiance de 3 ouvre la même porte.** Rallier et **incarner** sont deux chemins vers un départ, et un `ou` les réunit sans mécanisme nouveau : `{ type: 'ou', conditions: [{ type: 'relation', pays: ['ch'], relation: 'alliee', combien: 1 }, { type: 'confiance', commandantCle: 'cmd_elsbeth_vonlanthen', min: 3 }] }`. C'est la seule chose que la confiance débloque au niveau du schéma ; le co-commandant à jauge entière, lui, est une règle de jeu (`04-gameplay.md` §7.5). **[Proposition]**

### 15.7 `Commander` gagne `secret` et `deblocage`

```ts
secret?: boolean;      // absent de l'écran de sélection tant que le déblocage n'est pas acquis
deblocage?: Cle;       // la clé du `Deblocage` qui l'ouvre
```

Les deux champs vont **ensemble** : un commandant qui porte un `deblocage` sans `secret: true` est refusé, et un `secret: true` sans `deblocage` l'est aussi — ce serait un commandant injouable à jamais. **[Proposition]**

### 15.8 `Fil`

```ts
export interface EtapeFil {
  ordre: number;          // 1 à 8, strictement consécutifs, sans trou
  scenarioCle: Cle;
  gabarit: CleGabarit;    // jamais `exhibition`
  dureeVisee: number;     // minutes
  titre: string;
}

export interface Fil extends Enveloppe {
  code: Cle;
  titre: string;
  arc: string;            // 80 à 900 signes
  accroche: string;       // ≤ 160 signes
  paysCode?: CodePays;    // pays d'ancrage, quand le fil en a un
  acteMin: number;        // 0 à 3
  missions: EtapeFil[];   // 3 à 8, sans doublon de scénario
  deblocage: Condition;
  consequences: Consequence[];  // 1 à 4, sans doublon
  flagsEcrits: Cle[];     // 1 à 8, tous connus de `01-bible.md` §8
}
```

**Validations propres au `Fil`.** Le gabarit `exhibition` est refusé : c'est celui de la Dépêche, et une Dépêche n'écrit aucun flag de campagne. Un flag `monde.depeche.*` est refusé dans `flagsEcrits` (étanchéité de la Dépêche, `08-narration-choix.md` §4.4) ; un flag `monde.secret.*` aussi (un secret est posé par un easter egg codé à la main, jamais par du contenu). Un fil ancré dans un pays n'écrit que `pays.<son pays>.*`. Un fil sans conséquence est refusé : ce serait une suite de matchs, pas un fil. **[Proposition]**

### 15.9 `ProfilCampagne` — la sauvegarde de campagne

```ts
export interface ProfilCampagne {
  cle: Cle;
  paysDepart: CodePays;
  mode: Mode;
  flags: EtatFlags;               // booléens, compteurs, journal des décisions
  deblocages: Cle[];
  filsEnCours: { filCle: Cle; etape: number }[];
  filsFinis: Cle[];
  scenariosFinis: Cle[];
  secretsTrouves: Cle[];          // noms courts ; la forme longue est `monde.secret.<nom>`
  paysVisites: CodePays[];
  modesFinis: Mode[];
  relations: Record<CodePays, RelationNation>;  // absent = neutre ; jamais `paysDepart`
  confiance: Record<Cle, NiveauConfiance>;      // par général, 0 à 3 ; absent = 0
  serieDepeches: number;          // hors flags de campagne, par construction
  catalogueVersion: number;
  chainesVersion: number;
  creeLe: DateIso;
  majLe: DateIso;
}
```

**Validations.** Un booléen posé vaut `true` et jamais `false` : on ne défait pas une décision (`08-narration-choix.md` §2.1). Un fil ne peut pas être à la fois dans `filsEnCours` et dans `filsFinis`. Les listes sont sans doublon. `serieDepeches` est un champ **à part**, hors de `flags` : c'est le type qui protège l'étanchéité de la Dépêche, pas la discipline.

**Validations propres à `confiance`.** Une clé qui est un **code de commandant** (`cmd_<prenom>_<nom>`, jamais un code pays : la confiance se gagne auprès d'un général, pas d'une administration), une valeur entière de 0 à `CONFIANCE_MAX`. Un général absent est à 0, ce qui rend l'objet vide parfaitement valide au premier match. Le champ est **calculé** comme `relations` : il monte quand le joueur incarne la nation du général (§15.2 bis), jamais par une écriture du rendu. **[Proposition]**

**Validations propres à `relations`.** Vingt-quatre entrées au plus, une clé qui est un `CodePays`, une valeur qui est une `RelationNation`, **au plus cinq `retiree`** (`BORNES_RELATIONS.retireesMax`) — la borne anti-blocage du brief, tenue par le type et non par la bonne volonté d'une routine — et **jamais `paysDepart`** : la nation que le joueur représente n'est pas une relation, c'est lui. Une nation absente est `neutre`, ce qui rend le champ vide parfaitement valide au premier match. **[Proposition]**

Le profil ne porte **jamais** l'état d'une partie en cours : celui-ci est une `Sauvegarde` (§14), qui est ses actions et les versions qu'elle a figées. Les deux ne se mélangent pas — c'est ce qui permet d'abandonner un match sans perdre une campagne.

---

## 16. Récapitulatif des propositions hors brief

| # | Proposition | Où |
|---|---|---|
| 1 | Clés et énumérations en français sans accent | §0 |
| 2 | Refus des clés inconnues comme règle générale | §0 |
| 3 | Contraste minimal 3:1 dans la palette d'un pays | §1 |
| 4 | « Poids » borné d'un pouvoir, faiblesse obligatoire et réellement défavorable | §2 |
| 5 | Invariant « indirect ⇒ pas de riposte ni de tir après mouvement » inscrit dans le schéma | §3 |
| 6 | Absence de coût = infranchissable (pas de coût infini) | §4 |
| 7 | Regénération systématique des cartes soumises pour vérifier la reproductibilité | §5 |
| 8 | Refus des choix dont les options écrivent les mêmes flags | §6 |
| 9 | Symétrie obligatoire des exclusions de flags, refus des flags sans impact | §8 |
| 10 | Liste blanche de **domaines** en plus de la liste blanche de catégories | §9 |
| 11 | Une affirmation par entrée de mémoire, plafond de 200 entrées par portée | §10 |
| 12 | Retour arrière de prompt = nouvelle version, jamais un écrasement | §11 |
| 13 | Verrou optimiste sur la version révisée, et seuils recalculés côté serveur | §12 |
| 14 | Durée en journées `n = 3` et pose de terrain permanente réservées au super pouvoir | §2 |
| 15 | `taille` de silhouette bornée par le coût ; silhouette strictement unique par unité active | §3 |
| 16 | `CibleReview` gagne `unite`, et `ReviewVerdict.stats` accepte la forme `{ avec, sans }` pour un verdict d'unité | §12 |
| 16 bis | `MotifRejet` gagne `injouable_sous_meteo` et `nuit_bloquante` (proposés par `05-routines.md` §4.3) | §12 |
| 16 ter | `UnitType.subitDegats` : la colonne de dégâts d'une unité non `canon`, obligatoire et complète | §3 |
| 17 | `StatsSimulation.climat` : une ligne de statistiques par case de la matrice climatique | §12 |
| 18 | `EtatClimat` est un champ calculé, jamais soumis par une routine | §13 |
| 19 | Une mission du jour n'écrit aucun flag de campagne (`recompenses.flags` vide) | §14 |
| 20 | Cohérence exigée entre `TraitSpecialite` et la `famille` de la spécialité | §1 |
| 21 | `gelable` est un **paramètre commun** offert à toute mécanique régionale, pas un champ propre au Grand Est | §7 |
| 22 | `Mode`, `ParametresMode` et l'invariant « un `difficile` n'est jamais plus facile qu'un `normal` » | §15.1 |
| 23 | `Scenario.gabarit`, `.dureeVisee` et `.modes`, facultatifs au schéma, obligatoires pour la campagne | §15.2 |
| 24 | Les neuf `GabaritMission` et leurs fenêtres de durée, de journées et de côté de carte | §15.3 |
| 25 | Les bornes numériques de `Consequence` publiées comme données (`BORNES_CONSEQUENCE`) | §15.4 |
| 26 | `Condition` composable à profondeur bornée, évaluée sans horloge, fausse par défaut sur un type inconnu | §15.5 |
| 27 | `Commander.secret` et `Commander.deblocage` obligatoirement solidaires | §15.7 |
| 28 | `Fil` : gabarit `exhibition` interdit, flags de Dépêche et de secret interdits, au moins une conséquence | §15.8 |
| 29 | `ProfilCampagne`, et `serieDepeches` en champ propre pour protéger l'étanchéité de la Dépêche par le type | §15.9 |
| 30 | `RelationNation`, ses quatre états et le partage des deux bornes : `retireesMax` tenue par le schéma, `allieesGaranties` tenue par le contenu | §15.3 bis |
| 31 | `relation_nation` bornée par son type à `alliee \| rivale` : un fil rallie ou fâche, il ne retire jamais une nation | §15.4 |
| 32 | La condition `relation`, calquée sur `pays_visite`, et la récompense `depart_nation` qui ouvre une Nouvelle Ronde | §15.5, §15.6 |
| 33 | `ProfilCampagne.relations` : au plus cinq `retiree`, jamais `paysDepart`, absent = `neutre` | §15.9 |
| 34 | `Scenario.incarnation` : le général incarné au camp 0, et aucun flag de la trame principale — ni en récompense, ni dans un choix | §15.2 bis |
| 35 | La condition `confiance`, calquée sur `compteur`, et le second chemin vers `depart_nation` | §15.5, §15.6 |
| 36 | `ProfilCampagne.confiance` : 0 à `CONFIANCE_MAX` par général, clé de commandant, absent = 0 | §15.9 |
