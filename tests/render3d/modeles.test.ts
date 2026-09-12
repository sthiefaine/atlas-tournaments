/**
 * La conformation d'un modèle livré (`src/render3d/modeles.ts`), sans WebGL
 * ni réseau : des groupes three construits en mémoire, et un GLB fabriqué par
 * `tests/assets/glb.ts` pour le chemin d'analyse.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { genererSpecs, nomModele } from '../../src/assets/index';
import {
  analyserGlb, appliquerMasque, candidatsModele, clipEnBoucle, clonerMateriauNoeud, conformerModele, convertirMateriaux,
  couleurMasquee, couleurPour, creerChargeurModeles, creerLecteurClips, definirMasque, estMateriauStandard, estNomClip,
  indexTextureMasque, lireInventaireReseau, masqueDe, NOEUD_MASQUE_EQUIPE, NOM_FIGURINE, NOM_NIVEAUX,
  NOM_ORIENTATION, nomFichierModele, nomsClips, PROP_COULEUR_EQUIPE, PROP_MASQUE_EQUIPE, PROPORTIONS, ROTATION_AVANT,
  ROUTE_INVENTAIRE, teinterModele, versMateriauNoeud, type LectureFichier, type MateriauMasque,
} from '../../src/render3d/modeles';
import { Materiaux } from '../../src/render3d/unites';
import { binTriangle, construireGlb, documentTest } from '../assets/glb';

/** Une scène livrée : un nœud `corps` porteur d'une boîte, posée au sol, l'avant en +Z. */
function sceneLivree(nom = 'corps', taille: [number, number, number] = [0.6, 0.5, 0.8]): THREE.Group {
  const scene = new THREE.Group();
  const geo = new THREE.BoxGeometry(...taille);
  geo.translate(0, taille[1] / 2, 0);
  const maille = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'mat_corps' }));
  maille.name = nom;
  scene.add(maille);
  return scene;
}

/** Un clip qui déplace un nœud nommé en X, de `de` à `vers`, en une seconde. */
function clipPosition(nom: string, noeud: string, de: number, vers: number): THREE.AnimationClip {
  return new THREE.AnimationClip(nom, 1, [
    new THREE.VectorKeyframeTrack(`${noeud}.position`, [0, 1], [de, 0, 0, vers, 0, 0]),
  ]);
}

// ---------------------------------------------------------------------------
// Orientation, échelle, gabarit
// ---------------------------------------------------------------------------

test('l’avant livré en +Z regarde +X une fois conformé, et c’est +π/2 qui le fait', () => {
  const niveau = sceneLivree();
  const { objet } = conformerModele({ niveaux: [niveau], clips: [], kit: false });
  assert.equal(objet.name, NOM_FIGURINE);
  assert.equal(ROTATION_AVANT, Math.PI / 2);
  objet.updateMatrixWorld(true);
  const lod0 = objet.getObjectByName('lod0');
  assert.ok(lod0, 'le niveau livré est renommé lod0');
  // Un point à +Z du modèle livré : après conformation, il est à +X du rendu.
  const avant = lod0.localToWorld(new THREE.Vector3(0, 0, 1));
  assert.ok(Math.abs(avant.x - 1) < 1e-9, `x = ${avant.x}`);
  assert.ok(Math.abs(avant.z) < 1e-9, `z = ${avant.z}`);
  assert.ok(Math.abs(avant.y) < 1e-9);
  // Le signe n'est pas une convention qu'on suppose : −π/2 enverrait l'avant sur −X.
  const inverse = new THREE.Object3D();
  inverse.rotation.y = -Math.PI / 2;
  inverse.updateMatrixWorld(true);
  assert.ok(inverse.localToWorld(new THREE.Vector3(0, 0, 1)).x < 0);
});

/** L'emprise monde d'un modèle conformé : ce que le joueur verra, pas ce que dit un `scale`. */
function emprise(objet: THREE.Object3D): { x: number; y: number; z: number } {
  objet.updateMatrixWorld(true);
  const taille = new THREE.Box3().setFromObject(objet).getSize(new THREE.Vector3());
  return { x: Number(taille.x.toFixed(6)), y: Number(taille.y.toFixed(6)), z: Number(taille.z.toFixed(6)) };
}

test('aucune échelle de taille sur un modèle livré, mais le gabarit de la nation s’applique', () => {
  const b = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false }, 'b');
  assert.deepEqual(b.objet.scale.toArray(), [1, 1, 1]);
  assert.ok(Math.abs(b.hauteur - 0.5) < 1e-6, `une boîte de 0,5 reste haute de 0,5 (${b.hauteur})`);

  const c = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false }, 'c');
  assert.deepEqual(c.objet.scale.toArray(), PROPORTIONS.c);
  assert.ok(Math.abs(c.hauteur - 0.5 * PROPORTIONS.c[1]) < 1e-6, 'la hauteur suit le gabarit');
  const a = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false }, 'a');
  assert.deepEqual(a.objet.scale.toArray(), PROPORTIONS.a);
  // Le gabarit et la rotation vont sur des enveloppes, jamais sur le nœud livré :
  // les clips l'animeraient par-dessus.
  assert.deepEqual(a.objet.getObjectByName('lod0')!.scale.toArray(), [1, 1, 1]);
  assert.equal(a.objet.getObjectByName('lod0')!.rotation.y, 0);
  assert.equal(a.objet.getObjectByName(NOM_ORIENTATION)!.rotation.y, ROTATION_AVANT);
});

