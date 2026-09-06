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
 *
 * Chaque bâtiment porte un **mât**. C'est là, et nulle part ailleurs, que les
 * couleurs d'un camp se hissent et s'amènent : une capture se lit au drapeau,
 * jamais sur la ville elle-même, qui ne se déforme ni ne s'aplatit.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { type StyleRegion } from '../assets/spec';
import { styleRegionParMecanique } from '../assets/styles';
import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, SEUIL_CAPTURE, seuilCapture } from '../engine/index';
import { paletteDe } from '../render/palettes';
import type { Biome, CampId, Case, CleTerrain, Saison } from '../schemas/types';
import type { ParametresAmbiance } from './eclairage';
import { alea, CASE, type GrilleTerrain } from './geometrie';
import { creerPaysage } from './paysage';
import { jeuToit, sorteToit, type SorteToit } from './textures';

/** Couleurs de feuillage par saison : c'est la saison qu'on voit d'abord. */
const FEUILLAGE: Readonly<Record<Saison, { conifere: number; feuillu: number }>> = {
  printemps: { conifere: 0x3f8a4a, feuillu: 0x74bf5c },
  ete: { conifere: 0x2f7a3d, feuillu: 0x4e9a3c },
  automne: { conifere: 0x4a7a44, feuillu: 0xc9782a },
  hiver: { conifere: 0x4c6a58, feuillu: 0x9aa79c },
};

/** Les terrains qui portent un bâtiment, donc un mât. */
const TERRAINS_BATIS: readonly CleTerrain[] = ['ville', 'qg', 'usine', 'aeroport', 'radar'];

/** Hauteur du mât d'un bâtiment ordinaire, en cases. */
const HAUT_MAT = 0.5;

/** Le QG hisse plus haut : c'est le drapeau qu'on doit lire de loin. */
const HAUT_MAT_QG = 0.7;

/** Largeur et hauteur du drapeau : une douzaine de pixels à 48 px la case. */
const LARG_DRAPEAU = 0.24;
const HAUT_DRAPEAU = 0.15;

/** Hauteur du centre du drapeau amené, juste au-dessus du socle. */
const PIED_DRAPEAU = 0.1;

/** Épaisseur du socle et de son liseré : le mât se plante dessus, pas dedans. */
const SOCLE = 0.03;

/**
 * Où le mât se plante dans la case : l'angle avant gauche, seul coin qu'aucune
 * des quatre silhouettes n'occupe, et devant le bâtiment vu de la caméra.
 */
const DECALAGE_MAT = { x: -0.36, z: 0.37 } as const;

/** Opacité d'un bâtiment occupé : on voit la figurine au travers, et la ville entière. */
const OPACITE_FANTOME = 0.4;

/** Couleur des planches d'un chantier : bois brut, ni peint ni brûlé. */
export const COULEUR_PLANCHE = 0x9a7a52;

/** Distance du centre de la case à la palissade : là où passait le liseré de camp. */
export const RAYON_PALISSADE = 0.43;

/** Une planche ou un poteau de palissade, dans le repère d'un côté : x le long, y en haut, z vers l'extérieur. */
export interface PiecePalissade {
  l: number;
  h: number;
  p: number;
  x: number;
  y: number;
}

/**
 * Un côté de palissade : trois poteaux, deux lisses. Les quatre côtés sont ce
 * qui dit « chantier » de loin — un bâtiment désaffecté n'est pas détruit, il
 * est fermé en attendant qu'on le remette en service.
 */
export const PIECES_PALISSADE: readonly PiecePalissade[] = [
  { l: 0.03, h: 0.2, p: 0.03, x: -0.33, y: 0.1 },
  { l: 0.03, h: 0.2, p: 0.03, x: 0, y: 0.1 },
  { l: 0.03, h: 0.2, p: 0.03, x: 0.33, y: 0.1 },
  { l: 0.86, h: 0.045, p: 0.012, x: 0, y: 0.075 },
  { l: 0.86, h: 0.045, p: 0.012, x: 0, y: 0.155 },
];

/**
 * Répétitions du motif de couverture par case : six rangs de tuiles par motif,
 * donc vingt-quatre rangs la case — deux pixels le rang à 48 px par case, où
 * seul le grain se lit ; un rang se distingue dès le premier palier de zoom.
 */
export const REPETITIONS_TOIT = 4;

/**
 * Ce en quoi une couverture est faite, par sorte : la tuile est rêche, l'ardoise
 * un peu moins, la tôle peinte accroche la lumière et garde un rien de métal.
 */
const APPARENCE_TOIT: Readonly<Record<SorteToit, { rugosite: number; metal: number }>> = {
  tuile: { rugosite: 0.86, metal: 0 },
  ardoise: { rugosite: 0.72, metal: 0.02 },
  tole: { rugosite: 0.55, metal: 0.25 },
};

/**
 * Cartographie un pan de toit **à l'échelle du monde** plutôt qu'à celle de sa
 * face. Une boîte porte des UV de 0 à 1 par face : la couverture d'un pan de
 * maison (0,18 case) y serait deux fois plus serrée que sur un shed d'usine
 * (0,36), et une tranche de trois centièmes en porterait autant qu'un pan
 * entier. La projection se fait par boîte, sur l'axe dominant de la normale :
 * pour un pan, `u` court en x et `v` en z. Le motif descend la pente le long de
 * `u` — les rangs se recouvrent vers l'égout —, donc un pan qui regarde −X est
 * retourné en `u`, sans quoi ses tuiles se recouvriraient à l'envers. Les
 * tranches, minces, prennent ce qui vient.
 */
