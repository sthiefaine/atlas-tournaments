/**
 * Le **cadre d'ombre** (`16-realisme.md` A2) : où la carte d'ombre regarde, et
 * avec quelle finesse.
 *
 * Jusqu'ici la caméra d'ombre du soleil couvrait la **carte entière**, une fois
 * pour toutes : sur un plateau de 24 × 16, un texel d'ombre faisait quatre
 * centimètres de scène, et une figurine de cinquante centimètres portait une
 * ombre en escalier qui commençait à dix centimètres de ses bottes. Le cadre
 * est désormais **resserré sur ce que la caméra voit** — le sol dans le champ,
 * borné à la carte —, et tout ce qui en dépend en découle : la finesse d'un
 * texel, donc les biais, qui ne sont plus des constantes réglées à l'œil mais
 * des multiples du texel. Rapprocher la caméra affine l'ombre ; la reculer
 * jusqu'à voir toute la carte retrouve le cadre d'avant.
 *
 * Tout ici est **pur** : de la géométrie sur des nombres, sans three.js ni DOM,
 * testée à sec dans `tests/render3d/ombres.test.ts`. `eclairage.ts` applique le
 * résultat à la caméra d'ombre, et seulement quand la caméra ou le soleil ont
 * bougé.
 *
 * Le type d'ombre reste `PCFSoftShadowMap`, et c'est un choix : son noyau est
 * fixe et ignore `radius`, mais il **adoucit les bords d'un texel et demi**,
 * ce qui, avec un texel cent fois plus petit qu'avant, donne des ombres de
 * contact nettes aux bottes et des bords doux — le critère de fin d'A2.
 * `PCFShadowMap` avec un grand `radius` écarte ses neuf prélèvements sans en
 * ajouter, et bande ; `VSMShadowMap` floute tout, contact compris, et laisse
 * fuir la lumière là où deux ombres se recouvrent. Ni l'un ni l'autre ne
 * s'accorde avec un `normalBias` proportionnel au texel, qui est ce qui tient
 * l'acné à distance ici.
 */

import { FOV, positionCamera, type EtatCamera } from './camera';
import { CASE } from './geometrie';

/** Distance du soleil à la cible, en unités de scène : là où `eclairage.ts` le pose. */
export const DISTANCE_SOLEIL = 40;

/**
 * La tranche d'altitudes qui porte ou reçoit une ombre : du fond marin (−0,4)
 * au sommet d'un mât de QG posé sur une montagne, avec de la marge. Une tranche
 * trop haute ne coûte que de la précision de profondeur ; trop basse, elle
 * coupe une ombre.
 */
export const HAUTEURS_OMBRE: Readonly<{ min: number; max: number }> = Object.freeze({ min: -0.5, max: 3 });

/** Au-delà de la carte, ce que le cadre couvre encore : la rive, un bord de décor. */
export const MARGE_CARTE = 2;

/** Marge du cadre autour du champ, pour le noyau de filtrage aux bords. */
const MARGE_CADRE = 0.5;

/** Un cadre ne descend pas sous ce côté : au plus près, on ne gagne plus rien. */
const COTE_MIN = 4;

/**
 * `normalBias` et `bias`, en texels. Le premier pousse le point d'ombre le long
 * de la normale et tient l'acné sur les pentes ; le second, le long de la
 * lumière, tient le sol plat. Un texel et demi et un demi-texel : les valeurs
 * d'usage, qui donnent un décollement d'ombre de l'ordre du texel — invisible —
 * là où la constante d'avant (0,13 unité de scène) faisait flotter les figurines.
 */
const NORMAL_BIAS_TEXELS = 1.6;
const BIAS_TEXELS = 0.6;

