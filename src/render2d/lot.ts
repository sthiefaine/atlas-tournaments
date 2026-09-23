/**
 * Le **lot de sprites** : l'unique endroit où une image se dessine.
 *
 * Toutes les couches — bâtiments, décor, ombres, unités, badges, effets —
 * fabriquent des `InstanceSprite` (données pures) ; le lot les **ordonne** (par
 * calque, puis par ligne, puis par colonne, stable), les **range** dans un seul
 * tampon d'instances réutilisé d'une image à l'autre, et les dessine par
 * **instanciation** : un quad unitaire, vingt flottants par instance, un appel
 * de dessin par suite d'instances qui partagent la même page d'atlas.
 *
 * L'ordre est la seule chose qui compte pour la lecture : une case plus bas à
 * l'écran est plus près de la caméra, elle se peint après. Il n'y a pas de
 * tampon de profondeur ; c'est la grammaire d'Advance Wars, où rien ne cache
 * rien — les unités sont un calque au-dessus de tous les volumes.
 *
 * Le rangement (`empaqueter`) est pur : il ne voit qu'un résolveur d'images et
 * un tableau de flottants, et se teste sans WebGL (`tests/render2d/lot.test.ts`).
 */

import { ORDRE_CALQUES, versPlan, type CalqueRendu, type InstanceSprite } from './contrat';
import type { CadreResolu, TexturesPage } from './atlas';
import { creerProgramme, type Programme } from './gl';

/** Une instance à poser dans un calque, avec ses clés de tri. */
export interface Pose {
  calque: CalqueRendu;
  /**
   * Les clés de tri, en cases : la ligne, puis la colonne. Par défaut celles de
   * l'instance, mais un drapeau se trie **avec son bâtiment** et un badge avec
   * son unité — sinon un détail posé plus haut sur la case passerait dessous.
   */
  ligne: number;
  colonne: number;
  instance: InstanceSprite;
  /**
   * L'image est **du monde** — bâtiment, drapeau, décor, figurine — et reçoit
   * le voile d'ambiance que le calque porte (`ReglagesCalque.voile`) : la nuit,
   * la brume, la tempête, exactement comme le sol. Ce qui se lit (pastilles,
   * marques), les ombres, les effets et la météo ne le reçoivent pas
   * (`meteo.ts`, `doitEtalonner`). Le drapeau vit sur la pose, pas sur
   * l'instance : une instance prêtée par le sol n'est jamais modifiée.
   */
  voilee?: boolean;
  /**
   * La part **additive** de l'image, de 0 à 1 : la lumière d'un éclair ou d'une
   * étincelle s'ajoute à ce qu'elle couvre au lieu de le recouvrir. En alpha
   * prémultiplié, c'est de l'alpha qu'on retire : le mélange du lot
   * (`ONE, ONE_MINUS_SRC_ALPHA`) devient une addition, sans changer d'appel.
   * Une image voilée n'est jamais additive.
   */
  additif?: number;
}

/**
 * Ce qu'un appel de calque reçoit de l'ambiance : le poids de la page
 * d'émission (`EMISSION_JOUR` ou `EMISSION_NUIT`, du contrat) et le voile —
 * sa couleur sRGB et sa part, `[r, g, b, part]`, part nulle quand rien ne voile.
 */
export interface ReglagesCalque {
  emission: number;
  voile: Float32Array;
}

/** Un calque sans ambiance : aucune lumière propre, aucun voile. */
export function reglagesNeutres(): ReglagesCalque {
  return { emission: 0, voile: new Float32Array(4) };
}

/** Le quatrième flottant « divers » d'une instance voilée : négatif, pour ne pas se confondre avec une part additive. */
export const MODE_VOILEE = -1;

/** Une pose dont les clés de tri sont celles de l'instance. */
export function poser(calque: CalqueRendu, instance: InstanceSprite): Pose {
  return { calque, ligne: instance.y, colonne: instance.x, instance };
}

const RANG = new Map<CalqueRendu, number>(ORDRE_CALQUES.map((c, i) => [c, i]));

