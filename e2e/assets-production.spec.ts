/** Export des commandes : contrat réseau et parcours DOM, sans capture. */
import { test, expect } from '@playwright/test';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
const secret = process.env.E2E_ASSETS_SECRET;
test.use({ trace: 'off' });
test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!secret, 'Serveur isolé AUTH_SECRET requis.');
  await context.addCookies([{name: COOKIE_ADMIN, value: signerSession({sujet:'test-production', expire:Date.now()+600000}, secret), url:baseURL!}]);
});
test('exports individuels et global authentifiés, aucune approbation inventée', async ({ context, playwright, baseURL }) => {
  const anonyme = await playwright.request.newContext({baseURL});
  expect((await anonyme.get('/admin/assets/export')).status()).toBe(401);
  await anonyme.dispose();
  const individuel = await context.request.get('/admin/assets/export?cle=unite_antiair_base');
  expect(individuel.status()).toBe(200);
  expect(individuel.headers()['content-disposition']).toContain('unite_antiair_base_production.json');
  const commande = await individuel.json();
  expect(commande.asset).toBe('unite_antiair_base');
  expect(commande.fichiersObligatoires).toContain('unite_antiair_base_lod0.glb');
  expect(commande.avertissement).toContain('approbation artistique');
  const prompt = await context.request.get('/admin/assets/export?cle=unite_antiair_base&format=prompt');
  expect(prompt.status()).toBe(200); expect(await prompt.text()).toContain('unite_antiair_base');
  expect((await context.request.get('/admin/assets/export?cle=..%2Fsecret')).status()).toBe(400);
  expect((await context.request.get('/admin/assets/export?cle=asset_inexistant')).status()).toBe(404);
  const modele = await context.request.get('/assets/candidats/unite_drone_marin_base_lod0.glb');
  expect(modele.status()).toBe(200);
  const octets = await modele.body();
  expect(octets.subarray(0, 4).toString()).toBe('glTF');
  const image = await context.request.get('/assets/candidats/unite_drone_marin_base_albedo.png');
  expect(image.status()).toBe(200);
  expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const global = await context.request.get('/admin/assets/export');
  expect(global.status()).toBe(200); expect((await global.json()).total).toBeGreaterThan(1000);
});
test('la fiche et la bibliothèque permettent de parcourir les étapes et télécharger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/assets?famille=unite_antiair_base');
  await expect(page.getByRole('combobox', {name:'Famille', exact:true})).toBeVisible();
  await expect(page.getByRole('link', {name:'Télécharger le plan JSON'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.goto('/admin/assets/unite_antiair_base');
  await expect(page.getByRole('navigation', {name:'Parcours de production'})).toBeVisible();
  await expect(page.getByRole('link', {name:'Télécharger le manifeste JSON'})).toBeVisible();
  await expect(page.getByRole('list', {name:'État des étapes'})).toContainText('Validation artistique');
  await page.goto('/admin/assets/unite_drone_marin_base');
  await expect(page.locator('#candidat-expose')).toBeVisible();
  await expect(page.getByRole('button', {name:'Ouvrir le banc du candidat 3D', exact:true})).toBeVisible();
  await page.getByText('Télécharger les GLB et les textures du candidat', { exact: true }).click();
  await expect(page.locator('a[href^="/assets/candidats/unite_drone_marin_base_lod0.glb?"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('la fiche herbe haute reste contrastée, navigable au clavier et sans débordement', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/assets/terrain_herbe_haute');
  await expect(page.getByRole('heading', { name: 'Votre prochaine étape' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Parcours de production' });
  await navigation.getByRole('link', { name: '2. Fichiers attendus' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#fichiers$/);
  await expect(page.locator('#fichiers')).toContainText('réceptionnés');
  const specification = page.locator('#specifications > summary');
  await specification.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#specifications')).toHaveAttribute('open', '');
  const contrastes = await page.evaluate(() => {
    function rgb(texte: string) { return (texte.match(/[\d.]+/g) ?? []).map(Number); }
    function lumi(c: number[]) { return c.slice(0,3).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((s,x,i) => s+x*([.2126,.7152,.0722][i] ?? 0),0); }
    return [...document.querySelectorAll('main h2, main h3, main p, main summary, main .admin-action, #fichiers code, #fichiers li > span')].filter(el => el.getClientRects().length).map(el => {
      const style = getComputedStyle(el);
      let fond: Element | null = el;
      while (fond && rgb(getComputedStyle(fond).backgroundColor)[3] === 0) fond = fond.parentElement;
      const l1 = lumi(rgb(style.color)), l2 = lumi(rgb(getComputedStyle(fond ?? el).backgroundColor));
      return { texte: el.textContent?.slice(0,60), ratio: (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05), opacite: style.opacity };
    });
  });
  for (const resultat of contrastes) { expect(resultat.ratio, resultat.texte).toBeGreaterThanOrEqual(4.5); expect(resultat.opacite).toBe('1'); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
