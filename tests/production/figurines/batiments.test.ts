// Les bâtiments dans la chaîne des figurines (`doc/refonte/plan-batiments.md`) :
// l'identifiant de chaque état et variante, ce qu'une commande fabrique, ce
// qu'un module déclare, la fiche d'une entrée que le catalogue n'a pas encore,
// le lot par défaut d'un identifiant — et un lot de bâtiment qui passe le
// contrôle du dépôt, fenêtres éteintes comprises.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  declarationsModule, dossierLot, entreesBatiment, etatEteint, ficheDerivee, fichesCandidates, idFigurineBatiment,
} from '../../../scripts/production/figurines/batiments';
import { CHARTE } from '../../../scripts/production/figurines/charte';
import { identifiantInstallation } from '../../../scripts/production/figurines/installer';
import { assemblerLot, canauxLivres, ficheMesuree, type RapportBlender } from '../../../scripts/production/figurines/lot';
import { assemblerGlb, decouperGlb, type DocumentGltf } from '../../../scripts/infanterie/gltf';
import { validerAssetSpec } from '../../../src/assets/index';
import type { AssetSpec } from '../../../src/assets/spec';
import { controlerDepot } from '../../../src/serveur/depot-modeles';
import ficheVille from '../../../assets/specs/batiment_ville_base.json';
import ficheHelico from '../../../assets/specs/unite_helico_base.json';

const VILLE = ficheVille as unknown as AssetSpec;

test('l’identifiant d’un état ou d’une variante : le plan §1', () => {
  assert.equal(idFigurineBatiment('ville'), 'batiment_ville_base');
  assert.equal(idFigurineBatiment('ville', 'desaffecte'), 'batiment_ville_desaffecte');
  assert.equal(idFigurineBatiment('qg', 'base', 'fr'), 'batiment_qg_fr');
  assert.equal(idFigurineBatiment('superusine', 'inerte'), 'batiment_superusine_inerte');
  assert.equal(idFigurineBatiment('pont'), 'terrain_pont');
  assert.throws(() => idFigurineBatiment('qg', 'desaffecte', 'fr'), /ne se désaffecte pas/);
  assert.throws(() => idFigurineBatiment('pont', 'desaffecte'), /ni état ni variante/);
  assert.throws(() => idFigurineBatiment('ville_x'), /clé de bâtiment invalide/);
});

