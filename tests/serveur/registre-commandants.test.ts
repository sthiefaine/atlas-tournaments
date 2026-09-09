import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personnagesCanon } from '../../src/serveur/personnages';
import { listerProfilsCommandants, lireProfilCommandant } from '../../src/content/profils-commandants';
import { t } from '../../src/i18n';

test('le registre relie chaque commandant à ses deux capacités traduites', () => {
  const personnages = personnagesCanon();
  const profils = listerProfilsCommandants();
  assert.equal(personnages.length, 37);
  assert.equal(profils.length, 34);
  for (const p of personnages) {
    const profil = lireProfilCommandant(p.cle);
    if (p.role === 'civil') { assert.equal(profil, null); continue; }
    assert.ok(profil, p.cle);
    assert.equal(profil.nom, p.nom);
    assert.equal(t('fr', `commandant.${p.cle}.nom`), profil.nom);
    assert.equal(t('fr', `commandant.${p.cle}.pouvoir_v3`), profil.pouvoir.nom);
    assert.equal(t('fr', `commandant.${p.cle}.super_v3`), profil.superPouvoir.nom);
  }
});
