/**
 * L'écran de combat de la peau 2D (`src/render2d/combat.ts`) : une attaque
 * l'ouvre, il dessine deux formations sur le décor de leurs cases **dans la
 * toile**, les effectifs tombent pendant le duel, et il se ferme — seul à la
 * fin du duel, ou au clic.
 *
 * Ce que le spec vérifie, et rien d'autre :
 *
 * - le char du joueur attaque l'infanterie du pont (`premier_contact`) : le HUD
 *   ouvre l'écran de combat, et la peau 2D lui rend une présentation — la
 *   fenêtre porte `data-modele="3d"` (le nom que le HUD donne à toute
 *   présentation dans la toile) et l'hôte reçoit les bandes du décor
 *   (`[data-combat2d]`) ;
 * - la toile peint vraiment l'encart : dans une capture (`__atlas.capturer()`,
 *   qui redessine de façon synchrone), le filet qui sépare les deux cases est
 *   au milieu de l'hôte, et le ciel est uni d'un bord à l'autre ;
 * - les effectifs (`data-effectifs`, une figurine par PV affiché) partent de
 *   dix contre dix et changent pendant le duel ;
 * - l'écran se ferme seul à la fin du duel ; pendant le tour de l'adversaire,
 *   un clic le ferme bien avant la fin du sien — s'il attaque, ce qu'il fait
 *   d'ordinaire ; sinon, c'est dit dans les annotations, pas passé sous silence ;
 * - aucune erreur de console (le 404 du manifeste absent est toléré, comme
 *   dans `rendu-2d.spec.ts`).
 *
 * **Le témoin** : sans `ouvrirCombat` dans la peau 2D, le HUD retire l'hôte et
 * garde ses plaques peintes : `data-modele` manque, et le spec tombe.
 *
 * Lancer contre un serveur à soi :
 * `NEXT_DIST_DIR=.next-combat npx next dev --turbopack -p 3413`, puis
 * `E2E_BASE_URL=http://localhost:3413 npx playwright test e2e/combat-2d.spec.ts [--browser=webkit]`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(420_000);
test.use({
  viewport: { width: 1280, height: 800 },
  trace: 'off',
  // Sous Chromium sur macOS, le dessin passe par Metal : le rasteriseur
  // logiciel coûte une seconde par image sur une machine chargée, et le spec
  // mesurerait la machine (`rendu-2d.spec.ts`).
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

const MANIFESTE_ABSENT = !existsSync(path.resolve(process.cwd(), 'public/assets/sprites/manifeste.json'));

/** Le pont de développement (`render/jeu.ts`). */
type Pont = {
  positionCase(x: number, y: number): { x: number; y: number } | null;
  capturer(): string | null;
  mesurer(): { appels: number } | null;
  etat(): { journee: number; camp: number; terminee: boolean };
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
 * Attend que la case se projette au même point deux fois de suite : le
 * cadrage d'ouverture glisse encore un instant après la première image, et un
 * clic placé pendant ce glissement tombe à côté de sa case.
 */
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

async function etatPartie(page: Page): Promise<{ journee: number; camp: number } | null> {
  return page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.etat() ?? null);
}

/** Passe une scène de dialogue si elle est ouverte ; rend vrai si elle l'était. */
async function passerDialogue(page: Page): Promise<boolean> {
  const scene = page.locator('.atlas-scene');
  if (!(await scene.isVisible().catch(() => false))) return false;
  await scene.getByRole('button', { name: /Passer/ }).click().catch(() => undefined);
  return true;
}

