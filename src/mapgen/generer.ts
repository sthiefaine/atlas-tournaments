/**
 * Le générateur : `(ParametresCarte, graine) → MapDef`, déterministe au bit près.
 *
 * Pipeline en cinq passes (`02-architecture.md` §3.3) :
 *   1. relief — bruit de valeur seedé, seuillé en mer, montagnes et forêts ;
 *   2. côtes et hydrographie — plages, rivières, lissage, terres reliées (une
 *      carte à ports garde sa ceinture de mer intacte, 7 septembre 2026) ;
 *   3. bâtiments — QG à distance maximale, usines, aéroports, villes, villes neutres ;
 *   4. réseau — routes du QG vers ses bâtiments et vers l'axe central ;
 *   5. réparation — accès blindé entre QG, zones mortes, propriétés mal orientées ;
 *   6. hautes herbes — des taches sur la plaine que le bâti a laissée
 *      (`herbes.ts`, 7 septembre 2026), invisibles pour tout ce qui précède.
 *
 * La symétrie n'est pas une passe finale : le cadre (`symetrie.ts`) propage chaque
 * écriture sur toute l'orbite de la case, donc la carte est symétrique du premier
 * seuillage à la dernière route. C'est ce qui rend l'égalité de valeur entre camps
 * exacte plutôt qu'approchée.
 */

import type { CampId, DateIso, MapDef, ParametresCarte } from '../schemas/types';
import { construire } from './batiments';
import {
  CAPTURABLES, caractereDe, creerToile, distances, franchissable, lire, poserBrut,
  type Toile,
} from './grille';
import { semerHerbes } from './herbes';
import { normaliser, reglagesDe, versParametresCarte, type ParametresNormalises } from './parametres';
import { anneauDuBord, lisserCotes, poserPlages, poserRelief, relierTerres, tracerRivieres } from './relief';
import { creerRng, type Rng } from './rng';
import { creerCadre } from './symetrie';

/** Version du générateur : à incrémenter dès qu'une grille change à graine égale. */
export const MAPGEN_VERSION = 2;

/**
 * Date portée par l'enveloppe d'une carte générée. Le générateur n'a pas d'horloge
 * (`02-architecture.md` §7 : ni `Date.now`, ni `new Date`) ; le serveur réécrit
 * `creeLe` et `majLe` à l'enregistrement.
 */
export const DATE_GENERATION: DateIso = '2026-01-01';

/** Noms français des biomes, pour le titre de la carte. */
const NOMS_BIOME: Record<string, string> = {
  plaine: 'Plaines', foret: 'Forêts', montagne: 'Montagnes', desert: 'Désert',
  jungle: 'Jungle', neige: 'Neiges', volcanique: 'Terres volcaniques',
  cotier: 'Littoral', archipel: 'Archipel', marais: 'Marais',
};

/** Une grille terminée et le bâti qu'elle porte. */
interface Fabrication {
  toile: Toile;
  unites: MapDef['unitesDepart'];
}

/** Construit la grille de travail pour un essai donné. */
function fabriquer(p: ParametresNormalises, rng: Rng): Fabrication | null {
  const cadre = creerCadre(p.symetrie, p.camps, p.largeur, p.hauteur);
  const toile = creerToile(cadre, 'plaine');
  const reglages = reglagesDe(p.biome);

  const altitude = poserRelief(toile, rng.branche('relief'), p);
  tracerRivieres(toile, rng.branche('rivieres'), altitude, reglages.rivieres);
  lisserCotes(toile);
  // Des ports demandés ont mis la mer en ceinture (`poserRelief`) : aucune
  // chaussée ne la coupe. Sans port, rien ne change — c'est ce qui garde
  // identiques les cartes générées avant eux.
  relierTerres(toile, p.portsParCamp > 0 ? mursDe(toile, anneauDuBord(toile)) : undefined);
  poserPlages(toile);

  const bati = construire(toile, rng.branche('bati'), p);
  if (bati === null) return null;
  // Les hautes herbes viennent en dernier, sur la plaine que le bâti a laissée
  // et hors de la cour des QG : semées avant, routes et bâtiments en écrasaient
  // jusqu'aux deux tiers (`herbes.ts`). Sans le paramètre, rien n'est tiré.
  semerHerbes(toile, rng.branche('herbes'), p.ratioHerbesHautes, bati.qg);
  return { toile, unites: bati.unites };
}

