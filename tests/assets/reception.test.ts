import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { deflateSync } from 'node:zlib';
import { genererSpecs, commandeAsset, nomTexture } from '../../src/assets/index';
import { contratProduction } from '../../src/assets/production';
import { lirePng, crcPng } from '../../src/assets/png';
import { controlerBinaire } from '../../src/assets/controle-binaire';
import { controlerDepot } from '../../src/serveur/depot-modeles';
import { controlerTextures } from '../../src/serveur/controle-textures';
import { receptionAsset, lireLot, enregistrerRevue, conserverPrecedente } from '../../src/serveur/reception-assets';
import { assemblerGlb, decouperGlb } from '../../scripts/infanterie/gltf';
import { executer } from '../../scripts/controler-asset';
const specs = genererSpecs();
const fiche = (id: string) => { const s = specs.find((s) => s.id === id); assert.ok(s); return s; };
const plaine = fiche('terrain_plaine'), antiair = fiche('unite_antiair_base');

function encoder(largeur: number, hauteur: number, rgba: Uint8Array, filtre = 0): Uint8Array {
  function morceau(nom: string, octets: Uint8Array) {
    const b = Buffer.alloc(octets.length + 12); b.writeUInt32BE(octets.length); b.write(nom, 4); b.set(octets, 8); b.writeUInt32BE(crcPng(b.subarray(4, -4)), b.length - 4); return b;
  }
  const entete = Buffer.alloc(13); entete.writeUInt32BE(largeur); entete.writeUInt32BE(hauteur, 4); entete[8] = 8; entete[9] = 6;
  const ligne = largeur * 4, brut = Buffer.alloc((ligne + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (ligne + 1)] = filtre;
    for (let x = 0; x < ligne; x++) {
      const i = y * ligne + x, a = x >= 4 ? rgba[i - 4]! : 0, h = y ? rgba[i - ligne]! : 0, c = y && x >= 4 ? rgba[i - ligne - 4]! : 0;
      const p = a + h - c, da = Math.abs(p - a), dh = Math.abs(p - h), dc = Math.abs(p - c);
      const prediction = [0, a, h, Math.floor((a + h) / 2), da <= dh && da <= dc ? a : dh <= dc ? h : c][filtre]!;
      brut[y * (ligne + 1) + x + 1] = (rgba[i]! - prediction) & 255;
    }
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), morceau('IHDR', entete), morceau('IDAT', deflateSync(brut)), morceau('IEND', new Uint8Array())]);
}

test('les cinq filtres PNG décodent les mêmes pixels ; corruption et surdimension sont refusées', () => {
  const pixels = Uint8Array.from({ length: 64 }, (_, i) => i * 13 % 256);
  for (let f = 0; f < 5; f++) assert.deepEqual(lirePng(encoder(4, 4, pixels, f)).rgba, pixels);
  const corrompu = encoder(4, 4, pixels); corrompu[40] = corrompu[40]! ^ 1; assert.throws(() => lirePng(corrompu), /CRC/);
  assert.throws(() => lirePng(encoder(2049, 1, new Uint8Array(2049 * 4))), /2048/);
});

test('les trois lots passent le contrôle complet ; PNG voisins uniques et aucune image embarquée', () => {
  for (const id of ['terrain_plaine', 'unite_antiair_base', 'unite_artillerie_base']) {
    const spec = fiche(id), lot = lireLot(spec), v = controlerDepot(spec, lot);
    assert.equal(v.ok, true, JSON.stringify(v.motifs));
    for (const f of lot.filter((f) => f.nom.endsWith('.glb'))) {
      const d = decouperGlb(f.octets).document;
      for (const image of d.images as { uri?: string; bufferView?: number }[]) { assert.ok(lot.some((f) => f.nom === image.uri)); assert.equal(image.bufferView, undefined); }
      assert.ok(f.octets.length < 350000, `${f.nom} : seulement géométrie et clips`);
    }
  }
});

