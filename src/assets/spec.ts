/**
 * `AssetSpec` — le contrat que le dépôt écrit et que le générateur externe lit.
 *
 * Un `AssetSpec` est **le JSON qu'on donne à ChatGPT 6 Astra** pour qu'il produise
 * un modèle ou une texture (`BRIEF.md`, « Direction artistique », révision 3D du
 * 5 septembre 2026). Il dit tout ce qui doit être vrai du fichier rendu : ce qu'il
 * représente, à quelle échelle, avec quel budget, quelles cartes de textures,
 * quelles variantes, quelles animations, sous quel nom, et ce qui est interdit.
 *
 * Document propriétaire : `doc/11-assets-spec.md`. Ce fichier n'importe que
 * `schemas/` (`doc/02-architecture.md` §5, `tests/frontieres.test.ts`).
 *
 * Deux principes tiennent tout le format :
 *
 * 1. **La description est bilingue.** Le générateur lit l'anglais ; les humains du
 *    projet relisent le français. Les deux disent la même chose, et c'est la
 *    version française qui fait foi en cas de désaccord.
 * 2. **Tout champ est vérifiable.** Rien n'entre dans le format qui ne puisse être
 *    contrôlé sur le fichier rendu par `valider-gltf.ts` : l'échelle se mesure sur
 *    l'AABB, le budget se compte, le masque d'équipe et les animations se lisent
 *    dans le document glTF. Un champ décoratif serait un champ que personne
 *    n'applique.
 */

import { REGEX_CLE, type Biome, type Cle, type CodePays, type Couleur, type Palette, type Saison } from '../schemas/types';

// ---------------------------------------------------------------------------
// 1. Énumérations
// ---------------------------------------------------------------------------

/**
 * Les sept familles d'assets 3D du jeu. `kit` est arrivé avec l'arbitrage du
 * 5 septembre 2026 au soir (« Pas un simple masque de couleur ») : une unité de
 * base est **une géométrie partagée** (`unite`) et autant de **kits nationaux**
 * (`kit`) qu'il y a de nations, chacun portant ses textures complètes, ses
 * ornements et son gabarit.
 */
export const TYPES_ASSET = ['unite', 'kit', 'terrain', 'batiment', 'decor', 'commandant', 'effet'] as const;
/** Famille d'un asset : décide des textures, animations et contrôles par défaut. */
export type TypeAsset = typeof TYPES_ASSET[number];

/** Ordre de production d'un asset : 1 = France et ses premiers adversaires. */
export const PRIORITES = [1, 2, 3] as const;
/** Priorité d'un asset dans la file du générateur externe. */
export type Priorite = typeof PRIORITES[number];

/** Canaux de texture demandés au générateur, dans l'ordre de lecture d'un matériau PBR. */
export const CANAUX_TEXTURE = [
  'albedo', 'normale', 'rugosite', 'metal', 'emission', 'occlusion', 'masque_equipe',
] as const;
/** Canal d'une carte de texture. */
export type CanalTexture = typeof CANAUX_TEXTURE[number];

/** Résolutions admises : puissances de deux, 2048 au plus (budget mémoire mobile). */
export const RESOLUTIONS_TEXTURE = [256, 512, 1024, 2048] as const;
/** Résolution d'une carte de texture, en pixels de côté. */
export type ResolutionTexture = typeof RESOLUTIONS_TEXTURE[number];

/** Formats de livraison d'une texture : PNG pour la relecture, KTX2 pour le jeu. */
export const FORMATS_TEXTURE = ['png', 'ktx2'] as const;
/** Format de fichier d'une carte de texture. */
export type FormatTexture = typeof FORMATS_TEXTURE[number];

/** Les six clips d'animation nommés du projet. Liste fermée. */
export const CLIPS_ANIMATION = [
  'repos', 'deplacement', 'tir', 'touche', 'hors_jeu', 'capture',
] as const;
/** Nom canonique d'un clip d'animation. */
export type ClipAnimation = typeof CLIPS_ANIMATION[number];

/** Niveaux de détail attendus. */
export const NIVEAUX_LOD = [0, 1, 2] as const;
/** Niveau de détail : 0 est le modèle plein, 2 le plus léger. */
export type NiveauLod = typeof NIVEAUX_LOD[number];

