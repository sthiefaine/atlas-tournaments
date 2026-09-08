/**
 * `monterJeu()` — l'assemblage, désormais **indépendant du rendu**.
 *
 * Il tient cinq promesses :
 *
 * - le rendu est une **peau interchangeable** : `Rendu` (`rendu.ts`) est la seule
 *   chose que ce fichier connaisse ; la peau three.js s'y branche
 *   sans que rien ici ne change. `render/` n'a pas le droit d'importer
 *   `render3d/` (`02-architecture.md` §5), c'est donc la page de jeu qui fournit
 *   la fabrique 3D, exactement comme elle fournit l'adversaire ;
 * - l'**état logique est toujours en avance** sur l'animation : une animation
 *   n'est qu'un rattrapage visuel. Les événements d'une action passent par le
 *   réalisateur (`partition.ts`), qui écrit une **partition** jouée par deux
 *   exécutants — la peau (`rendu.jouer`) et le HUD (`hud.jouer`) —, et **un
 *   clic la coupe** : tout saute à l'état final, le clic ne vaut pas un ordre ;
 * - l'**adversaire joue par le même moteur** que le joueur, action par action ;
 * - la **sauvegarde est une liste d'actions** (`03-schemas.md` §14), dans
 *   `localStorage`, sous `try`/`catch` ;
 * - le **HUD est en HTML** (`hud-html.ts`), partagé par les deux peaux.
 */

import type {
  Action, Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, MotifRefus,
} from '../engine/index';
import {
  appliquer, brouillardActif, casesVisibles as casesVuesPar, chargerCatalogue, cleCase,
  creerPartie, POINTS_PAR_BARRE, rejouer, sceneDepuis, terrainLogique, uniteParId, unitesVues,
  verifierPouvoir, VERSION_MOTEUR,
} from '../engine/index';
import { resoudre, traducteur } from '../i18n/index';
import type {
  CampId, Case, CleUnite, Dialogue, MapDef, Meteo, PhaseJour, Saison, Sauvegarde,
  Scenario,
} from '../schemas/types';
import { ambiance as construireAmbiance, ambianceDe, type Ambiance } from './ambiance';
import { Controleur, type VueControleur } from './controleur';
import { monterDialogue, type ApiDialogue, type DialogueHtml } from './dialogue-html';
import {
  dialogueFin, filerRepliques, scenesDeclenchees, sceneOuverture, type RepliqueEnAttente,
} from './dialogues';
import { casesObjectifs } from './objectifs';
import { nomCourtUnite } from './libelles';
import { ecrirePartition } from './partition';
import { resoudreCommandantsScenario } from '../content/commandants-jeu';
import { monterHudHtml, type ApiHud, type HudHtml, type VueJeu } from './hud-html';
import {
  type CleRendu, type MesuresRendu, type Rendu, type VueInteraction,
} from './rendu';

/**
 * L'adversaire, vu du rendu : une fonction qui rend la suite d'actions du camp
 * courant. Le rendu **n'importe pas `ai/`** — la règle d'import de
 * `02-architecture.md` §5 ne l'y autorise pas. C'est la page de jeu qui branche.
 */
export type Adversaire = (etat: EtatPartie) => Action[];

/** L'adversaire par défaut : il passe son tour. Le rendu reste jouable sans IA. */
export const ADVERSAIRE_PASSIF: Adversaire = () => [{ type: 'finTour' }];

/** Ce qu'il faut pour monter une partie. */
export interface OptionsJeu {
  scenario: Scenario;
  carte: MapDef;
  catalogue?: Catalogue;
  graine?: string;
  locale?: string;
  /** L'adversaire : `jouerTour` d'`ai/`, branché par l'appelant. */
  adversaire?: Adversaire;
  commandants?: (CommandantMoteur | null)[];
  /** Reprend la sauvegarde locale si elle correspond au scénario et à la graine. */
  reprendre?: boolean;
  /**
   * La clé de sauvegarde locale, **déjà composée par l'appelant** ; par défaut
   * `cleSauvegarde(scenario.code)`. Le rendu ne sait pas qu'un appareil porte
   * plusieurs profils de joueur, pas plus qu'il ne sait traduire : la page lui
   * donne la clé comme elle lui donne des libellés.
   */
  cleSauvegarde?: string;
  /** Camp du joueur humain. Toujours 0 dans un scénario canon. */
  camp?: CampId;
  /** Fabrique des peaux que `render/` ne peut pas importer (la 3D). */
  fabriqueRendu?: (cle: CleRendu) => Rendu;
  /** Pose le HUD HTML par-dessus le canvas. Vrai par défaut. */
  hud?: boolean;
  /**
   * Joue les dialogues du scénario par-dessus la carte : ouverture, scènes en
   * cours de match, fin. **Faux par défaut** — un scénario de démonstration ou
   * un aperçu d'administration n'a rien à raconter, et un test de fumée n'a pas
   * à cliquer une réplique avant de pouvoir jouer.
   */
  dialogues?: boolean;
  /** Signale l'ouverture et la fermeture d'une scène de dialogue à la page hôte. */
  surDialogue?: (actif: boolean) => void;
  /**
   * Force la réduction des animations : la partition ne dure pas, les gestes
   * restent. Le réglage système (`prefers-reduced-motion`) s'ajoute toujours.
   */
  animationsReduites?: boolean;
  /**
   * L'écran de combat par-dessus la carte à chaque attaque (`Preferences.ecranCombat`).
   * **Vrai par défaut** ; un clic le coupe de toute façon.
   */
  ecranCombat?: boolean;
  /** Expose `window.__atlas` (tests de fumée et mise au point). */
  debug?: boolean;
  /** Informe l'écran de campagne sans lui donner l'autorité sur les règles. */
  surEtat?: (etat: EtatPartie) => void;
  finPersonnalisee?: boolean;
}

