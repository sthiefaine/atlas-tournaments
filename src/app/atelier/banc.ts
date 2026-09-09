/**
 * Le **banc d'essai** de l'atelier : de quoi regarder tous les rendus possibles
 * sans avoir à jouer une partie jusqu'à ce qu'ils apparaissent.
 *
 * Tout ce fichier est **pur** — pas de DOM, pas de three.js, pas d'horloge —
 * pour que la carte-catalogue, les surbrillances et les événements de
 * démonstration se vérifient par `tsx --test`. L'atelier n'en est que
 * l'interface.
 *
 * Deux principes le tiennent.
 *
 * **On montre le catalogue, pas une partie.** Une carte de mission ne pose
 * jamais les quinze terrains ni les vingt-quatre unités : on attend qu'ils
 * apparaissent,
 * et un défaut de rendu se découvre en jouant, tard. La carte-catalogue les
 * range côte à côte, y compris les cas qui ont réellement cassé — un bâtiment
 * encastré dans la montagne, une plage entre mer et plaine.
 *
 * **On rejoue l'événement, pas la règle.** Un banc n'a pas à être une partie
 * légale : il émet l'événement que le moteur émettrait et l'état qui en
 * résulterait, sans passer par `appliquer`. C'est ce qui permet de déclencher
 * une capture ou une mise hors jeu à la demande, dans n'importe quel ordre.
 */

import { chargerPays } from '@/content/index';
import { cleCase, SEUIL_CAPTURE, type Catalogue, type EtatPartie, type EvenementJeu } from '@/engine/index';
import { genererCarte } from '@/mapgen/index';
import type { Surbrillance } from '@/render/index';
import {
  BIOMES, CARACTERE_PAR_TERRAIN, METEOS, PHASES_JOUR, SAISONS,
  type BaseSilhouette, type Biome, type Case, type CampId, type CleTerrain, type CleUnite, type CodePays,
  type MapDef, type Meteo, type ParametresCarte, type PhaseJour, type Saison, type UniteDepart,
} from '@/schemas/types';

/**
 * La date portée par l'enveloppe de la carte. **Fixe** : le banc doit être
 * identique d'une ouverture à l'autre, et une couche pure ne lit pas l'horloge.
 */
const DATE_BANC = '2026-09-05';

/**
 * Largeur de la carte-catalogue. Le validateur exige entre 10 et 40.
 *
 * Vingt colonnes suffisaient à quatorze unités ; le catalogue 6 en compte
 * vingt-quatre, dont quatre qui flottent. Vingt-quatre colonnes laissent les
 * vingt pièces terrestres et aériennes sur un rang (colonnes 0 à 19), et
 * rendent à la flèche de chemin les colonnes de droite, qu'une quinzième unité
 * lui prenait ; le rang des unités n'est croisé par la flèche qu'en colonne 21.
 */
export const LARGEUR_BANC = 24;

/** La ville que les gestes de capture se disputent : celle du camp 1 au départ. */
export const VILLE_BANC: Case = { x: 1, y: 3 };

/** La ville désaffectée, à l'écart du rang : une palissade, pas de liseré, mât nu. */
export const VILLE_DESAFFECTEE_BANC: Case = { x: 15, y: 3 };

/**
 * La station radar du camp 1, au rang des bâtiments : c'est au-dessus d'elle
 * que le drone du joueur se fait abattre. Un drone qui tombe sur un bâtiment
 * adverse lit ce que ce camp a produit (`doc/04` §10 bis) ; au-dessus de la
 * plaine, il ne lirait rien et le geste ne montrerait qu'une mise hors jeu.
 */
export const STATION_ADVERSE_BANC: Case = { x: 12, y: 3 };
/**
 * Hauteur de la carte-catalogue : douze rangs de terre, plus la rive et ses
 * deux rangs de mer, où se tiennent les navires du catalogue 5.
 */
export const HAUTEUR_BANC = 15;

/**
 * Les rangs de la carte-catalogue. Chacun montre une famille, et les rangs
 * vides entre deux familles ne sont pas du décor : ils portent les
 * surbrillances et la flèche de chemin.
 */
export const RANGS = {
  terrains: 0,
  batiments: 3,
  surbrillancesHautes: 4,
  unitesCamp0: 5,
  surbrillancesBasses: 6,
  unitesCamp1: 7,
  chemin: 8,
  batimentsEnMontagne: 9,
  eau: 10,
  /** La rive : c'est là que les trois ports se tiennent, quai contre l'eau. */
  rive: 12,
  naviresCamp0: 13,
  naviresCamp1: 14,
} as const;

/**
 * La grille du banc.
 *
 * Les deux rangs de terrains sont **identiques**, ce qui montre d'un coup les
 * deux jonctions qui comptent : celle entre deux cases du même terrain et celle
 * avec la plaine. Le rang 9 est le cas qui a cassé — des bâtiments encastrés
 * entre des montagnes —, les rangs 10 et 11 portent la mer, la plage, la
 * rivière et son pont, c'est-à-dire tout ce qui bouge quand la marée monte.
 *
 * Les trois derniers rangs sont neufs (7 septembre 2026) : une **rive** qui
 * porte les trois ports — pris par chaque camp, et neutre — et deux rangs de
 * **mer** où se tiennent les navires du catalogue 5. Un cuirassé posé sur de
 * l'herbe ne dit rien de son rendu, et c'est justement ce qu'un banc doit
 * rendre impossible.
 *
 * À droite des rangs 8 à 11, le **réseau de voies** : un bout, une longue
 * droite, une croix, deux T et un virage, et un pont qui franchit une rivière
 * nord-sud — de quoi voir chaque pièce et le raccord d'une voie au bord de la
 * carte. Une carte de mission n'aligne jamais les six pièces côte à côte.
 */
