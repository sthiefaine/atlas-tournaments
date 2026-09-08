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
  EPSILON_UNIFORME, normaliserMateriau, sansZero,
} from '../../src/render3d/programmes';
import {
  cleGeometrieProgramme, lotsDePrechauffage, lotsDOmbre, porteursOmbre,
  prechauffer, prechaufferOmbres, signatureOmbre, TAILLE_LOT,
} from '../../src/render3d/prechauffage';
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
// L'ordre des attributs : une fausse piste, épinglée
// ---------------------------------------------------------------------------

test('l’ordre des attributs ne sépare pas deux programmes : three trie', () => {
  // Le §9.5 de `doc/10-rendu-3d.md` disait le contraire, et `ordonnerAttributs`
  // (retiré le 8 septembre 2026 au soir) rangeait les attributs pour cette
  // raison. C'était faux : `RenderObject.getGeometryCacheKey` de r170 écrit
  // `Object.keys(geometry.attributes).sort()`, et la mesure l'a confirmé — le
  // compte de programmes est le même avec et sans. Ce test tient la découverte :
  // le jour où une version de three cesserait de trier, il tombe.
  const boite = new THREE.BoxGeometry(1, 1, 1);
  assert.deepEqual(Object.keys(boite.attributes), ['position', 'normal', 'uv']);
  // La même, posée dans l'ordre qu'`ExtrudeGeometry` suivie de
  // `computeVertexNormals` produit : c'est le couple qui motivait le rangement.
  const autrement = new THREE.BoxGeometry(1, 1, 1);
  const garde = ['position', 'uv', 'normal'].map((n) => [n, autrement.getAttribute(n)] as const);
  for (const [n] of garde) autrement.deleteAttribute(n);
  for (const [n, a] of garde) autrement.setAttribute(n, a);
  assert.deepEqual(Object.keys(autrement.attributes), ['position', 'uv', 'normal'], 'deux ordres de pose');

  assert.equal(
    cleGeometrieProgramme(boite), cleGeometrieProgramme(autrement),
    'et pourtant une seule clé de géométrie',
  );
});

test('la clé de géométrie sépare ce qui change vraiment le nuanceur', () => {
  const nue = new THREE.BufferGeometry();
  nue.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const teintee = new THREE.BufferGeometry();
  teintee.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  teintee.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
  assert.notEqual(cleGeometrieProgramme(nue), cleGeometrieProgramme(teintee), 'un attribut de plus');

  // Le nombre de composantes entre dans la clé : une couleur en `vec3` et une
  // en `vec4` ne se lisent pas du même WGSL.
  const quadri = new THREE.BufferGeometry();
  quadri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  quadri.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 4));
  assert.notEqual(cleGeometrieProgramme(teintee), cleGeometrieProgramme(quadri));

  // L'index, oui ; les données, non — c'est ce qui permet de préchauffer une
  // forme pour toutes ses copies.
  const indexee = nue.clone();
  indexee.setIndex([0, 1, 2]);
  assert.notEqual(cleGeometrieProgramme(nue), cleGeometrieProgramme(indexee));
  assert.equal(cleGeometrieProgramme(nue), cleGeometrieProgramme(nue.clone()));
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

/**
 * Ce que le **premier temps** du chantier a à compiler : le plateau et
 * l'éclairage, rien d'autre (`index.ts`, `PhaseChantier`). C'est ce chiffre qui
 * décide si montrer le sol avant le reste vaut la peine — si le sol portait
 * déjà la moitié des programmes, on n'aurait rien gagné à le montrer d'abord.
 */
const PLAFOND_SOL: Readonly<Record<string, number>> = { premier_contact: 6, demo: 6 };

for (const [nom, carte, scenario] of [
  ['premier_contact', carteContact, scenarioContact],
  ['demo', carteDemo, scenarioDemo],
] as const) {
  test(`le sol de ${nom} ne porte qu’une fraction des programmes de la scène`, () => {
    const { etat, cat } = etatDeScenario(carte, scenario);
    const monde = batirMonde(etat, cat);
    const sol = compterProgrammes(monde.plateau.groupe, { invisibles: true });
    const tout = compterProgrammes(monde.scene, { invisibles: true });
    assert.ok(
      sol <= PLAFOND_SOL[nom]!,
      `${sol} programmes pour le seul plateau, plafond ${PLAFOND_SOL[nom]!} :\n`
      + programmes(monde.plateau.groupe, { invisibles: true }).map((p) => `  ${p.objets} ${p.exemple}`).join('\n'),
    );
    assert.ok(sol * 2 <= tout, `le sol porte ${sol} programmes sur ${tout} : le montrer d’abord ne gagne plus rien`);
    monde.dispose();
  });
}

