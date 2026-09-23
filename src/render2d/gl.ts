/**
 * Le contexte WebGL 2 de la peau 2D, et ce qui l'entoure : la toile, sa mesure,
 * la densité de pixels, la compilation des programmes, la perte de contexte.
 *
 * Tout ici est **mince** : un appel WebGL par intention, aucune règle de jeu,
 * aucune image. Ce qui mérite un test vit ailleurs, en fonctions pures.
 *
 * Trois choix, et leur raison :
 *
 * - `antialias: false` — les images cuites sont déjà lissées (réduites depuis
 *   quatre fois leur taille, `SURECHANTILLONNAGE`) ; un tampon multi-échantillons
 *   ne lisserait que les bords des quads, et coûterait sur un téléphone ;
 * - `alpha: false` — la toile est opaque (le fond est toujours peint) : le
 *   navigateur n'a pas à la mélanger à la page. Les images, elles, sont en
 *   **alpha prémultiplié**, et tout se mélange en `ONE, ONE_MINUS_SRC_ALPHA` ;
 * - la toile se mesure par sa **boîte de mise en page** (`clientWidth`), jamais
 *   par `getBoundingClientRect` : la page la fait entrer par une animation en
 *   `transform` (`mission.css`, `atlas-deploiement`), et une boîte transformée
 *   donnerait un tampon faux pendant sept dixièmes de seconde — puis pour
 *   toujours, un `ResizeObserver` ne voyant pas les transformations.
 */

/** La densité de pixels plafonnée : au-delà de 2, un téléphone paie au carré des pixels que l'œil ne voit pas. */
export const RATIO_MAX = 2;

/** Le ratio de pixels de la fenêtre, borné à `[1, max]`. */
export function ratioPixels(fenetre: Pick<Window, 'devicePixelRatio'> | null | undefined, max = RATIO_MAX): number {
  const brut = fenetre?.devicePixelRatio;
  const valeur = typeof brut === 'number' && Number.isFinite(brut) && brut > 0 ? brut : 1;
  return Math.max(1, Math.min(max, valeur));
}

/** Les attributs du contexte : voir l'en-tête. */
export const ATTRIBUTS_CONTEXTE: WebGLContextAttributes = Object.freeze({
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
});

let sondeMemo: boolean | null = null;

/**
 * Le navigateur sait-il ouvrir un contexte WebGL 2 ? La réponse est mémorisée :
 * la sonde crée une toile hors page et rend aussitôt son contexte, un appareil
 * ne change pas d'avis en cours de visite.
 */
export function moteur2dDisponible(): boolean {
  if (sondeMemo !== null) return sondeMemo;
  try {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return false;
    const toile = doc.createElement('canvas');
    const gl = toile.getContext('webgl2', ATTRIBUTS_CONTEXTE) as WebGL2RenderingContext | null;
    sondeMemo = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    sondeMemo = false;
  }
  return sondeMemo;
}

/** Compile un nuanceur ; lève avec le journal du pilote, qui est la seule piste en cas d'échec. */
function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Nuanceur impossible à créer (contexte perdu ?)');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const journal = gl.getShaderInfoLog(s) ?? '';
    gl.deleteShader(s);
    throw new Error(`Nuanceur refusé : ${journal}`);
  }
  return s;
}

/** Un programme lié, et l'emplacement de ses uniformes par nom. */
export interface Programme {
  readonly programme: WebGLProgram;
  uniforme(nom: string): WebGLUniformLocation | null;
  dispose(): void;
}

/**
 * Compile et lie un programme. Les emplacements d'attributs sont fixés dans le
 * source (`layout(location = n)`) : un VAO se décrit alors sans interroger le
 * programme, et deux programmes peuvent partager un même VAO.
 */
export function creerProgramme(gl: WebGL2RenderingContext, sommets: string, fragments: string): Programme {
  const vs = compiler(gl, gl.VERTEX_SHADER, sommets);
  const fs = compiler(gl, gl.FRAGMENT_SHADER, fragments);
  const p = gl.createProgram();
  if (!p) throw new Error('Programme impossible à créer (contexte perdu ?)');
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    const journal = gl.getProgramInfoLog(p) ?? '';
    gl.deleteProgram(p);
    throw new Error(`Programme refusé : ${journal}`);
  }
  const emplacements = new Map<string, WebGLUniformLocation | null>();
  return {
    programme: p,
    uniforme(nom: string): WebGLUniformLocation | null {
      if (!emplacements.has(nom)) emplacements.set(nom, gl.getUniformLocation(p, nom));
      return emplacements.get(nom) ?? null;
    },
    dispose(): void {
      gl.deleteProgram(p);
      emplacements.clear();
    },
  };
}

