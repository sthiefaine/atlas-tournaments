/**
 * La **vitrine des images cuites** (`/atelier/unites`), le **banc** de l'atelier
 * et l'**aperçu du carnet**, tous trois sur les images du jeu — sans 3D.
 *
 * Ce que le spec vérifie :
 *
 * - la vitrine lit le manifeste comme le jeu, et dit ce qu'elle en a fait —
 *   lu, absent, refusé et pourquoi ;
 * - pour une unité cuite, **une toile par animation** — toutes ses vues, tous
 *   ses clips —, chacune peinte d'une image cuite, qui **bouge** ; la couleur
 *   d'équipe change les pixels ; aucune toile n'ouvre de contexte WebGL ;
 * - une entrée absente montre son **repli**, peint ;
 * - le banc monte la peau 2D (`data-rendu="2d"`, WebGL 2) ;
 * - l'aperçu du carnet en jeu est une vignette cuite ;
 * - rien de tout cela ne télécharge three ni `render3d/`.
 *
 * **Le manifeste** : la cuisson le régénère à chaque passe
 * (`doc/refonte/sprites-cuisson.md`). S'il n'est pas sur le disque au moment du
 * spec, on le compose depuis les fichiers d'entrée que la cuisson a déjà écrits
 * (`public/assets/sprites/<famille>/<id>.json`) et on le sert à sa place — les
 * pages d'images, elles, sont les vraies. Sans aucune entrée cuite, les tests
 * qui en demandent une sont sautés, et le dire vaut mieux que de les voir verts.
 *
 * **Le témoin** : contre la révision d'avant la bascule, `/atelier/unites` est le
 * banc 3D (pas de `[data-vitrine]`), le banc n'a pas de `data-rendu="2d"`, et
 * l'aperçu du carnet est une scène WebGPU : chaque test tombe.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(300_000);
test.use({
  viewport: { width: 1280, height: 900 },
  trace: 'off',
  launchOptions: [async ({ browserName }, use) => {
    await use(browserName === 'chromium' && process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {});
  }, { scope: 'worker' }],
});

const SPRITES = path.resolve(process.cwd(), 'public/assets/sprites');
const MANIFESTE = path.join(SPRITES, 'manifeste.json');

interface EntreeLue { id: string; famille: string; cle: string; animations: { vue: string; clip: string; boucle: boolean; cadres: unknown[] }[]; pages: { masque?: string }[] }

/** Le manifeste du disque, ou celui qu'on compose des fichiers d'entrée déjà cuits ; `null` sans aucune entrée. */
function manifesteDuDisque(): { brut: unknown; entrees: Record<string, EntreeLue>; compose: boolean } | null {
  if (existsSync(MANIFESTE)) {
    const brut = JSON.parse(readFileSync(MANIFESTE, 'utf8')) as { entrees: Record<string, EntreeLue> };
    return { brut, entrees: brut.entrees, compose: false };
  }
  const entrees: Record<string, EntreeLue> = {};
  for (const famille of ['unites', 'batiments', 'decors', 'terrains']) {
    const dossier = path.join(SPRITES, famille);
    if (!existsSync(dossier)) continue;
    for (const nom of readdirSync(dossier).filter((f) => f.endsWith('.json'))) {
      try {
        const lu = JSON.parse(readFileSync(path.join(dossier, nom), 'utf8')) as { entree?: EntreeLue };
        if (lu.entree?.id) entrees[lu.entree.id] = lu.entree;
      } catch {
        // Un fichier en cours d'écriture par la cuisson : on le laisse.
      }
    }
  }
  if (Object.keys(entrees).length === 0) return null;
  return { brut: { version: 1, pixelsParCase: 128, tangage: 50, tangageProfil: 12, entrees }, entrees, compose: true };
}

const DISQUE = manifesteDuDisque();

