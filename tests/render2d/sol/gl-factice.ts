// Un contexte WebGL 2 de papier : il ne dessine rien, il **compte**. Le sol
// s'y monte sous Node comme dans un navigateur, et les tests lisent ce qu'il a
// envoyé — combien de textures, quels uniformes, et surtout **quand** : une
// mise à jour ne doit rien envoyer, c'est l'image qui envoie.
//
// La compilation réelle des nuanceurs est vérifiée ailleurs, dans un vrai
// WebGL 2 (`e2e/sol-2d.spec.ts`) ; ici, tout programme compile.

export interface AppelGl {
  nom: string;
  args: unknown[];
}

/** Les constantes dont le sol se sert : des nombres distincts, comme les vraies. */
const CONSTANTES: Record<string, number> = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  TEXTURE_2D: 0x0de1,
  TEXTURE_2D_ARRAY: 0x8c1a,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  LINEAR_MIPMAP_LINEAR: 0x2703,
  CLAMP_TO_EDGE: 0x812f,
  REPEAT: 0x2901,
  RGBA: 0x1908,
  RGBA8: 0x8058,
  UNSIGNED_BYTE: 0x1401,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
  UNPACK_ALIGNMENT: 0x0cf5,
  TEXTURE0: 0x84c0,
  TEXTURE1: 0x84c1,
  TEXTURE2: 0x84c2,
  DEPTH_TEST: 0x0b71,
  CULL_FACE: 0x0b44,
  BLEND: 0x0be2,
  ONE: 1,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  TRIANGLE_STRIP: 0x0005,
};

/** Un contexte factice, et le journal de ce qu'on lui a demandé. */
export interface GlFactice {
  gl: WebGL2RenderingContext;
  appels: AppelGl[];
  /** Les appels d'un nom, depuis le début ou depuis un index. */
  compter(nom: string, depuis?: number): number;
  /** Les objets créés et pas encore supprimés, par genre. */
  vivants(): Record<string, number>;
}

export function creerGlFactice(): GlFactice {
  const appels: AppelGl[] = [];
  const etat = new Map<number, unknown>([
    [CONSTANTES.UNPACK_FLIP_Y_WEBGL!, false],
    [CONSTANTES.UNPACK_PREMULTIPLY_ALPHA_WEBGL!, false],
    [CONSTANTES.UNPACK_ALIGNMENT!, 4],
  ]);
  const crees = new Map<string, Set<object>>();
  const creer = (genre: string): object => {
    const o = { genre };
    if (!crees.has(genre)) crees.set(genre, new Set());
    crees.get(genre)!.add(o);
    return o;
  };
  const supprimer = (genre: string, o: unknown): void => {
    if (o && typeof o === 'object') crees.get(genre)?.delete(o);
  };

  const methodes: Record<string, (...args: unknown[]) => unknown> = {
    createShader: () => creer('nuanceur'),
    createProgram: () => creer('programme'),
    createBuffer: () => creer('tampon'),
    createTexture: () => creer('texture'),
    createVertexArray: () => creer('tableau'),
    deleteShader: (o) => supprimer('nuanceur', o),
    deleteProgram: (o) => supprimer('programme', o),
    deleteBuffer: (o) => supprimer('tampon', o),
    deleteTexture: (o) => supprimer('texture', o),
    deleteVertexArray: (o) => supprimer('tableau', o),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    getUniformLocation: (_p, nom) => ({ uniforme: nom }),
    getExtension: () => null,
    getParameter: (cle) => etat.get(cle as number) ?? null,
    pixelStorei: (cle, valeur) => {
      etat.set(cle as number, valeur);
    },
    isContextLost: () => false,
    getError: () => 0,
  };

  const gl = new Proxy({} as Record<string, unknown>, {
    get(_cible, prop: string) {
      if (prop in CONSTANTES) return CONSTANTES[prop];
      const m = methodes[prop];
      return (...args: unknown[]): unknown => {
        appels.push({ nom: prop, args });
        return m ? m(...args) : undefined;
      };
    },
  }) as unknown as WebGL2RenderingContext;

  return {
    gl,
    appels,
    compter: (nom, depuis = 0) => appels.slice(depuis).filter((a) => a.nom === nom).length,
    vivants: () => Object.fromEntries([...crees].map(([g, s]) => [g, s.size])),
  };
}
