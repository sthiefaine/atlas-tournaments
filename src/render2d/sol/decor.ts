/**
 * Le **placement** du décor : quels arbres, quelles touffes, quelle montagne,
 * quels rochers, où, et sous quelle image du manifeste.
 *
 * Le sol ne dessine pas le décor : il rend des `InstanceSprite`, que le lot de
 * sprites peint dans le calque `volumes` avec les bâtiments (contrat). Tout ici
 * est **pur** et **déterministe** : positions, variantes et tailles sont tirées
 * d'un hachage de case, jamais de `Math.random` — deux montages sèment le même
 * paysage, et une case ne porte jamais deux fois le même hasard.
 *
 * Trois règles de placement :
 *
 * - **Le centre reste libre** autant que possible : c'est là que se pose une
 *   unité. Les arbres d'une forêt tiennent le fond de la case et ses deux
 *   flancs avant ; les touffes et les buissons se sèment en couronne. Seuls la
 *   montagne et le pont occupent le centre — ils *sont* la case.
 * - **Rien sous le noir.** Une case cachée ne rend aucune image : une montagne
 *   cuite dépasse vers le haut sur la case du dessus, et sa silhouette, même
 *   noire, dessinerait le relief que le brouillard doit taire. Près du bord du
 *   brouillard, une image s'assombrit comme le sol (`vue` continue).
 * - **Pas d'image, pas d'instance.** Une essence absente du manifeste ne rend
 *   rien ; le nuanceur du sol dessine alors un décor de repli pour la forêt, la
 *   montagne et les hautes herbes (`repliDecor`), afin que la carte se lise.
 */

import {
  idDecor, type AnimationSprite, type EntreeSprite, type EssenceDecor, type InstanceSprite,
  type ManifesteSprites, type SaisonDecor, type VueSprite, VERSION_SPRITES,
} from '../contrat';
import type { Biome, CleTerrain, Saison } from '../../schemas/types';
import { axePont, DIRECTIONS, terrainEn, type GrilleSol } from './grille';
import { TERRAINS_EAU } from './terrains';

// ---------------------------------------------------------------------------
// Le hasard de case
// ---------------------------------------------------------------------------

/**
 * Un aléa déterministe par case et par sel, dans [0, 1). Le hachage de la 3D
 * (`alea` de `render3d/geometrie.ts`), repris : les deux peaux sèment d'un
 * même geste.
 */
export function aleaCase(x: number, y: number, sel: number): number {
  let n = (x * 374_761_393 + y * 668_265_263 + sel * 2_246_822_519) | 0;
  n = (n ^ (n >>> 13)) * 1_274_126_177;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4_294_967_296;
}

/** Un nombre entier entre `min` et `max` inclus, tiré d'un aléa. */
function entre(a: number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(a * (max - min + 1)));
}

// ---------------------------------------------------------------------------
// Les essences, par biome
// ---------------------------------------------------------------------------

/** Une essence pondérée. */
type Tirage = readonly (readonly [EssenceDecor, number])[];

/**
 * Les arbres d'une forêt, par biome. Les proportions de la 3D : des conifères
 * en montagne, sous la neige et sur la côte, des feuillus mêlés ailleurs ; des
 * palmiers au désert et en archipel, de la forêt tropicale en jungle.
 */
export const ARBRES: Readonly<Record<Biome, Tirage>> = {
  plaine: [['feuillu', 0.7], ['conifere', 0.3]],
  foret: [['feuillu', 0.6], ['conifere', 0.4]],
  montagne: [['conifere', 1]],
  neige: [['conifere', 1]],
  desert: [['palmier', 1]],
  jungle: [['tropical', 0.8], ['palmier', 0.2]],
  volcanique: [['conifere', 0.6], ['feuillu', 0.4]],
  cotier: [['conifere', 0.7], ['feuillu', 0.3]],
  archipel: [['palmier', 0.7], ['tropical', 0.3]],
  marais: [['feuillu', 1]],
};

/** La montagne d'un biome, et celle qu'on prend si la sienne n'est pas cuite. */
export function essenceMontagne(biome: Biome): EssenceDecor {
  if (biome === 'desert') return 'montagne_aride';
  if (biome === 'volcanique') return 'montagne_volcan';
  return 'montagne';
}

/** La part des cases de plaine qui portent des buissons, par biome : épars, jamais une haie. */
export const CHANCE_BUISSON: Readonly<Record<Biome, number>> = {
  plaine: 0.18,
  foret: 0.25,
  montagne: 0.12,
  desert: 0.06,
  jungle: 0.3,
  neige: 0.05,
  volcanique: 0.06,
  cotier: 0.12,
  archipel: 0.1,
  marais: 0.12,
};

