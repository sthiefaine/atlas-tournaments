import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parametresAmbiance } from '../../src/render3d/eclairage';
import { creerDecor, poseDrapeau } from '../../src/render3d/decor';
import { SEUIL_CAPTURE } from '../../src/engine/index';
import { CAT, partie } from '../engine/aides';
import { carteBanc, scenarioBanc } from '../../src/app/atelier/banc';
import { creerPartie, sceneDepuis } from '../../src/engine/index';
import { validerScenario } from '../../src/schemas/index';
import scenarioDemo from '../../content/scenarios/demo.json';

/** Les matériaux d'un bâtiment, pour lire s'il est effacé ou plein. */
function materiaux(batiment: THREE.Object3D): THREE.MeshStandardMaterial[] {
  return batiment.children.map((m) => (m as THREE.Mesh).material as THREE.MeshStandardMaterial);
}

/** La matrice d'instance d'un lot de pavillons, décomposée. */
function instance(lot: THREE.InstancedMesh, i: number): { position: THREE.Vector3; echelle: THREE.Vector3 } {
  const mat = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  lot.getMatrixAt(i, mat);
  mat.decompose(position, new THREE.Quaternion(), echelle);
  return { position, echelle };
}

test('un bâtiment occupé s’efface en transparence, entier, sans révéler une unité hors vision', () => {
  const etat = partie('plaine');
  const unite = etat.unites[0]!;
  const cle = `${unite.x},${unite.y}`;
  const decor = creerDecor({ largeur: etat.largeur, hauteur: etat.hauteur, terrainDe: () => 'ville' }, etat, () => 0);
  const batiment = decor.groupe.getObjectByName('batiments')!.children.find((b) => b.userData['case'] === cle)!;
  decor.majProprietaires(etat, new Set([cle]));
  // La silhouette reste entière : on voit la figurine au travers, on n'écrase
  // pas la ville sous elle.
  assert.equal(batiment.scale.y, 1, 'le bâtiment ne s’aplatit plus');
  assert.ok(materiaux(batiment).every((m) => m.transparent && m.opacity < 1), 'le bâtiment occupé est translucide');
  assert.ok(batiment.children.every((m) => !m.castShadow), 'un bâtiment effacé ne projette pas d’ombre pleine');
  decor.majProprietaires(etat, new Set());
  assert.ok(materiaux(batiment).every((m) => !m.transparent), 'le bâtiment ne révèle pas l’occupation cachée');
  decor.majProprietaires({ ...etat, unites: [] }, null);
  assert.ok(materiaux(batiment).every((m) => !m.transparent), 'la matière revient après le départ sans changer le propriétaire');
  assert.equal(batiment.scale.y, 1);
  decor.dispose();
});

test('chaque bâtiment porte un mât, et seul un bâtiment tenu hisse un drapeau', () => {
  const etat = partie('plaine');
  const types = ['ville', 'qg', 'usine', 'aeroport'] as const;
  const sans = { ...etat, proprietaires: { '1,0': 1 as const }, unites: [] };
  const decor = creerDecor({ largeur: 4, hauteur: 1, terrainDe: (x) => types[x]! }, sans, () => 0.2);
  const mats = decor.groupe.getObjectByName('mats') as THREE.InstancedMesh;
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as THREE.InstancedMesh;
  assert.equal(mats.count, 4, 'un mât par bâtiment');
  assert.equal(drapeaux.count, 4);
  // Le mât se plante sur le socle, à la hauteur du sol lue au moment de la pose.
  assert.ok(instance(mats, 0).position.y > 0.2 && instance(mats, 0).position.y < 0.26);
  // Le QG hisse plus haut que la ville : c'est le drapeau qu'on lit de loin.
  assert.ok(instance(mats, 1).echelle.y > instance(mats, 0).echelle.y);
  // Un bâtiment neutre a le mât nu : son drapeau n'est pas dessiné.
  assert.equal(instance(drapeaux, 0).echelle.x, 0, 'la ville neutre n’a pas de drapeau');
  assert.equal(instance(drapeaux, 2).echelle.x, 0);
  const pris = instance(drapeaux, 1);
  assert.equal(pris.echelle.x, 1, 'le QG tenu hisse son drapeau');
  const sommet = instance(mats, 1).position.y + instance(mats, 1).echelle.y;
  assert.ok(pris.position.y > sommet - 0.12 && pris.position.y < sommet, 'le drapeau est en haut du mât');
  const couleur = new THREE.Color();
  drapeaux.getColorAt(1, couleur);
  assert.notEqual(couleur.getHexString(), 'ffffff', 'le drapeau porte les couleurs du camp');
  // Le QG n'a plus de pavillon fusionné : le mât vivant le remplace.
  const qg = decor.groupe.getObjectByName('batiments')!.children[1]!;
  assert.ok(qg.children.length <= 7);
  decor.dispose();
});

