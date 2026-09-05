/**
 * Le plateau : maillage de la grille, mélange de matières, eau, routes, grille.
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
 */

import * as THREE from 'three';

import type { Biome } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import {
  CASE, construireSplat, hauteurEn, NIVEAU_EAU, type GrilleTerrain,
} from './geometrie';
import { jeuMatiere, normalesEau, textureRoute } from './textures';

/** Subdivisions par case : trois suffisent à arrondir un col de montagne. */
const SUBDIVISIONS = 3;

/** Répétitions de texture de détail, par case. */
const TUILAGE = 0.65;

/** Le plateau monté : son groupe, son sol cliquable et ses réglages d'ambiance. */
export interface Plateau {
  readonly groupe: THREE.Group;
  /** Le maillage du sol : c'est lui que le lancer de rayon interroge. */
  readonly sol: THREE.Mesh;
  /** Altitude du sol en un point du monde. */
  hauteurEn(x: number, z: number): number;
  /** Applique une ambiance (teinte, neige, humidité, couleur de l'eau). */
  appliquerAmbiance(p: ParametresAmbiance): void;
  /** Fait avancer l'eau. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  /**
   * Relit la grille et remet le sol à jour : altitudes, mélange de matières,
   * routes.
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
      positions[k * 3 + 1] = hauteurEn(g, x, z);
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
    const y0 = hauteurEn(g, x0, z0) + 0.001;
    const y1 = hauteurEn(g, x1, z1) + 0.001;
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

/** Les bandes de route : un carré central par case, et un raccord par voisine. */
function geometrieRoutes(g: GrilleTerrain): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const estRoute = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= g.largeur || y >= g.hauteur) return false;
    const t = g.terrainDe(x, y);
    return t === 'route' || t === 'pont';
  };
  const HAUT = 0.022;
  const DEMI = 0.29;

  const quad = (
    x0: number, z0: number, x1: number, z1: number, vertical: boolean,
  ): void => {
    const base = positions.length / 3;
    const coins: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (const [x, z] of coins) {
      positions.push(x, hauteurEn(g, x, z) + HAUT, z);
    }
    if (vertical) uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    else uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };

  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (!estRoute(x, y)) continue;
      const cx = x * CASE + CASE / 2;
      const cz = y * CASE + CASE / 2;
      quad(cx - DEMI, cz - DEMI, cx + DEMI, cz + DEMI, true);
      if (estRoute(x, y - 1)) quad(cx - DEMI, cz - CASE / 2, cx + DEMI, cz - DEMI, true);
      if (estRoute(x, y + 1)) quad(cx - DEMI, cz + DEMI, cx + DEMI, cz + CASE / 2, true);
      if (estRoute(x - 1, y)) quad(cx - CASE / 2, cz - DEMI, cx - DEMI, cz + DEMI, false);
      if (estRoute(x + 1, y)) quad(cx + DEMI, cz - DEMI, cx + CASE / 2, cz + DEMI, false);
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

/** La grille au sol : des lignes fines, posées juste au-dessus du terrain. */
function geometrieGrille(g: GrilleTerrain): THREE.BufferGeometry {
  const positions: number[] = [];
  const pas = CASE / SUBDIVISIONS;
  const HAUT = 0.012;
  const ligne = (x0: number, z0: number, x1: number, z1: number): void => {
    positions.push(x0, hauteurEn(g, x0, z0) + HAUT, z0, x1, hauteurEn(g, x1, z1) + HAUT, z1);
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

  const geoRoutes = geometrieRoutes(g);
  const texRoute = textureRoute(doc);
  let routes: THREE.Mesh | null = null;
  const matRoute = new THREE.MeshStandardMaterial({
    map: texRoute,
    roughness: 0.86,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  if (geoRoutes) {
    routes = new THREE.Mesh(geoRoutes, matRoute);
    routes.receiveShadow = true;
    groupe.add(routes);
  }

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
      fonds[i] = Math.round((hauteurEn(g, x + 0.5, y + 0.5) + 0.4) / 1.4 * 255);
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

  /** Recoud le ruban de bitume sur une grille donnée, ou le cache s'il n'y a
   * plus de route. */
  function majRoutes(suivante: GrilleTerrain): void {
    const geoRoutes = geometrieRoutes(suivante);
    if (routes && geoRoutes) {
      routes.geometry.dispose();
      routes.geometry = geoRoutes;
      routes.visible = true;
    } else if (routes) {
      routes.visible = false;
      geoRoutes?.dispose();
    }
  }

  return {
    groupe,
    sol,
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
        majRoutes(suivante);
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
      majRoutes(suivante);
    },

    appliquerAmbiance(p: ParametresAmbiance): void {
      matSol.color.set(p.teinteSol);
      matSocle.color.set(p.teinteSol).multiplyScalar(0.55);
      // Le bitume ne prend qu'un soupçon de la teinte de saison : une route qui
      // vire au sable en automne se lit comme un chemin de terre.
      matRoute.color.set(0xffffff).lerp(new THREE.Color(p.teinteSol), 0.1);
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
      routes?.geometry.dispose();
      eau.geometry.dispose();
      matSol.dispose();
      matSocle.dispose();
      matRoute.dispose();
      matGrille.dispose();
      matEau.dispose();
      splat.dispose();
      tFonds.dispose();
      texRoute.dispose();
      nEau.dispose();
      for (const j of [herbe, terre, roche, sable, neige]) {
        j.albedo.dispose();
        j.normales.dispose();
      }
    },
  };
}
