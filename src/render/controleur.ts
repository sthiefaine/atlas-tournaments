/**
 * Le contrôleur : la machine à états de l'interaction.
 *
 *     inactif → sélection → chemin → action → (cible) → confirmation
 *
 * À côté de ces phases, l'**inspection** : un double-clic ou un appui long sur
 * une unité adverse visible allume ses déplacements et son enveloppe de tir,
 * sans toucher à la partie. Elle se referme au clic suivant ou à Échap.
 *
 * Deux règles fermes, qui font tenir toute l'architecture (`02-architecture.md`
 * §3.4) :
 *
 * - le contrôleur **ne mute jamais l'état** : il construit une `Action` et la
 *   passe à `appliquer`, qui rend un nouvel état ;
 * - il ne parle au moteur **que** par l'API publique : `portee`, `cheminVers`,
 *   `ciblesDepuis`, `appliquer`. Aucune règle n'est réécrite ici.
 *
 * Rien dans ce fichier ne touche au DOM : c'est ce qui le rend testable avec un
 * vrai état de partie.
 */

import type {
  Action, Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, MotifRefus, Portee, Suite, Unite,
} from '../engine/index';
import {
  appliquer, arriveeLibre, casesAtteignables, cheminVers, ciblesDepuis, cleCase,
  depuisCle, estDesaffecte, manhattan, peutCapturerIci, porte, portee, produitesPar, terrainLogique, uniteParId,
  uniteSur, unitesVues, verifierProduction, constructionsPossibles,
} from '../engine/index';
import type { Case, CampId, CleUnite } from '../schemas/types';
import type { OptionMenu } from './libelles';
import type { Surbrillance } from './surbrillance';

/** Les phases de l'interaction. */
export type Phase =
  | 'inactif' | 'selection' | 'action' | 'cible' | 'production' | 'attente' | 'fin';

/** Les suites proposables au joueur, dans l'ordre d'affichage du menu. */
export const SUITES_MENU = [
  'attaquer', 'capturer', 'remettre', 'fusionner', 'embarquer', 'debarquer', 'ravitailler', 'construire', 'attendre',
] as const;
/** Identifiant d'une entrée du menu d'actions. */
export type IdSuite = typeof SUITES_MENU[number];

/** Clé de chaîne d'une entrée de menu : jamais un texte, toujours une clé. */
const CLE_MENU: Record<IdSuite, string> = {
  attaquer: 'hud.attaquer',
  capturer: 'hud.capturer',
  remettre: 'hud.remettre',
  fusionner: 'hud.fusionner',
  embarquer: 'hud.embarquer',
  debarquer: 'hud.debarquer',
  ravitailler: 'hud.ravitailler',
  attendre: 'hud.attendre',
  construire: 'hud.construire',
};

/** Ce que le contrôleur expose au rendu : sa vue, jamais son état interne. */
export interface VueControleur {
  phase: Phase;
  curseur: Case;
  selection: string | null;
  chemin: Case[];
  surbrillances: Surbrillance[];
  menu: { ancre: Case; options: OptionMenu[] } | null;
  production: { batiment: Case; unites: CleUnite[] } | null;
  /**
   * La visée en cours : l'unité qui tire, la case d'où elle tirerait et les
   * cases visables. Le HUD s'en sert pour prévoir le duel avant confirmation ;
   * `null` hors phase `cible`, ou quand la phase vise des travaux.
   */
  visee: { attaquantId: string; depuis: Case; cibles: Case[]; cible: Case | null } | null;
  /**
   * L'unité adverse **inspectée** — double-clic ou appui long sur elle. Ses
   * déplacements et son enveloppe de tir sont dans `surbrillances`, en `danger`
   * et `attaque` ; le curseur reste posé dessus tant qu'elle est inspectée, de
   * sorte que le panneau d'unité continue de la montrer.
   */
  inspection: string | null;
}

/** Ce que le contrôleur signale à son hôte. */
export interface EcouteurControleur {
  /** Une action a été acceptée par le moteur. */
  surAction?(action: Action, evenements: EvenementJeu[], avant: EtatPartie, apres: EtatPartie): void;
  /** Une action a été refusée : le HUD en fait une annonce, jamais une exception. */
  surRefus?(action: Action, motif: MotifRefus): void;
  /** La vue a changé : la scène est à salir. */
  surChangement?(): void;
}

