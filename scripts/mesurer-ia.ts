/**
 * Combien de temps l'écran gelait pendant que l'IA réfléchissait (23 septembre 2026).
 *
 * ```
 * npx tsx scripts/mesurer-ia.ts                    # les situations lourdes, 12 journées
 * npx tsx scripts/mesurer-ia.ts --tous --journees 40
 * npx tsx scripts/mesurer-ia.ts --scenarios aube_superusine,pacte_du_col --journees 20
 * npx tsx scripts/mesurer-ia.ts --mode difficile --graine mesure:2
 * npx tsx scripts/mesurer-ia.ts --audit            # et le fil principal hors rendu
 * npx tsx scripts/mesurer-ia.ts --passes 5         # le minimum de cinq passes, une par processus
 * npx tsx scripts/mesurer-ia.ts --json             # chaque tour, en JSON
 * ```
 *
 * Jusqu'au 23 septembre 2026, la page de jeu appelait `adversaireIa` — donc
 * `jouerTour` — sur le fil principal, d'un bloc : pendant ce temps rien ne se
 * dessinait, rien ne répondait au doigt. Ce script rejoue des parties réelles
 * et chronomètre **exactement cet appel**, tour d'IA par tour d'IA : c'est la
 * durée du gel. Le camp du joueur est tenu par la stratégie pondérée, pour que
 * la partie avance comme une vraie. Le scénario passe par `scenarioPourMode`
 * et les commandants par `resoudreCommandantsScenario`, comme sur la page.
 *
 * Il chronomètre aussi ce que le worker ajoute (le clonage structuré de l'état,
 * qui se paie à l'envoi), et, avec `--audit`, les plus gros coûts du fil
 * principal **hors rendu** relevés dans `doc/refonte/ia-en-fond.md` : le rejeu
 * d'une partie reprise, la sauvegarde après chaque action, un survol de case
 * (contrôleur et HUD, sur une peau muette et un document factice), le journal
 * des rencontres que la page tient à chaque état, le catalogue qu'elle relit à
 * chaque rendu, et le bruit que l'audio synthétise à son premier son.
 *
 * **Ce sont des millisecondes de Node sur la machine qui mesure**, pas d'un
 * téléphone. La charge de la machine est imprimée avec les chiffres : une
 * machine partagée gonfle tout, les pires cas surtout. Un échauffement d'une
 * partie courte précède la mesure, pour que le premier tour chronométré ne
 * paie pas seul la compilation à la volée du moteur.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { performance } from 'node:perf_hooks';
import { jouerTour, PONDEREE } from '../src/ai/index';
import { adversaireIa } from '../src/app/jeu/adversaire';
import { enregistrerRencontres, type Rencontre } from '../src/app/campagne/progression';
import { cleProgression } from '../src/app/preferences';
import { creerAmbiance } from '../src/audio/ambiance';
import { resoudreCommandantsScenario } from '../src/content/commandants-jeu';
import { scenarioPourMode } from '../src/content/difficulte';
import {
  appliquer, chargerCatalogue, creerPartie, evaluerEffets, rejouer, restaurerRng, sceneDepuis, unitesVues,
  VERSION_MOTEUR,
  type Action, type Catalogue, type CommandantMoteur, type EtatPartie, type Scene,
} from '../src/engine/index';
import { ADVERSAIRE_PASSIF, cleSauvegarde, monterJeu } from '../src/render/jeu';
import type { GestesRendu, Rendu } from '../src/render/rendu';
import {
  validerMapDef, validerScenario, type MapDef, type Mode, type Scenario, type StrategieIa,
} from '../src/schemas/index';

/** Les situations les plus lourdes du jeu : grandes cartes, trois IA, brouillard, superusine. */
const PAR_DEFAUT = ['aube_superusine', 'aube_routes_3v1', 'aube_releve_1v3', 'aube_nuit_2v2', 'opus1_fr_04', 'pacte_du_col'];

/** Lit les options de la ligne de commande. */
function options(argv: string[]): Record<string, string | boolean> {
  const sortie: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined || !a.startsWith('--')) continue;
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith('--')) sortie[a.slice(2)] = true;
    else {
      sortie[a.slice(2)] = suivant;
      i += 1;
    }
  }
  return sortie;
}