/** Les rochers de côte : seuls deux biomes en ont, et ils gardent l'identifiant de leur GLB. */
export function rocherDe(biome: Biome): string | null {
  return biome === 'cotier' || biome === 'archipel' ? `decor_rocher_${biome}` : null;
}

// ---------------------------------------------------------------------------
// Le manifeste
// ---------------------------------------------------------------------------

/** Le manifeste s'il est lisible : un manifeste d'une autre version est refusé, pas deviné. */
export function manifesteLisible(m: ManifesteSprites | null | undefined): ManifesteSprites | null {
  return m && m.version === VERSION_SPRITES ? m : null;
}

/** Le plus grand numéro de variante cherché : la cuisson en produit au moins deux. */
const VARIANTES_MAX = 16;

/**
 * Les entrées d'une essence à une saison : d'abord la saison elle-même, puis
 * `toutes` quand elle ne se voit pas sur l'essence. Les numéros présents
 * seulement — la cuisson numérote à partir de 1, et un trou dans la suite ne
 * doit pas priver des suivantes.
 */
export function variantesPresentes(
  manifeste: ManifesteSprites | null, essence: EssenceDecor, saison: Saison,
): string[] {
  if (!manifeste) return [];
  for (const s of [saison, 'toutes'] as SaisonDecor[]) {
    const ids: string[] = [];
    for (let n = 1; n <= VARIANTES_MAX; n += 1) {
      const id = idDecor(essence, s, n);
      if (manifeste.entrees[id]) ids.push(id);
    }
    if (ids.length > 0) return ids;
  }
  return [];
}

/**
 * L'animation à poser pour une vue : le clip de repos s'il existe, sinon le
 * premier clip de la vue ; `-1` si la vue n'a pas été cuite.
 */
export function animationDeVue(entree: EntreeSprite, vue: VueSprite): number {
  const est = (a: AnimationSprite): boolean => a.vue === vue && a.cadres.length > 0;
  const repos = entree.animations.findIndex((a) => est(a) && a.clip === 'repos');
  return repos >= 0 ? repos : entree.animations.findIndex(est);
}

/** Les bits du décor de repli que le nuanceur dessine, faute d'image. */
export const REPLI = {
  FORET: 1,
  MONTAGNE: 2,
  HERBE_HAUTE: 4,
} as const;

/** Les essences d'arbre d'un biome qui ont des images, pondérées de nouveau. */
function arbresCuits(manifeste: ManifesteSprites | null, biome: Biome, saison: Saison): Tirage {
  const cuits = ARBRES[biome].filter(([e]) => variantesPresentes(manifeste, e, saison).length > 0);
  const total = cuits.reduce((s, [, p]) => s + p, 0);
  return total > 0 ? cuits.map(([e, p]) => [e, p / total] as const) : [];
}

/** La montagne cuite d'un biome : la sienne, sinon la montagne commune, sinon rien. */
function montagneCuite(manifeste: ManifesteSprites | null, biome: Biome, saison: Saison): EssenceDecor | null {
  const propre = essenceMontagne(biome);
  if (variantesPresentes(manifeste, propre, saison).length > 0) return propre;
  if (variantesPresentes(manifeste, 'montagne', saison).length > 0) return 'montagne';
  return null;
}

/**
 * Ce que le nuanceur doit dessiner lui-même : la forêt quand aucun arbre du
 * biome n'est cuit, la montagne quand aucune montagne ne l'est, les hautes
 * herbes quand la touffe manque. C'est ce qui garde la carte lisible avant la
 * première cuisson du décor.
 */
export function repliDecor(manifeste: ManifesteSprites | null, biome: Biome, saison: Saison): number {
  const m = manifesteLisible(manifeste);
  let bits = 0;
  if (arbresCuits(m, biome, saison).length === 0) bits |= REPLI.FORET;
  if (montagneCuite(m, biome, saison) === null) bits |= REPLI.MONTAGNE;
  if (variantesPresentes(m, 'touffe', saison).length === 0) bits |= REPLI.HERBE_HAUTE;
  return bits;
}

/** Vrai si le manifeste porte une image du pont dans la vue qu'il faut pour cet axe. */
export function vuePont(axe: 'ns' | 'eo'): VueSprite {
  // Le GLB du pont regarde +Z et sa circulation court le long de Z : en vue
  // `fixe` (lacet 0, il regarde le joueur) le tablier descend l'écran — un pont
  // nord-sud ; en vue `travers` (lacet 90), il le traverse — un pont est-ouest.
  return axe === 'ns' ? 'fixe' : 'travers';
}

