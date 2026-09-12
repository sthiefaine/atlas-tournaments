import { test, expect } from '@playwright/test';
test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('Premier contact charge les GLB nationaux et leurs textures depuis le serveur', async ({ page }) => {
  const recus = new Set<string>();
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('response', r => { if (r.ok()) recus.add(new URL(r.url()).pathname); });
  await page.goto('/jeu/premier_contact');
  await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
  for (const id of ['kit_fr_infanterie', 'kit_fr_char_leger', 'kit_lu_infanterie', 'kit_lu_recon']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_lod0.glb`), { timeout: 30000 }).toBe(true);
    await expect.poll(() => [...recus].some(p => p.startsWith(`/assets/modeles/${id}_`) && p.endsWith('.png')), { timeout: 30000 }).toBe(true);
  }
  for (const id of ['batiment_qg_fr_ile_de_france', 'batiment_qg_lu']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_lod0.glb`), { timeout: 30000 }).toBe(true);
  }
  for (const id of ['terrain_plaine', 'terrain_foret', 'terrain_riviere', 'terrain_route', 'terrain_pont']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_albedo.png`), { timeout: 30000 }).toBe(true);
  }
  for (const lod of [0, 1]) {
    await expect.poll(() => recus.has(`/assets/modeles/terrain_plaine_lod${lod}.glb`), { timeout: 30000 }).toBe(true);
  }
  expect(erreurs).toEqual([]);
});
