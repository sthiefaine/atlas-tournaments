/** Parcours et chargement réels, sans capture ni inspection visuelle. */
import { test, expect } from '@playwright/test';
import campagne from '../content/campagne.json';
test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('le carnet reprend un ancien profil au cinquième des dix tutoriels', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlas:qualification:v1', JSON.stringify({ version: 1,
    victoires: ['premier_contact', 'villes_du_bocage', 'chantier_des_usines', 'qg_de_la_presquile', 'pacte_du_col', 'couleurs_alliees'] })));
  await page.goto('/campagne');
  await expect(page.locator('.station')).toHaveCount(12);
  await expect(page.locator('a[href="/jeu/opus1_tutoriel_05"]')).toBeVisible();
  expect(await page.locator('.station[aria-current="step"]').count()).toBeLessThanOrEqual(1);
});
for (const mission of campagne.missions.filter(m => m.scenarioCle.startsWith('opus1_tutoriel_'))) {
  test(`${mission.scenarioCle} charge son plateau et ses commandes`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(`/jeu/${mission.scenarioCle}`);
    await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await expect(page.getByRole('button', { name: /Fin de tour/i }).first()).toBeVisible({ timeout: 45000 });
    expect(erreurs).toEqual([]);
  });
}
