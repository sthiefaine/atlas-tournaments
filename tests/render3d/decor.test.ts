import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { parametresAmbiance } from '../../src/render3d/eclairage';
import {
  cartographierToit, clonerMateriau, creerDecor, oublierFormesDecor, ouvrirChantierDecor,
  poidsFormesDecor, poseDrapeau, REPETITIONS_TOIT, type Decor,
} from '../../src/render3d/decor';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
import { LotInstancie } from '../../src/render3d/lots';
import { terrainLogique } from '../../src/engine/index';
import type { Biome, CleTerrain } from '../../src/schemas/index';
import { ecarts, empreinte } from './empreinte-decor';
import { etatDeScenario } from './monde';
import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import carteBrasDeMer from '../../content/cartes/carte_bras_de_mer.json';
import scenarioBrasDeMer from '../../content/scenarios/bras_de_mer.json';
import carteAlliees from '../../content/cartes/carte_couleurs_alliees.json';
import scenarioAlliees from '../../content/scenarios/couleurs_alliees.json';
import carteChantier from '../../content/cartes/carte_chantier_des_usines.json';
import scenarioChantier from '../../content/scenarios/chantier_des_usines.json';
import { creerUniformesBrouillard, grefferBrouillardSur, type UniformesBrouillard } from '../../src/render3d/terrain';
import { SEUIL_CAPTURE } from '../../src/engine/index';
import { CAT, partie } from '../engine/aides';
import { carteBanc, scenarioBanc } from '../../src/app/atelier/banc';
import { creerPartie, sceneDepuis } from '../../src/engine/index';
import { validerScenario } from '../../src/schemas/index';
import scenarioDemo from '../../content/scenarios/demo.json';
import { construireNuanceur, ligneDe } from './nuanceur';

/** Les matériaux d'un bâtiment, pour lire s'il est effacé ou plein. */
function materiaux(batiment: THREE.Object3D): THREE.MeshStandardNodeMaterial[] {
  return batiment.children.map((m) => (m as THREE.Mesh).material as THREE.MeshStandardNodeMaterial);
}

