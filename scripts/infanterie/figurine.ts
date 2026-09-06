/**
 * Une figurine d'infanterie : le corps, son squelette, son équipement et son
 * lanceur de marqueurs, construits dans le repère de la figurine — l'avant en
 * `+Z`, le haut en `+Y`, sa gauche en `+X` — à partir d'une **allure** (ce qui
 * distingue les trois membres de l'escouade) et d'une **finesse** (ce que le
 * niveau de détail s'autorise).
 *
 * Les proportions sont celles du placeholder (`src/render3d/pieces.ts`, « La
 * troupe à pied ») : cinq têtes et demie, épaules larges, membres courts, un
 * casque **repoussé sur l'arrière** de la tête pour que le visage dépasse
 * devant lui sous une caméra qui regarde d'en haut. Le visage lui-même est
 * peint (`textures.ts`) : ici, on se contente de déplier la sphère de la tête
 * pour que les yeux tombent où le peintre les met.
 *
 * Rien ici ne connaît le nom d'une unité : ce fichier fabrique des fusiliers,
 * et c'est `generer-infanterie.ts` qui décide que c'est l'infanterie.
 */

import * as THREE from 'three';

import { CELLULES, uDeAzimut, type Cellule } from './atlas';
import {
  boite, melange, rigide, sphere, tube,
  type AnneauTube, type Bout, type Poids, type Tampon,
} from './maillage';

// ---------------------------------------------------------------------------
// 1. Le squelette : onze os par figurine
// ---------------------------------------------------------------------------

/** Les os d'une figurine, dans l'ordre où le squelette les range. */
export const NOMS_OS = [
  'bassin', 'colonne', 'tete',
  'bras_g', 'avant_bras_g', 'bras_d', 'avant_bras_d',
  'cuisse_g', 'jambe_g', 'cuisse_d', 'jambe_d',
] as const;
/** Le nom d'un os, sans le préfixe de sa figurine. */
export type NomOs = typeof NOMS_OS[number];

/** Le parent de chaque os ; `null` pour le bassin, qui pend à l'ancre de la figurine. */
export const PARENT_OS: Readonly<Record<NomOs, NomOs | null>> = {
  bassin: null,
  colonne: 'bassin',
  tete: 'colonne',
  bras_g: 'colonne',
  avant_bras_g: 'bras_g',
  bras_d: 'colonne',
  avant_bras_d: 'bras_d',
  cuisse_g: 'bassin',
  jambe_g: 'cuisse_g',
  cuisse_d: 'bassin',
  jambe_d: 'cuisse_d',
};

/** Les articulations d'une figurine : l'origine de chaque os, dans le repère de la figurine. */
export type Articulations = Record<NomOs, THREE.Vector3>;

/** Ce que les clips ont besoin de savoir d'une figurine pour poser ses pieds au sol. */
export interface MesuresFigurine {
  /** Facteur de taille de la figurine. */
  k: number;
  cuisse: number;
  jambe: number;
  /** Hauteur de la hanche et de la cheville au repos. */
  hanche: number;
  cheville: number;
  /** Rayon du genou : c'est lui qui touche le sol quand on s'agenouille. */
  genou: number;
}

// ---------------------------------------------------------------------------
// 2. L'allure et la finesse
// ---------------------------------------------------------------------------

/** Un point ou un vecteur du repère de la figurine, écrit en clair. */
export type Triplet = readonly [number, number, number];

