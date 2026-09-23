// Les bâtiments : la couleur du propriétaire, le pavillon, le fanion d'une
// capture en cours, le terni d'un désaffecté, le noir du brouillard — et
// jamais une unité cachée trahie par son drapeau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleCase, seuilCapture, SEUIL_CAPTURE, terrainLogique, type EtatPartie } from '../../src/engine/index';
import {
  hauteurDrapeau, poseDrapeau, posesBatiments, TEINTE_DESAFFECTE, type OptionsPosesBatiments,
} from '../../src/render2d/batiments';
import { niveauxBrouillard } from '../../src/render2d/contrat';
import { FORMES, HAUTEUR_MAT } from '../../src/render2d/replis';
import { CAT, partiePersonnalisee } from '../engine/aides';

const BLEU = [0, 0, 1] as const;
const ROUGE = [1, 0, 0] as const;
const GRIS = [0.5, 0.5, 0.5] as const;

function etatEssai(): EtatPartie {
  // Une ville bleue, une usine neutre, un QG rouge, et un fantassin rouge sur la
  // ville bleue. Le bleu a un fantassin ailleurs : un camp sans unité est éliminé
  // dès l'ouverture, et ses bâtiments redeviennent neutres.
  return partiePersonnalisee(
    ['CPUPH', 'PPPPP'],
    { '0,0': 0, '4,0': 1 },
    [{ camp: 1, type: 'infanterie', x: 0, y: 0 }, { camp: 0, type: 'infanterie', x: 1, y: 1 }],
  );
}

function options(e: EtatPartie, extra: Partial<OptionsPosesBatiments> = {}): OptionsPosesBatiments {
  return {
    visibles: null, unitesVues: null, brouillard: null,
    equipe: (camp) => (camp === null ? GRIS : camp === 0 ? BLEU : ROUGE),
    entree: (terrain) => `batiment_${terrain}_base`,
    animation: () => null,
    seuil: (c) => seuilCapture(e, CAT, c),
    tempsMs: 0,
    reduit: false,
    ...extra,
  };
}

const terrainDe = (e: EtatPartie) => (c: { x: number; y: number }) => terrainLogique(e, CAT, c);

test('le pavillon : neutre et nu, possédé et hissé ; une capture amène les couleurs du propriétaire', () => {
  assert.deepEqual(poseDrapeau(null, null, 20), { camp: null, niveau: 0 });
  assert.deepEqual(poseDrapeau(0, null, 20), { camp: 0, niveau: 1 });
  assert.deepEqual(poseDrapeau(0, { camp: 1, points: 5 }, 20), { camp: 0, niveau: 0.75 });
  assert.deepEqual(poseDrapeau(null, { camp: 1, points: 10 }, 40), { camp: 1, niveau: 0.25 });
  assert.deepEqual(poseDrapeau(0, { camp: 0, points: 5 }, 20), { camp: 0, niveau: 1 }, 'son propre camp n’amène rien');
  assert.ok(hauteurDrapeau(1) < HAUTEUR_MAT && hauteurDrapeau(0) < hauteurDrapeau(0.5));
});

test('un bâtiment par case bâtie, à la couleur de son propriétaire, gris sans propriétaire', () => {
  const e = etatEssai();
  const { poses } = posesBatiments(e, terrainDe(e), options(e));
  const batiments = poses.filter((p) => p.instance.entree.startsWith('batiment_'));
  assert.deepEqual(batiments.map((p) => [p.instance.entree, p.instance.equipe]), [
    ['batiment_ville_base', BLEU], ['batiment_usine_base', GRIS], ['batiment_qg_base', ROUGE],
  ]);
  // Le mât et le drapeau suivent leur bâtiment dans le tri.
  const mats = poses.filter((p) => p.instance.entree === FORMES.mat);
  assert.equal(mats.length, 2, 'l’usine neutre n’a pas de mât');
  for (const m of mats) {
    const bat = batiments.find((b) => b.ligne === m.ligne && b.colonne === m.colonne);
    assert.ok(bat, 'un mât se trie avec son bâtiment');
  }
});

