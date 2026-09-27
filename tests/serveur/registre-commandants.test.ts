import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personnagesCanon, personnagesPourActe } from '../../src/serveur/personnages';
import { listerProfilsCommandants, lireProfilCommandant } from '../../src/content/profils-commandants';
import { CALENDRIER_DISPARITIONS } from '../../src/app/campagne/disparitions';
import { t } from '../../src/i18n';

/**
 * Les rôles qui n'ont **pas** de pouvoir de commandant : les civils d'Atlas, et
 * — depuis le 26 septembre 2026 (`doc/refonte/opus1-hors-serie.md` §5 point 3) —
 * les **adjointes** qui reprennent le banc d'une délégation dont le chef a
 * disparu. Une adjointe joue les couleurs et le catalogue de sa nation, pas un
 * kit : lui donner un profil de capacités la rendrait prenable au vestiaire et
 * recrutable en co-commandant, ce qu'elle n'est pas.
 */
const SANS_POUVOIR = new Set(['civil', 'adjointe']);

test('le registre relie chaque commandant à ses capacités traduites, révisions 3 et 4', () => {
  const personnages = personnagesCanon();
  // 37 jusqu'au 26 septembre 2026, et les quatre adjointes des disparitions.
  assert.equal(personnages.length, 41);
  for (const revision of [3, 4] as const) {
    const profils = listerProfilsCommandants(revision);
    assert.equal(profils.length, 34);
    for (const p of personnages) {
      const profil = lireProfilCommandant(p.cle, revision);
      if (SANS_POUVOIR.has(p.role ?? '')) { assert.equal(profil, null, p.cle); continue; }
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

test('les quatre adjointes reprennent chacune le banc d’un disparu, sans pouvoir et sans rien annoncer', () => {
  const personnages = personnagesCanon();
  const adjointes = personnages.filter((p) => p.role === 'adjointe');
  assert.deepEqual(adjointes.map((p) => p.cle).sort(), ['anju_basnet', 'dafni_rallis', 'lea_wagener', 'nadia_berrada']);
  const parCle = new Map(personnages.map((p) => [p.cle, p]));
  // Chaque banc nommé du calendrier est une adjointe de la nation du disparu,
  // liée à lui : c'est elle qui joue ses couleurs.
  const bancs = new Set<string>();
  for (const d of CALENDRIER_DISPARITIONS) {
    for (const b of d.branches) {
      if (b.banc === null) continue;
      const a = parCle.get(b.banc);
      assert.ok(a, `${b.banc} absente du registre`);
      assert.equal(a.role, 'adjointe', b.banc);
      assert.equal(a.paysCode, d.paysCode, `${b.banc} ne joue pas les couleurs de ${d.commandantCle}`);
      assert.ok(a.liens.includes(d.commandantCle), `${b.banc} n’est pas liée à ${d.commandantCle}`);
      bancs.add(b.banc);
    }
  }
  assert.deepEqual([...bancs].sort(), adjointes.map((p) => p.cle).sort(), 'aucune adjointe sans banc à reprendre');
  // La clé d'une adjointe n'a pas la forme d'un code de commandant : elle ne
  // peut entrer ni au vestiaire ni dans une confiance, qui exigent `cmd_…`.
  for (const a of adjointes) assert.ok(!a.cle.startsWith('cmd_'), a.cle);
  // Leurs faits se lisent dès l'acte où ils sont révélés, et aucun ne dit la
  // disparition qu'elles suivront : une mort n'est écrite qu'en note auteur, chez
  // le disparu, et seulement là (`opus1-hors-serie.md` §4).
  for (const a of adjointes) {
    assert.ok(a.historique.length >= 2, `${a.cle} : deux faits au moins`);
    for (const f of a.historique) {
      assert.equal(f.confidentialite, undefined, f.cle);
      assert.ok(!/\bmort|meurt|mourir|disparu|disparition|décès|deuil|reprend le banc/i.test(f.fait), `${f.cle} annonce ce qui vient`);
    }
  }
  for (const acte of [1, 2, 3]) {
    const publie = JSON.stringify(personnagesPourActe(acte).personnages.filter((p) => adjointes.some((a) => a.cle === p.cle)));
    assert.ok(!/\bmort|meurt|disparition/i.test(publie), `acte ${acte} : une adjointe annonce une disparition`);
  }
});