/** Un scénario du canon et sa carte, validés comme au chargement du jeu. */
function charger(code: string): { scenario: Scenario; carte: MapDef } {
  const vs = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  if (!vs.ok) throw new Error(`scénario ${code} invalide : ${JSON.stringify(vs.erreurs)}`);
  const vc = validerMapDef(JSON.parse(readFileSync(`content/cartes/${vs.valeur.carteCle}.json`, 'utf8')));
  if (!vc.ok) throw new Error(`carte ${vs.valeur.carteCle} invalide : ${JSON.stringify(vc.erreurs)}`);
  return { scenario: vs.valeur, carte: vc.valeur };
}

/** L'adversaire rend ses actions tout de suite : c'est `adversaireIa`, synchrone. */
function synchrone(reponse: Action[] | Promise<Action[]>): Action[] {
  if (!Array.isArray(reponse)) throw new Error('adversaireIa a rendu une promesse');
  return reponse;
}

/** Un tour d'IA chronométré, et la situation où il s'est joué. */
export interface TourMesure {
  scenario: string;
  journee: number;
  camp: number;
  commandant: string | null;
  strategie: StrategieIa;
  unites: number;
  unitesDuCamp: number;
  actions: number;
  pouvoir: boolean;
  brouillard: boolean;
  /** Le gel : l'appel à l'adversaire sur l'état vivant, d'un bloc — la page avant le worker. */
  ms: number;
  /** Le même calcul sur une copie : ce que fait le worker, sans geler personne. */
  msCopie: number;
  /** Ce que le worker ajoute à l'envoi : le clonage structuré de l'état. */
  msClonage: number;
  /** La taille de l'état en JSON, en octets. */
  octets: number;
}

/** Ce que coûtent, en fin de partie simulée, trois gestes du fil principal hors rendu. */
export interface CoutsFil {
  scenario: string;
  actionsJouees: number;
  /** `sauvegarder()` : la liste entière des actions, sérialisée après **chaque** action. */
  msSauvegarde: number;
  octetsSauvegarde: number;
  /** `rejouer()` au montage d'une partie reprise, d'un bloc. */
  msRejeu: number;
  /** `evaluerEffets` du pouvoir et du super du joueur : ce que la vue refait à chaque rafraîchissement quand un pouvoir est prêt. */
  msPrevisionPouvoirs: number;
}

interface Preparation {
  code: string;
  scenario: Scenario;
  carte: MapDef;
  cat: Catalogue;
  commandants: (CommandantMoteur | null)[];
  strategie: StrategieIa | undefined;
  strategiesParCamp: Partial<Record<number, StrategieIa>>;
  graine: string;
}

function preparer(code: string, mode: Mode, graine: string): Preparation {
  const { scenario: canon, carte } = charger(code);
  // Comme la page : le mode d'abord, puis les commandants du scénario effectif.
  const scenario = scenarioPourMode(canon, mode);
  const commandants = resoudreCommandantsScenario(scenario);
  return {
    code, scenario, carte, cat: chargerCatalogue(scenario.catalogueVersion), commandants,
    strategie: scenario.commandants.find((c) => c.ia)?.ia,
    strategiesParCamp: Object.fromEntries(scenario.commandants.filter((c) => c.ia).map((c) => [c.camp, c.ia!])),
    graine,
  };
}

/** Le centile `p` d'une liste de durées (0,5 : la médiane). */
function centile(valeurs: readonly number[], p: number): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.min(tri.length - 1, Math.floor(p * (tri.length - 1) + 0.5))]!;
}

/** Durée d'un appel, en millisecondes, avec son résultat. */
function chrono<T>(f: () => T): { ms: number; valeur: T } {
  const t0 = performance.now();
  const valeur = f();
  return { ms: performance.now() - t0, valeur };
}

/** Une partie jouée : ses tours d'IA chronométrés, ses coûts de fin, et de quoi la reprendre. */
interface PartieJouee {
  tours: TourMesure[];
  couts: CoutsFil;
  etat: EtatPartie;
  scene: Scene;
  actions: Action[];
}

/**
 * Joue une partie jusqu'à la journée `journees` et chronomètre chaque tour
 * d'IA. Le camp 0 — celui du joueur sur la page — est tenu par la pondérée,
 * jamais chronométré : sur la page, c'est un humain qui réfléchit. La partie
 * s'arrête au début d'un tour du camp 0 : c'est là qu'une reprise la rouvre.
 */
