/**
 * Le choix du dos du moteur (`src/render3d/scene.ts`, `choisirBackend`) et la
 * sonde de disponibilité : purs, sur un navigateur factice. Sous Node il n'y a
 * ni `navigator.gpu` ni WebGL 2, et c'est ce que la sonde doit dire.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { choisirBackend, moteur3dDisponible } from '../../src/render3d/scene';

test('sans `navigator.gpu`, c’est le dos WebGL', async () => {
  assert.equal(await choisirBackend(undefined), 'webgl');
  assert.equal(await choisirBackend(null), 'webgl');
  assert.equal(await choisirBackend({}), 'webgl');
  assert.equal(await choisirBackend({ gpu: undefined }), 'webgl');
});

test('`navigator.gpu` sans adaptateur — Chromium sans carte, SwiftShader — c’est encore WebGL', async () => {
  // three r170 lève quand l'adaptateur manque : la question doit être posée avant.
  const demandes: unknown[] = [];
  const dos = await choisirBackend({
    gpu: { requestAdapter: async (options) => { demandes.push(options); return null; } },
  });
  assert.equal(dos, 'webgl');
  // Et posée comme le moteur la posera : la même préférence de puissance.
  assert.deepEqual(demandes, [{ powerPreference: 'high-performance' }]);
  // Une demande qui lève vaut un refus, jamais une exception qui remonte.
  assert.equal(await choisirBackend({ gpu: { requestAdapter: async () => { throw new Error('non'); } } }), 'webgl');
});

test('un adaptateur, et c’est WebGPU', async () => {
  assert.equal(await choisirBackend({ gpu: { requestAdapter: async () => ({ features: new Set() }) } }), 'webgpu');
});

test('la sonde : rien sous Node, WebGPU dès que `navigator.gpu` existe', () => {
  // Le préchargement des tests pose un `navigator` sans `gpu`, et il n'y a pas
  // de `document` : ni WebGPU, ni WebGL 2.
  assert.equal(moteur3dDisponible(), false);
  const g = globalThis as { navigator?: unknown };
  const avant = g.navigator;
  try {
    // La sonde ne demande pas d'adaptateur : `navigator.gpu` suffit, le repli
    // prendra si l'adaptateur manque. C'est ce qui la garde synchrone.
    Object.defineProperty(globalThis, 'navigator', {
      value: { gpu: { requestAdapter: async () => null } }, configurable: true, writable: true,
    });
    assert.equal(moteur3dDisponible(), true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: avant, configurable: true, writable: true });
  }
});
