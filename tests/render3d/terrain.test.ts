// Le plateau du rendu 3D : ce que l'eau couvre, ce qui se repose avec le sol,
// et ce que l'ambiance coûte par image. Tout se vérifie sous Node, sans WebGL :
// three.js construit ses géométries et ses matériaux en mémoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import type { CleTerrain } from '../../src/schemas/types';
import { CASE, NIVEAU_EAU, type GrilleTerrain } from '../../src/render3d/geometrie';
import {
  creerPlateau, creerUniformesBrouillard, DEBORD_EAU, donneesVisibles, FACTEUR_BROUILLARD,
  grefferBrouillard, TEINTE_BROUILLARD,
} from '../../src/render3d/terrain';
import { melangerParametres, parametresAmbiance } from '../../src/render3d/eclairage';
import { HAUTEUR_BANC, LARGEUR_BANC, visiblesBanc } from '../../src/app/atelier/banc';
import { construireNuanceur, ligneDe } from './nuanceur';
import { bornesDessinees, sommetsDessines } from './tampons';

/** Toile mémoire : les recettes de textures se peignent sans navigateur. */
function documentMemoire(): Document {
  return {
    createElement: () => {
      const canvas = {
        width: 0, height: 0, pixels: new Uint8ClampedArray() as Uint8ClampedArray,
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (image: { data: Uint8ClampedArray }) => { canvas.pixels = image.data; },
        }),
      };
      return canvas;
    },
  } as unknown as Document;
}

function grille(largeur: number, hauteur: number, terrain: CleTerrain | ((x: number, y: number) => CleTerrain)): GrilleTerrain {
  return {
    largeur, hauteur,
    terrainDe: typeof terrain === 'function' ? terrain : (): CleTerrain => terrain,
  };
}

/** L'étendue au sol d'une maille plane, lue dans sa géométrie. */
function etendue(maille: THREE.Mesh): { largeur: number; hauteur: number } {
  maille.geometry.computeBoundingBox();
  const b = maille.geometry.boundingBox!;
  // Le plan est construit dans XY puis couché par une rotation : sa hauteur
  // de géométrie est la profondeur au sol.
  return { largeur: b.max.x - b.min.x, hauteur: b.max.y - b.min.y };
}

test('le plan d’eau ne déborde de la carte que d’une case, centré sur elle, au niveau de l’eau', () => {
  const plateau = creerPlateau(grille(12, 10, 'plaine'), documentMemoire());
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  assert.ok(eau, 'le plan d’eau est nommé pour être retrouvé');
  assert.equal(DEBORD_EAU, CASE, 'une case de débord : de quoi lire une berge, pas une mer');
  const { largeur, hauteur } = etendue(eau);
  assert.equal(largeur, 12 * CASE + 2 * DEBORD_EAU);
  assert.equal(hauteur, 10 * CASE + 2 * DEBORD_EAU);
  assert.deepEqual([eau.position.x, eau.position.y, eau.position.z], [6 * CASE, NIVEAU_EAU, 5 * CASE]);
  assert.ok(eau.receiveShadow, 'un pont porte toujours son ombre sur l’eau qu’il franchit');
  // Le socle descend sous le niveau de l'eau : le bord ne montre pas une
  // tranche ouverte au-dessus du vide, quelle que soit la marge.
  const socle = plateau.groupe.getObjectByName('socle') as THREE.Mesh;
  assert.ok(bornesDessinees(socle.geometry).min.y < NIVEAU_EAU, 'le socle plonge sous l’eau');
  plateau.dispose();
});