function jouer(prep: Preparation, journees: number, mesurer: boolean): PartieJouee {
  const { cat, commandants } = prep;
  const scene = sceneDepuis(prep.scenario, prep.carte, commandants);
  let etat = creerPartie(scene, cat, prep.graine);
  const adversaire = adversaireIa(prep.strategie, prep.scenario.catalogueVersion, commandants, prep.strategiesParCamp);
  const tours: TourMesure[] = [];
  const jouees: Action[] = [];
  for (let garde = 0; garde < 4000 && !etat.partie.terminee && etat.journee <= journees; garde += 1) {
    const camp = etat.campCourant;
    // Un tour calculé sur l'état vivant peut l'**écrire** : le moteur partage le
    // tableau vide `cargo` d'un transport entre deux états, et un embarquement y
    // écrit en place (`doc/refonte/ia-en-fond.md`). La partie repart donc d'une
    // copie prise avant le calcul, pour rester celle que la sauvegarde rejoue.
    const propre = structuredClone(etat);
    let suite: Action[];
    if (camp === 0) {
      suite = jouerTour(etat, PONDEREE, restaurerRng(etat.graine, etat.flux), cat, commandants).actions;
    } else {
      const avant = etat;
      const copie = structuredClone(propre);
      const clonage = chrono(() => structuredClone(propre));
      // L'état vivant d'abord : c'est le gel d'avant, et le premier calcul paie
      // seul les mémoires partagées du moteur que le second trouvera chaudes.
      const { ms, valeur } = chrono(() => synchrone(adversaire(avant)));
      const surCopie = chrono(() => synchrone(adversaire(copie)));
      suite = valeur;
      if (JSON.stringify(surCopie.valeur) !== JSON.stringify(valeur)) {
        throw new Error(`l'IA ne rend pas la même suite sur une copie : ${prep.code}, J${propre.journee}, camp ${camp}`);
      }
      if (mesurer) {
        tours.push({
          scenario: prep.code, journee: propre.journee, camp,
          commandant: propre.camps.find((c) => c.id === camp)?.commandantCle ?? null,
          strategie: prep.strategiesParCamp[camp] ?? prep.strategie ?? 'ponderee',
          unites: propre.unites.length, unitesDuCamp: propre.unites.filter((u) => u.camp === camp).length,
          actions: suite.length, pouvoir: suite.some((a) => a.type === 'pouvoir'),
          brouillard: propre.reglages.brouillard, ms, msCopie: surCopie.ms, msClonage: clonage.ms,
          octets: Buffer.byteLength(JSON.stringify(propre)),
        });
      }
    }
    etat = propre;
    // Comme `tourAdversaire` : action par action, par le moteur. Un refus ferme
    // le tour, exactement comme `jouerTour` l'aurait fait.
    let joue = false;
    for (const action of suite) {
      const r = appliquer(etat, action, cat, commandants);
      if (!r.ok) break;
      etat = r.etat;
      jouees.push(action);
      joue = true;
    }
    if (etat.campCourant === camp && !etat.partie.terminee) {
      const fin = appliquer(etat, { type: 'finTour' }, cat, commandants);
      if (!fin.ok) break;
      etat = fin.etat;
      jouees.push({ type: 'finTour' });
    } else if (!joue) break;
  }

  // --- Trois coûts du fil principal hors rendu, sur la partie ainsi jouée.
  const sauvegarde = sauvegardeDe(prep, etat, jouees);
  const ecriture = chrono(() => JSON.stringify(sauvegarde));
  const rejeu = chrono(() => rejouer(scene, cat, sauvegarde, commandants));
  if (JSON.stringify(rejeu.valeur.etat) !== JSON.stringify(etat)) throw new Error(`rejeu divergent sur ${prep.code}`);
  const moi = commandants[0] ?? null;
  const prevision = chrono(() => {
    if (!moi) return;
    evaluerEffets(etat, cat, 0, moi.pouvoir.effets);
    evaluerEffets(etat, cat, 0, moi.superPouvoir.effets);
  });
  return {
    tours, etat, scene, actions: jouees,
    couts: {
      scenario: prep.code, actionsJouees: jouees.length, msSauvegarde: ecriture.ms,
      octetsSauvegarde: Buffer.byteLength(ecriture.valeur), msRejeu: rejeu.ms, msPrevisionPouvoirs: prevision.ms,
    },
  };
}

/** La sauvegarde que la page écrirait pour cette partie (`render/jeu.ts`, `sauvegarder`). */
function sauvegardeDe(prep: Preparation, etat: EtatPartie, actions: Action[]) {
  return {
    scenarioCle: prep.scenario.code, scenarioVersion: prep.scenario.version, graine: prep.graine,
    catalogueVersion: prep.cat.version, engineVersion: VERSION_MOTEUR, mapgenVersion: etat.mapgenVersion,
    contentVersion: etat.contentVersion, actions,
  };
}