/** L'identifiant du pont dans le manifeste : celui de son GLB. */
export const ID_PONT = 'terrain_pont';

/** Vrai si les deux vues du pont ont été cuites : le tablier du nuanceur s'efface alors. */
export function pontCuit(manifeste: ManifesteSprites | null): boolean {
  const e = manifesteLisible(manifeste)?.entrees[ID_PONT];
  return !!e && animationDeVue(e, 'fixe') >= 0 && animationDeVue(e, 'travers') >= 0;
}

// ---------------------------------------------------------------------------
// Le brouillard
// ---------------------------------------------------------------------------

/**
 * La largeur de la transition du brouillard, en cases : une demi-case, prise
 * **du côté vu** — une case cachée est noire d'un bord à l'autre, rien d'elle
 * ne transparaît, et c'est la case vue qui s'assombrit en approchant du noir.
 */
export const TRANSITION_BROUILLARD = 0.5;

function lisser(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * La visibilité au point `(x, y)` du sol, en cases, dans [0, 1] : 0 sur une
 * case cachée, 1 à une demi-case ou plus de toute case cachée. C'est la formule
 * du nuanceur (`visibiliteEn`), pour que le décor s'assombrisse comme le sol.
 */
export function visibiliteEn(
  brouillard: Uint8Array | null, largeur: number, hauteur: number, x: number, y: number,
): number {
  if (!brouillard) return 1;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const cachee = (vx: number, vy: number): boolean =>
    vx >= 0 && vy >= 0 && vx < largeur && vy < hauteur && (brouillard[vy * largeur + vx] ?? 255) < 128;
  if (cachee(cx, cy)) return 0;
  let d = 9;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx !== 0 || dy !== 0) && cachee(cx + dx, cy + dy)) {
        const qx = Math.max(cx + dx - x, x - (cx + dx + 1), 0);
        const qy = Math.max(cy + dy - y, y - (cy + dy + 1), 0);
        d = Math.min(d, Math.hypot(qx, qy));
      }
    }
  }
  return lisser(0, TRANSITION_BROUILLARD, d);
}

// ---------------------------------------------------------------------------
// Le placement
// ---------------------------------------------------------------------------

/** Ce que le placement lit. */
export interface ContextePlacement {
  grille: GrilleSol;
  biome: Biome;
  saison: Saison;
  manifeste: ManifesteSprites | null;
  /** `niveauxBrouillard` du contrat ; `null` : tout est vu. */
  brouillard: Uint8Array | null;
}

/** Ce qu'une place attend : l'essence exacte se décide sur ce qui est cuit. */
export type GenreDecor = 'arbre' | 'montagne' | 'touffe' | 'buisson' | 'roseau' | 'rocher' | 'pont';

/** Une place, avant qu'on lui cherche une image. */
export interface PlaceDecor {
  genre: GenreDecor;
  x: number;
  y: number;
  echelle: number;
  /** Un aléa pour choisir la variante. */
  tirage: number;
  /** Un aléa pour choisir l'essence d'un arbre. */
  choix: number;
  /** Pour un pont : son axe. */
  axe?: 'ns' | 'eo';
}

/**
 * Les emplacements des arbres d'une forêt, en fraction de case : deux au fond,
 * deux sur les flancs avant, un cinquième au fond au milieu. Le devant du
 * centre reste dégagé — c'est là qu'une unité se tient, face au joueur.
 */
export const EMPLACEMENTS_ARBRES: readonly (readonly [number, number])[] = [
  [0.5, 0.14], [0.25, 0.24], [0.75, 0.27], [0.15, 0.64], [0.85, 0.68],
];

/** Choisit une essence dans un tirage pondéré. */
function choisir(t: Tirage, a: number): EssenceDecor | null {
  let cumul = 0;
  for (const [e, p] of t) {
    cumul += p;
    if (a < cumul) return e;
  }
  return t.length > 0 ? t[t.length - 1]![0] : null;
}

/** Une position en couronne autour du centre, tirée de deux aléas. */
function couronne(x: number, y: number, a: number, b: number, rMin: number, rMax: number): [number, number] {
  const angle = a * Math.PI * 2;
  const r = rMin + (rMax - rMin) * b;
  return [x + 0.5 + Math.cos(angle) * r, y + 0.5 + Math.sin(angle) * r * 0.9];
}