/** Réglages du contrôleur. */
export interface OptionsControleur {
  etat: EtatPartie;
  catalogue: Catalogue;
  /** Camp du joueur humain : le contrôleur ne joue jamais pour un autre. */
  camp: CampId;
  commandants?: (CommandantMoteur | null)[];
  ecouteur?: EcouteurControleur;
}

/** La machine à états de l'interaction. */
export class Controleur {
  private etatPartie: EtatPartie;

  private readonly cat: Catalogue;

  private readonly camp: CampId;

  private readonly commandants: (CommandantMoteur | null)[];

  private readonly ecouteur: EcouteurControleur;

  private phaseCourante: Phase = 'inactif';

  private curseurCase: Case = { x: 0, y: 0 };

  private selectionId: string | null = null;

  private cheminCourant: Case[] = [];

  private cibles: Unite[] = [];
  private travaux: Case[] = [];

  private options: IdSuite[] = [];

  private batimentProduction: Case | null = null;

  /**
   * La cible **pointée** en phase de visée. À la souris, le survol la pose, donc
   * un clic confirme du premier coup. Au doigt il n'y a pas de survol : le
   * premier appui vise et fait apparaître la prévision, le second confirme. Sans
   * elle, une attaque au doigt partait toujours à l'aveugle.
   */
  private cibleVisee: Case | null = null;

  /** L'unité adverse inspectée, hors de toute phase : l'inspection ne joue rien. */
  private inspectionId: string | null = null;

  /**
   * Vrai juste après qu'un clic a joué un ordre. Un double-clic qui **confirme**
   * une attaque arrive au contrôleur comme deux clics puis une demande
   * d'inspection : sans ce témoin, confirmer un tir ouvrirait l'inspection de
   * la cible qui vient d'être frappée.
   */
  private venaitDeJouer = false;

  private cacheAtteignables: {
    etat: EtatPartie; uniteId: string; portee: Portee; cases: ReadonlySet<string>;
  } | null = null;

  /** L'enveloppe de tir, mémoïsée comme les atteignables : la vue la relit trois fois par survol. */
  private cacheEnveloppe: {
    etat: EtatPartie; uniteId: string; atteignables: ReadonlySet<string>; cases: Case[];
  } | null = null;

  constructor(o: OptionsControleur) {
    this.etatPartie = o.etat;
    this.cat = o.catalogue;
    this.camp = o.camp;
    this.commandants = o.commandants ?? [];
    this.ecouteur = o.ecouteur ?? {};
    const premiere = o.etat.unites.find((u) => u.camp === o.camp);
    if (premiere) this.curseurCase = { x: premiere.x, y: premiere.y };
    if (o.etat.partie.terminee) this.phaseCourante = 'fin';
  }

  /** L'état courant. Lecture seule : personne ne le mute, pas même le contrôleur. */
  get etat(): EtatPartie {
    return this.etatPartie;
  }

  /** La phase courante. */
  get phase(): Phase {
    return this.phaseCourante;
  }

  /** Vrai quand c'est au joueur de donner des ordres. */
  get monTour(): boolean {
    return this.etatPartie.campCourant === this.camp && !this.etatPartie.partie.terminee;
  }

  /** Remplace l'état : c'est l'hôte qui le fait après un tour d'IA ou un rejeu. */
  poserEtat(etat: EtatPartie): void {
    this.etatPartie = etat;
    this.reinitialiser();
    if (etat.partie.terminee) this.phaseCourante = 'fin';
    this.ecouteur.surChangement?.();
  }

  /** Verrouille l'interaction pendant qu'une animation ou l'IA se joue. */
  attendre(actif: boolean): void {
    if (this.etatPartie.partie.terminee) {
      this.phaseCourante = 'fin';
      return;
    }
    this.phaseCourante = actif ? 'attente' : 'inactif';
    if (actif) this.reinitialiserSelection();
    this.ecouteur.surChangement?.();
  }

