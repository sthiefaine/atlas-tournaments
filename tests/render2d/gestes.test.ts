// Les gestes de la peau 2D, sur un `EventTarget` nu : un tap joue la case sous
// le doigt, un glisser ou un pincement ne jouent jamais rien, et la vue fixe
// n'a ni rotation ni inclinaison.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { creerCamera2d } from '../../src/render2d/camera';
import { versPlan } from '../../src/render2d/contrat';
import { brancherGestes2d, facteurMolette } from '../../src/render2d/gestes';
import type { ToucheJeu } from '../../src/render/entrees';
import type { Case } from '../../src/schemas/types';

function montage(pointerType = 'mouse') {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const camera = creerCamera2d(24, 24);
  camera.redimensionner(800, 600);
  camera.cadrerCarte({ x: 12, y: 12 });
  const journal: string[] = [];
  const clics: Case[] = [];
  const touches: ToucheJeu[] = [];
  let inspecte = true;
  const demonter = brancherGestes2d(canvas, () => camera, {
    surClicCase: (c) => { clics.push(c); journal.push('clic'); },
    surSurvolCase: (c) => { journal.push(`survol:${c?.x},${c?.y}`); },
    surAnnuler: () => { journal.push('annuler'); },
    surInspecter: () => { journal.push('inspecter'); return inspecte; },
    surTouche: (t) => { touches.push(t); },
  }, () => undefined);
  const pointer = (type: string, id: number, x: number, y: number, extra: Record<string, unknown> = {}) => {
    const e = Object.assign(new Event(type), { pointerId: id, clientX: x, clientY: y, pointerType, button: 0, ...extra });
    if ('temps' in extra) Object.defineProperty(e, 'timeStamp', { value: extra['temps'] });
    cible.dispatchEvent(e);
  };
  const autre = (type: string, props: Record<string, unknown>) => {
    const e = Object.assign(new Event(type, { cancelable: true }), props);
    cible.dispatchEvent(e);
    return e;
  };
  /** Le centre d'une case à l'écran. */
  const ecran = (x: number, y: number) => {
    const p = versPlan(x + 0.5, y + 0.5, 0);
    return camera.versEcran(p.X, p.Y);
  };
  return { camera, journal, clics, touches, pointer, autre, ecran, demonter, inspecter: (v: boolean) => { inspecte = v; } };
}

test('un tap joue la case sous le pointeur', () => {
  const m = montage();
  const p = m.ecran(11, 13);
  m.pointer('pointerdown', 1, p.x, p.y);
  m.pointer('pointerup', 1, p.x, p.y);
  assert.deepEqual(m.clics, [{ x: 11, y: 13 }]);
  m.demonter();
});

test('un glisser déplace la carte et ne joue rien, même revenu à son point de départ', () => {
  const m = montage('touch');
  const cx = m.camera.etat.cx;
  m.pointer('pointerdown', 1, 400, 300);
  m.pointer('pointermove', 1, 500, 300);
  assert.ok(m.camera.etat.cx < cx, 'la carte suit le doigt');
  m.pointer('pointermove', 1, 400, 300);
  m.pointer('pointerup', 1, 400, 300);
  assert.deepEqual(m.clics, []);
  m.demonter();
});

test('un pincement zoome autour des doigts et ne sélectionne jamais la case sous le doigt resté immobile', () => {
  const m = montage('touch');
  const zoom = m.camera.etat.zoom;
  m.pointer('pointerdown', 1, 300, 300);
  m.pointer('pointerdown', 2, 500, 300);
  m.pointer('pointermove', 2, 600, 300);
  assert.ok(m.camera.etat.zoom > zoom);
  m.pointer('pointerup', 2, 600, 300);
  m.pointer('pointerup', 1, 300, 300);
  assert.deepEqual(m.clics, []);
  m.demonter();
});