/** Trois pixels de la capture, dans le rectangle de l'hôte : le filet au milieu, le ciel à ses deux bouts. */
async function pixelsDuCombat(page: Page): Promise<{ filet: number[]; cielG: number[]; cielD: number[] } | null> {
  return page.evaluate(async () => {
    const hote = document.querySelector('.atlas-combat .scene3d');
    const toile = document.querySelector('canvas.atlas-toile');
    const url = (window as unknown as { __atlas?: Pont }).__atlas?.capturer() ?? null;
    if (!hote || !toile || !url) return null;
    const rh = hote.getBoundingClientRect();
    const rt = toile.getBoundingClientRect();
    const image = new Image();
    await new Promise((ok, ko) => { image.onload = ok; image.onerror = ko; image.src = url; });
    const hors = document.createElement('canvas');
    hors.width = image.naturalWidth;
    hors.height = image.naturalHeight;
    const g = hors.getContext('2d');
    if (!g) return null;
    g.drawImage(image, 0, 0);
    const k = image.naturalWidth / rt.width;
    const lire = (x: number, y: number): number[] => {
      const d = g.getImageData(Math.floor((x - rt.left) * k), Math.floor((y - rt.top) * k), 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
    };
    return {
      filet: lire(rh.left + rh.width / 2, rh.top + rh.height * 0.15),
      cielG: lire(rh.left + rh.width * 0.08, rh.top + rh.height * 0.05),
      cielD: lire(rh.left + rh.width * 0.92, rh.top + rh.height * 0.05),
    };
  });
}

/**
 * Un échantillonneur dans la page, posé **avant** l'attaque : il relit à chaque
 * image les effectifs écrits par l'écran de combat, là où un aller-retour de
 * Playwright en manquerait. Il s'arrête quand l'écran s'est refermé.
 */
async function echantillonnerEffectifs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __effectifs?: string[]; __ferme?: boolean; __ouvertA?: number; __fermeA?: number };
    w.__effectifs = [];
    w.__ferme = false;
    let vu = false;
    const debut = performance.now();
    const lire = (): void => {
      const racine = document.querySelector('[data-combat2d]');
      const e = racine?.getAttribute('data-effectifs') ?? null;
      if (e !== null) {
        if (!vu) w.__ouvertA = performance.now();
        vu = true;
        if (w.__effectifs![w.__effectifs!.length - 1] !== e) w.__effectifs!.push(e);
      }
      if (vu && !document.querySelector('.atlas-combat')) {
        w.__ferme = true;
        w.__fermeA = performance.now();
        return;
      }
      if (performance.now() - debut < 180_000) requestAnimationFrame(lire);
    };
    requestAnimationFrame(lire);
  });
}