/** Vrai si la case touche l'eau par un de ses côtés, et rend ce côté. */
function coteEau(g: GrilleSol, x: number, y: number): number {
  for (let d = 0; d < 4; d += 1) {
    const [dx, dy] = DIRECTIONS[d]!;
    const vx = x + dx;
    const vy = y + dy;
    if (vx < 0 || vy < 0 || vx >= g.largeur || vy >= g.hauteur) continue;
    if (TERRAINS_EAU.has(terrainEn(g, vx, vy))) return d;
  }
  return -1;
}

/** Vrai si la case touche la mer par un côté. */
function coteMer(g: GrilleSol, x: number, y: number): number {
  for (let d = 0; d < 4; d += 1) {
    const [dx, dy] = DIRECTIONS[d]!;
    const vx = x + dx;
    const vy = y + dy;
    if (vx < 0 || vy < 0 || vx >= g.largeur || vy >= g.hauteur) continue;
    if (terrainEn(g, vx, vy) === 'mer') return d;
  }
  return -1;
}

/**
 * Les places d'une case : tout ce que son terrain et son biome y sèment, sans
 * regarder le manifeste — c'est ce qui rend les densités testables.
 */
export function placesDeCase(g: GrilleSol, biome: Biome, x: number, y: number, rochers: boolean): PlaceDecor[] {
  const t: CleTerrain = terrainEn(g, x, y);
  const places: PlaceDecor[] = [];
  const a = (sel: number): number => aleaCase(x, y, sel);

  if (t === 'foret') {
    const nombre = entre(a(1), 3, 5);
    // Les trois emplacements obligatoires, puis le fond au milieu, puis le
    // flanc gauche : trois à cinq arbres sans jamais dégager tout un côté.
    const ordre = [1, 2, 4, 0, 3].slice(0, nombre).sort((i, j) => i - j);
    for (const k of ordre) {
      const [ex, ey] = EMPLACEMENTS_ARBRES[k]!;
      places.push({
        genre: 'arbre',
        x: x + ex + (a(10 + k) - 0.5) * 0.07,
        y: y + ey + (a(20 + k) - 0.5) * 0.06,
        echelle: 0.9 + a(30 + k) * 0.2,
        tirage: a(40 + k),
        choix: a(45 + k),
      });
    }
  } else if (t === 'herbe_haute') {
    const nombre = entre(a(2), 2, 4);
    for (let i = 0; i < nombre; i += 1) {
      const [px, py] = couronne(x, y, (i + a(50 + i) * 0.6) / nombre, a(60 + i), 0.22, 0.38);
      places.push({ genre: 'touffe', x: px, y: py, echelle: 0.85 + a(70 + i) * 0.3, tirage: a(80 + i), choix: 0 });
    }
  } else if (t === 'montagne') {
    places.push({
      genre: 'montagne',
      x: x + 0.5 + (a(3) - 0.5) * 0.06,
      y: y + 0.5 + (a(4) - 0.5) * 0.04,
      echelle: 0.95 + a(5) * 0.1,
      tirage: a(6),
      choix: 0,
    });
  } else if (t === 'pont') {
    places.push({ genre: 'pont', x: x + 0.5, y: y + 0.5, echelle: 1, tirage: 0, choix: 0, axe: axePont(g, x, y) });
  }

  // Les buissons, épars, sur la plaine et les hautes herbes.
  if ((t === 'plaine' || t === 'herbe_haute') && a(7) < CHANCE_BUISSON[biome]) {
    const nombre = entre(a(8), 1, 2);
    for (let i = 0; i < nombre; i += 1) {
      const [px, py] = couronne(x, y, a(90 + i), a(100 + i), 0.3, 0.42);
      places.push({ genre: 'buisson', x: px, y: py, echelle: 0.85 + a(110 + i) * 0.25, tirage: a(120 + i), choix: 0 });
    }
  }

  // Les roseaux, au bord de l'eau : en nombre au marais, de loin en loin ailleurs.
  if (t === 'plaine' || t === 'herbe_haute' || t === 'plage' || t === 'foret') {
    const d = coteEau(g, x, y);
    const chance = biome === 'marais' ? 0.7 : biome === 'desert' || biome === 'neige' || biome === 'volcanique' ? 0 : 0.2;
    if (d >= 0 && a(9) < chance) {
      const nombre = biome === 'marais' ? entre(a(11), 2, 3) : entre(a(11), 1, 2);
      const [dx, dy] = DIRECTIONS[d]!;
      for (let i = 0; i < nombre; i += 1) {
        const leLong = (a(130 + i) - 0.5) * 0.7;
        places.push({
          genre: 'roseau',
          x: x + 0.5 + dx * 0.38 + (dx === 0 ? leLong : 0),
          y: y + 0.5 + dy * 0.36 + (dy === 0 ? leLong : 0),
          echelle: 0.85 + a(140 + i) * 0.3,
          tirage: a(150 + i),
          choix: 0,
        });
      }
    }
  }

  // Les rochers de côte, rares : sur la grève ou dans les premiers mètres d'eau.
  if (rochers) {
    if ((t === 'plage' || t === 'plaine') && a(12) < 0.14) {
      const d = coteMer(g, x, y);
      if (d >= 0) {
        const [dx, dy] = DIRECTIONS[d]!;
        places.push({
          genre: 'rocher',
          x: x + 0.5 + dx * 0.3 + (a(13) - 0.5) * 0.3 * (dx === 0 ? 1 : 0),
          y: y + 0.5 + dy * 0.3 + (a(13) - 0.5) * 0.3 * (dy === 0 ? 1 : 0),
          echelle: 0.8 + a(14) * 0.35,
          tirage: 0,
          choix: 0,
        });
      }
    } else if (t === 'mer' && a(15) < 0.06) {
      for (let d = 0; d < 4; d += 1) {
        const [dx, dy] = DIRECTIONS[d]!;
        const vx = x + dx;
        const vy = y + dy;
        if (vx < 0 || vy < 0 || vx >= g.largeur || vy >= g.hauteur) continue;
        const voisin = terrainEn(g, vx, vy);
        if (!TERRAINS_EAU.has(voisin) && voisin !== 'pont') {
          places.push({
            genre: 'rocher', x: x + 0.5 + dx * 0.32, y: y + 0.5 + dy * 0.32, echelle: 0.7 + a(16) * 0.3, tirage: 0, choix: 0,
          });
          break;
        }
      }
    }
  }
  return places;
}

