// Le paysage : le semis est pur, déterministe, et respecte les deux règles qui
// comptent — le centre d'une case reste libre, une case bâtie ou une route ne
// reçoit rien. La carte-témoin est celle du banc d'essai, qui pose les douze
// terrains côte à côte : c'est elle qui garantit que chaque biome trouve de
// quoi semer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { carteBanc } from '../../src/app/atelier/banc';
import { parametresAmbiance } from '../../src/render3d/eclairage';
import { alea, NIVEAU_EAU, type GrilleTerrain } from '../../src/render3d/geometrie';
import { LotInstancie } from '../../src/render3d/lots';
import {
  creerPaysage, ESPECES, GENRES_PAYSAGE, genreRivage, memesVisibles, PAYSAGES, segmentsRivage, semerPaysage,
  type Accessoire,
} from '../../src/render3d/paysage';
import { creerUniformesBrouillard, grefferBrouillardSur, type UniformesBrouillard } from '../../src/render3d/terrain';
import { BIOMES, CARACTERE_PAR_TERRAIN, type CleTerrain } from '../../src/schemas/types';
import { construireNuanceur, ligneDe } from './nuanceur';

const TERRAIN_PAR_CARACTERE: Readonly<Record<string, CleTerrain>> = Object.fromEntries(
  Object.entries(CARACTERE_PAR_TERRAIN).map(([cle, car]) => [car, cle as CleTerrain]),
);

/** La carte-témoin : la grille du banc d'essai, lue comme le rendu la lit. */
function grilleTemoin(): GrilleTerrain {
  const carte = carteBanc();
  return {
    largeur: carte.largeur,
    hauteur: carte.hauteur,
    terrainDe: (x, y) => TERRAIN_PAR_CARACTERE[carte.grille[y]?.[x] ?? 'P'] ?? 'plaine',
  };
}

/** Les uniformes du brouillard, tels que le plateau les partage. */
function uniformesTemoins(): UniformesBrouillard {
  return creerUniformesBrouillard(new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat), 12, 12);
}

const INTERDITS: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['ville', 'qg', 'usine', 'aeroport', 'route', 'pont']);

function ecartAuCentre(a: Accessoire): number {
  return Math.hypot(a.x - (a.case.x + 0.5), a.z - (a.case.y + 0.5));
}

test('le semis est déterministe : même grille, même biome, mêmes positions', () => {
  const g = grilleTemoin();
  for (const biome of BIOMES) {
    assert.deepEqual(semerPaysage(g, biome), semerPaysage(g, biome), biome);
  }
  // Et deux biomes ne se ressemblent pas : chacun a son vocabulaire.
  const bocage = new Set(semerPaysage(g, 'plaine').map((a) => a.genre));
  const jungle = new Set(semerPaysage(g, 'jungle').map((a) => a.genre));
  assert.equal([...bocage].filter((genre) => jungle.has(genre)).length, 0);
});

test('chaque biome sème au moins un accessoire sur la carte-témoin, et tout reste dans sa case', () => {
  const g = grilleTemoin();
  for (const biome of BIOMES) {
    const semis = semerPaysage(g, biome);
    assert.ok(semis.length > 0, `${biome} ne sème rien`);
    for (const a of semis) {
      const ecart = ecartAuCentre(a);
      // Le disque plat du centre (0,28 de repli) reste libre pour la figurine.
      assert.ok(ecart > 0.15, `${biome}/${a.genre} au centre de sa case (${ecart.toFixed(3)})`);
      assert.ok(ecart < 0.47, `${biome}/${a.genre} déborde de sa case (${ecart.toFixed(3)})`);
      assert.ok(a.x > a.case.x && a.x < a.case.x + 1 && a.z > a.case.y && a.z < a.case.y + 1);
      assert.ok(!INTERDITS.has(g.terrainDe(a.case.x, a.case.y)), `${biome}/${a.genre} sur ${g.terrainDe(a.case.x, a.case.y)}`);
      assert.ok(a.echelle > 0 && a.teinte >= 0 && a.teinte < 1);
    }
  }
});

test('aucune règle ne cible une case bâtie ni une route, et chaque genre listé a une règle', () => {
  for (const genre of GENRES_PAYSAGE) {
    const r = ESPECES[genre].regle;
    for (const t of r.sur) assert.ok(!INTERDITS.has(t), `${genre} se pose sur ${t}`);
    assert.ok(r.rayon[0] >= 0.18 && r.rayon[1] <= 0.44, `${genre} : rayon ${r.rayon.join('–')}`);
    if (r.jumeau) assert.ok(GENRES_PAYSAGE.includes(r.jumeau), `${genre} : jumeau inconnu`);
  }
  for (const biome of BIOMES) {
    assert.ok(PAYSAGES[biome].length >= 5, `${biome} : moins de cinq accessoires`);
    // Un jumeau se sème par son porteur, jamais seul.
    for (const genre of PAYSAGES[biome]) assert.ok(ESPECES[genre].regle.chance > 0, `${biome}/${genre} inerte`);
  }
});

