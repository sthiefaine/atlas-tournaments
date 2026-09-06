/**
 * La conformation d'un modèle livré (`src/render3d/modeles.ts`), sans WebGL
 * ni réseau : des groupes three construits en mémoire, et un GLB fabriqué par
 * `tests/assets/glb.ts` pour le chemin d'analyse.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { genererSpecs, nomModele } from '../../src/assets/index';
import { PALIERS_DISTANCE } from '../../src/render3d/camera';
import {
  analyserGlb, appliquerMasque, candidatsModele, clipEnBoucle, conformerModele, couleurMasquee, couleurPour,
  couleurTernie, creerLecteurClips, definirMasque, estNomClip, forcerLod, indexTextureMasque, lodForce, masqueDe,
  NOM_FIGURINE, NOM_NIVEAUX, NOM_ORIENTATION, nomFichierModele, nomsClips, PROPORTIONS, ROTATION_AVANT, SEUILS_LOD,
  teinterModele,
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

test('les seuils de niveau de détail se déduisent des paliers de zoom, à mi-chemin', () => {
  assert.deepEqual(SEUILS_LOD, [(13 + 17.5) / 2, (24 + 33) / 2]);
  assert.equal(PALIERS_DISTANCE[3], 13);
  assert.equal(PALIERS_DISTANCE[6], 33);
});

test('trois niveaux font un THREE.LOD aux seuils, un seul niveau se pose sans seuil', () => {
  const trois = conformerModele({
    niveaux: [sceneLivree('corps'), sceneLivree('corps'), sceneLivree('corps')], clips: [], kit: false,
  });
  assert.equal(trois.lods, 3);
  const lod = trois.objet.getObjectByName(NOM_NIVEAUX);
  assert.ok(lod instanceof THREE.LOD);
  assert.deepEqual(lod.levels.map((l) => l.distance), [0, SEUILS_LOD[0], SEUILS_LOD[1]]);
  assert.deepEqual(lod.levels.map((l) => l.object.name), ['lod0', 'lod1', 'lod2']);
  assert.equal(lod.getObjectForDistance(PALIERS_DISTANCE[3])?.name, 'lod0', 'au palier 13, encore le plein');
  assert.equal(lod.getObjectForDistance(PALIERS_DISTANCE[4])?.name, 'lod1', 'à 17,5, le moyen');
  assert.equal(lod.getObjectForDistance(PALIERS_DISTANCE[7])?.name, 'lod2', 'à 45, le léger');

  const deux = conformerModele({ niveaux: [sceneLivree(), sceneLivree()], clips: [], kit: false });
  assert.equal(deux.lods, 2);
  const lod2 = deux.objet.getObjectByName(NOM_NIVEAUX) as THREE.LOD;
  assert.deepEqual(lod2.levels.map((l) => l.distance), [0, SEUILS_LOD[0]]);
  assert.equal(lod2.getObjectForDistance(40)?.name, 'lod1', 'sans lod2, le lod1 tient jusqu’au bout');

  const un = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false });
  assert.equal(un.lods, 1);
  assert.equal(un.objet.getObjectByName(NOM_NIVEAUX), undefined, 'un seul niveau : pas de LOD');
  assert.equal(un.objet.getObjectByName(NOM_ORIENTATION)!.children[0]?.name, 'lod0');
  assert.throws(() => conformerModele({ niveaux: [], clips: [], kit: false }), /lod0/);
});

test('forcer un niveau fige la visibilité ; rendre la main relance le choix de three', () => {
  const { objet } = conformerModele({ niveaux: [sceneLivree(), sceneLivree(), sceneLivree()], clips: [], kit: false });
  const lod = objet.getObjectByName(NOM_NIVEAUX) as THREE.LOD;
  assert.equal(lodForce(objet), null);
  forcerLod(objet, 2);
  assert.equal(lod.autoUpdate, false);
  assert.deepEqual(lod.levels.map((l) => l.object.visible), [false, false, true]);
  assert.equal(lodForce(objet), 2);
  forcerLod(objet, 0);
  assert.deepEqual(lod.levels.map((l) => l.object.visible), [true, false, false]);
  forcerLod(objet, null);
  assert.equal(lod.autoUpdate, true);
  assert.equal(lodForce(objet), null);
  // Sans LOD dans l'objet, forcer ne fait rien et ne lève pas.
  const un = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false });
  forcerLod(un.objet, 2);
  assert.equal(un.objet.getObjectByName('lod0')!.visible, true);
});

// ---------------------------------------------------------------------------
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
  const mat = corps.material as THREE.MeshStandardMaterial;
  assert.notEqual(mat, original, 'le matériau teinté est un clone');
  assert.equal(`#${mat.color.getHexString()}`, palette.main);
  assert.equal(original.color.getHexString(), 'ffffff', 'l’original n’a pas bougé');
  assert.equal(corps.castShadow, true);
  const details = objet.getObjectByName('details') as THREE.Mesh;
  assert.equal(`#${(details.material as THREE.MeshStandardMaterial).color.getHexString()}`, palette.dark);

  // Sans style, la palette du camp : le bleu du camp 0.
  const sansStyle = conformerModele({ niveaux: [sceneLivree()], clips: [], kit: false });
  teinterModele(sansStyle.objet, 0);
  const bleu = (sansStyle.objet.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardMaterial;
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
  const kit = (objet.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(kit.color.getHex(), 0x123456, 'la livrée du kit reste sienne');
  const lisere = (objet.getObjectByName('socle') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(`#${lisere.color.getHexString()}`, '#e04b45', 'le rouge du camp 1, pas la palette de la nation');
});

test('un matériau masqué mélange la couleur dans le shader et garde son albédo', () => {
  const scene = sceneLivree();
  const original = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const masque = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  definirMasque(original, masque);
  assert.equal(masqueDe(original), masque);
  const { objet } = conformerModele({ niveaux: [scene], clips: [], kit: false });
  teinterModele(objet, 0, { style: { palette } as never });
  const teinte = (objet.getObjectByName('corps') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.notEqual(teinte, original);
  assert.equal(teinte.color.getHexString(), 'ffffff', 'l’albédo n’est pas teinté : c’est le masque qui mélange');
  assert.equal(masqueDe(teinte), masque, 'le masque suit le clone');
  assert.equal(`#${couleurMasquee(teinte)!.getHexString()}`, palette.main);
  assert.equal(teinte.defines?.['USE_UV'], '', 'vUv doit exister même sans carte d’albédo');
  assert.equal(teinte.customProgramCacheKey(), 'atlas_masque_equipe', 'un seul programme pour tous les masques');

  // Le shader injecté : uniformes posés, mélange après la lecture de l'albédo.
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '',
    fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n}',
  };
  teinte.onBeforeCompile(shader as never, {} as never);
  assert.equal(shader.uniforms['atlasMasqueEquipe']?.value, masque);
  assert.equal((shader.uniforms['atlasCouleurEquipe']?.value as THREE.Color).getHexString(), couleurMasquee(teinte)!.getHexString());
  assert.match(shader.fragmentShader, /uniform sampler2D atlasMasqueEquipe;/);
  assert.match(shader.fragmentShader, /#include <map_fragment>\n\tdiffuseColor\.rgb = mix\( diffuseColor\.rgb, atlasCouleurEquipe, texture2D\( atlasMasqueEquipe, vUv \)\.r \);/);
});

test('la couleur ternie d’un masque suit les mêmes nombres que Materiaux.terni', () => {
  const materiaux = new Materiaux();
  const origine = new THREE.MeshStandardMaterial({ color: palette.main });
  const terni = materiaux.terni(origine);
  assert.equal(couleurTernie(new THREE.Color(palette.main)).getHexString(), terni.color.getHexString());
  // Et le terni d'un matériau masqué peut recevoir le masque à son tour.
  const masque = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  appliquerMasque(terni, masque, couleurTernie(new THREE.Color(palette.main)));
  assert.equal(masqueDe(terni), masque);
  materiaux.dispose();
});

// ---------------------------------------------------------------------------
// Noms de fichiers, ordre de repli, lecture d'un GLB
// ---------------------------------------------------------------------------

test('le rendu compose le même nom de fichier que la spécification', () => {
  const spec = genererSpecs().find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec);
  for (const lod of [0, 1, 2] as const) assert.equal(nomFichierModele(spec.id, lod), nomModele(spec, lod));
  assert.equal(nomFichierModele('kit_fr_char_leger', 1), 'kit_fr_char_leger_lod1.glb');
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
  const lod = objet.getObjectByName(NOM_NIVEAUX) as THREE.LOD;
  const positions = lod.levels.map((l) => l.object.getObjectByName('noeud')!.position.x);
  assert.deepEqual(positions.map((x) => Number(x.toFixed(6))), [0.5, 0.5]);
  lecteur.dispose();
});
