/**
 * Le plateau **au doigt**, sur un téléphone émulé.
 *
 * Écrit le 8 septembre 2026 sur le retour du propriétaire — « impossible de
 * jouer sur téléphone, impossible de toucher et zoomer » —, et il vérifie
 * exactement la cause soupçonnée : le zoom du **navigateur** volait le geste.
 * Deux doigts sur la carte agrandissaient la page, et une page agrandie déplace
 * ensuite tout ce que le lancer de rayon calcule, ce qui rend le toucher faux
 * autant que le zoom impossible.
 *
 * Trois précautions de méthode :
 *
 * - le pincement passe par **CDP** (`Input.dispatchTouchEvent`) et non par des
 *   `PointerEvent` fabriqués : des événements synthétiques entrent dans le code
 *   du jeu sans passer par le navigateur, donc sans que `touch-action` ni le
 *   zoom de page aient leur mot à dire — ils passeraient même avec le défaut ;
 * - `isMobile` fait honorer la **balise viewport** par Chromium, sans quoi la
 *   déclaration qu'on teste ne servirait à rien ;
 * - on ne mesure pas le zoom en pixels d'image mais par l'écart projeté entre
 *   deux cases voisines, lu au pont de développement : insensible au cadrage.
 */
import { expect, test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  channel: 'chrome',
  launchOptions: { args: ['--enable-unsafe-webgpu'] },
});

test.setTimeout(240_000);

const TOILE = 'canvas[data-rendu="3d"]';

/** L'écart en pixels entre deux cases voisines : il grandit avec le zoom. */
async function ecartCases(page: Page): Promise<number> {
  const a = await positionCase(page, 4, 3);
  const b = await positionCase(page, 5, 3);
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

/**
 * Le centre projeté d'une case, ou `null` si elle n'est pas à l'écran. Le pont
 * de développement est lu par une conversion **locale** : `fumee-3d.spec.ts`
 * déclare déjà `Window.__atlas`, et deux déclarations globales de la même
 * propriété se disputent le type.
 */
async function positionCase(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([cx, cy]) => {
    const w = window as unknown as {
      __atlas?: { positionCase(a: number, b: number): { x: number; y: number } | null };
    };
    return w.__atlas?.positionCase(cx, cy) ?? null;
  }, [x, y] as [number, number]);
}

/** Attend que le plateau soit monté et que le pont réponde. */
async function ouvrirPlateau(page: Page): Promise<void> {
  await page.goto('/jeu/demo');
  await expect(page.locator(TOILE)).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => (await positionCase(page, 4, 3)) !== null,
    { timeout: 120_000, message: 'le pont de développement projette une case' }).toBe(true);
}

test('la route du jeu refuse le zoom de page : il volait le pincement de la carte', async ({ page }) => {
  await ouvrirPlateau(page);
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta, 'la balise viewport de la route du jeu').toContain('maximum-scale=1');
  expect(meta).toContain('user-scalable=no');
  // Et la toile refuse les gestes du navigateur, ce qui est l'autre moitié :
  // iOS ignore `user-scalable` depuis des années.
  const action = await page.locator(TOILE).evaluate((c) => getComputedStyle(c).touchAction);
  expect(action, 'la toile ne laisse aucun geste au navigateur').toBe('none');
});

test('un tap sélectionne une unité', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await ouvrirPlateau(page);
  const toile = page.locator(TOILE);

  const p = await positionCase(page, 4, 3);
  expect(p).not.toBeNull();
  await page.touchscreen.tap((p as { x: number; y: number }).x, (p as { x: number; y: number }).y);

  await expect(toile).toHaveAttribute('data-etat', 'selection', { timeout: 20_000 });
  const surbrillances = Number(await toile.getAttribute('data-surbrillances'));
  expect(surbrillances, 'la portée de déplacement s’allume au doigt').toBeGreaterThan(1);
  expect(erreurs, 'aucune erreur de page').toEqual([]);
});

