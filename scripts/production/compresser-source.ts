/** Compression de diffusion, sans quantification ni modification des triangles/UV/animations. */
import { readFileSync, writeFileSync, existsSync, readlinkSync, unlinkSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MeshoptEncoder } from 'meshoptimizer';
import { assemblerCompression, EXT_MESHOPT, morceauxGlb } from '../../src/assets/compression-glb';

async function main() {
  const id = process.argv[2];
  if (id !== 'unite_char_leger_base') throw new Error('Cette première compression est limitée au char léger demandé');
  const dossier = path.resolve('assets/livraisons', id), nom = `${id}_lod0.glb`, fichier = path.join(dossier, nom);
  const initial = readFileSync(fichier), { document: d, bin } = morceauxGlb(initial);
  if (d.extensionsRequired?.includes(EXT_MESHOPT)) throw new Error('Fichier déjà compressé : repartir de la préparation source');
  await MeshoptEncoder.ready;
  const morceaux: Uint8Array[] = [];
  let position = 0;
  const original = d.buffers[0]!.byteLength;
  for (let i = 0; i < d.bufferViews.length; i++) {
    const b = d.bufferViews[i]!;
    const acc = d.accessors.filter(a => a.bufferView === i);
    if (b.buffer !== 0 || acc.length !== 1 || acc[0]!.byteOffset || b.extensions || b.byteStride) throw new Error('La préparation doit fournir un accesseur compact par vue');
    const a = acc[0]!, composants = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type];
    if (!composants || ![5125, 5126].includes(a.componentType)) throw new Error('Format source non pris en charge');
    const stride = composants * 4, mode = a.componentType === 5125 ? 'INDICES' : 'ATTRIBUTES';
    if (b.byteLength !== a.count * stride) throw new Error('Vue source incohérente');
    const brut = bin.subarray(b.byteOffset ?? 0, (b.byteOffset ?? 0) + b.byteLength);
    const code = MeshoptEncoder.encodeGltfBuffer(brut, a.count, stride, mode);
    const alignement = (4 - position % 4) % 4;
    if (alignement) { morceaux.push(new Uint8Array(alignement)); position += alignement; }
    b.extensions = { [EXT_MESHOPT]: { buffer: 0, byteOffset: position, byteLength: code.length, byteStride: stride, count: a.count, mode } };
    b.buffer = 1; morceaux.push(code); position += code.length;
  }
  d.buffers = [{ byteLength: position }, { byteLength: original, extensions: { [EXT_MESHOPT]: { fallback: true } } }];
  d.extensionsUsed = [...new Set([...(d.extensionsUsed ?? []), EXT_MESHOPT])];
  d.extensionsRequired = [...new Set([...(d.extensionsRequired ?? []), EXT_MESHOPT])];
  const sortie = assemblerCompression(d, Buffer.concat(morceaux));
  writeFileSync(fichier, sortie);
  const sha = createHash('sha256').update(sortie).digest('hex');
  const donnee = path.resolve('public/assets/donnees', sha + '.glb');
  if (!existsSync(donnee)) writeFileSync(donnee, sortie, { flag: 'wx' });
  const alias = path.resolve('public/assets/candidats', nom);
  readlinkSync(alias); // Un fichier ordinaire n'est jamais écrasé à la place d'un alias.
  unlinkSync(alias); symlinkSync(path.relative(path.dirname(alias), donnee), alias);
  const expositionPath = 'assets/production/exposition.json';
  const exposition = JSON.parse(readFileSync(expositionPath, 'utf8'));
  const entree = exposition.assets.find((a: { id: string }) => a.id === id);
  if (!entree) throw new Error('Candidat manquant');
  const spec = JSON.parse(readFileSync(`assets/specs/${id}.json`, 'utf8'));
  const revision = createHash('sha256').update(JSON.stringify(spec));
  let poids = 0;
  for (const n of entree.fichiers as string[]) {
    const octets = readFileSync(path.join(dossier, n)); poids += octets.length;
    revision.update(n).update('\0').update(createHash('sha256').update(octets).digest('hex'));
  }
  entree.revision = revision.digest('hex');
  writeFileSync(expositionPath, JSON.stringify(exposition, null, 2) + '\n');
  const rapport = { id, revision: entree.revision, codec: EXT_MESHOPT, quantification: false, octetsGlbAvant: initial.length, octetsGlbApres: sortie.length, octetsLot: poids, tests: 'non exécutés à la demande du propriétaire', approbationArtistique: false };
  writeFileSync(path.join(dossier, 'compression.json'), JSON.stringify(rapport, null, 2) + '\n');
  writeFileSync(path.join(dossier, 'validation-lot.json'), JSON.stringify({ id, revision: entree.revision, octets: poids, verdict: null, controle: rapport.tests, dernierVerdictAvantCompression: 'ok', approbationArtistique: false, integration: 'candidat_inspecteur' }, null, 2) + '\n');
  writeFileSync(path.join(dossier, 'version-candidat.json'), JSON.stringify({ revision: entree.revision, source: 'source.json', compression: 'compression.json', approbationArtistique: false }, null, 2) + '\n');
  console.log(JSON.stringify(rapport, null, 2));
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