  /** La vue à dessiner. */
  get vue(): VueControleur {
    return {
      phase: this.phaseCourante,
      curseur: this.curseurCase,
      selection: this.selectionId,
      chemin: this.cheminCourant,
      surbrillances: this.surbrillances(),
      menu: this.phaseCourante === 'action' && this.options.length > 0
        ? {
          ancre: this.arrivee(),
          options: this.options.map((id): OptionMenu => ({ id, cle: CLE_MENU[id], disponible: true })),
        }
        : null,
      production: this.phaseCourante === 'production' && this.batimentProduction
        ? { batiment: this.batimentProduction, unites: this.unitesProduisibles(this.batimentProduction) }
        : null,
      visee: this.phaseCourante === 'cible' && this.cibles.length > 0 && this.selectionId !== null
        ? {
          attaquantId: this.selectionId,
          depuis: this.arrivee(),
          cibles: this.cibles.map((u) => ({ x: u.x, y: u.y })),
          cible: this.cibleVisee,
        }
        : null,
      inspection: this.inspectionId,
    };
  }

  // -------------------------------------------------------------------------
  // Entrées
  // -------------------------------------------------------------------------

  /** Déplace le curseur d'une case, sans rien choisir. */
  bougerCurseur(dx: number, dy: number): void {
    // Quitter l'unité inspectée au clavier, c'est cesser de l'inspecter.
    this.inspectionId = null;
    const c = {
      x: Math.max(0, Math.min(this.etatPartie.largeur - 1, this.curseurCase.x + dx)),
      y: Math.max(0, Math.min(this.etatPartie.hauteur - 1, this.curseurCase.y + dy)),
    };
    this.curseurCase = c;
    if (this.phaseCourante === 'selection') this.majChemin(c);
    this.ecouteur.surChangement?.();
  }

  /** Pose le curseur sur une case (souris, survol). */
  poserCurseur(c: Case): void {
    if (!this.dansCarte(c)) return;
    // Pendant une inspection, le survol ne déplace pas le curseur : c'est lui qui
    // dit au HUD quelle unité montrer, et la fiche doit rester celle qu'on inspecte.
    if (this.inspectionId !== null) return;
    if (c.x === this.curseurCase.x && c.y === this.curseurCase.y) return;
    this.curseurCase = c;
    if (this.phaseCourante === 'selection') this.majChemin(c);
    // Survoler une cible, c'est déjà la pointer : le clic qui suit confirme.
    if (this.phaseCourante === 'cible' && this.cibles.some((u) => u.x === c.x && u.y === c.y)) {
      this.cibleVisee = { x: c.x, y: c.y };
    }
    this.ecouteur.surChangement?.();
  }

  /** Le geste principal sur une case : sélectionner, viser, valider. */
  clicCase(c: Case): void {
    if (!this.dansCarte(c) || this.phaseCourante === 'attente' || this.phaseCourante === 'fin') return;
    this.venaitDeJouer = false;
    // Un clic n'importe où referme l'inspection, puis fait son travail habituel.
    this.inspectionId = null;
    this.curseurCase = c;

    if (this.phaseCourante === 'cible' && this.travaux.length > 0) {
      if (this.travaux.some((v) => v.x === c.x && v.y === c.y)) this.jouerOrdre({ type: 'construire', cible: c });
      else this.annuler();
      return;
    }
    if (this.phaseCourante === 'cible') {
      const cible = this.cibles.find((u) => u.x === c.x && u.y === c.y);
      if (!cible) {
        this.annuler();
        return;
      }
      // Deux temps : le premier appui pointe et montre la prévision, le second
      // confirme. À la souris, le survol a déjà pointé, donc un clic suffit.
      if (this.cibleVisee && this.cibleVisee.x === c.x && this.cibleVisee.y === c.y) {
        this.jouerOrdre({ type: 'attaquer', cible: { x: cible.x, y: cible.y } });
        return;
      }
      this.cibleVisee = { x: cible.x, y: cible.y };
      this.ecouteur.surChangement?.();
      return;
    }

    if (this.phaseCourante === 'production') {
      this.annuler();
      return;
    }

    if (this.phaseCourante === 'action') {
      // Un clic hors du menu revient au choix de destination.
      this.phaseCourante = 'selection';
      this.majChemin(c);
      this.ecouteur.surChangement?.();
      return;
    }

    if (this.phaseCourante === 'selection') {
      const atteignables = this.atteignables();
      if (atteignables.has(cleCase(c))) {
        this.majChemin(c);
        this.ouvrirMenu();
        return;
      }
      this.annuler();
      return;
    }

    this.selectionnerSous(c);
  }

