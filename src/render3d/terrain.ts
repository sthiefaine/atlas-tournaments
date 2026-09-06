/**
 * Le plateau : maillage de la grille, mélange de matières, eau, voies, grille.
 *
 * Le maillage vient directement de `geometrie.ts` : trois subdivisions par case,
 * altitude prise dans le champ continu `hauteurEn`, **sommets partagés** — deux
 * cases voisines ne peuvent pas se décoller — et jonctions adoucies par
 * l'interpolation bilinéaire entre centres de cases.
 *
 * Les matières sont mélangées par une **carte de mélange** (`splat map`)
 * construite depuis la `MapDef` : un texel par case, quatre canaux (herbe,
 * terre et route, roche, sable), lu en filtrage linéaire, donc des lisières
 * fondues sans un seul flou fait main. Le mélange lui-même est greffé dans un
 * `MeshStandardMaterial` par `onBeforeCompile` : on garde ainsi l'éclairage PBR
 * complet de three.js — ombres, lumière hémisphérique, brouillard — au lieu de
 * réécrire un `ShaderMaterial` qui les perdrait tous.
 *
 * L'eau est un plan séparé, sous le niveau des lits de rivière et des fonds
 * marins : partout où le terrain remonte au-dessus d'elle, le tampon de
 * profondeur la cache tout seul.
 *
 * Le maillage lit `hauteurSol`, la **surface** lit `hauteurEn` : les deux ne
 * diffèrent que sous les ponts, où le sol se creuse au niveau du lit pendant
 * que le tablier — et tout ce qui roule dessus — reste à hauteur de berge.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { Biome } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import {
  axePont, CASE, construireSplat, hauteurEn, hauteurSol, NIVEAU_EAU, pieceDeCase,
  terrainBorne, type GrilleTerrain,
} from './geometrie';
import { jeuMatiere, normalesEau } from './textures';
import { APPARENCES, textureVoies, uvAtlas } from './textures-voies';

/** Subdivisions par case : trois suffisent à arrondir un col de montagne. */
const SUBDIVISIONS = 3;

/** Répétitions de texture de détail, par case. */
const TUILAGE = 0.65;

/** Le plateau monté : son groupe, son sol cliquable et ses réglages d'ambiance. */
export interface Plateau {
  readonly groupe: THREE.Group;
  /** Le maillage du sol : c'est lui que le lancer de rayon interroge. */
  readonly sol: THREE.Mesh;
  /**
   * Les tabliers de pont, interrogés **avant** le sol : sous un pont le sol se
   * creuse jusqu'au lit, et un clic sur le tablier tombait dans l'eau d'à côté.
   */
  readonly ponts: THREE.Mesh;
  /** Altitude du sol en un point du monde. */
  hauteurEn(x: number, z: number): number;
  /** Applique une ambiance (teinte, neige, humidité, couleur de l'eau). */
  appliquerAmbiance(p: ParametresAmbiance): void;
  /** Fait avancer l'eau. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  /**
   * Relit la grille et remet le sol à jour : altitudes, mélange de matières,
   * voies et ponts.
   *
   * Sans cela, le plateau reste celui du **premier jour**. C'est ce qui rendait
   * les marées invisibles : `modifTerrain` fait lire une case `mer` comme
   * `plage`, la lecture logique change, l'image ne changeait pas. Un terrain
   * posé par le génie souffrait du même gel.
   *
   * `duree` fait de la mutation un **événement** : le mélange de matières et le
   * relief glissent de l'ancien état au nouveau, l'écume enfle puis retombe. Une
   * mer qui réapparaît d'une image à l'autre se lit comme un défaut d'affichage ;
   * une mer qui monte se lit comme une marée.
   */
  majTerrain(g: GrilleTerrain, duree?: number): void;
  dispose(): void;
}

