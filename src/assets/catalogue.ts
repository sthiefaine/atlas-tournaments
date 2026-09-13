/**
 * Le catalogue des spécifications d'assets : **le canon, converti en commandes**.
 *
 * Rien n'est écrit à la main ici qui existe déjà ailleurs. Les unités viennent de
 * `content/unites.json`, les terrains de `content/terrains.json`, les archétypes de
 * `content/archetypes.json`, les biomes des schémas. Ce module ajoute la seule
 * chose que le canon ne dit pas : **à quoi ça ressemble**, en anglais pour le
 * générateur et en français pour la relecture.
 *
 * Conséquence directe de l'homologation (`BRIEF.md`, point 8 des arbitrages) :
 * une unité nouvelle n'ajoute pas une ligne de code ici. Elle entre dans
 * `content/unites.json`, le catalogue lui compose une description depuis sa
 * `Silhouette`, et la boucle avec le générateur repart. Les dix textes tenus à la
 * main sont un **enrichissement** des dix unités canon, jamais une condition.
 *
 * Cette couche n'importe que `schemas/` et `content/` (`doc/02-architecture.md` §5).
 */

import { chargerArchetypes, chargerPays, chargerTerrains, chargerUnites } from '../content/index';
import {
  BIOMES, TERRAINS_CAPTURABLES,
  type Biome, type Cle, type CodePays, type Country, type Region, type Saison,
  type Silhouette, type Terrain, type UnitType,
} from '../schemas/types';
import {
  cleUniteBase, idAsset, idBatiment, idDecor, idKit, INTERDITS, slugRegion,
  type AnimationSpec, type AssetSpec, type Bilingue, type Budget, type Echelle,
  type ElementDecorRegion, type FinitionStyle, type FormatAsset, type FormeToit,
  type Interdit, type MatiereStyle, type MotifDaltonien, type Nommage,
  type OrnementStyle, type Pivot, type Priorite, type StyleAsset, type StyleNation,
  type StyleRegion, type TextureSpec, type TypeAsset, type Variantes, type Verification,
} from './spec';
import { chargerStyleNation, chargerStylesNations } from './styles';

// ---------------------------------------------------------------------------
// 1. Blocs communs à toutes les spécifications
// ---------------------------------------------------------------------------

/** La devise du projet, recopiée dans chaque spécification. */
export const DEVISE = 'Réaliste dans les matières, léger dans l’esprit.';

/** Les quatre saisons, pour les assets qui se déclinent complètement. */
const QUATRE_SAISONS: Saison[] = ['printemps', 'ete', 'automne', 'hiver'];

/** Le style commun : le ton de `doc/01-bible.md` §5, traduit en consignes de matières. */
function style(motsCles: string[], aEviter: string[] = []): StyleAsset {
  return {
    reference: 'doc/01-bible.md §5 (guide de ton) et doc/10-rendu-3d.md §2',
    devise: DEVISE,
    matieres: 'Matières crédibles et travaillées — tôle peinte griffée, tissu technique mat, '
      + 'béton lavé, bois usé, caoutchouc poussiéreux — sur des formes simples et lisibles. '
      + 'On sculpte du matériel de compétition bien entretenu, pas du matériel de guerre : '
      + 'propre, marqué par l’usage, jamais abîmé par la violence.',
    motsCles: [
      'stylised realism', 'clean readable silhouette', 'top-down tactics board',
      'sports tournament equipment', 'physically based materials', ...motsCles,
    ],
    aEviter: [
      'no readable text or numbers', 'no real-world insignia or flags',
      'no grime of battle, no damage, no blood', 'no thin spikes or antennas under 2 cm',
      ...aEviter,
    ],
  };
}

/** La liste complète des interdits : chaque spécification la porte en entier. */
function interdits(): Interdit[] {
  return [...INTERDITS];
}

/** Le nommage, identique partout : c'est ce qui rend le dépôt d'assets lisible. */
function nommage(id: string, canalExemple: string, varianteExemple: string): Nommage {
  return {
    modele: '{id}_lod{lod}.glb',
    texture: '{id}_{canal}_{variante}.{ext}',
    exemples: [
      `${id}_lod0.glb`,
      `${id}_${canalExemple}.png`,
      `${id}_${canalExemple}_${varianteExemple}.png`,
    ],
  };
}

/** Le format de sortie, avec les noms imposés propres à l'asset. */
function format(noeuds: string[], materiauxAttendus: string[]): FormatAsset {
  return {
    conteneur: 'glb',
    versionGltf: '2.0',
    axeHaut: 'y',
    unite: 'metre',
    materiaux: 'pbr_metallic_roughness',
    noeudRacine: 'racine',
    noeuds: ['racine', ...noeuds],
    materiauxAttendus,
  };
}

/** Le pivot : centre au sol sauf pour ce qui vole. */
function pivot(poseAuSol = true): Pivot {
  return { origine: 'centre_au_sol', avant: '+z', haut: '+y', poseAuSol };
}

/** Une dimension : cible et tolérance absolue. */
function dim(cible: number, tolerance: number): { cible: number; tolerance: number } {
  return { cible, tolerance };
}

/** Une échelle complète, en mètres de scène (une case = 1 m). */
function echelle(x: number, y: number, z: number, tolerance: number): Echelle {
  return {
    caseEnMetres: 1,
    x: dim(x, tolerance),
    y: dim(y, Math.max(0.02, Math.min(tolerance, y * 0.8))),
    z: dim(z, tolerance),
  };
}

/** Le budget du modèle LOD0. */
function budget(lod0: number, materiauxMax: number): Budget {
  return { lod0, materiauxMax };
}

/** Une carte de texture. */
function tex(
  canal: TextureSpec['canal'], resolution: TextureSpec['resolution'], obligatoire: boolean, note: string,
): TextureSpec {
  return { canal, resolution, format: 'png', obligatoire, note };
}

/** Un clip d'animation. */
function anim(nom: AnimationSpec['nom'], dureeMs: number, boucle: boolean, obligatoire = true): AnimationSpec {
  return { nom, dureeMs, boucle, obligatoire };
}

/** Les variantes attendues. */
function variantes(saisons: Saison[], biomes: Biome[] = [], nations: CodePays[] = []): Variantes {
  return { saisons, biomes, nations };
}

/** Le bloc de vérification. */
function verification(
  controles: Verification['controles'], toleranceAabb: number, lodRequis: Verification['lodRequis'],
): Verification {
  return { controles, toleranceAabb, lodRequis };
}

// ---------------------------------------------------------------------------
// 2. Vocabulaire de silhouette : la seule façon de décrire une unité inconnue
// ---------------------------------------------------------------------------

/** Traduction des bases de silhouette, pour l'anglais du générateur. */
const BASE_EN: Record<Silhouette['base'], string> = {
  chenilles: 'a tracked chassis with visible road wheels and a rubber-padded track run',
  roues: 'a six-wheeled chassis with fat off-road tyres',
  pattes: 'walking figures on a shared oval base',
  coque: 'a floating hull with a waterline strake',
  rotor: 'a rotor mast with a four-blade disc and a landing skid',
  ailes: 'fixed wings with a slender fuselage',
  rail: 'rail bogies on a short section of track',
};

/** Traduction des bases de silhouette, en français. */
const BASE_FR: Record<Silhouette['base'], string> = {
  chenilles: 'un train de chenilles à galets visibles et patins caoutchoutés',
  roues: 'un châssis à six roues et pneus larges de tout-terrain',
  pattes: 'des figures debout sur une base ovale commune',
  coque: 'une coque flottante avec sa ligne de flottaison marquée',
  rotor: 'un mât de rotor à quatre pales et un patin d’atterrissage',
  ailes: 'une voilure fixe sur un fuselage élancé',
  rail: 'des bogies de rail sur un court tronçon de voie',
};

/** Traduction des corps de silhouette. */
const CORPS_EN: Record<Silhouette['corps'], string> = {
  bloc: 'a blocky angular hull with wide sloped cheeks',
  capsule: 'a rounded capsule hull with soft shoulders',
  plateau: 'a low flat deck with a raised front cab',
};

/** Traduction des corps de silhouette, en français. */
const CORPS_FR: Record<Silhouette['corps'], string> = {
  bloc: 'une caisse anguleuse aux joues larges et inclinées',
  capsule: 'une caisse en capsule aux épaules arrondies',
  plateau: 'un plateau bas surmonté d’une cabine avancée',
};

/** Traduction des modules de silhouette. */
const MODULE_EN: Record<string, string> = {
  tourelle: 'a rotating turret',
  canon_long: 'a long marker tube on a travel lock',
  lance_roquettes: 'a boxed marker-rocket rack',
  radar: 'a rotating radar dish',
  antenne: 'a whip antenna with a base spring',
  grue: 'a folding crane arm',
  panneaux_solaires: 'a folded solar panel wing',
  nacelle: 'a glazed crew pod',
};

/** Traduction des modules de silhouette, en français. */
const MODULE_FR: Record<string, string> = {
  tourelle: 'une tourelle pivotante',
  canon_long: 'un tube de marquage long sur son verrou de route',
  lance_roquettes: 'un caisson de marqueurs-fusées',
  radar: 'une antenne radar tournante',
  antenne: 'une antenne fouet sur ressort',
  grue: 'un bras de grue repliable',
  panneaux_solaires: 'une aile de panneaux solaires repliée',
  nacelle: 'une nacelle vitrée d’équipage',
};

/** Liste anglaise des modules d'une silhouette, prête à insérer dans une phrase. */
function modulesEn(s: Silhouette): string {
  if (s.modules.length === 0) return 'no add-on module';
  return s.modules.map((m) => MODULE_EN[m] ?? m).join(', ');
}

/** Liste française des modules d'une silhouette. */
function modulesFr(s: Silhouette): string {
  if (s.modules.length === 0) return 'aucun module rapporté';
  return s.modules.map((m) => MODULE_FR[m] ?? m).join(', ');
}

/**
 * La phrase de silhouette : ce que le rendu 2D compose déjà avec des formes
 * vectorielles, dit en mots pour le générateur 3D. Les deux rendus décrivent la
 * même unité, ce qui est exactement le point.
 */
function phraseSilhouette(u: UnitType): Bilingue {
  const s = u.silhouette;
  return {
    en: `Silhouette contract (must be recognisable from a 65-degree top-down camera): `
      + `${BASE_EN[s.base]}, ${CORPS_EN[s.corps]}, ${modulesEn(s)}, bulk class ${s.taille} of 3. `
      + `Game role: ${u.cout} funds, ${u.mouvement} movement on ${u.typeMouvement}, `
      + `range ${u.portee[0]}-${u.portee[1]}, vision ${u.vision}`
      + `${u.traits.length > 0 ? `, traits ${u.traits.join(', ')}` : ''}.`,
    fr: `Contrat de silhouette (reconnaissable à 65° au-dessus de l’horizontale) : `
      + `${BASE_FR[s.base]}, ${CORPS_FR[s.corps]}, ${modulesFr(s)}, encombrement ${s.taille} sur 3. `
      + `Rôle de jeu : ${u.cout} fonds, ${u.mouvement} de mouvement en ${u.typeMouvement}, `
      + `portée ${u.portee[0]}-${u.portee[1]}, vision ${u.vision}`
      + `${u.traits.length > 0 ? `, traits ${u.traits.join(', ')}` : ''}.`,
  };
}

// ---------------------------------------------------------------------------
// 2 bis. Le vocabulaire du style, traduit une fois pour toutes
// ---------------------------------------------------------------------------

