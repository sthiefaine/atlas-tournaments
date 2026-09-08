// Le fil de la campagne calcule trois choses, et elles se vérifient sans React
// ni DOM : l'état d'une station, celle qui s'ouvre à l'arrivée, et le nom court
// d'une épreuve. Le canon est lu sur le disque, comme la page le lit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etatStation, nomCourt, stationParDefaut } from '../../src/app/campagne/itineraire';
import campagne from '../../content/campagne.json';

const codes = campagne.missions.map((m) => m.scenarioCle);

test('le nom court d’une épreuve garde ce qui suit le dernier point médian', () => {
  assert.equal(nomCourt('Entraînement 1 · Premier contact'), 'Premier contact');
  assert.equal(nomCourt('Les villes du bocage'), 'Les villes du bocage');
  assert.equal(nomCourt('A · B · C'), 'C');
  // Un titre qui finirait par un point médian garderait le titre entier plutôt
  // que de rendre une station sans nom.
  assert.equal(nomCourt('Sans suite ·'), 'Sans suite ·');
  assert.equal(nomCourt('  espacé  '), 'espacé');
  // Et sur le vrai canon : aucune station ne se retrouve sans nom.
  for (const m of campagne.missions) assert.notEqual(nomCourt(m.titre), '');
});

test('avant la lecture du navigateur, la première épreuve est ouverte et les autres attendent', () => {
  // Le rendu du serveur n'affirme que ce qui est vrai dans tous les cas : une
  // progression annoncée puis démentie se lirait comme une progression perdue.
  assert.equal(etatStation(codes, 0, [], false), 'ouverte');
  for (let i = 1; i < codes.length; i += 1) {
    assert.equal(etatStation(codes, i, [], false), 'verrouillee');
  }
  // Même pour qui a tout remporté : ce qu'on sait déjà se dit quand même.
  assert.equal(etatStation(codes, 3, codes, false), 'gagnee');
});

test('une épreuve s’ouvre quand la précédente est remportée, et pas avant', () => {
  const victoires = [codes[0]!, codes[1]!];
  assert.equal(etatStation(codes, 0, victoires, true), 'gagnee');
  assert.equal(etatStation(codes, 1, victoires, true), 'gagnee');
  assert.equal(etatStation(codes, 2, victoires, true), 'ouverte');
  assert.equal(etatStation(codes, 3, victoires, true), 'verrouillee');
  // Une victoire prise dans le désordre — une sauvegarde bricolée — n'ouvre pas
  // la porte d'à côté : c'est la précédente qui décide, jamais la sienne.
  assert.equal(etatStation(codes, 5, [codes[5]!], true), 'gagnee');
  assert.equal(etatStation(codes, 4, [codes[5]!], true), 'verrouillee');
  // Hors des bornes, rien ne s'ouvre.
  assert.equal(etatStation(codes, codes.length, victoires, true), 'verrouillee');
  assert.equal(etatStation(codes, -1, victoires, true), 'verrouillee');
});

test('la station ouverte à l’arrivée est la prochaine à jouer, et la première une fois tout remporté', () => {
  assert.equal(stationParDefaut(codes, []), 0);
  assert.equal(stationParDefaut(codes, [codes[0]!, codes[1]!]), 2);
  assert.equal(stationParDefaut(codes, codes), 0, 'plus de prochaine : on revient au début');
  // Une victoire dans le désordre ne fait pas sauter les épreuves d'avant.
  assert.equal(stationParDefaut(codes, [codes[3]!]), 0);
});
