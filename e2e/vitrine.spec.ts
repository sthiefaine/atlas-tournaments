/**
 * La vitrine des unités quand le moteur ne peut pas se monter.
 *
 * Depuis le 9 septembre 2026 le moteur exige WebGPU : le repli WebGL 2 a été
 * retiré (`doc/10`, « Correction du jeu WebGPU »). Un navigateur sans adaptateur
 * ne voyait alors qu'une ligne perdue au milieu d'une planche vide et de
 * contrôles qui ne répondaient plus — le propriétaire a rapporté la page comme
 * plantée, et il avait raison de la lire ainsi.
 *
 * `--disable-blink-features=WebGPU` retire `navigator.gpu` : c'est exactement la
 * situation d'un Firefox ou d'un Safari ancien, obtenue sans quitter Chromium.
 */
import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-blink-features=WebGPU',
    ],
  },
});
test.setTimeout(180_000);

test('sans WebGPU, la vitrine dit ce qui manque et quoi faire', async ({ page }) => {
  await page.goto('/atelier/unites');

  // Next pose son propre `role="alert"` pour annoncer les changements de route :
  // on vise le nôtre par ce qu'il dit.
  const panneau = page.locator('[role="alert"]', { hasText: 'WebGPU' });
  await expect(panneau).toBeVisible({ timeout: 60_000 });
  await expect(panneau).toContainText('WebGPU');
  // Un écran d'échec qui n'indique pas la sortie n'en est pas un.
  await expect(panneau).toContainText('Chrome');
  await expect(panneau).toContainText('Safari');
  await expect(panneau).toContainText('Firefox');

  // Et la planche vide ne reste pas sous les yeux : elle n'a plus rien à montrer.
  await expect(page.locator('canvas')).toBeHidden();
});