// ---------------------------------------------------------------------------
// L'audit du fil principal hors rendu (`--audit`)
// ---------------------------------------------------------------------------

/** Un `localStorage` en mémoire : la page le lit et l'écrit à chaque action. */
function stockageFactice(): void {
  const valeurs = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => valeurs.get(k) ?? null,
    setItem: (k: string, v: string) => { valeurs.set(k, String(v)); },
    removeItem: (k: string) => { valeurs.delete(k); },
    clear: () => { valeurs.clear(); },
    key: (i: number) => [...valeurs.keys()][i] ?? null,
    get length() { return valeurs.size; },
  };
}

/** Juste assez de DOM pour que le HUD se monte et écrive (`tests/render/hud-html.test.ts`). */
class FauxElement {
  children: FauxElement[] = [];
  parent: FauxElement | null = null;
  className = '';
  id = '';
  clientWidth = 1280;
  clientHeight = 800;
  textContent = '';
  innerHTML = '';
  dataset: Record<string, string> = {};
  attributs = new Map<string, string>();
  style: Record<string, unknown> = {
    setProperty(this: Record<string, unknown>, cle: string, valeur: string): void { this[cle] = valeur; },
  };
  ownerDocument: unknown;
  setAttribute(k: string, v: string): void { this.attributs.set(k, v); }
  hasAttribute(k: string): boolean { return this.attributs.has(k); }
  appendChild(e: FauxElement): FauxElement { e.parent = this; this.children.push(e); return e; }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((e) => e !== this);
    this.parent = null;
  }
  contains(): boolean { return false; }
  querySelector(): null { return null; }
  classList = { contains: (c: string): boolean => this.className.split(' ').includes(c) };
  closest(): null { return null; }
  addEventListener(): void { /* aucun geste du HUD n'est rejoué ici */ }
  removeEventListener(): void { /* idem */ }
  focus(): void { /* idem */ }
}

/** Un conteneur dans un document factice. */
function conteneurFactice(): FauxElement {
  const g = globalThis as Record<string, unknown>;
  g['Element'] ??= FauxElement;
  g['HTMLElement'] ??= FauxElement;
  g['HTMLCanvasElement'] ??= class {};
  const doc = {
    createElement: (): FauxElement => Object.assign(new FauxElement(), { ownerDocument: doc }),
    getElementById: (): null => null,
    head: new FauxElement(),
    activeElement: null,
    defaultView: undefined,
  };
  const conteneur = new FauxElement();
  conteneur.ownerDocument = doc;
  return conteneur;
}

/** Une peau qui ne dessine rien et garde les gestes qu'on lui branche. */
function peauMuette(): { rendu: Rendu; gestes: () => GestesRendu } {
  let gestes: GestesRendu | null = null;
  const rendu = {
    cle: '2d' as const, canvas: null,
    monter: () => undefined, afficher: () => undefined, animer: () => Promise.resolve(),
    versMonde: () => null, versEcran: () => ({ x: 0, y: 0 }),
    brancher: (g: GestesRendu) => { gestes = g; return () => { gestes = null; }; },
    msParImage: () => 0, capturer: () => null, cadrer: () => undefined, demonter: () => undefined,
  } as unknown as Rendu;
  return { rendu, gestes: () => { if (!gestes) throw new Error('aucun geste'); return gestes; } };
}

/** Ce que coûte le fil principal hors rendu sur une partie reprise en milieu de partie. */
export interface Audit {
  scenario: string;
  actions: number;
  unites: number;
  /** `monterJeu` d'une partie reprise : rejeu, contrôleur, HUD, premier rafraîchissement. */
  msMontage: number;
  /** Un rafraîchissement complet sans changement : médiane de trente. */
  msRafraichir: number;
  /** Un survol de case sans sélection : contrôleur, vue, HUD. Médiane et pire. */
  survol: { mediane: number; pire: number; n: number };
  /** Un survol avec une unité sélectionnée : le chemin, la flèche, le coût. */
  survolSelection: { mediane: number; pire: number; n: number };
  /** Ce que `toile.tsx` fait à chaque état neuf : `unitesVues` et le journal des rencontres. */
  msJournalParEtat: number;
}

