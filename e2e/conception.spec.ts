import { test, expect } from '@playwright/test';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
const secret=process.env.E2E_ASSETS_SECRET;
test.use({trace:'off'});
test.beforeEach(async({context,baseURL})=>{
  test.skip(!secret,'Serveur isolé AUTH_SECRET requis.');
  await context.addCookies([{name:COOKIE_ADMIN,value:signerSession({sujet:'test-conception',expire:Date.now()+600000},secret),url:baseURL!}]);
});
test('conception : formulaire, simulations, rapport exportable et historique mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/admin/cartes');
  await expect(page.getByRole('heading',{name:'Laboratoire de missions'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Générer et tester les variantes'}).click();
  await expect(page.getByRole('region',{name:'Comparaison des variantes'})).toBeVisible({timeout:55000});
  await expect(page.getByRole('img',{name:/Plan de/})).toHaveCount(4);
  await expect(page.getByText(/Piste à examiner/)).toBeVisible();
  await page.getByRole('button',{name:'Retenir sa signature'}).first().click();
  await expect(page.getByRole('status')).toContainText('Signature retenue');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter le rapport complet et les rejeux'}).click();
  expect((await download).suggestedFilename()).toBe('rapport-conception.json');
  await page.reload();await expect(page.getByText(/1 signatures retenues/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