/** Le rang d'un calque dans l'ordre de peinture. */
export function rangCalque(c: CalqueRendu): number {
  return RANG.get(c) ?? 0;
}

/**
 * Ordonne les poses **en place** : calque, puis ligne, puis colonne. Le tri de
 * JavaScript est stable : deux poses aux mêmes clés gardent l'ordre où on les a
 * données — un bâtiment, puis son mât, puis son drapeau.
 */
export function ordonner(poses: Pose[]): Pose[] {
  return poses.sort((a, b) => (rangCalque(a.calque) - rangCalque(b.calque)) || (a.ligne - b.ligne) || (a.colonne - b.colonne));
}

/** Flottants par instance : rectangle, UV, équipe, teinte, divers. */
export const FLOTTANTS_INSTANCE = 20;

/** Un tampon d'instances qui grandit sans jamais rétrécir : aucune allocation une fois la taille atteinte. */
export class TamponInstances {
  donnees = new Float32Array(FLOTTANTS_INSTANCE * 256);

  /** Assure la place pour `n` instances. */
  assurer(n: number): void {
    if (this.donnees.length >= n * FLOTTANTS_INSTANCE) return;
    let capacite = this.donnees.length / FLOTTANTS_INSTANCE;
    while (capacite < n) capacite *= 2;
    const plus = new Float32Array(capacite * FLOTTANTS_INSTANCE);
    plus.set(this.donnees);
    this.donnees = plus;
  }
}

/** Une suite d'instances d'un même calque qui partagent une page : un appel de dessin. */
export interface GroupeLot {
  calque: CalqueRendu;
  textures: TexturesPage;
  debut: number;
  nombre: number;
}

/** Ce que le lot demande pour poser une instance. */
export interface ResolveurImages {
  resoudre(inst: InstanceSprite): CadreResolu | null;
}

/** Ce qu'un rangement a produit. */
export interface Empaquetage {
  groupes: GroupeLot[];
  /** Instances rangées (celles qui ont une image). */
  instances: number;
}

/**
 * Range des poses **déjà ordonnées** dans le tampon, et les regroupe par suites
 * qui partagent une page et un calque. Une instance sans image — une entrée
 * qu'on ne sait ni charger ni peindre — ne se range pas.
 *
 * Le rectangle est calculé ici, dans le plan : le pivot de l'image tombe sur le
 * point `versPlan(x, y, h)` de l'instance, à l'échelle de l'image, et le miroir
 * retourne autour de ce pivot — la gauche d'une unité est sa droite retournée.
 */
export function empaqueter(
  poses: readonly Pose[], resolveur: ResolveurImages, tampon: TamponInstances, groupes: GroupeLot[] = [],
): Empaquetage {
  groupes.length = 0;
  tampon.assurer(poses.length);
  const d = tampon.donnees;
  let n = 0;
  let courant: GroupeLot | null = null;
  for (const pose of poses) {
    const inst = pose.instance;
    const cadre = resolveur.resoudre(inst);
    if (!cadre) continue;
    const p = versPlan(inst.x, inst.y, inst.h ?? 0);
    const s = cadre.echelle * (inst.echelle ?? 1);
    const miroir = inst.miroir === true;
    const gauche = miroir ? p.X - (cadre.l - cadre.px) * s : p.X - cadre.px * s;
    const haut = p.Y - cadre.py * s;
    const o = n * FLOTTANTS_INSTANCE;
    d[o] = gauche;
    d[o + 1] = haut;
    d[o + 2] = gauche + cadre.l * s;
    d[o + 3] = haut + cadre.h * s;
    d[o + 4] = miroir ? cadre.u1 : cadre.u0;
    d[o + 5] = cadre.v0;
    d[o + 6] = miroir ? cadre.u0 : cadre.u1;
    d[o + 7] = cadre.v1;
    const equipe = inst.equipe ?? null;
    d[o + 8] = equipe ? equipe[0] : 1;
    d[o + 9] = equipe ? equipe[1] : 1;
    d[o + 10] = equipe ? equipe[2] : 1;
    d[o + 11] = cadre.masque && equipe ? 1 : 0;
    const teinte = inst.teinte;
    d[o + 12] = teinte ? teinte[0] : 1;
    d[o + 13] = teinte ? teinte[1] : 1;
    d[o + 14] = teinte ? teinte[2] : 1;
    d[o + 15] = Math.max(0, Math.min(1, inst.opacite ?? 1));
    d[o + 16] = Math.max(0, Math.min(1, inst.eclat ?? 0));
    d[o + 17] = Math.max(0, Math.min(1, inst.vue ?? 1));
    d[o + 18] = cadre.emission ? 1 : 0;
    // Le mode de l'image : voilée (du monde), ou sa part additive (de la lumière).
    d[o + 19] = pose.voilee === true ? MODE_VOILEE : Math.max(0, Math.min(1, pose.additif ?? 0));
    if (courant && courant.textures === cadre.textures && courant.calque === pose.calque) {
      courant.nombre += 1;
    } else {
      courant = { calque: pose.calque, textures: cadre.textures, debut: n, nombre: 1 };
      groupes.push(courant);
    }
    n += 1;
  }
  return { groupes, instances: n };
}

