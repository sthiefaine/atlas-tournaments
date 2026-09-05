/**
 * L'état de partie et sa création (`doc/02-architecture.md` §3.1).
 *
 * `EtatPartie` est du JSON pur : pas de `Map`, pas de `Set`, pas de classe, pas
 * de fonction. `JSON.parse(JSON.stringify(etat))` est l'identité — c'est ce qui
 * rend possibles la sauvegarde, le rejeu et l'envoi à la routine contrôle.
 */

import type {
  CampId, Cle, MapDef, Scenario,
} from '../schemas/index';
import { initialiserClimat } from './climat/index';
import { terrainBrut } from './hooks';
import { mecaniqueDe } from './mecaniques/registre';
import { poserModificateur } from './regles/pouvoirs';
import { ouvrirTour } from './regles/tour';
import { creerRng } from './rng';
import type {
  Catalogue, CommandantMoteur, EtatCamp, EtatPartie, EvenementJeu, ReglagesPartie,
  Scene, Unite,
} from './types';
import { cleCase } from './types';

/** Version du moteur : tout ce qui casse un rejeu l'incrémente. */
export const VERSION_MOTEUR = 2;

/** Jauge maximale par défaut, quand le camp n'a pas de commandant. */
export const JAUGE_MAX_DEFAUT = 900;

/** Longueur maximale du journal gardée dans l'état : au-delà, on oublie le début. */
export const JOURNAL_MAX = 120;

/** Copie profonde d'une valeur JSON pure. */
export function copier<T>(valeur: T): T {
  const clone = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone;
  if (clone) return clone(valeur);
  return JSON.parse(JSON.stringify(valeur)) as T;
}

/**
 * Copie de travail d'un état, écrite à la main.
 *
 * `appliquer` en fait une par action : c'est l'opération la plus fréquente du
 * moteur, et une copie générique y passe l'essentiel du temps de calcul. Les
 * sous-structures que le moteur **ne modifie jamais** — la grille, les réglages,
 * les effets de modificateur, les événements déjà écrits — sont partagées ;
 * tout ce qui est modifiable est recopié.
 */
export function copierEtat(e: EtatPartie): EtatPartie {
  return {
    ...e,
    grille: e.grille,
    reglages: e.reglages,
    flux: { ...e.flux },
    relais: { ...e.relais },
    proprietaires: { ...e.proprietaires },
    unites: e.unites.map((u) => (u.cargo.length === 0 ? { ...u } : { ...u, cargo: [...u.cargo] })),
    camps: e.camps.map((c) => ({ ...c })),
    climat: { ...e.climat, previsions: [e.climat.previsions[0], e.climat.previsions[1]] },
    terrainsPoses: e.terrainsPoses.map((t) => ({ ...t })),
    modificateurs: e.modificateurs.map((m) => ({ ...m })),
    mecanique: e.mecanique === null ? null : {
      ...e.mecanique,
      parametres: { ...e.mecanique.parametres },
      donnees: { ...e.mecanique.donnees },
    },
    partie: { ...e.partie },
    journal: [...e.journal],
    produites: { ...e.produites },
  };
}

/** Vrai si ce camp a déjà foulé cette case. */
export function aVisite(camp: EtatCamp, indice: number): boolean {
  return camp.visitees[indice] === '1';
}

/** Marque une case comme visitée par ce camp. */
export function marquerVisite(camp: EtatCamp, indice: number): void {
  if (indice < 0 || indice >= camp.visitees.length || camp.visitees[indice] === '1') return;
  camp.visitees = `${camp.visitees.slice(0, indice)}1${camp.visitees.slice(indice + 1)}`;
}

/** Le camp du joueur : le camp 0, le seul sans IA (`03-schemas.md` §6). */
export const CAMP_JOUEUR: CampId = 0;

/**
 * Les commandants d'une scène, l'**incarnation** appliquée.
 *
 * Quand `scenario.incarnation` est présent, le joueur ne joue pas son commandant
 * d'origine mais **le général de la nation incarnée** — ses pouvoirs, sa jauge
 * (`BRIEF.md`, « Le joueur et le départ »). Le camp du joueur prend donc ce
 * général : celui du scénario s'il y est déjà (`validerScenario` l'exige), sinon
 * celui que l'appelant a fourni ailleurs dans la liste.
 *
 * Le **catalogue** de la nation incarnée — son unité spéciale comprise — n'est pas
 * ici : le moteur ne charge rien, il reçoit. C'est l'appelant — le serveur ou la
 * page — qui passe à `creerPartie` le catalogue de la nation jouée au lieu de celui
 * du joueur (`02-architecture.md` §3.1, `13-campagne.md` §3.4).
 *
 * La fonction est **totale** : un général introuvable laisse la liste inchangée,
 * elle ne lève jamais.
 */
