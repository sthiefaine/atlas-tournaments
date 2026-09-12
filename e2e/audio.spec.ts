import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test.setTimeout(120_000);

test('sons accessibles et persistants, accueil silencieux, contexte seulement après geste en partie', async ({ page }) => {
  await page.addInitScript(() => {
    // Observation du cycle Web Audio, sans capturer ni écouter une piste.
    let crees = 0;
    const Original = window.AudioContext;
    Object.defineProperty(window, '__audioCrees', { get: () => crees });
    window.AudioContext = new Proxy(Original, { construct(cible, args) { crees++; return Reflect.construct(cible, args); } });
  });
  const compteur = () => page.evaluate(() => (window as unknown as { __audioCrees: number }).__audioCrees);
  await page.goto('/reglages');
  const sons = page.getByRole('switch', { name: /Sons en partie/ });
  const volume = page.getByRole('slider', { name: /Volume des effets/ });
  await expect(sons).toBeEnabled();
  await expect(sons).toHaveAttribute('aria-checked', 'true');
  await volume.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue('25');
  await sons.click();
  await expect(volume).toBeDisabled();
  await page.reload();
  await expect(sons).toHaveAttribute('aria-checked', 'false');
  await expect(volume).toHaveValue('25');
  await expect(volume).toBeDisabled();
  await sons.click();
  await expect(volume).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('atlas:reglages:v1')!).sons)).toBe(true);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.locator('body').press('Shift');
  expect(await compteur()).toBe(0);
  await page.goto('/jeu/premier_contact');
  const toile = page.locator('canvas.atlas-toile');
  await expect(toile).toBeVisible({ timeout: 60000 });
  expect(await compteur()).toBe(0);
  // Le conteneur écoute au niveau capture : un geste clavier suffit sans
  // dépendre de la position d'une unité ou avancer un dialogue.
  await toile.evaluate((element) => { element.tabIndex = 0; element.focus(); });
  await page.keyboard.press('Shift');
  await expect.poll(compteur).toBe(1);
  await page.keyboard.press('Shift');
  expect(await compteur()).toBe(1);
});