function auditPartie(prep: Preparation, partie: PartieJouee): Audit {
  stockageFactice();
  const cle = cleSauvegarde(prep.scenario.code);
  globalThis.localStorage.setItem(cle, JSON.stringify(sauvegardeDe(prep, partie.etat, partie.actions)));
  const { rendu, gestes } = peauMuette();
  const conteneur = conteneurFactice();
  const montage = chrono(() => monterJeu(conteneur as unknown as HTMLElement, {
    scenario: prep.scenario, carte: prep.carte, catalogue: prep.cat, commandants: prep.commandants,
    graine: prep.graine, reprendre: true, cleSauvegarde: cle, fabriqueRendu: () => rendu,
    adversaire: ADVERSAIRE_PASSIF, hud: true, dialogues: false, debug: false,
    vitesseAnimations: 'instantanee',
  }));
  const jeu = montage.valeur;
  if (JSON.stringify(jeu.etat) !== JSON.stringify(partie.etat)) throw new Error(`reprise divergente sur ${prep.code}`);
  const { largeur, hauteur } = jeu.etat;

  // Un rafraîchissement complet, état inchangé : vue du contrôleur, vue du jeu,
  // HUD. Le tour de l'IA en fait trois par action (`poserEtat`, `attendre`,
  // puis après la partition).
  const rafraichissements = Array.from({ length: 30 }, () => chrono(() => jeu.salir()).ms);

  // Un balayage en serpentin de toute la carte : chaque survol change de case.
  const survoler = (cases: { x: number; y: number }[]): number[] => cases.map((c) => chrono(() => gestes().surSurvolCase?.(c)).ms);
  const serpentin: { x: number; y: number }[] = [];
  for (let y = 0; y < hauteur; y += 1) {
    for (let i = 0; i < largeur; i += 1) serpentin.push({ x: y % 2 === 0 ? i : largeur - 1 - i, y });
  }
  const libre = survoler(serpentin);

  // Une unité du joueur, prête : on la sélectionne, puis on survole autour d'elle.
  const u = jeu.etat.unites.find((x) => x.camp === 0 && x.etat === 'prete' && !x.dansTransport);
  let avecSelection: number[] = [];
  if (u) {
    gestes().surClicCase?.({ x: u.x, y: u.y });
    const autour: { x: number; y: number }[] = [];
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        const c = { x: u.x + dx, y: u.y + dy };
        if (Math.abs(dx) + Math.abs(dy) <= 6 && c.x >= 0 && c.y >= 0 && c.x < largeur && c.y < hauteur) autour.push(c);
      }
    }
    avecSelection = survoler(autour);
  }
  jeu.demonter();

  // Ce que la page fait à chaque état neuf d'une mission (`toile.tsx`, `surEtat`).
  const catalogueJournal = chargerCatalogue(prep.scenario.catalogueVersion);
  const rencontres = (etat: EtatPartie): Rencontre[] => unitesVues(etat, catalogueJournal, 0).map((x) => ({
    mission: prep.scenario.code, journee: etat.journee, genre: 'unite', cle: x.type, relation: x.camp === 0 ? 'allie' : 'adversaire',
  }));
  // Un carnet déjà rempli : cent cinquante rencontres, comme après quelques missions.
  globalThis.localStorage.setItem(cleProgression('a'), JSON.stringify({
    version: 1, victoires: ['premier_contact', 'villes_du_bocage'],
    rencontres: Array.from({ length: 150 }, (_, i) => ({ genre: 'unite', cle: `unite_${i}`, relation: 'adversaire', mission: 'demo', journee: 1 })),
  }));
  // Deux temps : la vision du joueur sur des états neufs (mémoires froides,
  // comme chaque état qu'une action fabrique), puis le carnet relu, comparé et
  // réécrit s'il le faut.
  const neufs = Array.from({ length: 10 }, () => structuredClone(partie.etat));
  const vision = chrono(() => { for (const e of neufs) unitesVues(e, catalogueJournal, 0); });
  const liste = rencontres(partie.etat);
  const carnet = chrono(() => { for (let i = 0; i < 20; i += 1) enregistrerRencontres(liste, 'a'); });
  return {
    scenario: prep.code, actions: partie.actions.length, unites: partie.etat.unites.length, msMontage: montage.ms,
    msRafraichir: centile(rafraichissements, 0.5),
    survol: { mediane: centile(libre, 0.5), pire: Math.max(...libre), n: libre.length },
    survolSelection: avecSelection.length > 0
      ? { mediane: centile(avecSelection, 0.5), pire: Math.max(...avecSelection), n: avecSelection.length }
      : { mediane: 0, pire: 0, n: 0 },
    msJournalParEtat: vision.ms / neufs.length + carnet.ms / 20,
  };
}