test('le gabarit s’applique dans le repère du rendu : la longueur en X, la largeur en Z', () => {
  // Un modèle livré large de 1 (X du fichier) et long de 2 (Z du fichier, l'avant).
  const livre = (): THREE.Group => sceneLivree('corps', [1, 0.5, 2]);
  // Sans gabarit, la rotation seule : la longueur du fichier devient le X du rendu.
  assert.deepEqual(emprise(conformerModele({ niveaux: [livre()], clips: [], kit: false }, 'b').objet), { x: 2, y: 0.5, z: 1 });
  // En `c`, allongé : 2 × 1,14 de long en X, 1 × 0,95 de large en Z — comme le
  // placeholder. Sur un seul nœud, three composerait T·R·S et l'échelle
  // s'appliquerait dans le repère du fichier : 1,90 de long et 1,14 de large.
  assert.deepEqual(
    emprise(conformerModele({ niveaux: [livre()], clips: [], kit: false }, 'c').objet),
    { x: Number((2 * PROPORTIONS.c[0]).toFixed(6)), y: Number((0.5 * PROPORTIONS.c[1]).toFixed(6)), z: Number((1 * PROPORTIONS.c[2]).toFixed(6)) },
  );
  assert.deepEqual(
    emprise(conformerModele({ niveaux: [livre()], clips: [], kit: false }, 'a').objet),
    { x: Number((2 * PROPORTIONS.a[0]).toFixed(6)), y: Number((0.5 * PROPORTIONS.a[1]).toFixed(6)), z: Number((1 * PROPORTIONS.a[2]).toFixed(6)) },
  );
});

test('les niveaux livrés sont clonés, jamais volés à la lecture partagée', () => {
  const niveau = sceneLivree();
  const lu = { niveaux: [niveau], clips: [], kit: false };
  const un = conformerModele(lu);
  const deux = conformerModele(lu);
  assert.equal(niveau.parent, null, 'la scène lue n’a pas été reparentée');
  assert.notEqual(un.objet.getObjectByName('lod0'), deux.objet.getObjectByName('lod0'));
  assert.ok(un.objet.getObjectByName('corps'), 'les noms de nœuds survivent au clone');
});

// ---------------------------------------------------------------------------
// Niveaux de détail
// ---------------------------------------------------------------------------

test('seul le LOD0 est conservé même si une ancienne source fournit plusieurs niveaux', () => {
  const m = conformerModele({ niveaux: [sceneLivree(), sceneLivree(), sceneLivree()], clips: [], kit: false });
  assert.equal(m.lods, 1);
  assert.ok(m.objet.getObjectByName('lod0'));
  assert.equal(m.objet.getObjectByName('lod1'), undefined);
  assert.equal(m.objet.getObjectByName(NOM_NIVEAUX), undefined);
  assert.ok(m.objet.getObjectByName('lod0')!.visible);
  assert.throws(() => conformerModele({ niveaux: [], clips: [], kit: false }), /lod0/);
});

// Teinte : base, kit, masque
// ---------------------------------------------------------------------------

const palette = { main: '#2f5fd0', dark: '#1b3a86', light: '#8fb2f2', accents: ['#c8324a'] };

test('la règle de couleur par nom de matériau : tout le corps sur une base, le seul liseré sur un kit', () => {
  assert.equal(couleurPour('mat_corps', false, palette, '#e04b45'), '#2f5fd0');
  assert.equal(couleurPour('mat_details', false, palette, '#e04b45'), '#1b3a86');
  assert.equal(couleurPour('equipe_flancs', false, palette, '#e04b45'), '#2f5fd0', 'tolérance : equipe* prend la palette');
  assert.equal(couleurPour('accent_fanion', false, palette, '#e04b45'), '#c8324a', 'accent* prend le premier accent');
  assert.equal(couleurPour('accent', false, { main: '#111111', dark: '#222222', light: '#333333' }, '#e04b45'), '#333333', 'sans accent, le clair');
  assert.equal(couleurPour('mat_chenilles', false, palette, '#e04b45'), null, 'un matériau inconnu reste neutre');
  assert.equal(couleurPour('mat_kit', true, palette, '#e04b45'), null, 'un kit arrive peint');
  assert.equal(couleurPour('mat_corps', true, palette, '#e04b45'), null);
  assert.equal(couleurPour('mat_ornements', true, palette, '#e04b45'), null);
  assert.equal(couleurPour('equipe_socle', true, palette, '#e04b45'), '#e04b45', 'le liseré prend la couleur du camp');
});

