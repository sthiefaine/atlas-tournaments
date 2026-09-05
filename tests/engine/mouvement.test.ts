/**
 * Mouvement : coûts par type et terrain, franchissabilité, Dijkstra, zone de
 * contrôle, carburant, et refus motivés (`doc/04-gameplay.md` §2 et §4).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, casesAtteignables, cheminVers, coutEntree, coutVers, pointsMouvement,
  portee, verifierChemin,
} from '../../src/engine/index';
import type { Case } from '../../src/schemas/index';
import { CAT, partiePersonnalisee, u } from './aides';

//         0123456789
const GRILLE = [
  'PPFMVRPPPH',
  'PPPPVRPPPP',
  'PPPPNRPPPP',
  'PPPPVRPPPP',
  'PPPPVRPPPP',
  'HPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

test('les coûts de terrain sont ceux de la table du §4', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'char_leger', x: 9, y: 9 },
  ]);
  const inf = u(etat, 'u1');
  const char = u(etat, 'u2');
  assert.equal(coutEntree(etat, CAT, inf, { x: 0, y: 1 }), 1); // plaine, pied
  assert.equal(coutEntree(etat, CAT, inf, { x: 2, y: 0 }), 1); // forêt, pied
  assert.equal(coutEntree(etat, CAT, inf, { x: 3, y: 0 }), 2); // montagne, pied
  assert.equal(coutEntree(etat, CAT, inf, { x: 4, y: 0 }), 2); // rivière, pied
  assert.equal(coutEntree(etat, CAT, inf, { x: 5, y: 0 }), 1); // route, pied
  assert.equal(coutEntree(etat, CAT, char, { x: 2, y: 0 }), 2); // forêt, chenilles
  assert.equal(coutEntree(etat, CAT, char, { x: 3, y: 0 }), null); // montagne interdite
  assert.equal(coutEntree(etat, CAT, char, { x: 4, y: 0 }), null); // rivière interdite
  assert.equal(coutEntree(etat, CAT, char, { x: 4, y: 2 }), 1); // pont franchissable
});

test("la méca traverse la montagne et la rivière grâce à `tout_terrain`", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'meca', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const meca = u(etat, 'u1');
  assert.equal(coutEntree(etat, CAT, meca, { x: 3, y: 0 }), 1);
  assert.equal(coutEntree(etat, CAT, meca, { x: 4, y: 0 }), 1);
});

test("la portée s'arrête au budget de mouvement", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 6 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const inf = u(etat, 'u1');
  assert.equal(pointsMouvement(etat, CAT, inf), 3);
  const p = portee(etat, CAT, inf);
  assert.equal(coutVers(p, { x: 4, y: 6 }), 3);
  assert.equal(coutVers(p, { x: 5, y: 6 }), null);
  // Toutes les cases atteignables coûtent au plus 3.
  for (const c of casesAtteignables(p)) assert.ok((coutVers(p, c) ?? 9) <= 3);
});

test('le chemin reconstruit est contigu et part de la case de départ', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const p = portee(etat, CAT, u(etat, 'u1'));
  const chemin: Case[] | null = cheminVers(p, { x: 6, y: 6 }, { x: 8, y: 8 });
  assert.ok(chemin !== null);
  const cases: Case[] = chemin ?? [];
  assert.deepEqual(cases[0], { x: 6, y: 6 });
  for (let i = 1; i < cases.length; i += 1) {
    const a = cases[i - 1] ?? { x: 0, y: 0 };
    const b = cases[i] ?? { x: 0, y: 0 };
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1);
  }
});

test('la zone de contrôle arrête une unité qui longe un adversaire', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 8, y: 7 },
  ]);
  const chemin = [
    { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 },
  ];
  const v = verifierChemin(etat, CAT, u(etat, 'u1'), chemin);
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.motif, 'zone_de_controle');
  // S'arrêter sur la case de contrôle reste permis.
  const court = verifierChemin(etat, CAT, u(etat, 'u1'), chemin.slice(0, 3));
  assert.equal(court.ok, true);
});

test('un chemin non contigu, trop cher ou occupé est refusé avec un motif', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 0, y: 9 },
  ]);
  const inf = u(etat, 'u1');
  const saut = verifierChemin(etat, CAT, inf, [{ x: 6, y: 6 }, { x: 8, y: 6 }]);
  assert.equal(saut.ok === false && saut.motif, 'chemin_invalide');
  const trop = verifierChemin(etat, CAT, inf, [
    { x: 6, y: 6 }, { x: 6, y: 7 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 },
  ]);
  assert.equal(trop.ok === false && trop.motif, 'chemin_trop_cher');
  const ailleurs = verifierChemin(etat, CAT, inf, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
  assert.equal(ailleurs.ok === false && ailleurs.motif, 'chemin_invalide');
});

test('le déplacement consomme du carburant et refuse au-delà', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 0, y: 9 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1',
    chemin: [{ x: 6, y: 6 }, { x: 6, y: 7 }, { x: 6, y: 8 }],
    suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // Deux cases de plaine à 2 points de mouvement chacune pour des roues.
  assert.equal(u(r.etat, 'u1').carburant, 76);
  assert.equal(u(r.etat, 'u1').x, 6);
  assert.equal(u(r.etat, 'u1').y, 8);
});

test("une unité qui a déjà agi ne reçoit pas d'autre ordre", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 0, y: 9 },
  ]);
  const premier = appliquer(etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 6, y: 6 }, { x: 6, y: 7 }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(premier.ok, true);
  if (!premier.ok) return;
  const second = appliquer(premier.etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 6, y: 7 }, { x: 6, y: 8 }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.motif, 'unite_deja_agi');
});

test("une unité adverse n'obéit pas", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 0, y: 9 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u2', chemin: [{ x: 0, y: 9 }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok === false && r.motif, 'pas_mon_unite');
});

test("l'hélicoptère ignore le terrain et la zone de contrôle", () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'helico', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ]);
  const helico = u(etat, 'u1');
  assert.equal(coutEntree(etat, CAT, helico, { x: 3, y: 0 }), 1);
  const v = verifierChemin(etat, CAT, helico, [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
  ]);
  assert.equal(v.ok, true);
});

// ---------------------------------------------------------------------------
// L'événement de déplacement porte le chemin réellement parcouru
// ---------------------------------------------------------------------------

test('un déplacement annonce le chemin validé, case par case', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  // Un détour : la montagne en (3,0) est infranchissable à pied, on passe dessous.
  const chemin: Case[] = [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ];
  const r = appliquer(etat, { type: 'ordre', uniteId: 'u1', chemin, suite: { type: 'rien' } }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const e = r.evenements.find((x) => x.type === 'deplacement');
  assert.ok(e && e.type === 'deplacement');
  if (!e || e.type !== 'deplacement') return;

  assert.deepEqual(e.chemin, chemin, 'le rendu reçoit le trajet, pas seulement ses deux bouts');
  // Un chemin de rendu doit rester une suite de pas orthogonaux : c'est ce qui
  // empêche une figurine de couper à travers une montagne ou une unité adverse.
  for (let i = 1; i < e.chemin.length; i += 1) {
    const avant: Case = e.chemin[i - 1]!;
    const apres: Case = e.chemin[i]!;
    assert.equal(
      Math.abs(avant.x - apres.x) + Math.abs(avant.y - apres.y), 1,
      `pas ${i} : un seul cran à la fois`,
    );
  }
  assert.deepEqual(e.chemin[0], e.de);
  assert.deepEqual(e.chemin[e.chemin.length - 1], e.vers);
});

test('un déplacement immobile annonce un chemin d’une seule case, jamais vide', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1', chemin: [{ x: 6, y: 6 }], suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const e = r.evenements.find((x) => x.type === 'deplacement');
  assert.ok(e && e.type === 'deplacement');
  if (!e || e.type !== 'deplacement') return;
  assert.ok(e.chemin.length >= 1, 'le rendu ne reçoit jamais de chemin vide');
  assert.deepEqual(e.chemin[e.chemin.length - 1], e.vers);
});

test('aucun pas du chemin annoncé ne tombe sur une unité adverse', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 6, y: 6 },
    { camp: 1, type: 'infanterie', x: 8, y: 6 },
  ]);
  const chemin: Case[] = [{ x: 6, y: 6 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }];
  const r = appliquer(etat, { type: 'ordre', uniteId: 'u1', chemin, suite: { type: 'rien' } }, CAT);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const e = r.evenements.find((x) => x.type === 'deplacement');
  if (!e || e.type !== 'deplacement') return;
  const adverses = new Set(etat.unites.filter((x) => x.camp === 1).map((x) => `${x.x},${x.y}`));
  for (const c of e.chemin) {
    assert.ok(!adverses.has(`${c.x},${c.y}`), `le chemin traverse une unité adverse en ${c.x},${c.y}`);
  }
});
