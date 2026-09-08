/**
 * Le **lot instancié** qui ne coûte pas son programme.
 *
 * Un décor de carte, c'est treize à dix-sept paquets d'objets identiques —
 * troncs, conifères, feuillus, trois silhouettes de rocher, huit accessoires de
 * paysage, mâts, pommeaux, pavillons. L'instanciation les ramène chacun à un
 * appel de dessin, et c'est bien ce qu'on veut. Mais sous WebGPU (three r170),
 * chacun coûtait aussi **son programme**, et c'était la moitié du chargement.
 *
 * **Pourquoi.** `RenderObject.getMaterialCacheKey` finit par ceci :
 *
 * ```js
 * if ( object.count > 1 ) cacheKey += object.uuid + ',';
 * ```
 *
 * Ce n'est pas une précaution : sous mille instances, `InstanceNode` écrit les
 * matrices dans un **tampon d'uniformes dont la taille est dans le WGSL** —
 * `buffer( array, 'mat4', Math.max( count, 1 ) )`, soit `array<mat4x4<f32>, N>`.
 * Deux lots de tailles différentes ont donc bel et bien deux nuanceurs, et
 * three sépare leurs clés par le seul moyen sûr : l'identité de la maille. D'où
 * un programme par lot dans la passe principale, **et un de plus dans la passe
 * d'ombres**, dont la signature porte le même `uuid`.
 *
 * **Le remède, et il est écrit dans three aussi.** Le compte de dessin se lit
 * ainsi (`getDrawParameters`) :
 *
 * ```js
 * const instanceCount = geometry.isInstancedBufferGeometry ? geometry.instanceCount
 *   : ( object.count > 1 ? object.count : 1 );
 * ```
 *
 * Une `InstancedBufferGeometry` sur une **maille ordinaire** instancie donc
 * sans qu'`object.count` existe : plus d'`uuid` dans la clé. Les matrices
 * passent par quatre attributs par instance, lus par un nœud TSL **créé une
 * fois pour toutes** dans ce module — un nœud partagé a une identité partagée,
 * donc une clé partagée (`NodeUtils.getCacheKey` pousse l'identifiant de chaque
 * nœud). Deux lots de même forme d'attributs et de même matériau ne font alors
 * qu'un programme, quels que soient leurs comptes.
 *
 * Mesuré sur les deux plateaux du canon, invisibles compris : la passe
 * principale passe de **31 à 23** programmes (`premier_contact`) et de **34 à
 * 24** (`demo`) ; la passe d'ombres, de **15 à 5** et de **17 à 5**. Soit 46 →
 * 28 et 51 → 29 pipelines à créer avant que le monde entier soit à l'écran.
 *
 * **Trois pièges de r170 tombent avec.**
 *
 * 1. Un lot dont le compte change ne se **rebâtit** plus : le compte n'est plus
 *    dans le WGSL, `instanceCount` se règle librement d'une image à l'autre. Le
 *    décor rebâtissait ses arbres à chaque marée et à chaque capture.
 * 2. Un compte de **zéro** ne dessine plus une instance dégénérée :
 *    `getDrawParameters` rend `null` et rien n'est tiré.
 * 3. La passe d'ombres suit toute seule : `Renderer._renderObject` prête au
 *    matériau de substitution le `positionNode` du matériau vrai, donc notre
 *    instanciation, sans que rien n'ait à le savoir.
 *
 * **Ce qu'on perd, et pourquoi ce n'est rien ici.** Une maille ordinaire calcule
 * sa sphère englobante sur la forme, pas sur les instances : le tri par tronc de
 * vue la retirerait de l'écran dès que l'origine du lot en sort. On l'éteint
 * donc (`frustumCulled = false`) — ce que ces lots faisaient déjà tous, leurs
 * instances couvrant la carte entière. Le lancer de rayon ne les interroge pas
 * non plus : il ne s'adresse qu'au sol et aux tabliers de pont.
 */

import * as THREE from 'three/webgpu';
import { attribute, mat4, materialColor, normalLocal, positionLocal, transformNormal, vec3, Fn } from 'three/tsl';