test('une carte sans eau n’a pas de rivage ; la carte-témoin en a, terre contre eau seulement', () => {
  const plaine: GrilleTerrain = { largeur: 6, hauteur: 4, terrainDe: () => 'plaine' };
  assert.deepEqual(segmentsRivage(plaine), []);
  const g = grilleTemoin();
  const segments = segmentsRivage(g);
  assert.ok(segments.length > 0);
  for (const s of segments) {
    const terre = g.terrainDe(s.case.x, s.case.y);
    const eau = g.terrainDe(s.case.x + s.nx, s.case.y + s.nz);
    assert.ok(terre !== 'mer' && terre !== 'riviere');
    assert.ok(eau === 'mer' || eau === 'riviere');
    assert.equal(Math.abs(s.nx) + Math.abs(s.nz), 1, 'une normale par côté, jamais en diagonale');
  }
  // Le rivage ne suit pas le bord de carte : la grille y est prolongée, pas noyée.
  const ile: GrilleTerrain = { largeur: 3, hauteur: 3, terrainDe: (x, y) => (x === 1 && y === 1 ? 'plaine' : 'mer') };
  assert.equal(segmentsRivage(ile).length, 4);
  assert.deepEqual(segmentsRivage(g), segmentsRivage(g));
  for (const biome of BIOMES) assert.ok(['ecume', 'galets'].includes(genreRivage(biome)));
});

test('le montage instancie un lot par genre présent, une géométrie de rivage, et libère tout', () => {
  const g = grilleTemoin();
  const sol = (x: number, z: number): number => (alea(Math.round(x * 4), Math.round(z * 4)) - 0.5) * 0.3;
  const paysage = creerPaysage(g, sol, 'marais');
  const semis = semerPaysage(g, 'marais');
  const genres = new Set(semis.map((a) => a.genre));
  const lots = paysage.groupe.children.filter((o): o is LotInstancie => o instanceof LotInstancie);
  assert.equal(lots.length, genres.size, 'un lot par genre, ni plus ni moins');
  for (const lot of lots) {
    const genre = lot.name.replace('paysage-', '');
    assert.ok(genres.has(genre as typeof semis[number]['genre']), `lot inattendu ${lot.name}`);
    assert.equal(lot.compte, semis.filter((a) => a.genre === genre).length);
  }

  // Ce qui flotte ne descend jamais sous l'eau : un nénuphar sur un fond de mer
  // à −0,4 reste au plan d'eau.
  const nenuphars = paysage.groupe.getObjectByName('paysage-nenuphar') as LotInstancie;
  const mat = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (let i = 0; i < nenuphars.compte; i += 1) {
    nenuphars.getMatrixAt(i, mat);
    position.setFromMatrixPosition(mat);
    assert.ok(position.y >= NIVEAU_EAU - 1e-6, `nénuphar noyé à ${position.y}`);
  }

  const rivage = paysage.groupe.getObjectByName('rivage') as THREE.Mesh;
  assert.ok(rivage instanceof THREE.Mesh);
  const nombreSommets = rivage.geometry.getAttribute('position').count;
  assert.ok(nombreSommets > 0);
  assert.equal(rivage.geometry.getAttribute('color').itemSize, 4, 'l’écume se fond par l’alpha de sommet');

  // Le relief bouge : tout se repose, rivage compris, sans reconstruire.
  const avant = (rivage.geometry.getAttribute('position') as THREE.BufferAttribute).getY(0);
  const monte = creerPaysage(g, (x, z) => sol(x, z) + 0.2, 'marais');
  const rivageMonte = monte.groupe.getObjectByName('rivage') as THREE.Mesh;
  const apres = (rivageMonte.geometry.getAttribute('position') as THREE.BufferAttribute).getY(0);
  assert.ok(apres >= avant, 'la ligne suit le sol quand il monte');
  monte.dispose();

  // L'ambiance et le vent ne cassent rien, et la réduction des animations arrête tout.
  paysage.appliquerAmbiance(parametresAmbiance('hiver', 'nuit', 'tempete'), 'hiver');
  assert.equal(paysage.avancer(16, true), false, 'mouvement réduit : rien ne bouge');
  assert.equal(paysage.avancer(16, false), true, 'les roseaux se balancent dans la tempête');
  paysage.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'), 'ete');
  assert.equal(paysage.avancer(16, false), false, 'sans vent ni fumerolle, rien à redessiner');
  paysage.majRelief();

  // Les **formes** sont partagées avec les autres paysages de la page : un
  // démontage ne les libère pas, sans quoi chaque montage retaillerait
  // cinquante-quatre volumes et un paysage encore à l'écran se blanchirait.
  // Le rivage, lui, est taillé sur le trait de côte : il n'appartient qu'ici.
  let formesLiberees = 0;
  let rivageLibere = 0;
  for (const lot of lots) lot.geometry.addEventListener('dispose', () => { formesLiberees += 1; });
  rivage.geometry.addEventListener('dispose', () => { rivageLibere += 1; });
  paysage.dispose();
  assert.equal(formesLiberees, 0, 'les formes restent : le paysage n’en est pas propriétaire');
  assert.equal(rivageLibere, 1, 'le rivage est libéré avec son paysage');
});

