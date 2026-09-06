/**
 * L'infanterie générée (`scripts/generer-infanterie.ts`) : le premier vrai
 * fichier de modèle du projet, contrôlé ici comme le serait une livraison du
 * générateur externe — et un peu plus, parce que le générateur est sous la
 * main : déterminisme, lecture par three, conformation, clips qui bougent,
 * masque binaire, et l'identité entre le dépôt et ce que le script produit.
 *
 * La génération est faite **en mémoire**, une fois pour tous les tests ; rien
 * n'est écrit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { budgetDe, lireGlb, mesurerGltf, nomModele, nomTexture } from '../../src/assets/index';
import { crc32, SIGNATURE_PNG } from '../../src/render/apercu/png';
import { analyserGlb, conformerModele, creerLecteurClips, masqueDe, nomsClips } from '../../src/render3d/modeles';
import { inventaireModeles } from '../../src/serveur/modeles';
import {
  controlerLivraison, DOSSIER_DEPOT, genererInfanterie, ID_INFANTERIE, racineDepot, type Livraison,
} from '../../scripts/generer-infanterie';
import { azimutDeU, CELLULES, uDeAzimut, type Cellule } from '../../scripts/infanterie/atlas';
import { ALLURES, NOMS_OS } from '../../scripts/infanterie/figurine';

let partagee: Promise<Livraison> | null = null;
/** La livraison, générée une fois pour tous les tests du fichier. */
function livraison(): Promise<Livraison> {
  partagee = partagee ?? genererInfanterie();
  return partagee;
}

const NIVEAUX = [0, 1, 2] as const;

/** Un chargeur three qui lit les PNG voisins comme des textures d'un pixel : sous Node, il n'y a pas d'image. */
function chargeurSansImage(): GLTFLoader {
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.png$/i, {
    load(_url: string, onLoad: (t: THREE.Texture) => void): THREE.Texture {
      const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      t.needsUpdate = true;
      onLoad(t);
      return t;
    },
  } as unknown as THREE.Loader);
  return new GLTFLoader(manager);
}

/** Lit un GLB livré par three, ou échoue. */
async function analyser(l: Livraison, lod: 0 | 1 | 2): Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }> {
  const octets = l.fichiers.get(nomModele(l.spec, lod));
  assert.ok(octets, `le lod${lod} est livré`);
  const lecture = await analyserGlb(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer, chargeurSansImage());
  assert.ok(lecture, `three lit le lod${lod}`);
  return lecture;
}

/** Décode un PNG produit par l'encodeur du dépôt : RVB 8 bits, filtre 0 par ligne, CRC vérifiés. */
function decoderPng(fichier: Uint8Array): { largeur: number; hauteur: number; pixels: Uint8Array } {
  assert.deepEqual([...fichier.slice(0, 8)], [...SIGNATURE_PNG], 'signature PNG');
  let i = 8;
  let largeur = 0;
  let hauteur = 0;
  const idat: Uint8Array[] = [];
  while (i < fichier.length) {
    const vue = new DataView(fichier.buffer, fichier.byteOffset + i, 8);
    const taille = vue.getUint32(0);
    const type = String.fromCharCode(...fichier.slice(i + 4, i + 8));
    const donnees = fichier.slice(i + 8, i + 8 + taille);
    const attendu = new DataView(fichier.buffer, fichier.byteOffset + i + 8 + taille, 4).getUint32(0);
    assert.equal(crc32(fichier.slice(i + 4, i + 8 + taille)), attendu, `CRC du segment ${type}`);
    if (type === 'IHDR') {
      const e = new DataView(donnees.buffer, donnees.byteOffset, donnees.byteLength);
      largeur = e.getUint32(0);
      hauteur = e.getUint32(4);
      assert.equal(donnees[8], 8, 'huit bits par composante');
      assert.equal(donnees[9], 2, 'truecolor RVB');
    } else if (type === 'IDAT') idat.push(donnees);
    i += 12 + taille;
  }
  const brut = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d))));
  const pixels = new Uint8Array(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    assert.equal(brut[y * (1 + largeur * 3)], 0, 'filtre 0 sur chaque ligne');
    pixels.set(brut.subarray(y * (1 + largeur * 3) + 1, (y + 1) * (1 + largeur * 3)), y * largeur * 3);
  }
  return { largeur, hauteur, pixels };
}