/**
 * Où en est le chargement, tel que la peau le dit d'elle-même. Aucun de ces
 * états n'est deviné : ils sortent de `Rendu.mesurer()`, qui rend `backend`
 * nul tant que le moteur n'a pas démarré et zéro appel de dessin tant qu'aucune
 * image n'a été envoyée. Une barre qui avancerait toute seule mentirait ; ces
 * quatre mots, non.
 */
export type EtapeChargement =
  /** Le monde est bâti, le moteur graphique démarre (`renderer.init()`). */
  | 'moteur'
  /** Le moteur est là, la première image n'est pas encore dessinée. */
  | 'image'
  /** Une image est passée : le plateau est réellement à l'écran. */
  | 'pret';

/**
 * L'étape de chargement que disent les compteurs d'une peau. Pure, et c'est
 * exprès : c'est la **règle d'honnêteté** de l'écran de chargement, elle se
 * relit et se teste sans monter quoi que ce soit.
 *
 * - pas de mesure du tout — une peau qui ne sait pas répondre : `pret`. On ne
 *   retient jamais un écran de chargement sur une ignorance ;
 * - `backend` nul : le moteur graphique n'a pas démarré ;
 * - zéro appel de dessin : il a démarré, la première image est à venir ;
 * - au moins un appel : une image est passée, le plateau est réellement là.
 */
export function etapeChargement(mesures: MesuresRendu | null | undefined): EtapeChargement {
  if (!mesures) return 'pret';
  if (mesures.backend === null) return 'moteur';
  return mesures.appels > 0 ? 'pret' : 'image';
}

/** Ce que rend `monterJeu` : de quoi observer, piloter et démonter. */
export interface Jeu {
  /** L'état courant de la partie. */
  readonly etat: EtatPartie;
  /** La peau réellement montée. */
  readonly rendu: CleRendu;
  /**
   * Où en est le chargement. À interroger d'image en image par l'hôte : la
   * réponse ne change que deux fois, et la question ne coûte qu'une lecture
   * des compteurs du moteur. Une peau qui ne sait pas mesurer répond `pret` —
   * on ne retient pas un écran de chargement sur une ignorance.
   */
  etatChargement(): EtapeChargement;
  /** Force une image. */
  salir(): void;
  /** Efface la sauvegarde locale de ce scénario. */
  oublierSauvegarde(): void;
  /** Force une ambiance (mise au point et captures) ; `null` rend la main au climat. */
  forcerAmbiance(saison: Saison | null, phase?: PhaseJour, meteo?: Meteo): void;
  /** Retire tous les écouteurs, arrête la boucle et vide le cache. */
  demonter(): void;
}

/** Préfixe des clés de sauvegarde locale. */
export const PREFIXE_SAUVEGARDE = 'atlas:partie:';

/** La clé de sauvegarde d'un scénario, sous le préfixe par défaut ou celui de l'appelant. */
export function cleSauvegarde(scenarioCle: string, prefixe: string = PREFIXE_SAUVEGARDE): string {
  return `${prefixe}${scenarioCle}`;
}

/** Le stockage local, ou `null` s'il est indisponible (navigation privée, refus). */
function stockage(): Storage | null {
  try {
    const s = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (!s) return null;
    const sonde = `${PREFIXE_SAUVEGARDE}sonde`;
    s.setItem(sonde, '1');
    s.removeItem(sonde);
    return s;
  } catch {
    return null;
  }
}

/** Lit la sauvegarde d'un scénario, ou `null`. `cle` remplace la clé par défaut. */
export function lireSauvegarde(scenarioCle: string, cle: string = cleSauvegarde(scenarioCle)): (Sauvegarde & { actions: Action[] }) | null {
  const s = stockage();
  if (!s) return null;
  try {
    const brut = s.getItem(cle);
    if (!brut) return null;
    const valeur = JSON.parse(brut) as Sauvegarde & { actions: Action[] };
    if (typeof valeur?.scenarioCle !== 'string' || !Array.isArray(valeur.actions)) return null;
    return valeur;
  } catch {
    return null;
  }
}

/** Écrit la sauvegarde d'un scénario. Un échec est silencieux : on joue quand même. */
export function ecrireSauvegarde(sauvegarde: Sauvegarde, cle: string = cleSauvegarde(sauvegarde.scenarioCle)): void {
  const s = stockage();
  if (!s) return;
  try {
    s.setItem(cle, JSON.stringify(sauvegarde));
  } catch {
    // Quota plein ou stockage refusé : la partie continue, sans reprise.
  }
}

/** Efface la sauvegarde d'un scénario. */
export function effacerSauvegarde(scenarioCle: string, cle: string = cleSauvegarde(scenarioCle)): void {
  const s = stockage();
  if (!s) return;
  try {
    s.removeItem(cle);
  } catch {
    // Rien à faire : l'absence de sauvegarde est un état valide.
  }
}