test('un changement de taille de carte redimensionne l’eau, le socle et la grille', () => {
  const plateau = creerPlateau(grille(16, 12, 'plaine'), documentMemoire());
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  const socle = plateau.groupe.getObjectByName('socle') as THREE.Mesh;
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  // Le socle et la grille sont tenus par des tampons : leurs attributs sont
  // préalloués et seule la plage dessinée dit ce qui existe (`tampons.ts`).
  const sommetsGrille = sommetsDessines(lignes.geometry);

  plateau.majTerrain(grille(20, 12, 'mer'));
  assert.equal(etendue(eau).largeur, 20 * CASE + 2 * DEBORD_EAU, 'l’eau suit la carte, elle ne la déborde plus de trente unités');
  assert.equal(eau.position.x, 10 * CASE, 'et reste centrée');
  assert.equal(bornesDessinees(socle.geometry).max.x, 20 * CASE, 'le socle ferme la nouvelle carte');
  assert.ok(sommetsDessines(lignes.geometry) > sommetsGrille, 'la grille couvre la nouvelle carte');
  plateau.dispose();
});

test('après une marée, la grille et la profondeur lue par l’eau se reposent sur le sol', () => {
  const plateau = creerPlateau(grille(4, 4, 'plaine'), documentMemoire());
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  const yGrille = (): number => bornesDessinees(lignes.geometry).max.y;
  // La texture des fonds telle que le nuanceur de l'eau la lit : la carte garde
  // sa taille, c'est donc la même texture d'un bout à l'autre de la marée.
  const fonds = (): Uint8Array => (plateau.uniformesEau.tFonds.value as THREE.DataTexture).image.data as Uint8Array;
  const avant = yGrille();
  const fondsAvant = fonds()[0]!;

  // Une marée : la mer monte en 1,4 s. À mi-course, rien ne se repose encore.
  plateau.majTerrain(grille(4, 4, 'mer'), 1400);
  assert.equal(plateau.avancer(700), true, 'la mutation réclame des images');
  assert.equal(yGrille(), avant, 'la grille attend la fin du mouvement');
  assert.equal(fonds()[0], fondsAvant, 'l’écume aussi');
  assert.equal(plateau.avancer(800), false, 'la marée est finie');
  assert.ok(yGrille() < avant - 0.3, 'la grille est descendue avec le sol');
  assert.ok(fonds()[0]! < fondsAvant, 'le fond lu par l’eau est plus profond');
  plateau.dispose();
});

test('appliquerAmbiance ne refait rien pour la même ambiance, et tout pour une autre', () => {
  const plateau = creerPlateau(grille(2, 2, 'plaine'), documentMemoire());
  const matSol = plateau.sol.material as THREE.MeshStandardNodeMaterial;
  const jour = parametresAmbiance('ete', 'jour', 'clair');
  const nuit = parametresAmbiance('hiver', 'nuit', 'neige');

  plateau.appliquerAmbiance(jour);
  const teinte = matSol.color.getHex();
  // On dérègle la matière à la main : une réapplication de la même ambiance ne
  // doit pas y toucher, c'est ce qui rend l'appel par image gratuit.
  matSol.color.setHex(0x123456);
  plateau.appliquerAmbiance(jour);
  assert.equal(matSol.color.getHex(), 0x123456, 'la même identité ne se réapplique pas');

  plateau.appliquerAmbiance(nuit);
  assert.notEqual(matSol.color.getHex(), 0x123456, 'une autre ambiance s’applique');
  assert.notEqual(matSol.color.getHex(), teinte);

  // Pendant une transition, `eclairage` produit un objet neuf par image : il
  // est appliqué, même s'il vaut la même chose que le précédent.
  const mele = melangerParametres(jour, nuit, 0.5);
  plateau.appliquerAmbiance(mele);
  const milieu = matSol.color.getHex();
  matSol.color.setHex(0x123456);
  plateau.appliquerAmbiance(melangerParametres(jour, nuit, 0.5));
  assert.equal(matSol.color.getHex(), milieu, 'un objet neuf est appliqué');
  plateau.dispose();
});

