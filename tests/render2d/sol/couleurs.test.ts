// Les couleurs du sol suivent le biome et l'ambiance : l'automne roussit,
// l'hiver et le biome neige enneigent, la pluie assombrit — et la nuit n'est
// pas là, elle appartient à l'étalonnage du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  APPARENCES_VOIE, couleursSol, DISPOSITION, formeVoie, melangerCouleurs, MOTIFS_VOIE, neigeAuSol,
} from '../../../src/render2d/sol/couleurs';
import { MATIERES } from '../../../src/render2d/sol/terrains';
import { BIOMES } from '../../../src/schemas/types';

/** Une couleur de matière : `quelle` 0 sombre, 1 clair, 2 accent. */
function matiere(c: Float32Array, nom: (typeof MATIERES)[number], quelle: number): [number, number, number] {
  const i = DISPOSITION.matieres + MATIERES.indexOf(nom) * 9 + quelle * 3;
  return [c[i]!, c[i + 1]!, c[i + 2]!];
}

test('la disposition tient dans le tableau, sans trou ni chevauchement', () => {
  const c = couleursSol('plaine', 'printemps', 'clair');
  assert.equal(c.length, DISPOSITION.total);
  assert.equal(DISPOSITION.neige - DISPOSITION.matieres, MATIERES.length * 9);
  assert.equal(DISPOSITION.eau - DISPOSITION.neige, 6);
  assert.equal(DISPOSITION.feuillage - DISPOSITION.eau, 12);
  assert.equal(DISPOSITION.voie - DISPOSITION.feuillage, 12);
  assert.equal(DISPOSITION.climat - DISPOSITION.voie, 15);
  assert.equal(DISPOSITION.total - DISPOSITION.climat, 4);
  for (const v of c) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v));
});

test('l’automne roussit l’herbe, l’hiver la pâlit', () => {
  const printemps = matiere(couleursSol('plaine', 'printemps', 'clair'), 'herbe', 1);
  const automne = matiere(couleursSol('plaine', 'automne', 'clair'), 'herbe', 1);
  const hiver = matiere(couleursSol('plaine', 'hiver', 'clair'), 'herbe', 1);
  assert.ok(automne[0] / automne[1] > printemps[0] / printemps[1], 'plus de rouge par rapport au vert');
  assert.ok(hiver[2] > printemps[2], 'plus de bleu, plus pâle');
  // L'accent de l'herbe dit la saison : des feuilles tombées, pas des fleurs.
  const feuilles = matiere(couleursSol('plaine', 'automne', 'clair'), 'herbe', 2);
  const fleurs = matiere(couleursSol('plaine', 'printemps', 'clair'), 'herbe', 2);
  assert.notDeepEqual(feuilles, fleurs);
  assert.ok(feuilles[0] > feuilles[2] * 2, 'les feuilles d’automne sont rousses');
});

test('le biome se reconnaît avant tout décor', () => {
  const plaine = matiere(couleursSol('plaine', 'ete', 'clair'), 'herbe', 1);
  const desert = matiere(couleursSol('desert', 'ete', 'clair'), 'herbe', 1);
  assert.ok(desert[0] > plaine[0] && desert[1] - desert[0] < plaine[1] - plaine[0], 'l’herbe du désert est sèche');
  const volcan = matiere(couleursSol('volcanique', 'ete', 'clair'), 'sable', 1);
  assert.ok(volcan[0] < 0.7, 'le sable volcanique est sombre');
});

test('la neige : la météo en pose, l’hiver en laisse, le biome neige en garde', () => {
  assert.equal(neigeAuSol('plaine', 'ete', 'clair'), 0);
  assert.equal(neigeAuSol('plaine', 'hiver', 'clair'), 0.55);
  assert.equal(neigeAuSol('neige', 'ete', 'clair'), 0.78);
  assert.equal(neigeAuSol('plaine', 'printemps', 'neige'), 1);
  const c = couleursSol('neige', 'ete', 'clair');
  assert.equal(c[DISPOSITION.climat], Math.fround(0.78));
});

test('la pluie mouille et assombrit, la tempête agite l’eau', () => {
  const clair = couleursSol('plaine', 'ete', 'clair');
  const pluie = couleursSol('plaine', 'ete', 'pluie');
  const tempete = couleursSol('plaine', 'ete', 'tempete');
  assert.equal(clair[DISPOSITION.climat + 1], 0);
  assert.ok(pluie[DISPOSITION.climat + 1]! > 0.5);
  const lum = (c: [number, number, number]): number => c[0] + c[1] + c[2];
  assert.ok(lum(matiere(pluie, 'herbe', 1)) < lum(matiere(clair, 'herbe', 1)));
  assert.ok(tempete[DISPOSITION.climat + 2]! > clair[DISPOSITION.climat + 2]!, 'plus d’agitation');
  assert.ok(tempete[DISPOSITION.climat + 3]! > clair[DISPOSITION.climat + 3]!, 'plus d’écume');
});

test('les couleurs sont mémorisées et ne dépendent pas de la phase du jour', () => {
  assert.equal(couleursSol('foret', 'ete', 'clair'), couleursSol('foret', 'ete', 'clair'));
  // `couleursSol` ne prend pas la phase : la nuit s'applique par l'étalonnage,
  // sur le sol et les images cuites ensemble.
  assert.equal(couleursSol.length, 3);
});

test('le mélange de deux ambiances rejoint ses deux bouts, sans allouer', () => {
  const a = couleursSol('plaine', 'ete', 'clair');
  const b = couleursSol('plaine', 'ete', 'pluie');
  const sortie = new Float32Array(DISPOSITION.total);
  melangerCouleurs(a, b, 0, sortie);
  assert.deepEqual([...sortie], [...a]);
  melangerCouleurs(a, b, 1, sortie);
  assert.deepEqual([...sortie], [...b]);
  melangerCouleurs(a, b, 0.5, sortie);
  const i = DISPOSITION.climat + 1;
  assert.ok(Math.abs(sortie[i]! - (a[i]! + b[i]!) / 2) < 1e-6);
});

test('chaque biome a sa voie, et son motif est un code que le nuanceur connaît', () => {
  for (const biome of BIOMES) {
    const ap = APPARENCES_VOIE[biome];
    const { forme, style } = formeVoie(biome);
    assert.equal(forme[0], Math.fround(ap.demiLargeur));
    assert.ok(ap.demiLargeur + ap.largeurAccotement < 0.45, `${biome} : la voie tient dans sa case`);
    assert.equal(MOTIFS_VOIE[style[0]!], ap.motif);
  }
  assert.equal(APPARENCES_VOIE.montagne.motif, 'paves');
  assert.equal(APPARENCES_VOIE.archipel.motif, 'planches');
});
