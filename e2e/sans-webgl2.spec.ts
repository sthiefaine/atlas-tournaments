/**
 * Un navigateur **sans WebGL 2** : la seule chose que la peau 2D exige.
 *
 * Le jeu disait « WebGPU est indisponible » à tout échec, y compris sur un
 * appareil qui avait WebGPU (`CLAUDE.md`, 8 septembre : « le libellé reste à
 * corriger »). Depuis la bascule en 2D (23 septembre 2026), l'écran d'échec
 * nomme ce qui manque vraiment : WebGL 2 — et plus jamais WebGPU, que le jeu
 * n'exige plus. L'écran-titre, lui, montre son plateau à plat : c'est
 * exactement le cas pour lequel ce repli existe.
 *
 * On retire WebGL 2 en refusant `getContext('webgl2')` avant tout script de la
 * page — ce que fait un navigateur qui ne l'a pas —, ce qui marche aussi bien
 * sous Chromium que sous WebKit.
 *
 * **Le témoin** : avant la bascule, l'écran d'échec parlait de WebGPU, et
 * l'accueil n'avait pas de `data-fond`.
 */
import { expect, test } from '@playwright/test';

test.setTimeout(180_000);
test.use({ trace: 'off' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const origine = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, ...reste: unknown[]) {
      if (type === 'webgl2') return null;
      return (origine as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => RenderingContext | null).call(this, type, ...reste);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
});

test('le jeu dit qu’il lui manque WebGL 2, et ne parle plus de WebGPU', async ({ page }) => {
  await page.goto('/jeu/demo');
  const alerte = page.locator('.atlas-briefing[role="alert"]');
  await expect(alerte).toBeVisible({ timeout: 120_000 });
  await expect(alerte.locator('h1')).toContainText('WebGL 2');
  await expect(alerte).not.toContainText('WebGPU');
  // Une sortie, toujours : rejouer, ou revenir à la campagne.
  await expect(alerte.getByRole('link')).toHaveAttribute('href', '/campagne');
});

test('l’écran-titre montre son plateau à plat, sans monter de partie', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.accueil-vitrine')).toHaveAttribute('data-fond', 'repli', { timeout: 60_000 });
  await expect(page.locator('.accueil-vitrine .atlas-plateau')).toBeVisible();
  await expect(page.locator('.accueil-attract')).toHaveCount(0);
});
