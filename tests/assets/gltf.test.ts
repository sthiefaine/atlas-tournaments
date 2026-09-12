/**
 * Le contrôle d'un GLB livré par le générateur externe.
 *
 * Un GLB minimal mais valide est fabriqué en mémoire (`glb.ts`), puis cassé
 * volontairement d'une manière à la fois, pour vérifier que chaque défaut ressort
 * avec **son** code : `asset_format`, `asset_echelle`, `asset_budget`,
 * `asset_masque_absent`, `asset_animation_absente`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererSpecs, lireGlb, mesurerGltf, validerGlb, type AssetSpec } from '../../src/assets/index';
import { binTriangle, construireGlb, documentTest } from './glb';

const specs = genererSpecs();

/** La spécification de référence des tests : une unité, donc tous les contrôles. */
function specChar(): AssetSpec {
  const spec = specs.find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec, 'la géométrie de base du char léger doit exister');
  return spec;
}

/** Le GLB conforme, construit depuis les dimensions de la spécification. */
function glbConforme(): Uint8Array {
  const spec = specChar();
  return construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
    binTriangle(spec.echelle.x.cible, spec.echelle.y.cible, spec.echelle.z.cible),
  );
}

/** Les codes rendus par un verdict, sans les détails. */
function codes(octets: Uint8Array, spec = specChar()): string[] {
  return validerGlb(octets, spec).motifs.map((m) => m.code);
}

test('un GLB fabriqué en mémoire se relit', () => {
  const lecture = lireGlb(glbConforme());
  assert.equal(lecture.ok, true);
  if (!lecture.ok) return;
  assert.equal(lecture.document.asset?.version, '2.0');
  assert.equal(lecture.octetsBin, 36);
  const mesure = mesurerGltf(lecture.document);
  assert.equal(mesure.triangles, 1);
  assert.ok(mesure.boite);
});

test('un GLB conforme est accepté sans motif', () => {
  const verdict = validerGlb(glbConforme(), specChar());
  assert.deepEqual(verdict.motifs, [], JSON.stringify(verdict.motifs, null, 2));
  assert.equal(verdict.ok, true);
});

test('un conteneur cassé est refusé en asset_format', () => {
  const spec = specChar();
  assert.deepEqual(codes(new Uint8Array(8)), ['asset_format']);
  assert.deepEqual(codes(construireGlb(documentTest(), undefined, { magie: 0x11111111 })), ['asset_format']);
  assert.deepEqual(codes(construireGlb(documentTest(), undefined, { versionConteneur: 1 })), ['asset_format']);
  assert.deepEqual(codes(construireGlb(documentTest(), undefined, { longueurFausse: 42 })), ['asset_format']);
  // Version du document glTF, distincte de celle du conteneur.
  const vieux = construireGlb(documentTest({ version: '1.0' }), binTriangle(0.62, 0.5, 0.85));
  assert.deepEqual(codes(vieux, spec), ['asset_format']);
});

test('un nœud ou un matériau attendu absent est un défaut de format', () => {
  const spec = specChar();
  const sansTourelle = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: spec.format.noeuds.filter((n) => n !== 'module_tourelle'),
      materiaux: [...spec.format.materiauxAttendus],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
    binTriangle(spec.echelle.x.cible, spec.echelle.y.cible, spec.echelle.z.cible),
  );
  const verdict = validerGlb(sansTourelle, spec);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.motifs.map((m) => m.code), ['asset_format']);
  assert.match(String(verdict.motifs[0]?.detail), /module_tourelle/);

  const sansMateriau = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: [...spec.format.noeuds],
      materiaux: ['mat_corps'],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
    binTriangle(spec.echelle.x.cible, spec.echelle.y.cible, spec.echelle.z.cible),
  );
  const v2 = validerGlb(sansMateriau, spec);
  assert.deepEqual(v2.motifs.map((m) => m.code), ['asset_format']);
  assert.match(String(v2.motifs[0]?.detail), /mat_details/);
});

test('un modèle hors d’échelle est refusé en asset_echelle', () => {
  const spec = specChar();
  const doubleTaille = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible * 2, y: spec.echelle.y.cible * 2, z: spec.echelle.z.cible * 2 },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
  );
  const verdict = validerGlb(doubleTaille, spec);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.motifs.every((m) => m.code === 'asset_echelle'));
  assert.equal(verdict.motifs.length, 3, 'les trois axes doivent être signalés');
  assert.ok((verdict.motifs[0]?.mesure?.['mesure'] ?? 0) > (verdict.motifs[0]?.mesure?.['cible'] ?? 0));
});

test('un pivot qui ne repose pas au sol est refusé en asset_echelle', () => {
  const spec = specChar();
  const flottant = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      decalage: { x: 0, y: 0.4, z: 0 },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
  );
  const verdict = validerGlb(flottant, spec);
  assert.deepEqual(verdict.motifs.map((m) => m.code), ['asset_echelle']);
  assert.match(String(verdict.motifs[0]?.detail), /sol/);
});

test('un modèle trop lourd est refusé en asset_budget, par niveau de détail', () => {
  const spec = specChar();
  const gros = (sommets: number): Uint8Array => construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      sommets,
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
  );
  const trop = validerGlb(gros(30_000), spec);
  assert.deepEqual(trop.motifs.map((m) => m.code), ['asset_budget']);
  assert.equal(trop.motifs[0]?.mesure?.['triangles'], 10_000);
  assert.equal(trop.motifs[0]?.mesure?.['budget'], spec.budget.lod0);

  // Un fichier sans géométrie est un fichier vide, pas un fichier léger.
  const vide = construireGlb({ asset: { version: '2.0' } });
  assert.ok(validerGlb(vide, spec).motifs.some((m) => m.code === 'asset_budget'));
});