/** Masque de cases infranchissables pour les chaussées, à partir d'une liste. */
function mursDe(t: Toile, cases: readonly number[]): Uint8Array {
  const murs = new Uint8Array(t.largeur * t.hauteur);
  for (const c of cases) murs[c] = 1;
  return murs;
}

/**
 * Brouille le décor quand aucune symétrie n'a été demandée : la topologie reste
 * symétrique — donc l'équité aussi — mais la carte ne se lit plus comme un miroir.
 * L'échange plaine ↔ forêt ne change ni la franchissabilité ni le nombre de pas
 * entre deux cases : il est invisible pour toutes les mesures d'équilibre.
 * L'herbe haute reste hors du brouillage : ses taches sont voulues, les
 * éparpiller case par case les déferait.
 */
function brouillerDecor(t: Toile, rng: Rng): void {
  const total = t.largeur * t.hauteur;
  for (let c = 0; c < total; c += 1) {
    const terrain = lire(t, c);
    if (terrain !== 'plaine' && terrain !== 'foret') continue;
    if (!rng.chance(0.14)) continue;
    poserBrut(t, c, terrain === 'plaine' ? 'foret' : 'plaine');
  }
}

/** Grille de caractères d'une toile (`03-schemas.md` §5). */
function grilleDe(t: Toile): string[] {
  const lignes: string[] = [];
  for (let y = 0; y < t.hauteur; y += 1) {
    let ligne = '';
    for (let x = 0; x < t.largeur; x += 1) ligne += caractereDe(lire(t, y * t.largeur + x));
    lignes.push(ligne);
  }
  return lignes;
}

/** Propriétaires indexés `"x,y"`, insérés dans l'ordre de lecture de la grille. */
function proprietairesDe(t: Toile): Record<string, CampId> {
  const sortie: Record<string, CampId> = {};
  for (let y = 0; y < t.hauteur; y += 1) {
    for (let x = 0; x < t.largeur; x += 1) {
      const c = y * t.largeur + x;
      const camp = t.proprietaires[c] ?? -1;
      if (camp < 0) continue;
      if (!CAPTURABLES.includes(lire(t, c))) continue;
      sortie[`${x},${y}`] = camp as CampId;
    }
  }
  return sortie;
}

/** Mesures relues par la routine contrôle (`03-schemas.md` §5). */
function diagnostiquer(t: Toile, camps: number): NonNullable<MapDef['diagnostic']> {
  const total = t.largeur * t.hauteur;
  const qg: number[] = new Array<number>(camps).fill(-1);
  const usines: number[] = [];
  let surfaceTerre = 0;
  for (let c = 0; c < total; c += 1) {
    const terrain = lire(t, c);
    if (franchissable(terrain, 'pied')) surfaceTerre += 1;
    if (terrain === 'qg') {
      const camp = t.proprietaires[c] ?? -1;
      if (camp >= 0 && camp < camps) qg[camp] = c;
    }
    if (terrain === 'usine') usines.push(c);
  }

  let distanceQgQg = 0;
  const distanceQgUsine: number[] = [];
  for (let camp = 0; camp < camps; camp += 1) {
    const depart = qg[camp];
    if (depart === undefined || depart < 0) { distanceQgUsine.push(0); continue; }
    const d = distances(t, [depart], 'pied');
    for (let autre = camp + 1; autre < camps; autre += 1) {
      const cible = qg[autre];
      if (cible === undefined || cible < 0) continue;
      const pas = d[cible] ?? -1;
      if (pas > distanceQgQg) distanceQgQg = pas;
    }
    const proches = usines.map((u) => d[u] ?? -1).filter((v) => v >= 0);
    distanceQgUsine.push(proches.length > 0 ? Math.min(...proches) : 0);
  }

  const atteignables = distances(t, qg.filter((c) => c >= 0), 'pied');
  let zonesIsolees = 0;
  for (let c = 0; c < total; c += 1) {
    if (atteignables[c] === -1 && franchissable(lire(t, c), 'pied')) zonesIsolees += 1;
  }
  return { surfaceTerre, distanceQgQg, distanceQgUsine, zonesIsolees };
}

