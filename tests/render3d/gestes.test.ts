import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { creerVue3d } from '../../src/render3d/camera';
import { brancherGestes3d } from '../../src/render3d/gestes';

function montage(pointerType = 'touch') {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  let clics = 0;
  const demonter = brancherGestes3d(canvas, () => vue, () => null,
    { surClicCase: () => { clics++; } }, () => undefined);
  const pointer = (type: string, id: number, x: number, y: number) => {
    const e = Object.assign(new Event(type), {
      pointerId: id, clientX: x, clientY: y, pointerType, button: 0,
    });
    cible.dispatchEvent(e);
  };
  return { vue, pointer, clics: () => clics, demonter };
}

test('un tap sélectionne, un glisser un doigt déplace la grille sans clic à son retour', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1);
  const x = m.vue.etat.cible.x;
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 295, 422);
  assert.ok(m.vue.etat.cible.x < x);
  m.pointer('pointermove', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1, 'revenir au point de départ ne transforme pas le glisser en tap');
  m.demonter();
});

test('un pincement ne sélectionne jamais la case sous le doigt resté immobile', () => {
  const m = montage();
  const distance = m.vue.etat.distance;
  m.pointer('pointerdown', 1, 120, 422);
  m.pointer('pointerdown', 2, 240, 422);
  m.pointer('pointermove', 2, 310, 422);
  assert.ok(m.vue.etat.distance < distance);
  m.pointer('pointerup', 2, 310, 422);
  m.pointer('pointerup', 1, 120, 422);
  assert.equal(m.clics(), 0);
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 1, 'le tap suivant reste utilisable');
  m.demonter();
});

test('une interruption tactile et un contact à deux doigts sans déplacement ne jouent pas', () => {
  const m = montage();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointercancel', 1, 195, 422);
  m.pointer('pointerdown', 1, 120, 422);
  m.pointer('pointerdown', 2, 240, 422);
  m.pointer('pointerup', 1, 120, 422);
  m.pointer('pointerup', 2, 240, 422);
  assert.equal(m.clics(), 0);
  m.demonter();
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointerup', 1, 195, 422);
  assert.equal(m.clics(), 0, 'les écouteurs sont retirés au démontage');
});


test('le glisser souris gauche franchit le seuil puis déplace la carte sans sélectionner', () => {
  const m = montage('mouse');
  const x = m.vue.etat.cible.x;
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 198, 422);
  assert.equal(m.vue.etat.cible.x, x, 'un léger tremblement laisse le clic disponible');
  m.pointer('pointermove', 1, 245, 422);
  assert.ok(m.vue.etat.cible.x < x, 'le bouton gauche déplace bien la caméra');
  m.pointer('pointerup', 1, 245, 422);
  assert.equal(m.clics(), 0, 'aucune case sélectionnée au relâchement');
  m.pointer('pointerdown', 1, 195, 422);
  m.pointer('pointermove', 1, 198, 422);
  m.pointer('pointerup', 1, 198, 422);
  assert.equal(m.clics(), 1, 'un clic avec tremblement reste un clic');
  m.demonter();
});

// ---------------------------------------------------------------------------
// L'inspection : double-clic à la souris, appui long au doigt
// ---------------------------------------------------------------------------

function montageInspection(pointerType: string, inspecte: () => boolean) {
  const cible = new EventTarget();
  const canvas = Object.assign(cible, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as HTMLCanvasElement;
  const vue = creerVue3d({ largeur: 24, hauteur: 24 });
  vue.redimensionner(390, 844);
  vue.cadrerCarte();
  const journal: string[] = [];
  const demonter = brancherGestes3d(canvas, () => vue, () => null, {
    surClicCase: () => { journal.push('clic'); },
    surAnnuler: () => { journal.push('annuler'); },
    surInspecter: () => { journal.push('inspecter'); return inspecte(); },
  }, () => undefined);
  const pointer = (type: string, id: number, x: number, y: number, temps?: number) => {
    const e = Object.assign(new Event(type), {
      pointerId: id, clientX: x, clientY: y, pointerType, button: 0,
    });
    // `timeStamp` est en lecture seule sur `Event` : une propriété propre le masque.
    if (temps !== undefined) Object.defineProperty(e, 'timeStamp', { value: temps });
    cible.dispatchEvent(e);
  };
  return { pointer, journal, demonter };
}

test('deux clics souris sur la même case en moins de 350 ms demandent l’inspection, après les clics', () => {
  const m = montageInspection('mouse', () => true);
  m.pointer('pointerdown', 1, 195, 422, 1000);
  m.pointer('pointerup', 1, 195, 422, 1010);
  m.pointer('pointerdown', 1, 195, 422, 1200);
  m.pointer('pointerup', 1, 195, 422, 1210);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter']);
  // Trop tard : deux clics ordinaires.
  m.pointer('pointerdown', 1, 195, 422, 2000);
  m.pointer('pointerup', 1, 195, 422, 2010);
  m.pointer('pointerdown', 1, 195, 422, 2500);
  m.pointer('pointerup', 1, 195, 422, 2510);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter', 'clic', 'clic']);
  // Une autre case : deux clics ordinaires aussi.
  m.pointer('pointerdown', 1, 195, 422, 3000);
  m.pointer('pointerup', 1, 195, 422, 3010);
  m.pointer('pointerdown', 1, 60, 200, 3100);
  m.pointer('pointerup', 1, 60, 200, 3110);
  assert.deepEqual(m.journal, ['clic', 'clic', 'inspecter', 'clic', 'clic', 'clic', 'clic']);
  m.demonter();
});

test('un appui long au doigt inspecte sans annuler, annule s’il n’y a rien à inspecter, et n’est pas un tap', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let inspecte = true;
    const m = montageInspection('touch', () => inspecte);
    m.pointer('pointerdown', 1, 195, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 195, 422);
    assert.deepEqual(m.journal, ['inspecter'], 'ni clic ni annulation en plus');

    inspecte = false;
    m.pointer('pointerdown', 1, 195, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 195, 422);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler']);

    // Un doigt qui bouge avant le délai glisse la caméra, il n'appuie pas longuement.
    m.pointer('pointerdown', 1, 195, 422);
    m.pointer('pointermove', 1, 260, 422);
    mock.timers.tick(600);
    m.pointer('pointerup', 1, 260, 422);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler']);

    // Un tap bref reste un tap.
    m.pointer('pointerdown', 1, 195, 422);
    m.pointer('pointerup', 1, 195, 422);
    mock.timers.tick(600);
    assert.deepEqual(m.journal, ['inspecter', 'inspecter', 'annuler', 'clic']);
    m.demonter();
  } finally {
    mock.timers.reset();
  }
});