/**
 * Les quatre colonnes de la matrice d'instance, en attributs. Le nom compte :
 * c'est par lui que le nœud partagé les retrouve, forme après forme.
 */
const COLONNES = ['iCol0', 'iCol1', 'iCol2', 'iCol3'] as const;

/** L'attribut de teinte par instance, quand le lot en a une. */
const TEINTE = 'iTeinte';

/**
 * La matrice d'instance, reconstruite de ses quatre colonnes. `mat4` de TSL
 * prend ses arguments **par colonnes**, comme `Matrix4.elements` les range :
 * les deux conventions se rejoignent, et `setMatriceA` peut recopier
 * `elements` tel quel.
 */
const matriceInstance = /*@__PURE__*/ mat4(
  attribute(COLONNES[0], 'vec4'), attribute(COLONNES[1], 'vec4'),
  attribute(COLONNES[2], 'vec4'), attribute(COLONNES[3], 'vec4'),
);

/**
 * Le nœud de position, **partagé par tous les lots** — c'est tout l'intérêt du
 * module. Il fait ce que `InstanceNode` fait : la position, puis la normale,
 * sans quoi un arbre tourné s'éclairerait comme s'il ne l'était pas.
 *
 * Il est posé en `positionNode`, et non appendu à la pile comme three le fait :
 * c'est la seule porte qu'un matériau offre de l'extérieur, et c'est aussi
 * celle que la passe d'ombres emprunte.
 */
const positionInstanciee = /*@__PURE__*/ Fn(() => {
  normalLocal.assign(transformNormal(normalLocal, matriceInstance));
  return matriceInstance.mul(positionLocal).xyz;
})();

/**
 * La couleur d'un lot teinté : celle du matériau, multipliée par la teinte de
 * l'instance. C'est ce que fait `setupDiffuseColor` pour un `instanceColor`,
 * et il ne le fait que pour un vrai `InstancedMesh` — d'où cette copie, unique
 * et partagée.
 */
const couleurInstanciee = /*@__PURE__*/ materialColor.mul(vec3(attribute(TEINTE, 'vec3')));

/** Un tampon dont on peut demander le téléversement, comme `instanceMatrix`. */
export interface TamponInstances {
  needsUpdate: boolean;
  /**
   * Le compteur de téléversements, comme celui d'un `BufferAttribute`. Il ne
   * sert pas au moteur — il sert de **témoin** : `decor.test.ts` s'en sert pour
   * affirmer qu'un survol ne renvoie rien à la carte graphique. Un booléen ne
   * pourrait pas le dire, puisqu'il retombe à faux au téléversement suivant.
   */
  readonly version: number;
}

/**
 * Une maille instanciée qui ne porte pas son `uuid` dans la clé de programme.
 *
 * Elle s'emploie comme un `InstancedMesh` — `setMatrixAt`, `setColorAt`,
 * `instanceMatrix.needsUpdate` —, à un nom près : le compte d'instances
 * s'appelle `compte`, parce que `count` est précisément ce que three
 * interroge pour remettre l'`uuid` dans la clé.
 */
export class LotInstancie extends THREE.Mesh {
  /** Combien d'instances au plus. Au-delà, `setMatrixAt` ne fait rien. */
  readonly capacite: number;

  private readonly formeInstanciee: THREE.InstancedBufferGeometry;
  private readonly colonnes: THREE.InstancedBufferAttribute[];
  private teintesAttr: THREE.InstancedBufferAttribute | null = null;
  private teintesTampon: TamponInstances | null = null;

  /** À régler pour que les matrices écrites partent à la carte graphique. */
  readonly instanceMatrix: TamponInstances;

  /** Vrai quand les colonnes attendent d'être téléversées. */
  private colonnesSales = false;