/** Ce qui distingue une figurine de l'escouade : sa place, sa carrure, sa pose, son équipement. */
export interface Allure {
  /** Préfixe des noms d'os : `f1_bassin`. */
  prefixe: string;
  /** Quelle case de visage et de peau : trois visages, trois teints. */
  visage: 0 | 1 | 2;
  /** Facteur de taille : un peu plus petit, un peu plus grand, jamais un géant. */
  taille: number;
  /** Où elle se tient dans l'escouade, et vers où elle regarde, dans le repère du modèle. */
  ancre: { x: number; z: number; lacet: number };
  /** Le regard : lacet vers la gauche, tangage vers le haut. */
  regard: { lacet: number; tangage: number };
  /** Le tronc penché vers l'avant. */
  penche: number;
  /** Les chevilles, en `(x, z)`. */
  pieds: { gauche: readonly [number, number]; droit: readonly [number, number] };
  /** Le lanceur : la crosse et la direction du tir. */
  lanceur: { crosse: Triplet; direction: Triplet };
  /** La main gauche sur le garde-main, ou libre, à une position donnée. */
  mainGauche: 'lanceur' | Triplet;
  sac: 'grand' | 'petit';
  rouleau: boolean;
  poches: boolean;
  gourde: boolean;
  /** Déphasage des clips qui bouclent, en fraction de cycle. */
  phase: number;
  /** Retard des gestes ponctuels, en secondes : une salve, pas un tir à l'unisson. */
  delai: number;
}

/**
 * Les trois fusiliers. Le premier est en tête, lanceur au port d'armes ; le
 * deuxième marche, lanceur bas en bandoulière et main gauche sur la bretelle,
 * le regard sur le flanc ; le troisième, plus grand, porte le lanceur en
 * travers à deux mains. Trois teints, trois carrures, trois regards.
 */
export const ALLURES: readonly Allure[] = [
  {
    prefixe: 'f1', visage: 0, taille: 1,
    ancre: { x: 0, z: 0.06, lacet: 0 },
    regard: { lacet: 0, tangage: 0.12 }, penche: 0.03,
    pieds: { gauche: [0.05, 0.012], droit: [-0.05, -0.012] },
    lanceur: { crosse: [-0.075, 0.3, 0.055], direction: [0.66, 0.5, 0.42] },
    mainGauche: 'lanceur',
    sac: 'grand', rouleau: true, poches: true, gourde: false,
    phase: 0, delai: 0,
  },
  {
    prefixe: 'f2', visage: 1, taille: 0.96,
    ancre: { x: 0.118, z: -0.082, lacet: 0.3 },
    regard: { lacet: 0.32, tangage: 0.1 }, penche: 0.1,
    pieds: { gauche: [0.045, 0.05], droit: [-0.045, -0.04] },
    lanceur: { crosse: [-0.105, 0.3, -0.04], direction: [0.05, -0.35, 0.94] },
    mainGauche: [0.03, 0.4, 0.07],
    sac: 'petit', rouleau: false, poches: true, gourde: false,
    phase: 0.37, delai: 0.07,
  },
  {
    prefixe: 'f3', visage: 2, taille: 1.03,
    ancre: { x: -0.118, z: -0.082, lacet: -0.24 },
    regard: { lacet: -0.26, tangage: 0.14 }, penche: 0.02,
    pieds: { gauche: [0.06, -0.01], droit: [-0.058, 0.02] },
    lanceur: { crosse: [-0.1, 0.34, 0.05], direction: [0.97, 0.05, 0.22] },
    mainGauche: 'lanceur',
    sac: 'grand', rouleau: true, poches: false, gourde: true,
    phase: 0.71, delai: 0.14,
  },
];

/** Ce qu'un niveau de détail s'autorise : segments, anneaux, et quelles pièces existent encore. */
export interface Finesse {
  lod: 0 | 1 | 2;
  segTete: number;
  annTete: number;
  segCasque: number;
  annCasque: number;
  rebord: boolean;
  segTronc: number;
  anneauxTronc: 'complet' | 'reduit' | 'minimal';
  /** Un tube de bassin à part (le pantalon) ; sinon le tronc descend jusqu'à l'entrejambe. */
  bassinTube: boolean;
  /** Anneaux des bouts arrondis. */
  bouts: number;
  segMembre: number;
  anneauxMembre: 'complet' | 'reduit';
  /** Un bout arrondi à la hanche et à l'épaule ; sinon le tube reste ouvert là où le tronc le cache. */
  boutsMembres: boolean;
  segCylindre: number;
  sac: boolean;
  epaules: boolean;
  cou: boolean;
  mains: boolean;
  bottes: boolean;
  genouilleres: boolean;
  plastron: boolean;
  ceinture: boolean;
  poches: boolean;
  bretelles: boolean;
  rouleau: boolean;
  gourde: boolean;
  lanceur: 'complet' | 'simple' | 'bloc';
  segSocle: number;
}

