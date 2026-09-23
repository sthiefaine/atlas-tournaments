/**
 * **Cliquer une unité de l'atelier l'inspecte, comme en jeu** (23 septembre
 * 2026, demande du propriétaire). Le banc ne refait pas ce panneau : il monte
 * celui du HUD du jeu, restreint à lui seul (`ApiHud.seulement`).
 *
 * Ce que le spec vérifie, et rien d'autre :
 *
 * - un clic sur le char léger bleu de la carte-catalogue ouvre le panneau
 *   d'unité dans la colonne de droite, comme en jeu sur un écran large : il le
 *   **nomme** et déplie sa **fiche** — ce qu'il démolit — sans qu'on cherche la
 *   loupe ;
 * - ni le sélecteur d'unité ni le lien de la vitrine ne recouvrent ce panneau ;
 * - un clic sur une autre pièce change le panneau ;
 * - un clic sur une case vide, puis Échap, replient la fiche ;
 * - aucun autre panneau du HUD ne paraît : ni journée, ni fin de tour, ni
 *   bandeau de tour — le banc n'a pas de partie ;
 * - aucune erreur de page.
 *
 * Les cases sont celles de la carte-catalogue (`src/app/atelier/banc.ts`) : le
 * rang 5 porte les pièces bleues dans l'ordre d'`UNITES_BANC` — le char léger en
 * colonne 8, le char moyen en 9 —, et le rang 6, celui des surbrillances
 * basses, n'en porte aucune. La colonne resserre le plateau : on centre la vue
 * sur les chars avant de cliquer.
 *
 * Sur un téléphone, pas de colonne : le panneau se pose sur l'image, comme en
 * jeu, et la fiche s'ouvre à la loupe — dépliée d'office, elle couvrirait le
 * plateau qu'on lit. Le second cas le vérifie, au doigt.
 *
 * **Le témoin** : contre la révision d'avant (`7790712d`), à laquelle on ne
 * donne que `versEcran` sur le pont, le banc ne monte aucun HUD : le spec tombe
 * au premier clic, aucun panneau ne nomme le char léger.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-insp npx next dev --turbopack -p 3412`, puis
 * `E2E_BASE_URL=http://localhost:3412 npx playwright test e2e/atelier-inspection.spec.ts [--browser=webkit]`.
 */
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(300_000);
test.use({
  viewport: { width: 1280, height: 800 },
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal : le rasteriseur
  // logiciel coûte une seconde par image dès que la machine est chargée.
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

/** Le pont de développement du banc (`src/app/atelier/atelier.tsx`). */
type Pont = {
  versEcran(x: number, y: number): { x: number; y: number } | null;
  recentrer(x: number, y: number): void;
  mesurer(): { appels: number } | null;
};

type Boite = { x: number; y: number; width: number; height: number };
const recouvre = (a: Boite, b: Boite): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const RANG_BLEU = 5;
const RANG_VIDE = 6;

/** Le centre d'une case, en coordonnées de page : `versEcran` rend un point de la toile. */
async function pointDe(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => {
    const w = window as unknown as { __atlasBanc?: Pont };
    const local = w.__atlasBanc?.versEcran(cx, cy) ?? null;
    const toile = document.querySelector('[data-rendu="2d"] canvas');
    if (!local || !toile) return null;
    const boite = toile.getBoundingClientRect();
    return { x: boite.left + local.x, y: boite.top + local.y };
  }, [x, y] as [number, number]);
}

async function cliquerCase(page: Page, x: number, y: number, doigt = false): Promise<void> {
  const p = await pointDe(page, x, y);
  expect(p, `la case ${x},${y} se projette à l’écran`).not.toBeNull();
  if (doigt) await page.touchscreen.tap(p!.x, p!.y);
  else await page.mouse.click(p!.x, p!.y);
}

/** Le banc dessine, puis la vue se pose sur une case et s'y arrête. */
async function preparerBanc(page: Page, x: number, y: number): Promise<void> {
  await page.goto('/atelier');
  await expect(page.locator('[data-rendu="2d"] canvas')).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as { __atlasBanc?: Pont };
    return (w.__atlasBanc?.mesurer()?.appels ?? 0) > 0;
  }), { timeout: 60_000 }).toBe(true);
  // La vue glisse jusqu'à sa place : on attend qu'elle s'arrête, sans quoi le
  // clic tomberait à côté de la case visée.
  await page.evaluate(([cx, cy]) => (window as unknown as { __atlasBanc?: Pont }).__atlasBanc?.recentrer(cx, cy), [x, y] as [number, number]);
  let avant = '';
  await expect.poll(async () => {
    const p = JSON.stringify(await pointDe(page, x, y));
    const stable = p !== 'null' && p === avant;
    avant = p;
    return stable;
  }, { timeout: 30_000, intervals: [300] }).toBe(true);
}

