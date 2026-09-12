/** Réception administrateur : assertions DOM/réseau seulement, aucune capture. */
import { test, expect } from '@playwright/test';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
const secret = process.env.E2E_ASSETS_SECRET;
test.use({ trace: 'off', actionTimeout: 20000, launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test.setTimeout(180000);
test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!secret, 'Lancer sur un serveur de test isolé avec AUTH_SECRET=E2E_ASSETS_SECRET.');
  await context.addCookies([{ name: COOKIE_ADMIN, value: signerSession({ sujet: 'test-reception', expire: Date.now() + 600000 }, secret), url: baseURL! }]);
});
test('catalogue réel, fiches, chargement différé et PNG partagés', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/admin/assets?etat=conforme');
  await expect(page.getByRole('heading', { name: 'Bibliothèque d’assets', exact: true })).toBeVisible();
  await expect(page.locator('a.asset-carte[href="/admin/assets/terrain_plaine"]')).toBeVisible();
  await page.locator('a.asset-carte[href="/admin/assets/terrain_plaine"]').click();
  await expect(page.getByRole('heading', { name: 'plaine', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ouvrir le banc de réception 3D' }).click();
  await expect(page.locator('[data-pret="true"]')).toHaveCount(1, { timeout: 90000 });
  await expect(page.getByRole('combobox', { name: 'LOD', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-pret="true"]')).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Taille réelle : 48 px/m').check();
  await expect(page.locator('[data-pret="true"]')).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Mosaïque 4×4, quarts de tour').check();
  await expect(page.locator('[data-pret="true"]')).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Carte', { exact: true }).selectOption('normale');
  await expect(page.locator('[data-pret="true"]')).toHaveCount(1, { timeout: 60000 });
  await page.getByRole('button', { name: 'Fermer le banc de réception 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
test('les routes de revue et historique exigent une session', async ({ playwright, baseURL }) => {
  const anonyme = await playwright.request.newContext({ baseURL });
  const revue = await anonyme.post('/api/admin/assets/terrain_plaine/revue', { data: {} });
  expect(revue.status()).toBe(403);
  const fichier = await anonyme.get(`/api/admin/assets/terrain_plaine/historique/${'a'.repeat(64)}/terrain_plaine_lod0.glb`);
  expect(fichier.status()).toBe(403);
  await anonyme.dispose();
});

test('masque, couleur témoin, animation et comparaison gardent un banc utilisable', async ({ page }) => {
  const erreurs: string[] = []; page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/admin/assets/unite_antiair_base');
  await page.getByRole('button', { name: 'Ouvrir le banc de réception 3D' }).click();
  const pret = page.locator('[data-pret="true"]');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Carte', { exact: true }).selectOption('masque_equipe');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Carte', { exact: true }).selectOption('pbr');
  await page.getByLabel('Équipe', { exact: true }).selectOption('#008fd5');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Clip', { exact: true }).selectOption('hors_jeu');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Position', { exact: true }).fill('1');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Éclairage', { exact: true }).selectOption('nuit');
  await expect(pret).toHaveCount(1, { timeout: 60000 });
  await page.getByLabel('Comparer', { exact: true }).selectOption('reference');
  await expect(pret).toHaveCount(2, { timeout: 60000 });
  await page.getByRole('button', { name: 'Fermer le banc de réception 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('familles, recherche et biographies se parcourent sans charger la 3D', async ({ page }) => {
  await page.goto('/admin/assets');
  await expect(page.locator('.asset-carte')).toHaveCount(36);
  await page.getByRole('searchbox').fill('antiair');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page.locator('.asset-carte')).toHaveCount(1);
  await page.locator('.asset-carte').click();
  await expect(page.locator('.asset-carte')).toHaveCount(25);
  await page.locator('a.asset-carte[href="/admin/assets/unite_antiair_base"]').click();
  await expect(page.getByRole('button', { name: 'Copier le prompt pour Codex' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Fichiers obligatoires/ })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Personnages et histoire', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sélène Veyr', exact: true })).toBeVisible();
});
