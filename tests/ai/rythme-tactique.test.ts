import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { meilleureOption, POIDS_PONDEREE } from '../../src/ai';
import { chargerCatalogue, creerPartie, sceneDepuis } from '../../src/engine';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { scenePersonnalisee } from '../engine/aides';
import { validerMapDef, validerScenario } from '../../src/schemas';

test('une capture presque terminée vaut davantage que son premier tour', () => {
 const cat = chargerCatalogue(0);
 const scene = scenePersonnalisee(['HPCPH'], {'0,0':0,'4,0':1},[{camp:0,type:'infanterie',x:2,y:0},{camp:1,type:'infanterie',x:4,y:0}],{fondsDepart:0,brouillard:false});
 const e = creerPartie(scene,cat,'capture');
 const u = e.unites[0]!;
 const debut = meilleureOption(e,cat,u,POIDS_PONDEREE);
 const avance = meilleureOption(e,cat,{...u,pointsCapture:10},POIDS_PONDEREE);
 assert.ok(avance.score > debut.score);
 assert.equal(avance.action.type,'ordre');
 if(avance.action.type === 'ordre') assert.equal(avance.action.suite.type,'capturer');
});

test('siège : chaque réserve tardive est annoncée et une victoire anticipée évite l’attente vide', () => {
 const sr=validerScenario(JSON.parse(readFileSync('content/scenarios/aube_releve_1v3.json','utf8')));
 const mr=validerMapDef(JSON.parse(readFileSync('content/cartes/carte_quarantieme_releve.json','utf8')));
 assert.ok(sr.ok);assert.ok(mr.ok);if(!sr.ok||!mr.ok)return;
 const e=creerPartie(sceneDepuis(sr.valeur,mr.valeur,resoudreCommandantsScenario(sr.valeur)),chargerCatalogue(0),'siege');
 assert.ok(e.camps.every(c=>c.qgCase!==null));
 assert.ok(sr.valeur.victoire.some(v=>v.type==='capture_qg'));
 for(const j of [10,20,30,34,38]) {
  assert.ok(sr.valeur.renforts?.some(r=>r.journee===j));
  assert.ok(sr.valeur.scenesDialogue?.some(s=>s.declencheur.type==='journee'&&s.declencheur.journee===j-1));
 }
});

test('un soutien se rapproche aussi des clients d’un camp allié', () => {
 const cat=chargerCatalogue(0);
 const scene=scenePersonnalisee(['HPPPPPPPH','PPPPPPPPP','PPPPHPPPP'],{'0,0':0,'8,0':1,'4,2':2},[{camp:0,type:'transport',x:1,y:1},{camp:1,type:'char_leger',x:6,y:1},{camp:2,type:'infanterie',x:4,y:2}],{equipes:[[0,1],[2]],fondsDepart:0,brouillard:false});
 scene.camps=[0,1,2];
 const e=creerPartie(scene,cat,'soutien');
 e.unites.find(u=>u.camp===1)!.munitions=0;
 const a=meilleureOption(e,cat,e.unites[0]!,POIDS_PONDEREE).action;
 assert.equal(a.type,'ordre');
 if(a.type==='ordre') {assert.equal(a.suite.type,'ravitailler');assert.ok(a.chemin.at(-1)!.x>1);}
});

test('une pièce indirecte ne se rapproche pas au contact pour gagner du terrain', () => {
 const cat=chargerCatalogue(0);
 const scene=scenePersonnalisee(['HPPPPPPPH','PPPPPPPPP','PPPPPPPPP'],{'0,0':0,'8,0':1},[{camp:0,type:'artillerie',x:3,y:1},{camp:1,type:'char_leger',x:6,y:1}],{fondsDepart:0,brouillard:false});
 const e=creerPartie(scene,cat,'distance');
 const a=meilleureOption(e,cat,e.unites[0]!,POIDS_PONDEREE).action;
 assert.equal(a.type,'ordre');
 if(a.type==='ordre') {const fin=a.chemin.at(-1)!;assert.ok(Math.abs(fin.x-6)+Math.abs(fin.y-1)>=2);}
});
