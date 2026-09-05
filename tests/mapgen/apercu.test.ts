// L'aperçu texte est ce que la routine map reçoit pour commenter une carte
// (`05-routines.md` §3.3) : il doit porter la grille dans l'alphabet du schéma,
// sa légende, et les propriétaires comme les unités de départ en clair.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apercuTexte, genererCarte } from '../../src/mapgen/index';
import { CARACTERE_PAR_TERRAIN, type ParametresCarte } from '../../src/schemas/types';

const parametres: ParametresCarte = {
  largeur: 18,
  hauteur: 14,
  camps: 2,
  biome: 'cotier',
  ratioMer: 0.28,
  ratioRelief: 0.2,
  villesParCamp: 3,
  villesNeutres: 2,
  usinesParCamp: 1,
  aeroportsParCamp: 1,
  symetrie: 'point',
  densiteRoutes: 0.6,
  mecanique: 'meca_marees',
};

const carte = genererCarte(parametres, 606);
const texte = apercuTexte(carte);

test('l\'aperçu contient la grille, ligne pour ligne', () => {
  for (const ligne of carte.grille) assert.ok(texte.includes(ligne), `ligne absente : ${ligne}`);
});

test('l\'aperçu n\'emploie que les caractères de grille connus', () => {
  const connus = new Set(Object.values(CARACTERE_PAR_TERRAIN));
  const presents = new Set<string>();
  for (const ligne of carte.grille) for (const car of ligne) presents.add(car);
  for (const car of presents) assert.ok(connus.has(car), `caractère inconnu : ${car}`);
  // Une carte côtière porte au moins mer, plaine, ville et QG.
  for (const car of ['W', 'P', 'C', 'H']) assert.ok(presents.has(car), `caractère attendu : ${car}`);
});

test('la légende nomme chaque caractère présent', () => {
  const presents = new Set<string>();
  for (const ligne of carte.grille) for (const car of ligne) presents.add(car);
  const legende = texte.split('\n').find((l) => l.startsWith('Légende :'));
  assert.ok(legende, 'une ligne de légende est présente');
  for (const car of presents) {
    assert.ok(legende.includes(`${car} `), `légende sans entrée pour ${car} : ${legende}`);
  }
  assert.ok(legende.includes('W mer'));
  assert.ok(legende.includes('P plaine'));
});

test('propriétaires et unités de départ figurent en clair', () => {
  assert.ok(texte.includes('Propriétaires'));
  assert.ok(texte.includes('Unités de départ'));
  for (const [clef, camp] of Object.entries(carte.proprietaires)) {
    const [x, y] = clef.split(',');
    assert.ok(texte.includes(`(${x},${y})`), `propriété ${clef} absente de l'aperçu`);
    assert.ok(texte.includes(`camp ${camp} :`));
  }
  for (const unite of carte.unitesDepart) {
    assert.ok(texte.includes(`${unite.type} (${unite.x},${unite.y})`),
      `unité ${unite.type} en ${unite.x},${unite.y} absente`);
  }
  assert.ok(texte.includes('neutres :'));
});

test('l\'en-tête porte le nom, la graine et la mécanique', () => {
  assert.ok(texte.includes(carte.code));
  assert.ok(texte.includes('meca_marees'));
  assert.ok(texte.includes(`graine ${carte.generation?.graine ?? ''}`));
  assert.ok(texte.includes(`${carte.largeur}×${carte.hauteur}`));
});

test('les mesures d\'équilibre sont publiées', () => {
  const ligne = texte.split('\n').find((l) => l.startsWith('Mesures :'));
  assert.ok(ligne, 'une ligne de mesures est présente');
  for (const clef of ['cases_jouables', 'distance_qg_qg', 'zones_mortes', 'asymetrie_de_valeur']) {
    assert.ok(ligne.includes(`${clef}=`), `mesure absente : ${clef}`);
  }
});