test('une commande fabrique tous les états et variantes du module, ou ceux qu’on nomme', () => {
  const ids = (cle: string, etats: string[], variantes: string[], demande = {}) =>
    entreesBatiment(cle, { etats, variantes }, demande).map((e) => e.id);
  assert.deepEqual(ids('ville', ['base', 'desaffecte'], ['base']), ['batiment_ville_base', 'batiment_ville_desaffecte']);
  assert.deepEqual(ids('qg', ['base'], ['base', 'fr', 'lu']), ['batiment_qg_base', 'batiment_qg_fr', 'batiment_qg_lu']);
  // Un état autre que la base ne se combine qu'avec la variante commune.
  assert.deepEqual(ids('usine', ['base', 'desaffecte'], ['base', 'fr']), ['batiment_usine_base', 'batiment_usine_fr', 'batiment_usine_desaffecte']);
  assert.deepEqual(ids('ville', ['base', 'desaffecte'], ['base'], { etat: 'desaffecte' }), ['batiment_ville_desaffecte']);
  assert.deepEqual(ids('qg', ['base'], ['base', 'fr', 'lu'], { variante: 'lu' }), ['batiment_qg_lu']);
  assert.throws(() => ids('ville', ['base', 'desaffecte'], ['base'], { etat: 'inerte' }), /n'est pas dans ETATS/);
  const pont = entreesBatiment('pont', { etats: ['base'], variantes: ['base'] });
  assert.deepEqual(pont.map((e) => [e.id, e.famille, e.vues]), [['terrain_pont', 'terrain', ['fixe', 'travers']]]);
  assert.deepEqual(entreesBatiment('ville', { etats: ['base'], variantes: ['base'] })[0]!.vues, ['fixe']);
});

test('ce qu’un module déclare se lit dans sa source, et les défauts', () => {
  assert.deepEqual(declarationsModule("ETATS = ('base', 'desaffecte')\n"), { etats: ['base', 'desaffecte'], variantes: ['base'] });
  assert.deepEqual(declarationsModule('def construire(f, etat, variante):\n    pass\n'), { etats: ['base'], variantes: ['base'] });
  assert.deepEqual(declarationsModule("ETATS = ('base',)\nVARIANTES = ('base', 'fr', 'lu')\n"), { etats: ['base'], variantes: ['base', 'fr', 'lu'] });
  assert.throws(() => declarationsModule("ETATS = ('desaffecte',)\n"), /base/);
});

test('une entrée que le catalogue n’a pas encore se dérive de son type de base', () => {
  assert.deepEqual(fichesCandidates({ cle: 'ville', id: 'batiment_ville_desaffecte' }), ['batiment_ville_desaffecte', 'batiment_ville_base']);
  assert.deepEqual(fichesCandidates({ cle: 'superusine', id: 'batiment_superusine_inerte' }),
    ['batiment_superusine_inerte', 'batiment_superusine_base', 'batiment_usine_base']);
  assert.deepEqual(fichesCandidates({ cle: 'pont', id: 'terrain_pont' }), ['terrain_pont']);
  const d = ficheDerivee(VILLE, 'batiment_ville_desaffecte');
  assert.equal(d.id, 'batiment_ville_desaffecte');
  assert.equal(d.cle, 'ville_desaffecte');
  assert.ok(d.nommage.exemples.every((x) => x.startsWith('batiment_ville_desaffecte')));
  assert.deepEqual([d.format, d.textures, d.animations, d.echelle], [VILLE.format, VILLE.textures, VILLE.animations, VILLE.echelle]);
  const r = validerAssetSpec(d);
  assert.ok(r.ok, r.ok ? '' : JSON.stringify(r.erreurs));
  assert.throws(() => ficheDerivee(VILLE, 'unite_ville_x'), /ne se dérive pas/);
});

test('le lot par défaut d’un identifiant, et ce que l’installation accepte', () => {
  assert.equal(dossierLot('unite_char_leger_base'), 'tmp/figurines/char_leger/lot');
  assert.equal(dossierLot('batiment_ville_desaffecte'), 'tmp/figurines/batiments/ville/batiment_ville_desaffecte/lot');
  assert.equal(dossierLot('batiment_qg_fr'), 'tmp/figurines/batiments/qg/batiment_qg_fr/lot');
  assert.equal(dossierLot('terrain_pont'), 'tmp/figurines/batiments/pont/terrain_pont/lot');
  assert.throws(() => dossierLot('decor_rocher_cotier'), /sans figurine/);
  assert.equal(identifiantInstallation({ cle: 'char_leger' }), 'unite_char_leger_base');
  assert.equal(identifiantInstallation({ id: 'batiment_ville_base' }), 'batiment_ville_base');
  assert.throws(() => identifiantInstallation({ id: 'terrain_foret' }), /sans figurine/);
  assert.throws(() => identifiantInstallation({ id: 'batiment_ville_base', cle: 'ville' }), /pas les deux/);
  assert.ok(etatEteint('desaffecte', CHARTE.batiments.emission.eteints));
  assert.ok(etatEteint('inerte', CHARTE.batiments.emission.eteints));
  assert.ok(!etatEteint('base', CHARTE.batiments.emission.eteints));
});

/** Un GLB « de Blender » d'un bâtiment : racine, corps (une boîte au sol), toit et enseigne vides. */
function glbBatiment(): Uint8Array {
  const [x, y, z] = [0.42, 0.6, 0.42];
  const coins = [-1, 1].flatMap((a) => [0, 1].flatMap((b) => [-1, 1].map((c) => [a * x, b * y, c * z])));
  const positions = new Float32Array(coins.flat());
  const normales = new Float32Array(coins.flatMap(([a, b, c]) => { const n = Math.hypot(a!, b! - y / 2, c!); return [a! / n, (b! - y / 2) / n, c! / n]; }));
  const uv = new Float32Array(coins.flatMap(() => [0.05, 0.05]));
  const indices = new Uint16Array([0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3]);
  const morceaux = [positions, normales, uv, indices].map((t) => new Uint8Array(t.buffer));
  const vues: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  let o = 0;
  for (const m of morceaux) {
    vues.push({ buffer: 0, byteOffset: o, byteLength: m.length });
    o += m.length + ((4 - (m.length % 4)) % 4);
  }
  const bin = new Uint8Array(o);
  morceaux.forEach((m, i) => bin.set(m, vues[i]!.byteOffset));
  const document: DocumentGltf = {
    asset: { version: '2.0', generator: 'Khronos glTF Blender I/O' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'racine', children: [1, 3] }, { name: 'corps', mesh: 0, children: [2] }, { name: 'toit', translation: [0, 0.3, 0] }, { name: 'enseigne' }],
    meshes: [{ name: 'corps', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ name: 'mat_corps', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1] } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-x, 0, -z], max: [x, y, z] },
      { bufferView: 1, componentType: 5126, count: 8, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 8, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: vues,
    buffers: [{ byteLength: bin.length }],
  };
  return assemblerGlb(document, bin);
}

