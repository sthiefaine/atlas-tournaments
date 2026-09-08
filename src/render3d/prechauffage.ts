/**
 * Le **préchauffage** des nuanceurs : payer la première image avant qu'on la
 * regarde.
 *
 * Le portage à WebGPU n'a rien coûté par image — 10,2 ms contre 25 sur le dos
 * WebGL — mais sa **première** image bloque le fil principal une seconde
 * (`10-rendu-3d.md` §9.4), le temps de traduire les nœuds TSL en WGSL, en
 * JavaScript, puis de faire créer un pipeline par le pilote pour chacun. Le
 * gel tombe à l'instant précis où le plateau apparaît, souris comprise. C'est
 * la seule chose que le portage ait rendue pire, et c'est ce module qui la
 * corrige.
 *
 * **Pourquoi `compileAsync` semblait inutile, et pourquoi il ne l'est pas.**
 * `renderer.compileAsync(scene, camera)` projette la scène contre le tronc de
 * vue `_frustum` du module `Renderer.js`, que **rien ne renseigne avant la
 * première image** : il ne trouvait aucun objet, rendait la main en zéro
 * milliseconde, et laissait l'écran noir. Mais `_projectObject` écrit
 * `if (!object.frustumCulled || _frustum.intersectsObject(object))` : il suffit
 * d'éteindre `frustumCulled` le temps du préchauffage pour que **tout** entre
 * dans la liste, tronc de vue ou pas. Une seconde condition, tout aussi
 * silencieuse, est tenue par l'appelant (`scene.ts`) : préchauffer **sur la
 * cible de l'image vraie**, faute de quoi les pipelines sont compilés pour le
 * mauvais format. Alors seulement le gain arrive : quand on lui passe un
 * tableau de promesses, le moteur crée ses pipelines par
 * `createRenderPipelineAsync`, que Dawn compile **hors du fil principal**.
 *
 * **Par lots, pour rendre la main.** Un `compileAsync` sur la scène entière
 * ferait la traduction JavaScript d'un seul bloc. On cache donc tout ce qui se
 * dessine, on révèle un lot à la fois, et on attend ses pipelines avant le
 * suivant : entre deux lots, le navigateur peint son écran de chargement et
 * répond aux clics. On ne touche **jamais** à la visibilité d'une lumière ni
 * d'un groupe : une lumière absente de la liste changerait le nœud d'éclairage,
 * donc la clé de programme, et le préchauffage réchaufferait des programmes
 * dont l'image vraie n'aurait que faire.
 *
 * **La passe d'ombres se préchauffe autrement** (`prechaufferOmbres`, 8
 * septembre 2026). `compileAsync` ne peut rien pour elle, et pire : elle le
 * casse. Il appelle `updateBefore` sur chaque objet, un `ShadowNode` y répond
 * par un `renderer.render()` complet au milieu de la compilation, et il lève
 * avant d'avoir retiré l'`overrideMaterial` qu'il a posé sur la scène — trois
 * lots sur huit échouaient ainsi, mesuré. C'est `scene.ts` qui l'éteint avant
 * d'appeler ici (`poserOmbres`).
 *
 * Recopier le matériau ne marcherait pas non plus, et la raison est écrite dans
 * three : `_overrideMaterial` est une variable de module de `ShadowNode.js`, et
 * la clé de programme d'un matériau à nœuds passe par `getCacheKey`, qui pousse
 * l'**identifiant** de chaque nœud (`NodeUtils.js` : `values.push(object.id)`).
 * Deux graphes identiques n'ont donc pas la même clé : on réchaufferait un
 * pipeline dont la passe d'ombres n'aurait que faire.
 *
 * Le seul moyen d'obtenir le vrai matériau est donc de laisser three s'en
 * servir : on **rend** pour de bon, hors écran, en n'accordant `castShadow`
 * qu'à un lot à la fois. Chaque rendu compile les programmes d'ombre de son
 * lot, et rien d'autre — la passe principale, elle, est déjà chaude, et un lot
 * ne compte que des **représentants** : deux objets qui partagent géométrie,
 * type et `receiveShadow` partagent leur programme d'ombre, puisqu'ils
 * partagent aussi le matériau. Une poignée de rendus suffit là où il y avait
 * douze à dix-sept programmes.
 *
 * Ce qui reste hors de portée : la chaîne de post-traitement, qui dessine dans
 * une autre cible, donc un autre contexte, et ne s'allume qu'après la
 * calibration.
 *
 * **Ce que cela vaut, mesuré** (8 septembre 2026, Chrome sur M1, WebGPU réel,
 * plateau de la mission 1) : sans préchauffage, la première image bloque le fil
 * principal **840 à 894 ms** — 765 à 774 une fois les programmes réduits
 * (`programmes.ts`). Avec, le préchauffage prend **environ 700 ms en huit
 * tranches**, dont la plus longue tient **environ 250 ms**, et la première image
 * tombe à **250 à 280 ms**, ce qui reste étant la passe d'ombres. Le total ne
 * baisse donc pas : ce qui change est qu'aucun bloc du chargement ne dépasse le
 * quart de seconde, et que la page répond et peint pendant tout ce temps au lieu
 * d'être gelée. Il faut le dire ainsi plutôt que de promettre une seconde
 * gagnée.
 */