/** La valeur rouge d'un pixel au centre d'une case, dans une carte d'une résolution donnée. */
function centreCase(image: { largeur: number; pixels: Uint8Array }, c: Cellule): number {
  const e = image.largeur / 1024;
  const x = Math.round((c.x + c.largeur / 2) * e);
  const y = Math.round((c.y + c.hauteur / 2) * e);
  return image.pixels[(y * image.largeur + x) * 3]!;
}

// ---------------------------------------------------------------------------

test('deux générations donnent les mêmes octets, fichier par fichier', async () => {
  const a = await livraison();
  const b = await genererInfanterie();
  assert.deepEqual([...a.fichiers.keys()], [...b.fichiers.keys()]);
  for (const [nom, octets] of a.fichiers) {
    assert.equal(Buffer.compare(Buffer.from(octets), Buffer.from(b.fichiers.get(nom)!)), 0, `${nom} : mêmes octets`);
  }
});

test('la livraison porte les sept fichiers aux noms du gabarit, et moins d’un mégaoctet', async () => {
  const l = await livraison();
  const attendus = [
    ...NIVEAUX.map((lod) => nomModele(l.spec, lod)),
    ...(['albedo', 'normale', 'rugosite', 'masque_equipe'] as const).map((canal) => nomTexture(l.spec, canal)),
  ];
  assert.deepEqual([...l.fichiers.keys()].sort(), [...attendus].sort());
  assert.equal(l.spec.id, ID_INFANTERIE);
  const total = [...l.fichiers.values()].reduce((n, f) => n + f.byteLength, 0);
  assert.ok(total < 1_000_000, `${total} octets en tout`);
});

test('les trois niveaux passent le contrôle de la spécification, budgets décroissants', async () => {
  const l = await livraison();
  const verdicts = controlerLivraison(l);
  for (const lod of NIVEAUX) {
    assert.deepEqual(verdicts[lod], { ok: true, motifs: [] }, `lod${lod} accepté`);
    assert.ok(l.triangles[lod] <= budgetDe(l.spec.budget, lod), `lod${lod} : ${l.triangles[lod]} ≤ budget`);
    const lecture = lireGlb(l.fichiers.get(nomModele(l.spec, lod))!);
    assert.ok(lecture.ok);
    assert.equal(mesurerGltf(lecture.document).triangles, l.triangles[lod], 'le compte du script est celui du validateur');
  }
  assert.ok(l.triangles[0] > l.triangles[1] && l.triangles[1] > l.triangles[2]);
});

test('le document glTF : une escouade en un seul maillage à deux primitives, un squelette de trente-sept os, les cartes par uri', async () => {
  const l = await livraison();
  for (const lod of NIVEAUX) {
    const lecture = lireGlb(l.fichiers.get(nomModele(l.spec, lod))!);
    assert.ok(lecture.ok);
    const d = lecture.document as unknown as {
      meshes: { primitives: { attributes: Record<string, number>; material: number }[] }[];
      skins: { joints: number[] }[];
      images: { uri: string; name: string }[];
      textures: { source: number }[];
      materials: { name: string; pbrMetallicRoughness: { baseColorTexture?: { index: number } }; normalTexture?: { index: number } }[];
      nodes: { name?: string }[];
    };
    const corps = d.meshes.find((m) => m.primitives.length === 2);
    assert.ok(corps, 'le corps a deux primitives, une par matériau');
    assert.deepEqual(corps.primitives.map((p) => p.material), [0, 1]);
    for (const p of corps.primitives) assert.ok('JOINTS_0' in p.attributes && 'WEIGHTS_0' in p.attributes, 'le corps est skinné');
    assert.equal(d.skins.length, 1);
    assert.equal(d.skins[0]!.joints.length, 1 + ALLURES.length * (1 + NOMS_OS.length), 'base, puis une ancre et onze os par figurine');
    assert.deepEqual(d.images.map((i) => i.uri), ['albedo', 'normale', 'rugosite', 'masque_equipe'].map((c) => nomTexture(l.spec, c as 'albedo')));
    assert.equal(d.textures.length, 4);
    assert.deepEqual(d.materials.map((m) => m.name), ['mat_corps', 'mat_details']);
    for (const m of d.materials) {
      assert.equal(m.pbrMetallicRoughness.baseColorTexture?.index, 0);
      assert.equal(m.normalTexture?.index, 1);
    }
    const noms = new Set(d.nodes.map((n) => n.name));
    for (const attendu of l.spec.format.noeuds) assert.ok(noms.has(attendu), `nœud ${attendu}`);
    for (const allure of ALLURES) for (const os of NOMS_OS) assert.ok(noms.has(`${allure.prefixe}_${os}`), `os ${allure.prefixe}_${os}`);
  }
});

