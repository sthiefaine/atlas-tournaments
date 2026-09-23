/**
 * La lecture d'un GLB livré (`scripts/production/lecture-glb.ts`), sans WebGL
 * ni réseau : des groupes three construits en mémoire, et un GLB fabriqué par
 * `tests/assets/glb.ts` pour le chemin d'analyse.
 *
 * Ces tests accompagnaient le chargeur de la peau 3D (`tests/render3d/modeles.test.ts`)
 * et l'ont suivi quand la 3D temps réel a été retirée (23 septembre 2026) :
 * orientation, gabarit, lod0 seul, masque, ordre de repli, inventaire, lecteur
 * de clips. Ceux qui ne jugeaient que la 3D sont restés en arrière — la teinte
 * des matériaux par le nœud partagé du masque, les jumeaux à nœuds, les
 * attributs quantifiés réalignés pour WebGPU, l'inventaire lu sur le réseau.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { genererSpecs, nomModele } from '../../src/assets/index';
import {
  analyserGlb, candidatsModele, clipEnBoucle, conformerModele, creerChargeurModeles, creerLecteurClips,
  indexTextureMasque, masqueDe, NOM_FIGURINE, NOM_ORIENTATION, nomFichierModele, nomsClips, PROPORTIONS,
  ROTATION_AVANT, type LectureFichier,
} from '../../scripts/production/lecture-glb';
import { binTriangle, construireGlb, documentTest } from './glb';

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
  // Un point à +Z du modèle livré : après conformation, il est à +X.
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

/** L'emprise monde d'un modèle conformé : ce que la caméra verra, pas ce que dit un `scale`. */
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

test('le gabarit s’applique dans le repère conformé : la longueur en X, la largeur en Z', () => {
  // Un modèle livré large de 1 (X du fichier) et long de 2 (Z du fichier, l'avant).
  const livre = (): THREE.Group => sceneLivree('corps', [1, 0.5, 2]);
  // Sans gabarit, la rotation seule : la longueur du fichier devient le X.
  assert.deepEqual(emprise(conformerModele({ niveaux: [livre()], clips: [], kit: false }, 'b').objet), { x: 2, y: 0.5, z: 1 });
  // En `c`, allongé : 2 × 1,14 de long en X, 1 × 0,95 de large en Z. Sur un
  // seul nœud, three composerait T·R·S et l'échelle s'appliquerait dans le
  // repère du fichier : 1,90 de long et 1,14 de large.
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

test('seul le LOD0 est conservé même si une ancienne source fournit plusieurs niveaux', () => {
  const m = conformerModele({ niveaux: [sceneLivree(), sceneLivree(), sceneLivree()], clips: [], kit: false });
  assert.equal(m.lods, 1);
  assert.ok(m.objet.getObjectByName('lod0'));
  assert.equal(m.objet.getObjectByName('lod1'), undefined);
  assert.ok(m.objet.getObjectByName('lod0')!.visible);
  assert.throws(() => conformerModele({ niveaux: [], clips: [], kit: false }), /lod0/);
});

// ---------------------------------------------------------------------------
// Noms de fichiers, ordre de repli, lecture d'un GLB
// ---------------------------------------------------------------------------

test('la lecture compose le même nom de fichier que la spécification', () => {
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
  const materiau = (scene: THREE.Group): THREE.Material => (scene.getObjectByName('corps') as THREE.Mesh).material as THREE.Material;

  // Sans lecteur d'image — Node n'en a pas —, le modèle passe et ses cartes valent null.
  const nu = await analyserGlb(tampon());
  assert.ok(nu, 'un fichier à images se lit sous Node');
  assert.equal(masqueDe(materiau(nu.scene)), null, 'sans image décodée, pas de masque');
  assert.ok(materiau(nu.scene) instanceof THREE.MeshStandardMaterial, 'les matériaux restent ceux que GLTFLoader fabrique');

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

test('un inventaire vide ne coûte aucune lecture : rien n’est listé, rien n’est lu', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb']);
  const charger = creerChargeurModeles({ inventaire: async () => ({ modeles: {} }), lecteur: lecteur.lire });
  assert.equal(await charger('x', 'fr'), null);
  assert.equal(await charger('x', null), null);
  assert.deepEqual(lecteur.demandes, [], 'rien n’est listé, rien n’est demandé — même si le fichier existait');
});

test('un inventaire connu ne fait lire que ce qu’il liste, dans l’ordre', async () => {
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

test('un kit listé sans lod0 n’est même pas essayé : on s’arrête à la base', async () => {
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

test('sans inventaire, le chargeur essaie chaque candidat, un nom au plus une fois', async () => {
  const lecteur = lecteurFactice(['unite_x_base_lod0.glb', 'unite_x_base_lod1.glb']);
  const charger = creerChargeurModeles({ lecteur: lecteur.lire });
  const modele = await charger('x', 'fr');
  assert.ok(modele);
  assert.equal(modele.lods, 1);
  assert.deepEqual(lecteur.demandes, ['kit_fr_x_lod0.glb', 'unite_x_base_lod0.glb']);
  await charger('x', 'lu');
  assert.deepEqual(lecteur.demandes.slice(2), ['kit_lu_x_lod0.glb'], 'la base déjà lue n’est pas relue');
  assert.equal(await charger('y', null), null);
  assert.deepEqual(lecteur.demandes.slice(3), ['unite_y_base_lod0.glb']);
  // Un inventaire qui échoue vaut « inconnu », pas une exception.
  const casse = creerChargeurModeles({ inventaire: async () => { throw new Error('illisible'); }, lecteur: lecteur.lire });
  assert.ok(await casse('x', null));
});

// ---------------------------------------------------------------------------
// Le lecteur de clips
// ---------------------------------------------------------------------------

test('repos et deplacement bouclent, les autres clips jouent une fois', () => {
  assert.deepEqual(['repos', 'deplacement'].map((n) => clipEnBoucle(n as never)), [true, true]);
  assert.deepEqual(['tir', 'touche', 'hors_jeu', 'capture'].map((n) => clipEnBoucle(n as never)), [false, false, false, false]);
});

test('le lecteur joue repos, fond vers deplacement, retombe sur repos pour un clip absent', () => {
  const clips = [clipPosition('repos', 'noeud', 0, 0.1), clipPosition('deplacement', 'noeud', 0, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud')], clips, kit: false });
  const noeud = objet.getObjectByName('noeud')!;
  const lecteur = creerLecteurClips(objet, clips);
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

test('un clip qui ne boucle pas joue une fois, ajusté à la durée demandée, puis revient au repos', () => {
  const clips = [clipPosition('repos', 'noeud', 0, 0), clipPosition('touche', 'noeud', 0, 1)];
  const { objet } = conformerModele({ niveaux: [sceneLivree('noeud')], clips, kit: false });
  const lecteur = creerLecteurClips(objet, clips)!;
  lecteur.jouer('repos');
  lecteur.avancer(0.2);
  // Un clip d'une seconde, ajusté à 200 ms : fini au bout de 200 ms.
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