/**
 * Ce qu'un asset n'a **jamais** le droit de contenir. La liste est fermée et
 * recopiée telle quelle dans chaque spécification : le générateur doit la lire à
 * chaque asset, pas une fois pour toutes.
 */
export const INTERDITS = [
  'symboles_reels', 'drapeaux_reels', 'texte_lisible', 'sang',
  'marques_deposees', 'personnes_reelles', 'violence_explicite',
] as const;
/** Un interdit de la charte de sensibilité (`doc/01-bible.md` §5 et §7). */
export type Interdit = typeof INTERDITS[number];

/** Les quatre interdits que toute spécification doit porter, sans exception. */
export const INTERDITS_OBLIGATOIRES: readonly Interdit[] = [
  'symboles_reels', 'drapeaux_reels', 'texte_lisible', 'sang',
];

/** Les contrôles que le validateur de GLB sait exécuter. */
export const CONTROLES = [
  'format', 'noeuds', 'materiaux', 'echelle', 'budget', 'masque_equipe', 'animations', 'textures',
] as const;
/** Un contrôle demandé sur le fichier rendu. */
export type Controle = typeof CONTROLES[number];

/**
 * Codes de refus d'un asset. Les cinq premiers sont ceux du brief ; l'absence
 * d'un nœud ou d'un matériau attendu est un défaut de **format** (le fichier ne
 * respecte pas les conventions imposées), avec le nom manquant dans `detail`.
 */
export const CODES_MOTIF_ASSET = [
  'asset_format', 'asset_echelle', 'asset_budget', 'asset_masque_absent',
  'asset_animation_absente', 'asset_texture_absente',
] as const;
/** Code de refus d'un asset. */
export type CodeMotifAsset = typeof CODES_MOTIF_ASSET[number];

// ---------------------------------------------------------------------------
// 1 bis. Le vocabulaire du style : listes fermées, jamais du texte libre
// ---------------------------------------------------------------------------

/**
 * Les matières admises dans un style. Liste **fermée** : une matière absente
 * d'ici n'existe pas, exactement comme un trait d'unité (`BRIEF.md`, arbitrage
 * n° 8). C'est ce qui permet au générateur externe de recevoir toujours le même
 * vocabulaire, et au dépôt de refuser « métal spatial brossé » sans discussion.
 */
export const MATIERES_STYLE = [
  'peinture_mate', 'peinture_satinee', 'peinture_brillante', 'camouflage',
  'acier_brosse', 'acier_peint', 'aluminium', 'laiton', 'cuivre', 'fonte',
  'bois', 'bois_verni', 'bambou', 'rotin', 'osier', 'corde',
  'toile', 'toile_ciree', 'feutre', 'cuir', 'caoutchouc',
  'ceramique', 'terre_cuite', 'tuile', 'ardoise', 'pierre_seche', 'beton',
  'tole_ondulee', 'verre', 'email',
] as const;
/** Une matière de style. */
export type MatiereStyle = typeof MATIERES_STYLE[number];

/** Les finitions admises : comment la matière prend la lumière. */
export const FINITIONS_STYLE = [
  'mate', 'satinee', 'brillante', 'brossee', 'martelee', 'patinee', 'sablee',
  'vernie', 'ciree', 'huilee', 'laquee', 'blanchie', 'oxydee',
  'poudree_de_sel', 'poussieree', 'delavee',
] as const;
/** Une finition de style. */
export type FinitionStyle = typeof FINITIONS_STYLE[number];

/**
 * Les ornements admis. Liste fermée, et **deux à quatre par nation** : au-delà,
 * le modèle se charge, la silhouette se brouille et la lecture à trente pixels
 * est perdue (`doc/10-rendu-3d.md` §2).
 */
export const ORNEMENTS_STYLE = [
  'antenne', 'sacoche', 'filet', 'banniere', 'lanterne', 'toit_toile', 'panneau',
  'jerrican', 'roue_de_secours', 'pare_soleil', 'fanion', 'chaines',
  'galerie_de_toit', 'bache_roulee', 'guirlande', 'echelle', 'treuil', 'pelle',
  'bidon', 'tapis', 'cloche', 'plaque_de_desensablement', 'brise_vent',
  'corde_lovee', 'planche_de_secours', 'moustiquaire', 'gourde', 'brosse',
  'porte_skis', 'ancre_de_sable',
] as const;
/** Un ornement de style. */
export type OrnementStyle = typeof ORNEMENTS_STYLE[number];