/**
 * Les programmes de la **passe d'ombres**, comptés comme `prechaufferOmbres`
 * les compte : un par forme distincte parmi les porteurs d'ombre, le matériau
 * étant le même pour tous. Le §9.5 les estimait à douze ou dix-sept ; ce test
 * les chiffre, et échoue si une forme neuve fait remonter le compte — chacune
 * coûte un rendu de préchauffage de plus.
 */
const PLAFOND_OMBRES: Readonly<Record<string, number>> = { premier_contact: 15, demo: 17 };

for (const [nom, carte, scenario] of [
  ['premier_contact', carteContact, scenarioContact],
  ['demo', carteDemo, scenarioDemo],
] as const) {
  test(`la passe d’ombres de ${nom} tient sous son plafond de formes`, () => {
    const { etat, cat } = etatDeScenario(carte, scenario);
    const monde = batirMonde(etat, cat);
    const formes = lotsDOmbre(monde.scene).flat();
    const porteurs = porteursOmbre(monde.scene);
    assert.ok(
      formes.length <= PLAFOND_OMBRES[nom]!,
      `${formes.length} formes d’ombre pour ${porteurs.length} porteurs, plafond ${PLAFOND_OMBRES[nom]!}`,
    );
    assert.ok(formes.length < porteurs.length, 'la déduplication doit servir à quelque chose');
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

test('une famille éteinte par l’appelant se préchauffe quand même, et le reste', async () => {
  // La révélation en deux temps (`index.ts`) bâtit décor et unités **groupe
  // éteint** : sans remonter toute la chaîne des porteurs, `_projectObject`
  // s'arrêtait sur le groupe et le lot ne compilait rien — en silence.
  const { scene, porteur, porte, cache } = sceneEssai();
  const famille = scene.children[0]!;
  famille.visible = false;
  const compilees = new Set<THREE.Object3D>();
  await prechauffer({
    compileAsync: (s): Promise<void> => {
      const descendre = (o: THREE.Object3D): void => {
        if (!o.visible) return;
        if ((o as THREE.Mesh).isMesh) compilees.add(o);
        for (const e of o.children) descendre(e);
      };
      descendre(s);
      return Promise.resolve();
    },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => Promise.resolve() });

  assert.deepEqual(compilees, new Set([porteur, porte, cache]), 'les trois mailles de la famille éteinte');
  assert.equal(famille.visible, false, 'et la famille reste éteinte : c’est l’appelant qui la rallume');
  assert.equal(cache.visible, false);
  assert.equal(porteur.visible, true);
});

// ---------------------------------------------------------------------------
// Le préchauffage de la passe d'ombres
// ---------------------------------------------------------------------------

/** Une scène de porteurs d'ombre : deux formes, dont une en trois exemplaires. */
function scenePorteurs(): {
  scene: THREE.Scene; soleil: THREE.DirectionalLight;
  jumeaux: THREE.Mesh[]; autre: THREE.Mesh; sansOmbre: THREE.Mesh;
} {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshStandardNodeMaterial();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const famille = new THREE.Group();
  const jumeaux = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(cube, mat);
    m.castShadow = true;
    return m;
  });
  // Une sphère aurait la **même** clé qu'un cube : mêmes attributs, même index.
  // Ce qui sépare deux programmes, c'est la forme des attributs — ici une
  // couleur par sommet, que le nuanceur doit lire.
  const teintee = new THREE.BoxGeometry(1, 1, 1);
  teintee.setAttribute('color', new THREE.BufferAttribute(new Float32Array(teintee.attributes['position']!.count * 3), 3));
  const autre = new THREE.Mesh(teintee, mat);
  autre.castShadow = true;
  const sansOmbre = new THREE.Mesh(cube, mat);
  famille.add(...jumeaux, autre, sansOmbre);
  const soleil = new THREE.DirectionalLight();
  soleil.castShadow = true;
  scene.add(famille, soleil);
  return { scene, soleil, jumeaux, autre, sansOmbre };
}

test('la signature d’ombre confond ce qui partage géométrie, type et réception', () => {
  const { jumeaux, autre } = scenePorteurs();
  assert.equal(signatureOmbre(jumeaux[0]!), signatureOmbre(jumeaux[1]!), 'même forme, même programme');
  assert.notEqual(signatureOmbre(jumeaux[0]!), signatureOmbre(autre), 'une couleur par sommet sépare');
  jumeaux[1]!.receiveShadow = true;
  assert.notEqual(signatureOmbre(jumeaux[0]!), signatureOmbre(jumeaux[1]!), '`receiveShadow` entre dans la clé');
});

test('un lot instancié compte pour lui seul : r170 met son uuid dans la clé', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  const a = new THREE.InstancedMesh(geo, mat, 4);
  const b = new THREE.InstancedMesh(geo, mat, 4);
  assert.notEqual(signatureOmbre(a), signatureOmbre(b));
});

