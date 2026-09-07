/**
 * Vérifications **structurelles** d'une carte, réutilisables telles quelles par la
 * routine contrôle (`05-routines.md` §4). Elles ne simulent aucune partie : elles
 * relisent la grille, les propriétaires et les unités de départ, et rendent des
 * motifs pris dans l'énumération fermée `MotifRejet` (`03-schemas.md` §12).
 *
 * Correspondance avec le vocabulaire du brief :
 * `carte_invalide` → `schema_invalide`, `asymetrie_de_valeur` → `desequilibre_fonds`
 * (le catalogue de motifs ne connaît pas ces deux noms ; l'écart mesuré est publié
 * sous la clé `asymetrie_de_valeur`, comme dans l'aperçu de `05-routines.md` §3.3).
 */

import { chargerUnites } from '../content/index';
import { validerMapDef } from '../schemas/valider';
import type { CleTerrain, MapDef, MotifRejet, TypeMouvement } from '../schemas/types';
import {
  CAPTURABLES, composantes, distances, franchissable, lire, poserBrut, terrainDeCaractere,
  creerToile, voisins4, type Toile,
} from './grille';
import { creerCadreTrivial } from './symetrie';

/** Un motif de rejet structurel, avec sa mesure chiffrée. */
export interface MotifVerification {
  code: MotifRejet;
  detail: string;
  mesure: Record<string, number>;
}

/** Le verdict structurel d'une carte. */
export interface RapportVerification {
  ok: boolean;
  motifs: MotifVerification[];
  /** Mesures publiables, celles de l'aperçu de `05-routines.md` §3.3. */
  mesures: Record<string, number>;
}

/** Écart de valeur toléré entre deux camps (`05-routines.md` §3.5 : ≤ 0,05). */
export const ECART_VALEUR_MAX = 0.05;

/** Distance maximale acceptée entre un QG et l'usine la plus proche. */
export const DISTANCE_USINE_MAX = 18;

/**
 * Poids économique d'une propriété. Ville et QG pèsent pareil : voir `analyser`.
 * Le port produit comme un aéroport ; la station radar rapporte la moitié d'une
 * ville et ne produit rien.
 */
const POIDS: Record<string, number> = { ville: 1, usine: 1.5, aeroport: 1.25, qg: 1, port: 1.25, radar: 0.5 };

/** Reconstruit une grille de travail à partir d'une `MapDef` déjà écrite. */
export function toileDepuisMapDef(map: MapDef): Toile {
  const cadre = creerCadreTrivial(map.largeur, map.hauteur);
  const toile = creerToile(cadre, 'mer');
  for (let y = 0; y < map.hauteur; y += 1) {
    const ligne = map.grille[y] ?? '';
    for (let x = 0; x < map.largeur; x += 1) {
      const terrain = terrainDeCaractere(ligne[x] ?? 'W');
      poserBrut(toile, y * map.largeur + x, terrain ?? 'mer');
    }
  }
  for (const clef of Object.keys(map.proprietaires).sort()) {
    const [xs, ys] = clef.split(',');
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (x < 0 || y < 0 || x >= map.largeur || y >= map.hauteur) continue;
    toile.proprietaires[y * map.largeur + x] = map.proprietaires[clef] ?? -1;
  }
  return toile;
}

/** Lecture brute d'une carte : QG, propriétés, valeurs, accessibilité. */
interface Analyse {
  toile: Toile;
  qg: number[];
  qgManquants: number;
  proprietesParCamp: number[];
  neutres: number;
  valeurs: number[];
  asymetrie: number;
  pairesIsolees: number;
  zonesMortes: number;
  casesJouables: number;
  distanceQgQg: number;
  distanceQgUsine: number[];
  /** Ports sans une seule case de mer voisine : rien de ce qu'ils produisent n'en sort. */
  portsSansMer: number;
  /** Paires de ports de camps différents sans chemin par la mer. */
  portsIsoles: number;
}

