// Les illustrations de réplique au schéma : la liste est **fermée**, une clé
// inconnue est refusée à la validation, et chaque clé a son nom traduit.
//
// Ce fichier tient la promesse faite dans `types.ts` : une illustration se
// déclare en trois endroits — la liste, le dessin, la chaîne — et rien ne doit
// pouvoir n'en avoir que deux.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLES_ILLUSTRATION } from '../../src/schemas/types';
import { validerScenario } from '../../src/schemas/valider';
import { SOURCE_FR } from '../../src/i18n/source';
import { chargerCatalogue } from '../../src/engine/catalogue';
import { scenarioBretagne } from './exemples';

/** Le scénario d'exemple, dont la première réplique montre ce qu'on lui donne. */
function avecIllustration(illustration: unknown): unknown {
  const [premiere, ...suite] = scenarioBretagne.dialogueOuverture;
  return {
    ...scenarioBretagne,
    dialogueOuverture: [{ ...premiere, illustration }, ...suite],
  };
}

test('une réplique peut montrer une vignette de la liste, avec ou sans légende', () => {
  for (const illustration of [
    { cle: 'case_verte' },
    { cle: 'unite_char_leger', legende: 'Le char que Tomas vous prête' },
  ]) {
    const r = validerScenario(avecIllustration(illustration));
    assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs, null, 2));
  }
});

test('une clé d’illustration inconnue est refusée, et le chemin de la faute le dit', () => {
  for (const illustration of [
    { cle: 'tank_volant' },
    { cle: 'unite_cuirasse' },
    { cle: 'CASE_VERTE' },
    { cle: 42 },
    {},
  ]) {
    const r = validerScenario(avecIllustration(illustration));
    assert.equal(r.ok, false, `acceptée à tort : ${JSON.stringify(illustration)}`);
    if (r.ok) continue;
    assert.ok(
      r.erreurs.some((e) => e.chemin.includes('illustration')),
      `la faute ne cite pas l’illustration : ${JSON.stringify(r.erreurs)}`,
    );
  }
});

test('une illustration mal formée ne passe pas non plus', () => {
  for (const illustration of [
    'case_verte',
    { cle: 'case_verte', legende: 42 },
    { cle: 'case_verte', couleur: 'vert' },
    // Une légende est une phrase sous une image, pas un second paragraphe.
    { cle: 'case_verte', legende: 'x'.repeat(81) },
  ]) {
    const r = validerScenario(avecIllustration(illustration));
    assert.equal(r.ok, false, `acceptée à tort : ${JSON.stringify(illustration)}`);
  }
});

test('chaque clé de la liste a son nom accessible dans les chaînes', () => {
  for (const cle of CLES_ILLUSTRATION) {
    const texte = SOURCE_FR[`illustration.${cle}`];
    assert.ok(texte !== undefined, `illustration.${cle} manque à interface.fr.json`);
    assert.ok((texte ?? '').trim().length > 2, `illustration.${cle} est vide`);
  }
});

test('le nom d’une figurine est celui du canon, jamais un second nom', () => {
  // La leçon des chaînes de pouvoirs : la chaîne se réaligne sur le contenu,
  // jamais l'inverse. Si `unites.json` renomme une unité, c'est ici que ça rougit.
  const catalogue = chargerCatalogue(0);
  for (const cle of ['infanterie', 'meca', 'genie', 'char_leger', 'artillerie', 'transport']) {
    const type = catalogue.unites[cle];
    assert.ok(type, `${cle} absente du catalogue 6`);
    assert.equal(
      SOURCE_FR[`illustration.unite_${cle}`], type.nom,
      `illustration.unite_${cle} ne dit pas le nom du canon`,
    );
  }
});
