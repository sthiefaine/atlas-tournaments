/**
 * Le maillage d'une figurine : des primitives **cousues** dans un tampon par
 * matériau, chaque sommet portant sa position, sa normale, ses UV dans l'atlas
 * et ses quatre poids de peau. À la fin, un seul `BufferGeometry` à deux groupes
 * — un par matériau —, donc deux appels de dessin pour toute l'escouade.
 *
 * Pourquoi des primitives maison plutôt que celles de three : une figurine
 * skinnée a besoin de poids **par anneau** (un genou est à moitié cuisse, à
 * moitié jambe), d'UV qui tombent dans une case précise de l'atlas, et d'un
 * budget de triangles réglé au segment près. `TubeGeometry` ne sait rien de
 * tout cela ; un tube écrit ici, si.
 *
 * L'orientation des faces est **décidée par la normale** : un triangle dont
 * l'ordre des sommets contredit la normale moyenne de ses sommets est retourné
 * à l'écriture. Les normales sont analytiques (sphère, tube, boîte) et donc
 * sûres ; l'ordre des sommets d'un bouchon ou d'un pôle, lui, se trompe
 * facilement, et une face à l'envers disparaît au rendu sans un mot.
 */

import * as THREE from 'three';

import { uvDans, type Cellule } from './atlas';

// ---------------------------------------------------------------------------
// 1. Poids de peau et repère
// ---------------------------------------------------------------------------

/** Les poids d'un sommet : quatre os et quatre poids, comme glTF les écrit. */
export interface Poids {
  readonly os: readonly [number, number, number, number];
  readonly poids: readonly [number, number, number, number];
}

/** Un sommet tenu par un seul os. */
export function rigide(os: number): Poids {
  return { os: [os, 0, 0, 0], poids: [1, 0, 0, 0] };
}

/** Un sommet partagé entre deux os : `partB` va au second. */
export function melange(a: number, b: number, partB: number): Poids {
  const p = Math.max(0, Math.min(1, partB));
  return { os: [a, b, 0, 0], poids: [1 - p, p, 0, 0] };
}

/**
 * Le repère où une figurine se construit : ses pieds à `origine`, tournée de
 * `lacet` autour de la verticale. Les primitives sont écrites dans le repère
 * local de la figurine — l'avant en `+Z`, le haut en `+Y`, la gauche en `+X` —
 * et le tampon les pose dans le modèle à l'écriture.
 */
export interface Repere {
  origine: THREE.Vector3;
  lacet: number;
}

const IDENTITE = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// 2. Le tampon
// ---------------------------------------------------------------------------

/** Un tampon de sommets et de triangles pour un matériau. */
export class Tampon {
  readonly positions: number[] = [];
  readonly normales: number[] = [];
  readonly uvs: number[] = [];
  readonly os: number[] = [];
  readonly poids: number[] = [];
  readonly indices: number[] = [];
  /** Combien de triangles ont été retournés à l'écriture : un chiffre de mise au point. */
  retournes = 0;
  private rotation = new THREE.Quaternion();
  private origine = new THREE.Vector3();

  /** `materiau` : l'index du matériau dans la liste du maillage final. */
  constructor(readonly materiau: number) {}

  /** Construit dans un repère de figurine, ou dans le repère du modèle avec `null`. */
  poser(repere: Repere | null): void {
    if (repere === null) {
      this.rotation.identity();
      this.origine.set(0, 0, 0);
    } else {
      this.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), repere.lacet);
      this.origine.copy(repere.origine);
    }
  }

  get sommets(): number {
    return this.positions.length / 3;
  }

  get triangles(): number {
    return this.indices.length / 3;
  }

  /** Ajoute un sommet et rend son index. La position et la normale sont posées dans le repère courant. */
  sommet(position: THREE.Vector3, normale: THREE.Vector3, uv: readonly [number, number], poids: Poids): number {
    const p = position.clone().applyQuaternion(this.rotation).add(this.origine);
    const n = normale.clone().applyQuaternion(this.rotation).normalize();
    this.positions.push(p.x, p.y, p.z);
    this.normales.push(n.x, n.y, n.z);
    this.uvs.push(uv[0], uv[1]);
    this.os.push(...poids.os);
    this.poids.push(...poids.poids);
    return this.sommets - 1;
  }

  private point(i: number): THREE.Vector3 {
    return new THREE.Vector3(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  private normale(i: number): THREE.Vector3 {
    return new THREE.Vector3(this.normales[i * 3], this.normales[i * 3 + 1], this.normales[i * 3 + 2]);
  }

  /**
   * Ajoute un triangle, orienté d'après la normale moyenne de ses sommets ; un
   * triangle dégénéré — deux sommets confondus, au pôle d'une sphère — est
   * ignoré plutôt que compté dans le budget.
   */
  triangle(a: number, b: number, c: number): void {
    const pa = this.point(a);
    const geometrique = this.point(b).sub(pa).cross(this.point(c).sub(pa));
    if (geometrique.lengthSq() < 1e-16) return;
    const moyenne = this.normale(a).add(this.normale(b)).add(this.normale(c));
    if (geometrique.dot(moyenne) < 0) {
      this.retournes += 1;
      this.indices.push(a, c, b);
    } else {
      this.indices.push(a, b, c);
    }
  }

  /** Un quadrilatère `a b c d` dans l'ordre du tour, en deux triangles. */
  quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }
}

