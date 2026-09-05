// Les conventions de nommage sont des regex, et les regex sont testées : clés de
// flags (`01-bible.md` §8.1), clés d'objets, codes de langue et clés de chaînes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REGEX_CLE, REGEX_CLE_CHAINE, REGEX_CLE_MECANIQUE, REGEX_CODE_COMMANDANT,
  REGEX_CODE_LOCALE, REGEX_CODE_PAYS, REGEX_COULEUR, REGEX_DATE_ISO, REGEX_FLAG,
} from '../../src/schemas/index';

test('les clés de flags acceptées suivent les trois portées', () => {
  const valides = [
    'pays.fr.rival_respecte',
    'pays.lu.sponsor_accepte',
    'pays.fr.bretagne_maree_lue',
    'monde.atlas.soupcon',
    'monde.cinquieme.contact',
    'monde.regie.faveur',
    'monde.public.ferveur',
    'monde.tournoi.serie_propre',
    'monde.carnet.pages_scellees',
    'monde.depeche.serie',
    'cmd.maelle_kerdraon.respect',
    'cmd.mireille_bousquet.co_commandant',
  ];
  for (const f of valides) assert.match(f, REGEX_FLAG, `${f} devrait être une clé de flag valide`);
});

test('les clés de flags hors convention sont refusées', () => {
  const invalides = [
    'region.bretagne.maree_lue',   // pas de portée région
    'pays.FR.rival_respecte',      // majuscules
    'pays.fra.rival_respecte',     // code pays à trois lettres
    'monde.sponsors.faveur',       // domaine hors liste
    'monde.atlas.X',               // nom trop court et majuscule
    'cmd_maelle_kerdraon.respect', // séparateur de portée manquant
    'pays.fr.respecter-le-rival',  // tiret interdit
    'pays.fr.Rival',               // majuscule dans le nom
    'pays.fr',                     // segment manquant
  ];
  for (const f of invalides) assert.doesNotMatch(f, REGEX_FLAG, `${f} ne devrait pas passer`);
});

test('les identifiants, codes et couleurs suivent leurs formes', () => {
  assert.match('carte_fr_bretagne_01', REGEX_CLE);
  assert.doesNotMatch('Carte_FR', REGEX_CLE);
  assert.doesNotMatch('a', REGEX_CLE);

  assert.match('fr', REGEX_CODE_PAYS);
  assert.doesNotMatch('FR', REGEX_CODE_PAYS);
  assert.doesNotMatch('fra', REGEX_CODE_PAYS);

  assert.match('cmd_camille_aubertin', REGEX_CODE_COMMANDANT);
  assert.doesNotMatch('camille_aubertin', REGEX_CODE_COMMANDANT);

  assert.match('meca_marees', REGEX_CLE_MECANIQUE);
  assert.doesNotMatch('marees', REGEX_CLE_MECANIQUE);

  assert.match('#3f86e0', REGEX_COULEUR);
  assert.doesNotMatch('#3F86E0', REGEX_COULEUR);
  assert.doesNotMatch('3f86e0', REGEX_COULEUR);

  assert.match('2026-09-04', REGEX_DATE_ISO);
  assert.doesNotMatch('04/09/2026', REGEX_DATE_ISO);
});

test('les codes de langue et les clés de chaînes suivent 09-i18n §2', () => {
  for (const code of ['fr', 'en', 'pt-br', 'zh-hans', 'ja']) {
    assert.match(code, REGEX_CODE_LOCALE, `${code} devrait être un code de langue valide`);
  }
  for (const code of ['FR', 'fran', 'pt_BR', 'zh-Hans']) {
    assert.doesNotMatch(code, REGEX_CODE_LOCALE, `${code} ne devrait pas passer`);
  }

  for (const k of ['hud.fin_de_tour', 'cmd.cmd_elsbeth_vonlanthen.pouvoir.nom']) {
    assert.match(k, REGEX_CLE_CHAINE, `${k} devrait être une clé de chaîne valide`);
  }
  for (const k of ['hud', 'HUD.fin', 'hud..fin', 'hud.fin-de-tour']) {
    assert.doesNotMatch(k, REGEX_CLE_CHAINE, `${k} ne devrait pas passer`);
  }
});
