// L'ambiance est une fonction pure de (saison, phase, météo) : c'est ce qui la
// rend testable sans DOM, et c'est ce qui garantit qu'une partie jouée calques
// éteints est exactement la même partie (02-architecture.md §3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ambiance, lireCouleur, melanger, teinter } from '../../src/render/ambiance';
import { METEOS, PHASES_JOUR, SAISONS } from '../../src/schemas/index';

test('la clé d’ambiance identifie exactement le triplet climatique', () => {
  assert.equal(ambiance('automne', 'nuit', 'pluie').cle, 'automne:nuit:pluie');
  const vues = new Set<string>();
  for (const s of SAISONS) {
    for (const p of PHASES_JOUR) {
      for (const m of METEOS) vues.add(ambiance(s, p, m).cle);
    }
  }
  assert.equal(vues.size, SAISONS.length * PHASES_JOUR.length * METEOS.length);
});

test('deux appels identiques rendent le même objet : la mémorisation tient', () => {
  assert.equal(ambiance('ete', 'jour', 'clair'), ambiance('ete', 'jour', 'clair'));
});

test('chaque saison a sa propre palette de feuillage et de sol', () => {
  const feuillages = SAISONS.map((s) => ambiance(s, 'jour', 'clair').palette.feuillage);
  assert.equal(new Set(feuillages).size, SAISONS.length, 'deux saisons partagent un feuillage');
  const automne = ambiance('automne', 'jour', 'clair').palette;
  const printemps = ambiance('printemps', 'jour', 'clair').palette;
  // L'automne est roux : plus de rouge, moins de vert que le printemps.
  assert.ok(lireCouleur(automne.feuillage).r > lireCouleur(printemps.feuillage).r);
  assert.ok(lireCouleur(automne.feuillage).v < lireCouleur(printemps.feuillage).v);
});

test('l’hiver et la neige blanchissent le sol', () => {
  const base = ambiance('printemps', 'jour', 'clair').palette.herbe;
  const hiver = ambiance('hiver', 'jour', 'clair').palette.herbe;
  const neige = ambiance('printemps', 'jour', 'neige').palette.herbe;
  for (const clair of [hiver, neige]) {
    const a = lireCouleur(base);
    const b = lireCouleur(clair);
    assert.ok(b.r + b.v + b.b > a.r + a.v + a.b, 'le sol devrait être plus clair');
  }
});

test('la nuit assombrit, pose un voile bleu et allume les villes', () => {
  const jour = ambiance('ete', 'jour', 'clair');
  const nuit = ambiance('ete', 'nuit', 'clair');
  assert.equal(jour.voile, null);
  assert.ok(nuit.voile);
  assert.equal(nuit.villesEclairees, true);
  assert.equal(jour.villesEclairees, false);
  const a = lireCouleur(jour.palette.herbe);
  const b = lireCouleur(nuit.palette.herbe);
  assert.ok(b.r + b.v + b.b < a.r + a.v + a.b, 'la nuit devrait assombrir le sol');
  assert.ok(b.b > b.r, 'la nuit devrait bleuir');
  assert.equal(nuit.palette.fenetre, jour.palette.fenetre, 'les fenêtres restent chaudes');
});

test('chaque météo décide de son calque de particules', () => {
  assert.equal(ambiance('ete', 'jour', 'clair').particules.type, 'aucune');
  assert.equal(ambiance('ete', 'jour', 'pluie').particules.type, 'pluie');
  assert.equal(ambiance('hiver', 'jour', 'neige').particules.type, 'neige');
  assert.equal(ambiance('ete', 'jour', 'brouillard').particules.type, 'brume');
  assert.equal(ambiance('ete', 'jour', 'canicule').particules.type, 'poussiere');
  const pluie = ambiance('ete', 'jour', 'pluie').particules;
  const tempete = ambiance('ete', 'jour', 'tempete').particules;
  assert.ok(tempete.densite > pluie.densite && tempete.vent > pluie.vent);
});

test('les couleurs se mélangent et se teintent sans sortir des bornes', () => {
  assert.equal(melanger('#000000', '#ffffff', 0), '#000000');
  assert.equal(melanger('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(melanger('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(teinter('#ffffff', 2), '#ffffff', 'une teinte ne déborde jamais de 255');
  assert.equal(teinter('#ffffff', 0), '#000000');
});
