/**
 * Bout en bout : cinquante parties IA contre IA sur chacune des trois cartes
 * manuelles. Aucune exception, aucun refus, toutes les parties se terminent, et
 * les statistiques restent lisibles (`doc/02-architecture.md` §8, niveau 3).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simuler, chargerCarte } from '../../scripts/simuler';
import type { StrategieIa } from '../../src/schemas/index';

const CARTES = [
  'tests/engine/cartes/plaine.json',
  'tests/engine/cartes/riviere.json',
  'tests/engine/cartes/relief.json',
];

for (const chemin of CARTES) {
  test(`cinquante parties IA contre IA sur ${chemin}`, () => {
    const carte = chargerCarte(chemin);
    const bilan = simuler({
      carte,
      parties: 50,
      graine: 'bout-en-bout',
      strategies: ['ponderee', 'agressive'] as StrategieIa[],
      journees: 25,
      climat: 'tempere',
      saison: null,
      meteo: null,
      brouillard: false,
    });
    const s = bilan.stats;
    assert.equal(s.parties, 50);
    // Toutes les parties sont allées au bout : victoire, mise hors jeu ou points.
    const decidees = s.victoiresCamp.reduce((a, b) => a + b, 0);
    assert.ok(decidees >= 45, `${chemin} : seulement ${decidees} parties décidées`);
    // Personne n'est écrasé par la seule vertu de commencer.
    const part = (s.victoiresCamp[0] ?? 0) / s.parties;
    assert.ok(part > 0.1 && part < 0.9, `${chemin} : taux de victoire ${part}`);
    // Les deux camps produisent, et la carte est parcourue.
    assert.ok(Object.keys(bilan.produites).length >= 2, `${chemin} : production trop pauvre`);
    assert.ok(s.journeesMediane >= 5, `${chemin} : parties trop courtes`);
    assert.ok(s.dureeMoyenneMs < 3000, `${chemin} : ${s.dureeMoyenneMs} ms par partie`);
  });
}
