/** Contrastes calculés et navigation DOM ; aucune capture ni validation artistique. */
import { test, expect } from '@playwright/test';
import { signerSession, COOKIE_ADMIN } from '../src/serveur/auth';
const secret = process.env.E2E_ASSETS_SECRET;
test.use({ trace: 'off' });
const routes = ['/admin', '/admin/assets', '/admin/assets/chantier', '/admin/assets/terrain_herbe_haute', '/admin/cartes', '/admin/catalogue', '/admin/personnages', '/admin/file', '/admin/depeche', '/admin/prompts', '/admin/traductions'];
for (const theme of ['light', 'dark'] as const) test(`toute l’administration reste lisible en thème ${theme}`, async ({ page, context, baseURL }) => {
  test.skip(!secret, 'Serveur isolé AUTH_SECRET requis.');
  test.setTimeout(180000);
  await context.addCookies([{ name: COOKIE_ADMIN, value: signerSession({ sujet:'test-ui', expire:Date.now()+600000 },secret), url:baseURL! }]);
  await page.emulateMedia({ colorScheme:theme });
  await page.setViewportSize({ width:390, height:844 });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),route).toBe(true);
    const problemes = await page.evaluate(() => {
      const rgb = (s:string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const luminance = (c:number[]) => c.slice(0,3).map(x => { x/=255; return x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4; }).reduce((s,x,i)=>s+x*([.2126,.7152,.0722][i]??0),0);
      return [...document.querySelectorAll('.admin-shell h1,.admin-shell h2,.admin-shell h3,main p,main label,main button,main summary,main .admin-secondaire,main .admin-etat,main input:not([type=hidden]),main select,main textarea')].filter(el=>el.getClientRects().length).flatMap(el=>{
        const style=getComputedStyle(el); let fond:Element|null=el;
        while(fond && (rgb(getComputedStyle(fond).backgroundColor)[3]??1)<1) fond=fond.parentElement;
        const a=luminance(rgb(style.color)),b=luminance(rgb(getComputedStyle(fond??el).backgroundColor));
        const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        return ratio<4.5 || style.opacity!=='1' ? [{texte:el.textContent?.slice(0,80),ratio,opacity:style.opacity}] : [];
      });
    });
    expect(problemes,route).toEqual([]);
    await page.setViewportSize({width:1440,height:1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`${route} bureau`).toBe(true);
    await page.setViewportSize({width:390,height:844});
  }
  const menu=page.getByRole('button',{name:'Menu de l’administration'});
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Bibliothèque d’assets'}).click();
  await expect(page).toHaveURL(/\/admin\/assets$/);
  await expect(menu).toHaveAttribute('aria-expanded','false');
  await page.setViewportSize({width:1440,height:1000});
  await expect(page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Bibliothèque d’assets'})).toHaveAttribute('aria-current','page');
});
test('connexion accessible au clavier sous thème sombre',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/admin/login');
  await page.getByLabel('Mot de passe').focus();
  await expect(page.getByLabel('Mot de passe')).toBeFocused();
  expect(await page.locator('.admin-shell').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('light');
});