/**
 * Valeur d'un camp : somme des propriétés pondérées par leur distance à son QG.
 * Ville et QG portent le même poids — c'est ce qui rend la mesure insensible au
 * fait qu'à trois camps, le quatrième QG symétrique est remplacé par une ville.
 */
function analyser(map: MapDef): Analyse {
  const toile = toileDepuisMapDef(map);
  const total = map.largeur * map.hauteur;
  const camps = map.camps;
  const qg: number[] = new Array<number>(camps).fill(-1);
  const proprietesParCamp: number[] = new Array<number>(camps).fill(0);
  const proprietes: { cellule: number; terrain: CleTerrain }[] = [];
  let neutres = 0;
  let casesJouables = 0;

  for (let c = 0; c < total; c += 1) {
    const terrain = lire(toile, c);
    if (franchissable(terrain, 'pied')) casesJouables += 1;
    if (!CAPTURABLES.includes(terrain)) continue;
    proprietes.push({ cellule: c, terrain });
    const camp = toile.proprietaires[c] ?? -1;
    if (camp < 0) neutres += 1;
    else if (camp < camps) {
      proprietesParCamp[camp] = (proprietesParCamp[camp] ?? 0) + 1;
      if (terrain === 'qg') qg[camp] = c;
    }
  }

  const distancesQg = qg.map((c) => (c >= 0 ? distances(toile, [c], 'pied') : null));
  const valeurs: number[] = [];
  const distanceQgUsine: number[] = [];
  for (let camp = 0; camp < camps; camp += 1) {
    const d = distancesQg[camp];
    if (!d) { valeurs.push(0); distanceQgUsine.push(-1); continue; }
    let valeur = 0;
    let usine = -1;
    for (const propriete of proprietes) {
      const pas = d[propriete.cellule] ?? -1;
      if (pas < 0) continue;
      valeur += (POIDS[propriete.terrain] ?? 1) / (1 + pas);
      if (propriete.terrain === 'usine' && (usine < 0 || pas < usine)) usine = pas;
    }
    valeurs.push(valeur);
    distanceQgUsine.push(usine);
  }

  let pairesIsolees = 0;
  let distanceQgQg = 0;
  for (let a = 0; a < camps; a += 1) {
    const d = distancesQg[a];
    for (let b = a + 1; b < camps; b += 1) {
      const cible = qg[b];
      const pas = d && cible !== undefined && cible >= 0 ? (d[cible] ?? -1) : -1;
      if (pas < 0) pairesIsolees += 1;
      else if (pas > distanceQgQg) distanceQgQg = pas;
    }
  }

  const depuisQg = distances(toile, qg.filter((c) => c >= 0), 'pied');
  let zonesMortes = 0;
  for (let c = 0; c < total; c += 1) {
    if (depuisQg[c] === -1 && franchissable(lire(toile, c), 'pied')) zonesMortes += 1;
  }

  const naval = analyserPorts(toile, proprietes);

  const max = Math.max(...valeurs);
  const min = Math.min(...valeurs);
  return {
    toile,
    qg,
    qgManquants: qg.filter((c) => c < 0).length,
    proprietesParCamp,
    neutres,
    valeurs,
    asymetrie: max > 0 ? (max - min) / max : 0,
    pairesIsolees,
    zonesMortes,
    casesJouables,
    distanceQgQg,
    distanceQgUsine,
    portsSansMer: naval.sansMer,
    portsIsoles: naval.isoles,
  };
}

/**
 * Les ports (7 septembre 2026) : chacun touche la mer, et ceux de deux camps
 * différents se rejoignent par elle. Le graphe est celui du mouvement `mer`,
 * lu dans `terrains.json` : un port y est une case franchissable, donc deux
 * ports reliés sont simplement dans la même composante. Les ports neutres ne
 * comptent pas dans les paires : personne n'y produit.
 */
