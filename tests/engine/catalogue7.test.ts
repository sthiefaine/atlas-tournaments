import test from 'node:test';
import assert from 'node:assert/strict';
import { appliquer, chargerCatalogue, creerPartie, degatsBase, produitesPar, verifierProduction, visionUnite } from '../../src/engine/index';
import { scenePersonnalisee } from './aides';
import { usinesLibres } from '../../src/ai/evaluation';
import { validerScenario } from '../../src/schemas/index';
import scenarioJson from '../../content/scenarios/demo.json';
const cat = chargerCatalogue(7);
const nouvelles = ['drone_intercepteur', 'drone_ravitailleur', 'meridien_veilleur', 'meridien_bastion'];
function scene(atl = false) {
  return scenePersonnalisee(['APPPPPPP', 'UPPPPPPP'], { '0,0': 0, '0,1': 0 }, [
    { camp: 0, type: 'infanterie', x: 1, y: 1 }, { camp: 1, type: 'infanterie', x: 7, y: 1 },
  ], { fondsDepart: 30000, factionsParCamp: atl ? { 0: 'atl' } : {}, meteoForcee: 'clair', cycleJourNuit: { jour: 1, nuit: 0 } });
}
test('catalogue 7 ajoute quatre rôles sans modifier les six catalogues antérieurs', () => {
  assert.deepEqual([1,2,3,4,5,6,7].map((v) => chargerCatalogue(v).cles.length), [10,11,13,14,23,24,28]);
  const six = chargerCatalogue(6);
  for (const cle of six.cles) assert.deepEqual(cat.unites[cle], six.unites[cle]);
  for (const a of six.cles) for (const d of six.cles) assert.equal(degatsBase(cat,a,d), degatsBase(six,a,d));
  for (const cle of nouvelles) {
    assert(!six.cles.includes(cle));
    // Trente colonnes depuis l'automate méridien du catalogue 9 : la ligne
    // couvre tout le canon, le catalogue 7 n'en lit que vingt-huit.
    assert.equal(Object.keys(cat.unites[cle]!.degats).length, 30);
    assert.equal(Object.keys(cat.unites[cle]!.subitDegats!).length, 30);
  }
});
test('matériel exclusif : caché à la délégation, production réellement refusée et autorisée à atl', () => {
  const ordinaire = creerPartie(scene(),cat,'production');
  const faction = creerPartie(scene(true),cat,'production');
  assert(!produitesPar(cat,'aeroport',ordinaire,0).includes('meridien_veilleur'));
  assert(!produitesPar(cat,'usine',ordinaire,0).includes('meridien_bastion'));
  assert(produitesPar(cat,'aeroport',faction,0).includes('meridien_veilleur'));
  assert(!verifierProduction(ordinaire,cat,0,{x:0,y:0},'meridien_veilleur').ok);
  assert(verifierProduction(faction,cat,0,{x:0,y:0},'meridien_veilleur').ok);
  const r = appliquer(ordinaire,{type:'produire',batiment:{x:0,y:0},unite:'meridien_veilleur'},cat);
  assert(!r.ok);
  assert.equal(usinesLibres(faction,cat,0).length,2);
});
test('placement et renfort exclusifs refusés sans appartenance explicite', () => {
  const s = scene();s.unitesDepart.push({camp:0,type:'meridien_bastion',x:2,y:0});
  assert.throws(() => creerPartie(s,cat,'interdit'), /exclusive/);
  const r = scene();r.reglages.renforts=[{journee:2,unites:[{camp:0,type:'meridien_veilleur',x:2,y:0}]}];
  assert.throws(() => creerPartie(r,cat,'interdit'), /exclusive/);
  const valide = structuredClone(s);valide.reglages.factionsParCamp={0:'atl'};
  assert.doesNotThrow(() => creerPartie(valide,cat,'autorise'));
});
test('drone intercepteur combat seulement les aéronefs et son œil peut être brouillé', () => {
  const s=scene();s.unitesDepart=[{camp:0,type:'drone_intercepteur',x:2,y:0},{camp:1,type:'brouilleur',x:6,y:0}];
  const e=creerPartie(s,cat,'brouillage');
  assert.equal(visionUnite(e,cat,e.unites[0]!),1);
  assert(degatsBase(cat,'drone_intercepteur','drone')>0);
  assert.equal(degatsBase(cat,'drone_intercepteur','char_leger'),0);
});
test('drone ravitailleur remet réellement les réserves du voisin au plein', () => {
  const s=scene();s.unitesDepart=[{camp:0,type:'drone_ravitailleur',x:2,y:0},{camp:0,type:'char_leger',x:3,y:0},{camp:1,type:'infanterie',x:7,y:0}];
  const e=creerPartie(s,cat,'ravitaillement'); e.unites[1]!.munitions=1;e.unites[1]!.carburant=1;
  const r=appliquer(e,{type:'ordre',uniteId:'u1',chemin:[],suite:{type:'ravitailler',cible:{x:3,y:0}}},cat);
  assert(r.ok);if(!r.ok)return;
  assert.equal(r.etat.unites[1]!.munitions,cat.unites.char_leger!.munitions);
  assert.equal(r.etat.unites[1]!.carburant,cat.unites.char_leger!.carburant!.max);
});
test('factions du scénario : camps absents et codes inconnus refusés', () => {
  assert(validerScenario({...scenarioJson,factionsParCamp:{0:'atl'}}).ok);
  assert(!validerScenario({...scenarioJson,factionsParCamp:{3:'atl'}}).ok);
  assert(!validerScenario({...scenarioJson,factionsParCamp:{0:'fr'}}).ok);
});

test('ravitaillement entre camps alliés : réserves communes accessibles, propriété conservée et adversaire refusé', () => {
  const s = scene();
  s.camps = [0, 1, 2];
  s.reglages.equipes = [[0, 2], [1]];
  s.unitesDepart = [
    { camp: 0, type: 'drone_ravitailleur', x: 2, y: 0 },
    { camp: 2, type: 'char_leger', x: 3, y: 0 },
    { camp: 1, type: 'char_leger', x: 2, y: 1 },
  ];
  const e = creerPartie(s, cat, 'soutien-allie');
  e.unites[1]!.munitions = 1;
  e.unites[1]!.carburant = 1;
  const r = appliquer(e, { type: 'ordre', uniteId: 'u1', chemin: [], suite: { type: 'ravitailler', cible: { x: 3, y: 0 } } }, cat);
  assert(r.ok); if (!r.ok) return;
  assert.equal(r.etat.unites[1]!.camp, 2);
  assert.equal(r.etat.unites[1]!.munitions, cat.unites.char_leger!.munitions);
  assert.equal(r.etat.unites[1]!.carburant, cat.unites.char_leger!.carburant!.max);
  assert.equal(e.unites[1]!.munitions, 1, 'entrée immuable');
  assert(!appliquer(e, { type: 'ordre', uniteId: 'u1', chemin: [], suite: { type: 'ravitailler', cible: { x: 2, y: 1 } } }, cat).ok);
});
