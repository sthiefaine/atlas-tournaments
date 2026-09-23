import type { Action, CommandantMoteur, EtatPartie } from '@/engine/index';
import type { Adversaire } from '@/render/index';
import type { StrategieIa } from '@/schemas/index';
import { adversaireIa } from './adversaire';
import type { ConfigurationIa, MessageDepuisIa, MessageVersIa } from './ia.worker';

/**
 * L'adversaire **en fond** (23 septembre 2026) : le même que `adversaireIa`,
 * mais son tour se calcule dans un Web Worker (`ia.worker.ts`). Le fil
 * principal n'attend plus l'IA : il dessine, anime et répond pendant qu'elle
 * réfléchit, et le chef d'orchestre (`render/jeu.ts`, `tourAdversaire`) joue la
 * suite quand elle arrive, action par action, comme avant.
 *
 * **Aucune action ne change** : le worker appelle `adversaireIa` avec les
 * mêmes paramètres sur une copie de l'état, et l'IA est déterministe
 * (`ia.worker.ts` dit pourquoi la copie ne change rien). Et partout où le
 * worker ne peut pas servir, on **retombe sur le fil principal** — l'IA d'avant,
 * synchrone, sur une copie elle aussi (`copiePourIa` dit pourquoi) :
 *
 * - le navigateur n'a pas de `Worker`, ou sa création lève (politique de
 *   sécurité, paquet refusé) ;
 * - le worker lève (`error`), rend un message illisible (`messageerror`) ou
 *   répond `erreur` ;
 * - il ne se déclare pas prêt `MS_DEMARRAGE_IA` après la première demande, ou
 *   se tait `MS_SILENCE_IA` pendant qu'un tour l'attend.
 *
 * Le repli est définitif pour la partie : le worker est arrêté, les demandes en
 * cours sont rejouées sur le fil principal dans l'ordre, et les suivantes y
 * restent. Un worker qui a failli une fois ne se voit pas confier le tour
 * suivant — une IA qui hésiterait entre deux threads serait la pire des deux.
 *
 * Une réponse **périmée** est ignorée : celle d'une demande déjà rendue par le
 * repli, ou arrivée après `fermer()`. Une partie recommencée pendant que l'IA
 * réfléchissait est l'affaire du chef d'orchestre, qui compare l'état demandé
 * à l'état courant avant de jouer quoi que ce soit.
 */

/**
 * Le temps laissé au worker pour se déclarer prêt, compté **à partir de la
 * première demande** et non de sa création : il se charge pendant que le
 * joueur joue son premier tour, et un réseau lent n'est pas une panne tant que
 * personne n'attend. Au-delà, mieux vaut un tour calculé sur le fil principal —
 * l'écran gèle le temps d'un tour — qu'une partie qui ne reprend jamais.
 */
export const MS_DEMARRAGE_IA = 10_000;

/**
 * Le silence au-delà duquel un worker prêt est tenu pour mort : aucune réponse
 * alors qu'un tour l'attend. Le tour d'IA le plus long mesuré le 23 septembre
 * 2026 prend 36 ms sous Node sur un M1 au calme, 0,4 s sur la même machine
 * surchargée (`doc/refonte/ia-en-fond.md` §5) ; un téléphone modeste en
 * mettrait plusieurs fois plus — non mesuré. Trente secondes ne coupent donc
 * pas un tour qui réfléchit, seulement un worker qui ne répondra plus. Et
 * couper un worker lent ne servirait à rien : le fil principal mettrait le
 * même temps, gelé.
 */
export const MS_SILENCE_IA = 30_000;

/**
 * Ce qu'on attend d'un worker : un `Worker` du navigateur, ou un faux dans les
 * tests. Les écouteurs passent par les propriétés `on…` — une seule écoute par
 * genre, retirée d'une affectation.
 */
export interface WorkerIa {
  postMessage(message: MessageVersIa): void;
  terminate(): void;
  onmessage: ((evenement: { data: MessageDepuisIa }) => void) | null;
  onerror: ((evenement: unknown) => void) | null;
  onmessageerror: ((evenement: unknown) => void) | null;
}

/** Où l'IA joue : dans son worker, sur le fil principal, ou plus du tout. */
export type ModeIa = 'worker' | 'fil' | 'ferme';

/** Pourquoi l'IA est revenue sur le fil principal. */
export type RaisonRepli =
  | 'sans_worker' | 'creation' | 'erreur' | 'message_illisible' | 'envoi' | 'demarrage' | 'silence';

/** Réglages, pour les tests surtout : le jeu prend les valeurs par défaut. */
export interface OptionsAdversaireEnFond {
  /** Fabrique du worker ; par défaut le vrai, ou `null` sans `Worker`. */
  creerWorker?: () => WorkerIa | null;
  msDemarrage?: number;
  msSilence?: number;
  /** Prévenu une fois, au repli. Par défaut un avertissement en console, sauf l'absence de `Worker`. */
  surRepli?: (raison: RaisonRepli) => void;
}

