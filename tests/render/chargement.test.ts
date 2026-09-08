// L'écran de chargement d'une mission ne doit dire que des choses vraies, et
// `monterJeu` doit lancer le moteur graphique **avant** de faire travailler le
// moteur de règles. Ces deux promesses se vérifient sans DOM : la première est
// une fonction pure, la seconde s'observe en faisant échouer la mise en place
// juste après la fabrique de la peau.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etapeChargement, monterJeu, type OptionsJeu } from '../../src/render/jeu';
import type { MesuresRendu, Rendu } from '../../src/render/rendu';
import type { Catalogue } from '../../src/engine/index';
import type { MapDef, Scenario } from '../../src/schemas/types';

/** Des mesures de peau, réduites à ce que l'étape de chargement regarde. */
function mesures(partiel: Partial<MesuresRendu>): MesuresRendu {
  return {
    triangles: 0, appels: 0, msParImage: 0, composeur: false,
    msCalibration: null, backend: null, ...partiel,
  };
}

test('l’étape de chargement ne se lit que sur les compteurs de la peau', () => {
  // Pas de moteur démarré : on attend le moteur.
  assert.equal(etapeChargement(mesures({ backend: null })), 'moteur');
  // Le moteur est là, aucune image envoyée : on attend la première image.
  assert.equal(etapeChargement(mesures({ backend: 'webgpu', appels: 0 })), 'image');
  // Une image est passée : le plateau est réellement à l'écran.
  assert.equal(etapeChargement(mesures({ backend: 'webgpu', appels: 94 })), 'pret');
  assert.equal(etapeChargement(mesures({ backend: 'webgl', appels: 1 })), 'pret');
});

test('une peau qui ne sait pas mesurer est déclarée prête, jamais retenue', () => {
  // Le pire des mensonges serait un voile qu'on ne peut plus lever : une peau
  // muette rend la vue tout de suite.
  assert.equal(etapeChargement(null), 'pret');
  assert.equal(etapeChargement(undefined), 'pret');
});

/** Une peau qui ne fait rien, et qui note ce qu'on lui a demandé. */
function peauMuette(): { rendu: Rendu; journal: string[] } {
  const journal: string[] = [];
  const rendu = {
    cle: '3d' as const,
    canvas: null,
    monter: () => { journal.push('monter'); },
    afficher: () => undefined,
    animer: () => Promise.resolve(),
    versMonde: () => null,
    versEcran: () => null,
    brancher: () => () => undefined,
    msParImage: () => 0,
    capturer: () => null,
    cadrer: () => undefined,
    recentrer: () => undefined,
    zoomer: () => undefined,
    demonter: () => { journal.push('demonter'); },
  } as unknown as Rendu;
  return { rendu, journal };
}

test('le moteur graphique est lancé avant que le moteur de règles ne travaille', () => {
  const { rendu, journal } = peauMuette();
  // Le catalogue est la toute première chose que la mise en place demandait ;
  // il explose ici. Si la peau était fabriquée après lui, rien ne serait monté.
  const options = {
    scenario: { code: 'essai', catalogueVersion: 1 } as unknown as Scenario,
    carte: {} as MapDef,
    get catalogue(): Catalogue { throw new Error('canon illisible'); },
    fabriqueRendu: () => { journal.push('fabrique'); return rendu; },
  } as unknown as OptionsJeu;

  assert.throws(() => monterJeu({ style: {} } as unknown as HTMLElement, options), /canon illisible/);
  // Fabriquée, montée, puis démontée : une mise en place qui échoue ne laisse
  // pas un moteur graphique et sa boucle derrière elle.
  assert.deepEqual(journal, ['fabrique', 'monter', 'demonter']);
});

test('sans fabrique de rendu, on lève avant de toucher au conteneur', () => {
  assert.throws(
    () => monterJeu({ style: {} } as unknown as HTMLElement, {
      scenario: { code: 'essai', catalogueVersion: 1 } as unknown as Scenario,
      carte: {} as MapDef,
    }),
    /aucune fabrique de rendu/,
  );
});
