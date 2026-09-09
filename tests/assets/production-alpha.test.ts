import test from 'node:test';
import assert from 'node:assert/strict';
import { creerImage } from '../../src/render/apercu/png';
import { lirePng } from '../../src/assets/png';
import { encoderPngAlpha, alphaFeuillage } from '../../scripts/production/png-alpha';
test('feuillage : découpe alpha dans la seule bande UV des feuilles, RGB préservé',()=>{
 const n=128,source=creerImage(n,n,[60,120,65]);
 const png=lirePng(encoderPngAlpha(source,(x,y)=>alphaFeuillage(x,y,n)));
 const alpha=(x:number,y:number)=>png.rgba[(y*n+x)*4+3];
 assert.equal(alpha(72,64),255);assert.equal(alpha(64,0),0);assert.equal(alpha(65,64),0);
 assert.equal(alpha(30,0),255);assert.equal(alpha(10,127),255);
 assert.deepEqual([...png.rgba.slice((64*n+72)*4,(64*n+72)*4+3)],[60,120,65]);
 assert(png.rgba.some((v,i)=>i%4===3&&v===0));
});
