/**
 * Le décor : arbres, rochers et bâtiments.
 *
 * Deux exigences se répondent ici. La première est visuelle : une forêt doit
 * ressembler à une forêt et une ville à une ville, avec des fenêtres qui
 * s'allument la nuit. La seconde est budgétaire : une carte de soixante cases de
 * côté peut porter des milliers d'arbres, et un `Mesh` par arbre ferait fondre
 * la carte graphique. D'où l'`InstancedMesh` — un seul appel de dessin pour tous
 * les troncs, un autre pour toutes les couronnes — et un décor **déterministe**,
 * tiré d'un aléa de case : deux montages rendent exactement la même forêt.
 *
 * Les variantes saisonnières passent par la couleur des matériaux (feuillage
 * vert, doré, nu et enneigé, fleurs au printemps) plutôt que par des maillages
 * différents : c'est instantané au changement de journée.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { type StyleRegion } from '../assets/spec';
import { styleRegionParMecanique } from '../assets/styles';
import type { EtatPartie } from '../engine/index';
import { cleCase } from '../engine/index';
import { paletteDe } from '../render/palettes';
import type { Biome, CampId, Saison } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import { alea, CASE, type GrilleTerrain } from './geometrie';

/** Couleurs de feuillage par saison : c'est la saison qu'on voit d'abord. */
const FEUILLAGE: Readonly<Record<Saison, { conifere: number; feuillu: number }>> = {
  printemps: { conifere: 0x3f8a4a, feuillu: 0x74bf5c },
  ete: { conifere: 0x2f7a3d, feuillu: 0x4e9a3c },
  automne: { conifere: 0x4a7a44, feuillu: 0xc9782a },
  hiver: { conifere: 0x4c6a58, feuillu: 0x9aa79c },
};

/** Ce que `creerDecor` rend au rendu. */
export interface Decor {
  readonly groupe: THREE.Group;
  /** Reconstruit les bâtiments quand un propriétaire change. */
  majProprietaires(etat: EtatPartie, visibles?: ReadonlySet<string> | null): void;
  appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void;
  /** Fait osciller les arbres. Rend vrai tant qu'il faut redessiner. */
  avancer(ms: number): boolean;
  /**
   * Repose le décor sur le relief. Arbres et rochers sont placés une fois pour
   * toutes au montage, et les arbres ne se replacent ensuite que par grand vent :
   * quand une marée fait descendre le sol, ils restaient suspendus au-dessus du
   * vide. À appeler après toute mutation du terrain.
   */
  majRelief(): void;
  dispose(): void;
}

/** Une place d'arbre tirée de l'aléa de case. */
interface Arbre {
  x: number;
  z: number;
  echelle: number;
  conifere: boolean;
  angle: number;
}

/** Tire les arbres d'une carte : trois par case de forêt, aux bords pour laisser voir une unité. */
function semerArbres(g: GrilleTerrain, biome: Biome): Arbre[] {
  const arbres: Arbre[] = [];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (g.terrainDe(x, y) !== 'foret') continue;
      const nombre = 3;
      for (let i = 0; i < nombre; i += 1) {
        const a = alea(x, y, 10 + i);
        const angle = (i / nombre) * Math.PI * 2 + a * 0.25;
        const c = alea(x, y, 70 + i);
        arbres.push({
          x: x * CASE + 0.5 + Math.cos(angle) * 0.39,
          z: y * CASE + 0.5 + Math.sin(angle) * 0.39,
          echelle: 0.65 + c * 0.2,
          conifere: ['montagne', 'neige', 'cotier'].includes(biome)
            || (!['jungle', 'archipel', 'marais'].includes(biome) && alea(x, y, 100 + i) > 0.65),
          angle: alea(x, y, 130 + i) * Math.PI * 2,
        });
      }
    }
  }
  return arbres;
}

/**
 * Une pierre, tirée de l'aléa de case.
 *
 * Trois silhouettes plutôt qu'une : un bloc anguleux qui domine la case, des
 * éclats plus petits autour, et de loin en loin une **dalle** couchée. Un seul
 * volume répété — c'était un dodécaèdre régulier — donne une caillasse de dés
 * qu'on reconnaît au premier coup d'œil.
 */
