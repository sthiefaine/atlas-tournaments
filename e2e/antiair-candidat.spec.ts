/** Contrôle réseau/DOM du candidat : aucune capture ni approbation artistique. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
test.use({ trace: 'off', screenshot: 'off', video: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('anti-air : lot candidat exact, trois vues et cinq clips accessibles', async ({ page, context, baseURL }) => {
  const secret = process.env.E2E_ASSETS_SECRET;
  test.skip(!secret, 'Serveur isolé requis');
  await context.addCookies([{ name: COOKIE_ADMIN, value: signerSession({ sujet: 'test-antiair', expire: Date.now() + 600000 }, secret!), url: baseURL! }]);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  const fichier = 'unite_antiair_base_lod0.glb';
  const requete = await context.request.get('/assets/candidats/' + fichier);
  expect(requete.status()).toBe(200);
  expect(await requete.body()).toEqual(readFileSync('assets/livraisons/unite_antiair_base/' + fichier));
  await page.goto('/admin/assets/unite_antiair_base');
  const banc = page.locator('#candidat-expose');
  await banc.getByRole('button', { name: 'Ouvrir le banc du candidat 3D', exact: true }).click();
  await expect(banc.locator('[data-pret=true]')).toBeVisible();
  await banc.getByLabel('Taille réelle : 48 px/m').check();
  for (const vue of ['dessus', 'trois_quarts', 'jeu']) await banc.getByRole('combobox', { name: 'Vue', exact: true }).selectOption(vue);
  for (const clip of ['repos', 'deplacement', 'tir', 'touche', 'hors_jeu']) {
    await banc.getByRole('combobox', { name: 'Clip', exact: true }).selectOption(clip);
    await expect(banc.locator('[data-pret=true]')).toBeVisible();
    await expect(banc.getByRole('button', { name: 'Lire', exact: true })).toBeEnabled();
  }
  expect(erreurs).toEqual([]);
});