/** La matrice d'instance d'un lot de pavillons, décomposée. */
function instance(lot: LotInstancie, i: number): { position: THREE.Vector3; echelle: THREE.Vector3 } {
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
  const mats = decor.groupe.getObjectByName('mats') as LotInstancie;
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
  assert.equal(mats.compte, 4, 'un mât par bâtiment');
  assert.equal(drapeaux.compte, 4);
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

test('le port est un bâtiment comme les autres : quai, bassin, grue, mât et palissade', () => {
  const etat = partie('plaine');
  const grille = { largeur: 2, hauteur: 1, terrainDe: () => 'port' as const };
  const enService = { ...etat, proprietaires: { '0,0': 0 as const }, desaffectes: [], unites: [] };
  const decor = creerDecor(grille, enService, () => 0.2);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  assert.equal(batiments.children.length, 2, 'un port par case de port');
  const port = batiments.children[0]!;
  assert.equal(port.userData['type'], 'port');
  // Il se fusionne par matériau comme les autres bâtiments : jamais plus de
  // lots que de matières, sinon un quai coûterait plus qu'une ville.
  assert.ok(port.children.length >= 4 && port.children.length <= 8, `${port.children.length} lots`);
  assert.ok(port.children.every((m) => m instanceof THREE.Mesh));
  // Toutes ses matières sont des matériaux à nœuds du groupe du décor : c'est
  // la seule condition pour que `grefferBrouillardSur` les éteigne comme le
  // reste, sans qu'une ligne soit écrite pour le port.
  assert.ok(port.children.every((m) => (m as THREE.Mesh).material instanceof THREE.MeshStandardNodeMaterial));
  const uniformes = uniformesTemoins();
  grefferBrouillardSur(decor.groupe, uniformes, 'atlas-test-port');
  for (const m of materiaux(port)) assert.equal(m.outputNode, uniformes.sortie, 'le port lit le masque de brouillard');
  // Le bassin : une matière à part, sombre et lisse, qu'aucun autre bâtiment
  // n'emploie — c'est elle qui fait lire une darse plutôt qu'une cour.
  const couleurs = materiaux(port).map((m) => m.color.getHexString());
  assert.ok(couleurs.includes('22434e'), `le bassin manque (${couleurs.join(' ')})`);
  // En service, les vitrages du hangar et le feu du môle s'allument la nuit.
  assert.ok(materiaux(port).some((m) => m.emissive.getHex() !== 0), 'le feu du môle doit pouvoir s’allumer');
  // Et il porte un mât, comme tout bâtiment : c'est là que se lit la capture.
  const mats = decor.groupe.getObjectByName('mats') as LotInstancie;
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
  assert.equal(mats.compte, 2, 'un mât par port');
  assert.equal(instance(drapeaux, 0).echelle.x, 1, 'le port tenu hisse ses couleurs');
  assert.equal(instance(drapeaux, 1).echelle.x, 0, 'le port neutre garde le mât nu');

  // Désaffecté : la palissade le ferme, la grue est démontée, rien n'est rasé.
  const sommets = (b: THREE.Object3D): number => b.children
    .reduce((n, m) => n + (m as THREE.Mesh).geometry.getAttribute('position').count, 0);
  const avant = sommets(port);
  decor.majProprietaires({ ...enService, proprietaires: {}, desaffectes: ['0,0'] });
  const ferme = batiments.children.find((b) => b.userData['case'] === '0,0')!;
  assert.equal(ferme.userData['desaffecte'], true);
  assert.ok(sommets(ferme) > avant, 'la palissade s’ajoute, rien ne s’effondre');
  assert.ok(!materiaux(ferme).some((m) => m.emissive.getHex() !== 0), 'un port fermé n’allume rien');
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
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
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
  const vitrage = (i: number): THREE.MeshStandardNodeMaterial => materiaux(batiments.children[i]!)
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
  assert.ok((calotte.material as THREE.MeshStandardNodeMaterial).transparent, 'la parabole devient translucide aussi');
  decor.majProprietaires(e);
  assert.ok(!(calotte.material as THREE.MeshStandardNodeMaterial).transparent);
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
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
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
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
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
  const drapeaux = tenue.groupe.getObjectByName('drapeaux') as LotInstancie;
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

test('les détails architecturaux restent fusionnés par rôle, et une capture ne les refond pas', () => {
  const etat = partie('plaine');
  const types = ['ville', 'qg', 'usine', 'aeroport'] as const;
  const decor = creerDecor({ largeur: 4, hauteur: 1, terrainDe: (x) => types[x]! }, etat, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  let geometriesLiberees = 0;
  const avant = new Map<string, THREE.BufferGeometry[]>();
  for (const b of batiments.children) {
    assert.ok(b.children.length <= 7, 'les détails ne multiplient pas les appels de dessin');
    avant.set(String(b.userData['case']), b.children.map((m) => {
      assert.ok(m instanceof THREE.Mesh);
      m.geometry.addEventListener('dispose', () => { geometriesLiberees += 1; });
      return m.geometry;
    }));
  }
  decor.majProprietaires({ ...etat, proprietaires: { ...etat.proprietaires, '0,0': 1 } });
  // Les silhouettes sont **gardées** : elles ne dépendent que du terrain et de
  // l'état de service, jamais du camp qui tient la case. Une capture rebâtit
  // les mailles et leurs matières, elle ne refond plus la ville.
  assert.equal(geometriesLiberees, 0, 'une capture ne libère aucune silhouette');
  for (const b of batiments.children) {
    const memes = avant.get(String(b.userData['case']))!;
    assert.deepEqual(b.children.map((m) => (m as THREE.Mesh).geometry), memes,
      'la case retrouve exactement les géométries fondues du montage précédent');
  }
  // Le camp, lui, a bien changé de matière.
  const prise = batiments.children.find((b) => b.userData['case'] === '0,0')!;
  assert.ok(prise.children.some((m) => {
    const mat = (m as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
    return mat.color.getHexString() !== 'ffffff';
  }));
  decor.dispose();
});

test('les biomes portent des silhouettes de végétation distinctes sans multiplier les instances', () => {
  const etat = partie('plaine');
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'foret' as const };
  const alpine = creerDecor(grille, etat, () => 0, 'montagne');
  const tropical = creerDecor(grille, etat, () => 0, 'archipel');
  const coniferes = alpine.groupe.getObjectByName('coniferes') as LotInstancie;
  const palmes = tropical.groupe.getObjectByName('palmes') as LotInstancie;
  assert.equal(coniferes.compte, 3);
  assert.equal(palmes.compte, 3);
  assert.notEqual(coniferes.geometry.getAttribute('position').count, palmes.geometry.getAttribute('position').count);
  alpine.dispose(); tropical.dispose();
});

test('la réduction hivernale des couronnes conserve leurs positions sur le plateau', () => {
  const etat = partie('plaine');
  const decor = creerDecor({ largeur: 3, hauteur: 3, terrainDe: () => 'foret' }, etat, () => 0, 'marais');
  const feuillus = decor.groupe.getObjectByName('feuillus') as LotInstancie;
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
  const lots = [0, 1, 2].map((v) => decor.groupe.getObjectByName(`rochers-${v}`) as LotInstancie);

  for (const lot of lots) assert.ok(lot instanceof LotInstancie, 'trois silhouettes, trois lots');
  // Trois volumes distincts : c'est tout l'objet de la reprise. Un seul
  // polyèdre régulier répété donnait une caillasse de dés.
  const sommets = lots.map((l) => l.geometry.getAttribute('position').count);
  assert.equal(new Set(lots.map((l) => l.geometry.uuid)).size, 3);
  assert.ok(sommets.every((n) => n > 0));

  const total = lots.reduce((n, l) => n + l.compte, 0);
  assert.ok(total >= 3 && total <= 5, `trois à cinq pierres par case, vu ${total}`);
  assert.ok(lots[0]!.compte + lots[2]!.compte === 1, 'un seul gros bloc, ou une seule dalle');

  const mat = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const couleur = new THREE.Color();
  const teintes = new Set<string>();
  for (const lot of lots) {
    for (let i = 0; i < lot.compte; i += 1) {
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
    const a = decor.groupe.getObjectByName(`rochers-${v}`) as LotInstancie;
    const b = bis.groupe.getObjectByName(`rochers-${v}`) as LotInstancie;
    assert.equal(a.compte, b.compte);
    assert.deepEqual([...a.matricesAPlat()], [...b.matricesAPlat()]);
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
  const lot = decor.groupe.getObjectByName('rochers-1') as LotInstancie;
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

test('changer de grille ressème les arbres, les rochers, les mâts, et rebâtit les bâtiments', () => {
  const etat = partie('plaine');
  const nue = { largeur: 4, hauteur: 2, terrainDe: (): 'plaine' => 'plaine' };
  const decor = creerDecor(nue, etat, () => 0);
  const compter = (nom: string): number => (decor.groupe.getObjectByName(nom) as LotInstancie | null)?.compte ?? 0;
  const batiments = (): number => decor.groupe.getObjectByName('batiments')!.children.length;
  assert.equal(compter('troncs'), 0);
  assert.equal(compter('rochers-1'), 0);
  assert.equal(compter('mats'), 0);
  assert.equal(batiments(), 0);

  // Une forêt, une montagne, une ville : tout ce qui dérive de la grille doit
  // apparaître, alors que la scène n'a pas été démontée. C'est le cas du génie
  // qui pose du terrain, et celui de l'atelier qui change de carte.
  const peuplee = {
    largeur: 4, hauteur: 2,
    terrainDe: (x: number): 'foret' | 'montagne' | 'ville' | 'plaine' =>
      x === 0 ? 'foret' : x === 1 ? 'montagne' : x === 2 ? 'ville' : 'plaine',
  };
  decor.majGrille(peuplee);
  decor.majProprietaires(etat);
  assert.ok(compter('troncs') > 0, 'les arbres de la forêt manquent');
  assert.ok(compter('rochers-1') > 0, 'les pierres de la montagne manquent');
  assert.equal(compter('mats'), 2, 'chaque ville doit avoir son mât');
  assert.equal(batiments(), 2, 'les villes des deux lignes manquent');
  // Une prise de drapeau se trouve sur la nouvelle grille, pas sur l'ancienne.
  assert.ok(decor.drapeau('2,0'), 'la ville replantée doit avoir un drapeau');
  assert.equal(decor.drapeau('3,0'), null);

  // Et dans l'autre sens : raser la forêt retire ses arbres.
  decor.majGrille(nue);
  decor.majProprietaires(etat);
  assert.equal(compter('troncs'), 0, 'les arbres d’une forêt rasée doivent partir');
  assert.equal(compter('mats'), 0);
  assert.equal(batiments(), 0);
  decor.dispose();
});

// ---------------------------------------------------------------------------
// Le relief des toits
// ---------------------------------------------------------------------------

test('les toits portent un micro-relief partagé, blanchi par la neige, libéré avec le décor', () => {
  const etat = partie('plaine');
  // Une ville, une usine désaffectée, une station : tout ce qui a un toit, en
  // service ou non. Le QG et l'aéroport n'en composent pas.
  const types = ['ville', 'usine', 'radar'] as const;
  const grille = { largeur: 3, hauteur: 1, terrainDe: (x: number) => types[x]! };
  const decor = creerDecor(grille, { ...etat, proprietaires: {}, desaffectes: ['1,0'], unites: [] }, () => 0);
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const normales = new Set<string>();
  const albedos = new Set<string>();
  for (const b of batiments.children) {
    const toiture = b.getObjectByName('toiture') as THREE.Mesh | undefined;
    assert.ok(toiture, `${String(b.userData['type'])} : un toit fusionné, et nommé`);
    const m = toiture.material as THREE.MeshStandardNodeMaterial;
    assert.ok(m.normalMap, 'le toit a des normales');
    assert.ok(m.map, 'et un albédo discret');
    assert.equal(m.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(m.normalMap.colorSpace, THREE.NoColorSpace);
    normales.add(m.normalMap.uuid);
    albedos.add(m.map.uuid);
    // Les UV du toit sont à l'échelle du monde : leur étendue en u suit celle
    // du pan en x, et non la face de 0 à 1 d'une boîte.
    const uv = toiture.geometry.getAttribute('uv');
    const pos = toiture.geometry.getAttribute('position');
    const nor = toiture.geometry.getAttribute('normal');
    let dessus = 0;
    for (let i = 0; i < uv.count; i += 1) {
      if (nor.getY(i) < 0.8) continue;
      dessus += 1;
      assert.ok(Math.abs(Math.abs(uv.getX(i)) - Math.abs(pos.getX(i)) * REPETITIONS_TOIT) < 1e-5, 'u à l’échelle du monde');
      assert.ok(Math.abs(uv.getY(i) - pos.getZ(i) * REPETITIONS_TOIT) < 1e-5, 'v à l’échelle du monde');
    }
    assert.ok(dessus >= 4, 'au moins un dessus de pan');
  }
  assert.equal(normales.size, 1, 'un seul jeu de normales pour toute la carte, désaffectés compris');
  assert.equal(albedos.size, 1);
  assert.ok(batiments.children[1]!.userData['desaffecte'], 'l’usine est bien désaffectée');

  // La neige blanchit le toit comme avant : la couleur reste au matériau.
  const toit = (batiments.children[0]!.getObjectByName('toiture') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
  const ete = toit.color.clone();
  decor.appliquerAmbiance(parametresAmbiance('hiver', 'jour', 'neige'), 'hiver');
  assert.ok(toit.color.r > ete.r && toit.color.g > ete.g && toit.color.b > ete.b, 'le toit blanchit sous la neige');
  assert.ok(toit.map, 'sans perdre sa couverture');

  // Un bâtiment occupé garde sa couverture sur son jumeau translucide.
  decor.majProprietaires({ ...etat, proprietaires: {}, desaffectes: ['1,0'], unites: [{ ...etat.unites[0]!, x: 0, y: 0 }] });
  const fantome = (batiments.children[0]!.getObjectByName('toiture') as THREE.Mesh).material as THREE.MeshStandardNodeMaterial;
  assert.ok(fantome.transparent && fantome.normalMap === toit.normalMap);

  let liberees = 0;
  toit.normalMap!.addEventListener('dispose', () => { liberees += 1; });
  toit.map!.addEventListener('dispose', () => { liberees += 1; });
  decor.dispose();
  assert.equal(liberees, 2, 'les deux textures de toit sont libérées avec le décor');
});

test('un pan de toit est cartographié à l’échelle du monde, ses rangs descendant la pente', () => {
  const f = REPETITIONS_TOIT;
  const dessus = (geo: THREE.BufferGeometry): number[] => {
    const nor = geo.getAttribute('normal');
    const indices: number[] = [];
    for (let i = 0; i < nor.count; i += 1) if (nor.getY(i) > 0.8) indices.push(i);
    return indices;
  };
  // Le pan droit d'une maison : il regarde +X, son égout est en +X, u suit x.
  const droit = new THREE.BoxGeometry(0.2, 0.03, 0.35).rotateZ(-0.43).translate(0.1, 0.5, 0.2);
  cartographierToit(droit);
  const hautsDroit = dessus(droit);
  assert.equal(hautsDroit.length, 4, 'les quatre sommets du dessus');
  for (const i of hautsDroit) {
    assert.ok(Math.abs(droit.getAttribute('uv').getX(i) - droit.getAttribute('position').getX(i) * f) < 1e-9, 'u suit x');
    assert.ok(Math.abs(droit.getAttribute('uv').getY(i) - droit.getAttribute('position').getZ(i) * f) < 1e-9, 'v suit z');
  }
  // Le pan gauche regarde −X : u est retourné, pour que ses tuiles se recouvrent vers son égout.
  const gauche = new THREE.BoxGeometry(0.2, 0.03, 0.35).rotateZ(0.43).translate(-0.1, 0.5, 0.2);
  cartographierToit(gauche);
  const hautsGauche = dessus(gauche);
  assert.equal(hautsGauche.length, 4);
  for (const i of hautsGauche) {
    assert.ok(Math.abs(gauche.getAttribute('uv').getX(i) + gauche.getAttribute('position').getX(i) * f) < 1e-9, 'u suit −x');
    assert.ok(Math.abs(gauche.getAttribute('uv').getY(i) - gauche.getAttribute('position').getZ(i) * f) < 1e-9, 'v suit z');
  }
  // Deux pans de largeurs différentes portent la même densité : l'étendue en u
  // est proportionnelle à la largeur, ce que la face de 0 à 1 d'une boîte ne
  // donnait pas.
  const etendue = (geo: THREE.BufferGeometry): number => {
    const uv = geo.getAttribute('uv');
    const us = dessus(geo).map((i) => uv.getX(i));
    return Math.max(...us) - Math.min(...us);
  };
  // Les positions sont en float32 : la tolérance est celle de ce format, pas du double.
  const petit = cartographierToit(new THREE.BoxGeometry(0.18, 0.03, 0.35));
  const grand = cartographierToit(new THREE.BoxGeometry(0.36, 0.03, 0.58));
  assert.ok(Math.abs(etendue(petit) - 0.18 * f) < 1e-6, `étendue ${etendue(petit)} pour un pan de 0,18`);
  assert.ok(Math.abs(etendue(grand) - 0.36 * f) < 1e-6, `étendue ${etendue(grand)} pour un pan de 0,36`);
  // Une tranche prend les deux autres axes : elle n'est jamais laissée à ses UV de face.
  const tranche = dessus(petit);
  const uv = petit.getAttribute('uv');
  const pos = petit.getAttribute('position');
  for (let i = 0; i < uv.count; i += 1) {
    if (tranche.includes(i)) continue;
    const n = petit.getAttribute('normal');
    if (Math.abs(n.getX(i)) > 0.8) assert.ok(Math.abs(uv.getX(i) - pos.getY(i) * f) < 1e-9, 'tranche en x : u suit y');
    if (Math.abs(n.getZ(i)) > 0.8) assert.ok(Math.abs(uv.getY(i) - pos.getY(i) * f) < 1e-9, 'tranche en z : v suit y');
  }
});

// ---------------------------------------------------------------------------
// Ce qui ne change pas ne se refait pas : survol, image, ambiance
// ---------------------------------------------------------------------------

test('majProprietaires ne rebalaye rien tant que bâtiments, occupants et lueurs n’ont pas changé', () => {
  const etat = partie('plaine');
  const soldat = etat.unites[0]!;
  const grille = { largeur: 3, hauteur: 1, terrainDe: () => 'ville' as const };
  const e = { ...etat, proprietaires: { '0,0': 0 as const, '1,0': 1 as const }, desaffectes: [], unites: [{ ...soldat, x: 5, y: 5 }] };
  const decor = creerDecor(grille, e, () => 0);
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
  const batiments = decor.groupe.getObjectByName('batiments')!;
  decor.majProprietaires(e, null, CAT);
  const version = drapeaux.instanceMatrix.version;
  const mailles = batiments.children.flatMap((b) => b.children as THREE.Mesh[]);
  const avant = mailles.map((m) => m.material);

  // Un survol : même état, ou un état égal, mêmes cases vues. Les pavillons ne
  // repartent pas au processeur graphique, les matériaux ne sont pas
  // réassignés. (Passer d'aucun brouillard à un ensemble de cases vues n'est
  // pas un survol : c'est un changement d'aspect, testé plus bas.)
  decor.majProprietaires(e, null, CAT);
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 6, y: 6 }] }, null, CAT);
  assert.equal(drapeaux.instanceMatrix.version, version, 'rien renvoyé au GPU');
  assert.deepEqual(mailles.map((m) => m.material), avant);

  // Une unité qui monte sur une ville change l'aspect ; une unité en plaine, non.
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 0, y: 0 }] }, null, CAT);
  assert.ok(drapeaux.instanceMatrix.version > version, 'le fantôme et le drapeau sont refaits');
  const v2 = drapeaux.instanceMatrix.version;
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 0, y: 0 }] }, null, CAT);
  assert.equal(drapeaux.instanceMatrix.version, v2);
  // Ses points de capture aussi : le drapeau descend avec eux.
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 0, y: 0, pointsCapture: 10 }] }, null, CAT);
  assert.ok(drapeaux.instanceMatrix.version > v2, 'la capture qui avance se voit');
  const v3 = drapeaux.instanceMatrix.version;
  // La même unité cachée par le brouillard : c'est un autre aspect, sans rien révéler.
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 0, y: 0, pointsCapture: 10 }] }, new Set(), CAT);
  assert.ok(drapeaux.instanceMatrix.version > v3);
  assert.equal(instance(drapeaux, 0).echelle.x, 1, 'le drapeau du camp reste hissé');

  // Une lueur de chantier salit l'aspect sans changer l'état.
  const v4 = drapeaux.instanceMatrix.version;
  decor.chantier('1,0')!.eclairer(0.8);
  decor.majProprietaires({ ...e, unites: [{ ...soldat, x: 0, y: 0, pointsCapture: 10 }] }, new Set(), CAT);
  assert.ok(drapeaux.instanceMatrix.version > v4, 'la lueur est appliquée à la vue suivante');
  // Un propriétaire qui change rebâtit, comme avant.
  const v5 = drapeaux.instanceMatrix.version;
  decor.majProprietaires({ ...e, proprietaires: { '0,0': 1 as const } }, null, CAT);
  assert.ok(drapeaux.instanceMatrix.version > v5);
  assert.equal(instance(drapeaux, 1).echelle.x, 0, 'la ville rendue neutre baisse pavillon');
  decor.dispose();
});

