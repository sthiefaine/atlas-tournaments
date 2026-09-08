// Compter les **programmes** d'une scène, hors navigateur.
//
// Sous WebGPU (three r170), tout objet dessiné donne un `RenderObject` dont
// `initialCacheKey` sert de clé au cache `Nodes.nodeBuilderCache` : une clé
// jamais vue coûte une traduction TSL → WGSL **en JavaScript**, puis la
// création d'un pipeline. C'est exactement ce que la première image paie, et
// c'est pour cela qu'on la compte : le nombre de matériaux ne dit rien, seul le
// nombre de clés distinctes compte.
//
// La clé est recalculée ici comme `RenderObject.getMaterialCacheKey` la
// calcule — `customProgramCacheKey()` (le type du matériau plus l'identité de
// ses nœuds), puis chaque propriété du matériau réduite : un nombre devient
// « nul ou non », un objet devient `{}`, un booléen son texte —, plus la clé de
// géométrie, plus l'`uuid` d'un lot instancié, plus `receiveShadow`. La partie
// dynamique (scène, lumières) est la même pour tous les objets d'une scène :
// elle ne sépare rien et n'est donc pas recalculée.
//
// Ce que cela ne dit pas : les passes annexes (carte d'ombre, normales MRT du
// GTAO), qui ont leurs propres objets de rendu, et le temps de compilation
// lui-même, qui reste affaire de navigateur.
import * as THREE from 'three/webgpu';

/** Ce que `RenderObject.getGeometryCacheKey` écrit. */
function cleGeometrie(geo: THREE.BufferGeometry): string {
  let cle = '';
  for (const nom of Object.keys(geo.attributes)) {
    const attr = geo.attributes[nom]!;
    cle += nom + ',';
    if ((attr as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) cle += 'instanced,';
  }
  if (geo.index) cle += 'index,';
  return cle;
}

/** Le filtre de `getMaterialCacheKey` : ce qui ne sépare jamais deux programmes. */
const IGNORE = /^(is[A-Z]|_)|^(visible|version|uuid|name|opacity|userData)$/;

/** `getKeys` de three : les propriétés propres, plus les accesseurs du prototype. */
function clefs(obj: object): string[] {
  const keys = Object.keys(obj);
  let proto = Object.getPrototypeOf(obj) as object | null;
  while (proto) {
    const d = Object.getOwnPropertyDescriptors(proto);
    for (const k in d) if (typeof d[k]?.get === 'function') keys.push(k);
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return keys;
}

/** La clé de programme d'un couple (objet, matériau), comme `RenderObject`. */
export function cleProgramme(objet: THREE.Object3D, materiau: THREE.Material): string {
  const m = materiau as unknown as Record<string, unknown>;
  let cle = (materiau as unknown as { customProgramCacheKey(): string }).customProgramCacheKey();
  for (const p of clefs(materiau)) {
    if (IGNORE.test(p)) continue;
    const v = m[p];
    let vk: string;
    if (v !== null && v !== undefined) {
      const t = typeof v;
      if (t === 'number') vk = v !== 0 ? '1' : '0';
      else if (t === 'object') {
        vk = '{';
        if ((v as THREE.Texture).isTexture) vk += (v as THREE.Texture).mapping;
        vk += '}';
      } else vk = String(v);
    } else vk = String(v);
    cle += vk + ',';
  }
  const geo = (objet as THREE.Mesh).geometry;
  if (geo) cle += cleGeometrie(geo);
  // Sous 1000 instances, le compte est écrit en dur dans le WGSL : three sépare
  // donc les lots instanciés par leur `uuid`, un programme chacun.
  if ((objet as THREE.InstancedMesh).count > 1) cle += objet.uuid + ',';
  return cle + (objet.receiveShadow ? ':ombre' : '');
}

/** Un programme de la scène, et ce qui le partage. */
export interface Programme {
  cle: string;
  /** Combien d'objets dessinés partagent ce programme. */
  objets: number;
  /** La famille de premier niveau et un exemple d'objet. */
  exemple: string;
}

interface OptionsProgrammes {
  /** Compter aussi ce qui est invisible (`visible === false`). */
  invisibles?: boolean;
}

/** Parcourt une scène et range ses objets dessinés par programme. */
export function programmes(racine: THREE.Object3D, options: OptionsProgrammes = {}): Programme[] {
  const par = new Map<string, Programme>();
  const parcourir = (o: THREE.Object3D, famille: string): void => {
    const dessinable = (o as THREE.Mesh).isMesh === true || (o as THREE.Sprite).isSprite === true
      || (o as THREE.Line).isLine === true || (o as THREE.Points).isPoints === true;
    if (dessinable && (o.visible || options.invisibles)) {
      const mats = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(mats) ? mats : [mats]) {
        if (!mat) continue;
        const cle = cleProgramme(o, mat);
        const p = par.get(cle);
        if (p) p.objets += 1;
        else par.set(cle, { cle, objets: 1, exemple: `${famille}/${o.name || o.type}:${mat.type}` });
      }
    }
    for (const e of o.children) parcourir(e, famille);
  };
  for (const e of racine.children) parcourir(e, e.name || e.type);
  return [...par.values()].sort((a, b) => b.objets - a.objets);
}

/** Le nombre de programmes distincts d'une scène. */
export function compterProgrammes(racine: THREE.Object3D, options: OptionsProgrammes = {}): number {
  return programmes(racine, options).length;
}