/**
 * Les trois finesses. Le lod0 a des mains, un cou, des sacoches, un rebord de
 * casque et un lanceur en sept pièces ; le lod1 garde la silhouette et perd le
 * petit équipement ; le lod2 est une figurine à dix pixels — des tubes à quatre
 * ou cinq segments, un bloc pour le lanceur, rien qui ne se lise plus.
 */
export const FINESSES: Readonly<Record<0 | 1 | 2, Finesse>> = {
  0: {
    lod: 0, segTete: 14, annTete: 9, segCasque: 14, annCasque: 5, rebord: true,
    segTronc: 12, anneauxTronc: 'complet', bassinTube: true, bouts: 2,
    segMembre: 8, anneauxMembre: 'complet', boutsMembres: true, segCylindre: 8,
    sac: true, epaules: true, cou: true, mains: true, bottes: true, genouilleres: true, plastron: true,
    ceinture: true, poches: true, bretelles: true, rouleau: true, gourde: true,
    lanceur: 'complet', segSocle: 24,
  },
  1: {
    lod: 1, segTete: 8, annTete: 5, segCasque: 8, annCasque: 3, rebord: false,
    segTronc: 8, anneauxTronc: 'reduit', bassinTube: true, bouts: 1,
    segMembre: 6, anneauxMembre: 'reduit', boutsMembres: true, segCylindre: 6,
    sac: true, epaules: false, cou: true, mains: false, bottes: true, genouilleres: false, plastron: false,
    ceinture: false, poches: false, bretelles: false, rouleau: true, gourde: false,
    lanceur: 'simple', segSocle: 16,
  },
  2: {
    lod: 2, segTete: 4, annTete: 3, segCasque: 4, annCasque: 2, rebord: false,
    segTronc: 4, anneauxTronc: 'minimal', bassinTube: false, bouts: 1,
    segMembre: 3, anneauxMembre: 'reduit', boutsMembres: false, segCylindre: 4,
    sac: false, epaules: false, cou: false, mains: false, bottes: false, genouilleres: false, plastron: false,
    ceinture: false, poches: false, bretelles: false, rouleau: false, gourde: false,
    lanceur: 'bloc', segSocle: 8,
  },
};

// ---------------------------------------------------------------------------
// 3. Petite géométrie de pose
// ---------------------------------------------------------------------------

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const HAUT = new THREE.Vector3(0, 1, 0);

/**
 * L'articulation intermédiaire d'un membre en deux segments — coude ou genou —
 * de `a` à `b` : sur le cercle des points à `l1` de `a` et `l2` de `b`, du
 * côté de `pli`. Un bout hors de portée est ramené à bout de membre, jamais
 * arraché ; c'est le `bout` rendu qu'il faut alors utiliser.
 */
function articuler(
  a: THREE.Vector3, b: THREE.Vector3, l1: number, l2: number, pli: THREE.Vector3,
): { milieu: THREE.Vector3; bout: THREE.Vector3 } {
  let d = b.clone().sub(a);
  let distance = d.length();
  const portee = l1 + l2 - 0.002;
  let bout = b;
  if (distance > portee) {
    d = d.normalize().multiplyScalar(portee);
    distance = portee;
    bout = a.clone().add(d);
  }
  const u = d.clone().normalize();
  let n = pli.clone().sub(u.clone().multiplyScalar(pli.dot(u)));
  if (n.lengthSq() < 1e-8) n = v(0, -1, 0);
  n.normalize();
  const le = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const hauteur = Math.sqrt(Math.max(0, l1 * l1 - le * le));
  const milieu = a.clone().addScaledVector(u, le).addScaledVector(n, hauteur);
  return { milieu, bout };
}

/** Un point penché vers l'avant autour d'un pivot : le haut du corps suit le tronc. */
function pencher(p: THREE.Vector3, pivot: THREE.Vector3, angle: number): THREE.Vector3 {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  return p.clone().sub(pivot).applyQuaternion(q).add(pivot);
}

