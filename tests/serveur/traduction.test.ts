// La validation d'une traduction, chaîne par chaîne (09 §8.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BORNES_LOT, MOTIFS_TRADUCTION, categoriesPluriel, dansEchantillon, glossaireRespecte,
  marqueurs, scriptTenu, termeInterditTrouve, validerChaine,
} from '../../src/serveur/traduction';
import type { EntreeGlossaire } from '../../src/schemas/index';

const GLOSSAIRE = {
  termesInterdits: ['ennemi', 'guerre'],
  entrees: [
    { terme: 'Atlas', categorie: 'nom_propre', traduction: null, translitteration: 'アトラス' },
    { terme: 'adversaire', categorie: 'terme_impose', traduction: 'Gegner' },
  ] as EntreeGlossaire[],
};

const SOURCE = {
  cle: 'hud.previsions',
  texte: 'Prévisions : {n} journées',
  longueurMax: 26,
  placeholders: ['{n}'],
  pluriel: false,
  sourceHash: 'abcdef0123456789',
};

function valider(propose: string | Record<string, string>, options: Partial<Parameters<typeof validerChaine>[0]> = {}) {
  return validerChaine({
    source: SOURCE,
    propose,
    sourceHashRecu: SOURCE.sourceHash,
    locale: 'de',
    script: 'latin',
    glossaire: GLOSSAIRE,
    ...options,
  });
}

test('une traduction conforme est acceptée', () => {
  const d = valider('Vorschau: {n} Tage');
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.texte, 'Vorschau: {n} Tage');
});

test('un marqueur perdu est refusé', () => {
  const d = valider('Vorschau: Tage');
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.equal(d.refus.motif, 'placeholder_manquant');
    assert.deepEqual(d.refus.attendu, ['{n}']);
  }
});

test('un marqueur dupliqué est refusé aussi', () => {
  const d = valider('Vorschau: {n} {n}');
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'placeholder_manquant');
});

test('longueurMax est un plafond dur', () => {
  const d = valider('Vorschau auf die kommenden {n} Spieltage der Runde');
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'trop_long');
});

test('le verrou optimiste sur sourceHash protège d’un français qui a bougé', () => {
  const d = valider('Vorschau: {n} Tage', { sourceHashRecu: 'ffffffffffffffff' });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'source_modifiee');
});

test('un terme interdit est refusé', () => {
  const d = validerChaine({
    source: { ...SOURCE, texte: 'L’adversaire avance', longueurMax: null, placeholders: [] },
    propose: 'Der ennemi rückt vor',
    sourceHashRecu: SOURCE.sourceHash,
    locale: 'de', script: 'latin', glossaire: GLOSSAIRE,
  });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'terme_interdit');
});

test('un terme imposé du glossaire doit être employé', () => {
  const d = validerChaine({
    source: { ...SOURCE, texte: 'L’adversaire avance', longueurMax: null, placeholders: [] },
    propose: 'Der Feind rückt vor',
    sourceHashRecu: SOURCE.sourceHash,
    locale: 'de', script: 'latin', glossaire: GLOSSAIRE,
  });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'glossaire_non_respecte');
});

test('un nom propre se recopie ou se translittère', () => {
  const source = 'Atlas ouvre la manche';
  assert.equal(glossaireRespecte(source, 'Atlas eröffnet die Runde', GLOSSAIRE).ok, true);
  assert.equal(glossaireRespecte(source, 'アトラスが開幕', GLOSSAIRE).ok, true);
  assert.equal(glossaireRespecte(source, 'Der Weltverband eröffnet', GLOSSAIRE).ok, false);
});

test('une langue au mauvais script est refusée', () => {
  const d = validerChaine({
    source: { ...SOURCE, texte: 'Fin de tour', longueurMax: null, placeholders: [] },
    propose: 'End turn',
    sourceHashRecu: SOURCE.sourceHash,
    locale: 'ja', script: 'kana_kanji', glossaire: { termesInterdits: [], entrees: [] },
  });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'langue_incorrecte');
});

test('scriptTenu reconnaît les quatre scripts', () => {
  assert.equal(scriptTenu('ターン終了', 'kana_kanji'), true);
  assert.equal(scriptTenu('Конец хода', 'cyrillique'), true);
  assert.equal(scriptTenu('回合结束', 'han_simplifie'), true);
  assert.equal(scriptTenu('Fin de tour', 'latin'), true);
  assert.equal(scriptTenu('{n}', 'kana_kanji'), true, 'une chaîne de marqueurs seuls passe');
});

test('un pluriel incomplet est refusé, un pluriel complet passe', () => {
  const source = { ...SOURCE, pluriel: true, longueurMax: null };
  const incomplet = validerChaine({
    source, propose: { one: 'Tag {n}' }, sourceHashRecu: SOURCE.sourceHash,
    locale: 'de', script: 'latin', glossaire: GLOSSAIRE,
  });
  assert.equal(incomplet.ok, false);
  if (!incomplet.ok) assert.equal(incomplet.refus.motif, 'pluriel_incomplet');

  const complet = validerChaine({
    source, propose: { one: 'Tag {n}', other: 'Tage {n}' }, sourceHashRecu: SOURCE.sourceHash,
    locale: 'de', script: 'latin', glossaire: GLOSSAIRE,
  });
  assert.equal(complet.ok, true);
});

test('une chaîne simple soumise en objet est refusée', () => {
  const d = valider({ one: 'x' });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.refus.motif, 'pluriel_incomplet');
});

test('les fonctions d’appoint font ce qu’on leur demande', () => {
  assert.deepEqual(marqueurs('{b} et {a}'), ['{a}', '{b}']);
  assert.equal(termeInterditTrouve('la Guerre', ['guerre']), 'guerre');
  assert.equal(termeInterditTrouve('le match', ['guerre']), null);
  assert.ok(categoriesPluriel('ru').includes('many'));
  assert.deepEqual(categoriesPluriel('ja'), ['other']);
  assert.equal(MOTIFS_TRADUCTION.length, 7);
  assert.equal(BORNES_LOT.max, 60);
});

test('l’échantillon humain est déterministe et proportionné', () => {
  assert.equal(dansEchantillon('hud.fin_de_tour', 0), false);
  const cles = Array.from({ length: 400 }, (_, i) => `ecran.cle_${i}`);
  const tires = cles.filter((c) => dansEchantillon(c, 20)).length;
  assert.ok(tires > 5 && tires < 45, `tirage hors de l’ordre de grandeur : ${tires}`);
  // Le même tirage, deux fois, donne le même résultat.
  assert.equal(dansEchantillon('ecran.cle_7', 20), dansEchantillon('ecran.cle_7', 20));
});
