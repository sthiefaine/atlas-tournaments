// Le dépôt écrit dans un dossier servi publiquement : ce qu'il accepte est la
// seule chose qui le protège. Il ne filtre pas des chemins — il **reconnaît**
// des noms, et n'écrit que ceux que la fiche impose.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { genererSpecs, nomModele, nomTexture } from '../../src/assets/index';
import { classerDepot, controlerDepot, nomsAttendus } from '../../src/serveur/depot-modeles';

/** Une fiche d'unité, celle qui porte le plus de contraintes. */
function fiche() {
  const spec = genererSpecs().find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec);
  return spec;
}

test('les noms attendus sont ceux de la fiche, modèles et textures', () => {
  const spec = fiche();
  const noms = nomsAttendus(spec);
  for (const lod of spec.verification.lodRequis) {
    assert.ok(noms.includes(nomModele(spec, lod)), `le modèle du niveau ${lod}`);
  }
  for (const t of spec.textures) {
    assert.ok(noms.includes(nomTexture(spec, t.canal)), `la carte ${t.canal}`);
  }
});

test('un nom que la fiche n’attend pas n’est jamais retenu', () => {
  const spec = fiche();
  const { acceptes, inconnus } = classerDepot(spec, [
    nomModele(spec, 0),
    'final_v3.glb',
    '../../.env',
    '../../../etc/passwd',
    'unite_char_leger_base_lod0.glb.exe',
  ]);
  assert.deepEqual(acceptes, [nomModele(spec, 0)], 'seul le nom attendu passe');
  assert.equal(inconnus.length, 4, 'les quatre autres sont rendus, pour qu’on voie pourquoi');
});

test('un chemin livré est réduit à son nom de base', () => {
  // Un navigateur peut livrer « dossier/fichier.glb » : c'est le nom qui décide,
  // et il est comparé sans son chemin — jamais rejoint à un dossier.
  const spec = fiche();
  const { acceptes } = classerDepot(spec, [`livraison/${nomModele(spec, 0)}`]);
  assert.deepEqual(acceptes, [nomModele(spec, 0)]);
});

test('les niveaux de détail manquants sont nommés, et le lot est refusé', () => {
  const spec = fiche();
  const { lodManquants } = classerDepot(spec, []);
  assert.deepEqual(lodManquants, [0]);

  const verdict = controlerDepot(spec, []);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.motifs.some((m) => (m.detail ?? '').includes('niveau de détail manquant')));
});

test('un lot vide est refusé, et un GLB illisible aussi', () => {
  const spec = fiche();
  assert.equal(controlerDepot(spec, []).ok, false, 'rien à déposer n’est pas un succès');

  const bidon = spec.verification.lodRequis.map((lod) => ({
    nom: nomModele(spec, lod),
    octets: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
  }));
  const verdict = controlerDepot(spec, bidon);
  assert.equal(verdict.ok, false, 'huit octets ne sont pas un glTF');
  assert.ok(verdict.motifs.length > 0, 'et le refus est motivé');
  // Chaque motif dit de quel fichier il parle : sans cela, trois niveaux
  // refusés rendent trois motifs qu'on ne sait pas attribuer.
  assert.ok(verdict.motifs.every((m) => /\.(glb|png)/.test(m.detail ?? '')), 'chaque motif nomme son fichier');
});