/** Déclarations injectées en tête du nuanceur de fragments. */
const UNIFORMES_GLSL = `
uniform sampler2D tSplat;
uniform sampler2D tTerre;
uniform sampler2D tRoche;
uniform sampler2D tSable;
uniform sampler2D tNeige;
uniform sampler2D nTerre;
uniform sampler2D nRoche;
uniform sampler2D nSable;
uniform vec2 uTiling;
uniform float uNeige;
uniform float uMouille;
`;

/** Le mélange de matières : remplace `map_fragment`. */
const MELANGE_GLSL = `
vec4 splatBrut = texture2D( tSplat, vMapUv );
float sommeSplat = max( splatBrut.r + splatBrut.g + splatBrut.b + splatBrut.a, 0.001 );
vec4 splat = splatBrut / sommeSplat;
vec2 uvD = vMapUv * uTiling;
vec3 cHerbe = texture2D( map, uvD ).rgb;
vec3 cTerre = texture2D( tTerre, uvD ).rgb;
vec3 cRoche = texture2D( tRoche, uvD * 0.6 ).rgb;
vec3 cSable = texture2D( tSable, uvD ).rgb;
vec3 matiere = cHerbe * splat.r + cTerre * splat.g + cRoche * splat.b + cSable * splat.a;
// Les congères interrompues laissent apparaître pierre et terre sous la neige.
float reliefFin = texture2D( tRoche, uvD * 0.6 ).g;
float depot = smoothstep( 0.04, 0.55, uNeige - reliefFin * 0.32 );
float couverture = clamp( depot * ( 0.62 + 0.38 * ( splat.r + splat.b ) ), 0.0, 1.0 );
matiere = mix( matiere, texture2D( tNeige, uvD * 0.8 ).rgb, couverture );
// La teinte de saison colore surtout la végétation : appliquée telle quelle,
// elle rendrait la roche brune en automne et le sable bleu en hiver.
vec3 teinteSaison = mix( vec3( 1.0 ), diffuse, clamp( splat.r * 0.8 + 0.2, 0.0, 1.0 ) );
// La pluie assombrit surtout la terre et forme des zones humides irrégulières.
float humiditeLocale = uMouille * ( 0.50 + 0.50 * smoothstep( 0.12, 0.45, reliefFin ) );
diffuseColor.rgb = teinteSaison * matiere * ( 1.0 - humiditeLocale * 0.17 );
`;

/** La rugosité par matière : remplace `roughnessmap_fragment`. */
const RUGOSITE_GLSL = `
float roughnessFactor = 0.95 * splat.r + 0.92 * splat.g + 0.78 * splat.b + 0.97 * splat.a;
roughnessFactor = mix( roughnessFactor, 0.24, humiditeLocale );
roughnessFactor = mix( roughnessFactor, 0.68, couverture * 0.7 );
`;

/** Les normales mélangées : remplace `normal_fragment_maps`. */
const NORMALES_GLSL = `
vec3 nHerbe = texture2D( normalMap, uvD ).xyz * 2.0 - 1.0;
vec3 nTerreV = texture2D( nTerre, uvD ).xyz * 2.0 - 1.0;
vec3 nRocheV = texture2D( nRoche, uvD * 0.6 ).xyz * 2.0 - 1.0;
vec3 nSableV = texture2D( nSable, uvD ).xyz * 2.0 - 1.0;
vec3 mapN = normalize( nHerbe * splat.r + nTerreV * splat.g + nRocheV * splat.b + nSableV * splat.a );
mapN.xy *= normalScale * ( 1.0 - couverture * 0.6 );
normal = normalize( tbn * mapN );
`;