/** Les trois variantes de forme d'une unité de base. */
export const GABARITS = ['a', 'b', 'c'] as const;
/** Gabarit retenu par une nation pour une unité de base. */
export type Gabarit = typeof GABARITS[number];

/** Où se pose une décalcomanie sur un engin. */
export const PLACEMENTS_DECALCOMANIE = [
  'flanc', 'capot', 'toit', 'tourelle', 'socle', 'arriere', 'portiere', 'jupe',
  'nez', 'cabine', 'epaule',
] as const;
/** Placement d'une décalcomanie. */
export type PlacementDecalcomanie = typeof PLACEMENTS_DECALCOMANIE[number];

/**
 * Les motifs géométriques de lisibilité sans couleur. **Un par nation, jamais
 * deux fois le même** : c'est ce qui distingue deux équipes pour un joueur
 * daltonien, et c'est aussi ce qui sauve une capture d'écran en noir et blanc.
 */
export const MOTIFS_DALTONIENS = [
  'rayures_obliques', 'rayures_verticales', 'rayures_horizontales', 'chevrons',
  'damier', 'pois', 'triangles', 'losanges', 'vagues', 'croisillons', 'ecailles',
  'hachures', 'anneaux', 'zigzag', 'croix_diagonale', 'dents_de_scie', 'spirale',
  'grille', 'arcs', 'demi_lunes', 'etoiles_quatre_branches', 'carres_emboites',
  'bandes_pointillees', 'fleche_repetee', 'nid_dabeille', 'plumes',
] as const;
/** Motif de lisibilité sans couleur, propre à une nation. */
export type MotifDaltonien = typeof MOTIFS_DALTONIENS[number];

/** Les formes de toiture admises pour le style régional d'un bâtiment. */
export const FORMES_TOIT = [
  'deux_pans', 'quatre_pans', 'croupe', 'plat', 'terrasse', 'shed',
  'pente_douce', 'mansarde', 'voute', 'chaume', 'tole', 'coupole',
] as const;
/** Forme de toiture d'un style régional. */
export type FormeToit = typeof FORMES_TOIT[number];

/** Les éléments de décor admis dans un style régional. Liste fermée. */
export const ELEMENTS_DECOR_REGION = [
  'muret_de_pierre', 'haie_vive', 'rangee_de_vigne', 'sechoir', 'lavoir',
  'pigeonnier', 'cabane_sur_pilotis', 'four_a_pain', 'moulin', 'cypres_en_rideau',
  'palmier_en_alignement', 'canne_a_sucre', 'bosquet_de_bambous', 'filets_de_peche',
  'casiers_empiles', 'banc_de_pierre', 'croix_de_chemin', 'terrasse_en_escalier',
  'mangrove', 'ponton_de_bois', 'ruche', 'abri_de_berger', 'panneau_de_bois',
  'jardin_de_balisiers', 'alignement_de_pins', 'roseliere', 'alignement_de_pierres',
  'terril', 'pylone_de_telepherique', 'kiosque',
] as const;
/** Un élément de décor régional. */
export type ElementDecorRegion = typeof ELEMENTS_DECOR_REGION[number];

// ---------------------------------------------------------------------------
// 2. Sous-structures
// ---------------------------------------------------------------------------

/** Une description dans les deux langues du pipeline. */
export interface Bilingue {
  /** Anglais : ce que le générateur lit réellement. */
  en: string;
  /** Français : la version qui fait foi pour les humains du projet. */
  fr: string;
}

/** Le style : à quoi l'asset doit ressembler, et à quoi il ne doit pas ressembler. */
export interface StyleAsset {
  /** Document et section qui font foi sur le ton. */
  reference: string;
  /** La devise du projet, recopiée dans chaque spécification. */
  devise: string;
  /** Ce que les matières doivent être, en français. */
  matieres: string;
  /** Mots-clés de style, **en anglais** : ils entrent dans l'invite du générateur. */
  motsCles: string[];
  /** Ce qu'il ne faut pas produire, **en anglais**. */
  aEviter: string[];
}