/** Sert le manifeste composé à la place de celui qui manque ; relève les morceaux de JS. */
async function preparer(page: Page, manifeste: 'disque' | 'absent' | 'refuse' = 'disque'): Promise<string[]> {
  const morceaux: string[] = [];
  page.on('response', (r) => { if (/\.js(\?|$)/.test(r.url())) morceaux.push(r.url()); });
  if (manifeste === 'absent') {
    await page.route('**/assets/sprites/manifeste.json', (r) => r.fulfill({ status: 404, body: '' }));
  } else if (manifeste === 'refuse') {
    await page.route('**/assets/sprites/manifeste.json', (r) => r.fulfill({ json: { version: 99, pixelsParCase: 128, tangage: 50, tangageProfil: 12, entrees: {} } }));
  } else if (DISQUE?.compose) {
    await page.route('**/assets/sprites/manifeste.json', (r) => r.fulfill({ json: DISQUE.brut }));
  }
  return morceaux;
}

/** Une empreinte des pixels d'une toile 2D, et combien sont peints. */
async function pixels(page: Page, selecteur: string): Promise<{ peints: number; empreinte: number }> {
  return page.locator(selecteur).first().evaluate((c) => {
    const toile = c as HTMLCanvasElement;
    const g = toile.getContext('2d');
    if (!g || toile.width === 0 || toile.height === 0) return { peints: 0, empreinte: 0 };
    const d = g.getImageData(0, 0, toile.width, toile.height).data;
    let peints = 0;
    let empreinte = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i + 3] ?? 0) > 0) peints += 1;
      empreinte = (empreinte * 31 + (d[i] ?? 0) + (d[i + 1] ?? 0) * 7 + (d[i + 2] ?? 0) * 13) % 1_000_000_007;
    }
    return { peints, empreinte };
  });
}

/** L'unité cuite qu'on regarde : le char léger s'il est cuit, sinon la première unité cuite qui a un masque. */
function uniteCuite(): EntreeLue | null {
  if (!DISQUE) return null;
  const unites = Object.values(DISQUE.entrees).filter((e) => e.famille === 'unite' && e.pages.some((p) => p.masque));
  return unites.find((e) => e.id === 'unite_char_leger_base') ?? unites[0] ?? null;
}

test('la vitrine montre toutes les vues et tous les clips d’une unité cuite, animés, à la couleur de chaque camp, sans WebGL', async ({ page }) => {
  const unite = uniteCuite();
  test.skip(!unite, 'aucune unité cuite sur le disque');
  const morceaux = await preparer(page);
  await page.goto('/atelier/unites');
  const vitrine = page.locator('[data-vitrine="cuite"]');
  await expect(vitrine).toHaveAttribute('data-manifeste', 'lu', { timeout: 120_000 });
  await page.locator('select[data-choix="piece"]').selectOption(unite!.id);

  // Une toile par animation, chacune une image cuite.
  const tuiles = page.locator('figure[data-source]');
  await expect(tuiles).toHaveCount(unite!.animations.length, { timeout: 60_000 });
  for (let i = 0; i < unite!.animations.length; i += 1) {
    await expect(tuiles.nth(i), `animation ${i}`).toHaveAttribute('data-source', 'cuite', { timeout: 60_000 });
  }
  const peinture = await pixels(page, 'figure[data-source] canvas');
  expect(peinture.peints, 'la toile porte une image').toBeGreaterThan(200);

  // Elle bouge : une animation de plusieurs images change d'image.
  const rang = unite!.animations.findIndex((a) => a.boucle && a.cadres.length > 1);
  if (rang >= 0) {
    const vues = new Set<string>();
    for (let n = 0; n < 12 && vues.size < 2; n += 1) {
      vues.add(await tuiles.nth(rang).getAttribute('data-image') ?? '');
      await page.waitForTimeout(150);
    }
    expect(vues.size, 'l’image change').toBeGreaterThan(1);
  }

  // La couleur d'équipe passe par le masque : les pixels changent avec le camp.
  await page.getByRole('button', { name: 'Pause' }).click();
  const bleu = await pixels(page, 'figure[data-source] canvas');
  await page.getByRole('button', { name: 'Camp 2', exact: true }).click();
  await expect.poll(async () => (await pixels(page, 'figure[data-source] canvas')).empreinte, { timeout: 30_000 })
    .not.toBe(bleu.empreinte);

  // Tous les camps côte à côte : cinq toiles par animation.
  await page.getByRole('button', { name: 'Tous les camps' }).click();
  await expect(tuiles).toHaveCount(unite!.animations.length * 5, { timeout: 60_000 });

  // Aucune toile n'a de contexte WebGL : chacune a déjà son contexte 2D.
  const sansWebgl = await page.locator('figure[data-source] canvas').evaluateAll((liste) =>
    liste.every((c) => (c as HTMLCanvasElement).getContext('webgl2') === null && (c as HTMLCanvasElement).getContext('webgl') === null));
  expect(sansWebgl, 'des vignettes 2D, sans WebGL').toBe(true);
  expect(morceaux.filter((u) => /three|render3d/i.test(u)), 'aucun morceau de three ni de render3d').toEqual([]);
});

