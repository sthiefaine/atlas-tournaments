/**
 * Pendant la visée, un **clic sur la cible confirme l'attaque** — sur la peau
 * 2D, à 1 280 × 800, là où la prévision du duel s'ancre à côté de la case.
 *
 * Le défaut, trouvé par deux agents le 23 septembre 2026 : l'ancrage calculait
 * la place d'un panneau de 190 pixels (`LARGEUR_ANCRE`) quand la prévision en
 * fait 230 ; posée à gauche de sa cible, elle en couvrait le centre, et le clic
 * tombait sur elle — seule la touche Entrée confirmait. La prévision est
 * désormais ancrée à sa vraie largeur, à une demi-case de plus que le bord de
 * la cible, et elle ne reçoit plus le clic (`src/render/hud-html.ts`).
 *
 * Ce que le spec vérifie : le char de `premier_contact` roule au bout du pont
 * et vise l'infanterie d'en face ; la prévision paraît ; le point au centre de
 * la cible est **la toile** (`elementFromPoint`), et la case entière est hors
 * du panneau ; un clic de souris à ce point ouvre l'écran de combat.
 *
 * **Le témoin** : l'ancrage d'avant (190 pixels, écart de 36) et la prévision
 * qui reçoit le clic font tomber le spec sur `elementFromPoint`.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-images npx next dev --turbopack -p 3416`, puis
 * `E2E_BASE_URL=http://localhost:3416 npx playwright test e2e/confirmation-clic-2d.spec.ts [--browser=webkit]`.
 */
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(300_000);
test.use({
  viewport: { width: 1280, height: 800 },
  trace: 'off',
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

type Pont = { positionCase(x: number, y: number): { x: number; y: number } | null; mesurer(): { appels: number } | null };

async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => (window as unknown as { __atlas?: Pont }).__atlas?.positionCase(cx, cy) ?? null, [x, y] as [number, number]);
}

/** Le point d'une case dans la fenêtre : `versEcran` rend des pixels de la toile. */
async function pointFenetre(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const p = await positionCase(page, x, y);
  expect(p, `la case ${x},${y} se projette`).not.toBeNull();
  const r = await page.locator('canvas.atlas-toile').boundingBox();
  return { x: (r?.x ?? 0) + p!.x, y: (r?.y ?? 0) + p!.y };
}

async function attendreCadrage(page: Page, x: number, y: number): Promise<void> {
  let avant = await positionCase(page, x, y);
  await expect.poll(async () => {
    await page.waitForTimeout(250);
    const maintenant = await positionCase(page, x, y);
    const stable = avant !== null && maintenant !== null
      && Math.abs(avant.x - maintenant.x) < 0.5 && Math.abs(avant.y - maintenant.y) < 0.5;
    avant = maintenant;
    return stable;
  }, { timeout: 60_000 }).toBe(true);
}

test('en visée, un clic sur la cible confirme l’attaque : la prévision ne couvre ni n’intercepte la case', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`page : ${String(e)}`));
  await page.goto('/jeu/premier_contact?rendu=2d');
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 180_000 });
  await expect(toile).toHaveAttribute('data-rendu', '2d');
  const scene = page.locator('.atlas-scene');
  if (await scene.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)) {
    await scene.getByRole('button', { name: /Passer/ }).click();
    await expect(scene).toBeHidden();
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer()?.appels ?? 0))
    .toBeGreaterThan(0);
  await attendreCadrage(page, 2, 3);

  // Le char (2, 3) roule au bout du pont (8, 3), et vise l'infanterie (8, 2).
  const char = await pointFenetre(page, 2, 3);
  await page.mouse.click(char.x, char.y);
  await expect(toile).toHaveAttribute('data-etat', 'selection', { timeout: 15_000 });
  const arrivee = await pointFenetre(page, 8, 3);
  await page.mouse.click(arrivee.x, arrivee.y);
  await expect(toile).toHaveAttribute('data-etat', 'action');
  await page.getByRole('button', { name: 'Attaquer' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'cible');

  // La prévision paraît, ancrée à côté de la cible.
  const prevision = page.locator('.atlas-hud .p.duel');
  await expect(prevision).toBeVisible({ timeout: 15_000 });
  await expect(prevision).toHaveAttribute('data-ancre', 'oui');
  const cible = await pointFenetre(page, 8, 2);
  const voisine = await pointFenetre(page, 9, 2);
  const demiCase = Math.abs(voisine.x - cible.x) / 2;
  // Relevé avant le clic : la visée finie, la prévision s'en va.
  const panneau = (await prevision.boundingBox())!;
  // Ce qui reçoit un clic au centre de la cible, c'est la toile.
  const sous = await page.evaluate(({ x, y }) => {
    const e = document.elementFromPoint(x, y);
    return e ? `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}` : null;
  }, cible);
  expect(sous, 'la toile reçoit le clic au centre de la cible').toBe('canvas.atlas-toile');

  // Le clic confirme : l'écran de combat s'ouvre.
  await page.mouse.click(cible.x, cible.y);
  await expect(page.locator('.atlas-combat')).toBeVisible({ timeout: 30_000 });

  // Et la case entière était hors du panneau : la cible ne se lit pas sous la prévision.
  const chevauche = panneau.x < cible.x + demiCase && panneau.x + panneau.width > cible.x - demiCase;
  expect(chevauche, `le panneau [${panneau.x.toFixed(0)}, ${(panneau.x + panneau.width).toFixed(0)}] laisse la case ${(cible.x - demiCase).toFixed(0)}–${(cible.x + demiCase).toFixed(0)}`).toBe(false);
  expect(erreurs).toEqual([]);
});
