/**
 * L'écran-titre joue sa partie d'exhibition sur la **peau 2D** — sur ordinateur
 * comme sur téléphone — et le plateau SVG n'y paraît qu'en **repli**.
 *
 * Ce que le spec vérifie, et rien d'autre :
 *
 * - l'attract se monte, dessine une image (`data-attract="pret"`), et c'est la
 *   peau 2D (`data-rendu="2d"`, un contexte WebGL 2) ; le fond de la vitrine
 *   passe à l'attract (`data-fond`) sans que le plateau SVG ait jamais paru ;
 * - il se monte **aussi sur téléphone**, que la 3D laissait immobile ;
 * - la page ne télécharge ni three ni `render3d/` ;
 * - sa toile ne prend pas le focus du clavier : c'est un fond ;
 * - sous animations réduites — celles de l'appareil, ou le réglage du joueur —,
 *   ou quand l'appareil demande d'économiser ses données, aucune partie ne se
 *   monte et le plateau SVG paraît.
 *
 * **Le témoin** : contre la révision d'avant la bascule, l'attract est en 3D
 * (pas de `data-rendu="2d"`, des morceaux de three) et ne se monte pas au
 * téléphone ; les trois premiers tests tombent.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-x npx next dev --turbopack -p 3414`, puis
 * `E2E_BASE_URL=http://localhost:3414 npx playwright test e2e/accueil-2d.spec.ts [--browser=webkit] --output=<dossier>`.
 */
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(240_000);
test.use({
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal : le rasteriseur
  // logiciel coûte une seconde par image sur une machine chargée.
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

/** Ouvre l'accueil en relevant les morceaux de JavaScript et les erreurs de page. */
async function ouvrir(page: Page): Promise<{ morceaux: string[]; erreurs: string[] }> {
  const morceaux: string[] = [];
  const erreurs: string[] = [];
  page.on('response', (r) => { if (/\.js(\?|$)/.test(r.url())) morceaux.push(r.url()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto('/');
  return { morceaux, erreurs };
}

/** L'attract monté, dessiné, en 2D, et rien de la 3D dans la page. */
async function verifierAttract(page: Page, releve: { morceaux: string[]; erreurs: string[] }): Promise<void> {
  const vitrine = page.locator('.accueil-vitrine');
  const attract = page.locator('.accueil-attract');
  // Tant qu'on attend l'attract, le fond reste la nappe : jamais le plateau à plat.
  await expect(attract).toHaveAttribute('data-attract', 'pret', { timeout: 120_000 });
  await expect(attract).toHaveAttribute('data-rendu', '2d');
  await expect(vitrine).toHaveAttribute('data-fond', 'attract');
  await expect(page.locator('.accueil-vitrine .atlas-plateau')).toHaveCount(0);
  const toile = attract.locator('canvas');
  await expect(toile).toHaveCount(1);
  // La toile a déjà un contexte WebGL 2 : le redemander rend le même.
  expect(await toile.evaluate((c) => (c as HTMLCanvasElement).getContext('webgl2') !== null), 'un contexte WebGL 2').toBe(true);
  expect(await toile.getAttribute('tabindex'), 'le fond ne prend pas le focus').toBe('-1');
  expect(releve.morceaux.length, 'des morceaux ont été relevés').toBeGreaterThan(0);
  expect(releve.morceaux.filter((u) => /three|render3d/i.test(u)), 'aucun morceau de three ni de render3d').toEqual([]);
  expect(releve.erreurs, 'aucune erreur de page').toEqual([]);
}

test('sur ordinateur, l’attract joue en 2D et le plateau à plat ne paraît jamais', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const releve = await ouvrir(page);
  // Le fond de l'attente : la nappe, rien d'autre — relevé tant que l'attract
  // n'a pas dessiné.
  const fond = await page.locator('.accueil-vitrine').getAttribute('data-fond');
  expect(['attente', 'attract']).toContain(fond);
  await verifierAttract(page, releve);
});

test.describe('au téléphone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('l’attract se monte aussi : la 2D ne coûte presque rien', async ({ page }) => {
    const releve = await ouvrir(page);
    await verifierAttract(page, releve);
    // Le menu reste à portée du pouce au-dessus d'un fond qui joue.
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test('sous animations réduites par l’appareil, aucune partie ne se monte : le plateau à plat paraît', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.accueil-vitrine')).toHaveAttribute('data-fond', 'repli', { timeout: 60_000 });
  await expect(page.locator('.accueil-vitrine .atlas-plateau')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.accueil-attract')).toHaveCount(0);
});

test('l’économiseur de données de l’appareil épargne le moteur et ses images : le plateau à plat paraît', async ({ page }) => {
  // Un téléphone qui a demandé qu'on lui épargne ses données : l'attract
  // téléchargerait le moteur de jeu et les pages d'images qu'il montre.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' }, configurable: true });
  });
  await page.goto('/');
  await expect(page.locator('.accueil-vitrine')).toHaveAttribute('data-fond', 'repli', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.accueil-attract')).toHaveCount(0);
});

test('le réglage du joueur suffit, même quand l’appareil ne demande rien', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('atlas:reglages:v1', JSON.stringify({ animationsReduites: true })); } catch { /* stockage refusé */ }
  });
  await page.goto('/');
  await expect(page.locator('.accueil-vitrine')).toHaveAttribute('data-fond', 'repli', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.accueil-attract')).toHaveCount(0);
});