/** Le repère d'un lanceur : un point à `s` le long du tir, décalé vers le dessus et le côté. */
interface RepereLanceur {
  p(s: number, haut?: number, cote?: number): THREE.Vector3;
  d: THREE.Vector3;
  dessus: THREE.Vector3;
  orientation: THREE.Quaternion;
}

function repereLanceur(crosse: THREE.Vector3, direction: THREE.Vector3): RepereLanceur {
  const d = direction.clone().normalize();
  const dessus = HAUT.clone().sub(d.clone().multiplyScalar(HAUT.dot(d))).normalize();
  const cote = new THREE.Vector3().crossVectors(d, dessus).normalize();
  const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cote, dessus, d));
  return {
    p: (s, haut = 0, c = 0) => crosse.clone().addScaledVector(d, s).addScaledVector(dessus, haut).addScaledVector(cote, c),
    d, dessus, orientation,
  };
}

// ---------------------------------------------------------------------------
// 4. La construction
// ---------------------------------------------------------------------------

/** Les deux tampons du modèle : le corps (matériau 0) et les détails (matériau 1). */
export interface Tampons {
  corps: Tampon;
  details: Tampon;
}

/** Ce que rend la construction d'une figurine. */
export interface FigurineConstruite {
  articulations: Articulations;
  mesures: MesuresFigurine;
}

const CASE_VISAGE: readonly Cellule[] = [CELLULES.visage_0, CELLULES.visage_1, CELLULES.visage_2];
const CASE_PEAU: readonly Cellule[] = [CELLULES.peau_0, CELLULES.peau_1, CELLULES.peau_2];

/**
 * Construit une figurine dans les tampons, et rend ses articulations. `indice`
 * donne l'index de squelette d'un os de cette figurine : les poids de peau
 * sont écrits dans la géométrie, le squelette est assemblé après.
 */
