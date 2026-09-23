/**
 * Ce que Safari fait du plateau.
 *
 * Écrit le 8 septembre 2026, quand le jeu était « impossible à jouer sur
 * téléphone » : sur WebKit, le moteur WebGPU se montait, puis **la première
 * image levait** (`RangeError: Maximum call stack size exceeded`, une faute
 * d'amont de three r170 dans `NodeUtils.getCacheKey`, que
 * `scripts/rustine-three.mjs` corrige à l'installation). Le voile d'erreur
 * rendait alors le conteneur `inert` : le jeu était là, dessous, et plus rien
 * n'était touchable.
 *
 * **Depuis le 23 septembre 2026, la route du jeu monte la peau 2D** — les
 * images cuites, en WebGL 2 — et n'importe plus three du tout. Ce spec vérifie
 * désormais que Safari démarre **cette** peau, à l'adresse nue, sans voile
 * d'erreur, qu'elle dessine réellement, et qu'aucun morceau de three ni de
 * `render3d/` n'est téléchargé. Il tombe si la route revient à la 3D : la toile
 * `data-rendu="2d"` ne paraît plus.
 */
import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  trace: 'off',
});
test.setTimeout(240_000);

test('sur Safari, le plateau 2D démarre au lieu de montrer un écran d’erreur', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'ce défaut est propre au moteur de Safari');
  const morceaux: string[] = [];
  const erreurs: string[] = [];
  page.on('response', (r) => { if (/\.js(\?|$)/.test(r.url())) morceaux.push(r.url()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.goto('/jeu/demo');
  const toile = page.locator('canvas[data-rendu="2d"]');
  await expect(toile).toBeVisible({ timeout: 120_000 });
  // Une image est réellement passée, sur un contexte WebGL 2.
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as { __atlas?: { mesurer(): { appels: number; backend: string | null } | null } };
    const m = w.__atlas?.mesurer();
    return m && m.appels > 0 ? m.backend : null;
  }), { timeout: 60_000 }).toBe('webgl2');

  // Le voile d'erreur ne doit pas paraître, et la page ne doit pas devenir inerte.
  await page.waitForTimeout(3000);
  await expect(page.locator('.atlas-voile')).toHaveCount(0);
  expect(await page.locator('[data-scenario="demo"][inert]').count(), 'le plateau reste touchable').toBe(0);
  expect(morceaux.filter((u) => /three|render3d/i.test(u)), 'aucun morceau de three ni de render3d').toEqual([]);
  expect(erreurs, 'aucune erreur de page').toEqual([]);
});