  /**
   * Inspecte l'unité adverse sous une case : double-clic à la souris, appui long
   * au doigt. Rend vrai si une inspection s'est ouverte — l'hôte s'en sert pour
   * qu'un appui long qui inspecte n'annule pas en plus. Sur une unité amie ou
   * une case vide, rien ne change : les clics qui précédaient ont déjà agi.
   */
  inspecter(c: Case): boolean {
    if (this.venaitDeJouer) {
      this.venaitDeJouer = false;
      return false;
    }
    if (!this.dansCarte(c) || this.phaseCourante === 'attente' || this.phaseCourante === 'fin') return false;
    const u = uniteSur(this.etatPartie, c);
    if (!u || u.camp === this.camp) return false;
    // Sous brouillard, on n'inspecte que ce qu'on voit : `uniteSur` lit l'état
    // entier, et la portée d'une unité cachée dirait où elle est.
    if (!unitesVues(this.etatPartie, this.cat, this.camp).some((v) => v.id === u.id)) return false;
    this.reinitialiserSelection();
    this.inspectionId = u.id;
    this.curseurCase = { x: u.x, y: u.y };
    this.ecouteur.surChangement?.();
    return true;
  }

  /** Le geste secondaire (clic droit, appui long, Échap) : annuler d'un cran. */
  annuler(): void {
    if (this.inspectionId !== null) {
      this.inspectionId = null;
      this.ecouteur.surChangement?.();
      return;
    }
    if (this.phaseCourante === 'cible' || this.phaseCourante === 'action') {
      this.phaseCourante = 'selection';
      this.cibles = [];
      this.cibleVisee = null;
      this.travaux = [];
      this.options = [];
      const u = this.uniteSelectionnee();
      if (u) this.cheminCourant = [{ x: u.x, y: u.y }];
      this.ecouteur.surChangement?.();
      return;
    }
    this.reinitialiserSelection();
    this.ecouteur.surChangement?.();
  }

  /** La touche « valider » : sélectionne, ou confirme la première suite du menu. */
  valider(): void {
    if (this.phaseCourante === 'action') {
      const premiere = this.options[0];
      if (premiere) this.choisirSuite(premiere);
      return;
    }
    this.clicCase(this.curseurCase);
  }

  /** Choisit une entrée du menu d'actions. */
  choisirSuite(id: string): void {
    const suite = SUITES_MENU.find((s) => s === id);
    if (!suite || this.phaseCourante !== 'action') return;
    const u = this.uniteSelectionnee();
    if (!u) return;
    const arrivee = this.arrivee();

    switch (suite) {
      case 'attendre':
        this.jouerOrdre({ type: 'rien' });
        return;
      case 'capturer':
      case 'remettre':
        // Remettre en service est une capture pour le moteur : même suite, mêmes
        // points. Seul le libellé change, parce que le joueur ne « capture » pas
        // un bâtiment qui n'appartient à personne.
        this.jouerOrdre({ type: 'capturer' });
        return;
      case 'attaquer': {
        this.cibles = ciblesDepuis(this.etatPartie, this.cat, u, arrivee, this.aBouge());
        if (this.cibles.length === 0) return;
        // Même face à une cible unique, on passe par la phase de visée : c'est
        // là que le HUD montre la prévision du duel, et une attaque qui part
        // sans que le joueur ait vu ce qu'elle coûte est un pari, pas un ordre.
        this.phaseCourante = 'cible';
        this.cibleVisee = { x: this.cibles[0]!.x, y: this.cibles[0]!.y };
        this.curseurCase = { ...this.cibleVisee };
        this.ecouteur.surChangement?.();
        return;
      }
      case 'fusionner': {
        const ami = this.voisinFusionnable(u, arrivee);
        if (ami) this.jouerOrdre({ type: 'fusionner', avec: ami.id });
        return;
      }
      case 'embarquer': {
        const transport = this.transportVoisin(u, arrivee);
        if (transport) this.jouerOrdre({ type: 'embarquer', transport: transport.id });
        return;
      }
      case 'debarquer': {
        const vers = this.caseDebarquement(u, arrivee);
        if (vers) this.jouerOrdre({ type: 'debarquer', vers });
        return;
      }
      case 'construire': {
        this.cibles = [];
        this.travaux = constructionsPossibles(this.etatPartie, this.cat, { ...u, ...arrivee });
        this.phaseCourante = 'cible';
        this.ecouteur.surChangement?.();
        return;
      }
      case 'ravitailler': {
        const ami = this.voisinRavitaillable(u, arrivee);
        if (ami) this.jouerOrdre({ type: 'ravitailler', cible: { x: ami.x, y: ami.y } });
        return;
      }
      default:
        return;
    }
  }

