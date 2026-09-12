import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intentionCanon } from '../../src/serveur/conception-canon';
import { composerCarte, ouvrirAxes, ancrages } from '../../src/mapgen/conception';
import { controlerIntention, concevoirMission } from '../../src/serveur/conception';
import { validerConception } from '../../src/schemas/conception';
import { scenarioPourMode } from '../../src/content/difficulte';
import { avecConsequences } from '../../src/app/admin/cartes/consequences';

test('les variantes conservent ancrages, économie et effectifs ; la graine suffit à les reproduire',async()=>{
  const d=(await intentionCanon())!,avant=structuredClone(d);
  const a=composerCarte(d,0),b=composerCarte(d,1);
  assert.deepEqual(a,composerCarte(d,0));assert.notEqual(a.empreinte,b.empreinte);assert.deepEqual(d,avant);
  assert.deepEqual(a.carte.proprietaires,d.carte.proprietaires);assert.deepEqual(a.carte.unitesDepart,d.carte.unitesDepart);
  for(const p of ancrages(d))assert.equal(a.carte.grille[p.y]![p.x],d.carte.grille[p.y]![p.x]);
  assert.equal(a.carte.generation,undefined);assert.equal(a.carte.statut,'brouillon');
  assert.deepEqual(controlerIntention(d,a).erreurs,[]);
  const r=ouvrirAxes(a);for(const p of a.fixes)assert.equal(r.carte.grille[p.y]![p.x],a.carte.grille[p.y]![p.x]);
});
test('littoral et cases verrouillées restent intacts même après une correction',async()=>{
  const d=(await intentionCanon())!;d.carte.grille[0]='WWWWWWWWWWWW';d.intention.casesFixes=[{x:5,y:5}];
  const p=ouvrirAxes(composerCarte(d,1));assert.equal(p.carte.grille[0],d.carte.grille[0]);assert.equal(p.carte.grille[5]![5],d.carte.grille[5]![5]);
});
test('refus explicites du contrat, des contraintes pédagogiques et des doublons',async()=>{
  const d=(await intentionCanon())!;assert.equal(validerConception(d).ok,true);
  for(const modif of [()=>({...d,intention:{...d.intention,variantes:80}}),()=>({...d,publication:true}),()=>({...d,intention:{...d.intention,forme:'invente'}}),()=>({...d,scenario:{...d.scenario,carteCle:'autre'}})])assert.equal(validerConception(modif()).ok,false);
  d.intention.interdits=['nuit'];d.scenario.cycleJourNuit={jour:4,nuit:2};
  assert.ok(controlerIntention(d,composerCarte(d,0)).erreurs.some(x=>x.includes('nuit')));
  d.intention.interdits=[];const p=composerCarte(d,0);d.historique=[{empreinte:p.empreinte,forme:d.intention.forme}];
  assert.ok(controlerIntention(d,p).erreurs.some(x=>x.includes('historique')));
});
test('les conséquences sont résolues après les modes et restent présentes dans les deux versions',async()=>{
  const d=avecConsequences((await intentionCanon('pacte_du_col'))!);assert.ok(d.branches.length>0);
  const b=d.branches[0]!;
  for(const mode of ['normal','difficile'] as const){
    const base=scenarioPourMode(d.scenario,mode);
    assert.equal(b[mode].fondsDepartParCamp?.[0],(base.fondsDepartParCamp?.[0]??base.fondsDepart)+2000);
  }
  assert.equal(validerConception(d).ok,true);
});
test('pipeline : budgets, deux modes et rejeux réels, sans modifier le scénario',async()=>{
  const d=(await intentionCanon())!;const avant=JSON.stringify(d);
  const r=await concevoirMission(d,{partiesMax:4,dureeMaxMs:60000});
  assert.equal(r.budget.parties,4);assert.equal(r.budget.interrompu,true);
  const essais=r.candidates[0]!.revisions[0]!.essais;
  assert.deepEqual([...new Set(essais.map(e=>e.mode))],['normal','difficile']);
  assert.ok(essais.every(e=>e.actions.length>0&&e.rejeuConforme));
  assert.equal(JSON.stringify(d),avant);assert.equal(r.statut,'brouillon');
  assert.ok(r.candidates.some(c=>c.revisions.some(e=>e.statut==='incomplet')));
});
test('une demande annulée ne lance aucune partie et ne recommande rien',async()=>{
  const d=(await intentionCanon())!,controle=new AbortController();controle.abort();
  const r=await concevoirMission(d,{signal:controle.signal});assert.equal(r.budget.parties,0);assert.equal(r.recommandation,null);assert.equal(r.budget.interrompu,true);
});