test('les références servent de candidats, et le prompt reprend le style et les assemblages', () => {
  const texte = commandeAsset(antiair);
  for (const s of [antiair.style.matieres, ...antiair.style.motsCles, ...antiair.style.aEviter]) assert.ok(texte.includes(s));
  assert.match(texte, /parent module_tourelle/); assert.match(texte, /PNG textures external/);
  assert.equal(contratProduction(fiche('terrain_pont')).raccord, 'directionnel');
  assert.doesNotMatch(fiche('terrain_pont').description.en, /Deliver the mesh flat/);
  assert.equal(plaine.echelle.y.cible, .14); assert.equal(plaine.echelle.x.tolerance, 0);
});

test('faux nom, doublon et texture obligatoire manquante refusent le lot', () => {
  const lot = lireLot(plaine);
  assert.equal(controlerDepot(plaine, [...lot, lot[0]!]).ok, false);
  assert.equal(controlerDepot(plaine, [...lot, { nom: 'final.png', octets: lot[0]!.octets }]).ok, false);
  assert.equal(controlerDepot(plaine, lot.filter((f) => !f.nom.includes('normale'))).ok, false);
});

test('PNG de mauvaise résolution, masque gris et albédo coloré sont distingués', () => {
  const lot = new Map(lireLot(antiair).map((f) => [f.nom, f.octets]));
  const masque = nomTexture(antiair, 'masque_equipe'), p = lirePng(lot.get(masque)!);
  p.rgba[0] = 128; lot.set(masque, encoder(p.largeur, p.hauteur, p.rgba));
  assert.ok(controlerTextures(antiair, lot).some((m) => m.detail?.includes('non binaire')));
  lot.set(masque, lireLot(antiair).find((f) => f.nom === masque)!.octets);
  const nom = nomTexture(antiair, 'albedo'), a = lirePng(lot.get(nom)!);
  for (let i = 0; i < a.rgba.length; i += 4) { a.rgba[i] = 240; a.rgba[i + 1] = 0; a.rgba[i + 2] = 0; }
  lot.set(nom, encoder(a.largeur, a.hauteur, a.rgba));
  assert.ok(controlerTextures(antiair, lot).some((m) => m.detail?.includes('albédo coloré')));
  lot.set(nom, encoder(1, 1, new Uint8Array([128, 128, 128, 255])));
  assert.ok(controlerTextures(antiair, lot).some((m) => m.detail?.includes('résolution')));
});

test('les données binaires priment sur les noms et les bornes déclarées', () => {
  const f = lireLot(antiair).find((f) => f.nom.endsWith('lod0.glb'))!;
  const { document: d, bin } = decouperGlb(f.octets);
  const animations = d.animations as { name: string; samplers: { input: number; output: number }[] }[];
  const accesseurs = d.accessors as { bufferView: number; count: number; byteOffset?: number; min?: number[] }[];
  const vues = d.bufferViews as { byteOffset?: number }[];
  const temps = accesseurs[animations[0]!.samplers[0]!.input]!;
  const modifie = Buffer.from(bin), offset = (vues[temps.bufferView]!.byteOffset ?? 0) + (temps.byteOffset ?? 0) + (temps.count - 1) * 4;
  modifie.writeFloatLE(9, offset);
  assert.ok(controlerBinaire(assemblerGlb(d, modifie), antiair).some((m) => m.detail?.includes('durée')));
  accesseurs.find((a) => a.min?.length === 3)!.min![0] = -400;
  assert.ok(controlerBinaire(assemblerGlb(d, bin), antiair).some((m) => m.detail?.includes('sommets réels')));
  d.nodes = [{ name: 'racine', children: [0] }];
  assert.ok(controlerBinaire(assemblerGlb(d, bin), antiair).some((m) => m.detail?.includes('cycle')));
});

test('une couture de texture est refusée même avec un PNG correctement encodé', () => {
  const lot = new Map(lireLot(plaine).map((f) => [f.nom, f.octets])), nom = nomTexture(plaine, 'albedo'), p = lirePng(lot.get(nom)!);
  p.rgba[4] = p.rgba[4]! ^ 127; lot.set(nom, encoder(p.largeur, p.hauteur, p.rgba));
  assert.ok(controlerTextures(plaine, lot).some((m) => m.detail?.includes('raccord')));
});

