import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validerMapDef, validerScenario } from '../../src/schemas/index';
import { appliquer, creerPartie, sceneDepuis, copierEtat } from '../../src/engine/index';
import { evaluerFin } from '../../src/engine/regles/victoire';
import { CAT, partiePersonnalisee } from './aides';

function terrain() {
 return partiePersonnalisee(['HPPPH'], {'0,0':0,'4,0':1}, [{camp:0,type:'infanterie',x:1,y:0},{camp:1,type:'infanterie',x:3,y:0}]);
}
test('survie attend quatre journées complètes même sans adversaires',()=>{
 const e=terrain();e.reglages.victoire=[{type:'survivre',journees:4}];e.unites=e.unites.filter(u=>u.camp===0);
 e.journee=4;evaluerFin(e,CAT,[]);assert.equal(e.partie.terminee,false);
 e.journee=5;evaluerFin(e,CAT,[]);assert.equal(e.partie.motif,'objectif_survivre');
});
test('escorte exige la bonne unité débarquée et perd si elle disparaît',()=>{
 const e=terrain();e.reglages.victoire=[{type:'proteger',uniteRef:'u1',destination:{x:2,y:0}}];e.reglages.defaite=[{type:'unite_perdue',uniteRef:'u1'}];
 e.unites[0]!.x=2;e.unites[0]!.dansTransport='u99';evaluerFin(e,CAT,[]);assert.equal(e.partie.terminee,false);
 e.unites[0]!.dansTransport=null;evaluerFin(e,CAT,[]);assert.equal(e.partie.motif,'objectif_proteger');
 const perdu=terrain();perdu.reglages=e.reglages;perdu.unites=perdu.unites.filter(u=>u.id!=='u1');evaluerFin(perdu,CAT,[]);assert.notEqual(perdu.partie.vainqueur,0);
});
test('relais valide seulement les balises dans l’ordre et copie sa progression',()=>{
 const e=terrain();e.reglages.victoire=[{type:'relais',cases:[{x:2,y:0},{x:1,y:0}]}];evaluerFin(e,CAT,[]);assert.equal(e.relais?.['0'],undefined);
 e.unites[0]!.x=2;evaluerFin(e,CAT,[]);assert.equal(e.relais?.['0'],1);
 const copie=copierEtat(e);copie.relais!['0']=9;assert.equal(e.relais?.['0'],1);
 e.unites[0]!.x=1;evaluerFin(e,CAT,[]);assert.equal(e.partie.motif,'objectif_relais');
});
const manifeste=JSON.parse(readFileSync('content/campagne.json','utf8')) as {missions:{scenarioCle:string}[]};
for(const {scenarioCle} of manifeste.missions) test(`mission ${scenarioCle} : contrats et coordonnées d’objectif valides`,()=>{
 const s=validerScenario(JSON.parse(readFileSync(`content/scenarios/${scenarioCle}.json`,'utf8')));assert.equal(s.ok,true,JSON.stringify(s));if(!s.ok)return;
 const m=validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.valeur.carteCle}.json`,'utf8')));assert.equal(m.ok,true,JSON.stringify(m));if(!m.ok)return;
 let e=creerPartie(sceneDepuis(s.valeur,m.valeur,[]),CAT,'campagne');
 const objectif=s.valeur.victoire[0]!;
 for(const u of e.unites)assert.ok(CAT.unites[u.type]);
 // Les coordonnées de toutes les balises sont légales et accessibles à pied.
 const cibles=objectif.type==='proteger'?[objectif.destination!]:('cases'in objectif?objectif.cases:[]);
 for(const c of cibles){assert.ok(c.x>=0&&c.y>=0&&c.x<e.largeur&&c.y<e.hauteur);}
 if(objectif.type==='survivre'){
  for(let i=0;i<8;i++){const r=appliquer(e,{type:'finTour'},CAT);assert.equal(r.ok,true);if(r.ok)e=r.etat;}
  assert.equal(e.partie.vainqueur,0);
 }
});

test('la survie complète gagne à son échéance ; une escorte inachevée perd',()=>{
 const e=terrain();e.reglages.victoire=[{type:'survivre',journees:4}];e.reglages.defaite=[{type:'limite_journees',journees:4}];e.journee=5;evaluerFin(e,CAT,[]);assert.equal(e.partie.vainqueur,0);
 const autre=terrain();autre.reglages.victoire=[{type:'proteger',uniteRef:'u1',destination:{x:2,y:0}}];autre.reglages.defaite=[{type:'limite_journees',journees:4}];autre.journee=5;evaluerFin(autre,CAT,[]);assert.equal(autre.partie.vainqueur,1);
});
test('capturer le QG exige le QG et ne gagne pas par simple élimination',()=>{
 const e=terrain();e.reglages.victoire=[{type:'capture_qg'}];e.camps[1]!.qgCase=null;e.unites=e.unites.filter(u=>u.camp===0);delete e.proprietaires['4,0'];evaluerFin(e,CAT,[]);assert.equal(e.partie.terminee,false);
});

test('capture_qg seul gagne après une capture réelle en deux actions',()=>{
 let e=partiePersonnalisee(['HPPPH'],{'0,0':0,'4,0':1},[{camp:0,type:'infanterie',x:3,y:0},{camp:1,type:'infanterie',x:2,y:0}],{victoire:[{type:'capture_qg'}]});
 const actions=[
  {type:'ordre',uniteId:'u1',chemin:[{x:3,y:0},{x:4,y:0}],suite:{type:'capturer'}},
  {type:'finTour'}, {type:'finTour'},
  {type:'ordre',uniteId:'u1',chemin:[{x:4,y:0}],suite:{type:'capturer'}},
 ] as const;
 for(const action of actions){const r=appliquer(e,JSON.parse(JSON.stringify(action)),CAT);assert.equal(r.ok,true);if(r.ok)e=r.etat;}
 assert.equal(e.partie.vainqueur,0);assert.equal(e.partie.motif,'objectif_capture_qg');
});
