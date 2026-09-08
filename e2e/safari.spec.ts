/**
 * Ce que Safari fait du plateau — et il en fait un écran d'erreur.
 *
 * Trouvé le 8 septembre 2026 en cherchant pourquoi le jeu est « impossible à
 * jouer sur téléphone ». Sur WebKit, le moteur se monte, puis **la première
 * image lève** :
 *
 *     RangeError: Maximum call stack size exceeded.
 *       at cyrb53 … at getCacheKey … at getCacheKey$1 … at getCacheKey
 *       at getDynamicCacheKey … at RenderObject … at createRenderObject
 *       at _renderObjectDirect … at _renderScene … at render … at dessiner
 *
 * C'est la clé de programme d'un matériau à nœuds, que three calcule en
 * **descendant récursivement** le graphe. La pile de JavaScriptCore est plus
 * courte que celle de V8 : le même graphe passe sur Chromium et déborde ici.
 * Trois faits mesurés qui cadrent le défaut :
 *
 * - ce n'est **pas** une affaire de dos. En retirant `navigator.gpu` pour forcer
 *   le repli WebGL 2, l'écran d'erreur est le même : le système de nœuds est
 *   commun aux deux, un repli ne sauverait rien ;
 * - WebGL 2 **est** disponible (`getContext('webgl2')` rend un contexte) et
 *   `requestAdapter()` rend un adaptateur : le message « cet appareil n'a pas de
 *   WebGL 2 » est faux, et c'est ce qu'on montre au joueur ;
 * - le voile d'erreur rend le conteneur `inert`. Le jeu est là, dessous, et plus
 *   rien n'est touchable : c'est le « impossible de toucher » du rapport.
 *
 * **Corrigé le 8 septembre 2026.** La cause n'était ni la profondeur du graphe —
 * mesurée à 23 nœuds quand WebKit tolère 73 000 appels — ni le dos WebGPU. C'est
 * une faute d'amont dans `NodeUtils.getCacheKey` de r170, qui pousse le tableau
 * de la clé **dans lui-même** ; `cyrb53` le convertit ensuite en nombre, ce qui
 * appelle `Array.prototype.join` sur un tableau auto-référent — V8 s'en tire par
 * sa détection de cycle, JavaScriptCore lève. `scripts/rustine-three.mjs` corrige
 * la ligne à l'installation ; three l'a corrigée de son côté en 0.186.
 */
import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
test.setTimeout(240_000);

test('sur Safari, le plateau démarre au lieu de montrer un écran d’erreur', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'ce défaut est propre au moteur de Safari');
  await page.goto('/jeu/demo');
  await expect(page.locator('canvas[data-rendu="3d"]')).toBeVisible({ timeout: 120_000 });
  // Le voile d'erreur ne doit pas paraître, et la page ne doit pas devenir inerte.
  await page.waitForTimeout(6000);
  await expect(page.locator('.atlas-voile')).toHaveCount(0);
});
