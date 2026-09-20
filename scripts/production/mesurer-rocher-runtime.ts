/** Mesures du GLB réellement livré après préparation pour les lots instanciés, sans rendu. */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assemblerCompression, morceauxGlb } from '../../src/assets/compression-glb';
import { lectureDepuisGltf } from '../../src/render3d/modeles';
import { extraireRocherLivre } from '../../src/render3d/rochers-livres';
import { LotInstancie } from '../../src/render3d/lots';

async function mesurer() {
  const [id, dossier] = process.argv.slice(2);
  if (!id?.startsWith('decor_rocher_') || !dossier) throw new Error('Identifiant de rocher et dossier requis');
  const fichier = path.join(dossier, `${id}_lod0.glb`), original = readFileSync(fichier);
  const { document, bin } = morceauxGlb(original);
  // Les PNG restent sur disque : le chargement numérique conserve seulement les UV.
  for (const mat of document.materials as Record<string, unknown>[]) {
    const pbr = mat.pbrMetallicRoughness as Record<string, unknown>;
    delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture;
    delete mat.normalTexture; delete mat.emissiveTexture; delete mat.occlusionTexture;
  }
  delete document.images; delete document.textures;
  const bytes = assemblerCompression(document, bin);
  const chargeur = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const lecture = await lectureDepuisGltf(await chargeur.parseAsync(bytes.buffer as ArrayBuffer, ''));
  lecture.scene.animations = lecture.clips;
  const signature = () => {
    const hash = createHash('sha256');
    lecture.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const nom of ['position', 'normal', 'uv', 'tangent']) {
        const attr = o.geometry.getAttribute(nom);
        if (attr) hash.update(Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
      }
    });
    return hash.digest('hex');
  };
  const avant = signature(), rocher = extraireRocherLivre(lecture.scene);
  if (!rocher) throw new Error('Rocher incompatible avec les lots instanciés');
  const geo = rocher.geometrie, position = geo.getAttribute('position');
  if (signature() !== avant || !readFileSync(fichier).equals(original)) throw new Error('La préparation a modifié la source');
  if (geo.getAttribute('uv').count !== position.count || geo.getAttribute('normal').count !== position.count || geo.getAttribute('tangent')) throw new Error('Attributs instanciés incohérents');
  const lot = new LotInstancie(geo, rocher.materiau, 4), mat = new THREE.Matrix4();
  const enveloppes = [];
  for (let i = 0; i < 4; i++) {
    mat.makeRotationY(i * Math.PI / 2).scale(new THREE.Vector3().setScalar(rocher.echelle));
    lot.setMatrixAt(i, mat); lot.setColorAt(i, new THREE.Color(1, 1, 1));
    const relue = new THREE.Matrix4(); lot.getMatrixAt(i, relue);
    const box = new THREE.Box3();
    for (let j = 0; j < position.count; j++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, j).applyMatrix4(relue));
    enveloppes.push({ angle: i * 90, min: box.min.toArray(), max: box.max.toArray() });
  }
  lot.compte = 4;
  const rapport = {
    id, date: new Date().toISOString(), sha256: createHash('sha256').update(original).digest('hex'),
    trianglesParInstance: (geo.index?.count ?? position.count) / 3, instances: lot.compte,
    geometriePartagee: lot.geometry.getAttribute('position') === position,
    attributsSourceInchanges: true, normalesUvConservees: true, tangentesRetireesPourRepereDerive: true,
    echelleCarte: rocher.echelle, enveloppes,
    controleVisuel: false, approbationArtistique: false, fpsTelephone: null,
    limites: ['Chargement sans PNG en mémoire ; pas de compilation GPU ni de mesure de rendu.'],
  };
  lot.dispose(); rocher.dispose();
  writeFileSync(path.join(dossier, 'mesures-instanciation.json'), JSON.stringify(rapport, null, 2) + '\n');
  console.log(JSON.stringify({ id, triangles: rapport.trianglesParInstance, instances: 4, sourceInchangee: true }));
}
void mesurer().catch(e => { console.error(e); process.exitCode = 1; });