/**
 * Chaque liste fermée de `spec.ts` a ici son couple `[anglais, français]`. C'est
 * la seule façon de composer une commande bilingue sans qu'un humain n'écrive
 * 240 kits à la main : le style dit `bambou`, la table dit *strapped bamboo
 * panels*, et la description se construit toute seule.
 */
const MATIERE: Record<MatiereStyle, [string, string]> = {
  peinture_mate: ['flat matte paint', 'peinture mate'],
  peinture_satinee: ['satin paint', 'peinture satinée'],
  peinture_brillante: ['high-gloss paint', 'peinture brillante'],
  camouflage: ['multi-tone plant camouflage', 'camouflage végétal à plusieurs tons'],
  acier_brosse: ['brushed steel', 'acier brossé'],
  acier_peint: ['painted steel plate', 'tôle d’acier peinte'],
  aluminium: ['bare aluminium', 'aluminium nu'],
  laiton: ['polished brass fittings', 'garnitures de laiton poli'],
  cuivre: ['warm copper sheet', 'feuille de cuivre chaude'],
  fonte: ['cast iron', 'fonte'],
  bois: ['planed timber', 'bois raboté'],
  bois_verni: ['varnished wood', 'bois verni'],
  bambou: ['strapped bamboo', 'bambou sanglé'],
  rotin: ['woven rattan', 'rotin tressé'],
  osier: ['wickerwork', 'osier'],
  corde: ['braided rope', 'cordage tressé'],
  toile: ['heavy canvas', 'toile épaisse'],
  toile_ciree: ['oilcloth', 'toile cirée'],
  feutre: ['thick felt', 'feutre épais'],
  cuir: ['stitched leather', 'cuir cousu'],
  caoutchouc: ['dusty rubber', 'caoutchouc poussiéreux'],
  ceramique: ['glazed ceramic', 'céramique émaillée'],
  terre_cuite: ['fired earth', 'terre cuite'],
  tuile: ['clay tile', 'tuile de terre cuite'],
  ardoise: ['split slate', 'ardoise fendue'],
  pierre_seche: ['dry-laid stone', 'pierre sèche'],
  beton: ['washed concrete', 'béton lavé'],
  tole_ondulee: ['corrugated sheet', 'tôle ondulée'],
  verre: ['clear glazing', 'vitrage clair'],
  email: ['enamelled panel', 'panneau émaillé'],
};

const FINITION: Record<FinitionStyle, [string, string]> = {
  mate: ['fully matte', 'entièrement mate'],
  satinee: ['satin', 'satinée'],
  brillante: ['glossy', 'brillante'],
  brossee: ['brushed in one direction', 'brossée dans un seul sens'],
  martelee: ['hammered', 'martelée'],
  patinee: ['patinated by use', 'patinée par l’usage'],
  sablee: ['sand-blasted to a dead matte', 'sablée jusqu’au mat complet'],
  vernie: ['varnished', 'vernie'],
  ciree: ['waxed', 'cirée'],
  huilee: ['oiled', 'huilée'],
  laquee: ['lacquered', 'laquée'],
  blanchie: ['limewashed', 'blanchie à la chaux'],
  oxydee: ['lightly oxidised', 'légèrement oxydée'],
  poudree_de_sel: ['dusted with dried salt', 'poudrée de sel séché'],
  poussieree: ['dust-laden on the lower third', 'chargée de poussière sur le tiers bas'],
  delavee: ['sun-faded', 'délavée par le soleil'],
};

const ORNEMENT: Record<OrnementStyle, [string, string]> = {
  antenne: ['a whip antenna on a base spring', 'une antenne fouet sur ressort'],
  sacoche: ['a stitched side pannier', 'une sacoche cousue sur le flanc'],
  filet: ['a knotted net stowed on the deck', 'un filet noué rangé sur le plateau'],
  banniere: ['a plain unlettered banner', 'une banderole unie sans lettrage'],
  lanterne: ['a small hooded lantern', 'une lanterne à capuchon'],
  toit_toile: ['a stretched canvas roof', 'un toit de toile tendue'],
  panneau: ['a blank instruction plate', 'un panneau d’instruction vierge'],
  jerrican: ['a row of strapped jerrycans', 'une rangée de jerricans sanglés'],
  roue_de_secours: ['a spare wheel on the flank', 'une roue de secours sur le flanc'],
  pare_soleil: ['a fringed sun visor', 'un pare-soleil frangé'],
  fanion: ['a small plain pennant', 'un fanion uni'],
  chaines: ['coiled snow chains', 'des chaînes lovées'],
  galerie_de_toit: ['a loaded roof rack', 'une galerie de toit chargée'],
  bache_roulee: ['a rolled tarpaulin along the fender', 'une bâche roulée le long du garde-boue'],
  guirlande: ['a string of small hanging pennant lights', 'une guirlande de fanions'],
  echelle: ['a short side ladder', 'une échelle latérale courte'],
  treuil: ['a front winch with a hook', 'un treuil avant à crochet'],
  pelle: ['a strapped shovel', 'une pelle sanglée'],
  bidon: ['a hanging water can', 'un bidon d’eau accroché'],
  tapis: ['a rolled patterned rug', 'un tapis à motifs roulé'],
  cloche: ['a small mounted bell', 'une petite cloche montée'],
  plaque_de_desensablement: ['sand ladders on the flank', 'des plaques de désensablement sur le flanc'],
  brise_vent: ['a low windbreak screen', 'un brise-vent bas'],
  corde_lovee: ['a coil of rope on a cleat', 'une corde lovée sur un taquet'],
  planche_de_secours: ['a spare timber plank', 'une planche de secours'],
  moustiquaire: ['a rolled mosquito screen', 'une moustiquaire roulée'],
  gourde: ['a felt-covered flask', 'une gourde habillée de feutre'],
  brosse: ['a stiff cleaning brush clipped on', 'une brosse dure clipsée'],
  porte_skis: ['a ski and pole rack', 'un porte-skis et bâtons'],
  ancre_de_sable: ['a folding sand anchor', 'une ancre de sable repliable'],
};

const MOTIF: Record<MotifDaltonien, [string, string]> = {
  rayures_obliques: ['oblique stripes', 'rayures obliques'],
  rayures_verticales: ['vertical stripes', 'rayures verticales'],
  rayures_horizontales: ['horizontal bands', 'bandes horizontales'],
  chevrons: ['chevrons', 'chevrons'],
  damier: ['a chequerboard', 'un damier'],
  pois: ['dots', 'des pois'],
  triangles: ['a row of triangles', 'une file de triangles'],
  losanges: ['diamonds', 'des losanges'],
  vagues: ['a wave frieze', 'une frise de vagues'],
  croisillons: ['a cross-hatch', 'un croisillon'],
  ecailles: ['overlapping scales', 'des écailles'],
  hachures: ['tight hatching', 'des hachures serrées'],
  anneaux: ['concentric rings', 'des anneaux concentriques'],
  zigzag: ['a zigzag', 'une ligne brisée'],
  croix_diagonale: ['a diagonal cross', 'une croix diagonale'],
  dents_de_scie: ['a sawtooth line', 'une ligne en dents de scie'],
  spirale: ['a broad spiral', 'une spirale large'],
  grille: ['a square grid', 'un quadrillage'],
  arcs: ['a run of arcs', 'une suite d’arcs'],
  demi_lunes: ['half-moons', 'des demi-lunes'],
  etoiles_quatre_branches: ['four-pointed stars', 'des étoiles à quatre branches'],
  carres_emboites: ['nested squares', 'des carrés emboîtés'],
  bandes_pointillees: ['dashed bands', 'des bandes pointillées'],
  fleche_repetee: ['a repeated arrowhead', 'une pointe de flèche répétée'],
  nid_dabeille: ['a honeycomb', 'un nid d’abeille'],
  plumes: ['a feather pattern', 'un motif de plumes'],
};

const FORME_TOIT: Record<FormeToit, [string, string]> = {
  deux_pans: ['a simple gable roof', 'un toit à deux pans'],
  quatre_pans: ['a hipped roof on four sides', 'un toit à quatre pans'],
  croupe: ['a half-hipped roof', 'un toit à croupe'],
  plat: ['a flat roof', 'un toit plat'],
  terrasse: ['a usable roof terrace', 'une toiture-terrasse praticable'],
  shed: ['a sawtooth north-light roof', 'une toiture en sheds'],
  pente_douce: ['a shallow-pitched roof', 'un toit à faible pente'],
  mansarde: ['a mansard roof with dormers', 'un toit mansardé à lucarnes'],
  voute: ['a barrel-vaulted roof', 'une toiture en voûte'],
  chaume: ['a thatched roof', 'un toit de chaume'],
  tole: ['a ribbed metal roof', 'un toit de tôle nervurée'],
  coupole: ['a low dome', 'une coupole basse'],
};

const ELEMENT_DECOR: Record<ElementDecorRegion, [string, string]> = {
  muret_de_pierre: ['a dry stone wall', 'un muret de pierre sèche'],
  haie_vive: ['a thick living hedge', 'une haie vive épaisse'],
  rangee_de_vigne: ['a row of trained vines', 'une rangée de vigne palissée'],
  sechoir: ['an open drying rack', 'un séchoir ouvert'],
  lavoir: ['a covered washing basin', 'un lavoir couvert'],
  pigeonnier: ['a small dovecote', 'un pigeonnier'],
  cabane_sur_pilotis: ['a hut on stilts', 'une cabane sur pilotis'],
  four_a_pain: ['a stone bread oven', 'un four à pain en pierre'],
  moulin: ['a working mill', 'un moulin en état de marche'],
  cypres_en_rideau: ['a cypress windbreak row', 'un rideau de cyprès'],
  palmier_en_alignement: ['a line of planted palms', 'un alignement de palmiers'],
  canne_a_sucre: ['a block of cane in regular bands', 'un carré de canne en bandes régulières'],
  bosquet_de_bambous: ['a bamboo clump', 'un bosquet de bambous'],
  filets_de_peche: ['fishing nets hung to dry', 'des filets de pêche mis à sécher'],
  casiers_empiles: ['stacked fishing pots', 'des casiers empilés'],
  banc_de_pierre: ['a worn stone bench', 'un banc de pierre usé'],
  croix_de_chemin: ['a plain wayside marker cross', 'une croix de chemin sans inscription'],
  terrasse_en_escalier: ['stepped garden terraces', 'des terrasses de culture en escalier'],
  mangrove: ['a tangle of mangrove roots', 'un enchevêtrement de racines de mangrove'],
  ponton_de_bois: ['a timber pontoon', 'un ponton de bois'],
  ruche: ['a row of hives', 'une rangée de ruches'],
  abri_de_berger: ['a shepherd’s stone shelter', 'un abri de berger en pierre'],
  panneau_de_bois: ['a blank timber signboard', 'un panneau de bois vierge'],
  jardin_de_balisiers: ['a balisier garden bed', 'un jardin de balisiers'],
  alignement_de_pins: ['pines planted on a grid', 'des pins plantés au cordeau'],
  roseliere: ['a reed bed', 'une roselière'],
  alignement_de_pierres: ['a line of standing stones', 'un alignement de pierres levées'],
  terril: ['a dark spoil heap turned belvedere', 'un terril noir devenu belvédère'],
  pylone_de_telepherique: ['a cable-car pylon', 'un pylône de téléphérique'],
  kiosque: ['a bandstand kiosk', 'un kiosque à musique'],
};