/** Une dimension cible et sa tolérance, en mètres de scène. */
export interface Dimension {
  /** Valeur visée, en mètres. */
  cible: number;
  /** Écart absolu accepté, en mètres. */
  tolerance: number;
}

/**
 * L'échelle. **Une case de la grille vaut un mètre de scène** : c'est la seule
 * conversion du projet, et elle ne bouge jamais. Les axes sont ceux de glTF :
 * `x` latéral, `y` vertical, `z` vers l'avant de l'objet.
 */
export interface Echelle {
  /** Toujours 1 : une case = 1 m. Le champ existe pour être relu, pas pour varier. */
  caseEnMetres: number;
  x: Dimension;
  y: Dimension;
  z: Dimension;
}

/** Le pivot : où est l'origine du modèle et vers où il regarde. */
export interface Pivot {
  /** Origine au centre de l'emprise au sol. */
  origine: 'centre_au_sol';
  /** L'avant de l'objet regarde `+Z`. */
  avant: '+z';
  /** Le haut est `+Y` (convention glTF). */
  haut: '+y';
  /**
   * Vrai si la géométrie touche le sol (`min.y ≈ 0`). Faux pour ce qui vole :
   * l'hélicoptère est modélisé à sa hauteur de vol, le rendu ne le soulève pas.
   */
  poseAuSol: boolean;
}

/** Le budget de géométrie, en triangles, par niveau de détail. */
export interface Budget {
  lod0: number;
  lod1: number;
  lod2: number;
  /** Nombre de matériaux distincts admis dans le fichier. */
  materiauxMax: number;
}

/** Une carte de texture demandée. */
export interface TextureSpec {
  canal: CanalTexture;
  resolution: ResolutionTexture;
  format: FormatTexture;
  /** Faux pour une carte facultative : son absence ne fait pas refuser l'asset. */
  obligatoire: boolean;
  /** À quoi sert cette carte, en français. */
  note: string;
}

/** Les déclinaisons attendues du même asset. */
export interface Variantes {
  /** Saisons qui demandent un jeu de textures propre. Vide = pas de variante. */
  saisons: Saison[];
  /** Biomes qui demandent une déclinaison. Vide = l'asset est neutre. */
  biomes: Biome[];
  /** Nations qui demandent un modèle propre (unité spéciale). Presque toujours vide. */
  nations: CodePays[];
}

/** Un clip d'animation attendu. */
export interface AnimationSpec {
  nom: ClipAnimation;
  /** Durée du clip en millisecondes. */
  dureeMs: number;
  /** Vrai si le clip boucle sans couture. */
  boucle: boolean;
  /** Faux pour un clip souhaitable mais non bloquant. */
  obligatoire: boolean;
}

/** Le format de sortie, imposé et non négociable. */
export interface FormatAsset {
  conteneur: 'glb';
  versionGltf: '2.0';
  axeHaut: 'y';
  unite: 'metre';
  materiaux: 'pbr_metallic_roughness';
  /** Nom du nœud racine, présent dans `noeuds`. */
  noeudRacine: string;
  /** Noms de nœuds imposés : le rendu les cherche par leur nom, jamais par leur index. */
  noeuds: string[];
  /** Noms de matériaux imposés. */
  materiauxAttendus: string[];
}

/** Les conventions de nommage des fichiers livrés. */
export interface Nommage {
  /** Gabarit du modèle : `{id}` et `{lod}` sont substitués. */
  modele: string;
  /** Gabarit d'une texture : `{id}`, `{canal}`, `{variante}` et `{ext}` sont substitués. */
  texture: string;
  /** Noms complets, écrits en toutes lettres, pour lever toute ambiguïté. */
  exemples: string[];
}

/** Ce que le validateur contrôlera sur le fichier rendu. */
export interface Verification {
  controles: Controle[];
  /**
   * Tolérance **relative** sur l'AABB, en plus de la tolérance absolue de chaque
   * dimension : l'écart accepté est le plus grand des deux.
   */
  toleranceAabb: number;
  /** Niveaux de détail exigés à la livraison ; contient toujours 0. */
  lodRequis: NiveauLod[];
}

// ---------------------------------------------------------------------------
// 3. La spécification
// ---------------------------------------------------------------------------

