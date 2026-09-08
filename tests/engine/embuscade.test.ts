// L'embuscade sous brouillard (7 septembre 2026). Une unité adverse **cachée**
// sur l'arrivée d'un déplacement ne vaut pas un refus : refuser dirait au
// joueur qu'elle est là. Le déplacement part, et l'interruption arrête l'unité
// sur la dernière case libre du trajet — jusqu'au départ s'il le faut. Un
// adverse vu, un allié, ou une arrivée occupée sans brouillard restent refusés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquer, brouillardActif, chargerCatalogue, creerPartie, unitesVues,
  type Action, type EtatPartie, type ReglagesPartie,
} from '../../src/engine/index';
import type { Case, CampId, CleUnite } from '../../src/schemas/index';
import { scenePersonnalisee, u } from './aides';

const CAT = chargerCatalogue(6);
const PLAINE = Array.from({ length: 6 }, () => 'P'.repeat(10));

function partie(
  unites: { camp: CampId; type: CleUnite; x: number; y: number }[], reglages: Partial<ReglagesPartie>,
): EtatPartie {
  return creerPartie(scenePersonnalisee(PLAINE, {}, unites, reglages), CAT, 'embuscade');
}

function marche(uniteId: string, ...chemin: Case[]): Action {
  return { type: 'ordre', uniteId, chemin, suite: { type: 'rien' } };
}

const c = (x: number, y: number): Case => ({ x, y });

test('sous brouillard, une unité cachée sur l’arrivée arrête la marche sur la dernière case libre', () => {
  // L'infanterie voit à deux : l'adverse en (3,0) est hors de vue depuis (0,0).
  const e = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ], { brouillard: true });
  assert.equal(brouillardActif(e), true);
  assert.ok(!unitesVues(e, CAT, 0).some((x) => x.id === 'u2'), 'l’adverse est bien caché');

  const r = appliquer(e, marche('u1', c(0, 0), c(1, 0), c(2, 0), c(3, 0)), CAT);
  assert.ok(r.ok, `refusé : ${r.ok ? '' : r.motif}`);
  if (!r.ok) return;
  const marcheur = u(r.etat, 'u1');
  assert.deepEqual({ x: marcheur.x, y: marcheur.y }, c(2, 0), 'arrêtée juste avant l’embuscade');
  assert.equal(marcheur.etat, 'agi');
  const dep = r.evenements.find((ev) => ev.type === 'deplacement');
  assert.ok(dep && dep.type === 'deplacement');
  assert.equal(dep.interrompu, true);
  assert.deepEqual(dep.chemin, [c(0, 0), c(1, 0), c(2, 0)], 'le chemin transmis est celui parcouru');
});

test('sous brouillard, un char aveugle qui vise la case d’une unité cachée s’arrête au contact', () => {
  // Le char lourd voit à une case : à distance 2, l'adverse est caché. Le
  // premier pas le met au contact, et c'est là qu'il s'arrête — jamais sur
  // la case occupée. Au tour suivant l'adverse est vu, et viser sa case
  // redevient un refus ordinaire.
  const e = partie([
    { camp: 0, type: 'char_lourd', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 2, y: 0 },
  ], { brouillard: true });
  assert.ok(!unitesVues(e, CAT, 0).some((x) => x.id === 'u2'), 'l’adverse est bien caché');
  const r = appliquer(e, marche('u1', c(0, 0), c(1, 0), c(2, 0)), CAT);
  assert.ok(r.ok, `refusé : ${r.ok ? '' : r.motif}`);
  if (!r.ok) return;
  const marcheur = u(r.etat, 'u1');
  // (1,0) est à distance 1 de l'adverse : la surprise tombe dès le premier pas,
  // et cette case est libre — on s'y arrête.
  assert.deepEqual({ x: marcheur.x, y: marcheur.y }, c(1, 0));
  assert.equal(marcheur.etat, 'agi');

  // Au contact, l'adverse est vu : depuis (1,0), sa case est un refus franc.
  assert.ok(unitesVues(r.etat, CAT, 0).some((x) => x.id === 'u2'));
  const suite = { ...r.etat, unites: r.etat.unites.map((x) => (x.id === 'u1' ? { ...x, etat: 'prete' as const } : x)) };
  const r2 = appliquer(suite, marche('u1', c(1, 0), c(2, 0)), CAT);
  assert.equal(r2.ok ? '' : r2.motif, 'case_occupee');
});

test('sans brouillard, ou face à un adverse vu, une arrivée occupée reste refusée', () => {
  // L'hélicoptère ignore la zone de contrôle : le refus vient bien de la case.
  const clair = partie([
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ], { brouillard: false });
  const r = appliquer(clair, marche('u1', c(0, 0), c(1, 0), c(2, 0), c(3, 0)), CAT);
  assert.equal(r.ok, false);
  assert.equal(r.ok ? '' : r.motif, 'case_occupee');

  // Sous brouillard mais à portée de vue (l'hélicoptère voit à trois) : refus aussi.
  const vu = partie([
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
  ], { brouillard: true });
  assert.ok(unitesVues(vu, CAT, 0).some((x) => x.id === 'u2'));
  const r2 = appliquer(vu, marche('u1', c(0, 0), c(1, 0), c(2, 0), c(3, 0)), CAT);
  assert.equal(r2.ok ? '' : r2.motif, 'case_occupee');
});

test('un allié sur l’arrivée est un refus, brouillard ou non : on ne planifie pas sur quelqu’un', () => {
  const e = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 0, type: 'infanterie', x: 2, y: 0 },
    // Un adverse loin de tout, pour que la partie ne soit pas finie avant de commencer.
    { camp: 1, type: 'infanterie', x: 9, y: 5 },
  ], { brouillard: true });
  const r = appliquer(e, marche('u1', c(0, 0), c(1, 0), c(2, 0)), CAT);
  assert.equal(r.ok ? '' : r.motif, 'case_occupee');
});

test('passer devant une unité cachée ne coupe plus la course : il faut la heurter', () => {
  // Le 8 septembre 2026, le propriétaire allait tout droit ; une unité cachée
  // se tenait **à sa droite**, sans jamais barrer sa route, et sa course
  // s'arrêtait quand même. La règle disait « sur le chemin ou à côté » ; « à
  // côté » est retiré. On s'arrête quand on se cogne dedans, pas quand on passe.
  const e = partie([
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    // Une case au sud de (2,0), donc voisine du trajet, jamais dessus.
    { camp: 1, type: 'infanterie', x: 2, y: 1 },
  ], { brouillard: true });
  assert.ok(!unitesVues(e, CAT, 0).some((x) => x.id === 'u2'), 'l’adverse est bien caché');

  const r = appliquer(e, marche('u1', c(0, 0), c(1, 0), c(2, 0), c(3, 0)), CAT);
  assert.ok(r.ok, `refusé : ${r.ok ? '' : r.motif}`);
  if (!r.ok) return;
  const marcheur = u(r.etat, 'u1');
  assert.deepEqual({ x: marcheur.x, y: marcheur.y }, c(3, 0), 'la course va jusqu’au bout');
  const dep = r.evenements.find((ev) => ev.type === 'deplacement');
  assert.ok(dep && dep.type === 'deplacement');
  assert.equal(dep.interrompu, false, 'rien n’a interrompu la marche');
});