test('un bâtiment désaffecté est fermé, terni, éteint — jamais aux couleurs d’un camp, jamais rasé', () => {
  const etat = partie('plaine');
  const types = ['ville', 'usine', 'aeroport'] as const;
  const grille = { largeur: 3, hauteur: 1, terrainDe: (x: number) => types[x]! };
  const enService = { ...etat, proprietaires: {}, desaffectes: [], unites: [] };
  const decor = creerDecor(grille, enService, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const uuids = (b: THREE.Object3D): Set<string> => new Set(materiaux(b).map((m) => m.uuid));
  const sommetsDe = (b: THREE.Object3D): number => b.children
    .reduce((n, m) => n + (m as THREE.Mesh).geometry.getAttribute('position').count, 0);
  const avant = batiments.children.map(uuids);
  const sommets = batiments.children.map(sommetsDe);
  assert.ok(batiments.children.every((b) => materiaux(b).some((m) => m.emissive.getHex() !== 0)),
    'en service, chaque bâtiment a des vitrages qui s’allument');

  const fermes = { ...enService, desaffectes: ['0,0', '1,0', '2,0'] };
  decor.majProprietaires(fermes);
  assert.ok(batiments.children.every((b) => b.userData['desaffecte'] === true));
  batiments.children.forEach((b, i) => {
    assert.ok(b.scale.y === 1 && b.children.length <= 7, 'même silhouette, mêmes lots');
    assert.ok(!materiaux(b).some((m) => m.emissive.getHex() !== 0), 'les vitrages ne s’allumeront jamais');
    assert.ok([...uuids(b)].some((u) => !avant[i]!.has(u)), 'des matériaux ternis remplacent les vifs');
    // La palissade et la charpente s'ajoutent, une toiture ou un shed se
    // retire : le bâtiment reste au moins aussi fourni, il n'est pas rasé.
    assert.ok(sommetsDe(b) > sommets[i]!, 'rien n’est effondré');
  });
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as THREE.InstancedMesh;
  for (let i = 0; i < 3; i += 1) assert.equal(instance(drapeaux, i).echelle.x, 0, 'mât nu');

  // La remise en service reconstruit : la clé de reconstruction lit les désaffectés.
  decor.majProprietaires({ ...fermes, desaffectes: ['1,0', '2,0'], proprietaires: { '0,0': 0 } });
  assert.equal(batiments.children[0]!.userData['desaffecte'], false, 'remise en service, la ville rouvre');
  assert.equal(batiments.children[1]!.userData['desaffecte'], true);
  assert.equal(instance(drapeaux, 0).echelle.x, 1, 'et hisse son drapeau');
  decor.dispose();
});

test('la prise de chantier rallume les vitrages d’une seule case, puis rend l’ambiance', () => {
  const etat = partie('plaine');
  const grille = { largeur: 2, hauteur: 1, terrainDe: () => 'ville' as const };
  const e = { ...etat, proprietaires: { '0,0': 0 as const, '1,0': 0 as const }, desaffectes: [], unites: [] };
  const decor = creerDecor(grille, e, () => 0);
  decor.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'), 'ete');
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const vitrage = (i: number): THREE.MeshStandardMaterial => materiaux(batiments.children[i]!)
    .find((m) => m.emissive.getHex() !== 0)!;
  const jour = vitrage(0).emissiveIntensity;
  assert.equal(decor.chantier('5,5'), null);
  const prise = decor.chantier('0,0')!;
  prise.eclairer(1);
  decor.majProprietaires(e);
  assert.ok(vitrage(0).emissiveIntensity > jour + 0.5, 'la case rallumée luit au-dessus du jour');
  assert.equal(vitrage(1).emissiveIntensity, jour, 'sa voisine ne bouge pas');
  // Une unité posée dessus : la lueur passe par le jumeau translucide.
  decor.majProprietaires({ ...e, unites: [{ ...etat.unites[0]!, x: 0, y: 0 }] });
  assert.ok(vitrage(0).transparent && vitrage(0).emissiveIntensity > jour + 0.5);
  prise.relacher();
  decor.majProprietaires(e);
  assert.equal(vitrage(0).emissiveIntensity, jour, 'relâchée, la case rend l’ambiance');
  decor.dispose();
});

test('la station radar balaie quand elle est tenue, jamais neutre, désaffectée ou en mouvement réduit', () => {
  const etat = partie('plaine');
  const grille = { largeur: 3, hauteur: 1, terrainDe: () => 'radar' as const };
  const e = { ...etat, proprietaires: { '0,0': 0 as const }, desaffectes: ['2,0'], unites: [] };
  const decor = creerDecor(grille, e, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const paraboles = batiments.children.map((b) => b.getObjectByName('parabole') as THREE.Group);
  assert.ok(paraboles.every(Boolean), 'chaque station porte sa parabole');
  batiments.children.forEach((b) => {
    assert.ok(b.children.filter((c) => c instanceof THREE.Mesh).length <= 7, 'la station tient dans les lots des autres');
    // Le centre de la case reste libre pour l'unité : au-dessus du socle,
    // aucun sommet ne s'approche du centre.
    for (const m of b.children) {
      if (!(m instanceof THREE.Mesh)) continue;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        if (pos.getY(i) > 0.06) assert.ok(Math.hypot(pos.getX(i), pos.getZ(i)) > 0.1, `${m.name} occupe le centre`);
      }
    }
  });
  const angles = paraboles.map((p) => p.rotation.y);
  assert.ok(decor.avancer(500), 'une station tenue demande à redessiner');
  assert.notEqual(paraboles[0]!.rotation.y, angles[0], 'tenue, elle balaie');
  assert.equal(paraboles[1]!.rotation.y, angles[1], 'neutre, à l’arrêt');
  assert.equal(paraboles[2]!.rotation.y, angles[2], 'désaffectée, à l’arrêt');
  assert.ok(paraboles[2]!.rotation.x > 0.5, 'désaffectée, la parabole a basculé');
  assert.equal(paraboles[0]!.rotation.x, 0);
  const apres = paraboles[0]!.rotation.y;
  decor.avancer(500, true);
  assert.equal(paraboles[0]!.rotation.y, apres, 'mouvement réduit : rien ne tourne');
  // La parabole s'efface avec le reste quand une unité occupe la station.
  decor.majProprietaires({ ...e, unites: [{ ...etat.unites[0]!, x: 0, y: 0 }] });
  const calotte = paraboles[0]!.children[0] as THREE.Mesh;
  assert.ok((calotte.material as THREE.MeshStandardMaterial).transparent, 'la parabole devient translucide aussi');
  decor.majProprietaires(e);
  assert.ok(!(calotte.material as THREE.MeshStandardMaterial).transparent);
  decor.dispose();
});

test('la carte-catalogue du banc se monte entière, stations radar comprises', () => {
  const carte = carteBanc();
  const s = validerScenario(scenarioDemo);
  if (!s.ok) throw new Error('scénario de démonstration invalide');
  const etat = creerPartie(sceneDepuis(scenarioBanc(s.valeur), carte, []), CAT, 'banc:decor');
  const grille = {
    largeur: carte.largeur, hauteur: carte.hauteur,
    terrainDe: (x: number, y: number) => CAT.parCaractere[carte.grille[y]![x]!] ?? 'plaine',
  };
  const decor = creerDecor(grille, etat, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const radars = batiments.children.filter((b) => b.userData['type'] === 'radar');
  const attendues = carte.grille.join('').split('T').length - 1;
  assert.ok(attendues >= 3, 'le banc pose au moins les trois stations du rang des bâtiments');
  assert.equal(radars.length, attendues, 'chaque T de la grille monte une station');
  assert.ok(radars.every((b) => b.getObjectByName('parabole')));
  assert.ok(decor.avancer(200));
  decor.dispose();
});

test('la pose d’un drapeau suit la capture : on amène le sien, on hisse le nôtre', () => {
  assert.deepEqual(poseDrapeau(null, null, 20), { camp: null, niveau: 0 });
  assert.deepEqual(poseDrapeau(1, null, 20), { camp: 1, niveau: 1 });
  // Sur un bâtiment tenu, la capture amène le drapeau du propriétaire.
  assert.deepEqual(poseDrapeau(1, { camp: 0, points: 10 }, 20), { camp: 1, niveau: 0.5 });
  // Sur un bâtiment neutre, elle hisse celui du camp qui capture.
  assert.deepEqual(poseDrapeau(null, { camp: 0, points: 5 }, 20), { camp: 0, niveau: 0.25 });
  // Le seuil compte : un QG à quarante points descend deux fois moins vite.
  assert.deepEqual(poseDrapeau(1, { camp: 0, points: 10 }, 40), { camp: 1, niveau: 0.75 });
  // Sa propre unité sur son propre bâtiment n'y change rien.
  assert.deepEqual(poseDrapeau(1, { camp: 1, points: 10 }, 20), { camp: 1, niveau: 1 });
});

test('une capture en cours abaisse le drapeau d’après l’état, jamais d’après une unité cachée', () => {
  const etat = partie('plaine');
  const cle = '0,0';
  const capteur = { ...etat.unites[0]!, x: 0, y: 0, camp: 0 as const, pointsCapture: 10 };
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'ville' as const };
  const tenue = { ...etat, proprietaires: { [cle]: 1 as const }, unites: [capteur] };
  const decor = creerDecor(grille, tenue, () => 0);
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as THREE.InstancedMesh;
  const miCourse = instance(drapeaux, 0).position.y;
  decor.majProprietaires({ ...tenue, unites: [] }, null);
  const haut = instance(drapeaux, 0).position.y;
  assert.ok(haut > miCourse, 'sans capteur, le drapeau remonte en haut');
  decor.majProprietaires(tenue, null);
  assert.equal(instance(drapeaux, 0).position.y, miCourse);
  assert.ok(miCourse < haut - 0.1, 'à mi-capture, le drapeau est amené à mi-mât');
  // Une unité hors vision ne doit pas faire descendre le drapeau : ce serait la révéler.
  decor.majProprietaires(tenue, new Set());
  assert.equal(instance(drapeaux, 0).position.y, haut);
  // Avec le catalogue, le seuil vient du moteur, qui lit le terrain dans
  // l'**état** — pas dans la grille de rendu : un QG demande le double.
  const etatQg = { ...tenue, largeur: 1, hauteur: 1, grille: ['H'] };
  const qg = creerDecor({ largeur: 1, hauteur: 1, terrainDe: () => 'qg' as const }, etatQg, () => 0);
  qg.majProprietaires(etatQg, null, CAT);
  assert.equal(qg.drapeau(cle)!.seuil, SEUIL_CAPTURE * 2, 'le seuil d’un QG est doublé');
  const etatVille = { ...tenue, largeur: 1, hauteur: 1, grille: ['C'] };
  const villeCat = creerDecor(grille, etatVille, () => 0);
  villeCat.majProprietaires(etatVille, null, CAT);
  assert.equal(villeCat.drapeau(cle)!.seuil, SEUIL_CAPTURE);
  qg.dispose();
  villeCat.dispose();
  decor.dispose();
});

test('la prise d’un drapeau s’impose à l’état le temps d’un geste, puis le rend', () => {
  const etat = partie('plaine');
  let sol = 0.3;
  const decor = creerDecor(
    { largeur: 1, hauteur: 1, terrainDe: () => 'ville' as const },
    { ...etat, proprietaires: { '0,0': 1 }, unites: [] }, () => sol,
  );
  assert.equal(decor.drapeau('9,9'), null, 'une case sans bâtiment n’a pas de drapeau');
  const prise = decor.drapeau('0,0')!;
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as THREE.InstancedMesh;
  const haut = instance(drapeaux, 0).position.y;
  prise.forcer(0, 0);
  const couleur = new THREE.Color();
  drapeaux.getColorAt(0, couleur);
  const bleu = couleur.getHexString();
  assert.ok(instance(drapeaux, 0).position.y < haut - 0.2, 'forcé au pied, le drapeau descend');
  prise.forcer(null, 0.5);
  assert.equal(instance(drapeaux, 0).echelle.x, 0, 'forcé sans camp, il disparaît');
  prise.relacher();
  assert.equal(instance(drapeaux, 0).position.y, haut, 'relâché, il revient à ce que dit l’état');
  drapeaux.getColorAt(0, couleur);
  assert.notEqual(couleur.getHexString(), bleu, 'et à ses couleurs');
  // Le sommet se lit sur le relief du moment : une marée déplace le mât.
  const avant = prise.sommet.y;
  sol = -0.2;
  decor.majRelief();
  assert.ok(prise.sommet.y < avant - 0.4, 'le sommet a suivi le sol');
  assert.ok(instance(drapeaux, 0).position.y < haut - 0.4, 'le drapeau aussi');
  assert.ok(prise.pied.y < prise.sommet.y);
  decor.dispose();
});

test('les drapeaux flottent, sauf quand le système demande moins de mouvement', () => {
  const etat = partie('plaine');
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'ville' as const };
  const tenue = creerDecor(grille, { ...etat, proprietaires: { '0,0': 0 }, unites: [] }, () => 0);
  const drapeaux = tenue.groupe.getObjectByName('drapeaux') as THREE.InstancedMesh;
  const pos = drapeaux.geometry.getAttribute('position');
  const avant = [...pos.array];
  assert.ok(tenue.avancer(120), 'un drapeau hissé demande à redessiner');
  assert.notDeepEqual([...pos.array], avant, 'la toile a bougé');
  const fige = [...pos.array];
  assert.ok(!tenue.avancer(120, true), 'mouvement réduit : rien ne bouge');
  assert.deepEqual([...pos.array], fige);
  // Le bord au mât ne bouge jamais : c'est l'axe de l'onde.
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getX(i) === 0) assert.equal(pos.getZ(i), 0);
  }
  tenue.dispose();
  // Un mât nu n'a rien à faire flotter.
  const nue = creerDecor(grille, { ...etat, proprietaires: {}, unites: [] }, () => 0);
  assert.ok(!nue.avancer(120));
  nue.dispose();
});