interface Rocher {
  x: number;
  z: number;
  echelle: number;
  /** Silhouette : 0 bloc, 1 éclat, 2 dalle. */
  variante: number;
  /** Rotation autour de la verticale : c'est la seule qui soit libre. */
  angle: number;
  /** Assise, en radians. Bornée : une pierre s'incline, elle ne bascule pas. */
  penche: number;
  /** Multiplicateur de teinte, autour de 1 : deux pierres voisines diffèrent. */
  teinte: number;
}

/**
 * Tire les pierres : trois à cinq par case de montagne, **en couronne**, jamais
 * au centre exact — c'est là que se pose une unité.
 */
function semerRochers(g: GrilleTerrain): Rocher[] {
  const pierres: Rocher[] = [];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      if (g.terrainDe(x, y) !== 'montagne') continue;
      const nombre = 3 + Math.floor(alea(x, y, 3) * 3);
      for (let i = 0; i < nombre; i += 1) {
        const angle = (i / nombre) * Math.PI * 2 + alea(x, y, 200 + i) * 1.2;
        const rayon = 0.19 + alea(x, y, 230 + i) * 0.21;
        // Une seule grosse pierre par case ; le reste est de la caillasse, et
        // une case sur quatre porte une dalle à la place de son bloc.
        const gros = i === 0;
        const variante = gros ? (alea(x, y, 5) < 0.26 ? 2 : 0) : 1;
        const brut = alea(x, y, 260 + i);
        pierres.push({
          x: x * CASE + 0.5 + Math.cos(angle) * rayon,
          z: y * CASE + 0.5 + Math.sin(angle) * rayon,
          echelle: gros ? 0.78 + brut * 0.42 : 0.3 + brut * 0.3,
          variante,
          angle: alea(x, y, 290 + i) * Math.PI * 2,
          penche: (alea(x, y, 320 + i) - 0.5) * 0.34,
          teinte: 0.82 + alea(x, y, 350 + i) * 0.34,
        });
      }
    }
  }
  return pierres;
}

/**
 * Déforme un polyèdre pour qu'il cesse d'être régulier : chaque sommet est
 * poussé le long de sa normale d'un bruit tiré de sa **position arrondie**, de
 * sorte que deux sommets confondus bougent ensemble — sinon les facettes se
 * décousent, la géométrie d'un icosaèdre n'étant pas indexée.
 *
 * La base est ensuite aplatie : une pierre pose sur le sol, elle n'y pointe pas.
 */