test('la souris inspecte au double-clic ; le doigt, à l’appui long, et annule s’il n’y a rien à inspecter', () => {
  const m = montage();
  const p = m.ecran(12, 12);
  m.pointer('pointerdown', 1, p.x, p.y, { temps: 1000 });
  m.pointer('pointerup', 1, p.x, p.y, { temps: 1010 });
  m.pointer('pointerdown', 1, p.x, p.y, { temps: 1200 });
  m.pointer('pointerup', 1, p.x, p.y, { temps: 1210 });
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter']);
  m.demonter();

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const d = montage('touch');
    d.pointer('pointerdown', 1, p.x, p.y);
    mock.timers.tick(600);
    d.pointer('pointerup', 1, p.x, p.y);
    assert.deepEqual(d.journal, ['inspecter'], 'le relâchement n’est plus un tap');
    d.inspecter(false);
    d.pointer('pointerdown', 1, p.x, p.y);
    mock.timers.tick(600);
    d.pointer('pointerup', 1, p.x, p.y);
    assert.deepEqual(d.journal, ['inspecter', 'inspecter', 'annuler']);
    d.demonter();
  } finally {
    mock.timers.reset();
  }
});

test('le double-tap du doigt recentre et rapproche, il n’inspecte pas', () => {
  const m = montage('touch');
  const zoom = m.camera.etat.zoom;
  const p = m.ecran(5, 5);
  m.pointer('pointerdown', 1, p.x, p.y, { temps: 1000 });
  m.pointer('pointerup', 1, p.x, p.y, { temps: 1010 });
  m.pointer('pointerdown', 1, p.x, p.y, { temps: 1200 });
  m.pointer('pointerup', 1, p.x, p.y, { temps: 1210 });
  assert.ok(!m.journal.includes('inspecter'));
  m.camera.avancer(500);
  assert.ok(m.camera.etat.zoom >= zoom);
  m.demonter();
});

test('le clic droit annule', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 400, 300, { button: 2 });
  m.pointer('pointerup', 1, 400, 300, { button: 2 });
  assert.deepEqual(m.journal, ['annuler']);
  m.demonter();
});

test('la molette zoome autour du pointeur', () => {
  const m = montage();
  const avant = m.camera.versPlan(200, 150);
  const zoom = m.camera.etat.zoom;
  m.autre('wheel', { deltaY: -100, deltaMode: 0, clientX: 200, clientY: 150 });
  assert.ok(m.camera.etat.zoom > zoom);
  const apres = m.camera.versPlan(200, 150);
  assert.ok(Math.abs(avant.X - apres.X) < 1e-6 && Math.abs(avant.Y - apres.Y) < 1e-6);
  assert.ok(facteurMolette(-100) > 1 && facteurMolette(100) < 1);
  assert.ok(facteurMolette(-1e9) < 2, 'un cran démesuré reste borné');
  m.demonter();
});

test('Q, E, R et F ne font rien : la vue est fixe, et ce ne sont pas des ordres', () => {
  const m = montage();
  const etat = { ...m.camera.etat };
  for (const code of ['KeyQ', 'KeyE', 'KeyR', 'KeyF']) m.autre('keydown', { code });
  assert.deepEqual(m.touches, []);
  assert.deepEqual({ ...m.camera.etat }, etat);
  m.autre('keydown', { code: 'ArrowLeft' });
  m.autre('keydown', { code: 'KeyT' });
  assert.deepEqual(m.touches, ['gauche', 'fin_tour']);
  m.autre('keydown', { code: 'Equal' });
  assert.ok(m.camera.enMouvement(), 'le zoom au clavier se joue en transition');
  m.demonter();
});

test('les gestes de page de Safari sont refusés', () => {
  const m = montage('touch');
  for (const genre of ['gesturestart', 'gesturechange', 'gestureend']) {
    const e = m.autre(genre, {});
    assert.equal(e.defaultPrevented, true, genre);
  }
  m.demonter();
  const apres = m.autre('gesturestart', {});
  assert.equal(apres.defaultPrevented, false, 'débranché, plus rien n’est refusé');
});

test('le survol donne la case sous le pointeur', () => {
  const m = montage();
  const p = m.ecran(3, 4);
  m.pointer('pointermove', 7, p.x, p.y);
  assert.ok(m.journal.includes('survol:3,4'));
  m.demonter();
});
