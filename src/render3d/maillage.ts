/**
 * Poser une géométrie sur une maille, sous WebGPU.
 *
 * `WebGLRenderer` relisait `mesh.geometry` à chaque dessin : remplacer une
 * géométrie par une autre était transparent. `WebGPURenderer` ne le fait pas.
 * Il tient un `RenderObject` par couple **objet + matériau** (`RenderObjects`),
 * y capture la géométrie une fois pour toutes (`this.geometry = object.geometry`)
 * et **mémoïse** les attributs et les tampons qu'il en tire (`getAttributes` :
 * `if ( this.attributes !== null ) return this.attributes`). Il ne se reconstruit
 * que si sa **clé** change — et cette clé, pour la géométrie, ne retient que les
 * *noms* et *formats* des attributs (`getGeometryCacheKey` : nom, `stride`,
 * `offset`, `itemSize`, `normalized`, présence d'un index), **jamais leur taille
 * ni leur identité**. Deux flèches de longueurs différentes ont donc exactement
 * la même clé, et rien ne prévient le moteur. Lever `needsUpdate` sur le
 * matériau ne suffit pas non plus : la version est explicitement exclue de la
 * clé, et three se contente alors de recopier le numéro de version.
 *
 * La première parade, le 7 septembre au soir, fut un **attribut témoin** dont le
 * nom **alternait** entre deux valeurs à chaque échange. Elle était fausse, et
 * le propriétaire l'a vue tout de suite : « je n'ai pas la flèche quand je clique
 * sur une autre unité ». L'alternance compte les *échanges*, le moteur ne connaît
 * que les géométries **effectivement dessinées** — et une maille invisible n'en
 * crée aucune. Un aller-retour par un chemin vide (c'est exactement ce que fait
 * un clic sur une unité : le curseur est sur elle, le chemin ne fait qu'une case)
 * décalait donc les deux comptes d'un cran, et le survol suivant retombait sur la
 * clé déjà capturée : le moteur redessinait la flèche **d'avant**, figée, sur des
 * tampons qu'il venait de reconstruire depuis un tableau libéré.
 *
 * D'où la règle tenue ici, qui supprime le problème au lieu de le contourner :
 *
 * 1. **On n'échange plus la géométrie d'une maille qui change souvent.** Un
 *    `TamponMaille` alloue les `BufferAttribute` une fois, à une capacité
 *    suffisante, puis se contente de les **remplir** et d'ajuster
 *    `geometry.setDrawRange(0, n)`. La géométrie capturée reste la bonne, les
 *    attributs mémoïsés restent les bons, il n'y a plus rien à invalider. Le
 *    moteur relit `drawRange` à chaque dessin (`Renderer._renderObjectDirect` :
 *    `renderObject.drawRange = object.geometry.drawRange`) et
 *    `NodeMaterialObserver.equals()` compare explicitement la version de chaque
 *    attribut, celle de l'index **et** `drawRange` : lever `needsUpdate` suffit
 *    à faire renvoyer le tampon à la carte, sans reconstruire quoi que ce soit.
 * 2. **Quand la capacité ne suffit plus** — un autre semis, une autre carte —,
 *    on alloue une géométrie neuve et on la signale par un témoin **monotone**
 *    (`atlas_maj_1`, `atlas_maj_2`, …). Un nom neuf ne peut pas coïncider avec
 *    une clé déjà capturée, quel que soit le nombre de passes qui ont manqué
 *    l'échange — et il y en a plusieurs par maille : la passe principale, celle
 *    de la carte d'ombre, celle des normales du GTAO, chacune avec son propre
 *    objet de rendu et son propre rythme. C'est ce qu'une alternance ne pouvait
 *    pas garantir. Le prix est un état de pipeline de plus (`nodeBuilderCache`
 *    est une `Map`, jamais purgée tant que le matériau vit) : il est **borné**,
 *    parce qu'une réallocation multiplie la capacité par `FACTEUR_CAPACITE` et
 *    qu'il n'en faut donc qu'une poignée avant de ne plus jamais en refaire.
 *
 * Ce que le tampon **ne** fait pas : `updateRanges`. Le chemin partiel de r170
 * (`WebGPUAttributeUtils.updateAttribute`) écrit toujours à l'offset 0 du tampon
 * quel que soit `range.start` — il corromprait les données. On téléverse le
 * tableau entier, ce que fait three quand aucune plage n'est déclarée.
 */

import * as THREE from 'three/webgpu';

/** Ce qui se dessine à partir d'une géométrie, et dont on remplace la sienne. */
export type MailleDessinee = THREE.Mesh | THREE.LineSegments | THREE.Line;

/** Le préfixe des témoins d'invalidation. Le suffixe est un numéro, jamais réutilisé. */
export const PREFIXE_TEMOIN = 'atlas_maj_';

/**
 * Le compteur des témoins. Il est **global au module** et ne redescend jamais :
 * deux mailles qui se réallouent ne peuvent pas se donner le même nom, et une
 * maille ne peut pas retomber sur un nom qu'une de ses passes a déjà capturé.
 */
