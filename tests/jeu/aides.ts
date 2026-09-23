// Aides des tests de l'IA en fond : des parties réelles du canon, jouées comme
// la page les joue, et un faux worker qui se comporte comme un vrai — clonage
// structuré dans les deux sens, livraison différée, messages perdus tant que le
// module n'écoute pas, plus rien après `terminate()`.
import { readFileSync } from 'node:fs';
import { jouerTour, PONDEREE } from '../../src/ai/index';
import { adversaireIa } from '../../src/app/jeu/adversaire';
import type { WorkerIa } from '../../src/app/jeu/adversaire-fond';
import { brancherIa, type MessageDepuisIa, type MessageVersIa, type PortIa } from '../../src/app/jeu/ia.worker';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { scenarioPourMode } from '../../src/content/difficulte';
import {
  appliquer, chargerCatalogue, creerPartie, restaurerRng, sceneDepuis,
  type Action, type Catalogue, type CommandantMoteur, type EtatPartie,
} from '../../src/engine/index';
import {
  validerMapDef, validerScenario, type MapDef, type Mode, type Scenario, type StrategieIa,
} from '../../src/schemas/index';

/** Une partie du canon, préparée comme la page la prépare. */
export interface Partie {
  code: string;
  scenario: Scenario;
  carte: MapDef;
  cat: Catalogue;
  commandants: (CommandantMoteur | null)[];
  /** Les paramètres d'`adversaireIa`, lus comme `toile.tsx` les lit. */
  strategie: StrategieIa | undefined;
  strategiesParCamp: Partial<Record<number, StrategieIa>>;
  graine: string;
}

/** Charge un scénario et sa carte, applique le mode, résout les commandants. */
export function preparerPartie(code: string, mode: Mode = 'normal', graine = `${code}:1`): Partie {
  const vs = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  if (!vs.ok) throw new Error(`scénario ${code} invalide`);
  const vc = validerMapDef(JSON.parse(readFileSync(`content/cartes/${vs.valeur.carteCle}.json`, 'utf8')));
  if (!vc.ok) throw new Error(`carte ${vs.valeur.carteCle} invalide`);
  const scenario = scenarioPourMode(vs.valeur, mode);
  return {
    code, scenario, carte: vc.valeur, cat: chargerCatalogue(scenario.catalogueVersion),
    commandants: resoudreCommandantsScenario(scenario),
    strategie: scenario.commandants.find((c) => c.ia)?.ia,
    strategiesParCamp: Object.fromEntries(scenario.commandants.filter((c) => c.ia).map((c) => [c.camp, c.ia!])),
    graine,
  };
}

/** La partie neuve d'une préparation. */
export function partieNeuve(p: Partie): EtatPartie {
  return creerPartie(sceneDepuis(p.scenario, p.carte, p.commandants), p.cat, p.graine);
}

/** L'adversaire du fil principal, tel que la page le branchait avant le worker. */
export function adversaireDuFil(p: Partie): (etat: EtatPartie) => Action[] {
  const adversaire = adversaireIa(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp);
  return (etat) => {
    const reponse = adversaire(etat);
    if (!Array.isArray(reponse)) throw new Error('adversaireIa a rendu une promesse');
    return reponse;
  };
}

/** Un tour d'IA rencontré en jouant. */
export interface TourIa {
  journee: number;
  camp: number;
  strategie: StrategieIa;
  /** L'état d'avant le tour, intact : jamais un calcul n'y a touché. */
  etat: EtatPartie;
  /** La suite que l'IA du fil principal a choisie, sur l'objet vivant. */
  attendu: Action[];
}

/**
 * Joue la partie jusqu'à la fin de la journée `jusqua`. À chaque tour d'IA, on
 * garde une copie intacte de l'état et la suite choisie par l'IA du fil
 * principal **sur l'objet vivant**, mémoires du moteur chaudes — exactement
 * l'appel de la page avant le worker. Le camp 0, celui du joueur, est tenu par
 * la pondérée sur une copie : un humain ne calcule rien sur l'état.
 *
 * Le calcul sur l'objet vivant peut l'écrire (le `cargo` partagé d'un
 * transport vide, `adversaire-fond.ts`, `copiePourIa`) : la partie continue
 * donc depuis une copie prise avant, et reste celle que la sauvegarde rejoue.
 */
