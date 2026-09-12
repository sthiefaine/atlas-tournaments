import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORBITE_INITIALE,reglerOrbite} from '../../src/app/atelier/unites/orbite';
test('orbite continue, inclinaison et zoom bornés sans modifier la référence',()=>{
 const a=reglerOrbite({...ORBITE_INITIALE},-30,-20,2);
 assert.deepEqual(a,{bearing:330,inclinaison:48,zoom:2});
 assert.deepEqual(reglerOrbite(a,750,500,20),{bearing:0,inclinaison:85,zoom:3});
 assert.deepEqual(reglerOrbite(a,0,-500,.001),{bearing:330,inclinaison:-80,zoom:.4});
 assert.deepEqual(ORBITE_INITIALE,{bearing:0,inclinaison:68,zoom:1});
});