import * as THREE from 'three/webgpu';

/** Combien d'objets au plus par lot : c'est la finesse avec laquelle on rend la main. */
export const TAILLE_LOT = 8;

/** Au-delà, on cesse de préchauffer : le moteur a un problème, pas ce lot-ci. */
const ECHECS_MAX = 3;

/** Ce qu'un objet dessiné doit être pour valoir un programme. */
function dessinable(o: THREE.Object3D): boolean {
  if ((o as THREE.Sprite).isSprite === true) return true;
  if ((o as THREE.Mesh).isMesh !== true && (o as THREE.Line).isLine !== true
    && (o as THREE.Points).isPoints !== true) return false;
  // Un lot instancié **éteint** n'a rien à préchauffer : `allumer` (`decor.ts`)
  // met son compte à zéro parce qu'un zéro dessinerait une instance ; le
  // révéler ferait déclarer au moteur un tableau de matrices vide, et il
  // compilerait un nuanceur que l'image vraie n'emploiera jamais.
  if ((o as THREE.InstancedMesh).isInstancedMesh === true && (o as THREE.InstancedMesh).count < 1) return false;
  // Une géométrie sans sommets non plus : elle ne se dessine pas, et le moteur
  // n'a pas de tampon à lui donner.
  const geo = (o as THREE.Mesh).geometry;
  return (geo?.getAttribute('position')?.count ?? 0) > 0;
}

/**
 * Découpe la scène en lots à préchauffer, **famille par famille** — plateau,
 * décor, unités, surbrillances, effets — et par tranches d'au plus `TAILLE_LOT`.
 * Pur, donc testable : c'est le plan, pas son exécution.
 *
 * Les objets invisibles y sont **compris**. Un effet, une nappe de surbrillance
 * ou une flèche de chemin ne coûterait sinon son programme qu'au moment où on
 * la montre — c'est-à-dire au premier tir et au premier survol, là où un gel se
 * remarque autant qu'au chargement.
 */
export function lotsDePrechauffage(
  racine: THREE.Object3D | readonly THREE.Object3D[], taille = TAILLE_LOT,
): THREE.Object3D[][] {
  // Une racine unique donne ses **enfants** pour familles — c'est la scène, et
  // ses familles sont le plateau, le décor, les unités. Une liste, elle, est
  // déjà la liste des familles : c'est ainsi qu'on ne chauffe qu'une part du
  // monde (`index.ts`, la révélation en quatre temps).
  const familles = Array.isArray(racine)
    ? (racine as readonly THREE.Object3D[]) : (racine as THREE.Object3D).children;
  const lots: THREE.Object3D[][] = [];
  for (const famille of familles) {
    const feuilles: THREE.Object3D[] = [];
    famille.traverse((o) => { if (dessinable(o)) feuilles.push(o); });
    for (let i = 0; i < feuilles.length; i += taille) lots.push(feuilles.slice(i, i + taille));
  }
  return lots;
}

