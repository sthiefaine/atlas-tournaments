/**
 * Le peu de WebGL 2 dont le sol a besoin : compiler, lier, créer ses textures.
 * Le moteur 2D a ses propres outils ; le sol garde les siens, pour que les deux
 * lots n'aient jamais à s'attendre.
 *
 * Deux règles tiennent ici :
 *
 * - **Une erreur de nuanceur lève**, avec son journal : un sol qui se tairait
 *   laisserait une carte vide sans que personne sache pourquoi.
 * - **Les réglages de dépaquetage sont posés puis rendus.** `UNPACK_FLIP_Y` et
 *   `UNPACK_PREMULTIPLY_ALPHA` sont un état global du contexte, que le lot de
 *   sprites règle pour ses images ; une texture de données envoyée
 *   prémultipliée perdrait son canal alpha — le brouillard.
 */

/** Compile un nuanceur, ou lève avec son journal. */
export function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const n = gl.createShader(type);
  if (!n) throw new Error('sol : createShader a échoué');
  gl.shaderSource(n, source);
  gl.compileShader(n);
  if (!gl.getShaderParameter(n, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const journal = gl.getShaderInfoLog(n) ?? '';
    gl.deleteShader(n);
    throw new Error(`sol : nuanceur refusé\n${journal}`);
  }
  return n;
}

/** Compile et lie un programme, l'attribut `aCoin` à l'emplacement 0. */
export function programme(gl: WebGL2RenderingContext, sommets: string, fragments: string): WebGLProgram {
  const vs = compiler(gl, gl.VERTEX_SHADER, sommets);
  const fs = compiler(gl, gl.FRAGMENT_SHADER, fragments);
  const p = gl.createProgram();
  if (!p) throw new Error('sol : createProgram a échoué');
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aCoin');
  gl.linkProgram(p);
  // Les nuanceurs ne servent plus une fois liés : le programme garde son code.
  gl.detachShader(p, vs);
  gl.detachShader(p, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    const journal = gl.getProgramInfoLog(p) ?? '';
    gl.deleteProgram(p);
    throw new Error(`sol : programme refusé\n${journal}`);
  }
  return p;
}

/**
 * Exécute un envoi de texture avec des réglages de dépaquetage neutres, puis
 * rend ceux d'avant. Lire l'état coûte : on ne le fait qu'aux envois, jamais
 * par image.
 */
export function envoyer(gl: WebGL2RenderingContext, faire: () => void): void {
  const retourner = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean;
  const premultiplier = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean;
  const alignement = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  try {
    faire();
  } finally {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, retourner === true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplier === true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, typeof alignement === 'number' ? alignement : 4);
  }
}

/** Une texture de données : un texel par case, lue par `texelFetch`, sans filtrage. */
export function textureCases(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error('sol : createTexture a échoué');
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

/** Envoie une grille encodée : une nouvelle allocation si la taille change, une mise à jour sinon. */
export function envoyerCases(
  gl: WebGL2RenderingContext, t: WebGLTexture, largeur: number, hauteur: number,
  octets: Uint8Array, realloue: boolean,
): void {
  envoyer(gl, () => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (realloue) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, largeur, hauteur, 0, gl.RGBA, gl.UNSIGNED_BYTE, octets);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, largeur, hauteur, gl.RGBA, gl.UNSIGNED_BYTE, octets);
    }
  });
}

/** Le tableau des couches de détail : répété, filtré, avec ses niveaux de détail. */
export function textureDetails(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error('sol : createTexture a échoué');
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // Le sol est vu à 50° : sans filtrage anisotrope, le grain se brouille en
  // bandes horizontales dès qu'on dézoome. L'extension est facultative.
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic') as
    { TEXTURE_MAX_ANISOTROPY_EXT: number; MAX_TEXTURE_MAX_ANISOTROPY_EXT: number } | null;
  if (aniso) {
    const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, max || 1));
  }
  return t;
}

/** Envoie les couches de détail et bâtit leurs niveaux de détail. */
export function envoyerDetails(
  gl: WebGL2RenderingContext, t: WebGLTexture, taille: number, couches: number, octets: Uint8Array,
): void {
  envoyer(gl, () => {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, taille, taille, couches, 0, gl.RGBA, gl.UNSIGNED_BYTE, octets);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  });
}
