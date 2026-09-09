import { ROLES_UNITES, type GuideUnite } from '../content/roles-unites';
/**
 * La **fiche d'une unité** : ce qu'elle est, à quoi elle sert, contre quoi elle
 * est bonne, contre quoi elle craint, où elle avance bien et où elle ne passe
 * pas.
 *
 * Le menu de production ne montrait qu'un nom et un prix. Acheter un char sans
 * savoir ce qu'il chasse ni ce qui le chasse, c'est jouer à pile ou face : la
 * table de dégâts, les coûts de terrain et les effets de météo existent tous
 * dans le canon et dans le moteur, ils n'étaient simplement affichés nulle part.
 *
 * **Rien n'est réécrit ici.** Les dégâts viennent de `catalogue.degats`, les
 * coûts de terrain de `coutBase` — donc les traits `vol` et `tout_terrain`
 * sont pris en compte sans qu'on ait à y penser —, les malus de météo de
 * `surcoutMeteo` et `facteurMouvementMeteo`, et ce qu'un abri retire aux dégâts
 * de `facteurTerrain`. Une règle qui change au moteur change dans la fiche le
 * jour même ; c'est tout l'intérêt de ne rien recopier.
 *
 * Ce fichier est **pur** : ni DOM, ni horloge, ni état de partie. Il se vérifie
 * comme du moteur.
 */

import {
  consommationParTour, coutBase, degatsArme, degatsBase, facteurMouvementMeteo, facteurTerrain, porte,
  pvAffiches, surcoutMeteo, tireSansMunitions, type Catalogue, type Unite,
} from '../engine/index';
import {
  CLES_TERRAIN, METEOS, type CleTerrain, type CleUnite, type Meteo, type Trait, type UnitType,
} from '../schemas/types';

/** Combien d'adversaires on cite de chaque côté. Trois : au-delà, on ne lit plus. */
export const CITES = 3;

/** Une ligne « je frappe fort » ou « je crains ». */
export interface Duel {
  unite: CleUnite;
  /** Dégâts de base, en points de vie sur cent. */
  degats: number;
  /**
   * Le tireur frappe cette cible à l'**arme secondaire** (`04-gameplay.md`
   * §5.3) : sans consommer de munition, et même à zéro. Dans `forte`, c'est
   * l'unité de la fiche qui tire ; dans `craint`, c'est l'adversaire cité.
   */
  sansMunitions: boolean;
}

/** Ce qu'un transport porte : combien, qui, et s'il refait le plein de sa cale. */
export interface CaleFiche {
  places: number;
  /** Les types acceptés, dans l'ordre du canon. */
  accepte: readonly CleUnite[];
  /** Vrai si la cale est remise au plein à chaque début de tour (`transport.ravitaille`). */
  ravitaille: boolean;
}

/** Ce qui gêne une unité un jour donné. */
export interface GeneMeteo {
  meteo: Meteo;
  /** `case` : chaque case coûte plus cher. `bride` : le mouvement est divisé. */
  effet: 'case' | 'bride';
}

/**
 * Un **palier de défense** : les terrains où cette unité peut se tenir qui
 * valent le même nombre d'étoiles. Le dernier palier, à zéro étoile, est le
 * découvert — et c'est celui qui manquait à l'écran : deux unités identiques,
 * l'une sur route et l'autre en forêt, n'encaissent pas la même chose, et rien
 * ne le disait.
 *
 * Les étoiles sont la donnée du canon (`Terrain.defense`), telle quelle, et le
 * facteur vient de `facteurTerrain` du moteur : **la conversion des étoiles en
 * dégâts évités est une règle** (`04-gameplay.md` §5.1), et une seconde copie
 * finirait par mentir. La fiche demande, elle ne calcule pas.
 */
export interface Abri {
  /** Étoiles de défense du terrain, 0 à 4. */
  etoiles: number;
  /**
   * Ce qu'il reste des dégâts sur ce palier, tel que le moteur le calcule :
   * `1` à découvert, moins ailleurs. Le HUD en tire le pourcentage évité.
   */
  facteur: number;
  /** Les terrains de ce palier, dans l'ordre du canon. */
  terrains: readonly CleTerrain[];
}

/**
 * Le plein des points de vie **affichés** (`pvAffiches` du moteur rend 1 à 10).
 * C'est une échelle d'affichage, pas un coefficient de combat : elle sert
 * seulement à dire « cette unité n'est plus au complet ».
 */