test('teinter une base recolore des clones et laisse l’original neutre', () => {
  const scene = sceneLivree();
  const detailsLivres = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ name: 'mat_details' }));
  detailsLivres.name = 'details';
  scene.add(detailsLivres);
  const original = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const { objet } = conformerModele({ niveaux: [scene], clips: [], kit: false });
  teinterModele(objet, 0, { style: { palette } as never });
  const corps = objet.getObjectByName('corps') as THREE.Mesh;
  const mat = corps.material as THREE.MeshStandardNodeMaterial;
  assert.notEqual(mat, original, 'le matériau teinté est un clone');
  assert.ok(mat instanceof THREE.MeshStandardNodeMaterial, 'à nœuds : le classique du fichier a été converti à la conformation');
  assert.equal(`#${mat.color.getHexString()}`, palette.main);
  assert.equal(original.color.getHexString(), 'ffffff', 'l’original n’a pas bougé');
  assert.equal(corps.castShadow, true);
  const details = objet.getObjectByName('details') as THREE.Mesh;
  assert.equal(`#${(details.material as THREE.MeshStandardNodeMaterial).color.getHexString()}`, palette.dark);

  // Sans style, la palette du camp : le bleu du camp 0.
  const sansStyle = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false });
  teinterModele(sansStyle.objet, 0);
  const bleu = (sansStyle.objet.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
  assert.equal(`#${bleu.color.getHexString()}`, '#3f86e0');
});

test('teinter un kit ne touche pas le corps : seul le liseré prend la couleur du camp', () => {
  const scene = new THREE.Group();
  const corps = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'mat_kit', color: 0x123456 }));
  corps.name = 'corps';
  const socle = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshStandardMaterial({ name: 'equipe_socle' }));
  socle.name = 'socle';
  scene.add(corps, socle);
  const { objet } = conformerModele({ niveaux: [scene], clips: [], kit: true });
  teinterModele(objet, 1, { style: { palette } as never, kit: true });
  const kit = (objet.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
  assert.equal(kit.color.getHex(), 0x123456, 'la livrée du kit reste sienne');
  const lisere = (objet.getObjectByName('socle') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
  assert.equal(`#${lisere.color.getHexString()}`, '#e04b45', 'le rouge du camp 1, pas la palette de la nation');
});

test('un matériau masqué mélange la couleur par un nœud partagé et garde son albédo', () => {
  const scene = sceneLivree();
  const original = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const masque = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  definirMasque(original, masque);
  assert.equal(masqueDe(original), masque);
  const { objet } = conformerModele({ niveaux: [scene], clips: [], kit: false });
  teinterModele(objet, 0, { style: { palette } as never });
  const teinte = (objet.getObjectByName('corps') as THREE.Mesh).material as MateriauMasque;
  assert.notEqual(teinte, original);
  assert.ok(teinte instanceof THREE.MeshStandardNodeMaterial, 'un nœud ne se pose que sur un matériau à nœuds');
  assert.equal(teinte.color.getHexString(), 'ffffff', 'l’albédo n’est pas teinté : c’est le masque qui mélange');
  assert.equal(masqueDe(teinte), masque, 'le masque suit le clone');
  assert.equal(`#${couleurMasquee(teinte)!.getHexString()}`, palette.main);

  // Le nœud de couleur est **l'objet partagé** : la clé de programme d'un
  // matériau à nœuds est faite des identités de ses nœuds, un graphe unique
  // fait donc un seul programme pour tous les masques. Ce qui varie — la
  // texture, la couleur — est lu sur le matériau, où le nœud le trouve.
  assert.equal(teinte.colorNode, NOEUD_MASQUE_EQUIPE, 'un seul programme pour tous les masques');
  assert.ok(NOEUD_MASQUE_EQUIPE.isNode, 'le nœud est un nœud TSL');
  assert.equal(teinte[PROP_MASQUE_EQUIPE], masque, 'la texture que le nœud lit');
  assert.equal(teinte[PROP_COULEUR_EQUIPE], couleurMasquee(teinte), 'et la couleur, le même objet vivant');
  assert.equal((original as unknown as { colorNode?: unknown }).colorNode, undefined, 'l’original classique n’a rien reçu');

  // Un second modèle masqué, d'un autre camp : même nœud, autre couleur.
  const autre = sceneLivree();
  definirMasque((autre.children[0] as THREE.Mesh).material as THREE.Material, masque);
  const second = conformerModele({ niveaux: [autre], clips: [], kit: false });
  teinterModele(second.objet, 1);
  const rouge = (second.objet.getObjectByName('corps') as THREE.Mesh).material as MateriauMasque;
  assert.equal(rouge.colorNode, NOEUD_MASQUE_EQUIPE);
  assert.equal(`#${rouge[PROP_COULEUR_EQUIPE]!.getHexString()}`, '#e04b45', 'le rouge du camp 1');
  assert.notEqual(rouge[PROP_COULEUR_EQUIPE], teinte[PROP_COULEUR_EQUIPE], 'chacun sa couleur, sur lui-même');
});

