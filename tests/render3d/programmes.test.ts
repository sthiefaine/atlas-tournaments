/**
 * Combien de **programmes** la scène coûte, et pourquoi.
 *
 * Sous WebGPU, une clé de programme jamais vue coûte une traduction TSL → WGSL
 * en JavaScript puis un pipeline : c'est ce que la première image payait
 * (`10-rendu-3d.md` §9.4). Ces tests tiennent les deux bouts — la règle de
 * three qu'on exploite (deux nuanceurs identiques doivent partager une clé) et
 * le compte réel d'un plateau de mission, qui ne doit pas remonter en douce.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import {
  EPSILON_UNIFORME, normaliserMateriau, ordonnerAttributs, sansZero,
} from '../../src/render3d/programmes';
import { lotsDePrechauffage, prechauffer, TAILLE_LOT } from '../../src/render3d/prechauffage';
import { compterProgrammes, programmes } from './compter-programmes';
import { batirMonde, etatDeScenario } from './monde';
import { construireNuanceur } from './nuanceur';

import carteContact from '../../content/cartes/carte_premier_contact.json';
import scenarioContact from '../../content/scenarios/premier_contact.json';
import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../content/scenarios/demo.json';

/** Le WGSL d'une boîte au matériau donné, tel que three l'écrirait. */
function wgsl(parametres: THREE.MeshStandardNodeMaterialParameters): string {
  const maille = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial(parametres));
  const n = construireNuanceur(maille);
  return `${n.vertex}\n---\n${n.fragment}`;
}

// ---------------------------------------------------------------------------
// La règle de three qu'on exploite
// ---------------------------------------------------------------------------

test('un métal ou une émission nuls écrivent le même WGSL qu’un non nul : la clé sépare pour rien', () => {
  const reference = wgsl({ color: 0x808080, roughness: 0.5, metalness: 0.16, emissiveIntensity: 0.045 });
  // Ce sont des uniformes, pas des branches du nuanceur : le texte est le même
  // à zéro, à un millième et à un. C'est ce qui autorise `sansZero`.
  assert.equal(wgsl({ color: 0x808080, roughness: 0.5, metalness: 0, emissiveIntensity: 0.045 }), reference);
  assert.equal(wgsl({ color: 0x808080, roughness: 0.5, metalness: 0.16, emissiveIntensity: 0 }), reference);
  assert.equal(wgsl({ color: 0x808080, roughness: 0.5, metalness: EPSILON_UNIFORME, emissiveIntensity: EPSILON_UNIFORME }), reference);
  // Le contre-exemple, pour montrer qu'on ne dit pas « tout se vaut » : un seuil
  // alpha, lui, ajoute une coupure et change vraiment le nuanceur.
  assert.notEqual(wgsl({ color: 0x808080, roughness: 0.5, metalness: 0.16, alphaTest: 0.5 }), reference);
});

test('sansZero ne touche qu’un zéro exact', () => {
  assert.equal(sansZero(0), EPSILON_UNIFORME);
  assert.equal(sansZero(0.78), 0.78);
  assert.ok(EPSILON_UNIFORME < 1 / 255, 'sous la quantification d’un canal de huit bits : invisible');
});

test('normaliserMateriau efface les zéros et laisse le reste, deux fois de suite', () => {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0, emissiveIntensity: 0, roughness: 0.4 });
  normaliserMateriau(m);
  assert.equal(m.metalness, EPSILON_UNIFORME);
  assert.equal(m.emissiveIntensity, EPSILON_UNIFORME);
  assert.equal(m.roughness, 0.4, 'la rugosité n’est pas de son ressort');
  normaliserMateriau(m);
  assert.equal(m.metalness, EPSILON_UNIFORME, 'idempotente');
  // Un matériau sans ces champs ne doit pas s'en voir pousser.
  const base = new THREE.MeshBasicNodeMaterial();
  normaliserMateriau(base);
  assert.equal((base as { metalness?: number }).metalness, undefined);
});

// ---------------------------------------------------------------------------
// L'ordre des attributs
// ---------------------------------------------------------------------------