/** `chargerCatalogue`, que `toile.tsx` rappelle à chaque rendu d'un essai Aube. Médiane de vingt. */
function auditCatalogue(): number {
  return centile(Array.from({ length: 20 }, () => chrono(() => chargerCatalogue(0)).ms), 0.5);
}

/**
 * Le premier son d'ambiance : `creerAmbiance` synthétise douze secondes de
 * bruit stéréo à 48 kHz sur le fil principal, une fois par genre. Un contexte
 * audio factice qui ne rend que des tampons suffit à chronométrer la boucle.
 */
function auditAudio(): { premier: number; suivant: number } {
  const noeud = (): Record<string, unknown> => ({
    connect: () => undefined, disconnect: () => undefined, start: () => undefined, stop: () => undefined,
    gain: { value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, cancelAndHoldAtTime: () => undefined },
    frequency: { value: 0 }, Q: { value: 0 }, type: '', buffer: null, loop: false, loopStart: 0, onended: null,
  });
  const contexte = {
    sampleRate: 48_000, currentTime: 0,
    createBuffer: (canaux: number, longueur: number) => {
      const donnees = Array.from({ length: canaux }, () => new Float32Array(longueur));
      return { getChannelData: (i: number) => donnees[i]! };
    },
    createBufferSource: noeud, createBiquadFilter: noeud, createGain: noeud, createOscillator: noeud,
  } as unknown as AudioContext;
  const cache = new Map();
  const sortie = noeud() as unknown as AudioNode;
  const premier = chrono(() => creerAmbiance(contexte, sortie, 'pluie', cache)).ms;
  const suivant = chrono(() => creerAmbiance(contexte, sortie, 'pluie', cache)).ms;
  return { premier, suivant };
}

// ---------------------------------------------------------------------------

const arrondi = (n: number): string => (n < 10 ? n.toFixed(1) : n.toFixed(0));

/** Ce qu'une passe mesure, tel que `--json` l'écrit. */
interface Passe {
  journees: number;
  mode: Mode;
  graine: string;
  codes: string[];
  charge: { avant: number[]; apres: number[] };
  tours: TourMesure[];
  couts: CoutsFil[];
  audits: Audit[];
  autres: { catalogue: number; audio: { premier: number; suivant: number } } | null;
}

/** Une passe de mesure, dans ce processus. */
function unePasse(o: Record<string, string | boolean>): Passe {
  const codes = o['tous'] === true
    ? readdirSync('content/scenarios').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort()
    : typeof o['scenarios'] === 'string' ? o['scenarios'].split(',') : PAR_DEFAUT;
  const journees = typeof o['journees'] === 'string' ? Number(o['journees']) : 12;
  const mode: Mode = o['mode'] === 'difficile' ? 'difficile' : 'normal';
  const graine = typeof o['graine'] === 'string' ? o['graine'] : 'mesure:1';
  const chargeAvant = loadavg();

  // Échauffement : une partie courte, jamais comptée.
  jouer(preparer('demo', 'normal', 'echauffement'), 4, false);

  const tours: TourMesure[] = [];
  const couts: CoutsFil[] = [];
  const audits: Audit[] = [];
  for (const code of codes) {
    const prep = preparer(code, mode, graine);
    const r = jouer(prep, journees, true);
    tours.push(...r.tours);
    couts.push(r.couts);
    if (o['audit'] && !r.etat.partie.terminee) audits.push(auditPartie(prep, r));
  }
  const autres = o['audit'] ? { catalogue: auditCatalogue(), audio: auditAudio() } : null;
  return { journees, mode, graine, codes, charge: { avant: chargeAvant, apres: loadavg() }, tours, couts, audits, autres };
}

/**
 * Plusieurs passes, **chacune dans son processus** — mémoires du moteur
 * froides à chaque fois —, et pour chaque mesure le **minimum** des passes.
 * Les parties sont déterministes : le tour n de chaque passe est le même tour,
 * et la charge d'une machine partagée ne fait qu'ajouter du temps. Le minimum
 * est donc la meilleure estimation du coût propre ; il ne corrige rien d'un
 * cœur lent ou d'une machine bridée.
 */
