import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../src/app/api/routines/contrat/route';
import { PUT, PATCH } from '../../src/app/api/routines/missions/[id]/route';

test('le contrat reste authentifié, mais se découvre sans base de données', async () => {
  const ancien = process.env['CRON_SECRET'];
  process.env['CRON_SECRET'] = 'secret-de-test-routines';
  try {
    assert.equal((await GET(new Request('http://localhost/api/routines/contrat'))).status, 401);
    const reponse = await GET(new Request('http://localhost/api/routines/contrat', {
      headers: { authorization: 'Bearer secret-de-test-routines' },
    }));
    assert.equal(reponse.status, 200);
    assert.equal(reponse.headers.get('cache-control'), 'no-store');
    const contrat = await reponse.json();
    assert.deepEqual([...new Set(contrat.endpoints.map((e: { methode: string }) => e.methode))].sort(),
      ['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);
    assert.equal(contrat.publicationAutomatique, false);
    assert.equal(contrat.execution.identifiantModele, null);
  } finally {
    if (ancien === undefined) delete process.env['CRON_SECRET'];
    else process.env['CRON_SECRET'] = ancien;
  }
});

test('PUT et PATCH refusent toute annotation sans authentification avant accès BDD', async () => {
  for (const traitement of [PUT, PATCH]) {
    const reponse = await traitement(new Request('http://localhost/api/routines/missions/msn_test', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}',
    }), { params: Promise.resolve({ id: 'msn_test' }) });
    assert.equal(reponse.status, 401);
  }
});
