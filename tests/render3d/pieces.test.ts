// Le composeur de placeholders 3D. La règle du brief est absolue : **aucune
// unité n'est modélisée par son nom**. Ce test l'exerce sur les dix unités canon
// du catalogue, puis sur des silhouettes construites à la main, et vérifie que
// chaque brique déclarée se retrouve bien dans la liste de pièces.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue } from '../../src/engine/index';
import {
  composerSilhouette, echelleTaille, hauteurSilhouette, nomsPieces,
} from '../../src/render3d/pieces';
import {
  BASES_SILHOUETTE, CORPS_SILHOUETTE, MODULES_SILHOUETTE, TAILLES_SILHOUETTE,
  type Silhouette,
} from '../../src/schemas/index';

const CAT = chargerCatalogue();

function silhouette(p: Partial<Silhouette>): Silhouette {
  return { base: 'chenilles', corps: 'bloc', modules: [], taille: 2, ...p };
}

test('un char est une base, un corps et sa tourelle, dans cet ordre', () => {
  const noms = nomsPieces(silhouette({ base: 'chenilles', corps: 'bloc', modules: ['tourelle'] }));
  assert.deepEqual(noms, [
    'chenille_gauche', 'chenille_droite', 'plancher',
    'corps_bloc', 'capot',
    'tourelle', 'canon',
  ]);
});

test('l’artillerie pose son canon long sur un plateau à chenilles', () => {
  const noms = nomsPieces(silhouette({ base: 'chenilles', corps: 'plateau', modules: ['canon_long'] }));
  assert.deepEqual(noms, [
    'chenille_gauche', 'chenille_droite', 'plancher',
    'corps_plateau', 'cabine', 'pare_brise',
    'berceau', 'canon_long',
  ]);
});

test('l’infanterie est un groupe de trois figurines, jamais un bloc', () => {
  const noms = nomsPieces(silhouette({ base: 'pattes', corps: 'capsule', modules: [], taille: 1 }));
  assert.deepEqual(noms, [
    'figurine_1_jambes', 'figurine_1_buste', 'figurine_1_casque',
    'figurine_2_jambes', 'figurine_2_buste', 'figurine_2_casque',
    'figurine_3_jambes', 'figurine_3_buste', 'figurine_3_casque',
  ]);
  // Les trois figurines occupent trois places différentes dans la case.
  const places = composerSilhouette(silhouette({ base: 'pattes', corps: 'capsule' }))
    .filter((p) => p.nom.endsWith('_buste'))
    .map((p) => `${p.position[0]},${p.position[2]}`);
  assert.equal(new Set(places).size, 3);
  // Et une infanterie mécanisée porte quand même son module.
  const meca = nomsPieces(silhouette({ base: 'pattes', corps: 'capsule', modules: ['lance_roquettes'] }));
  assert.ok(meca.includes('rampe'), 'le module suit la troupe');
});

test('chaque base, chaque corps et chaque module produit des pièces', () => {
  for (const base of BASES_SILHOUETTE) {
    const noms = nomsPieces(silhouette({ base }));
    assert.ok(noms.length > 0, `la base ${base} ne produit rien`);
  }
  for (const corps of CORPS_SILHOUETTE) {
    const noms = nomsPieces(silhouette({ corps }));
    assert.ok(noms.length >= 3, `le corps ${corps} ne produit rien`);
  }
  for (const greffon of MODULES_SILHOUETTE) {
    const avec = nomsPieces(silhouette({ modules: [greffon] }));
    const sans = nomsPieces(silhouette({ modules: [] }));
    assert.ok(avec.length > sans.length, `le module ${greffon} ne produit rien`);
  }
});

test('les pièces sont nommées, dimensionnées et bornées à la case', () => {
  for (const cle of CAT.cles) {
    const type = CAT.unites[cle];
    if (!type) continue;
    const pieces = composerSilhouette(type.silhouette);
    assert.ok(pieces.length >= 3, `${cle} : trop peu de pièces`);
    const noms = new Set(pieces.map((p) => p.nom));
    assert.equal(noms.size, pieces.length, `${cle} : deux pièces portent le même nom`);
    const e = echelleTaille(type.silhouette.taille);
    for (const p of pieces) {
      for (const d of p.taille) assert.ok(d > 0, `${cle}/${p.nom} : dimension nulle`);
      assert.ok(p.position[1] >= -0.05, `${cle}/${p.nom} : pièce sous le sol`);
      // Rien ne dépasse d'une case : les unités voisines ne se chevauchent pas.
      const demiLargeur = (Math.abs(p.position[2]) + Math.max(...p.taille) / 2) * e;
      assert.ok(demiLargeur <= 0.62, `${cle}/${p.nom} : déborde de sa case (${demiLargeur})`);
    }
    const haut = hauteurSilhouette(type.silhouette);
    assert.ok(haut > 0.15 && haut < 1, `${cle} : hauteur invraisemblable (${haut})`);
  }
});

test('la taille de silhouette échelonne le modèle sans l’inverser', () => {
  const echelles = TAILLES_SILHOUETTE.map((t) => echelleTaille(t));
  for (let i = 1; i < echelles.length; i += 1) {
    const avant = echelles[i - 1] ?? 0;
    const apres = echelles[i] ?? 0;
    assert.ok(apres > avant, 'une taille supérieure doit donner un modèle plus grand');
  }
  assert.equal(echelleTaille(2), 1);
});
