/**
 * Le chantier : jouer la construction du monde une tranche à la fois
 * (`render3d/chantier.ts`).
 *
 * Tout se teste sans document, sans moteur et sans carte graphique : le module
 * ne sait rien de ce qu'une tranche fabrique, et l'ordonnanceur est de papier.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { jouerTranches, ouvrirChantier, type Tranche } from '../../src/render3d/chantier';

/** Un ordonnanceur de papier : les reprises s'empilent, on les déroule à la main. */
function file(): { planifier(f: () => void): void; deroulerTout(): Promise<void>; enAttente(): number } {
  const attente: (() => void)[] = [];
  return {
    planifier(f): void { attente.push(f); },
    enAttente: (): number => attente.length,
    async deroulerTout(): Promise<void> {
      for (let garde = 0; garde < 1000; garde += 1) {
        // Les promesses des tranches se résolvent sur la microfile : on la
        // laisse s'épuiser **avant** de regarder ce qui est planifié, sinon la
        // reprise d'une tranche qui vient de tenir n'y serait pas encore.
        await Promise.resolve();
        await Promise.resolve();
        const suivante = attente.shift();
        if (!suivante) return;
        suivante();
      }
    },
  };
}

test('les tranches se jouent dans l’ordre, une par tâche', async () => {
  const f = file();
  const joues: number[] = [];
  const tranches: Tranche[] = [0, 1, 2].map((i) => () => { joues.push(i); });
  const chantier = ouvrirChantier(tranches, { planifier: f.planifier });

  assert.deepEqual(joues, [], 'rien n’est joué avant `demarrer`');
  assert.equal(chantier.restantes, 3);
  chantier.demarrer();
  assert.deepEqual(joues, [0], 'une seule tranche par tâche : la page respire entre deux');
  assert.equal(chantier.restantes, 2);
  await f.deroulerTout();
  assert.deepEqual(joues, [0, 1, 2]);
  assert.equal(chantier.restantes, 0);
  assert.equal(chantier.fini, true);
});

test('une tranche qui promet retient la suivante', async () => {
  // C'est ce qui permet au préchauffage de s'intercaler : le sol est bâti, on
  // le chauffe, on le montre, et alors seulement on bâtit le décor.
  const f = file();
  const joues: string[] = [];
  let relacher!: () => void;
  const attente = new Promise<void>((r) => { relacher = r; });
  const chantier = ouvrirChantier([
    () => { joues.push('sol'); },
    async () => { joues.push('chauffe'); await attente; joues.push('chaud'); },
    () => { joues.push('decor'); },
  ], { planifier: f.planifier });

  chantier.demarrer();
  await f.deroulerTout();
  assert.deepEqual(joues, ['sol', 'chauffe'], 'le décor attend que la chauffe tienne');
  assert.equal(f.enAttente(), 0, 'et rien n’est planifié tant qu’elle est en vol');

  relacher();
  await f.deroulerTout();
  assert.deepEqual(joues, ['sol', 'chauffe', 'chaud', 'decor']);
});

test('une promesse rompue n’arrête pas le chantier', async () => {
  // Un préchauffage qui échoue ne coûte qu'une première image plus chère : le
  // monde, lui, doit finir de se bâtir.
  const f = file();
  const joues: string[] = [];
  const chantier = ouvrirChantier([
    () => { joues.push('sol'); },
    () => Promise.reject(new Error('pas de carte graphique')),
    () => { joues.push('decor'); },
  ], { planifier: f.planifier });
  chantier.demarrer();
  await f.deroulerTout();
  assert.deepEqual(joues, ['sol', 'decor']);
});

test('un démontage arrête le chantier avant la tranche suivante', async () => {
  const f = file();
  const joues: number[] = [];
  let vivant = true;
  const chantier = ouvrirChantier([0, 1, 2].map((i) => () => { joues.push(i); }), {
    planifier: f.planifier, vivant: () => vivant,
  });
  chantier.demarrer();
  vivant = false;
  await f.deroulerTout();
  assert.deepEqual(joues, [0], 'la scène est morte : on ne bâtit pas plus loin');
  assert.equal(chantier.fini, false);
});

test('`arreter` fait la même chose, et `restantes` tombe à zéro', async () => {
  const f = file();
  const joues: number[] = [];
  const chantier = ouvrirChantier([0, 1, 2].map((i) => () => { joues.push(i); }), { planifier: f.planifier });
  chantier.demarrer();
  chantier.arreter();
  await f.deroulerTout();
  assert.deepEqual(joues, [0]);
  assert.equal(chantier.restantes, 0);
  assert.equal(chantier.fini, false, 'arrêté n’est pas fini : le monde n’est pas bâti');
});

test('sans ordonnanceur, les tranches s’enchaînent sur la boucle d’événements', async () => {
  const joues: number[] = [];
  const chantier = ouvrirChantier([0, 1].map((i) => () => { joues.push(i); }));
  chantier.demarrer();
  assert.deepEqual(joues, [0]);
  await new Promise((r) => { setTimeout(r, 5); });
  assert.deepEqual(joues, [0, 1]);
});

test('`jouerTranches` tient quand tout est bâti — un chantier dans un chantier', async () => {
  // C'est ainsi que le décor entre dans le chantier principal : il a ses propres
  // tranches, dont le nombre dépend de la carte, et une tranche du chantier
  // principal les joue toutes sans avoir à les connaître ni à en réserver.
  const f = file();
  const joues: string[] = [];
  let fini = false;
  const chantier = ouvrirChantier([
    () => { joues.push('sol'); },
    async () => {
      joues.push('décor:ouvre');
      await jouerTranches([1, 2, 3].map((i) => () => { joues.push(`décor:${i}`); }), { planifier: f.planifier });
      joues.push('décor:pose');
    },
    () => { joues.push('unités'); fini = true; },
  ], { planifier: f.planifier });

  chantier.demarrer();
  await f.deroulerTout();
  assert.deepEqual(joues, ['sol', 'décor:ouvre', 'décor:1', 'décor:2', 'décor:3', 'décor:pose', 'unités']);
  assert.equal(fini, true);
});

test('`jouerTranches` tient aussi quand le chantier s’arrête : rien ne reste en vol', async () => {
  // Sans cela, la tranche qui attend le décor ne rendrait jamais la main, et le
  // chantier principal resterait bloqué sur une scène morte.
  const f = file();
  let vivant = true;
  const joues: number[] = [];
  const attente = jouerTranches([0, 1, 2].map((i) => () => { joues.push(i); }), {
    planifier: f.planifier, vivant: () => vivant,
  });
  vivant = false;
  await f.deroulerTout();
  await attente;
  assert.deepEqual(joues, [0], 'la première était partie, les suivantes non');
});

test('`surFin` ne tombe qu’une fois', async () => {
  const f = file();
  let fins = 0;
  const chantier = ouvrirChantier([() => {}], { planifier: f.planifier, surFin: () => { fins += 1; } });
  chantier.demarrer();
  await f.deroulerTout();
  chantier.arreter();
  await f.deroulerTout();
  assert.equal(fins, 1);
});