function eroder(geo: THREE.BufferGeometry, sel: number, aplatir: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bruit = alea(Math.round(x * 512), Math.round(z * 512) + Math.round(y * 97), sel);
    const facteur = 0.74 + bruit * 0.52;
    pos.setXYZ(i, x * facteur, Math.max(y * facteur, -aplatir), z * facteur);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Monte le décor complet. */
export function creerDecor(
  g: GrilleTerrain, etat: EtatPartie, hauteurEn: (x: number, z: number) => number,
  biome: Biome = 'plaine',
): Decor {
  const groupe = new THREE.Group();
  groupe.name = 'decor';

  // --- Arbres
  const arbres = semerArbres(g, biome);
  const tropical = biome === 'jungle' || biome === 'archipel';
  let saisonCourante: Saison = 'ete';
  const geoTronc = new THREE.CylinderGeometry(0.028, 0.042, 0.2, 6);
  const matTronc = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.92 });
  // Plusieurs volumes dans une seule géométrie : silhouettes travaillées sans
  // appel de dessin supplémentaire par arbre.
  const etages = [0, 1, 2].map((i) => {
    const geo = new THREE.ConeGeometry(0.17 - i * 0.035, 0.28 - i * 0.04, 8);
    return geo.translate(0, -0.12 + i * 0.13, 0);
  });
  const geoConifere = mergeGeometries(etages)!;
  etages.forEach((geo) => geo.dispose());
  const couronnes = tropical
    ? Array.from({ length: 6 }, (_, i) => new THREE.SphereGeometry(0.16, 6, 3)
      .scale(0.42, 0.16, 1.5).translate(0, 0, 0.09).rotateY(i * Math.PI / 3))
    : [[-0.065, -0.025, 0], [0.065, 0, 0.025], [0, 0.095, -0.025]].map(([x, y, z]) =>
      new THREE.IcosahedronGeometry(0.13, 1).translate(x!, y!, z!));
  const geoFeuillu = mergeGeometries(couronnes)!;
  couronnes.forEach((geo) => geo.dispose());
  const matConifere = new THREE.MeshStandardMaterial({ color: FEUILLAGE.ete.conifere, roughness: 0.82 });
  const matFeuillu = new THREE.MeshStandardMaterial({ color: FEUILLAGE.ete.feuillu, roughness: 0.84 });

  const troncs = new THREE.InstancedMesh(geoTronc, matTronc, Math.max(1, arbres.length));
  const coniferes = new THREE.InstancedMesh(
    geoConifere, matConifere, Math.max(1, arbres.filter((a) => a.conifere).length),
  );
  const feuillus = new THREE.InstancedMesh(
    geoFeuillu, matFeuillu, Math.max(1, arbres.filter((a) => !a.conifere).length),
  );
  troncs.name = 'troncs';
  coniferes.name = 'coniferes';
  feuillus.name = tropical ? 'palmes' : 'feuillus';
  for (const m of [troncs, coniferes, feuillus]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    groupe.add(m);
  }

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const ech = new THREE.Vector3();
  const axe = new THREE.Vector3(0, 1, 0);

  function poserArbres(souffle: number): void {
    let iTronc = 0;
    let iCon = 0;
    let iFeu = 0;
    for (const a of arbres) {
      const sol = hauteurEn(a.x, a.z);
      const penche = Math.sin(souffle + a.angle) * 0.09 * oscillation;
      quat.setFromAxisAngle(axe, a.angle);
      pos.set(a.x, sol + (tropical ? 0.19 : 0.1) * a.echelle, a.z);
      ech.set(a.echelle, a.echelle * (tropical ? 1.9 : 1), a.echelle);
      mat4.compose(pos, quat, ech);
      troncs.setMatrixAt(iTronc, mat4);
      iTronc += 1;
      const hautCouronne = sol + (a.conifere ? 0.34 : tropical ? 0.4 : 0.3) * a.echelle;
      quat.setFromEuler(new THREE.Euler(penche, a.angle, penche * 0.6));
      pos.set(a.x + penche * 0.12, hautCouronne, a.z + penche * 0.08);
      const volume = !a.conifere && !tropical && saisonCourante === 'hiver' ? 0.7 : 1;
      ech.set(a.echelle * volume, a.echelle * volume * (biome === 'cotier' ? 0.85 : 1), a.echelle * volume);
      mat4.compose(pos, quat, ech);
      if (a.conifere) {
        coniferes.setMatrixAt(iCon, mat4);
        iCon += 1;
      } else {
        feuillus.setMatrixAt(iFeu, mat4);
        iFeu += 1;
      }
    }
    troncs.count = iTronc;
    coniferes.count = iCon;
    feuillus.count = iFeu;
    troncs.instanceMatrix.needsUpdate = true;
    coniferes.instanceMatrix.needsUpdate = true;
    feuillus.instanceMatrix.needsUpdate = true;
  }

  // --- Rochers
  const rochers = semerRochers(g);
  // Trois lots : un appel de dessin par silhouette, et non un par pierre.
  const geosRocher = [
    eroder(new THREE.IcosahedronGeometry(0.17, 0), 900, 0.085),
    eroder(new THREE.IcosahedronGeometry(0.15, 0), 901, 0.06),
    eroder(new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.42, 0.86), 902, 0.05),
  ];
  const matRocher = new THREE.MeshStandardMaterial({ color: 0x9c9a90, roughness: 0.96, flatShading: true });
  const lotsRocher = geosRocher.map((geo, v) => {
    const total = Math.max(1, rochers.filter((r) => r.variante === v).length);
    const lot = new THREE.InstancedMesh(geo, matRocher, total);
    lot.name = `rochers-${v}`;
    lot.castShadow = true;
    lot.receiveShadow = true;
    lot.frustumCulled = false;
    lot.count = 0;
    groupe.add(lot);
    return lot;
  });
  const teinteRocher = new THREE.Color();

  function poserRochers(): void {
    const rangs = [0, 0, 0];
    for (const r of rochers) {
      const lot = lotsRocher[r.variante];
      if (!lot) continue;
      const i = rangs[r.variante]!;
      rangs[r.variante] = i + 1;
      // La pierre tourne librement autour de la verticale mais s'incline à
      // peine : une roche couchée sur le flanc se lit comme un débris tombé du
      // ciel. Et elle **s'enfonce** au lieu de se poser — sans quoi elle flotte
      // sur son unique facette d'appui, ce que faisait le dodécaèdre.
      quat.setFromEuler(new THREE.Euler(r.penche, r.angle, r.penche * 0.7));
      pos.set(r.x, hauteurEn(r.x, r.z) - 0.05 * r.echelle, r.z);
      ech.set(r.echelle, r.echelle * (0.72 + r.teinte * 0.2), r.echelle);
      mat4.compose(pos, quat, ech);
      lot.setMatrixAt(i, mat4);
      // Une teinte par pierre : la roche d'un massif n'est jamais d'un gris.
      teinteRocher.setRGB(r.teinte, r.teinte * 0.995, r.teinte * 0.96);
      lot.setColorAt(i, teinteRocher);
    }
    lotsRocher.forEach((lot, v) => {
      lot.count = rangs[v]!;
      lot.instanceMatrix.needsUpdate = true;
      if (lot.instanceColor) lot.instanceColor.needsUpdate = true;
    });
  }

  poserRochers();

  // --- Bâtiments
  const batiments = new THREE.Group();
  batiments.name = 'batiments';
  groupe.add(batiments);
  const matFenetres = new THREE.MeshStandardMaterial({
    color: 0x2a3242, emissive: 0xffd98a, emissiveIntensity: 0.05, roughness: 0.25, metalness: 0.1,
  });
  // Le style régional, quand la carte en porte un : la mécanique de la carte dit
  // sa région (`content/mecaniques.json`), la région dit ses toits et ses murs.
  // Une carte sans mécanique garde les teintes neutres, ce qui est un cas normal.
  const styleRegion: StyleRegion | null = styleRegionParMecanique(etat.mecanique?.cle ?? null);
  const couleurMur = styleRegion ? styleRegion.murs.couleur : '#d9d3c6';
  const couleurToit = styleRegion ? styleRegion.toits.couleur : '#6d6a66';
  const matBeton = new THREE.MeshStandardMaterial({ color: couleurMur, roughness: 0.9 });
  const matToit = new THREE.MeshStandardMaterial({ color: couleurToit, roughness: 0.85 });
  const matPierre = new THREE.MeshStandardMaterial({ color: 0xbbb9aa, roughness: 0.92 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x465560, roughness: 0.52, metalness: 0.38 });
  const matIvoire = new THREE.MeshStandardMaterial({ color: 0xeae5d4, roughness: 0.82 });
  const matsCamp = new Map<string, THREE.MeshStandardMaterial>();
  const geosBatiment = new Set<THREE.BufferGeometry>();
  const primitives = new Map<string, THREE.BufferGeometry>();

  function matCamp(camp: CampId | null): THREE.MeshStandardMaterial {
    const cle = String(camp);
    const memo = matsCamp.get(cle);
    if (memo) return memo;
    const m = new THREE.MeshStandardMaterial({ color: paletteDe(camp).main, roughness: 0.62, metalness: 0.1 });
    matsCamp.set(cle, m);
    return m;
  }

  function primitive(cle: string, creer: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geo = primitives.get(cle);
    if (!geo) { geo = creer(); primitives.set(cle, geo); }
    return geo;
  }

  function bloc(l: number, h: number, p: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(primitive('cube', () => new THREE.BoxGeometry(1, 1, 1)), mat);
    m.scale.set(l, h, p);
    return m;
  }

  // Les fenêtres, cheminées et encadrements d'une case sont fusionnés par
  // matériau. Leur nombre ne multiplie donc pas les draw calls sur mobile.
  function fusionnerCase(caseDecor: THREE.Group): void {
    const lots = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const enfant of caseDecor.children) {
      if (!(enfant instanceof THREE.Mesh) || Array.isArray(enfant.material)) continue;
      enfant.updateMatrix();
      const geo = enfant.geometry.clone().applyMatrix4(enfant.matrix);
      const lot = lots.get(enfant.material) ?? [];
      lot.push(geo);
      lots.set(enfant.material, lot);
    }
    caseDecor.clear();
    for (const [mat, lot] of lots) {
      const geo = mergeGeometries(lot)!;
      lot.forEach((g2) => g2.dispose());
      geosBatiment.add(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = mat === matFenetres ? 'vitrages' : 'architecture';
      mesh.castShadow = mat !== matFenetres;
      mesh.receiveShadow = true;
      caseDecor.add(mesh);
    }
  }

  function construireBatiments(e: EtatPartie): void {
    batiments.clear();
    for (const geo of geosBatiment) geo.dispose();
    geosBatiment.clear();
    for (let y = 0; y < g.hauteur; y += 1) {
      for (let x = 0; x < g.largeur; x += 1) {
        const terrain = g.terrainDe(x, y);
        if (!['ville', 'qg', 'usine', 'aeroport'].includes(terrain)) continue;
        const proprio = e.proprietaires[cleCase({ x, y })] ?? null;
        const cx = x * CASE + CASE / 2;
        const cz = y * CASE + CASE / 2;
        const groupeCase = new THREE.Group();
        groupeCase.position.set(cx, hauteurEn(cx, cz), cz);
        groupeCase.userData['case'] = cleCase({ x, y });
        groupeCase.userData['type'] = terrain;
        const teinte = matCamp(proprio);
        const poser = (l: number, h: number, p: number, mat: THREE.Material,
          px: number, py: number, pz: number, rz = 0): THREE.Mesh => {
          const m = bloc(l, h, p, mat);
          m.position.set(px, py, pz); m.rotation.z = rz; groupeCase.add(m); return m;
        };
        const cylindre = (rayon: number, h: number, mat: THREE.Material,
          px: number, py: number, pz: number): THREE.Mesh => {
          const geo = primitive('cylindre', () => new THREE.CylinderGeometry(1, 1, 1, 10));
          const m = new THREE.Mesh(geo, mat);
          m.scale.set(rayon, h, rayon); m.position.set(px, py, pz); groupeCase.add(m); return m;
        };
        const toiture = (px: number, py: number, pz: number, l: number, p: number): void => {
          for (const cote of [-1, 1]) poser(l * 0.57, 0.032, p * 1.12, matToit,
            px + cote * l * 0.24, py + l * 0.12, pz, -cote * 0.43);
          poser(0.032, 0.032, p * 1.15, matMetal, px, py + l * 0.24, pz);
        };
        const fenetres = (px: number, pz: number, l: number, h: number): void => {
          for (const cote of [-1, 1]) {
            for (const rang of [0.43, 0.75]) {
              // Deux fenêtres distinctes par façade, enchâssées dans une pierre claire.
              for (const decalage of [-0.23, 0.23]) {
                poser(l * 0.2, 0.064, 0.014, matIvoire, px + l * decalage, h * rang, pz + cote * l * 0.505);
                poser(l * 0.135, 0.047, 0.018, matFenetres, px + l * decalage, h * rang + 0.003, pz + cote * l * 0.51);
              }
              poser(0.018, 0.058, l * 0.38, matFenetres, px + cote * l * 0.51, h * rang, pz);
            }
          }
        };
        poser(0.83, 0.025, 0.83, matPierre, 0, 0.015, 0);
        for (const cote of [-1, 1]) {
          poser(0.9, 0.018, 0.035, teinte, 0, 0.028, cote * 0.44);
          poser(0.035, 0.018, 0.9, teinte, cote * 0.44, 0.028, 0);
        }

        if (terrain === 'ville') {
          // Deux maisons et leur passage plutôt qu'une collection de tours cubes.
          const places: [number, number, number][] = [[-0.2, -0.12, 0.31], [0.19, 0.12, 0.27]];
          places.forEach(([px, pz, l], i) => {
            const h = 0.32 + alea(x, y, 300 + i) * 0.16;
            poser(l, h, l, matBeton, px, h / 2 + 0.02, pz);
            poser(l * 1.05, 0.045, l * 1.05, matPierre, px, 0.045, pz);
            fenetres(px, pz, l, h);
            toiture(px, h + 0.035, pz, l, l);
            // Porche, auvent de nation et cheminée coiffée.
            poser(0.065, 0.11, 0.014, matMetal, px, 0.078, pz + l / 2 + 0.008);
            poser(0.15, 0.028, 0.09, teinte, px, 0.16, pz + l / 2 + 0.035);
            poser(0.12, 0.025, 0.07, matIvoire, px, 0.035, pz + l / 2 + 0.035);
            poser(0.045, 0.13, 0.05, matPierre, px + l * 0.23, h + 0.1, pz - l * 0.15);
            poser(0.06, 0.018, 0.064, matToit, px + l * 0.23, h + 0.17, pz - l * 0.15);
          });
          // Jardin / banquette laisse libre le centre occupable.
          poser(0.17, 0.055, 0.075, matToit, -0.18, 0.05, 0.3);
          poser(0.16, 0.018, 0.03, teinte, -0.18, 0.09, 0.33);
        } else if (terrain === 'qg') {
          poser(0.68, 0.075, 0.66, matPierre, 0, 0.055, 0);
          poser(0.59, 0.27, 0.55, matBeton, 0, 0.22, 0);
          poser(0.64, 0.045, 0.6, teinte, 0, 0.37, 0);
          poser(0.36, 0.23, 0.34, matBeton, 0, 0.49, -0.045);
          poser(0.39, 0.095, 0.36, matFenetres, 0, 0.52, -0.045);
          poser(0.44, 0.04, 0.4, matIvoire, 0, 0.63, -0.045);
          for (const cote of [-1, 1]) {
            poser(0.055, 0.28, 0.055, matIvoire, cote * 0.24, 0.22, 0.29);
            poser(0.12, 0.11, 0.016, matFenetres, cote * 0.18, 0.22, 0.282);
            poser(0.085, 0.025, 0.16, matPierre, cote * 0.105, 0.032, 0.37);
          }
          poser(0.105, 0.18, 0.02, matMetal, 0, 0.17, 0.282);
          poser(0.2, 0.032, 0.12, teinte, 0, 0.315, 0.3);
          // Pavillon lisible à distance, mât et hampe en métal.
          cylindre(0.012, 0.39, matMetal, 0.15, 0.825, -0.1);
          poser(0.23, 0.13, 0.012, teinte, 0.26, 0.94, -0.1);
          poser(0.06, 0.035, 0.016, matIvoire, 0.23, 0.94, -0.1);
          cylindre(0.027, 0.022, matIvoire, 0.15, 1.03, -0.1);
        } else if (terrain === 'usine') {
          poser(0.66, 0.28, 0.52, matBeton, 0, 0.17, 0.025);
          // Toit industriel à deux sheds, bandeaux de lumière et poutres.
          for (const cote of [-1, 1]) {
            poser(0.36, 0.035, 0.58, matToit, cote * 0.16, 0.35, 0.025, -0.23);
            poser(0.026, 0.065, 0.48, matFenetres, cote * 0.16 + 0.165, 0.34, 0.025);
            poser(0.045, 0.29, 0.03, teinte, cote * 0.28, 0.17, 0.3);
          }
          poser(0.39, 0.21, 0.022, matMetal, 0, 0.15, 0.3);
          for (let i = 0; i < 4; i += 1) poser(0.36, 0.01, 0.025, matPierre, 0, 0.065 + i * 0.048, 0.316);
          poser(0.5, 0.045, 0.075, teinte, 0, 0.285, 0.31);
          for (const px of [-0.22, 0.22]) poser(0.04, 0.08, 0.04, matIvoire, px, 0.055, 0.37);
          cylindre(0.055, 0.52, matPierre, -0.26, 0.37, -0.22);
          cylindre(0.064, 0.055, teinte, -0.26, 0.54, -0.22);
          cylindre(0.064, 0.024, matMetal, -0.26, 0.643, -0.22);
          cylindre(0.066, 0.17, matMetal, 0.3, 0.12, -0.23);
        } else {
          poser(0.21, 0.39, 0.21, matBeton, -0.26, 0.22, -0.21);
          poser(0.29, 0.1, 0.28, matFenetres, -0.26, 0.43, -0.21);
          poser(0.33, 0.035, 0.32, teinte, -0.26, 0.505, -0.21);
          cylindre(0.008, 0.18, matMetal, -0.26, 0.6, -0.21);
          poser(0.14, 0.025, 0.025, matIvoire, -0.26, 0.65, -0.21);
          poser(0.5, 0.17, 0.25, matBeton, 0.09, 0.11, 0.17);
          poser(0.45, 0.075, 0.02, matFenetres, 0.09, 0.135, 0.302);
          poser(0.56, 0.035, 0.31, teinte, 0.09, 0.215, 0.17);
          poser(0.53, 0.013, 0.14, matMetal, 0.12, 0.037, -0.19);
          for (let i = 0; i < 4; i += 1) poser(0.065, 0.004, 0.015, matIvoire, -0.07 + i * 0.12, 0.046, -0.19);
        }
        fusionnerCase(groupeCase);
        batiments.add(groupeCase);
      }
    }
  }

  let signature = '';
  let oscillation = 0.12;
  let souffle = 0;

  function majProprietaires(e: EtatPartie, visibles: ReadonlySet<string> | null = null): void {
    const cle = JSON.stringify(e.proprietaires);
    if (cle !== signature) {
      signature = cle;
      construireBatiments(e);
    }
    // En occupation, le bâtiment devient une maquette basse : ses toits et son
    // périmètre restent reconnaissables, mais la figurine dépasse clairement.
    // Une unité cachée ne doit jamais être révélée par le décor qui s'abaisse.
    const occupees = new Set(e.unites.filter((u) => !u.dansTransport
      && (!visibles || visibles.has(cleCase(u)))).map((u) => cleCase(u)));
    for (const batiment of batiments.children) {
      batiment.scale.y = occupees.has(String(batiment.userData['case'])) ? 0.12 : 1;
    }
  }

  majProprietaires(etat);
  poserArbres(0);

  return {
    groupe,
    majProprietaires,

    appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void {
      const f = FEUILLAGE[saison];
      const neige = p.neigeSol;
      matConifere.color.set(biome === 'neige' ? 0x47695f : f.conifere).lerp(new THREE.Color(0xffffff), neige * 0.55);
      matFeuillu.color.set(tropical ? 0x3e995c : f.feuillu).lerp(new THREE.Color(0xffffff), neige * 0.6);
      // Au printemps, les feuillus fleurissent : un soupçon de rose sur le vert.
      if (saison === 'printemps') matFeuillu.color.lerp(new THREE.Color(0xf3c6d8), 0.16);
      matTronc.color.set(0x6b4a2f).lerp(new THREE.Color(0xd8dde4), neige * 0.25);
      matRocher.color.set(0x8c929b).lerp(new THREE.Color(0xffffff), neige * 0.5);
      matBeton.color.set(couleurMur).lerp(new THREE.Color(p.teinteSol), 0.25);
      // Un toit d'ardoise ou de tôle blanchit sous la neige comme le reste.
      matToit.color.set(couleurToit).lerp(new THREE.Color(0xffffff), neige * 0.45);
      matFenetres.emissiveIntensity = p.fenetres;
      oscillation = p.oscillation;
      // L'hiver dénude les feuillus : on les rétrécit plutôt que de les cacher.
      if (saison !== saisonCourante) {
        saisonCourante = saison;
        poserArbres(souffle);
      }
    },

    majRelief(): void {
      poserArbres(souffle);
      poserRochers();
    },

    avancer(ms: number): boolean {
      if (oscillation < 0.3) return false;
      souffle += ms / 320;
      poserArbres(souffle);
      return true;
    },

    dispose(): void {
      geoTronc.dispose();
      geoConifere.dispose();
      geoFeuillu.dispose();
      for (const geo of geosRocher) geo.dispose();
      for (const g2 of geosBatiment) g2.dispose();
      for (const g2 of primitives.values()) g2.dispose();
      matTronc.dispose();
      matConifere.dispose();
      matFeuillu.dispose();
      matRocher.dispose();
      matBeton.dispose();
      matToit.dispose();
      matFenetres.dispose();
      matPierre.dispose();
      matMetal.dispose();
      matIvoire.dispose();
      for (const m of matsCamp.values()) m.dispose();
    },
  };
}