  /** Ouvre le menu de production d'un bâtiment possédé et libre. */
  ouvrirProduction(c: Case): boolean {
    if (!this.monTour) return false;
    const unites = this.unitesProduisibles(c);
    if (unites.length === 0) return false;
    this.reinitialiserSelection();
    this.batimentProduction = c;
    this.phaseCourante = 'production';
    this.ecouteur.surChangement?.();
    return true;
  }

  /** Produit une unité depuis le menu de production. */
  choisirProduction(cle: CleUnite): void {
    const batiment = this.batimentProduction;
    if (!batiment || this.phaseCourante !== 'production') return;
    this.jouer({ type: 'produire', batiment, unite: cle });
  }

  /** Déclenche un pouvoir de commandant. */
  jouerPouvoir(niveau: 'normal' | 'super'): void {
    if (!this.monTour) return;
    this.jouer({ type: 'pouvoir', niveau });
  }

  /** Termine le tour du joueur. */
  finTour(): void {
    if (!this.monTour) return;
    this.reinitialiserSelection();
    this.jouer({ type: 'finTour' });
  }

  // -------------------------------------------------------------------------
  // Lectures : tout passe par l'API publique du moteur
  // -------------------------------------------------------------------------

  /** Les surbrillances de la phase courante. */
  private surbrillances(): Surbrillance[] {
    const sortie: Surbrillance[] = [];
    if (this.phaseCourante === 'cible') {
      for (const c of this.travaux) sortie.push({ case: c, genre: 'production' });
      for (const c of this.cibles) sortie.push({ case: { x: c.x, y: c.y }, genre: 'attaque' });
      return sortie;
    }
    if (this.phaseCourante === 'production' && this.batimentProduction) {
      sortie.push({ case: this.batimentProduction, genre: 'production' });
      return sortie;
    }
    const inspectee = this.inspectionId === null ? undefined : uniteParId(this.etatPartie, this.inspectionId);
    if (inspectee) {
      // L'inspection d'Advance Wars : où l'adversaire peut aller, et d'où il peut
      // frapper. Ses arrivées sont un danger, pas une destination — le vert
      // resterait lu comme « j'y vais ».
      const atteignables = this.atteignablesDe(inspectee);
      for (const k of atteignables) sortie.push({ case: depuisCle(k), genre: 'danger' });
      for (const c of this.porteeAttaque(inspectee, atteignables)) sortie.push({ case: c, genre: 'attaque' });
      return sortie;
    }
    if (this.phaseCourante !== 'selection' && this.phaseCourante !== 'action') return sortie;
    const u = this.uniteSelectionnee();
    if (!u) return sortie;
    const atteignables = this.atteignables();
    for (const k of atteignables) {
      sortie.push({ case: depuisCle(k), genre: 'deplacement' });
    }
    // Le rouge dit « je peux frapper là », le vert « je peux aller là ». Une case
    // qui est les deux reste verte : on la lit d'abord comme une destination.
    for (const c of this.porteeAttaque(u, atteignables)) {
      sortie.push({ case: c, genre: 'attaque' });
    }
    return sortie;
  }

  /**
   * L'enveloppe de tir de l'unité sélectionnée : toutes les cases qu'elle
   * pourrait frapper ce tour-ci, **privées** de celles où elle peut aller.
   *
   * Une pièce indirecte qui ne tire pas après mouvement ne menace que depuis sa
   * case actuelle : afficher l'enveloppe de tous ses points de chute mentirait.
   */
  private porteeAttaque(u: Unite, atteignables: ReadonlySet<string>): Case[] {
    const cache = this.cacheEnveloppe;
    if (cache && cache.etat === this.etatPartie && cache.uniteId === u.id && cache.atteignables === atteignables) {
      return cache.cases;
    }
    const cases = this.calculerEnveloppe(u, atteignables);
    this.cacheEnveloppe = { etat: this.etatPartie, uniteId: u.id, atteignables, cases };
    return cases;
  }

