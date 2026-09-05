// Drones, brouilleur mobile et station radar (`04-gameplay.md` §10 bis) :
// catalogue 3 seulement, et un rejeu du catalogue 2 ne les voit jamais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  casesVisibles, chargerCatalogue, cleCase, creerPartie, estBrouillee, RAYON_BROUILLEUR_MOBILE,
  RAYON_STATION_RADAR, VISION_STATION_RADAR, visionUnite,
} from '../../src/engine/index';
import { scenePersonnalisee } from './aides';

const CAT3 = chargerCatalogue(3);
const LARGE = 'P'.repeat(30);

test('le catalogue 2 ignore les drones, le catalogue 3 les porte', () => {
  assert.equal(chargerCatalogue(2).unites['drone'], undefined);
  assert.equal(chargerCatalogue(3).unites['drone']?.cout, 3000);
  assert.equal(chargerCatalogue(3).unites['drone_filaire']?.cout, 12000, 'quatre fois le prix du drone');
});

test('un brouilleur mobile adverse aveugle un drone à dix cases, pas à onze', () => {
  const grille = Array.from({ length: 12 }, () => LARGE);
  const scene = scenePersonnalisee(grille, {}, [
    { camp: 0, type: 'drone', x: 0, y: 0 },
    { camp: 1, type: 'brouilleur', x: RAYON_BROUILLEUR_MOBILE, y: 0 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT3, 'brouillage');
  const drone = e.unites[0]!;
  assert.equal(estBrouillee(e, CAT3, drone), true);
  assert.equal(visionUnite(e, CAT3, drone), 1, 'un dixième de cinq, arrondi, jamais moins d’une case');
  const loin = { ...e, unites: e.unites.map((u) => (u.camp === 1 ? { ...u, x: RAYON_BROUILLEUR_MOBILE + 1 } : u)) };
  assert.equal(estBrouillee(loin, CAT3, drone), false);
  assert.equal(visionUnite(loin, CAT3, drone), 5);
});

test('une station radar adverse brouille à douze cases et voit à cinq pour son propriétaire', () => {
  const grille = Array.from({ length: 12 }, (_, y) => (y === 0 ? 'T' + 'P'.repeat(29) : LARGE));
  const scene = scenePersonnalisee(grille, { '0,0': 1 }, [
    { camp: 0, type: 'drone', x: RAYON_STATION_RADAR, y: 0 },
    { camp: 0, type: 'drone_filaire', x: RAYON_STATION_RADAR - 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 5, y: 5 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT3, 'radar');
  assert.equal(estBrouillee(e, CAT3, e.unites[0]!), true);
  assert.equal(estBrouillee(e, CAT3, e.unites[1]!), false, 'la liaison filaire ne se brouille pas');
  assert.equal(visionUnite(e, CAT3, e.unites[1]!), 5);
  const vues = casesVisibles(e, CAT3, 1);
  assert.ok(vues.has(cleCase({ x: VISION_STATION_RADAR, y: 0 })));
  assert.ok(!vues.has(cleCase({ x: VISION_STATION_RADAR + 1, y: 0 })));
  const neutre = { ...e, proprietaires: {} };
  assert.equal(estBrouillee(neutre, CAT3, e.unites[0]!), false, 'une station neutre ne brouille personne');
});
