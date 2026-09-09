import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerCatalogue, creerPartie, coutBase, degatsBase, produitesPar, visionUnite, verifierProduction } from '../../src/engine/index';
import { scenePersonnalisee } from './aides';
const cat = chargerCatalogue(8);
test('catalogue 8 ouvre le drone marin et conserve les anciens duels', () => {
  assert.equal(cat.cles.length,29);
  for(let v=1;v<=7;v++) assert(!chargerCatalogue(v).cles.includes('drone_marin'));
  const ancien=chargerCatalogue(7);
  for(const a of ancien.cles)for(const d of ancien.cles)assert.equal(degatsBase(cat,a,d),degatsBase(ancien,a,d));
  assert(cat.unites.drone_marin!.traits.includes('drone'));
  assert.equal(cat.unites.drone_marin!.domaine,'mer');
  assert.equal(cat.unites.drone_marin!.vision,5);
});
test('drone marin produit au port, navigable sans vol ni arme', () => {
  assert(produitesPar(cat,'port').includes('drone_marin'));
  assert(!produitesPar(cat,'aeroport').includes('drone_marin'));
  assert.equal(coutBase(cat,'plaine','mer',cat.unites.drone_marin),null);
  assert.equal(coutBase(cat,'mer','mer',cat.unites.drone_marin),1);
  for(const d of cat.cles)assert.equal(degatsBase(cat,'drone_marin',d),0);
  const s=scenePersonnalisee(['OWWPPPPP'],{'0,0':0},[{camp:0,type:'drone_marin',x:1,y:0},{camp:1,type:'infanterie',x:7,y:0}],{fondsDepart:10000,meteoForcee:'clair',cycleJourNuit:{jour:1,nuit:0}});
  const e=creerPartie(s,cat,'port');
  assert(verifierProduction(e,cat,0,{x:0,y:0},'drone_marin').ok);
  assert.equal(visionUnite(e,cat,e.unites[0]!),5);
});
test('drone de surface brouillable depuis la rive', () => {
  const s=scenePersonnalisee(['WWWPPPPP'],{},[{camp:0,type:'drone_marin',x:1,y:0},{camp:1,type:'brouilleur',x:6,y:0}],{meteoForcee:'clair',cycleJourNuit:{jour:1,nuit:0}});
  const e=creerPartie(s,cat,'brouillage-marin');
  assert.equal(visionUnite(e,cat,e.unites[0]!),1);
});

test('essai maritime : remappage valide et drone effectivement posé en mer', async () => {
  const { default: scenarioJson } = await import('../../content/scenarios/aube_drone_marin.json');
  const { default: carteJson } = await import('../../content/cartes/carte_drone_marin.json');
  const { validerScenario, validerMapDef } = await import('../../src/schemas');
  const { sceneDepuis } = await import('../../src/engine');
  const { resoudreCommandantsScenario } = await import('../../src/content/commandants-jeu');
  const vs=validerScenario(scenarioJson),vm=validerMapDef(carteJson);
  assert(vs.ok,vs.ok?'':JSON.stringify(vs.erreurs));
  assert(vm.ok,vm.ok?'':JSON.stringify(vm.erreurs));
  if(!vs.ok||!vm.ok)return;
  const e=creerPartie(sceneDepuis(vs.valeur,vm.valeur,resoudreCommandantsScenario(vs.valeur)),cat,'essai-marin');
  const drone=e.unites.find(u=>u.type==='drone_marin')!;
  assert(drone);
  assert.equal(drone.camp,0);
  assert(e.reglages.brouillard);
});