test('la capture en cours fait descendre les couleurs du propriétaire, au seuil du moteur', () => {
  const e = etatEssai();
  e.unites[0]!.pointsCapture = 10;
  const { poses } = posesBatiments(e, terrainDe(e), options(e));
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.ligne === 0.5 && p.colonne === 0.5)!;
  assert.deepEqual(drapeau.instance.equipe, BLEU);
  assert.equal(drapeau.instance.h, hauteurDrapeau(1 - 10 / SEUIL_CAPTURE));
});

test('une unité cachée ne trahit jamais sa capture', () => {
  const e = etatEssai();
  e.unites[0]!.pointsCapture = 10;
  const { poses } = posesBatiments(e, terrainDe(e), options(e, { unitesVues: new Set<string>() }));
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.colonne === 0.5)!;
  assert.equal(drapeau.instance.h, hauteurDrapeau(1), 'le drapeau reste en haut');
});

test('un QG ou un désaffecté demandent le double : le fanion monte deux fois moins vite', () => {
  const e = etatEssai();
  const qg = { x: 4, y: 0 };
  assert.equal(seuilCapture(e, CAT, qg), SEUIL_CAPTURE * 2);
  e.unites[0]!.x = 2;
  e.unites[0]!.camp = 0;
  e.desaffectes = [cleCase({ x: 2, y: 0 })];
  e.unites[0]!.pointsCapture = 20;
  const { poses } = posesBatiments(e, terrainDe(e), options(e));
  const usine = poses.find((p) => p.instance.entree === 'batiment_usine_base')!;
  assert.deepEqual(usine.instance.teinte, TEINTE_DESAFFECTE);
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.colonne === 2.5)!;
  assert.equal(drapeau.instance.h, hauteurDrapeau(0.5));
});

test('sous le brouillard, le bâtiment et son drapeau sont noirs, et une marque ne se pose pas', () => {
  const e = etatEssai();
  const brouillard = niveauxBrouillard(e.largeur, e.hauteur, new Set(['2,0']));
  const marques = new Map([['0,0', 'menacee' as const], ['2,0', 'menacee' as const]]);
  const { poses } = posesBatiments(e, terrainDe(e), options(e, { brouillard, visibles: new Set(['2,0']), marquesCases: marques }));
  const ville = poses.filter((p) => p.colonne === 0.5 && p.ligne === 0.5);
  assert.ok(ville.every((p) => p.instance.vue === 0 || p.instance.entree.startsWith('forme_marque') === false));
  assert.equal(ville.find((p) => p.instance.entree === 'batiment_ville_base')!.instance.vue, 0);
  assert.equal(ville.find((p) => p.instance.entree === FORMES.drapeau)!.instance.vue, 0);
  const marquesPosees = poses.filter((p) => p.instance.entree === FORMES.marque('menacee'));
  assert.deepEqual(marquesPosees.map((p) => p.colonne), [2.5], 'la marque d’une case cachée ne se dit pas');
});

test('un drapeau imposé par une animation l’emporte sur l’état', () => {
  const e = etatEssai();
  const forces = new Map([['0,0', { camp: 1 as const, niveau: 0.3 }]]);
  const { poses } = posesBatiments(e, terrainDe(e), options(e, { forces }));
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.colonne === 0.5)!;
  assert.deepEqual(drapeau.instance.equipe, ROUGE);
  assert.equal(drapeau.instance.h, hauteurDrapeau(0.3));
});

test('un bâtiment cuit qui s’anime demande l’ambiance, jamais sous réduction ni dans le noir', () => {
  const e = etatEssai();
  const anime = { animation: () => ({ index: 0, cadres: 6, ips: 12, boucle: true }), tempsMs: 1000 };
  assert.equal(posesBatiments(e, terrainDe(e), options(e, anime)).animees, true);
  assert.equal(posesBatiments(e, terrainDe(e), options(e, { ...anime, reduit: true })).animees, false);
  const noir = niveauxBrouillard(e.largeur, e.hauteur, new Set());
  assert.equal(posesBatiments(e, terrainDe(e), options(e, { ...anime, brouillard: noir })).animees, false);
});
