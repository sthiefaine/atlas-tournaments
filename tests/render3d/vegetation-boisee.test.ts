import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couronneFeuillue, conifereBoise, troncRamifie } from '../../src/render3d/vegetation-boisee';

test('les bois restent compacts, déterministes et sans géométrie dégénérée',()=>{
  for(const fabrique of [()=>couronneFeuillue([[0,0,0,.1]],57),conifereBoise,troncRamifie]) {
    const g=fabrique(),copie=fabrique();
    assert.deepEqual(g.getAttribute('position').array,copie.getAttribute('position').array);
    const plat=g.index?g.toNonIndexed():g;
    const p=plat.getAttribute('position');
    assert.ok(p.count/3<=600);
    for(let i=0;i<p.count;i+=3) {
      const ab=[p.getX(i+1)-p.getX(i),p.getY(i+1)-p.getY(i),p.getZ(i+1)-p.getZ(i)];
      const ac=[p.getX(i+2)-p.getX(i),p.getY(i+2)-p.getY(i),p.getZ(i+2)-p.getZ(i)];
      const aire=Math.hypot(ab[1]!*ac[2]!-ab[2]!*ac[1]!,ab[2]!*ac[0]!-ab[0]!*ac[2]!,ab[0]!*ac[1]!-ab[1]!*ac[0]!);
      assert.ok(Number.isFinite(aire)&&aire>1e-9,'triangle visible et fini');
    }
    g.computeBoundingBox();assert.ok(g.boundingBox!.max.x-g.boundingBox!.min.x<.4);assert.ok(g.boundingBox!.max.y-g.boundingBox!.min.y<.5);
    const couleurs=g.getAttribute('color');
    if(couleurs) for(const c of couleurs.array)assert.ok(c>=0&&c<=1);
    if(plat!==g)plat.dispose();g.dispose();copie.dispose();
  }
});