/** Construit la géométrie du sol, altitudes comprises. */
function geometrieSol(g: GrilleTerrain): THREE.BufferGeometry {
  const nx = g.largeur * SUBDIVISIONS;
  const nz = g.hauteur * SUBDIVISIONS;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const pas = CASE / SUBDIVISIONS;
  for (let j = 0; j <= nz; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const k = j * (nx + 1) + i;
      const x = i * pas;
      const z = j * pas;
      positions[k * 3] = x;
      positions[k * 3 + 1] = hauteurSol(g, x, z);
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / (g.largeur * CASE);
      uvs[k * 2 + 1] = z / (g.hauteur * CASE);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Le socle du diorama : la tranche de terre qui porte le plateau. */
function geometrieSocle(g: GrilleTerrain): THREE.BufferGeometry {
  const L = g.largeur * CASE;
  const H = g.hauteur * CASE;
  const bas = -1.1;
  const positions: number[] = [];
  const normales: number[] = [];
  const pas = CASE / SUBDIVISIONS;

  const mur = (
    x0: number, z0: number, x1: number, z1: number, nx: number, nz: number,
  ): void => {
    const y0 = hauteurSol(g, x0, z0) + 0.001;
    const y1 = hauteurSol(g, x1, z1) + 0.001;
    positions.push(x0, y0, z0, x0, bas, z0, x1, bas, z1);
    positions.push(x0, y0, z0, x1, bas, z1, x1, y1, z1);
    for (let i = 0; i < 6; i += 1) normales.push(nx, 0, nz);
  };

  for (let i = 0; i < g.largeur * SUBDIVISIONS; i += 1) {
    mur(i * pas, 0, (i + 1) * pas, 0, 0, -1);
    mur((i + 1) * pas, H, i * pas, H, 0, 1);
  }
  for (let j = 0; j < g.hauteur * SUBDIVISIONS; j += 1) {
    mur(0, (j + 1) * pas, 0, j * pas, -1, 0);
    mur(L, j * pas, L, (j + 1) * pas, 1, 0);
  }
  // Le fond, pour que le socle ne soit pas creux vu d'en dessous.
  positions.push(0, bas, 0, L, bas, 0, L, bas, H, 0, bas, 0, L, bas, H, 0, bas, H);
  for (let i = 0; i < 6; i += 1) normales.push(0, -1, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  return geo;
}

/** Hauteur du décalque de voie au-dessus de la surface. */
const HAUT_VOIE = 0.022;

/**
 * Le décalque des voies : pour chaque case de route ou de pont, une nappe de
 * `SUBDIVISIONS × SUBDIVISIONS` quads **aux mêmes sommets que le sol**, donc
 * exactement parallèle à lui — échantillonnée plus fin, elle passerait sous les
 * facettes du maillage entre deux sommets —, et des UV tournés vers la tuile
 * de l'atlas que `pieceDeCase` a choisie. Une seule géométrie, un seul appel.
 */
function geometrieVoies(g: GrilleTerrain): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pas = CASE / SUBDIVISIONS;
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const piece = pieceDeCase(g, x, y);
      if (!piece) continue;
      const base = positions.length / 3;
      for (let j = 0; j <= SUBDIVISIONS; j += 1) {
        for (let i = 0; i <= SUBDIVISIONS; i += 1) {
          const px = x * CASE + i * pas;
          const pz = y * CASE + j * pas;
          positions.push(px, hauteurEn(g, px, pz) + HAUT_VOIE, pz);
          const [u, v] = uvAtlas(piece.forme, piece.rotation, i / SUBDIVISIONS, j / SUBDIVISIONS);
          uvs.push(u, v);
        }
      }
      for (let j = 0; j < SUBDIVISIONS; j += 1) {
        for (let i = 0; i < SUBDIVISIONS; i += 1) {
          const a = base + j * (SUBDIVISIONS + 1) + i;
          const b = a + 1;
          const c = a + (SUBDIVISIONS + 1);
          const d = c + 1;
          // Même diagonale que le sol : les deux nappes restent parallèles.
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Les cotes d'un pont, en cases : tablier, parapets, piles. */
const PONT = {
  /** Largeur hors tout du tablier : un peu plus que la chaussée et ses accotements. */
  largeur: 0.64,
  epaisseurTablier: 0.07,
  /** Le dessus du tablier, juste sous le décalque de voie. */
  dessus: -0.006,
  parapet: { largeur: 0.05, hauteur: 0.11 },
  pile: { cote: 0.1, long: 0.33, travers: 0.2, fond: -0.36 },
} as const;

/**
 * Les ponts : un tablier, deux parapets et quatre piles par case, dans l'axe
 * que `axePont` a lu sur les voisines, le tout **fusionné** en une géométrie.
 * Les piles descendent sous le lit : elles ne flottent pas quand la marée
 * baisse. Le tablier est plat à la hauteur du terrain `pont`, c'est-à-dire là
 * où `hauteurEn` pose les unités qui le traversent.
 */
function geometriePonts(g: GrilleTerrain): THREE.BufferGeometry | null {
  const morceaux: THREE.BufferGeometry[] = [];
  const boite = (l: number, h: number, p: number, x: number, y: number, z: number): THREE.BufferGeometry =>
    new THREE.BoxGeometry(l, h, p).translate(x, y, z);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (terrainBorne(g, x, y) !== 'pont') continue;
      const axe = axePont(g, x, y);
      // Composé dans l'axe nord-sud (le long de Z), puis tourné s'il le faut.
      const parts = [
        boite(PONT.largeur, PONT.epaisseurTablier, CASE, 0, PONT.dessus - PONT.epaisseurTablier / 2, 0),
      ];
      for (const cote of [-1, 1]) {
        const bord = (PONT.largeur - PONT.parapet.largeur) / 2 * cote;
        parts.push(boite(PONT.parapet.largeur, PONT.parapet.hauteur, CASE, bord, PONT.dessus + PONT.parapet.hauteur / 2, 0));
        for (const bout of [-1, 1]) {
          const haut = PONT.dessus - PONT.epaisseurTablier;
          parts.push(boite(
            PONT.pile.cote, haut - PONT.pile.fond, PONT.pile.cote,
            PONT.pile.travers * cote, (haut + PONT.pile.fond) / 2, PONT.pile.long * bout,
          ));
        }
      }
      const pont = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!pont) continue;
      if (axe === 'eo') pont.rotateY(Math.PI / 2);
      pont.translate(x * CASE + CASE / 2, 0, y * CASE + CASE / 2);
      morceaux.push(pont);
    }
  }
  if (morceaux.length === 0) return null;
  const geo = mergeGeometries(morceaux);
  morceaux.forEach((m) => m.dispose());
  return geo;
}

/** La grille au sol : des lignes fines, posées juste au-dessus du terrain. */
function geometrieGrille(g: GrilleTerrain): THREE.BufferGeometry {
  const positions: number[] = [];
  const pas = CASE / SUBDIVISIONS;
  const HAUT = 0.012;
  const ligne = (x0: number, z0: number, x1: number, z1: number): void => {
    positions.push(x0, hauteurSol(g, x0, z0) + HAUT, z0, x1, hauteurSol(g, x1, z1) + HAUT, z1);
  };
  for (let x = 0; x <= g.largeur; x += 1) {
    for (let j = 0; j < g.hauteur * SUBDIVISIONS; j += 1) {
      ligne(x * CASE, j * pas, x * CASE, (j + 1) * pas);
    }
  }
  for (let y = 0; y <= g.hauteur; y += 1) {
    for (let i = 0; i < g.largeur * SUBDIVISIONS; i += 1) {
      ligne(i * pas, y * CASE, (i + 1) * pas, y * CASE);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

/** Monte le plateau complet dans un groupe. */
export function creerPlateau(g: GrilleTerrain, doc: Document, biome: Biome = 'plaine'): Plateau {
  const groupe = new THREE.Group();
  groupe.name = 'plateau';

  const herbe = jeuMatiere(doc, 'herbe', 256, biome);
  const terre = jeuMatiere(doc, 'terre', 256, biome);
  const roche = jeuMatiere(doc, 'roche', 256, biome);
  const sable = jeuMatiere(doc, 'sable', 256, biome);
  const neige = jeuMatiere(doc, 'neige', 128);

  const splat = new THREE.DataTexture(
    construireSplat(g), g.largeur, g.hauteur, THREE.RGBAFormat,
  );
  splat.minFilter = THREE.LinearFilter;
  splat.magFilter = THREE.LinearFilter;
  splat.wrapS = THREE.ClampToEdgeWrapping;
  splat.wrapT = THREE.ClampToEdgeWrapping;
  splat.needsUpdate = true;

  const uniformes = {
    tSplat: { value: splat },
    tTerre: { value: terre.albedo },
    tRoche: { value: roche.albedo },
    tSable: { value: sable.albedo },
    tNeige: { value: neige.albedo },
    nTerre: { value: terre.normales },
    nRoche: { value: roche.normales },
    nSable: { value: sable.normales },
    uTiling: { value: new THREE.Vector2(g.largeur * TUILAGE, g.hauteur * TUILAGE) },
    uNeige: { value: 0 },
    uMouille: { value: 0 },
  };

  const matSol = new THREE.MeshStandardMaterial({
    map: herbe.albedo,
    normalMap: herbe.normales,
    normalScale: new THREE.Vector2(0.58, 0.58),
    roughness: 0.95,
    metalness: 0,
  });
  matSol.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.fragmentShader = UNIFORMES_GLSL + shader.fragmentShader
      .replace('#include <map_fragment>', MELANGE_GLSL)
      .replace('#include <roughnessmap_fragment>', RUGOSITE_GLSL)
      .replace('#include <normal_fragment_maps>', NORMALES_GLSL);
  };
  matSol.customProgramCacheKey = (): string => 'atlas-terrain-peint-v2';

  const sol = new THREE.Mesh(geometrieSol(g), matSol);
  sol.name = 'sol';
  sol.receiveShadow = true;
  sol.castShadow = true;
  groupe.add(sol);

  const matSocle = new THREE.MeshStandardMaterial({
    map: terre.albedo,
    normalMap: terre.normales,
    roughness: 0.98,
    metalness: 0,
    color: 0x7d6c56,
  });
  const socle = new THREE.Mesh(geometrieSocle(g), matSocle);
  socle.receiveShadow = true;
  groupe.add(socle);

  // --- Les voies : un décalque par case de route ou de pont, tous dans une
  //     seule géométrie. Le décalque écrit la profondeur malgré sa
  //     transparence : sans cela, le plan d'eau — dessiné après lui — repeindrait
  //     la chaussée d'un pont, puisque le sol sous le tablier est un lit de
  //     rivière. `alphaTest` jette les pixels vides pour qu'ils ne le fassent pas.
  const apparence = APPARENCES[biome];
  const texVoies = textureVoies(doc, biome);
  const matVoie = new THREE.MeshStandardMaterial({
    map: texVoies,
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    alphaTest: 0.03,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const voies = new THREE.Mesh(new THREE.BufferGeometry(), matVoie);
  voies.name = 'voies';
  voies.receiveShadow = true;
  voies.visible = false;
  groupe.add(voies);

  const matPont = new THREE.MeshStandardMaterial({
    color: apparence.pont,
    roughness: 0.82,
    metalness: 0,
  });
  const ponts = new THREE.Mesh(new THREE.BufferGeometry(), matPont);
  ponts.name = 'ponts';
  ponts.castShadow = true;
  ponts.receiveShadow = true;
  ponts.visible = false;
  groupe.add(ponts);

  /** Recoud voies et ponts sur une grille, ou les cache s'il n'y en a plus. */
  function majVoies(suivante: GrilleTerrain): void {
    for (const [maille, batir] of [[voies, geometrieVoies], [ponts, geometriePonts]] as const) {
      const geo = batir(suivante);
      maille.geometry.dispose();
      maille.geometry = geo ?? new THREE.BufferGeometry();
      maille.visible = geo !== null;
    }
  }
  majVoies(g);

  const matGrille = new THREE.LineBasicMaterial({
    color: 0x0a1220, transparent: true, opacity: 0.17, depthWrite: false,
  });
  const geoGrille = geometrieGrille(g);
  const grille = new THREE.LineSegments(geoGrille, matGrille);
  grille.renderOrder = 1;
  groupe.add(grille);

  // --- L'eau : un plan large, qui déborde de la carte pour poser le diorama
  //     sur une mer plutôt que sur du vide.
  const nEau = normalesEau(doc);
  nEau.repeat.set(6, 6);
  const matEau = new THREE.MeshStandardMaterial({
    color: 0x2a6ea8,
    normalMap: nEau,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.34,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  // Un champ d'altitude partagé avec le sol donne une profondeur réelle à l'eau.
  // Une seule texture basse résolution, aucune géométrie par vague ou par rive.
  const fonds = new Uint8Array(g.largeur * g.hauteur * 4);
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const i = (y * g.largeur + x) * 4;
      fonds[i] = Math.round((hauteurSol(g, x + 0.5, y + 0.5) + 0.4) / 1.4 * 255);
      fonds[i + 3] = 255;
    }
  }
  const tFonds = new THREE.DataTexture(fonds, g.largeur, g.hauteur, THREE.RGBAFormat);
  tFonds.minFilter = THREE.LinearFilter;
  tFonds.magFilter = THREE.LinearFilter;
  tFonds.needsUpdate = true;
  const teintesRive: Partial<Record<Biome, number>> = {
    archipel: 0x66c9b3, cotier: 0x80b9b0, marais: 0x929b68,
    volcanique: 0x7d979a, neige: 0xb7d6da,
  };
  const uEau = {
    tFonds: { value: tFonds },
    uCarte: { value: new THREE.Vector2(g.largeur * CASE, g.hauteur * CASE) },
    uTemps: { value: 0 },
    uEcume: { value: 0.3 },
    uRive: { value: new THREE.Color(teintesRive[biome] ?? 0x91b9ad) },
  };
  matEau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uEau);
    shader.vertexShader = 'varying vec2 vMondeEau;\n' + shader.vertexShader
      .replace('#include <project_vertex>', `#include <project_vertex>
        vMondeEau = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;`);
    shader.fragmentShader = `
      varying vec2 vMondeEau;
      uniform sampler2D tFonds;
      uniform vec2 uCarte;
      uniform float uTemps;
      uniform float uEcume;
      uniform vec3 uRive;
    ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 uvCarte = vMondeEau / uCarte;
      float dansCarte = step(0.0, uvCarte.x) * step(0.0, uvCarte.y)
        * step(uvCarte.x, 1.0) * step(uvCarte.y, 1.0);
      float fond = texture2D(tFonds, clamp(uvCarte, 0.0, 1.0)).r * 1.4 - 0.4;
      float profondeur = max(0.0, -0.12 - fond);
      float peuProfond = (1.0 - smoothstep(0.025, 0.27, profondeur)) * dansCarte;
      diffuseColor.rgb = mix(diffuseColor.rgb, uRive, peuProfond * 0.65);
      float vague = sin(profondeur * 100.0 - uTemps * 1.6 + sin(vMondeEau.x * 5.0 + vMondeEau.y * 3.0));
      float bord = (1.0 - smoothstep(0.005, 0.09, profondeur)) * dansCarte;
      float ecume = smoothstep(0.42, 0.95, vague) * bord * uEcume;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.91, 0.86), ecume);
    `);
  };
  matEau.customProgramCacheKey = (): string => 'atlas-eau-rives-v2';
  const debord = Math.max(g.largeur, g.hauteur) * CASE * 1.6 + 30;
  const eau = new THREE.Mesh(new THREE.PlaneGeometry(debord, debord, 1, 1), matEau);
  eau.rotation.x = -Math.PI / 2;
  eau.position.set((g.largeur * CASE) / 2, NIVEAU_EAU, (g.hauteur * CASE) / 2);
  // Un pont porte son ombre sur l'eau qu'il franchit : c'est elle qui dit
  // qu'il est au-dessus, et non posé dessus.
  eau.receiveShadow = true;
  eau.renderOrder = 2;
  groupe.add(eau);

  let agitation = 0.4;
  let temps = 0;
  // Le terrain courant : il change quand la marée monte ou qu'on pose un pont.
  let terrain = g;

  /** La mutation en cours, ou `null`. Les tableaux sont les deux états à mêler. */
  let mutation: {
    ecoule: number;
    duree: number;
    splatAvant: Uint8Array;
    splatApres: Uint8Array;
    yAvant: Float32Array;
    yApres: Float32Array;
  } | null = null;

  /** Termine une mutation : on pose l'état d'arrivée, exactement. */
  function acheverMutation(): void {
    const m = mutation;
    if (!m) return;
    (splat.image.data as Uint8Array).set(m.splatApres);
    splat.needsUpdate = true;
    const pos = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < m.yApres.length; i += 1) pos.setY(i, m.yApres[i]!);
    pos.needsUpdate = true;
    // Les normales ne sont recalculées **qu'ici** : les rafraîchir à chaque image
    // de la transition coûterait plus que tout le reste, pour un gain invisible
    // pendant une seconde de mouvement.
    sol.geometry.computeVertexNormals();
    mutation = null;
  }

  return {
    groupe,
    sol,
    ponts,
    hauteurEn: (x, z) => hauteurEn(terrain, x, z),

    majTerrain(suivante: GrilleTerrain, duree = 0): void {
      acheverMutation();
      terrain = suivante;
      const donnees = construireSplat(suivante);
      const neuve = geometrieSol(suivante);
      const yApres = new Float32Array(neuve.getAttribute('position').count);
      const posNeuve = neuve.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < yApres.length; i += 1) yApres[i] = posNeuve.getY(i);

      // Les dimensions ne changent jamais **en cours de partie** : tant qu'elles
      // tiennent, on garde la géométrie et on ne fait glisser que les altitudes.
      // Mais le plateau survit à un changement de carte — l'atelier en change
      // sans démonter la scène —, et une splat écrite au chausse-pied dans une
      // texture d'une autre taille lève un `RangeError` qui blanchit la page.
      const posCourante = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
      const memeMaillage = posCourante.count === yApres.length;
      const memeTaille = splat.image.width === suivante.largeur
        && splat.image.height === suivante.hauteur;
      if (!memeTaille) {
        // Une nouvelle image plutôt qu'une écriture : three.js la renvoie
        // entière à la carte graphique au prochain rendu.
        splat.image = { data: donnees, width: suivante.largeur, height: suivante.hauteur };
        splat.needsUpdate = true;
        sol.geometry.dispose();
        sol.geometry = neuve;
        majVoies(suivante);
        return;
      }
      if (duree > 0 && memeMaillage) {
        const yAvant = new Float32Array(yApres.length);
        for (let i = 0; i < yAvant.length; i += 1) yAvant[i] = posCourante.getY(i);
        mutation = {
          ecoule: 0,
          duree,
          splatAvant: (splat.image.data as Uint8Array).slice(),
          splatApres: donnees,
          yAvant,
          yApres,
        };
        neuve.dispose();
      } else {
        sol.geometry.dispose();
        sol.geometry = neuve;
        (splat.image.data as Uint8Array).set(donnees);
        splat.needsUpdate = true;
      }
      majVoies(suivante);
    },

    appliquerAmbiance(p: ParametresAmbiance): void {
      matSol.color.set(p.teinteSol);
      matSocle.color.set(p.teinteSol).multiplyScalar(0.55);
      // Le revêtement ne prend qu'un soupçon de la teinte de saison : une route
      // qui vire au sable en automne se lit comme un chemin de terre. La neige
      // qui tombe, elle, le blanchit à moitié — jamais tout à fait, une voie
      // déneigée reste lisible, c'est même ce qui la rend utile.
      matVoie.color.set(0xffffff).lerp(new THREE.Color(p.teinteSol), 0.1)
        .lerp(new THREE.Color(0xf2f5f8), p.neigeSol * 0.5);
      matPont.color.set(apparence.pont).lerp(new THREE.Color(0xf2f5f8), p.neigeSol * 0.35);
      matVoie.roughness = 0.88 - p.mouille * 0.45;
      uniformes.uNeige.value = Math.max(p.neigeSol, biome === 'neige' ? 0.78 : 0);
      uniformes.uMouille.value = p.mouille;
      matEau.color.set(p.eau.couleur);
      matEau.opacity = p.eau.opacite;
      matEau.roughness = 0.26 + p.mouille * 0.08;
      uEau.uEcume.value = 0.32 + p.eau.agitation * 0.36;
      uEau.uRive.value.set(teintesRive[biome] ?? 0x91b9ad).multiply(new THREE.Color(p.teinteSol));
      matGrille.opacity = 0.16 + p.neigeSol * 0.06;
      agitation = p.eau.agitation;
    },

    // L'eau avance à chaque image mais ne **réclame** jamais d'image : au repos,
    // c'est la relance à une image par seconde qui la fait dériver doucement.
    avancer(ms: number): boolean {
      temps += ms;
      uEau.uTemps.value = temps / 1000;
      let encore = false;
      const m = mutation;
      if (m) {
        m.ecoule += ms;
        const brut = Math.min(1, m.ecoule / m.duree);
        if (brut >= 1) {
          acheverMutation();
        } else {
          // Une marée part vite et s'étale : c'est l'étale de fin de course.
          const t = 1 - (1 - brut) ** 3;
          const octets = splat.image.data as Uint8Array;
          for (let i = 0; i < octets.length; i += 1) {
            octets[i] = m.splatAvant[i]! + (m.splatApres[i]! - m.splatAvant[i]!) * t;
          }
          splat.needsUpdate = true;
          const pos = sol.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < m.yAvant.length; i += 1) {
            pos.setY(i, m.yAvant[i]! + (m.yApres[i]! - m.yAvant[i]!) * t);
          }
          pos.needsUpdate = true;
          // L'écume enfle au passage du front, puis retombe : c'est elle qui
          // raconte le mouvement, plus que le niveau lui-même.
          uEau.uEcume.value = (0.32 + agitation * 0.36) * (1 + Math.sin(brut * Math.PI) * 1.1);
          encore = true;
        }
      }
      const dt = Math.min(2, ms / 1000);
      nEau.offset.x += dt * 0.012 * (0.4 + agitation);
      nEau.offset.y += dt * 0.019 * (0.4 + agitation);
      matEau.normalScale.setScalar(0.18 + Math.sin(temps / 2400) * 0.03 + agitation * 0.16);
      return encore;
    },

    dispose(): void {
      sol.geometry.dispose();
      socle.geometry.dispose();
      geoGrille.dispose();
      voies.geometry.dispose();
      ponts.geometry.dispose();
      eau.geometry.dispose();
      matSol.dispose();
      matSocle.dispose();
      matVoie.dispose();
      matPont.dispose();
      matGrille.dispose();
      matEau.dispose();
      splat.dispose();
      tFonds.dispose();
      texVoies.dispose();
      nEau.dispose();
      for (const j of [herbe, terre, roche, sable, neige]) {
        j.albedo.dispose();
        j.normales.dispose();
      }
    },
  };
}