/** Identifiant stable d'une carte générée, conforme à `REGEX_CLE`. */
function codeDe(p: ParametresNormalises, graine: number): string {
  const g = (Math.trunc(graine) >>> 0).toString(36);
  return `carte_${p.biome}_${p.camps}c_${g}`;
}

/**
 * Génère une carte. Même `params` et même `graine` donnent le même `MapDef`,
 * au bit près après `JSON.stringify` : aucune horloge, aucun `Math.random`,
 * aucune itération d'objet sans ordre explicite.
 *
 * Le générateur ne refuse jamais : les paramètres hors bornes sont ramenés dans
 * les bornes du schéma et les effectifs de bâtiments réduits à ce que la surface
 * accepte (`parametres.ts`). Les paramètres réellement appliqués sont recopiés
 * dans `generation.parametres`, donc rejouer la génération depuis la carte
 * enregistrée redonne exactement la même grille.
 */
export function genererCarte(params: ParametresCarte, graine: number): MapDef {
  const base = normaliser(params);
  let faite: Fabrication | null = null;

  for (let essai = 0; essai < 4 && faite === null; essai += 1) {
    const p = essai === 0
      ? base
      : { ...base, ratioMerEffectif: base.ratioMerEffectif * (1 - essai / 4) };
    faite = fabriquer(p, creerRng(hacherEssai(graine, essai)));
  }
  if (faite === null) {
    // Dernier recours : une carte sans mer et sans relief se construit toujours.
    // Sans mer, pas de port : la ceinture d'une carte à ports mangerait la place.
    const p = { ...base, ratioMerEffectif: 0, ratioRelief: Math.min(base.ratioRelief, 0.1), portsParCamp: 0 };
    faite = fabriquer(p, creerRng(hacherEssai(graine, 9)));
  }
  if (faite === null) throw new Error('mapgen : aucune carte constructible pour ces paramètres');
  const toile = faite.toile;
  if (base.symetrie === 'aucune') brouillerDecor(toile, creerRng(hacherEssai(graine, 42)));

  const carte: MapDef = {
    cle: codeDe(base, graine),
    version: 1,
    statut: 'brouillon',
    source: 'atlas_map',
    creeLe: DATE_GENERATION,
    majLe: DATE_GENERATION,
    code: codeDe(base, graine),
    nom: `${NOMS_BIOME[base.biome] ?? 'Carte'} ${base.largeur}×${base.hauteur} · ${base.camps} camps`,
    largeur: base.largeur,
    hauteur: base.hauteur,
    camps: base.camps,
    biome: base.biome,
    grille: grilleDe(toile),
    proprietaires: proprietairesDe(toile),
    unitesDepart: faite.unites.slice()
      .sort((a, b) => a.camp - b.camp || a.y - b.y || a.x - b.x),
    generation: {
      graine: String(Math.trunc(graine) >>> 0),
      parametres: versParametresCarte(base),
      mapgenVersion: MAPGEN_VERSION,
    },
    diagnostic: diagnostiquer(toile, base.camps),
  };
  if (base.mecanique !== undefined) carte.mecanique = base.mecanique;
  return carte;
}

/** Décale la graine d'un essai à l'autre, sans jamais sortir du déterminisme. */
function hacherEssai(graine: number, essai: number): number {
  return ((Math.trunc(graine) >>> 0) + Math.imul(essai + 1, 0x9e3779b1)) >>> 0;
}

export type { ParametresNormalises };
