import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../../src/app/api/admin/conception/route';
import { GET as getRoutine, POST as postRoutine } from '../../src/app/api/routines/map/conception/route';
import { signerSession, COOKIE_ADMIN } from '../../src/serveur/auth';

test('laboratoire : authentification avant tout calcul, lecture sans BDD et refus des charges',async()=>{
  const anciens={auth:process.env.AUTH_SECRET,cron:process.env.CRON_SECRET};
  process.env.AUTH_SECRET='conception-test';process.env.CRON_SECRET='routine-conception-test';
  const cookie=`${COOKIE_ADMIN}=${signerSession({sujet:'test',expire:Date.now()+60000})}`;
  try{
    assert.equal((await GET(new Request('http://localhost/api/admin/conception'))).status,403);
    assert.equal((await POST(new Request('http://localhost/api/admin/conception',{method:'POST',body:'{}'}))).status,403);
    assert.equal((await postRoutine(new Request('http://localhost/api/routines/map/conception',{method:'POST'}))).status,401);
    const r=await getRoutine(new Request('http://localhost/api/routines/map/conception?scenario=opus1_tutoriel_05',{headers:{authorization:'Bearer routine-conception-test'}}));
    assert.equal(r.status,200);const c=await r.json();assert.equal(c.demande.version,1);assert.match(c.prompt,/aucune publication/i);
    const requete=(body:string,origin='http://localhost')=>new Request('http://localhost/api/admin/conception',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body});
    assert.equal((await POST(requete('{}','https://autre.test'))).status,403);
    assert.equal((await POST(requete('nul'))).status,400);
    assert.equal((await POST(requete('{}'))).status,422);
    assert.equal((await POST(requete(' '.repeat(262145)))).status,413);
    assert.equal((await GET(new Request('http://localhost/api/admin/conception?scenario=..%2Fsecret',{headers:{cookie}}))).status,404);
  }finally{for(const [cle,v]of [['AUTH_SECRET',anciens.auth],['CRON_SECRET',anciens.cron]] as const){if(v===undefined)delete process.env[cle];else process.env[cle]=v;}}
});
