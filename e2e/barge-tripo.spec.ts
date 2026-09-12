import {test,expect} from '@playwright/test';
test.use({trace:'off',screenshot:'off',video:'off',channel:'chrome',launchOptions:{args:['--enable-unsafe-webgpu']}});
test('barge active : chargement du LOD0 HD et des clips dans la vitrine',async({page})=>{
 const recus=new Set<string>(),erreurs:string[]=[];page.on('response',r=>{if(r.ok())recus.add(new URL(r.url()).pathname);});page.on('pageerror',e=>erreurs.push(e.message));
 await page.goto('/atelier/unites');await page.getByRole('combobox',{name:'Unité',exact:true}).selectOption('barge');
 await expect(page.locator('[data-livre="oui"]')).toBeVisible({timeout:60000});
 await expect.poll(()=>recus.has('/assets/modeles/unite_barge_base_lod0.glb')).toBe(true);
 expect([...recus].some(p=>/unite_barge_base_lod[12]/.test(p))).toBe(false);
 for(const canal of ['albedo','normale','metal','masque_equipe'])expect(recus.has(`/assets/modeles/unite_barge_base_${canal}.png`)).toBe(true);
 await expect(page.getByText(/fichier : repos, deplacement, touche, hors_jeu/)).toBeVisible();
 for(const clip of ['repos','deplacement','touche','hors_jeu']){const bouton=page.getByRole('button',{name:clip,exact:true});await bouton.click();await expect(bouton).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('combobox',{name:'Nation',exact:true}).selectOption('fr');await expect(page.locator('[data-livre="oui"]')).toBeVisible();
 expect(erreurs).toEqual([]);
});