test('l’écume revient à son repos à la fin d’une marée', () => {
  const plateau = creerPlateau(grille(3, 3, 'plage'), documentMemoire());
  const ecume = (): number => plateau.uniformesEau.uEcume.value;
  plateau.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'));
  const repos = ecume();
  plateau.majTerrain(grille(3, 3, 'mer'), 1000);
  plateau.avancer(500);
  assert.ok(ecume() > repos, 'l’écume enfle au passage du front');
  plateau.avancer(600);
  assert.equal(ecume(), repos, 'puis retombe exactement à son repos');
  plateau.dispose();
});

// ---------------------------------------------------------------------------
// Le brouillard de guerre : un masque d'un octet par case, lu par tout le plateau
// ---------------------------------------------------------------------------

/** La texture de visibilité telle que tout le plateau la lit, à l'instant où on la demande. */
function masqueDe(plateau: ReturnType<typeof creerPlateau>): THREE.DataTexture {
  return plateau.uniformesBrouillard.tVisibles.value as THREE.DataTexture;
}

test('donneesVisibles : 0 sur une case cachée, 255 sur une case vue, tout à 255 sans brouillard', () => {
  const g = grille(3, 2, 'plaine');
  assert.deepEqual([...donneesVisibles(g, null)], [255, 255, 255, 255, 255, 255]);
  assert.deepEqual([...donneesVisibles(g, new Set(['0,0', '2,1']))], [255, 0, 0, 0, 0, 255], 'un texel par case, dans l’ordre de la splat');
  assert.deepEqual([...donneesVisibles(g, new Set())], [0, 0, 0, 0, 0, 0], 'un ensemble vide cache tout');
});

test('le masque de visibilité du plateau vaut 0 hors de vue et 255 en vue, et n’est réécrit que si l’ensemble change', () => {
  const plateau = creerPlateau(grille(LARGEUR_BANC, HAUTEUR_BANC, 'plaine'), documentMemoire());
  const tex = masqueDe(plateau);
  assert.equal(tex.image.width, LARGEUR_BANC);
  assert.equal(tex.image.height, HAUTEUR_BANC);
  assert.equal(tex.format, THREE.RedFormat, 'un octet par case, pas quatre');
  assert.equal(tex.minFilter, THREE.LinearFilter, 'lu en linéaire : la frontière se fond sur un demi-texel');
  const octets = (): Uint8Array => tex.image.data as Uint8Array;
  assert.ok(octets().every((v) => v === 255), 'un plateau naît tout vu');

  // Le brouillard du banc : la moitié gauche est vue, la droite ne l'est pas.
  const version = tex.version;
  plateau.majVisibles(visiblesBanc());
  assert.ok(tex.version > version, 'la texture repart au processeur graphique');
  for (let y = 0; y < HAUTEUR_BANC; y += 1) {
    for (let x = 0; x < LARGEUR_BANC; x += 1) {
      assert.equal(octets()[y * LARGEUR_BANC + x], x < LARGEUR_BANC / 2 ? 255 : 0, `case ${x},${y}`);
    }
  }
  // Le survol repasse avec un ensemble neuf mais égal : rien n'est réécrit.
  const v2 = tex.version;
  plateau.majVisibles(visiblesBanc());
  assert.equal(tex.version, v2, 'le même ensemble ne réécrit pas la texture');
  // Une case de plus : réécrit.
  const plusUne = visiblesBanc();
  plusUne.add(`${LARGEUR_BANC - 1},0`);
  plateau.majVisibles(plusUne);
  assert.ok(tex.version > v2);
  assert.equal(octets()[LARGEUR_BANC - 1], 255);
  // Sans brouillard, tout revient à 255, une fois.
  const v3 = tex.version;
  plateau.majVisibles(null);
  assert.ok(tex.version > v3);
  assert.ok(octets().every((v) => v === 255), 'null remet tout à 255');
  plateau.majVisibles(null);
  assert.equal(tex.version, v3 + 1, 'null deux fois : une seule écriture');
  plateau.dispose();
});

