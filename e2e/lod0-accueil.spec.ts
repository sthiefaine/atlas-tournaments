import { test, expect } from '@playwright/test';
test.use({ trace: 'off', screenshot: 'off', video: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('accueil : la démonstration ne demande que des modèles LOD0', async ({ page }) => {
  const demandes: string[] = [];
  const erreurs: string[] = [];
  page.on('request', r => demandes.push(new URL(r.url()).pathname));
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await expect.poll(() => demandes.some(p => /_lod0\.glb$/.test(p)), { timeout: 45000 }).toBe(true);
  expect(demandes.filter(p => /_lod[1-9]\.glb$/.test(p))).toEqual([]);
  expect(erreurs).toEqual([]);
});