test('le double terni d’un matériau masqué garde le nœud et reçoit texture et couleur d’équipe inchangées', () => {
  // Depuis le 6 septembre 2026, une unité qui a joué ne change que d'opacité :
  // le clone terni garde la teinte de l'original et mélange la même couleur
  // d'équipe. Le clone d'un matériau à nœuds garde `colorNode` de lui-même ;
  // ce que le nœud lit sur le matériau, `Materiaux.translucide` le lui rend.
  const materiaux = new Materiaux();
  const origine = new THREE.MeshStandardNodeMaterial({ color: palette.main });
  const masque = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  const couleur = new THREE.Color(palette.main);
  appliquerMasque(origine, masque, couleur);
  const terni = materiaux.terni(origine) as MateriauMasque;
  assert.equal(terni.color.getHexString(), origine.color.getHexString(), 'même teinte');
  assert.equal(terni.transparent, true);
  assert.equal(terni.colorNode, NOEUD_MASQUE_EQUIPE, 'le nœud a suivi le clone');
  assert.equal(masqueDe(terni), masque, 'le masque est rendu au double');
  assert.equal(terni[PROP_MASQUE_EQUIPE], masque);
  assert.equal(terni[PROP_COULEUR_EQUIPE], couleur, 'la couleur d’équipe même, pas une copie ternie');
  // Un clone nu, lui, garde le nœud sans ce qu'il lit : c'est le cas que le double corrige.
  const nu = origine.clone() as MateriauMasque;
  assert.equal(nu.colorNode, NOEUD_MASQUE_EQUIPE);
  assert.equal(nu[PROP_MASQUE_EQUIPE], undefined, 'Material.copy ne connaît pas nos propriétés');
  assert.equal(masqueDe(nu), null, 'et masqueDe le dit : le masque est à rendre');
  materiaux.dispose();
});

// ---------------------------------------------------------------------------
// Les matériaux classiques d'un fichier deviennent des matériaux à nœuds
// ---------------------------------------------------------------------------

test('un matériau classique devient son jumeau à nœuds, tous champs copiés, masque compris', () => {
  const carte = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const normales = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  const masque = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  const classique = new THREE.MeshStandardMaterial({
    name: 'mat_corps', color: 0x123456, roughness: 0.3, metalness: 0.7, map: carte, normalMap: normales,
    emissive: 0x00ff00, emissiveIntensity: 0.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    alphaTest: 0.2, envMapIntensity: 2,
  });
  classique.normalScale.set(0.5, 0.25);
  classique.userData['gltfExtensions'] = { x: 1 };
  definirMasque(classique, masque);

  const jumeau = versMateriauNoeud(classique) as THREE.MeshStandardNodeMaterial;
  assert.ok(jumeau instanceof THREE.MeshStandardNodeMaterial);
  assert.notEqual(jumeau, classique);
  assert.notEqual(jumeau.uuid, classique.uuid, 'un objet neuf');
  assert.equal(jumeau.name, 'mat_corps');
  assert.equal(jumeau.color.getHex(), 0x123456);
  assert.equal(jumeau.roughness, 0.3);
  assert.equal(jumeau.metalness, 0.7);
  assert.equal(jumeau.map, carte);
  assert.equal(jumeau.normalMap, normales);
  assert.deepEqual([jumeau.normalScale.x, jumeau.normalScale.y], [0.5, 0.25]);
  assert.equal(jumeau.emissive.getHex(), 0x00ff00);
  assert.equal(jumeau.emissiveIntensity, 0.5);
  assert.equal(jumeau.transparent, true);
  assert.equal(jumeau.opacity, 0.4);
  assert.equal(jumeau.side, THREE.DoubleSide);
  assert.equal(jumeau.alphaTest, 0.2);
  assert.equal(jumeau.envMapIntensity, 2);
  assert.deepEqual(jumeau.userData, { gltfExtensions: { x: 1 } });
  assert.equal(masqueDe(jumeau), masque, 'le masque tenu à côté du classique suit le jumeau');
  assert.ok(estMateriauStandard(jumeau) && estMateriauStandard(classique), 'standard, l’un et l’autre');
  assert.equal(versMateriauNoeud(jumeau), jumeau, 'un matériau à nœuds est rendu tel quel');

  // Physique → physique, basique → basique ; tout autre reste ce qu'il est.
  const physique = versMateriauNoeud(new THREE.MeshPhysicalMaterial({ clearcoat: 0.6, transmission: 0.2 }));
  assert.ok(physique instanceof THREE.MeshPhysicalNodeMaterial);
  assert.equal((physique as THREE.MeshPhysicalNodeMaterial).clearcoat, 0.6);
  assert.equal((physique as THREE.MeshPhysicalNodeMaterial).transmission, 0.2);
  const basique = versMateriauNoeud(new THREE.MeshBasicMaterial({ color: 0xabcdef }));
  assert.ok(basique instanceof THREE.MeshBasicNodeMaterial);
  assert.equal((basique as THREE.MeshBasicNodeMaterial).color.getHex(), 0xabcdef);
  const ligne = new THREE.LineBasicMaterial();
  assert.equal(versMateriauNoeud(ligne), ligne, 'pas de jumeau connu : tel quel');
});