function plusieursPasses(n: number): Passe {
  const passes: Passe[] = [];
  for (let i = 0; i < n; i += 1) {
    const enfant = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, ...process.argv.slice(2), '--json', '--passe-unique'], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    });
    if (enfant.status !== 0) throw new Error(`passe ${i + 1} en échec : ${enfant.stderr}`);
    passes.push(JSON.parse(enfant.stdout) as Passe);
  }
  const [premiere, ...autresPasses] = passes;
  if (!premiere) throw new Error('aucune passe');
  const moins = (a: number, b: number): number => Math.min(a, b);
  for (const p of autresPasses) {
    if (p.tours.length !== premiere.tours.length) throw new Error('deux passes n’ont pas joué les mêmes tours');
    p.tours.forEach((t, i) => {
      const r = premiere.tours[i]!;
      if (t.scenario !== r.scenario || t.journee !== r.journee || t.camp !== r.camp || t.actions !== r.actions) {
        throw new Error(`deux passes divergent au tour ${i} (${t.scenario}, J${t.journee})`);
      }
      r.ms = moins(r.ms, t.ms);
      r.msCopie = moins(r.msCopie, t.msCopie);
      r.msClonage = moins(r.msClonage, t.msClonage);
    });
    p.couts.forEach((c, i) => {
      const r = premiere.couts[i]!;
      r.msSauvegarde = moins(r.msSauvegarde, c.msSauvegarde);
      r.msRejeu = moins(r.msRejeu, c.msRejeu);
      r.msPrevisionPouvoirs = moins(r.msPrevisionPouvoirs, c.msPrevisionPouvoirs);
    });
    p.audits.forEach((a, i) => {
      const r = premiere.audits[i]!;
      r.msMontage = moins(r.msMontage, a.msMontage);
      r.msRafraichir = moins(r.msRafraichir, a.msRafraichir);
      r.survol = { mediane: moins(r.survol.mediane, a.survol.mediane), pire: moins(r.survol.pire, a.survol.pire), n: r.survol.n };
      r.survolSelection = {
        mediane: moins(r.survolSelection.mediane, a.survolSelection.mediane),
        pire: moins(r.survolSelection.pire, a.survolSelection.pire), n: r.survolSelection.n,
      };
      r.msJournalParEtat = moins(r.msJournalParEtat, a.msJournalParEtat);
    });
    if (premiere.autres && p.autres) {
      premiere.autres = {
        catalogue: moins(premiere.autres.catalogue, p.autres.catalogue),
        audio: { premier: moins(premiere.autres.audio.premier, p.autres.audio.premier), suivant: moins(premiere.autres.audio.suivant, p.autres.audio.suivant) },
      };
    }
  }
  premiere.charge = {
    avant: [Math.min(...passes.map((p) => p.charge.avant[0]!)), Math.max(...passes.map((p) => p.charge.avant[0]!))],
    apres: [Math.min(...passes.map((p) => p.charge.apres[0]!)), Math.max(...passes.map((p) => p.charge.apres[0]!))],
  };
  return premiere;
}

