import { test, expect } from '@playwright/test';
test.use({ trace: 'off', channel: 'chrome', launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('Premier contact charge les GLB nationaux et leurs textures depuis le serveur', async ({ page }) => {
  const recus = new Set<string>();
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('response', r => { if (r.ok()) recus.add(new URL(r.url()).pathname); });
  await page.goto('/jeu/premier_contact');
  await expect(page.locator('canvas.atlas-toile')).toBeVisible({ timeout: 45000 });
  for (const id of ['kit_fr_infanterie', 'kit_fr_char_leger', 'kit_lu_infanterie', 'kit_lu_recon']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_lod0.glb`), { timeout: 30000 }).toBe(true);
    await expect.poll(() => [...recus].some(p => p.startsWith(`/assets/modeles/${id}_`) && p.endsWith('.png')), { timeout: 30000 }).toBe(true);
  }
  for (const id of ['batiment_qg_fr_ile_de_france', 'batiment_qg_lu']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_lod0.glb`), { timeout: 30000 }).toBe(true);
  }
  for (const id of ['terrain_foret', 'terrain_riviere', 'terrain_route', 'terrain_pont']) {
    await expect.poll(() => recus.has(`/assets/modeles/${id}_albedo.png`), { timeout: 30000 }).toBe(true);
  }
  expect([...recus].some(p => p.startsWith('/assets/modeles/terrain_plaine_'))).toBe(false);
  expect(erreurs).toEqual([]);
});

test('les assets actifs se chargent aussi dans une autre mission et sur l’accueil', async ({page})=>{
  for(const route of ['/jeu/villes_du_bocage','/']) {
    const recus=new Set<string>(),erreurs:string[]=[];
    const reponse=(r:import('@playwright/test').Response)=>{if(r.ok())recus.add(new URL(r.url()).pathname);};
    const erreur=(e:Error)=>erreurs.push(e.message);
    page.on('response',reponse);page.on('pageerror',erreur);
    await page.goto(route);
    await expect.poll(()=>recus.has('/assets/modeles/batiment_qg_fr_ile_de_france_lod0.glb'),{timeout:30000}).toBe(true);
    expect([...recus].some(p=>p.startsWith('/assets/modeles/terrain_plaine_'))).toBe(false);
    expect(erreurs).toEqual([]);
    page.off('response',reponse);page.off('pageerror',erreur);
  }
});