/** Liste anglaise ou française d'un vocabulaire fermé, prête à insérer. */
function liste<T extends string>(table: Record<T, [string, string]>, valeurs: readonly T[], en: boolean): string {
  const mots = valeurs.map((v) => table[v][en ? 0 : 1]);
  if (mots.length <= 1) return mots[0] ?? '';
  const dernier = mots[mots.length - 1] as string;
  return `${mots.slice(0, -1).join(', ')}${en ? ' and ' : ' et '}${dernier}`;
}

// ---------------------------------------------------------------------------
// 3. Les textes tenus à la main
// ---------------------------------------------------------------------------

/** Textes propres aux dix unités canon. */
const TEXTES_UNITE: Record<string, Bilingue> = {
  drone_marin: {
    fr: 'Un petit drone marin de reconnaissance de tournoi : coque basse compacte à deux flotteurs épais, capsule étanche, radar court et antenne robuste. Aucun cockpit, aucun passager et aucun tube de tir. Panneaux gris neutre de couleur d’équipe sur le pont et le nez ; dessous flottant au niveau de référence, silhouette clairement distincte d’une barge.',
    en: 'A small unmanned tournament reconnaissance surface boat: compact low twin-float hull, sealed capsule, short radar and sturdy antenna. No cockpit, passenger or marker launcher. Neutral grey team panels on deck and bow. Floating underside at reference level, clearly distinct from a transport barge.',
  },
  drone_intercepteur: {
    fr: 'Un drone intercepteur de tournoi compact : fuselage en losange, deux ailes épaisses et courts lanceurs de marqueurs dirigés vers le ciel. Aucun cockpit habité. Les ailes et le nez portent les panneaux neutres de couleur d’équipe. Silhouette rapide, nette, distincte du drone observateur ; aucune pièce fine ni emblème.',
    en: 'A compact unmanned tournament interceptor with a diamond fuselage, two thick wings and short upward-pointing marker launchers. No occupied cockpit. Smooth neutral-grey team panels on wings and nose. A fast, crisp silhouette distinct from an observer drone; no thin parts, symbols or lettering.',
  },
  drone_ravitailleur: {
    fr: 'Un drone logistique trapu, deux rotors protégés et une nacelle rectangulaire de batteries et de marqueurs sous le corps. Ni lanceur ni cabine de transport de personnes. La nacelle fermée et les carénages épais le distinguent du drone observateur ; panneaux d’équipe gris neutre sur le dessus et les côtés.',
    en: 'A squat supply drone with two protected rotors and a rectangular closed battery-and-marker pod beneath its body. No weapon launcher and no passenger cabin. The thick rotor guards and oversized supply pod distinguish it from an observation drone; neutral grey team panels on top and sides.',
  },
  meridien_veilleur: {
    fr: 'Un drone brouilleur méridien : corps compact, deux rotors, large disque radar rabattu au-dessus d’une nacelle courte. Le radar et la nacelle forment deux volumes clairement séparés vus d’en haut. Aucune arme ; matériaux techniques entretenus. Panneaux d’équipe gris neutre, aucun symbole qui révèle sa provenance.',
    en: 'A Meridian electronic-support drone: compact body, two rotors, a broad folding radar disc above a short equipment pod. Radar and pod form two clearly separated top-down volumes. No weapon. Well-maintained technical materials and neutral-grey team panels, with no provenance-revealing symbols.',
  },
  meridien_bastion: {
    fr: 'Une plateforme méridienne lourde à chenilles : coque basse et large, tourelle compacte portant deux tubes de marquage antiaérien courts et parallèles. Silhouette massive et lente, flancs larges, roues visibles. Panneaux d’équipe gris neutre sur tourelle et glacis, aucun insigne. Aucun canon long d’artillerie.',
    en: 'A heavy Meridian tracked platform: low wide hull, compact turret with two short parallel anti-air marker tubes. Massive slow silhouette, broad track runs and visible road wheels. Neutral-grey team panels on turret and front plate, no insignia and no long artillery barrel.',
  },
  infanterie: {
    en: 'A pair of tournament infantry athletes advancing at a steady walk, sculpted as one compact '
      + 'group on a single oval base. Padded team jersey, light chest plastron, knee guards, a soft '
      + 'field cap, and a shoulder-slung marker launcher carried low across the body. Broad shoulders, '
      + 'short limbs, nothing thinner than two centimetres. The plastron, shoulder panels and cap band '
      + 'are smooth and unlettered: they are the team-colour zones.',
    fr: 'Deux athlètes d’infanterie du tournoi qui avancent au pas, sculptés en un seul groupe compact '
      + 'sur une base ovale unique. Maillot d’équipe rembourré, plastron léger, genouillères, casquette '
      + 'de terrain souple et lanceur de marquage porté bas en bandoulière. Épaules larges, membres '
      + 'courts, rien de plus fin que deux centimètres. Plastron, épaules et bandeau de casquette restent '
      + 'lisses et sans lettrage : ce sont les zones de couleur d’équipe.',
  },
  meca: {
    en: 'A two-figure heavy support pair in reinforced kit: thick shin plates, a segmented back frame, '
      + 'a visored helmet, and a shoulder-carried boxed marker-rocket tube held level. Heavier and '
      + 'slower-looking than the infantry pair — the stance is planted, the boots are deep-lugged, the '
      + 'frame is what reads from above. Team colour lives on the back frame panel and the helmet crest.',
    fr: 'Un binôme d’appui lourd en tenue renforcée : plaques de tibia épaisses, cadre dorsal segmenté, '
      + 'casque à visière et caisson de marqueurs-fusées porté à l’épaule, à l’horizontale. Plus lourd et '
      + 'plus lent que le binôme d’infanterie : la posture est ancrée, les semelles sont crantées, et '
      + 'c’est le cadre dorsal qui se lit d’en haut. La couleur d’équipe tient au panneau dorsal et à la '
      + 'crête du casque.',
  },
  recon: {
    en: 'A light six-wheeled scout car with a rounded capsule body, a low glazed cabin, and a rotating '
      + 'radar dish folded flat on the rear deck. Everything about it should say fast and fragile: thin '
      + 'panels, exposed suspension arms, a spare wheel on the flank, dust on the lower third. The bonnet '
      + 'and the doors are the team-colour zones.',
    fr: 'Une voiture de reconnaissance légère à six roues, caisse en capsule, cabine vitrée basse et '
      + 'antenne radar tournante rabattue à plat sur le plateau arrière. Tout doit dire vite et fragile : '
      + 'tôles fines, bras de suspension apparents, roue de secours sur le flanc, poussière sur le tiers '
      + 'bas. Le capot et les portes sont les zones de couleur d’équipe.',
  },
  char_leger: {
    en: 'A compact tracked vehicle with a low blocky hull and a rounded rotating turret, built for speed '
      + 'rather than mass: short track run, five road wheels, sloped glacis, stowage boxes and rolled '
      + 'tarpaulin along the fenders. The turret cheeks and the hull sides are wide flat team-colour '
      + 'zones; the tracks stay neutral dark rubber.',
    fr: 'Un blindé chenillé compact, caisse basse et anguleuse, tourelle arrondie pivotante, conçu pour la '
      + 'vitesse plus que pour la masse : chenille courte, cinq galets, glacis incliné, coffres de rangement '
      + 'et bâche roulée le long des garde-boue. Les joues de tourelle et les flancs de caisse forment de '
      + 'larges zones de couleur d’équipe ; la chenille reste d’un caoutchouc sombre neutre.',
  },
  char_lourd: {
    en: 'The heaviest piece on the board: a wide tracked hull with thick sloped plates, a large turret and '
      + 'a long marker tube resting in a travel lock over the rear deck. Seven road wheels, deep skirts, a '
      + 'commander cupola, tow cables coiled on the flanks. It must look expensive and slow — the reason a '
      + 'player thinks twice before buying it. Team colour on turret sides and skirt panels.',
    fr: 'La pièce la plus lourde du plateau : large caisse chenillée aux plaques épaisses et inclinées, '
      + 'grosse tourelle, tube de marquage long posé sur son verrou de route au-dessus du plateau arrière. '
      + 'Sept galets, jupes profondes, coupole de chef de bord, câbles de remorquage lovés sur les flancs. '
      + 'Il doit avoir l’air cher et lent — la raison pour laquelle on hésite à l’acheter. Couleur d’équipe '
      + 'sur les flancs de tourelle et les jupes.',
  },
  artillerie: {
    en: 'A tracked flat-deck carrier with a long marker tube on an open pivot mount and two folding '
      + 'ground spades at the rear. It should read as a machine that must stop to work: spades down, tube '
      + 'raised, crew ladder folded on the side. No turret, no protection — deliberately vulnerable. Team '
      + 'colour on the deck skirt and the mount cradle.',
    fr: 'Un porteur chenillé à plateau plat, tube de marquage long sur affût pivotant ouvert, deux bêches '
      + 'repliables à l’arrière. Il doit se lire comme une machine qui doit s’arrêter pour travailler : '
      + 'bêches posées, tube relevé, échelle d’équipage repliée sur le flanc. Ni tourelle ni protection — '
      + 'volontairement vulnérable. Couleur d’équipe sur la jupe de plateau et le berceau d’affût.',
  },
  roquettes: {
    en: 'A big six-wheeled flat-deck truck carrying a boxed marker-rocket rack on a rear pivot, with '
      + 'stabiliser legs and a shielded forward cab. The rack is the silhouette: a wide rectangular box, '
      + 'clearly angled up, wider than the chassis. Long reach, no protection. Team colour on the cab '
      + 'doors and the rack cheeks.',
    fr: 'Un gros camion à plateau et six roues portant un caisson de marqueurs-fusées sur pivot arrière, '
      + 'béquilles de stabilisation et cabine avant blindée. C’est le caisson qui fait la silhouette : une '
      + 'large boîte rectangulaire, nettement pointée vers le haut, plus large que le châssis. Grande '
      + 'allonge, aucune protection. Couleur d’équipe sur les portes de cabine et les joues du caisson.',
  },
  antiair: {
    en: 'A tracked vehicle with a squat blocky hull, a compact turret carrying twin short marker tubes '
      + 'and a small rotating radar dish on a folding arm. The dish and the twin tubes are what identify '
      + 'it instantly from above; keep them chunky and clearly separated. Team colour on turret sides and '
      + 'hull front plate.',
    fr: 'Un blindé chenillé à caisse trapue et anguleuse, tourelle compacte portant deux tubes de marquage '
      + 'courts et une petite antenne radar tournante sur bras repliable. C’est l’antenne et le couple de '
      + 'tubes qui l’identifient au premier coup d’œil d’en haut : massifs et nettement séparés. Couleur '
      + 'd’équipe sur les flancs de tourelle et la plaque avant.',
  },
  helico: {
    en: 'A light rotorcraft modelled at hover height, not on the ground: a rounded glazed crew pod, a '
      + 'short tail boom with a ring-guarded tail rotor, skid landing gear, and a four-blade main rotor '
      + 'disc modelled as a very slightly coned set of blades. The rotor is a separate named node so the '
      + 'renderer can spin it. Team colour on the pod flanks and the tail fin.',
    fr: 'Un appareil à voilure tournante léger, modélisé à sa hauteur de vol et non posé : nacelle vitrée '
      + 'arrondie, poutre de queue courte à rotor anticouple caréné, atterrisseur à patins, et rotor '
      + 'principal à quatre pales très légèrement coniques. Le rotor est un nœud nommé à part, pour que le '
      + 'rendu le fasse tourner. Couleur d’équipe sur les flancs de nacelle et la dérive.',
  },
  transport: {
    en: 'A tracked flat-deck carrier with an open cargo bay, a folding crane arm stowed along the left '
      + 'side, tie-down rails, and a small forward cab. It carries nothing that could mark: no turret, no '
      + 'tube, no rack. The bay must look genuinely usable — a visible floor, bench edges, a lowered rear '
      + 'ramp. Team colour on the cab and the bay side panels.',
    fr: 'Un porteur chenillé à plateau, soute ouverte, bras de grue repliable rangé le long du flanc '
      + 'gauche, rails d’arrimage et petite cabine avant. Il ne porte rien qui puisse marquer : ni tourelle, '
      + 'ni tube, ni caisson. La soute doit avoir l’air réellement utilisable — plancher visible, bords de '
      + 'banquette, rampe arrière abaissée. Couleur d’équipe sur la cabine et les panneaux de soute.',
  },
};