test('ordonnerAttributs range les attributs et ne touche pas ce qui l’est déjà', () => {
  // `ExtrudeGeometry` pose `position, uv` puis `computeVertexNormals` ajoute
  // `normal` : c'est exactement le cas qui coûtait un programme de plus.
  const extrudee = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1),
  ]), { depth: 1, bevelEnabled: false });
  extrudee.computeVertexNormals();
  assert.deepEqual(Object.keys(extrudee.attributes), ['position', 'uv', 'normal']);
  const boite = new THREE.BoxGeometry(1, 1, 1);
  assert.deepEqual(Object.keys(boite.attributes), ['position', 'normal', 'uv']);

  const uv = extrudee.getAttribute('uv');
  ordonnerAttributs(extrudee);
  assert.deepEqual(Object.keys(extrudee.attributes), Object.keys(boite.attributes));
  assert.equal(extrudee.getAttribute('uv'), uv, 'les données mêmes, pas une copie');

  // Rangée, elle ne bouge plus : ranger une géométrie déjà dessinée changerait
  // sa clé et provoquerait la reconstruction qu'on évite.
  const ordre = extrudee.attributes;
  ordonnerAttributs(extrudee);
  assert.equal(extrudee.attributes, ordre);
});

test('ordonnerAttributs garde un attribut qu’il ne connaît pas, après les connus', () => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('atlas_maj', new THREE.BufferAttribute(new Float32Array(3), 1));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(2), 2));
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  ordonnerAttributs(geo);
  assert.deepEqual(Object.keys(geo.attributes), ['position', 'uv', 'atlas_maj']);
});

// ---------------------------------------------------------------------------
// Le compte réel d'un plateau
// ---------------------------------------------------------------------------

/**
 * Le plafond du 8 septembre 2026, mesuré **tout compris** — ce que le
 * préchauffage compile, donc invisibles compris : 31 programmes sur
 * `premier_contact` et 34 sur la carte de la démonstration (celle de l'attract
 * mode), contre 39 et 42 avant `programmes.ts`. Le test échoue si un matériau
 * ou une géométrie neuve fait remonter le compte : c'est le seul garde-fou
 * possible hors navigateur, et c'est précisément le chiffre qui décide du coût
 * de la première image.
 */
const PLAFOND: Readonly<Record<string, number>> = { premier_contact: 31, demo: 34 };

for (const [nom, carte, scenario] of [
  ['premier_contact', carteContact, scenarioContact],
  ['demo', carteDemo, scenarioDemo],
] as const) {
  test(`le plateau de ${nom} tient sous son plafond de programmes`, () => {
    const { etat, cat } = etatDeScenario(carte, scenario);
    const monde = batirMonde(etat, cat);
    const compte = compterProgrammes(monde.scene, { invisibles: true });
    assert.ok(
      compte <= PLAFOND[nom]!,
      `${compte} programmes contre un plafond de ${PLAFOND[nom]!} :\n`
      + programmes(monde.scene, { invisibles: true }).map((p) => `  ${p.objets} ${p.exemple}`).join('\n'),
    );
    monde.dispose();
  });
}

test('les sept rôles d’une figurine ne coûtent qu’un programme, biseautés ou non', () => {
  const { etat, cat } = etatDeScenario(carteContact, scenarioContact);
  const monde = batirMonde(etat, cat);
  const unites = monde.scene.getObjectByName('unites')!;
  const parCle = new Map<string, number>();
  for (const p of programmes(unites, { invisibles: true })) parCle.set(p.exemple, p.objets);
  // Un programme pour tout ce qui est opaque, un pour le verre translucide, un
  // pour le liseré et le socle, un pour les repères qui ne reçoivent pas
  // d'ombre : quatre, là où les deux ordres d'attributs et les zéros de métal
  // et d'émission en faisaient onze.
  assert.ok(parCle.size <= 4, `${parCle.size} programmes pour les unités : ${[...parCle.keys()].join(', ')}`);
  monde.dispose();
});

// ---------------------------------------------------------------------------
// Le préchauffage
// ---------------------------------------------------------------------------

/** Une scène à deux familles, dont une maille portée par une autre. */
function sceneEssai(): { scene: THREE.Scene; porteur: THREE.Mesh; porte: THREE.Mesh; cache: THREE.Mesh } {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  const famille = new THREE.Group();
  famille.name = 'famille';
  const porteur = new THREE.Mesh(geo, mat);
  const porte = new THREE.Mesh(geo, mat);
  porteur.add(porte);
  const cache = new THREE.Mesh(geo, mat);
  cache.visible = false;
  famille.add(porteur, cache);
  const lumieres = new THREE.Group();
  lumieres.add(new THREE.DirectionalLight());
  scene.add(famille, lumieres);
  return { scene, porteur, porte, cache };
}