/**
 * Une spécification d'asset : le contrat complet d'un modèle ou d'un jeu de
 * textures. Un fichier `assets/specs/<id>.json` par asset, produit par
 * `scripts/generer-specs-assets.ts` depuis le canon.
 */
export interface AssetSpec {
  /** Identifiant du fichier : toujours `<type>_<cle>`. */
  id: Cle;
  type: TypeAsset;
  /** Clé canon de la chose représentée : `char_leger`, `foret`, `arbre_jungle`… */
  cle: Cle;
  /**
   * Ordre de production : **1 = la France et ses premiers adversaires**, 2 = les
   * autres pays phares et le continent de départ, 3 = le reste, au fil des
   * routines (`BRIEF.md`, « Direction artistique », 5 septembre 2026 au soir).
   */
  priorite: Priorite;
  description: Bilingue;
  style: StyleAsset;
  echelle: Echelle;
  pivot: Pivot;
  budget: Budget;
  textures: TextureSpec[];
  variantes: Variantes;
  animations: AnimationSpec[];
  format: FormatAsset;
  nommage: Nommage;
  interdits: Interdit[];
  verification: Verification;
}

// ---------------------------------------------------------------------------
// 3 bis. Le style d'une nation et le style d'une région
// ---------------------------------------------------------------------------

/**
 * La palette d'un style : les trois couleurs de `Country.palette`, reprises
 * telles quelles, plus un à trois **accents** qui n'appartiennent qu'à la nation
 * (le rouge du téléphérique suisse, l'orange du deel mongol). Les trois
 * premières servent au repli du placeholder ; les accents ne servent qu'au kit.
 */
export interface PaletteStyle extends Palette {
  accents: Couleur[];
}

/** Un motif abstrait posé sur une pièce. Jamais un drapeau, jamais un symbole réel. */
export interface Decalcomanie {
  /** Le motif géométrique, pris dans la liste fermée. */
  motif: MotifDaltonien;
  placement: PlacementDecalcomanie;
  couleur: Couleur;
  /** Ce que le motif évoque, en français. Une image, jamais une référence réelle. */
  note: string;
}

/**
 * Le **style national** : ce qui fait qu'un engin se reconnaît comme suisse ou
 * comme sénégalais avant même qu'on ait vu sa couleur.
 *
 * Un fichier `content/styles/<code>.json` par nation, dérivé de sa fiche de
 * `doc/06-pays-de-depart.md` — climat, géographie, artisanat, cliché
 * affectueux — et de rien d'autre. Le style ne décide d'aucune règle : il ne
 * touche ni les statistiques, ni les pouvoirs, ni les cartes.
 */
export interface StyleNation {
  code: CodePays;
  nom: string;
  /** La phrase qui tient tout le style, en français et en anglais. */
  ligneDirectrice: Bilingue;
  palette: PaletteStyle;
  /** Trois à six matières, prises dans la liste fermée. */
  matieres: MatiereStyle[];
  /** Une à trois finitions. */
  finitions: FinitionStyle[];
  /** Deux à quatre ornements, jamais plus : au-delà, la silhouette se brouille. */
  ornements: OrnementStyle[];
  /** Le gabarit retenu par unité de base : `cle d'unité → a | b | c`. */
  gabarits: Record<Cle, Gabarit>;
  /** Un à trois motifs abstraits. Jamais de drapeau réel ni de symbole réel. */
  decalcomanies: Decalcomanie[];
  /** Le motif géométrique de lisibilité sans couleur, unique dans le jeu. */
  motifDaltonien: MotifDaltonien;
  priorite: Priorite;
  /** Pourquoi ce style, en une ou deux phrases, adossées à la fiche du pays. */
  justification: string;
}

/**
 * Le **style régional** : il habille les bâtiments, le décor et le terrain d'une
 * région d'un pays phare, **jamais les unités** (`BRIEF.md`). Un fichier
 * `content/styles/regions/<pays>/<region>.json`.
 *
 * Il ne vit pas dans `Region` parce que `Region` (`03-schemas.md` §7) est un
 * contrat de jeu, fermé, partagé avec les routines : une routine lore n'a rien à
 * faire dans la couleur d'une tuile.
 */