/** Textes propres aux terrains et aux bâtiments. */
const TEXTES_TERRAIN: Record<string, Bilingue> = {
  plaine: {
    en: 'A one-metre tileable patch of mown tournament grassland: dense short turf with a faint mowing '
      + 'pattern, scattered clover and dandelion, a few bare earth scuffs, and a very shallow surface '
      + 'undulation of about six centimetres. It tiles seamlessly on all four edges and never shows a '
      + 'feature large enough to be recognised twice on the same map.',
    fr: 'Une plaque carrée d’un mètre, raccordable, de prairie de tournoi tondue : gazon court et dense '
      + 'à trace de tonte discrète, trèfle et pissenlits épars, quelques éraflures de terre nue, et une '
      + 'ondulation de surface d’environ six centimètres. Elle se raccorde sur ses quatre bords et ne '
      + 'montre jamais un motif assez gros pour être reconnu deux fois sur la même carte.',
  },
  foret: {
    en: 'A one-metre tileable forest floor patch: leaf litter over dark humus, exposed root ridges, moss '
      + 'on the north side of the roots, fallen twigs and a scatter of acorns and cones. This asset is the '
      + 'ground only — the trees are separate decor assets — but its roots must read as belonging to '
      + 'something big standing on it.',
    fr: 'Une plaque d’un mètre, raccordable, de sol forestier : litière de feuilles sur humus sombre, '
      + 'racines affleurantes, mousse du côté nord des racines, brindilles tombées et semis de glands et '
      + 'de cônes. Cet asset n’est que le sol — les arbres sont des assets de décor à part — mais ses '
      + 'racines doivent appartenir visiblement à quelque chose de grand qui pousse dessus.',
  },
  montagne: {
    en: 'A rocky outcrop that the renderer drops on high tiles: a fractured stone mass with clear bedding '
      + 'planes, a flat walkable shelf on top wide enough to hold a unit, scree at the base, and lichen in '
      + 'the shaded cracks. It must read as the best perch on the board — high, defensible, and visibly '
      + 'reachable on foot from one side.',
    fr: 'Un éperon rocheux que le rendu pose sur les cases hautes : masse fracturée aux bancs nettement '
      + 'lisibles, replat praticable au sommet, assez large pour porter une unité, éboulis à la base, '
      + 'lichen dans les fissures à l’ombre. Il doit se lire comme le meilleur perchoir du plateau : haut, '
      + 'défendable, et visiblement accessible à pied par un côté.',
  },
  route: {
    en: 'A one-metre tileable strip of tournament service road: compacted asphalt with a slightly '
      + 'polished wheel track, gravel shoulders, a shallow drainage lip, and hairline cracks sealed with '
      + 'darker tar. No painted lines, no markings, no numbers. The surface must stay flat within four '
      + 'centimetres so that road strips join without a visible step.',
    fr: 'Une bande d’un mètre, raccordable, de route de service du tournoi : enrobé compacté à bande de '
      + 'roulement légèrement polie, accotements de gravier, léger seuil de drainage et fissures fines '
      + 'rebouchées au bitume plus sombre. Ni ligne peinte, ni marquage, ni chiffre. La surface reste plate '
      + 'à quatre centimètres près pour que deux bandes se joignent sans marche visible.',
  },
  plage: {
    en: 'A one-metre tileable beach patch: fine damp sand with a wind-ripple pattern, a scatter of small '
      + 'shells and smoothed pebbles, a faint darker tide line crossing one edge, and dry lighter sand '
      + 'gathering against the opposite edge. The tide line must be usable as a gradient towards the sea '
      + 'tiles.',
    fr: 'Une plaque d’un mètre, raccordable, de plage : sable fin humide à rides de vent, semis de petits '
      + 'coquillages et de galets polis, ligne de marée plus sombre traversant un bord, et sable sec plus '
      + 'clair accumulé contre le bord opposé. La ligne de marée doit servir de dégradé vers les cases de '
      + 'mer.',
  },
  riviere: {
    en: 'A one-metre tileable river bed patch, delivered as the bed only — the water surface is generated '
      + 'by the renderer. Rounded gravel and cobbles graded from coarse in the middle to fine at the edges, '
      + 'a silt band along one side, a few water-worn branches. The bed sits about thirty centimetres '
      + 'below the plain, so its edges must fall away cleanly.',
    fr: 'Une plaque d’un mètre, raccordable, de lit de rivière, livrée comme lit seul — la surface d’eau '
      + 'est produite par le rendu. Galets et graviers arrondis, grossiers au centre et fins sur les bords, '
      + 'bande de limon d’un côté, quelques branches polies par l’eau. Le lit est environ trente centimètres '
      + 'sous la plaine : ses bords doivent descendre proprement.',
  },
  pont: {
    en: 'A one-lane deck bridge section, exactly one metre long, that repeats to span any width: timber '
      + 'deck planks on steel stringers, low tubular side rails, bolted plates at the joints, and abutment '
      + 'blocks at each end. It is the only crossing heavy vehicles get, so it must look solid, functional '
      + 'and slightly worn at the wheel line.',
    fr: 'Un tronçon de pont à une voie, long d’exactement un mètre, qui se répète pour franchir n’importe '
      + 'quelle largeur : platelage de madriers sur longerons d’acier, garde-corps tubulaires bas, plaques '
      + 'boulonnées aux jonctions, culées à chaque extrémité. C’est le seul franchissement des véhicules '
      + 'lourds : il doit avoir l’air solide, fonctionnel et légèrement usé à la ligne des roues.',
  },
  mer: {
    en: 'A one-metre tileable sea-bed patch seen through water: pale rippled sand near the shore edge, '
      + 'darker weed patches and a scatter of rounded stones towards the deep edge. The water itself is a '
      + 'renderer material; this asset only has to make the shallows look inhabited when the surface is '
      + 'calm and transparent.',
    fr: 'Une plaque d’un mètre, raccordable, de fond marin vu à travers l’eau : sable clair ridé près du '
      + 'bord côtier, taches d’algues plus sombres et semis de pierres arrondies vers le bord profond. '
      + 'L’eau elle-même est un matériau du rendu ; cet asset n’a qu’à rendre les petits fonds habités '
      + 'quand la surface est calme et transparente.',
  },
  ville: {
    en: 'A small tournament host town block on a one-metre plot: three or four low buildings of two to '
      + 'three storeys around a paved courtyard, tiled roofs, shuttered windows, a canopy over a café '
      + 'terrace, planters and a bicycle rack. Warm, lived-in, welcoming — this is where the visiting teams '
      + 'are put up. Windows are a separate emissive material for the night phase; the awnings and the '
      + 'courtyard banner are the team-colour zones, and the banner carries no emblem at all.',
    fr: 'Un petit îlot de ville hôte sur une parcelle d’un mètre : trois ou quatre bâtiments bas de deux à '
      + 'trois étages autour d’une cour pavée, toits de tuiles, fenêtres à volets, auvent de terrasse de '
      + 'café, jardinières et râtelier à vélos. Chaleureux, habité, accueillant — c’est là qu’on loge les '
      + 'équipes en visite. Les fenêtres forment un matériau émissif à part pour la phase de nuit ; les '
      + 'stores et la banderole de cour sont les zones de couleur d’équipe, et la banderole ne porte aucun '
      + 'emblème.',
  },
  usine: {
    en: 'A tournament equipment works on a one-metre plot: a single-span hall with a sawtooth roof and '
      + 'glazed north lights, a wide roller shutter facing the front, an outside gantry with a chain hoist, '
      + 'stacked crates and a pallet of spare road wheels. It is a workshop, not a plant — clean floor, '
      + 'good light, tools on racks. Roller shutter and roof edge take the team colour; the north lights '
      + 'are emissive at night.',
    fr: 'Un atelier de matériel du tournoi sur une parcelle d’un mètre : halle d’une seule portée à toiture '
      + 'en sheds et verrières au nord, large rideau métallique en façade, portique extérieur à palan, '
      + 'caisses empilées et palette de galets de rechange. C’est un atelier, pas une usine : sol propre, '
      + 'bonne lumière, outils sur râteliers. Le rideau et la rive de toiture prennent la couleur d’équipe ; '
      + 'les verrières sont émissives la nuit.',
  },
  aeroport: {
    en: 'A rotorcraft pad on a one-metre plot: a circular concrete apron with a painted ring (a ring only, '
      + 'no letters), a low glazed control cabin on one side, a refuelling bowser, wind sock on a mast, and '
      + 'four ground lights at the cardinal points. Flat and open — nothing on it should be taller than the '
      + 'cabin. The cabin glazing and the four ground lights are emissive at night.',
    fr: 'Une aire pour voilures tournantes sur une parcelle d’un mètre : plateforme circulaire en béton à '
      + 'anneau peint (un anneau seul, aucune lettre), cabine de contrôle vitrée basse sur un côté, camion '
      + 'de ravitaillement, manche à air sur mât et quatre feux de sol aux points cardinaux. Plate et '
      + 'dégagée : rien n’y dépasse la hauteur de la cabine. Le vitrage de cabine et les quatre feux de sol '
      + 'sont émissifs la nuit.',
  },
  qg: {
    en: 'A team headquarters pavilion on a one-metre plot: a two-storey timber and glass building with a '
      + 'deep overhanging roof, an open first-floor balcony where the commander watches the field, a broad '
      + 'entrance canopy, and a tall bare flagpole with a plain unmarked pennant. It must be the most '
      + 'distinctive building on the board at a glance — taller, warmer, better lit. Roof edge, canopy and '
      + 'pennant are the team-colour zones.',
    fr: 'Un pavillon de quartier général sur une parcelle d’un mètre : bâtiment de deux niveaux en bois et '
      + 'verre, toit largement débordant, balcon ouvert à l’étage d’où le commandant regarde le terrain, '
      + 'auvent d’entrée généreux et mât nu portant un fanion uni sans marque. Ce doit être le bâtiment le '
      + 'plus reconnaissable du plateau d’un seul coup d’œil : plus haut, plus chaud, mieux éclairé. Rive de '
      + 'toit, auvent et fanion sont les zones de couleur d’équipe.',
  },
};

