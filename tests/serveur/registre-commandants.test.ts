import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personnagesCanon } from '../../src/serveur/personnages';
import { listerProfilsCommandants, lireProfilCommandant } from '../../src/content/profils-commandants';
import { t } from '../../src/i18n';

test('le registre relie chaque commandant à ses capacités traduites, révisions 3 et 4', () => {
  const personnages = personnagesCanon();
  assert.equal(personnages.length, 37);
  for (const revision of [3, 4] as const) {
    const profils = listerProfilsCommandants(revision);
    assert.equal(profils.length, 34);
    for (const p of personnages) {
      const profil = lireProfilCommandant(p.cle, revision);
      if (p.role === 'civil') { assert.equal(profil, null); continue; }
      assert.ok(profil, p.cle);
      assert.equal(profil.nom, p.nom);
      assert.equal(t('fr', `commandant.${p.cle}.nom`), profil.nom);
      // Les noms des pouvoirs sont des chaînes d'interface, suffixées par la
      // révision : la 3 gelée garde les siennes, la 4 a les siennes.
      assert.equal(t('fr', `commandant.${p.cle}.pouvoir_v${revision}`), profil.pouvoir.nom, `${p.cle} pouvoir_v${revision}`);
      assert.equal(t('fr', `commandant.${p.cle}.super_v${revision}`), profil.superPouvoir.nom, `${p.cle} super_v${revision}`);
    }
  }
});
