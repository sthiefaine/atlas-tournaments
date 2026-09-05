// L'authentification du serveur : Bearer des routines et session d'administration.
// Aucune base n'est nécessaire — tout est pur, tout est vérifiable ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COOKIE_ADMIN, cookieFermeture, cookieOuverture, egalConstant, exigerAdmin, exigerRoutine,
  jetonPorteur, lireCookie, motDePasseAdminValide, secretRoutineValide, signerSession,
  verifierSession,
} from '../../src/serveur/auth';

const SECRET = 'secret-de-test-0123456789';

test('egalConstant compare sans fuiter la longueur', () => {
  assert.equal(egalConstant('abc', 'abc'), true);
  assert.equal(egalConstant('abc', 'abd'), false);
  // Deux longueurs différentes ne doivent pas lever : les valeurs sont hachées avant.
  assert.equal(egalConstant('a', 'un secret beaucoup plus long'), false);
  assert.equal(egalConstant('', ''), true);
});

test('jetonPorteur lit un en-tête Bearer et rien d’autre', () => {
  assert.equal(jetonPorteur('Bearer abc'), 'abc');
  assert.equal(jetonPorteur('Bearer   abc  '), 'abc');
  assert.equal(jetonPorteur('bearer abc'), null);
  assert.equal(jetonPorteur('Basic abc'), null);
  assert.equal(jetonPorteur(null), null);
});

test('un CRON_SECRET absent refuse tout', () => {
  assert.equal(secretRoutineValide('Bearer peu-importe', undefined), false);
  assert.equal(secretRoutineValide('Bearer peu-importe', ''), false);
});

test('le secret des routines est vérifié exactement', () => {
  assert.equal(secretRoutineValide(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(secretRoutineValide(`Bearer ${SECRET} `, SECRET), true);
  assert.equal(secretRoutineValide(`Bearer ${SECRET}x`, SECRET), false);
  assert.equal(secretRoutineValide(null, SECRET), false);
});

test('exigerRoutine répond 401 sans corps', async () => {
  const avant = process.env['CRON_SECRET'];
  process.env['CRON_SECRET'] = SECRET;
  const refus = exigerRoutine(new Request('https://exemple.test/api/routines/missions'));
  assert.ok(refus);
  assert.equal(refus.status, 401);
  assert.equal(await refus.text(), '');

  const passe = exigerRoutine(new Request('https://exemple.test/api/routines/missions', {
    headers: { authorization: `Bearer ${SECRET}` },
  }));
  assert.equal(passe, null);
  if (avant === undefined) delete process.env['CRON_SECRET'];
  else process.env['CRON_SECRET'] = avant;
});

test('une session signée se relit, une session altérée ne se relit pas', () => {
  const jeton = signerSession({ sujet: 'admin', expire: Date.now() + 60_000 }, SECRET);
  const relue = verifierSession(jeton, SECRET);
  assert.equal(relue?.sujet, 'admin');

  // Charge modifiée : la signature ne tient plus.
  const [charge, signature] = jeton.split('.');
  const autreCharge = Buffer.from(JSON.stringify({ sujet: 'pirate', expire: Date.now() + 60_000 })).toString('base64url');
  assert.equal(verifierSession(`${autreCharge}.${signature}`, SECRET), null);
  assert.equal(verifierSession(`${charge}.zzz`, SECRET), null);
  assert.equal(verifierSession(jeton, 'un-autre-secret'), null);
  assert.equal(verifierSession(null, SECRET), null);
  assert.equal(verifierSession(jeton, ''), null);
});

test('une session expirée est refusée', () => {
  const jeton = signerSession({ sujet: 'admin', expire: 1_000 }, SECRET);
  assert.equal(verifierSession(jeton, SECRET, 2_000), null);
  assert.notEqual(verifierSession(jeton, SECRET, 500), null);
});

test('signer sans AUTH_SECRET est une erreur, pas une session vide', () => {
  assert.throws(() => signerSession({ sujet: 'admin', expire: Date.now() + 1000 }, ''));
});

test('le mot de passe d’administration est comparé en temps constant', () => {
  assert.equal(motDePasseAdminValide('bon', 'bon'), true);
  assert.equal(motDePasseAdminValide('mauvais', 'bon'), false);
  assert.equal(motDePasseAdminValide('bon', undefined), false);
});

test('lireCookie trouve le bon cookie parmi plusieurs', () => {
  const entete = `autre=1; ${COOKIE_ADMIN}=abc%20def; encore=2`;
  assert.equal(lireCookie(entete, COOKIE_ADMIN), 'abc def');
  assert.equal(lireCookie(entete, 'absent'), null);
  assert.equal(lireCookie(null, COOKIE_ADMIN), null);
});

test('le CRON_SECRET n’ouvre aucune route d’administration', () => {
  const requete = new Request('https://exemple.test/api/routines/catalogue/unites/x', {
    headers: { authorization: `Bearer ${SECRET}` },
  });
  const refus = exigerAdmin(requete);
  assert.ok(refus);
  assert.equal(refus.status, 403);
});

test('les cookies portent HttpOnly et SameSite, et la fermeture expire tout de suite', () => {
  const ouvert = cookieOuverture('jeton', true);
  assert.match(ouvert, /HttpOnly/);
  assert.match(ouvert, /SameSite=Lax/);
  assert.match(ouvert, /Secure/);
  assert.match(cookieFermeture(), /Max-Age=0/);
});