const GRILLE_BANC: readonly string[] = [
  'PFMRSVNWCUATOGPPPPPPPPPP',
  'PFMRSVNWCUATOGPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPPPPPP',
  'CCCUUUAAAHHTTTPCPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPRPPPPPPPPPP',
  'MCMUMAMCMPPPPRPPVPRRPPPP',
  'WWWSPPPPRRRRRRRRNRRRPPPP',
  'WWWSPPPPPPPPPRPPVPPPPPPP',
  'WWWSSSOSSSOSSSOSSSSSSSSS',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
];

/**
 * Les vingt-quatre unités du catalogue 6, dans l'ordre où elles se lisent : la
 * piétaille, puis les roues, puis les chenilles, puis ce qui vole, puis ce qui
 * flotte. Le test exige que cette liste **soit** le catalogue, à la clé près :
 * une unité homologuée qu'on oublierait ici ne serait jamais regardée.
 */
export const UNITES_BANC: readonly CleUnite[] = [
  'infanterie', 'meca', 'genie', 'recon', 'brouilleur', 'roquettes', 'missiles_air', 'missiles_sol',
  'char_leger', 'char_moyen', 'char_lourd', 'antiair', 'artillerie', 'transport',
  'helico', 'transport_air', 'drone', 'chasseur', 'bombardier', 'furtif',
  'barge', 'sous_marin', 'cuirasse', 'porte_avions',
  'drone_intercepteur', 'drone_ravitailleur', 'meridien_veilleur', 'meridien_bastion',
];

/**
 * Celles qui flottent : elles se posent sur les rangs de mer, pas sur le rang
 * de terre. Le domaine est au canon (`content/unites.json`), mais le banc n'a
 * pas de catalogue sous la main quand il construit sa carte — il en dresse donc
 * la liste, et un test la confronte au domaine `mer` du catalogue.
 */
export const UNITES_NAVALES_BANC: ReadonlySet<CleUnite> = new Set<CleUnite>([
  'barge', 'sous_marin', 'cuirasse', 'porte_avions',
]);

/** Les colonnes où les navires mouillent, une par unité navale. */
export const COLONNES_NAVIRES: readonly number[] = [5, 8, 11, 14];

/** Les trois ports de la rive : au camp 0, au camp 1, et neutre. */
export const PORTS_BANC: readonly Case[] = [
  { x: 6, y: RANGS.rive }, { x: 10, y: RANGS.rive }, { x: 14, y: RANGS.rive },
];

/**
 * Les bases de silhouette **qu'aucune unité du canon n'utilise**.
 *
 * Elles étaient trois — `rail`, `ailes` et `coque` — écrites dans
 * `render3d/pieces.ts` depuis le début et jamais vues à l'écran. Le catalogue 5
 * a donné des porteurs à `ailes` (chasseur, bombardier, puis le furtif du 6 en
 * aile volante) et à `coque` (barge, porte-avions, cuirassé, sous-marin) ; il
 * ne reste que `rail`, qu'on fait
 * apparaître en échangeant la base d'une unité dans une **copie** du catalogue
 * — jamais dans le canon, qui reste la vérité.
 */
export const BASES_JAMAIS_VUES: Readonly<Record<string, BaseSilhouette>> = Object.freeze({
  roquettes: 'rail',
});

/** La carte-catalogue : quinze terrains, six bâtiments, vingt-quatre unités par camp. */
export function carteBanc(): MapDef {
  const proprietaires: Record<string, CampId> = {};
  // Chaque famille de bâtiment est montrée trois fois : camp 0, camp 1, neutre.
  // Un bâtiment neutre ne se peint pas comme un bâtiment pris, et c'est
  // précisément ce qu'on vient vérifier.
  for (const x of [0, 3, 6, 11]) {
    proprietaires[cleCase({ x, y: RANGS.batiments })] = 0;
    proprietaires[cleCase({ x: x + 1, y: RANGS.batiments })] = 1;
  }
  // Les deux QG : le validateur en exige exactement un par camp.
  proprietaires[cleCase({ x: 9, y: RANGS.batiments })] = 0;
  proprietaires[cleCase({ x: 10, y: RANGS.batiments })] = 1;
  // Les ports de la rive suivent la même règle : pris, pris, neutre.
  proprietaires[cleCase(PORTS_BANC[0]!)] = 0;
  proprietaires[cleCase(PORTS_BANC[1]!)] = 1;

  const unitesDepart: UniteDepart[] = [];
  for (const camp of [0, 1] as const) {
    const rangTerre = camp === 0 ? RANGS.unitesCamp0 : RANGS.unitesCamp1;
    const rangMer = camp === 0 ? RANGS.naviresCamp0 : RANGS.naviresCamp1;
    let terre = 0;
    let mer = 0;
    for (const type of UNITES_BANC) {
      if (UNITES_NAVALES_BANC.has(type)) {
        const x = COLONNES_NAVIRES[mer];
        if (x === undefined) throw new Error('banc : plus de navires que de mouillages');
        unitesDepart.push({ camp, type, x, y: rangMer });
        mer += 1;
      } else {
        unitesDepart.push({ camp, type, x: terre, y: rangTerre });
        terre += 1;
      }
    }
  }

  return {
    cle: 'carte_banc_atelier',
    version: 1,
    statut: 'en_ligne',
    source: 'humain',
    creeLe: DATE_BANC,
    majLe: DATE_BANC,
    code: 'carte_banc_atelier',
    nom: 'Banc d’essai',
    largeur: LARGEUR_BANC,
    hauteur: HAUTEUR_BANC,
    camps: 2,
    biome: 'plaine',
    grille: [...GRILLE_BANC],
    proprietaires,
    desaffectes: [VILLE_DESAFFECTEE_BANC],
    unitesDepart,
  } as MapDef;
}

// ---------------------------------------------------------------------------
// La grande carte : celle du budget
// ---------------------------------------------------------------------------

