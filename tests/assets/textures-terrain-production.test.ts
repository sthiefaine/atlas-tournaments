import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelTerrain } from '../../scripts/production/textures-terrain';

test('les matières procédurales conservent les quatre bords du raccord',()=>{
  for(const cle of ['foret','herbe_haute','plage','mer','route','montagne'])for(const canal of ['albedo','normale','rugosite']) {
    const bord=canal==='normale'?[128,128,255]:[90,112,73];
    for(let i=0;i<32;i++)for(const[x,y]of[[0,i],[31,i],[i,0],[i,31]] as const)assert.deepEqual(pixelTerrain(cle,canal,x,y,32,undefined,bord),bord);
  }
});

test('les rides de l’eau sont dans la normale et ne peignent aucune réflexion dans l’albédo',()=>{
  const base=[43,112,126];
  const normales=new Set<string>();
  for(let x=4;x<28;x++) {
    assert.deepEqual(pixelTerrain('mer','albedo',x,111,1024,undefined,base),base);
    normales.add(pixelTerrain('mer','normale',x,111,1024,undefined,[128,128,255]).join(','));
  }
  assert.ok(normales.size>1);
});
