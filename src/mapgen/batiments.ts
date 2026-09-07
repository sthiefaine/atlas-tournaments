/**
 * Passe 4 du pipeline : QG, usines, aéroports, ports, stations radar, villes,
 * villes neutres, routes, unités de départ — puis la passe de réparation.
 *
 * Tout est choisi **dans le domaine fondamental** et recopié par le groupe de
 * symétrie : le camp 0 décide, les autres reçoivent la même chose à l'isométrie
 * près. Les transformations que les camps n'occupent pas (le quatrième quadrant
 * à trois camps) donnent des propriétés neutres, jamais des trous.
 */

import { chargerUnites } from '../content/index';
import type { CampId, CleTerrain, CleUnite, UniteDepart } from '../schemas/types';
import {
  CAPTURABLES, abscisse, cellule, cheminMoinsCher, composantes, coutDe, distanceCases,
  distances, franchissable, lire, ordonnee, poser, poserBrut, voisins4, type Toile,
} from './grille';
import type { ParametresNormalises } from './parametres';
import type { Rng } from './rng';

/** Une propriété posée sur la carte, avec son camp (`-1` pour neutre). */
export interface Propriete {
  cellule: number;
  terrain: CleTerrain;
  camp: number;
}

/** Ce que la passe de construction laisse derrière elle. */
export interface Bati {
  /** Case du QG de chaque camp, indexée par `CampId`. */
  qg: number[];
  proprietes: Propriete[];
  unites: UniteDepart[];
}

/**
 * L'herbe haute (7 septembre 2026) se bâtit comme la plaine qu'elle était : le
 * générateur la sème après le bâti (`herbes.ts`), mais si une toile en porte
 * déjà, le bâti garde la priorité sur les taches — comme sur la forêt.
 */
const CONSTRUCTIBLE: readonly CleTerrain[] = ['plaine', 'foret', 'plage', 'herbe_haute'];

/** Vrai si le générateur accepte de bâtir sur cette case. */
function batissable(t: Toile, c: number): boolean {
  return CONSTRUCTIBLE.includes(lire(t, c));
}

/** Cases du domaine fondamental dont l'orbite couvre tout le groupe. */
function basePropre(t: Toile): number[] {
  return t.cadre.base.filter((c) => t.cadre.orbite(c).length === t.cadre.ordre);
}

/**
 * Toutes les cases dont l'orbite couvre tout le groupe, représentantes ou non.
 * Le représentant d'une orbite est un choix arbitraire (sa case d'indice
 * minimal), et sous une rotation la frontière du domaine fondamental passe
 * près du QG : la côte à portée du camp 0 appartient souvent au représentant
 * d'un autre quadrant. Un port ou une station radar se choisit donc parmi
 * toutes les cases d'orbite pleine ; l'orbite se pose depuis la case retenue
 * (`poserOrbiteBatie`), le représentant n'y est pour rien.
 */
function orbitesPleines(t: Toile): number[] {
  const total = t.largeur * t.hauteur;
  const sortie: number[] = [];
  for (let c = 0; c < total; c += 1) if (t.cadre.orbite(c).length === t.cadre.ordre) sortie.push(c);
  return sortie;
}

// ---------------------------------------------------------------------------
// QG
// ---------------------------------------------------------------------------

/**
 * Choisit la case du QG du camp 0. Le score est la plus courte distance à pied
 * entre deux QG : on la veut maximale, pour que personne ne commence à portée
 * de canon de l'adversaire, et finie, pour que la partie puisse se jouer.
 */
function choisirQg(t: Toile, p: ParametresNormalises): number | null {
  const centre = cellule(t, Math.floor(t.largeur / 2), Math.floor(t.hauteur / 2));
  const transformations = t.cadre.transformationsCamps.slice(0, p.camps);

  const candidats = basePropre(t)
    .filter((c) => batissable(t, c))
    .filter((c) => {
      const images = transformations.map((i) => t.cadre.image(i, c));
      return new Set(images).size === images.length;
    })
    .sort((a, b) => distanceCases(t, b, centre) - distanceCases(t, a, centre) || a - b)
    .slice(0, 60);

  let meilleur: number | null = null;
  let meilleurScore = -1;
  for (const c of candidats) {
    const d = distances(t, [c], 'pied');
    let score = Infinity;
    for (const i of transformations) {
      const image = t.cadre.image(i, c);
      if (image === c) continue;
      const pas = d[image] ?? -1;
      if (pas < 0) { score = -1; break; }
      if (pas < score) score = pas;
    }
    if (score === Infinity) score = 0;
    if (score > meilleurScore) { meilleurScore = score; meilleur = c; }
  }
  return meilleurScore > 0 ? meilleur : null;
}