  private calculerEnveloppe(u: Unite, atteignables: ReadonlySet<string>): Case[] {
    const type = this.cat.unites[u.type];
    if (!type) return [];
    if (Object.keys(type.degats).length === 0) return [];
    const [min, max] = type.portee;
    if (max <= 0) return [];
    const departs = type.peutTirerApresMouvement
      ? [...atteignables].map(depuisCle)
      : [{ x: u.x, y: u.y }];
    // Garde-fou : une enveloppe se recalcule à chaque survol. Au-delà, on se
    // rabat sur la case de départ, qui reste l'information la plus utile.
    const trop = departs.length * (2 * max * (max + 1) + 1) > 6000;
    const sources = trop ? [{ x: u.x, y: u.y }] : departs;
    const vues = new Map<string, Case>();
    for (const d of sources) {
      for (let dx = -max; dx <= max; dx += 1) {
        const reste = max - Math.abs(dx);
        for (let dy = -reste; dy <= reste; dy += 1) {
          const distance = Math.abs(dx) + Math.abs(dy);
          if (distance < min || distance > max) continue;
          const c = { x: d.x + dx, y: d.y + dy };
          if (!this.dansCarte(c)) continue;
          const k = cleCase(c);
          if (atteignables.has(k)) continue;
          vues.set(k, c);
        }
      }
    }
    return [...vues.values()];
  }

  /** Cases atteignables par l'unité sélectionnée, arrivée libre comprise. */
  private atteignables(): ReadonlySet<string> {
    const u = this.uniteSelectionnee();
    return u ? this.atteignablesDe(u) : new Set<string>();
  }

  /**
   * Cases atteignables par une unité, arrivée libre comprise. Elle peut avoir
   * déjà agi : une inspection montre ce qu'elle pourra faire, pas ce qu'il lui
   * reste à faire ce tour-ci.
   *
   * Mémoïsé sur (état, unité) : la vue le demande à chaque survol, et
   * l'enveloppe de tir le redemande derrière. Le cache tombe dès que l'état
   * change — c'est une identité de référence, jamais une comparaison profonde.
   */
  private atteignablesDe(u: Unite): ReadonlySet<string> {
    return this.deplacementDe(u).cases;
  }

  /**
   * Le calcul de mouvement d'une unité — la portée du moteur et les arrivées
   * libres qui en découlent —, fait **une fois** par (état, unité). Le chemin
   * du survol lit la même portée : sans ce partage, chaque case survolée
   * rejouait le Dijkstra entier.
   */
  private deplacementDe(u: Unite): { portee: Portee; cases: ReadonlySet<string> } {
    const cache = this.cacheAtteignables;
    if (cache && cache.etat === this.etatPartie && cache.uniteId === u.id) return cache;
    const sortie = new Set<string>();
    const p = portee(this.etatPartie, this.cat, u);
    for (const c of casesAtteignables(p)) {
      if (arriveeLibre(this.etatPartie, c, u.id)) sortie.add(cleCase(c));
    }
    sortie.add(cleCase({ x: u.x, y: u.y }));
    this.cacheAtteignables = { etat: this.etatPartie, uniteId: u.id, portee: p, cases: sortie };
    return this.cacheAtteignables;
  }

  /** L'unité sélectionnée, ou `undefined`. */
  private uniteSelectionnee(): Unite | undefined {
    return this.selectionId === null ? undefined : uniteParId(this.etatPartie, this.selectionId);
  }

  /** La case d'arrivée du chemin courant. */
  private arrivee(): Case {
    const fin = this.cheminCourant[this.cheminCourant.length - 1];
    if (fin) return fin;
    const u = this.uniteSelectionnee();
    return u ? { x: u.x, y: u.y } : this.curseurCase;
  }

  /** Vrai si le chemin courant fait effectivement bouger l'unité. */
  private aBouge(): boolean {
    const u = this.uniteSelectionnee();
    if (!u) return false;
    const a = this.arrivee();
    return a.x !== u.x || a.y !== u.y;
  }

