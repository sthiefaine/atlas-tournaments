/**
 * Le contrôleur : la machine à états de l'interaction.
 *
 *     inactif → sélection → chemin → action → (cible) → confirmation
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
  Action, Catalogue, CommandantMoteur, EtatPartie, EvenementJeu, MotifRefus, Suite, Unite,
} from '../engine/index';
import {
  appliquer, arriveeLibre, casesAtteignables, cheminVers, ciblesDepuis, cleCase,
  manhattan, porte, portee, produitesPar, terrainLogique, uniteParId, uniteSur,
  verifierProduction,
} from '../engine/index';
import type { Case, CampId, CleUnite } from '../schemas/types';
import type { OptionMenu } from './hud';
import type { Surbrillance } from './scene';

/** Les phases de l'interaction. */
export type Phase =
  | 'inactif' | 'selection' | 'action' | 'cible' | 'production' | 'attente' | 'fin';

/** Les suites proposables au joueur, dans l'ordre d'affichage du menu. */
export const SUITES_MENU = [
  'attaquer', 'capturer', 'fusionner', 'embarquer', 'debarquer', 'ravitailler', 'attendre',
] as const;
/** Identifiant d'une entrée du menu d'actions. */
export type IdSuite = typeof SUITES_MENU[number];

/** Clé de chaîne d'une entrée de menu : jamais un texte, toujours une clé. */
const CLE_MENU: Record<IdSuite, string> = {
  attaquer: 'hud.attaquer',
  capturer: 'hud.capturer',
  fusionner: 'hud.fusionner',
  embarquer: 'hud.embarquer',
  debarquer: 'hud.debarquer',
  ravitailler: 'hud.ravitailler',
  attendre: 'hud.attendre',
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

  private options: IdSuite[] = [];

  private batimentProduction: Case | null = null;

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
    };
  }

  // -------------------------------------------------------------------------
  // Entrées
  // -------------------------------------------------------------------------

  /** Déplace le curseur d'une case, sans rien choisir. */
  bougerCurseur(dx: number, dy: number): void {
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
    if (c.x === this.curseurCase.x && c.y === this.curseurCase.y) return;
    this.curseurCase = c;
    if (this.phaseCourante === 'selection') this.majChemin(c);
    this.ecouteur.surChangement?.();
  }

  /** Le geste principal sur une case : sélectionner, viser, valider. */
  clicCase(c: Case): void {
    if (!this.dansCarte(c) || this.phaseCourante === 'attente' || this.phaseCourante === 'fin') return;
    this.curseurCase = c;

    if (this.phaseCourante === 'cible') {
      const cible = this.cibles.find((u) => u.x === c.x && u.y === c.y);
      if (cible) this.jouerOrdre({ type: 'attaquer', cible: { x: cible.x, y: cible.y } });
      else this.annuler();
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

  /** Le geste secondaire (clic droit, appui long, Échap) : annuler d'un cran. */
  annuler(): void {
    if (this.phaseCourante === 'cible' || this.phaseCourante === 'action') {
      this.phaseCourante = 'selection';
      this.cibles = [];
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
        this.jouerOrdre({ type: 'capturer' });
        return;
      case 'attaquer': {
        this.cibles = ciblesDepuis(this.etatPartie, this.cat, u, arrivee, this.aBouge());
        if (this.cibles.length === 1) {
          const seule = this.cibles[0];
          if (seule) this.jouerOrdre({ type: 'attaquer', cible: { x: seule.x, y: seule.y } });
          return;
        }
        this.phaseCourante = 'cible';
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
      for (const c of this.cibles) sortie.push({ case: { x: c.x, y: c.y }, genre: 'attaque' });
      return sortie;
    }
    if (this.phaseCourante === 'production' && this.batimentProduction) {
      sortie.push({ case: this.batimentProduction, genre: 'production' });
      return sortie;
    }
    if (this.phaseCourante !== 'selection' && this.phaseCourante !== 'action') return sortie;
    const u = this.uniteSelectionnee();
    if (!u) return sortie;
    for (const k of this.atteignables()) {
      const [x, y] = k.split(',');
      sortie.push({ case: { x: Number(x), y: Number(y) }, genre: 'deplacement' });
    }
    for (const c of this.menacables(u)) {
      sortie.push({ case: { x: c.x, y: c.y }, genre: 'attaque' });
    }
    return sortie;
  }

  /** Cases atteignables par l'unité sélectionnée, arrivée libre comprise. */
  private atteignables(): Set<string> {
    const u = this.uniteSelectionnee();
    const sortie = new Set<string>();
    if (!u) return sortie;
    const p = portee(this.etatPartie, this.cat, u);
    for (const c of casesAtteignables(p)) {
      if (arriveeLibre(this.etatPartie, c, u.id)) sortie.add(cleCase(c));
    }
    sortie.add(cleCase({ x: u.x, y: u.y }));
    return sortie;
  }

  /** Adversaires que l'unité pourrait viser depuis au moins une case atteignable. */
  private menacables(u: Unite): Unite[] {
    const cases = [...this.atteignables()].map((k) => {
      const [x, y] = k.split(',');
      return { x: Number(x), y: Number(y) };
    });
    if (cases.length > 96) return [];
    const vus = new Map<string, Unite>();
    for (const depuis of cases) {
      const aBouge = depuis.x !== u.x || depuis.y !== u.y;
      for (const cible of ciblesDepuis(this.etatPartie, this.cat, u, depuis, aBouge)) {
        vus.set(cible.id, cible);
      }
    }
    return [...vus.values()];
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
    if (!this.atteignables().has(cleCase(c))) return;
    const p = portee(this.etatPartie, this.cat, u);
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

    const terrain = terrainLogique(this.etatPartie, this.cat, arrivee);
    const fiche = terrain === null ? undefined : this.cat.terrains[terrain];
    if (
      fiche?.capturable && porte(type, 'capture')
      && this.etatPartie.proprietaires[cleCase(arrivee)] !== this.camp
    ) sortie.push('capturer');

    if (this.voisinFusionnable(u, arrivee)) sortie.push('fusionner');
    if (this.transportVoisin(u, arrivee)) sortie.push('embarquer');
    if (u.cargo.length > 0 && this.caseDebarquement(u, arrivee)) sortie.push('debarquer');
    if (porte(type, 'ravitaillement') && this.voisinRavitaillable(u, arrivee)) sortie.push('ravitailler');

    sortie.push('attendre');
    return sortie;
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
    this.reinitialiserSelection();
    if (r.etat.partie.terminee) this.phaseCourante = 'fin';
    this.ecouteur.surAction?.(action, r.evenements, avant, r.etat);
    this.ecouteur.surChangement?.();
  }

  /** Revient à l'état neutre sans toucher au curseur. */
  private reinitialiserSelection(): void {
    this.selectionId = null;
    this.cheminCourant = [];
    this.cibles = [];
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
