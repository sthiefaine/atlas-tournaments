// L'extraction des chaînes traduisibles : idempotence et empreintes (09 §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chainesDeLInterface, chainesDuCanon, collecterChaines, verifier,
} from '../../scripts/extraire-chaines';
import { empreinteCourte } from '../../src/db/requetes/communs';
import { extrairePlaceholders } from '../../src/db/requetes/chaines';
import { REGEX_CLE_CHAINE } from '../../src/schemas/index';

test('la collecte ramène de l’interface et du canon', () => {
  const interfaceFr = chainesDeLInterface();
  const canon = chainesDuCanon();
  assert.ok(interfaceFr.length > 30, 'trop peu de chaînes d’interface');
  assert.ok(canon.length > 20, 'trop peu de chaînes de canon');
  assert.equal(collecterChaines().length, interfaceFr.length + canon.length);
});

test('toutes les clés respectent la forme de CleChaine', () => {
  for (const c of collecterChaines()) {
    assert.match(c.cle, REGEX_CLE_CHAINE, `clé mal formée : ${c.cle}`);
  }
});

test('aucune clé n’est réutilisée pour un autre texte', () => {
  const fautes = verifier(collecterChaines());
  assert.deepEqual(fautes, []);
});

test('la collecte est idempotente : deux passages donnent le même résultat', () => {
  assert.deepEqual(collecterChaines(), collecterChaines());
});

test('le sourceHash est stable et change avec le texte', () => {
  const a = empreinteCourte('Fin de tour');
  assert.equal(a, empreinteCourte('Fin de tour'));
  assert.notEqual(a, empreinteCourte('Fin de tour.'));
  assert.equal(a.length, 16);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('les marqueurs sont extraits du texte, pas déclarés à la main', () => {
  assert.deepEqual(extrairePlaceholders('Prévisions : {n} journées'), ['{n}']);
  assert.deepEqual(extrairePlaceholders('{unite} contre {pays}'), ['{pays}', '{unite}']);
  assert.deepEqual(extrairePlaceholders('{n} et encore {n}'), ['{n}'], 'les doublons sont dédupliqués');
  assert.deepEqual(extrairePlaceholders('rien'), []);
});

test('le français ne dépasse jamais sa propre longueurMax', () => {
  for (const c of collecterChaines()) {
    if (c.longueurMax === null) continue;
    assert.ok(c.texte.length <= c.longueurMax, `${c.cle} : ${c.texte.length} > ${c.longueurMax}`);
  }
});

test('les chaînes de canon citent leur objet quand elles en ont un', () => {
  const unite = chainesDuCanon().find((c) => c.cle.startsWith('unite.') && c.cle.endsWith('.nom'));
  assert.ok(unite);
  assert.equal(unite?.objetRef?.type, 'UnitType');
  assert.equal(unite?.origine, 'canon');
});

test('une chaîne déclarée « pluriel » porte un marqueur de nombre', () => {
  for (const c of collecterChaines()) {
    if (!c.pluriel) continue;
    assert.match(c.texte, /\{n\}/, `${c.cle} est au pluriel mais ne porte pas {n}`);
  }
});
