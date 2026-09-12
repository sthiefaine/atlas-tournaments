import {test,expect} from '@playwright/test';
test.use({trace:'off',screenshot:'off',video:'off',channel:'chrome',launchOptions:{args:['--enable-unsafe-webgpu']}});
test('vitrine : glisser, zoom, clavier, vue unique et remise à zéro',async({page})=>{
 const erreurs:string[]=[];page.on('pageerror',e=>erreurs.push(e.message));
 await page.goto('/atelier/unites');
 await expect(page.getByRole('combobox',{name:'Catalogue',exact:true})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Unité',exact:true}).locator('option')).toHaveCount(30);
 await page.getByRole('combobox',{name:'Unité',exact:true}).selectOption('barge');
 await expect(page.locator('[data-livre="oui"]')).toBeVisible({timeout:45000});
 const vue=page.getByRole('region',{name:'Vue 3D interactive de l’unité'});
 await vue.scrollIntoViewIfNeeded();const b=await vue.boundingBox();expect(b).not.toBeNull();
 await page.mouse.move(b!.x+b!.width*.5,b!.y+b!.height*.5);await page.mouse.down();await page.mouse.move(b!.x+b!.width*.5+100,b!.y+b!.height*.5+30,{steps:5});await page.mouse.up();
 await expect(vue).toHaveAttribute('data-bearing','320');
 const zoom=Number(await vue.getAttribute('data-zoom'));await page.mouse.wheel(0,-150);await expect.poll(async()=>Number(await vue.getAttribute('data-zoom'))).toBeGreaterThan(zoom);
 await vue.press('ArrowRight');await expect(vue).toHaveAttribute('data-bearing','330');
 await page.getByRole('button',{name:'Réinitialiser la vue'}).click();await expect(vue).toHaveAttribute('data-bearing','0');await expect(vue).toHaveAttribute('data-zoom','1');
 await expect(page.locator('[data-vue]')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Six vues techniques'})).toHaveCount(0);
 // Deux pointeurs tactiles : le même chemin gère le pincement et l’annulation.
 await vue.evaluate(el=>{const fire=(type:string,id:number,x:number)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:200,bubbles:true}));
   // Les captures exigent un pointeur natif ; ce test instrumente seulement cette API DOM.
   el.setPointerCapture=()=>{};el.hasPointerCapture=()=>false;
   fire('pointerdown',11,100);fire('pointerdown',12,200);fire('pointermove',12,250);fire('pointercancel',11,100);fire('pointerup',12,250);
 });
 await expect(vue).toHaveAttribute('data-zoom','1.5');await expect(vue).toHaveAttribute('data-glisser','false');
 expect(erreurs).toEqual([]);
});
