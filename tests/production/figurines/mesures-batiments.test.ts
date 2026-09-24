// Les mesures d'un bâtiment, sur des images construites à la main : l'emprise
// prise sur la couverture (jamais sur l'ombre cuite), les fenêtres allumées,
// un repos qui ne bouge pas, le QG le plus haut, et le verdict des règles de
// `charte.json` (`batiments`) — chaque écart sur sa règle. Et ce que la planche
// pose comme le rendu : la nuit, le pavé, le mât et le drapeau.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHARTE } from '../../../scripts/production/figurines/charte';
import type { ClipFigurine } from '../../../scripts/production/figurines/lot';
import { composer, fondUni, reduireCadre, silhouette, voilerFond, type Cadre } from '../../../scripts/production/figurines/mesures';
import {
  ecartsRepos, empriseModele, partEmission, reglesBatiment, verdictHauteurQg, type MesuresBatiment,
} from '../../../scripts/production/figurines/mesures-batiments';
import { ambianceNuit, dessinerMat, solBatiment } from '../../../scripts/production/figurines/planche-batiment';
import { ambiance } from '../../../src/render/ambiance';
import { PIED_MAT } from '../../../src/render2d/batiments';
import { COS_TANGAGE, EMISSION_NUIT, PIXELS_PAR_CASE, SIN_TANGAGE } from '../../../src/render2d/contrat';
import { HAUTEUR_MAT } from '../../../src/render2d/replis';

/** Un cadre `l × h`, pivot (`px`, `py`), rempli par une fonction : [r, g, b, a, masque, couverture, émission]. */
function cadre(l: number, h: number, px: number, py: number, f: (x: number, y: number) => number[]): Cadre {
  const rgba = new Uint8Array(l * h * 4);
  const masque = new Uint8Array(l * h);
  const couverture = new Uint8Array(l * h);
  const emission = new Uint8Array(l * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [r, g, b, a, m, c, e] = f(x, y);
      const p = y * l + x;
      rgba.set([r!, g!, b!, a!], p * 4);
      masque[p] = m!;
      couverture[p] = c!;
      emission.set([e ?? 0, e ?? 0, e ?? 0], p * 3);
    }
  }
  return { l, h, px, py, rgba, masque, couverture, emission };
}

test('l’emprise d’un bâtiment se prend sur sa couverture, l’anneau du contour en plus : l’ombre cuite n’en est pas', () => {
  // 10 × 4, pivot (5, 3) : le modèle de x = 3 à 6, une ombre (alpha sans couverture) jusqu'à x = 9 et sur la ligne du haut.
  const c = cadre(10, 4, 5, 3, (x, y) => (x >= 3 && x <= 6 && y >= 1 ? [200, 200, 200, 255, 0, 255] : [0, 0, 0, 120, 0, 0]));
  const e = empriseModele(c, 3)!;
  assert.deepEqual([e.gauche, e.droite, e.dessus, e.dessous], [2 + 3, 2 + 3, 2 + 3, 1 + 3]);
  assert.deepEqual([e.largeur, e.hauteur], [4 + 6, 3 + 6]);
  assert.equal(empriseModele(cadre(2, 2, 1, 1, () => [0, 0, 0, 100, 0, 0]), 3), null, 'rien que de l’ombre');
});

test('les fenêtres allumées : la part des pixels du bâtiment dont l’émission atteint le seuil', () => {
  // 10 pixels de modèle, dont 2 fenêtres pleines et 1 bord de fenêtre ; une émission hors du modèle ne compte pas.
  const c = cadre(12, 1, 0, 0, (x) => (x < 10 ? [100, 100, 100, 255, 0, 255, x < 2 ? 240 : x === 2 ? 60 : 0] : [0, 0, 0, 0, 0, 0, 255]));
  assert.equal(partEmission(c, 128), 0.2);
  assert.equal(partEmission(c, 16), 0.3);
  const sansPage: Cadre = { ...c, emission: null };
  assert.equal(partEmission(sansPage, 16), 0);
});