  private dansCarte(c: Case): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.etatPartie.largeur && c.y < this.etatPartie.hauteur;
  }

  /** Sélectionne l'unité sous une case, ou ouvre la production d'un bâtiment. */
  private selectionnerSous(c: Case): void {
    const u = uniteSur(this.etatPartie, c);
    if (u && u.camp === this.camp && u.etat === 'prete' && this.monTour) {
      this.selectionId = u.id;
      this.cheminCourant = [{ x: u.x, y: u.y }];
      this.phaseCourante = 'selection';
      this.ecouteur.surChangement?.();
      return;
    }
    if (!u && this.ouvrirProduction(c)) return;
    this.reinitialiserSelection();
    this.ecouteur.surChangement?.();
  }

  /** Recalcule le chemin vers une case atteignable. */
  private majChemin(c: Case): void {
    const u = this.uniteSelectionnee();
    if (!u) return;
    const { portee: p, cases } = this.deplacementDe(u);
    if (!cases.has(cleCase(c))) return;
    const chemin = cheminVers(p, { x: u.x, y: u.y }, c);
    this.cheminCourant = chemin ?? [{ x: u.x, y: u.y }];
  }

  /** Ouvre le menu des suites possibles à l'arrivée. */
  private ouvrirMenu(): void {
    const u = this.uniteSelectionnee();
    if (!u) return;
    this.options = this.suitesPossibles(u, this.arrivee());
    this.phaseCourante = 'action';
    this.ecouteur.surChangement?.();
  }

  /** Les suites que le joueur peut légalement demander depuis l'arrivée. */
  private suitesPossibles(u: Unite, arrivee: Case): IdSuite[] {
    const sortie: IdSuite[] = [];
    const type = this.cat.unites[u.type];
    if (!type) return ['attendre'];
    const aBouge = arrivee.x !== u.x || arrivee.y !== u.y;

    if (ciblesDepuis(this.etatPartie, this.cat, u, arrivee, aBouge).length > 0) sortie.push('attaquer');

    if (peutCapturerIci(this.etatPartie, this.cat, { ...u, ...arrivee })) {
      sortie.push(estDesaffecte(this.etatPartie, arrivee) ? 'remettre' : 'capturer');
    }

    if (this.voisinFusionnable(u, arrivee)) sortie.push('fusionner');
    if (this.transportVoisin(u, arrivee)) sortie.push('embarquer');
    if (constructionsPossibles(this.etatPartie, this.cat, { ...u, ...arrivee }).length > 0) sortie.push('construire');
    if (u.cargo.length > 0 && this.caseDebarquement(u, arrivee)) sortie.push('debarquer');
    if (porte(type, 'ravitaillement') && this.voisinRavitaillable(u, arrivee)) sortie.push('ravitailler');

    sortie.push('attendre');
    // Place fixe : un ordre est toujours au même rang, quelles que soient les
    // options du moment. C'est ce qui rend le geste mécanique.
    return SUITES_MENU.filter((id) => sortie.includes(id));
  }

  /** Une unité amie du même type, adjacente et abîmée : la fusion a un sens. */
  private voisinFusionnable(u: Unite, arrivee: Case): Unite | undefined {
    return this.etatPartie.unites.find(
      (a) => a.id !== u.id && a.camp === u.camp && a.type === u.type && !a.dansTransport
        && a.pv < 100 && manhattan(a, arrivee) === 1,
    );
  }

  /** Un transport ami adjacent qui accepte cette unité et a de la place. */
  private transportVoisin(u: Unite, arrivee: Case): Unite | undefined {
    const type = this.cat.unites[u.type];
    if (!type || porte(type, 'transport')) return undefined;
    return this.etatPartie.unites.find((a) => {
      if (a.camp !== u.camp || a.id === u.id || a.dansTransport) return false;
      const ta = this.cat.unites[a.type];
      if (!ta || !porte(ta, 'transport') || ta.transport === null) return false;
      if (!ta.transport.accepte.includes(u.type)) return false;
      if (a.cargo.length >= ta.transport.places) return false;
      return manhattan(a, arrivee) === 1;
    });
  }

  /** Une case libre et franchissable où poser le premier passager. */
  private caseDebarquement(u: Unite, arrivee: Case): Case | undefined {
    const passagerId = u.cargo[0];
    if (passagerId === undefined) return undefined;
    const passager = uniteParId(this.etatPartie, passagerId);
    if (!passager) return undefined;
    const tp = this.cat.unites[passager.type];
    if (!tp) return undefined;
    const autour: Case[] = [
      { x: arrivee.x, y: arrivee.y - 1 }, { x: arrivee.x - 1, y: arrivee.y },
      { x: arrivee.x + 1, y: arrivee.y }, { x: arrivee.x, y: arrivee.y + 1 },
    ];
    return autour.find((c) => {
      if (!this.dansCarte(c) || uniteSur(this.etatPartie, c)) return false;
      const t = terrainLogique(this.etatPartie, this.cat, c);
      return t !== null && this.cat.terrains[t]?.couts[tp.typeMouvement] !== undefined;
    });
  }

  /** Une unité amie adjacente à court de munitions ou de carburant. */
  private voisinRavitaillable(u: Unite, arrivee: Case): Unite | undefined {
    return this.etatPartie.unites.find((a) => {
      if (a.camp !== u.camp || a.id === u.id || a.dansTransport) return false;
      if (manhattan(a, arrivee) !== 1) return false;
      const ta = this.cat.unites[a.type];
      if (!ta) return false;
      const sansMunitions = ta.munitions !== null && a.munitions !== null && a.munitions < ta.munitions;
      const sansCarburant = ta.carburant !== null && a.carburant !== null && a.carburant < ta.carburant.max;
      return sansMunitions || sansCarburant;
    });
  }

  /** Les unités qu'un bâtiment possédé et libre peut produire, coût compris. */
  private unitesProduisibles(c: Case): CleUnite[] {
    if (!this.monTour) return [];
    const terrain = terrainLogique(this.etatPartie, this.cat, c);
    if (terrain === null) return [];
    if (this.etatPartie.proprietaires[cleCase(c)] !== this.camp) return [];
    if (uniteSur(this.etatPartie, c)) return [];
    return produitesPar(this.cat, terrain).filter(
      (cle) => verifierProduction(this.etatPartie, this.cat, this.camp, c, cle).ok
        || (this.cat.unites[cle]?.cout ?? 0) > 0,
    );
  }

  // -------------------------------------------------------------------------
  // Écriture : un seul chemin, `appliquer`
  // -------------------------------------------------------------------------

  /** Construit l'ordre courant et le joue. */
  private jouerOrdre(suite: Suite): void {
    const u = this.uniteSelectionnee();
    if (!u) return;
    const chemin = this.cheminCourant.length > 0 ? this.cheminCourant : [{ x: u.x, y: u.y }];
    this.jouer({ type: 'ordre', uniteId: u.id, chemin, suite });
  }

  /** Le **seul** point d'écriture : `appliquer`, jamais une mutation. */
  private jouer(action: Action): void {
    const avant = this.etatPartie;
    const r = appliquer(avant, action, this.cat, this.commandants);
    if (!r.ok) {
      this.ecouteur.surRefus?.(action, r.motif);
      this.reinitialiserSelection();
      this.ecouteur.surChangement?.();
      return;
    }
    this.etatPartie = r.etat;
    this.venaitDeJouer = true;
    this.reinitialiserSelection();
    if (r.etat.partie.terminee) this.phaseCourante = 'fin';
    this.ecouteur.surAction?.(action, r.evenements, avant, r.etat);
    this.ecouteur.surChangement?.();
  }

  /** Revient à l'état neutre sans toucher au curseur. */
  private reinitialiserSelection(): void {
    this.selectionId = null;
    this.inspectionId = null;
    this.cheminCourant = [];
    this.cibles = [];
    this.cibleVisee = null;
    this.travaux = [];
    this.options = [];
    this.batimentProduction = null;
    if (this.phaseCourante !== 'fin' && this.phaseCourante !== 'attente') {
      this.phaseCourante = 'inactif';
    }
  }

  /** Remet tout à zéro, y compris la phase. */
  private reinitialiser(): void {
    this.phaseCourante = 'inactif';
    this.reinitialiserSelection();
  }
}