/** Ce que le préchauffage a besoin de savoir faire d'un moteur. */
export interface MoteurPrechauffable {
  compileAsync(scene: THREE.Scene, camera: THREE.Camera): Promise<void>;
}

interface OptionsPrechauffage {
  /** Rend la main entre deux lots ; par défaut, un tour de macrotâche. */
  pause?(): Promise<void>;
  /** Vrai tant que la scène vit : un démontage arrête le préchauffage. */
  vivante?(): boolean;
  taille?: number;
  /**
   * Les familles à chauffer. Absentes, c'est toute la scène.
   *
   * C'est ce qui permet de **montrer le sol avant le reste** : la première
   * image n'attend que les programmes du plateau, et le décor puis les unités
   * paient les leurs après, une famille à la fois, chacune paraissant dès
   * qu'elle est chaude. Le reste de la scène est caché pendant l'opération dans
   * tous les cas : on ne chauffe que ce qu'on a demandé.
   */
  cibles?: readonly THREE.Object3D[];
}

/** Un tour de boucle d'événements : le navigateur peint, puis on reprend. */
function tourDeBoucle(): Promise<void> {
  return new Promise((resoudre) => { setTimeout(resoudre, 0); });
}

/**
 * Compile les programmes de toute la scène, lot par lot, en rendant la main
 * entre chacun. Rend quand tout est chaud, ou après `ECHECS_MAX` lots refusés —
 * un préchauffage raté ne doit jamais empêcher de dessiner, l'image le refera
 * elle-même, au prix qu'elle a toujours payé.
 */
export async function prechauffer(
  moteur: MoteurPrechauffable, scene: THREE.Scene, camera: THREE.Camera,
  options: OptionsPrechauffage = {},
): Promise<void> {
  const pause = options.pause ?? tourDeBoucle;
  const vivante = options.vivante ?? ((): boolean => true);
  const lots = lotsDePrechauffage(options.cibles ?? scene, options.taille ?? TAILLE_LOT);
  if (lots.length === 0) return;

  // On retient l'état de chaque feuille avant de la cacher : c'est la seule
  // chose qu'on touche, et elle doit revenir exactement comme elle était — une
  // nappe de surbrillance éteinte doit le rester.
  //
  // On cache **toute** la scène, et pas seulement les cibles : un objet déjà
  // chaud qu'on laisserait allumé entrerait dans la projection de chaque lot,
  // et le moteur le traiterait autant de fois qu'il y a de lots. C'est ce qui
  // rendrait la révélation par familles plus chère que la révélation d'un bloc.
  const avant = new Map<THREE.Object3D, { visible: boolean; cull: boolean }>();
  let echecs = 0;
  scene.traverse((o) => {
    if (!dessinable(o)) return;
    avant.set(o, { visible: o.visible, cull: o.frustumCulled });
    o.visible = false;
  });
  try {
    for (const lot of lots) {
      if (!vivante()) break;
      // `_projectObject` s'arrête net sur un objet invisible : révéler une
      // maille sans son porteur ne la mettrait pas dans la liste. On remonte
      // donc **toute** la chaîne des porteurs jusqu'à la scène, et on la
      // rabaisse à la fin du lot. Remonter seulement ce qu'on avait caché
      // soi-même suffisait tant que l'appelant montrait tout ; il ne le fait
      // plus depuis la révélation en deux temps (`index.ts`), qui bâtit décor
      // et unités **groupe éteint** pour ne pas les dessiner avant qu'ils
      // soient chauds. Sans cela, une famille cachée par l'appelant ne
      // compilait rien du tout, en silence.
      const montres: THREE.Object3D[] = [];
      for (const o of lot) {
        o.frustumCulled = false;
        for (let n: THREE.Object3D | null = o; n; n = n.parent) {
          if (n.visible) continue;
          n.visible = true;
          montres.push(n);
        }
      }
      try {
        await moteur.compileAsync(scene, camera);
      } catch (cause) {
        // Un lot qui refuse de compiler n'emporte pas les autres : c'est un
        // programme de moins d'avance, pas une image de moins. Au troisième,
        // on arrête — le moteur a un problème que le préchauffage n'a pas à
        // répéter trente fois.
        echecs += 1;
        console.warn('Préchauffage : un lot n’a pas compilé', cause);
        if (echecs >= ECHECS_MAX) break;
      } finally {
        for (const o of montres) o.visible = false;
      }
      await pause();
    }
  } finally {
    for (const [o, etat] of avant) {
      o.visible = etat.visible;
      o.frustumCulled = etat.cull;
    }
  }
}