let dernierTemoin = 0;

/** Le témoin porté par une géométrie, ou `null` : ce qui distingue deux clés. */
export function temoinDe(geometrie: THREE.BufferGeometry): string | null {
  for (const nom of Object.keys(geometrie.attributes)) {
    if (nom.startsWith(PREFIXE_TEMOIN)) return nom;
  }
  return null;
}

/**
 * Pose `neuve` sur `maille` et fait en sorte que le moteur la voie, quel que
 * soit le nombre d'images où la maille est restée invisible.
 *
 * Réservé à ce qui change **rarement** : une carte qu'on remplace, un plan d'eau
 * qu'on redimensionne. Tout ce qui change au survol passe par `creerTampon`.
 * `libererAncienne` vaut faux quand la géométrie sortante est partagée ou
 * réutilisée ailleurs — la libérer la retirerait aussi de l'autre maille.
 */
export function remplacerGeometrie(
  maille: MailleDessinee,
  neuve: THREE.BufferGeometry,
  libererAncienne = true,
): void {
  const ancienne = maille.geometry;
  if (ancienne === neuve) return;
  // Un nom que personne n'a jamais vu : la clé du moteur ne peut pas coïncider.
  for (const nom of Object.keys(neuve.attributes)) {
    if (nom.startsWith(PREFIXE_TEMOIN)) neuve.deleteAttribute(nom);
  }
  dernierTemoin += 1;
  neuve.setAttribute(`${PREFIXE_TEMOIN}${dernierTemoin}`, new THREE.BufferAttribute(new Float32Array(1), 1));
  // Libérer **avant** de poser : le gestionnaire de `dispose` que three a
  // enregistré sur l'ancienne géométrie lit les attributs mémoïsés de l'objet
  // de rendu vivant, et c'est le seul moment où ils désignent encore l'ancienne.
  if (libererAncienne) ancienne.dispose();
  maille.geometry = neuve;
}

/** Un attribut à écrire : un tableau plat et la taille d'un élément. */
export interface AttributMaille {
  readonly valeurs: ArrayLike<number>;
  readonly taille: number;
}

/** Ce qu'un tampon sait recevoir. */
export interface ContenuMaille {
  /** Les attributs par nom. Tous doivent porter le même nombre de sommets. */
  readonly attributs: Readonly<Record<string, AttributMaille>>;
  /** Les indices, ou rien du tout si la géométrie n'est pas indexée. */
  readonly indices?: ArrayLike<number> | null;
}

/** La géométrie d'une maille, ses attributs préalloués, sa plage dessinée. */
export interface TamponMaille {
  /** La géométrie courante. Elle ne change qu'à une réallocation. */
  readonly geometrie: THREE.BufferGeometry;
  /** Écrit un contenu et ajuste la plage dessinée. */
  ecrire(contenu: ContenuMaille): void;
  /** Absorbe une géométrie bâtie ailleurs, puis la libère. `null` vide le tampon. */
  poser(neuve: THREE.BufferGeometry | null): void;
  /** Ne dessine plus rien, sans rien libérer : la capacité reste acquise. */
  vider(): void;
  /** Ce qui est effectivement dessiné : des indices, ou des sommets sans index. */
  readonly dessines: number;
  /** Combien de fois la capacité a dû être refaite. Zéro est le régime normal. */
  readonly reallocations: number;
  dispose(): void;
}

/** Options d'un tampon : les planchers de capacité, et de combien on grandit. */
export interface OptionsTampon {
  /** Capacité initiale en sommets : de quoi ne jamais réallouer au cas courant. */
  sommets?: number;
  /** Capacité initiale en indices. */
  indices?: number;
  /** Ce qu'on prend de marge sur un besoin qui déborde. */
  facteur?: number;
}

/** Une réallocation coûte un état de pipeline : mieux vaut en faire peu. */
const FACTEUR_CAPACITE = 1.6;

/** La signature d'un contenu : les noms, les tailles, l'indexation. Rien d'autre. */
function signatureDe(contenu: ContenuMaille): string {
  const noms = Object.keys(contenu.attributs).sort();
  const parts = noms.map((nom) => `${nom}:${contenu.attributs[nom]!.taille}`);
  return `${parts.join(',')}|${contenu.indices ? 'i' : ''}`;
}

/** Le contenu d'une géométrie bâtie ailleurs, vu comme des tableaux plats. */
function contenuDe(geometrie: THREE.BufferGeometry): ContenuMaille {
  const attributs: Record<string, AttributMaille> = {};
  for (const [nom, brut] of Object.entries(geometrie.attributes)) {
    if (nom.startsWith(PREFIXE_TEMOIN)) continue;
    const attribut = brut as THREE.BufferAttribute;
    attributs[nom] = {
      valeurs: attribut.array as unknown as ArrayLike<number>,
      taille: attribut.itemSize,
    };
  }
  const index = geometrie.index;
  return { attributs, indices: index ? (index.array as unknown as ArrayLike<number>) : null };
}

