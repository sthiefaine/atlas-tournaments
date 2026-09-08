/**
 * Le choix du dos du moteur (`src/render3d/scene.ts`, `choisirBackend`) et la
 * sonde de disponibilité : purs, sur un navigateur factice. Sous Node il n'y a
 * ni `navigator.gpu` ni WebGL 2, et c'est ce que la sonde doit dire.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { choisirBackend, creerMoteurWebGPU, moteur3dDisponible } from '../../src/render3d/scene';

test('sans WebGPU ou sans adaptateur, aucun repli WebGL', async () => {
  for (const navigateur of [undefined, null, {}, { gpu: undefined }]) {
    await assert.rejects(choisirBackend(navigateur), /WebGPU/);
  }
  await assert.rejects(choisirBackend({ gpu: { requestAdapter: async () => null } }), /adaptateur/);
  await assert.rejects(choisirBackend({ gpu: { requestAdapter: async () => { throw new Error('refus'); } } }), /refus/);
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

test('le moteur ne peut pas basculer silencieusement sur WebGL', () => {
  const moteur = creerMoteurWebGPU({ canvas: {} as HTMLCanvasElement });
  assert.equal(moteur._getFallback, null);
  assert.equal((moteur.backend as unknown as { isWebGPUBackend: boolean }).isWebGPUBackend, true);
});
