import { test, expect } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off', channel: 'chrome' });
for (const width of [390, 1440]) {
  test('menus : navigation et commandes lisibles à ' + width + ' px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    for (const route of ['/jeu', '/campagne', '/reglages']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
    }
    await page.goto('/jeu');
    const campagne = page.getByRole('link', { name: /Ouvrir la campagne/ });
    await expect(campagne).toBeVisible();
    await campagne.focus();
    expect(await campagne.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await expect(page.locator('.jeu-libre-partie h3').first()).toBeVisible();
    const boutons = page.locator('.jeu-libre-bouton');
    for (const bouton of await boutons.all()) {
      expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await campagne.click();
    await expect(page).toHaveURL(/\/campagne$/);
    expect(erreurs).toEqual([]);
  });
}
