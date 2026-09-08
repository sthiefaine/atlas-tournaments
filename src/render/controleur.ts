/**
 * Le contrôleur : la machine à états de l'interaction.
 *
 *     inactif → sélection → chemin → action → (cible) → confirmation
 *
 * À côté de ces phases, l'**inspection** : un double-clic ou un appui long sur
 * une unité adverse visible allume ses déplacements et son enveloppe de tir,
 * sans toucher à la partie. Elle se referme au clic suivant ou à Échap.
 *
 * Sous brouillard, un chemin qui **sort de la vue** court-circuite l'ordre :
 * choisir l'arrivée joue l'ordre en deux temps du moteur (`04-gameplay.md`
 * §2, suite `puis`) — on bouge d'abord, on décide ensuite. Sans embuscade,
 * l'unité ressort `deplacee` et le contrôleur rouvre aussitôt son menu de
 * suites, calculé sur ce qu'il y a **vraiment** à l'arrivée ; avec une
 * embuscade, elle ressort `agi` et la sélection tombe. Une unité `deplacee`
 * qu'on resélectionne plus tard rouvre directement son menu, sans phase de
 * chemin : elle ne bougera plus.
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
  Action, Catalogue, CommandantMoteur, Debarquement, EtatPartie, EvenementJeu, MotifRefus, Portee, Suite, Unite,
} from '../engine/index';
import {
  appliquer, arriveeLibre, brouillardActif, casesAtteignables, casesVisibles, cheminVers, ciblesDepuis, cleCase,
  coutVers, depuisCle, estDesaffecte, manhattan, peutCapturerIci, pointsMouvement, porte, portee, produitesPar,
  terrainLogique, uniteParId, uniteSur, unitesVues, verifierProduction, constructionsPossibles,
} from '../engine/index';
import type { Case, CampId, CleUnite } from '../schemas/types';
import type { OptionMenu } from './libelles';
import type { Surbrillance } from './surbrillance';

/** Les phases de l'interaction. */
export type Phase =
  | 'inactif' | 'selection' | 'action' | 'cible' | 'production' | 'attente' | 'fin';

/**
 * Les suites proposables au joueur, dans l'ordre d'affichage du menu.
 * `furtivite` (catalogue 6) bascule une unité au trait `furtif` ; `terminer`
 * n'existe qu'après un premier débarquement, quand il reste un passager à
 * poser et qu'on choisit de ne pas le faire.
 */
export const SUITES_MENU = [
  'attaquer', 'capturer', 'remettre', 'fusionner', 'embarquer', 'debarquer', 'ravitailler', 'construire',
  'furtivite', 'terminer', 'attendre',
] as const;
/** Identifiant d'une entrée du menu d'actions. */
export type IdSuite = typeof SUITES_MENU[number];

/**
 * Clé de chaîne d'une entrée de menu : jamais un texte, toujours une clé. Deux
 * entrées n'y sont pas, parce que leur libellé dépend du moment : `furtivite`
 * dit « se cacher » ou « se montrer » selon l'état de l'unité (`cleFurtivite`),
 * et `debarquer` nomme son passager (`suitesPossibles`, `poserPassager`).
 */
const CLE_MENU: Record<Exclude<IdSuite, 'furtivite' | 'debarquer'>, string> = {
  attaquer: 'hud.attaquer',
  capturer: 'hud.capturer',
  remettre: 'hud.remettre',
  fusionner: 'hud.fusionner',
  embarquer: 'hud.embarquer',
  ravitailler: 'hud.ravitailler',
  attendre: 'hud.attendre',
  construire: 'hud.construire',
  terminer: 'hud.terminer',
};

/** La clé de l'entrée `furtivite` : elle dit ce que l'ordre **fera**, pas ce que l'unité est. */
function cleFurtivite(u: Unite): string {
  return u.furtive === true ? 'hud.se_montrer' : 'hud.se_cacher';
}

/**
 * Une entrée du menu telle que le contrôleur la tient : la suite, sa clé, et
 * pour un débarquement le passager qu'elle pose — il y a une entrée par
 * passager, à la place fixe de `debarquer`, pour que le geste reste mécanique.
 */
interface EntreeMenu {
  id: IdSuite;
  cle: string;
  passager?: string;
}

