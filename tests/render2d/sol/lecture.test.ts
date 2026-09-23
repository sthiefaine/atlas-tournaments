// La lecture du terrain : le sol relit la grille logique quand `signatureTerrain`
// bouge, et ne déclare un changement que si une case a vraiment changé — une
// marée oui, un simple lever de jour non.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { copierEtat, terrainLogique } from '../../../src/engine/index';
import { LecteurTerrain, lireGrille } from '../../../src/render2d/sol/lecture';
import { terrainEn } from '../../../src/render2d/sol/grille';
import { cat, partie } from './aides';

/** Une côte bretonne : la mer à une case de la plage découvre à marée basse. */
const COTE = [
  'PPPPP',
  'PSSSP',
  'WWWWW',
  'WWWWW',
];

const MAREES = { cle: 'meca_marees', parametres: { periodeJournees: 1, amplitudeCases: 1, phaseInitiale: 0 } };

test('la grille lue est celle du moteur, pas celle de la carte', () => {
  const e = partie(COTE, { mecanique: MAREES });
  const g = lireGrille(e, cat());
  for (let y = 0; y < e.hauteur; y += 1) {
    for (let x = 0; x < e.largeur; x += 1) {
      assert.equal(terrainEn(g, x, y), terrainLogique(e, cat(), { x, y }) ?? 'plaine', `${x},${y}`);
    }
  }
});

test('une marée se voit, un jour sans marée ne se voit pas', () => {
  const e = partie(COTE, { mecanique: MAREES });
  const lecteur = new LecteurTerrain();
  assert.equal(lecteur.lire(e, cat()), 'premier');
  assert.equal(lecteur.lire(e, cat()), 'rien', 'même état, rien à relire');

  // La marée alterne chaque journée : la rangée de mer au bord de la plage
  // passe de mer à grève. Le moteur écrit sur l'état ; on en fait un neuf.
  const avant = lecteur.grille!;
  const suivant = copierEtat(e);
  suivant.journee += 1;
  const change = lecteur.lire(suivant, cat());
  const apres = lecteur.grille!;
  const rangee = [0, 1, 2, 3, 4].map((x) => [terrainEn(avant, x, 2), terrainEn(apres, x, 2)]);
  const bascule = rangee.some(([a, b]) => a !== b);
  assert.ok(bascule, `la marée n’a rien changé à la rangée 2 : ${JSON.stringify(rangee)}`);
  assert.equal(change, 'terrain');
  // La rangée du large ne découvre jamais : amplitude d'une case.
  assert.equal(terrainEn(apres, 2, 3), 'mer');
});

test('un changement de journée sans effet sur la grille n’est pas un changement', () => {
  const e = partie(['PPP', 'PFP', 'PPP']);
  const lecteur = new LecteurTerrain();
  lecteur.lire(e, cat());
  const grille = lecteur.grille;
  const suivant = copierEtat(e);
  suivant.journee += 3;
  suivant.climat = { ...suivant.climat, meteo: 'neige' };
  assert.equal(lecteur.lire(suivant, cat()), 'rien');
  assert.equal(lecteur.grille, grille, 'la grille d’avant est gardée, identité comprise');
});

test('un terrain posé par le génie change la grille', () => {
  const e = partie(['PVP', 'PVP']);
  const lecteur = new LecteurTerrain();
  lecteur.lire(e, cat());
  const suivant = copierEtat(e);
  suivant.terrainsPoses = [{ case: '1,0', terrain: 'pont', jusqu: null }];
  assert.equal(lecteur.lire(suivant, cat()), 'terrain');
  assert.equal(terrainEn(lecteur.grille!, 1, 0), 'pont');
});

test('une autre carte est un changement de dimensions', () => {
  const lecteur = new LecteurTerrain();
  lecteur.lire(partie(['PP', 'PP']), cat());
  assert.equal(lecteur.lire(partie(['PPP', 'PPP']), cat()), 'dimensions');
});
