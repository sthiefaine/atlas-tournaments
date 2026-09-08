// Le bouton Campagne de l'écran-titre : où il mène, ce qu'il compte, ce qu'il
// dit. La seule subtilité est le `null` — « pas encore lu » — qui doit rendre
// exactement le même neutre que le rendu du serveur, jamais un « 0 sur 6 » qui
// serait faux pour qui a déjà tout remporté.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  destinationCampagne, nombreGagnees, prochaineEpreuve, sousLigneCampagne,
  type Epreuve,
} from '../../src/app/accueil-campagne';

const EPREUVES: Epreuve[] = [
  { cle: 'un', titre: 'Entraînement 1 · Premier contact' },
  { cle: 'deux', titre: 'Entraînement 2 · Les villes' },
  { cle: 'trois', titre: 'Qualification' },
];

const LIBELLES = {
  neuf: 'Trois épreuves · commencez ici',
  fini: 'Tout remporté',
  etat: ['zéro', '1/3 · Les villes', '2/3 · Qualification', 'trois'],
};

test('le compte ne retient que les épreuves de la campagne, et rien tant que rien n’est lu', () => {
  assert.equal(nombreGagnees(EPREUVES, null), 0);
  assert.equal(nombreGagnees(EPREUVES, []), 0);
  assert.equal(nombreGagnees(EPREUVES, ['un', 'deux']), 2);
  // Une victoire sur une partie libre ne compte pas comme une épreuve.
  assert.equal(nombreGagnees(EPREUVES, ['un', 'bras_de_mer']), 1);
});

test('la prochaine épreuve est la première non remportée, dans l’ordre du canon', () => {
  assert.equal(prochaineEpreuve(EPREUVES, [])?.cle, 'un');
  assert.equal(prochaineEpreuve(EPREUVES, ['un'])?.cle, 'deux');
  // Un trou dans la progression ne saute pas l'épreuve manquante.
  assert.equal(prochaineEpreuve(EPREUVES, ['deux'])?.cle, 'un');
  assert.equal(prochaineEpreuve(EPREUVES, ['un', 'deux', 'trois']), null);
  assert.equal(prochaineEpreuve(EPREUVES, null), null);
});

test('la destination est vraie avant même que le navigateur ait parlé', () => {
  // Le neutre du serveur : le carnet mène quelque part dans tous les cas.
  assert.equal(destinationCampagne(EPREUVES, null), '/campagne');
  assert.equal(destinationCampagne(EPREUVES, []), '/jeu/un');
  assert.equal(destinationCampagne(EPREUVES, ['un', 'deux']), '/jeu/trois');
  assert.equal(destinationCampagne(EPREUVES, ['un', 'deux', 'trois']), '/campagne');
});

test('la sous-ligne dit « commencez ici », l’épreuve en cours, ou « tout remporté »', () => {
  assert.equal(sousLigneCampagne(LIBELLES, EPREUVES, null), LIBELLES.neuf);
  assert.equal(sousLigneCampagne(LIBELLES, EPREUVES, []), LIBELLES.neuf);
  assert.equal(sousLigneCampagne(LIBELLES, EPREUVES, ['un']), '1/3 · Les villes');
  assert.equal(sousLigneCampagne(LIBELLES, EPREUVES, ['un', 'deux', 'trois']), LIBELLES.fini);
  // Un tableau d'états trop court ne laisse jamais la ligne vide.
  assert.equal(sousLigneCampagne({ ...LIBELLES, etat: [] }, EPREUVES, ['un']), LIBELLES.neuf);
});