// ---------------------------------------------------------------------------
// 3. Les primitives
// ---------------------------------------------------------------------------

/** Une sphère — ou un ellipsoïde, ou une calotte quand `thetaMin` la coupe. */
export interface OptionsSphere {
  centre: THREE.Vector3;
  /** Rayons en X, Y, Z. */
  rayons: readonly [number, number, number];
  segments: number;
  anneaux: number;
  cellule: Cellule;
  poids: Poids;
  /** Orientation autour du centre. */
  orientation?: THREE.Quaternion;
  /** Le `u` d'un azimut : le dépliage d'un visage, par exemple. Par défaut, linéaire. */
  uDeAzimut?: (phi: number) => number;
  /** Élévation la plus basse, en radians : `−π/2` pour une sphère entière, plus haut pour une calotte ouverte. */
  thetaMin?: number;
}

/**
 * Une sphère UV : l'azimut `0` regarde `+Z` (l'avant), les anneaux vont du
 * pôle haut vers le bas. Les normales sont celles de l'ellipsoïde.
 */
export function sphere(t: Tampon, o: OptionsSphere): void {
  const thetaMin = o.thetaMin ?? -Math.PI / 2;
  const q = o.orientation ?? IDENTITE;
  const [rx, ry, rz] = o.rayons;
  const grille: number[][] = [];
  for (let i = 0; i <= o.anneaux; i += 1) {
    const theta = Math.PI / 2 - (Math.PI / 2 - thetaMin) * (i / o.anneaux);
    const rangee: number[] = [];
    for (let j = 0; j <= o.segments; j += 1) {
      const phi = -Math.PI + (2 * Math.PI * j) / o.segments;
      const local = new THREE.Vector3(rx * Math.cos(theta) * Math.sin(phi), ry * Math.sin(theta), rz * Math.cos(theta) * Math.cos(phi));
      const normale = new THREE.Vector3(local.x / (rx * rx), local.y / (ry * ry), local.z / (rz * rz)).normalize();
      local.applyQuaternion(q);
      normale.applyQuaternion(q);
      const u = o.uDeAzimut ? o.uDeAzimut(phi) : j / o.segments;
      const v = (Math.PI / 2 - theta) / Math.PI;
      rangee.push(t.sommet(local.add(o.centre), normale, uvDans(o.cellule, u, v), o.poids));
    }
    grille.push(rangee);
  }
  for (let i = 0; i < o.anneaux; i += 1) {
    const haut = grille[i]!;
    const bas = grille[i + 1]!;
    for (let j = 0; j < o.segments; j += 1) {
      t.quad(haut[j]!, haut[j + 1]!, bas[j + 1]!, bas[j]!);
    }
  }
}

/** Un anneau d'un tube : son centre, ses deux rayons (latéral, avant-arrière) et ses poids. */
export interface AnneauTube {
  centre: THREE.Vector3;
  rx: number;
  rz: number;
  poids: Poids;
}

/** Comment un tube se termine : arrondi, plat, ou ouvert (caché par une autre pièce). */
export type Bout = 'rond' | 'plat' | 'ouvert';

/** Un tube le long d'une ligne brisée, à section elliptique par anneau. */
export interface OptionsTube {
  anneaux: readonly AnneauTube[];
  segments: number;
  cellule: Cellule;
  debut?: Bout;
  fin?: Bout;
  /** Anneaux d'un bout arrondi : 1 fait un cône doux, 2 ou 3 une vraie demi-sphère. */
  anneauxBout?: number;
  /** La direction de référence du repère des anneaux ; par défaut la gauche de la figurine. */
  lateral?: THREE.Vector3;
}

