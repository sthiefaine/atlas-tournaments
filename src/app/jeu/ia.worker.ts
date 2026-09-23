/**
 * Le tour de l'IA, **hors du fil principal** (23 septembre 2026).
 *
 * Ce module est le point d'entrée d'un Web Worker : `adversaire-fond.ts` le
 * lance par `new Worker(new URL('./ia.worker.ts', import.meta.url))`, et webpack
 * comme Turbopack en font un paquet à part. La page lui envoie l'état de la
 * partie, il rend la suite d'actions du camp courant ; pendant ce temps le fil
 * principal continue de dessiner, d'animer et de répondre au doigt. Sur un
 * téléphone, un tour qui évalue ses pouvoirs sur des copies de l'état gelait
 * l'écran le temps de réfléchir.
 *
 * **Il ne réimplémente rien.** Il appelle `adversaireIa` — la fonction même que
 * la page appelait sur le fil principal, avec les mêmes paramètres — sur une
 * copie de l'état par clonage structuré. L'état est du JSON pur
 * (`engine/types.ts`, `EtatPartie`) : ni `Map`, ni `Set`, ni classe, ni
 * fonction, donc la copie est l'état au bit près, champs `undefined` compris.
 * Le flux d'aléa ne voyage pas en objet : `adversaireIa` le **recrée** depuis
 * `etat.graine` et `etat.flux` (`restaurerRng`), exactement comme sur le fil
 * principal. Les mémoires du moteur et de l'IA, attachées à l'identité des
 * objets, partent froides dans le worker ; elles ne font que mémoriser, et
 * `tests/jeu/ia-en-fond.test.ts` le vérifie sur des états réels.
 *
 * Le protocole tient en quatre messages. Le worker dit `pret` dès que son code
 * est chargé — la page n'envoie **rien** avant : un paquet dont les morceaux se
 * chargent encore n'a pas d'écouteur, et un message arrivé trop tôt serait
 * perdu sans bruit. La page envoie `configurer` une fois par partie, puis un
 * `tour` par demande ; le worker répond `tour` avec les actions, ou `erreur`.
 */

import type { Action, CommandantMoteur, EtatPartie } from '@/engine/index';
import type { Adversaire } from '@/render/index';
import type { StrategieIa } from '@/schemas/index';
import { adversaireIa } from './adversaire';

/** Ce qu'`adversaireIa` reçoit, envoyé une fois par partie. */
export interface ConfigurationIa {
  strategie: StrategieIa | undefined;
  catalogueVersion: number;
  commandants: (CommandantMoteur | null)[];
  strategiesParCamp: Partial<Record<number, StrategieIa>>;
}

/** Ce que la page envoie au worker. */
export type MessageVersIa =
  | { type: 'configurer'; configuration: ConfigurationIa }
  | { type: 'tour'; id: number; etat: EtatPartie };

/** Ce que le worker rend à la page. */
export type MessageDepuisIa =
  | { type: 'pret' }
  | { type: 'tour'; id: number; actions: Action[] }
  | { type: 'erreur'; id: number | null; message: string };

/**
 * Le côté worker d'un canal : `self` dans un vrai worker, un faux dans les
 * tests. Typé à la main parce que la bibliothèque `webworker` de TypeScript ne
 * se mêle pas à celle du DOM dans un même projet.
 */
export interface PortIa {
  postMessage(message: MessageDepuisIa): void;
  onmessage: ((evenement: { data: MessageVersIa }) => void) | null;
}

/** Le texte d'une erreur, pour la page : jamais un objet, qui pourrait ne pas se cloner. */
function texteErreur(cause: unknown): string {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
}

/**
 * Le répondeur : un message reçu, la réponse à rendre (ou `null`). Pur, sans
 * rien savoir du worker — c'est lui que les tests exécutent. Il garde
 * l'adversaire d'une partie, construit **une fois** à la configuration, comme
 * la page le construisait une fois au montage.
 */
export function creerRepondeur(): (message: MessageVersIa) => Promise<MessageDepuisIa | null> {
  let adversaire: Adversaire | null = null;
  return async (message) => {
    if (message?.type === 'configurer') {
      const c = message.configuration;
      try {
        adversaire = adversaireIa(c.strategie, c.catalogueVersion, c.commandants, c.strategiesParCamp);
      } catch (cause) {
        adversaire = null;
        return { type: 'erreur', id: null, message: texteErreur(cause) };
      }
      return null;
    }
    if (message?.type === 'tour') {
      if (!adversaire) return { type: 'erreur', id: message.id, message: 'adversaire non configuré' };
      try {
        return { type: 'tour', id: message.id, actions: await adversaire(message.etat) };
      } catch (cause) {
        return { type: 'erreur', id: message.id, message: texteErreur(cause) };
      }
    }
    // Un message qui n'est pas du protocole ne mérite pas de réponse.
    return null;
  };
}

/**
 * Installe le répondeur sur un port et annonce qu'il écoute. Les messages se
 * traitent dans l'ordre d'arrivée : le calcul d'un tour est synchrone, un
 * second message n'est lu qu'une fois le premier rendu.
 */
export function brancherIa(port: PortIa): void {
  const repondre = creerRepondeur();
  port.onmessage = (evenement) => {
    void repondre(evenement.data).then((reponse) => {
      if (!reponse) return;
      try {
        port.postMessage(reponse);
      } catch (cause) {
        // Une réponse qui ne se clone pas ne doit pas laisser la page attendre
        // son chien de garde : elle apprend l'échec, et joue sur le fil principal.
        port.postMessage({ type: 'erreur', id: reponse.type === 'pret' ? null : reponse.id, message: texteErreur(cause) });
      }
    });
  };
  port.postMessage({ type: 'pret' });
}

/**
 * Vrai dans un worker dédié, et nulle part ailleurs : ni dans la page, ni sous
 * Node, où les tests importent ce module pour en exécuter le protocole.
 * `WorkerGlobalScope` n'existe que dans un worker.
 */
function dansUnWorker(): boolean {
  const portee = (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope;
  return typeof portee === 'function' && globalThis instanceof (portee as new () => object);
}

if (dansUnWorker()) brancherIa(globalThis as unknown as PortIa);
