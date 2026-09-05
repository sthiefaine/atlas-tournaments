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
 *   n'est qu'un rattrapage visuel, et `rendu.animer()` rend une promesse ;
 * - l'**adversaire joue par le même moteur** que le joueur, action par action ;
 * - la **sauvegarde est une liste d'actions** (`03-schemas.md` §14), dans
 *   `localStorage`, sous `try`/`catch` ;
 * - le **HUD est en HTML** (`hud-html.ts`), partagé par les deux peaux.
 */

import type {
  Action, Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, MotifRefus,
} from '../engine/index';
import {
  appliquer, brouillardActif, casesVisibles as casesVuesPar, chargerCatalogue,
  creerPartie, rejouer, sceneDepuis, terrainLogique, VERSION_MOTEUR,
} from '../engine/index';
import { resoudre, traducteur } from '../i18n/index';
import type {
  CampId, Case, CleUnite, Dialogue, MapDef, Meteo, PhaseJour, Saison, Sauvegarde,
  Scenario,
} from '../schemas/types';
import { ambiance as construireAmbiance, ambianceDe, type Ambiance } from './ambiance';
import { Controleur } from './controleur';
import { monterDialogue, type ApiDialogue, type DialogueHtml } from './dialogue-html';
import {
  filerRepliques, scenesDeclenchees, sceneOuverture, type RepliqueEnAttente,
} from './dialogues';
import { casesObjectifs } from './objectifs';
import { resoudreCommandantsScenario } from '../content/commandants-jeu';
import { monterHudHtml, type ApiHud, type HudHtml, type VueJeu } from './hud-html';
import {
  type CleRendu, type Rendu, type VueInteraction,
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
  /** Expose `window.__atlas` (tests de fumée et mise au point). */
  debug?: boolean;
  /** Informe l'écran de campagne sans lui donner l'autorité sur les règles. */
  surEtat?: (etat: EtatPartie) => void;
  finPersonnalisee?: boolean;
}

