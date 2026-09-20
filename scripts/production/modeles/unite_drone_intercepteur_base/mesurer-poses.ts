/** Reconstitution indépendante de la géométrie et des clips exportés, sans rendu. */
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decouperGlb } from './gltf';

type Noeud = { name: string; children?: number[]; mesh?: number; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Accessor = { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number };
type Vue = { byteOffset?: number; byteStride?: number };
type Animation = { name: string; samplers: { input: number; output: number; interpolation?: string }[]; channels: { sampler: number; target: { node: number; path: string } }[] };
type Glb = { nodes: Noeud[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[]; accessors: Accessor[]; bufferViews: Vue[]; animations: Animation[] };
const id = 'unite_drone_intercepteur_base';
const sortie = path.resolve(process.argv[2] ?? `tmp/production-sequentielle/${id}`);
const { document, bin } = decouperGlb(readFileSync(path.join(sortie, `${id}_lod0.glb`)));
const doc = document as unknown as Glb;
function acc(index: number): number[] {
  const a = doc.accessors[index]!, v = doc.bufferViews[a.bufferView]!;
  if (a.componentType !== 5126) throw new Error('Mesure : Float32 attendu');
  const largeur = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  if (!largeur) throw new Error(`Accesseur inconnu : ${a.type}`);
  const vue = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), valeurs: number[] = [];
  const debut = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), pas = v.byteStride ?? largeur * 4;
  for (let i = 0; i < a.count; i++) for (let j = 0; j < largeur; j++) valeurs.push(vue.getFloat32(debut + i * pas + j * 4, true));
  return valeurs;
}
const objets = doc.nodes.map(n => {
  const o = new THREE.Object3D(); o.name = n.name;
  if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
  else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); }
  return o;
});
doc.nodes.forEach((n, i) => n.children?.forEach(c => objets[i]!.add(objets[c]!)));
const racine = objets.find(o => o.name === 'racine')!;
const defauts = objets.map(o => ({ p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
const points = doc.nodes.flatMap((n, i) => n.mesh === undefined ? [] : doc.meshes[n.mesh]!.primitives.map(p => ({ objet: objets[i]!, valeurs: acc(p.attributes.POSITION) })));
function reset() { objets.forEach((o, i) => { o.position.copy(defauts[i]!.p); o.quaternion.copy(defauts[i]!.q); o.scale.copy(defauts[i]!.s); }); }
function mesurer() {
  racine.updateMatrixWorld(true);
  if (!racine.matrixWorld.equals(new THREE.Matrix4())) throw new Error('Racine non identité');
  const box = new THREE.Box3(), p = new THREE.Vector3(); let rayon = 0;
  for (const { objet, valeurs } of points) for (let i = 0; i < valeurs.length; i += 3) {
    p.fromArray(valeurs, i).applyMatrix4(objet.matrixWorld); box.expandByPoint(p); rayon = Math.max(rayon, Math.hypot(p.x, p.z));
  }
  return { min: box.min.toArray(), max: box.max.toArray(), rayon };
}
const clips = doc.animations.map(a => {
  reset();
  const tracks = a.channels.map(c => {
    const s = a.samplers[c.sampler]!;
    if ((s.interpolation ?? 'LINEAR') !== 'LINEAR') throw new Error('Interpolation non mesurée');
    const times = acc(s.input), values = acc(s.output), node = doc.nodes[c.target.node]!.name;
    if (c.target.path === 'rotation') return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values);
    if (!['translation', 'scale'].includes(c.target.path)) throw new Error('Canal inconnu');
    return new THREE.VectorKeyframeTrack(`${node}.${c.target.path === 'translation' ? 'position' : 'scale'}`, times, values);
  });
  const clip = new THREE.AnimationClip(a.name, -1, tracks), mixer = new THREE.AnimationMixer(racine), action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const instants = new Set(Array.from({ length: 193 }, (_, i) => i / 192 * clip.duration));
  tracks.forEach(t => Array.from(t.times).forEach(x => instants.add(x)));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let rayon = 0;
  for (const t of [...instants].sort((x, y) => x - y)) {
    mixer.setTime(t); const m = mesurer();
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, m.min[i]!); max[i] = Math.max(max[i]!, m.max[i]!); }
    rayon = Math.max(rayon, m.rayon);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(racine);
  return { nom: a.name, nombreEchantillons: instants.size, enveloppe: { min, max }, rayonHorizontalMax: rayon };
});
const avant = JSON.parse(readFileSync(path.join(sortie, 'mesures-mouvements.json'), 'utf8')) as { clips: typeof clips };
clips.forEach((c, i) => {
  const b = avant.clips[i]!;
  if (c.nom !== b.nom || Math.abs(c.rayonHorizontalMax - b.rayonHorizontalMax) > 2e-6 || c.enveloppe.min.some((v, k) => Math.abs(v - b.enveloppe.min[k]!) > 2e-6) || c.enveloppe.max.some((v, k) => Math.abs(v - b.enveloppe.max[k]!) > 2e-6)) throw new Error('Divergence export');
});
writeFileSync(path.join(sortie, 'mesures-poses-three-glb.json'), JSON.stringify({ id, methode: 'Relecture des positions et pistes depuis le GLB exporté ; Three.js sans texture ni rendu, 193 instants plus clés exactes.', clips, pariteAvantExport: true, approbationArtistique: false }, null, 2) + '\n');
console.log(JSON.stringify({ clips: clips.length, poses: clips.reduce((n, c) => n + c.nombreEchantillons, 0), pariteAvantExport: true }));