function principal(): void {
  const o = options(process.argv.slice(2));
  const nPasses = typeof o['passes'] === 'string' ? Math.max(1, Number(o['passes'])) : 1;
  const r = nPasses > 1 && !o['passe-unique'] ? plusieursPasses(nPasses) : unePasse(o);
  const { journees, mode, graine, codes, tours, couts, audits, autres } = r;

  if (o['json']) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  const situation = (x: TourMesure): string => `J${x.journee}, camp ${x.camp}, ${x.unites} unités, ${x.actions} actions${x.pouvoir ? ', pouvoir' : ''}`;
  console.log(`Tours d'IA — ${journees} journées au plus, mode ${mode}, graine ${graine}${nPasses > 1 ? `, minimum de ${nPasses} passes` : ''}`);
  console.log(nPasses > 1
    ? `Charge de la machine (moyenne sur une minute) : de ${r.charge.avant[0]!.toFixed(1)} à ${r.charge.avant[1]!.toFixed(1)} au début des passes`
    : `Charge de la machine : ${r.charge.avant.map((c) => c.toFixed(1)).join(' ')} avant, ${r.charge.apres.map((c) => c.toFixed(1)).join(' ')} après`);
  console.log('Gel = l\'appel sur l\'état vivant (la page avant le worker) ; copie = le même calcul sur une copie (le worker, sans geler).\n');
  console.log('scénario                        tours   gel médian   p90   pire   situation du pire                              copie méd./pire   clonage méd./pire   état');
  for (const code of codes) {
    const t = tours.filter((x) => x.scenario === code);
    if (t.length === 0) continue;
    const ms = t.map((x) => x.ms);
    const pire = t.reduce((a, b) => (b.ms > a.ms ? b : a));
    const copies = t.map((x) => x.msCopie);
    const clonages = t.map((x) => x.msClonage);
    console.log(`${code.padEnd(31)} ${String(t.length).padStart(5)} ${arrondi(centile(ms, 0.5)).padStart(8)} ms ${arrondi(centile(ms, 0.9)).padStart(5)} ${arrondi(pire.ms).padStart(6)}   ${situation(pire).padEnd(46)}`
      + ` ${arrondi(centile(copies, 0.5)).padStart(5)} / ${arrondi(Math.max(...copies)).padStart(4)}   ${arrondi(centile(clonages, 0.5)).padStart(5)} / ${arrondi(Math.max(...clonages)).padStart(4)} ms   ${Math.round(pire.octets / 1024)} ko`);
  }
  const tous = tours.map((x) => x.ms);
  const pire = tours.reduce((a, b) => (b.ms > a.ms ? b : a));
  const avecPouvoir = tours.filter((x) => x.pouvoir);
  console.log(`\nTous : ${tours.length} tours d'IA, gel médian ${arrondi(centile(tous, 0.5))} ms, p90 ${arrondi(centile(tous, 0.9))} ms, p99 ${arrondi(centile(tous, 0.99))} ms, pire ${arrondi(pire.ms)} ms (${pire.scenario}, ${situation(pire)}).`);
  console.log(`Tours au-delà d'une image à 60 Hz (16,7 ms) : ${tours.filter((x) => x.ms > 16.7).length} ; au-delà de 50 ms : ${tours.filter((x) => x.ms > 50).length} ; au-delà de 100 ms : ${tours.filter((x) => x.ms > 100).length}.`);
  if (avecPouvoir.length > 0) {
    console.log(`Tours où l'IA déclenche un pouvoir : ${avecPouvoir.length}, gel médian ${arrondi(centile(avecPouvoir.map((x) => x.ms), 0.5))} ms, pire ${arrondi(Math.max(...avecPouvoir.map((x) => x.ms)))} ms.`);
  }
  console.log(`Clonage de l'état à l'envoi : médiane ${arrondi(centile(tours.map((x) => x.msClonage), 0.5))} ms, pire ${arrondi(Math.max(...tours.map((x) => x.msClonage)))} ms.`);

  console.log('\nFil principal hors rendu, en fin de partie simulée :');
  console.log('scénario                        actions   sauvegarde        rejeu    prévision des deux pouvoirs');
  for (const c of couts) {
    console.log(`${c.scenario.padEnd(31)} ${String(c.actionsJouees).padStart(7)}   ${arrondi(c.msSauvegarde).padStart(5)} ms ${String(Math.round(c.octetsSauvegarde / 1024)).padStart(4)} ko   ${arrondi(c.msRejeu).padStart(5)} ms   ${arrondi(c.msPrevisionPouvoirs).padStart(5)} ms`);
  }

  if (audits.length > 0 && autres) {
    console.log('\nAudit — une partie reprise en milieu de partie, peau muette, HUD sur un document factice :');
    console.log('scénario                        actions unités   montage (rejeu compris)   rafraîchir   survol méd./pire (n)      survol sélection méd./pire (n)   journal par état');
    for (const a of audits) {
      console.log(`${a.scenario.padEnd(31)} ${String(a.actions).padStart(7)} ${String(a.unites).padStart(6)}   ${arrondi(a.msMontage).padStart(10)} ms             `
        + `${arrondi(a.msRafraichir).padStart(5)} ms   `
        + `${arrondi(a.survol.mediane).padStart(5)} / ${arrondi(a.survol.pire).padStart(5)} ms (${a.survol.n})   `
        + `${arrondi(a.survolSelection.mediane).padStart(5)} / ${arrondi(a.survolSelection.pire).padStart(5)} ms (${a.survolSelection.n})         ${arrondi(a.msJournalParEtat)} ms`);
    }
    console.log(`chargerCatalogue (médiane de 20) : ${arrondi(autres.catalogue)} ms`);
    console.log(`Premier son d'ambiance (12 s de bruit stéréo synthétisés) : ${arrondi(autres.audio.premier)} ms ; les suivants : ${arrondi(autres.audio.suivant)} ms`);
  }
}

principal();