/** Ce qui pousse et ce qui affleure, biome par biome. */
const DECOR_BIOME: Record<Biome, { arbre: Bilingue; rocher: Bilingue }> = {
  plaine: {
    arbre: {
      en: 'a lone broad-crowned field oak with a short thick trunk, a wind-shaped asymmetric canopy and a '
        + 'ring of long grass at its foot',
      fr: 'un chêne de plein champ à couronne large, tronc court et épais, houppier dissymétrique formé par '
        + 'le vent et couronne d’herbes hautes au pied',
    },
    rocher: {
      en: 'a low field boulder of grey granite, half sunk in the turf, with a lichen crust on its upper face',
      fr: 'un bloc erratique de granit gris, à demi enfoncé dans l’herbe, croûté de lichen sur sa face '
        + 'supérieure',
    },
  },
  foret: {
    arbre: {
      en: 'a tall straight beech with a smooth silver trunk, a high dense crown and a clean understorey',
      fr: 'un hêtre haut et droit, tronc lisse et argenté, houppier dense en hauteur, sous-bois dégagé',
    },
    rocher: {
      en: 'a mossy sandstone block wedged between roots, dark and damp on its north face',
      fr: 'un bloc de grès moussu coincé entre des racines, sombre et humide sur sa face nord',
    },
  },
  montagne: {
    arbre: {
      en: 'a wind-bent mountain pine with a flattened crown, exposed roots gripping rock and a bare '
        + 'weathered leader',
      fr: 'un pin de montagne couché par le vent, couronne aplatie, racines apparentes agrippées au rocher, '
        + 'flèche nue et polie par les intempéries',
    },
    rocher: {
      en: 'an angular limestone block with sharp fracture planes and a scree collar at its base',
      fr: 'un bloc calcaire anguleux à plans de fracture nets, avec son collier d’éboulis à la base',
    },
  },
  desert: {
    arbre: {
      en: 'a flat-topped acacia with a thin twisted trunk, a wide sparse canopy and a hard cracked ground '
        + 'ring',
      fr: 'un acacia à cime plate, tronc fin et tordu, houppier large et clairsemé, sol dur et craquelé '
        + 'autour du pied',
    },
    rocher: {
      en: 'a wind-carved sandstone knob, ochre and banded, undercut at the base by blown sand',
      fr: 'une butte de grès sculptée par le vent, ocre et zonée, déchaussée à la base par le sable soufflé',
    },
  },
  jungle: {
    arbre: {
      en: 'a buttressed rainforest tree with plank roots, a straight bare trunk and a dense crown '
        + 'overhanging on one side, with a liana loop',
      fr: 'un grand arbre de forêt humide à contreforts, racines en planches, fût nu et droit, houppier dense '
        + 'débordant d’un côté, avec une boucle de liane',
    },
    rocher: {
      en: 'a dark basalt block almost buried under ferns and wet moss',
      fr: 'un bloc de basalte sombre presque enfoui sous les fougères et la mousse humide',
    },
  },
  neige: {
    arbre: {
      en: 'a narrow spruce loaded with snow, branches bent down, a dark green core showing through the '
        + 'white',
      fr: 'un épicéa étroit chargé de neige, branches ployées, cœur vert sombre visible sous le blanc',
    },
    rocher: {
      en: 'a rounded grey boulder with a snow cap and a wind-scoured dark flank',
      fr: 'un bloc gris arrondi coiffé de neige, avec un flanc sombre balayé par le vent',
    },
  },
  volcanique: {
    arbre: {
      en: 'a hardy pioneer tree on ash soil, sparse foliage, a soot-grey trunk and a low windbreak of scrub '
        + 'at its foot',
      fr: 'un arbre pionnier résistant sur sol de cendre, feuillage clairsemé, tronc gris de suie, et un '
        + 'brise-vent bas de broussailles au pied',
    },
    rocher: {
      en: 'a porous black lava block with a rough vesicular surface and rust-orange oxidation in the hollows',
      fr: 'un bloc de lave noire poreuse, surface vacuolaire rugueuse, oxydation orange rouille dans les '
        + 'creux',
    },
  },
  cotier: {
    arbre: {
      en: 'a salt-pruned maritime pine leaning inland, its canopy sheared flat on the seaward side',
      fr: 'un pin maritime taillé par le sel, penché vers l’intérieur, houppier rasé du côté de la mer',
    },
    rocher: {
      en: 'a sea-worn granite block with a barnacle band at its base and a dry pale top',
      fr: 'un bloc de granit poli par la mer, ceinture de balanes à la base, sommet sec et clair',
    },
  },
  archipel: {
    arbre: {
      en: 'a leaning coconut palm with a curved trunk, a ring of fronds and two nuts at the crown',
      fr: 'un cocotier penché, stipe courbe, couronne de palmes et deux noix à l’aisselle',
    },
    rocher: {
      en: 'a pitted coral limestone block, pale and sharp-edged, with a shell-strewn base',
      fr: 'un bloc de calcaire corallien alvéolé, clair et coupant, avec un pied semé de coquillages',
    },
  },
  marais: {
    arbre: {
      en: 'a pollarded willow with a swollen fissured trunk, thin whips at the top and a foot standing in '
        + 'reed and dark water',
      fr: 'un saule têtard au tronc renflé et fissuré, fines pousses au sommet, pied dans les roseaux et '
        + 'l’eau sombre',
    },
    rocher: {
      en: 'a half-submerged mud-caked stone with a waterline stain and reeds growing against it',
      fr: 'une pierre à demi immergée croûtée de vase, marquée d’une ligne d’eau, roseaux poussant contre '
        + 'elle',
    },
  },
};

/** Ce qui fait la présence d'un commandant, archétype par archétype. */
const TEXTES_ARCHETYPE: Record<string, Bilingue> = {
  stratege_prudent: {
    en: 'still, upright, hands clasped behind the back; a buttoned long coat over a high-collar sweater, '
      + 'reading glasses pushed up on the forehead, a rolled field notebook in a breast pocket',
    fr: 'immobile, droit, mains croisées dans le dos ; long manteau boutonné sur un pull à col montant, '
      + 'lunettes de lecture remontées sur le front, carnet de terrain roulé dans la poche de poitrine',
  },
  fonceuse: {
    en: 'caught mid-stride and leaning forward, sleeves shoved up, a training jacket half-open over a team '
      + 'vest, hair pulled back in a hurry, one glove still on',
    fr: 'saisie en plein élan, penchée en avant, manches remontées, veste d’entraînement à demi ouverte sur '
      + 'un maillot d’équipe, cheveux attachés à la hâte, un gant encore enfilé',
  },
  veteran: {
    en: 'broad-shouldered and slightly stooped, arms folded, a worn quilted jacket with mended elbows, a '
      + 'short grey beard, a thermos flask clipped to the belt',
    fr: 'large d’épaules et légèrement voûté, bras croisés, veste matelassée usée aux coudes rapiécés, barbe '
      + 'grise courte, gourde isotherme accrochée à la ceinture',
  },
  ingenieur: {
    en: 'leaning on one elbow as if over a workbench, sleeves rolled, a canvas apron with tool loops over '
      + 'work clothes, protective glasses on a cord, a folding rule in a chest pocket',
    fr: 'appuyé sur un coude comme au-dessus d’un établi, manches roulées, tablier de toile à passants '
      + 'd’outils par-dessus une tenue de travail, lunettes de protection au cordon, mètre pliant dans la '
      + 'poche de poitrine',
  },
  diplomate: {
    en: 'turned slightly as if greeting someone off to the side, one hand raised in a small open gesture; a '
      + 'tailored jacket over a scarf, a lanyard with a blank pass, an easy warm smile',
    fr: 'légèrement tournée comme si elle saluait quelqu’un sur le côté, une main levée en un petit geste '
      + 'ouvert ; veste ajustée sur une écharpe, cordon à badge vierge, sourire chaleureux et facile',
  },
  showman: {
    en: 'arms spread wide, chin up, playing to a crowd that is not in frame; an embroidered bomber jacket '
      + 'with the collar up, tinted glasses pushed into the hair, rings on both hands',
    fr: 'bras largement ouverts, menton haut, jouant pour un public hors champ ; blouson brodé au col '
      + 'relevé, lunettes teintées remontées dans les cheveux, bagues aux deux mains',
  },
  survivante: {
    en: 'compact and grounded, weight on the back foot, hands in pockets; a hooded technical jacket with '
      + 'the hood down, a thin scar-free weathered face, a whistle on a cord',
    fr: 'compacte et ancrée, poids sur la jambe arrière, mains dans les poches ; veste technique à capuche '
      + 'rabattue, visage mince et tanné, sifflet au cordon',
  },
  meteorologue: {
    en: 'head tilted up and slightly back, watching the sky, one hand shading the eyes; a long waxed '
      + 'raincoat, a knitted hat, a small handheld anemometer hanging at the hip',
    fr: 'tête relevée et un peu renversée, regardant le ciel, une main en visière ; long ciré, bonnet '
      + 'tricoté, petit anémomètre de poche pendu à la hanche',
  },
  prodige: {
    en: 'young and loose-limbed, hands in the front pocket of an oversized team hoodie, headphones around '
      + 'the neck, a slightly insolent tilt to the head',
    fr: 'jeune et dégingandé, mains dans la poche ventrale d’un sweat d’équipe trop grand, casque autour du '
      + 'cou, tête légèrement inclinée avec insolence',
  },
  gardienne: {
    en: 'planted square, feet apart, arms crossed low, absolutely still; a heavy padded coat with a high '
      + 'collar, gloves tucked in the belt, a calm level gaze straight ahead',
    fr: 'plantée d’aplomb, pieds écartés, bras croisés bas, parfaitement immobile ; manteau matelassé lourd '
      + 'à col haut, gants glissés dans la ceinture, regard calme et droit devant',
  },
};

// ---------------------------------------------------------------------------
// 4. Fabriques par famille
// ---------------------------------------------------------------------------

/** Dimensions cibles d'une unité, déduites de sa base et de son encombrement. */
function echelleUnite(s: Silhouette): Echelle {
  if (s.base === 'pattes') return echelle(0.45, 0.6, 0.45, 0.06);
  if (s.base === 'rotor') return echelle(0.9, 0.65, 0.9, 0.09);
  if (s.base === 'ailes') return echelle(0.95, 0.45, 0.85, 0.09);
  if (s.taille === 1) return echelle(0.5, 0.4, 0.7, 0.06);
  if (s.taille === 2) return echelle(0.62, 0.5, 0.85, 0.07);
  return echelle(0.7, 0.58, 0.95, 0.08);
}

/** Budget de triangles d'une unité : l'encombrement paie la géométrie. */
function budgetUnite(s: Silhouette): Budget {
  const materiaux = s.modules.length > 0 ? 3 : 2;
  if (s.base === 'pattes') return budget(4000, materiaux);
  if (s.taille === 1) return budget(3500, materiaux);
  if (s.taille === 2) return budget(6000, materiaux);
  return budget(9000, materiaux);
}

/** Les clips attendus d'une unité : ce qu'elle sait faire, et rien d'autre. */
function animationsUnite(u: UnitType): AnimationSpec[] {
  const clips: AnimationSpec[] = [
    anim('repos', 2400, true),
    anim('deplacement', 1000, true),
  ];
  const peutMarquer = Object.values(u.degats).some((d) => (d ?? 0) > 0);
  if (peutMarquer) clips.push(anim('tir', 700, false));
  clips.push(anim('touche', 500, false));
  clips.push(anim('hors_jeu', 900, false));
  if (u.traits.includes('capture')) clips.push(anim('capture', 1300, false));
  return clips;
}

/**
 * Une spécification de **géométrie de base** d'unité : le maillage que les
 * vingt-quatre nations partagent, et sur lequel chaque kit se peint.
 *
 * **Une seule forme** (décision du propriétaire, 9 septembre 2026). La base
 * annonçait trois gabarits `a`, `b`, `c` qu'un kit venait choisir, mais rien ne
 * les nommait : `nommage.modele` vaut `{id}_lod{lod}.glb`, sans place pour la
 * forme, et le validateur n'avait donc rien à contrôler. Un générateur à qui on
 * commandait « le gabarit B » réclamait un fichier qui ne pouvait pas exister.
 * Une unité de base = **une géométrie partagée + un kit national**. Le masque
 * d'équipe reste demandé ici, et ici seulement pour le corps entier : c'est le
 * repli du placeholder, tant qu'aucun kit n'est livré.
 */