test('sans manifeste, la vitrine le dit et montre le repli que le jeu poserait', async ({ page }) => {
  await preparer(page, 'absent');
  await page.goto('/atelier/unites');
  await expect(page.locator('[data-vitrine="cuite"]')).toHaveAttribute('data-manifeste', 'absent', { timeout: 120_000 });
  const tuiles = page.locator('figure[data-source]');
  await expect(tuiles).toHaveCount(1);
  await expect(tuiles.first()).toHaveAttribute('data-source', 'repli', { timeout: 30_000 });
  expect((await pixels(page, 'figure[data-source] canvas')).peints, 'le repli est peint').toBeGreaterThan(200);
});

test('un manifeste refusé par le jeu est refusé ici, et le motif est dit', async ({ page }) => {
  await preparer(page, 'refuse');
  await page.goto('/atelier/unites');
  await expect(page.locator('[data-vitrine="cuite"]')).toHaveAttribute('data-manifeste', 'refuse', { timeout: 120_000 });
  await expect(page.getByRole('status').filter({ hasText: 'refusé' })).toContainText('version 99');
});

test('le banc de l’atelier monte la peau 2D', async ({ page }) => {
  const morceaux = await preparer(page);
  await page.goto('/atelier');
  await expect(page.locator('[data-rendu="2d"] canvas')).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as { __atlasBanc?: { mesurer(): { appels: number; backend: string | null } | null } };
    const m = w.__atlasBanc?.mesurer();
    return m && m.appels > 0 ? m.backend : null;
  }), { timeout: 60_000 }).toBe('webgl2');
  expect(morceaux.filter((u) => /three|render3d/i.test(u)), 'aucun morceau de three ni de render3d').toEqual([]);
});

test('l’aperçu du carnet en jeu est une vignette cuite, sans WebGL', async ({ page }) => {
  const morceaux = await preparer(page);
  // Une mission avec des usines et des fonds : le carnet y propose des achats.
  await page.goto('/jeu/chantier_des_usines');
  await expect(page.locator('canvas[data-rendu="2d"]')).toBeVisible({ timeout: 120_000 });
  // Les commandants parlent sur la carte, et une scène peut en suivre une
  // autre : le fanion du carnet n'existe qu'entre deux scènes. On les passe
  // toutes, jusqu'à ce qu'aucune ne revienne.
  const scene = page.locator('.atlas-scene');
  for (let n = 0; n < 8; n += 1) {
    if (!await scene.waitFor({ state: 'visible', timeout: n === 0 ? 20_000 : 4000 }).then(() => true, () => false)) break;
    await scene.getByRole('button', { name: /Passer/ }).click().catch(() => undefined);
    await scene.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }
  await page.getByRole('button', { name: 'Ouvrir le carnet de campagne' }).click();
  const apercu = page.locator('dialog canvas[data-apercu]').first();
  await expect(apercu).toBeVisible({ timeout: 60_000 });
  const cle = await apercu.getAttribute('data-apercu');
  const cuite = Boolean(DISQUE?.entrees[`unite_${cle}_base`]);
  await expect(apercu).toHaveAttribute('data-source', cuite ? 'cuite' : 'repli', { timeout: 60_000 });
  expect((await pixels(page, 'dialog canvas[data-apercu]')).peints, 'la pièce est peinte').toBeGreaterThan(200);
  expect(await apercu.evaluate((c) => (c as HTMLCanvasElement).getContext('webgl2') === null), 'une toile 2D').toBe(true);
  expect(morceaux.filter((u) => /three|render3d/i.test(u)), 'aucun morceau de three ni de render3d').toEqual([]);
});
