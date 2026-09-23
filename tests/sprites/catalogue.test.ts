// Ce qui se cuit et comment : la classification des fichiers livrés, le plan
// de vues et de clips, et la lecture d'une liste de sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { IMAGES_PAR_SECONDE, LACET_VUE, TANGAGE_CARTE, TANGAGE_PROFIL } from '../../src/render2d/contrat';
import { classer, planVues, sourcesCatalogue, sourcesListe, type SourceSprite } from '../../scripts/sprites/catalogue';

const clips = (noms: string[]) => noms.map((nom) => ({ nom, duree: nom === 'repos' ? 2.4 : 0.7 }));

test('les fichiers livrés se classent en familles, les terrains de sol sont écartés', () => {
  assert.deepEqual(
    { famille: classer('unite_char_leger_base')?.famille, cle: classer('unite_char_leger_base')?.cle },
    { famille: 'unite', cle: 'char_leger' },
  );
  assert.equal(classer('batiment_qg_fr')?.variante, 'fr');
  assert.equal(classer('batiment_ville_base')?.variante, undefined);
  assert.deepEqual(classer('terrain_pont')?.vues, ['fixe', 'travers']);
  assert.equal(classer('decor_rocher_cotier')?.cle, 'rocher');
  assert.equal(classer('terrain_plaine'), null);
  const { sources, ecartes } = sourcesCatalogue();
  assert.ok(sources.some((s) => s.id === 'unite_infanterie_base'));
  assert.ok(ecartes.includes('terrain_plaine'));
  // Ombre au sol cuite pour tout ce qui ne bouge pas, jamais pour une unité.
  for (const s of sources) assert.equal(s.ombre, s.famille !== 'unite', s.id);
});

test('une unité : la marche dans trois vues, tous ses clips à droite, le combat de profil', () => {
  const unite = classer('unite_infanterie_base') as SourceSprite;
  const plan = planVues(unite, clips(['repos', 'deplacement', 'tir', 'touche', 'hors_jeu', 'capture', 'inconnu']));
  const resume = plan.map((v) => `${v.vue}:${v.animations.map((a) => a.clip).join(',')}`);
  assert.deepEqual(resume, [
    'droite:repos,deplacement,tir,touche,hors_jeu,capture',
    'bas:deplacement',
    'haut:deplacement',
    'profil:repos,tir,touche,hors_jeu',
  ]);
  for (const v of plan) {
    assert.equal(v.lacet, LACET_VUE[v.vue]);
    assert.equal(v.tangage, v.vue === 'profil' ? TANGAGE_PROFIL : TANGAGE_CARTE);
    for (const a of v.animations) assert.equal(a.boucle, a.clip === 'repos' || a.clip === 'deplacement');
  }
});

test('aucun clip n’est inventé : un transport sans tir n’en a pas', () => {
  const plan = planVues(classer('unite_transport_base') as SourceSprite, clips(['repos', 'deplacement', 'touche', 'hors_jeu']));
  assert.ok(plan.every((v) => v.animations.every((a) => a.clip !== 'tir' && a.clip !== 'capture')));
});

test('un modèle sans clip reçoit une image fixe par vue', () => {
  const plan = planVues(classer('terrain_pont') as SourceSprite, []);
  assert.deepEqual(plan.map((v) => v.vue), ['fixe', 'travers']);
  for (const v of plan) assert.deepEqual(v.animations, [{ clip: 'repos', anime: false, boucle: true, temps: [0], ips: IMAGES_PAR_SECONDE }]);
});

test('une unité venue d’une liste se cuit comme une unité du catalogue, et une source peut refuser le contour', () => {
  // La cuisson d'essai d'une figurine (`scripts/production/figurines/`) donne sa
  // source par une liste : même plan de vues, pas d'ombre cuite, masque d'une base.
  const dossier = mkdtempSync(join(tmpdir(), 'liste-unite-'));
  writeFileSync(join(dossier, 'char.glb'), '');
  const liste = join(dossier, 'liste.json');
  writeFileSync(liste, JSON.stringify({ version: 1, entrees: [
    { id: 'unite_char_leger_base', famille: 'unite', cle: 'char_leger', fichier: 'char.glb' },
    { id: 'calibration_x', famille: 'decor', cle: 'x', fichier: 'char.glb', contour: false },
  ] }));
  const [u, d] = sourcesListe(liste, dossier);
  const catalogue = classer('unite_char_leger_base')!;
  assert.deepEqual(
    { vues: u!.vues, ombre: u!.ombre, regleMasque: u!.regleMasque, emissionSeparee: u!.emissionSeparee, contour: u!.contour },
    { vues: catalogue.vues, ombre: catalogue.ombre, regleMasque: catalogue.regleMasque, emissionSeparee: catalogue.emissionSeparee, contour: undefined },
  );
  const resume = planVues(u!, clips(['repos', 'deplacement', 'tir'])).map((v) => `${v.vue}:${v.animations.map((a) => a.clip).join(',')}`);
  assert.deepEqual(resume, ['droite:repos,deplacement,tir', 'bas:deplacement', 'haut:deplacement', 'profil:repos,tir']);
  assert.equal(d!.contour, false);
  writeFileSync(liste, JSON.stringify({ version: 1, entrees: [{ id: 'x', famille: 'decor', cle: 'x', fichier: 'char.glb', contour: 'non' }] }));
  assert.throws(() => sourcesListe(liste, dossier));
});

test('une liste de sources se lit, et une liste fausse est refusée', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'liste-sprites-'));
  writeFileSync(join(dossier, 'arbre.glb'), '');
  const liste = join(dossier, 'liste.json');
  writeFileSync(liste, JSON.stringify({ version: 1, entrees: [
    { id: 'decor_feuillu_ete_1', famille: 'decor', cle: 'feuillu', variante: 'ete', fichier: 'arbre.glb', vues: ['fixe'], ombre: true },
  ] }));
  const [s] = sourcesListe(liste, dossier);
  assert.deepEqual({ id: s!.id, famille: s!.famille, cle: s!.cle, variante: s!.variante, fichier: s!.fichier, vues: s!.vues, ombre: s!.ombre },
    { id: 'decor_feuillu_ete_1', famille: 'decor', cle: 'feuillu', variante: 'ete', fichier: 'arbre.glb', vues: ['fixe'], ombre: true });
  for (const fausse of [
    { version: 2, entrees: [] },
    { version: 1, entrees: [{ id: 'x', famille: 'plante', cle: 'x', fichier: 'arbre.glb' }] },
    { version: 1, entrees: [{ id: 'x', famille: 'decor', cle: 'x', fichier: 'absent.glb' }] },
    { version: 1, entrees: [{ id: 'x', famille: 'decor', cle: 'x', fichier: 'arbre.glb', vues: ['dessous'] }] },
    { version: 1, entrees: [{ id: 'x', famille: 'decor', cle: 'x', fichier: 'arbre.glb' }, { id: 'x', famille: 'decor', cle: 'x', fichier: 'arbre.glb' }] },
  ]) {
    writeFileSync(liste, JSON.stringify(fausse));
    assert.throws(() => sourcesListe(liste, dossier), JSON.stringify(fausse));
  }
});
