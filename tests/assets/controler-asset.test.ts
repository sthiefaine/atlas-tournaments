/**
 * La commande de contrôle d'un asset livré (`scripts/controler-asset.ts`).
 *
 * On ne versionne aucun binaire : les GLB sont fabriqués en mémoire par
 * `glb.ts`, écrits dans un dossier temporaire, et contrôlés contre une **vraie**
 * spécification du dépôt — celle du char léger, le pilote de `doc/16` §3.2.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afficherVerdict, executer, lodDuNom } from '../../scripts/controler-asset';
import { genererSpecs } from '../../src/assets/index';
import { binTriangle, construireGlb, documentTest } from './glb';

const racine = path.resolve(import.meta.dirname, '..', '..');
const cheminSpec = path.join(racine, 'assets', 'specs', 'unite_char_leger_base.json');
const cheminKit = path.join(racine, 'assets', 'specs', 'kit_fr_char_leger.json');
const dossier = mkdtempSync(path.join(os.tmpdir(), 'atlas-controle-'));

const spec = genererSpecs().find((s) => s.id === 'unite_char_leger_base');
assert.ok(spec, 'la géométrie de base du char léger doit exister');

/** Écrit un GLB conforme à la spécification, à un défaut près si on le demande. */
function ecrire(nom: string, defaut: Partial<Parameters<typeof documentTest>[0]> = {}): string {
  const chemin = path.join(dossier, nom);
  writeFileSync(chemin, construireGlb(
    documentTest({
      taille: { x: spec!.echelle.x.cible, y: spec!.echelle.y.cible, z: spec!.echelle.z.cible },
      noeuds: [...spec!.format.noeuds],
      materiaux: [...spec!.format.materiauxAttendus],
      animations: spec!.animations.filter((a) => a.obligatoire).map((a) => a.nom),
      ...defaut,
    }),
    binTriangle(spec!.echelle.x.cible, spec!.echelle.y.cible, spec!.echelle.z.cible),
  ));
  return chemin;
}

test('un GLB conforme est accepté, et la commande rend 0', () => {
  const glb = ecrire('unite_char_leger_base_lod0.glb');
  const r = executer(['--spec', cheminSpec, '--glb', glb]);
  assert.equal(r.code, 0, r.texte);
  assert.equal(r.verdict?.ok, true);
  assert.match(r.texte, /ACCEPTÉ/);
  assert.match(r.texte, /unite_char_leger_base/);
  assert.doesNotMatch(r.texte, /Nom     :/, 'un fichier bien nommé ne reçoit pas d’avertissement de nom');

  // `--json` rend le verdict brut, exactement la forme de `validerGlb`.
  const brut = executer(['--spec', cheminSpec, '--glb', glb, '--json']);
  assert.equal(brut.code, 0);
  assert.deepEqual(JSON.parse(brut.texte), { ok: true, motifs: [] });
});

test('un GLB refusé rend 1, et le motif est imprimé tel que le serveur le rendrait', () => {
  const glb = ecrire('unite_char_leger_base_lod0.glb', { animations: ['repos', 'deplacement', 'touche', 'hors_jeu'] });
  const r = executer(['--spec', cheminSpec, '--glb', glb]);
  assert.equal(r.code, 1);
  assert.equal(r.verdict?.ok, false);
  assert.match(r.texte, /REFUSÉ/);
  assert.match(r.texte, /asset_animation_absente/);
  assert.match(r.texte, /tir/);
  const brut = executer(['--spec', cheminSpec, '--glb', glb, '--json']);
  assert.deepEqual(JSON.parse(brut.texte).motifs.map((m: { code: string }) => m.code), ['asset_animation_absente']);
});

test('le niveau de détail se lit dans le nom du fichier, et --lod l’emporte', () => {
  assert.equal(lodDuNom('livraison/unite_char_leger_base_lod2.glb'), 2);
  assert.equal(lodDuNom('unite_char_leger_base.glb'), null);
  // 3 000 sommets = 1 000 triangles : bon pour le lod0 (6 000), trop pour le lod2 (600).
  const lod2 = ecrire('unite_char_leger_base_lod2.glb', { sommets: 3000 });
  const r = executer(['--spec', cheminSpec, '--glb', lod2]);
  assert.equal(r.code, 1);
  assert.equal(r.verdict?.motifs[0]?.code, 'asset_budget');
  assert.equal(r.verdict?.motifs[0]?.mesure?.['lod'], 2);
  const force = executer(['--spec', cheminSpec, '--glb', lod2, '--lod', '0']);
  assert.equal(force.code, 0, force.texte);
  assert.match(force.texte, /lod0/);
});

