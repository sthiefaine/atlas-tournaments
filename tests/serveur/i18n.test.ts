// Le repli d'affichage : locale → en → fr, et JAMAIS de clé brute (09 §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAINES_INTERFACE, SOURCE_FR, categorieDe, chaineDeRepli, date, enregistrerBundle,
  incidentsI18n, liste, longueurMaxCible, nombre, oublierBundle, substituer, t, traducteur,
  viderIncidents,
} from '../../src/i18n/index';

test('la chaîne de repli est locale → en → fr', () => {
  assert.deepEqual(chaineDeRepli('de'), ['de', 'en', 'fr']);
  assert.deepEqual(chaineDeRepli('pt-br'), ['pt-br', 'pt', 'en', 'fr']);
  assert.deepEqual(chaineDeRepli('en'), ['en', 'fr']);
  assert.deepEqual(chaineDeRepli('fr'), ['fr', 'en']);
});

test('une langue chargée est servie, sinon on replie', () => {
  enregistrerBundle('de', { 'hud.fin_de_tour': 'Zug beenden' });
  assert.equal(t('de', 'hud.fin_de_tour'), 'Zug beenden');
  // Clé absente de `de` : repli sur le français source.
  assert.equal(t('de', 'hud.jauge_pouvoir'), SOURCE_FR['hud.jauge_pouvoir']);
  oublierBundle('de');
});

test('le repli passe par l’anglais avant le français', () => {
  enregistrerBundle('en', { 'hud.fin_de_tour': 'End turn' });
  enregistrerBundle('ja', {});
  assert.equal(t('ja', 'hud.fin_de_tour'), 'End turn');
  oublierBundle('ja');
  oublierBundle('en');
});

test('une clé brute ne s’affiche jamais', () => {
  viderIncidents();
  const rendu = t('fr', 'clef.qui.nexiste.pas');
  assert.equal(rendu, '');
  assert.notEqual(rendu, 'clef.qui.nexiste.pas');
  assert.equal(incidentsI18n().length, 1);
  assert.equal(incidentsI18n()[0]?.cle, 'clef.qui.nexiste.pas');
  viderIncidents();
});

test('les marqueurs sont substitués, et un marqueur sans valeur reste intact', () => {
  assert.equal(substituer('Fonds : {n}', { n: 38400 }), 'Fonds : 38400');
  assert.equal(substituer('{a} et {b}', { a: 'x' }), 'x et {b}');
  assert.equal(substituer('rien à faire'), 'rien à faire');
});

test('t substitue les paramètres de la chaîne source', () => {
  assert.equal(t('fr', 'hud.fonds', { n: 12 }), 'Fonds : 12');
});

test('une chaîne à pluriel stockée en catégories est résolue par Intl.PluralRules', () => {
  enregistrerBundle('ru', {
    'hud.journee': JSON.stringify({ one: 'День {n}', few: 'Дня {n}', many: 'Дней {n}', other: 'Дня {n}' }),
  });
  assert.equal(t('ru', 'hud.journee', { n: 1 }), 'День 1');
  assert.equal(t('ru', 'hud.journee', { n: 5 }), 'Дней 5');
  oublierBundle('ru');
});

test('les catégories de pluriel dépendent de la langue', () => {
  assert.equal(categorieDe('fr', 1), 'one');
  assert.equal(categorieDe('ja', 1), 'other');
  assert.equal(categorieDe('ja', 7), 'other');
});

test('Intl formate les nombres, les dates et les listes selon la langue', () => {
  assert.equal(nombre('en', 38400), '38,400');
  assert.notEqual(nombre('fr', 38400), nombre('en', 38400));
  assert.match(date('fr', '2026-09-05'), /2026/);
  assert.match(liste('fr', ['a', 'b']), /a/);
  // Une locale absurde ne fait pas tomber le rendu : on retombe sur le français.
  assert.equal(typeof nombre('zzz-invalide', 12), 'string');
});

test('longueurMaxCible corrige la borne par le facteur de longueur', () => {
  const base = CHAINES_INTERFACE.find((c) => c.cle === 'hud.fin_de_tour');
  assert.ok(base?.longueurMax);
  assert.equal(longueurMaxCible('hud.fin_de_tour', 1.2), Math.round((base?.longueurMax ?? 0) * 1.2));
  assert.equal(longueurMaxCible('clef.inconnue', 1), null);
});

test('traducteur() lie une langue une fois pour toutes', () => {
  const tr = traducteur('fr');
  assert.equal(tr('hud.fin_de_tour'), SOURCE_FR['hud.fin_de_tour']);
});

test('aucune chaîne source d’interface n’est vide', () => {
  for (const c of CHAINES_INTERFACE) {
    assert.notEqual(c.texte.trim(), '', `${c.cle} est vide`);
  }
});
