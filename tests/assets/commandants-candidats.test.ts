import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { genererSpecs } from '../../src/assets/catalogue';
import { geometriesCommandant, PROFILS_COMMANDANTS } from '../../scripts/production/commandants';
import { sceneCandidate, animationsCandidates } from '../../scripts/production/commun';
test('dix portraits : profils anatomiques, coiffures et âges distincts, budgets respectés',()=>{
 const specs=genererSpecs().filter(s=>s.type==='commandant');assert.equal(specs.length,10);
 assert.equal(new Set(Object.values(PROFILS_COMMANDANTS).map(p=>p.coiffure)).size,10);
 const signatures=new Set<string>();
 for(const s of specs){const morceaux=geometriesCommandant(s,0);const triangles=morceaux.reduce((n,m)=>n+(m.geometrie.index?.count??m.geometrie.getAttribute('position').count)/3,0);assert(triangles<=s.budget.lod0,`${s.id}: ${triangles}`);assert(morceaux.some(m=>m.noeud==='tete'&&m.role===5));assert(morceaux.some(m=>m.noeud==='buste'&&m.role===0));signatures.add(JSON.stringify(morceaux.map(m=>[m.noeud,m.role,...m.geometrie.getAttribute('position').array.slice(0,12)])));for(const m of morceaux)m.geometrie.dispose();}
 assert.equal(signatures.size,10);
});
test('portrait : tête articulée, UV peau sur une demi-carte, masque vestimentaire séparé',()=>{
 const s=genererSpecs().find(s=>s.id==='commandant_stratege_prudent')!,m=geometriesCommandant(s,0),root=sceneCandidate(s,m,{portrait:true});
 assert.equal(root.getObjectByName('tete')!.parent?.name,'buste');
 const tete=root.getObjectByName('tete') as THREE.Mesh;const uv=tete.geometry.getAttribute('uv');
 const groupePeau=tete.geometry.groups.find(g=>g.materialIndex===0)!;assert(groupePeau);
 for(let i=groupePeau.start;i<groupePeau.start+groupePeau.count;i++)assert(uv.getX(i)>=.019&&uv.getX(i)<=.481);
 const clip=animationsCandidates(s,root)[0]!;assert.equal(clip.name,'repos');assert.equal(clip.duration,2.8);assert(!clip.tracks.some(t=>t.name.startsWith('racine.')));
 const boite=new THREE.Box3().setFromObject(root);assert(Math.abs(boite.min.y)<1e-6);
});

test('visage : normales orientées vers l’extérieur, pas de tête retournée',()=>{
 const spec=genererSpecs().find(s=>s.id==='commandant_stratege_prudent')!,m=geometriesCommandant(spec,0);
 const visage=m.find(m=>m.noeud==='tete'&&m.geometrie.type==='BufferGeometry')!.geometrie;
 const p=visage.getAttribute('position'),n=visage.getAttribute('normal');let radial=0;
 for(let i=0;i<p.count;i++)radial+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);
 assert(radial>0);for(const morceau of m)morceau.geometrie.dispose();
});
