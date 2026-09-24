// Les bâtiments : la couleur du propriétaire, le pavillon — nu sur un neutre —,
// le fanion d'une capture en cours, le désaffecté endormi et sans mât, la
// superusine active ou inerte, le noir du brouillard — et jamais une unité
// cachée trahie par son drapeau. Chaque image d'état a son repli : l'image
// ordinaire, ternie pour un désaffecté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleCase, seuilCapture, SEUIL_CAPTURE, terrainLogique, type EtatPartie } from '../../src/engine/index';
import {
  aspectBatiment, ECHELLE_DRAPEAU_QG, ECHELLE_MAT_QG, hauteurDrapeau, poseDrapeau, poseDrapeauCase, posesBatiments, TEINTE_DESAFFECTE,
  type OptionsPosesBatiments,
} from '../../src/render2d/batiments';
import { COS_TANGAGE, niveauxBrouillard, PIXELS_PAR_CASE } from '../../src/render2d/contrat';
import { FORMES, HAUTEUR_MAT, TAILLE_DRAPEAU } from '../../src/render2d/replis';
import type { Pose } from '../../src/render2d/lot';
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

/** Une usine rouge qui porte la superusine du camp rouge, et une usine bleue ordinaire. */
function etatSuperusine(): EtatPartie {
  return partiePersonnalisee(
    ['HUPPUH', 'PPPPPP'],
    { '0,0': 0, '1,0': 0, '4,0': 1, '5,0': 1 },
    [{ camp: 0, type: 'infanterie', x: 2, y: 1 }, { camp: 1, type: 'infanterie', x: 3, y: 1 }],
    { superusines: [{ x: 4, y: 0, camp: 1, type: 'char_leger' }] },
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

/** Un atlas qui n'a que ces images d'état cuites. */
const cuites = (...ids: string[]) => ({ existe: (id: string) => ids.includes(id) });

const terrainDe = (e: EtatPartie) => (c: { x: number; y: number }) => terrainLogique(e, CAT, c);

/** Les poses d'une case, par la colonne de son centre. */
const surColonne = (poses: readonly Pose[], x: number) => poses.filter((p) => p.colonne === x + 0.5 && p.ligne === 0.5);

test('le pavillon : neutre et nu, possédé et hissé ; une capture amène les couleurs du propriétaire', () => {
  assert.deepEqual(poseDrapeau(null, null, 20), { camp: null, niveau: 0 });
  assert.deepEqual(poseDrapeau(0, null, 20), { camp: 0, niveau: 1 });
  assert.deepEqual(poseDrapeau(0, { camp: 1, points: 5 }, 20), { camp: 0, niveau: 0.75 });
  assert.deepEqual(poseDrapeau(null, { camp: 1, points: 10 }, 40), { camp: 1, niveau: 0.25 });
  assert.deepEqual(poseDrapeau(0, { camp: 0, points: 5 }, 20), { camp: 0, niveau: 1 }, 'son propre camp n’amène rien');
  assert.ok(hauteurDrapeau(1) < HAUTEUR_MAT && hauteurDrapeau(0) < hauteurDrapeau(0.5));
});

test('un bâtiment par case bâtie, à la couleur de son propriétaire ; le neutre porte un mât nu', () => {
  const e = etatEssai();
  const { poses } = posesBatiments(e, terrainDe(e), options(e));
  const batiments = poses.filter((p) => p.instance.entree.startsWith('batiment_'));
  assert.deepEqual(batiments.map((p) => [p.instance.entree, p.instance.equipe]), [
    ['batiment_ville_base', BLEU], ['batiment_usine_base', GRIS], ['batiment_qg_base', ROUGE],
  ]);
  // Le mât et le drapeau suivent leur bâtiment dans le tri.
  const mats = poses.filter((p) => p.instance.entree === FORMES.mat);
  assert.equal(mats.length, 3, 'tout bâtiment en service a son mât, le neutre compris');
  for (const m of mats) {
    const bat = batiments.find((b) => b.ligne === m.ligne && b.colonne === m.colonne);
    assert.ok(bat, 'un mât se trie avec son bâtiment');
  }
  // Jamais de drapeau gris : le mât de l'usine neutre est nu.
  const drapeaux = poses.filter((p) => p.instance.entree === FORMES.drapeau);
  assert.deepEqual(drapeaux.map((p) => p.colonne).sort(), [0.5, 4.5]);
  assert.ok(drapeaux.every((p) => p.instance.equipe !== GRIS));
});

test('la capture en cours fait descendre les couleurs du propriétaire, au seuil du moteur', () => {
  const e = etatEssai();
  e.unites[0]!.pointsCapture = 10;
  const { poses } = posesBatiments(e, terrainDe(e), options(e));
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.ligne === 0.5 && p.colonne === 0.5)!;
  assert.deepEqual(drapeau.instance.equipe, BLEU);
  assert.equal(drapeau.instance.h, hauteurDrapeau(1 - 10 / SEUIL_CAPTURE));
});

test('un neutre qu’on capture hisse les couleurs du capteur sur son mât nu', () => {
  const e = etatEssai();
  e.unites[1]!.x = 2;
  e.unites[1]!.y = 0;
  e.unites[1]!.pointsCapture = 10;
  const usine = surColonne(posesBatiments(e, terrainDe(e), options(e)).poses, 2);
  assert.equal(usine.filter((p) => p.instance.entree === FORMES.mat).length, 1);
  const drapeau = usine.find((p) => p.instance.entree === FORMES.drapeau)!;
  assert.deepEqual(drapeau.instance.equipe, BLEU);
  assert.equal(drapeau.instance.h, hauteurDrapeau(10 / SEUIL_CAPTURE));
});

test('une unité cachée ne trahit jamais sa capture', () => {
  const e = etatEssai();
  e.unites[0]!.pointsCapture = 10;
  const { poses } = posesBatiments(e, terrainDe(e), options(e, { unitesVues: new Set<string>() }));
  const drapeau = poses.find((p) => p.instance.entree === FORMES.drapeau && p.colonne === 0.5)!;
  assert.equal(drapeau.instance.h, hauteurDrapeau(1), 'le drapeau reste en haut');
  // Sur un neutre, le mât reste nu : rien ne monte sous une unité qu'on ne voit pas.
  e.unites[1]!.x = 2;
  e.unites[1]!.y = 0;
  e.unites[1]!.pointsCapture = 10;
  const usine = surColonne(posesBatiments(e, terrainDe(e), options(e, { unitesVues: new Set<string>() })).poses, 2);
  assert.deepEqual(usine.map((p) => p.instance.entree), ['batiment_usine_base', FORMES.mat]);
});

test('un QG demande le double : ses couleurs descendent deux fois moins vite', () => {
  const e = etatEssai();
  const qg = { x: 4, y: 0 };
  assert.equal(seuilCapture(e, CAT, qg), SEUIL_CAPTURE * 2);
  e.unites[1]!.x = 4;
  e.unites[1]!.y = 0;
  e.unites[1]!.pointsCapture = 20;
  const drapeau = surColonne(posesBatiments(e, terrainDe(e), options(e)).poses, 4)
    .find((p) => p.instance.entree === FORMES.drapeau)!;
  assert.deepEqual(drapeau.instance.equipe, ROUGE);
  assert.equal(drapeau.instance.h, hauteurDrapeau(0.5, ECHELLE_MAT_QG, ECHELLE_DRAPEAU_QG));
});

test('le QG porte le plus grand drapeau du jeu, sur un mât plus haut ; hissé, il reste sous la pomme', () => {
  const e = etatEssai();
  const poses = posesBatiments(e, terrainDe(e), options(e)).poses;
  const [matQg, drapeauQg] = [FORMES.mat, FORMES.drapeau].map((f) => surColonne(poses, 4).find((p) => p.instance.entree === f)!);
  assert.equal(matQg!.instance.echelle, ECHELLE_MAT_QG);
  assert.equal(drapeauQg!.instance.echelle, ECHELLE_DRAPEAU_QG);
  assert.ok(ECHELLE_DRAPEAU_QG > 1 && ECHELLE_MAT_QG > 1);
  // Hissé au plus haut, le haut du drapeau agrandi s'arrête sous la pomme du mât agrandi.
  const hauteur = (TAILLE_DRAPEAU.h * ECHELLE_DRAPEAU_QG) / (PIXELS_PAR_CASE * COS_TANGAGE);
  assert.ok(hauteurDrapeau(1, ECHELLE_MAT_QG, ECHELLE_DRAPEAU_QG) + hauteur < HAUTEUR_MAT * ECHELLE_MAT_QG);
  // La ville bleue garde les formes à leur taille.
  const [matVille, drapeauVille] = [FORMES.mat, FORMES.drapeau].map((f) => surColonne(poses, 0).find((p) => p.instance.entree === f)!);
  assert.equal(matVille!.instance.echelle, undefined);
  assert.equal(drapeauVille!.instance.echelle, undefined);
});

test('un désaffecté n’a jamais de mât, même pendant sa remise en service : terni sans image à lui', () => {
  const e = etatEssai();
  e.desaffectes = [cleCase({ x: 2, y: 0 })];
  // Une remise en service à mi-chemin : rien ne se hisse sur un mât couché.
  e.unites[1]!.x = 2;
  e.unites[1]!.y = 0;
  e.unites[1]!.pointsCapture = 20;
  const usine = surColonne(posesBatiments(e, terrainDe(e), options(e)).poses, 2);
  assert.deepEqual(usine.map((p) => p.instance.entree), ['batiment_usine_base'], 'ni mât ni drapeau');
  assert.deepEqual(usine[0]!.instance.teinte, TEINTE_DESAFFECTE);
  assert.deepEqual(usine[0]!.instance.equipe, GRIS, 'un désaffecté est neutre');
  assert.deepEqual(poseDrapeauCase(e, { x: 2, y: 0 }, e.unites[1], SEUIL_CAPTURE * 2), { camp: null, niveau: 0 });
  // Un drapeau qu'une animation imposerait n'y trouve pas de mât non plus.
  const forces = new Map([['2,0', { camp: 0 as const, niveau: 0.5 }]]);
  assert.deepEqual(surColonne(posesBatiments(e, terrainDe(e), options(e, { forces })).poses, 2).length, 1);
});

test('un désaffecté prend son image s’il l’a — sans teinte ni mât, son mât couché est dedans', () => {
  const e = etatEssai();
  e.desaffectes = [cleCase({ x: 2, y: 0 })];
  const o = options(e, cuites('batiment_usine_desaffecte'));
  const usine = surColonne(posesBatiments(e, terrainDe(e), o).poses, 2);
  assert.deepEqual(usine.map((p) => p.instance.entree), ['batiment_usine_desaffecte']);
  assert.equal(usine[0]!.instance.teinte, undefined);
  assert.deepEqual(usine[0]!.instance.equipe, GRIS, 'le toit reste sous le masque, au gris neutre');
  // L'image d'état d'un autre bâtiment ne sert à rien ici.
  const autre = surColonne(posesBatiments(e, terrainDe(e), options(e, cuites('batiment_ville_desaffecte'))).poses, 2);
  assert.deepEqual(autre.map((p) => [p.instance.entree, p.instance.teinte]), [['batiment_usine_base', TEINTE_DESAFFECTE]]);
});

test('une fois remis en service, le bâtiment reprend son image et hisse ses couleurs de zéro', () => {
  const e = etatEssai();
  e.desaffectes = [cleCase({ x: 2, y: 0 })];
  const avant = poseDrapeauCase(e, { x: 2, y: 0 }, null, SEUIL_CAPTURE * 2);
  e.desaffectes = [];
  e.proprietaires['2,0'] = 0;
  const apres = poseDrapeauCase(e, { x: 2, y: 0 }, null, SEUIL_CAPTURE);
  // `hisser` monte de l'un à l'autre : de rien au sommet, jamais d'une mi-hauteur héritée.
  assert.deepEqual([avant, apres], [{ camp: null, niveau: 0 }, { camp: 0, niveau: 1 }]);
  const usine = surColonne(posesBatiments(e, terrainDe(e), options(e, cuites('batiment_usine_desaffecte'))).poses, 2);
  assert.deepEqual(usine.map((p) => p.instance.entree), ['batiment_usine_base', FORMES.mat, FORMES.drapeau]);
});

test('la superusine : active à son camp, inerte prise ; l’usine tant que son image n’est pas cuite', () => {
  const e = etatSuperusine();
  const c = { x: 4, y: 0 };
  const deux = cuites('batiment_superusine_base', 'batiment_superusine_inerte');
  const images = { entree: (t: string) => `batiment_${t}_base`, ...deux };
  assert.deepEqual(aspectBatiment(e, c, 'usine', images), { entree: 'batiment_superusine_base', teinte: null, mat: true });
  // L'usine voisine du camp bleu n'est pas une superusine.
  assert.equal(aspectBatiment(e, { x: 1, y: 0 }, 'usine', images).entree, 'batiment_usine_base');
  // Sans aucune image : l'usine, avec son mât.
  assert.deepEqual(aspectBatiment(e, c, 'usine', { entree: images.entree }), { entree: 'batiment_usine_base', teinte: null, mat: true });
  // Prise par le bleu : inerte, à la couleur du preneur, et son mât porte ses couleurs.
  e.proprietaires['4,0'] = 0;
  assert.equal(aspectBatiment(e, c, 'usine', images).entree, 'batiment_superusine_inerte');
  const prise = surColonne(posesBatiments(e, terrainDe(e), options(e, deux)).poses, 4);
  assert.deepEqual(prise.map((p) => p.instance.entree), ['batiment_superusine_inerte', FORMES.mat, FORMES.drapeau]);
  assert.deepEqual(prise[0]!.instance.equipe, BLEU);
  // Inerte sans son image : l'usine — jamais l'image active, qui dirait qu'elle produit encore.
  assert.equal(aspectBatiment(e, c, 'usine', { ...images, ...cuites('batiment_superusine_base') }).entree, 'batiment_usine_base');
  // Neutre (son camp éliminé) : inerte aussi, sur un mât nu.
  delete e.proprietaires['4,0'];
  const neutre = surColonne(posesBatiments(e, terrainDe(e), options(e, deux)).poses, 4);
  assert.deepEqual(neutre.map((p) => p.instance.entree), ['batiment_superusine_inerte', FORMES.mat]);
});

test('une superusine désaffectée est inerte et sans mât ; sans image, c’est le désaffecté de l’usine', () => {
  const e = etatSuperusine();
  delete e.proprietaires['4,0'];
  e.desaffectes = ['4,0'];
  const c = { x: 4, y: 0 };
  const entree = (t: string) => `batiment_${t}_base`;
  assert.deepEqual(
    aspectBatiment(e, c, 'usine', { entree, ...cuites('batiment_superusine_inerte') }),
    { entree: 'batiment_superusine_inerte', teinte: null, mat: false },
  );
  assert.deepEqual(
    aspectBatiment(e, c, 'usine', { entree, ...cuites('batiment_usine_desaffecte') }),
    { entree: 'batiment_usine_desaffecte', teinte: null, mat: false },
  );
  assert.deepEqual(aspectBatiment(e, c, 'usine', { entree }), { entree: 'batiment_usine_base', teinte: TEINTE_DESAFFECTE, mat: false });
});

test('sous le brouillard, le bâtiment, son mât — nu ou pavoisé — et son drapeau sont noirs, et une marque ne se pose pas', () => {
  const e = etatEssai();
  const brouillard = niveauxBrouillard(e.largeur, e.hauteur, new Set(['2,0']));
  const marques = new Map([['0,0', 'menacee' as const], ['2,0', 'menacee' as const]]);
  const { poses } = posesBatiments(e, terrainDe(e), options(e, { brouillard, visibles: new Set(['2,0']), marquesCases: marques }));
  const ville = surColonne(poses, 0);
  assert.ok(ville.every((p) => p.instance.vue === 0 || p.instance.entree.startsWith('forme_marque') === false));
  assert.equal(ville.find((p) => p.instance.entree === 'batiment_ville_base')!.instance.vue, 0);
  assert.equal(ville.find((p) => p.instance.entree === FORMES.mat)!.instance.vue, 0);
  assert.equal(ville.find((p) => p.instance.entree === FORMES.drapeau)!.instance.vue, 0);
  // Le mât nu de l'usine vue est vu ; celui qu'on ne voit pas serait noir comme le reste.
  assert.equal(surColonne(poses, 2).find((p) => p.instance.entree === FORMES.mat)!.instance.vue, 1);
  const noir = niveauxBrouillard(e.largeur, e.hauteur, new Set());
  const nu = surColonne(posesBatiments(e, terrainDe(e), options(e, { brouillard: noir, visibles: new Set() })).poses, 2);
  assert.deepEqual(nu.map((p) => [p.instance.entree, p.instance.vue]), [['batiment_usine_base', 0], [FORMES.mat, 0]]);
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

test('l’animation d’un bâtiment se cherche dans l’image qu’on pose, état compris', () => {
  const e = etatEssai();
  e.desaffectes = [cleCase({ x: 2, y: 0 })];
  const demandees: string[] = [];
  const o = options(e, {
    ...cuites('batiment_usine_desaffecte'),
    animation: (id) => { demandees.push(id); return null; },
  });
  posesBatiments(e, terrainDe(e), o);
  assert.deepEqual(demandees, ['batiment_ville_base', 'batiment_usine_desaffecte', 'batiment_qg_base']);
});
