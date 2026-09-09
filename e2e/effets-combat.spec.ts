import { test, expect } from '@playwright/test';

test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });

test('le banc rejoue rafales, missiles et tirs courbes sans erreur de rendu', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/atelier');
  await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
  for (const nom of ['Tirer', 'Missile de simulation', 'Tir en cloche']) {
    const bouton = page.getByRole('button', { name: new RegExp(`^${nom}`) }).first();
    await bouton.click();
    // Laisse le tir, son impact et la riposte éventuelle traverser la boucle graphique.
    await page.waitForTimeout(1800);
    await expect(page.locator('canvas.atlas-toile')).toBeVisible();
    await expect(page.getByText(/Rien à montrer pour/)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  }
});