/**
 * La clé de géométrie d'un programme, **telle que three la calcule**
 * (`RenderObject.getGeometryCacheKey`, r170). Ce ne sont pas les données qui la
 * font, mais la **forme** des attributs : leurs noms, triés, avec pour chacun le
 * pas d'un tampon entrelacé, son décalage, son nombre de composantes et sa
 * normalisation, plus la présence d'un index.
 *
 * Deux géométries différentes de même forme partagent donc leur programme.
 * C'est ce qui permet de préchauffer la passe d'ombres en une poignée de rendus
 * au lieu d'un par maille, et c'est la fonction que le compteur de programmes
 * des tests lit ici plutôt que d'en recopier une variante — le dépôt garde
 * quatre cicatrices de listes recopiées.
 */
export function cleGeometrieProgramme(geo: THREE.BufferGeometry): string {
  let cle = '';
  for (const nom of Object.keys(geo.attributes).sort()) {
    const attr = geo.attributes[nom] as THREE.InterleavedBufferAttribute & THREE.BufferAttribute;
    cle += `${nom},`;
    if (attr.data) cle += `${attr.data.stride},`;
    if (attr.offset) cle += `${attr.offset},`;
    if (attr.itemSize) cle += `${attr.itemSize},`;
    if (attr.normalized) cle += 'n,';
  }
  if (geo.index) cle += 'index,';
  return cle;
}

/**
 * Ce qui sépare deux programmes de la **passe d'ombres**. Le matériau y est le
 * même pour tous — celui que `ShadowNode` garde en variable de module —, si
 * bien qu'il ne reste, dans la clé de `RenderObject`, que la forme de la
 * géométrie, le squelette et les morphes s'il y en a, l'`uuid` d'un lot dès que
 * son compte dépasse un (r170 écrit ce compte en dur dans le WGSL), et
 * `receiveShadow`, que la clé dynamique y joint.
 *
 * Deux objets de même signature partagent donc leur programme d'ombre : en
 * préchauffer un les préchauffe tous les deux. C'est ce qui ramène le
 * préchauffage des ombres à une poignée de rendus.
 */
export function signatureOmbre(o: THREE.Object3D): string {
  const m = o as THREE.Mesh & THREE.InstancedMesh & THREE.SkinnedMesh;
  let cle = `${o.type}|${m.geometry ? cleGeometrieProgramme(m.geometry) : ''}`;
  if (m.skeleton) cle += `|os:${m.skeleton.bones.length}`;
  if (m.morphTargetInfluences) cle += `|mo:${m.morphTargetInfluences.length}`;
  if (m.count > 1) cle += `|${o.uuid}`;
  return `${cle}|${o.receiveShadow}`;
}

/** Les porteurs d'ombre de la scène, dans l'ordre où on les rencontre. */
export function porteursOmbre(scene: THREE.Object3D): THREE.Object3D[] {
  const porteurs: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.castShadow === true && dessinable(o)) porteurs.push(o); });
  return porteurs;
}