test('les détails architecturaux restent fusionnés par matériau et libérés après capture', () => {
  const etat = partie('plaine');
  const types = ['ville', 'qg', 'usine', 'aeroport'] as const;
  const decor = creerDecor({ largeur: 4, hauteur: 1, terrainDe: (x) => types[x]! }, etat, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  let geometriesLiberees = 0;
  const nombre = batiments.children.reduce((n, b) => {
    assert.ok(b.children.length <= 7, 'les détails ne multiplient pas les appels de dessin');
    b.children.forEach((m) => {
      assert.ok(m instanceof THREE.Mesh);
      m.geometry.addEventListener('dispose', () => { geometriesLiberees += 1; });
    });
    return n + b.children.length;
  }, 0);
  decor.majProprietaires({ ...etat, proprietaires: { ...etat.proprietaires, '0,0': 1 } });
  assert.equal(geometriesLiberees, nombre, 'une capture libère toute la génération précédente');
  decor.dispose();
});

test('les biomes portent des silhouettes de végétation distinctes sans multiplier les instances', () => {
  const etat = partie('plaine');
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'foret' as const };
  const alpine = creerDecor(grille, etat, () => 0, 'montagne');
  const tropical = creerDecor(grille, etat, () => 0, 'archipel');
  const coniferes = alpine.groupe.getObjectByName('coniferes') as THREE.InstancedMesh;
  const palmes = tropical.groupe.getObjectByName('palmes') as THREE.InstancedMesh;
  assert.equal(coniferes.count, 3);
  assert.equal(palmes.count, 3);
  assert.notEqual(coniferes.geometry.getAttribute('position').count, palmes.geometry.getAttribute('position').count);
  alpine.dispose(); tropical.dispose();
});