/**
 * La taille sur laquelle le budget de `10-rendu-3d.md` §9.2 est écrit : ≈ 30 %
 * de forêt, un peu de relief et d'eau, une vingtaine de bâtiments possédés,
 * une trentaine d'unités. Aucune carte du dépôt ne la fait — les missions vont
 * de 10 × 10 à 16 × 12, la carte-catalogue fait 20 × 12 —, et c'est pourtant
 * la seule sur laquelle des chiffres se comparent au budget.
 */
export const LARGEUR_GRANDE = 24;
export const HAUTEUR_GRANDE = 16;

/**
 * La graine : choisie parmi une poignée pour la part de forêt la plus proche
 * des 30 % du budget, avec de la montagne et de l'eau. Fixe, comme tout le banc.
 */
export const GRAINE_GRANDE = 24;

/**
 * Ce qu'on demande au générateur. Le relief est la **borne haute** que
 * `normaliser` accepte — au-delà, la même carte sort — et c'est ce qui donne
 * ≈ 30 % de forêt en plaine ; les six villes, trois usines et un aéroport par
 * camp font, avec le QG, vingt-deux bâtiments possédés.
 */
export const PARAMETRES_GRANDE: ParametresCarte = Object.freeze({
  largeur: LARGEUR_GRANDE,
  hauteur: HAUTEUR_GRANDE,
  camps: 2,
  biome: 'plaine',
  ratioMer: 0.08,
  ratioRelief: 0.4,
  villesParCamp: 6,
  villesNeutres: 4,
  usinesParCamp: 3,
  aeroportsParCamp: 1,
  symetrie: 'axe_vertical',
  densiteRoutes: 0.5,
}) as ParametresCarte;

/**
 * Quinze unités par camp, trente en tout — et **pas le catalogue entier**.
 *
 * C'est la seule liste du banc qui ne suive pas le catalogue, et c'est voulu :
 * cette carte-là sert la **mesure** (`10-rendu-3d.md` §9.2), pas la couverture.
 * Le budget est écrit sur « une trentaine d'unités » ; le faire enfler à
 * quarante-six parce que le catalogue a grandi rendrait incomparables toutes les
 * campagnes de mesure passées. C'est la carte-catalogue qui garantit qu'aucune
 * unité n'est oubliée. L'infanterie ouvre la liste pour que « Déplacer » et
 * « Tirer » jouent sur elle comme sur la carte-catalogue ; le reste est un
 * mélange représentatif d'une partie — de la piétaille, du blindé, de l'appui,
 * un peu de vol.
 */
export const UNITES_GRANDE: readonly CleUnite[] = [
  'infanterie', 'infanterie', 'meca', 'genie', 'recon', 'roquettes',
  'char_leger', 'char_moyen', 'char_lourd', 'antiair', 'artillerie', 'missiles_sol',
  'transport', 'helico', 'drone',
];

/** Les terrains sur lesquels on pose une unité : de la terre nue, ni bâtie, ni noyée. */
const TERRAINS_DE_POSE: ReadonlySet<string> = new Set([
  CARACTERE_PAR_TERRAIN.plaine, CARACTERE_PAR_TERRAIN.foret, CARACTERE_PAR_TERRAIN.route, CARACTERE_PAR_TERRAIN.plage,
]);