export const PV_PLEIN = 10;

/** Tout ce qu'on sait dire d'une unité avant de l'acheter. */
export interface FicheUnite {
  guide?: GuideUnite;
  cle: CleUnite;
  cout: number;
  mouvement: number;
  vision: number;
  portee: readonly [number, number];
  /** Elle frappe de loin et **jamais** au contact : elle a besoin d'être couverte. */
  indirecte: boolean;
  munitions: number | null;
  /**
   * Le carburant brûlé par tour, immobile — `0` pour ce qui ne consomme qu'en
   * roulant ou ne consomme pas. Pour une unité **en jeu**, c'est sa consommation
   * effective, furtivité comprise ; pour le catalogue, celle du type.
   */
  consommationParTour: number;
  /**
   * Ce que coûterait la furtivité par tour, pour une unité qui en est capable
   * (trait `furtif`) ; `null` sinon. Le joueur doit savoir qu'un chasseur brûle
   * cinq par tour, et huit une fois caché.
   */
  consommationFurtive: number | null;
  /** La cale, pour un transport ; `null` pour tout le reste. */
  transport: CaleFiche | null;
  traits: readonly Trait[];
  /** Ce qu'elle démolit, du plus au moins. */
  forte: readonly Duel[];
  /** Ce qui la démolit, du plus au moins. Vide si rien ne la touche vraiment. */
  craint: readonly Duel[];
  /** Terrains traversés au coût minimal : sa route naturelle. */
  terrainsRapides: readonly CleTerrain[];
  /** Terrains qu'elle ne franchit pas du tout. */
  terrainsInterdits: readonly CleTerrain[];
  /** Météos qui la ralentissent. Vide si aucune ne la gêne. */
  meteosGenantes: readonly GeneMeteo[];
  /**
   * Ce que le terrain fait à sa défense : les cases qu'elle peut occuper,
   * groupées par étoiles, du plus couvert au découvert. C'est la moitié de la
   * formule de combat que la table de dégâts ne dit pas.
   */
  abris: readonly Abri[];
  /**
   * PV **affichés** de l'unité en jeu (1 à 10) ; `null` pour une fiche de
   * catalogue, qui ne parle d'aucune unité en particulier.
   */
  pv: number | null;
  /**
   * Elle a déjà encaissé, donc elle frappe moins fort (`04-gameplay.md` §5.1 :
   * les dégâts sont mis à l'échelle des points de vie de l'attaquant). C'est la
   * règle la moins intuitive du jeu, et elle n'était écrite nulle part à
   * l'écran. Faux pour une fiche de catalogue.
   */
  blessee: boolean;
}

/** Les terrains cités dans la fiche, dans l'ordre où on les lit sur une carte. */
const TERRAINS_CITES: readonly CleTerrain[] = [
  'route', 'plaine', 'foret', 'montagne', 'plage', 'riviere', 'pont', 'mer',
];

/**
 * La consommation par tour d'un type, lue au moteur — jamais recopiée : le
 * surcoût de la furtivité est sa règle, pas la nôtre. `enJeu` donne l'unité
 * telle qu'elle est ; `furtive` force l'état, pour dire ce que coûterait de se
 * cacher avant même d'avoir donné l'ordre. Le moteur ne lit de l'unité que ce
 * champ, et un témoin réduit à lui suffit quand il n'y a pas d'unité.
 */
function consommation(type: UnitType, enJeu: Unite | undefined, furtive?: boolean): number {
  if (enJeu && furtive === undefined) return consommationParTour(type, enJeu);
  const temoin: Pick<Unite, 'furtive'> = { furtive: furtive ?? false };
  return consommationParTour(type, temoin);
}

/**
 * Compose la fiche d'une unité depuis le catalogue actif.
 *
 * Rend `null` pour une clé inconnue plutôt que d'inventer : un catalogue peut
 * retirer une unité, et le HUD doit alors ne rien afficher, pas une fiche vide.
 *
 * `enJeu`, facultatif, est **cette** unité sur la carte : la rangée « redoutable
 * contre » dit alors ce qu'elle frappe **aujourd'hui** (`degatsArme` : à zéro
 * munition, la mitrailleuse), et la consommation par tour est la sienne. Sans
 * elle — le menu de production —, la fiche dit la valeur pleine du catalogue.
 */
