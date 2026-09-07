// L'ordre en deux temps (7 septembre 2026 au soir, `04-gameplay.md` §2) : la
// suite `puis` déplace d'abord ; sans embuscade l'unité passe `deplacee` et
// donne sa suite par un second ordre sans chemin ; avec une embuscade, elle
// s'arrête et son tour est fini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliquer, chargerCatalogue, type Action, type EtatPartie, type Suite } from '../../src/engine/index';
import type { Case } from '../../src/schemas/index';
import { partiePersonnalisee, u } from './aides';

const CAT = chargerCatalogue(6);
//               012345
const GRILLE = [
  'PPPCPP',
  'PPPPPP',
  'PPPPPP',
];
const c = (x: number, y: number): Case => ({ x, y });

function ordre(uniteId: string, chemin: Case[], suite: Suite): Action {
  return { type: 'ordre', uniteId, chemin, suite };
}

function exiger(e: EtatPartie, a: Action): EtatPartie {
  const r = appliquer(e, a, CAT);
  assert.ok(r.ok, `refusé : ${r.ok ? '' : `${r.motif} ${r.detail ?? ''}`}`);
  return r.ok ? r.etat : e;
}

function motif(e: EtatPartie, a: Action): string {
  const r = appliquer(e, a, CAT);
  return r.ok ? 'accepté' : r.motif;
}

function depart(): EtatPartie {
  return partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 5, y: 2 },
  ], { brouillard: true, meteoForcee: 'clair' });
}

test('`puis` déplace, laisse la suite à donner, et la suite se donne sans chemin', () => {
  const e1 = exiger(depart(), ordre('u1', [c(0, 0), c(1, 0), c(2, 0), c(3, 0)], { type: 'puis' }));
  const arrivee = u(e1, 'u1');
  assert.deepEqual({ x: arrivee.x, y: arrivee.y }, c(3, 0));
  assert.equal(arrivee.etat, 'deplacee');
  assert.equal(arrivee.pointsCapture, 0, 'rien n’est capturé avant la suite');
  const e2 = exiger(e1, ordre('u1', [c(3, 0)], { type: 'capturer' }));
  assert.ok(u(e2, 'u1').pointsCapture > 0, 'la capture a commencé');
  assert.equal(u(e2, 'u1').etat, 'agi');
  assert.equal(motif(e2, ordre('u1', [c(3, 0)], { type: 'rien' })), 'unite_deja_agi');
});

test('une unité déplacée ne rebouge pas, ne redonne pas `puis`, et un chemin vide vaut sa case', () => {
  const e1 = exiger(depart(), ordre('u1', [c(0, 0), c(1, 0)], { type: 'puis' }));
  assert.equal(motif(e1, ordre('u1', [c(1, 0), c(2, 0)], { type: 'rien' })), 'deja_deplacee');
  assert.equal(motif(e1, ordre('u1', [c(1, 0)], { type: 'puis' })), 'deja_deplacee');
  const e2 = exiger(e1, ordre('u1', [], { type: 'rien' }));
  assert.equal(u(e2, 'u1').etat, 'agi');
});

test('la suite d’une unité déplacée obéit aux règles « après mouvement »', () => {
  const e = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'artillerie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ], { meteoForcee: 'clair' });
  // L'artillerie ne tire pas après avoir bougé : `puis` compte comme un mouvement.
  // Depuis (1,0), la cible est à deux cases, dans sa portée : seul le mouvement l'arrête.
  const e1 = exiger(e, ordre('u1', [c(0, 0), c(1, 0)], { type: 'puis' }));
  assert.equal(motif(e1, ordre('u1', [c(1, 0)], { type: 'attaquer', cible: c(3, 0) })), 'a_bouge');
});

test('une suite jamais donnée est perdue à la fermeture du tour, et l’unité revient prête au tour suivant', () => {
  const e1 = exiger(depart(), ordre('u1', [c(0, 0), c(1, 0)], { type: 'puis' }));
  const e2 = exiger(e1, { type: 'finTour' });
  assert.equal(u(e2, 'u1').etat, 'agi');
  const e3 = exiger(e2, { type: 'finTour' });
  assert.equal(u(e3, 'u1').etat, 'prete');
});

test('avec une embuscade, `puis` s’arrête au contact et le tour de l’unité est fini', () => {
  // L'adverse est à trois cases, hors de la vue d'une infanterie qui voit à deux.
  const e = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ], { brouillard: true, meteoForcee: 'clair' });
  const r = appliquer(e, ordre('u1', [c(0, 0), c(1, 0), c(2, 0), c(3, 0)], { type: 'puis' }), CAT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const surprise = u(r.etat, 'u1');
  assert.deepEqual({ x: surprise.x, y: surprise.y }, c(2, 0));
  assert.equal(surprise.etat, 'agi', 'surprise : on ne joue plus');
  const dep = r.evenements.find((ev) => ev.type === 'deplacement');
  assert.ok(dep && dep.type === 'deplacement' && dep.interrompu);
});