export function specUnite(u: UnitType): AssetSpec {
  const s = u.silhouette;
  const cle = cleUniteBase(u.cle);
  const id = idAsset('unite', cle);
  const phrase = phraseSilhouette(u);
  const propre = TEXTES_UNITE[u.cle];
  const generique: Bilingue = {
    en: `Tournament equipment "${u.nom}", homologated for the Atlas Games: a ground vehicle built on `
      + `${BASE_EN[s.base]} carrying ${CORPS_EN[s.corps]} and ${modulesEn(s)}. Clean panels, `
      + 'purposeful details, no markings.',
    fr: `Matériel homologué « ${u.nom} » des Jeux Tactiques : un engin bâti sur ${BASE_FR[s.base]} `
      + `portant ${CORPS_FR[s.corps]} et ${modulesFr(s)}. Tôles nettes, détails utiles, aucune marque.`,
  };
  const base = propre ?? generique;
  const modules = s.modules.map((m) => `module_${m}`);
  const materiaux = ['mat_corps', ...(s.modules.length > 0 ? ['mat_details'] : [])];
  const textures: TextureSpec[] = [
    tex('albedo', 1024, true, 'Couleurs de base ; les zones d’équipe restent neutres, la teinte vient du masque.'),
    tex('normale', 1024, true, 'Relief de tôlerie, rivets, tissus et grain de caoutchouc.'),
    tex('rugosite', 512, true, 'Contraste métal poli / peinture mate / caoutchouc : c’est elle qui vend la matière.'),
    tex('metal', 512, false, 'Seulement si des pièces nues subsistent ; une valeur uniforme sinon.'),
    tex('masque_equipe', 512, true, 'Blanc = couleur de nation, noir = neutre. Un seul canal, sans dégradé sale.'),
  ];
  if (s.modules.includes('radar') || s.modules.includes('nacelle')) {
    textures.push(tex('emission', 512, false, 'Écrans et veilleuses, pour la phase de nuit.'));
  }
  return {
    id,
    type: 'unite',
    cle,
    priorite: 1,
    description: {
      en: `${base.en} ${phrase.en} ${u.factionExclusive ? 'Exclusive to the unknown Meridian faction; no national variants are commissioned. ' : ''}This is the SHARED BASE GEOMETRY: it carries no national livery and no `
        + 'ornament. One shape, one skeleton, one UV layout, one node naming — every national kit is painted '
        + 'on this exact mesh. Bulk stays roughly one half to two thirds of a tile so that two adjacent units '
        + 'never touch.',
      fr: `${base.fr} ${phrase.fr} ${u.factionExclusive ? 'Unité exclusive de la faction méridienne inconnue : aucune déclinaison nationale commandée. ' : ''}C’est la GÉOMÉTRIE DE BASE PARTAGÉE : elle ne porte ni livrée nationale `
        + 'ni ornement. Une seule forme, un squelette, un dépliage, un jeu de noms de nœuds — tout kit national '
        + 'se peint sur ce maillage-là. L’encombrement reste d’environ la moitié aux deux tiers d’une case, '
        + 'pour que deux unités voisines ne se touchent jamais.',
    },
    style: style(['tournament vehicle', 'crisp panel lines', 'neutral undressed base mesh']),
    echelle: echelleUnite(s),
    pivot: pivot(u.domaine !== 'air'),
    budget: ['barge', 'artillerie', 'infanterie', 'antiair', 'char_leger'].includes(u.cle) ? budget(1000000, u.cle === 'infanterie' ? 2 : 3) : budgetUnite(s),
    textures: ['barge', 'artillerie', 'infanterie', 'antiair', 'char_leger'].includes(u.cle) ? textures.map(t => (['albedo', 'normale'].includes(t.canal) || (['artillerie', 'infanterie', 'antiair', 'char_leger'].includes(u.cle) && ['rugosite', 'metal'].includes(t.canal))) ? { ...t, resolution: 4096 as const } : t) : textures,
    variantes: variantes(['hiver']),
    animations: animationsUnite(u),
    format: format(['corps', 'base', 'socle', ...modules], materiaux),
    nommage: nommage(id, 'albedo', 'hiver'),
    interdits: interdits(),
    verification: verification(
      ['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'masque_equipe', 'animations'],
      0.12,
      [0],
    ),
  };
}

/**
 * Une spécification de **kit national** : les textures complètes d'une nation
 * pour une unité de base, plus ses ornements. La géométrie n'est pas la sienne :
 * elle est celle de la base, livrée, et le kit se peint dessus sans la toucher.
 *
 * Ce n'est pas un masque teinté (`BRIEF.md`) : l'albédo est peint pour cette
 * nation et pour elle seule. Le seul masque d'équipe qui subsiste est réduit au
 * **liseré du socle**, pour qu'on distingue deux camps de la même nation dans un
 * match miroir — jamais pour porter la couleur du pays.
 */
export function specKit(styleNation: StyleNation, u: UnitType): AssetSpec {
  const base = specUnite(u);
  const cle: Cle = `${styleNation.code}_${u.cle}`;
  const id = idKit(styleNation.code, u.cle);
  const ornements = styleNation.ornements;
  const decals = styleNation.decalcomanies;
  const decalEn = decals
    .map((d) => `${MOTIF[d.motif][0]} in ${d.couleur} on the ${d.placement}`)
    .join('; ');
  const decalFr = decals
    .map((d) => `${MOTIF[d.motif][1]} en ${d.couleur} sur ${d.placement === 'socle' ? 'le socle' : `la zone « ${d.placement} »`}`)
    .join(' ; ');
  const accents = styleNation.palette.accents.join(', ');
  return {
    id,
    type: 'kit',
    cle,
    priorite: styleNation.priorite,
    description: {
      en: `National kit for "${u.nom}" in the colours and materials of ${styleNation.nom}. Guiding line: `
        + `${styleNation.ligneDirectrice.en} Paint the delivered base mesh of unite_${cleUniteBase(u.cle)}, `
        + `unchanged: same geometry, same UV layout, same node names and animation clips. Pigment palette: base ${styleNation.palette.main}, dark paint `
        + `${styleNation.palette.dark}, light paint ${styleNation.palette.light}, accents ${accents}. `
        + `Materials to read at a glance: ${liste(MATIERE, styleNation.matieres, true)}. Finish: `
        + `${liste(FINITION, styleNation.finitions, true)}. Paint these ornament motifs into the existing UV layout, with normal-map detail only, and `
        + `nothing else: ${liste(ORNEMENT, ornements, true)}. Abstract decals only: ${decalEn}. No added nodes, geometry, baked shadows or painted highlights. For colour-blind `
        + `readability an existing team-colour panel carries ${MOTIF[styleNation.motifDaltonien][0]}, unique to this nation. `
        + 'This is a full texture set, not a tinted mask: the albedo is painted for this nation alone. The only '
        + 'team mask left is a narrow band within the inherited team-colour panels, so two players of the same nation stay apart.',
      fr: `Kit national de « ${u.nom} » aux couleurs et aux matières du style « ${styleNation.nom} ». `
        + `Ligne directrice : ${styleNation.ligneDirectrice.fr} Peindre la géométrie de base livrée `
        + `unite_${cleUniteBase(u.cle)}, telle quelle : même géométrie, même dépliage, mêmes noms de nœuds et mêmes clips. Palette de pigments : fond `
        + `${styleNation.palette.main}, peinture sombre ${styleNation.palette.dark}, peinture claire `
        + `${styleNation.palette.light}, accents ${accents}. Matières à lire d’un coup d’œil : `
        + `${liste(MATIERE, styleNation.matieres, false)}. Finition : ${liste(FINITION, styleNation.finitions, false)}. `
        + `Peindre ces motifs ornementaux dans les UV existants, avec du détail en carte normale seulement : ${liste(ORNEMENT, ornements, false)}. `
        + `Décalcomanies abstraites seulement : ${decalFr}. Aucun ajout de géométrie, de nœud, d’ombre ou de reflet peint. Pour la lisibilité sans couleur, un panneau d’équipe existant porte `
        + `${MOTIF[styleNation.motifDaltonien][1]}, propre à cette nation. C’est un jeu de textures complet et `
        + 'non un masque teinté : l’albédo est peint pour cette nation et pour elle seule. Le seul masque '
        + 'd’équipe qui subsiste est un liseré étroit dans les panneaux d’équipe hérités, pour que deux joueurs d’une même nation '
        + 'restent distincts. Livrer le kit monté sur la géométrie de base — le maillage habillé — pour qu’il '
        + 'se contrôle tel qu’il apparaîtra en jeu.',
    },
    style: style(['national livery kit', 'hand-painted texture set', 'closed ornament vocabulary'], [
      'no tinted grey base coat pretending to be a livery',
    ]),
    echelle: base.echelle,
    pivot: pivot(u.domaine !== 'air'),
    budget: base.budget,
    textures: [
      tex('albedo', 1024, true, 'Peinture nationale complète : couleurs, matières et décalcomanies déjà en place.'),
      tex('normale', 1024, true, 'Relief propre au kit : coutures, sangles, panneaux rapportés, grain des matières.'),
      tex('rugosite', 512, true, 'C’est elle qui sépare une peinture mate d’un acier brossé : prévoir du contraste.'),
      tex('metal', 512, false, 'Seulement si le style demande du laiton, du cuivre ou de l’acier nu.'),
      tex('masque_equipe', 256, true, 'Liseré dans les zones d’équipe de la base : blanc = liseré gris neutre dans l’albédo, noir = tout le reste.'),
      ...base.textures.filter((t) => t.canal === 'emission' || t.canal === 'occlusion'),
    ],
    variantes: variantes(['hiver'], [], [styleNation.code]),
    animations: base.animations,
    format: base.format,
    nommage: nommage(id, 'albedo', 'hiver'),
    interdits: interdits(),
    verification: verification(
      ['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'masque_equipe', 'textures', 'animations'],
      0.14,
      [0],
    ),
  };
}

/** Relief cible d'un terrain, en mètres (`doc/10-rendu-3d.md` §4). */
const RELIEF_TERRAIN: Record<string, number> = {
  plaine: 0.14, foret: 0.09, montagne: 0.95, route: 0.05,
  plage: 0.06, riviere: 0.06, pont: 0.32, mer: 0.04,
};

/** Biomes où chaque terrain se décline. */
const BIOMES_TERRAIN: Record<string, Biome[]> = {
  plaine: ['plaine', 'foret', 'montagne', 'desert', 'jungle', 'neige', 'volcanique', 'cotier', 'marais'],
  foret: ['plaine', 'foret', 'montagne', 'jungle', 'neige', 'marais'],
  montagne: ['montagne', 'neige', 'volcanique', 'archipel'],
  route: ['plaine', 'foret', 'montagne', 'desert', 'jungle', 'neige', 'volcanique', 'cotier'],
  plage: ['cotier', 'archipel', 'jungle', 'marais'],
  riviere: ['plaine', 'foret', 'montagne', 'jungle', 'marais'],
  pont: ['plaine', 'foret', 'montagne', 'jungle', 'marais', 'cotier'],
  mer: ['cotier', 'archipel'],
};

/** Une spécification de terrain : une plaque raccordable d'une case de côté. */
export function specTerrain(t: Terrain): AssetSpec {
  const id = idAsset('terrain', t.cle);
  const hauteur = RELIEF_TERRAIN[t.cle] ?? 0.06;
  const volume = ['montagne', 'pont'].includes(t.cle);
  const tournable = ['plaine', 'foret', 'montagne'].includes(t.cle);
  const lourd = t.cle === 'montagne';
  const moyen = t.cle === 'pont';
  const texte = TEXTES_TERRAIN[t.cle];
  return {
    id,
    type: 'terrain',
    cle: t.cle,
    priorite: 1,
    description: {
      en: `${texte?.en ?? `A one-metre tileable ground patch for the "${t.nom}" tile.`} `
        + `Grid tile "${t.car}", defence ${t.defense} of 4. The patch is exactly one metre square in plan `
        + (tournable ? 'with compatible edges under quarter turns. ' : 'with directional connections; rotate only together with its road, bridge or shoreline axis. ')
        + (t.cle === 'plaine' ? 'A flat 0.02 m base carries curved grass blades 6–12 cm high and sparse low clover, up to 0.14 m total height. Separate grass with mat_herbe; retain one sol node. Broad terrain undulation belongs to the renderer.' : volume ? 'Build the volume described above within the stated dimensions.'
          : `Deliver a constant-thickness flat slab (${hauteur} m). Surface undulation and altitude are applied by the renderer; do not model them.`),
      fr: `${texte?.fr ?? `Une plaque de sol raccordable d’un mètre pour la case « ${t.nom} ».`} `
        + `Caractère de grille « ${t.car} », défense ${t.defense} sur 4. Exactement un mètre carré en plan. `
        + (tournable ? 'Bords compatibles après un quart de tour. ' : 'Raccords directionnels : respecter l’axe de la voie ou du rivage. ')
        + (t.cle === 'plaine' ? 'Une base plane de 0.02 m porte des brins courbés de 6 à 12 cm et quelques trèfles bas, hauteur totale 0.14 m. Séparer la végétation avec mat_herbe, conserver le nœud sol. Les ondulations du terrain appartiennent au rendu.' : volume ? 'Construire le volume décrit dans les dimensions imposées.'
          : `Livrer une dalle plane d’épaisseur constante (${hauteur} m). Le rendu applique l’altitude et les ondulations ; ne pas les modeler.`),
    },
    style: style(['tileable ground patch', 'photoscan-like surface detail', 'seasonal variants']),
    echelle: { ...echelle(1, hauteur, 1, 0.04), x: { cible: 1, tolerance: 0 }, z: { cible: 1, tolerance: 0 }, ...(t.cle === 'plaine' ? { y: { cible: 0.14, tolerance: 0.002 } } : {}) },
    pivot: pivot(true),
    budget: t.cle === 'plaine' ? budget(2400, 2) : lourd ? budget(2400, 2) : moyen ? budget(1200, 2) : budget(800, 2),
    textures: [
      tex('albedo', 1024, true, 'Couleurs de surface, sans ombre peinte ni éclairage cuit.'),
      tex('normale', 1024, true, 'Le grain qui fait la matière à faible incidence de lumière.'),
      tex('rugosite', 1024, true, 'C’est elle qui montre le sol mouillé sous la pluie : prévoir du contraste.'),
      tex('occlusion', 512, false, 'Facultative : creux et jointures, si la géométrie ne suffit pas.'),
    ],
    variantes: variantes(QUATRE_SAISONS, BIOMES_TERRAIN[t.cle] ?? ['plaine']),
    animations: [],
    format: format(['sol'], t.cle === 'plaine' ? ['mat_sol','mat_herbe'] : ['mat_sol']),
    nommage: nommage(id, 'albedo', 'hiver'),
    interdits: interdits(),
    verification: verification(['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'textures'], 0, [0]),
  };
}

/** Hauteur et budget des quatre bâtiments. */
const GABARIT_BATIMENT: Record<string, { x: number; y: number; z: number; tris: [number, number, number] }> = {
  ville: { x: 0.85, y: 0.7, z: 0.85, tris: [5000, 1600, 450] },
  usine: { x: 0.9, y: 0.8, z: 0.9, tris: [5600, 1800, 500] },
  aeroport: { x: 0.92, y: 0.45, z: 0.92, tris: [4200, 1400, 400] },
  qg: { x: 0.85, y: 0.95, z: 0.85, tris: [6500, 2100, 600] },
};

/**
 * Un **territoire** : ce dont un bâtiment et un décor prennent le style.
 *
 * Pour la France, c'est une **région** — l'ardoise en Bretagne, la tuile ronde
 * en Provence, la case créole aux Antilles. Pour les vingt-trois autres pays,
 * c'est le **pays** entier, avec son style national. C'est exactement le
 * découpage que le brief impose au pipeline.
 */
export interface Territoire {
  pays: Country;
  styleNation: StyleNation;
  region: Region | null;
  styleRegion: StyleRegion | null;
  priorite: Priorite;
}

/** Le nom lisible d'un territoire : « Bretagne » ou « Japon ». */
function nomTerritoire(t: Territoire): string {
  return t.region ? t.region.nom : t.pays.nom;
}

/** Le suffixe d'identifiant d'un territoire : `fr_bretagne` ou `jp`. */
function cleTerritoire(t: Territoire): Cle {
  return t.region ? `${t.pays.code}_${slugRegion(t.region.code)}` : t.pays.code;
}

/**
 * La consigne de style d'un territoire, en deux langues : toits, murs,
 * végétation et éléments de décor pour une région, matières et finitions du
 * style national pour un pays.
 */
function consigneTerritoire(t: Territoire): Bilingue {
  const s = t.styleRegion;
  if (s) {
    return {
      en: `Regional style of ${t.region?.nom ?? ''} (${s.ligneDirectrice.en}): roofs are `
        + `${FORME_TOIT[s.toits.forme][0]} in ${MATIERE[s.toits.matiere][0]}, colour ${s.toits.couleur}; walls are `
        + `${MATIERE[s.murs.matiere][0]}, colour ${s.murs.couleur}, ${FINITION[s.murs.finition][0]}; the planting `
        + `around it is ${s.vegetation.dominante} with ${s.vegetation.secondaire}, foliage ${s.vegetation.couleur}. `
        + `Dress the plot with ${liste(ELEMENT_DECOR, s.elementsDecor, true)}, and with nothing else.`,
      fr: `Style régional de ${t.region?.nom ?? ''} (${s.ligneDirectrice.fr}) : toiture en `
        + `${FORME_TOIT[s.toits.forme][1]} de ${MATIERE[s.toits.matiere][1]}, couleur ${s.toits.couleur} ; murs en `
        + `${MATIERE[s.murs.matiere][1]}, couleur ${s.murs.couleur}, finition ${FINITION[s.murs.finition][1]} ; `
        + `autour, ${s.vegetation.dominante} et ${s.vegetation.secondaire}, feuillage ${s.vegetation.couleur}. `
        + `Habiller la parcelle avec ${liste(ELEMENT_DECOR, s.elementsDecor, false)}, et rien d’autre.`,
    };
  }
  const n = t.styleNation;
  return {
    en: `National style of ${t.pays.nom} (${n.ligneDirectrice.en}): materials are `
      + `${liste(MATIERE, n.matieres, true)}, finish ${liste(FINITION, n.finitions, true)}, base colour `
      + `${n.palette.main} with accents ${n.palette.accents.join(', ')}. Biomes on its maps: `
      + `${t.pays.biomes.join(', ')}.`,
    fr: `Style national ${t.pays.nom} (${n.ligneDirectrice.fr}) : matières en `
      + `${liste(MATIERE, n.matieres, false)}, finition ${liste(FINITION, n.finitions, false)}, couleur de fond `
      + `${n.palette.main} et accents ${n.palette.accents.join(', ')}. Biomes de ses cartes : `
      + `${t.pays.biomes.join(', ')}.`,
  };
}

/**
 * Une spécification de bâtiment, **par région pour la France et par pays
 * sinon** : capturable, donc coloré et éclairé, et habillé du style local.
 */
export function specBatiment(t: Terrain, territoire: Territoire): AssetSpec {
  const cle: Cle = `${t.cle}_${cleTerritoire(territoire)}`;
  const id = idBatiment(t.cle, territoire.pays.code, territoire.region ? slugRegion(territoire.region.code) : undefined);
  const g = GABARIT_BATIMENT[t.cle] ?? { x: 0.85, y: 0.7, z: 0.85, tris: [5000, 1600, 450] as [number, number, number] };
  const texte = TEXTES_TERRAIN[t.cle];
  const revenus = t.revenus > 0 ? `Il rapporte ${t.revenus} fonds par journée.` : '';
  const revenusEn = t.revenus > 0 ? `It yields ${t.revenus} funds per day.` : '';
  const consigne = consigneTerritoire(territoire);
  return {
    id,
    type: 'batiment',
    cle,
    priorite: territoire.priorite,
    description: {
      en: `${texte?.en ?? `A capturable "${t.nom}" building on a one-metre plot.`} ${revenusEn} ${consigne.en} `
        + 'It is a capturable point: it changes owner during a match, so every surface that carries the '
        + 'team colour must be readable from directly above as well as from the default camera angle. '
        + 'Leave a clear flat approach on at least one side so a unit standing on the tile is never hidden.',
      fr: `${texte?.fr ?? `Un bâtiment capturable « ${t.nom} » sur une parcelle d’un mètre.`} ${revenus} `
        + `${consigne.fr} C’est un point capturable : il change de propriétaire pendant un match, donc chaque `
        + 'surface qui porte la couleur d’équipe doit se lire aussi bien à la verticale que sous l’angle de '
        + 'caméra par défaut. Laisser un accès plat et dégagé sur au moins un côté, pour qu’une unité posée '
        + 'sur la case ne soit jamais cachée.',
    },
    style: style(['host-town architecture', 'warm lived-in details', 'emissive windows at night',
      'regional building vernacular']),
    echelle: echelle(g.x, g.y, g.z, 0.07),
    pivot: pivot(true),
    budget: budget(g.tris[0], 3),
    textures: [
      tex('albedo', 1024, true, 'Enduits, tuiles, bois et béton ; aucune enseigne lisible, aucun chiffre.'),
      tex('normale', 1024, true, 'Joints de maçonnerie, bardages, tuiles, encadrements.'),
      tex('rugosite', 512, true, 'Verre lisse, enduit mat, tuile poreuse : trois familles bien séparées.'),
      tex('emission', 512, true, 'Fenêtres et lanterneaux éclairés : c’est ce qui fait la nuit du jeu.'),
      tex('masque_equipe', 512, true, 'Stores, rives de toit, fanion : les surfaces qui prennent la nation.'),
    ],
    variantes: variantes(['ete', 'hiver'], [], [territoire.pays.code]),
    animations: [anim('repos', 3200, true), anim('capture', 1400, false), anim('touche', 400, false, false)],
    format: format(['corps', 'toit', 'enseigne'], ['mat_corps', 'mat_vitrage']),
    nommage: nommage(id, 'emission', 'hiver'),
    interdits: interdits(),
    verification: verification(
      ['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'masque_equipe', 'animations'],
      0.08,
      [0],
    ),
  };
}

/**
 * Une spécification d'arbre, pour un biome **dans un territoire donné** : la
 * végétation d'une région de France ou d'un pays. C'est là que passe le « style
 * régional du décor » du brief — les ajoncs bretons ne sont pas les balisiers
 * martiniquais, même si les deux sont du décor de biome.
 */
export function specArbre(biome: Biome, territoire: Territoire): AssetSpec {
  const cle: Cle = `arbre_${biome}_${cleTerritoire(territoire)}`;
  const id = idDecor('arbre', biome, territoire.pays.code,
    territoire.region ? slugRegion(territoire.region.code) : undefined);
  const d = DECOR_BIOME[biome];
  const consigne = consigneTerritoire(territoire);
  const lieu = nomTerritoire(territoire);
  return {
    id,
    type: 'decor',
    cle,
    priorite: territoire.priorite,
    description: {
      en: `A single tree for the "${biome}" biome as it grows in ${lieu}: ${d.arbre.en}. ${consigne.en} `
        + 'It is instanced hundreds of times per map, so it must look good from every side and never show a '
        + 'face that identifies it as the same model. Model the trunk and the foliage as two separate named '
        + 'nodes; foliage uses alpha-tested cards clustered into three or four dense clumps, never a single '
        + 'flat billboard. Keep the crown clear of the tile edges so it does not overhang a neighbouring unit.',
      fr: `Un arbre isolé du biome « ${biome} », tel qu’il pousse en ${lieu} : ${d.arbre.fr}. ${consigne.fr} `
        + 'Il est instancié des centaines de fois par carte : il doit tenir sous tous les angles et ne jamais '
        + 'montrer une face qui le trahisse comme le même modèle. Tronc et feuillage sont deux nœuds nommés '
        + 'distincts ; le feuillage est fait de cartes à découpe alpha groupées en trois ou quatre touffes '
        + 'denses, jamais un panneau plat unique. Garder la couronne à l’intérieur des bords de la case, pour '
        + 'ne pas déborder sur une unité voisine.',
    },
    style: style(['instanced vegetation', 'alpha-tested foliage clusters', 'seasonal foliage variants',
      'regional planting']),
    echelle: echelle(0.55, 0.62, 0.55, 0.09),
    pivot: pivot(true),
    budget: budget(2500, 2),
    textures: [
      tex('albedo', 1024, true, 'Écorce et feuillage sur un seul atlas ; canal alpha net, sans halo.'),
      tex('normale', 512, true, 'Nervures des feuilles et relief d’écorce.'),
      tex('rugosite', 512, true, 'Feuille cireuse contre écorce sèche : deux valeurs franchement séparées.'),
    ],
    variantes: variantes(QUATRE_SAISONS, [biome], [territoire.pays.code]),
    animations: [anim('repos', 3600, true)],
    format: format(['tronc', 'feuillage'], ['mat_ecorce', 'mat_feuillage']),
    nommage: nommage(id, 'albedo', 'automne'),
    interdits: interdits(),
    verification: verification(
      ['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'animations'],
      0.15,
      [0],
    ),
  };
}

/**
 * Une spécification de rocher, pour un biome donné. Le rocher reste **par
 * biome et non par territoire** : la roche est une affaire de géologie, pas de
 * culture, et un bloc de granit breton se sculpte comme un bloc de granit
 * corse. Il est partagé par toutes les nations, donc de priorité 1.
 */
export function specRocher(biome: Biome): AssetSpec {
  const cle: Cle = `rocher_${biome}`;
  const id = idAsset('decor', cle);
  const d = DECOR_BIOME[biome];
  return {
    id,
    type: 'decor',
    cle,
    priorite: 1,
    description: {
      en: `A single rock for the "${biome}" biome: ${d.rocher.en}. Low enough that a unit standing behind `
        + 'it is never hidden, and irregular enough that four copies rotated by ninety degrees read as four '
        + 'different rocks. Sculpt real fracture planes rather than noise; the silhouette matters more than '
        + 'the surface, because at the default zoom this asset is about thirty pixels tall.',
      fr: `Un rocher isolé pour le biome « ${biome} » : ${d.rocher.fr}. Assez bas pour qu’une unité placée `
        + 'derrière ne soit jamais cachée, et assez irrégulier pour que quatre copies tournées d’un quart de '
        + 'tour se lisent comme quatre rochers différents. Sculpter de vrais plans de fracture plutôt que du '
        + 'bruit : la silhouette compte plus que la surface, parce qu’au zoom par défaut cet asset fait une '
        + 'trentaine de pixels de haut.',
    },
    style: style(['instanced rock', 'real fracture planes', 'lichen and weathering']),
    echelle: echelle(0.45, 0.3, 0.45, 0.08),
    pivot: pivot(true),
    budget: budget(900, 2),
    textures: [
      tex('albedo', 1024, true, 'Roche et lichen ; pas d’ombre peinte, l’éclairage vient de la scène.'),
      tex('normale', 512, true, 'Grain minéral et arêtes de fracture.'),
      tex('rugosite', 512, true, 'Faces polies contre faces cassées : c’est le contraste qui fait la pierre.'),
    ],
    variantes: variantes(['ete', 'hiver'], [biome]),
    animations: [],
    format: format(['bloc'], ['mat_roche']),
    nommage: nommage(id, 'albedo', 'hiver'),
    interdits: interdits(),
    verification: verification(['format', 'noeuds', 'materiaux', 'echelle', 'budget'], 0.15, [0]),
  };
}

/** Une spécification de buste de commandant, pour un archétype. */
export function specCommandant(
  cle: Cle, libelle: string, temperament: string, priorite: Priorite = 2,
): AssetSpec {
  const id = idAsset('commandant', cle);
  const t = TEXTES_ARCHETYPE[cle];
  return {
    id,
    type: 'commandant',
    cle,
    priorite,
    description: {
      en: `A three-quarter bust portrait for the "${libelle}" commander archetype, shown from the waist up `
        + `and posed as follows: ${t?.en ?? 'standing calmly, arms at the sides, in team training kit'}. `
        + `Temperament to convey: ${temperament}. This bust is displayed large in the interface during `
        + 'briefings and power activations, so the face carries the whole asset: sculpt real bone structure, '
        + 'asymmetric features and a specific age. The archetype is worn by two or three different nations, '
        + 'so the face must stay culturally neutral and the outfit unbranded — the nation is expressed by '
        + 'the team-colour mask on the jacket and collar, nothing else.',
      fr: `Un buste de portrait aux trois quarts pour l’archétype de commandant « ${libelle} », montré à `
        + `mi-corps et posé ainsi : ${t?.fr ?? 'debout calmement, bras le long du corps, en tenue d’équipe'}. `
        + `Tempérament à faire passer : ${temperament}. Ce buste est affiché en grand dans l’interface `
        + 'pendant les briefings et les activations de pouvoir : le visage porte tout l’asset, il faut '
        + 'sculpter une vraie ossature, des traits dissymétriques et un âge précis. L’archétype est porté '
        + 'par deux ou trois nations différentes : le visage reste culturellement neutre et la tenue sans '
        + 'marque — la nation s’exprime par le masque de couleur d’équipe sur la veste et le col, et par '
        + 'rien d’autre.',
    },
    style: style(['character bust portrait', 'sports team apparel', 'expressive but restrained face'], [
      'no exaggerated caricature', 'no military uniform or rank insignia',
    ]),
    echelle: echelle(0.55, 0.9, 0.45, 0.08),
    pivot: pivot(true),
    budget: budget(14000, 3),
    textures: [
      tex('albedo', 2048, true, 'Peau, cheveux et tissus ; le visage occupe la moitié de l’espace de carte.'),
      tex('normale', 1024, true, 'Pores, rides, mailles de tricot et coutures.'),
      tex('rugosite', 512, true, 'Peau contre tissu technique contre cuir : trois familles nettes.'),
      tex('masque_equipe', 512, true, 'Veste et col : les seules surfaces qui prennent la couleur de nation.'),
    ],
    variantes: variantes([]),
    animations: [anim('repos', 2800, true)],
    format: format(['buste', 'tete'], ['mat_peau', 'mat_tenue', 'mat_cheveux']),
    nommage: nommage(id, 'albedo', 'hiver'),
    interdits: interdits(),
    verification: verification(
      ['format', 'noeuds', 'materiaux', 'echelle', 'budget', 'masque_equipe', 'animations'],
      0.1,
      [0],
    ),
  };
}

// ---------------------------------------------------------------------------
// 5. Le catalogue complet
// ---------------------------------------------------------------------------

/** Combien de spécifications chaque famille produit, pour le bilan du script. */
export type BilanSpecs = Record<TypeAsset, number>;

/** Les variantes régionales sont suspendues : un territoire de production par nation. */
export function territoires(): Territoire[] {
  return chargerPays().flatMap(pays => {
    const styleNation = chargerStyleNation(pays.code);
    return styleNation ? [{ pays, styleNation, region: null, styleRegion: null, priorite: styleNation.priorite }] : [];
  });
}

/**
 * Produit toutes les spécifications d'assets depuis le canon, triées par
 * identifiant. Fonction pure : deux appels donnent le même tableau, ce qui rend
 * `assets/specs/` reproductible et donc relisible en revue de code.
 *
 * Cinq familles y entrent, dans l'ordre du brief : les **géométries de base**
 * d'unité (partagées), les **kits nationaux** (24 × 10), les **terrains**
 * (neutres), les **bâtiments et le décor par territoire**, et les **bustes de
 * commandant** par archétype.
 */
export function genererSpecs(): AssetSpec[] {
  const specs: AssetSpec[] = [];
  const unites = chargerUnites();

  for (const u of unites) specs.push(specUnite(u));
  for (const styleNation of chargerStylesNations()) {
    for (const u of unites) if (!u.factionExclusive) specs.push(specKit(styleNation, u));
  }

  const capturables = new Set<string>(TERRAINS_CAPTURABLES);
  const terrains = chargerTerrains();
  for (const t of terrains) {
    if (!capturables.has(t.cle)) specs.push(specTerrain(t));
  }

  for (const territoire of territoires()) {
    for (const t of terrains) {
      if (capturables.has(t.cle)) specs.push(specBatiment(t, territoire));
    }
    const biomes = territoire.region ? [territoire.region.biome] : territoire.pays.biomes;
    for (const b of biomes) specs.push(specArbre(b, territoire));
  }

  for (const b of BIOMES) specs.push(specRocher(b));

  // Un archétype qu'aucune nation de priorité 1 ne porte attend son tour : le
  // buste du prodige part avec la France, celui de la fonceuse plus tard.
  const prioriteArchetype = new Map<string, Priorite>();
  for (const pays of chargerPays()) {
    const p = chargerStyleNation(pays.code)?.priorite ?? 3;
    const connue = prioriteArchetype.get(pays.archetypeCommandant);
    if (connue === undefined || p < connue) prioriteArchetype.set(pays.archetypeCommandant, p);
  }
  for (const a of chargerArchetypes()) {
    specs.push(specCommandant(a.cle, a.libelle, a.temperament, prioriteArchetype.get(a.cle) ?? 3));
  }

  specs.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return specs;
}

/** Compte les spécifications par famille. */
export function bilanSpecs(specs: readonly AssetSpec[]): BilanSpecs {
  const bilan: BilanSpecs = {
    unite: 0, kit: 0, terrain: 0, batiment: 0, decor: 0, commandant: 0, effet: 0,
  };
  for (const s of specs) bilan[s.type] += 1;
  return bilan;
}

/** Compte les spécifications par priorité de production : 1, 2, 3. */
export function bilanPriorites(specs: readonly AssetSpec[]): Record<Priorite, number> {
  const bilan: Record<Priorite, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of specs) bilan[s.priorite] += 1;
  return bilan;
}