export function ficheUnite(cat: Catalogue, cle: CleUnite, enJeu?: Unite): FicheUnite | null {
  const u = cat.unites[cle];
  if (!u) return null;
  const adversaires = Object.keys(cat.unites) as CleUnite[];

  // Ce qu'elle frappe, et ce qui la frappe : la même table, lue dans les deux
  // sens. Un zéro n'est pas une faiblesse, c'est une absence d'arme — on ne
  // cite donc que ce qui touche vraiment.
  const trier = (l: Duel[]): Duel[] => l
    .filter((d) => d.degats > 0)
    .sort((a, b) => (b.degats - a.degats) || (a.unite < b.unite ? -1 : 1))
    .slice(0, CITES);

  // L'arme secondaire est lue par `tireSansMunitions`, la fonction du moteur :
  // la fiche ne sait pas ce qu'est une mitrailleuse, elle demande. Une unité en
  // jeu frappe avec ce qui lui reste — `degatsArme`, la seule source du chiffre
  // effectif —, le catalogue avec sa valeur pleine.
  const frappe = (cible: CleUnite): number => (enJeu && enJeu.type === cle
    ? degatsArme(cat, enJeu, cible)
    : degatsBase(cat, cle, cible));
  const forte = trier(adversaires.map((cible) => ({
    unite: cible, degats: frappe(cible), sansMunitions: tireSansMunitions(u, cible),
  })));
  const craint = trier(adversaires.map((par) => {
    const tireur = cat.unites[par];
    return {
      unite: par,
      degats: degatsBase(cat, par, cle),
      sansMunitions: tireur ? tireSansMunitions(tireur, cle) : false,
    };
  }));

  // Les coûts passent par `coutBase`, qui applique déjà `vol` et
  // `tout_terrain` : une unité aérienne ressort donc rapide partout, sans que
  // la fiche ait à connaître le trait.
  const rapides: CleTerrain[] = [];
  const interdits: CleTerrain[] = [];
  for (const t of TERRAINS_CITES) {
    const c = coutBase(cat, t, u.typeMouvement, u);
    if (c === null) interdits.push(t);
    else if (c <= 1) rapides.push(t);
  }

  // Une météo gêne si elle renchérit **au moins un** terrain que l'unité peut
  // emprunter — inutile d'annoncer la neige à qui ne quitte pas la route.
  const genantes: GeneMeteo[] = [];
  for (const meteo of METEOS) {
    if (facteurMouvementMeteo(meteo, u.domaine) < 1) {
      genantes.push({ meteo, effet: 'bride' });
      continue;
    }
    const gene = CLES_TERRAIN.some((t) => coutBase(cat, t, u.typeMouvement, u) !== null
      && surcoutMeteo(meteo, t, u.typeMouvement) > 0);
    if (gene) genantes.push({ meteo, effet: 'case' });
  }

  // Les abris : on ne cite que les cases où l'unité peut réellement se tenir —
  // une infanterie ne s'abrite pas en pleine mer —, et `coutBase` répond pour
  // nous, traits compris. Le regroupement par étoiles évite d'aligner dix
  // pastilles dont sept disent la même chose.
  const paliers = new Map<number, CleTerrain[]>();
  for (const t of CLES_TERRAIN) {
    if (coutBase(cat, t, u.typeMouvement, u) === null) continue;
    const fiche = cat.terrains[t];
    if (!fiche) continue;
    const liste = paliers.get(fiche.defense);
    if (liste) liste.push(t);
    else paliers.set(fiche.defense, [t]);
  }
  const abris: Abri[] = [...paliers.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([etoiles, terrains]) => ({ etoiles, facteur: facteurTerrain(etoiles), terrains }));

  // Les PV de **cette** unité : la fiche de catalogue ne parle de personne, et
  // ne peut donc dire ni ses points de vie ni qu'elle est blessée.
  const sienne = enJeu && enJeu.type === cle ? enJeu : undefined;
  const pv = sienne ? pvAffiches(sienne.pv) : null;

  return {
    cle,
    guide: ROLES_UNITES[cle],
    cout: u.cout,
    mouvement: u.mouvement,
    vision: u.vision,
    portee: u.portee,
    // Portée minimale au-delà de 1 : elle ne peut pas riposter au contact.
    indirecte: u.portee[0] > 1,
    munitions: u.munitions,
    consommationParTour: consommation(u, enJeu && enJeu.type === cle ? enJeu : undefined),
    consommationFurtive: porte(u, 'furtif') ? consommation(u, undefined, true) : null,
    transport: u.transport === null
      ? null
      : { places: u.transport.places, accepte: u.transport.accepte, ravitaille: u.transport.ravitaille === true },
    traits: u.traits,
    forte,
    craint,
    terrainsRapides: rapides,
    terrainsInterdits: interdits,
    meteosGenantes: genantes,
    abris,
    pv,
    blessee: pv !== null && pv < PV_PLEIN,
  };
}