function analyserPorts(
  toile: Toile,
  proprietes: readonly { cellule: number; terrain: CleTerrain }[],
): { sansMer: number; isoles: number } {
  const ports = proprietes.filter((b) => b.terrain === 'port').map((b) => b.cellule);
  if (ports.length === 0) return { sansMer: 0, isoles: 0 };
  let sansMer = 0;
  for (const c of ports) {
    if (!voisins4(toile, c).some((v) => lire(toile, v) === 'mer')) sansMer += 1;
  }
  const { etiquettes } = composantes(toile, 'mer');
  let isoles = 0;
  for (let i = 0; i < ports.length; i += 1) {
    const a = ports[i] as number;
    const campA = toile.proprietaires[a] ?? -1;
    if (campA < 0) continue;
    for (let j = i + 1; j < ports.length; j += 1) {
      const b = ports[j] as number;
      const campB = toile.proprietaires[b] ?? -1;
      if (campB < 0 || campB === campA) continue;
      if (etiquettes[a] !== etiquettes[b]) isoles += 1;
    }
  }
  return { sansMer, isoles };
}

/** Type de mouvement d'une unité du catalogue, `pied` par défaut. */
function mouvementDe(cle: string): TypeMouvement {
  const fiche = chargerUnites().find((u) => u.cle === cle);
  return fiche?.typeMouvement ?? 'pied';
}

/**
 * Vérifie une carte. `ok` est faux dès qu'un motif est relevé : tous les motifs
 * de cette passe sont structurels, donc bloquants — une carte qui en porte un
 * n'est pas jouable, elle n'est pas seulement perfectible.
 */
export function verifierCarte(map: MapDef): RapportVerification {
  const motifs: MotifVerification[] = [];
  const valide = validerMapDef(map);
  if (!valide.ok) {
    const apercu = valide.erreurs.slice(0, 4)
      .map((e) => `${e.chemin === '' ? '(racine)' : e.chemin} : ${e.message}`)
      .join(' ; ');
    motifs.push({
      code: 'schema_invalide',
      detail: `la carte ne passe pas validerMapDef — ${apercu}`,
      mesure: { erreurs: valide.erreurs.length },
    });
    return { ok: false, motifs, mesures: { erreurs: valide.erreurs.length } };
  }

  const a = analyser(map);

  if (a.pairesIsolees > 0 || a.qgManquants > 0) {
    motifs.push({
      code: 'qg_inaccessible',
      detail: a.qgManquants > 0
        ? `${a.qgManquants} camp(s) sans QG possédé`
        : `${a.pairesIsolees} paire(s) de QG sans chemin terrestre`,
      mesure: { paires_isolees: a.pairesIsolees, qg_manquants: a.qgManquants },
    });
  }
  if (a.zonesMortes > 0) {
    motifs.push({
      code: 'zone_morte',
      detail: `${a.zonesMortes} case(s) terrestre(s) hors d'atteinte de tout QG`,
      mesure: { zones_mortes: a.zonesMortes },
    });
  }
  // Zones mortes navales (7 septembre 2026) : un port sans mer, ou sans chemin
  // vers l'adversaire, produit une flotte que rien ne peut employer. Deux codes
  // dédiés (`MotifRejet`), sans quoi le verdict, qui dédoublonne par code, les
  // aurait cachés derrière une zone morte terrestre.
  if (a.portsSansMer > 0) {
    motifs.push({
      code: 'port_sans_mer',
      detail: `${a.portsSansMer} port(s) sans case de mer voisine : rien de ce qu'ils produisent n'en sort`,
      mesure: { ports_sans_mer: a.portsSansMer },
    });
  }
  if (a.portsIsoles > 0) {
    motifs.push({
      code: 'ports_isoles',
      detail: `${a.portsIsoles} paire(s) de ports de camps différents sans chemin par la mer`,
      mesure: { ports_isoles: a.portsIsoles },
    });
  }
  if (a.asymetrie > ECART_VALEUR_MAX) {
    motifs.push({
      code: 'desequilibre_fonds',
      detail: `écart de valeur entre camps de ${(a.asymetrie * 100).toFixed(1)} %`,
      mesure: { asymetrie_de_valeur: Number(a.asymetrie.toFixed(4)) },
    });
  }
  const premier = a.proprietesParCamp[0] ?? 0;
  if (a.proprietesParCamp.some((n) => n !== premier)) {
    motifs.push({
      code: 'desequilibre_villes',
      detail: `propriétés par camp : ${a.proprietesParCamp.join(', ')}`,
      mesure: { ecart: Math.max(...a.proprietesParCamp) - Math.min(...a.proprietesParCamp) },
    });
  }
  const troploin = a.distanceQgUsine.filter((d) => d < 0 || d > DISTANCE_USINE_MAX);
  if (troploin.length > 0) {
    motifs.push({
      code: 'usine_trop_loin',
      detail: `${troploin.length} camp(s) sans usine à moins de ${DISTANCE_USINE_MAX} cases`,
      mesure: { camps: troploin.length, distance_max: Math.max(...a.distanceQgUsine) },
    });
  }

  const bloquees = map.unitesDepart.filter((u) => {
    const c = u.y * map.largeur + u.x;
    return !franchissable(lire(a.toile, c), mouvementDe(u.type));
  });
  if (bloquees.length > 0) {
    motifs.push({
      code: 'depart_bloque',
      detail: `${bloquees.length} unité(s) de départ sur un terrain qu'elles ne franchissent pas`,
      mesure: { unites: bloquees.length },
    });
  }

  const demandees = map.generation?.parametres.villesNeutres ?? 0;
  if (demandees > 0 && a.neutres === 0) {
    motifs.push({
      code: 'economie_insuffisante',
      detail: `${demandees} ville(s) neutre(s) demandée(s), aucune posée`,
      mesure: { demandees, posees: 0 },
    });
  }

  return { ok: motifs.length === 0, motifs, mesures: mesurerCarte(map, a) };
}