test('convertir un objet partage le jumeau entre les maillages qui partageaient le matériau, et la conformation ne laisse aucun classique', () => {
  const scene = sceneLivree();
  const partage = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const second = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), partage);
  second.name = 'second';
  const tableau = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), [partage, new THREE.MeshStandardMaterial({ name: 'mat_details' })]);
  tableau.name = 'tableau';
  scene.add(second, tableau);

  const copie = scene.clone();
  const crees = convertirMateriaux(copie);
  assert.equal(crees.length, 2, 'deux classiques distincts, deux jumeaux');
  const a = (copie.getObjectByName('corps') as THREE.Mesh).material;
  const b = (copie.getObjectByName('second') as THREE.Mesh).material;
  const c = (copie.getObjectByName('tableau') as THREE.Mesh).material as THREE.Material[];
  assert.ok(a instanceof THREE.MeshStandardNodeMaterial);
  assert.equal(a, b, 'un matériau partagé n’a qu’un jumeau, partagé de même');
  assert.equal(c[0], a, 'jusque dans un tableau de matériaux');
  assert.ok(c[1] instanceof THREE.MeshStandardNodeMaterial);
  assert.equal((scene.children[0] as THREE.Mesh).material, partage, 'la source n’est pas touchée');
  assert.deepEqual(convertirMateriaux(copie), [], 'convertir deux fois ne crée rien');

  // La conformation convertit ses clones et laisse la scène lue intacte.
  const { objet } = conformerModele({ niveaux: [scene], clips: [], kit: false });
  objet.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      assert.ok((m as { isNodeMaterial?: boolean }).isNodeMaterial, `${o.name} : un matériau à nœuds`);
    }
  });
  assert.equal(((scene.getObjectByName('tableau') as THREE.Mesh).material as THREE.Material[])[0], partage);
});

test('le clone complet d’un matériau à nœuds garde couleur, matière et cartes, que `clone()` perd en r170', () => {
  const carte = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const origine = new THREE.MeshStandardNodeMaterial({
    name: 'mat_corps', color: 0x2f5fd0, roughness: 0.3, metalness: 0.7, map: carte, emissive: 0x2f5fd0,
    emissiveIntensity: 0.045, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  });
  origine.colorNode = NOEUD_MASQUE_EQUIPE;
  // Le constat, d'abord : sans quoi la fonction n'aurait pas de raison d'être.
  const nu = origine.clone();
  assert.equal(nu.colorNode, NOEUD_MASQUE_EQUIPE, 'clone() garde les nœuds');
  assert.equal(nu.opacity, 0.6, 'et les champs de Material');
  assert.equal(nu.color.getHex(), 0xffffff, 'mais pas la couleur du standard : blanc');
  assert.equal(nu.map, null, 'ni ses cartes');

  const clone = clonerMateriauNoeud(origine);
  assert.notEqual(clone, origine);
  assert.equal(clone.colorNode, NOEUD_MASQUE_EQUIPE, 'les nœuds suivent');
  assert.equal(clone.name, 'mat_corps');
  assert.equal(clone.color.getHex(), 0x2f5fd0, 'la couleur aussi');
  assert.equal(clone.roughness, 0.3);
  assert.equal(clone.metalness, 0.7);
  assert.equal(clone.map, carte);
  assert.equal(clone.emissive.getHex(), 0x2f5fd0);
  assert.equal(clone.emissiveIntensity, 0.045);
  assert.equal(clone.transparent, true);
  assert.equal(clone.opacity, 0.6);
  assert.equal(clone.side, THREE.DoubleSide);
  // L'original n'a pas bougé, et un physique reste physique, ses champs avec lui.
  assert.equal(origine.color.getHex(), 0x2f5fd0);
  const physique = clonerMateriauNoeud(new THREE.MeshPhysicalNodeMaterial({ color: 0x123456, clearcoat: 0.4 }));
  assert.ok(physique instanceof THREE.MeshPhysicalNodeMaterial);
  assert.equal(physique.color.getHex(), 0x123456);
  assert.equal(physique.clearcoat, 0.4);
});

// ---------------------------------------------------------------------------
// Noms de fichiers, ordre de repli, lecture d'un GLB
// ---------------------------------------------------------------------------

test('le rendu compose le même nom de fichier que la spécification', () => {
  const spec = genererSpecs().find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec);
  for (const lod of [0] as const) assert.equal(nomFichierModele(spec.id, lod), nomModele(spec, lod));
  assert.equal(nomFichierModele('kit_fr_char_leger', 0), 'kit_fr_char_leger_lod0.glb');
});

test('l’ordre de repli : le kit de la nation, puis la base ; sans nation, la base seule', () => {
  assert.deepEqual(candidatsModele('char_leger', 'fr'), [
    { id: 'kit_fr_char_leger', kit: true },
    { id: 'unite_char_leger_base', kit: false },
  ]);
  assert.deepEqual(candidatsModele('char_leger', null), [{ id: 'unite_char_leger_base', kit: false }]);
});

test('le masque d’équipe se repère par le nom de son image, comme au validateur', () => {
  assert.equal(indexTextureMasque({
    images: [{ name: 'x_albedo' }, { uri: 'textures/x_masque_equipe.png' }],
    textures: [{ source: 0 }, { source: 1 }],
  }), 1);
  assert.equal(indexTextureMasque({ images: [{ name: 'x_team_mask' }], textures: [{ source: 0 }] }), 0);
  assert.equal(indexTextureMasque({ images: [{ name: 'x_masque_equipe' }], textures: [] }), -1, 'une image sans texture n’est pas chargeable');
  assert.equal(indexTextureMasque(undefined), -1);
});