/**
 * Commandants de secours : un scénario cite des clés, le canon des commandants
 * n'est pas encore écrit. Leur nom vient de `t()` comme tout le reste.
 */
export function commandantsDuScenario(scenario: Scenario): (CommandantMoteur | null)[] {
  return resoudreCommandantsScenario(scenario);
}

/** Pause entre deux actions de l'adversaire : de quoi suivre sans s'ennuyer. */
const MS_ENTRE_ACTIONS = 220;

/** Durée d'affichage d'une annonce. */
const MS_ANNONCE = 2200;

/** Ce que `window.__atlas` expose en développement. */
export interface PontDebug {
  rendu: CleRendu;
  /** Position d'écran du centre d'une case : le test de fumée clique dessus. */
  positionCase(x: number, y: number): { x: number; y: number } | null;
  /** Une image PNG en `data:` de l'état courant : le test de fumée l'échantillonne. */
  capturer(): string | null;
  /** Durée moyenne d'une image, en millisecondes. */
  msParImage(): number;
  /**
   * Le coût de la dernière image — triangles, appels, durée, chaîne de
   * post-traitement active ou non —, ou `null` si la peau ne sait pas mesurer.
   * C'est la mesure de `16-realisme.md` A6, lisible depuis la console.
   */
  mesurer(): MesuresRendu | null;
  forcerAmbiance(saison: Saison | null, phase?: PhaseJour, meteo?: Meteo): void;
  etat(): { journee: number; camp: number; terminee: boolean };
  /**
   * Le terrain **tel que le rendu le lit** sur une case. Une mécanique régionale
   * réinterprète la carte sans l'écrire : c'est la seule façon de vérifier de
   * l'extérieur qu'une marée est bien arrivée jusqu'à l'image.
   */
  terrain(x: number, y: number): string | null;
  /** Où la peau dessine cette unité en ce moment (unités de scène), ou `null`. */
  positionUnite(id: string): { x: number; y: number; z: number } | null;
}

/**
 * Monte une partie dans un conteneur et rend de quoi la démonter. Tout le cycle
 * de vie est ici : peau, contrôleur, HUD HTML, adversaire, sauvegarde.
 */
