import test from 'node:test';
import assert from 'node:assert/strict';
import { clesCampagne, MODES_VERIFICATION } from '../../scripts/verifier-campagne';
test('vérification : découvre toutes les missions du manifeste, y compris dix tutoriels et deux matchs', () => {
  const missions = [...Array.from({length:10}, (_,i) => ({scenarioCle:`tutoriel_${i+1}`})),{scenarioCle:'qualification'},{scenarioCle:'exhibition'}];
  assert.equal(clesCampagne(missions).length,12);
  assert.deepEqual(clesCampagne([...missions,missions[0]!], 'tutoriel_1,exhibition'), ['tutoriel_1','exhibition']);
  assert.deepEqual(clesCampagne(missions,'inexistant'),[]);
});
test('vérification : exerce les deux modes sans remplacer les réglages de jeu', () => {
  assert.deepEqual(MODES_VERIFICATION,['normal','difficile']);
});

test('cibles : ne vise ni le QG allié ni les bâtiments déjà capturés par cet allié', async () => {
  const { ciblesCaptureCampagne } = await import('../../scripts/verifier-campagne');
  const { creerPartie, chargerCatalogue, sceneDepuis } = await import('../../src/engine');
  const { readFileSync } = await import('node:fs');
  const { validerScenario, validerMapDef } = await import('../../src/schemas');
  const v = validerScenario(JSON.parse(readFileSync('content/scenarios/premier_contact.json','utf8')));
  assert(v.ok);
  const m = validerMapDef(JSON.parse(readFileSync(`content/cartes/${v.valeur.carteCle}.json`,'utf8')));
  assert(m.ok);
  const { resoudreCommandantsScenario } = await import('../../src/content/commandants-jeu');
  const e = creerPartie(sceneDepuis(v.valeur,m.valeur,resoudreCommandantsScenario(v.valeur)),chargerCatalogue(v.valeur.catalogueVersion),'preuve');
  e.reglages.equipes = [[0,1],[2]];
  e.reglages.victoire = [{type:'capture_qg'},{type:'capturer',cases:[{x:1,y:1},{x:2,y:2}],combien:2}];
  e.camps[1]!.qgCase = '1,1';
  e.camps.push({...e.camps[1]!,id:2,qgCase:'3,3'});
  e.proprietaires['1,1'] = 1;
  e.proprietaires['2,2'] = 2;
  e.proprietaires['3,3'] = 2;
  assert.deepEqual(ciblesCaptureCampagne(e),[{x:3,y:3},{x:2,y:2}]);
});