  constructor(forme: THREE.BufferGeometry, materiau: THREE.Material, capacite: number) {
    const n = Math.max(1, Math.floor(capacite));
    const instanciee = new THREE.InstancedBufferGeometry();
    // Les attributs de la forme sont **partagés**, jamais recopiés : une
    // silhouette de conifère peut peser des dizaines de kilo-octets, et le
    // décor la mémorise justement pour ne la tailler qu'une fois. En
    // contrepartie, libérer cette géométrie-ci libérerait les tampons de la
    // forme partagée : c'est `libererForme` qui en décide, et il vaut faux par
    // défaut.
    for (const [nom, attr] of Object.entries(forme.attributes)) instanciee.setAttribute(nom, attr);
    if (forme.index) instanciee.setIndex(forme.index);
    for (const groupe of forme.groups) instanciee.addGroup(groupe.start, groupe.count, groupe.materialIndex);
    instanciee.instanceCount = 0;
    super(instanciee, materiau);
    this.capacite = n;
    this.formeInstanciee = instanciee;
    const colonnes = COLONNES.map((nom) => {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      instanciee.setAttribute(nom, attr);
      return attr;
    });
    this.colonnes = colonnes;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- les accesseurs ci-dessous ont leur propre `this`.
    const lot = this;
    // Les quatre colonnes se téléversent ensemble : de l'extérieur, elles sont
    // la matrice, et `lot.instanceMatrix.needsUpdate = true` s'écrit comme avant.
    // `BufferAttribute.needsUpdate` s'écrit mais ne se lit pas — c'est un
    // mutateur pur, qui incrémente `version`. On garde donc l'état ici pour
    // pouvoir le rendre, comme le reste du dépôt s'y attend.
    this.instanceMatrix = {
      get needsUpdate(): boolean { return lot.colonnesSales; },
      set needsUpdate(v: boolean) {
        lot.colonnesSales = v;
        if (v) for (const c of colonnes) c.needsUpdate = true;
      },
      // Les quatre colonnes partent ensemble : la première dit pour toutes.
      get version(): number { return colonnes[0]!.version; },
    };
    // Une maille ordinaire n'a pas de sphère englobante juste pour ses
    // instances : le tri par tronc de vue mentirait (voir l'en-tête).
    this.frustumCulled = false;
    (materiau as THREE.Material & { positionNode?: unknown }).positionNode ??= positionInstanciee;
  }

  /**
   * Combien d'instances se dessinent. Zéro n'en dessine aucune.
   *
   * Elle s'appelle `compte` et **surtout pas `count`** : c'est nommément
   * `object.count > 1` que `getMaterialCacheKey` interroge pour décider
   * d'ajouter l'`uuid` à la clé. Porter ce nom-là remettrait un programme par
   * lot, c'est-à-dire tout ce que ce module défait. Un test le tient.
   */
  get compte(): number { return this.formeInstanciee.instanceCount; }

  set compte(n: number) { this.formeInstanciee.instanceCount = Math.max(0, Math.min(this.capacite, n)); }

  /**
   * Le tampon des teintes, ou `null` tant que le lot n'en a pas reçu.
   *
   * Il s'appelle `teintes` et **surtout pas `instanceColor`**, pour la même
   * raison que `compte` ne s'appelle pas `count` : `setupDiffuseColor` fait
   * `if ( object.instanceColor )` et multiplie alors la couleur par le varying
   * `vInstanceColor` — que seul `InstanceNode` écrit, et qui reste donc **non
   * initialisé** ici. Les drapeaux sortaient noirs, sans une erreur. Un test le
   * tient.
   */
  get teintes(): TamponInstances | null { return this.teintesTampon; }

  /** Pose la matrice d'une instance. Même signature que `InstancedMesh`. */
  setMatrixAt(i: number, matrice: THREE.Matrix4): void {
    if (i < 0 || i >= this.capacite) return;
    const e = matrice.elements;
    for (let c = 0; c < 4; c += 1) {
      const dest = this.colonnes[c]!.array as Float32Array;
      const base = i * 4;
      const src = c * 4;
      dest[base] = e[src]!;
      dest[base + 1] = e[src + 1]!;
      dest[base + 2] = e[src + 2]!;
      dest[base + 3] = e[src + 3]!;
    }
  }

  /** Relit la matrice d'une instance. Même signature que `InstancedMesh`. */
  getMatrixAt(i: number, matrice: THREE.Matrix4): void {
    const e = matrice.elements;
    for (let c = 0; c < 4; c += 1) {
      const src = this.colonnes[c]!.array as Float32Array;
      const base = i * 4;
      const dest = c * 4;
      e[dest] = src[base]!;
      e[dest + 1] = src[base + 1]!;
      e[dest + 2] = src[base + 2]!;
      e[dest + 3] = src[base + 3]!;
    }
  }