/** Ce que rend `monterJeu` : de quoi observer, piloter et démonter. */
export interface Jeu {
  /** L'état courant de la partie. */
  readonly etat: EtatPartie;
  /** La peau réellement montée. */
  readonly rendu: CleRendu;
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

/** La clé de sauvegarde d'un scénario. */
export function cleSauvegarde(scenarioCle: string): string {
  return `${PREFIXE_SAUVEGARDE}${scenarioCle}`;
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

/** Lit la sauvegarde d'un scénario, ou `null`. */
export function lireSauvegarde(scenarioCle: string): (Sauvegarde & { actions: Action[] }) | null {
  const s = stockage();
  if (!s) return null;
  try {
    const brut = s.getItem(cleSauvegarde(scenarioCle));
    if (!brut) return null;
    const valeur = JSON.parse(brut) as Sauvegarde & { actions: Action[] };
    if (typeof valeur?.scenarioCle !== 'string' || !Array.isArray(valeur.actions)) return null;
    return valeur;
  } catch {
    return null;
  }
}

/** Écrit la sauvegarde d'un scénario. Un échec est silencieux : on joue quand même. */
export function ecrireSauvegarde(sauvegarde: Sauvegarde): void {
  const s = stockage();
  if (!s) return;
  try {
    s.setItem(cleSauvegarde(sauvegarde.scenarioCle), JSON.stringify(sauvegarde));
  } catch {
    // Quota plein ou stockage refusé : la partie continue, sans reprise.
  }
}

/** Efface la sauvegarde d'un scénario. */
export function effacerSauvegarde(scenarioCle: string): void {
  const s = stockage();
  if (!s) return;
  try {
    s.removeItem(cleSauvegarde(scenarioCle));
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
  forcerAmbiance(saison: Saison | null, phase?: PhaseJour, meteo?: Meteo): void;
  etat(): { journee: number; camp: number; terminee: boolean };
  /**
   * Le terrain **tel que le rendu le lit** sur une case. Une mécanique régionale
   * réinterprète la carte sans l'écrire : c'est la seule façon de vérifier de
   * l'extérieur qu'une marée est bien arrivée jusqu'à l'image.
   */
  terrain(x: number, y: number): string | null;
}

/**
 * Monte une partie dans un conteneur et rend de quoi la démonter. Tout le cycle
 * de vie est ici : peau, contrôleur, HUD HTML, adversaire, sauvegarde.
 */
export function monterJeu(conteneur: HTMLElement, options: OptionsJeu): Jeu {
  const cat = options.catalogue ?? chargerCatalogue(options.scenario.catalogueVersion);
  const locale = options.locale ?? 'fr';
  const t = traducteur(locale);
  const camp: CampId = options.camp ?? 0;
  const graine = options.graine ?? `${options.scenario.code}:1`;
  const commandants = options.commandants ?? commandantsDuScenario(options.scenario);
  const scene = sceneDepuis(options.scenario, options.carte, commandants);
  const adversaire: Adversaire = options.adversaire ?? ADVERSAIRE_PASSIF;

  // --- État initial : partie neuve, ou reprise de la sauvegarde locale.
  let actions: Action[] = [];
  let etat = creerPartie(scene, cat, graine);
  if (options.reprendre) {
    const sauvegarde = lireSauvegarde(options.scenario.code);
    if (sauvegarde && sauvegarde.graine === graine && sauvegarde.catalogueVersion === cat.version && sauvegarde.engineVersion === VERSION_MOTEUR) {
      const r = rejouer(scene, cat, { ...sauvegarde, actions: sauvegarde.actions }, commandants);
      etat = r.etat;
      actions = [...sauvegarde.actions];
    }
  }

  // --- La peau. Il n'y en a plus qu'une, et `render/` n'a pas le droit
  //     d'importer `render3d/` (`02-architecture.md` §5) : c'est donc l'appelant
  //     qui la fabrique. S'il n'en fournit pas, ou si elle refuse de se monter,
  //     on **lève** — un appareil sans WebGL 2 doit l'apprendre par un écran qui
  //     le dit, pas par un plateau vide.
  if (!options.fabriqueRendu) throw new Error('aucune fabrique de rendu fournie');
  const rendu: Rendu = options.fabriqueRendu('3d');
  rendu.monter(conteneur);

  if (conteneur.style.position === '') conteneur.style.position = 'relative';

  let annonce: string | null = null;
  let minuterieAnnonce: ReturnType<typeof setTimeout> | null = null;
  let attenteIa = false;
  let vivant = true;
  let ambianceForcee: Ambiance | null = null;
  let hud: HudHtml | null = null;
  let sceneHtml: DialogueHtml | null = null;
  const minuteries = new Set<ReturnType<typeof setTimeout>>();

  // --- Dialogues : une file de répliques, et le registre des scènes déjà dites.
  const avecDialogues = options.dialogues === true;
  const scenesScenario = options.scenario.scenesDialogue ?? [];
  const fileRepliques: RepliqueEnAttente[] = [];
  const scenesJouees = new Set<string>();
  let attentesDialogue: (() => void)[] = [];

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
        sauvegarder();
        annoncer(evenements);
        void jouerAnimations(evenements, avant).then(async () => {
          if (!vivant) return;
          ouvrirScenes(evenements);
          rafraichir();
          await attendreDialogue();
          if (!vivant) return;
          if (apres.partie.terminee) effacerSauvegarde(options.scenario.code);
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

  /** Ouvre les scènes que la dernière action vient de déclencher. */
  function ouvrirScenes(evenements: readonly EvenementJeu[]): void {
    if (!avecDialogues) return;
    for (const s of scenesDeclenchees(scenesScenario, scenesJouees, {
      etat, evenements, camp,
    })) enfiler(s.cle, s.repliques);
    if (etat.partie.terminee) {
      const gagne = etat.partie.vainqueur === camp && !etat.partie.nul;
      enfiler('fin', gagne ? options.scenario.dialogueVictoire : options.scenario.dialogueDefaite);
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
    });
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
   */
  function annoncer(evenements: readonly EvenementJeu[]): void {
    for (const e of evenements) {
      if (e.type === 'capture' && e.acquis) {
        const terrain = terrainLogique(etat, cat, e.case);
        poserAnnonce(t(CLE_PRISE[terrain ?? ''] ?? 'combat.ville_capturee'));
      }
    }
  }

  function jouerAnimations(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
    if (!vivant) return Promise.resolve();
    return rendu.animer(evenements, avant).catch(() => undefined);
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
        actions.push(action);
        sauvegarder();
        annoncer(r.evenements);
        controleur.poserEtat(etat);
        controleur.attendre(true);
        await jouerAnimations(r.evenements, avant);
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
    if (etat.partie.terminee) effacerSauvegarde(options.scenario.code);
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

  function vueInteraction(): VueInteraction {
    const v = controleur.vue;
    return {
      catalogue: cat,
      ambiance: ambianceCourante(),
      surbrillances: [...casesObjectifs(etat), ...v.surbrillances],
      chemin: v.chemin,
      curseur: v.curseur,
      selection: v.selection,
      visibles: visibles(),
      attenteIa,
      etiquetteQg: t('hud.qg'),
    };
  }

  function vueJeu(): VueJeu {
    const v = controleur.vue;
    return {
      etat,
      catalogue: cat,
      ambiance: ambianceCourante(),
      locale,
      camp,
      phase: v.phase,
      curseur: v.curseur,
      selection: v.selection,
      menu: v.menu,
      production: v.production,
      visee: v.visee,
      attenteIa,
      annonce,
      masquerFin: options.finPersonnalisee,
      sceneOuverte: dialogueActif(),
    };
  }

  /** Expose l'état de l'interaction : c'est ce que lisent les tests de fumée. */
  function marquerEtat(): void {
    const v = controleur.vue;
    const cible = rendu.canvas ?? conteneur;
    cible.dataset['scenario'] = options.scenario.code;
    cible.dataset['rendu'] = rendu.cle;
    cible.dataset['pret'] = '1';
    cible.dataset['etat'] = v.phase;
    cible.dataset['surbrillances'] = String(v.surbrillances.length);
    cible.dataset['selection'] = v.selection ?? '';
    cible.dataset['camp'] = String(etat.campCourant);
    cible.dataset['journee'] = String(etat.journee);
    cible.dataset['partie'] = etat.partie.terminee ? 'terminee' : 'en_cours';
    cible.dataset['dialogue'] = dialogueActif() ? 'ouvert' : 'ferme';
    conteneur.dataset['rendu'] = rendu.cle;
  }

  function rafraichir(): void {
    if (!vivant) return;
    rendu.afficher(etat, vueInteraction());
    hud?.rafraichir();
    sceneHtml?.rafraichir();
    marquerEtat();
    options.surEtat?.(etat);
  }

  // -------------------------------------------------------------------------
  // HUD et entrées
  // -------------------------------------------------------------------------

  function recommencer(): void {
    for (const m of minuteries) clearTimeout(m);
    minuteries.clear();
    actions = [];
    etat = creerPartie(scene, cat, graine);
    effacerSauvegarde(options.scenario.code);
    attenteIa = false;
    annonce = null;
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
    choisirSuite: (id) => controleur.choisirSuite(id),
    choisirProduction: (cle: CleUnite) => controleur.choisirProduction(cle),
    jouerPouvoir: (niveau) => controleur.jouerPouvoir(niveau),
    annuler: () => controleur.annuler(),
    recommencer,
    zoomer: (sens) => rendu.zoomer?.(sens),
    recentrer: () => {
      const unite = etat.unites.find(u => u.id === controleur.vue.selection)
        ?? etat.unites.find(u => u.camp === camp && !u.dansTransport);
      if (unite) (rendu.recentrer ?? rendu.cadrer).call(rendu, { x: unite.x, y: unite.y });
    },
    versEcran: (c: Case) => rendu.versEcran(c),
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
    surClicCase: (c) => controleur.clicCase(c),
    surSurvolCase: (c) => {
      if (c) controleur.poserCurseur(c);
    },
    surAnnuler: () => controleur.annuler(),
    surTouche: (touche) => {
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
      forcerAmbiance,
      etat: () => ({ journee: etat.journee, camp: etat.campCourant, terminee: etat.partie.terminee }),
      terrain: (x, y) => terrainLogique(etat, cat, { x, y }),
    };
    (globalThis as unknown as { __atlas?: PontDebug }).__atlas = pont;
  }

  return {
    get etat() { return etat; },
    rendu: rendu.cle,
    salir: () => rafraichir(),
    oublierSauvegarde: () => effacerSauvegarde(options.scenario.code),
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
