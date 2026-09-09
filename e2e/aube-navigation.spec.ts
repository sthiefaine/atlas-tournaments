/** Vérifications fonctionnelles, sans capture ni jugement visuel. */
import { test, expect } from '@playwright/test';
test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('les coalitions et les drones sont annoncées comme essais et ouvrent un plateau', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/jeu');
  await expect(page.locator('a[href^="/jeu/aube_"]')).toHaveCount(6);
  await page.locator('a[href="/jeu/aube_batteries_2v1"]').click();
  await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fin de tour/i }).first()).toBeVisible({ timeout: 45000 });
  expect(erreurs).toEqual([]);
});

test('la difficulté choisie est conservée et visible depuis la campagne', async ({ page }) => {
  await page.goto('/reglages');
  const difficile = page.getByRole('radio', { name: 'Difficile', exact: true });
  await difficile.click();
  await expect(difficile).toHaveAttribute('aria-checked', 'true');
  await page.goto('/campagne');
  await expect(page.locator('.aube-parcours')).toContainText('Mode difficile');
  await page.goto('/reglages');
  await expect(page.getByRole('radio', { name: 'Difficile', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('une quête attend sa décision de campagne, puis ouvre un vrai plateau', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/jeu/aube_convoi_secondaire');
  await expect(page.getByRole('heading', { name: 'Quête encore fermée', exact: true })).toBeVisible();
  await expect(page.locator('canvas.atlas-toile')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('atlas:qualification:v1', JSON.stringify({
    version: 1, victoires: ['aube_batteries_2v1'], canonVersion: 1,
    decisions: { 'aube_batteries_2v1:1:1': { scenario: 'aube_batteries_2v1', scenarioVersion: 1, canonVersion: 1, choix: 'mutualiser_reserves' } },
    journal: ['aube_batteries_2v1:1:1'],
  })));
  await page.reload();
  await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Passer', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fin de tour/i }).first()).toBeVisible();
  expect(erreurs).toEqual([]);
});