test('un repos immobile ne rapporte rien ; un nœud qui bouge est nommé ; une pièce mobile a le droit', () => {
  const noeuds = [
    { nom: 'corps', translation: [0, 0, 0], tournant: false },
    { nom: 'toit', translation: [0, 0.3, 0], tournant: false },
    { nom: 'parabole', translation: [0.1, 0.5, 0], tournant: false, mobile: true },
  ];
  const repos = (pistes: ClipFigurine['pistes']): ClipFigurine[] => [{ nom: 'repos', duree: 3.2, boucle: true, pistes }];
  const t = [0, 1.6, 3.2];
  assert.deepEqual(ecartsRepos(repos([{ noeud: 'corps', chemin: 'translation', temps: t, valeurs: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }]), noeuds), []);
  const e = ecartsRepos(repos([
    { noeud: 'toit', chemin: 'translation', temps: t, valeurs: [[0, 0.3, 0], [0, 0.31, 0], [0, 0.3, 0]] },
    { noeud: 'parabole', chemin: 'rotation', temps: t, valeurs: [[0, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1]] },
    { noeud: 'corps', chemin: 'rotation', temps: t, valeurs: [[0, 0, 0, 1], [0, Math.sin(Math.PI / 360), 0, Math.cos(Math.PI / 360)], [0, 0, 0, 1]] },
  ]), noeuds);
  assert.deepEqual(e.map((x) => x.noeud).sort(), ['corps', 'toit']);
  assert.ok(Math.abs(e.find((x) => x.noeud === 'toit')!.translation - 0.01) < 1e-9);
  assert.ok(Math.abs(e.find((x) => x.noeud === 'corps')!.rotation - 1) < 1e-6, 'un degré');
  assert.deepEqual(ecartsRepos([], noeuds), [], 'sans clip de repos (le pont)');
});

test('le QG est le plus haut : contre les bâtiments figurines installés d’une autre clé', () => {
  const installes = [{ id: 'batiment_ville_base', cle: 'ville', hauteur: 0.7 }, { id: 'batiment_qg_base', cle: 'qg', hauteur: 0.95 }];
  assert.equal(verdictHauteurQg('qg', 0.9, installes).ok, true);
  assert.equal(verdictHauteurQg('qg', 0.65, installes).ok, false);
  assert.equal(verdictHauteurQg('usine', 0.8, installes).ok, true);
  assert.equal(verdictHauteurQg('usine', 1.0, installes).ok, false);
  assert.equal(verdictHauteurQg('ville', 0.7, [installes[0]!]).ok, null, 'pas de QG installé : une information');
  assert.equal(verdictHauteurQg('qg', 0.9, [installes[1]!]).ok, null, 'un QG ne se compare qu’aux autres');
});

/** Des mesures qui passent toutes les règles d'un bâtiment en service. */
function bonnes(): MesuresBatiment {
  return {
    id: 'batiment_ville_base', cle: 'ville', etat: 'base', variante: 'base', genre: 'batiment', superusine: false,
    equipe: 0.4, equipeEclairee: 0.78, equipeConnexe: 0.6, equipeIds: 0.41,
    debordLateral: 0.445, hauteurAuDessusPivot: 0.8, largeur: 0.89, emprise: { x: 0.42, z: 0.42 }, hauteurModele: 0.7, basAuRepos: 0,
    coinMat: { libre: true, hauteur: null, noeuds: [] }, emission: { allumee: 0.06, residuelle: 0.07 },
    palette: { equipe: 0.41, enduit: 0.4, fenetre: 0.1, bois: 0.05, graphite: 0.03, pave: 0.01 },
    teintes: ['equipe', 'graphite', 'enduit', 'pave', 'bois', 'fenetre'], triangles: 6000,
    materiaux: { trouves: ['mat_corps', 'mat_vitrage'], attendus: ['mat_corps', 'mat_vitrage'], max: 3 },
    piecesFines: [{ nom: 'mur', epaisseur: 0.2, fin: false }], repos: [], mobiles: [], agitation: { moyenne: 0, pire: 0 },
    clarteHorsEquipe: 60, controle: { ok: true, motifs: 0 }, hauteurQg: { ok: null, texte: '0.700 m ; aucun QG figurine installé' },
    recouvrement: { batiment: 'batiment_usine_base', valeur: 0.6 }, anomaliesCuisson: [],
  };
}