export function commandantsIncarnes(
  scenario: Scenario, commandants: (CommandantMoteur | null)[],
): (CommandantMoteur | null)[] {
  const incarnation = scenario.incarnation;
  if (!incarnation) return commandants;
  if (commandants[CAMP_JOUEUR]?.cle === incarnation.commandantCle) return commandants;
  const general = commandants.find((c) => c?.cle === incarnation.commandantCle) ?? null;
  if (general === null) return commandants;
  const sortie = [...commandants];
  sortie[CAMP_JOUEUR] = general;
  return sortie;
}

/**
 * Compose une scène jouable à partir d'un scénario, d'une carte et des commandants.
 *
 * Pour un **match d'incarnation**, le camp du joueur reçoit le général de la nation
 * incarnée (`commandantsIncarnes`), et le catalogue passé plus tard à `creerPartie`
 * est celui de cette nation — c'est l'appelant qui le fournit.
 */
export function sceneDepuis(
  scenario: Scenario, carte: MapDef, commandants: (CommandantMoteur | null)[],
  climatPays: ReglagesPartie['climatPays'] = 'tempere',
  hemisphere: ReglagesPartie['hemisphere'] = 'nord',
): Scene {
  const camps = scenario.commandants.map((c) => c.camp).sort((a, b) => a - b);
  return {
    scenarioCle: scenario.code,
    carteCle: carte.code,
    largeur: carte.largeur,
    hauteur: carte.hauteur,
    grille: carte.grille,
    proprietaires: carte.proprietaires,
    unitesDepart: carte.unitesDepart,
    camps,
    commandants: commandantsIncarnes(scenario, commandants),
    mecanique: carte.mecanique ? { cle: carte.mecanique, parametres: {} } : null,
    reglages: {
      date: scenario.date,
      climatPays,
      hemisphere,
      saisonForcee: scenario.climatFixe?.saison ?? null,
      meteoForcee: scenario.climatFixe?.meteo ?? null,
      cycleJourNuit: scenario.cycleJourNuit,
      fondsDepart: scenario.fondsDepart,
      revenusParBatiment: scenario.revenusParBatiment,
      brouillard: scenario.brouillard,
      limiteJournees: scenario.limiteJournees,
      victoire: scenario.victoire,
      defaite: scenario.defaite,
    },
  };
}

/**
 * Compose une scène depuis une carte seule, sans scénario écrit : c'est ce
 * qu'utilisent les simulations IA contre IA et les tests du moteur.
 */
export function sceneDeCarte(
  carte: MapDef, reglages: ReglagesPartie,
  commandants: (CommandantMoteur | null)[] = [],
  mecanique: Scene['mecanique'] = null,
): Scene {
  const camps: CampId[] = [];
  for (let i = 0; i < carte.camps; i += 1) camps.push(i as CampId);
  return {
    scenarioCle: `sim_${carte.code}`,
    carteCle: carte.code,
    largeur: carte.largeur,
    hauteur: carte.hauteur,
    grille: carte.grille,
    proprietaires: carte.proprietaires,
    unitesDepart: carte.unitesDepart,
    camps,
    commandants,
    mecanique: mecanique ?? (carte.mecanique ? { cle: carte.mecanique, parametres: {} } : null),
    reglages,
  };
}

/** Réglages par défaut : ce qu'une carte de test utilise sans scénario écrit. */
export function reglagesParDefaut(partiel: Partial<ReglagesPartie> = {}): ReglagesPartie {
  return {
    date: '2026-09-05',
    climatPays: 'tempere',
    hemisphere: 'nord',
    saisonForcee: null,
    meteoForcee: null,
    cycleJourNuit: { jour: 4, nuit: 2 },
    fondsDepart: 5000,
    revenusParBatiment: 1000,
    brouillard: false,
    limiteJournees: 40,
    victoire: [{ type: 'capture_qg' }, { type: 'hors_jeu_total' }],
    defaite: [{ type: 'qg_perdu' }, { type: 'toutes_unites_hors_jeu' }],
    ...partiel,
  };
}

