/**
 * Les styles : vingt-quatre styles nationaux, dix-huit styles régionaux.
 *
 * Ce que ce test protège n'est pas la beauté — personne ne sait la tester — mais
 * les trois propriétés dont dépend la lisibilité du jeu : chaque nation a un
 * **motif géométrique distinct** (le daltonisme ne doit pas faire perdre un
 * match), chaque nation retient un **gabarit pour les dix unités de base**, et
 * aucun style ne dérive du canon des pays et des régions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chargerStyleNation, chargerStyleRegion, chargerStylesNations, chargerStylesRegions,
  gabaritDe, styleRegionParMecanique, validerStyleNation, validerStyleRegion,
} from '../../src/assets/index';
import { chargerPays, chargerRegions, chargerUnites } from '../../src/content/index';

const nations = chargerStylesNations();
const regions = chargerStylesRegions('fr');

test('les 24 styles nationaux passent leur validateur', () => {
  assert.equal(nations.length, 24);
  for (const s of nations) {
    const r = validerStyleNation(s);
    assert.equal(r.ok, true, r.ok ? '' : `${s.code} : ${JSON.stringify(r.erreurs, null, 2)}`);
  }
});

test('les 18 styles régionaux de France passent leur validateur', () => {
  assert.equal(regions.length, 18);
  for (const s of regions) {
    const r = validerStyleRegion(s);
    assert.equal(r.ok, true, r.ok ? '' : `${s.code} : ${JSON.stringify(r.erreurs, null, 2)}`);
  }
});

test('un style existe pour chaque pays de départ, avec sa palette', () => {
  for (const p of chargerPays()) {
    const s = chargerStyleNation(p.code);
    assert.ok(s, `style manquant pour ${p.code}`);
    assert.equal(s.nom, p.nom);
    // Le style reprend la palette de la fiche pays et lui ajoute ses accents.
    assert.equal(s.palette.main, p.palette.main, p.code);
    assert.equal(s.palette.dark, p.palette.dark, p.code);
    assert.equal(s.palette.light, p.palette.light, p.code);
    assert.ok(s.palette.accents.length >= 1, p.code);
  }
});

test('chaque nation a un motif daltonien distinct', () => {
  const motifs = nations.map((s) => s.motifDaltonien);
  assert.equal(new Set(motifs).size, motifs.length, `motifs en double : ${motifs.join(', ')}`);
});

test('chaque nation retient un gabarit pour les dix unités de base', () => {
  const unites = chargerUnites().filter((u) => u.statut === 'canon').map((u) => u.cle);
  for (const s of nations) {
    assert.deepEqual(Object.keys(s.gabarits).sort(), [...unites].sort(), s.code);
    for (const u of unites) assert.ok(['a', 'b', 'c'].includes(gabaritDe(s, u)), `${s.code} ${u}`);
  }
  // Une unité homologuée demain n'a pas de gabarit : elle prend le gabarit `a`
  // plutôt que de faire échouer une génération de commandes.
  assert.equal(gabaritDe(nations[0]!, 'drone_solaire'), 'a');
  for (const unite of chargerUnites().filter((u) => u.statut === 'homologuee')) {
    for (const nation of nations) assert.equal(gabaritDe(nation, unite.cle), nation.gabarits[unite.cle] ?? 'a');
  }
});

test('deux nations ne se ressemblent pas : ornements et matières diffèrent', () => {
  const signatures = nations.map((s) => `${[...s.matieres].sort().join()}|${[...s.ornements].sort().join()}`);
  assert.equal(new Set(signatures).size, signatures.length, 'deux nations partagent la même signature');
  for (const s of nations) {
    assert.ok(s.ornements.length >= 2 && s.ornements.length <= 4, s.code);
    assert.ok(s.matieres.length >= 3 && s.matieres.length <= 6, s.code);
  }
});

test('un style régional existe pour chacune des 18 régions', () => {
  for (const r of chargerRegions('fr')) {
    const s = chargerStyleRegion('fr', r.code);
    assert.ok(s, `style régional manquant pour ${r.code}`);
    assert.equal(s.nom, r.nom);
    assert.equal(s.paysCode, 'fr');
    assert.ok(s.elementsDecor.length >= 2, r.code);
  }
  assert.equal(chargerStyleRegion('fr', 'region_fr_atlantide'), null);
  assert.equal(chargerStylesRegions('jp').length, 0, 'le Japon attend ses régions');
});

test('la mécanique d’une carte suffit à retrouver son style régional', () => {
  // C'est le seul lien du rendu : une carte déclare sa mécanique, pas sa région.
  const bretagne = styleRegionParMecanique('meca_marees');
  assert.ok(bretagne);
  assert.equal(bretagne.code, 'region_fr_bretagne');
  assert.equal(bretagne.toits.matiere, 'ardoise');

  const provence = styleRegionParMecanique('meca_mistral');
  assert.ok(provence);
  assert.equal(provence.toits.matiere, 'tuile');

  // Une carte sans mécanique n'a pas de style régional, et ce n'est pas une erreur.
  assert.equal(styleRegionParMecanique(null), null);
  assert.equal(styleRegionParMecanique('meca_inconnue'), null);
});

test('un style refusé l’est avec un chemin lisible', () => {
  const s = nations[0]!;
  assert.equal(validerStyleNation({ ...s, motifDaltonien: 'arc_en_ciel' }).ok, false);
  assert.equal(validerStyleNation({ ...s, ornements: [] }).ok, false, 'deux ornements au moins');
  assert.equal(
    validerStyleNation({ ...s, ornements: ['antenne', 'fanion', 'filet', 'tapis', 'cloche'] }).ok,
    false,
    'quatre ornements au plus',
  );
  assert.equal(validerStyleNation({ ...s, matieres: ['adamantium'] }).ok, false);
  const r = validerStyleNation({ ...s, gabarits: { char_leger: 'd' } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erreurs.some((e) => e.chemin === 'gabarits.char_leger'));

  const rg = validerStyleRegion({ ...regions[0]!, toits: { forme: 'pagode', matiere: 'ardoise', couleur: '#000000' } });
  assert.equal(rg.ok, false);
  if (!rg.ok) assert.ok(rg.erreurs.some((e) => e.chemin === 'toits.forme'));
});
