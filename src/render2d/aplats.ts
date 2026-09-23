/**
 * Les **aplats** : des triangles de couleur posés dans le plan, sans image.
 *
 * C'est le second et dernier programme de la peau, pour ce qui n'est pas une
 * photographie : le fond coloré sous le sol, les surbrillances et la flèche de
 * déplacement, le curseur, l'anneau de sélection, le voile d'ambiance. Chaque
 * couche d'aplats a **son** tampon, qu'elle ne réécrit que si sa géométrie a
 * changé : un survol ne refait que la flèche et le curseur, pas le fond.
 *
 * `Trace` est pur — un tableau de flottants qu'on remplit de triangles — et se
 * teste sans WebGL.
 */

import { creerProgramme, type Programme } from './gl';

/** Une couleur droite (non prémultipliée), de 0 à 1. */
export type Rvba = readonly [number, number, number, number];

/** Flottants par sommet : X, Y, puis la couleur prémultipliée. */
export const FLOTTANTS_SOMMET = 6;

/** Lit une couleur `0xrrggbb` et une opacité. */
export function rvba(hex: number, a: number): Rvba {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a];
}

/** Lit une couleur CSS `#rrggbb` et une opacité ; une entrée illisible rend du noir. */
export function rvbaCss(css: string, a: number): Rvba {
  const n = Number.parseInt(css.replace('#', ''), 16);
  return Number.isFinite(n) ? rvba(n, a) : [0, 0, 0, a];
}

/** Des triangles de couleur, dans un tableau qui grandit sans rétrécir. */
export class Trace {
  donnees = new Float32Array(FLOTTANTS_SOMMET * 3 * 256);
  /** Sommets écrits. */
  sommets = 0;

  vider(): void {
    this.sommets = 0;
  }

  private assurer(plus: number): void {
    const besoin = (this.sommets + plus) * FLOTTANTS_SOMMET;
    if (besoin <= this.donnees.length) return;
    let taille = this.donnees.length;
    while (taille < besoin) taille *= 2;
    const d = new Float32Array(taille);
    d.set(this.donnees);
    this.donnees = d;
  }

  private sommet(x: number, y: number, c: Rvba): void {
    const o = this.sommets * FLOTTANTS_SOMMET;
    const d = this.donnees;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = c[0] * c[3];
    d[o + 3] = c[1] * c[3];
    d[o + 4] = c[2] * c[3];
    d[o + 5] = c[3];
    this.sommets += 1;
  }

  triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: Rvba): void {
    if (c[3] <= 0) return;
    this.assurer(3);
    this.sommet(ax, ay, c);
    this.sommet(bx, by, c);
    this.sommet(cx, cy, c);
  }

  /** Un quadrilatère convexe, sommets dans l'ordre du tour. */
  quadrilatere(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, c: Rvba): void {
    this.triangle(ax, ay, bx, by, cx, cy, c);
    this.triangle(ax, ay, cx, cy, dx, dy, c);
  }

  /** Un rectangle aligné sur les axes du plan. */
  rectangle(x0: number, y0: number, x1: number, y1: number, c: Rvba): void {
    this.quadrilatere(x0, y0, x1, y0, x1, y1, x0, y1, c);
  }
}

const SOMMETS = `#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aCouleur;
uniform mat3 uPlanVersDecoupe;
out vec4 vCouleur;
void main() {
  vCouleur = aCouleur;
  vec3 c = uPlanVersDecoupe * vec3(aPosition, 1.0);
  gl_Position = vec4(c.xy, 0.0, 1.0);
}`;

const FRAGMENTS = `#version 300 es
precision mediump float;
in vec4 vCouleur;
out vec4 sortie;
void main() {
  sortie = vCouleur;
}`;

/** Le programme des aplats, partagé par toutes les couches d'aplats. */
export class ProgrammeAplats {
  readonly programme: Programme;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.programme = creerProgramme(gl, SOMMETS, FRAGMENTS);
  }

  dispose(): void {
    this.programme.dispose();
  }

  /** Une couche d'aplats : un tampon et son VAO. */
  couche(): CoucheAplats {
    return new CoucheAplats(this.gl, this);
  }
}

/** Une couche d'aplats : elle garde sa géométrie tant qu'on ne la remplace pas. */
export class CoucheAplats {
  private readonly vao: WebGLVertexArrayObject;
  private readonly tampon: WebGLBuffer;
  private sommets = 0;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly prog: ProgrammeAplats) {
    const vao = gl.createVertexArray();
    const tampon = gl.createBuffer();
    if (!vao || !tampon) throw new Error('Couche d’aplats impossible à créer (contexte perdu ?)');
    this.vao = vao;
    this.tampon = tampon;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, FLOTTANTS_SOMMET * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOTTANTS_SOMMET * 4, 8);
    gl.bindVertexArray(null);
  }

  /** Remplace la géométrie par celle d'une trace. */
  poser(trace: Trace): void {
    const gl = this.gl;
    this.sommets = trace.sommets;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tampon);
    gl.bufferData(gl.ARRAY_BUFFER, trace.donnees, gl.DYNAMIC_DRAW, 0, Math.max(1, trace.sommets) * FLOTTANTS_SOMMET);
  }

  get vide(): boolean {
    return this.sommets === 0;
  }

  /** Triangles de la couche. */
  get triangles(): number {
    return this.sommets / 3;
  }

  /** Dessine la couche ; rend le nombre d'appels (0 ou 1). */
  dessiner(matrice: Float32Array): number {
    if (this.sommets === 0) return 0;
    const gl = this.gl;
    const p = this.prog.programme;
    gl.useProgram(p.programme);
    gl.uniformMatrix3fv(p.uniforme('uPlanVersDecoupe'), false, matrice);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.sommets);
    gl.bindVertexArray(null);
    return 1;
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.tampon);
  }
}
