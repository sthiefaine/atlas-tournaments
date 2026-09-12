import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAudioJeu, MAX_VOIX } from '../../src/audio/moteur';
import { volumeNormalise } from '../../src/audio/types';

test('volume corrompu ou extrême normalisé', () => {
  assert.equal(volumeNormalise(NaN), .45); assert.equal(volumeNormalise(-2), 0); assert.equal(volumeNormalise(3), 1);
});
test('aucun contexte avant geste ; voix bornées, masquage, mute et démontage', async () => {
  const ancienDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const ancienAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const doc = new EventTarget() as EventTarget & { hidden: boolean }; doc.hidden = false;
  let crees = 0, fermes = 0, actifs = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const noeud = () => ({ connect() {}, disconnect() {} });
  class FauxAudio {
    state = 'running'; currentTime = 0; sampleRate = 1000; destination = {};
    constructor() { crees++; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { fermes++; return Promise.resolve(); }
    createGain() { return { ...noeud(), gain: param() }; }
    createDynamicsCompressor() { return { ...noeud(), threshold: param(), ratio: param() }; }
    createOscillator() { let started = false; return { ...noeud(), frequency: param(), type: '', onended: null, start() { started = true; actifs++; }, stop(t?: number) { if (t === undefined && started) { started = false; actifs--; } } }; }
    createBuffer(_c: number, taille: number) { return { getChannelData: () => new Float32Array(taille) }; }
    createBufferSource() { return { ...noeud(), buffer: null, start() {}, stop() {} }; }
    createBiquadFilter() { return { ...noeud(), type: '', frequency: param() }; }
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FauxAudio });
  try {
    const cible = new EventTarget();
    const audio = creerAudioJeu(cible as HTMLElement, true, .5);
    audio.jouer('canon'); assert.equal(crees, 0);
    cible.dispatchEvent(new Event('pointerdown')); assert.equal(crees, 1);
    for (let i = 0; i < 30; i++) audio.jouer('canon');
    assert.equal(actifs, MAX_VOIX);
    audio.annuler(); assert.equal(actifs, 0);
    audio.jouer('capture'); assert.equal(actifs, 1);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(actifs, 0);
    audio.jouer('canon'); assert.equal(actifs, 0);
    doc.hidden = false; audio.jouer('canon'); assert.equal(actifs, 0);
    cible.dispatchEvent(new Event('keydown')); audio.jouer('canon'); assert.equal(actifs, 1);
    audio.regler(false, 1); assert.equal(actifs, 0); audio.jouer('canon'); assert.equal(actifs, 0);
    audio.detruire(); audio.detruire(); assert.equal(fermes, 1);
    cible.dispatchEvent(new Event('pointerdown')); assert.equal(crees, 1);
  } finally {
    if (ancienDocument) Object.defineProperty(globalThis, 'document', ancienDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (ancienAudio) Object.defineProperty(globalThis, 'AudioContext', ancienAudio); else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