test('l’ambiance n’est repeinte que si ses paramètres ou la saison changent', () => {
  const etat = partie('plaine');
  const grille = { largeur: 2, hauteur: 1, terrainDe: (x: number) => (x === 0 ? 'ville' as const : 'foret' as const) };
  const decor = creerDecor(grille, { ...etat, proprietaires: { '0,0': 0 }, unites: [] }, () => 0);
  const p = parametresAmbiance('ete', 'jour', 'clair');
  decor.appliquerAmbiance(p, 'ete');
  const batiment = decor.groupe.getObjectByName('batiments')!.children[0]!;
  const mats = materiaux(batiment);
  const arbres = decor.groupe.children.filter((o): o is LotInstancie => o instanceof LotInstancie);
  const tous = [...mats, ...arbres.map((a) => a.material as THREE.MeshStandardNodeMaterial)];
  // On noircit tout : si l'ambiance repasse, elle repeint.
  for (const m of tous) m.color.setHex(0x000000);
  decor.appliquerAmbiance(p, 'ete');
  assert.ok(tous.every((m) => m.color.getHex() === 0), 'même objet, même saison : rien repeint');
  decor.appliquerAmbiance(p, 'automne');
  assert.ok(tous.some((m) => m.color.getHex() !== 0), 'une autre saison repeint');
  for (const m of tous) m.color.setHex(0x000000);
  // `parametresAmbiance` rend le même objet pour le même triplet ; une transition,
  // elle, mélange deux ambiances dans un objet neuf à chaque image.
  decor.appliquerAmbiance({ ...p }, 'automne');
  assert.ok(tous.some((m) => m.color.getHex() !== 0), 'un objet neuf — une transition — repeint');
  decor.dispose();
});

