/**
 * Test de fumée du **rendu 3D** : on ouvre `/jeu/demo?rendu=3d`, on attend que le
 * plateau soit monté, on sélectionne une unité au clic, on regarde les
 * surbrillances s'allumer, on termine le tour, on laisse l'adversaire jouer,
 * puis on force une nuit d'hiver sous la neige.
 *
 * Trois choses valent d'être dites sur ce fichier :
 *
 * - **WebGL en headless** demande d'ouvrir explicitement le rendu logiciel
 *   (`--use-angle=swiftshader`), sans quoi Chromium refuse le contexte sur une
 *   machine sans GPU. Les images sortent donc d'un rasteriseur logiciel : elles
 *   sont justes, mais plus lentes que sur une vraie carte ;
 * - **le moteur est `WebGPURenderer`** (7 septembre 2026), qui tourne sur WebGPU
 *   si `navigator.gpu` rend un adaptateur et sur son dos WebGL 2 sinon. Chromium
 *   headless expose `navigator.gpu` mais ne rend **pas** d'adaptateur sans carte :
 *   le rendu retomberait de lui-même sur WebGL, après une demande d'adaptateur
 *   qui ne mène à rien. `--disable-blink-features=WebGPU` retire `navigator.gpu`
 *   et rend la fumée **déterministe** : c'est le dos WebGL 2, sous SwiftShader,
 *   celui des captures de référence et des mesures de `doc/10` §9.2. Pour
 *   essayer WebGPU sur le rasteriseur logiciel à la place, remplacer ce drapeau
 *   par `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` — non essayé,
 *   et rien ne dit que Vulkan logiciel soit présent sur la machine de test ;
 * - **on ne clique pas une case « au pixel »** : le rendu expose en développement
 *   `window.__atlas.positionCase(x, y)`, qui projette le centre d'une case à
 *   l'écran. Le test clique donc une case du jeu, pas une coordonnée devinée —
 *   ce qui le rend insensible au cadrage, au zoom et au quart de tour courant.
 *
 * Les captures vont dans `test-results/`, pour la relecture humaine du style.
 */

import { expect, test, type Page } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      // Le dos WebGL 2 du moteur, à coup sûr : voir l'en-tête.
      '--disable-blink-features=WebGPU',
    ],
  },
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
  await page.goto('/jeu/demo?rendu=3d');

  const toile = page.locator(TOILE);
  await expect(toile).toBeVisible();
  await expect(toile).toHaveAttribute('data-rendu', '3d');
  await expect(toile).toHaveAttribute('data-scenario', 'demo');
  await expect(toile).toHaveAttribute('data-camp', '0');
  await expect(toile).toHaveAttribute('data-journee', '1');

  // Le HUD est en HTML, par-dessus le canvas : il doit être là, et en français.
  await expect(page.locator('[data-hud="html"]')).toBeVisible();
  await expect(page.getByText('Journée 1')).toBeVisible();

  // --- 01 : le plateau au repos, éclairé, avec son décor et ses unités.
  await page.waitForTimeout(1500);
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

  // Un ordre complet : une case plus loin, le menu d'ordres HTML, puis « Attendre ».
  await cliquerCase(page, 5, 3);
  await expect(toile).toHaveAttribute('data-etat', 'action');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/fumee-3d-02b.png' });
  await page.getByRole('button', { name: 'Attendre' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'inactif');

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
  // Le Bulletin est un panneau repliable : ses prévisions ne s'affichent qu'une
  // fois ouvert. On l'ouvre comme le joueur, puis on lit ce qu'il annonce.
  await page.locator('.atlas-hud .bulletin summary').click();
  await expect(page.getByText('Hiver · Nuit')).toBeVisible();
  await expect(page.getByText('Neige', { exact: true })).toBeVisible();
  expect(await richesse(page), 'la nuit reste lisible').toBeGreaterThan(25);

  expect(erreurs, 'aucune erreur de page').toEqual([]);
});