test('les fumerolles fument même sans vent, et respectent la préférence de mouvement', () => {
  const g = grilleTemoin();
  const paysage = creerPaysage(g, () => 0, 'volcanique');
  const fumee = paysage.groupe.getObjectByName('paysage-fumee') as LotInstancie;
  assert.ok(fumee instanceof LotInstancie, 'la carte-témoin porte au moins une fumerolle');
  assert.equal(fumee.castShadow, false, 'la fumée ne porte pas d’ombre');
  paysage.appliquerAmbiance(parametresAmbiance('ete', 'jour', 'clair'), 'ete');
  assert.equal(paysage.avancer(16, true), false);
  assert.equal(paysage.avancer(16, false), true);
  paysage.dispose();
});

test('l’ambiance du paysage n’est repeinte que si ses paramètres ou la saison changent', () => {
  const paysage = creerPaysage(grilleTemoin(), () => 0, 'marais');
  const lots = paysage.groupe.children.filter((o): o is LotInstancie => o instanceof LotInstancie);
  const mats = lots.map((l) => l.material as THREE.MeshStandardNodeMaterial);
  const p = parametresAmbiance('ete', 'jour', 'clair');
  paysage.appliquerAmbiance(p, 'ete');
  for (const m of mats) m.color.setHex(0x000000);
  paysage.appliquerAmbiance(p, 'ete');
  assert.ok(mats.every((m) => m.color.getHex() === 0), 'même objet, même saison : rien repeint');
  paysage.appliquerAmbiance(p, 'hiver');
  assert.ok(mats.some((m) => m.color.getHex() !== 0), 'une autre saison repeint');
  for (const m of mats) m.color.setHex(0x000000);
  paysage.appliquerAmbiance({ ...p }, 'hiver');
  assert.ok(mats.some((m) => m.color.getHex() !== 0), 'un objet neuf — une transition — repeint');
  paysage.dispose();
});

// ---------------------------------------------------------------------------
// Le brouillard de guerre : les accessoires et le rivage d'une case hors de vue
// ---------------------------------------------------------------------------

test('memesVisibles compare des contenus, pas des objets', () => {
  assert.equal(memesVisibles(null, null), true);
  assert.equal(memesVisibles(new Set(['0,0']), new Set(['0,0'])), true, 'un ensemble neuf mais égal');
  assert.equal(memesVisibles(new Set(['0,0']), new Set(['0,1'])), false);
  assert.equal(memesVisibles(new Set(['0,0']), new Set(['0,0', '0,1'])), false);
  assert.equal(memesVisibles(null, new Set()), false, 'sans brouillard et tout caché ne sont pas la même chose');
  assert.equal(memesVisibles(new Set(), null), false);
});

