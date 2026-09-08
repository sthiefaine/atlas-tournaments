/**
 * La mesure **par famille** du coût d'une image (`16-realisme.md` A6).
 *
 * `renderer.info` compte les triangles et les appels de l'image entière, sans
 * dire d'où ils viennent. Ce module parcourt la scène et range ce qui se
 * dessine sous le **groupe de premier niveau** qui le porte — `plateau`,
 * `decor`, `unites`, `surbrillances`, `effets`, `eclairage` —, pour dire quelle
 * famille pèse quoi, donc laquelle le §9.1 de `10-rendu-3d.md` doit instancier
 * en premier.
 *
 * Tout est **pur** : un parcours d'objets three.js en mémoire, sans contexte
 * graphique, testé avec des groupes construits à la main. On imite le compte
 * que le moteur tient dans `renderer.info` (`Info.update` : un tirage, puis
 * `instances × sommets / 3` triangles) — index ou positions, `drawRange`, un
 * tirage par groupe de matériau, instances multipliées, le seul niveau courant
 * d'un `LOD` — sans imiter le tri par frustum : une famille est comptée
 * **entière**, là où le rendu ne dessine que ce que la caméra voit. Les deux
 * chiffres coïncident carte cadrée en entier, et s'écartent en gros plan.
 *
 * Les compteurs de l'image entière, eux, se lisent sur `renderer.info`
 * (`depuisInfo`). Depuis le moteur WebGPU (7 septembre 2026), `render.calls` y
 * compte les **passes** — chaque `render()`, ombres et quads compris — et
 * c'est `render.drawCalls` qui compte les tirages ; `WebGLRenderer` appelait
 * `calls` ce que celui-ci appelle `drawCalls`, d'où cette fonction plutôt
 * qu'une lecture directe qu'on aurait mal recopiée.
 */

import * as THREE from 'three/webgpu';

import type { MesureFamille } from '../render/rendu';

/** Le nom sous lequel tombe un objet posé à la racine sans nom. */
const SANS_NOM = 'autres';

/**
 * Le nombre de sommets qu'un tirage dessine, `drawRange` et groupe de matériau
 * compris — le `drawCount` de `renderBufferDirect`, qui ne dessine rien quand
 * il tombe à zéro.
 */
function compteTirage(geo: THREE.BufferGeometry, groupe: { start: number; count: number } | null): number {
  const total = geo.index ? geo.index.count : (geo.attributes['position']?.count ?? 0);
  let debut = geo.drawRange.start;
  let fin = geo.drawRange.start + geo.drawRange.count;
  if (groupe) {
    debut = Math.max(debut, groupe.start);
    fin = Math.min(fin, groupe.start + groupe.count);
  }
  debut = Math.max(debut, 0);
  fin = Math.min(fin, total);
  const compte = fin - debut;
  return Number.isFinite(compte) && compte > 0 ? compte : 0;
}

/** Ce qu'un objet dessine à lui seul, ou `null` s'il n'est pas dessinable. */
function coutDe(o: THREE.Object3D): MesureFamille | null {
  // Un sprite est un quad partagé par tous : deux triangles, un tirage.
  if ((o as THREE.Sprite).isSprite) return { triangles: 2, mailles: 1 };
  const estMaille = (o as THREE.Mesh).isMesh === true;
  const estPoints = (o as THREE.Points).isPoints === true;
  const estLigne = (o as THREE.Line).isLine === true;
  if (!estMaille && !estPoints && !estLigne) return null;
  const { geometry, material } = o as THREE.Mesh;
  if (!geometry) return null;
  const instances = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1;
  if (instances <= 0) return { triangles: 0, mailles: 0 };
  // Un matériau en tableau dessine la géométrie groupe par groupe : autant de
  // tirages, et un groupe dont le matériau est invisible n'est pas dessiné.
  const tirages: number[] = [];
  if (Array.isArray(material)) {
    for (const groupe of geometry.groups) {
      const mat = material[groupe.materialIndex ?? 0];
      if (!mat || !mat.visible) continue;
      tirages.push(compteTirage(geometry, groupe));
    }
  } else {
    if (material && !material.visible) return null;
    tirages.push(compteTirage(geometry, null));
  }
  let triangles = 0;
  let mailles = 0;
  for (const compte of tirages) {
    if (compte === 0) continue;
    mailles += 1;
    // Points et lignes ne coûtent que leur tirage : seule une maille fait des triangles.
    if (estMaille) triangles += Math.floor(compte / 3) * instances;
  }
  return { triangles, mailles };
}