/** Ce que le contrôleur expose au rendu : sa vue, jamais son état interne. */
export interface VueControleur {
  phase: Phase;
  curseur: Case;
  selection: string | null;
  chemin: Case[];
  /**
   * Le chemin pointé traverse une case que le joueur ne voit pas : choisir
   * cette arrivée jouera l'ordre en deux temps, sans menu avant. Vrai en phase
   * `selection` seulement — ailleurs il n'y a pas de chemin à pointer.
   */
  cheminAveugle: boolean;
  /**
   * Ce que le chemin pointé **coûte**, sur ce dont l'unité dispose. `null` hors
   * de la phase de chemin.
   *
   * Le panneau d'unité affichait le mouvement du **catalogue**, c'est-à-dire le
   * maximum du type, jamais ce que le trajet visé consomme : la flèche était
   * dessinée et le budget muet. Le coût est lu sur la portée que le moteur a
   * calculée et que le contrôleur garde déjà en cache — il n'est pas recalculé.
   */
  cheminCout: { cout: number; max: number } | null;
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
   * Le débarquement en cours : le transport, le passager qu'on pose, les cases
   * où il peut être posé, celle qu'on pointe, et les débarquements **déjà
   * choisis** dans le même ordre — une barge à deux places vide sa cale en un
   * seul ordre. `null` hors d'un débarquement.
   */
  debarquement: {
    transportId: string; passager: string | null; cases: Case[]; case: Case | null; choisis: Debarquement[];
  } | null;
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

  /**
   * Le débarquement en train de se composer. En phase `cible`, `passager` est
   * celui dont on choisit la case parmi `cases` ; en phase `action` — après
   * une première case —, `passager` est `null` et le menu propose de poser le
   * suivant ou de terminer. `choisis` s'allonge à chaque case ; l'ordre part
   * une seule fois, avec tout.
   */
  private debarquement: { passager: string | null; cases: Case[]; choisis: Debarquement[] } | null = null;