  /**
   * Les seize flottants d'une instance, dans l'ordre exact où
   * `InstancedMesh.instanceMatrix.array` les rangeait — quatre colonnes à la
   * suite. Sert aux empreintes de non-régression, qui comparent un décor bâti
   * par ce module à un décor bâti par l'ancien.
   */
  matricesAPlat(): Float32Array {
    const plat = new Float32Array(this.capacite * 16);
    for (let i = 0; i < this.capacite; i += 1) {
      for (let c = 0; c < 4; c += 1) {
        plat.set((this.colonnes[c]!.array as Float32Array).subarray(i * 4, i * 4 + 4), i * 16 + c * 4);
      }
    }
    return plat;
  }

  /** Les teintes par instance, ou `null` si le lot n'en a pas. */
  teintesAPlat(): Float32Array | null {
    return this.teintesAttr ? (this.teintesAttr.array as Float32Array) : null;
  }

  /**
   * Teinte une instance. Le premier appel crée l'attribut **et** branche la
   * couleur sur le matériau, exactement comme `InstancedMesh.setColorAt` crée
   * `instanceColor` — sans quoi le lot serait teinté sans que rien ne le lise.
   */
  setColorAt(i: number, couleur: THREE.Color): void {
    if (i < 0 || i >= this.capacite) return;
    if (!this.teintesAttr) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.capacite * 3).fill(1), 3);
      this.formeInstanciee.setAttribute(TEINTE, attr);
      this.teintesAttr = attr;
      this.teintesTampon = {
        get needsUpdate(): boolean { return attr.needsUpdate; },
        set needsUpdate(v: boolean) { attr.needsUpdate = v; },
        get version(): number { return attr.version; },
      };
      const mat = this.material as THREE.Material & { colorNode?: unknown };
      // Un matériau qui a déjà sa couleur en nœud garde la sienne : on ne la
      // remplace pas dans son dos.
      mat.colorNode ??= couleurInstanciee;
    }
    couleur.toArray(this.teintesAttr.array as Float32Array, i * 3);
  }

  /**
   * Relit la teinte d'une instance, en face de `getMatrixAt`. Rend faux — sans
   * toucher à la couleur donnée — quand le lot n'a jamais été teinté : c'est
   * ce qu'`InstancedMesh` dit par un `instanceColor` nul, et le lot n'alloue
   * son attribut qu'au premier `setColorAt`.
   */
  getColorAt(i: number, couleur: THREE.Color): boolean {
    if (!this.teintesAttr || i < 0 || i >= this.capacite) return false;
    couleur.fromArray(this.teintesAttr.array as Float32Array, i * 3);
    return true;
  }

  /**
   * Libère ce que le lot possède en propre. La **forme** ne l'est pas : ses
   * attributs viennent d'un cache au niveau module, partagé avec les décors
   * encore à l'écran, et les libérer tuerait leurs arbres (`paysage.ts`,
   * `decor.ts`). Passer `libererForme` n'a de sens que pour une forme taillée
   * pour ce lot-là et pour personne d'autre.
   */
  dispose(libererForme = false): void {
    if (libererForme) { this.formeInstanciee.dispose(); return; }
    // Sans la forme, il ne reste que nos attributs par instance : on les
    // détache, et le ramasse-miettes les reprend. Leurs tampons graphiques
    // partent avec la géométrie quand plus rien ne la tient.
    for (const nom of COLONNES) this.formeInstanciee.deleteAttribute(nom);
    if (this.teintesAttr) this.formeInstanciee.deleteAttribute(TEINTE);
  }
}

/**
 * Vrai si cet objet est un lot instancié de ce module. Sert là où le code
 * distinguait un `InstancedMesh` pour compter ses instances ou décider s'il
 * valait un programme.
 */
export function estLotInstancie(o: THREE.Object3D): o is LotInstancie {
  return o instanceof LotInstancie;
}