export interface StyleRegion {
  /** Clé de la région, celle de `Region.code` : `region_fr_bretagne`. */
  code: Cle;
  paysCode: CodePays;
  nom: string;
  ligneDirectrice: Bilingue;
  toits: { forme: FormeToit; matiere: MatiereStyle; couleur: Couleur };
  murs: { matiere: MatiereStyle; couleur: Couleur; finition: FinitionStyle };
  vegetation: { dominante: string; secondaire: string; couleur: Couleur };
  /** Deux à quatre éléments de décor, pris dans la liste fermée. */
  elementsDecor: ElementDecorRegion[];
  priorite: Priorite;
  justification: string;
}

/** Un motif de refus d'asset, de la même forme que `ReviewVerdict.motifs`. */
export interface MotifAsset {
  code: CodeMotifAsset;
  detail?: string;
  mesure?: Record<string, number>;
}

/** Le verdict rendu sur un fichier livré. */
export interface VerdictAsset {
  ok: boolean;
  motifs: MotifAsset[];
}

// ---------------------------------------------------------------------------
// 4. Petits utilitaires partagés
// ---------------------------------------------------------------------------

/** Forme d'un identifiant d'asset : la même que celle d'une `Cle`. */
export const REGEX_ID_ASSET = REGEX_CLE;

/** Compose l'identifiant d'un asset : `unite` + `char_leger` → `unite_char_leger`. */
export function idAsset(type: TypeAsset, cle: Cle): Cle {
  return `${type}_${cle}`;
}

/** La clé d'une géométrie de base d'unité : `char_leger` → `char_leger_base`. */
export function cleUniteBase(cle: Cle): Cle {
  return `${cle}_base`;
}

/** L'identifiant du kit national d'une unité : `kit_fr_char_leger`. */
export function idKit(pays: CodePays, unite: Cle): Cle {
  return idAsset('kit', `${pays}_${unite}`);
}

/**
 * L'identifiant d'un bâtiment : par **région** pour un pays phare détaillé
 * (`batiment_ville_fr_bretagne`), par **pays** sinon (`batiment_ville_jp`).
 */
export function idBatiment(type: Cle, pays: CodePays, region?: Cle): Cle {
  return idAsset('batiment', region === undefined ? `${type}_${pays}` : `${type}_${pays}_${region}`);
}

/** L'identifiant d'un décor : `decor_arbre_cotier_fr_bretagne`, `decor_arbre_desert_ma`. */
export function idDecor(element: Cle, biome: Biome, pays: CodePays, region?: Cle): Cle {
  const territoire = region === undefined ? pays : `${pays}_${region}`;
  return idAsset('decor', `${element}_${biome}_${territoire}`);
}

/**
 * Le nom court d'une région dans un identifiant d'asset : `region_fr_bretagne`
 * devient `bretagne`. Les identifiants sont bornés à 48 caractères comme toute
 * `Cle` ; répéter le pays deux fois y tiendrait mal et se lirait plus mal encore.
 */
export function slugRegion(code: Cle): Cle {
  const coupe = code.replace(/^region_[a-z]{2}_/, '');
  return coupe === '' ? code : coupe;
}

/** Le gabarit qu'une nation retient pour une unité ; `a` si elle n'en dit rien. */
export function gabaritDe(style: StyleNation, unite: Cle): Gabarit {
  return style.gabarits[unite] ?? 'a';
}

/** Le budget de triangles d'un niveau de détail donné. */
export function budgetDe(budget: Budget, lod: NiveauLod): number {
  if (lod === 0) return budget.lod0;
  if (lod === 1) return budget.lod1;
  return budget.lod2;
}

/** Le nom de fichier d'un modèle, gabarit appliqué. */
export function nomModele(spec: AssetSpec, lod: NiveauLod): string {
  return spec.nommage.modele.replace('{id}', spec.id).replace('{lod}', String(lod));
}

/**
 * Le nom de fichier d'une texture, gabarit appliqué. Une variante vide retire le
 * segment `_{variante}` au lieu de laisser un double tiret bas.
 */
export function nomTexture(spec: AssetSpec, canal: CanalTexture, variante = ''): string {
  const brut = spec.nommage.texture
    .replace('{id}', spec.id)
    .replace('{canal}', canal)
    .replace('{variante}', variante)
    .replace('{ext}', spec.textures.find((t) => t.canal === canal)?.format ?? 'png');
  return variante === '' ? brut.replace('__', '_').replace('_.', '.') : brut;
}