test('une attaque ouvre l’écran de combat de la peau 2D, qui dessine, compte, et se ferme', async ({ page }) => {
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
  // La première mission ouvre sur son briefing, joué sur la carte une fois
  // cadrée : on l'attend (`isVisible` n'attend pas), puis on le passe. Un clic
  // posé avant qu'il paraisse tomberait sur lui.
  const scene = page.locator('.atlas-scene');
  if (await scene.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)) {
    await scene.getByRole('button', { name: /Passer/ }).click();
    await expect(scene).toBeHidden();
  }
  await expect.poll(() => positionCase(page, 2, 3), { timeout: 60_000 }).not.toBeNull();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __atlas?: Pont }).__atlas?.mesurer()?.appels ?? 0))
    .toBeGreaterThan(0);
  await attendreCadrage(page, 2, 3);

  // Le char (2, 3) roule jusqu'au bout du pont (8, 3) et vise l'infanterie (8, 2).
  await cliquerCase(page, 2, 3);
  await expect(toile).toHaveAttribute('data-etat', 'selection', { timeout: 15_000 });
  await cliquerCase(page, 8, 3);
  await expect(toile).toHaveAttribute('data-etat', 'action');
  await page.getByRole('button', { name: 'Attaquer' }).click();
  await expect(toile).toHaveAttribute('data-etat', 'cible');
  await echantillonnerEffectifs(page);
  // La cible unique est pointée d'office en entrant en visée, et Entrée confirme
  // (`Controleur.valider`). Pas de clic sur la case : à 1280 × 800, la prévision
  // du duel (`.duel-camp`) couvre son centre et recevrait le clic à sa place.
  await toile.focus();
  await page.keyboard.press('Enter');

  const combat = page.locator('.atlas-combat');
  await expect(combat).toBeVisible({ timeout: 30_000 });
  // La peau 2D a rendu une présentation : le HUD ne peint pas ses plaques, il ouvre sa fenêtre.
  await expect(combat).toHaveAttribute('data-modele', '3d');
  await expect(page.locator('.atlas-combat .scene3d [data-combat2d="ouvert"]')).toHaveCount(1);

  // La toile peint l'encart : le filet au milieu de l'hôte, un ciel uni d'un bord à l'autre.
  const pixels = await pixelsDuCombat(page);
  expect(pixels, 'la capture lit le rectangle de l’hôte').not.toBeNull();
  const proche = (a: number[], b: number[], tol: number): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tol);
  expect(proche(pixels!.filet, [11, 20, 26], 3), `le filet au milieu : ${pixels!.filet.join(',')}`).toBe(true);
  expect(proche(pixels!.cielG, pixels!.cielD, 2), `un seul ciel : ${pixels!.cielG.join(',')} / ${pixels!.cielD.join(',')}`).toBe(true);
  expect(proche(pixels!.cielG, [11, 20, 26], 3), 'le ciel n’est pas le filet').toBe(false);

  // Il se ferme seul, à la fin du duel.
  await expect(combat).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ferme?: boolean }).__ferme === true), { timeout: 30_000 })
    .toBe(true);
  const effectifs = await page.evaluate(() => (window as unknown as { __effectifs?: string[] }).__effectifs ?? []);
  expect(effectifs[0], `dix contre dix au départ : ${JSON.stringify(effectifs)}`).toBe('10:10');
  expect(effectifs.length, `les effectifs tombent pendant le duel : ${JSON.stringify(effectifs)}`).toBeGreaterThan(1);
  const [, cibleFin] = (effectifs[effectifs.length - 1] ?? '10:10').split(':').map(Number);
  expect(cibleFin!, 'l’infanterie a perdu des figurines').toBeLessThan(10);
  test.info().annotations.push(
    { type: 'effectifs', description: effectifs.join(' → ') },
    { type: 'pixels', description: `filet ${pixels!.filet.join(',')} ; ciel ${pixels!.cielG.join(',')} / ${pixels!.cielD.join(',')}` },
  );

  // Le tour de l'adversaire : s'il attaque, un clic ferme son duel bien avant la fin.
  await passerDialogue(page);
  await expect(page.locator('.atlas-scene')).toBeHidden({ timeout: 30_000 });
  await page.locator('button[data-action="fin_tour"]').click();
  let issue: 'duel' | 'main' | 'attente' = 'attente';
  const debutTour = Date.now();
  while (Date.now() - debutTour < 150_000) {
    if (await combat.isVisible().catch(() => false)) { issue = 'duel'; break; }
    const e = await etatPartie(page);
    if (e && e.camp === 0 && e.journee > 1) { issue = 'main'; break; }
    await passerDialogue(page);
    await page.waitForTimeout(30);
  }
  if (issue === 'duel') {
    const vuA = Date.now();
    await expect(page.locator('.atlas-combat .scene3d [data-combat2d="ouvert"]')).toHaveCount(1);
    // Le bouton « Toucher pour passer » : le clic remonte à l'écran, qui coupe la partition.
    await combat.locator('.indice').click();
    const clicA = Date.now();
    await expect(combat).toBeHidden({ timeout: 5_000 });
    const fermeA = Date.now();
    expect(fermeA - clicA, 'le clic ferme l’écran tout de suite').toBeLessThan(1_000);
    expect(fermeA - vuA, 'bien avant la fin du duel (1,9 s)').toBeLessThan(1_800);
    test.info().annotations.push({ type: 'fermeture au clic', description: `${fermeA - clicA} ms après le clic, ${fermeA - vuA} ms après l’ouverture` });
    await expect(page.locator('[data-combat2d]')).toHaveCount(0);
  } else {
    test.info().annotations.push({
      type: 'non observé',
      description: issue === 'main'
        ? 'l’adversaire n’a pas attaqué pendant son tour : la fermeture au clic n’a pas été exercée'
        : 'le tour de l’adversaire n’a pas fini dans le temps imparti',
    });
  }

  expect(erreurs, 'aucune erreur de console').toEqual([]);
});
