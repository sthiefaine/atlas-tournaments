// L'écran de chargement d'une mission est **rendu par le serveur** : c'est le
// premier balisage que le joueur voit, avant même que le moteur ne descende. Une
// clé manquante s'y verrait comme un trou, et rien ne l'attraperait — la page
// n'a pas de test de fumée. On vérifie donc ici que chaque étape déclarée par
// `etapes-chargement.ts` a bien un libellé français, et qu'il tient sur la
// ligne : la liste lue est **celle que l'écran lit**, pas une copie.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLE_ETAPE, CLE_LISTE_ETAPES, ETAPES_CHARGEMENT,
} from '../../src/app/jeu/[scenario]/etapes-chargement';
import { chaineSource, SOURCE_FR } from '../../src/i18n/source';
import { t } from '../../src/i18n/index';

test('chaque étape de chargement a un libellé français, et il tient sur la ligne', () => {
  for (const etape of ETAPES_CHARGEMENT) {
    const cle = CLE_ETAPE[etape];
    const texte = SOURCE_FR[cle];
    assert.ok(texte, `l’étape « ${etape} » n’a pas de chaîne sous ${cle}`);
    const maxi = chaineSource(cle)?.longueurMax;
    if (maxi !== null && maxi !== undefined) {
      assert.ok(texte.length <= maxi, `${cle} dépasse sa longueur maximale (${texte.length} > ${maxi})`);
    }
    // `t()` est ce que l'écran appelle : une clé absente rendrait vide, et un
    // écran de chargement muet ne dit rien de ce qu'il attend.
    assert.notEqual(t('fr', cle), '');
  }
  assert.notEqual(t('fr', CLE_LISTE_ETAPES), '');
});

test('les quatre étapes sont dans l’ordre où elles surviennent, sans doublon', () => {
  // L'écran coche les étapes précédentes en comparant les rangs : un doublon ou
  // un ordre inversé cocherait une étape qui n'a pas eu lieu.
  assert.deepEqual([...ETAPES_CHARGEMENT], ['modules', 'plateau', 'moteur', 'image']);
  assert.equal(new Set(ETAPES_CHARGEMENT).size, ETAPES_CHARGEMENT.length);
});
