// Drones, brouilleur mobile et station radar (`04-gameplay.md` §10 bis) :
// catalogue 3 seulement, et un rejeu du catalogue 2 ne les voit jamais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquer, casesVisibles, chargerCatalogue, cleCase, creerPartie, estBrouillee, RAYON_BROUILLEUR_MOBILE,
  RAYON_STATION_RADAR, VISION_STATION_RADAR, visionUnite,
} from '../../src/engine/index';
import { scenePersonnalisee } from './aides';

const CAT3 = chargerCatalogue(3);
const LARGE = 'P'.repeat(30);

test('le catalogue 2 ignore les drones, le catalogue 3 les porte', () => {
  assert.equal(chargerCatalogue(2).unites['drone'], undefined);
  assert.equal(chargerCatalogue(3).unites['drone']?.cout, 3000);
  // Le char moyen entre au 4 : le catalogue 3 ne le voit pas plus que le 2 ne voit le drone.
  assert.equal(chargerCatalogue(3).unites['char_moyen'], undefined);
  assert.equal(chargerCatalogue(4).unites['char_moyen']?.cout, 10000);
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
    { camp: 0, type: 'helico', x: RAYON_STATION_RADAR - 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 5, y: 5 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT3, 'radar');
  assert.equal(estBrouillee(e, CAT3, e.unites[0]!), true);
  // Le brouillage n'agit que sur le trait `drone` : un autre œil volant voit comme avant.
  assert.equal(estBrouillee(e, CAT3, e.unites[1]!), false, 'sans le trait drone, rien ne se brouille');
  assert.equal(visionUnite(e, CAT3, e.unites[1]!), CAT3.unites['helico']!.vision);
  const vues = casesVisibles(e, CAT3, 1);
  assert.ok(vues.has(cleCase({ x: VISION_STATION_RADAR, y: 0 })));
  assert.ok(!vues.has(cleCase({ x: VISION_STATION_RADAR + 1, y: 0 })));
  const neutre = { ...e, proprietaires: {} };
  assert.equal(estBrouillee(neutre, CAT3, e.unites[0]!), false, 'une station neutre ne brouille personne');
});

test('un drone mis hors jeu au-dessus d’un bâtiment adverse révèle la production de ce camp', () => {
  // L'antiaérien du camp 1 abat le drone du camp 0 posé sur la ville du camp 1.
  const scene = scenePersonnalisee(['HPPPH', 'PPCPP'], { '0,0': 0, '4,0': 1, '2,1': 1 }, [
    { camp: 0, type: 'drone', x: 2, y: 1 },
    { camp: 1, type: 'antiair', x: 3, y: 1 },
  ]);
  let e = creerPartie(scene, CAT3, 'test');
  e.produites = { '1:infanterie': 3, '1:char_leger': 1, '0:recon': 2 };
  let r = appliquer(e, { type: 'finTour' }, CAT3);
  assert.ok(r.ok); e = r.etat;
  r = appliquer(e, { type: 'ordre', uniteId: 'u2', chemin: [{ x: 3, y: 1 }], suite: { type: 'attaquer', cible: { x: 2, y: 1 } } }, CAT3);
  assert.ok(r.ok); e = r.etat;
  assert.ok(!e.unites.some((u) => u.id === 'u1'), 'le drone est hors jeu');
  const revelation = e.journal.find((ev) => ev.type === 'production_revelee');
  assert.ok(revelation && revelation.type === 'production_revelee');
  assert.equal(revelation.camp, 0);
  assert.equal(revelation.proprietaire, 1);
  assert.deepEqual(revelation.produites, { infanterie: 3, char_leger: 1 }, 'seule la production du propriétaire est lue');
});

test('un drone abattu sur une case sans bâtiment adverse ne révèle rien', () => {
  const scene = scenePersonnalisee(['HPPPH', 'PPPPP'], { '0,0': 0, '4,0': 1 }, [
    { camp: 0, type: 'drone', x: 2, y: 1 },
    { camp: 1, type: 'antiair', x: 3, y: 1 },
  ]);
  let e = creerPartie(scene, CAT3, 'test');
  let r = appliquer(e, { type: 'finTour' }, CAT3);
  assert.ok(r.ok); e = r.etat;
  r = appliquer(e, { type: 'ordre', uniteId: 'u2', chemin: [{ x: 3, y: 1 }], suite: { type: 'attaquer', cible: { x: 2, y: 1 } } }, CAT3);
  assert.ok(r.ok); e = r.etat;
  assert.ok(!e.journal.some((ev) => ev.type === 'production_revelee'));
});
