import test from 'node:test';
import assert from 'node:assert/strict';
import { appliquer, coutEntree, terrainLogique } from '../../src/engine/index';
import { CAT, partiePersonnalisee } from './aides';

function chantier(type = 'genie', terrain: 'riviere' | 'montagne' = 'riviere') {
  const car = CAT.terrains[terrain]!.car;
  const e = partiePersonnalisee([`P${car}PP`, 'PPPP'], {}, [
    { camp: 0, type, x: 0, y: 0 }, { camp: 1, type: 'infanterie', x: 3, y: 1 },
  ]);
  e.camps[0]!.fonds = 4000;
  return e;
}

test('génie : pont permanent, coût, action consommée et état source intact', () => {
  const e = chantier(); const u = e.unites[0]!;
  const action = { type: 'ordre' as const, uniteId: u.id, chemin: [], suite: { type: 'construire' as const, cible: { x: 1, y: 0 } } };
  const r = appliquer(e, action, CAT); assert.ok(r.ok);
  assert.equal(terrainLogique(r.etat, CAT, { x: 1, y: 0 }), 'pont');
  assert.equal(r.etat.camps[0]!.fonds, 2500);
  assert.equal(e.camps[0]!.fonds, 4000); assert.equal(e.terrainsPoses.length, 0);
  assert.equal(appliquer(r.etat, action, CAT).ok, false);
  assert.equal(coutEntree(r.etat, CAT, { ...u, type: 'char_leger' }, { x: 1, y: 0 }), 1);
});

test('génie : col ouvert, sans travaux à distance ou sans argent', () => {
  const e = chantier('genie', 'montagne'); const u = e.unites[0]!;
  const action = { type: 'ordre' as const, uniteId: u.id, chemin: [], suite: { type: 'construire' as const, cible: { x: 1, y: 0 } } };
  const r = appliquer(e, action, CAT); assert.ok(r.ok);
  assert.equal(terrainLogique(r.etat, CAT, { x: 1, y: 0 }), 'route');
  e.camps[0]!.fonds = 1499; assert.equal(appliquer(e, action, CAT).ok, false);
  e.camps[0]!.fonds = 4000; action.suite.cible.x = 3; assert.equal(appliquer(e, action, CAT).ok, false);
});

test('une unité sans trait génie ne construit pas', () => {
  const e = chantier('infanterie');
  assert.equal(appliquer(e, { type: 'ordre', uniteId: e.unites[0]!.id, chemin: [], suite: { type: 'construire', cible: { x: 1, y: 0 } } }, CAT).ok, false);
});

test('le contrôleur propose les travaux et attend la case ciblée', async () => {
  const { Controleur } = await import('../../src/render/controleur');
  const e = chantier();
  const c = new Controleur({ etat: e, catalogue: CAT, camp: 0 });
  c.clicCase({ x: 0, y: 0 }); c.clicCase({ x: 0, y: 0 });
  assert.ok(c.vue.menu?.options.some((o) => o.id === 'construire'));
  c.choisirSuite('construire');
  assert.equal(c.vue.phase, 'cible');
  assert.ok(c.vue.surbrillances.some((s) => s.case.x === 1 && s.case.y === 0));
  c.clicCase({ x: 1, y: 0 });
  assert.equal(terrainLogique(c.etat, CAT, { x: 1, y: 0 }), 'pont');
});

test('l’IA sait construire un passage au profit de ses véhicules', async () => {
  const { meilleureOption, POIDS_PONDEREE } = await import('../../src/ai/strategies/ponderee');
  const e = chantier();
  e.unites.push({ ...e.unites[0]!, id: 'char_ami', type: 'char_leger', x: 0, y: 1 });
  const option = meilleureOption(e, CAT, e.unites[0]!, { ...POIDS_PONDEREE, progression: 0, securite: 0, echange: 0 });
  assert.equal(option.action.type, 'ordre');
  if (option.action.type === 'ordre') assert.equal(option.action.suite.type, 'construire');
  assert.equal(appliquer(e, option.action, CAT).ok, true);
});

test('le catalogue actuel permet de produire le génie', async () => {
  const { chargerCatalogue, produitesPar } = await import('../../src/engine/index');
  const courant = chargerCatalogue();
  assert.equal(courant.cles.length, 30);
  assert.ok(courant.unites['genie']);
  assert.ok(produitesPar(courant, 'usine').includes('genie'));
});
