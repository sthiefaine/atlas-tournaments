/**
 * Catalogue 9 (10 septembre 2026) : l'automate de combat méridien, troisième
 * matériel exclusif de la faction, invisible aux catalogues antérieurs.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chargerCatalogue, creerPartie, degatsBase, prevoirDuel, produitesPar, verifierProduction,
} from '../../src/engine/index';
import { jouerTour, PONDEREE } from '../../src/ai/index';
import { creerRng } from '../../src/engine/rng';
import { scenePersonnalisee } from './aides';

const cat = chargerCatalogue(9);
const auto = cat.unites['meridien_automate']!;

test('catalogue 9 : trente unités, l’automate invisible avant, les anciens duels intacts', () => {
  assert.equal(cat.cles.length, 30);
  for (let v = 1; v <= 8; v += 1) assert.ok(!chargerCatalogue(v).cles.includes('meridien_automate'), `catalogue ${v}`);
  const huit = chargerCatalogue(8);
  assert.equal(huit.cles.length, 29);
  for (const a of huit.cles) for (const d of huit.cles) assert.equal(degatsBase(cat, a, d), degatsBase(huit, a, d));
});

test('l’automate : chenilles, tir illimité, exclusif, produit à l’usine des Gris seulement', () => {
  assert.equal(auto.factionExclusive, 'atl');
  assert.equal(auto.homologation?.catalogue, 9);
  assert.equal(auto.munitions, null);
  assert.equal(auto.typeMouvement, 'chenilles');
  assert.equal(auto.mouvement, 5);
  assert.equal(auto.vision, 2);
  assert.equal(auto.cout, 9000);
  assert.deepEqual(auto.silhouette, { base: 'chenilles', corps: 'bloc', modules: ['tourelle', 'canon_long', 'antenne'], taille: 2 });
  const grille = ['HUPPPPPP', 'PPPPPPPP', 'PPPPPPUH'];
  const proprietaires = { '0,0': 0 as const, '1,0': 0 as const, '6,2': 1 as const, '7,2': 1 as const };
  const unites = [{ camp: 0 as const, type: 'infanterie', x: 3, y: 1 }, { camp: 1 as const, type: 'infanterie', x: 4, y: 1 }];
  const ordinaire = creerPartie(scenePersonnalisee(grille, proprietaires, unites, { fondsDepart: 20000 }), cat, 'o');
  assert.ok(!produitesPar(cat, 'usine', ordinaire, 0).includes('meridien_automate'));
  assert.equal(verifierProduction(ordinaire, cat, 0, { x: 1, y: 0 }, 'meridien_automate').ok, false);
  const gris = creerPartie(scenePersonnalisee(grille, proprietaires, unites, { fondsDepart: 20000, factionsParCamp: { 0: 'atl' } }), cat, 'g');
  assert.ok(produitesPar(cat, 'usine', gris, 0).includes('meridien_automate'));
  assert.ok(!produitesPar(cat, 'aeroport', gris, 0).includes('meridien_automate'));
  assert.ok(verifierProduction(gris, cat, 0, { x: 1, y: 0 }, 'meridien_automate').ok);
  // Tir illimité : sans munitions à compter, le duel se prévoit à plein.
  const duel = creerPartie(scenePersonnalisee(grille, proprietaires, [
    { camp: 0, type: 'meridien_automate', x: 3, y: 1 }, { camp: 1, type: 'infanterie', x: 4, y: 1 },
  ], { factionsParCamp: { 0: 'atl' } }), cat, 'duel');
  const att = duel.unites[0]!;
  assert.equal(att.munitions, null);
  assert.ok(prevoirDuel(duel, cat, att, duel.unites[1]!, { x: 3, y: 1 }).degats > 0);
});

test('bon contre le mou et les légers, moyen contre les chars, rien en l’air ; encaissé comme un char moyen', () => {
  for (const cible of ['infanterie', 'meca', 'recon', 'artillerie', 'roquettes', 'transport', 'genie', 'brouilleur']) {
    const d = degatsBase(cat, 'meridien_automate', cible);
    assert.ok(d >= 60 && d <= 75, `${cible} : ${d}`);
  }
  for (const cible of ['char_leger', 'char_moyen', 'char_lourd', 'meridien_bastion']) {
    const d = degatsBase(cat, 'meridien_automate', cible);
    assert.ok(d >= 35 && d <= 45, `${cible} : ${d}`);
  }
  for (const cible of cat.cles.filter((c) => cat.unites[c]!.domaine === 'air')) {
    assert.equal(degatsBase(cat, 'meridien_automate', cible), 0, cible);
  }
  for (const att of cat.cles.filter((c) => c !== 'meridien_automate')) {
    assert.equal(degatsBase(cat, att, 'meridien_automate'), degatsBase(cat, att, 'char_moyen'), `${att} → automate comme → char moyen`);
  }
  // Contrainte 2 du §13.3 : un contre canon à 70 au moins.
  const canon = cat.cles.filter((c) => cat.unites[c]!.statut === 'canon');
  assert.ok(canon.some((a) => degatsBase(cat, a, 'meridien_automate') >= 70));
});

test('l’IA joue les automates comme des unités ordinaires, sans refus', () => {
  const s = scenePersonnalisee(['HPPPPPPP', 'PPPPPPPP', 'PPPPPPPH'], { '0,0': 0, '7,2': 1 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 }, { camp: 0, type: 'char_leger', x: 2, y: 1 },
    { camp: 1, type: 'meridien_automate', x: 6, y: 1 }, { camp: 1, type: 'meridien_automate', x: 6, y: 0 },
  ], { factionsParCamp: { 1: 'atl' }, cycleJourNuit: { jour: 1, nuit: 0 } });
  let e = creerPartie(s, cat, 'automate-ia');
  const rng = creerRng('automate-ia');
  for (let i = 0; i < 6 && !e.partie.terminee; i += 1) {
    const r = jouerTour(e, PONDEREE, rng.branche(`t${i}`), cat);
    assert.deepEqual(r.refus, []);
    e = r.etat;
  }
  assert.ok(e.journal.some((v) => v.type === 'attaque' && e.unites.concat().some(() => true)), 'la partie a tourné');
});