// ---------------------------------------------------------------------------
// Le programme et l'appel de dessin
// ---------------------------------------------------------------------------

const SOMMETS = `#version 300 es
layout(location = 0) in vec2 aCoin;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aUv;
layout(location = 3) in vec4 aEquipe;
layout(location = 4) in vec4 aTeinte;
layout(location = 5) in vec4 aDivers;
uniform mat3 uPlanVersDecoupe;
out vec2 vUv;
out vec4 vEquipe;
out vec4 vTeinte;
out vec4 vDivers;
void main() {
  vec2 p = mix(aRect.xy, aRect.zw, aCoin);
  vUv = mix(aUv.xy, aUv.zw, aCoin);
  vEquipe = aEquipe;
  vTeinte = aTeinte;
  vDivers = aDivers;
  vec3 c = uPlanVersDecoupe * vec3(p, 1.0);
  gl_Position = vec4(c.xy, 0.0, 1.0);
}`;

/**
 * Le nuanceur d'une image, en alpha prémultiplié, dans cet ordre :
 *
 * 1. `couleur × mix(1, équipe, masque) × teinte` — les zones d'équipe, cuites
 *    en blanc, prennent la couleur du camp (le gris neutre sans propriétaire) ;
 * 2. le **voile** d'ambiance, pour une image du monde : `c·(1 − a) + V·a`, la
 *    formule exacte du sol (`tracerVoile`), écrite en prémultiplié — un pixel
 *    à demi couvert reçoit le voile de sa part, et le composé est exact ;
 * 3. l'éclat d'un coup, vers le blanc : la lumière d'un choc ne se voile pas ;
 * 4. les lumières propres (page d'émission), **ajoutées** après la nuit :
 *    une fenêtre ressort sur un mur assombri ;
 * 5. le brouillard vers le noir — après l'éclat et les fenêtres : rien de ce
 *    qu'on ne voit pas ne clignote ni ne luit ;
 * 6. l'opacité, et la part additive retirée de l'alpha.
 */
const FRAGMENTS = `#version 300 es
precision highp float;
uniform sampler2D uCouleur;
uniform sampler2D uMasque;
uniform sampler2D uEmission;
uniform float uPoidsEmission;
uniform vec4 uVoile;
in vec2 vUv;
in vec4 vEquipe;
in vec4 vTeinte;
in vec4 vDivers;
out vec4 sortie;
void main() {
  vec4 c = texture(uCouleur, vUv);
  float m = texture(uMasque, vUv).r * vEquipe.a;
  vec3 rvb = c.rgb * mix(vec3(1.0), vEquipe.rgb, m) * vTeinte.rgb;
  float voilee = step(vDivers.w, -0.5);
  rvb = mix(rvb, uVoile.rgb * c.a, uVoile.a * voilee);
  rvb = mix(rvb, vec3(c.a), vDivers.x);
  rvb += texture(uEmission, vUv).rgb * (uPoidsEmission * vDivers.z);
  rvb *= vDivers.y;
  float additif = max(vDivers.w, 0.0);
  sortie = vec4(rvb, c.a * (1.0 - additif)) * vTeinte.a;
}`;