test('deux doigts zooment la carte, et non la page', async ({ page, browserName }) => {
  // Le pincement passe par CDP pour traverser la couche de gestes du navigateur ;
  // seul Chromium l'expose. Sur WebKit, c'est `safari.spec.ts` qui parle.
  test.skip(browserName !== 'chromium', 'CDP n’existe que sur Chromium');
  await ouvrirPlateau(page);
  const avant = await ecartCases(page);
  expect(avant, 'le plateau est projeté').toBeGreaterThan(4);

  const cdp = await page.context().newCDPSession(page);
  const cx = 195;
  const cy = 420;
  // Deux doigts sur la **même ordonnée** : l'écart zoome, et la composante
  // verticale — qui incline la caméra — reste nulle.
  const doigts = (ecart: number) => [
    { x: cx - ecart, y: cy, id: 1 },
    { x: cx + ecart, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: doigts(40) });
  for (const ecart of [60, 80, 100, 120, 140]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: doigts(ecart) });
    await page.waitForTimeout(60);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);

  // Le navigateur n'a pas bougé : c'est la preuve directe que le geste est allé
  // à la carte. Sans la balise viewport, `scale` monterait au-dessus de 1.
  const echelle = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  expect(echelle, 'la page ne s’est pas agrandie sous les doigts').toBeCloseTo(1, 2);

  const apres = await ecartCases(page);
  expect(apres, `la carte a zoomé (${avant} → ${apres})`).toBeGreaterThan(avant * 1.1);
});

test('un plateau immobile laisse respirer le fil principal', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'les compteurs de performance passent par CDP');
  await ouvrirPlateau(page);
  // Le monde finit de se bâtir : on mesure un plateau **au repos**, pas un
  // chantier.
  await page.waitForTimeout(8000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const lire = async (): Promise<Record<string, number>> => {
    const { metrics } = await cdp.send('Performance.getMetrics') as { metrics: { name: string; value: number }[] };
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  };
  const avant = await lire();
  await page.waitForTimeout(5000);
  const apres = await lire();
  const occupe = ((apres['TaskDuration'] ?? 0) - (avant['TaskDuration'] ?? 0)) * 1000;

  // Drapeaux, respiration, rotors et eau ne s'arrêtent jamais, et la boucle se
  // rappelait pour eux **à chaque image** : le fil principal était saturé sur un
  // plateau où rien ne se passe — 5 178 ms sur 5 000 au témoin, mesuré le
  // 9 septembre 2026. L'ambiance a désormais son pas (50 ms au doigt), et
  // l'urgent — inertie de caméra, marée, effets, animations — garde l'image
  // suivante. Le seuil est large parce que le rendu logiciel du banc gonfle tout :
  // ce qu'il attrape, c'est le retour d'une boucle qui ne dort plus.
  expect(occupe, `${Math.round(occupe)} ms de fil principal sur 5 000 au repos`)
    .toBeLessThan(5000 * 0.75);
});

test('le HUD rend le bord de l’écran à la carte', async ({ page }) => {
  await ouvrirPlateau(page);
  // La colonne de sept boutons de caméra faisait 338 px le long du bord droit.
  // Elle est une rangée : sa hauteur le dit, sans regarder une image.
  const camera = page.locator('.atlas-hud .camera');
  await expect(camera).toBeVisible();
  const boite = await camera.boundingBox();
  expect(boite, 'la zone caméra est mesurable').not.toBeNull();
  expect((boite as { height: number }).height,
    'les boutons de caméra tiennent sur une rangée, pas une colonne').toBeLessThanOrEqual(60);

  // Et la météo ne s'empile plus sous la journée : elle est dans la moitié droite.
  const meteo = await page.locator('.atlas-hud .bulletin').boundingBox();
  expect(meteo).not.toBeNull();
  expect((meteo as { x: number }).x, 'la météo tient le coin droit').toBeGreaterThan(390 / 2);

  // Le budget de place, mesuré et non estimé. Chaque panneau a une hauteur
  // maximale : c'est ce qui empêche l'interface de reprendre pixel par pixel la
  // place qu'on vient de rendre à la carte.
  const boites: Record<string, number> = {};
  for (const [nom, sel, max] of [
    ['journée', '.atlas-hud .partie', 40],
    ['météo', '.atlas-hud .bulletin', 60],
    ['pied', '.atlas-hud .dock', 60],
    ['caméra', '.atlas-hud .camera', 50],
  ] as [string, string, number][]) {
    const b = await page.locator(sel).boundingBox();
    expect(b, `${nom} est mesurable`).not.toBeNull();
    const h = Math.round((b as { height: number }).height);
    boites[nom] = h;
    expect(h, `${nom} : ${h} px, budget ${max}`).toBeLessThanOrEqual(max);
  }
  const pris = Object.values(boites).reduce((a, b) => a + b, 0);
  expect(pris, `le HUD prend ${pris} px de haut sur 844`).toBeLessThan(844 * 0.25);
});
