import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { genererSpecs } from '../../src/assets/catalogue';
import { contratProduction } from '../../src/assets/production';
import { sceneCandidate, animationsCandidates } from '../../scripts/production/commun';
import { noeudPiece } from '../../scripts/production/unites';
import type { Piece } from '../../src/render3d/pieces';
const specs=genererSpecs();
function morceau(nom:string){return {noeud:nom,role:0,geometrie:new THREE.BoxGeometry(.2,.2,.2).translate(0,.2,.1)};}
test('candidat : pivots contractuels et parentages préservent le modèle au repos',()=>{
 const s=specs.find(s=>s.id==='unite_antiair_base')!;
 const root=sceneCandidate(s,s.format.noeuds.filter(n=>n!=='racine').map(morceau),{});
 for(const articulation of contratProduction(s).assemblage){const o=root.getObjectByName(articulation.nom)!;assert(o);if(articulation.parent)assert.equal(o.parent?.name,articulation.parent);if(articulation.pivot)assert(o.position.distanceTo(new THREE.Vector3(...articulation.pivot))<1e-10);}
 const box=new THREE.Box3().setFromObject(root);assert(Math.abs(box.min.y)<1e-7);assert(Math.abs(box.max.x-s.echelle.x.cible/2)<1e-7);
 const repos=animationsCandidates(s,root).find(a=>a.name==='repos')!;assert(repos.tracks.some(t=>t.name==='module_radar.quaternion'));
});
test('hors jeu : aucune disparition des bêches ou du support générique',()=>{
 for(const id of ['unite_artillerie_base','unite_char_leger_base']){const s=specs.find(s=>s.id===id)!;const root=sceneCandidate(s,s.format.noeuds.filter(n=>n!=='racine').map(morceau),{});const clip=animationsCandidates(s,root).find(a=>a.name==='hors_jeu')!;assert(!clip.tracks.some(t=>t.name==='socle.scale'));}
});
test('modules : berceau, rampe, tubes, panneaux et hublot suivent leur articulation',()=>{
 const p:Piece={nom:'rampe',forme:'boite',role:'principal',position:[0,0,0],taille:[1,1,1]};
 for(const [module,noms]of Object.entries({canon_long:['berceau','canon_long'],tourelle:['canon','tourelle'],lance_roquettes:['rampe','tube_gauche','tube_droit'],panneaux_solaires:['panneau_gauche','panneau_droit'],nacelle:['nacelle','hublot']})){
 const s={...specs.find(s=>s.type==='unite')!,format:{...specs.find(s=>s.type==='unite')!.format,noeuds:['racine','base','corps',`module_${module}`]}};
 for(const nom of noms)assert.equal(noeudPiece(s,{...p,nom}),`module_${module}`);
 }
});

test('LOD : la simplification conserve les pivots du modèle de référence',()=>{
 const s=specs.find(s=>s.id==='unite_char_leger_base')!;
 const reference=[morceau('corps'),{...morceau('module_tourelle'),geometrie:new THREE.BoxGeometry(.1,.1,.3).translate(0,.4,.2)}];
 const simplifie=[{...morceau('corps'),geometrie:new THREE.BoxGeometry(.1,.1,.1).translate(0,.15,.05)},morceau('module_tourelle')];
 const a=sceneCandidate(s,reference,{reference}), b=sceneCandidate(s,simplifie,{reference});
 for(const n of ['corps','module_tourelle'])assert.deepEqual(a.getObjectByName(n)!.position.toArray(),b.getObjectByName(n)!.position.toArray());
});