/**
 * Crée une partie prête à jouer : la journée 1 est ouverte (hooks, revenus,
 * réparation, réveil), c'est au camp 0 de donner ses ordres.
 *
 * Le catalogue est **toujours** fourni par l'appelant, jamais chargé ici. Pour un
 * match d'incarnation, c'est donc le serveur ou la page qui passe le catalogue de la
 * nation incarnée — celui qui porte son unité spéciale (`sceneDepuis`).
 */
export function creerPartie(scene: Scene, cat: Catalogue, graine: string): EtatPartie {
  const rng = creerRng(graine);
  const camps: EtatCamp[] = scene.camps.map((id) => {
    const commandant = scene.commandants[id] ?? null;
    return {
      id,
      fonds: scene.reglages.fondsDepart,
      jauge: 0,
      jaugeMax: commandant ? commandant.superPouvoir.barres * 100 : JAUGE_MAX_DEFAUT,
      commandantCle: commandant ? commandant.cle : null,
      qgCase: null,
      pouvoirUtiliseCeTour: false,
      elimine: false,
      visitees: '0'.repeat(scene.largeur * scene.hauteur),
    };
  });

  const unites: Unite[] = [];
  let prochainId = 1;
  for (const d of scene.unitesDepart) {
    const type = cat.unites[d.type];
    if (!type) continue;
    unites.push({
      id: `u${prochainId}`,
      camp: d.camp,
      type: d.type,
      x: d.x,
      y: d.y,
      pv: d.pv ?? 100,
      munitions: type.munitions,
      carburant: type.carburant ? type.carburant.max : null,
      etat: 'prete',
      pointsCapture: 0,
      cargo: [],
      dansTransport: null,
    });
    prochainId += 1;
  }

  const mecaniqueCle: Cle | null = scene.mecanique?.cle ?? null;
  const greffon = mecaniqueDe(mecaniqueCle);
  const parametres = {
    ...((greffon?.parametresParDefaut ?? {}) as Record<string, number | string | boolean>),
    ...(scene.mecanique?.parametres ?? {}),
  };
  const gelable = parametres['gelable'] !== false;

  const etat: EtatPartie = {
    engineVersion: VERSION_MOTEUR,
    catalogueVersion: cat.version,
    contentVersion: 1,
    mapgenVersion: 1,
    scenarioCle: scene.scenarioCle,
    carteCle: scene.carteCle,
    graine,
    flux: {},
    largeur: scene.largeur,
    hauteur: scene.hauteur,
    grille: [...scene.grille],
    proprietaires: { ...scene.proprietaires },
    unites,
    prochainId,
    journee: 0,
    campCourant: 0,
    camps,
    climat: { saison: 'printemps', phase: 'jour', journeeDansCycle: 0, meteo: 'clair', previsions: ['clair', 'clair'] },
    terrainsPoses: [],
    modificateurs: [],
    prochainModificateur: 1,
    mecanique: mecaniqueCle
      ? { cle: mecaniqueCle, parametres, gelable, donnees: {}, declenchements: 0 }
      : null,
    reglages: scene.reglages,
    partie: { terminee: false, vainqueur: null, nul: false, motif: null },
    journal: [],
    produites: {},
  };

  etat.climat = initialiserClimat(etat.reglages, rng);

  // Le QG de départ de chaque camp : le perdre élimine le camp (§9).
  for (const [k, proprio] of Object.entries(etat.proprietaires)) {
    const c = etat.camps.find((e) => e.id === proprio);
    if (!c || c.qgCase !== null) continue;
    const [x, y] = k.split(',');
    if (terrainBrut(etat, cat, { x: Number(x), y: Number(y) }) === 'qg') c.qgCase = k;
  }

  // Passifs des commandants : des modificateurs permanents comme les autres.
  for (const camp of etat.camps) {
    const commandant = scene.commandants[camp.id] ?? null;
    if (commandant?.passif) {
      poserModificateur(etat, camp.id, 'passif', commandant.passif, { type: 'permanent' });
    }
  }

  const evts: EvenementJeu[] = [];
  ouvrirTour(etat, cat, rng, evts);
  etat.journal.push(...evts);
  etat.flux = rng.instantane();
  return etat;
}

/** Camp d'une case capturable, ou `null` si elle est neutre. */
export function proprietaire(etat: EtatPartie, x: number, y: number): CampId | null {
  return etat.proprietaires[cleCase({ x, y })] ?? null;
}