/** Une texture de 1 × 1 d'une couleur : ce qu'on lie quand une page n'a pas de masque ou d'émission. */
export function texturePixel(gl: WebGL2RenderingContext, rvba: readonly [number, number, number, number]): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error('Texture impossible à créer (contexte perdu ?)');
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rvba));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return t;
}

/**
 * Les réglages d'échantillonnage d'une page d'atlas : bords collés — une image
 * rognée au plus près ne doit pas reprendre la ligne d'en face —, et mipmaps,
 * sans quoi une carte vue de loin (0,375 pixel d'écran par pixel d'image)
 * scintillerait à chaque glisser.
 */
export function reglerTexture(gl: WebGL2RenderingContext, mipmaps: boolean): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
}

/** Ce que la toile sait d'elle-même : sa taille de mise en page, son tampon, sa densité. */
export interface Toile {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  /** Taille de mise en page, en pixels CSS. */
  readonly largeur: number;
  readonly hauteur: number;
  /** Pixels physiques par pixel CSS, plafonné. */
  readonly ratio: number;
  /** Vrai entre la perte du contexte et sa restauration : on ne dessine rien. */
  readonly perdu: boolean;
  /** Remesure la toile ; rend vrai si sa taille ou sa densité a changé. */
  mesurer(): boolean;
  dispose(): void;
}

/** Ce que la toile dit à la peau. */
export interface EcouteToile {
  /** La taille ou la densité ont changé : caméra et image sont à refaire. */
  surRedimension(largeur: number, hauteur: number, ratio: number): void;
  /** Le contexte est perdu : tout objet WebGL est mort. */
  surPerte(): void;
  /** Le contexte est rendu : programmes, tampons et textures sont à refaire. */
  surRestauration(): void;
}

/**
 * Crée la toile dans le conteneur et ouvre son contexte. **Lève** si WebGL 2
 * manque : `monterJeu` le laisse remonter jusqu'à la page, qui dit au joueur
 * que le jeu n'a pas pu démarrer — mieux qu'un plateau vide.
 */
export function creerToile(conteneur: HTMLElement, ecoute: EcouteToile): Toile {
  const doc = conteneur.ownerDocument;
  const fenetre = doc.defaultView;
  const canvas = doc.createElement('canvas');
  // La classe de la peau 3D : la page l'anime à l'entrée et le diagnostic la trouve par elle.
  canvas.className = 'atlas-toile';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.outline = 'none';
  // Aucun geste au navigateur : la carte prend le glisser et le pincement.
  canvas.style.touchAction = 'none';
  canvas.setAttribute('tabindex', '0');
  const gl = canvas.getContext('webgl2', ATTRIBUTS_CONTEXTE) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('Rendu 2D indisponible : WebGL 2 requis.');
  conteneur.appendChild(canvas);

  let largeur = 0;
  let hauteur = 0;
  let ratio = 1;
  let perdu = false;

  function mesurer(): boolean {
    const l = Math.max(1, Math.round(canvas.clientWidth || conteneur.clientWidth || 1));
    const h = Math.max(1, Math.round(canvas.clientHeight || conteneur.clientHeight || 1));
    const r = ratioPixels(fenetre);
    if (l === largeur && h === hauteur && r === ratio) return false;
    largeur = l;
    hauteur = h;
    ratio = r;
    canvas.width = Math.max(1, Math.round(l * r));
    canvas.height = Math.max(1, Math.round(h * r));
    return true;
  }

  const observateur = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (mesurer()) ecoute.surRedimension(largeur, hauteur, ratio); })
    : null;
  // Les deux sont observés : la toile parce que c'est elle qu'on mesure, le
  // conteneur pour le moment où elle n'a pas encore de boîte.
  observateur?.observe(canvas);
  observateur?.observe(conteneur);
  mesurer();

  const surPerte = (e: Event): void => {
    // Sans `preventDefault`, le navigateur ne rendrait jamais le contexte.
    e.preventDefault();
    perdu = true;
    ecoute.surPerte();
  };
  const surRestauration = (): void => {
    perdu = false;
    ecoute.surRestauration();
  };
  canvas.addEventListener('webglcontextlost', surPerte);
  canvas.addEventListener('webglcontextrestored', surRestauration);

  return {
    canvas,
    gl,
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get ratio() { return ratio; },
    get perdu() { return perdu || gl.isContextLost(); },
    mesurer,
    dispose(): void {
      observateur?.disconnect();
      canvas.removeEventListener('webglcontextlost', surPerte);
      canvas.removeEventListener('webglcontextrestored', surRestauration);
      // Rendre le contexte tout de suite : un navigateur n'en tient qu'une
      // quinzaine, et une page qu'on remonte en rouvre un à chaque partie.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