/** Ce que rend `creerAdversaireEnFond`. */
export interface AdversaireEnFond {
  /** À passer à `monterJeu` : `options.adversaire`. */
  readonly adversaire: Adversaire;
  readonly mode: ModeIa;
  /** La raison du repli, ou `null` tant que le worker sert. */
  readonly raisonRepli: RaisonRepli | null;
  /**
   * Arrête le worker. Idempotent. Les demandes en cours se résolvent en une
   * suite vide — la partie qui les attendait est démontée —, et un adversaire
   * fermé ne joue plus.
   */
  fermer(): void;
}

/**
 * Le worker du navigateur, ou `null` sans `Worker`. L'expression
 * `new Worker(new URL('./ia.worker.ts', import.meta.url), …)` doit rester
 * **littérale** : c'est elle que webpack et Turbopack reconnaissent pour
 * construire le paquet du worker à part.
 *
 * `type: 'module'` ne survit à aucun des deux, et c'est voulu : la sortie
 * client de Next n'est pas un module, webpack réécrit l'option en
 * `type: void 0` et Turbopack l'écrase de même — relevé dans les deux
 * constructions du 23 septembre 2026. Le worker est donc **classique**, et
 * charge ses morceaux par `importScripts`, ce qu'un worker module refuserait.
 * `name` nomme le paquet (`static/chunks/atlas-ia.*.js`) et le fil dans les
 * outils du navigateur.
 */
function workerDuNavigateur(): WorkerIa | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./ia.worker.ts', import.meta.url), { type: 'module', name: 'atlas-ia' }) as unknown as WorkerIa;
}

/**
 * La copie de l'état sur laquelle l'IA calcule, dans le worker comme sur le fil
 * principal. Ce n'est pas une précaution de principe : le moteur partage entre
 * deux états successifs le tableau `cargo` d'un transport **vide**
 * (`engine/etat.ts`, `copierEtat`) et l'embarquement y écrit en place
 * (`engine/actions.ts`, `cargo.push`). Un tour d'IA calculé sur l'état
 * **vivant** y faisait donc apparaître ses passagers avant que la page ait joué
 * l'ordre ; mesuré le 23 septembre 2026, la partie en cours divergeait alors de
 * son propre rejeu, jusqu'à changer de vainqueur (`doc/refonte/ia-en-fond.md`).
 * Le worker calcule sur une copie par nature ; le repli fait de même, pour que
 * la partie ne dépende pas du fil qui a réfléchi. Les actions choisies, elles,
 * ne changent pas : l'IA rend la même suite sur une copie que sur l'original.
 */
function copiePourIa(etat: EtatPartie): EtatPartie {
  return typeof structuredClone === 'function' ? structuredClone(etat) : etat;
}

/** Une demande en cours : l'état demandé et de quoi rendre la réponse. */
interface Attente {
  id: number;
  etat: EtatPartie;
  envoyee: boolean;
  resoudre(actions: Action[]): void;
  rejeter(cause: unknown): void;
}

/**
 * L'adversaire d'une partie, calculé dans **un** worker créé ici et arrêté par
 * `fermer()`. Mêmes paramètres qu'`adversaireIa`, plus des options de test.
 */
