// Le plateau du rendu 3D : ce que l'eau couvre, ce qui se repose avec le sol,
// et ce que l'ambiance coûte par image. Tout se vérifie sous Node, sans WebGL :
// three.js construit ses géométries et ses matériaux en mémoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import type { CleTerrain } from '../../src/schemas/types';
import { CASE, NIVEAU_EAU, type GrilleTerrain } from '../../src/render3d/geometrie';
import {
  creerPlateau, DEBORD_EAU, donneesVisibles, FACTEUR_BROUILLARD, TEINTE_BROUILLARD,
} from '../../src/render3d/terrain';
import { melangerParametres, parametresAmbiance } from '../../src/render3d/eclairage';
import { HAUTEUR_BANC, LARGEUR_BANC, visiblesBanc } from '../../src/app/atelier/banc';

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
  socle.geometry.computeBoundingBox();
  assert.ok(socle.geometry.boundingBox!.min.y < NIVEAU_EAU, 'le socle plonge sous l’eau');
  plateau.dispose();
});

test('un changement de taille de carte redimensionne l’eau, le socle et la grille', () => {
  const plateau = creerPlateau(grille(16, 12, 'plaine'), documentMemoire());
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  const socle = plateau.groupe.getObjectByName('socle') as THREE.Mesh;
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  const sommetsGrille = lignes.geometry.getAttribute('position').count;

  plateau.majTerrain(grille(20, 12, 'mer'));
  assert.equal(etendue(eau).largeur, 20 * CASE + 2 * DEBORD_EAU, 'l’eau suit la carte, elle ne la déborde plus de trente unités');
  assert.equal(eau.position.x, 10 * CASE, 'et reste centrée');
  socle.geometry.computeBoundingBox();
  assert.equal(socle.geometry.boundingBox!.max.x, 20 * CASE, 'le socle ferme la nouvelle carte');
  assert.ok(lignes.geometry.getAttribute('position').count > sommetsGrille, 'la grille couvre la nouvelle carte');
  plateau.dispose();
});

test('après une marée, la grille et la profondeur lue par l’eau se reposent sur le sol', () => {
  const plateau = creerPlateau(grille(4, 4, 'plaine'), documentMemoire());
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  const yGrille = (): number => {
    lignes.geometry.computeBoundingBox();
    return lignes.geometry.boundingBox!.max.y;
  };
  const fonds = (): Uint8Array => {
    const mat = eau.material as THREE.MeshStandardMaterial;
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: '' };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    return (shader.uniforms['tFonds']!.value as THREE.DataTexture).image.data as Uint8Array;
  };
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
  const matSol = plateau.sol.material as THREE.MeshStandardMaterial;
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
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  const ecume = (): number => {
    const mat = eau.material as THREE.MeshStandardMaterial;
    const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '' };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    return shader.uniforms['uEcume']!.value;
  };
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

/** Ce qu'un matériau du plateau fait du nuanceur au moment de compiler : un squelette des chunks qu'il remplace. */
function compiler(mat: THREE.Material): { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string } {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <project_vertex>',
    fragmentShader: [
      '#include <map_fragment>', '#include <color_fragment>', '#include <roughnessmap_fragment>',
      '#include <normal_fragment_maps>', '#include <opaque_fragment>', '#include <fog_fragment>',
    ].join('\n'),
  };
  (mat as THREE.MeshStandardMaterial).onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return shader;
}

/** La texture de visibilité telle que le sol la lit. */
function masqueDe(plateau: ReturnType<typeof creerPlateau>): THREE.DataTexture {
  return compiler(plateau.sol.material as THREE.Material).uniforms['tVisibles']!.value as THREE.DataTexture;
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
  plateau.majTerrain(grille(6, 3, 'mer'));
  const shader = compiler(plateau.sol.material as THREE.Material);
  const tex = shader.uniforms['tVisibles']!.value as THREE.DataTexture;
  assert.equal(tex.image.width, 6);
  assert.equal(tex.image.height, 3);
  const octets = tex.image.data as Uint8Array;
  assert.equal(octets.length, 18);
  assert.equal(octets[0], 255, 'la case vue le reste');
  assert.equal(octets.filter((v) => v === 255).length, 1, 'le reste est dans le noir');
  const carte = shader.uniforms['uCarteBrouillard']!.value as THREE.Vector2;
  assert.deepEqual([carte.x, carte.y], [6 * CASE, 3 * CASE], 'les coordonnées monde se rapportent à la nouvelle carte');
  plateau.dispose();
});