test('le masque suit un changement de taille de carte, avec le dernier ensemble connu', () => {
  const plateau = creerPlateau(grille(4, 4, 'plaine'), documentMemoire());
  plateau.majVisibles(new Set(['0,0']));
  // Une texture WebGPU ne change pas de taille : à une autre carte, une autre
  // texture, et l'ancienne est libérée. Le nœud qui la lit reste le même.
  const ancienne = masqueDe(plateau);
  let liberee = false;
  ancienne.addEventListener('dispose', () => { liberee = true; });
  const noeud = plateau.uniformesBrouillard.tVisibles;
  plateau.majTerrain(grille(6, 3, 'mer'));
  const tex = masqueDe(plateau);
  assert.notEqual(tex, ancienne, 'une texture neuve à la taille de la carte');
  assert.ok(liberee, 'l’ancienne est libérée');
  assert.equal(plateau.uniformesBrouillard.tVisibles, noeud, 'le nœud du masque ne change pas, seule sa valeur');
  assert.equal(tex.image.width, 6);
  assert.equal(tex.image.height, 3);
  const octets = tex.image.data as Uint8Array;
  assert.equal(octets.length, 18);
  assert.equal(octets[0], 255, 'la case vue le reste');
  assert.equal(octets.filter((v) => v === 255).length, 1, 'le reste est dans le noir');
  const carte = plateau.uniformesBrouillard.uCarteBrouillard.value;
  assert.deepEqual([carte.x, carte.y], [6 * CASE, 3 * CASE], 'les coordonnées monde se rapportent à la nouvelle carte');
  // La splat et les fonds sont remplacés de la même façon.
  const matSol = plateau.sol.material as THREE.MeshStandardNodeMaterial;
  assert.ok(matSol.colorNode, 'le sol garde son mélange');
  const fonds = plateau.uniformesEau.tFonds.value as THREE.DataTexture;
  assert.equal(fonds.image.width, 6);
  assert.equal(fonds.image.height, 3);
  plateau.dispose();
});