test('les lots d’ombre ne gardent qu’un représentant par forme', () => {
  const { scene, jumeaux, autre, sansOmbre } = scenePorteurs();
  const lots = lotsDOmbre(scene);
  const tous = lots.flat();
  assert.equal(tous.length, 2, 'trois cubes nus et un cube teinté : deux programmes');
  assert.ok(tous.includes(autre));
  assert.ok(tous.some((o) => jumeaux.includes(o as THREE.Mesh)));
  assert.ok(!tous.includes(sansOmbre), 'ce qui ne porte pas ombre n’a pas de programme d’ombre');
});

test('le préchauffage des ombres n’allume qu’un lot à la fois, puis rend tout', async () => {
  const { scene, soleil, jumeaux, autre, sansOmbre } = scenePorteurs();
  const vues: number[] = [];
  const recalculs: number[] = [];
  await prechaufferOmbres({
    renderAsync: (s): Promise<void> => {
      let n = 0;
      s.traverse((o) => { if (o.castShadow === true && (o as THREE.Mesh).isMesh) n += 1; });
      vues.push(n);
      recalculs.push(soleil.shadow.needsUpdate ? 1 : 0);
      return Promise.resolve();
    },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => Promise.resolve() });

  assert.deepEqual(vues, [1, 2], 'un porteur au premier rendu, deux au second : les lots s’accumulent');
  assert.deepEqual(recalculs, [1, 1], 'et chaque rendu redemande la carte d’ombre');
  assert.ok(jumeaux.every((m) => m.castShadow), 'tous les porteurs sont rendus à la fin');
  assert.equal(autre.castShadow, true);
  assert.equal(sansOmbre.castShadow, false, 'et qui n’en portait pas n’en porte toujours pas');
  assert.equal(soleil.shadow.needsUpdate, true, 'la première vraie image redessine la carte entière');
});

test('sans lumière qui porte ombre, on ne rend rien du tout', async () => {
  const { scene, soleil } = scenePorteurs();
  soleil.castShadow = false;
  let appels = 0;
  await prechaufferOmbres({
    renderAsync: (): Promise<void> => { appels += 1; return Promise.resolve(); },
  }, scene, new THREE.PerspectiveCamera(), { pause: () => Promise.resolve() });
  assert.equal(appels, 0);
});

test('un rendu d’ombre qui échoue n’emporte pas les autres, et trois échecs arrêtent tout', async () => {
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  const mat = new THREE.MeshStandardNodeMaterial();
  // Six formes distinctes : six lots instanciés, que r170 sépare par leur `uuid`
  // dès que le compte dépasse un — six boîtes de tailles différentes n'en
  // feraient qu'un seul, la clé ne regardant pas les données.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const porteurs = [0, 1, 2, 3, 4, 5].map(() => {
    const m = new THREE.InstancedMesh(geo, mat, 4);
    m.castShadow = true;
    return m;
  });
  groupe.add(...porteurs);
  const soleil = new THREE.DirectionalLight();
  soleil.castShadow = true;
  scene.add(groupe, soleil);
  let appels = 0;
  await prechaufferOmbres({
    renderAsync: (): Promise<void> => {
      appels += 1;
      return Promise.reject(new Error('pas de carte graphique'));
    },
  }, scene, new THREE.PerspectiveCamera(), { taille: 1, pause: () => Promise.resolve() });
  assert.equal(appels, 3, 'trois essais, puis on renonce');
  assert.ok(porteurs.every((o) => o.castShadow), 'et tous les porteurs sont rendus');
});

test('un représentant d’ombre est pris allumé quand il en existe un', async () => {
  // Un rendu ne compile que ce qu'il dessine : un représentant éteint laisserait
  // sa forme froide tout en occupant sa place.
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial();
  const eteint = new THREE.Mesh(geo, mat);
  eteint.castShadow = true;
  eteint.visible = false;
  const allume = new THREE.Mesh(geo, mat);
  allume.castShadow = true;
  groupe.add(eteint, allume);
  const soleil = new THREE.DirectionalLight();
  soleil.castShadow = true;
  scene.add(groupe, soleil);

  assert.deepEqual(lotsDOmbre(scene).flat(), [allume], 'un seul programme, et c’est celui qu’on peut dessiner');

  // Et si le porteur entier est éteint, on prend ce qu'il y a : le rallumer est
  // l'affaire de l'appelant, qui le fait avant d'appeler (`index.ts`).
  groupe.visible = false;
  assert.equal(lotsDOmbre(scene).flat().length, 1);
});