export function monterJeu(conteneur: HTMLElement, options: OptionsJeu): Jeu {
  // --- La peau **d'abord**. Il n'y en a plus qu'une, et `render/` n'a pas le
  //     droit d'importer `render3d/` (`02-architecture.md` §5) : c'est donc
  //     l'appelant qui la fabrique. S'il n'en fournit pas, ou si elle refuse de
  //     se monter, on **lève** — un appareil sans moteur doit l'apprendre par un
  //     écran qui le dit, pas par un plateau vide.
  //
  //     Elle est montée **avant** que le moteur de règles ne travaille, et c'est
  //     délibéré : depuis le portage WebGPU, `monter()` lance une initialisation
  //     asynchrone (`renderer.init()`, adaptateur et périphérique graphiques) qui
  //     ne coûte presque rien au fil principal mais met du temps à revenir. La
  //     lancer d'abord, c'est laisser la mise en place de la partie — catalogue,
  //     scène, création, et surtout le **rejeu** d'une sauvegarde, qui peut faire
  //     des centaines d'actions — se dérouler pendant cette attente au lieu de
  //     s'y ajouter. Rien ici ne dépend de la peau, et la peau ne dépend de rien
  //     ici : c'est la seule mise en parallèle que le fil principal permette.
  if (!options.fabriqueRendu) throw new Error('aucune fabrique de rendu fournie');
  const rendu: Rendu = options.fabriqueRendu('3d');
  rendu.monter(conteneur);

  if (conteneur.style.position === '') conteneur.style.position = 'relative';

  let cat: Catalogue;
  let camp: CampId;
  let graine: string;
  let commandants: (CommandantMoteur | null)[];
  let scene: ReturnType<typeof sceneDepuis>;
  let cleLocale: string;
  let actions: Action[] = [];
  let etat: EtatPartie;
  try {
    cat = options.catalogue ?? chargerCatalogue(options.scenario.catalogueVersion);
    camp = options.camp ?? 0;
    graine = options.graine ?? `${options.scenario.code}:1`;
    commandants = options.commandants ?? commandantsDuScenario(options.scenario);
    scene = sceneDepuis(options.scenario, options.carte, commandants);
    cleLocale = options.cleSauvegarde ?? cleSauvegarde(options.scenario.code);

    // --- État initial : partie neuve, ou reprise de la sauvegarde locale.
    etat = creerPartie(scene, cat, graine);
    if (options.reprendre) {
      const sauvegarde = lireSauvegarde(options.scenario.code, cleLocale);
      if (sauvegarde && sauvegarde.graine === graine && sauvegarde.catalogueVersion === cat.version && sauvegarde.engineVersion === VERSION_MOTEUR) {
        const r = rejouer(scene, cat, { ...sauvegarde, actions: sauvegarde.actions }, commandants);
        etat = r.etat;
        actions = [...sauvegarde.actions];
      }
    }
  } catch (cause) {
    // La peau est déjà montée : un canon illisible ne doit pas laisser un
    // moteur graphique et sa boucle derrière lui.
    rendu.demonter();
    throw cause;
  }

  const locale = options.locale ?? 'fr';
  const t = traducteur(locale);
  const adversaire: Adversaire = options.adversaire ?? ADVERSAIRE_PASSIF;

  let annonce: string | null = null;
  let minuterieAnnonce: ReturnType<typeof setTimeout> | null = null;
  let attenteIa = false;
  let vivant = true;
  let ambianceForcee: Ambiance | null = null;
  let hud: HudHtml | null = null;
  let sceneHtml: DialogueHtml | null = null;
  const minuteries = new Set<ReturnType<typeof setTimeout>>();
  /** Une partition se joue : le prochain clic la coupe au lieu de donner un ordre. */
  let partitionEnCours = false;
  const mouvementReduit = conteneur.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');

  // --- Dialogues : une file de répliques, et le registre des scènes déjà dites.
  const avecDialogues = options.dialogues === true;
  const scenesScenario = options.scenario.scenesDialogue ?? [];
  const fileRepliques: RepliqueEnAttente[] = [];
  const scenesJouees = new Set<string>();
  let attentesDialogue: (() => void)[] = [];
  /**
   * La partie vient de se terminer et son dialogue de fin **n'est pas encore
   * en file** : il attend la fin de l'animation du dernier coup. Pendant ce
   * temps, l'écran de résultat ne doit pas se montrer — ni celui du HUD, ni
   * celui de la page hôte, prévenue par `surDialogue`.
   */
  let finEnAttente = false;

  const controleur = new Controleur({
    etat,
    catalogue: cat,
    camp,
    commandants,
    ecouteur: {
      surChangement: () => rafraichir(),
      surRefus: (_action, motif: MotifRefus) => {
        poserAnnonce(resoudre(locale, `refus.${motif}`) ?? t('hud.action_refusee'));
      },
      surAction: (action, evenements, avant, apres) => {
        actions.push(action);
        etat = apres;
        // Avant tout rafraîchissement : le contrôleur appelle `surChangement`
        // juste après, et l'écran de fin se rendrait avant que le commandant
        // ait pu ouvrir la bouche.
        retenirFin();
        sauvegarder();
        annoncer(evenements, avant);
        void jouerPartition(evenements, avant, apres).then(async () => {
          if (!vivant) return;
          ouvrirScenes(evenements);
          rafraichir();
          await attendreDialogue();
          if (!vivant) return;
          if (apres.partie.terminee) effacerSauvegarde(options.scenario.code, cleLocale);
          else if (apres.campCourant !== camp) void tourAdversaire();
        });
      },
    },
  });

  // -------------------------------------------------------------------------
  // Dialogues : la file, les déclencheurs, et l'attente de l'adversaire
  // -------------------------------------------------------------------------

  /** Camp d'un locuteur, lu sur la distribution du scénario. */
  function campDe(locuteur: string): CampId | null {
    return options.scenario.commandants.find((c) => c.commandantCle === locuteur)?.camp ?? null;
  }

  /** Vrai tant qu'une réplique est à l'écran : le jeu attend le joueur. */
  function dialogueActif(): boolean {
    return fileRepliques.length > 0;
  }

  /** Met une suite de répliques en file, sous une clé de scène jouée une fois. */
  function enfiler(sceneCle: string, repliques: readonly Dialogue[]): void {
    if (!avecDialogues || repliques.length === 0 || scenesJouees.has(sceneCle)) return;
    scenesJouees.add(sceneCle);
    fileRepliques.push(...filerRepliques(sceneCle, repliques, campDe));
    options.surDialogue?.(true);
  }

  /** Vide les attentes quand la dernière réplique tombe. */
  function libererAttentes(): void {
    if (dialogueActif()) return;
    const attentes = attentesDialogue;
    attentesDialogue = [];
    for (const resoudreAttente of attentes) resoudreAttente();
    options.surDialogue?.(false);
  }

  /**
   * Attend que la file se vide. L'adversaire s'en sert : une scène qui se
   * déclenche sur son tour doit arrêter la partie, pas défiler pendant qu'un
   * char avance derrière la boîte de dialogue.
   */
  function attendreDialogue(): Promise<void> {
    if (!dialogueActif() || !vivant) return Promise.resolve();
    return new Promise((resoudreAttente) => attentesDialogue.push(resoudreAttente));
  }

  /**
   * La partie vient de se terminer : on **retient** l'écran de résultat jusqu'à
   * ce que le dialogue de fin soit en file. C'est la correction du double
   * affichage : la fin était connue de l'état — donc du HUD et de la page —
   * dès l'action, mais le dialogue n'était enfilé qu'après l'animation ; entre
   * les deux, « Manche gagnée » passait une première fois.
   */
  function retenirFin(): void {
    if (!avecDialogues || !etat.partie.terminee || finEnAttente || scenesJouees.has('fin')) return;
    finEnAttente = true;
    options.surDialogue?.(true);
  }

  /** Ouvre les scènes que la dernière action vient de déclencher. */
  function ouvrirScenes(evenements: readonly EvenementJeu[]): void {
    if (!avecDialogues) return;
    for (const s of scenesDeclenchees(scenesScenario, scenesJouees, {
      etat, evenements, camp,
    })) enfiler(s.cle, s.repliques);
    if (etat.partie.terminee) {
      const gagne = etat.partie.vainqueur === camp && !etat.partie.nul;
      // Toujours un visage en fin de match : le scénario, sinon le repli.
      enfiler('fin', dialogueFin(options.scenario, camp, gagne, t));
      finEnAttente = false;
      // Rien n'a pu s'ouvrir (fin déjà dite, distribution vide) : on rend
      // l'écran de résultat au lieu de le retenir pour toujours.
      if (!dialogueActif()) options.surDialogue?.(false);
    }
  }

  // -------------------------------------------------------------------------
  // Sauvegarde
  // -------------------------------------------------------------------------

  function sauvegarder(): void {
    ecrireSauvegarde({
      scenarioCle: options.scenario.code,
      graine,
      catalogueVersion: cat.version,
      engineVersion: etat.engineVersion,
      mapgenVersion: etat.mapgenVersion,
      contentVersion: etat.contentVersion,
      actions,
    }, cleLocale);
  }

  // -------------------------------------------------------------------------
  // Annonces et animations
  // -------------------------------------------------------------------------

  function poserAnnonce(texte: string): void {
    if (!texte) return;
    annonce = texte;
    if (minuterieAnnonce !== null) clearTimeout(minuterieAnnonce);
    minuterieAnnonce = setTimeout(() => {
      minuterieAnnonce = null;
      annonce = null;
      rafraichir();
    }, MS_ANNONCE);
    rafraichir();
  }

  /** Le nom du bâtiment pris : une usine n'est pas une ville, un QG encore moins. */
  const CLE_PRISE: Readonly<Record<string, string>> = {
    ville: 'combat.ville_capturee',
    usine: 'combat.usine_capturee',
    aeroport: 'combat.aeroport_capture',
    qg: 'combat.qg_capture',
    radar: 'combat.radar_capture',
    port: 'combat.port_capture',
  };

  /**
   * Les événements qui méritent un mot **éphémère** au joueur.
   *
   * La fin de match n'en fait pas partie, et c'est une correction : elle était
   * annoncée ici, puis redite par le dialogue de victoire, puis une troisième
   * fois par l'écran de fin. Le joueur voyait une bannière clignoter et
   * disparaître au milieu de sa phrase — la scène de dialogue masque le HUD —
   * avant de lire deux fois la même nouvelle. Une fin de partie est un **état**,
   * pas une notification : elle a son dialogue et son écran, elle n'a pas
   * besoin d'un troisième messager.
   *
   * `avant` est l'état d'où l'action est partie : une **panne sèche** retire
   * l'unité de l'état d'après, et son nom ne se lit plus que là.
   */
  function annoncer(evenements: readonly EvenementJeu[], avant: EtatPartie): void {
    // Sous brouillard, une unité adverse hors de vue ne se raconte pas : l'annonce
    // dirait ce que la carte cache.
    // La vision ne se calcule que si un événement le demande : la plupart des
    // actions n'annoncent rien.
    let vues: ReadonlySet<string> | null | undefined;
    const seVoit = (u: { camp: CampId; x: number; y: number }): boolean => {
      if (u.camp === camp) return true;
      if (vues === undefined) vues = visibles();
      return vues === null || vues.has(cleCase(u));
    };
    for (const e of evenements) {
      if (e.type === 'remise_en_service') {
        poserAnnonce(t('combat.batiment_remis_prime', { n: e.prime }));
      }
      // L'embuscade (`04-gameplay.md` §2) : la marche s'arrête net, la suite
      // tombe, le tour de l'unité est fini. Le « ! » de la partition le montre,
      // l'annonce le dit — sans nommer ce qui a été heurté : vue d'ici, une
      // unité adverse s'arrête « pour rien », et c'est exactement ce qu'on sait.
      // L'unité se lit dans l'état d'après : c'est là qu'elle s'est arrêtée.
      if (e.type === 'deplacement' && e.interrompu) {
        const u = uniteParId(etat, e.uniteId);
        if (u && seVoit(u)) poserAnnonce(t('hud.embuscade', { unite: nomCourtUnite(locale, cat, u.type) }));
      }
      // La panne sèche mérite un mot : l'unité sort du jeu sans qu'on l'ait
      // frappée, et le geste `hors_jeu` seul ressemble à un tir venu de nulle part.
      if (e.type === 'panne_seche') {
        const u = uniteParId(avant, e.uniteId);
        if (u && seVoit(u)) poserAnnonce(t('hud.panne_seche', { unite: nomCourtUnite(locale, cat, u.type) }));
      }
      // Le ravitaillement ne se voit pas sur la carte : rien ne bouge, rien ne
      // tombe. L'annonce est son seul retour.
      if (e.type === 'ravitaillement') {
        const cible = uniteParId(etat, e.cibleId);
        if (cible && seVoit(cible)) poserAnnonce(t('hud.ravitaillement', { unite: nomCourtUnite(locale, cat, cible.type) }));
      }
      // Se cacher, se montrer : le voile se voit à peine, et ce qu'il change —
      // repérée au contact seulement, un surcoût de carburant — ne se voit pas
      // du tout. Une furtive adverse hors contact n'est pas racontée.
      if (e.type === 'furtivite') {
        const u = uniteParId(etat, e.uniteId);
        if (u && seVoit(u)) {
          poserAnnonce(t(e.furtive ? 'hud.furtivite_activee' : 'hud.furtivite_levee', { unite: nomCourtUnite(locale, cat, u.type) }));
        }
      }
      if (e.type === 'production_revelee' && e.camp === 0) {
        const liste = Object.entries(e.produites)
          .map(([cle, n]) => `${n} ${nomCourtUnite(locale, cat, cle)}`)
          .join(', ');
        poserAnnonce(liste ? t('combat.production_revelee', { liste }) : t('combat.production_revelee_vide'));
      } else if (e.type === 'capture' && e.acquis) {
        const terrain = terrainLogique(etat, cat, e.case);
        poserAnnonce(t(CLE_PRISE[terrain ?? ''] ?? 'combat.ville_capturee'));
      }
    }
  }

  /** Vrai si le joueur ou son appareil demande des animations réduites. */
  function reduit(): boolean {
    return (mouvementReduit?.matches ?? false) || options.animationsReduites === true;
  }

  /**
   * Joue une action : le réalisateur écrit la partition depuis les événements,
   * la peau et le HUD la jouent ensemble, et la promesse tient jusqu'au dernier
   * des deux. Une peau qui ne sait pas encore `jouer` retombe sur `animer`, qui
   * met en scène elle-même : `jeu.ts` marche avec les deux. La caméra n'a le
   * droit de recadrer que pendant le tour de l'adversaire.
   */
  function jouerPartition(evenements: readonly EvenementJeu[], avant: EtatPartie, apres: EtatPartie): Promise<void> {
    if (!vivant) return Promise.resolve();
    const partition = ecrirePartition(evenements, avant, apres, {
      camp, reduit: reduit(), cadrer: attenteIa, ecranCombat: options.ecranCombat !== false,
    });
    partitionEnCours = true;
    const peau = rendu.jouer ? rendu.jouer(partition) : rendu.animer(evenements, avant);
    return Promise.all([
      peau.catch(() => undefined),
      hud?.jouer(partition).catch(() => undefined) ?? Promise.resolve(),
    ]).then(() => {
      partitionEnCours = false;
    });
  }

  /**
   * Un clic pendant une partition la **coupe** (`doc/10` §7.3) : la peau et le
   * HUD sautent à l'état final, les promesses se résolvent, et la suite —
   * scènes, rafraîchissement, tour de l'adversaire — continue. Rend vrai si un
   * clic a servi à couper : il ne vaut alors pas un ordre.
   */
  function couperPartition(): boolean {
    if (!partitionEnCours) return false;
    rendu.couper?.();
    hud?.couper();
    return true;
  }

  function pause(ms: number): Promise<void> {
    return new Promise((resoudreP) => {
      const jeton = setTimeout(() => {
        minuteries.delete(jeton);
        resoudreP();
      }, ms);
      minuteries.add(jeton);
    });
  }

  // -------------------------------------------------------------------------
  // L'adversaire : le même moteur, action par action, regardable
  // -------------------------------------------------------------------------

  async function tourAdversaire(): Promise<void> {
    if (!vivant || etat.partie.terminee || etat.campCourant === camp) return;
    attenteIa = true;
    controleur.attendre(true);
    // La caméra va aller voir ce qui se joue ailleurs (les gestes `cadrer` de
    // la partition) : on retient d'où le joueur regardait pour l'y ramener.
    rendu.retenirVue?.();
    rafraichir();
    let suite = adversaire(etat);
    let garde = 0;
    while (vivant && !etat.partie.terminee && etat.campCourant !== camp && garde < 400) {
      garde += 1;
      const action = suite.shift();
      if (!action) break;
      const avant = etat;
      const r = appliquer(etat, action, cat, commandants);
      if (r.ok) {
        etat = r.etat;
        retenirFin();
        actions.push(action);
        sauvegarder();
        annoncer(r.evenements, avant);
        controleur.poserEtat(etat);
        controleur.attendre(true);
        await jouerPartition(r.evenements, avant, etat);
        if (!vivant) return;
        ouvrirScenes(r.evenements);
        rafraichir();
        await attendreDialogue();
        if (!vivant) return;
        await pause(MS_ENTRE_ACTIONS);
        if (!vivant) return;
      }
      if (suite.length === 0 && !etat.partie.terminee && etat.campCourant !== camp) {
        suite = adversaire(etat);
      }
    }
    if (!vivant) return;
    attenteIa = false;
    controleur.poserEtat(etat);
    controleur.attendre(false);
    // La main revient au joueur : la vue aussi, sauf s'il l'a lui-même déplacée.
    rendu.revenirVue?.();
    if (etat.partie.terminee) effacerSauvegarde(options.scenario.code, cleLocale);
    rafraichir();
  }

  // -------------------------------------------------------------------------
  // Vues
  // -------------------------------------------------------------------------

  function ambianceCourante(): Ambiance {
    return ambianceForcee ?? ambianceDe(etat.climat);
  }

  function visibles(): ReadonlySet<string> | null {
    if (!brouillardActif(etat)) return null;
    return casesVuesPar(etat, cat, camp);
  }

  /**
   * Les unités que le joueur voit, par identifiant : la règle du moteur
   * (`unitesVues`, mémoïsée par état), pas une lecture par case — une furtive
   * hors contact ou une unité tapie en forêt sont sur une case éclairée et
   * pourtant cachées. `null` sans brouillard.
   */
  function unitesVuesIds(): ReadonlySet<string> | null {
    if (!brouillardActif(etat)) return null;
    return new Set(unitesVues(etat, cat, camp).map((u) => u.id));
  }

  /**
   * La vue du contrôleur est un getter qui recompose surbrillances et enveloppe
   * de tir à chaque lecture, et trois lecteurs la demandent par rafraîchissement.
   * Pendant `rafraichir`, elle est calculée une fois et partagée.
   */
  let vueCourante: VueControleur | null = null;
  function vueControleur(): VueControleur {
    return vueCourante ?? controleur.vue;
  }

  function vueInteraction(): VueInteraction {
    const v = vueControleur();
    return {
      catalogue: cat,
      ambiance: ambianceCourante(),
      surbrillances: [...casesObjectifs(etat), ...v.surbrillances],
      chemin: v.chemin,
      cheminAveugle: v.cheminAveugle,
      curseur: v.curseur,
      selection: v.selection,
      visibles: visibles(),
      camp,
      unitesVues: unitesVuesIds(),
      attenteIa,
      etiquetteQg: t('hud.qg'),
    };
  }

  /**
   * Les deux pouvoirs du commandant du joueur, avec le verdict du moteur pour
   * chacun. C'est `verifierPouvoir` qui décide — le HUD n'a pas le commandant,
   * et une seconde règle écrite dans le HUD aurait divergé de la première au
   * premier changement de coût.
   */
  function pouvoirsDuJoueur(): VueJeu['pouvoirs'] {
    const commandant = commandants[camp] ?? null;
    if (!commandant) return null;
    const lire = (niveau: 'normal' | 'super') => {
      const p = niveau === 'super' ? commandant.superPouvoir : commandant.pouvoir;
      return {
        nom: p.nom,
        cout: p.barres * POINTS_PAR_BARRE,
        pret: verifierPouvoir(etat, commandant, camp, niveau).ok,
      };
    };
    return { normal: lire('normal'), super: lire('super') };
  }

  function vueJeu(): VueJeu {
    const v = vueControleur();
    return {
      etat,
      catalogue: cat,
      ambiance: ambianceCourante(),
      locale,
      camp,
      phase: v.phase,
      curseur: v.curseur,
      selection: v.selection,
      cheminAveugle: v.cheminAveugle,
      menu: v.menu,
      production: v.production,
      visee: v.visee,
      unitesVues: unitesVuesIds(),
      attenteIa,
      pouvoirs: pouvoirsDuJoueur(),
      annonce,
      masquerFin: options.finPersonnalisee,
      sceneOuverte: dialogueActif(),
      finEnAttente,
    };
  }

  /** Expose l'état de l'interaction : c'est ce que lisent les tests de fumée. */
  function marquerEtat(): void {
    const v = vueControleur();
    const cible = rendu.canvas ?? conteneur;
    cible.dataset['scenario'] = options.scenario.code;
    cible.dataset['rendu'] = rendu.cle;
    cible.dataset['pret'] = '1';
    cible.dataset['etat'] = v.phase;
    cible.dataset['surbrillances'] = String(v.surbrillances.length);
    cible.dataset['selection'] = v.selection ?? '';
    cible.dataset['inspection'] = v.inspection ?? '';
    cible.dataset['camp'] = String(etat.campCourant);
    cible.dataset['journee'] = String(etat.journee);
    cible.dataset['partie'] = etat.partie.terminee ? 'terminee' : 'en_cours';
    cible.dataset['dialogue'] = dialogueActif() ? 'ouvert' : 'ferme';
    conteneur.dataset['rendu'] = rendu.cle;
  }

  function rafraichir(): void {
    if (!vivant) return;
    vueCourante = controleur.vue;
    try {
      rendu.afficher(etat, vueInteraction());
      hud?.rafraichir();
      sceneHtml?.rafraichir();
      marquerEtat();
      options.surEtat?.(etat);
    } finally {
      vueCourante = null;
    }
  }

  // -------------------------------------------------------------------------
  // HUD et entrées
  // -------------------------------------------------------------------------

  function recommencer(): void {
    for (const m of minuteries) clearTimeout(m);
    minuteries.clear();
    actions = [];
    etat = creerPartie(scene, cat, graine);
    effacerSauvegarde(options.scenario.code, cleLocale);
    attenteIa = false;
    annonce = null;
    finEnAttente = false;
    fileRepliques.length = 0;
    scenesJouees.clear();
    libererAttentes();
    controleur.poserEtat(etat);
    ouvrirOuverture();
    rafraichir();
  }

  const api: ApiHud = {
    vue: vueJeu,
    t,
    finTour: () => {
      if (!attenteIa) controleur.finTour();
    },
    choisirSuite: (id, passager) => controleur.choisirSuite(id, passager),
    choisirProduction: (cle: CleUnite) => controleur.choisirProduction(cle),
    jouerPouvoir: (niveau) => controleur.jouerPouvoir(niveau),
    annuler: () => controleur.annuler(),
    recommencer,
    zoomer: (sens) => rendu.zoomer?.(sens),
    tourner: rendu.tourner ? (sens) => rendu.tourner?.(sens) : undefined,
    recentrer: () => {
      const unite = etat.unites.find(u => u.id === controleur.vue.selection)
        ?? etat.unites.find(u => u.camp === camp && !u.dansTransport);
      if (unite) (rendu.recentrer ?? rendu.cadrer).call(rendu, { x: unite.x, y: unite.y });
    },
    versEcran: (c: Case) => rendu.versEcran(c),
    couper: () => { couperPartition(); },
  };

  if (options.hud !== false) hud = monterHudHtml(conteneur, api);

  const apiDialogue: ApiDialogue = {
    replique: () => fileRepliques[0] ?? null,
    nomLocuteur: (cle) => t(`commandant.${cle}.nom`) || t('hud.commandant'),
    t,
    suivante: () => {
      fileRepliques.shift();
      libererAttentes();
      rafraichir();
    },
    passer: () => {
      fileRepliques.length = 0;
      libererAttentes();
      rafraichir();
    },
  };
  if (avecDialogues) sceneHtml = monterDialogue(conteneur, apiDialogue);

  const debrancher = rendu.brancher({
    // Un clic pendant une partition la coupe, et c'est tout ce qu'il fait.
    surClicCase: (c) => {
      if (couperPartition()) return;
      controleur.clicCase(c);
    },
    surSurvolCase: (c) => {
      if (c) controleur.poserCurseur(c);
    },
    surAnnuler: () => controleur.annuler(),
    surInspecter: (c) => controleur.inspecter(c),
    surTouche: (touche) => {
      if (couperPartition()) return;
      switch (touche) {
        case 'haut': controleur.bougerCurseur(0, -1); break;
        case 'bas': controleur.bougerCurseur(0, 1); break;
        case 'gauche': controleur.bougerCurseur(-1, 0); break;
        case 'droite': controleur.bougerCurseur(1, 0); break;
        case 'valider': controleur.valider(); break;
        case 'annuler': controleur.annuler(); break;
        case 'fin_tour': if (!attenteIa) controleur.finTour(); break;
        default: break;
      }
      rendu.cadrer(controleur.vue.curseur);
      rafraichir();
    },
  });

  /**
   * L'ouverture se joue **une fois la carte cadrée**, jamais avant : le briefing
   * d'Advance Wars se donne sur le terrain, pas sur un écran noir.
   */
  function ouvrirOuverture(): void {
    if (!avecDialogues) return;
    const declaree = sceneOuverture(scenesScenario);
    if (declaree) enfiler(declaree.cle, declaree.repliques);
    else enfiler('ouverture', options.scenario.dialogueOuverture);
  }

  // --- Cadrage de départ : la première unité du joueur.
  const depart = etat.unites.find((u) => u.camp === camp);
  rafraichir();
  if (depart) rendu.cadrer({ x: depart.x, y: depart.y });
  ouvrirOuverture();
  rafraichir();
  if (etat.campCourant !== camp && !etat.partie.terminee) {
    void attendreDialogue().then(() => {
      if (vivant) void tourAdversaire();
    });
  }

  function forcerAmbiance(saison: Saison | null, phase?: PhaseJour, meteo?: Meteo): void {
    ambianceForcee = saison === null
      ? null
      : construireAmbiance(saison, phase ?? 'jour', meteo ?? 'clair');
    rafraichir();
  }

  if (options.debug ?? process.env.NODE_ENV !== 'production') {
    const pont: PontDebug = {
      rendu: rendu.cle,
      positionCase: (x, y) => rendu.versEcran({ x, y }),
      capturer: () => rendu.capturer(),
      msParImage: () => rendu.msParImage(),
      mesurer: () => rendu.mesurer?.() ?? null,
      forcerAmbiance,
      etat: () => ({ journee: etat.journee, camp: etat.campCourant, terminee: etat.partie.terminee }),
      terrain: (x, y) => terrainLogique(etat, cat, { x, y }),
      positionUnite: (id) => rendu.positionUnite?.(id) ?? null,
    };
    (globalThis as unknown as { __atlas?: PontDebug }).__atlas = pont;
  }

  return {
    get etat() { return etat; },
    rendu: rendu.cle,
    /**
     * L'avancement du chargement, lu sur les compteurs de la peau et sur rien
     * d'autre : `backend` reste nul tant que le moteur n'a pas démarré, et
     * `appels` vaut zéro tant qu'aucune image n'a été envoyée au processeur
     * graphique. Une peau qui ne sait pas mesurer répond `pret` : on ne retient
     * pas un écran de chargement sur une ignorance.
     */
    etatChargement: (): EtapeChargement => etapeChargement(rendu.mesurer?.()),
    salir: () => rafraichir(),
    oublierSauvegarde: () => effacerSauvegarde(options.scenario.code, cleLocale),
    forcerAmbiance,
    demonter: () => {
      vivant = false;
      for (const m of minuteries) clearTimeout(m);
      minuteries.clear();
      if (minuterieAnnonce !== null) clearTimeout(minuterieAnnonce);
      minuterieAnnonce = null;
      debrancher();
      hud?.demonter();
      hud = null;
      sceneHtml?.demonter();
      sceneHtml = null;
      fileRepliques.length = 0;
      // Une promesse d'attente laissée en suspens retiendrait le tour d'IA
      // dans une continuation morte : on les libère toutes au démontage.
      const restantes = attentesDialogue;
      attentesDialogue = [];
      for (const resoudreAttente of restantes) resoudreAttente();
      rendu.demonter();
      const g = globalThis as unknown as { __atlas?: PontDebug };
      if (g.__atlas) delete g.__atlas;
    },
  };
}