test('la toile des drapeaux bat trente fois par seconde au plus, sans cesser de demander l’image', () => {
  const etat = partie('plaine');
  const grille = { largeur: 1, hauteur: 1, terrainDe: () => 'ville' as const };
  const decor = creerDecor(grille, { ...etat, proprietaires: { '0,0': 0 }, unites: [] }, () => 0);
  const pos = (decor.groupe.getObjectByName('drapeaux') as LotInstancie).geometry.getAttribute('position');
  const avant = [...pos.array];
  assert.ok(decor.avancer(16), 'la boucle doit continuer');
  assert.deepEqual([...pos.array], avant, 'à soixante images par seconde, une image sur deux ne réécrit pas la toile');
  assert.ok(decor.avancer(16));
  assert.deepEqual([...pos.array], avant);
  assert.ok(decor.avancer(16));
  assert.notDeepEqual([...pos.array], avant, 'le battement est arrivé, au tiers de la période');
  decor.dispose();
});

// ---------------------------------------------------------------------------
// Le brouillard de guerre : ce qui est hors de vue est dans le noir
// ---------------------------------------------------------------------------

/** Les uniformes du brouillard, tels que le plateau les partage. */
function uniformesTemoins(): UniformesBrouillard {
  return creerUniformesBrouillard(new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat), 2, 1);
}

