// Le lot d'une figurine : un GLB brut « comme Blender l'écrit », construit à
// la main, complété de ses cartes et de ses clips par `lot.ts`, doit passer le
// contrôle du dépôt (`controlerDepot`) tel quel — noms des images, matériaux de
// la fiche, clips aux bonnes durées, bornes des temps, boucles fermées.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHARTE } from '../../../scripts/production/figurines/charte';
import {
  assemblerLot, canauxLivres, ficheMesuree, injecterClips, verifierReposNoeuds, type ClipFigurine, type RapportBlender,
} from '../../../scripts/production/figurines/lot';
import { assemblerGlb, decouperGlb, type DocumentGltf } from '../../../scripts/infanterie/gltf';
import { controlerDepot } from '../../../src/serveur/depot-modeles';
import { nomTexture, type AssetSpec } from '../../../src/assets/spec';
import ficheCharLeger from '../../../assets/specs/unite_char_leger_base.json';

/** La fiche du char léger aux petites résolutions : mêmes noms, mêmes règles, des PNG vite faits. */
const SPEC = { ...ficheCharLeger, textures: ficheCharLeger.textures.map((t) => ({ ...t, resolution: 256 })) } as unknown as AssetSpec;

/** Un GLB « de Blender » : racine, corps (une boîte), les nœuds vides de la fiche, un seul matériau. */
function glbBrut(): Uint8Array {
  const [x, y, z] = [0.25, 0.1, 0.3];
  const coins = [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [-1, 1].map((c) => [a * x, b * y, c * z])));
  const positions = new Float32Array(coins.flat());
  const normales = new Float32Array(coins.flatMap(([a, b, c]) => { const n = Math.hypot(a!, b!, c!); return [a! / n, b! / n, c! / n]; }));
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
    nodes: [
      { name: 'racine', children: [1, 3, 4] },
      { name: 'corps', translation: [0, 0.1, 0], mesh: 0, children: [2] },
      { name: 'module_tourelle', translation: [0, 0.1, 0.05] },
      { name: 'base' },
      { name: 'socle' },
    ],
    meshes: [{ name: 'corps', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ name: 'mat_corps', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1] } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-x, -y, -z], max: [x, y, z] },
      { bufferView: 1, componentType: 5126, count: 8, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 8, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: vues,
    buffers: [{ byteLength: bin.length }],
  };
  return assemblerGlb(document, bin);
}

/** Des clips pour chaque clip de la fiche : le corps qui monte et redescend (les boucles reviennent au départ). */
function clips(): ClipFigurine[] {
  return SPEC.animations.map((a) => {
    const d = a.dureeMs / 1000;
    const temps = [0, d / 2, d];
    return {
      nom: a.nom, duree: d, boucle: a.boucle,
      pistes: [{ noeud: 'corps', chemin: 'translation', temps, valeurs: [[0, 0.1, 0], [0, 0.11, 0], a.boucle ? [0, 0.1, 0] : [0, 0.09, 0]] }],
    };
  });
}

function rapport(): RapportBlender {
  return {
    cle: 'char_leger', id: 'unite_char_leger_base', teintes: ['equipe', 'graphite'], clips: clips(), materiaux: ['mat_corps', 'mat_details'],
    noeuds: [
      { nom: 'racine', parent: null, translation: [0, 0, 0], tournant: false },
      { nom: 'corps', parent: 'racine', translation: [0, 0.1, 0], tournant: false },
      { nom: 'module_tourelle', parent: 'corps', translation: [0, 0.1, 0.05], tournant: false },
      { nom: 'base', parent: 'racine', translation: [0, 0, 0], tournant: false },
      { nom: 'socle', parent: 'racine', translation: [0, 0, 0], tournant: false },
    ],
  };
}

test('le lot passe le contrôle du dépôt, contre la fiche aux dimensions mesurées', () => {
  const fichiers = assemblerLot(glbBrut(), rapport(), SPEC, CHARTE);
  const { document } = decouperGlb(fichiers.get('unite_char_leger_base_lod0.glb')!);
  const fiche = ficheMesuree(SPEC, document, 60000);
  assert.deepEqual([fiche.echelle.x.cible, fiche.echelle.y.cible, fiche.echelle.z.cible], [0.5, 0.2, 0.6]);
  assert.equal(fiche.budget.lod0, 60000);
  assert.deepEqual(fiche.format, SPEC.format, 'la fiche mesurée ne touche ni aux noms ni aux clips');
  const verdict = controlerDepot(fiche, [...fichiers].map(([nom, octets]) => ({ nom, octets })));
  assert.deepEqual(verdict.motifs, []);
  assert.ok(verdict.ok);
  // Contre la fiche du canon, seule l'échelle est refusée.
  const officiel = controlerDepot(SPEC, [...fichiers].map(([nom, octets]) => ({ nom, octets })));
  assert.ok(officiel.motifs.length > 0 && officiel.motifs.every((m) => m.code === 'asset_echelle'), JSON.stringify(officiel.motifs));
});

