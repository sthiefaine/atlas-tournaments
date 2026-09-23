// Le côté worker de `ia-thread.test.ts`, dans un vrai thread Node : le module
// `ia.worker.ts` tel quel, branché sur le port du thread au lieu de `self`.
// Ses propres instances de modules — mémoires du moteur froides, rien de
// partagé avec le thread du test —, et le clonage structuré de V8 entre les deux.
import { parentPort } from 'node:worker_threads';
import { brancherIa, type MessageVersIa, type PortIa } from '../../src/app/jeu/ia.worker';

const port = parentPort;
if (!port) throw new Error('fil-ia : à lancer dans un worker_threads');
const cote: PortIa = {
  onmessage: null,
  postMessage: (message) => port.postMessage(message),
};
port.on('message', (data: MessageVersIa) => cote.onmessage?.({ data }));
brancherIa(cote);
