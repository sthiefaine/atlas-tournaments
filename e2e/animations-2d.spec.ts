/**
 * Les animations de la peau 2D (`src/render2d/animations.ts`, `effets.ts`,
 * `meteo.ts`) jouent dans un vrai navigateur — un déplacement puis une attaque
 * sur `premier_contact`, sans une erreur de console — et se terminent.
 *
 * Ce que le spec vérifie, et rien d'autre :
 *
 * - le char **glisse** : `positionUnite` passe par des points intermédiaires
 *   entre sa case de départ et celle d'arrivée ;
 * - il **tire** : arrivé, sa figurine recule le long du tir (sa position quitte
 *   le centre de sa case, puis y revient exactement) et des **effets** sont
 *   dessinés — la famille `effets` de `mesurer()` compte des triangles ;
 * - la partition **se termine** : le contrôleur revient au repos, les effets
 *   s'éteignent, la figurine est posée au centre de sa case ;
 * - la **météo** tombe quand l'ambiance le dit (famille `meteo`), et plus rien
 *   ne tombe sous animations réduites ;
 * - aucune erreur de console (le 404 du manifeste est toléré s'il manque).
 *
 * **Les témoins**, lancés à la main le 23 septembre 2026, et tous tombés — sinon
 * ce spec ne prouverait rien : sans l'exécutant `tirer` (retiré de
 * `EXECUTANTS`), il tombe sur le recul ; sans images d'effets (une planche qui
 * ne résout rien), sur « des effets dessinés pendant le combat » ; avec une
 * météo qui ignore la réduction, sur la famille `meteo` sous réduction ; avec
 * une météo muette, sur la pluie forcée. Le premier témoin était d'abord
 * **passé** : la secousse de la riposte passait pour le recul — d'où la fenêtre
 * du tir.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-anim npx next dev --turbopack -p 3412`, puis
 * `E2E_BASE_URL=http://localhost:3412 npx playwright test e2e/animations-2d.spec.ts [--browser=webkit]`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(300_000);
test.use({
  viewport: { width: 1280, height: 800 },
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal : le rasteriseur logiciel
  // mesurerait la machine chargée, pas la peau (`e2e/rendu-2d.spec.ts`).
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

const MANIFESTE_ABSENT = !existsSync(path.resolve(process.cwd(), 'public/assets/sprites/manifeste.json'));

/** Le pont de développement (`render/jeu.ts`). */
type Pont = {
  positionCase(x: number, y: number): { x: number; y: number } | null;
  positionUnite(id: string): { x: number; y: number; z: number } | null;
  mesurer(): { appels: number; familles?: Record<string, { triangles: number; mailles: number }> } | null;
  forcerAmbiance(saison: string | null, phase?: string, meteo?: string): void;
};

async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => (window as unknown as { __atlas?: Pont }).__atlas?.positionCase(cx, cy) ?? null, [x, y] as [number, number]);
}

async function cliquerCase(page: Page, x: number, y: number): Promise<void> {
  const p = await positionCase(page, x, y);
  expect(p, `la case ${x},${y} se projette à l’écran`).not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}

/**
 * Passe les scènes de dialogue ouvertes. Celle d'ouverture paraît quand la
 * carte est cadrée — tard, sur une machine chargée —, et `premier_contact` en
 * ouvre une autre après le premier combat.
 */
async function passerScenes(page: Page, attente = 2_000): Promise<void> {
  const scene = page.locator('.atlas-scene');
  for (let i = 0; i < 6; i++) {
    if (!(await scene.isVisible({ timeout: attente }).catch(() => false))) return;
    await scene.getByRole('button', { name: /Passer/ }).click().catch(() => undefined);
    await expect(scene).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
  }
}

async function famille(page: Page, nom: string): Promise<number> {
  return page.evaluate((n) => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer()?.familles?.[n]?.triangles ?? 0, nom);
}

interface Echantillon { t: number; x: number; z: number; effets: number; etat: string; duel: boolean }

