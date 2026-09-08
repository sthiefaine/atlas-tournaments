// L'ordre du chantier existe pour une raison précise : commander un kit avant sa
// géométrie de base fait réclamer au générateur un maillage qui n'existe pas.
// C'est arrivé trois fois de suite sur « kit_fr_artillerie ».
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { genererSpecs } from '../../src/assets/index';
import { baseRequise, chantier, prochain } from '../../src/serveur/chantier-assets';

const SPECS = genererSpecs();

test('un kit dépend de la géométrie de base de son unité', () => {
  const kit = SPECS.find((s) => s.id === 'kit_fr_artillerie');
  assert.ok(kit);
  assert.equal(baseRequise(kit), 'unite_artillerie_base');

  // Une clé d'unité à tirets bas ne perd pas ses segments.
  const charLeger = SPECS.find((s) => s.id === 'kit_fr_char_leger');
  assert.ok(charLeger);
  assert.equal(baseRequise(charLeger), 'unite_char_leger_base');

  // Rien d'autre ne dépend de rien : un terrain, un décor, une base.
  const base = SPECS.find((s) => s.id === 'unite_artillerie_base');
  assert.ok(base);
  assert.equal(baseRequise(base), null);
});

test('un kit dont la base manque n’est jamais proposé', () => {
  const rien = new Set<string>();
  const propose = prochain(SPECS, rien);
  assert.ok(propose);
  assert.equal(propose.bloquePar, null, 'ce qui est proposé n’est jamais bloqué');
  assert.notEqual(propose.spec.type, 'kit', 'aucun kit tant qu’aucune base n’est livrée');

  // Et tous les kits sont bien marqués comme retenus, pas simplement rangés plus loin.
  const suite = chantier(SPECS, rien);
  const kits = suite.filter((e) => e.spec.type === 'kit');
  assert.ok(kits.length > 0);
  assert.ok(kits.every((e) => e.bloquePar !== null), 'chaque kit dit ce qui le retient');
});

test('livrer une base débloque exactement ses kits, et pas les autres', () => {
  const avec = new Set<string>(['unite_artillerie_base']);
  const suite = chantier(SPECS, avec);

  const kitsArtillerie = suite.filter((e) => e.spec.type === 'kit' && e.spec.cle.endsWith('_artillerie'));
  assert.ok(kitsArtillerie.length > 0);
  assert.ok(kitsArtillerie.every((e) => e.bloquePar === null), 'les kits d’artillerie sont libres');

  const autres = suite.filter((e) => e.spec.type === 'kit' && !e.spec.cle.endsWith('_artillerie'));
  assert.ok(autres.every((e) => e.bloquePar !== null), 'les autres attendent toujours');

  // La base livrée a quitté le chantier.
  assert.ok(!suite.some((e) => e.spec.id === 'unite_artillerie_base'));
});

test('à égalité, la priorité décide, et les géométries de base passent devant', () => {
  const suite = chantier(SPECS, new Set<string>());
  const libres = suite.filter((e) => e.bloquePar === null);
  assert.ok(libres.length > 1);
  assert.equal(libres[0]!.spec.priorite, 1, 'on commence par la priorité 1');
  // Les bases d'unité ouvrent la marche : ce sont elles qui débloquent le reste.
  assert.equal(libres[0]!.spec.type, 'unite');
});