/**
 * Place le décor d'une carte. Rend des instances **triées par ligne**, du fond
 * vers le joueur — le moteur les re-trie avec les bâtiments, mais un lot déjà
 * trié se trie pour presque rien.
 */
export function placerDecor(ctx: ContextePlacement): InstanceSprite[] {
  const manifeste = manifesteLisible(ctx.manifeste);
  const { grille: g, biome, saison, brouillard } = ctx;
  if (!manifeste) return [];

  const arbres = arbresCuits(manifeste, biome, saison);
  const montagne = montagneCuite(manifeste, biome, saison);
  const variantes = new Map<EssenceDecor, string[]>();
  const idsDe = (e: EssenceDecor): string[] => {
    let ids = variantes.get(e);
    if (!ids) {
      ids = variantesPresentes(manifeste, e, saison);
      variantes.set(e, ids);
    }
    return ids;
  };
  const rocher = rocherDe(biome);
  const entreeRocher = rocher ? manifeste.entrees[rocher] : undefined;
  const animRocher = entreeRocher ? animationDeVue(entreeRocher, 'fixe') : -1;
  const entreePont = manifeste.entrees[ID_PONT];

  const sortie: InstanceSprite[] = [];
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      // Une case cachée ne rend rien : pas même une silhouette noire.
      if (brouillard && (brouillard[y * g.largeur + x] ?? 255) < 128) continue;
      for (const p of placesDeCase(g, biome, x, y, animRocher >= 0)) {
        let entree: string | null = null;
        let animation = 0;
        if (p.genre === 'pont') {
          if (!entreePont || !p.axe) continue;
          animation = animationDeVue(entreePont, vuePont(p.axe));
          if (animation < 0) continue;
          entree = ID_PONT;
        } else if (p.genre === 'rocher') {
          if (!rocher) continue;
          entree = rocher;
          animation = animRocher;
        } else {
          const essence: EssenceDecor | null = p.genre === 'arbre'
            ? choisir(arbres, p.choix)
            : p.genre === 'montagne' ? montagne : p.genre;
          if (!essence) continue;
          const ids = idsDe(essence);
          if (ids.length === 0) continue;
          entree = ids[Math.min(ids.length - 1, Math.floor(p.tirage * ids.length))]!;
          const e = manifeste.entrees[entree];
          animation = e ? animationDeVue(e, 'fixe') : -1;
          if (animation < 0) continue;
        }
        const vue = visibiliteEn(brouillard, g.largeur, g.hauteur, p.x, p.y);
        const instance: InstanceSprite = { entree, animation, cadre: 0, x: p.x, y: p.y };
        if (p.echelle !== 1) instance.echelle = p.echelle;
        if (vue < 1) instance.vue = vue;
        sortie.push(instance);
      }
    }
  }
  sortie.sort((a, b) => a.y - b.y || a.x - b.x);
  return sortie;
}