// ---------------------------------------------------------------------------
// Propriétés
// ---------------------------------------------------------------------------

interface Demande {
  terrain: CleTerrain;
  cible: number;
  min: number;
  max: number;
}

/**
 * Ordonne les bâtiments d'un camp : usines proches, aéroports ensuite, puis les
 * ports et les stations radar (7 septembre 2026), villes en éventail. Les ports
 * passent avant les villes parce qu'ils sont les plus contraints — une côte,
 * une mer commune — et que les villes se contentent de ce qui reste.
 */
function demandes(p: ParametresNormalises): Demande[] {
  const liste: Demande[] = [];
  for (let k = 0; k < p.usinesParCamp; k += 1) {
    liste.push({ terrain: 'usine', cible: 3 + k, min: 2, max: 9 });
  }
  for (let k = 0; k < p.aeroportsParCamp; k += 1) {
    liste.push({ terrain: 'aeroport', cible: 5 + k, min: 3, max: 11 });
  }
  // Un port se tient à la distance d'un aéroport : une base de production
  // avancée, pas un bâtiment de cour de QG.
  for (let k = 0; k < p.portsParCamp; k += 1) {
    liste.push({ terrain: 'port', cible: 5 + k, min: 3, max: 11 });
  }
  // Une station radar est dans l'orbite du camp, jamais collée au QG (`min: 2`,
  // et l'écart de deux cases de `espaceLibre` interdit même la diagonale).
  for (let k = 0; k < p.radarsParCamp; k += 1) {
    liste.push({ terrain: 'radar', cible: 4 + k, min: 2, max: 10 });
  }
  for (let k = 0; k < p.villesParCamp; k += 1) {
    liste.push({ terrain: 'ville', cible: 2 + 2 * k, min: 1, max: 8 + 2 * k });
  }
  return liste;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/**
 * Taille minimale de la mer qu'un port dessert. Deux cases d'eau partagées par
 * deux ports en miroir sont une mare, pas une mer : un navire n'y manœuvre pas.
 */
const MER_MIN_PORT = 4;

/** Étiquettes des cases de mer voisines d'une case, sans doublon. */
function mersVoisines(t: Toile, c: number, etiquettes: Int32Array): number[] {
  const sortie: number[] = [];
  for (const v of voisins4(t, c)) {
    if (lire(t, v) !== 'mer') continue;
    const e = etiquettes[v] ?? -1;
    if (e >= 0 && !sortie.includes(e)) sortie.push(e);
  }
  return sortie;
}

/**
 * La mer commune à toute l'orbite d'une case, ou `null`. Un port n'a de sens
 * que si l'image de chaque camp touche la **même** composante de mer : sinon le
 * navire d'un camp ne rencontre jamais celui de l'autre. Chaque image est
 * vérifiée pour elle-même — on ne déduit pas la côte du miroir, on la lit.
 */
function merCommune(
  t: Toile,
  base: number,
  mer: { etiquettes: Int32Array; tailles: number[] },
): number | null {
  let communes: number[] | null = null;
  for (const image of t.cadre.orbite(base)) {
    const voisines = mersVoisines(t, image, mer.etiquettes);
    if (voisines.length === 0) return null;
    communes = communes === null ? voisines : communes.filter((e) => voisines.includes(e));
    if (communes.length === 0) return null;
  }
  if (communes === null) return null;
  const assezGrandes = communes.filter((e) => (mer.tailles[e] ?? 0) >= MER_MIN_PORT);
  if (assezGrandes.length === 0) return null;
  // La plus vaste : c'est celle où une flotte a le plus de chances de servir.
  return assezGrandes.reduce((a, b) => ((mer.tailles[b] ?? 0) > (mer.tailles[a] ?? 0) ? b : a));
}

/** Vrai si aucune propriété n'est déjà posée à moins de `ecart` cases. */
function espaceLibre(t: Toile, c: number, occupees: readonly number[], ecart = 2): boolean {
  return occupees.every((o) => distanceCases(t, c, o) >= ecart);
}

/**
 * Pose une propriété sur toute l'orbite d'une case du domaine fondamental :
 * une par camp, plus une neutre par transformation inoccupée.
 */
function poserOrbiteBatie(
  t: Toile,
  bati: Bati,
  base: number,
  terrain: CleTerrain,
  camps: number,
): void {
  const vues: number[] = [];
  for (let i = 0; i < t.cadre.ordre; i += 1) {
    const image = t.cadre.image(i, base);
    if (vues.includes(image)) continue;
    vues.push(image);
    const rang = t.cadre.transformationsCamps.indexOf(i);
    const camp = rang >= 0 && rang < camps ? rang : -1;
    poserBrut(t, image, terrain);
    t.proprietaires[image] = camp;
    bati.proprietes.push({ cellule: image, terrain, camp });
  }
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/** Passe 4 complète : bâtiments, routes, unités de départ. */
export function construire(t: Toile, rng: Rng, p: ParametresNormalises): Bati | null {
  const bati: Bati = { qg: [], proprietes: [], unites: [] };
  const baseQg = choisirQg(t, p);
  if (baseQg === null) return null;

  // QG : un par camp, plus une ville neutre sur les transformations inoccupées.
  const vues: number[] = [];
  for (let i = 0; i < t.cadre.ordre; i += 1) {
    const image = t.cadre.image(i, baseQg);
    if (vues.includes(image)) continue;
    vues.push(image);
    const rang = t.cadre.transformationsCamps.indexOf(i);
    const camp = rang >= 0 && rang < p.camps ? rang : -1;
    const terrain: CleTerrain = camp >= 0 ? 'qg' : 'ville';
    poserBrut(t, image, terrain);
    t.proprietaires[image] = camp;
    bati.proprietes.push({ cellule: image, terrain, camp });
    if (camp >= 0) bati.qg[camp] = image;
  }

  const distancesQg = bati.qg.map((q) => distances(t, [q], 'pied'));
  const depuisQg0 = distancesQg[0] as Int32Array;
  const occupees = bati.proprietes.map((b) => b.cellule);

  // Propriétés de camp : choisies près du QG 0, jamais plus près d'un QG adverse.
  // Les bâtiments d'origine se choisissent dans le domaine fondamental, les
  // ports et radars parmi toutes les orbites pleines (voir `orbitesPleines`) —
  // élargir le bassin des premiers changerait les cartes générées avant eux.
  // La mer est étiquetée une fois, avant toute pose : aucun bâtiment ne la
  // modifie, et un port posé ne fait que la rejoindre.
  const pool = basePropre(t).filter((c) => batissable(t, c));
  const poolLarge = p.portsParCamp > 0 || p.radarsParCamp > 0
    ? orbitesPleines(t).filter((c) => batissable(t, c))
    : pool;
  const mer = p.portsParCamp > 0 ? composantes(t, 'mer') : null;
  let merDesPorts: number | null = null;
  for (const demande of demandes(p)) {
    let choisie: number | null = null;
    let meilleur = Infinity;
    const bassin = demande.terrain === 'port' || demande.terrain === 'radar' ? poolLarge : pool;
    for (const c of bassin) {
      const d = depuisQg0[c] ?? -1;
      if (d < demande.min || d > demande.max) continue;
      if (!espaceLibre(t, c, occupees)) continue;
      let propre = true;
      for (let camp = 1; camp < bati.qg.length; camp += 1) {
        const autre = (distancesQg[camp] as Int32Array)[c] ?? -1;
        if (autre >= 0 && autre <= d) { propre = false; break; }
      }
      if (!propre) continue;
      let score = Math.abs(d - demande.cible) * 4 + rng.suivant();
      if (demande.terrain === 'port') {
        if (mer === null) continue;
        const commune = merCommune(t, c, mer);
        if (commune === null) continue;
        // Tous les ports d'une carte desservent la même mer : le second port
        // d'un camp ne va pas ouvrir une flotte sur un lac où personne ne vient.
        if (merDesPorts !== null && commune !== merDesPorts) continue;
        // Une grève d'abord — c'est une plaine qui bordait la mer —, la forêt
        // seulement à défaut, et une petite mer se paie en distance.
        if (lire(t, c) === 'foret') score += 2;
        score += Math.max(0, 16 - (mer.tailles[commune] ?? 0)) / 4;
      }
      if (score < meilleur) { meilleur = score; choisie = c; }
    }
    // Aucun candidat : on pose moins de ce bâtiment. La carte le dit par ses
    // mesures (`ports_par_camp`, `radars_par_camp` contre les paramètres).
    if (choisie === null) continue;
    if (demande.terrain === 'port' && mer !== null) merDesPorts = merCommune(t, choisie, mer);
    poserOrbiteBatie(t, bati, choisie, demande.terrain, p.camps);
    occupees.push(...t.cadre.orbite(choisie));
  }

  placerVillesNeutres(t, rng, p, bati, occupees, distancesQg);
  tracerRoutes(t, p, bati);
  reparer(t, p, bati);
  placerUnites(t, p, bati);
  return bati;
}

/**
 * Villes neutres : `villesNeutres` est un **minimum** (`03-schemas.md` §5). On
 * privilégie les cases à orbite courte — l'axe de symétrie, le centre — qui sont
 * à égale distance de tous les camps, donc réellement disputées.
 */
function placerVillesNeutres(
  t: Toile,
  rng: Rng,
  p: ParametresNormalises,
  bati: Bati,
  occupees: number[],
  distancesQg: readonly Int32Array[],
): void {
  let neutres = bati.proprietes.filter((b) => b.camp < 0).length;
  if (neutres >= p.villesNeutres) return;

  const candidats = t.cadre.base
    .filter((c) => batissable(t, c))
    .map((c) => {
      const orbite = t.cadre.orbite(c);
      const ecarts = distancesQg.map((d) => d[c] ?? -1);
      const atteignable = ecarts.every((d) => d >= 0);
      const moyenne = ecarts.reduce((a, b) => a + b, 0) / Math.max(1, ecarts.length);
      const dispersion = Math.max(...ecarts) - Math.min(...ecarts);
      return { c, orbite, atteignable, moyenne, dispersion, bruit: rng.suivant() };
    })
    .filter((e) => e.atteignable)
    .sort((a, b) =>
      a.orbite.length - b.orbite.length
      || a.dispersion - b.dispersion
      || Math.abs(a.moyenne - 5) - Math.abs(b.moyenne - 5)
      || a.bruit - b.bruit
      || a.c - b.c);

  // Deux passes : on tient l'écart de deux cases tant qu'on peut, puis on serre.
  for (const ecart of [2, 1]) {
    for (const candidat of candidats) {
      if (neutres >= p.villesNeutres) return;
      if (!batissable(t, candidat.c)) continue;
      if (!espaceLibre(t, candidat.c, occupees, ecart)) continue;
      for (const image of candidat.orbite) {
        poserBrut(t, image, 'ville');
        t.proprietaires[image] = -1;
        bati.proprietes.push({ cellule: image, terrain: 'ville', camp: -1 });
        neutres += 1;
      }
      occupees.push(...candidat.orbite);
    }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Coût de tracé d'une route : la mer est interdite, le relief se paie. */
function coutRoute(terrain: CleTerrain): number | null {
  switch (terrain) {
    case 'mer': return null;
    case 'route': case 'pont': return 1;
    case 'ville': case 'usine': case 'aeroport': case 'qg': case 'radar': case 'port': return 1;
    case 'plaine': case 'herbe_haute': return 2;
    case 'plage': return 3;
    case 'foret': return 4;
    case 'riviere': return 6;
    case 'montagne': return 9;
  }
}

/** Terrains qu'une route recouvre : l'herbe haute comme la plaine, sans trou dans le ruban. */
const SOUS_ROUTE: readonly CleTerrain[] = ['plaine', 'herbe_haute', 'foret', 'plage', 'montagne'];

/** Écrit un chemin sur la carte : route sur la terre, pont sur la rivière. */
function ecrireChemin(t: Toile, chemin: readonly number[]): void {
  for (const c of chemin) {
    const terrain = lire(t, c);
    if (terrain === 'riviere') poser(t, c, 'pont');
    else if (SOUS_ROUTE.includes(terrain)) poser(t, c, 'route');
  }
}

/** Bâtiments raccordés dès que le réseau est un peu dense : aéroports, ports, radars. */
const RACCORDES_SI_DENSE: readonly CleTerrain[] = ['aeroport', 'port', 'radar'];

/**
 * Routes : elles relient le QG à ses usines, à ses aéroports — ports et
 * stations radar suivent la même règle — et à une part de ses villes fixée par
 * `densiteRoutes`, plus un axe vers le centre de la carte. L'axe central est ce
 * qui met les QG en relation les uns avec les autres : mirroir compris, il
 * forme la route qui traverse la carte de part en part.
 */
export function tracerRoutes(t: Toile, p: ParametresNormalises, bati: Bati): void {
  const qg0 = bati.qg[0];
  if (qg0 === undefined) return;
  const mienne = bati.proprietes.filter((b) => b.camp === 0 && b.cellule !== qg0);
  const depuis = distances(t, [qg0], 'pied');
  const trie = mienne.slice().sort((a, b) => (depuis[a.cellule] ?? 0) - (depuis[b.cellule] ?? 0) || a.cellule - b.cellule);

  const villes = trie.filter((b) => b.terrain === 'ville');
  const aRelier: number[] = [
    ...trie.filter((b) => b.terrain === 'usine').map((b) => b.cellule),
    ...(p.densiteRoutes >= 0.3 ? trie.filter((b) => RACCORDES_SI_DENSE.includes(b.terrain)).map((b) => b.cellule) : []),
    ...villes.slice(0, Math.ceil(p.densiteRoutes * villes.length)).map((b) => b.cellule),
  ];

  // Axe central : sans lui, deux camps peuvent n'avoir aucune route commune.
  const centre = caseCentrale(t);
  if (centre !== null) aRelier.push(centre);

  for (const cible of aRelier) {
    const chemin = cheminMoinsCher(t, qg0, cible, coutRoute);
    if (chemin) ecrireChemin(t, chemin);
  }
}

/** Case terrestre la plus proche du centre géométrique. */
function caseCentrale(t: Toile): number | null {
  const cx = Math.floor(t.largeur / 2);
  const cy = Math.floor(t.hauteur / 2);
  const centre = cellule(t, cx, cy);
  const total = t.largeur * t.hauteur;
  let meilleure: number | null = null;
  let meilleurEcart = Infinity;
  for (let c = 0; c < total; c += 1) {
    if (!franchissable(lire(t, c), 'chenilles')) continue;
    const ecart = distanceCases(t, c, centre);
    if (ecart < meilleurEcart) { meilleurEcart = ecart; meilleure = c; }
  }
  return meilleure;
}

// ---------------------------------------------------------------------------
// Réparation
// ---------------------------------------------------------------------------

/** Coût de percée : ce qu'il en coûte d'ouvrir un passage aux blindés. */
function coutPercee(terrain: CleTerrain): number | null {
  const normal = coutDe(terrain, 'chenilles');
  if (normal !== null) return normal;
  if (terrain === 'riviere') return 5;   // deviendra un pont
  if (terrain === 'montagne') return 9;  // deviendra une route de col
  return null;                            // la mer ne se perce pas
}

/** Ouvre le chemin : rivière en pont, montagne en route. */
function percer(t: Toile, chemin: readonly number[]): void {
  for (const c of chemin) {
    const terrain = lire(t, c);
    if (terrain === 'riviere') poser(t, c, 'pont');
    else if (terrain === 'montagne') poser(t, c, 'route');
  }
}

/**
 * Réparation finale, dans l'ordre : accès blindé entre QG et vers les usines,
 * zones mortes, puis propriétés mal orientées. Chaque correction passe par
 * `poser`, donc la symétrie tient jusqu'au bout.
 */
export function reparer(t: Toile, p: ParametresNormalises, bati: Bati): void {
  reparerAcces(t, bati);
  reparerZonesMortes(t, bati);
  reparerProprietes(t, bati);
}

/** Tout QG rejoint tout QG et toute usine, en chenilles comme à pied. */
function reparerAcces(t: Toile, bati: Bati): void {
  const cibles: number[] = [
    ...bati.qg,
    ...bati.proprietes.filter((b) => b.terrain === 'usine').map((b) => b.cellule),
  ];
  for (let essai = 0; essai < 8; essai += 1) {
    const { etiquettes } = composantes(t, 'chenilles');
    const reference = bati.qg[0];
    if (reference === undefined) return;
    const groupe = etiquettes[reference];
    const isolees = cibles.filter((c) => etiquettes[c] !== groupe);
    if (isolees.length === 0) return;
    const premiere = isolees[0] as number;
    const chemin = cheminMoinsCher(t, reference, premiere, coutPercee);
    if (!chemin) return;
    percer(t, chemin);
  }
}

/** Aucune case terrestre ne reste hors d'atteinte d'un QG. */
function reparerZonesMortes(t: Toile, bati: Bati): void {
  for (let essai = 0; essai < 4; essai += 1) {
    const d = distances(t, bati.qg, 'pied');
    const total = t.largeur * t.hauteur;
    const perdues: number[] = [];
    for (let c = 0; c < total; c += 1) {
      if (d[c] === -1 && franchissable(lire(t, c), 'pied')) perdues.push(c);
    }
    if (perdues.length === 0) return;
    // Ces poches sont minuscules et sans bâtiment : on les rend à la mer, orbite
    // comprise, et seulement si aucune image ne porte de propriété.
    for (const c of perdues) {
      const orbite = t.cadre.orbite(c);
      if (orbite.some((image) => CAPTURABLES.includes(lire(t, image)))) continue;
      poser(t, c, 'mer');
    }
  }
}

/** Une propriété plus proche d'un QG adverse que du sien redevient neutre. */
function reparerProprietes(t: Toile, bati: Bati): void {
  const distancesQg = bati.qg.map((q) => distances(t, [q], 'pied'));
  for (const propriete of bati.proprietes) {
    if (propriete.camp < 0 || propriete.terrain === 'qg') continue;
    const sienne = (distancesQg[propriete.camp] as Int32Array)[propriete.cellule] ?? -1;
    let usurpee = false;
    for (let camp = 0; camp < distancesQg.length; camp += 1) {
      if (camp === propriete.camp) continue;
      const autre = (distancesQg[camp] as Int32Array)[propriete.cellule] ?? -1;
      if (autre >= 0 && (sienne < 0 || autre < sienne)) { usurpee = true; break; }
    }
    if (usurpee) {
      propriete.camp = -1;
      t.proprietaires[propriete.cellule] = -1;
    }
  }
}

// ---------------------------------------------------------------------------
// Unités de départ
// ---------------------------------------------------------------------------

/** Deux types de départ lus dans le catalogue : jamais un nom d'unité en dur. */
function typesDepart(): { capture: CleUnite; escorte: CleUnite } {
  const unites = chargerUnites();
  const parCout = (a: { cout: number; cle: string }, b: { cout: number; cle: string }): number =>
    a.cout - b.cout || (a.cle < b.cle ? -1 : 1);
  const capture = unites.filter((u) => u.capture && u.domaine === 'terre').sort(parCout)[0];
  const escorte = unites
    .filter((u) => !u.capture && u.domaine === 'terre'
      && Object.values(u.degats).some((d) => (d ?? 0) > 0))
    .sort(parCout)[0];
  return {
    capture: capture?.cle ?? 'infanterie',
    escorte: escorte?.cle ?? 'recon',
  };
}

/** Unités de départ : deux par camp, aux mêmes positions relatives pour tous. */
export function placerUnites(t: Toile, p: ParametresNormalises, bati: Bati): void {
  const qg0 = bati.qg[0];
  if (qg0 === undefined) return;
  const types = typesDepart();
  const unites = chargerUnites();
  const mouvementDe = (cle: CleUnite): 'pied' | 'roues' | 'chenilles' | 'bottes' => {
    const fiche = unites.find((u) => u.cle === cle);
    const m = fiche?.typeMouvement ?? 'pied';
    return m === 'roues' || m === 'chenilles' || m === 'bottes' ? m : 'pied';
  };

  const depuis = distances(t, [qg0], 'pied');
  const occupees: number[] = [];
  for (const cle of [types.capture, types.escorte]) {
    const mouvement = mouvementDe(cle);
    const candidats = basePropre(t)
      .filter((c) => !occupees.includes(c))
      .filter((c) => t.proprietaires[c] === -1 && lire(t, c) !== 'mer')
      .filter((c) => franchissable(lire(t, c), mouvement))
      .filter((c) => (depuis[c] ?? -1) >= 1 && (depuis[c] ?? -1) <= 5)
      .sort((a, b) => (depuis[a] ?? 0) - (depuis[b] ?? 0) || a - b);
    const choisie = candidats[0];
    if (choisie === undefined) continue;
    occupees.push(choisie);
    for (let camp = 0; camp < p.camps; camp += 1) {
      const i = t.cadre.transformationsCamps[camp];
      if (i === undefined) continue;
      const image = t.cadre.image(i, choisie);
      bati.unites.push({ camp: camp as CampId, type: cle, x: abscisse(t, image), y: ordonnee(t, image) });
    }
  }
}
