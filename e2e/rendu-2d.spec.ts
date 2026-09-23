/**
 * La peau 2D (`src/render2d/`, décision du 23 septembre 2026) se monte, dessine
 * et se joue — **sans WebGPU**, sous Chromium comme sous WebKit.
 *
 * Ce que le spec vérifie, et rien d'autre :
 *
 * - la page choisit la peau par l'adresse (`?rendu=2d`) : la toile porte
 *   `data-rendu="2d"` ;
 * - l'image n'est pas un aplat : on la lit par `window.__atlas.capturer()`,
 *   qui redessine de façon synchrone avant de lire (un tampon WebGL non
 *   préservé serait vide autrement) ;
 * - une unité du joueur se sélectionne et se déplace par des clics placés avec
 *   `versEcran` (le pont `positionCase`), et **glisse** : `positionUnite`
 *   passe par des points intermédiaires pendant l'animation ;
 * - aucune erreur de console. La seule tolérée est le 404 du manifeste des
 *   images cuites **quand il n'existe pas** sur le disque : le jeu se joue
 *   alors tout en replis, c'est un état normal, pas une panne.
 *
 * **Le témoin** : `E2E_TEMOIN=3d` ouvre la même page sans `?rendu=2d` (la
 * peau 3D, qui ne démarre pas sans WebGPU) ; `E2E_TEMOIN=mouvement` réduit les
 * animations, et le glissement ne passe plus par aucun point intermédiaire. Les
 * deux doivent faire tomber ce spec — sinon il ne prouve rien.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-2d npx next dev --turbopack -p 3411`, puis
 * `E2E_BASE_URL=http://localhost:3411 npx playwright test e2e/rendu-2d.spec.ts [--browser=webkit]`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(300_000);
test.use({
  viewport: { width: 1280, height: 800 },
  // D'autres specs écrivent dans `test-results/` en même temps : pas de trace.
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal. Le rasteriseur
  // logiciel par défaut coûte une seconde par image dès que la machine est
  // chargée (mesuré : 885 ms d'une image à l'autre, contre 16,6 avec Metal) ;
  // le spec mesurerait alors la machine, pas la peau.
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

const TEMOIN = process.env['E2E_TEMOIN'] ?? '';
const ADRESSE = TEMOIN === '3d' ? '/jeu/premier_contact' : '/jeu/premier_contact?rendu=2d';
const MANIFESTE_ABSENT = !existsSync(path.resolve(process.cwd(), 'public/assets/sprites/manifeste.json'));

/** Le pont de développement (`render/jeu.ts`), lu par une conversion locale. */
type Pont = {
  positionCase(x: number, y: number): { x: number; y: number } | null;
  capturer(): string | null;
  positionUnite(id: string): { x: number; y: number; z: number } | null;
  mesurer(): { appels: number; backend: string | null } | null;
};

async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => {
    const w = window as unknown as { __atlas?: Pont };
    return w.__atlas?.positionCase(cx, cy) ?? null;
  }, [x, y] as [number, number]);
}

async function cliquerCase(page: Page, x: number, y: number): Promise<void> {
  const p = await positionCase(page, x, y);
  expect(p, `la case ${x},${y} se projette à l’écran`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

/** Le nombre de couleurs distinctes de l'image courante, échantillonnée. */
async function richesse(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const w = window as unknown as { __atlas?: Pont };
    const url = w.__atlas?.capturer() ?? null;
    if (!url) return 0;
    const image = new Image();
    await new Promise((ok, ko) => { image.onload = ok; image.onerror = ko; image.src = url; });
    const hors = document.createElement('canvas');
    hors.width = image.naturalWidth;
    hors.height = image.naturalHeight;
    const g = hors.getContext('2d');
    if (!g) return 0;
    g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, hors.width, hors.height).data;
    const couleurs = new Set<string>();
    for (let i = 0; i < d.length; i += 4 * 211) couleurs.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return couleurs.size;
  });
}

