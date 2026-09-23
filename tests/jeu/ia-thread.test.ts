// Le même protocole dans un **vrai** thread (`worker_threads`) : ses propres
// instances de modules — les mémoires du moteur et de l'IA, attachées aux
// objets comme aux signatures de terrain, y partent froides et n'y voient
// rien du thread du test —, et le clonage structuré de V8 entre les deux. Le
// faux worker de `ia-en-fond.test.ts` partage le processus ; celui-ci non.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

import { creerAdversaireEnFond, type RaisonRepli, type WorkerIa } from '../../src/app/jeu/adversaire-fond';
import type { MessageDepuisIa } from '../../src/app/jeu/ia.worker';
import { preparerPartie, toursIa, type TourIa } from './aides';

/** Un vrai thread, vu par l'adversaire en fond comme un `Worker` du navigateur. */
function vraiThread(): { worker: WorkerIa; fini: Promise<void> } {
  const fil = new Worker(new URL('./fil-ia.mjs', import.meta.url));
  const worker: WorkerIa = {
    onmessage: null, onerror: null, onmessageerror: null,
    postMessage: (message) => fil.postMessage(message),
    terminate: () => { void fil.terminate(); },
  };
  fil.on('message', (data: MessageDepuisIa) => worker.onmessage?.({ data }));
  fil.on('error', (erreur) => worker.onerror?.(erreur));
  fil.on('messageerror', (erreur) => worker.onmessageerror?.(erreur));
  const fini = new Promise<void>((resoudre) => { fil.once('exit', () => resoudre()); });
  return { worker, fini };
}

test('dans un vrai thread, la même suite que sur le fil principal : pouvoirs de la faction, embarquement', async () => {
  // Deux parties suffisent ici — le faux worker couvre le reste — : chaque
  // thread neuf recharge le moteur et l'IA par tsx, et cela se paie.
  const parties: { code: string; jusqua: number; garder: (t: TourIa) => boolean }[] = [
    // La Forge : le premier pouvoir de Basile tombe à la journée 6, sous brouillard.
    { code: 'aube_superusine', jusqua: 6, garder: (t) => t.journee >= 4 },
    // Le drone marin : l'agressive embarque et déclenche son pouvoir à la journée 13.
    { code: 'aube_drone_marin', jusqua: 13, garder: (t) => t.journee >= 11 },
  ];
  let compares = 0;
  let pouvoirs = 0;
  let embarquements = 0;
  for (const { code, jusqua, garder } of parties) {
    const p = preparerPartie(code);
    const tours = toursIa(p, jusqua).filter(garder);
    const threads: { fini: Promise<void> }[] = [];
    const replis: RaisonRepli[] = [];
    const fond = creerAdversaireEnFond(p.strategie, p.scenario.catalogueVersion, p.commandants, p.strategiesParCamp, {
      creerWorker: () => {
        const t = vraiThread();
        threads.push(t);
        return t.worker;
      },
      surRepli: (r) => { replis.push(r); },
      // Un thread neuf charge le moteur et l'IA par tsx : quelques secondes au
      // repos, bien plus quand la suite entière tourne sur une machine chargée.
      msDemarrage: 120_000,
      msSilence: 120_000,
    });
    for (const tour of tours) {
      assert.deepEqual(await fond.adversaire(tour.etat), tour.attendu, `${code}, journée ${tour.journee}, camp ${tour.camp}`);
      compares += 1;
      if (tour.attendu.some((a) => a.type === 'pouvoir')) pouvoirs += 1;
      if (tour.attendu.some((a) => a.type === 'ordre' && a.suite.type === 'embarquer')) embarquements += 1;
    }
    assert.equal(fond.mode, 'worker', `${code} : jamais de repli (${replis.join(', ')})`);
    fond.fermer();
    // `fermer` arrête le thread pour de bon.
    await threads[0]!.fini;
  }
  assert.ok(compares >= 5, `${compares} tours comparés`);
  assert.ok(pouvoirs >= 2, `${pouvoirs} tours avec pouvoir`);
  assert.ok(embarquements >= 1, `${embarquements} tours avec embarquement`);
});