export function creerAdversaireEnFond(
  id: StrategieIa | undefined,
  catalogueVersion: number,
  commandants: (CommandantMoteur | null)[],
  strategiesParCamp: Partial<Record<number, StrategieIa>> = {},
  options: OptionsAdversaireEnFond = {},
): AdversaireEnFond {
  const configuration: ConfigurationIa = { strategie: id, catalogueVersion, commandants, strategiesParCamp };
  const msDemarrage = options.msDemarrage ?? MS_DEMARRAGE_IA;
  const msSilence = options.msSilence ?? MS_SILENCE_IA;
  const surRepli = options.surRepli ?? ((raison: RaisonRepli) => {
    if (raison !== 'sans_worker') console.warn(`IA : repli sur le fil principal (${raison})`);
  });

  // Le repli ne se construit qu'au besoin : tant que le worker sert, le fil
  // principal ne charge même pas le catalogue de l'IA.
  let repli: Adversaire | null = null;
  const surLeFil = (): Adversaire => (repli ??= adversaireIa(id, catalogueVersion, commandants, strategiesParCamp));

  const attentes = new Map<number, Attente>();
  let prochainId = 1;
  let mode: ModeIa = 'worker';
  let raisonRepli: RaisonRepli | null = null;
  let worker: WorkerIa | null = null;
  let pret = false;
  let minuterieDemarrage: ReturnType<typeof setTimeout> | null = null;
  let chienDeGarde: ReturnType<typeof setTimeout> | null = null;

  /** Arrête le worker et ses minuteries. N'a rien à rendre à personne. */
  function liberer(): void {
    if (minuterieDemarrage !== null) clearTimeout(minuterieDemarrage);
    if (chienDeGarde !== null) clearTimeout(chienDeGarde);
    minuterieDemarrage = null;
    chienDeGarde = null;
    if (!worker) return;
    const w = worker;
    worker = null;
    w.onmessage = null;
    w.onerror = null;
    w.onmessageerror = null;
    try {
      w.terminate();
    } catch {
      // Déjà arrêté : il n'y a rien de plus à arrêter.
    }
  }

  /** Les demandes en cours, dans l'ordre où elles ont été faites, et la file vidée. */
  function vider(): Attente[] {
    const enCours = [...attentes.values()].sort((a, b) => a.id - b.id);
    attentes.clear();
    return enCours;
  }

  /** Rend une demande par l'IA du fil principal : celle d'avant, sur une copie. */
  function rendreSurLeFil(a: Attente): void {
    try {
      const reponse = surLeFil()(copiePourIa(a.etat));
      if (Array.isArray(reponse)) a.resoudre(reponse);
      else reponse.then(a.resoudre, a.rejeter);
    } catch (cause) {
      a.rejeter(cause);
    }
  }

  /** Le repli, définitif : le worker s'arrête, ses demandes passent sur le fil principal. */
  function abandonner(raison: RaisonRepli): void {
    if (mode !== 'worker') return;
    mode = 'fil';
    raisonRepli = raison;
    liberer();
    surRepli(raison);
    for (const a of vider()) rendreSurLeFil(a);
  }

  /**
   * Le chien de garde, réarmé à chaque réponse : il ne mesure pas la durée
   * d'un tour, mais le silence d'un worker qui a des tours à rendre.
   */
  function armerChien(): void {
    if (chienDeGarde !== null) clearTimeout(chienDeGarde);
    chienDeGarde = null;
    if (!worker || !pret) return;
    for (const a of attentes.values()) {
      if (!a.envoyee) continue;
      chienDeGarde = setTimeout(() => {
        chienDeGarde = null;
        abandonner('silence');
      }, msSilence);
      return;
    }
  }

  /** Envoie une demande. Faux si l'envoi a échoué — et alors tout est déjà passé au repli. */
  function envoyer(a: Attente): boolean {
    if (!worker) return false;
    try {
      // Le clonage structuré se fait ici, sur le fil principal : il lève si
      // l'état portait un jour autre chose que du JSON.
      worker.postMessage({ type: 'tour', id: a.id, etat: a.etat });
    } catch {
      abandonner('envoi');
      return false;
    }
    a.envoyee = true;
    return true;
  }

  function surPret(): void {
    if (pret || !worker) return;
    pret = true;
    if (minuterieDemarrage !== null) clearTimeout(minuterieDemarrage);
    minuterieDemarrage = null;
    try {
      worker.postMessage({ type: 'configurer', configuration });
    } catch {
      abandonner('envoi');
      return;
    }
    for (const a of [...attentes.values()].sort((x, y) => x.id - y.id)) {
      if (!a.envoyee && !envoyer(a)) return;
    }
    armerChien();
  }

  function recevoir(message: MessageDepuisIa): void {
    if (mode !== 'worker' || typeof message !== 'object' || message === null) return;
    if (message.type === 'pret') {
      surPret();
      return;
    }
    if (message.type === 'erreur') {
      abandonner('erreur');
      return;
    }
    if (message.type !== 'tour') return;
    const a = attentes.get(message.id);
    // Périmée : déjà rendue par le repli, ou jamais demandée.
    if (!a) return;
    if (!Array.isArray(message.actions)) {
      abandonner('message_illisible');
      return;
    }
    attentes.delete(message.id);
    armerChien();
    a.resoudre(message.actions);
  }

  // --- Un seul worker par partie, lancé tout de suite : il charge son paquet
  //     pendant que le joueur joue, et le premier tour de l'IA ne l'attend pas.
  let raisonCreation: RaisonRepli = 'sans_worker';
  try {
    worker = (options.creerWorker ?? workerDuNavigateur)();
  } catch {
    worker = null;
    raisonCreation = 'creation';
  }
  if (worker) {
    worker.onmessage = (evenement) => recevoir(evenement.data);
    worker.onerror = () => abandonner('erreur');
    worker.onmessageerror = () => abandonner('message_illisible');
  } else {
    mode = 'fil';
    raisonRepli = raisonCreation;
    surRepli(raisonCreation);
  }

  const adversaire: Adversaire = (etat) => {
    if (mode === 'ferme') return [];
    // Sans worker, l'IA d'avant, synchrone, sur une copie : le chef d'orchestre
    // la joue dans le même tour d'horloge qu'avant.
    if (mode === 'fil') return surLeFil()(copiePourIa(etat));
    return new Promise<Action[]>((resoudre, rejeter) => {
      const a: Attente = { id: prochainId, etat, envoyee: false, resoudre, rejeter };
      prochainId += 1;
      attentes.set(a.id, a);
      if (pret) {
        if (envoyer(a)) armerChien();
      } else if (minuterieDemarrage === null) {
        minuterieDemarrage = setTimeout(() => {
          minuterieDemarrage = null;
          abandonner('demarrage');
        }, msDemarrage);
      }
    });
  };

  return {
    adversaire,
    get mode() { return mode; },
    get raisonRepli() { return raisonRepli; },
    fermer(): void {
      if (mode === 'ferme') return;
      mode = 'ferme';
      liberer();
      for (const a of vider()) a.resoudre([]);
      repli = null;
    },
  };
}
