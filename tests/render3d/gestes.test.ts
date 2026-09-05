import { test } from 'node:test';
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
