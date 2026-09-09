import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personnagesCanon, personnagesPourActe } from '../../src/serveur/personnages';
import { estSecret } from '../../src/serveur/canon';
test('histoires uniques, sources et liens réels du canon', () => {
  const personnages = personnagesCanon(), cles = new Set(personnages.map(p => p.cle));
  assert.equal(cles.size, personnages.length);
  const faits = personnages.flatMap(p => p.historique);
  assert.equal(new Set(faits.map(f => f.cle)).size, faits.length);
  for (const p of personnages) for (const lien of p.liens) assert.ok(cles.has(lien), lien);
  for (const fait of faits) { assert.ok([1,2,3].includes(fait.acteRevelation)); assert.ok(/^canon_aube(?:_v[0-9]+|_opus1_v[0-9]+)$/.test(fait.source), fait.source); }
});
test('les secrets et motivations ne sortent pas par le canon général ou un acte précoce', () => {
  assert.ok(estSecret('personnages.json'));
  assert.equal(personnagesPourActe(0).personnages.flatMap(p => p.historique).length, 0);
  const debut = JSON.stringify(personnagesPourActe(1));
  assert.equal(debut.includes('dirige la Cinquième Manche'), false);
  assert.equal(debut.includes('motivation'), false);
  assert.ok(JSON.stringify(personnagesPourActe(3)).includes('dirige la Cinquième Manche'));
  assert.throws(() => personnagesPourActe(4));
});

test('la route historique exige l’authentification et borne l’acte demandé', async () => {
  const { GET } = await import('../../src/app/api/routines/bible/personnages/route');
  const avant = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'histoire-test';
  try {
    assert.equal((await GET(new Request('http://localhost/api/routines/bible/personnages'))).status, 401);
    const demande = (acte: string) => new Request(`http://localhost/api/routines/bible/personnages?acte=${acte}`, { headers: { authorization: 'Bearer histoire-test' } });
    assert.equal((await GET(demande('4'))).status, 400);
    const reponse = await GET(demande('1'));
    assert.equal(reponse.status, 200);
    assert.equal(reponse.headers.get('cache-control'), 'no-store');
    assert.equal((await reponse.text()).includes('dirige la Cinquième Manche'), false);
  } finally {
    if (avant === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = avant;
  }
});

test('un acte tardif ne déverrouille jamais les secrets auteur ni un jalon de saison', async () => {
  const { filtrerPersonnagesPourActe } = await import('../../src/serveur/personnages');
  const personnage = {...personnagesCanon()[0]!, historique:[
    {cle:'public',repere:'Ronde XIV',acteRevelation:1,fait:'Parcours publié',source:'canon_aube_v2'},
    {cle:'famille',repere:'Coulisses',acteRevelation:1,fait:'SECRET_FRATRIE',source:'canon_aube_v2',confidentialite:'auteur'},
    {cle:'pivot',repere:'S5E4',acteRevelation:3,fait:'SECRET_PATERNITE',source:'canon_aube_v2',confidentialite:'jalon',jalonRevelation:'opus1_finale_10'},
    {cle:'borne',repere:'S5E4',acteRevelation:1,fait:'SECRET_JALON_SANS_MODE',source:'canon_aube_v2',jalonRevelation:'opus1_finale_10'},
    {cle:'inconnu',repere:'Auteur',acteRevelation:1,fait:'SECRET_MODE_INCONNU',source:'canon_aube_v2',confidentialite:'nouveau_mode'},
  ]};
  for (const acte of [0,1,2,3]) {
    const resultat = filtrerPersonnagesPourActe([personnage],acte);
    assert(!JSON.stringify(resultat).includes('SECRET_'));
    assert.equal(resultat[0]!.historique.length,acte===0?0:1);
  }
  assert.throws(() => filtrerPersonnagesPourActe([personnage],4));
});

test('les profils familiaux publiés ne révèlent pas la parenté, même à l’acte trois', () => {
  const famille = new Set(['cmd_mael_orven','cmd_lise_orven','cmd_edran_sorel']);
  for (const acte of [0,1,2,3]) {
    const publics = personnagesPourActe(acte).personnages.filter(p => famille.has(p.cle));
    assert.equal(/père|frère|sœur|paternité|fratrie|\bfils\b|\bfille\b/i.test(JSON.stringify(publics)),false);
  }
});