test('un GLB fabriqué en mémoire s’analyse sous Node, et ses clips traversent la conformation', async () => {
  const octets = construireGlb(
    documentTest({ images: [], animations: ['repos', 'deplacement', 'inconnu'] }),
    binTriangle(0.62, 0.5, 0.85),
  );
  const lecture = await analyserGlb(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer);
  assert.ok(lecture, 'le GLB se lit');
  const noms: string[] = [];
  lecture.scene.traverse((o) => { if (o.name) noms.push(o.name); });
  assert.deepEqual(noms, ['racine', 'corps', 'base', 'module_tourelle']);
  assert.deepEqual(lecture.clips.map((c) => c.name), ['repos', 'deplacement', 'inconnu']);
  const modele = conformerModele({ niveaux: [lecture.scene], clips: lecture.clips, kit: false }, 'c');
  assert.deepEqual(nomsClips(modele.clips), ['repos', 'deplacement'], 'seuls les six noms comptent');
  assert.ok(modele.objet.getObjectByName('module_tourelle'), 'les nœuds imposés se retrouvent par leur nom');
  assert.equal(await analyserGlb(new Uint8Array(8).buffer), null, 'un conteneur cassé rend null, jamais une exception');
});

test('un GLB qui porte des images s’analyse sous Node, et un masque référencé par uri s’attache aux matériaux', async () => {
  // Le premier fichier livré l'a montré : dès qu'un GLB porte une image,
  // `GLTFLoader` lit `self.URL`, que Node n'a pas, et l'analyse rendait null.
  const doc = documentTest({ images: ['x_albedo', 'x_masque_equipe'], animations: ['repos'] });
  for (const image of doc['images'] as { name: string; uri?: string; bufferView?: number }[]) {
    image.uri = `${image.name}.png`;
    delete image.bufferView;
  }
  const octets = construireGlb(doc, binTriangle(0.62, 0.5, 0.85));
  const tampon = (): ArrayBuffer => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer;
  const materiau = (scene: THREE.Group): THREE.MeshStandardNodeMaterial => (scene.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;

  // Sans lecteur d'image — Node n'en a pas —, le modèle passe et ses cartes valent null.
  const nu = await analyserGlb(tampon());
  assert.ok(nu, 'un fichier à images se lit sous Node');
  assert.equal(masqueDe(materiau(nu.scene)), null, 'sans image décodée, pas de masque');
  assert.ok(materiau(nu.scene) instanceof THREE.MeshStandardNodeMaterial, 'la lecture rend des matériaux à nœuds, une fois pour toutes les nations');

  // Avec un lecteur injecté par le gestionnaire de chargement, le masque se retrouve par son nom.
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.png$/i, {
    load(_url: string, onLoad: (t: THREE.Texture) => void): THREE.Texture {
      const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      t.needsUpdate = true;
      onLoad(t);
      return t;
    },
  } as unknown as THREE.Loader);
  const lu = await analyserGlb(tampon(), new GLTFLoader(manager));
  assert.ok(lu);
  const masque = masqueDe(materiau(lu.scene));
  assert.ok(masque, 'le masque est attaché au matériau standard');
  assert.equal(masque.colorSpace, THREE.NoColorSpace, 'un masque est une donnée, pas une couleur');
});

// ---------------------------------------------------------------------------
// Le chargeur : l'inventaire décide de ce qui est demandé
// ---------------------------------------------------------------------------

/** Un lecteur de test : il sert les noms qu'on lui donne, et note tout ce qu'on lui demande. */
function lecteurFactice(servis: readonly string[]): { lire(nom: string): Promise<LectureFichier | null>; demandes: string[] } {
  const demandes: string[] = [];
  return {
    demandes,
    lire: async (nom) => {
      demandes.push(nom);
      return servis.includes(nom) ? { scene: sceneLivree(), clips: [] } : null;
    },
  };
}

test('un inventaire vide ne coûte aucune requête : le placeholder reste, sans une sonde', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb']);
  const charger = creerChargeurModeles({ inventaire: async () => ({ modeles: {} }), lecteur: lecteur.lire });
  assert.equal(await charger('x', 'fr'), null);
  assert.equal(await charger('x', null), null);
  assert.deepEqual(lecteur.demandes, [], 'rien n’est listé, rien n’est demandé — même si le fichier existait');
});

test('un inventaire connu ne fait demander que ce qu’il liste, aux niveaux listés, dans l’ordre', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb', 'unite_x_base_lod1.glb', 'unite_x_base_lod2.glb']);
  const charger = creerChargeurModeles({
    inventaire: async () => ({ modeles: { unite_x_base: [0] } }),
    lecteur: lecteur.lire,
  });
  const modele = await charger('x', 'fr');
  assert.ok(modele);
  assert.equal(modele.lods, 1);
  assert.equal(modele.kit, false);
  assert.deepEqual(lecteur.demandes, ['unite_x_base_lod0.glb'],
    'le kit fr n’est pas listé : pas demandé ; le lod2 n’est pas listé : pas demandé');

  // Le résultat est mémorisé par couple, la lecture par nom : une seconde
  // nation qui retombe sur la même base ne relit rien.
  await charger('x', 'fr');
  const autre = await charger('x', 'lu');
  assert.ok(autre);
  assert.deepEqual(lecteur.demandes, ['unite_x_base_lod0.glb']);
});

