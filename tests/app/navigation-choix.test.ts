import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexChoix } from '../../src/app/navigation-choix';

test('les choix bouclent dans les deux directions au clavier', () => {
  assert.equal(indexChoix('ArrowRight', 2, 3), 0);
  assert.equal(indexChoix('ArrowLeft', 0, 3), 2);
  assert.equal(indexChoix('ArrowDown', 0, 3), 1);
  assert.equal(indexChoix('ArrowUp', 2, 3), 1);
});
test('les extrémités et les touches natives restent prévisibles', () => {
  assert.equal(indexChoix('Home', 2, 3), 0);
  assert.equal(indexChoix('End', 0, 3), 2);
  assert.equal(indexChoix('Tab', 1, 3), null);
  assert.equal(indexChoix('Enter', 1, 3), null);
  assert.equal(indexChoix('ArrowRight', 0, 0), null);
  assert.equal(indexChoix('ArrowLeft', 0, 1), 0);
});
