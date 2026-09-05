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
 * jamais les douze terrains ni les onze unités : on attend qu'ils apparaissent,
 * et un défaut de rendu se découvre en jouant, tard. La carte-catalogue les
 * range côte à côte, y compris les cas qui ont réellement cassé — un bâtiment
 * encastré dans la montagne, une plage entre mer et plaine.
 *
 * **On rejoue l'événement, pas la règle.** Un banc n'a pas à être une partie
 * légale : il émet l'événement que le moteur émettrait et l'état qui en
 * résulterait, sans passer par `appliquer`. C'est ce qui permet de déclencher
 * une capture ou une mise hors jeu à la demande, dans n'importe quel ordre.
 */

import { cleCase, SEUIL_CAPTURE, type Catalogue, type EtatPartie, type EvenementJeu } from '@/engine/index';
import type { Surbrillance } from '@/render/index';
import { CARACTERE_PAR_TERRAIN, type BaseSilhouette, type Case, type CampId, type CleTerrain, type CleUnite, type MapDef } from '@/schemas/types';

/**
 * La date portée par l'enveloppe de la carte. **Fixe** : le banc doit être
 * identique d'une ouverture à l'autre, et une couche pure ne lit pas l'horloge.
 */
const DATE_BANC = '2026-09-05';

/** Largeur de la carte-catalogue. Le validateur exige entre 10 et 40. */
export const LARGEUR_BANC = 20;

/** La ville que les gestes de capture se disputent : celle du camp 1 au départ. */
export const VILLE_BANC: Case = { x: 1, y: 3 };

/** La ville désaffectée, à l'écart du rang : une palissade, pas de liseré, mât nu. */
export const VILLE_DESAFFECTEE_BANC: Case = { x: 15, y: 3 };
/** Hauteur de la carte-catalogue. */
export const HAUTEUR_BANC = 12;

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
} as const;

/**
 * La grille du banc.
 *
 * Les deux rangs de terrains sont **identiques**, ce qui montre d'un coup les
 * deux jonctions qui comptent : celle entre deux cases du même terrain et celle
 * avec la plaine. Le rang 9 est le cas qui a cassé — des bâtiments encastrés
 * entre des montagnes —, et les deux derniers rangs portent la mer, la plage,
 * la rivière et son pont, c'est-à-dire tout ce qui bouge quand la marée monte.
 *
 * À droite des rangs 8 à 11, le **réseau de voies** : un bout, une longue
 * droite, une croix, deux T et un virage, et un pont qui franchit une rivière
 * nord-sud — de quoi voir chaque pièce et le raccord d'une voie au bord de la
 * carte. Une carte de mission n'aligne jamais les six pièces côte à côte.
 */
const GRILLE_BANC: readonly string[] = [
  'PFMRSVNWCUATPPPPPPPP',
  'PFMRSVNWCUATPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPP',
  'CCCUUUAAAHHTTTPCPPPP',
  'PPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPPPPPPPP',
  'PPPPPPPPPPPPPRPPPPPP',
  'MCMUMAMCMPPPPRPPVPRR',
  'WWWSPPPPRRRRRRRRNRRR',
  'WWWSPPPPPPPPPRPPVPPP',
];

/**
 * Les onze unités du catalogue, dans l'ordre où elles se lisent : la piétaille,
 * puis les roues, puis les chenilles, puis ce qui vole.
 */
export const UNITES_BANC: readonly CleUnite[] = [
  'infanterie', 'meca', 'genie', 'recon', 'brouilleur', 'roquettes', 'char_leger',
  'char_lourd', 'antiair', 'artillerie', 'transport', 'helico', 'drone', 'drone_filaire',
];

/**
 * Les bases de silhouette **qu'aucune unité du canon n'utilise**.
 *
 * `rail`, `ailes` et `coque` sont écrites dans `render3d/pieces.ts` depuis le
 * début et n'ont jamais été vues à l'écran (`CLAUDE.md`, manque n° 5) : rien ne
 * les porte. On les fait apparaître en échangeant la base de trois unités dans
 * une **copie** du catalogue — jamais dans le canon, qui reste la vérité.
 */