test('un lod2 listé sans lod1 n’est pas un jeu de niveaux : on s’arrête au lod0', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb', 'unite_x_base_lod2.glb']);
  const charger = creerChargeurModeles({
    inventaire: async () => ({ modeles: { unite_x_base: [0], kit_fr_x: [] } }),
    lecteur: lecteur.lire,
  });
  const modele = await charger('x', 'fr');
  assert.ok(modele);
  assert.equal(modele.lods, 1);
  assert.deepEqual(lecteur.demandes, ['unite_x_base_lod0.glb'], 'un kit sans lod0 n’est même pas essayé');
});

test('sans inventaire, le chargeur sonde chaque candidat comme avant, un 404 par nom au plus', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb', 'unite_x_base_lod1.glb']);
  const charger = creerChargeurModeles({ inventaire: async () => null, lecteur: lecteur.lire });
  const modele = await charger('x', 'fr');
  assert.ok(modele);
  assert.equal(modele.lods, 1);
  assert.deepEqual(lecteur.demandes, [
    'kit_fr_x_lod0.glb', 'unite_x_base_lod0.glb',
  ]);
  await charger('x', 'lu');
  assert.deepEqual(lecteur.demandes.slice(2), ['kit_lu_x_lod0.glb'], 'la base déjà lue n’est pas relue');
  assert.equal(await charger('y', null), null);
  assert.deepEqual(lecteur.demandes.slice(3), ['unite_y_base_lod0.glb']);
  // Un inventaire qui échoue vaut « inconnu », pas une exception.
  const casse = creerChargeurModeles({ inventaire: async () => { throw new Error('hors ligne'); }, lecteur: lecteur.lire });
  assert.ok(await casse('x', null));
});

test('l’inventaire réseau rend null sur tout ce qui n’est pas une réponse valide', async () => {
  const reponse = (statut: number, corps: unknown): Promise<Response> => Promise.resolve(
    new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } }),
  );
  let url = '';
  assert.deepEqual(await lireInventaireReseau((u) => { url = u; return reponse(200, { modeles: { unite_x_base: [0] } }); }), { modeles: { unite_x_base: [0] } });
  assert.equal(url, ROUTE_INVENTAIRE);
  assert.equal(await lireInventaireReseau(() => reponse(404, { error: 'introuvable' })), null, 'route absente');
  assert.equal(await lireInventaireReseau(() => reponse(200, { autre: 1 })), null, 'une autre forme');
  assert.equal(await lireInventaireReseau(() => Promise.resolve(new Response('pas du json', { status: 200 }))), null);
  assert.equal(await lireInventaireReseau(() => Promise.reject(new Error('hors ligne'))), null);
});

// ---------------------------------------------------------------------------
// Le lecteur de clips
// ---------------------------------------------------------------------------

test('les six noms, et ceux qui bouclent', () => {
  assert.deepEqual(['repos', 'deplacement'].map((n) => clipEnBoucle(n as never)), [true, true]);
  assert.deepEqual(['tir', 'touche', 'hors_jeu', 'capture'].map((n) => clipEnBoucle(n as never)), [false, false, false, false]);
  assert.equal(estNomClip('capture'), true);
  assert.equal(estNomClip('marche'), false);
});

test('le lecteur joue repos, fond vers deplacement, retombe sur repos pour un clip absent', () => {
  const { objet } = conformerModele({
    niveaux: [sceneLivree('noeud')],
    clips: [clipPosition('repos', 'noeud', 0, 0.1), clipPosition('deplacement', 'noeud', 0, 1)],
    kit: false,
  });
  const noeud = objet.getObjectByName('noeud')!;
  const lecteur = creerLecteurClips(objet, [clipPosition('repos', 'noeud', 0, 0.1), clipPosition('deplacement', 'noeud', 0, 1)]);
  assert.ok(lecteur);
  assert.deepEqual(lecteur.clips, ['repos', 'deplacement']);
  assert.equal(lecteur.courant, null);
  assert.equal(lecteur.avancer(0.1), false, 'rien ne joue avant le premier clip');

  lecteur.jouer('repos');
  assert.equal(lecteur.courant, 'repos');
  assert.equal(lecteur.avancer(0.5), true);
  assert.ok(Math.abs(noeud.position.x - 0.05) < 1e-6, `repos à mi-course : ${noeud.position.x}`);

  lecteur.jouer('deplacement');
  assert.equal(lecteur.courant, 'deplacement');
  // Le fondu dure 150 ms : au-delà, seule la marche pèse.
  lecteur.avancer(0.15);
  lecteur.avancer(0.35);
  assert.ok(noeud.position.x > 0.4, `la marche a pris la main : ${noeud.position.x}`);

  lecteur.jouer('tir');
  assert.equal(lecteur.courant, 'repos', 'un clip absent retombe sur repos, sans erreur');
  lecteur.dispose();
  assert.equal(lecteur.courant, null);
  assert.equal(lecteur.avancer(0.1), false);
});