test('three lit les trois niveaux : nœuds imposés, deux matériaux masqués, six clips aux durées de la spécification', async () => {
  const l = await livraison();
  for (const lod of NIVEAUX) {
    const { scene, clips } = await analyser(l, lod);
    for (const nom of l.spec.format.noeuds) assert.ok(scene.getObjectByName(nom), `lod${lod} : ${nom}`);
    // Deux primitives : three fait de `corps` un groupe de deux SkinnedMesh
    // qui partagent un seul squelette — deux appels de dessin, une pose.
    const corps = scene.getObjectByName('corps');
    assert.ok(corps, 'le nœud corps existe');
    const peaux: THREE.SkinnedMesh[] = [];
    corps.traverse((o) => { if (o instanceof THREE.SkinnedMesh) peaux.push(o); });
    assert.equal(peaux.length, 2, 'une maille skinnée par matériau');
    assert.equal(peaux[0]!.skeleton, peaux[1]!.skeleton, 'un seul squelette pour les deux');
    assert.equal(peaux[0]!.skeleton.bones.length, 37);
    assert.ok(scene.getObjectByName('socle') instanceof THREE.Mesh);
    const materiaux = peaux.map((p) => p.material as THREE.MeshStandardMaterial);
    assert.deepEqual(materiaux.map((m) => m.name), ['mat_corps', 'mat_details']);
    for (const m of materiaux) assert.ok(masqueDe(m), `${m.name} porte le masque d’équipe`);
    assert.deepEqual(nomsClips(clips), ['repos', 'deplacement', 'tir', 'touche', 'hors_jeu', 'capture']);
    for (const clip of clips) {
      const attendu = l.spec.animations.find((a) => a.nom === clip.name);
      assert.ok(attendu);
      assert.ok(Math.abs(clip.duration - attendu.dureeMs / 1000) < 1e-3, `${clip.name} dure ${clip.duration} s`);
    }
  }
});

test('conformé, le modèle tient dans la tolérance de la spécification, dans le repère du rendu', async () => {
  const l = await livraison();
  const niveaux = [];
  for (const lod of NIVEAUX) niveaux.push((await analyser(l, lod)).scene);
  const modele = conformerModele({ niveaux, clips: [], kit: false }, 'b');
  assert.equal(modele.lods, 3);
  modele.objet.updateMatrixWorld(true);
  const boite = new THREE.Box3().setFromObject(modele.objet);
  const taille = boite.getSize(new THREE.Vector3());
  const marge = (axe: 'x' | 'y' | 'z'): number => Math.max(l.spec.echelle[axe].tolerance, l.spec.echelle[axe].cible * l.spec.verification.toleranceAabb);
  // L'avant du fichier (+Z) regarde +X dans le rendu : la profondeur du fichier devient la longueur.
  assert.ok(Math.abs(taille.x - l.spec.echelle.z.cible) <= marge('z'), `longueur ${taille.x}`);
  assert.ok(Math.abs(taille.z - l.spec.echelle.x.cible) <= marge('x'), `largeur ${taille.z}`);
  assert.ok(Math.abs(taille.y - l.spec.echelle.y.cible) <= marge('y'), `hauteur ${taille.y}`);
  assert.ok(Math.abs(boite.min.y) <= marge('y'), 'posé au sol');
  assert.ok(Math.abs(modele.hauteur - 0.6) <= marge('y'), `l’étiquette s’accroche à ${modele.hauteur}`);
});