test('tout le décor lit le masque de brouillard, après l’éclairage et par instance', () => {
  // Le brouillard ne se peint plus en noircissant les couleurs : un matériau
  // noir garde le reflet du studio et l'éclat du soleil, et c'est ce gris qu'on
  // voyait à travers le noir. Bâtiments, arbres, pierres et pavillons lisent
  // désormais le même masque que le sol, dans le nuanceur, après l'éclairage.
  const etat = partie('plaine');
  const grille = { largeur: 2, hauteur: 1, terrainDe: () => 'ville' as const };
  const e = { ...etat, proprietaires: { '0,0': 0 as const, '1,0': 1 as const }, desaffectes: [], unites: [] };
  const decor = creerDecor(grille, e, () => 0);
  const uniformes = uniformesTemoins();
  grefferBrouillardSur(decor.groupe, uniformes, 'atlas-test');

  let greffes = 0;
  let instancies = 0;
  decor.groupe.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (!(mat instanceof THREE.MeshStandardNodeMaterial)) return;
    greffes += 1;
    // Le même nœud de sortie pour tout le décor : le masque, après l'éclairage.
    assert.equal(mat.outputNode, uniformes.sortie, `${o.name} lit le masque`);
    if (o instanceof LotInstancie) instancies += 1;
  });
  assert.ok(greffes > 5, `tout le décor est greffé (${greffes} matériaux)`);
  assert.ok(instancies > 0, 'dont des lots instanciés');

  // Le WGSL d'un lot instancié — les drapeaux, qui ont aussi une couleur par
  // instance — : la position monde que lit le masque est calculée par le
  // sommet **après** la matrice d'instance. Sans cela, toutes les copies d'un
  // lot liraient la case de l'origine du lot ; le moteur à nœuds l'assure de
  // lui-même, là où le GLSL exigeait de l'écrire.
  const drapeaux = decor.groupe.getObjectByName('drapeaux') as LotInstancie;
  const { vertex, fragment } = construireNuanceur(drapeaux);
  // Depuis `lots.ts`, la matrice vient de quatre attributs par instance au lieu
  // du tampon d'uniformes de three — c'est ce qui fait tenir tous les lots dans
  // un programme. L'ordre, lui, ne change pas, et c'est ce qui compte ici.
  const instance = ligneDe(vertex, /varyings\.positionLocal = \( nodeVar\d+ \* vec4<f32>\( varyings\.positionLocal, 1\.0 \) \)\.xyz;/);
  const monde = ligneDe(vertex, /varyings\.v_positionWorld = \( object\.\w+ \* vec4<f32>\( varyings\.positionLocal, 1\.0 \) \)\.xyz;/);
  assert.ok(instance >= 0 && monde > instance, 'la matrice d’instance, puis la position monde');
  assert.match(vertex, /nodeVar\d+ = mat4x4<f32>\( iCol0, iCol1, iCol2, iCol3 \)/, 'la matrice vient des colonnes');
  const teinte = /varyings\.(\w+) = iTeinte;/.exec(vertex)?.[1];
  assert.ok(teinte, 'la couleur par instance passe au fragment');
  assert.ok(!fragment.includes('vInstanceColor'), 'et non par le varying de three, que rien n’écrirait');
  const lecture = ligneDe(fragment, /textureSample\( tVisibles, tVisibles_sampler, clamp\( \( v_positionWorld\.xz \/ object\.uCarteBrouillard \)/);
  const eclaire = ligneDe(fragment, /^\s*Output = /);
  assert.ok(eclaire >= 0 && lecture > eclaire, 'le masque se lit après la couleur éclairée');
  assert.ok(fragment.includes(teinte!), 'et la teinte d’instance entre dans le diffus');

  // Greffer deux fois ne change rien, et un jumeau translucide — un clone —
  // naît greffé : le moteur à nœuds recopie les nœuds d'un matériau cloné.
  grefferBrouillardSur(decor.groupe, uniformes, 'atlas-test');
  const batiments = decor.groupe.getObjectByName('batiments')!;
  const opaque = materiaux(batiments.children[0]!)[0]!;
  assert.equal(opaque.outputNode, uniformes.sortie);
  decor.majProprietaires({ ...e, unites: [{ ...etat.unites[0]!, x: 0, y: 0 }] }, null);
  const fantome = materiaux(batiments.children[0]!)[0]!;
  assert.notEqual(fantome, opaque);
  assert.ok(fantome.transparent);
  assert.equal(fantome.outputNode, uniformes.sortie, 'le jumeau porte la greffe de son original');
  assert.equal(fantome.color.getHex(), opaque.color.getHex(), 'et sa couleur');
  assert.equal(fantome.roughness, opaque.roughness, 'et sa rugosité');
  decor.dispose();
});