test('un clip qui ne boucle pas joue une fois, ajusté à la durée du geste, puis revient au repos', () => {
  const clips = [clipPosition('repos', 'noeud', 0, 0), clipPosition('touche', 'noeud', 0, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud')], clips, kit: false });
  const lecteur = creerLecteurClips(objet, clips)!;
  lecteur.jouer('repos');
  lecteur.avancer(0.2);
  // Un clip d'une seconde, ajusté à un geste de 200 ms : fini au bout de 200 ms.
  lecteur.jouer('touche', 200);
  assert.equal(lecteur.courant, 'touche');
  assert.equal(lecteur.avancer(0.1), true);
  lecteur.avancer(0.15);
  assert.equal(lecteur.courant, 'repos', 'le clip fini rend la main au repos de lui-même');
  assert.equal(lecteur.avancer(0.1), true, 'et le repos boucle');
  lecteur.dispose();
});

test('sans repos, un clip fini s’arrête et le lecteur le dit', () => {
  const clips = [clipPosition('hors_jeu', 'noeud', 0, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud')], clips, kit: false });
  const lecteur = creerLecteurClips(objet, clips)!;
  lecteur.jouer('hors_jeu');
  lecteur.avancer(0.5);
  assert.equal(lecteur.avancer(0.6), false, 'plus rien à jouer');
  assert.equal(lecteur.courant, 'hors_jeu');
  lecteur.dispose();
  assert.equal(creerLecteurClips(objet, []), null, 'aucun clip connu : pas de lecteur');
});

test('la première image s’applique dès `jouer`, et sans fondu on saute à celle du clip demandé', () => {
  // Un repos qui ne pose pas le nœud là où le laisse la pose de liaison (0) :
  // c'est ce qui distingue « la première image » de « rien ».
  const clips = [clipPosition('repos', 'noeud', 0.2, 0.2), clipPosition('deplacement', 'noeud', 0.5, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud')], clips, kit: false });
  const noeud = objet.getObjectByName('noeud')!;
  const lecteur = creerLecteurClips(objet, clips)!;
  assert.equal(noeud.position.x, 0, 'pose de liaison avant tout');
  lecteur.jouer('repos');
  assert.ok(Math.abs(noeud.position.x - 0.2) < 1e-6, `la première image du repos, sans avancer : ${noeud.position.x}`);
  assert.equal(lecteur.enTransition, false, 'un premier clip n’a rien d’où fondre');

  lecteur.jouer('deplacement', 0, false);
  assert.ok(Math.abs(noeud.position.x - 0.5) < 1e-6, `sans fondu, la première image de la marche : ${noeud.position.x}`);
  assert.equal(lecteur.enTransition, false);

  // Avec fondu : en transition le temps du fondu, puis plus.
  lecteur.jouer('repos');
  assert.equal(lecteur.enTransition, true);
  lecteur.avancer(0.1);
  assert.equal(lecteur.enTransition, true, 'à 100 ms, le fondu de 150 ms n’est pas fini');
  lecteur.avancer(0.1);
  assert.equal(lecteur.enTransition, false);
  assert.ok(Math.abs(noeud.position.x - 0.2) < 1e-6, `le repos a tout le poids : ${noeud.position.x}`);
  lecteur.dispose();
});

test('chaque niveau de détail reçoit sa propre action, avancée en même temps', () => {
  const clips = [clipPosition('repos', 'noeud', 0, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud'), sceneLivree('noeud')], clips, kit: false });
  const lecteur = creerLecteurClips(objet, clips)!;
  lecteur.jouer('repos');
  lecteur.avancer(0.5);
  const position = objet.getObjectByName('lod0')!.getObjectByName('noeud')!.position.x;
  assert.equal(Number(position.toFixed(6)), 0.5);
  lecteur.dispose();
});


test('les normales quantifiées GLB deviennent compatibles WebGPU sans perdre leurs valeurs ni dupliquer les attributs partagés', () => {
  const normal = new THREE.Int16BufferAttribute([32767, 0, -32767, 16384, 0, 16384], 3, true);
  const source = Array.from(normal.array);
  const groupe = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('normal', normal);
    groupe.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()));
  }
  convertirMateriaux(groupe);
  const a = (groupe.children[0] as THREE.Mesh).geometry.getAttribute('normal');
  const b = (groupe.children[1] as THREE.Mesh).geometry.getAttribute('normal');
  assert.ok(a.array instanceof Float32Array);
  assert.equal(a.itemSize * a.array.BYTES_PER_ELEMENT % 4, 0);
  assert.equal(a.normalized, false); assert.equal(a.count, normal.count); assert.equal(a, b);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(a.getComponent(i,c) - normal.getComponent(i,c)) < 1e-7);
  assert.deepEqual(Array.from(normal.array), source);
  convertirMateriaux(groupe);
  assert.equal((groupe.children[0] as THREE.Mesh).geometry.getAttribute('normal'), a);
});
