import { test, expect } from '@playwright/test';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
const secret = process.env.E2E_ASSETS_SECRET;
test.use({ trace: 'off' });
test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!secret, 'Serveur isolé AUTH_SECRET requis.');
  await context.addCookies([{ name: COOKIE_ADMIN, value: signerSession({ sujet: 'test-personnages', expire: Date.now() + 600000 }, secret), url: baseURL! }]);
});
test('le registre présente pouvoirs, super-pouvoirs et histoires sans débordement mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/personnages');
  await expect(page.getByRole('heading', { name: 'Personnages, pouvoirs et histoire' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(37);
  await expect(page.getByRole('region', { name: 'Pouvoir de Ariane Belloc', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Super-pouvoir de Ariane Belloc', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('textbox', { name: 'Rechercher un personnage' }).fill('Ariane');
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await page.goto('/admin/personnages?groupe=civils');
  await expect(page.locator('article')).toHaveCount(3);
  await expect(page.getByText('Personnage civil : aucun pouvoir de commandement.')).toHaveCount(3);
});