test('un masque d’équipe absent est refusé en asset_masque_absent', () => {
  const spec = specChar();
  const sansMasque = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      images: ['unite_char_leger_base_albedo'],
      animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
  );
  const verdict = validerGlb(sansMasque, spec);
  assert.deepEqual(verdict.motifs.map((m) => m.code), ['asset_masque_absent']);
});

test('un clip obligatoire absent est refusé en asset_animation_absente', () => {
  const spec = specChar();
  const sansTir = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      animations: ['repos', 'deplacement', 'touche', 'hors_jeu'],
    }),
  );
  const verdict = validerGlb(sansTir, spec);
  assert.deepEqual(verdict.motifs.map((m) => m.code), ['asset_animation_absente']);
  assert.match(String(verdict.motifs[0]?.detail), /tir/);
});

test('un terrain ne se voit reprocher ni masque ni animation', () => {
  const spec = specs.find((s) => s.id === 'terrain_plaine');
  assert.ok(spec);
  const plaque = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      images: [],
      animations: [],
    }),
    binTriangle(1, 0.06, 1),
  );
  const verdict = validerGlb(plaque, spec, { fichiersLivres: spec.textures.map((t) => `${spec.id}_${t.canal}.png`) });
  assert.deepEqual(verdict.motifs, [], JSON.stringify(verdict.motifs, null, 2));
});

test('un défaut n’en cache pas un autre : les motifs s’accumulent', () => {
  const spec = specChar();
  const cumule = construireGlb(
    documentTest({
      taille: { x: spec.echelle.x.cible * 3, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
      sommets: 30_000,
      noeuds: [...spec.format.noeuds],
      materiaux: [...spec.format.materiauxAttendus],
      images: [],
      animations: ['repos'],
    }),
  );
  const verdict = validerGlb(cumule, spec);
  const trouves = new Set(verdict.motifs.map((m) => m.code));
  assert.ok(trouves.has('asset_echelle'));
  assert.ok(trouves.has('asset_budget'));
  assert.ok(trouves.has('asset_masque_absent'));
  assert.ok(trouves.has('asset_animation_absente'));
});

test('un kit national accepte ses textures dans le GLB ou livrées à côté', () => {
  const spec = specs.find((s) => s.id === 'kit_fr_char_leger');
  assert.ok(spec);
  const canaux = spec.textures.filter((t) => t.obligatoire).map((t) => t.canal);

  const monter = (images: string[], fichiers?: string[]): ReturnType<typeof validerGlb> => validerGlb(
    construireGlb(
      documentTest({
        taille: { x: spec.echelle.x.cible, y: spec.echelle.y.cible, z: spec.echelle.z.cible },
        noeuds: [...spec.format.noeuds],
        materiaux: [...spec.format.materiauxAttendus],
        images,
        animations: spec.animations.filter((a) => a.obligatoire).map((a) => a.nom),
      }),
      binTriangle(spec.echelle.x.cible, spec.echelle.y.cible, spec.echelle.z.cible),
    ),
    spec,
    fichiers ? { fichiersLivres: fichiers } : {},
  );

  // 1. Toutes les cartes référencées par le GLB : accepté.
  const dansGlb = monter(canaux.map((c) => `kit_fr_char_leger_${c}`));
  assert.deepEqual(dansGlb.motifs, [], JSON.stringify(dansGlb.motifs, null, 2));

  // 2. Aucune carte dans le GLB, toutes livrées à côté sous leur nom : accepté.
  const aCote = monter([], canaux.map((c) => `kit_fr_char_leger_${c}.png`));
  assert.deepEqual(aCote.motifs, [], JSON.stringify(aCote.motifs, null, 2));

  // 3. Une carte manque des deux côtés : refusée, et nommée.
  const sansRugosite = monter(
    canaux.filter((c) => c !== 'rugosite').map((c) => `kit_fr_char_leger_${c}`),
  );
  assert.deepEqual(sansRugosite.motifs.map((m) => m.code), ['asset_texture_absente']);
  assert.match(String(sansRugosite.motifs[0]?.detail), /rugosite/);

  // 4. Un nom de fichier hors gabarit ne compte pas : on ne saurait pas le charger.
  const malNomme = monter([], ['final_v3.png', 'kit_fr_char_leger_albedo.png']);
  assert.ok(malNomme.motifs.length >= 1);
  assert.ok(malNomme.motifs.every((m) => ['asset_texture_absente', 'asset_masque_absent'].includes(m.code)));

  // 5. Une variante saisonnière porte le même nom, suffixé : elle compte aussi.
  const enHiver = monter([], canaux.map((c) => `kit_fr_char_leger_${c}_hiver.png`));
  assert.deepEqual(enHiver.motifs, [], JSON.stringify(enHiver.motifs, null, 2));
});

test('les bornes du radar suivent la tourelle et ses parents (TRS et matrice)', () => {
  const document = {
    accessors: [{ min: [-1, 0, -1], max: [1, 1, 1], count: 3 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [
      { children: [1], translation: [0, 2, 0], scale: [2, 2, 2] },
      { children: [2], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
      { mesh: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1] },
    ],
  };
  const { boite, triangles } = mesurerGltf(document);
  assert.equal(triangles, 1);
  assert.ok(boite);
  [-2, 2, -2].forEach((v, i) => assert.ok(Math.abs(boite.min[i]! - v) < 1e-10));
  [0, 6, 2].forEach((v, i) => assert.ok(Math.abs(boite.max[i]! - v) < 1e-10));
});