test('des mesures dans la charte des bâtiments passent toutes ses règles', () => {
  const r = reglesBatiment(bonnes(), CHARTE);
  assert.deepEqual(r.filter((x) => x.verdict === 'echec').map((x) => x.id), []);
  for (const id of ['equipe', 'equipe_eclairee', 'debord_lateral', 'emprise_sol', 'hauteur_pivot', 'coin_mat', 'emission', 'palette_orange', 'repos_immobile', 'repos_agitation']) {
    assert.ok(r.some((x) => x.id === id && x.verdict === 'ok'), id);
  }
  assert.ok(r.filter((x) => x.verdict === 'info').every((x) => x.id.startsWith('palette_') || ['equipe_connexe', 'hauteur_qg', 'largeur', 'clarte_hors_equipe', 'recouvrement'].includes(x.id)));
});

test('chaque écart à la charte des bâtiments tombe sur sa règle', () => {
  const echecs = (m: Partial<MesuresBatiment>): string[] => reglesBatiment({ ...bonnes(), ...m }, CHARTE).filter((x) => x.verdict === 'echec').map((x) => x.id);
  assert.deepEqual(echecs({ equipe: 0.5, equipeIds: 0.5 }), ['equipe']);
  assert.deepEqual(echecs({ equipe: 0.25, equipeIds: 0.25 }), ['equipe']);
  assert.deepEqual(echecs({ equipeEclairee: 0.5 }), ['equipe_eclairee']);
  assert.deepEqual(echecs({ equipeIds: 0.5 }), ['equipe_coherente']);
  assert.deepEqual(echecs({ debordLateral: 0.5 }), ['debord_lateral']);
  assert.deepEqual(echecs({ emprise: { x: 0.4, z: 0.49 } }), ['emprise_sol']);
  assert.deepEqual(echecs({ hauteurAuDessusPivot: 0.9 }), ['hauteur_pivot']);
  assert.deepEqual(echecs({ hauteurQg: { ok: false, texte: '' } }), ['hauteur_qg']);
  assert.deepEqual(echecs({ coinMat: { libre: false, hauteur: 0.3, noeuds: ['corps'] } }), ['coin_mat']);
  assert.deepEqual(echecs({ coinMat: null }), ['coin_mat'], 'un coin qu’on n’a pas mesuré n’est pas libre');
  assert.deepEqual(echecs({ emission: { allumee: 0.005, residuelle: 0.01 } }), ['emission']);
  assert.deepEqual(echecs({ palette: { ...bonnes().palette, orange: 0.02 } }), ['palette_orange']);
  assert.deepEqual(echecs({ basAuRepos: 0.03 }), ['au_sol']);
  assert.deepEqual(echecs({ repos: [{ noeud: 'toit', translation: 0.01, rotation: 0, echelle: 0 }] }), ['repos_immobile']);
  assert.deepEqual(echecs({ agitation: { moyenne: 0.01, pire: 0.02 } }), ['repos_agitation']);
  assert.deepEqual(echecs({ teintes: ['equipe', 'graphite', 'enduit', 'pave', 'bois', 'fenetre', 'os'] }), ['teintes']);
  assert.deepEqual(echecs({ piecesFines: [{ nom: 'planche', epaisseur: 0.02, fin: false }] }), ['epaisseur']);
  assert.deepEqual(echecs({ anomaliesCuisson: ['fixe/repos image 3 : silhouette'] }), ['cuisson_entiere']);
  // Désaffecté : les fenêtres s'éteignent, et c'est la moindre lueur qui échoue.
  assert.deepEqual(echecs({ etat: 'desaffecte', emission: { allumee: 0, residuelle: 0 } }), []);
  assert.deepEqual(echecs({ etat: 'desaffecte', emission: { allumee: 0, residuelle: 0.001 } }), ['emission']);
  // La superusine : jusqu'à 0,6 case, l'œil orange en service, éteint quand elle est prise.
  const superusine = { cle: 'superusine', superusine: true, debordLateral: 0.58, emprise: { x: 0.58, z: 0.55 } };
  assert.deepEqual(echecs({ ...superusine, palette: { ...bonnes().palette, orange: 0.03 } }), []);
  assert.deepEqual(echecs({ ...superusine }), ['palette_orange'], 'en service, sans œil');
  assert.deepEqual(echecs({ ...superusine, etat: 'inerte', emission: { allumee: 0, residuelle: 0 }, palette: { ...bonnes().palette, orange: 0.03 } }), ['palette_orange']);
  // Le pont : ni équipe, ni mât, ni fenêtres ; ce qui compte, c'est qu'il n'ait pas d'équipe.
  const pont = reglesBatiment({ ...bonnes(), id: 'terrain_pont', cle: 'pont', genre: 'pont', equipe: 0, coinMat: null, hauteurQg: undefined }, CHARTE);
  assert.ok(pont.some((x) => x.id === 'equipe_absente' && x.verdict === 'ok'));
  assert.ok(!pont.some((x) => ['equipe', 'coin_mat', 'emission', 'debord_lateral'].includes(x.id)));
});

