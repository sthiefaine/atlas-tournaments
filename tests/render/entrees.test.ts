// Les entrées pointeur, sur un `EventTarget` nu : aucun DOM, seulement des
// événements. C'est assez pour vérifier qu'un geste composé — double-clic,
// appui long — remonte l'intention voulue, et rien de plus.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { brancherEntrees, type Gestes } from '../../src/render/entrees';

function montage(gestes: Gestes, pointerType = 'mouse') {
  const cible = new EventTarget();
  const attributs = new Map<string, string>();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    hasAttribute: (n: string) => attributs.has(n),
    setAttribute: (n: string, v: string) => { attributs.set(n, v); },
  }) as unknown as HTMLCanvasElement;
  const demonter = brancherEntrees(canvas, gestes);
  const pointer = (type: string, id: number, x: number, y: number, extra: Record<string, unknown> = {}) => {
    const e = Object.assign(new Event(type), {
      pointerId: id, clientX: x, clientY: y, pointerType, button: 0, ...extra,
    });
    // `timeStamp` est un accesseur en lecture seule sur `Event` : on le masque
    // par une propriété propre quand un test a besoin de maîtriser l'horloge.
    if ('temps' in extra) Object.defineProperty(e, 'timeStamp', { value: extra['temps'] });
    cible.dispatchEvent(e);
  };
  return { pointer, demonter };
}

test('deux clics sur le même point en moins de 350 ms font un double-clic, après les deux taps', () => {
  const journal: string[] = [];
  const m = montage({
    surTap: () => { journal.push('tap'); },
    surInspecter: () => { journal.push('inspecter'); return true; },
  });
  m.pointer('pointerdown', 1, 100, 100, { temps: 1000 });
  m.pointer('pointerup', 1, 100, 100, { temps: 1010 });
  m.pointer('pointerdown', 1, 102, 101, { temps: 1200 });
  m.pointer('pointerup', 1, 102, 101, { temps: 1210 });
  assert.deepEqual(journal, ['tap', 'tap', 'inspecter'], 'les deux taps précèdent l’inspection');
  // Un troisième clic repart de zéro : pas de second double-clic.
  m.pointer('pointerdown', 1, 102, 101, { temps: 1300 });
  m.pointer('pointerup', 1, 102, 101, { temps: 1310 });
  assert.deepEqual(journal, ['tap', 'tap', 'inspecter', 'tap']);
  m.demonter();
});

test('deux clics trop espacés, ou trop éloignés, ne font pas de double-clic', () => {
  let inspections = 0;
  const m = montage({ surInspecter: () => { inspections++; return true; } });
  m.pointer('pointerdown', 1, 100, 100, { temps: 1000 });
  m.pointer('pointerup', 1, 100, 100, { temps: 1010 });
  m.pointer('pointerdown', 1, 100, 100, { temps: 1500 });
  m.pointer('pointerup', 1, 100, 100, { temps: 1510 });
  assert.equal(inspections, 0, 'cinq cents millisecondes, ce sont deux clics');
  m.pointer('pointerdown', 1, 160, 100, { temps: 1600 });
  m.pointer('pointerup', 1, 160, 100, { temps: 1610 });
  assert.equal(inspections, 0, 'soixante pixels, ce sont deux cases');
  m.demonter();
});

test('un appui long qui inspecte n’annule pas ; un appui long ailleurs annule', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const journal: string[] = [];
    let inspecte = true;
    const m = montage({
      surTap: () => { journal.push('tap'); },
      surTapSecondaire: () => { journal.push('annuler'); },
      surInspecter: () => { journal.push('inspecter'); return inspecte; },
    }, 'touch');
    m.pointer('pointerdown', 1, 100, 100);
    mock.timers.tick(600);
    assert.deepEqual(journal, ['inspecter'], 'l’inspection a pris le geste');
    m.pointer('pointerup', 1, 100, 100);
    assert.deepEqual(journal, ['inspecter'], 'le relâchement n’est plus un tap');

    inspecte = false;
    m.pointer('pointerdown', 1, 100, 100);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 100, 100);
    assert.deepEqual(journal, ['inspecter', 'inspecter', 'annuler'], 'sans rien à inspecter, l’appui long annule');

    // Un tap bref au doigt reste un tap : le minuteur est annulé au relâchement.
    m.pointer('pointerdown', 1, 100, 100);
    m.pointer('pointerup', 1, 100, 100);
    mock.timers.tick(600);
    assert.deepEqual(journal, ['inspecter', 'inspecter', 'annuler', 'tap']);
    m.demonter();
  } finally {
    mock.timers.reset();
  }
});