/** Cumule dans `total` tout ce que `o` et ses descendants visibles dessinent. */
function parcourir(o: THREE.Object3D, total: MesureFamille): void {
  if (!o.visible) return;
  const cout = coutDe(o);
  if (cout) {
    total.triangles += cout.triangles;
    total.mailles += cout.mailles;
  }
  if ((o as THREE.LOD).isLOD) {
    // Les niveaux sont tous enfants du `LOD` ; le rendu n'en dessine qu'un —
    // celui que three a choisi à la dernière image, ou celui qu'on a forcé.
    const lod = o as THREE.LOD;
    const i = lod.autoUpdate ? lod.getCurrentLevel() : lod.levels.findIndex((n) => n.object.visible);
    const niveau = lod.levels[i];
    if (niveau) parcourir(niveau.object, total);
    return;
  }
  for (const enfant of o.children) parcourir(enfant, total);
}

/**
 * Le coût de chaque famille de la scène, sous le nom de son groupe de premier
 * niveau. Un groupe nommé apparaît même s'il ne dessine rien — la table du
 * budget attend ses cinq familles —, un objet sans nom seulement s'il dessine.
 */
export function compterFamilles(racine: THREE.Object3D): Record<string, MesureFamille> {
  const familles: Record<string, MesureFamille> = {};
  for (const enfant of racine.children) {
    const nom = enfant.name || SANS_NOM;
    const total = familles[nom] ?? { triangles: 0, mailles: 0 };
    parcourir(enfant, total);
    if (enfant.name || total.mailles > 0) familles[nom] = total;
  }
  return familles;
}

/** La forme de `renderer.info` dont on a besoin : celle d'`Info`, sans en dépendre. */
export interface CompteursInfo {
  render: { drawCalls: number; triangles: number };
}

/**
 * Les compteurs de l'image entière : triangles et appels de dessin, tels que
 * le moteur les a comptés depuis la dernière remise à zéro — que `scene.ts`
 * fait une fois par image, pas une fois par passe (`info.autoReset` éteint).
 * Sans moteur initialisé, des zéros : rien n'a été dessiné.
 *
 * **Les triangles ne se comparent pas d'un dos à l'autre**, et c'est un défaut
 * de three r170, pas du nôtre : `Info.update(object, count, instanceCount)`
 * est appelé par le dos WebGL avec la signature de l'ancien `WebGLRenderer`,
 * `info.update(object, count, mode, primcount)` (`WebGLBufferRenderer`), de
 * sorte que le **mode de dessin** arrive à la place du nombre d'instances :
 * quatre, la valeur de `gl.TRIANGLES`. Une maille ordinaire est donc comptée
 * quatre fois, une maille instanciée quatre fois quel que soit son nombre
 * réel d'instances. Mesuré le 8 septembre 2026 sur le même plateau et la même
 * image : 42 799 triangles sur WebGPU, 107 228 sur le dos WebGL. Les
 * **appels** (`drawCalls`), eux, sont justes des deux côtés — 85 dans les deux
 * cas —, et `compterFamilles` dit la vérité de la scène sur les deux dos.
 */
export function depuisInfo(info: CompteursInfo | null | undefined): { triangles: number; appels: number } {
  if (!info) return { triangles: 0, appels: 0 };
  // `Info.update` cumule `instances × (sommets / 3)` sans arrondir : une
  // géométrie à sommets orphelins laisserait une fraction de triangle.
  return { triangles: Math.round(info.render.triangles), appels: info.render.drawCalls };
}
