/**
 * Test de fumée du rendu : on ouvre `/jeu/demo`, on sélectionne une unité, on
 * vérifie qu'une surbrillance apparaît, on donne un ordre, on termine le tour et
 * on attend que l'adversaire joue.
 *
 * Un canvas ne s'inspecte pas comme du DOM : le rendu expose donc son état
 * d'interaction en attributs `data-*` (`render/jeu.ts`, `marquerEtat`), et le
 * test vérifie en plus que l'image dessinée n'est pas un aplat. Les captures
 * vont dans `test-results/`, pour la relecture humaine du style vectoriel.
 */

import { expect, test, type Locator } from '@playwright/test';

const CANVAS = 'canvas[data-scenario="demo"]';

/** Nombre de couleurs distinctes échantillonnées dans le canvas. */
async function richesse(canvas: Locator): Promise<number> {
  return canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (!g) return 0;
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const couleurs = new Set<string>();
    for (let i = 0; i < d.length; i += 4 * 499) couleurs.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return couleurs.size;
  });
}

test('une partie de démonstration se joue du clic à la fin de tour', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));

  // `?rendu=2d` force la peau vectorielle : depuis la bascule 3D du 5 septembre,
  // `/jeu/demo` sans paramètre prend la 3D dès que WebGL 2 répond — ce qui est le
  // cas de Chromium headless. Le rendu 3D a son propre test (`fumee-3d.spec.ts`).
  await page.goto('/jeu/demo?rendu=2d');

  const canvas = page.locator(CANVAS);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-pret', '1');
  await expect(canvas).toHaveAttribute('data-etat', 'inactif');
  await expect(canvas).toHaveAttribute('data-camp', '0');
  await expect(canvas).toHaveAttribute('data-journee', '1');

  // La carte est réellement dessinée : eau, sable, herbe, routes, unités, HUD.
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: 'test-results/fumee-01-carte.png' });
  expect(await richesse(canvas), 'la carte doit être dessinée, pas un aplat').toBeGreaterThan(20);

  // Le curseur part sur une unité du joueur : « valider » la sélectionne.
  await canvas.focus();
  await canvas.press('Enter');
  await expect(canvas).toHaveAttribute('data-etat', 'selection');
  await expect(canvas).not.toHaveAttribute('data-selection', '');
  const surbrillances = Number(await canvas.getAttribute('data-surbrillances'));
  expect(surbrillances, 'la portée de déplacement doit s’allumer').toBeGreaterThan(1);
  await canvas.screenshot({ path: 'test-results/fumee-02-selection.png' });

  // Une case plus loin, puis le menu d'ordres, puis la première suite proposée.
  await canvas.press('ArrowRight');
  await canvas.press('Enter');
  await expect(canvas).toHaveAttribute('data-etat', 'action');
  await canvas.screenshot({ path: 'test-results/fumee-03-menu.png' });
  await canvas.press('Enter');
  await expect(canvas).toHaveAttribute('data-etat', 'inactif');
  await expect(canvas).toHaveAttribute('data-selection', '');

  // Le menu de production s'ouvre sur l'usine du camp 0, deux cases à gauche.
  await canvas.press('ArrowLeft');
  await canvas.press('ArrowLeft');
  await canvas.press('Enter');
  await expect(canvas).toHaveAttribute('data-etat', 'production');
  await canvas.screenshot({ path: 'test-results/fumee-04-production.png' });
  await canvas.press('Escape');
  await expect(canvas).toHaveAttribute('data-etat', 'inactif');

  // Fin de tour : l'adversaire joue, puis la main revient au camp 0 en journée 2.
  await canvas.press('KeyT');
  await expect(canvas).toHaveAttribute('data-camp', '0', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-journee', '2', { timeout: 60_000 });
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: 'test-results/fumee-05-apres-ia.png' });
  await expect(canvas).toHaveAttribute('data-partie', 'en_cours');

  expect(erreurs, 'aucune erreur de page').toEqual([]);
});
