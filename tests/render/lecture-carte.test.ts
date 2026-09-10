// Ce que la carte lit de l'état sans que ce soit une règle : l'usine sous
// impulsion (`render/iem.ts`), qui suit le registre du moteur. Le radar, lui,
// ne rapporte rien à la carte (10 septembre 2026, retiré).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue, cleCase, verifierProduction, type EtatPartie } from '../../src/engine/index';
import { casesUsinesIem, usineSousIem } from '../../src/render/iem';
import { partiePersonnalisee } from '../engine/aides';

const CAT = chargerCatalogue();

/** Deux QG, une usine au camp 0, une usine au camp 1. */
function partie(): EtatPartie {
  return partiePersonnalisee(
    ['HUTPP', 'PPPPP', 'PPUPH'],
    { '0,0': 0, '1,0': 0, '2,0': 0, '2,2': 1, '4,2': 1 },
    [{ camp: 0, type: 'infanterie', x: 0, y: 1 }, { camp: 1, type: 'infanterie', x: 4, y: 1 }],
  );
}

test('une usine n’est sous impulsion que tant que le registre la porte, et c’est le verdict du moteur', () => {
  const etat = partie();
  const usine = { x: 1, y: 0 };
  assert.equal(usineSousIem(etat, CAT, usine), false);
  assert.deepEqual(casesUsinesIem(etat, CAT), []);
  const touchee: EtatPartie = { ...etat, usinesIem: { [cleCase(usine)]: etat.journee } };
  assert.equal(usineSousIem(touchee, CAT, usine), true);
  assert.equal(usineSousIem(touchee, CAT, { x: 2, y: 2 }), false, 'l’autre usine n’est pas touchée');
  assert.deepEqual(casesUsinesIem(touchee, CAT), [cleCase(usine)]);
  // La même lecture que le moteur : la production y est refusée `usine_iem`.
  const verdict = verifierProduction(touchee, CAT, 0, usine, 'infanterie');
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.motif, 'usine_iem');
  // Une entrée hors carte ne marque rien.
  assert.deepEqual(casesUsinesIem({ ...etat, usinesIem: { '9,9': 1 } }, CAT), []);
});