test('la nuit de la planche est celle du rendu : le voile, puis les fenêtres ajoutées par-dessus', () => {
  const nuit = ambianceNuit();
  const v = ambiance('ete', 'nuit', 'clair').voile!;
  assert.ok(Math.abs(nuit.voile[3] - v.alpha) < 1e-6);
  assert.equal(nuit.emission, EMISSION_NUIT);
  // Un pixel blanc opaque sans masque, une émission de 128 : c·(1 − part) + V·part, puis + émission.
  const c = cadre(1, 1, 0, 0, () => [255, 255, 255, 255, 0, 255, 128]);
  const f = fondUni(1, 1, [0, 0, 0]);
  composer(f, c, 0, 0, null, false, 1, nuit);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(f.rvb[k]! - (1 * (1 - nuit.voile[3]) + nuit.voile[k]! * nuit.voile[3] + (128 / 255) * EMISSION_NUIT)) < 1e-6);
  // Sans ambiance, la composition d'avant, au bit près.
  const jour = fondUni(1, 1, [0, 0, 0]);
  composer(jour, c, 0, 0, null);
  assert.deepEqual([...jour.rvb], [1, 1, 1]);
  const sol = fondUni(2, 1, [1, 1, 1]);
  voilerFond(sol, nuit.voile, 1, 0);
  assert.deepEqual([...sol.rvb.subarray(0, 3)], [1, 1, 1], 'hors du rectangle, rien');
  assert.ok(Math.abs(sol.rvb[3]! - (1 - nuit.voile[3] + nuit.voile[0]! * nuit.voile[3])) < 1e-6);
  // La réduction à 48 pixels moyenne aussi l'émission.
  const r = reduireCadre(cadre(4, 4, 2, 2, (x) => [255, 255, 255, 255, 0, 255, x < 2 ? 200 : 0]), 0.5);
  assert.ok(r.emission && r.emission.some((e) => e === 200));
  const pave = solBatiment();
  assert.ok(pave.every((x) => x > 0.4 && x < 0.9), 'le pavé, un gris moyen');
});

test('la silhouette d’un bâtiment se lit au-dessus de l’ombre cuite', () => {
  // Une image : un modèle opaque et une ombre à 0,55.
  const c = cadre(8, 8, 4, 7, (x) => (x < 4 ? [200, 200, 200, 255, 0, 255] : [0, 0, 0, 140, 0, 0]));
  const tout = silhouette(c, 8, 8);
  const modele = silhouette(c, 8, 8, CHARTE.batiments.silhouetteAlphaMin);
  assert.equal(tout.size, 64);
  assert.equal(modele.size, 32);
});

test('le mât de la planche se plante au pied du rendu ; le drapeau, seulement avec un camp', () => {
  const k = 1;
  const f = fondUni(200, 200, [0, 0, 0]);
  const x = 100;
  const y = 150;
  dessinerMat(f, x, y, k, null);
  const px = Math.round(x + (PIED_MAT.x - 0.5) * PIXELS_PAR_CASE);
  const py = Math.round(y + (PIED_MAT.y - 0.5) * PIXELS_PAR_CASE * SIN_TANGAGE);
  const lu = (u: number, v: number): number => f.rvb[(v * f.l + u) * 3]!;
  assert.ok(lu(px, py - 5) > 0, 'la hampe part du pied');
  assert.ok(lu(px, Math.round(py - HAUTEUR_MAT * PIXELS_PAR_CASE * COS_TANGAGE) + 2) > 0, 'jusqu’au sommet');
  assert.equal(lu(px + 15, py - 70), 0, 'un mât nu, sans drapeau');
  dessinerMat(f, x, y, k, [1, 0, 0]);
  assert.ok(lu(px + 15, py - 72) > 0.9, 'le drapeau flotte à droite du mât');
});
