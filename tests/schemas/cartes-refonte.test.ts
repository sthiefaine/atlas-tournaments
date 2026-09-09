import { test } from 'node:test';
import assert from 'node:assert/strict';
import batteries from '../../content/cartes/carte_detour_des_batteries.json';
import nuit from '../../content/cartes/carte_ligne_de_nuit.json';
import releve from '../../content/cartes/carte_quarantieme_releve.json';
import { validerMapDef } from '../../src/schemas/valider';
import { chargerTerrains, chargerUnites } from '../../src/content';
import type { MapDef } from '../../src/schemas';

const terrains = chargerTerrains();
const unites = chargerUnites();
function accessible(carte: MapDef, depart: string, mouvement: 'pied' | 'chenilles', bloquee?: string) {
  const vus = new Set([depart]);
  const file = [depart];
  for (let i = 0; i < file.length; i++) {
    const [x = 0, y = 0] = file[i]!.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, cle = `${nx},${ny}`;
      const terrain = terrains.find(t => t.car === carte.grille[ny]?.[nx]);
      const cout = terrain?.couts[mouvement];
      if (cle !== bloquee && !vus.has(cle) && typeof cout === 'number' && Number.isFinite(cout)) {
        vus.add(cle); file.push(cle);
      }
    }
  }
  return vus;
}
for (const brut of [batteries, nuit, releve]) {
  test(`${brut.cle} : contrat, départs praticables et QG accessibles à pied et en chenilles`, () => {
    const r = validerMapDef(brut);
    assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs));
    if (!r.ok) return;
    const carte = r.valeur;
    const qgs = Object.keys(carte.proprietaires).filter(k => {
      const [x = 0, y = 0] = k.split(',').map(Number); return carte.grille[y]?.[x] === 'H';
    });
    assert.equal(new Set(qgs.map(k => carte.proprietaires[k])).size, carte.camps);
    for (const mouvement of ['pied', 'chenilles'] as const) {
      const vus = accessible(carte, qgs[0]!, mouvement);
      for (const qg of qgs) assert.ok(vus.has(qg), `${mouvement} : QG inaccessible ${qg}`);
    }
    for (const u of carte.unitesDepart) {
      const def = unites.find(d => d.cle === u.type);
      assert.ok(def, `unité inconnue ${u.type}`);
      const terrain = terrains.find(t => t.car === carte.grille[u.y]?.[u.x]);
      assert.equal(typeof terrain?.couts[def.typeMouvement], 'number', `départ impraticable ${u.type}`);
    }
  });
}
test('le détour garde une traversée pour les véhicules si un pont est occupé', () => {
  const carte = batteries as MapDef;
  for (const pont of ['10,4', '10,11']) {
    assert.ok(accessible(carte, '2,3', 'chenilles', pont).has('17,8'));
    assert.ok(accessible(carte, '2,12', 'chenilles', pont).has('17,8'));
  }
});
test('la ligne de nuit donne à chaque camp la même dotation initiale et deux producteurs', () => {
  const valeurs = [0, 1, 2, 3].map(camp => nuit.unitesDepart.filter(u => u.camp === camp)
    .reduce((total, u) => total + unites.find(d => d.cle === u.type)!.cout, 0));
  assert.equal(new Set(valeurs).size, 1);
  for (const camp of [0, 1, 2, 3]) assert.equal(Object.values(nuit.proprietaires).filter(c => c === camp).length, 2);
});
test('la relève réserve six cases raccordées et libres au sud, sans nouvelle unité', () => {
  for (const y of [15, 16, 17]) for (const x of [11, 12]) {
    assert.equal(releve.grille[y]?.[x], 'R');
    assert.ok(!releve.unitesDepart.some(u => u.x === x && u.y === y));
    assert.ok(accessible(releve as MapDef, '11,13', 'chenilles').has(`${x},${y}`));
  }
});
