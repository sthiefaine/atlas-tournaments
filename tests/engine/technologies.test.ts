import test from 'node:test';
import assert from 'node:assert/strict';
import { appliquer, creerPartie, copierEtat, chargerCatalogue } from '../../src/engine/index';
import { pointsMouvement, coutEntree } from '../../src/engine/regles/mouvement';
import { prevoirDuel } from '../../src/engine/regles/combat';
import { ouvrirTechnologies } from '../../src/engine/regles/technologies';
import { campAdapteClimat } from '../../src/engine/climat/index';
import { scenePersonnalisee } from './aides';
const CAT = chargerCatalogue(0);
import type { EtatPartie } from '../../src/engine/types';

function scene() {
  return scenePersonnalisee(['PPPPPPP', 'PPPCPPP', 'MMMMMMM', 'MMMMMMM'], {'3,1': 1}, [
    {camp: 0, type: 'helico', x: 2, y: 1},
    {camp: 0, type: 'infanterie', x: 2, y: 0},
    {camp: 1, type: 'helico', x: 3, y: 0},
    {camp: 0, type: 'drone_marin', x: 3, y: 2},
    {camp: 0, type: 'helico', x: 0, y: 3},
  ], {installationsIem: [{cle: 'poste', x: 3, y: 1, premiereJournee: 2}], victoire: [{type: 'survivre', journees: 20}], meteoForcee: 'clair'});
}
function fin(e: EtatPartie) {
  const r = appliquer(e, {type: 'finTour'}, CAT);
  assert(r.ok); return r.etat;
}
test('IEM : annonce, portée, domaines, arrêt réel un tour et réveil', () => {
  let e = creerPartie(scene(), CAT, 'iem');
  assert(e.journal.some(v => v.type === 'annonce' && v.texte.includes('impulsion demain')));
  e = fin(fin(e));
  assert.equal(e.journee, 2);
  assert.equal(e.unites[0]!.iemJusquaJournee, 2);
  assert.equal(e.unites[3]!.iemJusquaJournee, 2);
  assert.equal(e.unites[1]!.iemJusquaJournee, undefined);
  assert.equal(e.unites[2]!.iemJusquaJournee, undefined);
  assert.equal(e.unites[4]!.iemJusquaJournee, undefined);
  assert.equal(pointsMouvement(e, CAT, e.unites[0]!), 0);
  assert.equal(appliquer(e, {type: 'ordre', uniteId: 'u1', chemin: [], suite: {type:'rien'}}, CAT).ok, false);
  const copie = copierEtat(e); delete copie.unites[0]!.iemJusquaJournee;
  assert.equal(e.unites[0]!.iemJusquaJournee, 2);
  e = fin(e);
  assert.equal(e.unites[0]!.iemJusquaJournee, undefined);
  e = fin(e);
  assert.equal(e.unites[0]!.etat, 'prete');
});
test('IEM : capture inverse le camp protégé, neutre éteint, intervalle respecté', () => {
  const e = creerPartie(scene(), CAT, 'capture');
  e.journee = 2; e.proprietaires['3,1'] = 0;
  ouvrirTechnologies(e, CAT, []);
  assert.equal(e.unites[0]!.iemJusquaJournee, undefined);
  assert.equal(e.unites[2]!.iemJusquaJournee, 2);
  delete e.unites[2]!.iemJusquaJournee;
  e.journee = 3; ouvrirTechnologies(e, CAT, []);
  assert.equal(e.unites[2]!.iemJusquaJournee, undefined);
  e.journee = 5; delete e.proprietaires['3,1'];
  ouvrirTechnologies(e, CAT, []);
  assert.equal(e.unites[2]!.iemJusquaJournee, undefined);
});
test('IEM : la prévision ne promet aucune riposte désactivée', () => {
  const e = creerPartie(scene(), CAT, 'duel');
  const att = e.unites[2]!; const def = e.unites[0]!;
  att.x = 3; att.y = 1;
  const avant = prevoirDuel(e, CAT, att, def, att);
  assert(avant.riposte > 0);
  def.iemJusquaJournee = 1;
  assert.equal(prevoirDuel(e, CAT, att, def, att).riposte, 0);
});
test('climat : annonce J-2, prévisions exactes, adaptation bornée par camp', () => {
  const s = scene(); delete s.reglages.installationsIem;
  s.reglages.evenementsClimat = [{cle: 'front', journee: 3, meteo: 'tempete', duree: 2, campsAdaptes: [1]}];
  let e = creerPartie(s, CAT, 'climat');
  assert.deepEqual(e.climat.previsions, ['clair', 'tempete']);
  assert(e.journal.some(v => v.type === 'annonce' && v.texte.includes('Modification météo annoncée')));
  const normal = pointsMouvement(e, CAT, e.unites[0]!);
  e = fin(fin(fin(fin(e))));
  assert.equal(e.journee, 3); assert.equal(e.climat.meteo, 'tempete');
  assert(pointsMouvement(e, CAT, e.unites[0]!) < normal);
  assert.equal(pointsMouvement(e, CAT, e.unites[2]!), normal);
  assert(campAdapteClimat(e, 1)); assert(!campAdapteClimat(e, 0));
  e = fin(fin(fin(fin(e))));
  assert.equal(e.journee, 5); assert.equal(e.climat.meteo, 'clair'); assert(!campAdapteClimat(e, 1));
});
test('climat : coût de déplacement respecte le camp consulté, sans immunité saisonnière', () => {
  const e = creerPartie(scene(), CAT, 'pluie');
  e.reglages.evenementsClimat = [{cle: 'pluie', journee: 3, meteo:'pluie', duree:1, campsAdaptes:[1]}];
  e.journee = 3; e.climat.meteo = 'pluie';
  const u = {...e.unites[0]!, type: 'recon'};
  assert.equal(coutEntree(e, CAT, {...u, camp: 0}, {x: 0, y: 0}), 3);
  assert.equal(coutEntree(e, CAT, {...u, camp: 1}, {x: 0, y: 0}), 2);
});
test('IEM : refuse un emplacement non capturable à la création', () => {
  const s = scene(); s.reglages.installationsIem![0]!.x = 0;
  assert.throws(() => creerPartie(s, CAT, 'invalide'), /capturable/);
});