test('les clips animent les os des trois niveaux : la marche lance les cuisses, la mise hors jeu abaisse le bassin', async () => {
  const l = await livraison();
  const lu = await analyser(l, 0);
  const niveaux = [lu.scene];
  for (const lod of [1, 2] as const) niveaux.push((await analyser(l, lod)).scene);
  const modele = conformerModele({ niveaux, clips: lu.clips, kit: false });
  const lecteur = creerLecteurClips(modele.objet, modele.clips);
  assert.ok(lecteur);
  assert.deepEqual(lecteur.clips, ['repos', 'deplacement', 'tir', 'touche', 'hors_jeu', 'capture']);
  const os = (niveau: string, nom: string): THREE.Object3D => {
    const o = modele.objet.getObjectByName(niveau)?.getObjectByName(nom);
    assert.ok(o, `${niveau} porte ${nom}`);
    return o;
  };
  const reposBassin = os('lod0', 'f1_bassin').position.y;
  lecteur.jouer('deplacement', 0, false);
  lecteur.avancer(0.25);
  for (const niveau of ['lod0', 'lod1', 'lod2']) {
    const cuisse = os(niveau, 'f1_cuisse_g').quaternion;
    assert.ok(Math.abs(cuisse.x) > 0.05, `${niveau} : la cuisse gauche a basculé (${cuisse.x})`);
  }
  // Les trois figurines ne marchent pas au même pas.
  const pas = ALLURES.map((a) => os('lod0', `${a.prefixe}_cuisse_g`).quaternion.x);
  assert.ok(new Set(pas.map((x) => x.toFixed(3))).size === 3, `déphasées : ${pas.join(', ')}`);

  lecteur.jouer('hors_jeu', 0, false);
  lecteur.avancer(0.85);
  assert.equal(lecteur.courant, 'hors_jeu');
  const bassin = os('lod0', 'f1_bassin').position.y;
  assert.ok(bassin < reposBassin - 0.05, `le bassin descend : ${reposBassin} → ${bassin}`);
  const colonne = os('lod0', 'f1_colonne').quaternion;
  assert.ok(colonne.x > 0.1, 'le tronc se voûte vers l’avant');
  lecteur.dispose();
});

test('le masque d’équipe est binaire et suit les cases de l’atlas ; les cartes ont leurs résolutions', async () => {
  const l = await livraison();
  const masque = decoderPng(l.fichiers.get(nomTexture(l.spec, 'masque_equipe'))!);
  assert.equal(masque.largeur, 512);
  assert.equal(masque.hauteur, 512);
  const valeurs = new Set<number>();
  for (const v of masque.pixels) valeurs.add(v);
  assert.deepEqual([...valeurs].sort((a, b) => a - b), [0, 255], 'zéro ou deux cent cinquante-cinq, rien entre');
  for (const c of Object.values(CELLULES)) {
    assert.equal(centreCase(masque, c), c.equipe ? 255 : 0, `case ${c.nom}`);
  }
  const albedo = decoderPng(l.fichiers.get(nomTexture(l.spec, 'albedo'))!);
  assert.equal(albedo.largeur, 1024);
  assert.equal(decoderPng(l.fichiers.get(nomTexture(l.spec, 'normale'))!).largeur, 1024);
  assert.equal(decoderPng(l.fichiers.get(nomTexture(l.spec, 'rugosite'))!).largeur, 512);
  // Le lanceur est sombre, le signal orange, la peau claire : l'albédo n'est pas un aplat.
  assert.ok(centreCase(albedo, CELLULES.lanceur) < 90);
  assert.ok(centreCase(albedo, CELLULES.signal) > 200);
  assert.ok(centreCase(albedo, CELLULES.peau_0) > 200);
});

test('le dépliage d’un visage est réversible, et l’hémisphère avant a la part du lion', () => {
  for (const phi of [-3, -1.6, -1, -0.3, 0, 0.3, 1, 1.6, 3]) {
    assert.ok(Math.abs(azimutDeU(uDeAzimut(phi)) - phi) < 1e-9, `azimut ${phi}`);
  }
  assert.equal(uDeAzimut(0), 0.5);
  assert.ok(uDeAzimut(Math.PI / 2) - uDeAzimut(-Math.PI / 2) > 0.65);
});

test('les fichiers déposés dans public/assets/modeles sont ceux que le script produit, ni plus ni moins', async () => {
  const l = await livraison();
  const dossier = path.join(racineDepot(), DOSSIER_DEPOT);
  const noms = readdirSync(dossier).filter((n) => !n.startsWith('.')).sort();
  assert.deepEqual(noms, [...l.fichiers.keys()].sort());
  for (const nom of noms) {
    const depose = readFileSync(path.join(dossier, nom));
    assert.equal(Buffer.compare(depose, Buffer.from(l.fichiers.get(nom)!)), 0, `${nom} : le dépôt est la production du script`);
  }
  assert.deepEqual(inventaireModeles(noms), { modeles: { [ID_INFANTERIE]: [0, 1, 2] } }, 'l’inventaire voit les trois niveaux');
});