  private options: EntreeMenu[] = [];

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
      cheminAveugle: this.phaseCourante === 'selection' && this.cheminSortDeLaVue(this.cheminCourant),
      cheminCout: this.coutDuChemin(),
      surbrillances: this.surbrillances(),
      menu: this.phaseCourante === 'action' && this.options.length > 0
        ? {
          ancre: this.arrivee(),
          options: this.options.map((o): OptionMenu => (o.passager === undefined
            ? { id: o.id, cle: o.cle, disponible: true }
            : { id: o.id, cle: o.cle, disponible: true, passager: o.passager })),
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
      debarquement: this.debarquement && this.selectionId !== null
        && (this.phaseCourante === 'cible' || this.phaseCourante === 'action')
        ? {
          transportId: this.selectionId,
          passager: this.debarquement.passager,
          cases: [...this.debarquement.cases],
          case: this.phaseCourante === 'cible' ? this.cibleVisee : null,
          choisis: [...this.debarquement.choisis],
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
    // Une case de débarquement se pointe de la même façon.
    if (this.phaseCourante === 'cible' && this.cibles.some((u) => u.x === c.x && u.y === c.y)) {
      this.cibleVisee = { x: c.x, y: c.y };
    }
    if (this.phaseCourante === 'cible' && this.debarquement?.cases.some((v) => v.x === c.x && v.y === c.y)) {
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
    if (this.phaseCourante === 'cible' && this.debarquement) {
      if (!this.debarquement.cases.some((v) => v.x === c.x && v.y === c.y)) {
        this.annuler();
        return;
      }
      // Les mêmes deux temps que la visée : pointer, puis confirmer. À la
      // souris le survol a pointé ; au clavier, la première case est pointée
      // d'office et Entrée suffit.
      if (this.cibleVisee && this.cibleVisee.x === c.x && this.cibleVisee.y === c.y) {
        this.poserPassager(c);
        return;
      }
      this.cibleVisee = { x: c.x, y: c.y };
      this.ecouteur.surChangement?.();
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
      if (this.uniteSelectionnee()?.etat === 'deplacee') {
        // Une unité déplacée n'a pas de choix de destination où revenir : le
        // menu se ferme, elle reste `deplacee`, et le clic fait son travail
        // habituel — sur elle, il rouvre le menu ; ailleurs, il sélectionne.
        this.reinitialiserSelection();
        this.selectionnerSous(c);
        return;
      }
      // Un clic hors du menu revient au choix de destination — et oublie un
      // débarquement à moitié composé : rien n'est parti, rien n'est à défaire.
      this.phaseCourante = 'selection';
      this.debarquement = null;
      this.majChemin(c);
      this.ecouteur.surChangement?.();
      return;
    }

    if (this.phaseCourante === 'selection') {
      const atteignables = this.atteignables();
      if (atteignables.has(cleCase(c))) {
        this.majChemin(c);
        // Un chemin qui sort de la vue ne promet rien : on avance, on verra.
        if (this.cheminSortDeLaVue(this.cheminCourant)) this.jouerDeuxTemps();
        else this.ouvrirMenu();
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
    return this.ouvrirInspection(uniteSur(this.etatPartie, c));
  }

  /**
   * Ouvre l'inspection sur une unité adverse, si elle en est une et qu'on la
   * voit. Sous brouillard, `uniteSur` lit l'état **entier** : allumer la portée
   * d'une unité cachée dirait où elle est. Rend vrai si l'inspection s'est
   * ouverte — l'appelant s'en sert pour ne pas faire autre chose en plus.
   */
  private ouvrirInspection(u: Unite | undefined): boolean {
    if (!u || u.camp === this.camp) return false;
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
      const deplacee = this.uniteSelectionnee();
      if (deplacee?.etat === 'deplacee') {
        // Pas de phase de chemin derrière le menu d'une déplacée : depuis la
        // visée, Échap revient au menu ; depuis le menu, il le ferme sans rien
        // jouer — la suite reste à donner, jusqu'à la fin du tour.
        if (this.phaseCourante === 'cible') {
          this.reprendreDeplacee(deplacee);
          return;
        }
        this.reinitialiserSelection();
        this.ecouteur.surChangement?.();
        return;
      }
      this.phaseCourante = 'selection';
      this.cibles = [];
      this.cibleVisee = null;
      this.travaux = [];
      this.debarquement = null;
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
      if (premiere) this.choisirSuite(premiere.id, premiere.passager);
      return;
    }
    this.clicCase(this.curseurCase);
  }

  /**
   * Choisit une entrée du menu d'actions. `passager` n'a de sens que pour
   * `debarquer` : c'est l'unité de la cale que l'entrée pose ; sans lui, le
   * premier passager qu'une case peut accueillir.
   */
  choisirSuite(id: string, passager?: string): void {
    const suite = SUITES_MENU.find((s) => s === id);
    if (!suite || this.phaseCourante !== 'action') return;
    const u = this.uniteSelectionnee();
    if (!u) return;
    const arrivee = this.arrivee();

    switch (suite) {
      case 'attendre':
        this.jouerOrdre({ type: 'rien' });
        return;
      case 'furtivite':
        // Une bascule : le moteur dit lui-même dans quel sens, le libellé du
        // menu l'a déjà dit au joueur (`cleFurtivite`).
        this.jouerOrdre({ type: 'furtivite' });
        return;
      case 'terminer': {
        // Il reste un passager et une case pour lui, et le joueur s'en tient
        // là : l'ordre part avec ce qui est choisi.
        const choisis = this.debarquement?.choisis ?? [];
        if (choisis.length > 0) this.jouerDebarquement(choisis);
        return;
      }
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
        this.ouvrirDebarquement(u, arrivee, passager);
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
      // Les cases où le passager peut être posé : c'est là qu'il **va**, et le
      // vert dit exactement cela — « j'y vais » —, sans nouveau genre à apprendre.
      for (const c of this.debarquement?.cases ?? []) sortie.push({ case: c, genre: 'deplacement' });
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
    // Une déplacée n'ira nulle part : allumer ses arrivées mentirait, et son
    // enveloppe de tir se lit dans le menu — « attaquer » y est, ou n'y est pas.
    if (u.etat === 'deplacee') return sortie;
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

  /**
   * Le coût du chemin courant et le budget de l'unité. `null` tant qu'on ne
   * pointe pas un chemin, ou si l'unité n'a pas bougé du tout : « 0 sur 6 » sur
   * sa propre case n'apprend rien.
   */
  private coutDuChemin(): { cout: number; max: number } | null {
    if (this.phaseCourante !== 'selection') return null;
    const u = this.uniteSelectionnee();
    if (!u || this.cheminCourant.length < 2) return null;
    const cout = coutVers(this.deplacementDe(u).portee, this.arrivee());
    if (cout === null) return null;
    return { cout, max: pointsMouvement(this.etatPartie, this.cat, u) };
  }

  /**
   * Va à la **prochaine unité qui n'a pas joué**, en cycle.
   *
   * Le bouton de fin de tour compte depuis longtemps les unités qui restent à
   * jouer ; il ne savait pas y aller. Sur un match à quinze unités, les
   * retrouver à l'œil était une chasse au trésor à chaque tour — et `recentrer`
   * allait sur la sélection, sinon sur la **première du tableau**, qui n'est
   * presque jamais la bonne.
   *
   * On repart de celle qui est sélectionnée : le cycle avance d'un cran à
   * chaque appui au lieu de revenir sans cesse à la même.
   */
  uniteSuivante(): Case | null {
    if (!this.monTour) return null;
    const jouables = this.etatPartie.unites.filter(
      (u) => u.camp === this.camp && !u.dansTransport
        && (u.etat === 'prete' || u.etat === 'deplacee'),
    );
    if (jouables.length === 0) return null;
    const depuis = jouables.findIndex((u) => u.id === this.selectionId);
    const suivante = jouables[(depuis + 1) % jouables.length];
    if (!suivante) return null;
    const c = { x: suivante.x, y: suivante.y };
    // La sélection courante est **défaite d'abord** : en phase de chemin, un clic
    // sur une autre case veut dire « va là », pas « prends celle-ci ». Sans cela
    // le cycle repassait sans fin entre les deux premières unités.
    this.reinitialiserSelection();
    this.poserCurseur(c);
    this.clicCase(c);
    return c;
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

  /**
   * Vrai si le chemin courant fait effectivement bouger l'unité — ou si elle a
   * déjà bougé par un ordre en deux temps : le moteur la traite comme telle
   * (tir indirect refusé, tir après mouvement), le menu doit dire pareil.
   */
  private aBouge(): boolean {
    const u = this.uniteSelectionnee();
    if (!u) return false;
    if (u.etat === 'deplacee') return true;
    const a = this.arrivee();
    return a.x !== u.x || a.y !== u.y;
  }

  /**
   * Vrai si le chemin traverse, hors sa case de départ, une case que le joueur
   * ne voit pas. Sans brouillard, jamais. La vision est celle du moteur
   * (`casesVisibles`, mémoïsée par état) : rien n'est réinventé ici.
   */
  private cheminSortDeLaVue(chemin: readonly Case[]): boolean {
    if (chemin.length < 2 || !brouillardActif(this.etatPartie)) return false;
    const vues = casesVisibles(this.etatPartie, this.cat, this.camp);
    for (let i = 1; i < chemin.length; i += 1) {
      if (!vues.has(cleCase(chemin[i]!))) return true;
    }
    return false;
  }

  private dansCarte(c: Case): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.etatPartie.largeur && c.y < this.etatPartie.hauteur;
  }

  /** Sélectionne l'unité sous une case, ou ouvre la production d'un bâtiment. */
  private selectionnerSous(c: Case): void {
    const u = uniteSur(this.etatPartie, c);
    if (u && u.camp === this.camp && u.etat === 'deplacee' && this.monTour) {
      this.reprendreDeplacee(u);
      return;
    }
    if (u && u.camp === this.camp && u.etat === 'prete' && this.monTour) {
      this.selectionId = u.id;
      this.cheminCourant = [{ x: u.x, y: u.y }];
      this.phaseCourante = 'selection';
      this.ecouteur.surChangement?.();
      return;
    }
    // Un clic **simple** sur une unité adverse ouvre son détail. Le double-clic
    // et l'appui long restent, mais ils ne s'apprennent nulle part, et au doigt
    // il n'y a pas de survol pour montrer le panneau : ce clic-là ne faisait
    // rien d'autre que défaire une sélection déjà défaite.
    if (this.ouvrirInspection(u)) return;
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
  private suitesPossibles(u: Unite, arrivee: Case): EntreeMenu[] {
    const sortie: EntreeMenu[] = [];
    const simple = (id: Exclude<IdSuite, 'furtivite' | 'debarquer'>): void => { sortie.push({ id, cle: CLE_MENU[id] }); };
    const type = this.cat.unites[u.type];
    if (!type) return [{ id: 'attendre', cle: CLE_MENU.attendre }];
    // Une déplacée a déjà bougé : les règles « après mouvement » s'appliquent
    // depuis la case où elle est, et le menu ne propose que ce que le moteur
    // acceptera.
    const aBouge = u.etat === 'deplacee' || arrivee.x !== u.x || arrivee.y !== u.y;

    if (ciblesDepuis(this.etatPartie, this.cat, u, arrivee, aBouge).length > 0) simple('attaquer');

    if (peutCapturerIci(this.etatPartie, this.cat, { ...u, ...arrivee })) {
      simple(estDesaffecte(this.etatPartie, arrivee) ? 'remettre' : 'capturer');
    }

    if (this.voisinFusionnable(u, arrivee)) simple('fusionner');
    if (this.transportVoisin(u, arrivee)) simple('embarquer');
    if (constructionsPossibles(this.etatPartie, this.cat, { ...u, ...arrivee }).length > 0) simple('construire');
    // Une entrée par passager qu'une case voisine peut accueillir : le joueur
    // choisit **qui** descend avant de choisir où.
    for (const passager of this.passagersDebarquables(u, arrivee, [])) {
      sortie.push({ id: 'debarquer', cle: 'hud.debarquer_unite', passager: passager.id });
    }
    if (porte(type, 'ravitaillement') && this.voisinRavitaillable(u, arrivee)) simple('ravitailler');
    // Se cacher ou se montrer : offert partout où l'unité peut s'arrêter, avec
    // ou sans déplacement — c'est le moteur qui borne, pas le menu.
    if (porte(type, 'furtif')) sortie.push({ id: 'furtivite', cle: cleFurtivite(u) });

    simple('attendre');
    // Place fixe : un ordre est toujours au même rang, quelles que soient les
    // options du moment. C'est ce qui rend le geste mécanique.
    return SUITES_MENU.flatMap((id) => sortie.filter((e) => e.id === id));
  }

  /**
   * Les passagers de la cale qu'une case voisine de l'arrivée peut accueillir,
   * dans l'ordre de la cale, `exclus` mis à part — ceux déjà posés dans
   * l'ordre en cours, et les cases qu'ils occupent.
   */
  private passagersDebarquables(u: Unite, arrivee: Case, choisis: readonly Debarquement[]): Unite[] {
    const occupees = choisis.map((d) => d.vers);
    const poses = new Set(choisis.map((d) => d.passager));
    const sortie: Unite[] = [];
    for (const id of u.cargo) {
      if (poses.has(id)) continue;
      const passager = uniteParId(this.etatPartie, id);
      if (!passager) continue;
      if (this.casesDebarquement(passager, arrivee, occupees).length > 0) sortie.push(passager);
    }
    return sortie;
  }

  /**
   * Ouvre le choix de la case pour un passager : la phase de visée, sur les
   * cases voisines libres et franchissables par **lui** — un char ne débarque
   * pas sur une montagne où l'infanterie serait allée. La première case est
   * pointée d'office, pour qu'Entrée suffise.
   */
  private ouvrirDebarquement(u: Unite, arrivee: Case, passagerId: string | undefined): void {
    const choisis = this.debarquement?.choisis ?? [];
    const candidats = this.passagersDebarquables(u, arrivee, choisis);
    const passager = passagerId === undefined ? candidats[0] : candidats.find((p) => p.id === passagerId);
    if (!passager) return;
    const cases = this.casesDebarquement(passager, arrivee, choisis.map((d) => d.vers));
    const premiere = cases[0];
    if (!premiere) return;
    this.cibles = [];
    this.travaux = [];
    this.options = [];
    this.debarquement = { passager: passager.id, cases, choisis };
    this.phaseCourante = 'cible';
    this.cibleVisee = { ...premiere };
    this.curseurCase = { ...premiere };
    this.ecouteur.surChangement?.();
  }

  /**
   * La case du passager est choisie. S'il reste un passager et une case pour
   * lui, le menu revient avec « débarquer aussi » et « terminer » ; sinon
   * l'ordre part, avec tout ce qui a été choisi.
   */
  private poserPassager(c: Case): void {
    const d = this.debarquement;
    const u = this.uniteSelectionnee();
    if (!d || !u || d.passager === null) return;
    const choisis: Debarquement[] = [...d.choisis, { vers: { x: c.x, y: c.y }, passager: d.passager }];
    const restants = this.passagersDebarquables(u, this.arrivee(), choisis);
    if (restants.length === 0) {
      this.jouerDebarquement(choisis);
      return;
    }
    this.debarquement = { passager: null, cases: [], choisis };
    this.cibleVisee = null;
    this.options = [
      ...restants.map((p): EntreeMenu => ({ id: 'debarquer', cle: 'hud.debarquer_aussi', passager: p.id })),
      { id: 'terminer', cle: CLE_MENU.terminer },
    ];
    this.phaseCourante = 'action';
    this.curseurCase = { ...this.arrivee() };
    this.ecouteur.surChangement?.();
  }

  /** L'ordre de débarquement, une fois : le premier par `vers`/`passager`, les suivants par `autres`. */
  private jouerDebarquement(choisis: readonly Debarquement[]): void {
    const [premier, ...autres] = choisis;
    if (!premier) return;
    this.jouerOrdre(autres.length > 0
      ? { type: 'debarquer', vers: premier.vers, passager: premier.passager, autres }
      : { type: 'debarquer', vers: premier.vers, passager: premier.passager });
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

  /**
   * Les cases voisines de l'arrivée, libres et franchissables par ce passager,
   * dans l'ordre nord, ouest, est, sud ; `occupees` sont celles qu'un
   * passager posé dans le même ordre prendra déjà. La règle est celle du
   * moteur (`debarquerUn`) : adjacente, libre, un coût de terrain pour son
   * type de mouvement. La case que le transport **quitte** est libre : l'état
   * lu est celui d'avant l'ordre, où il s'y trouve encore.
   */
  private casesDebarquement(passager: Unite, arrivee: Case, occupees: readonly Case[]): Case[] {
    const tp = this.cat.unites[passager.type];
    if (!tp) return [];
    const autour: Case[] = [
      { x: arrivee.x, y: arrivee.y - 1 }, { x: arrivee.x - 1, y: arrivee.y },
      { x: arrivee.x + 1, y: arrivee.y }, { x: arrivee.x, y: arrivee.y + 1 },
    ];
    return autour.filter((c) => {
      if (!this.dansCarte(c)) return false;
      const occupant = uniteSur(this.etatPartie, c);
      if (occupant && occupant.id !== this.selectionId) return false;
      if (occupees.some((o) => o.x === c.x && o.y === c.y)) return false;
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

  /**
   * L'ordre en deux temps : le chemin part avec la suite `puis`, et le moteur
   * dit ce qu'il en est. Sans embuscade, l'unité ressort `deplacee` et son
   * menu s'ouvre sur sa case, calculé sur l'état réel — c'est tout l'intérêt :
   * « capturer » n'y est que si la ville est vraiment là, et vraiment libre.
   * Avec une embuscade, elle ressort `agi`, son tour est fini, et la sélection
   * est déjà tombée avec l'ordre.
   */
  private jouerDeuxTemps(): void {
    const u = this.uniteSelectionnee();
    if (!u) return;
    const chemin = this.cheminCourant.length > 0 ? this.cheminCourant : [{ x: u.x, y: u.y }];
    if (!this.jouer({ type: 'ordre', uniteId: u.id, chemin, suite: { type: 'puis' } })) return;
    const arrivee = uniteParId(this.etatPartie, u.id);
    if (!arrivee || arrivee.etat !== 'deplacee' || this.phaseCourante === 'fin') return;
    this.reprendreDeplacee(arrivee);
  }

  /**
   * Rouvre le menu d'une unité déplacée, sur sa case, sans phase de chemin :
   * elle ne bougera plus, et l'ordre qu'elle donnera partira « sur place »
   * (`chemin: [sa case]`), comme le moteur l'attend.
   */
  private reprendreDeplacee(u: Unite): void {
    const ici = { x: u.x, y: u.y };
    this.selectionId = u.id;
    this.cheminCourant = [ici];
    this.cibles = [];
    this.cibleVisee = null;
    this.travaux = [];
    this.debarquement = null;
    this.options = this.suitesPossibles(u, ici);
    this.phaseCourante = 'action';
    this.ecouteur.surChangement?.();
  }

  /** Le **seul** point d'écriture : `appliquer`, jamais une mutation. Rend vrai si l'action est passée. */
  private jouer(action: Action): boolean {
    const avant = this.etatPartie;
    const r = appliquer(avant, action, this.cat, this.commandants);
    if (!r.ok) {
      this.ecouteur.surRefus?.(action, r.motif);
      this.reinitialiserSelection();
      this.ecouteur.surChangement?.();
      return false;
    }
    this.etatPartie = r.etat;
    this.venaitDeJouer = true;
    this.reinitialiserSelection();
    if (r.etat.partie.terminee) this.phaseCourante = 'fin';
    this.ecouteur.surAction?.(action, r.evenements, avant, r.etat);
    this.ecouteur.surChangement?.();
    return true;
  }

  /** Revient à l'état neutre sans toucher au curseur. */
  private reinitialiserSelection(): void {
    this.selectionId = null;
    this.inspectionId = null;
    this.cheminCourant = [];
    this.cibles = [];
    this.cibleVisee = null;
    this.travaux = [];
    this.debarquement = null;
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
