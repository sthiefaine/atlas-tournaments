import { test, expect } from '@playwright/test';

test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });

test('cadence mémorisée et mode tactique réellement appliqué puis restauré', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/reglages');
  const groupe = page.getByRole('radiogroup', { name: 'Vitesse des animations' });
  await groupe.getByRole('radio', { name: 'Rapide ×2', exact: true }).click();
  await page.reload();
  await expect(groupe.getByRole('radio', { name: 'Rapide ×2', exact: true })).toHaveAttribute('aria-checked', 'true');
  await groupe.getByRole('radio', { name: 'Instantanée', exact: true }).click();
  await page.goto('/jeu/aube_batteries_2v1');
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  const bascule = page.locator('[data-action="mode_tactique"]');
  if (!await bascule.isVisible()) await page.locator('details.outils-vue > summary').click();
  await bascule.click();
  await expect(bascule).toHaveAttribute('aria-pressed', 'true');
  await expect(toile).toHaveAttribute('data-mode-tactique', 'true');
  await page.reload();
  await expect(toile).toHaveAttribute('data-mode-tactique', 'true', { timeout: 45000 });
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  if (!await bascule.isVisible()) await page.locator('details.outils-vue > summary').click();
  await bascule.click();
  await expect(toile).toHaveAttribute('data-mode-tactique', 'false');
  expect(erreurs).toEqual([]);
});