function rapportBatiment(teintes: string[]): RapportBlender {
  const clips = VILLE.animations.filter((a) => a.obligatoire).map((a) => {
    const d = a.dureeMs / 1000;
    return { nom: a.nom, duree: d, boucle: a.boucle, pistes: [{ noeud: 'toit', chemin: 'translation' as const, temps: [0, d / 2, d], valeurs: [[0, 0.3, 0], [0, a.boucle ? 0.3 : 0.32, 0], [0, 0.3, 0]] }] };
  });
  return {
    cle: 'ville', id: 'batiment_ville_desaffecte', teintes, clips, materiaux: ['mat_corps', 'mat_vitrage'],
    noeuds: [
      { nom: 'racine', parent: null, translation: [0, 0, 0], tournant: false },
      { nom: 'corps', parent: 'racine', translation: [0, 0, 0], tournant: false },
      { nom: 'toit', parent: 'corps', translation: [0, 0.3, 0], tournant: false },
      { nom: 'enseigne', parent: 'racine', translation: [0, 0, 0], tournant: false },
    ],
  };
}

test('un lot de bâtiment passe le contrôle du dépôt : ses matériaux, et la carte d’émission que sa fiche exige même éteint', () => {
  // Les petites résolutions : mêmes noms, mêmes règles, des PNG vite faits.
  const base = { ...VILLE, textures: VILLE.textures.map((t) => ({ ...t, resolution: 256 })) } as AssetSpec;
  const fiche = ficheDerivee(base, 'batiment_ville_desaffecte');
  // Désaffecté : aucune teinte qui émet, et pourtant la carte (obligatoire) est livrée.
  assert.ok(canauxLivres(fiche, false).includes('emission'));
  const unite = ficheHelico as unknown as AssetSpec;
  assert.deepEqual(canauxLivres(unite, false), canauxLivres(unite, true).filter((c) => c !== 'emission'), 'une unité ne change pas');
  const fichiers = assemblerLot(glbBatiment(), rapportBatiment(['equipe', 'enduit', 'bois', 'graphite']), fiche, CHARTE);
  assert.ok(fichiers.has('batiment_ville_desaffecte_emission.png') && fichiers.has('batiment_ville_desaffecte_emission_hiver.png'));
  const glb = fichiers.get('batiment_ville_desaffecte_lod0.glb')!;
  const { document } = decouperGlb(glb);
  assert.deepEqual((document['materials'] as { name: string }[]).map((m) => m.name), ['mat_corps', 'mat_vitrage'], 'le vitrage est ajouté, dans l’ordre de la fiche');
  const mesuree = ficheMesuree(fiche, document, CHARTE.budget.triangles);
  const verdict = controlerDepot(mesuree, [...fichiers].map(([nom, octets]) => ({ nom, octets })));
  assert.deepEqual(verdict.motifs, []);
  assert.ok(verdict.ok);
});
