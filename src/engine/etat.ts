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
import { uniteAutorisee } from './catalogue';
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

/**
  * Version du moteur : tout ce qui casse un rejeu l'incrémente. Passée à 4 le
  * 8 septembre 2026, quand la formule de dégâts a pris son échelle et son poids
  * de terrain (§5.1) ; puis à **5** le même jour, quand la riposte a pris son
  * facteur (`FACTEUR_RIPOSTE`) pour que frapper en premier paie aussi contre
  * une unité à l'abri. Dans les deux cas une partie enregistrée avant diverge
  * dès la première attaque : la sauvegarde est déclarée périmée et le joueur
  * repart d'une partie neuve — rien ne casse au-delà du match en cours.
  */
/** Version 6 : équipes, victoire commune et renforts déterministes. */
/**
 * Version 7 (10 septembre 2026) : révision 4 des capacités — `chance` élargit
 * l'aléa de combat, `etoiles` change la défense, la faiblesse est posée à la
 * création de l'état. Une partie enregistrée avant ne rejoue plus pareil.
 */
/**
 * Version 8 (10 septembre 2026, fin d'après-midi) : une impulsion IEM — de
 * station comme de pouvoir — touche aussi les bâtiments producteurs adverses,
 * qui ne produisent rien à leur tour (`usine_iem`) ; et les superusines de
 * scénario font paraître leurs unités au début du tour. Un rejeu d'avant qui
 * produisait sous impulsion diverge.
 */
export const VERSION_MOTEUR = 8;

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
    ...(e.renfortsLivres ? { renfortsLivres: [...e.renfortsLivres] } : {}),
    ...(e.superusinesProduites ? { superusinesProduites: { ...e.superusinesProduites } } : {}),
    ...(e.usinesIem ? { usinesIem: { ...e.usinesIem } } : {}),
    proprietaires: { ...e.proprietaires },
    desaffectes: [...e.desaffectes],
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
    desaffectes: (carte.desaffectes ?? []).map(cleCase),
    unitesDepart: carte.unitesDepart,
    camps,
    commandants: commandantsIncarnes(scenario, commandants),
    mecanique: carte.mecanique ? { cle: carte.mecanique, parametres: {} } : null,
    reglages: {
      ...(scenario.factionsParCamp ? { factionsParCamp: scenario.factionsParCamp } : {}),
      ...(scenario.equipes ? { equipes: scenario.equipes } : {}),
      ...(scenario.renforts ? { renforts: scenario.renforts } : {}),
      ...(scenario.installationsIem ? { installationsIem: scenario.installationsIem } : {}),
      ...(scenario.superusines ? { superusines: scenario.superusines } : {}),
      ...(scenario.evenementsClimat ? { evenementsClimat: scenario.evenementsClimat } : {}),
      date: scenario.date,
      climatPays,
      hemisphere,
      saisonForcee: scenario.climatFixe?.saison ?? null,
      meteoForcee: scenario.climatFixe?.meteo ?? null,
      cycleJourNuit: scenario.cycleJourNuit,
      fondsDepart: scenario.fondsDepart,
      ...(scenario.fondsDepartParCamp ? { fondsDepartParCamp: scenario.fondsDepartParCamp } : {}),
      revenusParBatiment: scenario.revenusParBatiment,
      ...(scenario.revenusParBatimentParCamp ? { revenusParBatimentParCamp: scenario.revenusParBatimentParCamp } : {}),
      ...(scenario.vitesseJaugeJoueur !== undefined ? { vitesseJaugeJoueur: scenario.vitesseJaugeJoueur } : {}),
      ...(scenario.previsionJournees !== undefined ? { previsionJournees: scenario.previsionJournees } : {}),
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
    desaffectes: (carte.desaffectes ?? []).map(cleCase),
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
  for (const vague of scene.reglages.renforts ?? []) for (const u of vague.unites) {
    if (!cat.unites[u.type] || !scene.camps.includes(u.camp)
      || u.x < 0 || u.y < 0 || u.x >= scene.largeur || u.y >= scene.hauteur) {
      throw new Error('Renfort invalide : unité, camp ou point d’entrée hors de la scène.');
    }
  }
  for (const station of scene.reglages.installationsIem ?? []) {
    const cleTerrain = cat.parCaractere[scene.grille[station.y]?.[station.x] ?? ""];
    const terrain = cleTerrain ? cat.terrains[cleTerrain] : undefined;
    if (!terrain?.capturable) throw new Error("Installation IEM hors bâtiment capturable.");
  }
  // Une superusine (10 septembre 2026) se pose sur un bâtiment producteur —
  // ou le QG — de son camp, et fait un type du catalogue : c'est ici, avec la
  // carte et le catalogue sous la main, que le scénario est tenu à sa parole.
  for (const s of scene.reglages.superusines ?? []) {
    const cleTerrain = cat.parCaractere[scene.grille[s.y]?.[s.x] ?? ''];
    const terrain = cleTerrain ? cat.terrains[cleTerrain] : undefined;
    if (!terrain || (cleTerrain !== 'qg' && terrain.produit.length === 0)) {
      throw new Error('Superusine hors d’un bâtiment producteur ou d’un QG.');
    }
    if (scene.proprietaires[cleCase(s)] !== s.camp || !scene.camps.includes(s.camp)) {
      throw new Error('Superusine sur un bâtiment qui n’est pas à son camp.');
    }
    if (!cat.unites[s.type]) throw new Error('Superusine : type inconnu du catalogue.');
  }
  const contexte = { reglages: scene.reglages };
  for (const u of [...scene.unitesDepart, ...(scene.reglages.renforts ?? []).flatMap((v) => v.unites), ...(scene.reglages.superusines ?? [])]) {
    if (cat.unites[u.type] && !uniteAutorisee(cat, u.type, contexte, u.camp)) {
      throw new Error('Unité exclusive interdite pour ce camp.');
    }
  }
  const rng = creerRng(graine);
  const camps: EtatCamp[] = scene.camps.map((id) => {
    const commandant = scene.commandants[id] ?? null;
    return {
      id,
      fonds: scene.reglages.fondsDepartParCamp?.[id] ?? scene.reglages.fondsDepart,
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
    desaffectes: [...(scene.desaffectes ?? [])],
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

  // Passifs et faiblesses des commandants : des modificateurs permanents comme
  // les autres, sous deux sources distinctes — le HUD les lit séparément, et la
  // faiblesse (`doc/04` §7.3) ne doit jamais passer pour un bonus.
  for (const camp of etat.camps) {
    const commandant = scene.commandants[camp.id] ?? null;
    if (commandant?.passif) {
      poserModificateur(etat, camp.id, 'passif', commandant.passif, { type: 'permanent' });
    }
    if (commandant?.faiblesse) {
      poserModificateur(etat, camp.id, 'faiblesse', commandant.faiblesse, { type: 'permanent' });
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