/** Un rectangle au sol, en unités de scène. */
export interface RectangleSol {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Ce qu'on applique à la caméra d'ombre orthographique. */
export interface CadreOmbre {
  gauche: number;
  droite: number;
  bas: number;
  haut: number;
  near: number;
  far: number;
  /** Côté d'un texel de la carte d'ombre, en unités de scène. */
  texel: number;
  /** `DirectionalLightShadow.bias`, en profondeur normalisée : négatif. */
  bias: number;
  /** `DirectionalLightShadow.normalBias`, en unités de scène. */
  normalBias: number;
}

type V3 = readonly [number, number, number];

function soustraire(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function croix(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function scalaire(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normaliser(a: V3): V3 {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n > 1e-9 ? [a[0] / n, a[1] / n, a[2] / n] : [1, 0, 0];
}

/**
 * La direction du soleil depuis son élévation et son azimut, unitaire. C'est la
 * formule de `directionSoleil` (`eclairage.ts`), recopiée sur des nombres pour
 * que ce module reste sans three.js ; le test vérifie que les deux s'accordent.
 */
export function directionLumiere(elevation: number, azimut: number): V3 {
  const e = (elevation * Math.PI) / 180;
  const a = (azimut * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

/**
 * La taille de la carte d'ombre. 2048² sur un ordinateur ; 1024² dès que le
 * pointeur principal est grossier — un doigt —, ce qui désigne un téléphone ou
 * une tablette sans se tromper sur un portable à écran tactile, dont le
 * pointeur principal reste la souris. Quatre fois plus de texels coûtent quatre
 * fois plus de remplissage à chaque image, et c'est ce que ces appareils n'ont
 * pas.
 */
export function tailleCarteOmbre(pointeurGrossier: boolean): number {
  return pointeurGrossier ? 1024 : 2048;
}

/** La carte, avec sa marge : ce que le cadre ne dépasse jamais. */
export function rectangleCarte(carte: { largeur: number; hauteur: number }, marge = MARGE_CARTE): RectangleSol {
  return {
    minX: -marge,
    maxX: carte.largeur * CASE + marge,
    minZ: -marge,
    maxZ: carte.hauteur * CASE + marge,
  };
}

/**
 * Le sol que la caméra voit, en rectangle au sol aligné sur les axes : les
 * quatre rayons des coins de l'écran, coupés par les plans de la tranche
 * d'altitudes, et l'enveloppe des huit points. C'est exact là où `champAuSol`
 * (`camera.ts`) approxime — la perspective montre plus de sol au fond de l'écran
 * que devant, et une ombre coupée au fond se voit.
 */
export function champVisibleAuSol(
  etat: EtatCamera, aspect: number, hauteurs: { min: number; max: number } = HAUTEURS_OMBRE,
): RectangleSol {
  const p = positionCamera(etat);
  const position: V3 = [p.x, p.y, p.z];
  const avant = normaliser(soustraire([etat.cible.x, 0, etat.cible.z], position));
  const droite = normaliser(croix(avant, [0, 1, 0]));
  const haut = croix(droite, avant);
  const t = Math.tan((FOV * Math.PI) / 360);
  const a = Math.max(0.2, aspect);
  let minX = etat.cible.x;
  let maxX = etat.cible.x;
  let minZ = etat.cible.z;
  let maxZ = etat.cible.z;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const dir: V3 = [
        avant[0] + droite[0] * sx * t * a + haut[0] * sy * t,
        avant[1] + droite[1] * sx * t * a + haut[1] * sy * t,
        avant[2] + droite[2] * sx * t * a + haut[2] * sy * t,
      ];
      for (const h of [hauteurs.min, hauteurs.max]) {
        // Le tangage borné à 60° et le demi-champ de 21° gardent tous les rayons
        // vers le bas ; on garde tout de même une portée de repli.
        const s = dir[1] < -1e-6 ? (h - position[1]) / dir[1] : 200;
        const x = position[0] + dir[0] * s;
        const z = position[2] + dir[2] * s;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
  }
  return { minX, maxX, minZ, maxZ };
}

/** L'intersection de deux rectangles, ou `null` s'ils ne se touchent pas. */
export function intersectionSol(a: RectangleSol, b: RectangleSol): RectangleSol | null {
  const r = {
    minX: Math.max(a.minX, b.minX),
    maxX: Math.min(a.maxX, b.maxX),
    minZ: Math.max(a.minZ, b.minZ),
    maxZ: Math.min(a.maxZ, b.maxZ),
  };
  return r.minX < r.maxX && r.minZ < r.maxZ ? r : null;
}

/** Élargit un rectangle trop petit autour de son centre, sur chaque axe. */
function auMoins(r: RectangleSol, cote: number): RectangleSol {
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  const dx = Math.max(cote, r.maxX - r.minX) / 2;
  const dz = Math.max(cote, r.maxZ - r.minZ) / 2;
  return { minX: cx - dx, maxX: cx + dx, minZ: cz - dz, maxZ: cz + dz };
}

/**
 * Le cadre orthographique de la caméra d'ombre pour un champ visible donné.
 *
 * Le champ est d'abord ramené à la carte et à sa marge — au-delà il n'y a rien
 * qui porte une ombre — puis les huit coins de la boîte (champ × tranche
 * d'altitudes) passent dans le repère de la lumière, celui que three.js
 * construit par `lookAt` depuis la position du soleil vers la cible ; leur
 * enveloppe est le cadre. Un cadre ainsi bâti contient **tout rayon de lumière
 * qui traverse la boîte**, donc tout ce qui peut y porter une ombre, même
 * depuis l'extérieur du champ : il suffit que le plan proche recule d'autant
 * qu'un tel porteur peut précéder la boîte le long du rayon.
 */
export function cadreOmbre(
  champ: RectangleSol,
  carte: { largeur: number; hauteur: number },
  soleil: { elevation: number; azimut: number },
  cible: { x: number; z: number },
  tailleCarte: number,
  hauteurs: { min: number; max: number } = HAUTEURS_OMBRE,
  distanceSoleil = DISTANCE_SOLEIL,
): CadreOmbre {
  const limite = rectangleCarte(carte);
  const rect = auMoins(intersectionSol(champ, limite) ?? limite, COTE_MIN);

  const direction = directionLumiere(soleil.elevation, soleil.azimut);
  const oeil: V3 = [
    cible.x + direction[0] * distanceSoleil,
    direction[1] * distanceSoleil,
    cible.z + direction[2] * distanceSoleil,
  ];
  // Le repère de `Matrix4.lookAt(oeil, cible, haut)` : z vers l'arrière, x à
  // droite, y en haut ; la caméra regarde le long de −z.
  const z = normaliser(direction);
  const x = normaliser(croix([0, 1, 0], z));
  const y = croix(z, x);

  let gauche = Number.POSITIVE_INFINITY;
  let droite = Number.NEGATIVE_INFINITY;
  let bas = Number.POSITIVE_INFINITY;
  let haut = Number.NEGATIVE_INFINITY;
  let proche = Number.POSITIVE_INFINITY;
  let loin = Number.NEGATIVE_INFINITY;
  for (const px of [rect.minX, rect.maxX]) {
    for (const py of [hauteurs.min, hauteurs.max]) {
      for (const pz of [rect.minZ, rect.maxZ]) {
        const d = soustraire([px, py, pz], oeil);
        const lx = scalaire(d, x);
        const ly = scalaire(d, y);
        const profondeur = -scalaire(d, z);
        gauche = Math.min(gauche, lx);
        droite = Math.max(droite, lx);
        bas = Math.min(bas, ly);
        haut = Math.max(haut, ly);
        proche = Math.min(proche, profondeur);
        loin = Math.max(loin, profondeur);
      }
    }
  }
  gauche -= MARGE_CADRE;
  droite += MARGE_CADRE;
  bas -= MARGE_CADRE;
  haut += MARGE_CADRE;

  // Un porteur d'ombre hors de la boîte, sur un rayon qui la traverse, la
  // précède d'au plus la hauteur de la tranche divisée par le sinus de
  // l'élévation : c'est de là que le plan proche doit partir.
  const sinus = Math.max(0.15, Math.sin((soleil.elevation * Math.PI) / 180));
  const recul = (hauteurs.max - hauteurs.min) / sinus;
  const near = Math.max(0.1, proche - recul - 1);
  const far = loin + 1;

  const texel = Math.max(droite - gauche, haut - bas) / Math.max(1, tailleCarte);
  return {
    gauche,
    droite,
    bas,
    haut,
    near,
    far,
    texel,
    bias: -(texel * BIAS_TEXELS) / (far - near),
    normalBias: texel * NORMAL_BIAS_TEXELS,
  };
}
