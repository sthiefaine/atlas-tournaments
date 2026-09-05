// Le cycle de vie du contenu : qui a le droit de faire quoi (02 §6, 05 §1.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  doitEtreArchive, porteUneAlerte, statutApresVerdict, transitionAutorisee,
  transitionUniteAutorisee, visibleParLesJoueurs,
} from '../../src/serveur/cycle';

test('aucune routine ne pose en_ligne', () => {
  for (const acteur of ['routine', 'atlas_controle', 'serveur'] as const) {
    const d = transitionAutorisee('valide', 'en_ligne', acteur);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, 'acteur_interdit');
  }
  assert.equal(transitionAutorisee('valide', 'en_ligne', 'humain').ok, true);
});

test('rien n’atteint valide sans passer par la routine contrôle', () => {
  assert.equal(transitionAutorisee('brouillon', 'valide', 'humain').ok, false);
  assert.equal(transitionAutorisee('brouillon', 'valide', 'serveur').ok, false);
  assert.equal(transitionAutorisee('brouillon', 'valide', 'atlas_controle').ok, true);
  assert.equal(transitionAutorisee('en_controle', 'valide', 'atlas_controle').ok, true);
});

test('une transition qui n’existe pas est refusée, pas tolérée', () => {
  const d = transitionAutorisee('brouillon', 'en_ligne', 'humain');
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.code, 'transition_interdite');
  assert.equal(transitionAutorisee('retire', 'en_ligne', 'humain').ok, false);
});

test('une transition vers soi-même est idempotente', () => {
  assert.equal(transitionAutorisee('brouillon', 'brouillon', 'routine').ok, true);
});

test('la quarantaine est ouverte aux routines, sa levée aux humains seuls', () => {
  assert.equal(transitionAutorisee('brouillon', 'quarantaine', 'routine').ok, true);
  assert.equal(transitionAutorisee('quarantaine', 'brouillon', 'routine').ok, false);
  assert.equal(transitionAutorisee('quarantaine', 'brouillon', 'humain').ok, true);
});

test('un seul statut est visible des joueurs', () => {
  assert.equal(visibleParLesJoueurs('en_ligne'), true);
  for (const s of ['brouillon', 'en_controle', 'valide', 'rejete', 'quarantaine', 'retire'] as const) {
    assert.equal(visibleParLesJoueurs(s), false);
  }
});

test('le statut suit le verdict, et trois rejets archivent', () => {
  assert.equal(statutApresVerdict('valide'), 'valide');
  assert.equal(statutApresVerdict('rejete'), 'rejete');
  assert.equal(doitEtreArchive(2), false);
  assert.equal(doitEtreArchive(3), true);
  assert.equal(doitEtreArchive(7), true);
});

test('trois motifs déclenchent une alerte humaine', () => {
  assert.equal(porteUneAlerte(['zone_morte']), false);
  assert.equal(porteUneAlerte(['zone_morte', 'sujet_interdit']), true);
  assert.equal(porteUneAlerte(['personne_reelle']), true);
  assert.equal(porteUneAlerte(['categorie_hors_liste_blanche']), true);
});

test('une unité canon ne change jamais de statut', () => {
  for (const vers of ['essai', 'homologuee', 'retiree'] as const) {
    const d = transitionUniteAutorisee('canon', vers, 'valide', 'humain');
    assert.equal(d.ok, false);
  }
});

test('le catalogue ne se modifie que depuis une session d’administration', () => {
  const d = transitionUniteAutorisee('essai', 'homologuee', 'valide', 'routine');
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.code, 'acteur_interdit');
  assert.equal(transitionUniteAutorisee('essai', 'homologuee', 'valide', 'humain').ok, true);
});

test('une candidate non certifiée ne passe pas en essai', () => {
  assert.equal(transitionUniteAutorisee('essai', 'essai', 'brouillon', 'humain').ok, false);
  assert.equal(transitionUniteAutorisee('essai', 'essai', 'valide', 'humain').ok, true);
});

test('les seules transitions de catalogue sont celles de 05 §9.4', () => {
  assert.equal(transitionUniteAutorisee('essai', 'retiree', 'valide', 'humain').ok, true);
  assert.equal(transitionUniteAutorisee('homologuee', 'retiree', 'valide', 'humain').ok, true);
  assert.equal(transitionUniteAutorisee('retiree', 'homologuee', 'valide', 'humain').ok, false);
  assert.equal(transitionUniteAutorisee('homologuee', 'essai', 'valide', 'humain').ok, false);
});