test('réception complète, approbation humaine, changement de révision et comparaison précédente', () => {
  const temporaire = mkdtempSync(path.join(os.tmpdir(), 'atlas-reception-')), modeles = path.join(temporaire, 'modeles'), suivi = path.join(temporaire, 'suivi');
  mkdirSync(modeles);
  try {
    assert.equal(receptionAsset(plaine, modeles, suivi).etat, 'a_produire');
    const lot = lireLot(plaine); writeFileSync(path.join(modeles, lot[0]!.nom), lot[0]!.octets);
    assert.equal(receptionAsset(plaine, modeles, suivi).etat, 'incomplet');
    for (const f of lot) writeFileSync(path.join(modeles, f.nom), f.octets);
    const r = receptionAsset(plaine, modeles, suivi); assert.equal(r.etat, 'conforme'); assert.ok(r.revision);
    assert.throws(() => enregistrerRevue(plaine, r.revision!, 'integre', 'test', modeles, suivi), /Approuver/);
    enregistrerRevue(plaine, r.revision, 'approuve', 'Trois vues et mosaïque examinées dans le scénario de test.', modeles, suivi);
    assert.equal(receptionAsset(plaine, modeles, suivi).etat, 'approuve');
    enregistrerRevue(plaine, r.revision, 'integre', 'Test en jeu consigné.', modeles, suivi);
    assert.equal(receptionAsset(plaine, modeles, suivi).etat, 'integre');
    conserverPrecedente(plaine, modeles, suivi);
    const nom = `${plaine.id}_lod0.glb`, { document, bin } = decouperGlb(readFileSync(path.join(modeles, nom)));
    document.extras = { revision: 2 }; writeFileSync(path.join(modeles, nom), assemblerGlb(document, bin));
    const nouvelle = receptionAsset(plaine, modeles, suivi); assert.equal(nouvelle.etat, 'conforme'); assert.equal(nouvelle.precedente, r.revision);
    assert.throws(() => enregistrerRevue(plaine, r.revision!, 'approuve', 'ancienne', modeles, suivi), /changé/);
    assert.deepEqual(readFileSync(path.join(suivi, plaine.id, r.revision, nom)), Buffer.from(lot.find((f) => f.nom === nom)!.octets));
  } finally { rmSync(temporaire, { recursive: true, force: true }); }
});

test('la ligne de commande de lot rend le verdict du dépôt', () => {
  const r = executer(['--spec', 'assets/specs/terrain_plaine.json', '--lot', 'public/assets/modeles']);
  assert.equal(r.code, 0); assert.deepEqual(r.verdict, controlerDepot(plaine, lireLot(plaine).sort((a, b) => a.nom.localeCompare(b.nom))));
});

test('les kits héritent du squelette et des clips ; la réception exige la géométrie originale', () => {
  const kit = fiche('kit_fr_antiair');
  assert.deepEqual(kit.format, antiair.format); assert.deepEqual(kit.animations, antiair.animations);
  assert.doesNotMatch(kit.description.en, /separate named nodes|own shadow|edge highlight/);
  const base = lireLot(antiair), source = base.find((f) => f.nom.endsWith('lod0.glb'))!;
  const { document, bin } = decouperGlb(source.octets);
  const lot = base.map((f) => ({ nom: f.nom.replace(antiair.id, kit.id), octets: f.octets }));
  const sansBase = controlerDepot(kit, lot);
  assert.ok(sansBase.motifs.some((m) => m.detail?.includes('géométrie de base requise')));
  document.extras = { livree: 'kit de test' };
  const modifie = assemblerGlb(document, bin);
  const avecBase = controlerDepot(kit, [{ nom: `${kit.id}_lod0.glb`, octets: modifie }], base);
  assert.ok(!avecBase.motifs.some((m) => m.detail?.includes('le kit a modifié')));
  const mauvais = Buffer.from(bin); mauvais[0] = mauvais[0]! ^ 1;
  const refuse = controlerDepot(kit, [{ nom: `${kit.id}_lod0.glb`, octets: assemblerGlb(document, mauvais) }], base);
  assert.ok(refuse.motifs.some((m) => m.detail?.includes('le kit a modifié')));
});
