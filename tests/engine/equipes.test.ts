import test from 'node:test';
import assert from 'node:assert/strict';
import { creerPartie, appliquer, sontAllies, copierEtat } from '../../src/engine/index';
import { peutCapturerIci } from '../../src/engine/regles/capture';
import { casesVisibles } from '../../src/engine/regles/vision';
import { evaluerFin } from '../../src/engine/regles/victoire';
import { deployerRenforts } from '../../src/engine/regles/renforts';
import { adversairesConnus, objectifsCapture } from '../../src/ai/evaluation';
import { CAT, scenePersonnalisee } from './aides';
function creer() {
  const scene = scenePersonnalisee(['PPPPPPPP', 'PPPVPPPP'], { '3,1': 2 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 7, y: 0 },
    { camp: 2, type: 'infanterie', x: 1, y: 0 },
  ], { equipes: [[0, 2], [1]], brouillard: true, victoire: [{ type: 'hors_jeu_total' }] });
  scene.camps = [0, 1, 2];
  return creerPartie(scene, CAT, 'equipes');
}
test('alliés : aucun tir ni capture, vision partagée et IA sans cible alliée', () => {
  const e = creer();
  assert(sontAllies(e, 0, 2));
  const r = appliquer(e, { type: 'ordre', uniteId: 'u1', chemin: [], suite: { type: 'attaquer', cible: { x: 1, y: 0 } } }, CAT);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.motif, 'cible_amie');
  assert(!peutCapturerIci(e, CAT, { ...e.unites[0]!, x: 3, y: 1 }));
  assert(!objectifsCapture(e, CAT, 0).some((c) => c.x === 3 && c.y === 1));
  assert(adversairesConnus(e, CAT, 0).every((u) => u.camp === 1));
  for (const c of casesVisibles(e, CAT, 2)) assert(casesVisibles(e, CAT, 0).has(c));
});
test('élimination du camp joueur : allié poursuit puis victoire commune', () => {
  const e = creer(); e.unites = e.unites.filter((u) => u.camp !== 0);
  evaluerFin(e, CAT, []); assert(!e.partie.terminee);
  e.unites = e.unites.filter((u) => u.camp !== 1);
  evaluerFin(e, CAT, []); assert.equal(e.partie.vainqueur, 0);
});
test('renfort J41 déterministe, report sur case voisine et aucune duplication après copie', () => {
  const e = creer();
  e.reglages.renforts = [{ journee: 41, unites: [{ camp: 2, type: 'infanterie', x: 0, y: 0 }] }];
  e.journee = 40; deployerRenforts(e, CAT, []); assert.equal(e.unites.length, 3);
  e.journee = 41; deployerRenforts(e, CAT, []); assert.equal(e.unites.length, 4);
  assert.deepEqual([e.unites[3]!.x, e.unites[3]!.y], [0, 1]);
  const copie = copierEtat(e); deployerRenforts(copie, CAT, []); assert.equal(copie.unites.length, 4);
  assert.deepEqual(copie.renfortsLivres, ['0:0']);
});
test('survie : pas de victoire J40, renfort présent avant victoire J41', () => {
  const e = creer();
  e.reglages.victoire = [{ type: 'survivre', journees: 40 }];
  e.reglages.renforts = [{ journee: 41, unites: [{ camp: 2, type: 'infanterie', x: 3, y: 0 }] }];
  e.journee = 40; evaluerFin(e, CAT, []); assert(!e.partie.terminee);
  e.journee = 41; deployerRenforts(e, CAT, []); evaluerFin(e, CAT, []);
  assert.equal(e.partie.motif, 'objectif_survivre'); assert.equal(e.unites.length, 4);
});
test('un camp attendant ses renforts demeure en lice ; aucune place reporte la livraison', () => {
  const e = creer();
  e.unites = e.unites.filter((u) => u.camp !== 2); delete e.proprietaires['3,1'];
  e.reglages.renforts = [{ journee: 41, unites: [{ camp: 2, type: 'infanterie', x: 0, y: 0 }] }];
  evaluerFin(e, CAT, []); assert(!e.camps[2]!.elimine);
  e.journee = 41; e.grille = ['WWWWWWWW', 'WWWWWWWW'];
  deployerRenforts(e, CAT, []); assert.equal(e.renfortsLivres, undefined);
  const libre = copierEtat(e); libre.grille = ['PPPPPPPP', 'PPPPPPPP']; deployerRenforts(libre, CAT, []);
  assert.deepEqual(libre.renfortsLivres, ['0:0']);
});
test('fin du dernier tour J40 déclenche arrivée avant événement de victoire', () => {
  const e = creer(); e.journee = 40; e.campCourant = 2;
  e.reglages.victoire = [{ type: 'survivre', journees: 40 }];
  e.reglages.renforts = [{ journee: 41, unites: [{ camp: 2, type: 'infanterie', x: 3, y: 0 }] }];
  const r = appliquer(e, { type: 'finTour' }, CAT);
  assert(r.ok);
  if (!r.ok) return;
  assert.equal(r.etat.journee, 41);
  assert.equal(r.etat.partie.vainqueur, 0);
  assert.equal(r.etat.unites.length, 4);
  assert(r.evenements.findIndex((v) => v.type === 'annonce' && v.icone === 'renfort')
    < r.evenements.findIndex((v) => v.type === 'fin_partie'));
});