/** Le QG d'un camp : la case `qg` que la carte lui attribue. */
function qgDe(carte: MapDef, camp: CampId): Case | null {
  for (let y = 0; y < carte.hauteur; y += 1) {
    for (let x = 0; x < carte.largeur; x += 1) {
      if (carte.grille[y]?.[x] === CARACTERE_PAR_TERRAIN.qg && carte.proprietaires[cleCase({ x, y })] === camp) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * La grande carte : générée avec sa graine fixe, puis garnie de ses trente
 * unités, posées sur la terre nue la plus proche du QG de chaque camp — par
 * distance, puis par rang et colonne, pour que deux constructions donnent le
 * même état. Elle sert la **mesure** (`16-realisme.md` A6), pas le catalogue :
 * les gestes d'unités — « Déplacer », « Tirer », « Mettre hors jeu »,
 * « Brouiller » — et « Fin de tour » y ont un sens ; les captures, la remise en
 * service, le drone abattu et la marée visent les cases de la carte-catalogue
 * et n'y montrent rien de sensé.
 */
export function carteGrande(): MapDef {
  const generee = genererCarte(PARAMETRES_GRANDE, GRAINE_GRANDE);
  const occupees = new Set<string>();
  const unitesDepart: UniteDepart[] = [];
  for (const camp of [0, 1] as const) {
    const qg = qgDe(generee, camp);
    if (!qg) throw new Error(`grande carte : aucun QG pour le camp ${camp}`);
    const candidates: Case[] = [];
    for (let y = 0; y < generee.hauteur; y += 1) {
      for (let x = 0; x < generee.largeur; x += 1) {
        if (TERRAINS_DE_POSE.has(generee.grille[y]?.[x] ?? '') && !occupees.has(cleCase({ x, y }))) candidates.push({ x, y });
      }
    }
    const distance = (c: Case): number => Math.abs(c.x - qg.x) + Math.abs(c.y - qg.y);
    candidates.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
    UNITES_GRANDE.forEach((type, i) => {
      const c = candidates[i];
      if (!c) throw new Error('grande carte : pas assez de terre nue autour du QG');
      occupees.add(cleCase(c));
      unitesDepart.push({ camp, type, x: c.x, y: c.y });
    });
  }
  return {
    ...generee,
    cle: 'carte_banc_grande',
    code: 'carte_banc_grande',
    nom: 'Grande carte 24 × 16',
    unitesDepart,
  };
}

/**
 * La version de catalogue du banc.
 *
 * **Le dernier, obligatoirement** : le catalogue 1 ne compte que dix unités, le
 * génie y manque. Un banc monté sur le scénario de démonstration, qui est en
 * catalogue 1, perdait le génie **sans rien dire** — la carte se montait, il
 * n'était simplement pas là. C'est le genre d'absence qu'un banc d'essai est
 * censé rendre impossible, et c'est pourquoi ce nombre suit le catalogue — le
 * test le confronte à la version de `content/unites.json`, pour qu'il ne
 * reste pas en arrière d'une homologation.
 */
export const VERSION_CATALOGUE_BANC = 7;

/**
 * Un scénario pour le banc : celui qu'on lui prête, forcé sur le catalogue qui
 * porte toutes les unités. On ne modifie pas le canon, on en prend une copie.
 */
export function scenarioBanc<T extends { catalogueVersion: number }>(base: T): T {
  return { ...base, catalogueVersion: VERSION_CATALOGUE_BANC, factionsParCamp: { 0: 'atl', 1: 'atl' } }; // Banc technique : les deux camps peuvent montrer tous les prototypes.
}

/**
 * Une copie du catalogue où une unité porte la base que rien ne porte.
 *
 * On ne touche pas au canon : `chargerCatalogue` rend toujours la vérité, et
 * c'est cette copie qu'on passe au rendu le temps du coup d'œil.
 */
export function catalogueSilhouettes(cat: Catalogue): Catalogue {
  const unites = { ...cat.unites };
  for (const [cle, base] of Object.entries(BASES_JAMAIS_VUES)) {
    const u = unites[cle as CleUnite];
    if (!u) continue;
    unites[cle as CleUnite] = { ...u, silhouette: { ...u.silhouette, base } };
  }
  return { ...cat, unites };
}

/** Les cinq genres de surbrillance, dans l'ordre où le HUD les explique. */
export const GENRES_SURBRILLANCE = ['deplacement', 'attaque', 'capture', 'production', 'danger'] as const;
export type GenreBanc = typeof GENRES_SURBRILLANCE[number];

/** Où chaque genre se pose sur le banc : rang, première et dernière colonne. */
const BANDES: Readonly<Record<GenreBanc, readonly [number, number, number]>> = {
  deplacement: [RANGS.surbrillancesHautes, 0, 5],
  attaque: [RANGS.surbrillancesHautes, 6, 11],
  capture: [RANGS.surbrillancesBasses, 0, 3],
  production: [RANGS.surbrillancesBasses, 4, 7],
  danger: [RANGS.surbrillancesBasses, 8, 11],
};

/** Les surbrillances des genres demandés, en bandes lisibles côte à côte. */
export function surbrillancesBanc(genres: readonly GenreBanc[]): Surbrillance[] {
  const cases: Surbrillance[] = [];
  for (const genre of genres) {
    const bande = BANDES[genre];
    if (!bande) continue;
    const [y, debut, fin] = bande;
    for (let x = debut; x <= fin; x += 1) cases.push({ case: { x, y }, genre });
  }
  return cases;
}

/**
 * Un chemin coudé **deux fois**, sur les rangs libres à droite des unités : un
 * coude unique ne dit pas si la flèche sait tourner deux fois dans le même sens.
 *
 * Il passe par le rang des unités du camp 0, et c'est le piège de ce banc : au
 * catalogue 4, dix-neuf unités par rang auraient posé la quinzième pièce sur la
 * case de la flèche. La carte s'est élargie à vingt-quatre colonnes et le chemin
 * s'est décalé d'autant — les vingt pièces terrestres et aériennes du
 * catalogue 6 tiennent en 0…19, le chemin vit en 19…23 et ne croise le rang des
 * unités qu'en colonne 21, qui reste libre.
 */
export const CHEMIN_BANC: readonly Case[] = [
  { x: 19, y: RANGS.surbrillancesHautes },
  { x: 20, y: RANGS.surbrillancesHautes },
  { x: 21, y: RANGS.surbrillancesHautes },
  { x: 21, y: RANGS.unitesCamp0 },
  { x: 21, y: RANGS.surbrillancesBasses },
  { x: 22, y: RANGS.surbrillancesBasses },
  { x: 23, y: RANGS.surbrillancesBasses },
];

/**
 * Le brouillard du banc : on ne voit que la moitié gauche.
 *
 * Une frontière franche et verticale, pas un disque autour d'une unité : ce
 * qu'on vient regarder, c'est comment une case cachée se peint, pas comment la
 * vision se calcule — ça, c'est au moteur, et il a ses propres tests.
 */
export function visiblesBanc(): Set<string> {
  const vues = new Set<string>();
  for (let y = 0; y < HAUTEUR_BANC; y += 1) {
    for (let x = 0; x < LARGEUR_BANC / 2; x += 1) vues.add(cleCase({ x, y }));
  }
  return vues;
}

/** Les gestes que le banc sait rejouer. */
export const GESTES_BANC = [
  'deplacement', 'attaque', 'tir_missile', 'tir_cloche', 'capture_en_cours', 'capture', 'remise_en_service', 'hors_jeu',
  'brouillage', 'drone_abattu', 'maree_haute', 'maree_basse', 'fin_de_tour',
] as const;
export type GesteBanc = typeof GESTES_BANC[number];

/** Ce qu'un bouton du banc dit de lui-même : son nom, et ce qu'on doit voir. */
export interface DescriptionGeste {
  cle: GesteBanc;
  nom: string;
  /** Une phrase qui dit ce qui doit se passer à l'écran : c'est le critère de relecture. */
  aide: string;
  groupe: 'unites' | 'batiments' | 'terrain' | 'tour';
}

/**
 * Les gestes, décrits pour l'interface. L'aide ne dit pas ce que fait le
 * moteur mais ce qu'on doit **voir** : un banc sert à comparer l'écran à une
 * attente écrite, et sans elle un défaut passe pour une intention.
 */
export const DESCRIPTIONS_GESTES: readonly DescriptionGeste[] = [
  { cle: 'deplacement', nom: 'Déplacer', groupe: 'unites',
    aide: 'La première unité bleue suit une flèche coudée deux fois, puis se grise et se cadenasse : elle a joué.' },
  { cle: 'attaque', nom: 'Tirer', groupe: 'unites',
    aide: 'La première unité bleue frappe la première rouge, qui riposte : les deux barres de vie baissent, la bleue se grise.' },
  { cle: 'tir_missile', nom: 'Missile de simulation', groupe: 'unites',
    aide: 'Le lanceur bleu envoie un projectile à traînée vers une cible rouge ; le marqueur atteint la cible avant son impact.' },
  { cle: 'tir_cloche', nom: 'Tir en cloche', groupe: 'unites',
    aide: 'L’artillerie bleue lance un marqueur sur une trajectoire courbe, puis la cible accuse l’impact sans riposte.' },
  { cle: 'hors_jeu', nom: 'Mettre hors jeu', groupe: 'unites',
    aide: 'La première unité rouge quitte la carte, avec son animation de sortie ; rien ne se casse ni ne brûle.' },
  { cle: 'brouillage', nom: 'Brouiller', groupe: 'unites',
    aide: 'Le brouilleur rouge traverse la carte et se colle sous le drone bleu : sa silhouette doit se lire comme un brouilleur, pas comme un transport.' },
  { cle: 'drone_abattu', nom: 'Abattre le drone', groupe: 'unites',
    aide: 'Le drone bleu survole la station radar rouge, l’antiaérien le met hors jeu, et le HUD annonce ce que le camp rouge a produit (rien, sur le banc).' },
  { cle: 'capture_en_cours', nom: 'Entamer la capture', groupe: 'batiments',
    aide: 'Une unité se pose sur la ville du rang des bâtiments et le drapeau descend à mi-mât : la ville reste aux couleurs de l’autre camp.' },
  { cle: 'capture', nom: 'Capturer', groupe: 'batiments',
    aide: 'La ville prend les couleurs du camp : le drapeau descend puis remonte aux nouvelles couleurs ; rejoué, elle change de mains dans l’autre sens.' },
  { cle: 'remise_en_service', nom: 'Remettre en service', groupe: 'batiments',
    aide: 'La palissade de la ville désaffectée tombe, puis le drapeau bleu se hisse et une prime s’annonce ; rejoué, la palissade revient.' },
  { cle: 'maree_haute', nom: 'Marée haute', groupe: 'terrain',
    aide: 'À gauche des deux derniers rangs, la plage devient mer et la plaine devient plage : le sol glisse, l’écume enfle puis retombe.' },
  { cle: 'maree_basse', nom: 'Marée basse', groupe: 'terrain',
    aide: 'Le mouvement inverse : la mer découvre une plage, la plage redevient plaine, et les pièces reprises par l’eau pataugent sans se noyer.' },
  { cle: 'fin_de_tour', nom: 'Fin de tour', groupe: 'tour',
    aide: 'Le bandeau de tour passe, et toute unité grisée par un geste retrouve ses couleurs et son cadenas ouvert.' },
];

/** Un geste rejoué : ce qu'on affiche après, et ce qu'on anime. */
export interface RejouerBanc {
  /** L'état tel qu'il serait après le geste : le rendu l'affiche d'abord. */
  apres: EtatPartie;
  evenements: EvenementJeu[];
}

/** Terrain d'un caractère de grille, pour annoncer ce qu'on vient de poser. */
const CAT_TERRAIN: Readonly<Record<string, CleTerrain>> = Object.fromEntries(
  Object.entries(CARACTERE_PAR_TERRAIN).map(([cle, car]) => [car, cle as CleTerrain]),
);

/** La première unité d'un camp, dans l'ordre de la carte-catalogue. */
function premiere(etat: EtatPartie, camp: CampId): EtatPartie['unites'][number] | undefined {
  return etat.unites.find((u) => u.camp === camp);
}

/**
 * Un chemin en équerre : d'abord vertical, puis horizontal. Les rangs de
 * surbrillance et le rang du chemin sont vides d'unités, les rangs d'unités ne
 * le sont pas : on quitte le rang par le plus court, et on voyage sur un rang
 * libre. Un banc ne vérifie pas le chemin, mais une flèche qui traverse une
 * pièce ferait douter d'un rendu qui n'a rien fait de mal.
 */
function cheminEnEquerre(de: Case, vers: Case): Case[] {
  const chemin: Case[] = [{ x: de.x, y: de.y }];
  let { x, y } = de;
  while (y !== vers.y) { y += Math.sign(vers.y - y); chemin.push({ x, y }); }
  while (x !== vers.x) { x += Math.sign(vers.x - x); chemin.push({ x, y }); }
  return chemin;
}

/**
 * Ce qu'un camp a produit, lu comme `revelerProduction` le lit (`combat.ts`) :
 * les compteurs `camp:type` de l'état. Sur le banc, personne n'a rien produit
 * et la liste est vide — c'est ce que le moteur dirait, on ne l'embellit pas.
 */
function produitesPar(etat: EtatPartie, camp: CampId): Record<CleUnite, number> {
  const produites: Record<CleUnite, number> = {};
  const prefixe = `${camp}:`;
  for (const [k, n] of Object.entries(etat.produites)) {
    if (k.startsWith(prefixe) && n > 0) produites[k.slice(prefixe.length)] = n;
  }
  return produites;
}

/**
 * Compose un geste : l'état d'après et les événements qui l'accompagnent.
 *
 * L'ordre est celui du jeu (`render/jeu.ts`) — **l'état logique passe devant**,
 * l'animation n'est qu'un rattrapage visuel. Un geste impossible sur le banc
 * (aucune unité du bon camp) rend `null` plutôt que d'inventer.
 */
export function rejouer(etat: EtatPartie, geste: GesteBanc): RejouerBanc | null {
  const mien = premiere(etat, 0);
  const sien = premiere(etat, 1);

  if (geste === 'deplacement') {
    if (!mien) return null;
    const chemin: Case[] = [
      { x: mien.x, y: mien.y },
      { x: mien.x + 1, y: mien.y },
      { x: mien.x + 2, y: mien.y },
      { x: mien.x + 2, y: mien.y - 1 },
      { x: mien.x + 3, y: mien.y - 1 },
    ];
    const arrivee = chemin[chemin.length - 1]!;
    // Une unité qui bouge a joué : c'est ce que le rendu doit montrer — gris,
    // immobile, cadenas — et ce qu'on vient regarder sur le banc.
    return {
      apres: { ...etat, unites: etat.unites.map((u) => (u.id === mien.id ? { ...u, x: arrivee.x, y: arrivee.y, etat: 'agi' } : u)) },
      evenements: [{
        type: 'deplacement', uniteId: mien.id,
        de: { x: mien.x, y: mien.y }, vers: arrivee, chemin, interrompu: false,
      }],
    };
  }

  if (geste === 'attaque' || geste === 'tir_missile' || geste === 'tir_cloche') {
    const tireur = geste === 'attaque' ? mien : etat.unites.find((u) => u.camp === 0
      && u.type === (geste === 'tir_missile' ? 'missiles_sol' : 'artillerie'));
    if (!tireur || !sien) return null;
    // Le banc garde ses pièces pour permettre des essais répétés, même après plusieurs impacts.
    const degats = Math.min(Math.max(0, sien.pv - 1), 42);
    const riposte = geste === 'attaque' ? Math.min(Math.max(0, tireur.pv - 1), 17) : 0;
    return {
      apres: {
        ...etat,
        unites: etat.unites.map((u) => {
          if (u.id === sien.id) return { ...u, pv: sien.pv - degats };
          if (u.id === tireur.id) return { ...u, pv: tireur.pv - riposte, etat: 'agi' };
          return u;
        }),
      },
      evenements: [{ type: 'attaque', attaquantId: tireur.id, cibleId: sien.id, degats, riposte }],
    };
  }

  if (geste === 'capture' || geste === 'capture_en_cours') {
    // La ville prise du rang des bâtiments change de mains **à chaque geste** :
    // c'est le seul moyen de voir les deux temps de l'animation — l'ancien
    // drapeau qu'on amène, le nouveau qu'on hisse — et de la rejouer sans fin.
    const cible: Case = VILLE_BANC;
    const tenue = etat.proprietaires[cleCase(cible)] ?? null;
    const camp: CampId = tenue === 0 ? 1 : 0;
    // L'unité qui capture est celle déjà posée sur la ville si elle y est,
    // sinon la première du camp, qu'on y amène.
    const posee = etat.unites.find((u) => u.camp === camp && u.x === cible.x && u.y === cible.y);
    const capteur = posee ?? premiere(etat, camp);
    if (!capteur) return null;
    const acquis = geste === 'capture';
    const points = acquis ? SEUIL_CAPTURE : Math.floor(SEUIL_CAPTURE / 2);
    const unites = etat.unites.map((u) => (u.id === capteur.id
      ? { ...u, x: cible.x, y: cible.y, pointsCapture: acquis ? 0 : points }
      : u));
    return {
      apres: {
        ...etat,
        unites,
        proprietaires: acquis ? { ...etat.proprietaires, [cleCase(cible)]: camp } : etat.proprietaires,
      },
      evenements: [{ type: 'capture', uniteId: capteur.id, case: cible, points, acquis, camp }],
    };
  }

  if (geste === 'remise_en_service') {
    const cible = VILLE_DESAFFECTEE_BANC;
    const cle = cleCase(cible);
    if (!etat.desaffectes.includes(cle)) {
      // Déjà en service : on la referme, sans événement — c'est ce qui rend le
      // geste rejouable. Le moteur, lui, ne désaffecte jamais rien en partie.
      const proprietaires = { ...etat.proprietaires };
      delete proprietaires[cle];
      return {
        apres: {
          ...etat,
          proprietaires,
          desaffectes: [...etat.desaffectes, cle],
          unites: etat.unites.map((u) => (u.x === cible.x && u.y === cible.y ? { ...u, pointsCapture: 0 } : u)),
        },
        evenements: [],
      };
    }
    // Le génie remet en service ; à défaut, la première unité du camp 0.
    const camp: CampId = 0;
    const capteur = etat.unites.find((u) => u.camp === camp && u.type === 'genie') ?? premiere(etat, camp);
    if (!capteur) return null;
    return {
      apres: {
        ...etat,
        proprietaires: { ...etat.proprietaires, [cle]: camp },
        desaffectes: etat.desaffectes.filter((d) => d !== cle),
        unites: etat.unites.map((u) => (u.id === capteur.id ? { ...u, x: cible.x, y: cible.y, pointsCapture: 0 } : u)),
      },
      // Le moteur émet la remise en service **puis** la capture acquise : le
      // rendu fait tomber la palissade, et seulement ensuite hisse le drapeau.
      evenements: [
        { type: 'remise_en_service', prime: 2000, uniteId: capteur.id, case: cible, camp },
        { type: 'capture', uniteId: capteur.id, case: cible, points: SEUIL_CAPTURE * 2, acquis: true, camp },
      ],
    };
  }

  if (geste === 'fin_de_tour') {
    // Le seul geste qui **réveille** : sans lui, une unité grisée par « Déplacer »
    // le reste jusqu'à la remise à neuf, et le retour à l'aspect d'origine —
    // le point délicat — ne se verrait jamais. Le camp courant ne change pas :
    // on veut revoir les mêmes pièces prêtes, pas passer la main à l'autre.
    const camp = etat.campCourant;
    return {
      apres: { ...etat, unites: etat.unites.map((u) => (u.camp === camp && u.etat !== 'prete' ? { ...u, etat: 'prete' } : u)) },
      evenements: [{ type: 'fin_tour', camp }],
    };
  }

  if (geste === 'hors_jeu') {
    if (!sien) return null;
    return {
      apres: { ...etat, unites: etat.unites.filter((u) => u.id !== sien.id) },
      evenements: [{ type: 'hors_jeu', uniteId: sien.id, camp: sien.camp, unite: sien.type }],
    };
  }

  if (geste === 'brouillage') {
    // Le brouilleur adverse vient se poster sous le drone du joueur. Sur le
    // banc, le drone est déjà brouillé par la station radar du camp 1 — douze
    // cases de rayon, la carte en fait vingt — : ce geste ne montre pas la
    // vision qui tombe, il montre la pièce en mouvement et arrêtée à portée.
    const drone = etat.unites.find((u) => u.camp === 0 && u.type === 'drone');
    const brouilleur = etat.unites.find((u) => u.camp === 1 && u.type === 'brouilleur');
    if (!drone || !brouilleur) return null;
    const poste: Case = { x: drone.x, y: drone.y + 1 };
    // Déjà en poste : rien à rejouer, la pièce est là où le geste la met.
    if (brouilleur.x === poste.x && brouilleur.y === poste.y) return null;
    const chemin = cheminEnEquerre(brouilleur, poste);
    return {
      apres: { ...etat, unites: etat.unites.map((u) => (u.id === brouilleur.id ? { ...u, x: poste.x, y: poste.y, etat: 'agi' } : u)) },
      evenements: [{
        type: 'deplacement', uniteId: brouilleur.id,
        de: { x: brouilleur.x, y: brouilleur.y }, vers: poste, chemin, interrompu: false,
      }],
    };
  }

  if (geste === 'drone_abattu') {
    // Le drone du joueur survole la station adverse, l'antiaérien le descend :
    // le moteur émet l'attaque, la mise hors jeu, **puis** la révélation de
    // production (`combat.ts`, `mettreHorsJeu`). C'est le seul événement du
    // catalogue 3 que le HUD annonce, et il ne s'annonce que pour le camp 0.
    const drone = etat.unites.find((u) => u.camp === 0 && u.type === 'drone');
    const tireur = etat.unites.find((u) => u.camp === 1 && u.type === 'antiair') ?? sien;
    if (!drone || !tireur) return null;
    const station = STATION_ADVERSE_BANC;
    const proprietaire = etat.proprietaires[cleCase(station)];
    if (proprietaire === undefined || proprietaire === drone.camp) return null;
    const chemin = cheminEnEquerre(drone, station);
    const evenements: EvenementJeu[] = [];
    if (chemin.length > 1) {
      evenements.push({ type: 'deplacement', uniteId: drone.id, de: { x: drone.x, y: drone.y }, vers: station, chemin, interrompu: false });
    }
    // Un drone ne riposte pas : c'est un œil, pas une pièce de combat.
    evenements.push(
      { type: 'attaque', attaquantId: tireur.id, cibleId: drone.id, degats: drone.pv, riposte: 0 },
      { type: 'hors_jeu', uniteId: drone.id, camp: drone.camp, unite: drone.type },
      { type: 'production_revelee', camp: drone.camp, proprietaire, case: station, produites: produitesPar(etat, proprietaire) },
    );
    return {
      apres: {
        ...etat,
        unites: etat.unites
          .filter((u) => u.id !== drone.id)
          .map((u) => (u.id === tireur.id ? { ...u, etat: 'agi' } : u)),
      },
      evenements,
    };
  }

  // La marée : on **réécrit la grille**, ce que le génie fait aussi. La mécanique
  // régionale, elle, la réinterprète sans jamais l'écrire — mais côté rendu les
  // deux arrivent au même endroit : `signatureTerrain` change, et le sol doit
  // suivre. C'est exactement le gel qu'on a corrigé, et qui se revoit ici.
  //
  // Les deux sens sont **symétriques** et agissent tous les deux dès l'état de
  // départ : un bouton qui ne fait rien tant qu'on n'a pas pressé l'autre est un
  // bouton qu'on croit cassé.
  const haute = geste === 'maree_haute';
  const monte: Record<string, string> = { S: 'W', P: 'S' };
  const descend: Record<string, string> = { W: 'S', S: 'P' };
  const table = haute ? monte : descend;
  const grille = etat.grille.map((ligne, y) => {
    if (y < RANGS.eau) return ligne;
    return [...ligne].map((car, x) => (x <= 5 ? table[car] ?? car : car)).join('');
  });
  const touchees: Case[] = [];
  grille.forEach((ligne, y) => [...ligne].forEach((car, x) => {
    if (car !== etat.grille[y]?.[x]) touchees.push({ x, y });
  }));
  if (touchees.length === 0) return null;
  return {
    apres: { ...etat, grille },
    // Le terrain annoncé est celui qu'on vient d'écrire, pas un terrain type :
    // la mer et la plage ne montent pas au même endroit.
    evenements: touchees.map((c) => (haute
      ? { type: 'terrain_pose' as const, case: c, terrain: CAT_TERRAIN[grille[c.y]?.[c.x] ?? 'P'] ?? 'mer' }
      : { type: 'terrain_retire' as const, case: c })),
  };
}

// ---------------------------------------------------------------------------
// Ambiances prêtes
// ---------------------------------------------------------------------------

/** Une scène prête : un biome, une saison, une heure et une météo qui vont ensemble. */
export interface PresetAmbiance {
  cle: string;
  nom: string;
  biome: Biome;
  saison: Saison;
  phase: PhaseJour;
  meteo: Meteo;
}

/**
 * Dix scènes, une par biome, parce que la carte-catalogue ne change pas et que
 * c'est l'ambiance qui fait voir ce que le sol, l'eau et les silhouettes
 * deviennent sous un autre ciel. Chaque couple (saison, météo) existe dans la
 * table du climat (`engine/climat/meteo.ts`) pour au moins un climat de pays :
 * une neige d'été ou une canicule d'hiver n'apprendrait rien, aucune partie ne
 * la montrera. Les deux phases y sont, et les six météos.
 */
export const PRESETS_AMBIANCE: readonly PresetAmbiance[] = [
  { cle: 'matin_de_plaine', nom: 'Matin de plaine', biome: 'plaine', saison: 'printemps', phase: 'jour', meteo: 'clair' },
  { cle: 'lisiere_d_automne', nom: 'Lisière d’automne', biome: 'foret', saison: 'automne', phase: 'jour', meteo: 'brouillard' },
  { cle: 'nuit_de_pluie_en_montagne', nom: 'Nuit de pluie en montagne', biome: 'montagne', saison: 'automne', phase: 'nuit', meteo: 'pluie' },
  { cle: 'canicule_du_desert', nom: 'Canicule du désert', biome: 'desert', saison: 'ete', phase: 'jour', meteo: 'canicule' },
  { cle: 'mousson_de_jungle', nom: 'Mousson de jungle', biome: 'jungle', saison: 'ete', phase: 'nuit', meteo: 'pluie' },
  { cle: 'neige_au_crepuscule', nom: 'Neige au crépuscule', biome: 'neige', saison: 'hiver', phase: 'nuit', meteo: 'neige' },
  { cle: 'nuit_volcanique', nom: 'Nuit volcanique', biome: 'volcanique', saison: 'ete', phase: 'nuit', meteo: 'clair' },
  { cle: 'brouillard_sur_la_cote', nom: 'Brouillard sur la côte', biome: 'cotier', saison: 'automne', phase: 'jour', meteo: 'brouillard' },
  { cle: 'tempete_d_archipel', nom: 'Tempête d’archipel', biome: 'archipel', saison: 'automne', phase: 'jour', meteo: 'tempete' },
  { cle: 'hiver_des_marais', nom: 'Hiver des marais', biome: 'marais', saison: 'hiver', phase: 'jour', meteo: 'neige' },
];

// ---------------------------------------------------------------------------
// La vue du banc dans l'adresse
// ---------------------------------------------------------------------------

/** Tout ce qui fait une vue du banc : de quoi la retrouver depuis un lien. */
export interface VueBanc {
  monde: number;
  biome: Biome;
  saison: Saison;
  phase: PhaseJour;
  meteo: Meteo;
  paysAllie: CodePays;
  paysAdverse: CodePays;
  brouillard: boolean;
  genres: GenreBanc[];
}

/** Les vingt-quatre codes de pays du canon : ce que `decoderVue` accepte. */
export const PAYS_BANC: readonly CodePays[] = chargerPays().map((p) => p.code);

/**
 * La vue en chaîne de requête, sans `?`. Les clés sont courtes et **dans un
 * ordre fixe** : un lien copié deux fois donne deux fois le même texte, et
 * c'est ce qui permet de le comparer. `brouillard` n'apparaît que vrai ;
 * `genres` apparaît toujours, même vide, sinon « aucune surbrillance » se
 * confondrait avec « je n'ai rien dit » et reprendrait le défaut.
 */
export function encoderVue(v: VueBanc): string {
  const paires: [string, string][] = [
    ['monde', String(v.monde)],
    ['biome', v.biome],
    ['saison', v.saison],
    ['phase', v.phase],
    ['meteo', v.meteo],
    ['bleu', v.paysAllie],
    ['rouge', v.paysAdverse],
  ];
  if (v.brouillard) paires.push(['brouillard', '1']);
  paires.push(['genres', v.genres.join(',')]);
  return paires.map(([k, val]) => `${k}=${val}`).join('&');
}

/** Garde la valeur si elle est dans l'énumération, sinon le défaut. */
function parmi<T extends string>(valeurs: readonly T[], texte: string | null, defaut: T): T {
  return texte !== null && (valeurs as readonly string[]).includes(texte) ? (texte as T) : defaut;
}

/**
 * Relit une vue depuis une chaîne de requête, avec ou sans `?`. Tolérante :
 * une clé absente, vide ou hors de son énumération garde le défaut, clé par
 * clé — un lien vieilli d'une saison retrouve tout le reste. Le monde est
 * borné à un entier positif ; la borne haute est à l'interface, qui seule
 * sait combien de mondes elle porte. Le brouillard fait exception : il n'est
 * écrit que vrai, donc absent vaut faux.
 */
export function decoderVue(texte: string, defaut: VueBanc): VueBanc {
  const params = new URLSearchParams(texte.startsWith('?') ? texte.slice(1) : texte);
  // `Number(null)` et `Number('')` valent zéro : une clé absente doit garder le
  // défaut, pas ramener au premier monde.
  const mondeTexte = params.get('monde');
  const monde = mondeTexte ? Number(mondeTexte) : Number.NaN;
  const genresTexte = params.get('genres');
  const genres = genresTexte === null
    ? [...defaut.genres]
    : genresTexte.split(',').filter((g, i, tous): g is GenreBanc => (
      (GENRES_SURBRILLANCE as readonly string[]).includes(g) && tous.indexOf(g) === i
    ));
  return {
    monde: Number.isFinite(monde) ? Math.max(0, Math.floor(monde)) : defaut.monde,
    biome: parmi(BIOMES, params.get('biome'), defaut.biome),
    saison: parmi(SAISONS, params.get('saison'), defaut.saison),
    phase: parmi(PHASES_JOUR, params.get('phase'), defaut.phase),
    meteo: parmi(METEOS, params.get('meteo'), defaut.meteo),
    paysAllie: parmi(PAYS_BANC, params.get('bleu'), defaut.paysAllie),
    paysAdverse: parmi(PAYS_BANC, params.get('rouge'), defaut.paysAdverse),
    // Le brouillard n'est écrit que vrai : absent veut dire faux, pas « défaut »,
    // sinon une vue sans brouillard ne survivrait pas à l'aller-retour.
    brouillard: params.get('brouillard') === '1',
    genres,
  };
}