test('la réduction hivernale des couronnes conserve leurs positions sur le plateau', () => {
  const etat = partie('plaine');
  const decor = creerDecor({ largeur: 3, hauteur: 3, terrainDe: () => 'foret' }, etat, () => 0, 'marais');
  const feuillus = decor.groupe.getObjectByName('feuillus') as THREE.InstancedMesh;
  const avant = new THREE.Matrix4(); const apres = new THREE.Matrix4();
  feuillus.getMatrixAt(12, avant);
  decor.appliquerAmbiance(parametresAmbiance('hiver', 'jour', 'clair'), 'hiver');
  feuillus.getMatrixAt(12, apres);
  assert.deepEqual(apres.elements.slice(12, 15), avant.elements.slice(12, 15));
  assert.ok(Math.abs(apres.elements[0]!) < Math.abs(avant.elements[0]!));
  decor.dispose();
});

test('les pierres se posent en couronne, enfoncées dans le sol et jamais identiques', () => {
  const etat = partie('plaine');
  // Une seule case, tout en montagne : on inspecte exactement une case.
  const grille = { largeur: 1, hauteur: 1, terrainDe: (): 'montagne' => 'montagne' };
  const solide = 0.4;
  const decor = creerDecor(grille, etat, () => solide);
  const lots = [0, 1, 2].map((v) => decor.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh);

  for (const lot of lots) assert.ok(lot instanceof THREE.InstancedMesh, 'trois silhouettes, trois lots');
  // Trois volumes distincts : c'est tout l'objet de la reprise. Un seul
  // polyèdre régulier répété donnait une caillasse de dés.
  const sommets = lots.map((l) => l.geometry.getAttribute('position').count);
  assert.equal(new Set(lots.map((l) => l.geometry.uuid)).size, 3);
  assert.ok(sommets.every((n) => n > 0));

  const total = lots.reduce((n, l) => n + l.count, 0);
  assert.ok(total >= 3 && total <= 5, `trois à cinq pierres par case, vu ${total}`);
  assert.ok(lots[0]!.count + lots[2]!.count === 1, 'un seul gros bloc, ou une seule dalle');

  const mat = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const couleur = new THREE.Color();
  const teintes = new Set<string>();
  for (const lot of lots) {
    for (let i = 0; i < lot.count; i += 1) {
      lot.getMatrixAt(i, mat);
      mat.decompose(position, rotation, echelle);
      // Le centre de la case reste dégagé : c'est là que se pose une unité.
      const ecart = Math.hypot(position.x - 0.5, position.z - 0.5);
      assert.ok(ecart > 0.15, `pierre trop au centre : ${ecart}`);
      assert.ok(ecart < 0.45, `pierre débordant de sa case : ${ecart}`);
      // Elle s'enfonce au lieu de se poser : une pierre posée flotte sur sa
      // facette d'appui, ce que faisait l'ancien dodécaèdre relevé de 0,06.
      assert.ok(position.y < solide, `pierre flottante à ${position.y} sur un sol à ${solide}`);
      assert.ok(position.y > solide - 0.12, 'mais pas engloutie');
      lot.getColorAt(i, couleur);
      teintes.add(couleur.getHexString());
    }
  }
  assert.ok(teintes.size > 1, 'deux pierres voisines n’ont pas le même gris');

  // Déterminisme : deux montages rendent exactement le même éboulis.
  const bis = creerDecor(grille, etat, () => solide);
  for (let v = 0; v < 3; v += 1) {
    const a = decor.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh;
    const b = bis.groupe.getObjectByName(`rochers-${v}`) as THREE.InstancedMesh;
    assert.equal(a.count, b.count);
    assert.deepEqual([...a.instanceMatrix.array], [...b.instanceMatrix.array]);
  }
  bis.dispose();
  decor.dispose();
});

test('les pierres se reposent quand le terrain bouge', () => {
  const etat = partie('plaine');
  let sol = 0.4;
  const decor = creerDecor(
    { largeur: 1, hauteur: 1, terrainDe: (): 'montagne' => 'montagne' }, etat, () => sol,
  );
  const lot = decor.groupe.getObjectByName('rochers-1') as THREE.InstancedMesh;
  const mat = new THREE.Matrix4();
  lot.getMatrixAt(0, mat);
  const avant = mat.elements[13]!;
  // Une marée ou un chantier du génie fait descendre le sol : les pierres
  // doivent suivre, sinon elles restent suspendues au-dessus du vide.
  sol = -0.1;
  decor.majRelief();
  lot.getMatrixAt(0, mat);
  assert.ok(mat.elements[13]! < avant - 0.4, 'la pierre a suivi le sol qui descend');
  decor.dispose();
});