/** Vrai si rien, du porteur à la racine, n'éteint cet objet. */
function affiche(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/**
 * Les lots de la passe d'ombres : un **représentant** par signature, par
 * tranches d'au plus `taille`. Pur, comme `lotsDePrechauffage` : c'est le plan.
 *
 * Le représentant est pris **allumé** quand il en existe un : contrairement à
 * `compileAsync`, un rendu ne compile que ce qu'il dessine, et un représentant
 * éteint laisserait sa forme froide tout en occupant sa place.
 */
export function lotsDOmbre(
  scene: THREE.Object3D | readonly THREE.Object3D[], taille = TAILLE_LOT, connues?: Set<string>,
): THREE.Object3D[][] {
  // `connues` traverse les appels : une forme chauffée quand le sol a paru ne
  // se rechauffe pas quand le décor paraît. Un lot d'ombre coûte un rendu
  // entier, on ne le rejoue pas pour rien.
  const vus = connues ?? new Set<string>();
  const representants: THREE.Object3D[] = [];
  const porteurs = Array.isArray(scene)
    ? (scene as readonly THREE.Object3D[]).flatMap((r) => porteursOmbre(r))
    : porteursOmbre(scene as THREE.Object3D);
  for (const o of [...porteurs.filter(affiche), ...porteurs]) {
    const s = signatureOmbre(o);
    if (vus.has(s)) continue;
    vus.add(s);
    representants.push(o);
  }
  const lots: THREE.Object3D[][] = [];
  for (let i = 0; i < representants.length; i += taille) lots.push(representants.slice(i, i + taille));
  return lots;
}

/** Ce que le préchauffage des ombres a besoin de savoir faire d'un moteur. */
export interface MoteurOmbrable {
  renderAsync(scene: THREE.Scene, camera: THREE.Camera): Promise<void>;
}

/** Une lumière qui porte une carte d'ombre, telle qu'on a besoin de la piloter. */
type LumierePorteuse = THREE.Light & { shadow: THREE.LightShadow };

/** Les lumières de la scène dont la carte d'ombre se recalcule. */
function lumieresOmbrantes(scene: THREE.Object3D): LumierePorteuse[] {
  const lumieres: LumierePorteuse[] = [];
  scene.traverse((o) => {
    const l = o as LumierePorteuse;
    if (l.isLight === true && l.castShadow === true && l.shadow) lumieres.push(l);
  });
  return lumieres;
}

/**
 * Compile les programmes de la **passe d'ombres**, lot par lot, en rendant la
 * main entre chacun.
 *
 * Le moyen est un vrai rendu, et il n'y en a pas d'autre : le matériau de la
 * passe est hors d'atteinte (voir l'en-tête). On n'accorde donc `castShadow`
 * qu'aux représentants d'un lot, on force le recalcul de la carte, et on rend —
 * hors écran, la cible étant posée par l'appelant, exactement comme pour la
 * passe principale. Les représentants gardent leur `castShadow` d'un lot au
 * suivant : le dernier rendu est alors la vraie passe d'ombres, à ceci près
 * qu'elle ne dessine qu'un exemplaire de chaque forme.
 *
 * La passe principale se rejoue à chaque lot, et c'est le prix : elle est déjà
 * chaude — c'est l'ordre d'appel de `scene.ts` — donc elle ne coûte que ses
 * tirages, sur la carte graphique, pas sur le fil principal.
 */
export async function prechaufferOmbres(
  moteur: MoteurOmbrable, scene: THREE.Scene, camera: THREE.Camera,
  options: OptionsPrechauffage & { connues?: Set<string> } = {},
): Promise<void> {
  const pause = options.pause ?? tourDeBoucle;
  const vivante = options.vivante ?? ((): boolean => true);
  const lumieres = lumieresOmbrantes(scene);
  if (lumieres.length === 0) return;
  const lots = lotsDOmbre(options.cibles ?? scene, options.taille ?? TAILLE_LOT, options.connues);
  if (lots.length === 0) return;

  const porteurs = porteursOmbre(scene);
  for (const o of porteurs) o.castShadow = false;
  let echecs = 0;
  try {
    for (const lot of lots) {
      if (!vivante()) break;
      for (const o of lot) o.castShadow = true;
      // La carte d'ombre ne se recalcule que sur ordre (`poserOmbres`) : sans
      // cette ligne, seul le premier rendu ferait une passe d'ombres et les
      // lots suivants ne compileraient rien.
      for (const l of lumieres) l.shadow.needsUpdate = true;
      try {
        await moteur.renderAsync(scene, camera);
      } catch (cause) {
        echecs += 1;
        console.warn('Préchauffage des ombres : un lot n’a pas compilé', cause);
        if (echecs >= ECHECS_MAX) break;
      }
      await pause();
    }
  } finally {
    for (const o of porteurs) o.castShadow = true;
    // La première vraie image redessine la carte entière : tous les porteurs
    // sont revenus, et leurs programmes sont chauds.
    for (const l of lumieres) l.shadow.needsUpdate = true;
  }
}