export function construireFigurine(
  allure: Allure, finesse: Finesse, tampons: Tampons, indice: (os: NomOs) => number,
): FigurineConstruite {
  const k = allure.taille;
  const os = (nom: NomOs): Poids => rigide(indice(nom));
  const entre = (a: NomOs, b: NomOs, partB: number): Poids => melange(indice(a), indice(b), partB);
  const visage = CASE_VISAGE[allure.visage]!;
  const peau = CASE_PEAU[allure.visage]!;

  // --- Les repères du corps ------------------------------------------------
  const cuisse = 0.118 * k;
  const jambe = 0.112 * k;
  const bras = 0.092 * k;
  const avantBras = 0.086 * k;
  const rayonTete = 0.049 * k;
  const pivot = v(0, 0.29 * k, 0);
  const lean = (p: THREE.Vector3): THREE.Vector3 => pencher(p, pivot, allure.penche);
  const qLean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), allure.penche);

  const hancheG = v(0.042 * k, 0.27 * k, 0);
  const hancheD = v(-0.042 * k, 0.27 * k, 0);
  const chevilleG = v(allure.pieds.gauche[0] * k, 0.045 * k, allure.pieds.gauche[1] * k);
  const chevilleD = v(allure.pieds.droit[0] * k, 0.045 * k, allure.pieds.droit[1] * k);
  // Un genou plie vers l'avant : le pli regarde +Z.
  const genouG = articuler(hancheG, chevilleG, cuisse, jambe, v(0, 0, 1)).milieu;
  const genouD = articuler(hancheD, chevilleD, cuisse, jambe, v(0, 0, 1)).milieu;

  const bassin = v(0, 0.285 * k, 0);
  const colonne = lean(v(0, 0.31 * k, 0));
  const couBas = lean(v(0, 0.436 * k, 0));
  const couHaut = lean(v(0, 0.455 * k, 0));
  const epauleG = lean(v(0.088 * k, 0.415 * k, 0));
  const epauleD = lean(v(-0.088 * k, 0.415 * k, 0));

  // Le regard : lacet puis tangage, la tête penchée en arrière de ce que le
  // tronc penche en avant, pour que le visage se présente à une caméra haute.
  const qTete = new THREE.Quaternion().setFromEuler(new THREE.Euler(-allure.regard.tangage, allure.regard.lacet, 0, 'YXZ'));
  const centreTete = couHaut.clone().add(v(0, rayonTete - 0.002 * k, 0.005 * k).applyQuaternion(qTete));

  // --- Le lanceur, et les mains qui vont dessus ------------------------------
  const lanceur = repereLanceur(
    v(allure.lanceur.crosse[0] * k, allure.lanceur.crosse[1] * k, allure.lanceur.crosse[2] * k),
    v(...allure.lanceur.direction),
  );
  const cibleMainD = lanceur.p(0.065, -0.017);
  const cibleMainG = allure.mainGauche === 'lanceur'
    ? lanceur.p(0.165, -0.011)
    : v(allure.mainGauche[0] * k, allure.mainGauche[1] * k, allure.mainGauche[2] * k);
  // Un coude plie vers le bas, l'arrière et l'extérieur.
  const brasD = articuler(epauleD, cibleMainD, bras, avantBras, v(-0.7, -1, -0.45));
  const brasG = articuler(epauleG, cibleMainG, bras, avantBras, v(0.7, -1, -0.45));

  // --- Le bas du corps : pantalon, jambes, bottes ----------------------------
  const rayon = (x: number): number => x * k;
  const membre = (
    a: THREE.Vector3, milieu: THREE.Vector3, b: THREE.Vector3,
    rayons: readonly [number, number, number], poids: readonly [Poids, Poids, Poids], cellule: Cellule, fin: Bout,
  ): void => {
    const anneaux: AnneauTube[] = [];
    const ajouter = (centre: THREE.Vector3, r: number, p: Poids): void => { anneaux.push({ centre, rx: rayon(r), rz: rayon(r), poids: p }); };
    ajouter(a, rayons[0], poids[0]);
    if (finesse.anneauxMembre === 'complet') ajouter(a.clone().lerp(milieu, 0.5), (rayons[0] + rayons[1]) / 2, poids[0]);
    ajouter(milieu, rayons[1], poids[1]);
    if (finesse.anneauxMembre === 'complet') ajouter(milieu.clone().lerp(b, 0.5), (rayons[1] + rayons[2]) / 2, poids[2]);
    ajouter(b, rayons[2], poids[2]);
    tube(tampons.corps, {
      anneaux, segments: finesse.segMembre, cellule, debut: finesse.boutsMembres ? 'rond' : 'ouvert', fin, anneauxBout: 1,
    });
  };

  for (const [cote, hanche, genou, cheville] of [
    ['g', hancheG, genouG, chevilleG], ['d', hancheD, genouD, chevilleD],
  ] as const) {
    const hautOs: NomOs = cote === 'g' ? 'cuisse_g' : 'cuisse_d';
    const basOs: NomOs = cote === 'g' ? 'jambe_g' : 'jambe_d';
    membre(hanche, genou, cheville, [0.036, 0.03, 0.026], [os(hautOs), entre(hautOs, basOs, 0.5), os(basOs)], CELLULES.pantalon, finesse.bottes ? 'ouvert' : 'rond');
    if (finesse.bottes) {
      boite(tampons.details, {
        centre: v(cheville.x, 0.0225 * k, cheville.z + 0.012 * k), taille: [0.058 * k, 0.045 * k, 0.095 * k],
        cellule: CELLULES.bottes, poids: os(basOs),
      });
    }
    if (finesse.genouilleres) {
      boite(tampons.corps, {
        centre: genou.clone().add(v(0, -0.004 * k, 0.026 * k)), taille: [0.05 * k, 0.046 * k, 0.018 * k],
        cellule: CELLULES.cuir, poids: entre(hautOs, basOs, 0.5),
      });
    }
  }

  const taille = lean(v(0, 0.308 * k, 0));
  if (finesse.bassinTube) {
    tube(tampons.corps, {
      anneaux: [
        { centre: v(0, 0.248 * k, 0), rx: 0.066 * k, rz: 0.052 * k, poids: os('bassin') },
        { centre: v(0, 0.278 * k, 0), rx: 0.08 * k, rz: 0.06 * k, poids: os('bassin') },
        { centre: taille, rx: 0.071 * k, rz: 0.052 * k, poids: entre('bassin', 'colonne', 0.5) },
      ],
      segments: finesse.segTronc, cellule: CELLULES.pantalon, debut: 'rond', fin: 'ouvert', anneauxBout: finesse.bouts,
    });
  }

  // --- Le tronc : maillot, plastron, épaules, ceinture -----------------------
  const anneauxTronc: AnneauTube[] = [];
  if (!finesse.bassinTube) anneauxTronc.push({ centre: v(0, 0.25 * k, 0), rx: 0.07 * k, rz: 0.054 * k, poids: os('bassin') });
  anneauxTronc.push({ centre: taille, rx: 0.073 * k, rz: 0.054 * k, poids: entre('bassin', 'colonne', 0.5) });
  if (finesse.anneauxTronc !== 'minimal') anneauxTronc.push({ centre: lean(v(0, 0.36 * k, 0)), rx: 0.085 * k, rz: 0.062 * k, poids: os('colonne') });
  anneauxTronc.push({ centre: lean(v(0, 0.41 * k, 0)), rx: 0.094 * k, rz: 0.058 * k, poids: os('colonne') });
  if (finesse.anneauxTronc === 'complet') anneauxTronc.push({ centre: lean(v(0, 0.44 * k, 0)), rx: 0.05 * k, rz: 0.038 * k, poids: os('colonne') });
  tube(tampons.corps, {
    anneaux: anneauxTronc, segments: finesse.segTronc, cellule: CELLULES.uniforme,
    debut: finesse.bassinTube ? 'ouvert' : 'rond', fin: 'rond', anneauxBout: finesse.bouts,
  });
  if (finesse.ceinture) {
    tube(tampons.corps, {
      anneaux: [
        { centre: taille.clone().add(v(0, -0.007 * k, 0)), rx: 0.079 * k, rz: 0.058 * k, poids: os('bassin') },
        { centre: taille.clone().add(v(0, 0.007 * k, 0)), rx: 0.079 * k, rz: 0.058 * k, poids: entre('bassin', 'colonne', 0.5) },
      ],
      segments: finesse.segTronc, cellule: CELLULES.cuir, debut: 'ouvert', fin: 'ouvert',
    });
  }
  if (finesse.plastron) {
    boite(tampons.corps, {
      centre: lean(v(0, 0.365 * k, 0.062 * k)), taille: [0.11 * k, 0.09 * k, 0.02 * k],
      cellule: CELLULES.uniforme, poids: os('colonne'), orientation: qLean,
    });
  }
  if (finesse.epaules) {
    for (const epaule of [epauleG, epauleD]) {
      sphere(tampons.corps, {
        centre: epaule, rayons: [0.031 * k, 0.028 * k, 0.031 * k], segments: 5, anneaux: 3,
        cellule: CELLULES.uniforme, poids: os('colonne'),
      });
    }
  }

  // --- Les bras, avec ou sans mains -------------------------------------------
  for (const [cote, epaule, coude, main] of [
    ['g', epauleG, brasG.milieu, brasG.bout], ['d', epauleD, brasD.milieu, brasD.bout],
  ] as const) {
    const hautOs: NomOs = cote === 'g' ? 'bras_g' : 'bras_d';
    const basOs: NomOs = cote === 'g' ? 'avant_bras_g' : 'avant_bras_d';
    const poignet = main.clone().sub(coude).normalize().multiplyScalar(-0.022 * k).add(main);
    membre(epaule, coude, poignet, [0.027, 0.022, 0.019], [os(hautOs), entre(hautOs, basOs, 0.5), os(basOs)], CELLULES.uniforme, finesse.mains ? 'ouvert' : 'rond');
    if (finesse.mains) {
      sphere(tampons.details, {
        centre: main, rayons: [0.024 * k, 0.022 * k, 0.026 * k], segments: 6, anneaux: 4,
        cellule: peau, poids: os(basOs),
      });
    }
  }

  // --- Le cou, la tête, le casque ---------------------------------------------
  if (finesse.cou) {
    tube(tampons.details, {
      anneaux: [
        { centre: couBas, rx: 0.018 * k, rz: 0.018 * k, poids: entre('colonne', 'tete', 0.4) },
        { centre: couHaut, rx: 0.019 * k, rz: 0.019 * k, poids: os('tete') },
      ],
      segments: Math.max(4, finesse.segMembre), cellule: peau, debut: 'ouvert', fin: 'ouvert',
    });
  }
  sphere(tampons.details, {
    centre: centreTete, rayons: [0.05 * k, rayonTete, 0.05 * k], segments: finesse.segTete, anneaux: finesse.annTete,
    cellule: visage, poids: os('tete'), orientation: qTete, uDeAzimut,
  });
  // Le casque : une calotte plus large que la tête, remontée et reculée, et
  // basculée en arrière — c'est la bascule qui dégage le front et couvre la
  // nuque, pas le recul seul.
  const qCasque = qTete.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.38));
  const rayonCasque = rayonTete + 0.009 * k;
  const centreCasque = centreTete.clone().add(v(0, 0.014 * k, -0.012 * k).applyQuaternion(qTete));
  const thetaMin = -0.1;
  sphere(tampons.corps, {
    centre: centreCasque, rayons: [rayonCasque, rayonCasque, rayonCasque], segments: finesse.segCasque, anneaux: finesse.annCasque,
    cellule: CELLULES.casque, poids: os('tete'), orientation: qCasque, thetaMin,
  });
  if (finesse.rebord) {
    const axe = HAUT.clone().applyQuaternion(qCasque);
    const bord = centreCasque.clone().addScaledVector(axe, rayonCasque * Math.sin(thetaMin));
    const r = rayonCasque * Math.cos(thetaMin) + 0.004 * k;
    tube(tampons.corps, {
      anneaux: [
        { centre: bord.clone().addScaledVector(axe, -0.0045 * k), rx: r, rz: r, poids: os('tete') },
        { centre: bord.clone().addScaledVector(axe, 0.0045 * k), rx: r, rz: r, poids: os('tete') },
      ],
      segments: finesse.segCasque, cellule: CELLULES.rebord, debut: 'ouvert', fin: 'ouvert',
      lateral: new THREE.Vector3(1, 0, 0).applyQuaternion(qCasque),
    });
  }

  // --- Le sac, le rouleau, les bretelles, les sacoches, la gourde --------------
  const grand = allure.sac === 'grand';
  if (finesse.sac) {
    boite(tampons.corps, {
      centre: lean(v(0, (grand ? 0.36 : 0.35) * k, (grand ? -0.085 : -0.08) * k)),
      taille: grand ? [0.11 * k, 0.13 * k, 0.055 * k] : [0.09 * k, 0.09 * k, 0.045 * k],
      cellule: CELLULES.sac, poids: os('colonne'), orientation: qLean,
    });
  }
  if (finesse.rouleau && allure.rouleau) {
    tube(tampons.corps, {
      anneaux: [
        { centre: lean(v(-0.066 * k, 0.443 * k, -0.082 * k)), rx: 0.022 * k, rz: 0.022 * k, poids: os('colonne') },
        { centre: lean(v(0.066 * k, 0.443 * k, -0.082 * k)), rx: 0.022 * k, rz: 0.022 * k, poids: os('colonne') },
      ],
      segments: finesse.segCylindre, cellule: CELLULES.rouleau, debut: 'plat', fin: 'plat', lateral: HAUT,
    });
  }
  if (finesse.bretelles) {
    for (const x of [-0.04, 0.04]) {
      boite(tampons.corps, {
        centre: lean(v(x * k, 0.37 * k, 0.06 * k)), taille: [0.02 * k, 0.13 * k, 0.012 * k],
        cellule: CELLULES.cuir, poids: os('colonne'), orientation: qLean,
      });
    }
  }
  if (finesse.poches && allure.poches) {
    for (const x of [-0.047, 0.047]) {
      boite(tampons.corps, {
        centre: v(x * k, 0.268 * k, 0.062 * k), taille: [0.036 * k, 0.042 * k, 0.03 * k],
        cellule: CELLULES.cuir, poids: os('bassin'),
      });
    }
  }
  if (finesse.gourde && allure.gourde) {
    tube(tampons.corps, {
      anneaux: [
        { centre: v(-0.086 * k, 0.24 * k, 0.012 * k), rx: 0.02 * k, rz: 0.02 * k, poids: os('bassin') },
        { centre: v(-0.086 * k, 0.29 * k, 0.012 * k), rx: 0.02 * k, rz: 0.02 * k, poids: os('bassin') },
      ],
      segments: finesse.segCylindre, cellule: CELLULES.rouleau, debut: 'plat', fin: 'plat',
    });
  }

  // --- Le lanceur de marqueurs ---------------------------------------------------
  // Un lanceur de marqueurs, pas une arme : un boîtier ramassé, un réservoir
  // de peinture sous le garde-main et un embout de signalisation orange. Il
  // est tenu par l'avant-bras droit : c'est lui qui le porte dans les clips.
  const tenu = os('avant_bras_d');
  const piece = (s: number, taille: readonly [number, number, number], cellule: Cellule, haut = 0): void => {
    boite(tampons.details, { centre: lanceur.p(s, haut), taille, cellule, poids: tenu, orientation: lanceur.orientation });
  };
  const canon = (de: number, a: number, r: number, cellule: Cellule, debut: Bout, fin: Bout): void => {
    tube(tampons.details, {
      anneaux: [
        { centre: lanceur.p(de), rx: r, rz: r, poids: tenu },
        { centre: lanceur.p(a), rx: r, rz: r, poids: tenu },
      ],
      segments: finesse.segCylindre, cellule, debut, fin, lateral: lanceur.dessus,
    });
  };
  if (finesse.lanceur === 'complet') {
    piece(0.028, [0.02, 0.036, 0.055], CELLULES.lanceur);
    piece(0.1, [0.024, 0.036, 0.09], CELLULES.lanceur);
    piece(0.065, [0.016, 0.03, 0.02], CELLULES.lanceur, -0.028);
    piece(0.125, [0.02, 0.04, 0.026], CELLULES.signal, -0.036);
    piece(0.165, [0.022, 0.03, 0.05], CELLULES.lanceur);
    piece(0.11, [0.012, 0.014, 0.03], CELLULES.lanceur, 0.024);
    canon(0.19, 0.245, 0.007, CELLULES.lanceur, 'ouvert', 'plat');
    canon(0.245, 0.268, 0.011, CELLULES.signal, 'plat', 'plat');
  } else if (finesse.lanceur === 'simple') {
    piece(0.1, [0.024, 0.036, 0.2], CELLULES.lanceur);
    piece(0.125, [0.02, 0.04, 0.026], CELLULES.signal, -0.036);
    canon(0.19, 0.245, 0.007, CELLULES.lanceur, 'ouvert', 'ouvert');
    canon(0.245, 0.268, 0.011, CELLULES.signal, 'plat', 'plat');
  } else {
    piece(0.12, [0.026, 0.04, 0.24], CELLULES.lanceur);
  }

  return {
    articulations: {
      bassin, colonne, tete: couBas,
      bras_g: epauleG, avant_bras_g: brasG.milieu, bras_d: epauleD, avant_bras_d: brasD.milieu,
      cuisse_g: hancheG, jambe_g: genouG, cuisse_d: hancheD, jambe_d: genouD,
    },
    mesures: { k, cuisse, jambe, hanche: 0.27 * k, cheville: 0.045 * k, genou: 0.03 * k },
  };
}

/** Demi-axes du socle ovale, en mètres : c'est lui qui donne l'emprise au sol du modèle. */
export const SOCLE = { rx: 0.225, rz: 0.205, hauteur: 0.03 } as const;

/** Le socle ovale partagé de l'escouade : une plaque à dessus plat, sans dessous (personne ne le verra). */
export function construireSocle(t: Tampon, finesse: Finesse, poids: Poids): void {
  tube(t, {
    anneaux: [
      { centre: v(0, 0, 0), rx: SOCLE.rx, rz: SOCLE.rz, poids },
      { centre: v(0, SOCLE.hauteur, 0), rx: SOCLE.rx, rz: SOCLE.rz, poids },
    ],
    segments: finesse.segSocle, cellule: CELLULES.socle, debut: 'ouvert', fin: 'plat',
  });
}
