// La signature du terrain : le rendu la demande à chaque vue, donc à chaque
// case survolée. Sa seule part qui grandit avec la carte — la grille jointe —
// est mémorisée par identité du tableau ; le reste s'écrit en place sur l'état
// de travail d'une action et doit rester lu à chaque appel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signatureTerrain } from '../../src/engine/index';
import { partiePersonnalisee } from './aides';

/** Une grille dont on compte les jointures : c'est la lecture qu'on veut éviter. */
function grilleEspionne(lignes: string[]): { grille: string[]; jointures(): number } {
  let n = 0;
  const grille = [...lignes];
  Object.defineProperty(grille, 'join', {
    value(this: string[], sep?: string): string {
      n += 1;
      return Array.prototype.join.call(this, sep);
    },
  });
  return { grille, jointures: () => n };
}

test('la signature ne rejoint pas la grille d’un état déjà vu, et change dès qu’un terme change', () => {
  const etat = partiePersonnalisee(['..^^', 'P..~'], {}, []);
  const espion = grilleEspionne(etat.grille);
  etat.grille = espion.grille;
  const premiere = signatureTerrain(etat);
  assert.equal(espion.jointures(), 1, 'la grille est jointe une fois');
  assert.equal(signatureTerrain(etat), premiere);
  assert.equal(signatureTerrain(etat), premiere);
  assert.equal(espion.jointures(), 1, 'jamais deux fois pour le même tableau');
  assert.ok(premiere.includes('..^^/P..~'), 'la grille est bien dans la signature');

  // Ce que le moteur écrit en place sur son état de travail est relu à chaque
  // appel : une journée de plus, une pose de terrain, une donnée de mécanique.
  etat.journee += 1;
  const journee = signatureTerrain(etat);
  assert.notEqual(journee, premiere);
  etat.terrainsPoses.push({ case: '0,0', terrain: 'route', jusqu: null });
  assert.notEqual(signatureTerrain(etat), journee);
  assert.equal(espion.jointures(), 1, 'la grille, elle, n’a pas été rejointe');

  // Un autre tableau au même contenu donne la même signature : la mémoire est
  // une économie, pas une identité.
  const jumeau = { ...etat, grille: [...etat.grille] };
  assert.equal(signatureTerrain(jumeau), signatureTerrain(etat));
  // Et une grille différente, une signature différente.
  assert.notEqual(signatureTerrain({ ...etat, grille: ['^^^^', '....'] }), signatureTerrain(etat));
});