export function cartographierToit(geo: THREE.BufferGeometry, repetitions = REPETITIONS_TOIT): THREE.BufferGeometry {
  const position = geo.getAttribute('position');
  const normale = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < position.count; i += 1) {
    const nx = normale.getX(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(normale.getY(i));
    const az = Math.abs(normale.getZ(i));
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, (nx < -1e-6 ? -x : x) * repetitions, z * repetitions);
    else if (ax >= az) uv.setXY(i, y * repetitions, z * repetitions);
    else uv.setXY(i, x * repetitions, y * repetitions);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Pleine lueur des vitrages qui se rallument, au-dessus de l'ambiance la plus nocturne. */
const LUEUR_PLEINE = 1.1;

/** Vitesse de balayage d'une parabole de station radar, en radians par seconde : lent, on doit le remarquer sans le regarder. */
const BALAYAGE_RADAR = 0.45;

/** Une parabole de station : le pivot qu'on fait tourner, et si elle balaie. */
interface Parabole {
  pivot: THREE.Group;
  /** Une station tenue balaie ; neutre ou désaffectée, elle est à l'arrêt. */
  active: boolean;
}

/** Ce qu'un pavillon montre : des couleurs, et une hauteur sur le mât. */
export interface PoseDrapeau {
  camp: CampId | null;
  /** 0 au pied du mât, 1 au sommet. */
  niveau: number;
}

/**
 * La pose d'un pavillon d'après l'état. Une capture en cours **amène** les
 * couleurs du propriétaire à proportion des points pris ; sur un bâtiment
 * neutre, elle **hisse** celles du camp qui capture. Un mât neutre et tranquille
 * reste nu : un drapeau gris se disputerait l'œil avec les couleurs de camp.
 */
export function poseDrapeau(
  proprio: CampId | null, capture: { camp: CampId; points: number } | null, seuil: number,
): PoseDrapeau {
  const part = capture && capture.camp !== proprio
    ? Math.min(1, Math.max(0, capture.points / seuil)) : 0;
  if (proprio === null) {
    return capture && part > 0 ? { camp: capture.camp, niveau: part } : { camp: null, niveau: 0 };
  }
  return { camp: proprio, niveau: 1 - part };
}

/** La prise d'un drapeau : ce qu'une animation peut en faire, le temps d'un geste. */
export interface PriseDrapeau {
  /** Le seuil de capture du bâtiment : ce qui fait un drapeau entier. */
  readonly seuil: number;
  /** Le sommet du mât en coordonnées monde, lu sur le relief du moment. */
  readonly sommet: THREE.Vector3;
  /** Le pied du mât, là où se pose un anneau de progression. */
  readonly pied: THREE.Vector3;
  /** Impose au drapeau un camp et une hauteur, par-dessus ce que dit l'état. */
  forcer(camp: CampId | null, niveau: number): void;
  /** Rend le drapeau à ce que dit l'état. */
  relacher(): void;
}

/** Ce qu'une animation de remise en service peut faire d'un bâtiment. */
export interface PriseChantier {
  /** Fait luire les vitrages par-dessus l'ambiance : 0 éteint, 1 pleine lueur. */
  eclairer(lueur: number): void;
  /** Rend les vitrages à l'ambiance. */
  relacher(): void;
}

/** Un mât et son drapeau, sur une case bâtie. */
interface Pavillon {
  cle: string;
  case: Case;
  cx: number;
  cz: number;
  hauteurMat: number;
  /**
   * Le seuil du moment : un QG ou un bâtiment désaffecté en demande le double,
   * et un bâtiment peut se désaffecter en cours de partie. Relu à chaque `maj`
   * quand le catalogue est fourni ; sinon le seuil de base.
   */
  seuil: number;
  /** Ce que dit l'état. */
  pose: PoseDrapeau;
  /** Ce qu'impose une animation en cours, s'il y en a une. */
  force: PoseDrapeau | null;
}

/** Ce que `creerDecor` rend au rendu. */
export interface Decor {
  readonly groupe: THREE.Group;
  /**
   * Reconstruit les bâtiments quand un propriétaire change, efface en
   * transparence ceux qu'une unité occupe, et règle les pavillons : une capture
   * en cours se lit à la hauteur du drapeau.
   */
  majProprietaires(etat: EtatPartie, visibles?: ReadonlySet<string> | null, cat?: Catalogue | null): void;
  appliquerAmbiance(p: ParametresAmbiance, saison: Saison): void;
  /**
   * Fait osciller les arbres et flotter les drapeaux. Rend vrai tant qu'il faut
   * redessiner. Le flottement s'arrête si le système demande moins de mouvement,
   * comme la respiration des figurines.
   */
  avancer(ms: number, mouvementReduit?: boolean): boolean;
  /** La prise du drapeau d'une case bâtie, `null` si la case n'en porte pas. */
  drapeau(cle: string): PriseDrapeau | null;
  /** La prise des vitrages d'une case bâtie, pour les rallumer à la remise en service. */
  chantier(cle: string): PriseChantier | null;
  /**
   * Repose le décor sur le relief. Arbres et rochers sont placés une fois pour
   * toutes au montage, et les arbres ne se replacent ensuite que par grand vent :
   * quand une marée fait descendre le sol, ils restaient suspendus au-dessus du
   * vide. À appeler après toute mutation du terrain.
   */
  majRelief(): void;
  /**
   * Change de grille : ressème arbres et rochers, replante les mâts, refait le
   * paysage et rebâtit les bâtiments au prochain `majProprietaires`. C'est le cas
   * du génie qui pose du terrain, d'une marée qui découvre une berge, et de
   * l'atelier qui change de carte. Le décor lisait la grille capturée au
   * montage — le gel noté dans `CLAUDE.md` avait fini par mordre.
   */
  majGrille(grille: GrilleTerrain): void;
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
  // La grille courante : `majGrille` la remplace, et tout ce qui en dérive —
  // semis, mâts, bâtiments — repart d'elle. Rien ne lit `g` après cette ligne.
  let grille: GrilleTerrain = g;

  // --- Arbres
  let arbres = semerArbres(grille, biome);
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

  // Un lot instancié a une capacité fixe : quand le semis change, on le rebâtit
  // à la taille du nouveau semis plutôt que de le surdimensionner à l'aveugle.
  let troncs!: THREE.InstancedMesh;
  let coniferes!: THREE.InstancedMesh;
  let feuillus!: THREE.InstancedMesh;

  function batirArbres(): void {
    for (const m of [troncs, coniferes, feuillus]) {
      if (!m) continue;
      groupe.remove(m);
      m.dispose();
    }
    troncs = new THREE.InstancedMesh(geoTronc, matTronc, Math.max(1, arbres.length));
    coniferes = new THREE.InstancedMesh(
      geoConifere, matConifere, Math.max(1, arbres.filter((a) => a.conifere).length),
    );
    feuillus = new THREE.InstancedMesh(
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
  }
  batirArbres();

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
  let rochers = semerRochers(grille);
  // Trois lots : un appel de dessin par silhouette, et non un par pierre.
  const geosRocher = [
    eroder(new THREE.IcosahedronGeometry(0.17, 0), 900, 0.085),
    eroder(new THREE.IcosahedronGeometry(0.15, 0), 901, 0.06),
    eroder(new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.42, 0.86), 902, 0.05),
  ];
  const matRocher = new THREE.MeshStandardMaterial({ color: 0x9c9a90, roughness: 0.96, flatShading: true });
  let lotsRocher: THREE.InstancedMesh[] = [];

  function batirRochers(): void {
    for (const lot of lotsRocher) {
      groupe.remove(lot);
      lot.dispose();
    }
    lotsRocher = geosRocher.map((geo, v) => {
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
  }
  batirRochers();
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

  // --- Paysage : les accessoires du biome et la ligne de rivage (`paysage.ts`).
  //     Il lit `hauteurEn` à chaque pose, comme les arbres : rien n'y est gelé.
  let paysage = creerPaysage(grille, hauteurEn, biome);
  groupe.add(paysage.groupe);
  /** La dernière ambiance appliquée, pour la redonner à un paysage refait. */
  let ambianceCourante: { p: ParametresAmbiance; saison: Saison } | null = null;

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
  // La couverture : un micro-relief synthétisé comme celui du sol, choisi
  // d'après la matière du style régional — tuile, ardoise, tôle ondulée —, un
  // seul jeu de textures pour toute la carte. L'albédo est un facteur discret
  // de la couleur du style : elle reste au matériau, qui la blanchit sous la neige.
  const toitures = jeuToit(sorteToit(styleRegion?.toits.matiere));
  const apparenceToit = APPARENCE_TOIT[toitures.sorte];
  const matBeton = new THREE.MeshStandardMaterial({ color: couleurMur, roughness: 0.9 });
  const matToit = new THREE.MeshStandardMaterial({
    color: couleurToit, roughness: apparenceToit.rugosite, metalness: apparenceToit.metal,
    map: toitures.albedo, normalMap: toitures.normales,
  });
  const matPierre = new THREE.MeshStandardMaterial({ color: 0xbbb9aa, roughness: 0.92 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x465560, roughness: 0.52, metalness: 0.38 });
  const matIvoire = new THREE.MeshStandardMaterial({ color: 0xeae5d4, roughness: 0.82 });
  // Un bâtiment désaffecté garde ses murs et ses toits, ternis ; ses vitrages
  // ne s'allument jamais, et une palissade de chantier le ferme. Rien n'y est
  // noirci ni effondré : il est hors service, pas détruit.
  const matBetonTerni = new THREE.MeshStandardMaterial({ color: couleurMur, roughness: 0.97 });
  const matToitTerni = new THREE.MeshStandardMaterial({
    color: couleurToit, roughness: Math.min(1, apparenceToit.rugosite + 0.12), metalness: apparenceToit.metal * 0.5,
    map: toitures.albedo, normalMap: toitures.normales,
  });
  const matVitresEteintes = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.7 });
  const matPlanche = new THREE.MeshStandardMaterial({ color: COULEUR_PLANCHE, roughness: 0.96 });
  // La parabole est une calotte creuse : vue de l'ouverture, une face simple
  // disparaîtrait à chaque demi-tour de balayage.
  const matParabole = new THREE.MeshStandardMaterial({ color: 0xeae5d4, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
  const paraboles: Parabole[] = [];
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
      // Un pan de toit prend sa couverture à l'échelle du monde, le motif
      // descendant la pente, quelle que soit la taille du pan.
      if (enfant.material === matToit || enfant.material === matToitTerni) cartographierToit(geo);
      const lot = lots.get(enfant.material) ?? [];
      lot.push(geo);
      lots.set(enfant.material, lot);
    }
    // Ce qui n'est pas une maille — la parabole d'une station, qui doit
    // pouvoir tourner seule — survit à la fusion tel quel.
    const gardes = caseDecor.children.filter((c) => !(c instanceof THREE.Mesh));
    caseDecor.clear();
    for (const garde of gardes) caseDecor.add(garde);
    for (const [mat, lot] of lots) {
      const geo = mergeGeometries(lot)!;
      lot.forEach((g2) => g2.dispose());
      geosBatiment.add(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = mat === matFenetres ? 'vitrages' : mat === matToit || mat === matToitTerni ? 'toiture' : 'architecture';
      mesh.castShadow = mat !== matFenetres;
      mesh.receiveShadow = true;
      // L'occupation échange le matériau contre son jumeau translucide ; il faut
      // pouvoir retrouver l'original quand l'unité repart.
      mesh.userData['opaque'] = mat;
      caseDecor.add(mesh);
    }
  }

  function construireBatiments(e: EtatPartie): void {
    batiments.clear();
    for (const geo of geosBatiment) geo.dispose();
    geosBatiment.clear();
    paraboles.length = 0;
    for (let y = 0; y < grille.hauteur; y += 1) {
      for (let x = 0; x < grille.largeur; x += 1) {
        const terrain = grille.terrainDe(x, y);
        if (!TERRAINS_BATIS.includes(terrain)) continue;
        const proprio = e.proprietaires[cleCase({ x, y })] ?? null;
        const desaffecte = e.desaffectes.includes(cleCase({ x, y }));
        const cx = x * CASE + CASE / 2;
        const cz = y * CASE + CASE / 2;
        const groupeCase = new THREE.Group();
        groupeCase.position.set(cx, hauteurEn(cx, cz), cz);
        groupeCase.userData['case'] = cleCase({ x, y });
        groupeCase.userData['type'] = terrain;
        groupeCase.userData['desaffecte'] = desaffecte;
        // Désaffecté : pas de couleur de camp, il n'a pas de camp. La pierre
        // reprend les accents plutôt qu'un gris de plus, qui coûterait un lot.
        const teinte = desaffecte ? matPierre : matCamp(proprio);
        const mur = desaffecte ? matBetonTerni : matBeton;
        const toit = desaffecte ? matToitTerni : matToit;
        const vitre = desaffecte ? matVitresEteintes : matFenetres;
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
          for (const cote of [-1, 1]) poser(l * 0.57, 0.032, p * 1.12, toit,
            px + cote * l * 0.24, py + l * 0.12, pz, -cote * 0.43);
          poser(0.032, 0.032, p * 1.15, matMetal, px, py + l * 0.24, pz);
        };
        // Une toiture manquante : la charpente à nu, en attente de couverture.
        const charpente = (px: number, py: number, pz: number, l: number, p: number): void => {
          for (const k of [-0.36, -0.12, 0.12, 0.36]) {
            poser(0.02, 0.018, p * 1.05, matPlanche, px + k * l, py + l * 0.24 - Math.abs(k) * l * 0.5, pz);
          }
          poser(0.02, 0.02, p * 1.1, matPlanche, px, py + l * 0.25, pz);
        };
        // Les planches clouées en croix sur une porte : c'est fermé.
        const condamner = (px: number, py: number, pz: number): void => {
          for (const rz of [0.55, -0.55]) poser(0.19, 0.028, 0.012, matPlanche, px, py, pz, rz);
        };
        const palissade = (): void => {
          for (let k = 0; k < 4; k += 1) {
            const a = k * Math.PI / 2;
            for (const piece of PIECES_PALISSADE) {
              const m = bloc(piece.l, piece.h, piece.p, matPlanche);
              // Le repère du côté tourne avec lui : x reste le long de la lisse.
              m.position.set(
                Math.cos(a) * piece.x + Math.sin(a) * RAYON_PALISSADE, piece.y,
                -Math.sin(a) * piece.x + Math.cos(a) * RAYON_PALISSADE,
              );
              m.rotation.y = a;
              groupeCase.add(m);
            }
          }
        };
        const fenetres = (px: number, pz: number, l: number, h: number): void => {
          for (const cote of [-1, 1]) {
            for (const rang of [0.43, 0.75]) {
              // Deux fenêtres distinctes par façade, enchâssées dans une pierre claire.
              for (const decalage of [-0.23, 0.23]) {
                poser(l * 0.2, 0.064, 0.014, matIvoire, px + l * decalage, h * rang, pz + cote * l * 0.505);
                poser(l * 0.135, 0.047, 0.018, vitre, px + l * decalage, h * rang + 0.003, pz + cote * l * 0.51);
              }
              poser(0.018, 0.058, l * 0.38, vitre, px + cote * l * 0.51, h * rang, pz);
            }
          }
        };
        poser(0.83, 0.025, 0.83, matPierre, 0, 0.015, 0);
        if (desaffecte) {
          palissade();
        } else {
          for (const cote of [-1, 1]) {
            poser(0.9, 0.018, 0.035, teinte, 0, 0.028, cote * 0.44);
            poser(0.035, 0.018, 0.9, teinte, cote * 0.44, 0.028, 0);
          }
        }

        if (terrain === 'ville') {
          // Deux maisons et leur passage plutôt qu'une collection de tours cubes.
          const places: [number, number, number][] = [[-0.2, -0.12, 0.31], [0.19, 0.12, 0.27]];
          places.forEach(([px, pz, l], i) => {
            const h = 0.32 + alea(x, y, 300 + i) * 0.16;
            poser(l, h, l, mur, px, h / 2 + 0.02, pz);
            poser(l * 1.05, 0.045, l * 1.05, matPierre, px, 0.045, pz);
            fenetres(px, pz, l, h);
            // Désaffectée, la seconde maison a perdu sa couverture.
            if (desaffecte && i === 1) charpente(px, h + 0.035, pz, l, l);
            else toiture(px, h + 0.035, pz, l, l);
            // Porche, auvent de nation et cheminée coiffée.
            poser(0.065, 0.11, 0.014, matMetal, px, 0.078, pz + l / 2 + 0.008);
            if (desaffecte) condamner(px, 0.085, pz + l / 2 + 0.02);
            poser(0.15, 0.028, 0.09, teinte, px, 0.16, pz + l / 2 + 0.035);
            poser(0.12, 0.025, 0.07, matIvoire, px, 0.035, pz + l / 2 + 0.035);
            poser(0.045, 0.13, 0.05, matPierre, px + l * 0.23, h + 0.1, pz - l * 0.15);
            poser(0.06, 0.018, 0.064, toit, px + l * 0.23, h + 0.17, pz - l * 0.15);
          });
          // Jardin / banquette laisse libre le centre occupable.
          poser(0.17, 0.055, 0.075, toit, -0.18, 0.05, 0.3);
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
          // Le QG n'a plus son pavillon fusionné sur le toit : tous les
          // bâtiments portent un mât vivant, le sien est simplement plus haut.
        } else if (terrain === 'usine') {
          poser(0.66, 0.28, 0.52, mur, 0, 0.17, 0.025);
          // Toit industriel à deux sheds, bandeaux de lumière et poutres.
          for (const cote of [-1, 1]) {
            // Désaffectée, l'usine a perdu un shed : il n'en reste que les pannes.
            if (desaffecte && cote === 1) {
              for (const k of [-0.12, 0, 0.12]) poser(0.02, 0.02, 0.56, matPlanche, cote * 0.16 + k, 0.35 - k * 0.23, 0.025);
            } else {
              poser(0.36, 0.035, 0.58, toit, cote * 0.16, 0.35, 0.025, -0.23);
            }
            poser(0.026, 0.065, 0.48, vitre, cote * 0.16 + 0.165, 0.34, 0.025);
            poser(0.045, 0.29, 0.03, teinte, cote * 0.28, 0.17, 0.3);
          }
          if (desaffecte) condamner(0, 0.15, 0.315);
          poser(0.39, 0.21, 0.022, matMetal, 0, 0.15, 0.3);
          for (let i = 0; i < 4; i += 1) poser(0.36, 0.01, 0.025, matPierre, 0, 0.065 + i * 0.048, 0.316);
          poser(0.5, 0.045, 0.075, teinte, 0, 0.285, 0.31);
          for (const px of [-0.22, 0.22]) poser(0.04, 0.08, 0.04, matIvoire, px, 0.055, 0.37);
          cylindre(0.055, 0.52, matPierre, -0.26, 0.37, -0.22);
          cylindre(0.064, 0.055, teinte, -0.26, 0.54, -0.22);
          cylindre(0.064, 0.024, matMetal, -0.26, 0.643, -0.22);
          cylindre(0.066, 0.17, matMetal, 0.3, 0.12, -0.23);
        } else if (terrain === 'radar') {
          // Une station : un local technique bas à gauche, une tour en treillis
          // à droite portant la parabole, et le centre libre pour l'unité.
          poser(0.32, 0.2, 0.26, mur, -0.22, 0.12, -0.22);
          poser(0.28, 0.05, 0.016, vitre, -0.22, 0.15, -0.085);
          poser(0.32, 0.03, 0.27, toit, -0.22, 0.235, -0.225);
          poser(0.28, 0.02, 0.05, teinte, -0.22, 0.26, -0.11);
          poser(0.065, 0.11, 0.014, matMetal, -0.22, 0.075, -0.082);
          if (desaffecte) condamner(-0.22, 0.085, -0.07);
          // La petite antenne du local, coiffée aux couleurs du camp.
          cylindre(0.006, 0.22, matMetal, -0.3, 0.36, -0.28);
          cylindre(0.016, 0.02, teinte, -0.3, 0.475, -0.28);
          // La tour : quatre montants, trois ceintures, une plate-forme.
          const tx = 0.24;
          const tz = -0.22;
          for (const dx of [-0.07, 0.07]) {
            for (const dz of [-0.07, 0.07]) cylindre(0.011, 0.44, matMetal, tx + dx, 0.24, tz + dz);
          }
          for (const niveau of [0.14, 0.28, 0.42]) {
            poser(0.16, 0.012, 0.012, matMetal, tx, niveau, tz - 0.07);
            poser(0.16, 0.012, 0.012, matMetal, tx, niveau, tz + 0.07);
            poser(0.012, 0.012, 0.16, matMetal, tx - 0.07, niveau, tz);
            poser(0.012, 0.012, 0.16, matMetal, tx + 0.07, niveau, tz);
          }
          poser(0.22, 0.02, 0.22, matMetal, tx, 0.465, tz);
          poser(0.24, 0.014, 0.014, teinte, tx, 0.5, tz - 0.115);
          poser(0.24, 0.014, 0.014, teinte, tx, 0.5, tz + 0.115);
          poser(0.045, 0.06, 0.045, matIvoire, tx, 0.5, tz);
          // La parabole, sur son pivot : elle n'est pas fondue avec le reste,
          // c'est elle qui balaie.
          const pivot = new THREE.Group();
          pivot.name = 'parabole';
          pivot.position.set(tx, 0.56, tz);
          pivot.rotation.y = alea(x, y, 400) * Math.PI * 2;
          const calotte = new THREE.Mesh(
            primitive('calotte', () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3)),
            matParabole,
          );
          calotte.scale.setScalar(0.17);
          // Le creux regarde l'horizon, un peu vers le ciel.
          calotte.rotation.x = Math.PI / 2 - 0.35;
          calotte.position.set(0, 0.04, -0.06);
          const bras = new THREE.Mesh(primitive('cylindre', () => new THREE.CylinderGeometry(1, 1, 1, 10)), matMetal);
          bras.scale.set(0.008, 0.16, 0.008);
          bras.rotation.x = -0.4;
          bras.position.set(0, 0.06, 0.05);
          const cornet = new THREE.Mesh(primitive('cube', () => new THREE.BoxGeometry(1, 1, 1)), teinte);
          cornet.scale.set(0.03, 0.03, 0.03);
          cornet.position.set(0, 0.13, 0.11);
          for (const m of [calotte, bras, cornet]) {
            m.castShadow = true;
            m.userData['opaque'] = m.material;
            pivot.add(m);
          }
          if (desaffecte) {
            // Désaffectée, la parabole a basculé et pend de travers : elle
            // n'est pas tombée du haut de la tour, elle attend qu'on la règle.
            pivot.rotation.x = 0.85;
            pivot.rotation.z = 0.3;
          }
          groupeCase.add(pivot);
          paraboles.push({ pivot, active: proprio !== null && !desaffecte });
        } else {
          poser(0.21, 0.39, 0.21, mur, -0.26, 0.22, -0.21);
          poser(0.29, 0.1, 0.28, vitre, -0.26, 0.43, -0.21);
          // Désaffectée, la tour a perdu sa coiffe et son antenne.
          if (desaffecte) {
            for (const k of [-0.1, 0.1]) poser(0.02, 0.02, 0.3, matPlanche, -0.26 + k, 0.505, -0.21);
          } else {
            poser(0.33, 0.035, 0.32, teinte, -0.26, 0.505, -0.21);
            cylindre(0.008, 0.18, matMetal, -0.26, 0.6, -0.21);
            poser(0.14, 0.025, 0.025, matIvoire, -0.26, 0.65, -0.21);
          }
          poser(0.5, 0.17, 0.25, mur, 0.09, 0.11, 0.17);
          poser(0.45, 0.075, 0.02, vitre, 0.09, 0.135, 0.302);
          if (desaffecte) condamner(0.09, 0.1, 0.31);
          poser(0.56, 0.035, 0.31, teinte, 0.09, 0.215, 0.17);
          poser(0.53, 0.013, 0.14, matMetal, 0.12, 0.037, -0.19);
          for (let i = 0; i < 4; i += 1) poser(0.065, 0.004, 0.015, matIvoire, -0.07 + i * 0.12, 0.046, -0.19);
        }
        fusionnerCase(groupeCase);
        batiments.add(groupeCase);
      }
    }
  }

  // --- Fantômes
  // Un bâtiment occupé s'efface en transparence : sa silhouette reste entière
  // et la figurine se lit au travers. L'aplatir en maquette basse — ce qu'on
  // faisait — se lisait comme une ville écrasée par l'unité qui la prend.
  const matsFantome = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();

  function materiauFantome(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    let f = matsFantome.get(source);
    if (!f) {
      f = source.clone();
      f.transparent = true;
      f.opacity = OPACITE_FANTOME;
      // Sans écriture de profondeur, l'unité à l'intérieur reste nette : c'est
      // elle qu'on regarde, le bâtiment n'est plus qu'un repère.
      f.depthWrite = false;
      matsFantome.set(source, f);
    }
    return f;
  }

  // --- Pavillons
  // Trois lots instanciés — mâts, pommeaux, drapeaux — quel que soit le nombre
  // de bâtiments : trois appels de dessin, et la couleur par instance.
  const pavillons = new THREE.Group();
  pavillons.name = 'pavillons';
  groupe.add(pavillons);
  // Le tableau est stable : les prises rendues par `drapeau()` le cherchent par
  // clé, et une grille changée le vide et le remplit sur place.
  const places: Pavillon[] = [];

  function semerPavillons(): void {
    places.length = 0;
    for (let y = 0; y < grille.hauteur; y += 1) {
      for (let x = 0; x < grille.largeur; x += 1) {
        const terrain = grille.terrainDe(x, y);
        if (!TERRAINS_BATIS.includes(terrain)) continue;
        places.push({
          cle: cleCase({ x, y }),
          case: { x, y },
          cx: x * CASE + CASE / 2,
          cz: y * CASE + CASE / 2,
          hauteurMat: terrain === 'qg' ? HAUT_MAT_QG : HAUT_MAT,
          seuil: SEUIL_CAPTURE,
          pose: { camp: null, niveau: 0 },
          force: null,
        });
      }
    }
  }
  semerPavillons();
  // Le mât part de son pied : sa hauteur est une échelle, pas une géométrie.
  const geoMat = new THREE.CylinderGeometry(0.011, 0.015, 1, 6).translate(0, 0.5, 0);
  const geoPommeau = new THREE.SphereGeometry(0.022, 8, 6);
  // Le drapeau tient au mât par son bord gauche : c'est l'axe de son onde.
  const geoDrapeau = new THREE.PlaneGeometry(LARG_DRAPEAU, HAUT_DRAPEAU, 6, 2)
    .translate(LARG_DRAPEAU / 2, 0, 0);
  const drapeauPlat = Float32Array.from(geoDrapeau.getAttribute('position').array);
  const matDrapeau = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, side: THREE.DoubleSide });
  let mats!: THREE.InstancedMesh;
  let pommeaux!: THREE.InstancedMesh;
  let drapeaux!: THREE.InstancedMesh;

  function batirPavillons(): void {
    for (const lot of [mats, pommeaux, drapeaux]) {
      if (!lot) continue;
      pavillons.remove(lot);
      lot.dispose();
    }
    const totalPavillons = Math.max(1, places.length);
    mats = new THREE.InstancedMesh(geoMat, matMetal, totalPavillons);
    pommeaux = new THREE.InstancedMesh(geoPommeau, matIvoire, totalPavillons);
    drapeaux = new THREE.InstancedMesh(geoDrapeau, matDrapeau, totalPavillons);
    mats.name = 'mats';
    pommeaux.name = 'pommeaux';
    drapeaux.name = 'drapeaux';
    for (const lot of [mats, pommeaux, drapeaux]) {
      lot.castShadow = true;
      lot.frustumCulled = false;
      lot.count = places.length;
      pavillons.add(lot);
    }
  }
  batirPavillons();
  const couleurDrapeau = new THREE.Color();

  /** Le pied d'un mât : le sol est relu à chaque pose, une marée le déplace. */
  function piedDe(p: Pavillon): THREE.Vector3 {
    return new THREE.Vector3(p.cx + DECALAGE_MAT.x, hauteurEn(p.cx, p.cz) + SOCLE, p.cz + DECALAGE_MAT.z);
  }

  function poserPavillons(): void {
    quat.identity();
    places.forEach((p, i) => {
      const pied = piedDe(p);
      pos.copy(pied);
      ech.set(1, p.hauteurMat, 1);
      mat4.compose(pos, quat, ech);
      mats.setMatrixAt(i, mat4);
      pos.set(pied.x, pied.y + p.hauteurMat, pied.z);
      ech.set(1, 1, 1);
      mat4.compose(pos, quat, ech);
      pommeaux.setMatrixAt(i, mat4);
      const { camp, niveau } = p.force ?? p.pose;
      // Un drapeau sans camp n'est pas dessiné : une échelle nulle le retire
      // sans changer la taille du lot.
      const e = camp === null ? 0 : 1;
      const course = p.hauteurMat - PIED_DRAPEAU - HAUT_DRAPEAU / 2 - 0.02;
      pos.set(pied.x, pied.y + PIED_DRAPEAU + Math.min(1, Math.max(0, niveau)) * course, pied.z);
      ech.set(e, e, e);
      mat4.compose(pos, quat, ech);
      drapeaux.setMatrixAt(i, mat4);
      couleurDrapeau.set(paletteDe(camp).main);
      drapeaux.setColorAt(i, couleurDrapeau);
    });
    mats.instanceMatrix.needsUpdate = true;
    pommeaux.instanceMatrix.needsUpdate = true;
    drapeaux.instanceMatrix.needsUpdate = true;
    if (drapeaux.instanceColor) drapeaux.instanceColor.needsUpdate = true;
  }

  let vent = 0.7;

  /**
   * Fait onduler la toile : une onde qui part du mât, nulle à la hampe et
   * pleine au bord libre, dont l'ampleur suit le vent de l'ambiance. Par temps
   * calme, un drapeau pend et frémit à peine ; par tempête il claque.
   */
  function flotter(): void {
    const attr = geoDrapeau.getAttribute('position') as THREE.BufferAttribute;
    const ampleur = 0.012 + oscillation * 0.05;
    for (let i = 0; i < attr.count; i += 1) {
      const x0 = drapeauPlat[i * 3]!;
      const y0 = drapeauPlat[i * 3 + 1]!;
      const u = x0 / LARG_DRAPEAU;
      const onde = Math.sin(u * 5.2 - vent * 6.4) * u;
      attr.setXYZ(i, x0, y0 + onde * ampleur * 0.35 - u * u * 0.012, onde * ampleur);
    }
    attr.needsUpdate = true;
    geoDrapeau.computeVertexNormals();
  }

  let signature = '';
  let oscillation = 0.12;
  let souffle = 0;
  // Une première onde figée : même sans mouvement, un drapeau n'est pas une plaque.
  flotter();

  // --- Vitrages qui se rallument
  // La lueur imposée par une remise en service, par case, et le matériau qui
  // la porte : le vitrage partage son matériau avec toute la carte, on ne peut
  // pas l'allumer pour une seule ville sans lui en donner un à elle.
  const lueurs = new Map<string, number>();
  const matsLueur = new Map<string, { fantome: boolean; mat: THREE.MeshStandardMaterial }>();

  function materiauLueur(cle: string, fantome: boolean, lueur: number): THREE.MeshStandardMaterial {
    let entree = matsLueur.get(cle);
    if (!entree || entree.fantome !== fantome) {
      entree?.mat.dispose();
      entree = { fantome, mat: (fantome ? materiauFantome(matFenetres) : matFenetres).clone() };
      matsLueur.set(cle, entree);
    }
    entree.mat.emissiveIntensity = Math.max(matFenetres.emissiveIntensity, lueur * LUEUR_PLEINE);
    return entree.mat;
  }

  /** Les mailles d'un bâtiment : ses lots fondus, et celles de sa parabole. */
  function maillesDe(batiment: THREE.Object3D): THREE.Mesh[] {
    const mailles: THREE.Mesh[] = [];
    for (const c of batiment.children) {
      if (c instanceof THREE.Mesh) mailles.push(c);
      else for (const m of c.children) if (m instanceof THREE.Mesh) mailles.push(m);
    }
    return mailles;
  }

  function majProprietaires(
    e: EtatPartie, visibles: ReadonlySet<string> | null = null, cat: Catalogue | null = null,
  ): void {
    // La remise en service change l'aspect sans changer de propriétaire dans
    // le même événement : sans la liste des désaffectés dans la clé, la
    // palissade resterait à l'écran.
    const cle = JSON.stringify([e.proprietaires, e.desaffectes]);
    if (cle !== signature) {
      signature = cle;
      construireBatiments(e);
    }
    // Une unité cachée ne doit jamais être révélée par le décor : ni par un
    // bâtiment qui s'efface, ni par un drapeau qui descend.
    const occupants = new Map<string, Unite>();
    for (const u of e.unites) {
      if (!u.dansTransport && (!visibles || visibles.has(cleCase(u)))) occupants.set(cleCase(u), u);
    }
    for (const batiment of batiments.children) {
      const cleBat = String(batiment.userData['case']);
      const fantome = occupants.has(cleBat);
      const lueur = lueurs.get(cleBat);
      for (const m of maillesDe(batiment)) {
        const opaque = m.userData['opaque'] as THREE.MeshStandardMaterial;
        if (opaque === matFenetres && lueur !== undefined) m.material = materiauLueur(cleBat, fantome, lueur);
        else m.material = fantome ? materiauFantome(opaque) : opaque;
        // Un bâtiment qu'on voit au travers ne projette pas une ombre pleine
        // sur la figurine qu'il abrite.
        m.castShadow = !fantome && opaque !== matFenetres;
      }
    }
    for (const p of places) {
      const u = occupants.get(p.cle);
      if (cat) p.seuil = seuilCapture(e, cat, p.case);
      p.pose = poseDrapeau(
        e.proprietaires[p.cle] ?? null,
        u && u.pointsCapture > 0 ? { camp: u.camp, points: u.pointsCapture } : null,
        p.seuil,
      );
    }
    poserPavillons();
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
      // Le terni suit l'original, en plus gris : la neige le blanchit aussi.
      matBetonTerni.color.copy(matBeton.color).lerp(new THREE.Color(0x8a8a84), 0.5);
      matToitTerni.color.copy(matToit.color).lerp(new THREE.Color(0x77756f), 0.5);
      // Les jumeaux translucides suivent leurs originaux : un bâtiment occupé
      // blanchit sous la neige et allume ses fenêtres comme les autres.
      for (const [source, f] of matsFantome) {
        f.color.copy(source.color);
        f.emissiveIntensity = source.emissiveIntensity;
      }
      oscillation = p.oscillation;
      ambianceCourante = { p, saison };
      paysage.appliquerAmbiance(p, saison);
      // L'hiver dénude les feuillus : on les rétrécit plutôt que de les cacher.
      if (saison !== saisonCourante) {
        saisonCourante = saison;
        poserArbres(souffle);
      }
    },

    majRelief(): void {
      poserArbres(souffle);
      poserRochers();
      poserPavillons();
      paysage.majRelief();
    },

    majGrille(suivante: GrilleTerrain): void {
      grille = suivante;
      arbres = semerArbres(grille, biome);
      batirArbres();
      rochers = semerRochers(grille);
      batirRochers();
      semerPavillons();
      batirPavillons();
      // Le paysage est semé sur la grille comme les arbres : on le refait plutôt
      // que d'apprendre à chacun de ses lots à se ressemer. Il reprend
      // l'ambiance en cours, sans quoi il repartirait en plein été à midi.
      groupe.remove(paysage.groupe);
      paysage.dispose();
      paysage = creerPaysage(grille, hauteurEn, biome);
      groupe.add(paysage.groupe);
      if (ambianceCourante) paysage.appliquerAmbiance(ambianceCourante.p, ambianceCourante.saison);
      // Les bâtiments se rebâtissent au prochain `majProprietaires` : on efface
      // la signature qui lui fait croire que rien n'a changé.
      signature = '';
      poserArbres(souffle);
      poserRochers();
      poserPavillons();
    },

    avancer(ms: number, mouvementReduit = false): boolean {
      let encore = false;
      if (oscillation >= 0.3) {
        souffle += ms / 320;
        poserArbres(souffle);
        encore = true;
      }
      if (!mouvementReduit && places.some((p) => (p.force ?? p.pose).camp !== null)) {
        vent += ms / 1000;
        flotter();
        encore = true;
      }
      if (!mouvementReduit) {
        for (const p of paraboles) {
          if (!p.active) continue;
          p.pivot.rotation.y += (ms / 1000) * BALAYAGE_RADAR;
          encore = true;
        }
      }
      // Roseaux, ailes de moulin, fumerolles : le paysage a son propre souffle.
      if (paysage.avancer(ms, mouvementReduit)) encore = true;
      return encore;
    },

    chantier(cle: string): PriseChantier | null {
      if (!places.some((q) => q.cle === cle)) return null;
      return {
        eclairer(lueur): void {
          lueurs.set(cle, Math.min(1, Math.max(0, lueur)));
        },
        relacher(): void {
          lueurs.delete(cle);
          matsLueur.get(cle)?.mat.dispose();
          matsLueur.delete(cle);
        },
      };
    },

    drapeau(cle: string): PriseDrapeau | null {
      const p = places.find((q) => q.cle === cle);
      if (!p) return null;
      return {
        seuil: p.seuil,
        get sommet(): THREE.Vector3 {
          return piedDe(p).add(new THREE.Vector3(0, p.hauteurMat, 0));
        },
        get pied(): THREE.Vector3 {
          return piedDe(p);
        },
        forcer(camp, niveau): void {
          p.force = { camp, niveau };
          poserPavillons();
        },
        relacher(): void {
          p.force = null;
          poserPavillons();
        },
      };
    },

    dispose(): void {
      geoMat.dispose();
      geoPommeau.dispose();
      geoDrapeau.dispose();
      matDrapeau.dispose();
      for (const f of matsFantome.values()) f.dispose();
      for (const l of matsLueur.values()) l.mat.dispose();
      matBetonTerni.dispose();
      matToitTerni.dispose();
      matVitresEteintes.dispose();
      matPlanche.dispose();
      matParabole.dispose();
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
      toitures.dispose();
      matFenetres.dispose();
      matPierre.dispose();
      matMetal.dispose();
      matIvoire.dispose();
      for (const m of matsCamp.values()) m.dispose();
      paysage.dispose();
    },
  };
}