/**
 * Monte un tampon sur une maille. La géométrie qu'elle porte au montage est
 * abandonnée à la première écriture — c'est celle du constructeur, vide.
 */
export function creerTampon(maille: MailleDessinee, options: OptionsTampon = {}): TamponMaille {
  const facteur = Math.max(1, options.facteur ?? FACTEUR_CAPACITE);
  const plancherSommets = Math.max(0, options.sommets ?? 0);
  const plancherIndices = Math.max(0, options.indices ?? 0);

  let structure = '';
  let capaciteSommets = 0;
  let capaciteIndices = 0;
  let dessines = 0;
  let reallocations = 0;
  // Réutilisées d'une écriture à l'autre : une bordure ne s'alloue pas par survol.
  const boite = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const point = new THREE.Vector3();
  const etendue = new THREE.Vector3();

  function allouer(contenu: ContenuMaille, sommets: number, nbIndices: number): void {
    capaciteSommets = Math.max(1, plancherSommets, Math.ceil(sommets * facteur));
    capaciteIndices = nbIndices > 0 ? Math.max(1, plancherIndices, Math.ceil(nbIndices * facteur)) : 0;
    const geo = new THREE.BufferGeometry();
    for (const [nom, attribut] of Object.entries(contenu.attributs)) {
      geo.setAttribute(
        nom,
        new THREE.BufferAttribute(new Float32Array(capaciteSommets * attribut.taille), attribut.taille),
      );
    }
    // Toujours en 32 bits : passer de 16 à 32 bits en cours de vie changerait le
    // format d'index du pipeline sans que la clé du moteur en dise rien.
    if (capaciteIndices > 0) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(capaciteIndices), 1));
    geo.boundingBox = boite;
    geo.boundingSphere = sphere;
    structure = signatureDe(contenu);
    reallocations += 1;
    remplacerGeometrie(maille, geo);
  }

  /**
   * Les bornes sur les seuls sommets **écrits** : le reste du tampon est du
   * remplissage à zéro, et une sphère qui l'engloberait tirerait le centre du
   * plateau vers l'origine — donc le cadrage d'ombre et le tri des transparences.
   */
  function borner(position: AttributMaille | undefined, sommets: number): void {
    if (!position || sommets === 0) {
      boite.makeEmpty();
      sphere.center.set(0, 0, 0);
      sphere.radius = 0;
      return;
    }
    const { valeurs, taille } = position;
    boite.makeEmpty();
    for (let i = 0; i < sommets; i += 1) {
      const b = i * taille;
      boite.expandByPoint(point.set(valeurs[b] ?? 0, valeurs[b + 1] ?? 0, valeurs[b + 2] ?? 0));
    }
    boite.getCenter(sphere.center);
    // Le demi-diagonal : plus large que le rayon minimal, jamais plus étroit.
    sphere.radius = boite.getSize(etendue).length() / 2;
  }

  function vider(): void {
    dessines = 0;
    maille.geometry.setDrawRange(0, 0);
    // Les bornes suivent : `Mesh.raycast` et le tri du frustum lisent la sphère,
    // et une sphère restée sur l'ancien contenu ferait exister ce qui n'est plus.
    borner(undefined, 0);
  }

  function ecrire(contenu: ContenuMaille): void {
    const noms = Object.keys(contenu.attributs);
    const premier = noms.length > 0 ? contenu.attributs[noms[0]!] : undefined;
    const sommets = premier ? Math.floor(premier.valeurs.length / premier.taille) : 0;
    const nbIndices = contenu.indices ? contenu.indices.length : 0;
    if (sommets === 0) {
      vider();
      return;
    }
    if (signatureDe(contenu) !== structure
      || sommets > capaciteSommets
      || nbIndices > capaciteIndices) {
      allouer(contenu, sommets, nbIndices);
    }
    const geo = maille.geometry;
    for (const nom of noms) {
      const source = contenu.attributs[nom]!;
      const attribut = geo.getAttribute(nom) as THREE.BufferAttribute;
      (attribut.array as Float32Array).set(source.valeurs, 0);
      attribut.needsUpdate = true;
    }
    const index = geo.index;
    if (contenu.indices && index) {
      (index.array as Uint32Array).set(contenu.indices, 0);
      index.needsUpdate = true;
    }
    dessines = nbIndices > 0 ? nbIndices : sommets;
    geo.setDrawRange(0, dessines);
    borner(contenu.attributs['position'], sommets);
  }

  return {
    get geometrie(): THREE.BufferGeometry {
      return maille.geometry;
    },
    get dessines(): number {
      return dessines;
    },
    get reallocations(): number {
      return reallocations;
    },
    ecrire,
    poser(neuve: THREE.BufferGeometry | null): void {
      if (neuve === null) {
        vider();
        return;
      }
      ecrire(contenuDe(neuve));
      neuve.dispose();
    },
    vider,
    dispose(): void {
      maille.geometry.dispose();
    },
  };
}
