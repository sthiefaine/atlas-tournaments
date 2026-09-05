// La clé du cache de sprites : cinq champs, et pour une unité la **silhouette**
// et non la clé d'unité (02-architecture.md §2 point 2 et §3.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import { palierZoom } from '../../src/render/camera';
import { nationDe } from '../../src/render/palettes';
import { cleSilhouette } from '../../src/render/sprites/silhouettes';
import { cleSprite } from '../../src/render/sprites/cache';
import { ambiance } from '../../src/render/ambiance';

test('la clé de sprite tient en cinq champs séparés par deux-points', () => {
  const cle = cleSprite({
    type: 'silhouette', cle: 'chenilles-bloc-tourelle-2', nation: 'bleu',
    ambiance: 'automne:jour:clair', zoom: 2,
  });
  assert.equal(cle, 'silhouette:chenilles-bloc-tourelle-2:bleu:automne:jour:clair:2x');
  assert.equal(cle.startsWith('silhouette:'), true);
  assert.equal(cle.endsWith(':2x'), true);
});

test('deux unités de silhouette identique partagent la même clé', () => {
  const a = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 });
  const b = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 });
  const c = cleSilhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 3 });
  assert.equal(a, b);
  assert.notEqual(a, c, 'la taille fait partie de l’identité de la silhouette');
  assert.equal(a, 'chenilles-bloc-tourelle-2');
  assert.equal(
    cleSilhouette({ base: 'pattes', corps: 'capsule', modules: [], taille: 1 }),
    'pattes-capsule-nu-1',
  );
});

test('les dix unités canon donnent des silhouettes distinctes', () => {
  const cat = chargerCatalogue();
  const cles = cat.cles.filter((c) => cat.unites[c]!.statut === 'canon').map((c) => cleSilhouette(cat.unites[c]!.silhouette));
  assert.equal(cles.length, 10);
  assert.equal(new Set(cles).size, 10, 'deux unités canon partagent une silhouette');
});

test('la clé change avec la nation, l’ambiance et le palier de zoom', () => {
  const champs = {
    type: 'silhouette', cle: 'roues-plateau-lance_roquettes-3',
    nation: nationDe(0), ambiance: ambiance('hiver', 'jour', 'neige').cle, zoom: palierZoom(1),
  };
  const base = cleSprite(champs);
  assert.notEqual(base, cleSprite({ ...champs, nation: nationDe(1) }));
  assert.notEqual(base, cleSprite({ ...champs, ambiance: ambiance('hiver', 'nuit', 'neige').cle }));
  assert.notEqual(base, cleSprite({ ...champs, zoom: palierZoom(2) }));
});

// ---------------------------------------------------------------------------
// Le terrain qui change en cours de partie doit atteindre l'image
// ---------------------------------------------------------------------------

test('une marée change la signature de terrain, donc la clé de la couche de fond', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { appliquer, chargerCatalogue, creerPartie, sceneDepuis, signatureTerrain } = await import('../../src/engine/index');
  const { carteDe } = await import('../../src/render/scene');
  const { commandantsDuScenario } = await import('../../src/render/jeu');
  const { validerMapDef, validerScenario } = await import('../../src/schemas/valider');

  const racine = path.resolve(import.meta.dirname, '..', '..', 'content');
  const s = validerScenario(JSON.parse(readFileSync(path.join(racine, 'scenarios', 'passage_des_marees.json'), 'utf8')) as unknown);
  const c = validerMapDef(JSON.parse(readFileSync(path.join(racine, 'cartes', 'carte_passage_des_marees.json'), 'utf8')) as unknown);
  assert.ok(s.ok && c.ok, 'le canon des marées est valide');
  if (!s.ok || !c.ok) return;

  const cat = chargerCatalogue(s.valeur.catalogueVersion);
  const cmd = commandantsDuScenario(s.valeur);
  const basse = creerPartie(sceneDepuis(s.valeur, c.valeur, cmd), cat, 'marees');
  let haute = basse;
  for (let i = 0; i < 4 && haute.journee < 2; i += 1) {
    const r = appliquer(haute, { type: 'finTour' }, cat, cmd);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    haute = r.etat;
  }

  // Le chenal découvre à marée basse et se remplit à marée haute.
  assert.equal(carteDe(basse, cat).terrainDe(5, 6), 'plage', 'journée 1 : le chenal est à sec');
  assert.equal(carteDe(haute, cat).terrainDe(5, 6), 'mer', 'journée 2 : la mer est revenue');

  // C'est cette signature qui sert de clé au cache de la couche de fond : si
  // elle ne bouge pas, la carte reste peinte au premier jour — le rendu gelait
  // la marée exactement comme ça.
  assert.notEqual(
    signatureTerrain(basse), signatureTerrain(haute),
    'la signature de terrain doit distinguer les deux marées',
  );
});
