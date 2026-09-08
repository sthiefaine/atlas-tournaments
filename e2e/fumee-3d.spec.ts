/** Fumée sur WebGPU réel : sélection, déplacement, tour adverse et météo. */

import { expect, test, type Page } from '@playwright/test';

test.use({
  channel: 'chrome',
  launchOptions: { args: ['--enable-unsafe-webgpu'] },
});

// Le rasteriseur logiciel dessine une image en dizaines de millisecondes : ce
// test a besoin de plus que le budget par défaut du dépôt.
test.setTimeout(180_000);

const TOILE = 'canvas[data-rendu="3d"]';

/** Le pont de développement exposé par `render/jeu.ts`. */
interface PontAtlas {
  rendu: string;
  positionCase(x: number, y: number): { x: number; y: number } | null;
  capturer(): string | null;
  forcerAmbiance(saison: string | null, phase?: string, meteo?: string): void;
  etat(): { journee: number; camp: number; terminee: boolean };
}

declare global {
  interface Window { __atlas?: PontAtlas }
}

/** Position d'écran du centre d'une case, via le pont de développement. */
async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(
    ([cx, cy]) => window.__atlas?.positionCase(cx as number, cy as number) ?? null,
    [x, y],
  );
  expect(p, `la case ${x},${y} doit se projeter à l’écran`).not.toBeNull();
  return p as { x: number; y: number };
}

/** Clique une case du plateau. */
async function cliquerCase(page: Page, x: number, y: number): Promise<void> {
  const p = await positionCase(page, x, y);
  await page.mouse.click(p.x, p.y);
}

/**
 * Nombre de couleurs distinctes dans l'image courante. On passe par
 * `window.__atlas.capturer()`, qui **redessine de façon synchrone** avant de lire
 * le canvas : un tampon non préservé est vidé dès la composition suivante, et
 * le lire directement rendrait une image noire alors que l'écran est correct.
 * Tant que le moteur n'est pas initialisé — il l'est de façon asynchrone —,
 * `capturer()` rend `null` et la richesse vaut zéro : une attente trop courte
 * se lit comme un aplat, pas comme un succès.
 */
async function richesse(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const url = window.__atlas?.capturer() ?? null;
    if (!url) return 0;
    const image = new Image();
    await new Promise((ok, ko) => {
      image.onload = ok;
      image.onerror = ko;
      image.src = url;
    });
    const hors = document.createElement('canvas');
    hors.width = image.naturalWidth;
    hors.height = image.naturalHeight;
    const g = hors.getContext('2d');
    if (!g) return 0;
    g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, hors.width, hors.height).data;
    const couleurs = new Set<string>();
    for (let i = 0; i < d.length; i += 4 * 397) couleurs.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return couleurs.size;
  });
}

test('le plateau 3D se joue, s’éclaire et se laisse regarder', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/jeu/demo?dos=webgpu');

  const toile = page.locator(TOILE);
  await expect(toile).toBeVisible();
  await expect(toile).toHaveAttribute('data-rendu', '3d');
  await expect(toile).toHaveAttribute('data-scenario', 'demo');
  await expect(toile).toHaveAttribute('data-camp', '0');
  await expect(toile).toHaveAttribute('data-journee', '1');

  // Le HUD est en HTML, par-dessus le canvas : il doit être là, et en français.
  await expect(page.locator('[data-hud="html"]')).toBeVisible();
  await expect(page.locator('[data-hud="html"]').getByText('Journée 1', { exact: true })).toBeVisible();

  // --- 01 : le plateau au repos, éclairé, avec son décor et ses unités.
  await expect.poll(() => page.evaluate(() =>
    (window.__atlas as unknown as { mesurer(): { backend: string } } | undefined)?.mesurer()?.backend,
  )).toBe('webgpu');
  await expect.poll(() => richesse(page), { timeout: 30000 }).toBeGreaterThan(40);
  await page.screenshot({ path: 'test-results/fumee-3d-01.png' });
  expect(await richesse(page), 'le plateau doit être dessiné, pas un aplat').toBeGreaterThan(40);

  // --- 02 : sélection d'une unité au clic, et surbrillances de déplacement.
  await cliquerCase(page, 4, 3);
  await expect(toile).toHaveAttribute('data-etat', 'selection');
  await expect(toile).not.toHaveAttribute('data-selection', '');
  const surbrillances = Number(await toile.getAttribute('data-surbrillances'));
  expect(surbrillances, 'la portée de déplacement doit s’allumer').toBeGreaterThan(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/fumee-3d-02.png' });

  const selection = await toile.getAttribute('data-selection');
  const position = () => page.evaluate((id) =>
    (window.__atlas as unknown as { positionUnite(id: string): { x: number; y: number; z: number } })
      .positionUnite(id!), selection);
  const avant = await position();

  // Un ordre complet : une case plus loin, le menu d'ordres HTML, puis « Attendre ».
  await cliquerCase(page, 5, 3);
  await expect(toile).toHaveAttribute('data-etat', 'action');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/fumee-3d-02b.png' });
  await page.getByRole('button', { name: 'Attendre' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'inactif');
  await expect.poll(position).not.toEqual(avant);

  // --- 03 : fin de tour, l'adversaire joue, la main revient en journée 2.
  await page.getByRole('button', { name: 'Fin de tour' }).click();
  await expect(toile).toHaveAttribute('data-camp', '0', { timeout: 60_000 });
  await expect(toile).toHaveAttribute('data-journee', '2', { timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/fumee-3d-03.png' });
  await expect(toile).toHaveAttribute('data-partie', 'en_cours');

  // --- 04 : nuit d'hiver sous la neige — l'ambiance passe par l'éclairage.
  await page.evaluate(() => window.__atlas?.forcerAmbiance('hiver', 'nuit', 'neige'));
  // La transition d'ambiance dure ~600 ms de **temps de jeu**, et la boucle
  // n'avance que d'une image à la fois : en rendu logiciel, où une image coûte
  // trois cents millisecondes, il faut laisser passer une dizaine d'images.
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'test-results/fumee-3d-04.png' });
  await expect(page.getByText('Hiver · Nuit')).toBeVisible();
  await expect(page.locator('.meteo-case[data-courant="oui"]').getByText('Neige', { exact: true })).toBeVisible();
  expect(await richesse(page), 'la nuit reste lisible').toBeGreaterThan(25);

  expect(erreurs, 'aucune erreur de page').toEqual([]);
});

test('sans WebGPU, le jeu explique son indisponibilité sans ouvrir WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    const origine = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof origine>) {
      if (String(args[0]).startsWith('webgl')) throw new Error('Repli WebGL interdit');
      return origine.apply(this, args);
    } as typeof origine;
  });
  await page.goto('/jeu/demo?dos=webgl');
  await expect(page.locator('section[role="alert"]')).toContainText('WebGPU est indisponible');
});