/** Mesures d'aperçu d'une carte (`05-routines.md` §3.3). */
export function mesurer(map: MapDef): Record<string, number> {
  return mesurerCarte(map, analyser(map));
}

function mesurerCarte(map: MapDef, a: Analyse): Record<string, number> {
  const compter = (terrain: CleTerrain): number => {
    let n = 0;
    for (let c = 0; c < map.largeur * map.hauteur; c += 1) if (lire(a.toile, c) === terrain) n += 1;
    return n;
  };
  return {
    cases_jouables: a.casesJouables,
    distance_qg_qg: a.distanceQgQg,
    chemin_qg_qg: a.pairesIsolees === 0 ? 1 : 0,
    villes_par_camp: Math.round(compter('ville') / Math.max(1, map.camps)),
    usines_par_camp: Math.round(compter('usine') / Math.max(1, map.camps)),
    villes_neutres: a.neutres,
    zones_mortes: a.zonesMortes,
    asymetrie_de_valeur: Number(a.asymetrie.toFixed(4)),
    // Ports et radars (7 septembre 2026) : comparés à `generation.parametres`,
    // ils disent si le générateur a posé moins que demandé — c'est là que se
    // lit la correction, une `MapDef` n'ayant pas d'avertissements.
    ports_par_camp: Math.round(compter('port') / Math.max(1, map.camps)),
    radars_par_camp: Math.round(compter('radar') / Math.max(1, map.camps)),
    ports_sans_mer: a.portsSansMer,
    ports_relies: a.portsIsoles === 0 ? 1 : 0,
    // Hautes herbes (7 septembre 2026) : la part de la plaine — plaine et
    // herbe confondues — réellement semée, à comparer à `ratioHerbesHautes`.
    // Elle est en dessous quand la séparation des taches ne permet plus de tout
    // caser (vers 0,5), et nulle sur un biome sans plaine (le désert, tout en sable).
    herbe_haute_part: partHerbe(compter('plaine'), compter('herbe_haute')),
  };
}

/** Part d'herbe parmi les cases qui étaient de la plaine, à quatre décimales. */
function partHerbe(plaines: number, herbes: number): number {
  const anciennes = plaines + herbes;
  return anciennes === 0 ? 0 : Number((herbes / anciennes).toFixed(4));
}
