import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionEnvironnement, candidatsBatiment } from '../../src/render3d/assets-environnement';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
const grille:GrilleTerrain={largeur:3,hauteur:1,terrainDe:x=>x===0?'plaine':x===1?'qg':'route'};
const inventaire={modeles:{terrain_plaine:[0] as 0[],terrain_route:[0] as 0[],terrain_mer:[0] as 0[],batiment_qg_fr_ile_de_france:[0] as 0[],batiment_qg_lu:[0] as 0[],batiment_qg_jp:[0] as 0[]}};
test('assets actifs sélectionnés selon la carte et les nations, jamais le numéro du camp',()=>{
  assert.deepEqual(new Set(selectionEnvironnement(grille,{0:'lu',2:'fr'},inventaire)),new Set(['terrain_route','batiment_qg_lu','batiment_qg_fr_ile_de_france']));
  assert.deepEqual(selectionEnvironnement(grille,{},inventaire),['terrain_route']);
  assert.ok(!selectionEnvironnement(grille,{1:'jp'},inventaire).includes('batiment_qg_lu'));
  assert.deepEqual(selectionEnvironnement(grille,{}, {modeles:{}}),[]);
  for(const terrain of ['plaine','foret','herbe_haute'] as const) {
    assert.ok(!selectionEnvironnement({...grille,terrainDe:()=>terrain},{},inventaire).includes('terrain_plaine'));
  }
});
test('modèle national prioritaire, repli partagé ; aucune nation arbitraire',()=>{
  assert.deepEqual(candidatsBatiment('qg','jp'),['batiment_qg_jp','batiment_qg_base']);
  const modele={modeles:{...inventaire.modeles,batiment_qg_fr:[0] as 0[],batiment_qg_base:[0] as 0[]}};
  const choix=selectionEnvironnement(grille,{0:'fr'},modele);
  assert.ok(choix.includes('batiment_qg_fr'));assert.ok(!choix.includes('batiment_qg_fr_ile_de_france'));
  assert.ok(choix.includes('batiment_qg_base'));
});