test('les accessoires du paysage lisent le masque de brouillard, après l’éclairage', () => {
  // Le brouillard ne se peint plus dans les couleurs d'instance : un matériau
  // noirci garde le reflet du studio et l'éclat du soleil, et c'est ce gris
  // qu'on voyait dans le noir. Il se lit désormais dans le nuanceur, comme au
  // sol, et il doit tenir compte de l'instanciation — un lot d'accessoires est
  // un seul objet, ses instances sont ailleurs sur la carte.
  const paysage = creerPaysage(grilleTemoin(), () => 0, 'marais');
  const uniformes = uniformesTemoins();
  grefferBrouillardSur(paysage.groupe, uniformes, 'atlas-test');

  const lots = paysage.groupe.children.filter((o): o is LotInstancie => o instanceof LotInstancie);
  assert.ok(lots.length > 0, 'la carte-témoin a des accessoires');
  const rivage = paysage.groupe.getObjectByName('rivage') as THREE.Mesh;
  for (const lot of [...lots, rivage]) {
    const mat = lot.material as THREE.MeshStandardNodeMaterial;
    assert.ok(mat.isNodeMaterial, `${lot.name} : un matériau à nœuds`);
    assert.equal(mat.outputNode, uniformes.sortie, `${lot.name} lit le masque, le même que le sol`);
  }

  // Le WGSL d'un lot : couleurs de sommet et couleur d'instance teintent le
  // diffus, la position monde suit la matrice d'instance, le masque vient après
  // la couleur éclairée.
  const lot = lots.find((l) => l.name === 'paysage-roseau') ?? lots[0]!;
  const { vertex, fragment } = construireNuanceur(lot);
  // La matrice vient de quatre attributs par instance depuis `lots.ts`, et non
  // plus du tampon d'uniformes de three : c'est ce qui met tous les genres de
  // paysage dans un même programme. L'ordre, lui, est le même.
  const instance = ligneDe(vertex, /varyings\.positionLocal = \( nodeVar\d+ \* vec4<f32>\( varyings\.positionLocal, 1\.0 \) \)\.xyz;/);
  const monde = ligneDe(vertex, /varyings\.v_positionWorld = /);
  assert.ok(instance >= 0 && monde > instance, `${lot.name} : la matrice d’instance, puis la position monde`);
  assert.match(vertex, /nodeVar\d+ = mat4x4<f32>\( iCol0, iCol1, iCol2, iCol3 \)/, 'la matrice vient des colonnes');
  const teinte = /varyings\.(\w+) = iTeinte;/.exec(vertex)?.[1];
  assert.ok(teinte, 'la teinte d’instance passe au fragment');
  assert.ok(!fragment.includes('vInstanceColor'), 'et non par le varying de three, que rien n’écrirait');
  const diffus = fragment.split('\n').find((l) => l.includes('DiffuseColor = ')) ?? '';
  assert.ok(diffus.includes(teinte!), `couleur d’instance dans le diffus : ${diffus}`);
  // Et la couleur de **sommet** avec elle : les deux voyagent en varyings, la
  // teinte par instance et la nuance du maillage, et le diffus est leur produit.
  const sommet = /varyings\.(\w+) = color;/.exec(vertex)?.[1];
  assert.ok(sommet && sommet !== teinte, 'la couleur de sommet a son propre varying');
  assert.ok(diffus.includes(sommet!), `couleur de sommet dans le diffus : ${diffus}`);
  const lecture = ligneDe(fragment, /textureSample\( tVisibles, tVisibles_sampler, clamp\( \( v_positionWorld\.xz/);
  assert.ok(lecture > ligneDe(fragment, /^\s*Output = /), `${lot.name} : le masque après la couleur éclairée`);
  paysage.dispose();
});

test('le rivage se fond par l’alpha de ses couleurs de sommet, que le matériau à nœuds lit à quatre composantes', () => {
  // Le matériau à nœuds ne lit les couleurs de sommet qu'en `vec3` et jette
  // l'alpha ; une seconde lecture du même attribut en `vec4` se rabat sur la
  // première et rend un alpha de 1. Le rivage lit donc l'attribut une fois, à
  // quatre composantes, `vertexColors` éteint, et le donne à ses deux nœuds.
  const paysage = creerPaysage(grilleTemoin(), () => 0, 'cotier');
  const rivage = paysage.groupe.getObjectByName('rivage') as THREE.Mesh;
  const mat = rivage.material as THREE.MeshStandardNodeMaterial;
  assert.equal(mat.vertexColors, false);
  assert.ok(mat.colorNode && mat.opacityNode, 'couleur et opacité par nœud');
  assert.equal(rivage.geometry.getAttribute('color').itemSize, 4);
  const { fragment } = construireNuanceur(rivage);
  const alpha = fragment.match(/DiffuseColor\.w = \( DiffuseColor\.w \* \( object\.\w+ \* (nodeVarying\d+)\.w \) \);/);
  assert.ok(alpha, 'l’opacité se multiplie par l’alpha de sommet');
  assert.match(fragment, new RegExp(`${alpha![1]} : vec4<f32>`), 'l’attribut est lu à quatre composantes');
  assert.match(fragment, new RegExp(`\\* ${alpha![1]}\\.xyz \\)`), 'et sa couleur teinte le diffus');
  paysage.dispose();
});