test('un fichier mal nommé est accepté mais prévenu : le rendu ne le trouverait pas', () => {
  const glb = ecrire('final_v3.glb');
  const r = executer(['--spec', cheminSpec, '--glb', glb]);
  assert.equal(r.code, 0);
  assert.match(r.texte, /Nom     : attendu unite_char_leger_base_lod0\.glb/);
});

test('un fichier illisible ou absent rend 1, une commande incomplète rend 2', () => {
  const faux = path.join(dossier, 'pas_un_glb.glb');
  writeFileSync(faux, 'ceci n’est pas un GLB');
  const illisible = executer(['--spec', cheminSpec, '--glb', faux]);
  assert.equal(illisible.code, 1);
  assert.equal(illisible.verdict?.motifs[0]?.code, 'asset_format');

  const absent = executer(['--spec', cheminSpec, '--glb', path.join(dossier, 'absent.glb')]);
  assert.equal(absent.code, 1);
  assert.equal(absent.verdict, null);
  assert.match(absent.texte, /illisible/);

  const specAbsente = executer(['--spec', path.join(dossier, 'absente.json'), '--glb', faux]);
  assert.equal(specAbsente.code, 1);
  assert.match(specAbsente.texte, /spécification illisible/);

  const invalide = path.join(dossier, 'invalide.json');
  writeFileSync(invalide, JSON.stringify({ id: 'x' }));
  const specInvalide = executer(['--spec', invalide, '--glb', faux]);
  assert.equal(specInvalide.code, 1);
  assert.match(specInvalide.texte, /spécification invalide/);

  assert.equal(executer(['--glb', faux]).code, 2);
  assert.equal(executer([]).code, 2);
  assert.match(executer([]).texte, /usage/);
});

test('--fichiers passe les textures livrées à côté : un kit s’en contente', () => {
  const kit = genererSpecs().find((s) => s.id === 'kit_fr_char_leger');
  assert.ok(kit);
  const livraison = mkdtempSync(path.join(os.tmpdir(), 'atlas-kit-'));
  const glb = path.join(livraison, 'kit_fr_char_leger_lod0.glb');
  writeFileSync(glb, construireGlb(
    documentTest({
      taille: { x: kit.echelle.x.cible, y: kit.echelle.y.cible, z: kit.echelle.z.cible },
      noeuds: [...kit.format.noeuds],
      materiaux: [...kit.format.materiauxAttendus],
      images: [],
      animations: kit.animations.filter((a) => a.obligatoire).map((a) => a.nom),
    }),
    binTriangle(kit.echelle.x.cible, kit.echelle.y.cible, kit.echelle.z.cible),
  ));
  // Sans les textures, refusé ; avec le dossier qui les porte, accepté.
  const sans = executer(['--spec', cheminKit, '--glb', glb]);
  assert.equal(sans.code, 1);
  assert.ok(sans.verdict?.motifs.every((m) => ['asset_texture_absente', 'asset_masque_absent'].includes(m.code)));
  for (const t of kit.textures.filter((x) => x.obligatoire)) {
    writeFileSync(path.join(livraison, `kit_fr_char_leger_${t.canal}.png`), '');
  }
  const avec = executer(['--spec', cheminKit, '--glb', glb, '--fichiers', livraison]);
  assert.equal(avec.code, 0, avec.texte);
});

test('le texte du verdict porte les mesures, comme celui d’une carte', () => {
  const texte = afficherVerdict(spec!, 'x_lod0.glb', 0, 1234, {
    ok: false,
    motifs: [{ code: 'asset_budget', detail: 'trop lourd', mesure: { triangles: 9000, budget: 6000, lod: 0 } }],
  });
  assert.match(texte, /REFUSÉ/);
  assert.match(texte, /asset_budget/);
  assert.match(texte, /trop lourd/);
  assert.match(texte, /triangles=9000 budget=6000 lod=0/);
});