test('clonerMateriau rend un jumeau complet : nœuds, réglages, cartes', () => {
  // `NodeMaterial.clone()` (three r170) ne recopie que les nœuds et les champs
  // de `Material` : couleur, cartes et rugosité repartent aux valeurs par
  // défaut. C'est ce que le jumeau translucide d'un bâtiment ne peut pas perdre.
  const carte = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const source = new THREE.MeshStandardNodeMaterial({
    color: 0x8844aa, emissive: 0x112233, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.2,
    map: carte, normalMap: carte, normalScale: new THREE.Vector2(0.4, 0.4), flatShading: true, side: THREE.DoubleSide,
  });
  source.outputNode = uniformesTemoins().sortie;
  const nu = source.clone();
  assert.equal(nu.color.getHex(), 0xffffff, 'three : un clone perd sa couleur');
  assert.equal(nu.map, null, 'et ses cartes');
  const jumeau = clonerMateriau(source);
  assert.equal(jumeau.color.getHex(), 0x8844aa);
  assert.equal(jumeau.emissive.getHex(), 0x112233);
  assert.equal(jumeau.emissiveIntensity, 0.7);
  assert.equal(jumeau.roughness, 0.3);
  assert.equal(jumeau.metalness, 0.2);
  assert.equal(jumeau.map, carte);
  assert.equal(jumeau.normalMap, carte);
  assert.deepEqual([jumeau.normalScale.x, jumeau.normalScale.y], [0.4, 0.4]);
  assert.equal(jumeau.flatShading, true);
  assert.equal(jumeau.side, THREE.DoubleSide);
  assert.equal(jumeau.outputNode, source.outputNode, 'les nœuds voyagent avec le clone');
  assert.notEqual(jumeau.color, source.color, 'une couleur à lui : le jumeau se teinte sans teindre l’original');
  carte.dispose();
});

test('une unité cachée ne rend pas son bâtiment translucide', () => {
  const etat = partie('plaine');
  const grille = { largeur: 2, hauteur: 1, terrainDe: () => 'ville' as const };
  const u = { ...etat.unites[0]!, x: 1, y: 0, camp: 1 as const };
  const e = { ...etat, proprietaires: { '0,0': 0 as const, '1,0': 1 as const }, desaffectes: [], unites: [u] };
  const decor = creerDecor(grille, e, () => 0);
  const cachee = decor.groupe.getObjectByName('batiments')!.children[1]!;

  decor.majProprietaires(e, null);
  const occupe = materiaux(cachee).some((m) => m.transparent);
  assert.ok(occupe, 'sans brouillard, la ville occupée se laisse voir au travers');

  decor.majProprietaires(e, new Set(['0,0']));
  assert.ok(
    !materiaux(cachee).some((m) => m.transparent),
    'la case étant hors de vue, rien ne dit qu’une unité s’y trouve',
  );
  decor.dispose();
});

test('un `InstancedMesh` écrit son compte dans le nuanceur — la raison d’être de `lots.ts`', () => {
  // Piège de r170, trouvé le 8 septembre 2026 en cherchant les cousins du défaut
  // de la flèche. Sous les mille instances, `InstanceNode` range les matrices
  // dans un tampon d'uniformes dont la taille est **écrite en dur** dans le
  // WGSL, avec le `count` du premier rendu ; et la clé de l'objet de rendu ne
  // porte que l'identifiant de la maille, jamais son compte. Relever `count`
  // ensuite ne recompile donc rien, et les instances au-delà lisent hors du
  // tableau — d'où un lot qui se **rebâtit** au lieu de se régler, et un
  // programme par lot.
  //
  // Le décor ne passe plus par là : ses lots sont des `LotInstancie`, qui
  // instancient par attributs. Ce test garde la règle du moteur sous les yeux,
  // parce que c'est elle qui interdit d'y revenir.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0x808080 });
  const taille = (compte: number): string | undefined => {
    const lot = new THREE.InstancedMesh(geo, mat, 64);
    lot.count = compte;
    const { vertex } = construireNuanceur(lot, { lumieres: false, brume: false });
    return /array<\s*mat4x4<f32>\s*,\s*(\d+)\s*>/.exec(vertex)?.[1];
  };
  assert.equal(taille(2), '2', 'le nuanceur ne connaît que le compte du moment');
  assert.equal(taille(6), '6', 'et non la capacité du lot');
});