/** Aucune commande de l'atelier — retour, sélecteur, vitrine — ne recouvre le panneau d'unité. */
async function rienNeRecouvre(page: Page): Promise<void> {
  const boitePanneau = await page.locator('.atlas-hud .inspect').boundingBox();
  expect(boitePanneau).not.toBeNull();
  const commandes = [
    page.getByRole('link', { name: /Accueil/ }), page.locator('label:has(select)'),
    page.getByRole('link', { name: /Vitrine des images/ }),
  ];
  for (const commande of commandes) {
    const b = await commande.boundingBox();
    expect(b).not.toBeNull();
    expect(recouvre(b!, boitePanneau!), `une commande de l’atelier recouvre le panneau : ${JSON.stringify(b)}`).toBe(false);
  }
}

test('cliquer une unité de l’atelier la nomme et déplie sa fiche, comme en jeu', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await preparerBanc(page, 8, RANG_BLEU);

  const panneau = page.locator('.atlas-hud .inspect');
  const titre = panneau.locator('.tt');
  const fiche = panneau.locator('.fiche');

  await cliquerCase(page, 8, RANG_BLEU);
  await expect(titre).toHaveText('Char léger', { timeout: 10_000 });
  await expect(fiche).toBeVisible();
  await expect(fiche.locator('.bloc.fort'), 'la fiche dit ce que l’unité démolit').toBeVisible();

  // Dans la colonne, comme en jeu sur un écran large : le plateau se resserre.
  await expect(page.locator('[data-atlas-rail="oui"]')).toHaveCount(1);
  await expect(page.locator('.atlas-hud .hud-rail .inspect')).toHaveCount(1);
  // Et les commandes de l'atelier ne le recouvrent pas.
  await rienNeRecouvre(page);

  // Le banc n'a pas de partie : le HUD n'en montre rien.
  await expect(page.locator('.atlas-hud .partie')).toHaveCount(0);
  await expect(page.locator('.atlas-hud .fintour')).toHaveCount(0);
  await expect(page.locator('.atlas-tour')).toHaveCount(0);

  await cliquerCase(page, 9, RANG_BLEU);
  await expect(titre).toHaveText('Char moyen');
  await expect(fiche).toBeVisible();

  // Un clic à côté : la fiche se replie avec la sélection.
  await cliquerCase(page, 8, RANG_VIDE);
  await expect(fiche).toHaveCount(0);
  await expect(titre).not.toHaveText('Char moyen');

  // Échap aussi.
  await cliquerCase(page, 8, RANG_BLEU);
  await expect(fiche).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fiche).toHaveCount(0);

  expect(erreurs, 'aucune erreur de page').toEqual([]);
});

test.describe('au doigt, sur un téléphone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('le panneau se pose sur l’image, nomme l’unité touchée, et la fiche s’ouvre à la loupe', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(String(e)));
    await preparerBanc(page, 8, RANG_BLEU);

    const panneau = page.locator('.atlas-hud .inspect');
    await cliquerCase(page, 8, RANG_BLEU, true);
    await expect(panneau.locator('.tt')).toHaveText('Char léger', { timeout: 10_000 });
    await expect(page.locator('[data-atlas-rail="oui"]'), 'pas de colonne sur un téléphone').toHaveCount(0);
    await expect(panneau.locator('.fiche'), 'repliée d’office : elle couvrirait le plateau').toHaveCount(0);
    await rienNeRecouvre(page);

    await panneau.locator('[data-action="fiche"]').tap();
    await expect(panneau.locator('.fiche')).toBeVisible();
    await rienNeRecouvre(page);

    expect(erreurs, 'aucune erreur de page').toEqual([]);
  });
});