test('le sol, le socle, les voies, les ponts et l’eau portent la même greffe de brouillard, lue après l’éclairage', () => {
  const g = grille(3, 2, (x) => (x === 1 ? 'route' : x === 2 ? 'pont' : 'plaine'));
  const plateau = creerPlateau(g, documentMemoire());
  const { sortie, tVisibles, uFacteurBrouillard, uTeinteBrouillard } = plateau.uniformesBrouillard;
  assert.equal(tVisibles.value, masqueDe(plateau));
  assert.equal(uFacteurBrouillard.value, FACTEUR_BROUILLARD);
  assert.equal(uTeinteBrouillard.value.getHex(), TEINTE_BROUILLARD);
  for (const nom of ['sol', 'socle', 'voies', 'ponts', 'eau']) {
    const maille = plateau.groupe.getObjectByName(nom) as THREE.Mesh;
    assert.ok(maille, nom);
    const mat = maille.material as THREE.MeshStandardNodeMaterial;
    assert.ok(mat.isNodeMaterial, `${nom} : un matériau du moteur à nœuds, le seul qui sache lire une greffe`);
    // Un seul nœud de sortie pour les cinq : la clé de programme d'un matériau à
    // nœuds compose avec l'identité de ses nœuds, et cinq greffes bâties à part
    // seraient cinq programmes d'extinction à compiler pour la même formule.
    assert.equal(mat.outputNode, sortie, `${nom} : la greffe partagée`);
  }
  // Ce que chacun faisait déjà survit à la greffe : d'autres nœuds.
  const matSol = plateau.sol.material as THREE.MeshStandardNodeMaterial;
  assert.ok(matSol.colorNode && matSol.roughnessNode && matSol.normalNode, 'le sol mélange ses matières en couleur, rugosité et normales');
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  const matEau = eau.material as THREE.MeshStandardNodeMaterial;
  assert.ok(matEau.colorNode, 'l’eau garde ses rives');
  assert.ok(matEau.transparent && matEau.opacity < 1 && !matEau.depthWrite);

  // Le WGSL du sol, tel que le navigateur le recevrait, avec des lumières et
  // une brume de scène : le masque vient **après** la couleur éclairée (sinon
  // le reflet du ciel rallumerait la case) et après la brume.
  const { vertex, fragment } = construireNuanceur(plateau.sol);
  const lecture = ligneDe(fragment, /textureSample\( tVisibles, tVisibles_sampler, /);
  assert.ok(lecture >= 0, 'le fragment lit le masque');
  assert.match(fragment.split('\n')[lecture]!, /v_positionWorld\.xz/, 'à la position monde du fragment');
  const eclaire = ligneDe(fragment, /^\s*Output = /);
  const lumiere = ligneDe(fragment, /^\s*outgoingLight = \( totalDiffuse \+ totalSpecular \)/);
  assert.ok(lumiere >= 0 && lumiere < eclaire && eclaire < lecture, 'lumière, couleur finie, puis lecture du masque');
  const resultat = ligneDe(fragment, /^\s*output\.color = /);
  assert.ok(resultat > lecture, 'la sortie vient en dernier');
  const ligneSortie = fragment.split('\n')[resultat]!;
  assert.match(ligneSortie, /mix\( \( \( Output\.xyz \* vec3<f32>\( object\.uFacteurBrouillard \) \) \+ object\.uTeinteBrouillard \), Output\.xyz, smoothstep\( 0\.3, 0\.7, /,
    'multiplie, pose le plancher, puis fond sur un demi-texel');
  // La position monde est une sortie du sommet : le fragment ne la recalcule pas.
  assert.match(vertex, /varyings\.v_positionWorld = \( object\.\w+ \* vec4<f32>\( varyings\.positionLocal, 1\.0 \) \)\.xyz;/);
  // Le mélange du sol est bien dans le nuanceur : ses textures et ses réglages, par leur nom.
  for (const nom of ['tSplat', 'tHerbe', 'tTerre', 'tRoche', 'tSable', 'tNeige', 'nHerbe', 'nTerre', 'nRoche', 'nSable']) {
    assert.match(fragment, new RegExp(`textureSample\\( ${nom}, ${nom}_sampler, `), `le sol lit ${nom}`);
  }
  for (const nom of ['uTiling', 'uNeige', 'uMouille']) assert.match(fragment, new RegExp(`object\\.${nom}\\b`), `le sol lit ${nom}`);
  assert.equal((fragment.match(/textureSample\( tSplat,/g) ?? []).length, 1, 'la splat est lue une fois, partagée par les trois nœuds');
  assert.ok(fragment.includes('isFront'), 'les normales passent par le repère tangent dérivé de l’écran');
  // L'eau : ses fonds, son temps, son écume et sa rive, et le même masque.
  const nuanceurEau = construireNuanceur(eau);
  // La coordonnée de carte est lue deux fois — les fonds et le bord de carte — :
  // le constructeur la met en variable, et c'est elle que `clamp` borne.
  const coordonnee = nuanceurEau.fragment.match(/(\w+) = \( v_positionWorld\.xz \/ object\.uCarte \);/);
  assert.ok(coordonnee, 'la position monde, rapportée à la carte');
  assert.match(nuanceurEau.fragment, new RegExp(`textureSample\\( tFonds, tFonds_sampler, clamp\\( ${coordonnee![1]}, `), 'les fonds se lisent à cette coordonnée');
  for (const nom of ['uTemps', 'uEcume', 'uRive']) assert.match(nuanceurEau.fragment, new RegExp(`object\\.${nom}\\b`), `l’eau lit ${nom}`);
  assert.match(nuanceurEau.fragment, /textureSample\( tVisibles, tVisibles_sampler, /);

  // La grille au sol n'a pas de greffe : c'est déjà un trait sombre et presque
  // transparent, qui ne peut pas dessiner la carte en clair dans le noir.
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  const matGrille = lignes.material as THREE.LineBasicNodeMaterial;
  assert.ok(matGrille.isNodeMaterial && matGrille.outputNode === null);
  assert.ok(matGrille.color.r < 0.02 && matGrille.color.g < 0.02 && matGrille.color.b < 0.03, 'la grille est un bleu de nuit');
  assert.ok(matGrille.opacity < 0.25);
  // Décision du propriétaire du 7 septembre 2026 : « noir noir, 100 % ».
  assert.equal(FACTEUR_BROUILLARD, 0, 'noir complet, rien du terrain ne se lit');
  assert.equal(TEINTE_BROUILLARD, 0x000000);
  plateau.dispose();
});

test('le temps de l’eau avance avec le plateau, et son nuanceur le lit', () => {
  const plateau = creerPlateau(grille(2, 2, 'mer'), documentMemoire());
  const { uTemps } = plateau.uniformesEau;
  assert.equal(uTemps.value, 0);
  plateau.avancer(250);
  assert.equal(uTemps.value, 0.25, 'en secondes');
  plateau.avancer(250);
  assert.equal(uTemps.value, 0.5);
  plateau.dispose();
});

test('une greffe ne se pose qu’une fois, jamais par-dessus un autre nœud de sortie', () => {
  const masque = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
  const uniformes = creerUniformesBrouillard(masque, 1, 1);
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0x336699 });
  grefferBrouillard(mat, uniformes, 'atlas-test');
  assert.equal(mat.outputNode, uniformes.sortie);
  grefferBrouillard(mat, uniformes, 'atlas-test');
  assert.equal(mat.outputNode, uniformes.sortie, 'deux greffes : un nœud');
  // Un clone garde ses nœuds : il naît greffé, et une nouvelle greffe le voit.
  const clone = mat.clone();
  assert.equal(clone.outputNode, uniformes.sortie);
  grefferBrouillard(clone, uniformes, 'atlas-test');
  assert.equal(clone.outputNode, uniformes.sortie);
  // Un matériau qui porte déjà un autre nœud de sortie n'est pas écrasé en silence.
  const autre = new THREE.MeshStandardNodeMaterial();
  autre.outputNode = creerUniformesBrouillard(masque, 2, 2).sortie;
  assert.throws(() => grefferBrouillard(autre, uniformes, 'atlas-test'), /outputNode/);
  masque.dispose();
});

test('matières livrées : PNG PBR dans le relief existant, pont raccordé conservé', () => {
  const jeu = () => ({albedo:new THREE.Texture({width:8,height:8} as TexImageSource),normale:new THREE.Texture({width:8,height:8} as TexImageSource),rugosite:new THREE.Texture({width:8,height:8} as TexImageSource)});
  const herbe=jeu(), foret=jeu(), pont=jeu(), route=jeu(), eau=jeu();
  const sols=new Map([['terrain_plaine',herbe],['terrain_foret',foret],['terrain_pont',pont],['terrain_route',route],['terrain_riviere',eau]]);
  const g:GrilleTerrain={largeur:3,hauteur:1,terrainDe:x=>x===1?'pont':'plaine'};
  const plateau=creerPlateau(g,documentMemoire(),'plaine',sols);
  const sol=plateau.groupe.getObjectByName('sol') as THREE.Mesh;
  assert.equal((sol.material as THREE.MeshStandardNodeMaterial).map!.image,herbe.albedo.image);
  const p=plateau.groupe.getObjectByName('ponts') as THREE.Mesh;
  assert.equal((p.material as THREE.MeshStandardNodeMaterial).normalMap,pont.normale);
  assert.equal((p.material as THREE.MeshStandardNodeMaterial).roughnessMap,pont.rugosite);
  assert(p.geometry.getAttribute('position').count>0);
  const v=plateau.groupe.getObjectByName('voies') as THREE.Mesh;
  assert.equal((v.material as THREE.MeshStandardNodeMaterial).normalMap,route.normale);
  plateau.dispose();
});