/** Ce qu'un dessin de lot a coûté. */
export interface StatsLot {
  appels: number;
  instances: number;
}

/** Le lot monté sur un contexte. */
export class LotSprites {
  private readonly programme: Programme;
  private readonly vao: WebGLVertexArrayObject;
  private readonly coins: WebGLBuffer;
  private readonly tamponGl: WebGLBuffer;
  private readonly noir: WebGLTexture;
  readonly tampon = new TamponInstances();
  private groupes: GroupeLot[] = [];
  private instances = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.programme = creerProgramme(gl, SOMMETS, FRAGMENTS);
    const vao = gl.createVertexArray();
    const coins = gl.createBuffer();
    const tampon = gl.createBuffer();
    const noir = gl.createTexture();
    if (!vao || !coins || !tampon || !noir) throw new Error('Lot de sprites impossible à créer (contexte perdu ?)');
    this.vao = vao;
    this.coins = coins;
    this.tamponGl = tampon;
    this.noir = noir;
    gl.bindTexture(gl.TEXTURE_2D, noir);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, coins);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    for (let i = 1; i <= 5; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
    gl.useProgram(this.programme.programme);
    gl.uniform1i(this.programme.uniforme('uCouleur'), 0);
    gl.uniform1i(this.programme.uniforme('uMasque'), 1);
    gl.uniform1i(this.programme.uniforme('uEmission'), 2);
  }

  /**
   * Range et téléverse les poses de l'image : **un seul** envoi par image, dans
   * un tampon orphelin (`bufferData`), que le pilote n'a pas à attendre.
   */
  preparer(poses: readonly Pose[], resolveur: ResolveurImages): Empaquetage {
    const e = empaqueter(poses, resolveur, this.tampon, this.groupes);
    this.instances = e.instances;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponGl);
    // La surcharge à décalage de WebGL 2 : la tranche utile, sans `subarray`.
    gl.bufferData(gl.ARRAY_BUFFER, this.tampon.donnees, gl.DYNAMIC_DRAW, 0, Math.max(1, e.instances) * FLOTTANTS_INSTANCE);
    return e;
  }

  /**
   * Dessine les groupes d'un calque ; rend ce que cela a coûté. Les réglages
   * d'ambiance valent pour tout l'appel : le poids des fenêtres, et le voile,
   * que seules les images marquées du monde reçoivent.
   */
  dessinerCalque(calque: CalqueRendu, matrice: Float32Array, reglages: ReglagesCalque): StatsLot {
    const gl = this.gl;
    let appels = 0;
    let instances = 0;
    let pret = false;
    for (const g of this.groupes) {
      if (g.calque !== calque || g.nombre === 0) continue;
      if (!pret) {
        gl.useProgram(this.programme.programme);
        gl.uniformMatrix3fv(this.programme.uniforme('uPlanVersDecoupe'), false, matrice);
        gl.uniform1f(this.programme.uniforme('uPoidsEmission'), reglages.emission);
        gl.uniform4fv(this.programme.uniforme('uVoile'), reglages.voile);
        gl.bindVertexArray(this.vao);
        pret = true;
      }
      // WebGL 2 n'a pas d'instance de base : on décale les pointeurs d'attributs
      // sur le début du groupe, ce qui ne coûte que cinq appels.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponGl);
      const pas = FLOTTANTS_INSTANCE * 4;
      const base = g.debut * pas;
      for (let i = 0; i < 5; i++) gl.vertexAttribPointer(i + 1, 4, gl.FLOAT, false, pas, base + i * 16);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.textures.couleur);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, g.textures.masque ?? this.noir);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, g.textures.emission ?? this.noir);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, g.nombre);
      appels += 1;
      instances += g.nombre;
    }
    if (pret) {
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
    }
    return { appels, instances };
  }

  /** Les instances rangées à la dernière préparation. */
  get nombreInstances(): number {
    return this.instances;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.coins);
    gl.deleteBuffer(this.tamponGl);
    gl.deleteTexture(this.noir);
    this.programme.dispose();
  }
}