/** Le repère d'un anneau : son axe et deux directions perpendiculaires, sans torsion d'un anneau à l'autre. */
function repereAnneau(axe: THREE.Vector3, lateral: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  let u = lateral.clone().sub(axe.clone().multiplyScalar(lateral.dot(axe)));
  if (u.lengthSq() < 1e-8) {
    const secours = Math.abs(axe.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    u = secours.sub(axe.clone().multiplyScalar(secours.dot(axe)));
  }
  u.normalize();
  const v = new THREE.Vector3().crossVectors(axe, u).normalize();
  return { u, v };
}

/**
 * Un tube : un anneau de sommets par anneau déclaré, des quadrilatères entre
 * deux anneaux voisins, et un bout à chaque extrémité. Un membre entier — de la
 * hanche à la cheville, avec un anneau au genou — est un seul tube : moins de
 * triangles que deux capsules qui se chevauchent, et un genou qui plie
 * proprement parce que son anneau est à moitié à chaque os.
 */
export function tube(t: Tampon, o: OptionsTube): void {
  const n = o.anneaux.length;
  if (n < 2) throw new Error('un tube demande au moins deux anneaux');
  const lateral = o.lateral ?? new THREE.Vector3(1, 0, 0);
  const axes: THREE.Vector3[] = [];
  for (let i = 0; i < n; i += 1) {
    const avant = o.anneaux[Math.min(n - 1, i + 1)]!.centre;
    const arriere = o.anneaux[Math.max(0, i - 1)]!.centre;
    axes.push(avant.clone().sub(arriere).normalize());
  }
  // La position le long du tube donne le `v` : la texture suit le membre.
  const longueurs: number[] = [0];
  for (let i = 1; i < n; i += 1) longueurs.push(longueurs[i - 1]! + o.anneaux[i]!.centre.distanceTo(o.anneaux[i - 1]!.centre));
  const total = Math.max(1e-9, longueurs[n - 1]!);

  const cercles: number[][] = [];
  const reperes: { u: THREE.Vector3; v: THREE.Vector3 }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = o.anneaux[i]!;
    const { u, v } = repereAnneau(axes[i]!, lateral);
    reperes.push({ u, v });
    const cercle: number[] = [];
    for (let j = 0; j <= o.segments; j += 1) {
      const alpha = (2 * Math.PI * j) / o.segments;
      const p = a.centre.clone().addScaledVector(u, a.rx * Math.cos(alpha)).addScaledVector(v, a.rz * Math.sin(alpha));
      const normale = u.clone().multiplyScalar(Math.cos(alpha) / a.rx).addScaledVector(v, Math.sin(alpha) / a.rz).normalize();
      cercle.push(t.sommet(p, normale, uvDans(o.cellule, j / o.segments, longueurs[i]! / total), a.poids));
    }
    cercles.push(cercle);
  }
  for (let i = 0; i < n - 1; i += 1) {
    const a = cercles[i]!;
    const b = cercles[i + 1]!;
    for (let j = 0; j < o.segments; j += 1) t.quad(a[j]!, a[j + 1]!, b[j + 1]!, b[j]!);
  }

  const bout = (indice: number, sens: 1 | -1, genre: Bout): void => {
    if (genre === 'ouvert') return;
    const a = o.anneaux[indice]!;
    const axe = axes[indice]!.clone().multiplyScalar(sens);
    const { u, v } = reperes[indice]!;
    const vBout = sens === 1 ? 1 : 0;
    let precedent = cercles[indice]!;
    if (genre === 'plat') {
      // Des sommets propres, avec la normale du plan : un bouchon plat ne
      // partage pas ses normales avec la paroi.
      const bord: number[] = [];
      for (let j = 0; j <= o.segments; j += 1) {
        const alpha = (2 * Math.PI * j) / o.segments;
        const p = a.centre.clone().addScaledVector(u, a.rx * Math.cos(alpha)).addScaledVector(v, a.rz * Math.sin(alpha));
        bord.push(t.sommet(p, axe, uvDans(o.cellule, 0.5 + 0.5 * Math.cos(alpha), 0.5 + 0.5 * Math.sin(alpha)), a.poids));
      }
      const centre = t.sommet(a.centre, axe, uvDans(o.cellule, 0.5, 0.5), a.poids);
      for (let j = 0; j < o.segments; j += 1) t.triangle(bord[j]!, bord[j + 1]!, centre);
      return;
    }
    const rayon = (a.rx + a.rz) / 2;
    const nb = Math.max(1, o.anneauxBout ?? 1);
    for (let k = 1; k <= nb; k += 1) {
      const beta = (Math.PI / 2) * (k / nb);
      const echelle = Math.cos(beta);
      const centre = a.centre.clone().addScaledVector(axe, rayon * Math.sin(beta));
      if (k === nb) {
        const pole = t.sommet(centre, axe, uvDans(o.cellule, 0.5, vBout), a.poids);
        for (let j = 0; j < o.segments; j += 1) t.triangle(precedent[j]!, precedent[j + 1]!, pole);
        return;
      }
      const cercle: number[] = [];
      for (let j = 0; j <= o.segments; j += 1) {
        const alpha = (2 * Math.PI * j) / o.segments;
        const p = centre.clone().addScaledVector(u, a.rx * echelle * Math.cos(alpha)).addScaledVector(v, a.rz * echelle * Math.sin(alpha));
        const radiale = u.clone().multiplyScalar(Math.cos(alpha) / a.rx).addScaledVector(v, Math.sin(alpha) / a.rz).normalize();
        const normale = radiale.multiplyScalar(Math.cos(beta)).addScaledVector(axe, Math.sin(beta)).normalize();
        cercle.push(t.sommet(p, normale, uvDans(o.cellule, j / o.segments, vBout), a.poids));
      }
      for (let j = 0; j < o.segments; j += 1) t.quad(precedent[j]!, precedent[j + 1]!, cercle[j + 1]!, cercle[j]!);
      precedent = cercle;
    }
  };
  bout(0, -1, o.debut ?? 'rond');
  bout(n - 1, 1, o.fin ?? 'rond');
}