test('IEM renforcée mondiale : J6 puis J12, aéronefs adverses abattus et propriétaire protégé', () => {
  const s=scene();s.reglages.installationsIem=[{cle:'poste',x:3,y:1,mode:'renforcee',portee:'carte',campProtege:1,premiereJournee:6,intervalle:6}];
  const e=creerPartie(s,CAT,'mondiale');
  assert(e.journal.some(v=>v.type==='annonce'&&v.texte.includes('toute la carte')));
  e.journee=5;ouvrirTechnologies(e,CAT,[]);assert.equal(e.unites.length,5);
  e.journee=6;const evts:Parameters<typeof ouvrirTechnologies>[2]=[];ouvrirTechnologies(e,CAT,evts);
  assert(!e.unites.some(u=>u.id==='u1'||u.id==='u5'));assert(e.unites.some(u=>u.id==='u3'));
  assert.equal(e.unites.find(u=>u.id==='u4')!.iemJusquaJournee,6);assert.equal(e.unites.find(u=>u.id==='u2')!.iemJusquaJournee,undefined);
  assert.equal(evts.filter(v=>v.type==='hors_jeu').length,2);
  delete e.unites.find(u=>u.id==='u4')!.iemJusquaJournee;
  e.journee=11;ouvrirTechnologies(e,CAT,[]);assert.equal(e.unites.find(u=>u.id==='u4')!.iemJusquaJournee,undefined);
  e.journee=12;ouvrirTechnologies(e,CAT,[]);assert.equal(e.unites.find(u=>u.id==='u4')!.iemJusquaJournee,12);
});
test('la station mondiale capturée ou désaffectée reste éteinte ; les alliés du propriétaire sont protégés', () => {
  const s=scene();s.reglages.installationsIem=[{cle:'poste',x:3,y:1,mode:'renforcee',portee:'carte',campProtege:1,premiereJournee:6}];
  for(const off of ['capture','desaffecte','allies']){
    const e=creerPartie(s,CAT,off);e.journee=6;
    if(off==='capture')e.proprietaires['3,1']=0;
    if(off==='desaffecte')e.desaffectes.push('3,1');
    if(off==='allies')e.reglages.equipes=[[0,1]];
    ouvrirTechnologies(e,CAT,[]);assert.equal(e.unites.length,5);assert(e.unites.every(u=>u.iemJusquaJournee===undefined));
  }
});
test('le moteur refuse une station mondiale sans camp protégé ou une cadence renforcée trop courte',()=>{
  const s=scene();s.reglages.installationsIem=[{cle:'poste',x:3,y:1,mode:'renforcee',portee:'carte',premiereJournee:6}];
  assert.throws(()=>creerPartie(s,CAT,'refus'),/camp protégé/);
  s.reglages.installationsIem[0]!.campProtege=1;s.reglages.installationsIem[0]!.intervalle=3;
  assert.throws(()=>creerPartie(s,CAT,'refus'),/intervalle/);
});
