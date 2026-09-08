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
 * **Ce que cela ne couvre pas**, et il faut le dire : la **passe d'ombres**. Non
 * seulement elle ne se préchauffe pas — elle rend la scène avec un
 * `overrideMaterial` que three garde pour lui (`ShadowNode.js`, variable de
 * module) et sa propre caméra, et on ne peut pas la rejouer sans ce matériau —,
 * mais elle **casse** le préchauffage si on la laisse faire : `compileAsync`
 * appelle `updateBefore` sur chaque objet, un `ShadowNode` y répond par un
 * `renderer.render()` complet au milieu de la compilation, et il lève avant
 * d'avoir retiré l'`overrideMaterial` qu'il a posé sur la scène. Trois lots sur
 * huit échouaient ainsi, mesuré. C'est `scene.ts` qui l'éteint avant d'appeler
 * ici (`poserOmbres`), et la première image la redemande comme d'habitude : ses
 * programmes — un fragment d'une ligne, mais le même sommet — restent à sa
 * charge. La chaîne de post-traitement non plus : elle dessine dans une autre
 * cible, donc dans un autre contexte, et elle ne s'allume qu'après la
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
export function lotsDePrechauffage(scene: THREE.Object3D, taille = TAILLE_LOT): THREE.Object3D[][] {
  const lots: THREE.Object3D[][] = [];
  for (const famille of scene.children) {
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
  const lots = lotsDePrechauffage(scene, options.taille ?? TAILLE_LOT);
  if (lots.length === 0) return;

  // On retient l'état de chaque feuille avant de la cacher : c'est la seule
  // chose qu'on touche, et elle doit revenir exactement comme elle était — une
  // nappe de surbrillance éteinte doit le rester.
  const avant = new Map<THREE.Object3D, { visible: boolean; cull: boolean }>();
  let echecs = 0;
  for (const lot of lots) {
    for (const o of lot) {
      avant.set(o, { visible: o.visible, cull: o.frustumCulled });
      o.visible = false;
    }
  }
  try {
    for (const lot of lots) {
      if (!vivante()) break;
      // `_projectObject` s'arrête net sur un objet invisible : révéler une
      // maille sans son porteur ne la mettrait pas dans la liste. On remonte
      // donc la chaîne des porteurs qu'on a nous-mêmes cachés — jamais un
      // groupe ni une lumière, qui gardent la visibilité qu'on leur connaît.
      const montres: THREE.Object3D[] = [];
      for (const o of lot) {
        o.frustumCulled = false;
        for (let n: THREE.Object3D | null = o; n && avant.has(n); n = n.parent) {
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