test('un lot instancié vide s’éteint, et son groupe avec lui', () => {
  // `RenderObject.getDrawParameters` fait `object.count > 1 ? object.count : 1`
  // pour une maille instanciée : un lot à zéro coûtait un appel de dessin et une
  // instance à matrice nulle. Un `LotInstancie` y échappe — le compte passe par
  // `geometry.instanceCount`, et zéro rend `null`. On l'éteint tout de même,
  // pour une autre raison : une maille éteinte est ignorée par la **passe
  // d'ombres**, qui ne lit pas le compte.
  const source = readFileSync('node_modules/three/src/renderers/common/RenderObject.js', 'utf8');
  assert.ok(source.includes('object.count > 1 ? object.count : 1'), 'la règle du moteur n’a pas changé');

  // Une carte de forêt : des arbres, des rochers, un seul bâtiment — donc des
  // lots pleins et des lots vides, dans la même scène.
  const etat = partie('plaine');
  const grille = { largeur: 4, hauteur: 2, terrainDe: (x: number, y: number): 'foret' | 'plaine' | 'ville' => (
    y === 0 ? (x === 0 ? 'ville' : 'foret') : 'plaine') };
  const decor = creerDecor(grille, { ...etat, proprietaires: { '0,0': 1 as const }, unites: [] }, () => 0);
  const lots = [...decor.groupe.children, ...decor.groupe.children.flatMap((o) => o.children)]
    .filter((o): o is LotInstancie => o instanceof LotInstancie);
  assert.ok(lots.length > 0);
  for (const lot of lots) {
    assert.equal(lot.visible, lot.compte > 0, `${lot.name} : visible si et seulement s’il porte quelque chose`);
  }
  decor.dispose();
});

// ---------------------------------------------------------------------------
// L'empreinte : la preuve qu'un remaniement n'a rien déplacé
// ---------------------------------------------------------------------------

/**
 * Un relief de banc : une bosse et un creux, déterministes, sans plateau ni
 * texture. Ce qu'on vérifie ici est le décor, pas le sol qu'il épouse — mais il
 * faut qu'il l'épouse, sinon l'empreinte ne dirait rien des poses.
 */
function reliefTemoin(x: number, z: number): number {
  return 0.05 * Math.sin(x * 1.3) + 0.03 * Math.cos(z * 0.7);
}

/** Le décor d'un scénario du canon, sur un relief de banc. */
function decorDe(carte: unknown, scenario: unknown, biome: Biome): Decor {
  const { etat, cat } = etatDeScenario(carte, scenario);
  const grille: GrilleTerrain = {
    largeur: etat.largeur,
    hauteur: etat.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(etat, cat, { x, y }) ?? 'plaine',
  };
  return creerDecor(grille, etat, reliefTemoin, biome);
}

/**
 * Les empreintes figées, prises **avant** le découpage en tranches et la
 * mémorisation des formes (8 septembre 2026) et inchangées depuis. Cinq couples
 * carte × biome qui portent, ensemble, les six terrains bâtis, un bâtiment
 * désaffecté, une station radar, un port, un rivage d'écume et un de galets.
 *
 * Un chiffre qui bouge ici veut dire qu'un sommet, une pose, une teinte
 * d'instance ou une matière a changé. Si c'est voulu, on relève l'empreinte et
 * on écrit pourquoi ; sinon, c'est une régression.
 *
 * **Relevées à nouveau le 8 septembre 2026**, et pour une raison qui n'est pas
 * un changement de scène : l'empreinte ne hache plus que les instances
 * **dessinées**. Au-delà du compte, le tampon d'un lot n'atteint pas l'écran, et
 * un lot vide y gardait une pose morte — deux façons de ne rien dessiner se
 * lisaient comme deux scènes. La preuve que rien n'a bougé est directe : la même
 * règle appliquée au code d'avant `lots.ts` rend ces cinq condensés-ci, au
 * caractère près.
 */
// 12 septembre : la plaine inclut le lot paysage-gazon ajouté par 9f378cd.
// Deuxième passe du 12 septembre : haies, bottes, parcelles et touffes refaites, buissons et fougères ajoutés au bocage.
// Troisième passe du 12 septembre : feuillages pliés, troncs ramifiés et conifères en rameaux sur tous les biomes tempérés.
// Les effectifs et les placements restent identiques ; seules les géométries et matières changent.
const EMPREINTES: ReadonlyArray<readonly [string, unknown, unknown, Biome, string, number]> = [
  ['demo', carteDemo, scenarioDemo, 'plaine', '2a0e8be5', 118],
  ['demo', carteDemo, scenarioDemo, 'marais', 'b32d1dea', 113],
  ['bras_de_mer', carteBrasDeMer, scenarioBrasDeMer, 'cotier', '78bd3341', 161],
  ['couleurs_alliees', carteAlliees, scenarioAlliees, 'montagne', '6ff4a9a0', 69],
  ['chantier_des_usines', carteChantier, scenarioChantier, 'neige', '0993fdf4', 72],
];

for (const [nom, carte, scenario, biome, digest, objets] of EMPREINTES) {
  test(`le décor de ${nom} en ${biome} rend exactement la même scène qu’avant`, () => {
    oublierFormesDecor();
    const decor = decorDe(carte, scenario, biome);
    const e = empreinte(decor.groupe);
    assert.equal(e.lignes.length, objets, 'le nombre d’objets du décor');
    assert.equal(e.digest, digest, `l’empreinte du décor de ${nom} en ${biome} a changé`);
    decor.dispose();
  });
}

test('le chantier en tranches rend exactement le décor que creerDecor rend d’un bloc', () => {
  for (const [nom, carte, scenario, biome] of EMPREINTES) {
    const { etat, cat } = etatDeScenario(carte, scenario);
    const grille: GrilleTerrain = {
      largeur: etat.largeur,
      hauteur: etat.hauteur,
      terrainDe: (x, y): CleTerrain => terrainLogique(etat, cat, { x, y }) ?? 'plaine',
    };
    oublierFormesDecor();
    const bloc = creerDecor(grille, etat, reliefTemoin, biome);
    const attendu = empreinte(bloc.groupe);
    bloc.dispose();

    oublierFormesDecor();
    const chantier = ouvrirChantierDecor(grille, etat, reliefTemoin, biome);
    // Personne ne dessine avant la dernière tranche, mais rien ne doit lever
    // en chemin : c'est l'ordonnanceur d'`index.ts` qui les joue, une par tâche.
    for (const tranche of chantier.tranches) tranche();
    const obtenu = empreinte(chantier.decor().groupe);
    assert.equal(obtenu.digest, attendu.digest,
      `${nom} en ${biome} : les tranches ne rendent pas le même décor\n${ecarts(attendu, obtenu).join('\n')}`);
    chantier.decor().dispose();
  }
});