/** Une boîte à faces plates, orientée. */
export interface OptionsBoite {
  centre: THREE.Vector3;
  /** Dimensions en X, Y, Z (avant l'orientation). */
  taille: readonly [number, number, number];
  cellule: Cellule;
  poids: Poids;
  orientation?: THREE.Quaternion;
}

/** Une boîte : six faces, vingt-quatre sommets, douze triangles, normales plates. */
export function boite(t: Tampon, o: OptionsBoite): void {
  const q = o.orientation ?? IDENTITE;
  const [sx, sy, sz] = o.taille;
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  for (let a = 0; a < 3; a += 1) {
    for (const sens of [1, -1] as const) {
      const n = axes[a]!.clone().multiplyScalar(sens);
      const t1 = axes[(a + 1) % 3]!;
      const t2 = axes[(a + 2) % 3]!;
      const demi = [sx / 2, sy / 2, sz / 2];
      const coins: number[] = [];
      for (const [e1, e2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const local = n.clone().multiplyScalar(demi[a]!)
          .addScaledVector(t1, e1 * demi[(a + 1) % 3]!)
          .addScaledVector(t2, e2 * demi[(a + 2) % 3]!);
        local.applyQuaternion(q);
        const normale = n.clone().applyQuaternion(q);
        coins.push(t.sommet(local.add(o.centre), normale, uvDans(o.cellule, 0.5 + e1 * 0.45, 0.5 + e2 * 0.45), o.poids));
      }
      t.quad(coins[0]!, coins[1]!, coins[2]!, coins[3]!);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. L'assemblage
// ---------------------------------------------------------------------------

/**
 * Assemble les tampons en une seule géométrie à un groupe par tampon. Les
 * indices de peau sont écrits en entiers courts non signés — c'est ce que glTF
 * exige pour `JOINTS_0`, et ce que l'exportateur écrit sans conversion. Une
 * pièce rigide (`peau: false`) part sans poids : un socle n'a pas de squelette.
 */
export function assembler(tampons: readonly Tampon[], options: { peau?: boolean } = {}): THREE.BufferGeometry {
  const geometrie = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normales: number[] = [];
  const uvs: number[] = [];
  const os: number[] = [];
  const poids: number[] = [];
  const indices: number[] = [];
  for (const t of tampons) {
    const decalage = positions.length / 3;
    const debut = indices.length;
    positions.push(...t.positions);
    normales.push(...t.normales);
    uvs.push(...t.uvs);
    os.push(...t.os);
    poids.push(...t.poids);
    for (const i of t.indices) indices.push(i + decalage);
    geometrie.addGroup(debut, indices.length - debut, t.materiau);
  }
  geometrie.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometrie.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normales), 3));
  geometrie.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  if (options.peau ?? true) {
    geometrie.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(os), 4));
    geometrie.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(poids), 4));
  }
  geometrie.setIndex(indices);
  return geometrie;
}