test('un déplacement puis une attaque se jouent en 2D — glissement, recul, effets — et la partition se termine', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`page : ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const lieu = m.location().url ?? '';
    if (MANIFESTE_ABSENT && lieu.includes('/assets/sprites/manifeste.json')) return;
    erreurs.push(`console : ${m.text()} (${lieu})`);
  });

  await page.goto('/jeu/premier_contact?rendu=2d');
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 180_000 });
  await expect(toile).toHaveAttribute('data-rendu', '2d');
  await expect.poll(() => positionCase(page, 2, 3), { timeout: 60_000 }).not.toBeNull();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer()?.appels ?? 0))
    .toBeGreaterThan(0);
  // Le dialogue d'ouverture paraît une fois la carte cadrée : on l'attend, et on le passe.
  await passerScenes(page, 30_000);

  // Le char du joueur, sur la route : jusqu'au pont d'en face, à côté de l'infanterie adverse.
  await cliquerCase(page, 2, 3);
  await expect(toile).toHaveAttribute('data-etat', 'selection');
  const char = await toile.getAttribute('data-selection');
  expect(char, 'le char est sélectionné').toBeTruthy();
  await cliquerCase(page, 8, 3);
  await expect(toile).toHaveAttribute('data-etat', 'action');
  await page.getByRole('button', { name: 'Attaquer' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'cible');

  // Un échantillonneur à chaque image, posé avant l'ordre. Il s'arrête quand la
  // partition est **finie** — l'écran de combat du HUD vu puis refermé, ou la
  // scène que le premier combat ouvre ensuite —, la figurine posée sur sa case
  // et les effets éteints depuis douze images. Entre la marche et le tir, le
  // char attend l'écran de combat : ce calme-là n'est pas la fin.
  await page.evaluate((id) => {
    const w = window as unknown as { __atlas?: Pont; __echantillons?: Echantillon[]; __fini?: boolean };
    const toile = document.querySelector('canvas.atlas-toile');
    w.__echantillons = [];
    w.__fini = false;
    let calme = 0;
    let duelVu = false;
    const debut = performance.now();
    const visible = (el: Element | null): boolean => el instanceof HTMLElement && el.offsetParent !== null;
    const lire = (): void => {
      const p = w.__atlas?.positionUnite(id);
      const effets = w.__atlas?.mesurer()?.familles?.['effets']?.triangles ?? 0;
      const etat = toile?.getAttribute('data-etat') ?? '';
      const duel = visible(document.querySelector('.atlas-combat'));
      if (p) w.__echantillons!.push({ t: performance.now(), x: p.x, z: p.z, effets, etat, duel });
      if (duel) duelVu = true;
      const fin = (duelVu && !duel) || visible(document.querySelector('.atlas-scene'));
      const pose = p !== undefined && p !== null && Math.abs(p.x - 8.5) < 1e-6 && Math.abs(p.z - 3.5) < 1e-6;
      calme = fin && pose && effets === 0 ? calme + 1 : 0;
      if (calme < 12 && performance.now() - debut < 150_000) requestAnimationFrame(lire);
      else w.__fini = true;
    };
    requestAnimationFrame(lire);
  }, char!);
  // En visée, la prévision du duel est posée sur la cible et prendrait le clic :
  // on confirme au clavier — la visée a déjà pointé la cible, Entrée la valide.
  await toile.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fini?: boolean }).__fini === true), { timeout: 170_000 })
    .toBe(true);

  const echantillons = await page.evaluate(() => (window as unknown as { __echantillons?: Echantillon[] }).__echantillons ?? []);
  expect(echantillons.length, 'l’échantillonneur a tourné').toBeGreaterThan(10);
  const dernier = echantillons[echantillons.length - 1]!;
  expect(dernier.x, 'posé au centre de sa case d’arrivée').toBeCloseTo(8.5, 6);
  expect(dernier.z).toBeCloseTo(3.5, 6);
  expect(dernier.effets, 'les effets se sont éteints').toBe(0);
  // Le premier combat ouvre une scène ; passée, la main revient au joueur.
  await passerScenes(page, 5_000);
  await expect(toile, 'le contrôleur est revenu au repos').toHaveAttribute('data-etat', 'inactif', { timeout: 30_000 });

  // Il a glissé : des points entre le départ et l'arrivée.
  const entre = echantillons.filter((e) => e.x > 2.6 && e.x < 8.4);
  expect(entre.length, `la figurine glisse : ${JSON.stringify(echantillons.slice(0, 30).map((e) => e.x))}`).toBeGreaterThan(0);
  // Il a tiré : il recule le long du tir — vers le bas, la cible est au-dessus. Le
  // tir part au tiers de l'écran de combat (665 ms), la riposte le touche 400 ms
  // plus tard et le secoue à son tour : le recul se lit **entre les deux**, sans
  // quoi la secousse de la riposte passerait pour lui.
  const debutDuel = echantillons.find((e) => e.duel)?.t;
  expect(debutDuel, 'l’écran de combat s’est ouvert').toBeDefined();
  const tir = echantillons.filter((e) => e.t - debutDuel! >= 500 && e.t - debutDuel! <= 1000);
  const recul = tir.some((e) => e.z - 3.5 > 0.004);
  expect(recul, `le recul du tir : ${JSON.stringify(tir.map((e) => Math.round((e.z - 3.5) * 1000)))}`).toBe(true);
  // Et des effets ont été dessinés **par le combat** : sous l'écran de combat, une
  // fois retombée la poussière de la marche.
  const combat = echantillons.filter((e) => e.duel && e.t - debutDuel! >= 500);
  expect(Math.max(0, ...combat.map((e) => e.effets)), 'des effets dessinés pendant le combat').toBeGreaterThan(0);

  // La météo : de la pluie quand l'ambiance le dit…
  await page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.forcerAmbiance('printemps', 'jour', 'pluie'));
  await expect.poll(() => famille(page, 'meteo'), { timeout: 30_000 }).toBeGreaterThan(0);
  // … et plus rien sous animations réduites.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.forcerAmbiance('printemps', 'jour', 'tempete'));
  await expect.poll(() => famille(page, 'meteo'), { timeout: 30_000 }).toBe(0);

  expect(erreurs, 'aucune erreur de console').toEqual([]);
});