test('les cartes : PNG voisins aux noms de la fiche, le masque en image que nul matériau ne lit, les matériaux de la fiche', () => {
  const fichiers = assemblerLot(glbBrut(), rapport(), SPEC, CHARTE);
  const { document } = decouperGlb(fichiers.get('unite_char_leger_base_lod0.glb')!);
  const images = (document['images'] as { uri: string }[]).map((i) => i.uri);
  assert.deepEqual(images, ['albedo', 'normale', 'rugosite', 'masque_equipe'].map((c) => nomTexture(SPEC, c as never)));
  const materiaux = document['materials'] as { name: string; pbrMetallicRoughness: Record<string, { index: number }>; normalTexture: { index: number }; doubleSided?: boolean }[];
  assert.deepEqual(materiaux.map((m) => m.name), ['mat_corps', 'mat_details'], 'le matériau absent de Blender est ajouté, dans l’ordre de la fiche');
  for (const m of materiaux) {
    assert.equal(m.pbrMetallicRoughness['baseColorTexture']!.index, 0);
    assert.equal(m.pbrMetallicRoughness['metallicRoughnessTexture']!.index, 2);
    assert.equal(m.normalTexture.index, 1);
    assert.equal(m.doubleSided, undefined);
  }
  const lues = new Set(materiaux.flatMap((m) => [m.pbrMetallicRoughness['baseColorTexture']!.index, m.pbrMetallicRoughness['metallicRoughnessTexture']!.index, m.normalTexture.index]));
  assert.ok(!lues.has(3), 'aucun matériau ne lit le masque');
  for (const nom of images) assert.ok(fichiers.has(nom), nom);
  assert.ok(fichiers.has(nomTexture(SPEC, 'metal')), 'le métal est livré à côté, non référencé');
  assert.ok(fichiers.has(nomTexture(SPEC, 'albedo', 'hiver')));
  // L'émission ne vient que d'une teinte qui émet, et seulement si la fiche l'accepte.
  assert.ok(!canauxLivres(SPEC, false).includes('emission'));
});

test('les clips : temps depuis zéro jusqu’à la durée, bornés, un canal par piste vers le nœud nommé', () => {
  const fichiers = assemblerLot(glbBrut(), rapport(), SPEC, CHARTE);
  const { document } = decouperGlb(fichiers.get('unite_char_leger_base_lod0.glb')!);
  const animations = document['animations'] as { name: string; samplers: { input: number; output: number; interpolation: string }[]; channels: { target: { node: number; path: string } }[] }[];
  const accessors = document['accessors'] as { min?: number[]; max?: number[]; count: number; type: string }[];
  assert.deepEqual(animations.map((a) => a.name), SPEC.animations.map((a) => a.nom));
  for (const a of animations) {
    const spec = SPEC.animations.find((s) => s.nom === a.name)!;
    const entree = accessors[a.samplers[0]!.input]!;
    assert.equal(entree.min![0], 0);
    assert.ok(Math.abs(entree.max![0]! * 1000 - spec.dureeMs) < 1);
    assert.equal(a.samplers[0]!.interpolation, 'LINEAR');
    assert.equal(accessors[a.samplers[0]!.output]!.type, 'VEC3');
    assert.equal(a.channels[0]!.target.node, 1);
    assert.equal(a.channels[0]!.target.path, 'translation');
  }
});

test('un clip vers un nœud absent, ou hors de sa durée, est refusé ; un repos démenti aussi', () => {
  const { document, bin } = decouperGlb(glbBrut());
  const faux = (p: Partial<ClipFigurine['pistes'][number]>): ClipFigurine[] => [{
    nom: 'repos', duree: 2.4, boucle: true,
    pistes: [{ noeud: 'corps', chemin: 'translation', temps: [0, 2.4], valeurs: [[0, 0.1, 0], [0, 0.1, 0]], ...p }],
  }];
  assert.throws(() => injecterClips(structuredClone(document), bin, faux({ noeud: 'tourelle_fantome' })), /absent/);
  assert.throws(() => injecterClips(structuredClone(document), bin, faux({ temps: [0.1, 2.4] })), /hors de/);
  assert.throws(() => injecterClips(structuredClone(document), bin, faux({ chemin: 'rotation' })), /invalides/);
  const r = rapport();
  r.noeuds[1]!.translation = [0, -0.1, 0];
  assert.match(verifierReposNoeuds(document, r).join(' '), /corps : translation/);
  assert.deepEqual(verifierReposNoeuds(document, rapport()), []);
});