test('le sol, le socle, les voies, les ponts et l’eau lisent le masque après l’éclairage, chacun avec sa clé de programme', () => {
  const g = grille(3, 2, (x) => (x === 1 ? 'route' : x === 2 ? 'pont' : 'plaine'));
  const plateau = creerPlateau(g, documentMemoire());
  const tex = masqueDe(plateau);
  const cles = new Set<string>();
  for (const nom of ['sol', 'socle', 'voies', 'ponts', 'eau']) {
    const maille = plateau.groupe.getObjectByName(nom) as THREE.Mesh;
    assert.ok(maille, nom);
    const mat = maille.material as THREE.MeshStandardMaterial;
    const shader = compiler(mat);
    assert.equal(shader.uniforms['tVisibles']!.value, tex, `${nom} lit la même texture que le sol`);
    assert.equal(shader.uniforms['uFacteurBrouillard']!.value, FACTEUR_BROUILLARD);
    assert.equal((shader.uniforms['uTeinteBrouillard']!.value as THREE.Color).getHex(), TEINTE_BROUILLARD);
    const fs = shader.fragmentShader;
    const lecture = fs.indexOf('texture2D( tVisibles');
    assert.ok(lecture > 0, `${nom} : le nuanceur lit le masque`);
    // Après l'éclairage — sinon le reflet du ciel rallumerait la case — et
    // avant le brouillard de scène, qui est une autre chose.
    assert.ok(fs.indexOf('#include <opaque_fragment>') < lecture, `${nom} : après l’éclairage`);
    assert.ok(lecture < fs.indexOf('#include <fog_fragment>'), `${nom} : avant le brouillard de scène`);
    assert.match(fs, /gl_FragColor\.rgb \* uFacteurBrouillard \+ uTeinteBrouillard/, `${nom} : multiplie, puis pose le plancher`);
    assert.match(shader.vertexShader, /vAtlasMonde = \( modelMatrix/, `${nom} : la case se lit sur la position monde`);
    cles.add(mat.customProgramCacheKey());
  }
  assert.equal(cles.size, 5, 'cinq matériaux greffés, cinq programmes : aucun ne peut voler celui d’un autre');
  // Ce que chacun faisait déjà survit à la greffe.
  assert.match(compiler(plateau.sol.material as THREE.Material).fragmentShader, /tSplat/, 'le sol mélange toujours ses matières');
  const eau = plateau.groupe.getObjectByName('eau') as THREE.Mesh;
  assert.match(compiler(eau.material as THREE.Material).fragmentShader, /tFonds/, 'l’eau garde ses rives');
  // La grille au sol n'a pas de greffe : c'est déjà un trait sombre et presque
  // transparent, qui ne peut pas dessiner la carte en clair dans le noir.
  const lignes = plateau.groupe.getObjectByName('grille') as THREE.LineSegments;
  const matGrille = lignes.material as THREE.LineBasicMaterial;
  assert.ok(matGrille.color.r < 0.02 && matGrille.color.g < 0.02 && matGrille.color.b < 0.03, 'la grille est un bleu de nuit');
  assert.ok(matGrille.opacity < 0.25);
  // Décision du propriétaire du 7 septembre 2026 : « noir noir, 100 % ».
  assert.equal(FACTEUR_BROUILLARD, 0, 'noir complet, rien du terrain ne se lit');
  assert.equal(TEINTE_BROUILLARD, 0x000000);
  plateau.dispose();
});