test('les lots couvrent tout ce qui se dessine, invisibles compris, et rien d’autre', () => {
  const { scene, porteur, porte, cache } = sceneEssai();
  const lots = lotsDePrechauffage(scene);
  const tous = lots.flat();
  assert.deepEqual(new Set(tous), new Set([porteur, porte, cache]), 'les trois mailles, la lumière non');
  assert.equal(tous.length, 3, 'chaque maille dans un lot et un seul');
  assert.ok(lots.every((l) => l.length <= TAILLE_LOT));
});

test('les lots découpent une grande famille en tranches', () => {
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  for (let i = 0; i < 7; i += 1) groupe.add(new THREE.Mesh(geo, mat));
  scene.add(groupe);
  assert.deepEqual(lotsDePrechauffage(scene, 3).map((l) => l.length), [3, 3, 1]);
});

test('le préchauffage montre chaque maille une fois, avec son porteur, puis rend la scène intacte', async () => {
  const { scene, porteur, porte, cache } = sceneEssai();
  cache.frustumCulled = true;
  const vues: Set<THREE.Object3D>[] = [];
  let pauses = 0;
  await prechauffer({
    compileAsync: (s): Promise<void> => {
      const visibles = new Set<THREE.Object3D>();
      // Ce que le moteur verrait : un objet caché arrête la descente, comme
      // `_projectObject` le fait.
      const descendre = (o: THREE.Object3D): void => {
        if (!o.visible) return;
        if ((o as THREE.Mesh).isMesh) visibles.add(o);
        for (const e of o.children) descendre(e);
      };
      descendre(s);
      vues.push(visibles);
      return Promise.resolve();
    },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => { pauses += 1; return Promise.resolve(); } });

  assert.equal(vues.length, 3, 'un lot par maille');
  assert.equal(pauses, 3, 'et la main rendue entre chacun');
  const compilees = new Set(vues.flatMap((v) => [...v]));
  assert.deepEqual(compilees, new Set([porteur, porte, cache]), 'les trois y sont passées');
  // Le lot de la maille portée a bien montré son porteur : sans lui, le moteur
  // ne l'aurait pas vue.
  assert.ok(vues.some((v) => v.has(porte)), 'la maille portée a été projetée');

  assert.equal(porteur.visible, true, 'la scène revient exactement comme elle était');
  assert.equal(porte.visible, true);
  assert.equal(cache.visible, false, 'une maille éteinte le reste');
  assert.equal(cache.frustumCulled, true, 'et retrouve son tri par tronc de vue');
});

test('un lot qui ne compile pas n’emporte pas les autres, et trois échecs arrêtent tout', async () => {
  // Six mailles, un lot chacune, et tous les lots refusent : on n'insiste pas
  // au-delà de trois — un moteur en panne n'a pas à le dire trente fois.
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  for (let i = 0; i < 6; i += 1) groupe.add(new THREE.Mesh(geo, mat));
  scene.add(groupe);
  let appels = 0;
  await prechauffer({
    compileAsync: (): Promise<void> => {
      appels += 1;
      return Promise.reject(new Error('pas de carte graphique'));
    },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => Promise.resolve() });
  assert.equal(appels, 3, 'trois essais, puis on renonce');
  assert.ok(groupe.children.every((o) => o.visible), 'et la scène revient intacte');
});

test('un lot instancié éteint et une géométrie vide ne se préchauffent pas', () => {
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  const eteint = new THREE.InstancedMesh(geo, mat, 8);
  eteint.count = 0;
  const allume = new THREE.InstancedMesh(geo, mat, 8);
  allume.count = 3;
  const vide = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  const pleine = new THREE.Mesh(geo, mat);
  groupe.add(eteint, allume, vide, pleine);
  scene.add(groupe);
  assert.deepEqual(new Set(lotsDePrechauffage(scene).flat()), new Set([allume, pleine]));
});

test('un démontage arrête le préchauffage en cours', async () => {
  const { scene, cache } = sceneEssai();
  let vivante = true;
  let appels = 0;
  await prechauffer({
    compileAsync: (): Promise<void> => { appels += 1; vivante = false; return Promise.resolve(); },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => Promise.resolve(), vivante: () => vivante });
  assert.equal(appels, 1);
  assert.equal(cache.visible, false, 'et la scène reste ce qu’elle était');
});