export const BASES_JAMAIS_VUES: Readonly<Record<string, BaseSilhouette>> = Object.freeze({
  transport: 'coque',
  artillerie: 'ailes',
  roquettes: 'rail',
});

/** La carte-catalogue : treize terrains, cinq bâtiments, quatorze unités par camp. */
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

  const unitesDepart = ([0, 1] as const).flatMap((camp) => UNITES_BANC.map((type, x) => ({
    camp: camp as CampId,
    type,
    x,
    y: camp === 0 ? RANGS.unitesCamp0 : RANGS.unitesCamp1,
  })));

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

/**
 * La version de catalogue du banc.
 *
 * **Deux, obligatoirement** : le catalogue 1 ne compte que dix unités, le génie
 * y manque. Un banc monté sur le scénario de démonstration, qui est en
 * catalogue 1, perdait le génie **sans rien dire** — la carte se montait, il
 * n'était simplement pas là. C'est le genre d'absence qu'un banc d'essai est
 * censé rendre impossible.
 */
export const VERSION_CATALOGUE_BANC = 3;

/**
 * Un scénario pour le banc : celui qu'on lui prête, forcé sur le catalogue qui
 * porte toutes les unités. On ne modifie pas le canon, on en prend une copie.
 */
export function scenarioBanc<T extends { catalogueVersion: number }>(base: T): T {
  return { ...base, catalogueVersion: VERSION_CATALOGUE_BANC };
}

/**
 * Une copie du catalogue où trois unités portent une base jamais vue.
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
 */
export const CHEMIN_BANC: readonly Case[] = [
  { x: 13, y: RANGS.surbrillancesHautes },
  { x: 14, y: RANGS.surbrillancesHautes },
  { x: 15, y: RANGS.surbrillancesHautes },
  { x: 15, y: RANGS.unitesCamp0 },
  { x: 15, y: RANGS.surbrillancesBasses },
  { x: 16, y: RANGS.surbrillancesBasses },
  { x: 17, y: RANGS.surbrillancesBasses },
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
  'deplacement', 'attaque', 'capture_en_cours', 'capture', 'remise_en_service', 'hors_jeu',
  'maree_haute', 'maree_basse',
] as const;
export type GesteBanc = typeof GESTES_BANC[number];

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
    return {
      apres: { ...etat, unites: etat.unites.map((u) => (u.id === mien.id ? { ...u, x: arrivee.x, y: arrivee.y } : u)) },
      evenements: [{
        type: 'deplacement', uniteId: mien.id,
        de: { x: mien.x, y: mien.y }, vers: arrivee, chemin, interrompu: false,
      }],
    };
  }

  if (geste === 'attaque') {
    if (!mien || !sien) return null;
    const degats = Math.min(sien.pv, 42);
    const riposte = Math.min(mien.pv - 1, 17);
    return {
      apres: {
        ...etat,
        unites: etat.unites.map((u) => {
          if (u.id === sien.id) return { ...u, pv: sien.pv - degats };
          if (u.id === mien.id) return { ...u, pv: mien.pv - riposte };
          return u;
        }),
      },
      evenements: [{ type: 'attaque', attaquantId: mien.id, cibleId: sien.id, degats, riposte }],
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
        { type: 'remise_en_service', uniteId: capteur.id, case: cible, camp },
        { type: 'capture', uniteId: capteur.id, case: cible, points: SEUIL_CAPTURE * 2, acquis: true, camp },
      ],
    };
  }

  if (geste === 'hors_jeu') {
    if (!sien) return null;
    return {
      apres: { ...etat, unites: etat.unites.filter((u) => u.id !== sien.id) },
      evenements: [{ type: 'hors_jeu', uniteId: sien.id, camp: sien.camp, unite: sien.type }],
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