test('aucune tranche du décor ne bâtit plus de quelques cases à la fois', () => {
  const { etat, cat } = etatDeScenario(carteDemo, scenarioDemo);
  const grille: GrilleTerrain = {
    largeur: etat.largeur,
    hauteur: etat.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(etat, cat, { x, y }) ?? 'plaine',
  };
  const chantier = ouvrirChantierDecor(grille, etat, reliefTemoin, 'plaine');
  // Douze bâtiments sur la carte de démonstration : quatre par tranche, plus la
  // tranche qui vide la génération précédente.
  const batis = [...Array(etat.hauteur).keys()].flatMap((y) => [...Array(etat.largeur).keys()]
    .filter((x) => ['ville', 'qg', 'usine', 'aeroport', 'radar', 'port']
      .includes(terrainLogique(etat, cat, { x, y }) ?? 'plaine')));
  // Arbres, pierres, accessoires, rivage, pavillons, la remise à zéro des
  // bâtiments, leurs paquets, et la pose finale.
  const attendues = 6 + Math.ceil(batis.length / 4) + 1;
  assert.equal(chantier.tranches.length, attendues,
    `${chantier.tranches.length} tranches pour ${batis.length} bâtiments`);
  for (const tranche of chantier.tranches) tranche();
  chantier.decor().dispose();
});

test('un décor libéré ne touche pas aux formes du décor suivant', () => {
  // C'est la faute de `CalqueUnites.dispose()`, qui vidait deux caches pourtant
  // au niveau module : un montage libérait ce que le suivant allait reprendre.
  oublierFormesDecor();
  const premier = decorDe(carteDemo, scenarioDemo, 'plaine');
  const second = decorDe(carteDemo, scenarioDemo, 'plaine');
  const empreinteAvant = empreinte(second.groupe);

  let liberees = 0;
  const vues = new Set<THREE.BufferGeometry>();
  second.groupe.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (!g || vues.has(g)) return;
    vues.add(g);
    g.addEventListener('dispose', () => { liberees += 1; });
  });
  assert.ok(vues.size > 20, 'le décor porte bien des dizaines de géométries');

  premier.dispose();
  assert.equal(liberees, 0, 'libérer un décor n’emporte aucune géométrie du suivant');
  // Et le second reste dessinable à l'identique : mêmes sommets, mêmes poses.
  const empreinteApres = empreinte(second.groupe);
  assert.equal(empreinteApres.digest, empreinteAvant.digest,
    ecarts(empreinteAvant, empreinteApres).join('\n'));
  for (const g of vues) {
    assert.ok((g.getAttribute('position') as THREE.BufferAttribute).count > 0);
  }
  second.dispose();
});

test('les formes mémorisées du décor sont bornées, et deux montages ne les repaient pas', () => {
  oublierFormesDecor();
  assert.equal(poidsFormesDecor().formes, 0, 'oublierFormesDecor vide bien le cache');
  const premier = decorDe(carteDemo, scenarioDemo, 'plaine');
  const apresUn = poidsFormesDecor();
  premier.dispose();
  // Le second montage de la même carte ne taille plus rien : mêmes formes,
  // même poids. C'est tout l'objet du cache.
  const second = decorDe(carteDemo, scenarioDemo, 'plaine');
  assert.deepEqual(poidsFormesDecor(), apresUn, 'un second montage ne taille aucune forme de plus');
  second.dispose();

  // Neuf biomes de plus, deux cartes : le cache est borné, il ne grandit pas
  // sans fin. Mesuré au 8 septembre 2026 : 601 ko pour une carte et un biome,
  // 1,7 Mo pour dix biomes sur deux cartes, 2,9 Mo pour les neuf cartes du
  // canon — l'ordre de grandeur des toiles de `textures.ts`, qui s'autorise
  // 5,5 Mo. Ce chiffre est ce qu'on surveille : c'est de la mémoire vive.
  for (const biome of ['foret', 'montagne', 'desert', 'jungle', 'neige', 'volcanique', 'cotier', 'archipel', 'marais'] as const) {
    decorDe(carteDemo, scenarioDemo, biome).dispose();
    decorDe(carteBrasDeMer, scenarioBrasDeMer, biome).dispose();
  }
  const poids = poidsFormesDecor();
  assert.ok(poids.octets < 4 * 1024 * 1024, `${(poids.octets / 1024).toFixed(0)} ko gardés : c’est trop`);
  // Et d'autres montages encore ne le font pas franchir sa borne.
  for (const biome of ['foret', 'montagne', 'desert'] as const) {
    decorDe(carteDemo, scenarioDemo, biome).dispose();
  }
  assert.ok(poidsFormesDecor().octets < 4 * 1024 * 1024, 'le cache reste borné après d’autres montages');
});

test('QG livré : remplace la silhouette, suit le relief et garde la transparence sous brouillard', () => {
  const e=partie('plaine'); e.camps[0]!.qgCase='0,0';
  const source=new THREE.Group();source.name='batiment_qg_fr_ile_de_france';
  const racine=new THREE.Group(), sous=new THREE.Group();
  const mat=new THREE.MeshStandardNodeMaterial(), mesh=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.7),mat);
  mesh.userData['opaque']=mat;sous.add(mesh);racine.add(sous);source.add(racine);
  const chantier=ouvrirChantierDecor({largeur:1,hauteur:1,terrainDe:()=> 'qg'},e,()=>.27,'plaine',new Map([[source.name,source]]),{0:'fr'});
  for(const t of chantier.tranches)t();const decor=chantier.decor();
  const bat=decor.groupe.getObjectByName('batiments')!.children[0]!;
  assert.equal(bat.position.y,.27);assert.equal(bat.children.length,1);assert.equal(bat.children[0]!.name,source.name);
  const unite={...e.unites[0]!,x:0,y:0};const occupe={...e,unites:[unite]};
  decor.majProprietaires(occupe,new Set(['0,0']));
  let rendu:THREE.Mesh|undefined;decor.groupe.getObjectByName(source.name)!.traverse(o=>{if(o instanceof THREE.Mesh)rendu=o;});
  assert.equal((rendu!.material as THREE.MeshStandardNodeMaterial).transparent,true);
  decor.majProprietaires(occupe,new Set());
  assert.equal((rendu!.material as THREE.MeshStandardNodeMaterial).transparent,false);
  decor.dispose();
});