test('la peau 2D se monte, dessine, et une unité s’y sélectionne puis glisse jusqu’à sa case', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`page : ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const lieu = m.location().url ?? '';
    if (MANIFESTE_ABSENT && lieu.includes('/assets/sprites/manifeste.json')) return;
    erreurs.push(`console : ${m.text()} (${lieu})`);
  });
  if (TEMOIN === 'mouvement') await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto(ADRESSE);
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 180_000 });
  await expect(toile).toHaveAttribute('data-rendu', '2d');
  await expect(toile).toHaveAttribute('data-scenario', 'premier_contact');

  // La première mission ouvre sur son briefing : on le passe.
  const scene = page.locator('.atlas-scene');
  if (await scene.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await scene.getByRole('button', { name: /Passer/ }).click();
    await expect(scene).toBeHidden();
  }

  await expect.poll(() => positionCase(page, 2, 3), { timeout: 60_000 }).not.toBeNull();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer()?.appels ?? 0))
    .toBeGreaterThan(0);
  const couleurs = await richesse(page);
  expect(couleurs, `l’image n’est pas un aplat (${couleurs} couleurs)`).toBeGreaterThan(12);

  // Sélectionner le char du joueur, puis viser une case de la route.
  await cliquerCase(page, 2, 3);
  await expect(toile).toHaveAttribute('data-etat', 'selection');
  const selection = await toile.getAttribute('data-selection');
  expect(selection, 'une unité est sélectionnée').toBeTruthy();
  expect(Number(await toile.getAttribute('data-surbrillances')), 'la portée s’allume').toBeGreaterThan(1);
  const depart = await page.evaluate((id) => (window as unknown as { __atlas?: Pont }).__atlas?.positionUnite(id) ?? null, selection!);
  expect(depart).not.toBeNull();

  await cliquerCase(page, 6, 3);
  await expect(toile).toHaveAttribute('data-etat', 'action');

  // Un échantillonneur dans la page, à chaque image, posé **avant** l'ordre :
  // il voit passer la figurine là où un test en aller-retour la manquerait. Il
  // s'arrête quand elle est posée depuis huit images, pas au bout d'un temps
  // fixe : sous un rasteriseur logiciel sur une machine chargée, une image
  // peut coûter une seconde, et le clic lui-même plusieurs.
  const xArrivee = 6.5;
  await page.evaluate(([id, arrivee]) => {
    const w = window as unknown as { __atlas?: Pont; __echantillons?: number[]; __fini?: boolean };
    w.__echantillons = [];
    w.__fini = false;
    let posee = 0;
    const debut = performance.now();
    const lire = (): void => {
      const p = w.__atlas?.positionUnite(id);
      if (p) {
        w.__echantillons!.push(p.x);
        posee = Math.abs(p.x - arrivee) < 1e-6 ? posee + 1 : 0;
      }
      if (posee < 8 && performance.now() - debut < 120_000) requestAnimationFrame(lire);
      else w.__fini = true;
    };
    requestAnimationFrame(lire);
  }, [selection!, xArrivee] as [string, number]);
  await page.getByRole('button', { name: 'Attendre' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'inactif');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fini?: boolean }).__fini === true), { timeout: 150_000 })
    .toBe(true);

  const echantillons = await page.evaluate(() => (window as unknown as { __echantillons?: number[] }).__echantillons ?? []);
  const xDepart = depart!.x;
  expect(echantillons.length, 'l’échantillonneur a tourné').toBeGreaterThan(5);
  expect(echantillons[echantillons.length - 1], 'la figurine est arrivée').toBeCloseTo(xArrivee, 5);
  const entre = echantillons.filter((x) => x > xDepart + 0.05 && x < xArrivee - 0.05);
  expect(entre.length, `la figurine glisse : ${JSON.stringify(echantillons.slice(0, 40))}`).toBeGreaterThan(0);

  expect(erreurs, 'aucune erreur de console').toEqual([]);
});