/** Les traits qui méritent d'être dits en clair au joueur, dans cet ordre. */
export const TRAITS_CITES: readonly Trait[] = [
  'capture', 'transport', 'tir_indirect', 'anti_air', 'vol', 'amphibie',
  'plongee', 'furtif', 'tout_terrain', 'ravitaillement', 'vision_etendue', 'furtif_nuit',
];

/** Les traits d'une unité, dans l'ordre de lecture et sans les inconnus. */
export function traitsLisibles(traits: readonly Trait[]): Trait[] {
  return TRAITS_CITES.filter((t) => traits.includes(t));
}

// ---------------------------------------------------------------------------
// Les alertes d'une unité **en jeu** : carburant et munitions
// ---------------------------------------------------------------------------

/**
 * Le niveau d'alerte d'une statistique : `orange` quand il faut y penser au
 * prochain tour, `rouge` quand la règle mord déjà ou mordra au tour suivant,
 * `null` quand tout va bien. Le HUD n'ajoute aucun mot : une couleur sur le
 * chiffre, et un libellé pour l'accessibilité.
 */
export type Alerte = 'orange' | 'rouge' | null;

/** Sous cette part du plein, une unité qui ne consomme qu'en roulant est signalée. */
export const PART_CARBURANT_FAIBLE = 0.2;

/**
 * L'alerte carburant (`04-gameplay.md` §2 : « le HUD signale en orange toute
 * unité aérienne à moins de 2 tours d'autonomie : la panne sèche ne doit
 * jamais être une surprise »).
 *
 * Une unité qui consomme **par tour** tombe en panne au début du tour où son
 * carburant ne couvre plus la consommation : à `carburant ≤ consommation` elle
 * ne passera pas le prochain début de tour (rouge), à moins de deux tours elle
 * est orange. Une unité qui ne consomme qu'en roulant ne tombe jamais en
 * panne, elle s'arrête : orange sous un cinquième du plein, rouge à zéro,
 * quand elle ne bouge plus du tout.
 *
 * `consommation` est ce que l'unité brûle **réellement** par tour — pour une
 * unité en jeu, `consommationParTour(type, unite)` du moteur, qui compte la
 * furtivité ; à défaut, celle du type. Juger une furtive sur le chiffre du
 * catalogue lui promettrait un tour qu'elle n'a pas.
 */
export function alerteCarburant(
  type: UnitType, carburant: number | null, consommation = type.carburant?.parTour ?? 0,
): Alerte {
  if (type.carburant === null || carburant === null) return null;
  const { max } = type.carburant;
  if (consommation > 0) {
    if (carburant <= consommation) return 'rouge';
    if (carburant < 2 * consommation) return 'orange';
    return null;
  }
  if (carburant <= 0) return 'rouge';
  if (max > 0 && carburant < max * PART_CARBURANT_FAIBLE) return 'orange';
  return null;
}

/**
 * L'alerte munitions (`04-gameplay.md` §5.3 : « à 0 munition, l'unité ne peut
 * ni attaquer ni riposter — le HUD l'affiche en rouge »). Orange à la dernière.
 * Une arme secondaire ne change rien au rouge : c'est l'arme principale qui
 * est vide, et c'est elle que le chiffre compte.
 */
export function alerteMunitions(type: UnitType, munitions: number | null): Alerte {
  if (type.munitions === null || munitions === null) return null;
  if (munitions <= 0) return 'rouge';
  if (munitions === 1) return 'orange';
  return null;
}

/** `porte` du moteur, réexporté : le HUD n'a pas à importer deux couches. */
export { porte };