export function toursIa(p: Partie, jusqua: number): TourIa[] {
  const ia = adversaireDuFil(p);
  const tours: TourIa[] = [];
  let etat = partieNeuve(p);
  for (let garde = 0; garde < 1000 && !etat.partie.terminee && etat.journee <= jusqua; garde += 1) {
    const camp = etat.campCourant;
    const propre = structuredClone(etat);
    let suite: Action[];
    if (camp === 0) {
      suite = jouerTour(structuredClone(etat), PONDEREE, restaurerRng(etat.graine, etat.flux), p.cat, p.commandants).actions;
    } else {
      const intact = structuredClone(etat);
      suite = ia(etat);
      tours.push({
        journee: intact.journee, camp, strategie: p.strategiesParCamp[camp] ?? p.strategie ?? 'ponderee',
        etat: intact, attendu: suite,
      });
    }
    etat = propre;
    for (const action of suite) {
      const r = appliquer(etat, action, p.cat, p.commandants);
      if (!r.ok) throw new Error(`${p.code} : action refusée (${r.motif})`);
      etat = r.etat;
    }
    if (etat.campCourant === camp && !etat.partie.terminee) throw new Error(`${p.code} : le tour du camp ${camp} ne s'est pas fermé`);
  }
  return tours;
}

/** Comment le faux worker se comporte. */
export interface OptionsFaux {
  /**
   * `normal` : le module écoute au bout d'un instant, et ce qui arrive avant est
   * **perdu**, comme un paquet dont les morceaux se chargent encore. `jamais` :
   * il n'écoute jamais. `erreur` : le paquet ne se charge pas (`error`).
   */
  demarrage?: 'normal' | 'jamais' | 'erreur';
  /** Délai avant que le module écoute, en millisecondes. */
  msChargement?: number;
  /** Retient, remplace ou double ce que le worker rend à la page. */
  sortie?: (message: MessageDepuisIa) => MessageDepuisIa[];
}

/** Un worker qui tourne dans le même processus, et ne se permet rien de plus qu'un vrai. */
export class FauxWorker implements WorkerIa {
  onmessage: ((evenement: { data: MessageDepuisIa }) => void) | null = null;
  onerror: ((evenement: unknown) => void) | null = null;
  onmessageerror: ((evenement: unknown) => void) | null = null;
  /** Ce que la page a envoyé, dans l'ordre. */
  readonly envoyes: MessageVersIa[] = [];
  /** Messages arrivés avant que le module n'écoute. */
  perdus = 0;
  terminaisons = 0;
  private termine = false;
  private readonly port: PortIa;

  constructor(options: OptionsFaux = {}) {
    const sortie = options.sortie ?? ((m: MessageDepuisIa) => [m]);
    this.port = {
      onmessage: null,
      postMessage: (message) => {
        // Le clonage se fait à l'envoi, comme dans un vrai worker.
        const copies = sortie(message).map((m) => structuredClone(m));
        for (const copie of copies) {
          setTimeout(() => { if (!this.termine) this.onmessage?.({ data: copie }); }, 0);
        }
      },
    };
    const demarrage = options.demarrage ?? 'normal';
    if (demarrage === 'erreur') {
      setTimeout(() => { if (!this.termine) this.onerror?.({ message: 'paquet introuvable' }); }, 0);
    } else if (demarrage === 'normal') {
      setTimeout(() => { if (!this.termine) brancherIa(this.port); }, options.msChargement ?? 2);
    }
  }

  postMessage(message: MessageVersIa): void {
    this.envoyes.push(message);
    const copie = structuredClone(message);
    setTimeout(() => {
      if (this.termine) return;
      if (!this.port.onmessage) {
        this.perdus += 1;
        return;
      }
      this.port.onmessage({ data: copie });
    }, 0);
  }

  terminate(): void {
    this.termine = true;
    this.terminaisons += 1;
  }
}

/** Laisse passer les minuteries en file : la livraison d'un faux worker en est une. */
export function unInstant(ms = 5): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}
